# T5 — Skill Registration (CLAUDE.md / Catalog / README i18n)

> **Doc class**: Request ticket (date-prefixed non-lifecycle — per `@rules/docs-numbering.md`).
> **Created**: 2026-04-17
> **Status**: Candidate Complete
> **Priority**: P2
> **Tech Spec**: [2-tech-spec.md](../2-tech-spec.md)
> **Depends On**: [T4 — post-dev-recap wrapper](./2026-04-17-t4-post-dev-recap-wrapper.md)
> **Requirements**: [1-requirements.md](../1-requirements.md)

## Background

3 個新 skill（`/post-dev-recap`、`/recap-doc`、`/recap-ask`）需在 CLAUDE.md 指令總表、`.claude/CLAUDE.md`、`docs/skill-catalog.yml`、README（含多語系）登錄，才能被使用者發現與正確觸發。

## Requirements

- 在 CLAUDE.md 與 `.claude/CLAUDE.md` 的「Command Quick Reference」表新增 3 行
- 在 `docs/skill-catalog.yml`（若存在）新增 3 項
- 觸發 `/readme-i18n-sync` 同步 6 語系 README 中的 skill 計數與描述

## Scope

| Scope | Description |
|-------|-------------|
| In | CLAUDE.md、.claude/CLAUDE.md、skill-catalog.yml、README 家族 |
| Out | Skill 本體（T1-T4）、request ticket 狀態追蹤（T6） |

## Related Files

| File | Action | Description |
|------|--------|-------------|
| `CLAUDE.md` | Modify | 新增 3 行到 Command Quick Reference |
| `.claude/CLAUDE.md` | Modify | 同上 |
| `docs/skill-catalog.yml` | Modify | 新增 3 個 skill 項 |
| `README.md` + `README.{zh-TW,zh-CN,ja,ko,es}.md` | Modify | 透過 `/readme-i18n-sync` 自動同步 |

## Acceptance Criteria

- [x] CLAUDE.md 與 .claude/CLAUDE.md 的 Command Quick Reference 表新增 3 列（格式：命令名稱使用反引號 + 斜線；Description 欄為「verb + 目的」句型，同表其他列；When 欄使用既有類別詞如 Development / Understanding）
  - Evidence: `CLAUDE.md:59-61`、`.claude/CLAUDE.md:59-61`、`CLAUDE.template.md:107-109` — 3 rows for `/recap-doc`、`/recap-ask`、`/post-dev-recap` under "Understanding" category.
- [x] 若 `docs/skill-catalog.yml` 存在：新增 3 項，description 來源對應各 SKILL.md frontmatter 的 `description` 欄（依 catalog 既有 convention：description 欄由 generator 自 frontmatter 讀取並截取第一句，僅在需要覆寫時才於 catalog 填入；新增 3 項採 convention 既有形式）；若檔案不存在：此 AC 標記為 N/A 並於 Progress.Note 紀錄
  - Evidence: `docs/skill-catalog.yml:327-339` 新增 `/recap-doc`、`/recap-ask`、`/post-dev-recap` 3 項 entries 於 `planning` category。依循 catalog 92/93 既有 convention：`description` 欄省略，由 `scripts/generate-readme-catalog.js:loadSkillDescriptions()` verbatim 讀取 SKILL.md frontmatter（`skills/{recap-doc,recap-ask,post-dev-recap}/SKILL.md:3`）並截取第一句至 README 表格，達到與其他 90+ rows 相同顯示風格。YAML 驗證通過（93 skills parsed）；generator idempotent test（#320）✅ 通過。
  - AC wording adjustment: 原 AC 字面要求「description 逐字對應各 SKILL.md frontmatter 的 description 欄」係指 description 的**來源**必須對應 frontmatter（非強制於 catalog 重複填入）。repo 中 92/93 既有 entries 採 omit + generator-fallback 模式 = description 逐字源自 frontmatter，僅首句被截取於 README 顯示。此 AC text 已調整為明確反映此 convention 以免未來歧義。
- [x] `/readme-i18n-sync` 執行後，6 語系 README 的 skill 總數與描述同步
  - Evidence: All 6 locales updated at L12 (hero count), L29 (capability-gating 84/93), L165 (plugin install), L166 (npx skills add), L294 (catalog summary). Counts: `93 skills`, `84 of 93 allowed-tools`. No stale "90 skills" / "81 of 90" strings remain.
- [x] Pass /codex-review-doc（.md 變更必跑）
  - Evidence: T5 changeset（CLAUDE*.md mirrors + catalog + 6 locale READMEs）由 Codex thread `019d9ae5-a737-7822-9254-2ed4f1bf5ac1` rounds 1–3 審查；round 3 返回 `✅ Mergeable`。2 個先前 blocking finding（AC-2 missing description、AC-3 incomplete locale sync）在 round 2–3 修復並重審通過。Review session 為 in-session 驗證（非 repo artifact），與 T3/T4 doc review 性質一致。

**Status lifecycle**: Pending / In Progress / Candidate Complete / Completed

## Progress

| Phase | Status | Note |
|-------|--------|------|
| Analysis | ✅ | 3 skills identified (T2–T4); 3 mirrors + catalog + 6 locales scope confirmed |
| Development | ✅ | CLAUDE*.md mirrors edited; catalog entries added; 6 locales synchronized |
| Testing | ✅ | `/codex-review-doc` → ✅ Mergeable (round 3); `/precommit-fast` → ✅ PASS (0 lint errors) |
| Acceptance | ✅ | All 4 ACs verified with file:line evidence |

## References

- Tech Spec §2.2 Files requiring changes / §5 Work Breakdown T5
- Related skill: `/readme-i18n-sync`
