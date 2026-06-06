# AutoDL 弹性部署 API 完整参考

所有请求 HOST: `https://private.autodl.com`

鉴权 Header: `Authorization: <token>`

---

## 1. 获取镜像列表

**POST** `/api/v1/dev/image/private/list`

### 请求参数

| 参数 | 类型 | 必须 | 说明 |
|------|------|------|------|
| page_index | Int | 是 | 页码 |
| page_size | Int | 是 | 每页条目数 |
| offset | Int | 否 | 起始偏移量 |

### 响应 data.list 对象

| 字段 | 类型 | 说明 |
|------|------|------|
| id | Int | 镜像 ID |
| image_uuid | String | 镜像 UUID（用于创建部署） |
| name | String | 镜像名称 |
| status | String | 镜像状态 |

---

## 2. 创建部署

**POST** `/api/v1/dev/deployment`

### 请求参数（顶层）

| 参数 | 类型 | 必须 | 说明 |
|------|------|------|------|
| name | String | 是 | 部署名称 |
| deployment_type | String | 是 | `ReplicaSet` / `Job` / `Container` |
| replica_num | Int | ReplicaSet/Job 必填 | 容器副本数量 |
| parallelism_num | Int | Job 必填 | 同时运行的容器容量 |
| reuse_container | Bool | 否 | 是否复用已停止容器 |
| container_template | Object | 是 | 容器模板（见下表） |

### container_template 对象

| 参数 | 类型 | 必须 | 说明 |
|------|------|------|------|
| dc_list | List\<String\> | 是 | 可调度数据中心/区域标识列表 |
| service_6006_port_protocol | String | 否 | 6006 端口协议，如 `http` |
| service_6008_port_protocol | String | 否 | 6008 端口协议，如 `http` |
| cuda_v_from | Int | 是 | CUDA 最低版本值（如 118 表示 11.8） |
| cuda_v_to | Int | 是 | CUDA 最高版本值（如 122 表示 12.2） |
| gpu_name_set | List\<String\> | 是 | 可调度的 GPU 型号列表 |
| gpu_num | Int | 是 | 所需 GPU 数量 |
| memory_size_from | Int | 是 | 内存下限（GB） |
| memory_size_to | Int | 是 | 内存上限（GB） |
| cpu_num_from | Int | 是 | CPU 核心数下限 |
| cpu_num_to | Int | 是 | CPU 核心数上限 |
| price_from | Int | 是 | 价格下限（元×1000，如 0.1元 = 100） |
| price_to | Int | 是 | 价格上限（元×1000） |
| image_uuid | String | 是 | 镜像 UUID |
| cmd | String | 是 | 启动命令（见下方陷阱警告） |

**⚠️ cmd 参数陷阱警告**

**`&&` 与 `||` 组合会导致容器无法停止**

使用 `&&` 和 `||` 组合命令（如 `cmd1 && cmd2 || cmd3`）会导致 Job 类型部署无法正确判断命令结束，容器将持续运行不停止。

| 命令模式 | 结果 |
|---------|------|
| `ls ; echo ; ls` | ✅ 正常停止 |
| `ls && echo && ls` | ✅ 正常停止 |
| `ls && echo \|\| fallback` | ❌ **卡住不停止** |

**推荐写法**：
```bash
# ❌ 避免使用
ls /data && process || echo "fallback"

# ✅ 改用分号 + if 语句
ls /data ; process ; if [ $? -ne 0 ]; then echo "fallback"; fi

# ✅ 或忽略错误继续执行
ls /data ; process ; true
```

### 响应

```json
{
    "code": "Success",
    "msg": "",
    "data": {
        "deployment_uuid": "833f1cd5a764fa3"
    }
}
```

---

## 3. 获取部署列表

**POST** `/api/v1/dev/deployment/list`

### 请求参数

| 参数 | 类型 | 必须 | 说明 |
|------|------|------|------|
| page_index | Int | 是 | 页码 |
| page_size | Int | 是 | 每页条目数 |

### 响应 data.list 对象

| 字段 | 类型 | 说明 |
|------|------|------|
| uuid | String | 部署 UUID |
| name | String | 部署名称 |
| deployment_type | String | 部署类型 |
| status | String | 状态 |
| replica_num | Int | 副本数量 |
| parallelism_num | Int | 并行数量 |
| reuse_container | Bool | 是否复用容器 |
| starting_num | Int | 启动中数量 |
| running_num | Int | 运行中数量 |
| finished_num | Int | 已完成数量 |
| image_uuid | String | 镜像 UUID |
| template | Object | 容器模板配置 |

---

## 4. 查询容器事件

**POST** `/api/v1/dev/deployment/container/event/list`

通过轮询 offset 参数获取最新事件。

### 请求参数

| 参数 | 类型 | 必须 | 说明 |
|------|------|------|------|
| deployment_uuid | String | 是 | 部署 UUID |
| deployment_container_uuid | String | 否 | 容器 UUID（筛选特定容器） |
| page_index | Int | 是 | 页码 |
| page_size | Int | 是 | 每页条目数 |
| offset | Int | 否 | 起始偏移量 |

### 响应 data.list 对象

| 字段 | 类型 | 说明 |
|------|------|------|
| deployment_container_uuid | String | 容器 UUID |
| status | String | 状态类型 |
| created_at | String | 状态发生时间 |

容器状态流转: `creating` → `created` → `starting` → `oss_merged` → `running` → `shutting_down` → `shutdown`

---

## 5. 查询容器

**POST** `/api/v1/dev/deployment/container/list`

容器内部可通过环境变量 `AutoDLContainerUUID` 获取容器 UUID。

### 请求参数

| 参数 | 类型 | 必须 | 说明 |
|------|------|------|------|
| deployment_uuid | String | 是 | 部署 UUID |
| container_uuid | String | 否 | 筛选容器 UUID |
| date_from | String | 否 | 创建时间起始 |
| date_to | String | 否 | 创建时间结束 |
| gpu_name | String | 否 | 筛选 GPU 型号 |
| cpu_num_from / cpu_num_to | Int | 否 | 筛选 CPU 范围 |
| memory_size_from / memory_size_to | Int | 否 | 筛选内存范围 |
| price_from / price_to | Float | 否 | 筛选价格范围 |
| released | Bool | 否 | 是否查询已释放实例 |
| page_index | Int | 是 | 页码（缺省 0） |
| page_size | Int | 是 | 每页数量（缺省 10） |

### 响应 data.list 对象

| 字段 | 类型 | 说明 |
|------|------|------|
| uuid | String | 容器 UUID |
| deployment_uuid | String | 部署 UUID |
| machine_id | String | 主机 UUID |
| status | String | 容器状态 |
| gpu_name | String | GPU 型号 |
| gpu_num | Int | GPU 数量 |
| cpu_num | Int | CPU 数量 |
| memory_size | Int | 内存大小（byte） |
| image_uuid | String | 镜像 UUID |
| price | Float | 基准价格（元×1000） |
| info.ssh_command | String | SSH 登录指令 |
| info.root_password | String | SSH 密码 |
| info.service_url | String | 自定义服务地址 |
| started_at | String | 开始运行时间 |
| stopped_at | String | 停止时间 |

---

## 6. 停止某容器

**PUT** `/api/v1/dev/deployment/container/stop`

### 请求参数

| 参数 | 类型 | 必须 | 说明 |
|------|------|------|------|
| deployment_container_uuid | String | 是 | 容器 UUID |
| decrease_one_replica_num | Bool | 否 | 同时将 ReplicaSet 副本数减 1（仅 ReplicaSet 有效） |

### 响应

```json
{"code": "Success", "msg": "", "data": null}
```

---

## 7. 设置副本数量

**PUT** `/api/v1/dev/deployment/replica_num`

仅支持 ReplicaSet 类型。

### 请求参数

| 参数 | 类型 | 必须 | 说明 |
|------|------|------|------|
| deployment_uuid | String | 是 | 部署 UUID |
| replica_num | Int | 是 | 目标副本数量 |

### 响应

```json
{"code": "Success", "msg": "", "data": null}
```

---

## 8. 停止部署

**PUT** `/api/v1/dev/deployment/operate`

### 请求参数

| 参数 | 类型 | 必须 | 说明 |
|------|------|------|------|
| deployment_uuid | String | 是 | 部署 UUID |
| operate | String | 是 | 固定为 `"stop"` |

### 响应

```json
{"code": "Success", "msg": "", "data": null}
```

---

## 9. 删除部署

**DELETE** `/api/v1/dev/deployment`

未停止的部署会先自动停止再删除。

### 请求参数

| 参数 | 类型 | 必须 | 说明 |
|------|------|------|------|
| deployment_uuid | String | 是 | 部署 UUID |

### 响应

```json
{"code": "Success", "msg": "", "data": null}
```

---

## 10. 设置调度黑名单

**POST** `/api/v1/dev/deployment/blacklist`

将指定容器所在主机设为禁止调度状态（24小时后自动解除）。

### 请求参数

| 参数 | 类型 | 必须 | 说明 |
|------|------|------|------|
| deployment_container_uuid | String | 是 | 容器 UUID |
| comment | String | 否 | 备注信息 |

### 响应

```json
{"code": "Success", "msg": "", "data": null}
```

---

## 11. 获取弹性部署 GPU 库存

**GET** `/api/v1/dev/machine/gpu_stock`

无请求参数。

### 响应示例

```json
{
    "code": "Success",
    "data": [
        {"RTX 4090": {"idle_gpu_num": 215, "total_gpu_num": 2285}},
        {"RTX 3080 Ti": {"idle_gpu_num": 20, "total_gpu_num": 392}}
    ]
}
```

## 12. 获取区域 GPU 库存

**POST** `/api/v1/dev/machine/region/gpu_stock`

### 请求参数

| 参数 | 类型 | 必须 | 说明 |
|------|------|------|------|
| region_sign | String | 否 | 区域标识 |
| dc_list | List\<String\> | 否 | 数据中心/区域标识列表 |

### 响应

响应 data 结构与全局库存一致，CLI 会归一化为：

```json
{
    "RTX 4090": {"idle": 215, "total": 2285}
}
```

---

## 通用响应格式

所有接口响应结构：

```json
{
    "code": "Success",   // 成功时为 "Success"
    "msg": "",           // 错误时包含错误信息
    "data": {}           // 响应数据
}
```
