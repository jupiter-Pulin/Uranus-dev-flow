---
name: load-pr-review
description: "Load GitHub PR review comments into AI session — summarize, plan fixes, apply changes, optional writeback. Use when: reviewing PR feedback, planning fixes, addressing review comments, replying to reviewers. Not for: creating reviews (use codex-review-fast), creating PRs (use create-pr), viewing PR status (use pr-summary)."
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
Load review → AI-assisted triage → optional fix → optional writeback
Data plane (JS script) handles fetch/normalize/writeback.
Control plane (this SKILL.md) handles classification, fix orchestration, auto-loop.
```

## Workflow

```mermaid
sequenceDiagram
    participant U as User
    participant SK as SKILL.md
    participant JS as load-pr-review.js
    participant GH as GitHub (gh CLI)
    participant CX as Codex (fresh thread)
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
        SK->>CX: Batch triage (issue-analyze + seek-verdict pattern)
        Note over CX: Independent research
        CX-->>SK: Per-thread verdicts
    end

    alt summary mode
        SK->>U: Table of threads
    end

    alt plan mode
        SK->>SK: Classify comments (AI)
        SK->>U: Fix strategy by priority
    end

    alt fix mode
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

## Step 1.5: Issue Analysis Triage (verdict-enabled by default)

In **plan** and **fix** modes (not summary), run a batch Codex assessment following `/issue-analyze`'s classification model and `/seek-verdict`'s blind verdict pattern.

**When to execute**:

| Mode | Verdict | Reason |
|------|---------|--------|
| summary | Skip | Lightweight display, cost not justified |
| plan | Execute (default) | Enrich plan table with Codex assessment |
| fix | Execute (default) | Pre-select actionable threads |

**Flag**: `--no-verdict` disables this step.

**Execution**: Use the batch prompt template in `references/verdict-triage-prompt.md`:
1. Collect all unresolved threads from Step 1 output (when `--all` is used, scope remains unresolved-only for triage; resolved/outdated threads are excluded from verdict assessment)
2. Call `mcp__codex__codex` with fresh thread, `sandbox: 'read-only'`, `approval-policy: 'never'`
3. Parse JSON array response — match each entry's `thread_id` to loaded threads
4. If >60% threads are NON_ACTIONABLE, emit `[VERDICT_TRIAGE_WARN]`
5. If Codex call fails, warn user and proceed without verdict (graceful degradation)

**Anti-anchoring**: The prompt contains only raw thread data (reviewer comments, file, line). Never include Claude's own classification.

**Result mapping** (per `@skills/seek-verdict/references/policy-mapping.md`; normal state — heightened thresholds apply after `[DISMISS_PATTERN_WARN]`, see policy-mapping.md Anti-Abuse Guard):

| Codex Verdict | Confidence | Evidence Refs | Result | Grouping |
|---------------|------------|---------------|--------|----------|
| NON_ACTIONABLE | >= 0.80 (normal) / >= 0.85 (heightened) | >= 2 (normal) / >= 3 (heightened) | DISMISS_VERIFIED | Likely Non-Actionable |
| ACTIONABLE | >= 0.70 | any | FIX_REQUIRED | ACTIONABLE |
| UNCERTAIN / low | any | any | NEED_HUMAN | Needs Discussion |

## Step 2: Present (mode-dependent)

### Summary Mode (default)

Display the thread table:

```markdown
## PR #<N>: <title>
**Review Status**: <unresolved> unresolved / <total> total threads

| # | File | Line | Reviewer | Comment (truncated) |
|---|------|------|----------|---------------------|
| 1 | src/foo.ts | 42 | alice | Use early return... |

Use `--mode plan` to get fix strategy, or `--mode fix` to start fixing.
```

### Plan Mode

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

### Fix Mode

1. Show plan first (as in plan mode)
   - ACTIONABLE threads are pre-selected; NON_ACTIONABLE threads are listed with `(DISMISS_VERIFIED — skip suggested)` — user can override via AskUserQuestion
2. AskUserQuestion: which threads to fix?
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
- [ ] Summary/plan/fix modes produce correct output
- [ ] Writeback dry-run shows plan without executing
- [ ] Writeback execute posts reply + optional resolve
- [ ] Auto-loop triggers after fix mode edits
- [ ] Verdict triage executes in plan/fix mode (not summary)
- [ ] `--no-verdict` skips triage
- [ ] Codex prompt contains no Claude classifications (anti-anchoring)
- [ ] >60% NON_ACTIONABLE triggers `[VERDICT_TRIAGE_WARN]`

## References

- `references/api-contract.md` — GraphQL query + REST fallback specification
- `references/token-budget.md` — Truncation strategy + budget rules
- `references/writeback-guardrails.md` — Writeback safety rules + jq pattern
- `references/verdict-triage-prompt.md` — Batch Codex verdict prompt for PR review triage
