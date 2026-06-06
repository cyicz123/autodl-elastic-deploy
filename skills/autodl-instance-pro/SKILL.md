---
name: autodl-instance-pro
description: Use when managing AutoDL public cloud container instance Pro resources, including creating instances, listing instances, checking status/details, power on/off, release, save images, and list private images through AutoDL Pro API.
---

# AutoDL Instance Pro

## Overview

Use this skill for AutoDL public cloud container instance Pro resources.

- **API host**: `https://api.autodl.com`
- **Host override**: `AUTODL_PRO_HOST`
- **Token order**: `AUTODL_PRO_TOKEN`, then fallback `AUTODL_TOKEN`, read only from this skill's local `.env`
- **CLI**: `node <SKILL_DIR>/autodl-pro.mjs ...`
- **Important**: Pro API access requires personal or enterprise verification.

Do not reuse Elastic private-cloud host/token variables. `AUTODL_ELASTIC_HOST` and `AUTODL_ELASTIC_TOKEN` belong to the sibling elastic deployment skill only.

## Commands

```bash
node <SKILL_DIR>/autodl-pro.mjs create --json <config.json>
node <SKILL_DIR>/autodl-pro.mjs snapshot <instance_uuid>
node <SKILL_DIR>/autodl-pro.mjs status <instance_uuid>
node <SKILL_DIR>/autodl-pro.mjs list [--page-index 1] [--page-size 10]
node <SKILL_DIR>/autodl-pro.mjs power-on <instance_uuid> [--start-command "..."]
node <SKILL_DIR>/autodl-pro.mjs power-off <instance_uuid>
node <SKILL_DIR>/autodl-pro.mjs release <instance_uuid>
node <SKILL_DIR>/autodl-pro.mjs save-image <instance_uuid> --name <image_name>
node <SKILL_DIR>/autodl-pro.mjs list-images [--page-index 1] [--page-size 10]
```

## Release Workflow

Release is destructive and the CLI does not silently power off first.

1. Check status.
2. Power off the instance.
3. Release the stopped instance.

```bash
node <SKILL_DIR>/autodl-pro.mjs status pro-xxxxxxxx
node <SKILL_DIR>/autodl-pro.mjs power-off pro-xxxxxxxx
node <SKILL_DIR>/autodl-pro.mjs release pro-xxxxxxxx
```

## Create Config

Required fields:

| Field | Requirement |
|---|---|
| `req_gpu_amount` | Integer 1 through 4 |
| `expand_system_disk_by_gb` | Integer 0 through 500 |
| `gpu_spec_uuid` | GPU spec UUID |
| `image_uuid` | Base/private image UUID |
| `cuda_v_from` | Minimum CUDA version value, such as `118` |

Example:

```json
{
  "req_gpu_amount": 1,
  "expand_system_disk_by_gb": 50,
  "gpu_spec_uuid": "GPU-RTX4090",
  "image_uuid": "image-xxxxxxxxxx",
  "cuda_v_from": 118
}
```

## Reference IDs

GPU spec IDs vary by region and account availability. Confirm current IDs with AutoDL before creating paid resources.

| Example GPU | Example spec ID |
|---|---|
| RTX 4090 | `GPU-RTX4090` |
| RTX 3090 | `GPU-RTX3090` |
| A100 | `GPU-A100` |
| H100 | `GPU-H100` |

Public base image UUID examples are illustrative; prefer listing private images or using the official console for exact current values.

| Example image | Example UUID |
|---|---|
| PyTorch CUDA 11.8 | `image-pytorch-118-example` |
| Ubuntu 22.04 CUDA 12.2 | `image-ubuntu-122-example` |

## Error Handling

The CLI prints structured JSON to stdout. On error:

```json
{
  "status": "error",
  "error_type": "validation_error",
  "message": "Pro 创建参数有误",
  "details": {
    "errors": ["req_gpu_amount(5) 必须是 1 到 4"]
  }
}
```

For `token_missing`, write `AUTODL_PRO_TOKEN` in this skill's `.env`. For `validation_error`, fix the config before retrying. For release, ask the user to confirm the target instance and power-off state before calling `release`.

## References

- Full endpoint table: [api-reference.md](api-reference.md)
- CLI examples: [examples.md](examples.md)
