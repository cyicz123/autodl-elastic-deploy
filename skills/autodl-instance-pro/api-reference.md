# AutoDL Instance Pro API Reference

All requests use host `https://api.autodl.com` unless `AUTODL_PRO_HOST` overrides it.

Authorization header:

```text
Authorization: <token>
Content-Type: application/json
```

Using Pro API requires personal or enterprise verification.

## Endpoints

| Operation | Method | Endpoint |
|---|---|---|
| Create instance | POST | `/api/v1/dev/instance/pro/create` |
| Snapshot/details | GET | `/api/v1/dev/instance/pro/snapshot` |
| Status | GET | `/api/v1/dev/instance/pro/status` |
| List instances | POST | `/api/v1/dev/instance/pro/list` |
| Power on | POST | `/api/v1/dev/instance/pro/power_on` |
| Power off | POST | `/api/v1/dev/instance/pro/power_off` |
| Release | POST | `/api/v1/dev/instance/pro/release` |
| Save image | POST | `/api/v1/dev/instance/pro/image/save` |
| List private images | POST | `/api/v1/dev/instance/pro/image/private/list` |

## Create Instance

**POST** `/api/v1/dev/instance/pro/create`

Required request fields:

| Field | Type | Notes |
|---|---|---|
| `req_gpu_amount` | Int | 1 through 4 |
| `expand_system_disk_by_gb` | Int | 0 through 500 |
| `gpu_spec_uuid` | String | GPU spec UUID |
| `image_uuid` | String | Image UUID |
| `cuda_v_from` | Int | Minimum CUDA version value |

## Snapshot And Status

**GET** `/api/v1/dev/instance/pro/snapshot`

```json
{"instance_uuid": "pro-xxxxxxxx"}
```

**GET** `/api/v1/dev/instance/pro/status`

```json
{"instance_uuid": "pro-xxxxxxxx"}
```

## List

**POST** `/api/v1/dev/instance/pro/list`

```json
{"page_index": 1, "page_size": 10}
```

## Power

**POST** `/api/v1/dev/instance/pro/power_on`

```json
{
  "instance_uuid": "pro-xxxxxxxx",
  "payload": "gpu",
  "start_command": "optional command"
}
```

`payload` is always `gpu`. `start_command` is omitted when not provided.

**POST** `/api/v1/dev/instance/pro/power_off`

```json
{"instance_uuid": "pro-xxxxxxxx"}
```

## Release

**POST** `/api/v1/dev/instance/pro/release`

```json
{"instance_uuid": "pro-xxxxxxxx"}
```

Power off first; the CLI does not perform an implicit power-off.

## Images

**POST** `/api/v1/dev/instance/pro/image/save`

```json
{
  "instance_uuid": "pro-xxxxxxxx",
  "image_name": "saved-image"
}
```

**POST** `/api/v1/dev/instance/pro/image/private/list`

```json
{"page_index": 1, "page_size": 10}
```

## Common Response

```json
{
  "code": "Success",
  "msg": "",
  "data": {}
}
```
