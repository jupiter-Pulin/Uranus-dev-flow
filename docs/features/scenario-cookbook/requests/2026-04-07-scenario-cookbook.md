# Scenario Cookbook

> **Created**: 2026-04-07
> **Status**: Pending
> **Priority**: P2

## Background

sd0x-dev-flow 有 91 個 skills，但使用者不知道在特定情境下該組合哪些 skills。需要建立情境導向的 Cookbook，讓使用者透過場景找到正確的 skill 組合和工作流程。README 放 4 個精選場景作為 teaser，完整 8 個場景放在 `docs/cookbook/` 供瀏覽。

## Requirements

- 建立 `docs/cookbook/README.md` landing page — 場景矩陣 + 簡介
- 建立 8 個場景頁面，每個遵循標準化格式
- 在 README.md 新增 `## Cookbook` section（Workflow Tracks 之後），3-column table 放 4 個精選場景
- 場景格式：Use this when → Core skills → Command flow → Decision points → Gates → Outcome → Related

## Scope

| Scope | Description |
|-------|-------------|
| In | `docs/cookbook/` 目錄（landing + 8 scenario pages）、README.md Cookbook section、`/readme-i18n-sync` 同步 |
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
| `README.md` | Modify | Add Cookbook section after Workflow Tracks |

## Acceptance Criteria

- [ ] AC1: `docs/cookbook/README.md` exists with matrix linking to all 8 scenario pages
- [ ] AC2: All 8 scenario pages follow standardized format (Use this when / Core skills / Command flow / Decision points / Gates / Outcome / Related)
- [ ] AC3: README.md has `## Cookbook` section after Workflow Tracks with 3-column table (Scenario | Flow | Docs) containing 4 featured scenarios
- [ ] AC4: Featured README scenarios are differentiated from Workflow Tracks (situation-oriented, not track-oriented)
- [ ] Pass `/codex-review-doc`
- [ ] Pass `/precommit`

## Progress

| Phase | Status | Note |
|-------|--------|------|
| Analysis | Done | Adversarial debate completed (threadId: 019d6775) |
| Development | - | |
| Testing | - | |
| Acceptance | - | |

**Status**: Not Started

## References

- Adversarial debate: threadId `019d6775-af0b-7813-9f24-dc00637528b9`
- Existing Workflow Tracks: `README.md:151-205`
- Existing Showcase: `README.md:403-414`
