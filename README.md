# autodl-elastic-deploy

An agent skill for batch scheduling and managing GPU containers via the AutoDL Private Cloud Elastic Deployment API.

## Install

```bash
npx skills add https://github.com/cyicz123/autodl-elastic-deploy --skill autodl-elastic-deploy
```

### Options

| Option | Example | Description |
|--------|---------|-------------|
| Global install | `-g` | Install to user directory instead of project |
| Target agents | `-a cursor -a claude-code` | Install to specific agents |

## What It Does

This skill enables your coding agent to interact with [AutoDL Private Cloud](https://private.autodl.com) for GPU container orchestration. The agent can:

- **Queued submission** — auto-validate config, poll for GPU availability, then submit
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
├── skills/
│   └── autodl-elastic-deploy/    # Skill package
│       ├── SKILL.md              # Main skill definition (agent reads this)
│       ├── api-reference.md      # Full API parameters & response formats
│       ├── examples.md           # Common scenario code examples
│       └── queue_submit.py       # Queued deployment submission script
│       ├── .env.example          # Token configuration template
│       └── .env                  # Your actual token (git-ignored)
├── tests/                        # Test suite (100% coverage)
│   ├── conftest.py
│   ├── test_api.py
│   ├── test_dependencies.py
│   ├── test_fetch_gpu_stock.py
│   ├── test_fetch_images.py
│   ├── test_main_flow.py
│   ├── test_token_loader.py
│   ├── test_utils.py
│   └── test_validate_schema.py
├── pyproject.toml                # Project configuration & pytest settings
├── requirements-dev.txt          # Development dependencies
└── .gitignore
```

## Queued Submission

AutoDL doesn't natively support queuing when GPU resources are unavailable. `queue_submit.py` fills this gap:

1. **Validates** config schema, image existence, and GPU type availability
2. **Polls** GPU stock until sufficient idle GPUs are found
3. **Submits** the deployment and returns the UUID

For impossible requirements (non-existent GPU types, invalid images, contradictory parameters), the script exits immediately with structured JSON errors so the agent can ask the user to correct them.

```bash
python skills/autodl-elastic-deploy/queue_submit.py deploy.json --interval 30 --timeout 3600
```

| Error Type | Meaning |
|------------|---------|
| `validation_error` | Bad config parameters (e.g., `cpu_from > cpu_to`) |
| `image_not_found` | Image UUID doesn't exist |
| `gpu_type_not_found` | None of the requested GPU types exist |
| `submission_error` | GPU available but API rejected the request |
| `timeout` | Timed out waiting for GPU resources |

## Documentation

| File | Description |
|------|-------------|
| [skills/autodl-elastic-deploy/SKILL.md](skills/autodl-elastic-deploy/SKILL.md) | Core skill instructions, concepts, and quick reference |
| [skills/autodl-elastic-deploy/queue_submit.py](skills/autodl-elastic-deploy/queue_submit.py) | Queued submission with validation and GPU polling |
| [skills/autodl-elastic-deploy/api-reference.md](skills/autodl-elastic-deploy/api-reference.md) | Complete API parameters, response schemas, and gotchas |
| [skills/autodl-elastic-deploy/examples.md](skills/autodl-elastic-deploy/examples.md) | 7 ready-to-use scenario examples (deploy, scale, debug, etc.) |

## Testing

This project includes a comprehensive test suite with **100% code coverage**.

### Install Dependencies

```bash
# Install dev dependencies
pip install -r requirements-dev.txt
```

### Run Tests

```bash
python -m pytest -v --cov=skills/autodl-elastic-deploy
```

### Test Structure

| Test File | Coverage |
|-----------|----------|
| `test_token_loader.py` | Token loading from env/file |
| `test_utils.py` | Helper functions (JSON output, config loader) |
| `test_validate_schema.py` | Config validation logic |
| `test_api.py` | API wrapper functions |
| `test_fetch_images.py` | Image fetching with pagination |
| `test_fetch_gpu_stock.py` | GPU stock parsing |
| `test_main_flow.py` | End-to-end deployment flow |
| `test_dependencies.py` | Dependency checking (curl, jq) |

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
