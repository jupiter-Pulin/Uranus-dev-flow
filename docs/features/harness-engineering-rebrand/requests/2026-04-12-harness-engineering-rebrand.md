# Harness Engineering Rebrand — Description-Layer Only

> **Doc class**: Request ticket (date-prefixed, non-lifecycle — per `@rules/docs-numbering.md`)
> **Created**: 2026-04-12
> **Status**: Completed
> **Priority**: P2
> **Requirements**: [1-requirements.md](../1-requirements.md)
> **Tech Spec**: _(skipped 2026-04-12 by user decision — technical scope is simple text/JSON edits; requirements doc provides sufficient blueprint)_

## Background

Reposition `sd0x-dev-flow` as a **reference implementation of AI Agent Harness Engineering**, an emerging discipline formalized by Mitchell Hashimoto (Feb 2026) and adopted by Martin Fowler, Anthropic engineering blog, and arXiv literature. The project already implements 10 of the discipline's canonical sub-problems (see [1-requirements.md §5 Pattern Map](../1-requirements.md)), but its brand layer still describes it as a generic "development workflow plugin with 100+ tools" — undersells the substance and is invisible to the strongest target audience (harness engineering practitioners and learners).

**Zero-breakage constraint**: This rebrand touches only the **description layer** (README body, JSON `description` fields, GitHub About UI). It does NOT modify `plugin.json` `name`, repo slug, derived state paths, or any hook regex patterns — so existing `/plugin update` installs pull the new text with zero disruption.

**Content opportunity**: Beyond a tagline swap, the README gains a new core section **"What This Harness Does"** that renders the Pattern Map from requirements §5, converting the README from a tool catalog into a grounded tour of harness engineering with code evidence per sub-problem.

## Requirements

Derived from `1-requirements.md` §4 Must-Have and §4.2 Should-Have:

- Unify three JSON `description` fields (`plugin.json`, `package.json`, `marketplace.json`) to identical text that leads with "Harness engineering for Claude Code"
- Resolve the existing 100+/90+/90 skill count inconsistency — all surfaces unify on **90 skills** (count reconciled against `scripts/generate-readme-catalog.js` which reads from `docs/skill-catalog.yml` public-skill count; supersedes requirements doc FR-S1 which conflated filesystem count 92 with marketing count 90)
- Update `README.md` H1 area with new two-line primary tagline + preserved secondary slogan "Quality gates that AI can't skip"
- Add new **"What This Harness Does"** section to `README.md` rendering the requirements §5 Pattern Map (10 rows mapping harness sub-problems → sd0x-dev-flow implementations → code evidence)
- Propagate README changes to all 5 locale files via `/readme-i18n-sync --full`
- Update `CLAUDE.md` Line 1 title to match new positioning
- Document GitHub repo UI operations (About description + Topics) for manual user execution — Claude cannot edit GitHub UI directly
- All tagline text must honor the `fail-closed where it counts` qualifier per requirements §8.0 TA-4 (mode semantics honesty)

## Scope

| Scope | Description |
|-------|-------------|
| In | Three JSON `description` field edits; README.md full rewrite of H1/tagline/hero + new "What This Harness Does" section; 5 locale README sync via `/readme-i18n-sync --full`; CLAUDE.md title; GitHub UI operation checklist for user |
| Out | Rename `plugin.json` `name` field; rename GitHub repo slug; rename lesson log file; modify hook regex patterns; modify `skills/git-profile/scripts/git-profile.sh` config paths; change default `GUARD_MODE` from warn to strict; banner image regeneration |

## Related Files

| File | Action | Description |
|------|--------|-------------|
| `.claude-plugin/plugin.json` | Modify | `description` field only (do NOT touch `name`) |
| `.claude-plugin/marketplace.json` | Modify | `description` field only (do NOT touch `name` or `repo`) |
| `package.json` | Modify | `description` field only (do NOT touch `name`) |
| `README.md` | Modify | H1 area (tagline + secondary slogan), "What This Harness Does" new section; no hero count change needed (auto-generated block already shows 90 skills correctly, matches target) |
| `README.zh-TW.md` | Modify | Propagated via `/readme-i18n-sync --full` |
| `README.zh-CN.md` | Modify | Propagated via `/readme-i18n-sync --full` |
| `README.ja.md` | Modify | Propagated via `/readme-i18n-sync --full` |
| `README.ko.md` | Modify | Propagated via `/readme-i18n-sync --full` |
| `README.es.md` | Modify | Propagated via `/readme-i18n-sync --full` |
| `CLAUDE.md` | Modify | Line 1 heading — content only, filename unchanged |
| GitHub repo Settings → About | External | User manually updates Description (≤350 chars, copy from requirements §8.1.4) + Topics (add `harness-engineering`, `agent-harness`, `claude-code-plugin`) — not a file edit |

## Acceptance Criteria

- [x] AC-1: Three JSON `description` fields (`plugin.json`, `package.json`, `marketplace.json`) contain harmonized text leading with "Harness engineering for Claude Code" and citing "90 skills". Verification: extract the three `description` values via `jq -r '.description' .claude-plugin/plugin.json package.json` and equivalent `jq` path for `marketplace.json` (`.plugins[0].description`); all three strings must be byte-exact identical. **Resolution**: Count reconciled from requirements §4.2 FR-S1 (which said 92 from filesystem `ls skills/`) to **90** (catalog-public truth via `generate-readme-catalog.js`); the 2 filesystem-only skills `readme-i18n-sync` and `update-readme` are README-maintenance tooling intentionally not in the public catalog. ✅ Verified 2026-04-12: all 3 strings byte-equal via `jq -r` comparison
- [x] AC-2: `README.md` H1 area contains the new two-line primary tagline (L1 = "The harness layer for Claude Code.", L2 cites dual review + state-machine gates + fail-closed qualifier) AND preserves "Quality gates that AI can't skip" as visible secondary slogan (grep ≥ 1 hit). ✅ Verified: `README.md:7` = `> The harness layer for Claude Code.`, `README.md:9` opens with `**Quality gates that AI can't skip.**` followed by the harness engineering framing
- [x] AC-3: `README.md` contains a new section titled "What This Harness Does" (or equivalent) rendering all 10 rows of the requirements §5 Pattern Map with concrete code-evidence citations. ✅ Verified: new `## What This Harness Does` section inserted at `README.md:17` with harness-engineering blockquote + 10-row Pattern Map table + closing differentiation sentence; all code-evidence paths resolve (Codex doc review confirmed in Phase C)
- [x] AC-4: All 5 locale README files (`zh-TW`, `zh-CN`, `ja`, `ko`, `es`) reflect the new tagline and Pattern Map section after running `/readme-i18n-sync --full`; line count parity within ±5 lines of `README.md`. ✅ Verified: all 6 READMEs are exactly 486 lines; all 5 locale tagline lines updated to harness-centric wording; all 5 locales report 12 hits for `harness engineering | Claude Code | fail-closed` glossary compliance check
- [x] AC-5: `CLAUDE.md` Line 1 title reflects the new positioning (filename unchanged — content edit only). ✅ Verified: `CLAUDE.md:1` = `# sd0x-dev-flow — Harness Engineering for Claude Code` (backward-compatible prefix `# sd0x-dev-flow` preserved for any grep dependencies); Codex doc review passed Phase D
- [x] AC-6: Hard constraints verification — all 6 items from requirements §2.1 must hold:
  - **C1** (`plugin.json` `name`): `jq -r '.name' .claude-plugin/plugin.json` equals `sd0x-dev-flow` before and after; `git diff .claude-plugin/plugin.json` shows no change to the `name` field
  - **C2** (GitHub repo slug + marketplace identity): `jq -r '.plugins[0].name' .claude-plugin/marketplace.json` equals `sd0x-dev-flow` AND `jq -r '.plugins[0].source.repo' .claude-plugin/marketplace.json` equals `sd0xdev/sd0x-dev-flow`; `git diff` shows no change to either field
  - **C3** (`package.json` `name`): `jq -r '.name' package.json` equals `sd0x-dev-flow` before and after; `git diff package.json` shows no change to the `name` field
  - **C4** (file-name immutability — name-status guard): `git diff --name-status HEAD` contains no rename (`R`) or delete (`D`) entries for `README.md`, `CLAUDE.md`, or `.claude/sd0x-dev-flow-lessons.md`; no new file with those basenames was added at a different path
  - **C5** (git-profile registry path): `git diff skills/git-profile/scripts/git-profile.sh` shows zero changes to the literals `~/.config/sd0x-dev-flow/` and `~/.sd0x-dev-flow/`
  - **C6** (hook regex patterns): `git diff hooks/stop-guard.sh hooks/post-tool-review-state.sh` shows zero changes to regex patterns containing `sd0x-dev-flow:`
- [x] AC-7: GitHub repo About description + Topics. ✅ Verified 2026-04-12 via `gh repo view sd0xdev/sd0x-dev-flow --json description,repositoryTopics`: Description = new 244-char harness text; Topics = 6 items (3 existing preserved: `claude-code`, `codex`, `skills` + 3 new added: `harness-engineering`, `agent-harness`, `claude-code-plugin`). Executed via `gh repo edit --description ...` + `gh repo edit --add-topic ...` with user approval under `/feature-dev` execution.
- [x] AC-8: Pass `/codex-review-doc` on all modified `.md` files with `✅ Mergeable` gate. ✅ Verified: glossary (A1) ✅ Mergeable after P2 sweep; README (C) ✅ Mergeable 5/5 no findings; CLAUDE.md (D) ✅ PASS; 1-requirements.md already ✅ Mergeable from earlier session

## Progress

| Phase | Status | Note |
|-------|--------|------|
| Analysis | Done | `/deep-research` (4 shards) + `/codex-brainstorm` tagline debate (2 rounds) + `/req-analyze` → `1-requirements.md` passed doc review |
| Development | Done | 10 files edited (3 JSON + 6 READMEs + CLAUDE.md); Phase A-D executed per plan file; glossary protected-terms update applied (local-only, gitignored) |
| Testing | Done | Hard constraints C1-C6 all verified ✅; JSON byte-equality confirmed via `jq -r`; 5 locale READMEs line-equal 486 and glossary-compliant (12 hits each); old "ship fast" phrase fully removed from all locales |
| Acceptance | Done | All 8 ACs verified complete; AC-7 closed 2026-04-12 after `gh repo edit` executed description + 3 new topics |

## GitHub UI Operation Log (AC-7, executed 2026-04-12)

Executed via `gh repo edit sd0xdev/sd0x-dev-flow` (not GitHub web UI — `gh` CLI can modify About description and Topics programmatically). Verified via `gh repo view sd0xdev/sd0x-dev-flow --json description,repositoryTopics` after execution.

| Location | Action | Value applied | Status |
|----------|--------|---------------|--------|
| GitHub repo → About → Description | `gh repo edit --description "..."` | `The harness layer for Claude Code — a reference implementation of harness engineering with hook-enforced dual review, state-machine gates that survive context compaction, and fail-closed safety where it counts. Quality gates that AI can't skip.` (**244 characters** measured by `wc -m`, well under GitHub's 350 limit) | ✅ Applied |
| GitHub repo → About → Topics | `gh repo edit --add-topic harness-engineering,agent-harness,claude-code-plugin` | 3 new topics added; existing `claude-code`, `codex`, `skills` preserved (6 total) | ✅ Applied |
| GitHub repo → About → Website | Unchanged | — | N/A |
| GitHub repo → Settings → Repository name | **DO NOT CHANGE** (hard constraint C2) | `sd0x-dev-flow` unchanged | ✅ Preserved |

### Durable evidence snapshot (AC-7)

Captured 2026-04-12 via `gh repo view sd0xdev/sd0x-dev-flow --json description,repositoryTopics` for in-repo reproducibility:

```json
{
  "description": "The harness layer for Claude Code — a reference implementation of harness engineering with hook-enforced dual review, state-machine gates that survive context compaction, and fail-closed safety where it counts. Quality gates that AI can't skip.",
  "repositoryTopics": [
    {"name": "claude-code"},
    {"name": "codex"},
    {"name": "skills"},
    {"name": "agent-harness"},
    {"name": "claude-code-plugin"},
    {"name": "harness-engineering"}
  ]
}
```

Reproduction: `gh repo view sd0xdev/sd0x-dev-flow --json description,repositoryTopics` (requires `gh auth login`). Topics count: 6 (3 pre-existing `claude-code`/`codex`/`skills` + 3 new `harness-engineering`/`agent-harness`/`claude-code-plugin`).

## References

- Requirements doc: [1-requirements.md](../1-requirements.md) — 297 lines, `✅ Mergeable`, integrates `/deep-research` + `/codex-brainstorm` outputs
- Pattern Map anchor: [1-requirements.md §5](../1-requirements.md) — the core content for the new README section
- Tagline decision inputs: [1-requirements.md §8](../1-requirements.md) — attribute requirements (TA-1..TA-7) + candidate equilibrium from `/codex-brainstorm`
- Hard constraints: [1-requirements.md §2.1](../1-requirements.md) — 6 non-negotiable items protecting zero-breakage
- Zero-breakage acceptance: [1-requirements.md §7.2](../1-requirements.md)
- Auto-loop rule: [`rules/auto-loop.md`](../../../../rules/auto-loop.md) — any `.md` edit during execution triggers `/codex-review-doc`
- i18n sync tool: [`skills/readme-i18n-sync/SKILL.md`](../../../../skills/readme-i18n-sync/SKILL.md)
