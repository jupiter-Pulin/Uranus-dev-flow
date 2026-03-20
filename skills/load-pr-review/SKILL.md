---
name: load-pr-review
description: "Load GitHub PR review comments into AI session — analyze, triage, plan. Default: analysis-only (no auto-fix). Use when: reviewing PR feedback, planning fixes, addressing review comments, replying to reviewers. Not for: creating reviews (use codex-review-fast), creating PRs (use create-pr), viewing PR status (use pr-summary)."
---

# Load PR Review

## Trigger Keywords

`load pr review`, `pr feedback`, `address review`, `review comments`, `pr comments`

## When NOT to Use

| Need | Use Instead |
|------|-------------|
| Create a code review | `/codex-review-fast` or `/codex-review` |
| Post new review comments | `/pr-comment` |
| Create a PR | `/create-pr` |
| PR status overview | `/pr-summary` |
| Investigate code history | `/git-investigate` |

## Core Principle

```
Load review → independent per-thread triage → analysis report → user decides next step
Default: analysis-only. Fix and writeback require explicit --mode fix / --writeback.
Data plane (JS script) handles fetch/normalize/writeback.
Control plane (this SKILL.md) handles classification, fix orchestration, auto-loop.
```

## Analysis-Only Default ⚠️

This skill is an **analysis tool by default**. It loads PR review comments and produces a triage report. It does NOT auto-fix.

### Prohibited Behaviors

| ❌ Prohibited | ✅ Correct |
|--------------|-----------|
| Auto-fixing code after loading PR reviews | Present analysis report, wait for user to invoke `--mode fix` |
| Editing files in plan mode | Only read and classify; no writes |
| Suggesting "let me fix this" without explicit `--mode fix` | "Use `--mode fix` to start fixing ACTIONABLE threads." |
| Skipping triage and jumping to fixes | Always complete Step 1.5 triage before any action |

### Precedence

> **Rule priority**: Plan mode's analysis-only constraint overrides the "Skill analysis-only mode" exception in `fix-all-issues.md`.
> Issues found in plan mode are recorded in the analysis report (logged as `[ANALYSIS_ONLY_DEFERRED]`), not auto-fixed. User must explicitly invoke `--mode fix` to apply changes.

### Mode Behavior

| Mode | Default? | Reads Code | Edits Code | Writes Back |
|------|----------|------------|------------|-------------|
| `plan` | **Yes** | ✅ | ❌ | ❌ |
| `summary` | No | ❌ | ❌ | ❌ |
| `fix` | No (explicit) | ✅ | ✅ (after AskUserQuestion) | Only with `--writeback` |

## Workflow

```mermaid
sequenceDiagram
    participant U as User
    participant SK as SKILL.md
    participant JS as load-pr-review.js
    participant GH as GitHub (gh CLI)
    participant SV as /seek-verdict (per thread)
    participant AL as Auto-Loop

    U->>SK: /load-pr-review [args]
    SK->>SK: Step 0 — Resolve PR target

    SK->>JS: fetch --pr N --repo owner/repo
    JS->>GH: gh api graphql (reviewThreads)
    alt GraphQL fails
        JS->>GH: gh api REST (fallback)
    end
    JS-->>SK: Normalized JSON

    alt plan/fix mode + verdict enabled
        loop Each unresolved thread (parallel)
            SK->>SV: /seek-verdict (fresh Codex per thread)
            Note over SV: Independent research
            SV-->>SK: Per-thread verdict
        end
    end

    alt summary mode
        SK->>U: Table of threads
    end

    alt plan mode (DEFAULT)
        SK->>SK: Map verdicts to categories
        SK->>U: Analysis report (no edits)
    end

    alt fix mode (explicit --mode fix only)
        SK->>U: AskUserQuestion — select threads
        loop Each selected thread
            SK->>SK: Read file + apply fix
            SK->>AL: auto-loop
        end
    end

    alt --writeback
        SK->>JS: writeback --plan
        JS-->>SK: Dry-run plan
        SK->>U: AskUserQuestion — approve
        U->>SK: Approved
        loop Each thread
            SK->>JS: writeback --execute (one at a time)
            JS->>GH: POST reply + resolve
        end
    end
```

## Step 0: Resolve PR Target

Determine the target PR using this cascade:

1. **Explicit PR# in arguments** → use directly
2. **URL in arguments** → parse `owner/repo/number`
3. **Context block data** → `gh pr view` on current branch
4. **None found** → AskUserQuestion: ask user to provide PR# or URL

## Step 1: Fetch Review Comments

Run the data plane script:

```bash
bash scripts/run-skill.sh load-pr-review load-pr-review.js \
  fetch --pr <N> --repo <owner/repo> [--all] [--budget <N>]
```

Parse the JSON output. Check `summary.degraded` — if `true`, inform user:

> REST fallback active: thread resolution status unknown, showing all comments.

If `summary.total === 0`:

> No review comments found on this PR.

## Step 1.5: Per-Thread Independent Verdict (via `/seek-verdict`)

In **plan** and **fix** modes (not summary), invoke `/seek-verdict` **per thread** for independent Codex assessment. Each thread gets its own fresh Codex context — no shared state between threads.

**Why per-thread, not batch**: Each review comment needs an independent perspective. Batch assessment in a single Codex call allows cross-thread contamination (one verdict influencing another). Per-thread invocation ensures every assessment is genuinely independent.

**When to execute**:

| Mode | Verdict | Reason |
|------|---------|--------|
| summary | Skip | Lightweight display, cost not justified |
| plan | Execute (default) | Enrich plan table with independent Codex assessment |
| fix | Execute (default) | Pre-select actionable threads |

**Flag**: `--no-verdict` disables this step.

**Execution**:

1. Collect all unresolved threads from Step 1 output
2. For each thread, package as a finding for `/seek-verdict`:
   - `finding_key`: `<thread.path>|<first comment summary truncated to 120 chars>`
   - `severity`: P2 (all PR review threads assessed at P2 level for seek-verdict compatibility)
   - `original_finding_text`: reviewer's comment body
   - `relevant_diff`: `git diff HEAD -- <thread.path>`
3. Invoke `/seek-verdict` per thread via **Skill tool** (built-in, always available — no `allowed-tools` entry needed)
   - Launch threads in parallel where possible (multiple Skill tool calls in one message)
   - Each `/seek-verdict` independently reads the code and assesses the comment
   - Concurrency: 1-5 all parallel; 6-15 parallel; 16-30 parallel + warn cost; 30+ recommend `--no-verdict`
4. Collect per-thread `[DISMISS_VERDICT]` audit trails
5. If >60% threads receive DISMISS_VERIFIED, emit `[VERDICT_TRIAGE_WARN]`
6. If any `/seek-verdict` call fails, warn user and mark that thread as UNCERTAIN (graceful degradation)

**Anti-anchoring**: `/seek-verdict` enforces this natively — Claude's classification is never sent to Codex.

**Result mapping** (per `@skills/seek-verdict/references/policy-mapping.md`; normal state — heightened thresholds apply after `[DISMISS_PATTERN_WARN]`, see policy-mapping.md Anti-Abuse Guard):

| Codex Verdict | Confidence | Evidence Refs | Result | Grouping |
|---------------|------------|---------------|--------|----------|
| NON_ACTIONABLE | >= 0.80 (normal) / >= 0.85 (heightened) | >= 2 (normal) / >= 3 (heightened) | DISMISS_VERIFIED | Likely Non-Actionable |
| ACTIONABLE | >= 0.70 | any | FIX_REQUIRED | ACTIONABLE |
| UNCERTAIN / low | any | any | NEED_HUMAN | Needs Discussion |

## Step 2: Present (mode-dependent)

### Summary Mode (`--mode summary`)

Lightweight display — no verdict triage, no code reads.

```markdown
## PR #<N>: <title>
**Review Status**: <unresolved> unresolved / <total> total threads

| # | File | Line | Reviewer | Comment (truncated) |
|---|------|------|----------|---------------------|
| 1 | src/foo.ts | 42 | alice | Use early return... |

Use `--mode plan` to get fix strategy with independent Codex assessment.
```

### Plan Mode (DEFAULT)

Classify each thread using verdict data from Step 1.5 (or AI judgment if verdict unavailable):

| Category | Description | Priority |
|----------|-------------|----------|
| `code_change` | Code modification suggestion | 1 — Fix |
| `doc_update` | Documentation/comment update | 2 — Fix |
| `question` | Question needing explanation | 3 — Reply |
| `disagree` | Design disagreement | 4 — Discuss |
| `nit` | Style/naming nitpick | 5 — Optional |

Present grouped by verdict then priority:

```markdown
## Fix Strategy (issue-analyzed)

### ACTIONABLE (N threads)
| # | File | Reviewer | Category | Summary | Confidence | Effort |
|---|------|----------|----------|---------|------------|--------|

### Likely Non-Actionable (N threads) (DISMISS_VERIFIED per policy-mapping thresholds)
| # | File | Reviewer | Category | Summary | Confidence | Reason |
|---|------|----------|----------|---------|------------|--------|

### Needs Discussion (N threads)
| # | File | Reviewer | Category | Summary | Confidence |
|---|------|----------|----------|---------|------------|

Use `--mode fix` to start fixing ACTIONABLE threads.
```

### Fix Mode (explicit `--mode fix` required)

**⚠️ Fix mode is opt-in only. Never auto-enter fix mode. The user must explicitly pass `--mode fix`.**

1. Show plan first (as in plan mode, with full verdict triage)
   - ACTIONABLE threads are pre-selected; NON_ACTIONABLE threads are listed with `(DISMISS_VERIFIED — skip suggested)` — user can override via AskUserQuestion
2. AskUserQuestion: which threads to fix? (user must confirm before any edits)
3. For each selected thread:
   a. Read the file at `thread.path` around `thread.line`
   b. Understand the review comment
   c. Apply the fix
   d. **Auto-loop**: code changes → `/codex-review-fast` → `/precommit`; doc changes → `/codex-review-doc`
4. After all fixes complete, suggest `--writeback` to close the loop

## Step 3: Writeback (optional, gated)

Only when `--writeback` is specified.

### Dry-run (default)

```bash
bash scripts/run-skill.sh load-pr-review load-pr-review.js \
  writeback --plan --input <json-path> --threads <IDs>
```

Show the plan table to user (includes Verdict column from Step 1.5 when available). Ask for approval via AskUserQuestion.

### Execute (after approval)

For each approved thread, one at a time:

```bash
bash scripts/run-skill.sh load-pr-review load-pr-review.js \
  writeback --execute --thread <ID> --reply "<message>" \
  --replyTargetId <databaseId> --repo <owner/repo> --pr <N> [--resolve]
```

**Safety rules** (see `references/writeback-guardrails.md`):
- Must use `replyTargetId` (first comment's `databaseId`)
- Body transmitted via `jq` + temp file + `--input <tmpFile>` (no shell interpolation)
- Missing `replyTargetId` → degrade to plan-only, warn user
- Each thread processed independently; failure does not abort others

## Output Format

### JSON (default from script)

```json
{
  "pr": { "number": 42, "title": "...", "url": "...", "head": "feat/x", "base": "main" },
  "summary": { "total": 15, "unresolved": 8, "outdated": 3, "loaded": 8, "truncated": 7, "degraded": false },
  "threads": [
    {
      "id": "PRRT_...",
      "path": "src/foo.ts",
      "line": 42,
      "isResolved": false,
      "isOutdated": false,
      "replyTargetId": 12345,
      "comments": [
        { "id": "PRRC_...", "databaseId": 12345, "author": "reviewer", "body": "...", "createdAt": "..." }
      ]
    }
  ]
}
```

### Markdown (with `--markdown`)

Human-readable table for direct display.

## Verification Checklist

- [ ] PR target resolves correctly (explicit, URL, current branch)
- [ ] GraphQL fetch returns normalized threads
- [ ] REST fallback activates when GraphQL fails
- [ ] Token budget truncation works (default 30, --all 200)
- [ ] Default mode is `plan` (analysis-only, no edits)
- [ ] Fix mode requires explicit `--mode fix`
- [ ] No files edited in plan or summary mode
- [ ] Per-thread `/seek-verdict` invoked (not batch) in plan/fix mode
- [ ] Each `/seek-verdict` uses fresh Codex thread (anti-anchoring)
- [ ] `--no-verdict` skips triage
- [ ] >60% DISMISS_VERIFIED triggers `[VERDICT_TRIAGE_WARN]`
- [ ] Writeback dry-run shows plan without executing
- [ ] Writeback execute posts reply + optional resolve
- [ ] Auto-loop triggers after fix mode edits

## References

- `references/api-contract.md` — GraphQL query + REST fallback specification
- `references/token-budget.md` — Truncation strategy + budget rules
- `references/writeback-guardrails.md` — Writeback safety rules + jq pattern
- `references/verdict-triage-prompt.md` — Per-thread verdict packaging template (for `/seek-verdict` integration)
