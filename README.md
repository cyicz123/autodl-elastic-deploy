# AutoDL Skills

This repository contains two Node.js-backed Agent Skills for AutoDL. Both share TypeScript source and tests at the repository root, but each skill keeps its own runtime host, token variables, CLI entrypoint, and local `.env`.

## Skills

| Skill | Cloud context | Default host | Host override | Primary token |
|---|---|---|---|---|
| `skills/autodl-elastic-deploy` | AutoDL private cloud elastic deployment | `https://private.autodl.com` | `AUTODL_ELASTIC_HOST` | `AUTODL_ELASTIC_TOKEN` |
| `skills/autodl-instance-pro` | AutoDL public cloud container instance Pro | `https://api.autodl.com` | `AUTODL_PRO_HOST` | `AUTODL_PRO_TOKEN` |

`AUTODL_TOKEN` is kept only as a compatibility fallback. Skill-specific token variables always win.

## Build And Test

```bash
npm install
npm run build
npm test
```

The checked-in skill entrypoints import compiled files from `dist/`, so run `npm run build` after cloning or editing TypeScript.

## Elastic Deployment

Use this for private-cloud elastic deployments: ReplicaSet, Job, Container, queue-submit, scaling, lifecycle, images, GPU stock, events, and blacklists.

```bash
node skills/autodl-elastic-deploy/autodl-elastic.mjs --help
node skills/autodl-elastic-deploy/autodl-elastic.mjs queue-submit deploy.json --interval 30 --timeout 3600
```

Configure `skills/autodl-elastic-deploy/.env`:

```env
AUTODL_ELASTIC_TOKEN=your_token_here
AUTODL_ELASTIC_HOST=https://private.autodl.com
```

Elastic deployment configs use `dc_list`, `cuda_v_from`, and `cuda_v_to`.

## Instance Pro

Use this for public-cloud container instance Pro resources: create, snapshot, status, list, power on/off, release, save images, and list images. Pro API access requires personal or enterprise verification.

```bash
node skills/autodl-instance-pro/autodl-pro.mjs --help
node skills/autodl-instance-pro/autodl-pro.mjs create --json pro-create.json
```

Configure `skills/autodl-instance-pro/.env`:

```env
AUTODL_PRO_TOKEN=your_token_here
AUTODL_PRO_HOST=https://api.autodl.com
```

Power off an instance before releasing it; the CLI does not power off implicitly.

## Install Locally

For Codex/Agents skills, create directory junctions from this repository into `~/.agents/skills`.

```powershell
New-Item -ItemType Junction -Path "$env:USERPROFILE\.agents\skills\autodl-elastic-deploy" -Target "C:\Users\chengyue\Documents\Code\autodl-elastic-deploy\skills\autodl-elastic-deploy"
New-Item -ItemType Junction -Path "$env:USERPROFILE\.agents\skills\autodl-instance-pro" -Target "C:\Users\chengyue\Documents\Code\autodl-elastic-deploy\skills\autodl-instance-pro"
```

If those paths already exist, inspect their targets before replacing them.

## Repository Layout

```text
skills/
  autodl-elastic-deploy/
    SKILL.md
    autodl-elastic.mjs
    .env.example
    api-reference.md
    examples.md
  autodl-instance-pro/
    SKILL.md
    autodl-pro.mjs
    .env.example
    api-reference.md
    examples.md
src/
  core/
  elastic/
  pro/
tests-ts/
```

## License

MIT
