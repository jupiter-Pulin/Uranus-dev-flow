# Output Adapter for codex-plugin-cc

> **Created**: 2026-03-31
> **Status**: Pending
> **Priority**: P1
> **Tech Spec**: [Tech Spec](../2-tech-spec.md) <- Section 3.2

## Background

codex-plugin-cc `/codex:review` 輸出為非結構化文字。需要 adapter 將其轉換為標準 P0/P1/P2/Nit 格式，供 degradation cascade 消費。

## Requirements

- 設計 severity mapping（CRITICAL→P0, BUG→P1, SUGGESTION→P2, STYLE→Nit）
- 實作 file:line 抽取 regex
- 實作 parse failure 路徑（unparseable → degrade signal）
- 建立 fixture-driven test suite

## Scope

| Scope | Description |
|-------|-------------|
| In | Adapter parsing logic, severity mapping, test fixtures |
| Out | Plugin 安裝、cascade integration（see r2）、Codex MCP 本身 |

## Related Files

| File | Action | Description |
|------|--------|-------------|
| `scripts/lib/codex-plugin-adapter.js` | New | Adapter 核心 parsing 模組 |
| `test/scripts/codex-plugin-adapter.test.js` | New | Fixture-driven unit tests |
| `test/fixtures/plugin-output/` | New | 5+ 種 plugin 輸出格式 fixtures |

## Acceptance Criteria

- [ ] Adapter 正確映射 5 種 severity keyword 到 P0/P1/P2/Nit
- [ ] file:line regex 從 plugin 輸出抽取位置資訊
- [ ] 無 file:line 的輸出回傳 `{ parseable: false }` degrade signal
- [ ] 5+ fixture files 涵蓋 structured/unstructured/empty/error 格式
- [ ] Pass /codex-review-fast
- [ ] Pass /precommit-fast

## Progress

| Phase | Status | Note |
|-------|--------|------|
| Analysis | - | |
| Development | - | |
| Testing | - | |
| Acceptance | - | |

## References

- Tech Spec: [codex-plugin-fallback](../2-tech-spec.md) Section 3.2
