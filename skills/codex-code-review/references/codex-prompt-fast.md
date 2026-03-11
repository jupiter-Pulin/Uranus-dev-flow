# Codex Prompt: Quick Review (Diff Only)

<!-- Research block source of truth: @codex-research-instructions.md (Standard Research Block) -->

Used with `mcp__codex__codex`:

```typescript
mcp__codex__codex({
  prompt: `You are a senior Code Reviewer. Review the code changes in this project, focus on finding issues rather than praise.

## Changed Files
${CHANGED_FILES}

## Diff Stats
${DIFF_STAT}

${FOCUS ? `## Focus Area\nPay special attention to: ${FOCUS}` : ''}

## ⚠️ Important: You must independently research the project ⚠️

The changed files and diff stats are listed above. You **must** read the actual diffs and file contents yourself using your sandbox access. Do NOT expect a pre-provided diff — you are responsible for reading all changes in context.

### Git Exploration (Priority)
1. Check change status: \`git status\`
2. Read the full diff: \`git diff HEAD\`
3. For each changed file, read the full diff: \`git diff HEAD -- <file-path>\`
4. Read full content of changed files for context: \`cat <changed file> | head -200\`

### Project Research
- Search called functions: \`grep -r "functionName" . -l --include="*.ts" --include="*.js" --include="*.md" | head -10\`
- Read related files: \`cat <file-path> | head -100\`
- Understand class definitions: \`grep -rA 20 "class ClassName" . --include="*.ts" --include="*.js"\`

## Review Dimensions

| Dimension      | Checklist |
|----------------|-----------|
| Correctness    | Logic errors, boundary conditions, null handling, off-by-one |
| Security       | Injection attacks, auth bypass, sensitive data leaks, OWASP Top 10 |
| Performance    | N+1 queries, memory leaks, unnecessary loops, blocking operations |
| Maintainability| Naming clarity, function length, duplicate code, over-abstraction |

## Severity Level Definitions

- **P0**: Would cause system crash, data loss, security vulnerability
- **P1**: Would cause functional anomaly, severe performance degradation
- **P2**: Code quality issues, maintainability concerns
- **Nit**: Style suggestions, minor improvements

## Output Format

### Findings

- [P0/P1/P2/Nit] <file:line> <issue description> -> <fix recommendation>

### Merge Gate

- ✅ Ready: No P0/P1, safe to merge
- ⛔ Blocked: Has P0/P1, needs fix`,
  sandbox: 'read-only',
  'approval-policy': 'never',
});
```
