# autodl-elastic-deploy

An agent skill for batch scheduling and managing GPU containers via the AutoDL Private Cloud Elastic Deployment API.

## Install

```bash
npx skills add https://github.com/cyicz123/autodl-elastic-deploy
```

### Options

| Option | Example | Description |
|--------|---------|-------------|
| Global install | `-g` | Install to user directory instead of project |
| Target agents | `-a cursor -a claude-code` | Install to specific agents |

## What It Does

This skill enables your coding agent to interact with [AutoDL Private Cloud](https://private.autodl.com) for GPU container orchestration. The agent can:

- **Create deployments** — ReplicaSet, Job, or single Container
- **Monitor containers** — query status, events, SSH info
- **Scale dynamically** — adjust replica count on the fly
- **Manage lifecycle** — stop, delete deployments and containers
- **Check GPU stock** — view available GPU inventory before deploying

## Setup

### 1. Get Your Token

Navigate to **AutoDL Console → Settings → Developer Token** and copy your token.

### 2. Configure

Copy the example env file and fill in your token:

```bash
cp .env.example .env
```

```env
AUTODL_TOKEN=<your_token>
```

> **Note:** If `.env` is missing when the skill is activated, the agent will prompt you for the token and create it automatically.

## Supported Deployment Types

| Type | Description |
|------|-------------|
| **ReplicaSet** | Maintains a specified number of running container replicas. Auto-scales when conditions or count change |
| **Job** | Creates containers until the target count is completed. No new containers after completion |
| **Container** | Creates a single container until it finishes. Equivalent to a Job with `replica_num=1` |

## API Endpoints

| Operation | Method | Endpoint |
|-----------|--------|----------|
| List images | POST | `/api/v1/dev/image/private/list` |
| Create deployment | POST | `/api/v1/dev/deployment` |
| List deployments | POST | `/api/v1/dev/deployment/list` |
| List container events | POST | `/api/v1/dev/deployment/container/event/list` |
| List containers | POST | `/api/v1/dev/deployment/container/list` |
| Stop container | PUT | `/api/v1/dev/deployment/container/stop` |
| Set replica count | PUT | `/api/v1/dev/deployment/replica_num` |
| Stop deployment | PUT | `/api/v1/dev/deployment/operate` |
| Delete deployment | DELETE | `/api/v1/dev/deployment` |
| Set scheduling blacklist | POST | `/api/v1/dev/deployment/blacklist` |
| Get GPU stock | GET | `/api/v1/dev/machine/gpu_stock` |

## File Structure

```
autodl-elastic-deploy/
├── SKILL.md            # Skill definition (agent reads this)
├── api-reference.md    # Full API parameters & response formats
├── examples.md         # Common scenario code examples
├── .env.example        # Token configuration template
├── .env                # Your actual token (git-ignored)
└── .gitignore
```

## Documentation

| File | Description |
|------|-------------|
| [SKILL.md](SKILL.md) | Core skill instructions, concepts, and quick reference |
| [api-reference.md](api-reference.md) | Complete API parameters, response schemas, and gotchas |
| [examples.md](examples.md) | 7 ready-to-use scenario examples (deploy, scale, debug, etc.) |

## Compatibility

This skill works with any agent that supports the [Agent Skills specification](https://agentskills.io):

| Agent | Status |
|-------|--------|
| Cursor | Supported |
| Claude Code | Supported |
| Codex | Supported |
| OpenCode | Supported |
| Other agents | Should work if the agent supports SKILL.md |

## License

MIT
