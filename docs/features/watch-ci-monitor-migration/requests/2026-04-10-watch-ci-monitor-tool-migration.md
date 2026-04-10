# Migrate watch-ci to Monitor Tool Streaming

> **Doc class**: Request ticket (date-prefixed non-lifecycle — per `@rules/docs-numbering.md`). Per-task work breakdown unit for progress tracking. **Not** a feature-level requirements doc — for that see `../1-requirements.md` if present (created via `/req-analyze`).
> **Created**: 2026-04-10
> **Status**: Pending
> **Priority**: P1
> **Tech Spec**: Pending (implement directly from research findings; create if scope expands)

## Background

Claude Code v2.1.98 introduced the Monitor tool for streaming stdout from background processes. `/watch-ci` currently uses foreground blocking (locks Claude) or unreliable `run_in_background` mode. Monitor tool provides non-blocking streaming with reliable notifications — the canonical use case for `gh run watch`.

## Requirements

- Replace foreground blocking with Monitor tool as default execution mode for `gh run watch`
- Demote `--background` (Bash `run_in_background`) to explicit fallback only
- Update `push-ci` documentation to reflect inherited Monitor behavior
- Add Monitor tool and sleep-first blocking to CLAUDE.md Footguns table

## Scope

| Scope | Description |
| ----- | ---------------------------------- |
| In | watch-ci SKILL.md Monitor migration, push-ci doc sync, CLAUDE.md + CLAUDE.template.md + .claude/CLAUDE.md Footguns sync |
| Out | verify/precommit runner refactoring (P2, self-built streaming is adequate), Agent dispatch skills (N/A) |

## Related Files

| File | Action | Description |
| -------------------- | ------ | -------------------- |
| `skills/watch-ci/SKILL.md` | Modify | Add Monitor to allowed-tools, rewrite Step 3b modes, update arguments/examples |
| `skills/push-ci/SKILL.md` | Modify | Update Phase 3 description + possibly allowed-tools |
| `CLAUDE.md` | Modify | Add Monitor tool + sleep-first blocking to Footguns table |
| `CLAUDE.template.md` | Modify | Mirror CLAUDE.md Footguns update |
| `.claude/CLAUDE.md` | Modify | Mirror CLAUDE.md Footguns update |

## Acceptance Criteria

- [ ] `watch-ci` allowed-tools includes `Monitor`
- [ ] Step 3b default mode is Monitor streaming (not foreground blocking)
- [ ] `--background` flag demoted to fallback-only with clear documentation
- [ ] Multiple CI runs: when 2+ runs match, launch parallel Monitor instances; each reports per-run verdict; overall verdict = worst result
- [ ] `push-ci` Phase 3 states "delegates to `/watch-ci` where Monitor streaming is default" (no foreground-blocking language remains)
- [ ] CLAUDE.md + CLAUDE.template.md + .claude/CLAUDE.md Footguns table all contain Monitor tool + sleep-first blocking entries (3-file sync)
- [ ] Pass `/codex-review-doc`

## Progress

| Phase | Status | Note |
| ---------- | ------ | ---- |
| Analysis | Done | Deep research + deep explore completed (2026-04-10) |
| Development | - | |
| Testing | - | |
| Acceptance | - | |

## References

- Claude Code v2.1.98 release: Monitor tool + sleep-first blocking (source: `https://github.com/anthropics/claude-code/releases/tag/v2.1.98`)
- GitHub Issue anthropics/claude-code#45928: Monitor tool missing from official docs
- GitHub Issue anthropics/claude-code#46170: Monitor 400-char event truncation
- GitHub Issue anthropics/claude-code#46144: Sleep-first blocking complaints + opt-out request
- Prior fix: commit `2e2a160` — fix: Prevent sleep-first Bash command in watch-ci retry logic
