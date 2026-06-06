---
name: autodl-elastic-deploy
description: 通过 AutoDL 私有云弹性部署 API 批量调度和管理 GPU 容器。支持创建部署(ReplicaSet/Job/Container)、查询容器状态、设置副本数、停止/删除部署等操作。当用户提到 AutoDL、弹性部署、GPU 容器调度、批量创建容器、私有云部署时使用。
---

# AutoDL 私有云弹性部署

## 概述

弹性部署通过私有云 API 批量调度 GPU 容器，并管理部署、容器和黑名单。

- **API HOST**: `https://private.autodl.com`
- **Host override**: `AUTODL_ELASTIC_HOST`
- **鉴权**: 请求 Header 添加 `Authorization: <token>`
- **Token 顺序**: `AUTODL_ELASTIC_TOKEN`，然后兼容 fallback `AUTODL_TOKEN`，读取范围只限本 skill 同级 `.env`
- **CLI**: `node <SKILL_DIR>/autodl-elastic.mjs ...`

使用前若 `.env` 不存在，复制 `.env.example` 为 `.env` 并写入 `AUTODL_ELASTIC_TOKEN`。不要读取兄弟 skill 的 `.env`。

## Dry-run 回答要求

当用户要求“只给命令 / dry-run / review / 不要执行 / 先看 payload”时，不要调用 AutoDL API。回答必须明确写出 `not executed` 和 `no live API call`，并同时给出：

- CLI 命令：例如 `node <SKILL_DIR>/autodl-elastic.mjs containers --deployment-uuid <uuid>`
- Host：默认 `https://private.autodl.com`，或说明 `AUTODL_ELASTIC_HOST`
- Token 命名空间：`AUTODL_ELASTIC_TOKEN`，fallback `AUTODL_TOKEN`
- API 端点：例如查询容器 `POST /api/v1/dev/deployment/container/list`、区域库存 `POST /api/v1/dev/machine/region/gpu_stock`、创建部署 `POST /api/v1/dev/deployment`
- 相关请求体或配置片段（创建部署、查询库存、查询容器等场景都要展示）

## 核心概念

| 类型 | 说明 |
|------|------|
| `ReplicaSet` | 维持指定数量的运行容器副本 |
| `Job` | 创建容器直到完成指定数量，需 `replica_num` 和 `parallelism_num` |
| `Container` | 创建单个容器，等价于单次调试/运行 |

容器生命周期由 `cmd` 决定。前台运行推荐 `python app.py`；若后台运行，必须用 `sleep infinity` 保持父进程不退出。Conda 环境建议直接调用解释器路径，例如 `/root/miniconda3/envs/my-env/bin/python app.py`。

## CLI 速查

```bash
node <SKILL_DIR>/autodl-elastic.mjs queue-submit <config.json> [--interval 30] [--timeout 0]
node <SKILL_DIR>/autodl-elastic.mjs images [--page-index 1] [--page-size 100]
node <SKILL_DIR>/autodl-elastic.mjs deployments [--page-index 1] [--page-size 10]
node <SKILL_DIR>/autodl-elastic.mjs containers --deployment-uuid <uuid> [--page-index 1] [--page-size 10]
node <SKILL_DIR>/autodl-elastic.mjs events --deployment-uuid <uuid> [--offset N]
node <SKILL_DIR>/autodl-elastic.mjs stop-container <container_uuid> [--decrease-one-replica-num] [--no-cache]
node <SKILL_DIR>/autodl-elastic.mjs set-replicas <deployment_uuid> <replica_num>
node <SKILL_DIR>/autodl-elastic.mjs stop-deployment <deployment_uuid>
node <SKILL_DIR>/autodl-elastic.mjs delete-deployment <deployment_uuid>
node <SKILL_DIR>/autodl-elastic.mjs blacklist <container_uuid> [--comment "..."]
node <SKILL_DIR>/autodl-elastic.mjs list-blacklist
node <SKILL_DIR>/autodl-elastic.mjs gpu-stock --region <region_sign> [--json <filters.json>]
```

`queue-submit` 是创建部署的推荐入口：它会先做本地参数校验、检查镜像、检查 GPU 库存，GPU 不足时轮询等待，资源就绪后提交。

## API 速查

| 操作 | 方法 | 端点 |
|------|------|------|
| 获取镜像列表 | POST | `/api/v1/dev/image/private/list` |
| 创建部署 | POST | `/api/v1/dev/deployment` |
| 获取部署列表 | POST | `/api/v1/dev/deployment/list` |
| 查询容器事件 | POST | `/api/v1/dev/deployment/container/event/list` |
| 查询容器 | POST | `/api/v1/dev/deployment/container/list` |
| 停止某容器 | PUT | `/api/v1/dev/deployment/container/stop` |
| 设置副本数量 | PUT | `/api/v1/dev/deployment/replica_num` |
| 停止部署 | PUT | `/api/v1/dev/deployment/operate` |
| 删除部署 | DELETE | `/api/v1/dev/deployment` |
| 设置调度黑名单 | POST | `/api/v1/dev/deployment/blacklist` |
| 获取全局 GPU 库存 | GET | `/api/v1/dev/machine/gpu_stock` |
| 获取区域 GPU 库存 | POST | `/api/v1/dev/machine/region/gpu_stock` |

## 配置文件格式

创建部署请求体使用新版 CUDA 范围字段：`cuda_v_from` 和 `cuda_v_to`。`cuda_v_from` / `cuda_v_to` are integer codes, not semantic version strings: `118` 表示 CUDA 11.8，`122` 表示 CUDA 12.2；do not write `"11.8"`, `"12.1"`, or `"12.8"`。旧 `cuda_v` 会被本地校验拒绝并提示迁移。

```json
{
  "name": "my-deployment",
  "deployment_type": "ReplicaSet",
  "replica_num": 2,
  "reuse_container": true,
  "container_template": {
    "dc_list": ["beijing"],
    "service_6006_port_protocol": "http",
    "service_6008_port_protocol": "http",
    "gpu_name_set": ["RTX 4090"],
    "gpu_num": 1,
    "cuda_v_from": 118,
    "cuda_v_to": 122,
    "cpu_num_from": 1,
    "cpu_num_to": 100,
    "memory_size_from": 1,
    "memory_size_to": 256,
    "cmd": "cd /root && python app.py",
    "price_from": 100,
    "price_to": 9000,
    "image_uuid": "image-xxxxxxxxxx"
  }
}
```

## 输出

成功输出：

```json
{
  "status": "success",
  "deployment_uuid": "833f1cd5a764fa3",
  "waited_seconds": 120
}
```

错误输出统一为结构化 JSON：

```json
{
  "status": "error",
  "error_type": "gpu_type_not_found",
  "message": "请求的 GPU 型号均不存在: [\"RTX 5090\"]",
  "details": {
    "requested": ["RTX 5090"],
    "available_gpus": ["RTX 4090", "RTX 3090"]
  }
}
```

## 错误处理

收到错误时，agent 必须根据 `error_type` 引导用户修正参数，而不是盲目重试。

| `error_type` | 含义 | agent 处理方式 |
|---|---|---|
| `validation_error` | 参数有误（范围反转、缺少字段、旧 `cuda_v` 等） | 展示 `details.errors`，询问如何修正 |
| `image_not_found` | 镜像 UUID 不存在 | 展示 `details.available_images`，让用户选择正确镜像 |
| `gpu_type_not_found` | 请求 GPU 型号均不存在 | 展示 `details.available_gpus`，让用户重新选择 |
| `submission_error` | GPU 有空闲但提交连续失败 | 说明这是 after 3 submit failures 的结果，展示 API 响应和 suggestion，引导调整 price / CPU / memory / CUDA；不要直接重试 |
| `timeout` | 等待 GPU 超时 | 展示 `details.last_stock`，建议放宽 GPU/区域或稍后重试 |
| `token_missing` | 本 skill `.env` 或环境变量无 token | 写入 `AUTODL_ELASTIC_TOKEN`，或兼容使用 `AUTODL_TOKEN` |
| `config_error` | 配置文件读取或 CLI 参数错误 | 检查路径、JSON 格式和参数 |
| `api_error` | HTTP、JSON 或 AutoDL API 通用错误 | 展示 message/details，必要时请用户确认后再重试 |

## 最佳实践

1. 镜像：静态环境打入镜像，变更频繁的代码/模型放网络存储。
2. 启动命令：不要单独后台执行，否则父进程退出容器即关闭。
3. 路径：先 `cd` 再执行，例如 `cd /root && python app.py`。
4. 调试：将 `cmd` 改为 `sleep infinity` 后 SSH 进入排查。
5. `cmd1 && cmd2 || fallback` 可能导致 Job 无法停止，优先用分号或显式 `if`。

## 详细参考

- 完整 API 参数与响应格式，见 [api-reference.md](api-reference.md)
- 常用 CLI 场景示例，见 [examples.md](examples.md)
