# Verdict Triage Prompt — Batch PR Review Thread Assessment

<!-- Pattern source: @skills/seek-verdict/references/verdict-prompt.md -->
<!-- Classification source: @skills/issue-analyze/references/classification.md (Review Thread section) -->
<!-- Threshold source: @skills/seek-verdict/references/policy-mapping.md -->

## Usage

Used with `mcp__codex__codex` (**fresh thread required**) in `/load-pr-review` Step 1.5.

```typescript
mcp__codex__codex({
  prompt: `You are a senior code reviewer performing an independent triage of PR review comments.

## PR Context

- PR #${PR_NUMBER}: ${PR_TITLE}
- Head: ${HEAD_BRANCH} -> Base: ${BASE_BRANCH}
- HEAD SHA: ${CURRENT_HEAD_SHA}

## Review Threads Under Triage

${THREADS.map((t, i) => `
### Thread ${i + 1} (id: ${t.id})
- File: ${t.path}:${t.line}
- Reviewer: ${t.comments[0].author}
- Comment: ${t.comments[0].body}
${t.comments.length > 1 ? t.comments.slice(1).map(c => `  - Reply (${c.author}): ${c.body}`).join('\n') : ''}
`).join('\n')}

## Your Task

For EACH thread above, independently determine:
1. Is this comment actionable (requires a code/doc change) or non-actionable (already addressed, false positive, or purely cosmetic with no real impact)?
2. What category does it belong to?

**Do not assume any comment is valid or invalid.** You must independently verify each by reading the actual code.

## ⚠️ Important: You must independently research the project ⚠️

When reviewing, you **must** perform the following research, do not rely only on the context above:

### Git Exploration (Priority)
1. Check change status: \`git status\`
2. Check changed files: \`git diff --name-only HEAD\`
3. Check full changes for specific file: \`git diff HEAD -- <file-path>\`
4. Check full content of changed files: \`cat <changed file> | head -200\`

### Project Research
- Search called functions: \`grep -r "functionName" src/ -l | head -10\`
- Read related files: \`cat <file-path> | head -100\`
- Understand class definitions: \`grep -A 20 "class ClassName" src/\`

## Output Format (JSON array, one entry per thread)

Respond with a JSON array. Each entry must include ALL fields:

[
  {
    "thread_id": "<thread.id>",
    "verdict": "ACTIONABLE | NON_ACTIONABLE | UNCERTAIN",
    "confidence": <0.0-1.0>,
    "category": "code_change | doc_update | question | disagree | nit",
    "reasoning": "<brief justification citing specific code evidence>",
    "evidence_refs": ["<file:line>", ...]
  }
]`,
  sandbox: 'read-only',
  'approval-policy': 'never',
});
```

## Anti-Anchoring Enforcement

| Check | Required |
|-------|----------|
| Prompt does NOT contain Claude's classification results | Yes |
| Prompt does NOT contain "Claude thinks..." or similar | Yes |
| Prompt includes "Do not assume any comment is valid or invalid" | Yes |
| Prompt includes full Research Block | Yes |
| Uses fresh `mcp__codex__codex` thread | Yes |

## Anti-Abuse Guard

| Condition | Action |
|-----------|--------|
| >60% of threads receive NON_ACTIONABLE | Emit `[VERDICT_TRIAGE_WARN]` |

```
[VERDICT_TRIAGE_WARN] pr=<N> | non_actionable_ratio=<N/total> | reason=high-dismiss-ratio | timestamp=<ISO8601>
```

## Graceful Degradation

If Codex call fails (timeout, parse error), log warning and proceed without verdict data. All threads default to "no verdict" state — Claude falls back to its own classification.

## Per-Thread Body Truncation

Each comment body in the prompt is truncated to 500 chars (shorter than the data plane's 2000 char limit) to keep the batch prompt within Codex context limits.
