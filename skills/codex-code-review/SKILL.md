---
name: codex-code-review
description: "Code review using Codex MCP. Use when: PR review, code audit, second opinion on changes. Not for: doc review (use doc-review), security audit (use security-review). Output: severity-grouped findings + merge gate."
allowed-tools: mcp__codex__codex, mcp__codex__codex-reply, Bash(git:*), Bash(yarn:*), Bash(npm:*), Bash(bash:*), Read, Grep, Glob, Task
---

# Codex Code Review

<!-- Security note: Bash(bash:*) is broader than ideal; cannot scope to specific
     script paths until Claude Code #9354 resolves ${CLAUDE_PLUGIN_ROOT} in
     command frontmatter. Only invoke bash for project scripts (scripts/*). -->

## Trigger

- Keywords: review, PR, code review, second opinion, audit, check

## When NOT to Use

- Document review (use `doc-review`)
- Security-specific review (use `security-review`)
- Test coverage review (use `test-review`)
- Just want to understand code (use `code-explore`)

## Variants

| Variant | Command | Scope | Pre-checks |
|---------|---------|-------|------------|
| Fast    | `/codex-review-fast` | Diff only | None |
| Full    | `/codex-review` | Diff + local checks | lint:fix + build |
| Branch  | `/codex-review-branch` | Full branch | None |

## Shared Workflow

```
Step 0 (PENDING) → Collect changes → [Pre-checks if Full] → Dual Review (Codex + Task) → Await Results → Aggregate → Emit Gate → Loop if Blocked
```

### Step 0: Dual Review Init (Fail-closed)

Execute: `bash scripts/emit-review-gate.sh PENDING`

This sets `review_mode=dual` and `aggregate_gate.executed=false` in state file, ensuring fail-closed semantics — if the process crashes before Step 4.5, stop-guard blocks.

### Step 1: Collect Change Metadata

Collect **metadata only** — Codex reads the actual diffs and file contents itself via sandbox access.

| Variant | Collection Method |
|---------|-------------------|
| Fast    | `CHANGED_FILES`: `git diff --name-only HEAD` + `DIFF_STAT`: `git diff --stat HEAD` |
| Full    | Same as Fast |
| Branch  | Same + `CURRENT_BRANCH` + `BASE_BRANCH` + `COMMIT_COUNT` |

Codex independently reads full diffs and file contents via `git diff HEAD -- <file>` + `cat` (per research instructions).

### Step 2: Pre-checks (Full variant only)

```bash
{LINT_FIX_COMMAND}
{BUILD_COMMAND}
```

These placeholders are resolved from the host project's `CLAUDE.md` or `package.json` scripts. Record results as `LOCAL_CHECKS`.

### Step 3: Dual Review (Parallel Dispatch)

**Case A: First review (no `--continue`)**

Launch **two reviewers in parallel** (single message, multiple tool calls):

1. **Codex MCP (primary)**: Use `mcp__codex__codex` with variant-specific prompt:

   | Variant | Prompt Template |
   |---------|-----------------|
   | Fast    | `references/codex-prompt-fast.md` |
   | Full    | `references/codex-prompt-full.md` |
   | Branch  | `references/codex-prompt-branch.md` |

   Config: `sandbox: 'read-only'`, `approval-policy: 'never'`

   **Save the returned `threadId`.**

2. **Secondary reviewer**: Use `Task` tool with reviewer selection cascade:

   | Priority | Reviewer | subagent_type | Condition |
   |----------|----------|---------------|-----------|
   | 1 | `pr-review-toolkit:code-reviewer` | `pr-review-toolkit:code-reviewer` | Default choice |
   | 2 | `strict-reviewer` | `strict-reviewer` | Priority 1 fails/times out |
   | 3 | Codex-only (degraded) | — | Both unavailable |

   **Selection**: Try priority 1 first. If Task fails or times out (30s), try priority 2. If both unavailable, fall back to Codex-only (degraded mode — proceed with Codex results only, apply degradation matrix from `references/review-common.md`).

   **Task prompt** (provide changed file list + diff stats, request P0/P1/P2/Nit findings in standard output format):

   ```
   Review the code changes for correctness, security, performance, and maintainability issues.

   ## Changed Files
   <git diff --name-only output>

   ## Diff Stats
   <git diff --stat output>

   Read the actual diffs and file contents yourself to perform the review.

   Output findings in this format:
   - [P0/P1/P2/Nit] file:line issue description → fix recommendation

   Group by severity. Include a final gate: ✅ Ready (no P0/P1) or ⛔ Blocked (has P0/P1).
   ```

**Case B: Loop review (has `--continue`)**

- **Codex**: Use `mcp__codex__codex-reply` with re-review template from `references/review-common.md`
- **Secondary**: Re-dispatch in parallel (same mechanism as first pass, fresh context). Always dispatched in v1 — no skip exception. Cycle resets on any code edit.

### Step 3.5: Await Codex + Reconcile Secondary

Codex is the **blocking** reviewer — await its result for the initial gate. Secondary runs in background (`run_in_background: true`) and is **non-blocking**:

| Secondary Status | Action |
|-----------------|--------|
| Completed before Codex | Include in aggregation (Step 4) |
| Completed after Codex, before precommit | Reconcile at pre-precommit checkpoint |
| Still running at precommit | Proceed with Codex gate (authoritative); if late result has P0/P1, re-open fix→re-review loop |
| Failed/timed out | Apply degradation matrix per `references/review-common.md § Dual Reviewer Aggregation` |

### Step 4: Consolidate Output (Dual Mode)

1. **Normalize** both sets of findings to unified format: `[severity] file:line description → fix`
   - Codex findings: already in standard format
   - toolkit findings: apply Severity Mapping (see `references/review-common.md § Severity Mapping`)
   - strict-reviewer findings: already use P0/P1/P2/Nit

2. **Deduplicate** using key = `file + canonical_issue_text` (ignore line ±5 difference)
   - Same key → keep highest severity (P0 > P1 > P2 > Nit)

3. **Tag source**: `source = codex | toolkit | both`

4. **Sort**: P0 → P1 → P2 → Nit

5. **Gate decision**: any P0/P1 → BLOCKED; else → READY

Output format includes source tag:

```
- [P0] file:line issue → fix [source: both]
- [P1] file:line issue → fix [source: codex]
```

### Step 4.5: Emit Review Gate

Execute: `bash scripts/emit-review-gate.sh READY` or `bash scripts/emit-review-gate.sh BLOCKED`

This updates `aggregate_gate.executed=true` and `aggregate_gate.gate` in the state file.

Then output the standard gate sentinel:
- `✅ Ready` — if READY (no P0/P1)
- `⛔ Blocked` — if BLOCKED (has P0/P1)

## Shared Definitions

See `references/review-common.md` for:
- Severity levels (P0/P1/P2/Nit)
- Review dimensions
- Merge gate definitions
- Re-review prompt template
- Gate sentinels (hook + behavior-layer)
- Dual Reviewer Aggregation (severity mapping, deduplication, degradation matrix, source attribution)

## Review Loop

**⚠️ @CLAUDE.md auto-loop: fix → re-review → ... → ✅ PASS ⚠️**

Blocked → fix P0/P1 → `/codex-review-fast --continue <threadId>` → repeat until Ready.
Ready + P2/Nit → batch fix → 1 Codex `--continue` verify → evaluate (see `rules/auto-loop.md` P2/Nit Quality Sweep).

3 rounds on same issue → report blocker, request intervention.

### Dual Mode Loop Behavior

| Reviewer | Loop Behavior |
|----------|---------------|
| Codex MCP | Stateful → `mcp__codex__codex-reply(threadId)` continues context |
| Secondary | Re-dispatched every iteration (fresh context). Always dispatched in v1 (no skip exception). |

Codex gate is authoritative for timing. Secondary runs non-blocking in background. Aggregation reconciled at pre-precommit checkpoint. Any code edit resets the review cycle — both reviewers must re-run.

### Pre-precommit Checkpoint

Before triggering `/precommit-fast`, reconcile any pending secondary result:

| Condition | Action |
|-----------|--------|
| Task completed + has P0/P1 | Re-emit BLOCKED → fix → re-review (Codex `--continue` + Secondary fresh) |
| Task completed + no P0/P1 | Union aggregate → proceed to precommit |
| Task still running | Proceed with Codex gate (authoritative); if late result has P0/P1, re-open fix→re-review loop |

## Verification

- [ ] Each issue tagged with severity (P0/P1/P2/Nit)
- [ ] Gate is clear (✅ Ready / ⛔ Blocked)
- [ ] Issues include: file:line, description, fix suggestion
- [ ] Codex performed independent project research
- [ ] Branch variant: dimension rating table included

## References

- Shared definitions: `references/review-common.md`
- Fast prompt: `references/codex-prompt-fast.md`
- Full prompt: `references/codex-prompt-full.md`
- Branch prompt: `references/codex-prompt-branch.md`
- Research instructions: `references/codex-research-instructions.md`

## Examples

```
Input: /codex-review-fast
Action: emit PENDING → git diff → Codex + Task(code-reviewer) parallel → aggregate → emit gate → P0/P1/P2/Nit + Gate

Input: /codex-review --focus "auth"
Action: emit PENDING → lint:fix → build → git diff → Codex + Task parallel (focus: auth) → aggregate → emit gate

Input: /codex-review-branch origin/develop
Action: emit PENDING → branch diff + history → Codex + Task parallel → aggregate → emit gate → Rating table + Findings + Gate

Input: /codex-review-fast (Codex unavailable)
Action: emit PENDING → git diff → Task(code-reviewer) only → degraded aggregate → emit gate + ⚠️ warning
```
