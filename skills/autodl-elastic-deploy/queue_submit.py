#!/usr/bin/env python3
"""
queue_submit.py - AutoDL elastic deployment with GPU resource queuing.

Validates deployment config, polls for GPU availability, then submits.
Outputs structured JSON to stdout; progress logs to stderr.

Usage:
    python queue_submit.py <config.json> [--interval 30] [--timeout 3600]

Exit codes: 0=success, 1=validation, 2=timeout, 3=API/runtime error
"""

import argparse
import json
import os
import sys
import time

try:
    import requests
except ImportError:
    print(json.dumps({
        "status": "error",
        "error_type": "dependency_missing",
        "message": "需要 requests 库: pip install requests"
    }))
    sys.exit(3)

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
HOST = "https://private.autodl.com"

VALID_DEPLOYMENT_TYPES = ("ReplicaSet", "Job", "Container")
KNOWN_CUDA_VERSIONS = (111, 113, 116, 117, 118, 120, 122)
MAX_SUBMIT_RETRIES = 3


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def load_token():
    token = os.environ.get("AUTODL_TOKEN")
    if token:
        return token
    env_path = os.path.join(SCRIPT_DIR, ".env")
    if not os.path.exists(env_path):
        return None
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if "=" in line:
                k, v = line.split("=", 1)
                if k.strip() == "AUTODL_TOKEN":
                    return v.strip()
    return None


def log(msg):
    print(msg, file=sys.stderr, flush=True)


def output_json(data):
    print(json.dumps(data, ensure_ascii=False, indent=2))


def fail(error_type, message, details=None, exit_code=1):
    out = {"status": "error", "error_type": error_type, "message": message}
    if details:
        out["details"] = details
    output_json(out)
    sys.exit(exit_code)


def api(method, path, token, body=None):
    headers = {"Authorization": token, "Content-Type": "application/json"}
    try:
        r = requests.request(
            method, f"{HOST}{path}", json=body, headers=headers, timeout=30
        )
        r.raise_for_status()
        return r.json()
    except requests.RequestException as e:
        fail("api_error", f"API 请求失败: {e}", exit_code=3)


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------

def validate_schema(config):
    """Local sanity checks. Returns a list of error strings (empty = OK)."""
    errors = []

    if "name" not in config:
        errors.append("缺少 name")

    dtype = config.get("deployment_type")
    if dtype not in VALID_DEPLOYMENT_TYPES:
        errors.append(
            f"无效 deployment_type '{dtype}'，可选: {', '.join(VALID_DEPLOYMENT_TYPES)}"
        )

    if dtype in ("ReplicaSet", "Job") and "replica_num" not in config:
        errors.append(f"{dtype} 需要 replica_num")
    if dtype == "Job" and "parallelism_num" not in config:
        errors.append("Job 需要 parallelism_num")

    t = config.get("container_template")
    if not t:
        errors.append("缺少 container_template")
        return errors

    required = [
        "gpu_name_set", "gpu_num", "cuda_v",
        "cpu_num_from", "cpu_num_to",
        "memory_size_from", "memory_size_to",
        "cmd", "price_from", "price_to", "image_uuid",
    ]
    missing = [f for f in required if f not in t]
    if missing:
        errors.append(f"container_template 缺少: {', '.join(missing)}")
        return errors

    if t["cpu_num_from"] > t["cpu_num_to"]:
        errors.append(f"cpu_num_from({t['cpu_num_from']}) > cpu_num_to({t['cpu_num_to']})")
    if t["memory_size_from"] > t["memory_size_to"]:
        errors.append(
            f"memory_size_from({t['memory_size_from']}) > memory_size_to({t['memory_size_to']})"
        )
    if t["price_from"] > t["price_to"]:
        errors.append(f"price_from({t['price_from']}) > price_to({t['price_to']})")
    if t["gpu_num"] < 1:
        errors.append(f"gpu_num({t['gpu_num']}) 必须 >= 1")
    if not t["gpu_name_set"]:
        errors.append("gpu_name_set 不能为空")
    if t["cuda_v"] not in KNOWN_CUDA_VERSIONS:
        errors.append(
            f"cuda_v({t['cuda_v']}) 不在已知版本列表 {list(KNOWN_CUDA_VERSIONS)}"
        )

    return errors


def fetch_all_images(token):
    """Return list of {uuid, name} for all private images."""
    all_imgs = []
    page = 1
    while True:
        r = api("POST", "/api/v1/dev/image/private/list", token, {
            "page_index": page, "page_size": 100
        })
        if r.get("code") != "Success":
            fail("api_error", f"查询镜像失败: {r.get('msg')}", exit_code=3)
        page_data = r.get("data", {})
        imgs = page_data.get("list", [])
        if not imgs:
            break
        for img in imgs:
            all_imgs.append({
                "uuid": img.get("image_uuid", ""),
                "name": img.get("image_name", ""),
            })
        max_page = page_data.get("max_page", page)
        if page >= max_page:
            break
        page += 1
    return all_imgs


def fetch_gpu_stock(token):
    """Return dict {gpu_name: {idle, total}}."""
    r = api("GET", "/api/v1/dev/machine/gpu_stock", token)
    if r.get("code") != "Success":
        fail("api_error", f"查询 GPU 库存失败: {r.get('msg')}", exit_code=3)
    raw = r.get("data", {})
    stock = {}
    if isinstance(raw, dict):
        for name, info in raw.items():
            if isinstance(info, dict):
                stock[name] = {
                    "idle": info.get("idle_gpu_num", 0),
                    "total": info.get("total_gpu_num", 0),
                }
    elif isinstance(raw, list):
        for item in raw:
            for name, info in item.items():
                stock[name] = {
                    "idle": info.get("idle_gpu_num", 0),
                    "total": info.get("total_gpu_num", 0),
                }
    return stock


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="AutoDL queued deployment submission"
    )
    parser.add_argument("config", help="Deployment config JSON file path")
    parser.add_argument(
        "--interval", type=int, default=30,
        help="GPU stock polling interval in seconds (default: 30)",
    )
    parser.add_argument(
        "--timeout", type=int, default=0,
        help="Max wait seconds, 0 = unlimited (default: 0)",
    )
    args = parser.parse_args()

    # ---- token ----
    token = load_token()
    if not token:
        fail("token_missing", ".env 中未找到 AUTODL_TOKEN")

    # ---- load config ----
    try:
        with open(args.config) as f:
            config = json.load(f)
    except Exception as e:
        fail("config_error", f"读取配置失败: {e}")

    t = config.get("container_template", {})
    gpu_names = t.get("gpu_name_set", [])
    gpu_num = t.get("gpu_num", 1)

    # ---- 1. schema validation ----
    log("[1/4] 验证配置参数...")
    errs = validate_schema(config)
    if errs:
        fail("validation_error", "配置参数有误", {"errors": errs})

    # ---- 2. image validation ----
    log("[2/4] 验证镜像是否存在...")
    all_images = fetch_all_images(token)
    if not any(img["uuid"] == t["image_uuid"] for img in all_images):
        fail("image_not_found", f"镜像 '{t['image_uuid']}' 不存在", {
            "requested": t["image_uuid"],
            "available_images": all_images,
        })

    # ---- 3. GPU type validation ----
    log("[3/4] 检查 GPU 库存...")
    stock = fetch_gpu_stock(token)
    available_types = sorted(stock.keys())
    existing = [g for g in gpu_names if g in stock]

    if not existing:
        fail("gpu_type_not_found",
             f"请求的 GPU 型号均不存在: {gpu_names}",
             {"requested": gpu_names, "available_gpus": available_types})

    missing_types = [g for g in gpu_names if g not in stock]
    if missing_types:
        log(f"  警告: GPU 型号 {missing_types} 不存在于系统中，将仅使用: {existing}")

    # ---- 4. poll & submit ----
    log("[4/4] 等待 GPU 资源...")
    start = time.time()
    attempt = 0
    submit_failures = 0

    while True:
        attempt += 1

        has_idle = any(
            stock.get(g, {}).get("idle", 0) >= gpu_num for g in gpu_names
        )

        if has_idle:
            matched = [
                f"{g}(空闲{stock[g]['idle']})"
                for g in gpu_names
                if stock.get(g, {}).get("idle", 0) >= gpu_num
            ]
            log(f"  资源可用 [{', '.join(matched)}]，正在提交部署...")

            r = api("POST", "/api/v1/dev/deployment", token, config)

            if r.get("code") == "Success":
                waited = int(time.time() - start)
                output_json({
                    "status": "success",
                    "deployment_uuid": r["data"]["deployment_uuid"],
                    "waited_seconds": waited,
                })
                sys.exit(0)

            submit_failures += 1
            err_msg = r.get("msg", "未知错误")

            if submit_failures >= MAX_SUBMIT_RETRIES:
                fail("submission_error",
                     f"部署提交连续失败 {MAX_SUBMIT_RETRIES} 次: {err_msg}",
                     {
                         "api_response": r,
                         "suggestion": "GPU 有空闲但提交失败，可能原因: "
                                       "价格范围无匹配机器、CPU/内存超出机器规格、"
                                       "CUDA 版本与 GPU 型号不兼容等",
                     },
                     exit_code=3)

            log(f"  提交失败 ({submit_failures}/{MAX_SUBMIT_RETRIES}): {err_msg}")
        else:
            idle_info = {
                g: stock[g]["idle"] for g in gpu_names if g in stock
            }
            log(f"  [轮询 #{attempt}] GPU 不足 "
                f"(需要 {gpu_num} 卡，当前空闲: {idle_info})，"
                f"{args.interval}s 后重试...")

        elapsed = time.time() - start
        if args.timeout > 0 and elapsed >= args.timeout:
            fail("timeout",
                 f"等待 GPU 资源超时 ({int(elapsed)}s)",
                 {
                     "elapsed_seconds": int(elapsed),
                     "timeout_seconds": args.timeout,
                     "last_stock": {
                         g: stock.get(g) for g in gpu_names if g in stock
                     },
                 },
                 exit_code=2)

        time.sleep(args.interval)
        stock = fetch_gpu_stock(token)


if __name__ == "__main__":
    main()
