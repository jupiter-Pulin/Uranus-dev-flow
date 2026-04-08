# Scenario Cookbook

> **Created**: 2026-04-07
> **Status**: In Progress
> **Priority**: P2

## Background

sd0x-dev-flow 有 90 個 skills，但使用者不知道在特定情境下該組合哪些 skills。需要建立情境導向的 Cookbook，讓使用者透過場景找到正確的 skill 組合和工作流程。README 放精選場景作為 teaser，完整 10 個場景（8 基本 + 2 showcase combos）放在 `docs/cookbook/` 供瀏覽。

## Requirements

- 建立 `docs/cookbook/README.md` landing page — 場景矩陣 + 簡介
- 建立 10 個場景頁面（8 基本 + 2 showcase combos），每個遵循標準化格式
- 在 README.md 新增 `## Cookbook` section（Workflow Tracks 之後），table 放 4 精選場景 + 2 showcase combos
- 場景格式：Use this when → Core skills → Command flow → Decision points → Gates → Outcome → Related

## Scope

| Scope | Description |
|-------|-------------|
| In | `docs/cookbook/` 目錄（landing + 10 scenario pages）、README.md Cookbook section、`/readme-i18n-sync` 同步 |
| Out | Locale cookbook 翻譯（English-only for docs/cookbook/）、自動化 lint check（v2）、影片/截圖 |

## Related Files

| File | Action | Description |
|------|--------|-------------|
| `docs/cookbook/README.md` | New | Landing page with scenario matrix |
| `docs/cookbook/first-day.md` | New | Scenario: First day in existing repo |
| `docs/cookbook/new-feature.md` | New | Scenario: Implement new feature safely |
| `docs/cookbook/fix-bug.md` | New | Scenario: Fix bug from issue/report |
| `docs/cookbook/pr-review-comments.md` | New | Scenario: Resolve PR review comments |
| `docs/cookbook/request-to-spec.md` | New | Scenario: Rough request → tech spec |
| `docs/cookbook/close-test-gaps.md` | New | Scenario: Close testing gaps |
| `docs/cookbook/security-pre-merge.md` | New | Scenario: Security-focused pre-merge |
| `docs/cookbook/ship-change.md` | New | Scenario: Finish and ship a change |
| `docs/cookbook/validate-direction.md` | New | Showcase: Validate direction (deep-research + best-practices) |
| `docs/cookbook/adversarial-design.md` | New | Showcase: Adversarial design debate (codex-brainstorm) |
| `README.md` | Modify | Add Cookbook section after Workflow Tracks |

## Acceptance Criteria

- [x] AC1: `docs/cookbook/README.md` exists with matrix linking to all 10 scenario pages (8 basic + 2 showcase)
- [x] AC2: All 10 scenario pages follow standardized format (Use this when / Core skills / Command flow / Decision points / Gates / Outcome / Related)
- [x] AC3: README.md has `## Cookbook` section after Workflow Tracks with table containing 4 featured + 2 showcase scenarios
- [x] AC4: Featured README scenarios are differentiated from Workflow Tracks (situation-oriented, not track-oriented)
- [x] Pass `/codex-review-doc`
- [ ] Pass `/precommit`
- [ ] Pass `/readme-i18n-sync` (README Cookbook section locale sync)

## Progress

| Phase | Status | Note |
|-------|--------|------|
| Analysis | Done | Adversarial debate completed (threadId: 019d6775) |
| Development | Done | 10 scenario pages + README section |
| Testing | Done | `/codex-review-doc` ✅ Mergeable |
| Acceptance | Pending | `/precommit` + `/readme-i18n-sync` remaining |

**Status**: In Progress

## References

- Adversarial debate: threadId `019d6775-af0b-7813-9f24-dc00637528b9`
- Existing Workflow Tracks: `README.md` Workflow Tracks section
- Cookbook section: `README.md` ## Cookbook
