# `/safe-remove` — 安全移除 plugin 資產

> **Created**: 2026-03-16
> **Status**: Pending
> **Priority**: P2

## Background

手動移除 plugin 資產（skill / command / agent / rule / script / hook）需觸及 13+ 個檔案（2 core + 9 docs + 1 manifest + tests），容易遺漏 README count、locale 翻譯、cross-skill 引用。經 `/best-practices` audit + `/codex-brainstorm` 對抗辯論（threadId: `019cf518-8ea6-7dc1-8980-540ea00dc3ae`，2 rounds，Nash Equilibrium）確認設計方案。

## Requirements

| # | Requirement | Detail |
|---|-------------|--------|
| R1 | 單一 skill 處理所有 asset types | `skill / command / agent / rule / script / hook` via type parameter |
| R2 | Dry-run default + `--execute` opt-in | 與 `/smart-commit`、`/create-pr` 一致的安全 pattern |
| R3 | 2-tier impact classification | BLOCKER（structured runtime bindings: `@skills/` in commands, `hooks.json` paths, agents `skills:` field）/ PATCHABLE（prose/docs: rules mentions, CLAUDE.md, README, skill descriptions） |
| R4 | Reference graph discovery | `grep -r` 掃描所有引用點，分類為 BLOCKER 或 PATCHABLE |
| R5 | BLOCKER → HALT | 有 critical 依賴時停止並報告，不自動修復 |
| R6 | PATCHABLE → auto-edit | CLAUDE.md table row、README count + detail row、skill prose mentions |
| R7 | Post-removal verification | Type-specific regex 確認無殘留引用（`@skills/`、`skills:`、`/<name>`、hooks path）+ 執行 existing schema/coverage tests |
| R8 | `disable-model-invocation: true` | 破壞性操作，僅限使用者明確觸發 |

## Scope

| Scope | Description |
| ----- | ----------- |
| In | Skill definition（SKILL.md + command + references）、discovery engine、plan output、`--execute` apply、verification |
| Out | `--replace-with` 替換語意（v2）、新增 JS scripts（v2）、4-tier classification（簡化為 2-tier） |

## Related Files

| File | Action | Description |
| ---- | ------ | ----------- |
| `commands/safe-remove.md` | New | Command entry point |
| `skills/safe-remove/SKILL.md` | New | Skill definition |
| `skills/safe-remove/references/removal-policy.md` | New | BLOCKER / PATCHABLE 判定規則 |
| `CLAUDE.md` | Modify | 新增 `/safe-remove` 至 command table |
| `CLAUDE.template.md` | Modify | 同步 command table |
| `README.md` + 5 locale variants | Modify | 新增 command + 更新 count |
| `.claude-plugin/plugin.json` | Modify | Version bump（搭配移除） |
| `test/commands/` | New (optional) | Discovery / verification 測試 |

## Acceptance Criteria

- [ ] `/safe-remove skill <name>` 可正確 discover 所有引用（commands/, rules/, CLAUDE.md, README, agents/, hooks/）
- [ ] `/safe-remove command <name>` 可正確 discover command 引用
- [ ] BLOCKER 偵測覆蓋：`@skills/` bindings in commands、`hooks.json` command paths、agents `skills:` YAML field
- [ ] PATCHABLE 偵測覆蓋：CLAUDE.md table、README.md + 5 locale variants（count + detail row）、rules/ prose mentions、skill descriptions
- [ ] Dry-run mode 輸出完整 plan（files to delete + patches + blockers）不做任何修改
- [ ] `--execute` mode 需 AskUserQuestion 確認後才執行
- [ ] Execute 順序：patches first → deletes last
- [ ] Post-removal type-specific verification（`@skills/<name>/`、`skills: <name>`、`/<name>`、hooks path）回傳 0 結果（排除 archived docs）
- [ ] Per-asset-type discovery matrix 有明確定義（skill/command/agent/rule/script/hook 各自的 BLOCKER/PATCHABLE pattern）
- [ ] Target not found 時輸出明確錯誤訊息（idempotency）
- [ ] `disable-model-invocation: true` 設定於 command
- [ ] 通過 `/codex-review-fast`

## Design Decisions（Debate Record）

| Decision | Rationale | Debate Round |
| -------- | --------- | ------------ |
| Single skill, all asset types | 移除邏輯跨 type 共通；拆成 6 個 skill 是過度工程 | R0, both agreed |
| 2-tier classification（非 4-tier） | REQUIRES_REMAP / AUTO_PATCH 邊界模糊；syntax-based 2-tier 更清晰 | R1, Codex conceded |
| 不加 `--replace-with`（v1） | UNIX 哲學 do one thing well；替換語意屬 v2 | R1, Codex conceded |
| Prompt-native，不加 scripts（v1） | v1 scope 控制；JS scripts 可 v2 加入 | R1, revised consensus |
| BLOCKER = structured runtime bindings | `@skills/` in commands、`hooks.json` paths、agents `skills:` YAML field = runtime/config dependency | R2, precision tweak |
| PATCHABLE = prose/docs references | CLAUDE.md tables、README、rules/ mentions、skill descriptions = documentation only | R2, consensus |

## Progress

| Phase | Status | Note |
| ----- | ------ | ---- |
| Analysis | ✅ Done | best-practices audit + codex-brainstorm (Nash Equilibrium) |
| Development | ✅ Done | SKILL.md + command + removal-policy.md + CLAUDE.md updated; doc review passed |
| Testing | - | |
| Acceptance | - | |

## References

- [Google SWE Book — Deprecation](https://abseil.io/resources/swe-book/html/ch15.html)
- [Meta SCARF — Automated Deprecation](https://engineering.fb.com/2023/10/17/data-infrastructure/automating-product-deprecation-meta/)
- Best practices audit: session context (Phase 1-4)
- Debate record: Codex threadId `019cf518-8ea6-7dc1-8980-540ea00dc3ae`
