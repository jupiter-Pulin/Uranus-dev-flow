---
name: watch-ci
description: "Monitor GitHub Actions CI runs until completion. Use when: watching CI after push, checking build status, monitoring PR checks, waiting for CI completion, user says 'watch CI', 'check CI', 'CI status', 'monitor build', or /watch-ci. Not for: pushing code (use push-ci), creating PRs (use create-pr). Output: per-run verdict (pass/fail/timeout)."
allowed-tools: Bash(gh:*), Bash(git:*), Read
context: fork
---

# Watch CI

Monitor GitHub Actions CI runs for the current HEAD (or a specified SHA) until completion, then report verdict.

## Trigger

- Keywords: watch CI, check CI, CI status, monitor build, build status, is CI passing, watch actions, CI result

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
```

If `--run-id <id>` is specified, skip run discovery and monitor that specific run directly.

### Step 2: Find CI Runs

Find runs matching the target SHA on the target branch:

```bash
gh run list --branch "$BRANCH" --limit 10 \
  --json databaseId,headSha,status,name,url
```

Filter results to those matching `HEAD_SHA`.

**Retry logic**: If no matching runs found, retry up to 3 times with 10s interval. CI workflows may take a few seconds to trigger after push.

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
gh run watch <run-id> --exit-status
```

**Execution mode**: `gh run watch` is a long-running blocking command. Foreground mode is the default for reliable verdict reporting.

| Mode | When | Behavior |
|------|------|----------|
| Foreground (default) | No `--background` flag | Execute `gh run watch` inline (blocking). Claude waits for completion, then reports verdict. Reliable. |
| Background | `--background` flag passed | Launch with `Bash(run_in_background: true)`. Provide manual check command. **Do NOT promise auto-reporting** — background notifications in forked context are unreliable. |

**Foreground mode (default) — behavior**:
1. Execute `gh run watch <run-id> --exit-status` inline
2. Wait for completion (blocking)
3. Parse output for pass/fail status
4. Report verdict

**Background mode (`--background`) — honest behavior**:
1. Quick-check (Step 3a) first — if already completed, report immediately and skip background
2. If still running, launch `gh run watch` with `Bash(run_in_background: true)`
3. Inform the user honestly: "CI monitoring launched in background for run `<id>`. Background notifications may not auto-report reliably. To check manually: `gh run view <id>` or re-run `/watch-ci`"
4. **Do NOT promise "I'll report when it completes"** — background notification delivery is not guaranteed in forked context

**Multiple runs**: If multiple workflow runs match (e.g. CI + Auto Release), monitor all. In foreground mode, watch sequentially. In background mode, launch each as a separate background task.

**Timeout enforcement**: Default 10 minutes (configurable via `--timeout`). Since `gh run watch` has no native timeout flag, enforce via Bash tool's `timeout` parameter (milliseconds): set `timeout: TIMEOUT_MIN * 60 * 1000`. If the Bash call returns a timeout error, report the run as timed out. Timeout applies per individual `gh run watch` invocation, not to the entire monitoring session.

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
❌ Promising "I'll report when it completes" in background mode — background notifications in forked context are unreliable
❌ Skipping the quick-check step (Step 3a) — always check status before deciding to watch
❌ Reporting "CI monitoring started" without actually launching `gh run watch`
❌ Using `gh run list` results as the final verdict — list shows status at query time, not completion
```

## Arguments

| Argument | Description | Default |
|----------|-------------|---------|
| `--sha <sha>` | SHA to monitor | `git rev-parse HEAD` |
| `--branch <branch>` | Branch to filter runs | `git rev-parse --abbrev-ref HEAD` |
| `--timeout <min>` | Watch timeout in minutes | 10 |
| `--run-id <id>` | Monitor a specific run ID directly | auto-detect |
| `--background` | Launch `gh run watch` in background (may not auto-report reliably) | foreground |

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
  If still running → foreground watch (blocking) → wait → report verdict

Input: /watch-ci --sha abc1234
Action: Find runs for SHA → quick-check → watch if needed → verdict

Input: /watch-ci --run-id 12345678
Action: Quick-check run 12345678 → watch if still running → verdict

Input: /watch-ci --background
Action: Auto-detect → find runs → quick-check
  If completed → report immediately (no background needed)
  If still running → launch background watch → "CI monitoring launched, check manually with `gh run view <id>`"

Input: Is CI passing?
Action: Auto-detect → find runs → quick-check → watch if needed → verdict
```
