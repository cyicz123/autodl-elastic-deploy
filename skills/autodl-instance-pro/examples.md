# AutoDL Instance Pro CLI Examples

Set credentials in this skill's `.env`:

```bash
AUTODL_PRO_TOKEN=your_token_here
AUTODL_PRO_HOST=https://api.autodl.com
```

## Create

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

```bash
node skills/autodl-instance-pro/autodl-pro.mjs power-on pro-xxxxxxxx --start-command "bash /root/start.sh"
node skills/autodl-instance-pro/autodl-pro.mjs power-on pro-xxxxxxxx
node skills/autodl-instance-pro/autodl-pro.mjs power-off pro-xxxxxxxx
```

## Save Image And List Images

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
