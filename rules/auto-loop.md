# Auto-Loop Rule ⚠️ CRITICAL

**Fix -> immediately re-review -> fail -> fix again -> ... -> ✅ Pass -> next step**

## Prohibited Behaviors

❌ Asking "Should I re-review?" or "Continue?" after fixing
❌ Stopping after outputting a summary without executing review
❌ Waiting for user instructions
❌ **Declaring as executing**: Saying "need to run X" without actually invoking the tool
❌ **Summary as completion**: Outputting a polished summary then stopping, without executing the next step
❌ **Context/token excuse**: Citing context window limits, long session, or token budget as reason to skip or defer review. If context is genuinely exhausted, the model must still attempt the review — failure to invoke is a violation regardless of reason

## Auto-Trigger

| Change Type | Event              | Execute Immediately  |
| ----------- | ------------------ | -------------------- |
| code files  | Fix P0/P1/P2       | `/codex-review-fast` |
| code files  | review Ready + P2/Nit | P2/Nit Quality Sweep |
| code files  | review Ready (no P2/Nit) | `/precommit-fast` |
| code files  | precommit Pass     | Doc Sync (see Note)  |
| code files  | precommit failure  | Fix -> re-run        |
| `.md`       | Fix doc issues     | `/codex-review-doc`  |
| `.md`       | review failure     | Fix -> re-run        |

### Dual Review Mode

Code review commands dispatch two reviewers in parallel. This section defines the interaction with auto-loop.

| Rule | Description |
|------|-------------|
| First-pass dual | Code review command must dual-dispatch on first pass (Codex + secondary background) |
| Non-blocking secondary | Secondary reviewer runs in background and does not block initial gate emission |
| Late P0/P1 | Within same review session, late secondary P0/P1 re-opens fix→re-review loop |
| Loop re-review | `--continue` loops use Codex stateful re-review only; do not restart secondary |
| Pre-precommit checkpoint | Before `/precommit-fast`, reconcile any pending secondary result; if late P0/P1, re-enter review loop |

## P2/Nit Quality Sweep

**Gate ✅ Ready + P2/Nit exists → batch fix → verify → precommit**

When Codex review returns `✅ Ready` but findings include P2 or Nit items:

| Step | Action | Detail |
|------|--------|--------|
| 1 | Batch-fix | Fix all P2/Nit in one pass (1 attempt) |
| 2 | Verify | 1 batched Codex `--continue` re-review |
| 3 | Evaluate | Check resolution status |
| 4 | Continue | Proceed to `/precommit-fast` or stop |

### Resolution Evaluation

| Priority | Condition | Action |
|----------|-----------|--------|
| 1 | Unresolved P2 | ⚠️ Need Human — stop, report reason |
| 2 | Unresolved Nit only | Continue — Nit exemption with log |
| 3 | All resolved | `/precommit-fast` |

### Nit Exemption Log

When unresolved Nit items are exempted, output structured log:

```
[NIT_DEFERRED] file:line | issue | reason: possible-false-positive | timestamp
```

### No P2/Nit Path

Gate ✅ Ready + no P2/Nit → directly `/precommit-fast` (unchanged behavior).

## Exit Conditions (Only)

- ✅ All Pass
  - Code changes: review + precommit all passed
  - Doc changes: doc review passed
- ⛔ Need Human — Architecture changes, feature removal, user requests stop
- ⚠️ Need Human — Feature docs not found (3-level fallback exhausted)
- 🔄 3 rounds on same issue — Report blocker, request intervention

## Correct Behavior

```
"Fixed 3 issues, running /codex-review-fast..."
[Execute]
"Passed, running /precommit-fast..."
[Execute]
"All passed ✅"
```

## ⚠️ Behavior Anchor: Execute Within the Same Reply

### Correct Pattern

```
[Edit complete] -> Invoke review tool in the same reply -> Wait for result -> Report
```

```
Claude: [Edit tool complete]
        ↓
        "Updated, running review..."
        ↓
        [Skill tool: /codex-review-doc]  <- Same reply
        ↓
        "Review passed ✅" or "Issues found, fixing..."
```

### Incorrect Pattern

```
[Edit complete] -> Output summary -> [Stop] -> User follows up -> Then execute review
```

```
Claude: [Edit tool complete]
        ↓
        "Updated requirements doc ✅"
        ↓
        [Output polished table summary]
        ↓
        "Next step: suggest running /codex-review-doc"  <- ❌ Declaring as executing
        ↓
        [Stop, waiting for user]  <- ❌ Violates rule
```

### Key Principles

| Principle                  | Description                                                      |
| -------------------------- | ---------------------------------------------------------------- |
| **Declaring ≠ Executing**  | Saying "need to run" does not equal having run it                |
| **Summary ≠ Completion**   | After outputting a summary, the review process is still ongoing  |
| **Execute in same reply**  | After Edit completes, must invoke review tool in the same reply  |
| **Stop only on result**    | Can only stop after seeing review result (Pass/Fail)             |

## Enforcement Mechanism

### Dual-Layer Defense

```
[Edit/Write] -> [PostToolUse Hook] -> [State file update]
                                          ↓
[Stop Hook] <- Read state file <- [Review command executed]
```

| Layer       | Mechanism                          | Trigger              |
| ----------- | ---------------------------------- | -------------------- |
| PostToolUse | Track file changes + review result | Edit/Bash execution  |
| Stop Hook   | Warn before stopping if review pending (strict mode: block) | When attempting stop  |

### State File Schema

**File**: `.claude_review_state.json` (locally ignored)

```json
{
  "session_id": "abc123",
  "updated_at": "2026-01-26T10:00:00Z",
  "has_code_change": true,
  "has_doc_change": false,
  "code_review": {
    "executed": true,
    "passed": true,
    "last_run": "2026-01-26T10:00:00Z"
  },
  "doc_review": { "executed": false, "passed": false },
  "precommit": {
    "executed": true,
    "passed": true,
    "last_run": "2026-01-26T10:01:00Z"
  }
}
```

> **Note**: The above shows the full field schema; the actual hook may only update a subset of fields.

### Debug and Escape Hatch

| Environment Variable | Purpose                   | Use Case        |
| -------------------- | ------------------------- | --------------- |
| `HOOK_DEBUG=1`       | Output debug information  | Troubleshooting |
| `HOOK_BYPASS=1`      | Skip Stop Hook checks     | Emergency       |

### Standard Gate Sentinels

Review commands must output standard markers. Hook-parsed sentinels are consumed by `stop-guard.sh`; behavior-layer sentinels are consumed by Claude's auto-loop logic only.

| Sentinel | Context | Meaning | Parsed by |
|----------|---------|---------|-----------|
| `✅ Ready` | Code review | No P0/P1 | Hook + behavior |
| `⛔ Blocked` | Code review | Has P0/P1 | Hook + behavior |
| `✅ Mergeable` | Doc review | No 🔴 items | Hook + behavior |
| `⛔ Needs revision` | Doc review | Has 🔴 items | Hook + behavior |
| `✅ All Pass` | Precommit | All checks passed | Hook |
| `⛔ FAIL` / `❌ FAIL` | Precommit | Check failed | Hook |
| `⚠️ Need Human` | Any | Needs human intervention | Behavior-layer only |

### Doc Sync Note

Doc Sync is a **behavior-layer rule** (not hook-enforced). After precommit Pass, only when the change maps to a feature under `docs/features/`, auto-trigger:

1. `/update-docs <tech-spec-path>` — Incremental update of changed sections
2. `/create-request --update <request-path>` — Update Progress / Status / AC (e.g. `docs/features/<feature>/requests/<date>-<title>.md`)

**Target detection**: 3-level fallback (context → git diff → ⚠️ Need Human). See `/update-docs` for algorithm details.

**Safety valve**: After doc sync, compare code diff against pre-sync baseline; if new code changes exist, return to review loop. See `/update-docs` Safety Valve section.

## Project Customization

Project-specific overrides belong in `auto-loop-project.md` (not this file).
See `@rules/auto-loop-project.md` for your project's custom auto-loop behavior.
