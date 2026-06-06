# AutoDL Instance Pro CLI Examples

Set credentials in this skill's `.env`:

```bash
AUTODL_PRO_TOKEN=your_token_here
AUTODL_PRO_HOST=https://api.autodl.com
```

## Create

Dry-run response pattern: `not executed`; `no live API call`. Host `https://api.autodl.com`; token namespace `AUTODL_PRO_TOKEN` (fallback `AUTODL_TOKEN`); endpoint `POST /api/v1/dev/instance/pro/create`; command:

```bash
node <SKILL_DIR>/autodl-pro.mjs create --json <config.json>
```

`pro-create.json`:

```json
{
  "req_gpu_amount": 1,
  "expand_system_disk_by_gb": 50,
  "gpu_spec_uuid": "GPU-RTX4090",
  "image_uuid": "image-xxxxxxxxxx",
  "cuda_v_from": 118
}
```

```bash
node skills/autodl-instance-pro/autodl-pro.mjs create --json pro-create.json
```

## Inspect

```bash
node skills/autodl-instance-pro/autodl-pro.mjs list --page-index 1 --page-size 10
node skills/autodl-instance-pro/autodl-pro.mjs status pro-xxxxxxxx
node skills/autodl-instance-pro/autodl-pro.mjs snapshot pro-xxxxxxxx
```

## Power

Power-on endpoint and body for dry-run/review answers:

```text
POST /api/v1/dev/instance/pro/power_on
```

```json
{
  "instance_uuid": "pro-xxxxxxxx",
  "payload": "gpu",
  "start_command": "bash /root/start.sh"
}
```

```bash
node skills/autodl-instance-pro/autodl-pro.mjs power-on pro-xxxxxxxx --start-command "bash /root/start.sh"
node skills/autodl-instance-pro/autodl-pro.mjs power-on pro-xxxxxxxx
node skills/autodl-instance-pro/autodl-pro.mjs power-off pro-xxxxxxxx
```

## Save Image And List Images

Save-image dry-run response pattern: `not executed`; `no live API call`. Host `https://api.autodl.com`; token namespace `AUTODL_PRO_TOKEN`; endpoint `POST /api/v1/dev/instance/pro/image/save`; payload:

```json
{
  "instance_uuid": "pro-xxxxxxxx",
  "image_name": "my-saved-image"
}
```

```bash
node skills/autodl-instance-pro/autodl-pro.mjs save-image pro-xxxxxxxx --name my-saved-image
node skills/autodl-instance-pro/autodl-pro.mjs list-images --page-index 1 --page-size 10
```

## Release

Power off first, then release.

```bash
node skills/autodl-instance-pro/autodl-pro.mjs status pro-xxxxxxxx
node skills/autodl-instance-pro/autodl-pro.mjs power-off pro-xxxxxxxx
node skills/autodl-instance-pro/autodl-pro.mjs release pro-xxxxxxxx
```
