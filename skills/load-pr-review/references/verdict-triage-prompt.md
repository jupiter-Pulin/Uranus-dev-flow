# Verdict Packaging Template — Per-Thread `/seek-verdict` Integration

> Step 2 is mandatory in plan/fix mode. Presenting analysis without executing this template is a SKILL.md violation.

<!-- Pattern source: @skills/seek-verdict/references/verdict-prompt.md -->
<!-- Classification source: @skills/issue-analyze/references/classification.md (Review Thread section) -->
<!-- Threshold source: @skills/seek-verdict/references/policy-mapping.md -->

## Usage

Used in `/load-pr-review` Step 2 (MANDATORY). Each unresolved thread is packaged as a finding for independent `/seek-verdict` invocation via **Skill tool** (built-in, always available).

## Per-Thread Packaging

For each unresolved thread, construct the `/seek-verdict` finding:

| Field | Source | Redaction |
|-------|--------|-----------|
| `finding_key` | `<thread.path>\|<first comment summary, max 120 chars>` | Strip code snippets |
| `severity` | Derive from reviewer comment (keyword heuristic; fallback P2) | — |
| `original_finding_text` | Reviewer's comment body (max 500 chars) | Strip secrets/tokens per `@rules/logging.md` |
| `origin_thread_id` | N/A (no prior review session) | — |
| `current_head_sha` | `git rev-parse HEAD` | — |
| `relevant_diff` | `git diff HEAD -- <thread.path>` | Sent to Codex unredacted; **never recorded in audit log** |

## Invocation

```
/seek-verdict "<thread.path>|<first comment summary>"
```

Each thread gets its own **independent** `/seek-verdict` invocation:
- Fresh Codex thread per assessment (enforced by seek-verdict protocol)
- No cross-thread context contamination
- Anti-anchoring: Claude's classification is never included

## Parallel Dispatch

Launch multiple `/seek-verdict` calls in parallel where possible (single message, multiple Skill tool calls). Concurrency guidance:

| Thread Count | Strategy |
|-------------|----------|
| 1-5 | All in parallel |
| 6-15 | Parallel (default budget) |
| 16-30 | Parallel, but warn user about cost |
| 30+ | Recommend `--no-verdict` or reduce `--budget` |

## Result Collection

Each `/seek-verdict` returns a `[DISMISS_VERDICT]` audit trail. Map to thread classification:

| Verdict Result | Thread Grouping |
|---------------|----------------|
| `DISMISS_VERIFIED` | Likely Non-Actionable |
| `DISMISS_CANDIDATE` | Needs Discussion (⚠️ Need Human — P0/P1 requires human confirmation) |
| `FIX_REQUIRED` | ACTIONABLE |
| `NEED_HUMAN` | Needs Discussion |

## Anti-Anchoring Enforcement

| Check | Required |
|-------|----------|
| `/seek-verdict` prompt does NOT contain Claude's classification | Yes (enforced natively) |
| Each thread gets fresh Codex context | Yes (enforced by seek-verdict protocol) |
| No batch — each thread assessed independently | Yes |

## Anti-Abuse Guard

| Condition | Action |
|-----------|--------|
| >60% of threads receive DISMISS_VERIFIED | Emit `[VERDICT_TRIAGE_WARN]` |

```
[VERDICT_TRIAGE_WARN] pr=<N> | non_actionable_ratio=<N/total> | reason=high-dismiss-ratio | timestamp=<ISO8601>
```

Note: `/seek-verdict`'s own anti-abuse guard (3 consecutive dismissals → heightened thresholds) applies per-session across all threads.

## Graceful Degradation

If any `/seek-verdict` call fails (timeout, Codex error), mark that thread as UNCERTAIN and proceed. Claude falls back to its own classification for failed threads only.

## Redaction Rules

Per `@skills/seek-verdict/references/policy-mapping.md`:

| Field | Policy |
|-------|--------|
| `finding_key` | File path + issue summary (≤120 chars); no code snippets |
| `original_finding_text` | Reviewer comment truncated to 500 chars; no secrets/tokens/passwords |
| `relevant_diff` | Sent to Codex unredacted for research; **never recorded in `[DISMISS_VERDICT]` audit log** |
| `evidence` in audit log | File:line references only; no source code content |

## Verification of Execution

After all per-thread `/seek-verdict` invocations complete, the model must be able to fill this table:

| Required Field | Source |
|---------------|--------|
| Codex Thread ID | From each `/seek-verdict` Skill tool response |
| Verdict | DISMISS_VERIFIED / DISMISS_CANDIDATE / FIX_REQUIRED / NEED_HUMAN |
| Confidence | 0.0-1.0 from Codex |

If this table cannot be filled, Step 2 was not executed. Return to Step 2 before proceeding.
