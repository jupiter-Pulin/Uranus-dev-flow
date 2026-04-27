---
name: necessity-audit
description: "Necessity audit for over-designed spec elements. Use when: auditing lifecycle spec (1-requirements / 2-tech-spec / 3-architecture) for YAGNI/KISS violations, challenging necessity of FRs/NFRs/abstractions/configs via Codex adversarial debate. Not for: FP reasoning validity (use /codex-review-spec), completeness check (use /feature-completeness), detail review (use /codex-review-doc), or code-level simplification (use /simplify)."
allowed-tools: Read, Grep, Glob, Write, Bash(git:*), Bash(node:*), Bash(wc:*), Bash(mktemp:*), Bash(rm:*), mcp__codex__codex, mcp__codex__codex-reply
---

# Necessity Audit

3-phase necessity audit with Codex adversarial debate. Identifies over-designed elements in lifecycle specs via 6-dimension YAGNI rubric.

## Non-Negotiable Rules

> **SKILL.md is the normative source.** Reference files elaborate but do not override.

| # | Rule | Violation = |
|---|------|-------------|
| 1 | Phase A classification output **must NOT** appear in Phase B debate topic | Audit invalid |
| 2 | Phase B **must** invoke `/codex-brainstorm` via Skill tool — raw `mcp__codex__codex` for debate is invalid | Audit invalid |
| 3 | Phase C report **must** include non-empty `debate.threadId` | Report rejected |
| 4 | Phase C report **must** include `Debate Conclusion` referencing specific rounds (not blank / placeholder) | Report rejected |
| 5 | Output **must** start with `## Document Review` header and end with `✅ Mergeable` OR `⛔ Needs revision` sentinel | Auto-loop cannot parse |

## Trigger

- Keywords: necessity audit, over-design, YAGNI audit, spec necessity, 過度設計, over-engineered

## When NOT to Use

### Alternatives by intent

| Intent | Use | Not this skill |
|--------|-----|----------------|
| 「這段推理站得住嗎？」 | `/codex-review-spec` (planned) / `/review-spec` | — |
| 「這個 spec 完成了嗎？」 | `/feature-completeness` (planned) | — |
| 「這個 code 是否過度抽象？」 | `/simplify` / `/refactor` | — |
| 「這個實作符合產業標準嗎？」 | `/best-practices` | — |
| **「這個 spec 是否過度設計？需要砍嗎？」** | **`/necessity-audit` ← this skill** | — |

### Chain recommendation

`/codex-review-doc` (detail) → `/codex-review-spec` (reasoning, planned) → **`/necessity-audit` (necessity, this skill)** → `/feature-completeness` (completeness, planned) → `/review-spec` (synthesis)

## Arguments

| Arg | Required | Default | Purpose |
|-----|----------|---------|---------|
| `<path>` | Yes | — | Target lifecycle spec (repo-relative) |
| `--depth brief\|normal\|deep` | No | `normal` | Dimension coverage + equilibrium strictness |
| `--continue <threadId>` | No | — | Resume Phase C via `mcp__codex__codex-reply` |
| `--skip-preflight` | No | false | Skip state-read advisory; emits `[PREFLIGHT SKIPPED]` banner |
| `--include-feasibility` | No | false | Accept `0-feasibility-study.md` (emits override banner) |
| `--override <id>:<rationale>` | No (repeatable, `;`-separated) | — | Mark Cut element as kept with justification |
| `--output markdown\|json` | No | `markdown` | Output format |

## Workflow

```
Phase 0 preflight → Phase A classify → Phase B Codex debate → Phase C consolidate → Redact → Emit
```

### Phase 0: Preflight (executable)

```bash
TMPDIR=$(mktemp -d)
node scripts/skills/necessity-audit/preflight.js \
  --path <path> --depth <depth> \
  [--skip-preflight] [--include-feasibility] \
  --output $TMPDIR/preflight.json
```

Non-zero exit = hard block. Read `$TMPDIR/preflight.json` to continue.

### Phase A: Claude classify (LLM)

Read target file with Read tool. Apply `references/phase-a-classify.md` template substituting `${TARGET_PATH}`, `${DOC_KIND}`, `${ACTIVE_DIMENSIONS}`, `${GREENFIELD}` from preflight.

Extract elements (FR / NFR / Component / Abstraction / Extensibility / Config), score each against active dimensions only (depth=brief → dims 1-3; normal/deep → dims 1-6), assign initial Keep/Review/Cut.

Write result: `Write` tool → `$TMPDIR/phase-a.json` with schema `{ elements: ClassifiedElement[] }` (only `claude.*` fields populated).

### Phase B: Codex debate (Skill invocation)

```bash
node scripts/skills/necessity-audit/debate-topic.js build \
  --preflight $TMPDIR/preflight.json \
  --output $TMPDIR/topic.txt
```

Read topic, invoke:

```
Skill("codex-brainstorm", <contents of $TMPDIR/topic.txt>)
```

Write raw response: `Write` tool → `$TMPDIR/debate.txt`.

```bash
node scripts/skills/necessity-audit/debate-topic.js parse \
  --input $TMPDIR/debate.txt \
  --output $TMPDIR/debate.json
```

### Phase C: Consolidate (executable)

```bash
node scripts/skills/necessity-audit/consolidate.js \
  --phase-a $TMPDIR/phase-a.json \
  --debate $TMPDIR/debate.json \
  --preflight $TMPDIR/preflight.json \
  --overrides "<id>:<rationale>[;...]" \
  --depth <depth> \
  --output $TMPDIR/report.json
```

Applies 6 deterministic checks, under-coverage check, `--override` handling, gate selection.

### Assemble + Redact + Emit

```bash
node scripts/skills/necessity-audit/report.js \
  --input $TMPDIR/report.json \
  --format markdown \
  --output $TMPDIR/report.md

node scripts/skills/necessity-audit/redact.js \
  --input $TMPDIR/report.md \
  --output $TMPDIR/report.final.md
```

Read `$TMPDIR/report.final.md` and emit as final user-visible message. Cleanup: `rm -rf $TMPDIR`.

## Output Format + Gate Selection

Output header, sections, sentinel: see `references/output-template.md` (normative).
Gate-selection decision table + narrative rules: see `references/phase-c-consolidate.md`.

Invariant: `⚠️ Need Human` NEVER appears as the final gate — only as a narrative line above the `✅ Mergeable` / `⛔ Needs revision` sentinel.

## Review Loop (`--continue`)

After user revises the spec, re-run with `--continue <threadId>` to reuse the Codex debate context via `mcp__codex__codex-reply`. See `references/review-loop.md`.

## References

- `references/dimensions.md` — 6-dimension × 4-tier rubric (authoritative)
- `references/phase-a-classify.md` — Phase A prompt template
- `references/phase-b-debate-topic.md` — Phase B topic builder documentation
- `references/phase-c-consolidate.md` — Phase C logic
- `references/output-template.md` — Markdown report layout
- `references/review-loop.md` — `--continue` flow
- `references/redaction-rules.md` — Secret / PII patterns applied by `redact.js`

## Verification

- [ ] Phase B used `Skill("codex-brainstorm")`, not raw `mcp__codex__codex`
- [ ] Report contains non-empty `debate.threadId`
- [ ] Report contains non-empty Debate Conclusion
- [ ] Output starts with `## Document Review` header
- [ ] Output ends with `✅ Mergeable` OR `⛔ Needs revision` sentinel
- [ ] `⚠️ Need Human` never used as gate (only as narrative)
- [ ] Redaction applied before emission

## Examples

```
Input: /necessity-audit docs/features/foo/2-tech-spec.md
Action: Phase 0 preflight → Phase A classify → Phase B debate → Phase C consolidate → report + redact → emit with sentinel

Input: /necessity-audit docs/features/foo/2-tech-spec.md --continue 019dab42-xxxx
Action: Resume via codex-reply; re-run Phase C with updated spec; emit diff-focused report

Input: /necessity-audit docs/features/foo/1-requirements.md --depth brief --skip-preflight
Action: Only challenge dims 1-3; skip state advisory; emit [PREFLIGHT SKIPPED] banner

Input: /necessity-audit docs/features/foo/2-tech-spec.md --override FR-12:"needed for Q3 rollout"
Action: FR-12 kept with justification; final gate ✅ Mergeable if no other Cut items remain
```
