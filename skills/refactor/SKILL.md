---
name: refactor
description: "Multi-target refactoring orchestrator. Use when: cleaning up messy code/docs, simplifying code, restructuring documents, batch cleanup. Not for: new features (use feature-dev), bug fixes (use bug-fix), code understanding (use code-explore). Output: refactored code/docs + review gate."
allowed-tools: Read, Grep, Glob, Edit, Write, Bash, Skill, AskUserQuestion
---

# Refactor — Multi-Target Refactoring Orchestrator

## Trigger

- Keywords: refactor, cleanup, clean up, simplify code, restructure, tidy up, reduce complexity, batch refactor
- zh-TW: 重構, 整理, 清理, 簡化

## When NOT to Use

| Scenario | Alternative |
|----------|------------|
| New feature development | `/feature-dev` |
| Bug fix | `/bug-fix` |
| Code understanding | `/code-explore` |
| Doc review only | `/codex-review-doc` |
| Single file simplify (known target) | `/simplify` directly |
| Remove AI artifacts (known doc) | `/de-ai-flavor` directly |

## Prohibited Actions

```
❌ git add | git commit | git push — per @rules/git-workflow.md
```

<budget:token_budget>150000</budget:token_budget>

## Arguments

| Flag | Default | Description |
|------|---------|-------------|
| `--target <path>` | — | Specific file or directory (repo-relative) |
| `--auto` | — | Auto-detect targets using inline metrics |
| `--max-targets N` | 10 | Maximum targets per run |

## Workflow

```
Phase 0: Target Detection → Phase 2: Incremental Refactor Loop → Phase 3: Report
(Phase 1: reserved for v2 — parallel exploration)
```

---

## Phase 0: Target Detection & Planning

### `--target` Mode

1. **Validate path** (per `references/target-detection.md`):
   - Reject absolute paths (starts with `/`)
   - Reject `..` traversal
   - Reject symlink escape (resolved path outside repo root)
   - Reject non-existent files
   - On rejection: `[REFACTOR_BLOCKED] <path>: <reason>`

2. **Detect file type**:
   - Use extension mapping from `references/target-detection.md`
   - For `.md` files: run AI artifact heuristic (scan for tool names, boilerplate, etc.; 3+ matches → `doc-ai`, else → `doc-structure`)
   - v2 types (config/shell/test): log `[REFACTOR_SKIPPED] {target}: type not yet dispatched (v2)` and skip

3. **Classify refactor types** from `references/refactor-catalog.md` (R01-R09 for v1)

### `--auto` Mode

1. **(Optional) Baseline**: Run `/project-audit` to capture health score
2. **Scan** repo for candidate files (code + doc)
3. **Score** each candidate:

   ```
   score = 0.40 × complexity + 0.35 × change_frequency + 0.25 × isolation
   ```

   - `complexity`: `wc -l <file>` normalized 0-1
   - `change_frequency`: `git log --oneline -- <file> | wc -l` normalized 0-1
   - `isolation`: `1 - (import_count / max_import_count)`
4. **Sort** descending, take top `--max-targets` (default 10)
5. **Classify** each target's file type and refactor types

---

## Phase 2: Incremental Refactor Loop

Process each target in priority order. Budget: max `--max-targets` targets per run.

### Code Targets

```
FOR EACH code target:
  1. /verify fast → capture baseline exit code
     IF baseline exit ≠ 0:
       [REFACTOR_SKIPPED] {target}: baseline failing, cannot verify preservation
       CONTINUE

  2. /simplify {target}

  3. /verify fast → capture post-refactor exit code

  4. Behavioral gate (per references/behavioral-gate.md):
     IF BEHAVIOR_CHANGED (0→non-0):
       [REFACTOR_SKIPPED] {target}: behavioral regression detected
       CONTINUE
     IF NO_TESTS (all steps skipped):
       ⚠️ NO_TESTS: behavioral preservation not verified (advisory, continue)

  5. /codex-review-fast (auto-loop, max 3 rounds)
     IF still blocked:
       [REFACTOR_BLOCKED] {target}: review not passing after max rounds
       CONTINUE

  6. /precommit-fast (lint + test gate, per CLAUDE.md required flow)
     IF ⛔ FAIL:
       [REFACTOR_BLOCKED] {target}: precommit not passing
       CONTINUE

  7. Mark as committable
```

### Doc Targets

Doc targets bypass the behavioral gate entirely — docs have no executable tests.

```
FOR EACH doc target:
  1. Classify: AI artifact heuristic
     IF doc-ai (3+ matches): dispatch /de-ai-flavor {target}
     ELSE (doc-structure): dispatch /doc-refactor {target}

  2. /codex-review-doc (auto-loop, max 3 rounds)
     IF still blocked:
       [REFACTOR_BLOCKED] {target}: review not passing after max rounds
       CONTINUE

  3. Mark as committable
```

### v2 Targets

```
FOR EACH v2 target (config/shell/test):
  [REFACTOR_SKIPPED] {target}: type not yet dispatched (v2)
  CONTINUE
```

---

## Phase 3: Report & Handoff

### Per-Target Result Table

Output per `references/output-template.md`:

```markdown
| # | Target | Type | Action | Gate | Result |
|---|--------|------|--------|------|--------|
```

### Delta Report (`--auto` only)

If Phase 0 captured `/project-audit` baseline:
1. Run `/project-audit` again
2. Compare dimension scores (before vs after)
3. Output delta table

### User Handoff

List committable files. Suggest `/smart-commit --execute` (no auto-commit per @rules/git-workflow.md).

---

## Review Loop

**⚠️ Per @rules/auto-loop.md: fix → re-review → ... → ✅ Pass**

| After editing... | Immediately run |
|------------------|----------------|
| Code files | `/codex-review-fast` |
| Doc files | `/codex-review-doc` |

## Verification Checklist

- [ ] All code targets passed behavioral gate (`/verify fast` PRESERVED)
- [ ] All targets reviewed (`/codex-review-fast` or `/codex-review-doc`)
- [ ] Skip log complete for all skipped/blocked targets
- [ ] No `git add/commit/push` executed

## Examples

```bash
/refactor --target src/utils.ts           # Refactor single code file
/refactor --target docs/guide.md          # Refactor single doc file
/refactor --target src/                   # Refactor all code in directory
/refactor --auto                          # Auto-detect up to 10 targets
/refactor --auto --max-targets 5          # Auto with budget cap
```
