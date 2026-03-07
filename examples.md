# AutoDL 弹性部署常用场景示例

所有示例共用以下 headers：

```python
import requests
import time

TOKEN = "您的token"
HOST = "https://private.autodl.com"
HEADERS = {
    "Authorization": TOKEN,
    "Content-Type": "application/json"
}
```

---

## 场景一：创建 ReplicaSet 部署并监控就绪

```python
# 1. 创建部署
resp = requests.post(f"{HOST}/api/v1/dev/deployment", json={
    "name": "inference-service",
    "deployment_type": "ReplicaSet",
    "replica_num": 4,
    "reuse_container": True,
    "container_template": {
        "gpu_name_set": ["RTX 4090"],
        "gpu_num": 1,
        "cuda_v": 118,
        "cpu_num_from": 4,
        "cpu_num_to": 32,
        "memory_size_from": 16,
        "memory_size_to": 128,
        "cmd": "cd /root/app && python server.py",
        "price_from": 100,
        "price_to": 9000,
        "image_uuid": "image-xxxxxxxxxx"
    }
}, headers=HEADERS)

deployment_uuid = resp.json()["data"]["deployment_uuid"]
print(f"部署已创建: {deployment_uuid}")

# 2. 轮询等待所有容器 running
while True:
    resp = requests.post(f"{HOST}/api/v1/dev/deployment/container/list", json={
        "deployment_uuid": deployment_uuid,
        "page_index": 1,
        "page_size": 100
    }, headers=HEADERS)
    containers = resp.json()["data"]["list"]
    running = [c for c in containers if c["status"] == "running"]
    print(f"运行中: {len(running)}/4")
    if len(running) >= 4:
        break
    time.sleep(10)

# 3. 获取所有容器的 SSH 和服务地址
for c in running:
    print(f"容器: {c['uuid']}")
    print(f"  SSH: {c['info']['ssh_command']}")
    print(f"  密码: {c['info']['root_password']}")
    print(f"  服务: {c['info']['service_url']}")
```

---

## 场景二：创建 Job 批量训练

```python
resp = requests.post(f"{HOST}/api/v1/dev/deployment", json={
    "name": "batch-training",
    "deployment_type": "Job",
    "replica_num": 10,        # 总共需要完成 10 个容器
    "parallelism_num": 3,     # 同时运行 3 个
    "reuse_container": True,
    "container_template": {
        "gpu_name_set": ["RTX 4090", "RTX 3090"],
        "gpu_num": 1,
        "cuda_v": 118,
        "cpu_num_from": 4,
        "cpu_num_to": 64,
        "memory_size_from": 16,
        "memory_size_to": 256,
        "cmd": "cd /root/train && python train.py --config /root/nas/config.yaml",
        "price_from": 100,
        "price_to": 9000,
        "image_uuid": "image-xxxxxxxxxx"
    }
}, headers=HEADERS)

print(resp.json())
```

---

## 场景三：创建单个容器进行调试

```python
resp = requests.post(f"{HOST}/api/v1/dev/deployment", json={
    "name": "debug-session",
    "deployment_type": "Container",
    "reuse_container": True,
    "container_template": {
        "gpu_name_set": ["RTX 4090"],
        "gpu_num": 1,
        "cuda_v": 118,
        "cpu_num_from": 4,
        "cpu_num_to": 64,
        "memory_size_from": 16,
        "memory_size_to": 128,
        "cmd": "sleep infinity",  # 保持容器运行以便 SSH 调试
        "price_from": 100,
        "price_to": 9000,
        "image_uuid": "image-xxxxxxxxxx"
    }
}, headers=HEADERS)

print(resp.json())
```

---

## 场景四：动态扩缩容

```python
deployment_uuid = "your-deployment-uuid"

# 扩容到 8 副本
requests.put(f"{HOST}/api/v1/dev/deployment/replica_num", json={
    "deployment_uuid": deployment_uuid,
    "replica_num": 8
}, headers=HEADERS)

# 缩容到 2 副本
requests.put(f"{HOST}/api/v1/dev/deployment/replica_num", json={
    "deployment_uuid": deployment_uuid,
    "replica_num": 2
}, headers=HEADERS)
```

---

## 场景五：停止异常容器并加入黑名单

```python
container_uuid = "deployment-uuid-machine-id-container-id"

# 停止容器（同时减少副本数，避免 ReplicaSet 重新拉起）
requests.put(f"{HOST}/api/v1/dev/deployment/container/stop", json={
    "deployment_container_uuid": container_uuid,
    "decrease_one_replica_num": True
}, headers=HEADERS)

# 将该容器所在主机加入黑名单（24小时内不再调度）
requests.post(f"{HOST}/api/v1/dev/deployment/blacklist", json={
    "deployment_container_uuid": container_uuid,
    "comment": "容器频繁异常退出"
}, headers=HEADERS)
```

---

## 场景六：查看 GPU 库存后选择最优型号

```python
resp = requests.get(f"{HOST}/api/v1/dev/machine/gpu_stock", headers=HEADERS)
stocks = resp.json()["data"]

print("GPU 库存:")
for item in stocks:
    for gpu_name, info in item.items():
        idle = info["idle_gpu_num"]
        total = info["total_gpu_num"]
        print(f"  {gpu_name}: {idle}/{total} 空闲")
```

---

## 场景七：完整生命周期管理

```python
# 1. 创建部署
resp = requests.post(f"{HOST}/api/v1/dev/deployment", json={
    "name": "full-lifecycle-demo",
    "deployment_type": "ReplicaSet",
    "replica_num": 2,
    "reuse_container": True,
    "container_template": {
        "gpu_name_set": ["RTX 4090"],
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
}, headers=HEADERS)
deployment_uuid = resp.json()["data"]["deployment_uuid"]

# 2. 等待运行（同场景一的轮询逻辑）

# 3. 停止部署
requests.put(f"{HOST}/api/v1/dev/deployment/operate", json={
    "deployment_uuid": deployment_uuid,
    "operate": "stop"
}, headers=HEADERS)

# 4. 删除部署
requests.delete(f"{HOST}/api/v1/dev/deployment", json={
    "deployment_uuid": deployment_uuid
}, headers=HEADERS)
```
