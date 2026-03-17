# Context Management Rule

**Measure → decide → act. Never guess.**

## Prohibited Behaviors

❌ Claiming "context too long" or "running low on context" without first running `/context` (if `/context` is unavailable or errors, proceed with work — unavailability is not evidence of exhaustion)
❌ Stopping or deferring work when context used ≤ 70%
❌ Using context state to skip auto-loop obligations (review/precommit)
❌ Proposing new session without first attempting `/compact` + retry

## Three-Tier Policy

| Zone | Condition | Action |
|------|-----------|--------|
| Normal | used < 80% | Continue. Run `/context` at major milestones |
| Compact | 80% ≤ used < 92% | `/compact` at next major boundary, then continue |
| Critical | used ≥ 92% | Complete pending auto-loop obligations first → `/compact` → if still ≥ 92% → propose new session with handoff |

## Milestone Check

At major milestones (precommit pass, review complete, task group done), run `/context`.
This is diagnostic — do not stop or change behavior based solely on a check.
**Cooldown**: Skip if `/context` was checked within the last 2 tool calls (avoid overhead in dense review loops).

## Compact Preservation

When compacting, ensure summary preserves:
- Pending task list and current progress
- Architectural decisions from this session
- Active review threadIds (for --continue)
- Uncommitted file list
- Current plan file path (if any)
- Never include secrets, tokens, or passwords in compact summary (per @rules/security.md)

## Auto-Loop Precedence

Context management cannot override auto-loop:
- Even at Critical zone, must attempt review/precommit before stopping
- See @rules/auto-loop.md for full obligations
