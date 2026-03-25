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
Auto-detect (branch + SHA) → Find matching runs → Watch all → Verdict
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

### Step 3: Monitor Runs

For each matching run, monitor with `gh run watch`:

```bash
gh run watch <run-id> --exit-status
```

**Execution mode**: `gh run watch` is a long-running blocking command. Background mode is the default to keep the conversation responsive.

| Mode | When | Behavior |
|------|------|----------|
| Background (default) | No `--foreground` flag | Use Bash `run_in_background: true`. Report monitoring started, **then end the turn immediately** so the user can continue other work. When the background task notification arrives, read output and report verdict. |
| Foreground | `--foreground` flag passed | Execute inline (blocking). Claude waits for completion before responding. Only use when the caller explicitly needs to block on CI result. |

**Background mode (default) — critical behavior**:
1. Launch each `gh run watch` with `run_in_background: true`
2. Immediately inform the user: "CI monitoring started for run `<id>`, I'll report when it completes"
3. **End the current turn** — do NOT wait for the background tasks. The user can continue chatting, ask questions, or start new tasks while CI runs.
4. When each background task notification arrives, read the output file (from the task notification's `output_file` path) using Read tool, then parse `gh run watch` output for pass/fail status and emit the verdict.

**Multiple runs**: If multiple workflow runs match (e.g. CI + Auto Release), monitor all. In background mode, launch each as a separate background task. Report verdict for each individually.

**Timeout enforcement**: Default 10 minutes (configurable via `--timeout`). If any run exceeds timeout, stop monitoring and report as timeout.

### Step 4: Verdict

| CI Result | Output |
|-----------|--------|
| All pass | "✅ CI passed" + per-run URLs |
| Any fail | Failing jobs + `gh run view <id> --log-failed` summary |
| Timeout | "⚠️ CI still running after <N>min — `gh run watch <id>`" |

Overall verdict = worst individual result (any fail → overall fail).

## Arguments

| Argument | Description | Default |
|----------|-------------|---------|
| `--sha <sha>` | SHA to monitor | `git rev-parse HEAD` |
| `--branch <branch>` | Branch to filter runs | `git rev-parse --abbrev-ref HEAD` |
| `--timeout <min>` | Watch timeout in minutes | 10 |
| `--run-id <id>` | Monitor a specific run ID directly | auto-detect |
| `--foreground` | Run `gh run watch` in foreground (blocking) | background |

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
Action: Auto-detect HEAD SHA → find matching runs → launch background watch → "CI monitoring started, I'll report when it completes" → end turn → (user continues chatting) → background completes → read output → report verdict

Input: /watch-ci --sha abc1234
Action: Find runs for specified SHA → background watch → verdict on completion

Input: /watch-ci --run-id 12345678
Action: Watch specific run in background → verdict on completion

Input: /watch-ci --foreground
Action: Auto-detect → find runs → blocking watch → verdict (user waits)

Input: Is CI passing?
Action: Auto-detect → find runs → background watch → verdict
```
