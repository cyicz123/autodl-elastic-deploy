---
name: autodl-elastic-deploy
description: 通过 AutoDL 私有云弹性部署 API 批量调度和管理 GPU 容器。支持创建部署(ReplicaSet/Job/Container)、查询容器状态、设置副本数、停止/删除部署等操作。当用户提到 AutoDL、弹性部署、GPU 容器调度、批量创建容器、私有云部署时使用。
---

# AutoDL 私有云弹性部署

## 概述

弹性部署通过 API 或网页批量调度和启动 GPU 容器，并管理容器生命周期。

- **API HOST**: `https://private.autodl.com`
- **鉴权**: 在请求 Header 中添加 `Authorization: <token>`（控制台 → 设置 → 开发者Token）
- **Token 存储**: token 存放在与本 SKILL.md **同级目录**的 `.env` 文件中，格式见 `.env.example`

### Token 初始化流程（由 agent 执行）

使用本 skill 前，先检查同级目录下是否存在 `.env` 文件：
1. 若 `.env` **已存在**，直接读取其中的 `AUTODL_TOKEN` 值作为后续请求的鉴权 token
2. 若 `.env` **不存在**，向用户提问获取 token（提示用户在 AutoDL 控制台 → 设置 → 开发者Token 中获取），然后复制 `.env.example` 为 `.env`，将 `your_token_here` 替换为用户输入的实际 token 值

## 核心概念

### 算力调度单元

系统将主机的 CPU 和内存按 GPU 数量等比例划分为不可拆分的调度单元。例如：8卡3090、128核CPU、720GB内存 → 每个调度单元为 `3090×1 + 16vCPU + 90GB`。容器配置只能为该调度单元的 1~N 倍。

### 三种部署类型

| 类型 | 说明 |
|------|------|
| **ReplicaSet** | 维持指定数量的运行容器副本。修改条件/数量时自动增减容器 |
| **Job** | 创建容器直到完成指定数量，完成后不再启动新容器 |
| **Container** | 创建单个容器直到结束，等价于 replica_num=1 的 Job |

### 容器生命周期

容器生命周期 = `cmd` 命令执行周期。cmd 结束则容器关机。

- **前台运行**（推荐）: `python app.py`
- **后台运行**: `nohup python app.py & && sleep infinity`（需要 sleep infinity 阻止父进程退出）
- **Conda 环境**: 不要用 `conda activate`，直接用 `/root/miniconda3/envs/my-env/bin/python xxx.py`

### 容器复用

设置 `reuse_container: true` 可复用已停止容器（系统保留最长7天），显著缩短镜像拉取时间。复用时不清理原容器数据。

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
| 获取 GPU 库存 | GET | `/api/v1/dev/machine/gpu_stock` |

## CUDA 版本映射

| CUDA 版本 | `cuda_v` 值 |
|-----------|------------|
| 11.1 | 111 |
| 11.3 | 113 |
| 11.6 | 116 |
| 11.7 | 117 |
| 11.8 | 118 |
| 12.0 | 120 |
| 12.2 | 122 |

选择不低于所需 CUDA 版本的最小可选值（高版本驱动兼容低版本 CUDA）。

## 基本用法

所有请求均需在 Header 中携带 token。agent 按上述"Token 初始化流程"获取 token 后，在 Python 代码中直接使用：

```python
import requests

TOKEN = "<从 .env 文件中读取到的 AUTODL_TOKEN 值>"

headers = {
    "Authorization": TOKEN,
    "Content-Type": "application/json"
}
```

创建 ReplicaSet 部署示例：

```python
url = "https://private.autodl.com/api/v1/dev/deployment"
body = {
    "name": "my-deployment",
    "deployment_type": "ReplicaSet",
    "replica_num": 2,
    "reuse_container": True,
    "container_template": {
        "gpu_name_set": ["RTX A5000"],
        "gpu_num": 1,
        "cuda_v": 118,
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
resp = requests.post(url, json=body, headers=headers)
print(resp.json())
# 返回: {"code": "Success", "data": {"deployment_uuid": "xxx"}}
```

## 最佳实践

1. **镜像**: 静态环境打入镜像，避免频繁更新；变更频繁的代码/模型放网络存储
2. **启动命令**: 不要后台执行（`&`），否则父进程退出容器即关闭
3. **路径**: 先 cd 再执行，如 `cd /root && python app.py`
4. **复杂命令**: 写成 shell 脚本放入镜像或文件存储中
5. **异常调试**: 将 cmd 改为 `sleep infinity` 保持容器运行，SSH 登录后手动排查

### ⚠️ 常见陷阱

**`&&` 与 `||` 组合会导致 Job 类型部署无法停止**

避免使用 `cmd1 && cmd2 || cmd3` 模式，这会导致容器持续运行不停止。

```bash
# ❌ 避免使用
ls /data && process || echo "fallback"

# ✅ 改用分号分隔
ls /data ; process ; true
```

## 详细参考

- 完整 API 参数与响应格式，见 [api-reference.md](api-reference.md)
- 常用场景代码示例，见 [examples.md](examples.md)
