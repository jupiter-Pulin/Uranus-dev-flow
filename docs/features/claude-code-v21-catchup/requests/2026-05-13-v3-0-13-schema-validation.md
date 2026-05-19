# v3.0.13 — Manifest `$schema` + `claude plugin validate` + Inventory tests

> **Created**: 2026-05-13
> **Status**: Pending
> **Priority**: P1
> **Depends On**: [v3.0.12 correctness patch](./2026-05-13-v3-0-12-correctness-patch.md)
> **Audit Source**: `/best-practices` 對照 Claude Code v2.1.140 的 audit；codex-brainstorm threadId `019e1f30-89a1-77f3-afbd-9615f2783592`

## Background

v3.0.12 完成 parser silent bug 與 manifest 描述清理後，本 patch 補上 **schema 驗證基礎建設**：

1. Claude Code v2.1.120+ `claude plugin validate` 支援 `$schema` 欄位驗證（具體版本以 Claude Code changelog 為準，本 ticket 對特定 patch number 不做斷言）；目前 plugin.json / marketplace.json 都缺此欄位，validate 雖通過但會 warn「No marketplace description provided」。
2. marketplace.json 缺頂層 `version` / `description`（v2.1.120+ 開放支援），影響 marketplace UI 顯示與版本追蹤。
3. `test/skills/plugin-manifest.test.js:9` 的 `ALLOWED_FIELDS` 集合**排除** `$schema`——加入 `$schema` 前必須先更新此測試的 allow list，否則直接失敗。
4. 缺乏 inventory 驗證：basename ≡ frontmatter `name` 沒測過、bundled / public skill 數量沒斷言、與內建 slash command（`/debug`、`/simplify`、`/security-review`）的衝突沒列冊。
5. README 寫「Claude Code 2.1+」但 plugin hooks 完整保證需 ≥ v2.1.94（v2.1.94 修了 `CLAUDE_PLUGIN_ROOT` 與 plugin skill hooks 被忽略的 bug）；最低版本宣告需更精確。

## Requirements

- plugin.json / marketplace.json 加上 `$schema` 欄位（指向 SchemaStore 上的官方 schema）
- marketplace.json 加上頂層 `version` / `description`
- 更新 `test/skills/plugin-manifest.test.js` 的 `ALLOWED_FIELDS` 接受 `$schema`
- CI 加入 `claude plugin validate` 步驟，並斷言 CI 用的 `claude --version` ≥ 2.1.120（或於 workflow 中 pin 具體 CLI 版本），確保 schema 驗證行為可重現
- 新增 inventory 測試三組：basename ≡ frontmatter `name`、bundled vs public 雙計數斷言、built-in / bundled 名稱衝突報告
- README 最低版本宣告改為「full hook guarantees require Claude Code ≥ 2.1.94」
- 過程中若發現 `package.json` engines 欄位有對應要求，一併同步

## Scope

| Scope | Description |
|-------|-------------|
| In | manifest schema 欄位、CI validate 步驟、3 組 inventory 測試、README 最低版本聲明、6 份 locale README 同步 |
| Out | `bump-version` skill 擴充（→ v3.1.0）、hooks `args` 遷移（→ v3.1.0）、PreCompact（→ v3.1.0）、衝突 skill 改名或加 `disable-model-invocation`（→ v3.1.0 決策） |

## Related Files

| File | Action | Description |
|------|--------|-------------|
| `.claude-plugin/plugin.json` | Modify | 加 `$schema` |
| `.claude-plugin/marketplace.json` | Modify | 加 `$schema` + 頂層 `version` + 頂層 `description` |
| `test/skills/plugin-manifest.test.js` | Modify | `ALLOWED_FIELDS` 加入 `$schema`；新增 schema URL 格式斷言 |
| `test/skills/marketplace-manifest.test.js` | New（若不存在）| 驗證 marketplace 頂層欄位 |
| `test/skills/skill-basename-name-parity.test.js` | New | 對所有 `skills/*/SKILL.md` 斷言 directory basename ≡ frontmatter `name` |
| `test/skills/skill-count-parity.test.js` | New | 雙計數：`ls skills/`（98）與 `docs/skill-catalog.yml`（96 public）分別斷言；變動需同步更新 |
| `test/skills/builtin-collision-report.test.js` | New | 對 `debug` / `simplify` / `security-review` 等內建 slash command 名稱產生衝突報告（log warning 而非 fail，policy 留 v3.1.0 決定） |
| `.github/workflows/*.yml` | Modify | 加 `claude plugin validate` 步驟（位置依現有 CI 結構決定） |
| `README.md` | Modify | 最低版本宣告改為「Claude Code ≥ 2.1.94」 |
| `README.zh-TW.md` / `README.zh-CN.md` / `README.ja.md` / `README.ko.md` / `README.es.md` | Modify | 同步 |

## Acceptance Criteria

- [ ] `plugin.json` 含 `$schema` 欄位且指向 SchemaStore 官方 URL
- [ ] `marketplace.json` 含 `$schema` + 頂層 `version` + 頂層 `description`
- [ ] `test/skills/plugin-manifest.test.js` `ALLOWED_FIELDS` 接受 `$schema` 且全測試通過
- [ ] `claude plugin validate` 在乾淨環境下 0 warning 0 error
- [ ] CI workflow 含 `claude plugin validate` 步驟並在 PR 上自動跑
- [ ] CI workflow 明確 pin 或斷言 Claude Code CLI 版本（避免上游 schema 行為漂移破壞驗證）
- [ ] basename-name parity test 對 98 個 skill 全綠
- [ ] skill-count-parity test 同時斷言 bundled = 98 與 public = 96
- [ ] builtin-collision-report test 至少列出 `debug` / `simplify` / `security-review` 三項並 emit warning
- [ ] 6 份 README 的最低版本聲明同步為 v2.1.94
- [ ] Pass `/codex-review-fast`
- [ ] Pass `/precommit`

## Progress

| Phase | Status | Note |
|-------|--------|------|
| Analysis | Done | `/best-practices` audit 完成 |
| Development | - | |
| Testing | - | |
| Acceptance | - | |

## References

- Audit Conversation: codex-brainstorm threadId `019e1f30-89a1-77f3-afbd-9615f2783592`
- Sibling tickets: [v3.0.12 correctness patch](./2026-05-13-v3-0-12-correctness-patch.md)（depends on）、[v3.1.0 modernization](./2026-05-13-v3-1-0-modernization.md)
- Plugin manifest schema: <https://www.schemastore.org/claude-code-plugin-manifest.json>
- Marketplace schema: <https://www.schemastore.org/claude-code-marketplace.json>
- Claude Code Changelog（`$schema` + `claude plugin validate` 自 v2.1.120+ 起支援）: <https://code.claude.com/docs/en/changelog>
- v2.1.94 release（plugin hooks fix）: <https://github.com/anthropics/claude-code/releases/tag/v2.1.94>
