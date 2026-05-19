# v3.1.0 — Hooks exec form / PreCompact / Skill effort / bump-version 擴充

> **Created**: 2026-05-13
> **Status**: Pending
> **Priority**: P2
> **Depends On**: [v3.0.13 schema/validation](./2026-05-13-v3-0-13-schema-validation.md)
> **Audit Source**: `/best-practices` 對照 Claude Code v2.1.140 的 audit；codex-brainstorm threadId `019e1f30-89a1-77f3-afbd-9615f2783592`
> **Granularity Note**: 本 ticket 是 modernization umbrella，含 5 個獨立 workstream（A/B/C/D/E）。實作前建議再切為 sub-tickets。建議切法之一為 4 張 sub-ticket（將 C effort + D bump-version 因檔案重疊性高合併）：r1 hooks args / r2 PreCompact / r3 effort+bump-version / r4 collision policy。也可採 5 張一對一切法。

## Background

v3.0.12 / v3.0.13 修完 correctness 與 schema 後，本 minor version 啟動 Claude Code v2.1.x **平台特性現代化**：

1. **Hooks `args` exec form**（Claude Code v2.1.x；具體 patch 以 changelog 為準）—— 目前 `hooks/hooks.json` 全部用 shell string 形式註冊（**9 個 command 註冊**，分佈於 8 支 `hooks/*.sh` 與 1 支 `scripts/namespace-hint.sh`）。遷移可降低 quoting risk，並對齊官方推薦寫法（`${CLAUDE_PLUGIN_ROOT}` 以單一 arg 傳遞）。
2. **PreCompact hook**（Claude Code v2.1.x）—— 補上 compaction preflight 鉤點：snapshot auto-loop state、在 state 損毀或未保存的 review iteration 期間 **block** compaction。**不取代** 現有 `SessionStart compact`（後者負責 post-compact 重注入，兩者語意分離）。
3. **Skill `effort:` frontmatter**（Claude Code v2.1.x）—— 對重型 skill 明示 high thinking budget。**僅** 套用於：`codex-architect`、`best-practices`、`tech-spec`、`feasibility-study`、`deep-research`。其他 skill 維持預設，不影響 deterministic guards。
4. **`bump-version` skill 擴充** —— v3.0.12 已決定 manifest 不寫具體數字，但 README + skill-catalog.yml 仍會漂移。擴充 `bump-version` 在每次升版時驗證 bundled count（`ls skills/`）與 public count（catalog entries）並同步至 README 6 個 locale。
5. **Standalone install 衝突政策** —— `skills/debug`、`skills/simplify`、`skills/security-review` 與 Claude Code 內建 slash commands（`/debug`、`/simplify`、`/security-review`）名稱衝突。Plugin 安裝路徑有 namespace 保護，但 standalone install 會 shadow。三個解法擇一：改名、加 `disable-model-invocation: true`、文件警告（待 v3.1.0 開工時決定）。

## Requirements

### Workstream A — Hooks `args` exec form

- **目標範圍**：`hooks/hooks.json` 中所有 9 個 command 註冊（含 8 支 `hooks/*.sh` + 1 支 `scripts/namespace-hint.sh` 的 SessionStart 註冊）全部從 `command: "..."` 改為 `args: ["...", "..."]` exec form
- 更新 `test/hooks/hooks-json-registry.test.js:17` 從 `h.command?.includes(...)` 改為支援雙路檢測（command 字串形式與 args 陣列形式並存）
- 同步更新 `install-hooks` skill 的 install 腳本以正確安裝兩種格式

### Workstream B — PreCompact hook

- 新增 `hooks/pre-compact-guard.sh`：讀取 `.claude_review_state.json`，若 review iteration 進行中且 fix→review→precommit 未完成 → exit 2 with reason
- `hooks/hooks.json` 註冊 PreCompact event 與新 script
- 保留現有 `SessionStart compact` matcher 與 `post-compact-auto-loop.sh` 不動
- 新增 `test/hooks/pre-compact-guard.test.js`

### Workstream C — Skill `effort:` frontmatter

- 5 個 skill 的 frontmatter 加 `effort: high`：`codex-architect`、`best-practices`、`tech-spec`、`feasibility-study`、`deep-research`
- 其他 93 個 skill 不變
- 不對 `pre-edit-guard` / `stop-guard` 等 deterministic guards 引入 effort 條件分支

### Workstream D — bump-version 擴充

- `skills/bump-version/SKILL.md` 邏輯擴充：
  - 讀取 `ls skills/` 計算 bundled count
  - 讀取 `docs/skill-catalog.yml` entries 計算 public count
  - 同步至 6 份 README 的 count 敘述
- 新增 `test/skills/bump-version.test.js` 驗證 count 計算正確性

### Workstream E — Standalone install 衝突政策

- 決定處理方式（建議：保留 skill 名稱不改，加 `disable-model-invocation: true` 並加文件警告）
- 文件化於 README「Installation」段落或新增 `docs/standalone-install-collisions.md`

## Scope

| Scope | Description |
|-------|-------------|
| In | A/B/C/D/E 五個 workstream；各自有獨立 AC，可分批 PR |
| Out | Plugin themes / output-styles / statusline（→ P2 backlog）、`.zip` / `--plugin-url` 文件（→ P2）、MCP `alwaysLoad`（不適用，sd0x 不擁有 MCP server）、`updatedToolOutput`（窄範圍評估，本 ticket 不含實作） |

## Related Files

| File | Action | Workstream |
|------|--------|------------|
| `hooks/hooks.json` | Modify | A + B |
| `hooks/*.sh`（8 個）| 不改內容，僅 hooks.json 引用改 args | A |
| `hooks/pre-compact-guard.sh` | New | B |
| `test/hooks/hooks-json-registry.test.js` | Modify | A |
| `test/hooks/pre-compact-guard.test.js` | New | B |
| `skills/install-hooks/SKILL.md` | Modify | A |
| `skills/codex-architect/SKILL.md` | Modify | C |
| `skills/best-practices/SKILL.md` | Modify | C |
| `skills/tech-spec/SKILL.md` | Modify | C |
| `skills/feasibility-study/SKILL.md` | Modify | C |
| `skills/deep-research/SKILL.md` | Modify | C |
| `skills/bump-version/SKILL.md` | Modify | D |
| `test/skills/bump-version.test.js` | New / Modify | D |
| `README.md` + 5 locale | Modify | D + E |
| `docs/standalone-install-collisions.md` | New（可選）| E |

## Acceptance Criteria

- [ ] `hooks/hooks.json` 中**全部 9 個 command 註冊**（8 支 `hooks/*.sh` + namespace-hint）遷移為 `args` exec form，hooks.json 通過 `claude plugin validate`
- [ ] `hooks-json-registry.test.js` 同時支援檢測 command 與 args 兩種形式
- [ ] `pre-compact-guard.sh` 在 review iteration 進行時能 block compaction（exit 2 + 明確 reason）
- [ ] `SessionStart compact` matcher 與 `post-compact-auto-loop.sh` 行為未受影響
- [ ] 5 個指定 skill 的 frontmatter 含 `effort: high`，其他 93 個未動
- [ ] `bump-version` skill 升版時自動驗證並同步 bundled / public count 至 6 份 README
- [ ] standalone install 衝突政策**明確決定** 並具體落實（3 選 1）：
  - 選項 1：保留 skill 名稱，於 `skills/debug/SKILL.md`、`skills/simplify/SKILL.md`、`skills/security-review/SKILL.md` 三檔 frontmatter 加 `disable-model-invocation: true`
  - 選項 2：改名（提供新舊名 mapping，並於 6 份 README 更新指引）
  - 選項 3：保留現狀，於 README「Installation」段或 `docs/standalone-install-collisions.md` 加入警告與規避指引
  - AC 驗收時必須能指出選了哪個選項、實際改動的具體檔案清單
- [ ] `claude plugin validate` 0 warning 0 error
- [ ] Pass `/codex-review-fast`
- [ ] Pass `/precommit`

## Progress

| Phase | Status | Note |
|-------|--------|------|
| Analysis | Done | `/best-practices` audit 完成 |
| Development | - | 建議實作前先切 sub-tickets（r1-r5） |
| Testing | - | |
| Acceptance | - | |

## References

- Audit Conversation: codex-brainstorm threadId `019e1f30-89a1-77f3-afbd-9615f2783592`
- Sibling tickets: [v3.0.12 correctness patch](./2026-05-13-v3-0-12-correctness-patch.md)、[v3.0.13 schema/validation](./2026-05-13-v3-0-13-schema-validation.md)（depends on）
- Claude Code Changelog（hook `args` exec form / effort frontmatter / PreCompact hook 的具體 patch 版本以 changelog 為準）: <https://code.claude.com/docs/en/changelog>
- Hooks Reference: <https://code.claude.com/docs/en/hooks>
