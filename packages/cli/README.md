# VelocityAI CLI

The **VelocityAI** command-line interface — drive your AI product delivery pipeline
(features → PRD → tasks → AI code review) straight from the terminal.

> Companion to the VelocityAI web app at <https://VelocityAI.in>. Full docs: <https://VelocityAI.in/docs/cli>.

```bash
$ velocityai feature create --title "Dark mode" --description "Add a theme toggle"
✔ Created feature 4f9a02c1 — Dark mode

$ velocityai prd approve 4f9a02c1…
✔ PRD approved — engineering task generation was triggered.

$ velocityai task mine
ID        STATUS       TYPE      TITLE                       FEATURE    ORG
482bd89c  in_progress  backend   Implement theme service     Dark mode  Acme
```

## Quick start

```bash
# 1. Install (Node.js >= 18)
npm install -g velocityai

# 2. Sign in — opens your browser for a one-click approval
velocityai login

# 3. Pick an organization (skipped automatically if you only have one)
velocityai org use <slug>

# 4. Look around
velocityai status
```

`velocityai login` uses the OAuth 2.0 Device Authorization flow: it prints a URL and
a short code, opens your browser, and waits while you approve the request. No
passwords or tokens to copy by hand. The credential is stored at
`~/.velocityai/config.json` (mode `0600`).

## Commands

Run `velocityai <command> --help` for the options of any command.

### Session & configuration

| Command | What it does |
| --- | --- |
| `velocityai login` | Sign in via the browser (device authorization). |
| `velocityai logout` | Remove the stored credentials from this machine. |
| `velocityai whoami` | Show the signed-in user, active org, and API URL. |
| `velocityai ping` | Check the configured deployment is reachable (+ latency). |
| `velocityai config list` | Show the effective configuration (token redacted). |
| `velocityai config set-api <url>` | Pin the CLI to a self-hosted / staging deployment. |
| `velocityai config unset-api` | Go back to the default `https://VelocityAI.in`. |
| `velocityai config path` | Print the config file location. |

### Organizations & projects

| Command | What it does |
| --- | --- |
| `velocityai org list` | Organizations you belong to (`*` marks the active one). |
| `velocityai org use <slug>` | Set the active organization. |
| `velocityai project list` | Projects in the active organization. |
| `velocityai member list` | Teammates, their roles, and email verification state. |
| `velocityai status` | One-screen pipeline snapshot: features by status, review cycles. |
| `velocityai search <query>` | Search projects, features, tasks, PRDs, repos, and reviews. |

### Features

| Command | What it does |
| --- | --- |
| `velocityai feature list [--status s] [--project id]` | List feature requests. |
| `velocityai feature create --title t --description d` | Create a feature (starts AI clarification). |
| `velocityai feature show <id>` | Status, PRD summary, tasks, and reviews for one feature. |
| `velocityai feature clarify <id> <answer…>` | Reply to the AI product manager's question. |
| `velocityai feature open <id>` | Open the feature in your browser. |
| `velocityai feature approve <id> [--notes n]` | Approve a feature in review *(manager+)*. |
| `velocityai feature reject <id> <reason…>` | Reject a feature — marks it blocked *(manager+)*. |
| `velocityai feature ship <id>` | Mark an approved feature as shipped *(manager+)*. |

### PRDs

| Command | What it does |
| --- | --- |
| `velocityai prd generate <featureId>` | Trigger PRD generation / regeneration. |
| `velocityai prd show <featureId>` | Print the PRD as markdown. |
| `velocityai prd approve <featureId>` | Approve the PRD → generates engineering tasks. |
| `velocityai prd download <featureId> [-o file]` | Save the PRD as a PDF. |
| `velocityai prd share <featureId> --to a@b.com [--to …] [--message m]` | Email the PRD (PDF attached). |

`prd share` sends to teammates and outside addresses alike; teammates must have
a verified email (see `velocityai member list`).

### Tasks

| Command | What it does |
| --- | --- |
| `velocityai task list <featureId>` | The feature's task board, grouped by status. |
| `velocityai task mine` | Tasks assigned to you, across all organizations. |
| `velocityai task start <taskId>` | Move a task to `in_progress`. |
| `velocityai task done <taskId>` | Mark a task as `done`. |
| `velocityai task move <taskId> <status> [--reason r]` | Any move: `todo`, `in_progress`, `done`, `blocked`. |
| `velocityai task assign <taskId> <who>` | Assign by email, name, or `me`. |
| `velocityai task notes <taskId>` | Read a task's discussion thread. |
| `velocityai task note <taskId> <text…>` | Add a note to the thread. |

### Reviews

| Command | What it does |
| --- | --- |
| `velocityai review list [--status s]` | AI review cycles (`running`, `passed`, `failed`). |
| `velocityai review show <cycleId>` | A cycle's verdict, score, and findings. |
| `velocityai review resolve <issueId>` | Mark a finding as resolved. |

## Global flags

Global flags go **before** the subcommand: `velocityai --json feature list`.

| Flag | Meaning |
| --- | --- |
| `--json` | Machine-readable JSON output — for scripting and CI. |
| `--api <url>` | Target a non-default deployment for this call (and persist it on `login`). |
| `--org <slug>` | Run against a specific organization for this call. |

## Configuration

Everything lives in `~/.velocityai/config.json`. The API base URL is resolved in
this order:

1. `--api <url>` flag
2. `VELOCITYAI_API_URL` environment variable
3. `apiUrl` stored in the config file (set via `velocityai config set-api` or `login --api`)
4. Default: `https://VelocityAI.in`

`velocityai login` prints which deployment it is signing in to, and only persists
the URL when you passed it explicitly — so a one-off `--api` experiment can't
silently redirect future logins.

For CI / headless use, skip `login` and set a token in the environment:

```bash
export VELOCITYAI_TOKEN="<token>"
velocityai --json task mine
```

## Scripting

Every command supports `--json`, so output pipes cleanly into `jq`:

```bash
# Full ids of all features that are ready for PRD review
velocityai --json feature list | jq -r '.[] | select(.status == "prd_ready") | .id'

# Fail a CI step if any AI review cycle failed
test "$(velocityai --json review list --status failed | jq length)" = "0"
```

## Troubleshooting

**Login opens the wrong URL (an old dev/staging domain).**
The CLI is pinned to another deployment. Check with `velocityai config list`, then
`velocityai config unset-api` and run `velocityai login` again.

**"You're not signed in" / 401s.**
Your token expired or points at a different deployment. `velocityai login`.

**"Select an organization before accessing this resource."**
Run `velocityai org use <slug>` once, or pass `--org <slug>` per command.

**No browser opens on login.**
Headless environments can't spawn a browser — open the printed URL on any device
and enter the device code.

## How it works

The CLI is a thin, fully type-safe [tRPC](https://trpc.io) client against the same
API the web app uses; its types are derived from the server's router, so the CLI
can never drift from the API. Authentication rides on BetterAuth's device grant +
bearer token.
