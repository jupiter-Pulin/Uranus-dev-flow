# Policy Mapping

## Verdict → Result Mapping

| Codex Verdict | Confidence | Evidence Refs | Result | Action |
|---------------|------------|---------------|--------|--------|
| NON_ACTIONABLE | >= 0.80 | >= 2 | `DISMISS_VERIFIED` | Log audit trail, continue |
| ACTIONABLE | >= 0.70 | any | `FIX_REQUIRED` | Return to fix loop |
| UNCERTAIN / low confidence | any | any | `NEED_HUMAN` | Stop, escalate |

**Asymmetric threshold**: dismiss (0.80) > fix (0.70) because false negative (missing a real issue) costs more than false positive (fixing an unnecessary issue).

## Audit Trail Format

```
[DISMISS_VERDICT] key=<file|canonical_issue> | severity=P2 | verdict=<DISMISS_VERIFIED|FIX_REQUIRED|NEED_HUMAN> | confidence=<0..1> | codex_thread=<id> | evidence=<brief> | timestamp=<ISO8601>
```

### Redaction Rules

| Field | Policy |
|-------|--------|
| `key` | Keep file path + issue summary (<= 120 chars); remove code snippets |
| `evidence` | File:line references only; no source code content |
| `finding_packet.relevant_diff` | Send to Codex unredacted; **never record in audit log** |
| All fields | No secrets/tokens/passwords/API keys (per `rules/logging.md`) |

**Retention**: `[DISMISS_VERDICT]` is session output only, not persisted to filesystem. If persistence needed, follow `.gitignore` policy.

## Anti-Abuse Guard

**Session scope**: "session" = single Claude Code conversation. Branch switch or new conversation resets streak counter.

| Condition | Action |
|-----------|--------|
| 3 consecutive `DISMISS_VERIFIED` in same session | Emit `[DISMISS_PATTERN_WARN]` |
| Warning state: subsequent dismiss attempts | Heightened thresholds: confidence >= 0.85 + evidence refs >= 3 |
| Session end or branch switch | Reset streak counter |

```
[DISMISS_PATTERN_WARN] streak=<N> | scope=P2 | reason=systematic-over-dismiss-risk | action=heightened-scrutiny | timestamp=<ISO8601>
```

### Heightened Threshold Table

| State | Dismiss Threshold | Evidence Refs |
|-------|-------------------|---------------|
| Normal | confidence >= 0.80 | >= 2 |
| After warning | confidence >= 0.85 | >= 3 |

## Rebuttal Mechanism

If Codex returns `FIX_REQUIRED` but Claude has counter-evidence:

| Rule | Detail |
|------|--------|
| Max rounds | **1 round only** |
| Channel | `mcp__codex__codex-reply` (same verdict thread) |
| Allowed content | Objective artifacts: tests, specs, language semantics |
| Prohibited content | "Please confirm me", opinion-based arguments |
| After rebuttal | Still FIX_REQUIRED -> fix; Still ambiguous -> `NEED_HUMAN` |
