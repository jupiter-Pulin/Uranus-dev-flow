# Quality Checklist (L1/L2/L3 Validation)

## L1: Frontmatter Schema (built-in)

| Check | Pass Criteria |
|-------|---------------|
| `name` field exists | Non-empty, kebab-case |
| `description` field exists | Non-empty |
| `allowed-tools` field exists | Non-empty, comma-separated |

## L2: Skill Format Lint (via skill-lint.js)

**Invocation**:

```bash
bash scripts/run-skill.sh skill-health-check skill-lint.js --skills-dir <target-dir> --json
```

| Check | Severity | Pass Criteria |
|-------|----------|---------------|
| Frontmatter present | P0 | `---` delimiters + `name` field + `description` field |
| Routing signature | P1 | 2+ cues (Use when / Not for / Output) |
| When NOT section | P1 | `## When NOT to Use` heading exists |
| Output section | P2 | `## Output` heading exists |
| Verification section | P2 | `## Verification` heading exists |
| References routing | P2 | Each `references/*.md` mentioned in body |
| Scripts contract | P2 | Each `scripts/*` mentioned in body |

**Pass**: Exit code 0 (all pass) or 1 (P2 warnings only). **Fail**: Exit code 2 (P0/P1 errors).

## L3: LLM Semantic Check

Prompt pattern for Claude to self-verify generated skills:

| Check | Verification Method |
|-------|-------------------|
| Tools exist | Compare `allowed-tools` against known tool list |
| Skill refs exist | Grep target `skills/` for each `/skill-name` reference |
| Rule refs exist | Grep target `rules/` for each `@rules/*.md` reference |
| Routing signature quality | Parse description for Use when/Not for/Output cues |
| No hallucination | Verify every named file/function in body actually exists |
| Workflow coherence | Phases are logically ordered, no circular dependencies |
