# Nit History Persistence

> **Created**: 2026-03-24
> **Status**: Pending
> **Priority**: P2
> **Tech Spec**: [Auto-Loop Evolution](../2-tech-spec.md) Section 3.2 (Nit History File), 3.3 T5
> **Depends On**: [Iteration Counter](./2026-03-24-iteration-counter-convergence-r2.md)

## Background

`[NIT_DEFERRED]` logs are output to transcript only, lost after context compaction or new sessions. The same Nit can be retried infinitely, contributing to alert fatigue (industry data: 5-15% false positive rate causes 2/3 of developers to bypass checks). A standalone `.claude_nit_history.json` file with TTL-based expiry solves cross-session deduplication.

## Requirements

- Create `.claude_nit_history.json` schema (deferred + dismissed_via_verdict)
- Parse `[NIT_DEFERRED]` sentinels from review output in hooks
- Compute finding hash using fingerprint algorithm from R2
- Upsert deferred findings (increment `defer_count` on match)
- Inject known deferred findings into review prompt (with sanitization)
- TTL-based garbage collection (deferred: 14d, dismissed: 30d)
- Track seek-verdict dismissed findings in same file

## Scope

| Scope | Description |
|-------|-------------|
| In | Nit history file, sentinel parsing, dedup, prompt injection, TTL GC, sanitization |
| Out | Cross-project finding sharing; ML-based false positive classification |

## Related Files

| File | Action | Description |
|------|--------|-------------|
| `hooks/post-tool-review-state.sh` | Modify | Parse `[NIT_DEFERRED]` + `[DISMISS_VERDICT]`, write to nit history |
| `skills/codex-code-review/SKILL.md` | Modify | Read nit history, inject deferred context into prompt |
| `.claude_nit_history.json` | New | Standalone deferred findings registry |

## Acceptance Criteria

- [ ] `.claude_nit_history.json` created with `schema_version: 1`
- [ ] `[NIT_DEFERRED]` sentinels parsed and stored with `sha256` hash
- [ ] Same finding (matching hash) increments `defer_count` instead of duplicating
- [ ] Deferred findings re-injected into review prompt with `<deferred_context>` XML wrapper
- [ ] Sanitization contract enforced: max 120 chars, no code snippets, no secrets, strip markdown control chars
- [ ] TTL GC removes expired entries on every write (deferred: 14d, dismissed: 30d)
- [ ] `[DISMISS_VERDICT]` entries tracked in `dismissed_via_verdict` array
- [ ] `.claude_nit_history.json` added to `.gitignore` (local-only, not shared)
- [ ] Pass /codex-review-fast
- [ ] Pass /precommit-fast

## Progress

| Phase | Status | Note |
|-------|--------|------|
| Analysis | Done | Deep Research + Tech Spec completed |
| Development | - | Blocked until R2 fingerprint algo available |
| Testing | - | |
| Acceptance | - | |
