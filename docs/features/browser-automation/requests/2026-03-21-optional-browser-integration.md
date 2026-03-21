# Optional Browser Automation Integration

> **Created**: 2026-03-21
> **Status**: Pending
> **Priority**: P2
> **Tech Spec**: N/A (new feature, pending design)

## Background

gstack 的持久化瀏覽器 daemon（58MB Bun binary, 100-200ms latency）是其技術殺手功能。但 Codex 辯論結論確認：對 sd0x-dev-flow 的 rigor-first 定位而言，browser 不改善任何核心 gate 的 pass/fail 品質，屬於 optional extension。業界標準方案為 Microsoft Playwright MCP（`claude mcp add playwright`，零自建成本）。

策略：不自建 daemon，不綑綁 binary。提供 provider-based 整合文件與推薦配置，讓需要 UI/E2E 測試的使用者自行啟用。

## Requirements

- 撰寫 Playwright MCP 推薦配置文件（安裝、設定、最佳實踐）
- 確保引用 browser 的 skills（best-practices, deep-research）在 Playwright MCP 可用時正確 cascade
- 明確標示 browser 為 optional provider，不進入核心 review/precommit loop

## Scope

| Scope | Description |
|-------|-------------|
| In | Playwright MCP 配置文件、skill cascade 驗證、optional provider 文件 |
| Out | 自建 browser daemon、binary 綑綁、browser 進入核心 gate loop、cookie import 功能 |

## Related Files

| File | Action | Description |
|------|--------|-------------|
| `skills/best-practices/SKILL.md` | Verify | 確認 agent-browser cascade 正確 |
| `skills/deep-research/SKILL.md` | Verify | 確認 web research cascade 正確 |
| `docs/` (new) | New | Playwright MCP 推薦配置指南 |

## Acceptance Criteria

- [ ] Playwright MCP 配置文件涵蓋安裝、設定、使用情境
- [ ] 引用 browser 的 skills 在 Playwright MCP 啟用時正確運作
- [ ] 文件明確標示 browser 為 optional（不影響核心功能）
- [ ] Pass `/codex-review-doc`

## Progress

| Phase | Status | Note |
|-------|--------|------|
| Analysis | - | 競爭分析完成 |
| Development | - | |
| Testing | - | |
| Acceptance | - | |

## References

- Microsoft Playwright MCP: [github.com/microsoft/playwright-mcp](https://github.com/microsoft/playwright-mcp)
- gstack `/browse` skill: [github.com/garrytan/gstack](https://github.com/garrytan/gstack)
- Codex Brainstorm threadId: `019d0e3a-8d86-7ac1-b613-dbedfaf5f1c3`
- Source: Best-practices audit — browser automation analysis (2026-03-21)
