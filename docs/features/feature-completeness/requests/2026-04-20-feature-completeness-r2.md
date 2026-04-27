# Feature Completeness — R2 Skill Entry + References + Catalog

> **Doc class**: Request ticket (date-prefixed non-lifecycle — per `@rules/docs-numbering.md`). Per-task work breakdown unit for progress tracking. **Not** a feature-level requirements doc — for that see `../1-requirements.md`.
> **Created**: 2026-04-20
> **Status**: Pending
> **Priority**: P1
> **Tech Spec**: [2-tech-spec.md](../2-tech-spec.md)
> **Depends On**: [R1 Core Data Pipeline](./2026-04-20-feature-completeness-r1.md)
> **Requirements**: [1-requirements.md](../1-requirements.md)

## Background

建立 `feature-completeness` skill 的使用者面：thin SKILL.md（≤ 200 行）、5 份 references、skill catalog 登錄 + 6 locale README 同步、`stop-guard.sh` 回歸測試（驗證 `## Completeness Verdict:` header 不被誤匹配，per FR-7 / NFR-4）。消費 R1 的 core 模組。

## Requirements

- `skills/feature-completeness/SKILL.md` — thin entry，CLI args、mode flags、sub-skill dispatch（read-only envelope per R9）、sentinel header contract
- `references/` 5 份：`dimensions.md` / `orchestration.md` / `output-template.md` / `discussion-prompts.md` / `extraction.md`
- Skill catalog + i18n README 同步（`/readme-i18n-sync` 或手動 6 locale）
- `stop-guard.sh` 回歸測試確保本 skill 的 `## Completeness Verdict:` header 不被 hook 誤匹配（NFR-4）
- Path boundary 採 `realpathSync` + separator-aware check（§4 R8 模式，參 recap-ask）

## Scope

| Scope | Description |
|-------|-------------|
| In  | SKILL.md + 5 references + skill catalog + 6 locale README + hook regression test |
| Out | Core 模組 fc-*.js（R1）；`--discuss` / `--challenge` 互動邏輯（R3）；E2E fixture feature tests（R3） |

## Related Files

| File | Action | Description |
|------|--------|-------------|
| `skills/feature-completeness/SKILL.md` | New | Thin entry（≤ 200 行，NFR-3） |
| `skills/feature-completeness/references/dimensions.md` | New | 5 baseline + 4 opt-in 維度 + evidence 來源 |
| `skills/feature-completeness/references/orchestration.md` | New | Sub-skill dispatch map + graceful degradation（R9 read-only envelope） |
| `skills/feature-completeness/references/output-template.md` | New | Dashboard / gap report / `## Completeness Verdict:` header 範本 |
| `skills/feature-completeness/references/discussion-prompts.md` | New | 先 stub；R3 填入具體 prompt |
| `skills/feature-completeness/references/extraction.md` | New | FR / NFR / AC regex + prohibited-domain keyword 清單 |
| `docs/skill-catalog.yml` | Modify | 加入 feature-completeness 條目 |
| `README.md` | Modify | 加入 feature-completeness 描述（英文 source） |
| `README.zh-TW.md` | Modify | 繁中同步（經 `/readme-i18n-sync`） |
| `README.zh-CN.md` | Modify | 简中同步（經 `/readme-i18n-sync`） |
| `README.ja.md` | Modify | 日文同步（經 `/readme-i18n-sync`） |
| `README.ko.md` | Modify | 韓文同步（經 `/readme-i18n-sync`） |
| `README.es.md` | Modify | 西文同步（經 `/readme-i18n-sync`） |
| `test/hooks/stop-guard.feature-completeness.test.js` | New | 驗證 `## Completeness Verdict:` header 不被 hook 解析為 Gate |
| `test/skills/feature-completeness.test.js` | New | SKILL.md 結構 + allowed-tools + header 契約（基礎版，E2E 在 R3） |

## Acceptance Criteria

- [ ] SKILL.md ≤ 200 行；`allowed-tools` 不含 `Write` / `Edit` / `Bash(git add:*)` / `Bash(git commit:*)` / `Bash(git push:*)`（NFR-6）
- [ ] SKILL.md 的 `When NOT to Use` 至少列 6 個近鄰 skill（`/test-health` / `/pre-pr-audit` / `/project-audit` / `/check-coverage` / `/codex-test-review` / `/review-spec`）— FR-9
- [ ] `hooks/stop-guard.sh` 對本 skill 輸出的 `## Completeness Verdict: ✅/⚠️/⛔` 回歸測試：不被匹配為 `Gate: ✅/⛔`
- [ ] 5 份 references 全部建立；每份皆被 SKILL.md 明確引用；discussion-prompts.md 可為 R3 延伸的 stub
- [ ] Skill catalog 登錄完整；6 locale README 同步通過 `/codex-review-doc`
- [ ] Path boundary check 完整實作（§4 R8 完整契約）：(a) `fs.realpathSync(p)` 解析 symlink、(b) `path.relative(repo_root, real)` 結果非 `..` 開頭、(c) `!path.isAbsolute(rel)`、(d) separator-aware `startsWith(repo_root + path.sep)` 驗證；任一檢查失敗即拒絕
- [ ] Pass /codex-review-fast
- [ ] Pass /codex-review-doc（SKILL.md + references）

## Progress

| Phase | Status | Note |
|-------|--------|------|
| Analysis | Done | Tech spec §2.3 清單已明確 |
| Development | - | Blocked by R1 |
| Testing | - | |
| Acceptance | - | |

## References

- Tech Spec: [../2-tech-spec.md](../2-tech-spec.md) §2.3, §3.4.1, §4 R4/R8/R9, §5 T5/T6/T11/T12
- Requirements: [../1-requirements.md](../1-requirements.md) FR-7/8/9, NFR-3/4/6, §S-5/S-6/S-7
- Sibling: [R1 Core pipeline](./2026-04-20-feature-completeness-r1.md) · [R3 Interactive + E2E](./2026-04-20-feature-completeness-r3.md)
