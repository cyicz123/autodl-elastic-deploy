# Sync Reference — rclone over SSH

Incrementally sync code, weights, and logs between your local machine and an AutoDL container directly over the container's SSH/SFTP. No public git repo or object-store intermediary is needed. This is documentation-driven: there is no `autodl.mjs sync` subcommand. The agent detects/installs `rclone`, derives SSH info from the elastic/pro CLI, and runs `rclone` directly.

Works the same on Windows, Linux, and macOS because `rclone` is a single self-contained binary with an identical CLI on every platform.

## 1. Detect and install rclone

Detect first:

```bash
rclone version
```

If it is missing, **always show the install command and ask the user to confirm before installing** — never install silently.

| OS | Primary | Fallbacks |
|---|---|---|
| Windows | `winget install Rclone.Rclone` | `scoop install rclone`, `choco install rclone`, or download the zip from rclone.org and add `rclone.exe` to `PATH` |
| Linux | `curl https://rclone.org/install.sh \| sudo bash` | `sudo apt install rclone`, `sudo dnf install rclone` |
| macOS | `brew install rclone` | download the zip from rclone.org and add to `PATH` |

## 2. Get the container SSH connection info

The container exposes an SSH command of the form `ssh -p <port> <user>@<host>` plus a root password. Parse `host`, `port`, and `user` from it.

Elastic (private cloud) — from the container list:

```bash
node <SKILL_DIR>/autodl.mjs elastic containers --deployment-uuid <uuid>
# read info.ssh_command and info.root_password
```

Pro (public cloud) — from the snapshot:

```bash
node <SKILL_DIR>/autodl.mjs pro snapshot <instance_uuid>
# read ssh_command / proxy_host / ssh_port / root_password
```

## 3. Authenticate without leaking the password

The AutoDL root password is plaintext. rclone requires an **obscured** password, and it must not appear in the rclone config file or on the command line / in shell history. Use ephemeral environment variables for the `sftp` backend; `rclone obscure` converts the plaintext password to the obscured form.

PowerShell (Windows):

```powershell
$env:RCLONE_SFTP_HOST = "<host>"
$env:RCLONE_SFTP_PORT = "<port>"
$env:RCLONE_SFTP_USER = "root"
$env:RCLONE_SFTP_PASS = (rclone obscure "<root_password>")
```

bash / zsh (Linux, macOS):

```bash
export RCLONE_SFTP_HOST="<host>"
export RCLONE_SFTP_PORT="<port>"
export RCLONE_SFTP_USER="root"
export RCLONE_SFTP_PASS="$(rclone obscure '<root_password>')"
```

These `RCLONE_SFTP_*` variables configure the `sftp` backend, so you can reference the remote simply as `:sftp:<REMOTE_PATH>` with nothing sensitive on the command line. Clear the variables when done.

Host key: AutoDL containers are ephemeral, so their SSH host key and port change on rebuild. Do **not** configure a `known_hosts` file (leave `RCLONE_SFTP_KNOWN_HOSTS_FILE` unset); the `sftp` backend then does not fail on a changed host key.

## 4. Remote path

There is **no default remote path**. The calling agent supplies `<REMOTE_PATH>` from its own AGENTS.md / context (for example a data-disk path like `/root/autodl-tmp/...` or a persistent file-storage path). Always require an explicit remote path.

## 5. Push (local → container), the safe default

`rclone copy` only adds/updates files and never deletes anything on the remote, so it is safe for weights and logs. Incremental selection is by size + modification time (add `--checksum` to compare by hash instead).

```bash
rclone copy <LOCAL_DIR> :sftp:<REMOTE_PATH> \
  --exclude ".git/**" --exclude "__pycache__/**" --exclude "*.pyc" \
  --exclude ".ipynb_checkpoints/**" --exclude "node_modules/**" --exclude ".DS_Store" \
  --progress --transfers 4 --checkers 8 --multi-thread-streams 4 --stats 10s
```

## 6. Pull (container → local)

Reverse the source and destination, e.g. to retrieve logs/weights/artifacts:

```bash
rclone copy :sftp:<REMOTE_PATH>/logs <LOCAL_DIR>/logs --progress --stats 10s
```

## 7. Mirror (opt-in, dangerous)

`rclone sync` makes the destination match the source, which **deletes** remote files that are not present locally. Only use it when the user explicitly wants a mirror. You **must** run a `--dry-run` first, present the files that would be added/changed/deleted, get explicit confirmation, and only then run the real command.

```bash
rclone sync <LOCAL_DIR> :sftp:<REMOTE_PATH> <flags> --dry-run   # preview deletions, confirm
rclone sync <LOCAL_DIR> :sftp:<REMOTE_PATH> <flags>             # only after confirmation
```

## 8. Defaults and tuning

- **Excludes (default set):** `.git/**`, `__pycache__/**`, `*.pyc`, `.ipynb_checkpoints/**`, `node_modules/**`, `.DS_Store`. The user can add more with `--exclude` or supply a filter file with `--filter-from <file>`.
- **Performance:** `--progress --transfers 4 --checkers 8 --multi-thread-streams 4 --stats 10s`. Large weight files benefit from `--multi-thread-streams`. Transfers resume automatically on re-run.
- **Throttle:** `--bwlimit 20M` (or a schedule like `--bwlimit "08:00,512k 22:00,off"`) to cap bandwidth.
- **Windows local paths:** quote paths and use the drive letter, e.g. `"D:\runs"`; rclone accepts both `\` and `/` on the local side.

## 9. Dry-run discipline

When the user asks to only show the command / dry-run / not execute, print the full `rclone` command (with the obscure/env setup), state `not executed` and `no live API call`, and do not run it.
