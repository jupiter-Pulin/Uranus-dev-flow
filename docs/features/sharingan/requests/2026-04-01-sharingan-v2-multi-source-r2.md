# Sharingan v2: Multi-Source Input — R2 策略實作

> **Created**: 2026-04-01
> **Status**: Pending
> **Priority**: P2
> **Tech Spec**: [2-tech-spec.md](../2-tech-spec.md) §7
> **Depends On**: [R1 設計基建](./2026-04-01-sharingan-v2-multi-source-r1.md)

## Background

R1 建立 SourceBundle 規格與 Input Classification 參考文件後，R2 負責實作 Phase 0B classifier、3 source strategy adapters、security envelope、及對應測試。

## Requirements

- Phase 0A: GitHub URL deterministic fast-path 完全不變（zero regression）
- Phase 0B: LLM input classifier 實作（confidence-based routing to 3 strategies）
- external_evidence adapter: delegation to `/deep-research`，thin wrapper → SourceBundle
- local_code_context adapter: Read/Grep → SourceBundle
- scan-repo.js: SourceBundle builder function（github_repo output 轉換）
- Security envelope: HTTPS-only、deny private addresses、payload limit、time limit
- 測試覆蓋：classifier、SourceBundle、adapters、security、regression

## Scope

| Scope | Description |
|-------|-------------|
| In | Phase 0B classifier、strategy adapters、scan-repo.js SourceBundle builder、security envelope、v2 tests |
| Out | SourceBundle spec（R1）、routing signature（R1）、v2 cache 機制（future） |

## Related Files

| File | Action | Description |
|------|--------|-------------|
| `skills/sharingan/SKILL.md` | Modify | Phase 0B workflow + strategy dispatch + SourceBundle normalization |
| `skills/sharingan/scripts/scan-repo.js` | Modify | Export SourceBundle builder function |
| `commands/sharingan.md` | Modify | v2 workflow 步驟 |
| `test/scripts/sharingan-scan-repo.test.js` | Modify | SourceBundle builder tests |
| `test/commands/sharingan.test.js` | Modify | Input auto-detect + --source flag tests |

## Acceptance Criteria

- [ ] AC1: Phase 0A — GitHub URL (`GITHUB_URL_RE`) 仍走現有 scan-repo.js pipeline，v1 測試全部通過（zero regression）
- [ ] AC2: Phase 0B — 非 GitHub 輸入進入 LLM classifier，輸出 strategy + confidence，低信心（< threshold）觸發 AskUserQuestion
- [ ] AC3: `external_evidence` adapter — 呼叫 `/deep-research --budget low`，從 research output 提取 skill-relevant knowledge → SourceBundle
- [ ] AC4: `local_code_context` adapter — Read/Grep 指定路徑 → 提取 patterns/conventions → SourceBundle
- [ ] AC5: scan-repo.js 導出 `toSourceBundle(analysis)` function，將 v1 SourceAnalysis 轉換為 SourceBundle format
- [ ] AC6: Security envelope 完整實作（tech spec §7.8 全部規則）：HTTPS-only、deny private addresses（127.0.0.1、10.x、172.16-31.x、192.168.x）、payload ≤ 500KB、timeout ≤ 30s、untrusted content isolation（sanitize before prompt）、no execution（永不執行 fetched code）、cross-verification（單一來源不自動採信）
- [ ] AC7: Classifier + adapter 實作遵循 R1 參考文件：`input-classification.md` prompt template 用於 Phase 0B、`source-bundle.md` schema 用於 SourceBundle 輸出
- [ ] AC8: 測試覆蓋 — classifier（GitHub/URL/description/local 各 1）、SourceBundle builder、SSRF protection（private IP rejection）、v1 regression（`node --test test/scripts/sharingan-scan-repo.test.js` 全通過）
- [ ] Pass `/codex-review-fast`
- [ ] Pass `/precommit`

## Progress

| Phase | Status | Note |
|-------|--------|------|
| Analysis | Done | Tech spec §7 + best practices audit |
| Development | - | Blocked on R1 |
| Testing | - | |
| Acceptance | - | |

## References

- Tech Spec §7: [2-tech-spec.md](../2-tech-spec.md) — v2 Multi-Source Input Architecture
- R1 Design Foundation: [R1](./2026-04-01-sharingan-v2-multi-source-r1.md)
