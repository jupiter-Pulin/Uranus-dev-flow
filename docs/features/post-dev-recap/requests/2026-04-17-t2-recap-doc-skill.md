# T2 — `/recap-doc` Skill

> **Doc class**: Request ticket (date-prefixed non-lifecycle — per `@rules/docs-numbering.md`).
> **Created**: 2026-04-17
> **Status**: Candidate Complete
> **Priority**: P1
> **Tech Spec**: [2-tech-spec.md](../2-tech-spec.md)
> **Depends On**: [T1 — Scope Detector + Redaction](./2026-04-17-t1-scope-detector-redaction-util.md)
> **Requirements**: [1-requirements.md](../1-requirements.md)

## Background

`/recap-doc` 為 Shape B+D Hybrid 架構的文件產出層 sub-skill，負責把 `ScopeReport` 轉成 `briefing-recap-<date>.md`，包含 FR-3（靜態導覽）、FR-7（規格對照）、FR-9（盲點清單 Must）、FR-11（anticipated questions）。

## Requirements

- 實作 `.claude/skills/recap-doc/SKILL.md`（薄層 orchestrator）
- 重用 `tech-brief` Stage 2 git evidence 收集邏輯（NFR-5）
- 重用 `/codex-explain` 產生程式碼說明（NFR-5）
- Depth matrix：brief=top-5 / normal=top-10 / deep=top-15
- FR-9 盲點清單**所有 depth 都必須輸出**（無項目時明示「本輪未偵測到明顯盲點」）
- 若偵測到 tech-spec，輸出 §4 Drift 對照區段

## Scope

| Scope | Description |
|-------|-------------|
| In | `.claude/skills/recap-doc/` SKILL.md + prompt template + 對應 integration test |
| Out | Q&A 階段（T3）、wrapper 整合（T4）、scope detector（T1） |

## Related Files

| File | Action | Description |
|------|--------|-------------|
| `.claude/skills/recap-doc/SKILL.md` | New | 主 skill 定義 |
| `.claude/skills/recap-doc/references/prompt-template.md` | New | Recap synthesis prompt 模板 |
| `test/skills/recap-doc.test.js` | New | Integration test：scope JSON → doc 輸出、drift 偵測、blind spots、redaction |

## Acceptance Criteria

- [x] `/recap-doc --scope <json> --depth normal` 產出符合 tech-spec §3.2.2 結構的 markdown，且每個變更檔案含 file:line 引用（AS-3）— 合約測試 `test/skills/recap-doc.test.js:225-232` 驗證 `file:line` 模板強制、§1-§7 結構齊全。⚠️ runtime 端到端執行測試待 T4 wrapper 覆蓋（ENV_UNAVAILABLE exception）。
- [x] `--depth` 三種值產生可區分的輸出規模（AS-13）— `test/skills/recap-doc.test.js:113-139` 驗證 `brief=5 / normal=10 / deep=15` 在 Depth Levels 表；`references/output-template.md:83-93` 逐區段規則。
- [x] FR-9 Blind Spots 區段任何 depth 都存在；無盲點時明示「本輪未偵測到明顯盲點」— `test/skills/recap-doc.test.js:143-173` 驗證 §5 heading always-on、fallback 字串逐字、depth matrix 所有欄皆非空。
- [x] 偵測到 `feature_context.has_tech_spec === true` 時，輸出 Drift 對照表（AS-10）— `test/skills/recap-doc.test.js:236-247`、`references/output-template.md:44-49` 驗證條件觸發。
- [x] FR-11 Anticipated Questions：`--depth brief` 時省略；`normal`/`deep` 時產出至少 3 題並於 recap doc 含「使用 `/recap-ask` 展開」提示（AS-14）— `test/skills/recap-doc.test.js:193-210, 290-294` 驗證 brief omit、normal/deep ≥3、模板直接引用 `/recap-ask`。
- [x] NFR-2 效能：`/recap-doc` 產出（不含 LLM 外部延遲）≤ 30s（AS-8）— `SKILL.md` Performance 區段與 `source-guide.md:102-104` 定義 Stage 1-3 ≤10s + 4a 預算切分；⚠️ 實機效能測量待整合測試（ENV_UNAVAILABLE exception）。
- [x] `/recap-doc` 呼叫 `/codex-explain` 產生程式碼說明（NFR-5 驗收）— `test/skills/recap-doc.test.js:81-84` 驗證 SKILL.md 明示 Phase 4a Skill 呼叫；實際呼叫執行時由 Claude runtime 依 SKILL.md 指令觸發。
- [x] 輸出前呼叫 `security-redact.js`；高信心 secret 存在時 abort（NFR-7）— `test/skills/recap-doc.test.js:86-89`、`SKILL.md` Phase 5 明示 `redact()` + `AbortError` 行為；⚠️ 實機 abort 路徑由 T1 `security-redact.js` 20 個測試已覆蓋。
- [x] Pass /codex-review-fast — ✅ Ready（Codex 初評 P2×3 + Nit×1、二評 P0×1 全部修復；二審 `--continue` ✅ Ready；doc-review ✅ Mergeable）

**Status lifecycle**: Pending / In Progress / Candidate Complete / Completed

## Progress

| Phase | Status | Note |
|-------|--------|------|
| Analysis | ✅ | Plan `glittery-marinating-donut.md` 通過；Shape B+D Hybrid，sub-skill 定義 + references 先行 |
| Development | ✅ | SKILL.md + 3 reference files + 34 contract tests 交付；`CLAUDE.md`/`CLAUDE.template.md`/`.claude/CLAUDE.md` 登錄 `/recap-doc`（Understanding 類別） |
| Testing | ✅ | `node --test test/skills/recap-doc.test.js` 34/34；全專案 `npm test` 1332/1334 pass（2 skipped，0 fail） |
| Acceptance | ⚠️ | Adequacy Gate = ⚠️ Adequate with exceptions（AC1/AC6/AC7/AC8 合約層驗證、runtime 端到端待 T4 整合測試；exception class = ENV_UNAVAILABLE） |

## References

- Tech Spec §3.4.2 `/recap-doc` 合成流程 / §3.2.2 Recap doc 結構
- Requirements FR-3, FR-7, FR-9, FR-11, NFR-5
- Reuse anchors: `tech-brief` source-guide.md L26-46, `codex-explain` SKILL.md L29-33
