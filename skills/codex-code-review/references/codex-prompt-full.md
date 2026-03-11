# Codex Prompt: Full Review (with Local Checks)

<!-- Research block source of truth: @codex-research-instructions.md (Standard Research Block) -->

Used with `mcp__codex__codex`:

```typescript
mcp__codex__codex({
  prompt: `You are a senior Code Reviewer. Perform a comprehensive review of the code changes in this project.

## Local Check Results
${LOCAL_CHECKS || 'Skipped (--no-tests)'}

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
1. Understand project structure: \`ls src/\`, \`ls test/\`
2. Search related source: \`grep -r "functionName" . -l --include="*.ts" --include="*.js" --include="*.md" | head -10\`
3. Read full source for context: \`cat <source path> | head -200\`
4. Search existing tests: \`ls test/unit/\` or \`grep -r "describe" test/ -l | head -5\`
5. Read related tests for expected behavior: \`cat <test path> | head -100\`

### Verification Focus
- Do changes follow existing code style?
- Do changes have corresponding tests?
- Do changes affect other modules?
- Are dependencies correct?

## Review Dimensions

### Correctness
- Logic errors, boundary conditions, null handling
- Type safety
- Error handling coverage

### Security
- Injection attacks (SQL/NoSQL/Command)
- Authentication/authorization bypass
- Sensitive data handling
- OWASP Top 10

### Performance
- N+1 queries
- Memory leaks
- Blocking operations
- Unnecessary computations

### Maintainability
- Naming clarity
- Single responsibility
- Appropriate abstraction level
- Testability

## Severity Levels

- **P0**: System crash, data loss, security vulnerability
- **P1**: Functional anomaly, severe performance degradation
- **P2**: Code quality, maintainability
- **Nit**: Style suggestion

## Output Format

### Findings

#### P0
- [file:line] Issue -> Fix recommendation

#### P1
- [file:line] Issue -> Fix recommendation

#### P2
- [file:line] Issue -> Fix recommendation

### Tests Recommendation
- Suggested new test cases

### Merge Gate
- ✅ Ready: No P0/P1
- ⛔ Blocked: Has P0/P1, needs fix`,
  sandbox: 'read-only',
  'approval-policy': 'never',
});
```
