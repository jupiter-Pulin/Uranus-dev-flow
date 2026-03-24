---
description: Independent finding verification via Codex blind assessment (dismiss/confirm/clarify)
argument-hint: "<finding-key> [--intent <dismiss|confirm|clarify>] [--thread <threadId>]"
allowed-tools: mcp__codex__codex, mcp__codex__codex-reply, Bash(git:*), Read, Grep, Glob
---

@skills/seek-verdict/SKILL.md
@skills/seek-verdict/references/verdict-prompt.md
@skills/seek-verdict/references/policy-mapping.md

## Context

- Git HEAD: !`git rev-parse --short HEAD`
- Git status: !`git status -sb`

## Task

Independent blind verification of a finding. Use 3-phase protocol: Candidate Packaging -> Blind Independent Verdict -> Policy Mapping.

### Arguments

```
$ARGUMENTS
```

| Parameter | Description | Default |
|-----------|-------------|---------|
| `<finding-key>` | Finding key (`file\|canonical_issue_text`) from review output | — |
| `--intent <intent>` | `dismiss` / `confirm` / `clarify` | `dismiss` |
| `--thread <threadId>` | Continue rebuttal on existing verdict thread (1 round max) | — |

### Workflow

```
Extract finding_packet -> Codex blind verdict (fresh thread) -> Policy mapping (intent x severity) -> Audit log
```

1. **Candidate Packaging**: Extract finding artifact from review output; record Claude's hypothesis locally but **never send to Codex**
2. **Blind Verdict**: Call Codex via `mcp__codex__codex` with finding_packet only (no conclusions)
3. **Policy Mapping**: Apply intent x severity thresholds from policy-mapping.md
4. **Output**: `[DISMISS_VERDICT]` (dismiss intent) or `[SEEK_VERDICT]` (confirm/clarify intent)

### Key Rules

- **All severities** — P0/P1 dismiss produces `DISMISS_CANDIDATE` + human gate; P2/Nit auto-authorized
- **Fresh Codex thread** — never reuse the review session thread
- **Anti-anchoring** — prompt must not contain Claude's hypothesis
- **Anti-abuse** — dismiss: 3 consecutive -> warning; confirm/clarify: per-finding cap
- **1 rebuttal max** — use `--thread` to submit counter-evidence

## Output

```markdown
## Seek Verdict Report

### Finding
- Key: <finding-key>
- Severity: <P0|P1|P2|Nit>
- Intent: <dismiss|confirm|clarify>
- Origin: <review threadId>

### Codex Verdict
- Verdict: <ACTIONABLE|NON_ACTIONABLE|UNCERTAIN>
- Confidence: <0.0-1.0>
- Evidence: <file:line references>

### Result (dismiss intent)
[DISMISS_VERDICT] key=<...> | severity=<...> | verdict=<DISMISS_VERIFIED|DISMISS_CANDIDATE|FIX_REQUIRED|NEED_HUMAN> | confidence=<...> | codex_thread=<...> | evidence=<...> | timestamp=<ISO8601> | intent=dismiss | authorization=<automated|human-required|human-confirmed>

### Result (confirm/clarify intent)
[SEEK_VERDICT] key=<...> | severity=<...> | intent=<confirm|clarify> | verdict=<CONFIRMED|DISPUTED|HIGH_IMPACT|LOW_IMPACT|UNCERTAIN> | confidence=<...> | codex_thread=<...> | evidence=<...> | timestamp=<ISO8601>
```

## Examples

```bash
/seek-verdict "src/service/cache.ts|Set vs Map for runtimeInjectedKeys"
/seek-verdict "src/auth.ts|shell injection risk" --intent dismiss
/seek-verdict "src/api.ts|missing rate limit" --intent confirm
/seek-verdict "src/db.ts|N+1 query" --intent clarify
/seek-verdict --thread abc123
```
