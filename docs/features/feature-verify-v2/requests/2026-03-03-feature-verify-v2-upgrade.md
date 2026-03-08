# Feature Verify v2 Upgrade

> **Created**: 2026-03-03
> **Status**: Superseded
> **Priority**: P1
> **Tech Spec**: N/A (superseded before spec)
> **Source**: Codex Brainstorm Nash Equilibrium (2026-03-03)
> **Superseded by**:
> - [2026-03-08-observation-only-mode.md](./2026-03-08-observation-only-mode.md) (P1)
> - [2026-03-08-endpoint-discovery-spike.md](./2026-03-08-endpoint-discovery-spike.md) (P2)

## Superseded Reason

此 request 的大部分 AC 已在先前開發中完成（SKILL.md 已從 94 行重寫為 270+ 行的完整 P0-P5 framework）。經 `/best-practices` 審計（Codex brainstorm `019cc761-0825-7b02-8f26-8550ce4f571c`）確認：

1. Plugin 已實作 P0-P5 + degradation matrix + template-driven abstraction
2. 但 degradation matrix 缺少 **observation-only mode**（L2-OBS：API 不可達但 Log 可用，如 prod 環境）
3. Endpoint discovery（route-scan）需要跨框架 spike 研究後才能決定是否抽象化

因此拆為兩個更精確的 request，而非在過時的 AC 上打勾。

## Background (Original)

現有 `feature-verify` skill 為 basic-to-mid 成熟度（6 個泛用 Phase，缺乏具體執行指引）。onekey onchain 版本有已驗證的 P0-P5 Phase framework + 4-level degradation matrix + production guardrails，可抽象化為通用的 runtime-first API verification pattern。

## Requirements

- 升級現有 `skills/feature-verify/SKILL.md`，不建新 skill
- 採用 P0-P5 Phase framework：
  - P0: Scope & Safety（環境選擇、可達性檢查、read-only 確認）
  - P1: Diff-Lite Scoping（git diff → 受影響 endpoint/module）
  - P2: Test Charter（L1 回歸 + L2 主動觸發 + L3 被動觀測）
  - P3: API Execute（curl + 記錄 HTTP/code/latency/requestId）
  - P4: Observation Correlate（embedded forensics，抽象化 log observation）
  - P5: Verdict + Report（Pass/Warn/Blocked/Inconclusive + 信心等級）
- 4-level degradation matrix（API+Log → API only → Log only → No runtime）
- P4 以 embed-first 設計（不建獨立 forensics skill），但保留 extract-later 路徑
- 抽象化環境設定（使用者透過 references/ 自定義 HOST、headers、endpoint allowlist）
- Production guardrails（單請求逐一、固定測試參數、read-only endpoint allowlist）

## Scope

| Scope | Description |
| ----- | ----------- |
| In | SKILL.md 重寫 + references（environments、safety-rules、blackbox-testing、output-template）+ command 更新 |
| Out | OpenSearch/Grafana 整合、log-insight 依賴、deploy-to-test 功能 |

## Related Files

| File | Action | Description |
| ---- | ------ | ----------- |
| `skills/feature-verify/SKILL.md` | Rewrite | P0-P5 framework + degradation |
| `skills/feature-verify/references/environments.md` | New | 環境設定 template（使用者自訂） |
| `skills/feature-verify/references/safety-rules.md` | New | Read-only 規則 + endpoint allowlist |
| `skills/feature-verify/references/blackbox-testing.md` | New | Test charter 設計 + log 驗證流程 |
| `skills/feature-verify/references/output-template.md` | Modify | Verdict report 格式 |
| `commands/feature-verify.md` | Modify | 更新 argument-hint |

## Acceptance Criteria

- [ ] P0-P5 Phase workflow 完整定義
- [ ] 4-level degradation matrix（API+Log / API only / Log only / None）
- [ ] P4 Observation 以抽象介面設計（不硬綁 OpenSearch）
- [ ] Verdict taxonomy: Pass / Warn / Blocked / Inconclusive + 信心等級
- [ ] Production guardrails section 完備
- [ ] environments.md 為可自訂 template（非 hardcode）
- [ ] safety-rules.md 定義 read-only 規則 + endpoint allowlist pattern
- [ ] When NOT to Use section 完備
- [ ] `/skill-health-check` 全維度通過
- [ ] `/codex-review-doc` 通過

## Progress

| Phase | Status | Note |
| ----- | ------ | ---- |
| Analysis | - | |
| Development | - | |
| Testing | - | |
| Acceptance | - | |

## References

- Source: onekey `feature-verify` skill (P0-P5 framework)
- Current: `skills/feature-verify/SKILL.md` (270+ lines, P0-P5 complete)
- Original brainstorm: `019cb1d4-8534-7932-bd24-6b3054091171`
- Supersede audit brainstorm: `019cc761-0825-7b02-8f26-8550ce4f571c` (3 rounds, Nash equilibrium)
- 均衡結論：V2 AC 大部分已滿足，拆為 observation-only-mode + endpoint-discovery-spike
