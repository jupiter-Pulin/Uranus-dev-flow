---
name: watch-ci
description: "Monitor GitHub Actions CI runs until completion. Use when: watching CI after push, checking build status, monitoring PR checks, waiting for CI completion, user says 'watch CI', 'check CI', 'CI status', 'monitor build', or /watch-ci. Not for: pushing code (use push-ci), creating PRs (use create-pr). Output: per-run verdict (pass/fail/timeout)."
allowed-tools: Bash(gh:*), Bash(git:*), Read, Monitor
---

# Watch CI

Monitor GitHub Actions CI runs for the current HEAD (or a specified SHA) until completion, then report verdict.

## Trigger

- Keywords: watch CI, check CI, CI status, monitor build, build status, is CI passing, watch actions, CI result

## When NOT to Use

- Pushing code to remote (use `/push-ci`)
- Creating pull requests (use `/create-pr`)
- Running local tests (use `/verify` or `/precommit`)

## Workflow

```
Auto-detect (branch + SHA) → Find matching runs → Quick-check status → Watch or Report → Verdict
```

### Step 1: Resolve Target

Determine which CI runs to monitor. Use arguments if provided, otherwise auto-detect.

```bash
BRANCH=${ARG_BRANCH:-$(git rev-parse --abbrev-ref HEAD)}
HEAD_SHA=${ARG_SHA:-$(git rev-parse HEAD)}
TIMEOUT=${ARG_TIMEOUT:-10}
INTERVAL=${ARG_INTERVAL:-30}
```

If `--run-id <id>` is specified, skip run discovery and monitor that specific run directly.

### Step 2: Find CI Runs

Find runs matching the target SHA on the target branch:

```bash
gh run list --branch "$BRANCH" --limit 30 \
  --json databaseId,headSha,status,name,url
```

> **Note**: Use `--limit 30` (not 10) to avoid missing target SHA runs on busy branches. Filter results client-side by `HEAD_SHA`.

Filter results to those matching `HEAD_SHA`.

**Retry logic**: If no matching runs found, retry up to 3 times by re-running the `gh run list` command. The natural processing delay between retries provides sufficient wait time — **do not use `sleep N` (N ≥ 2) as the first command**, the harness will block it. All retry commands must start with `gh` or `git` to match `allowed-tools`. CI workflows may take a few seconds to trigger after push.

If still no runs found after retries:

```
⚠️ No CI run detected for SHA <sha>. Possible causes:
- No workflow configured for this branch
- Path-filtered workflow didn't trigger
- Check: gh run list --branch <branch>
```

### Step 3a: Quick Status Check

Before starting a long-running watch, check if runs are already completed:

```bash
gh run view <run-id> --json status,conclusion,name,url
```

| Result | Action |
|--------|--------|
| All runs completed | Skip to Step 4 (Verdict) immediately — no watching needed |
| Some completed, some in progress | Report completed verdicts, watch remaining (Step 3b) |
| All in progress | Proceed to Step 3b |

### Step 3b: Watch Runs

For each in-progress run, monitor with `gh run watch`:

```bash
gh run watch <run-id> --exit-status -i "$INTERVAL"
```

**Poll interval**: `$INTERVAL` defaults to 30 seconds (configurable via `--interval`). `gh`'s own default is 3 seconds; at that rate, Monitor streaming surfaces ~20 notifications per minute, which has been reported as noisy. 30 seconds reduces poll noise by ~90% at the cost of ≤ 27 s additional completion-detection lag, which is negligible for typical multi-minute CI runs. Pass `--interval 3` to restore the old cadence when near-real-time feedback matters.

**Execution mode**: Monitor streaming is the default — non-blocking, reliable notifications for each status line.

| Mode | When | Behavior |
|------|------|----------|
| Monitor (default) | No mode flag | Stream `gh run watch` via Monitor tool. Each stdout line arrives as a notification. Claude processes verdict on completion. Non-blocking. |
| Foreground (`--blocking`) | `--blocking` flag passed | Execute `gh run watch` inline (blocking). Claude waits for completion, then reports verdict. Use when Monitor is unavailable or for simple single-run cases. |
| Background (`--background`) | `--background` flag passed | Launch with `Bash(run_in_background: true)`. Legacy fallback only — `run_in_background` delivers a single completion event, not streaming progress, so Monitor is preferred for rich updates. Provide a manual check command. |

**Monitor mode (default) — behavior**:
1. Launch `gh run watch <run-id> --exit-status -i "$INTERVAL"` via Monitor tool with `description: "CI run <run-id> (<name>)"` and `timeout_ms: TIMEOUT * 60 * 1000`
2. Each stdout line (status update) arrives as a streaming notification — `$INTERVAL` controls how often those lines fire
3. On exit (run completes or fails), parse final output for pass/fail status
4. Report verdict

**Foreground mode (`--blocking`) — behavior**:
1. Execute `gh run watch <run-id> --exit-status -i "$INTERVAL"` inline via Bash
2. Wait for completion (blocking) — `$INTERVAL` only affects how often `gh` polls the API, not wall-clock completion
3. Parse output for pass/fail status
4. Report verdict

**Background mode (`--background`) — legacy fallback only**:
1. Quick-check (Step 3a) first — if already completed, report immediately and skip background
2. If still running, launch `gh run watch <run-id> --exit-status -i "$INTERVAL"` with `Bash(run_in_background: true)`; `$INTERVAL` still applies (same `gh` call), but because background mode only surfaces a single completion event, poll cadence has no user-visible effect here
3. Inform the user honestly: "CI monitoring launched in background for run `<id>`. Background notifications may not auto-report reliably. To check manually: `gh run view <id>` or re-run `/watch-ci`"
4. **Do NOT promise streaming progress updates** — `Bash(run_in_background: true)` only delivers a single completion event, not per-status-line streaming; for rich updates, use Monitor mode

**Multiple runs**: If multiple workflow runs match (e.g. CI + Auto Release), launch parallel Monitor instances — one per run. Each Monitor reports its own per-run verdict via notifications. Overall verdict = worst individual result (any fail → overall fail). In `--blocking` mode, watch sequentially. In `--background` mode, launch each as a separate background task.

**Timeout enforcement**: Default 10 minutes (configurable via `--timeout`). In Monitor mode, set `timeout_ms: TIMEOUT * 60 * 1000` (Monitor tool enforces deadline). In `--blocking` mode, enforce via Bash tool's `timeout` parameter (milliseconds). If a timeout occurs, report the run as timed out. Timeout applies per individual run invocation, not to the entire monitoring session.

### Step 4: Verdict

| CI Result | Output |
|-----------|--------|
| All pass | "✅ CI passed" + per-run URLs |
| Any fail | Failing jobs + `gh run view <id> --log-failed` summary |
| Timeout | "⚠️ CI still running after <N>min — `gh run watch <id>`" |

Overall verdict = worst individual result (any fail → overall fail).

## Prohibited Actions

```
❌ Running `gh run view` once and treating that as "monitoring" — one-shot status check is NOT watching
❌ Promising per-status-line streaming updates in background mode — `Bash(run_in_background: true)` only delivers a single completion event; use Monitor for rich streaming
❌ Skipping the quick-check step (Step 3a) — always check status before deciding to watch
❌ Reporting "CI monitoring started" without actually launching `gh run watch`
❌ Using `gh run list` results as the final verdict — list shows status at query time, not completion
❌ Using `sleep N` (N ≥ 2) as the first Bash command — harness blocks it; retry by re-running `gh run list` directly
❌ Using commands outside `allowed-tools` (only `gh`, `git`, `Read`, and `Monitor` are permitted)
❌ Using `Bash(run_in_background: true)` when Monitor is available — Monitor is the preferred streaming mechanism
```

## Arguments

| Argument | Description | Default |
|----------|-------------|---------|
| `--sha <sha>` | SHA to monitor | `git rev-parse HEAD` |
| `--branch <branch>` | Branch to filter runs | `git rev-parse --abbrev-ref HEAD` |
| `--timeout <min>` | Watch timeout in minutes | 10 |
| `--interval <sec>` | Poll interval for `gh run watch -i` — controls how often `gh` queries the API and emits a status line (Monitor mode surfaces each line as one notification) | 30 |
| `--run-id <id>` | Monitor a specific run ID directly | auto-detect |
| `--blocking` | Use foreground blocking mode instead of Monitor streaming | Monitor |
| `--background` | Legacy fallback: launch in background (unreliable auto-reporting) | Monitor |

## Output

```markdown
## CI Monitor Report

**Branch**: `<branch>`
**SHA**: `<sha>`

| Run | Name | Status | URL |
|-----|------|--------|-----|
| 123 | CI | ✅ Pass | https://github.com/.../runs/123 |
| 124 | Auto Release | ✅ Pass | https://github.com/.../runs/124 |

## Verdict: ✅ All Pass / ⛔ N failures
```

## Verification

- [ ] Target SHA resolved (from argument or auto-detect)
- [ ] CI runs matched by SHA (not "latest")
- [ ] All matching runs monitored
- [ ] Verdict reported (pass/fail/timeout)

## Examples

```
Input: /watch-ci
Action: Auto-detect HEAD SHA → find matching runs → quick-check status
  If completed → report verdict immediately
  If still running → launch Monitor stream per run → receive status notifications → report verdict on completion

Input: /watch-ci --sha abc1234
Action: Find runs for SHA → quick-check → Monitor stream if needed → verdict

Input: /watch-ci --run-id 12345678
Action: Quick-check run 12345678 → Monitor stream if still running → verdict

Input: /watch-ci --blocking
Action: Auto-detect → find runs → quick-check
  If completed → report immediately
  If still running → foreground watch (blocking) → wait → report verdict

Input: /watch-ci --background
Action: Auto-detect → find runs → quick-check
  If completed → report immediately (no background needed)
  If still running → launch background watch (legacy) → "CI monitoring launched, check manually with `gh run view <id>`"

Input: Is CI passing?
Action: Auto-detect → find runs → quick-check → Monitor stream if needed → verdict
```
