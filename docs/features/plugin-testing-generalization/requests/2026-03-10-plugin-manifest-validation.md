# plugin.json Manifest Validation Test

> **Created**: 2026-03-10
> **Status**: Pending
> **Priority**: P1
> **Tech Spec**: [2-tech-spec.md](../2-tech-spec.md) (parent feature; this request adds manifest validation coverage)

## Background

`"skills": "skills"` 格式錯誤導致 plugin update 失敗（Zod validation error: `skills: Invalid input`）。目前沒有針對 `.claude-plugin/plugin.json` manifest schema 的專門測試，這類 regression 可以在 CI 前就被攔截。

## Requirements

- 新增 `test/commands/plugin-manifest.test.js` manifest validation 測試
- 驗證分為 hard 和 recommended 兩層（見下方定義）
- 涵蓋 9 個 test cases（見 Acceptance Criteria）
- 零外部依賴（僅用 `node:test` + `node:assert`）
- 符合現有 `test/commands/schema.test.js` 程式碼風格

### Validation Tiers

| Tier | Behavior | Example |
| ---- | -------- | ------- |
| **Hard** | Test failure（`assert` 失敗 → CI 紅燈） | `name` required, version sync, unknown fields |
| **Recommended** | 獨立 test case，失敗時提供 warning message 但仍 fail | `version` semver, `description` 非空 |

## Scope

| Scope | Description |
| ----- | ---------------------------------- |
| In | plugin.json validation test、field allowlist、path format、version sync |
| Out | Runtime validation script、dedicated precommit hook（測試已由 `npm test` 涵蓋，不需額外 hook） |

## Related Files

| File | Action | Description |
| ---- | ------ | ----------- |
| `test/commands/plugin-manifest.test.js` | New | Manifest validation 測試 |
| `.claude-plugin/plugin.json` | Read | 驗證目標 |
| `package.json` | Read | Version sync 對照 |
| `test/commands/schema.test.js` | Reference | 程式碼風格參考 |
| `test/commands/skills-schema.test.js` | Reference | 結構驗證參考 |

## Acceptance Criteria

### Hard Tests（test failure = CI fail）

- [ ] `test/commands/plugin-manifest.test.js` 建立
- [ ] T1: Valid JSON parse
- [ ] T2: `name` 存在且為 kebab-case (`/^[a-z0-9]+(-[a-z0-9]+)*$/`)
- [ ] T3: Version sync — `plugin.version === package.version`
- [ ] T4: No unknown root fields（allowlist: `name`, `version`, `description`, `author`, `homepage`, `repository`, `license`, `keywords`, `commands`, `agents`, `skills`, `hooks`, `mcpServers`, `outputStyles`, `lspServers`）
- [ ] T5: Component path fields `./` prefix — 目標欄位: `commands`, `agents`, `skills`, `hooks`, `mcpServers`, `outputStyles`, `lspServers`；if present, string 或 array 中每個值都以 `./` 開頭
- [ ] T6: Component path fields type check — 同上目標欄位；reject object / object[]（防止 `[{name, path}]` legacy format）

### Recommended Tests（test failure = CI fail + descriptive message）

- [ ] T7: `version` 存在且符合 semver (`/^\d+\.\d+\.\d+/`)
- [ ] T8: `description` 存在且非空
- [ ] T9: `keywords` 為 string array（if present）

### Quality Gates

- [ ] Pass `/codex-review-fast`
- [ ] Pass `/precommit`

## Progress

| Phase | Status | Note |
| ----- | ------ | ---- |
| Analysis | Done | `/best-practices` audit + `/codex-brainstorm` debate (threadId: `019cd867-7048-77e1-b244-0f5bba997ebc`) |
| Development | - | |
| Testing | - | |
| Acceptance | - | |

## References

- Best Practices Audit: Gap Report (brainstorm threadId: `019cd867-7048-77e1-b244-0f5bba997ebc`)
- Official Docs: [Plugins Reference](https://code.claude.com/docs/en/plugins-reference)
- Issue: [#20409 Silent skill loading failure](https://github.com/anthropics/claude-code/issues/20409)
- Issue: [#21598 Agents field string format failure](https://github.com/anthropics/claude-code/issues/21598)
