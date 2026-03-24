# Verdict Prompt Template

<!-- Research block source of truth: @skills/codex-code-review/references/codex-research-instructions.md (Standard Research Block) -->

## Phase B: Blind Independent Verdict

Used with `mcp__codex__codex` (**new thread required** — never use `codex-reply` from the review session):

```typescript
mcp__codex__codex({
  prompt: `You are a senior code reviewer performing an independent assessment of a finding.

## Finding Under Review

\`\`\`
finding_key: ${FINDING_KEY}
severity: ${SEVERITY}
intent: ${INTENT}
original_finding_text: ${ORIGINAL_FINDING_TEXT}
origin_thread_id: ${ORIGIN_THREAD_ID}
current_head_sha: ${CURRENT_HEAD_SHA}
\`\`\`

## Relevant Code Context
\`\`\`diff
${RELEVANT_DIFF}
\`\`\`

## Your Task

Determine whether this finding is actionable (requires a code fix) or non-actionable (false positive / no real impact).

**Do not assume this finding is true or false.** You must independently verify.

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

## Output (all fields required)

- codex_verdict: ACTIONABLE | NON_ACTIONABLE | UNCERTAIN
- confidence: [0.0 - 1.0]
- evidence_refs: [list of files/lines/commands you used to reach this conclusion]
- reasoning: [why this verdict, not the others — cite specific evidence]`,
  sandbox: 'read-only',
  'approval-policy': 'never',
});
```

## Anti-Anchoring Enforcement

| Check | Required |
|-------|----------|
| Prompt does NOT contain Claude's dismiss hypothesis | Yes |
| Prompt does NOT contain "Claude thinks..." or similar | Yes |
| Prompt does NOT ask "is this a false positive?" | Yes |
| Prompt includes "Do not assume this finding is true or false" | Yes |
| Uses fresh `mcp__codex__codex` thread (not `codex-reply` from review) | Yes |

## Candidate Packaging (Phase A)

Before calling Codex, extract the finding packet locally:

```
finding_packet:
  finding_key: <file + canonical_issue_text>
  severity: <P0 | P1 | P2 | Nit>
  intent: <dismiss | confirm | clarify>
  original_finding_text: <Codex review original text (secrets redacted)>
  origin_thread_id: <review session threadId>
  current_head_sha: <git rev-parse HEAD>
  relevant_diff: <git diff HEAD -- <file>>
```

**Critical**: Record Claude's dismiss hypothesis locally but **never include it in the Codex prompt**.

## Rebuttal Prompt (Phase B extension)

If Codex returns `FIX_REQUIRED` and Claude has objective counter-evidence (1 round max):

```typescript
mcp__codex__codex-reply({
  threadId: '<verdict threadId>',
  prompt: `Counter-evidence for your FIX_REQUIRED verdict:

## Objective Evidence
${COUNTER_EVIDENCE}

Based on this additional evidence, please re-evaluate:
- codex_verdict: ACTIONABLE | NON_ACTIONABLE | UNCERTAIN
- confidence: [0.0 - 1.0]
- evidence_refs: [updated list]
- reasoning: [updated reasoning]`,
});
```
