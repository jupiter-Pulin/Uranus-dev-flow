---
description: P2 dismiss blind verification via Codex independent assessment
argument-hint: "<finding-key> [--thread <threadId>]"
allowed-tools: mcp__codex__codex, mcp__codex__codex-reply, Bash(git:*), Read, Grep, Glob
---

@skills/seek-verdict/SKILL.md
@skills/seek-verdict/references/verdict-prompt.md
@skills/seek-verdict/references/policy-mapping.md

## Context

- Git HEAD: !`git rev-parse --short HEAD`
- Git status: !`git status -sb`

## Task

Blind verification of a P2 finding before dismissal. Use 3-phase protocol: Candidate Packaging -> Blind Independent Verdict -> Policy Mapping.

### Arguments

```
$ARGUMENTS
```

| Parameter | Description |
|-----------|-------------|
| `<finding-key>` | Finding key (`file\|canonical_issue_text`) from review output |
| `--thread <threadId>` | Continue rebuttal on existing verdict thread (1 round max) |

### Workflow

```
Extract finding_packet -> Codex blind verdict (fresh thread) -> Policy mapping -> Audit log
```

1. **Candidate Packaging**: Extract finding artifact from review output; record Claude's hypothesis locally but **never send to Codex**
2. **Blind Verdict**: Call Codex via `mcp__codex__codex` with finding_packet only (no conclusions)
3. **Policy Mapping**: Apply asymmetric thresholds (dismiss >= 0.80, fix >= 0.70)
4. **Output**: `[DISMISS_VERDICT]` audit trail

### Key Rules

- **P2 only** — reject P0/P1 (must fix) and Nit (use `[NIT_DEFERRED]`)
- **Fresh Codex thread** — never reuse the review session thread
- **Anti-anchoring** — prompt must not contain Claude's dismiss hypothesis
- **Anti-abuse** — 3 consecutive dismissals triggers warning + heightened thresholds
- **1 rebuttal max** — use `--thread` to submit counter-evidence

## Output

```markdown
## Seek Verdict Report

### Finding
- Key: <finding-key>
- Severity: P2
- Origin: <review threadId>

### Codex Verdict
- Verdict: <ACTIONABLE|NON_ACTIONABLE|UNCERTAIN>
- Confidence: <0.0-1.0>
- Evidence: <file:line references>

### Result
[DISMISS_VERDICT] key=<...> | severity=P2 | verdict=<DISMISS_VERIFIED|FIX_REQUIRED|NEED_HUMAN> | confidence=<...> | codex_thread=<...> | evidence=<...> | timestamp=<ISO8601>
```

## Examples

```bash
/seek-verdict "src/service/cache.ts|Set vs Map for runtimeInjectedKeys"
/seek-verdict --thread abc123
```
