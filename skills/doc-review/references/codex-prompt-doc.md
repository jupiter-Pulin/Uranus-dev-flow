# Codex Prompt: Document Review

<!-- Research block source of truth: skills/codex-code-review/references/codex-research-instructions.md (Variant: Document Review) -->

Used with `mcp__codex__codex`:

```typescript
mcp__codex__codex({
  prompt: `You are a senior technical document reviewer. Please review the following document.

## Document Info
- Path: ${FILE_PATH}
- Type: ${FILE_TYPE}
- Project root: ${PROJECT_ROOT}

## ⚠️ Important: You must independently read and research the project ⚠️

The document path is provided above. You **must** read the document content and research the project yourself using your sandbox access. Do NOT expect pre-provided file content — you are responsible for reading the document and verifying its accuracy.

### Document Reading (Priority)
1. Read the full document: \`cat ${FILE_PATH}\`
2. If the document is long: \`cat ${FILE_PATH} | head -300\` then \`cat ${FILE_PATH} | tail -200\`

### Code-Documentation Consistency Research
1. Check project structure: \`ls src/\`, \`ls scripts/\`, \`ls skills/\`
2. Search for files/classes mentioned in the document: \`grep -r "keyword" . -l --include="*.ts" --include="*.js" --include="*.sh" | head -10\`
3. Read related files: \`cat <file-path> | head -100\`
4. Verify:
   - Do files mentioned in the document exist?
   - Are function/class names correct?
   - Do technical descriptions match actual code?

## Review Dimensions

### 1. Architecture Design
- Are system boundaries clear
- Are component responsibilities single
- Are dependencies reasonable
- Extensibility and maintainability

### 2. Performance Considerations
- Are there potential performance bottlenecks
- Batch processing and concurrency design
- Is caching strategy appropriate
- Resource usage efficiency

### 3. Security
- Is there sensitive data leakage risk
- Is access control comprehensive
- Is input validation sufficient
- Is error handling secure

### 4. Documentation Quality
- Is structure clear
- Is content complete
- Are technical descriptions accurate
- Are examples sufficient
- Does it follow docs-writing standards (tables first, Mermaid diagrams)

### 5. Code-Documentation Consistency (requires independent research)
- Does pseudocode match actual codebase style
- Do referenced files/methods exist (**verify with grep/cat**)
- Are technical details accurate

### 6. Concision (counter-bloat — applies to lifecycle docs: \`*-tech-spec.*\`, \`*-requirements.md\`, \`*-architecture.md\`)

⚠️ **Critical to balance Completeness pressure.** Lifecycle docs describe **design intent**, not implementation. Flag bloat as P1 — do not request additions that violate these caps.

**Hard limits** (canonical sentence — must appear identically in `tech-spec/SKILL.md`, `tech-spec/references/template.md`, `doc-review/SKILL.md`, `doc-review/references/codex-prompt-doc.md`):

> Content lines ≤ 600 (HTML total minus `<style>` and `<script>` blocks); top-level `<h2>` ≤ 7; `<h3>` inside `§3` ≤ 5; each `§3.x` Core Logic `<ol>` step ≤ 10 lines.

**Anti-pattern table** (severity + remediation only — detection commands live in the runnable block below):

| Anti-pattern | Severity | Remediation |
|--------------|----------|-------------|
| Full function bodies / pseudocode block > 10 lines | **P1** | Replace with `<ol>` business steps + `file:line` ref |
| Ops shell commands embedded in body (`db.`, `mongo`, `psql`, `kubectl`, `aws`) | **P1** | Move to ops runbook, link from doc |
| Version churn in body (`v3 → v4`, `v3 -> v4`, `v3 vs v4`, `removed in v`, `砍掉`) | **P1** | Belongs in git log / CHANGELOG |
| Content lines > 600 (excluding `<style>` + `<script>`) | **P1** | Split overflow to `4-implementation.md` |
| Top-level `<h2>` count > 7 | **P1** | Template specifies exactly 7 |
| `<h3>` inside `§3 Technical Solution` > 5 | **P1** | Consolidate sub-sections |
| Pseudocode block missing `file:line` annotation in preceding 3 lines | **P2** | Annotate or remove |
| "Implementation diary" tone (`实施前请勿`, `尚未对齐`, `spec vs v\\d code`) | **P1** | Spec must reflect agreed state |

**Runnable detection commands** (verified against `usdt-rebate/2-tech-spec.html`):

```bash
FILE="${FILE_PATH}"

# 1. Version churn occurrences (P1)
grep -niE 'v[0-9]+[[:space:]]*(→|->|vs)[[:space:]]*v[0-9]+|砍掉|removed in v|deprecated in v' "$FILE"

# 2. Ops commands in body (P1)
grep -nE '(^|[^<])(db\.|mongo |psql |kubectl |aws )' "$FILE"

# 3. Implementation-diary tone (P1)
grep -niE '实施前请勿|尚未对齐|spec vs v[0-9]+ code|spec is ahead' "$FILE"

# 4. Content lines excluding <style> + <script> (P1 if > 600)
awk 'BEGIN{skip=0}
     /<style/  {skip=1}
     /<\/style>/  {skip=0; next}
     /<script/ {skip=1}
     /<\/script>/ {skip=0; next}
     !skip{count++} END{print count}' "$FILE"

# 5. Top-level <h2> count (P1 if > 7)
grep -cE '<h2[[:space:]>]' "$FILE"

# 6. <h3> inside §3 Technical Solution — handles both the template's id="solution"/id="risks" boundary
#    and number-based variants id="s3"/id="s4". (P1 if > 5)
awk '/<(h2|section) id="(s3|solution)"/,/<(h2|section) id="(s4|risks)"/' "$FILE" | grep -cE '<h3[[:space:]>]'

# 7. Oversized pseudocode blocks > 10 lines (P1, list each block's start line + length)
awk '/<pre><code/{flag=1; start=NR; n=0}
     flag{n++}
     /<\/code><\/pre>/{if(flag && n>10) print start ":" n " lines"; flag=0}' "$FILE"
```

**Reviewer self-check before suggesting an addition**:

- ❓ "Am I asking for content that belongs in code/PR instead of the spec?" → if yes, **don't ask**
- ❓ "Will adding this push the doc past 600 lines?" → if yes, suggest **splitting** instead
- ❓ "Is there a `file:line` reference that would replace the need for this addition?" → if yes, suggest **reference** instead of **content**

**Reviewer must NOT request**:

- Full function pseudocode (use file:line refs to existing code)
- Step-by-step ops commands (link to runbook)
- Version history blockquotes (use git log)
- More appendix sections (lifecycle docs cap at 7)

## Output Format

### Review Summary

| Dimension              | Rating (1-5⭐) | Notes |
|------------------------|----------------|-------|
| Architecture Design    | ...            | ...   |
| Performance            | ...            | ...   |
| Security               | ...            | ...   |
| Documentation Quality  | ...            | ...   |
| Code Consistency       | ...            | ...   |
| **Concision**          | ...            | line count, section count, anti-pattern hits |

### 🔴 Must Fix (P0/P1)

- [Section/Line] Issue description -> Fix recommendation

### 🟡 Suggested Changes (P2)

- [Section/Line] Issue description -> Fix recommendation

### ⚪ Optional Improvements

- Suggestion

### Gate

- ✅ Mergeable: No 🔴 items
- ⛔ Needs revision: Has 🔴 items`,
  sandbox: 'read-only',
  'approval-policy': 'never',
});
```
