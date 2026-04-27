# Handoff-doc R3: Check Mode + Redaction（code layer）

> **Doc class**: Request ticket（date-prefixed non-lifecycle — per `@rules/docs-numbering.md`）
> **Created**: 2026-04-22
> **Status**: Pending
> **Priority**: P1
> **Tech Spec**: [2-tech-spec.md](../2-tech-spec.md)
> **Requirements**: [1-requirements.md](../1-requirements.md)
> **Depends On**: [R1 — Skeleton + Template](./2026-04-22-handoff-doc-r1.md)
> **Siblings**: [R1](./2026-04-22-handoff-doc-r1.md) · [R2](./2026-04-22-handoff-doc-r2.md) · [R4](./2026-04-22-handoff-doc-r4.md)

## Background

實作兩個 code-layer 基建：`--check` 模式（freshness validation）與 `security-redact.js` 的 handoff-specific patterns 擴充。兩者皆為純 pure-function / regex-rule 性質，可平行開發且共享 test harness。

## Requirements

- 實作 `scripts/lib/handoff-check.js`：
  - Export `check(docPath) → CheckReport`
  - 解析 `<!-- handoff-contract-index:v1 ... -->` 區塊
  - 逐 contract 比對 `git hash-object <source_file>` 與 `source_sha`
  - 驗 `source_ref` 行號仍在檔案範圍內（citation integrity）
  - 掃 doc 中 contract-index 外的 `file:line` 引用，檢查 file 存在與 line 範圍
  - 狀態分類對齊 runbook：Fresh / Stale / Missing / Unknown
- 建立 `skills/handoff-doc/references/check-output.md`：`--check` 輸出格式 + exit codes（0/10/11/12 per tech-spec §3.3.2）
- 擴充 `scripts/security-redact.js` 加入 handoff-specific patterns：
  - 內網 IP：`10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.` → `<internal-ip>`
  - `.internal` / `.corp` / `.local` 主機 → `<internal-host>`
  - `localhost` 保留（quickstart 需要）
  - 附 `<!-- handoff-redaction-notes -->` 區塊列出被遮罩項（supplies sender review trail）
- 實作 `test/scripts/lib/handoff-check.test.js`：Fresh / Stale / Missing / Unknown 各類至少一個 fixture→status 映射 test case + citation integrity（file 不存在、line 超出範圍）
- 擴充 existing `security-redact.js` 的測試覆蓋新 patterns（`localhost` 不應被誤傷）+ fake-secret 非洩漏回歸測試（AS-3 錨點）

## Scope

| Scope | Description |
|-------|-------------|
| In | handoff-check.js + check-output.md + security-redact.js 擴充 + 兩個 test file |
| Out | SKILL.md 整合（R4）/ surface-extractor（R2）/ template 建立（R1）/ `--no-internal-redact` 全埠（留 v2） |

## Related Files

| File | Action | Description |
|------|--------|-------------|
| `scripts/lib/handoff-check.js` | New | `--check` mode 核心 |
| `skills/handoff-doc/references/check-output.md` | New | 輸出格式 + exit codes |
| `scripts/security-redact.js` | Modify | 加 internal IP/host/corp/local patterns + redaction-notes block |
| `test/scripts/lib/handoff-check.test.js` | New | 4 狀態 + citation integrity |
| `test/scripts/security-redact.test.js` | Modify | 擴測新 patterns + localhost 保留 |

## Acceptance Criteria

- [ ] `scripts/lib/handoff-check.js` Fresh / Stale / Missing / Unknown 四態分類準確（與 runbook 語彙一致）；每一態至少一個 fixture→status 映射 test case（4 × ≥1 = 至少 4 test cases）
- [ ] Citation integrity：file 不存在時回 Unknown；line 超出範圍時回 Stale（各 1 test case）
- [ ] `references/check-output.md` 定義輸出 schema + exit codes 0/10/11/12
- [ ] `security-redact.js` 遮罩內網 IP / `.internal` / `.corp` / `.local` 但保留 `localhost`
- [ ] `<!-- handoff-redaction-notes -->` 區塊於有遮罩時出現，列原始字串與遮罩後字串
- [ ] 兩個測試檔覆 happy + edge（包含 localhost 不應被遮的回歸測試）
- [ ] **AS-3 錨點**：`security-redact.test.js` 含 fake-secret fixture 非洩漏測試 — fixture 輸入含測試用假 token pattern（例：`sk-test-<40 chars>` 格式字串），產出字串經 redact 後必須不含該 raw 字串（`assert.doesNotMatch` 斷言）
- [ ] Pass `/codex-review-fast`
- [ ] Pass `/codex-test-review`
- [ ] Pass `/precommit`

## Progress

| Phase | Status | Note |
|-------|--------|------|
| Analysis | - | |
| Development | - | |
| Testing | - | |
| Acceptance | - | |

**Status**: Pending

## References

- Tech Spec §3.3.2 Exit Codes
- Tech Spec §3.4.3 `--check` Mode
- Tech Spec §3.4.4 Redaction Extension
- Runbook 語彙對齊：`skills/runbook/references/check-output.md`
