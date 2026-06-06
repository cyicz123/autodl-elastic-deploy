# AutoDL 弹性部署 CLI 示例

所有示例使用本 skill 同级目录的 `autodl-elastic.mjs`。先在同级 `.env` 中写入：

```bash
AUTODL_ELASTIC_TOKEN=your_token_here
AUTODL_ELASTIC_HOST=https://private.autodl.com
```

`AUTODL_TOKEN` 仅作为旧配置 fallback。

---

## 创建 ReplicaSet 并排队等待 GPU

`deploy-replicaset.json`:

```json
{
  "name": "inference-service",
  "deployment_type": "ReplicaSet",
  "replica_num": 4,
  "reuse_container": true,
  "container_template": {
    "dc_list": ["beijing"],
    "service_6006_port_protocol": "http",
    "service_6008_port_protocol": "http",
    "gpu_name_set": ["RTX 4090"],
    "gpu_num": 1,
    "cuda_v_from": 118,
    "cuda_v_to": 122,
    "cpu_num_from": 4,
    "cpu_num_to": 32,
    "memory_size_from": 16,
    "memory_size_to": 128,
    "cmd": "cd /root/app && python server.py",
    "price_from": 100,
    "price_to": 9000,
    "image_uuid": "image-xxxxxxxxxx"
  }
}
```

```bash
node skills/autodl-elastic-deploy/autodl-elastic.mjs queue-submit deploy-replicaset.json --interval 30 --timeout 3600
```

---

## 创建 Job 批量训练

`deploy-job.json`:

```json
{
  "name": "batch-training",
  "deployment_type": "Job",
  "replica_num": 10,
  "parallelism_num": 3,
  "reuse_container": true,
  "container_template": {
    "dc_list": ["beijing", "shanghai"],
    "gpu_name_set": ["RTX 4090", "RTX 3090"],
    "gpu_num": 1,
    "cuda_v_from": 118,
    "cuda_v_to": 122,
    "cpu_num_from": 4,
    "cpu_num_to": 64,
    "memory_size_from": 16,
    "memory_size_to": 256,
    "cmd": "cd /root/train && python train.py --config /root/nas/config.yaml",
    "price_from": 100,
    "price_to": 9000,
    "image_uuid": "image-xxxxxxxxxx"
  }
}
```

```bash
node skills/autodl-elastic-deploy/autodl-elastic.mjs queue-submit deploy-job.json --timeout 0
```

---

## 创建单容器调试

`debug.json`:

```json
{
  "name": "debug-session",
  "deployment_type": "Container",
  "reuse_container": true,
  "container_template": {
    "dc_list": ["beijing"],
    "gpu_name_set": ["RTX 4090"],
    "gpu_num": 1,
    "cuda_v_from": 118,
    "cuda_v_to": 122,
    "cpu_num_from": 4,
    "cpu_num_to": 64,
    "memory_size_from": 16,
    "memory_size_to": 128,
    "cmd": "sleep infinity",
    "price_from": 100,
    "price_to": 9000,
    "image_uuid": "image-xxxxxxxxxx"
  }
}
```

```bash
node skills/autodl-elastic-deploy/autodl-elastic.mjs queue-submit debug.json
```

---

## 查看资源和对象

```bash
node skills/autodl-elastic-deploy/autodl-elastic.mjs images --page-size 100
node skills/autodl-elastic-deploy/autodl-elastic.mjs gpu-stock --region beijing
node skills/autodl-elastic-deploy/autodl-elastic.mjs deployments --page-index 1 --page-size 10
node skills/autodl-elastic-deploy/autodl-elastic.mjs containers --deployment-uuid deploy-xxxxxxxx --page-size 100
node skills/autodl-elastic-deploy/autodl-elastic.mjs events --deployment-uuid deploy-xxxxxxxx --offset 0
```

区域库存也可传额外过滤 JSON：

```bash
node skills/autodl-elastic-deploy/autodl-elastic.mjs gpu-stock --region beijing --json filters.json
```

---

## 生命周期管理

```bash
node skills/autodl-elastic-deploy/autodl-elastic.mjs set-replicas deploy-xxxxxxxx 8
node skills/autodl-elastic-deploy/autodl-elastic.mjs stop-container container-xxxxxxxx --decrease-one-replica-num
node skills/autodl-elastic-deploy/autodl-elastic.mjs blacklist container-xxxxxxxx --comment "容器频繁异常退出"
node skills/autodl-elastic-deploy/autodl-elastic.mjs list-blacklist
node skills/autodl-elastic-deploy/autodl-elastic.mjs stop-deployment deploy-xxxxxxxx
node skills/autodl-elastic-deploy/autodl-elastic.mjs delete-deployment deploy-xxxxxxxx
```
