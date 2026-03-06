# Review Common Definitions

## Severity Levels

- **P0**: System crash, data loss, security vulnerability
- **P1**: Functional anomaly, severe performance degradation
- **P2**: Code quality, maintainability concerns
- **Nit**: Style suggestions, minor improvements

## Review Dimensions

| Dimension       | Checklist |
|-----------------|-----------|
| Correctness     | Logic errors, boundary conditions, null handling, off-by-one, type safety, error handling |
| Security        | Injection attacks (SQL/NoSQL/Command), auth bypass, sensitive data leaks, OWASP Top 10 |
| Performance     | N+1 queries, memory leaks, unnecessary loops/computations, blocking operations |
| Maintainability | Naming clarity, function length, single responsibility, duplicate code, testability |

## Merge Gate

- **Ready**: No P0/P1; P2/Nit sweep policy applies before precommit
- **Blocked**: Has P0/P1, needs fix

## Codex Independent Research (Required)

Codex **must** perform its own research, not rely only on provided diff/context:

### Git Exploration (Priority)

1. Check change status: `git status`
2. Check changed files: `git diff --name-only HEAD`
3. Check full changes for specific file: `git diff HEAD -- <file-path>`
4. Check full content of changed files: `cat <changed file> | head -200`

### Project Research

- Search called functions: `grep -r "functionName" . -l --include="*.ts" --include="*.js" --include="*.md" | head -10`
- Read related files: `cat <file-path> | head -100`
- Understand class definitions: `grep -rA 20 "class ClassName" . --include="*.ts" --include="*.js"`

## Review Loop

**⚠️ Follow @CLAUDE.md review loop rules ⚠️**

When review result is Blocked:

1. Remember the `threadId`
2. Fix P0/P1 issues
3. Re-review using `--continue <threadId>`
4. Repeat until Ready

## P2/Nit Post-Ready Sweep

When review returns Ready with P2/Nit findings, auto-loop triggers a quality sweep:

1. **Batch-fix** all P2/Nit items (1 attempt)
2. **Re-review** using `--continue <threadId>` with P2/Nit verification
3. **Evaluate**: unresolved P2 → ⚠️ Need Human; unresolved Nit → exempt with `[NIT_DEFERRED]` log; all resolved → `/precommit-fast`

### P2/Nit Judgment

| Step | Description |
|------|-------------|
| Parse | Extract P2/Nit findings from Codex output (tag-based `[P2]`/`[Nit]` or section-based `#### P2`/`#### Nit`) |
| Identity | Key = `file + canonicalized issue text` (line number approximate, may shift after fix) |
| Dedupe | Same key across reviews counts as 1 item |
| False-positive | Same key persists after fix → mark `possible-false-positive` |

### Re-review Prompt Template

Used with `mcp__codex__codex-reply`:

```typescript
mcp__codex__codex-reply({
  threadId: '<from --continue parameter>',
  prompt: `I have fixed the previously identified issues. Please re-review:

## ${LOCAL_CHECKS ? 'Local Check Results\n' + LOCAL_CHECKS + '\n\n##' : ''} New Git Diff
\`\`\`diff
${GIT_DIFF}
\`\`\`

Please verify:
1. Have previous P0/P1 issues been correctly fixed?
2. Did fixes introduce new issues?
3. Update Merge Gate status
4. For P2/Nit items from previous review: are they resolved? List any remaining P2/Nit with status.`,
});
```

## Output Findings Format

```
- [P0/P1/P2/Nit] <file:line> <issue description> -> <fix recommendation>
```

## Gate Sentinels (for Hook parsing)

- `✅ Ready` — Passed (code review)
- `⛔ Blocked` — Failed (code review)

> Note: Use explicit `✅ Ready` / `⛔ Blocked` tokens. Bare `## Gate:` prefix is optional label only.
