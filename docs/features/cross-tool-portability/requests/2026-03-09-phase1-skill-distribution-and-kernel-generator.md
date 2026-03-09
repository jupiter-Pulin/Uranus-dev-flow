# Phase 1: Skill Distribution + Kernel Generator

> **Created**: 2026-03-09
> **Status**: Done
> **Priority**: P1
> **Tech Spec**: [2-tech-spec.md](../2-tech-spec.md)

## Background

sd0x-dev-flow 僅支援 Claude Code。Phase 1 實作 Agent Skills 標準適配（`npx skills add`）+ `codex-setup` skill + AGENTS.md kernel generator，使 Codex CLI 等非 Claude 工具能使用 sd0x-dev-flow 的 skills 與開發規範。

## Requirements

- plugin.json 加入完整 skills 陣列（47 entries），啟用 `npx skills add` 跨工具分發
- 建立 `codex-setup` skill（init/doctor/sync subcommands）
- 建立 AGENTS.md kernel 模板（byte-budgeted，≤ 24 KiB hard cap）
- 建立 `build-codex-artifacts.js` kernel generator（host context 偵測 + placeholder 替換）
- 新增對應 command file（`commands/codex-setup.md`）
- 更新 CLAUDE.md × 3 的 Command Quick Reference

## Scope

| Scope | Description |
|-------|-------------|
| In | plugin.json skills 陣列、codex-setup skill、kernel 模板、generator script、tests、CLAUDE.md 更新 |
| Out | sd0x-flow-core extraction（Phase 3）、Windsurf adapter（Phase 4）、62 commands 全量移植 |

## Related Files

| File | Action | Description |
|------|--------|-------------|
| `.claude-plugin/plugin.json` | Modify | 加入 skills 陣列（47 entries） |
| `skills/codex-setup/SKILL.md` | New | Codex 基建 setup skill（init/doctor/sync） |
| `skills/codex-setup/references/agents-kernel.md` | New | AGENTS.md kernel 模板 |
| `scripts/build-codex-artifacts.js` | New | Kernel generator script |
| `commands/codex-setup.md` | New | Command file wiring to skill |
| `test/scripts/build-codex-artifacts.test.js` | New | Generator 測試（10 test cases） |
| `CLAUDE.md` | Modify | Command Quick Reference 加入 `/codex-setup` |
| `.claude/CLAUDE.md` | Modify | 同上 |
| `CLAUDE.template.md` | Modify | 同上 |

## Acceptance Criteria

- [x] plugin.json 含 47 個 skills entries，按字母排序
- [x] `skills/codex-setup/SKILL.md` 含 name + description frontmatter
- [x] `agents-kernel.md` 模板含 placeholders：`{PROJECT_NAME}`, `{VERSION}`, `{TEST_COMMAND}`
- [x] `build-codex-artifacts.js` 偵測 host context 並替換 placeholders
- [x] Kernel output ≤ 24 KiB（實際 2,099 bytes）
- [x] Generator 正確偵測 package.json `name` 和 `scripts.test`
- [x] 無 package.json 時 fallback 至目錄名 + `npm test`
- [x] Oversize template 產生 exit code 1
- [x] `--template-path` flag 支援自訂模板路徑
- [x] Unknown flags 產生錯誤訊息
- [x] `commands/codex-setup.md` 存在且通過 schema + coverage tests
- [x] 10 個 unit tests 全通過
- [x] `claude-md-coverage.test.js` 通過（CLAUDE.md 與 commands/ 一致）
- [x] `/codex-review-fast` 通過（✅ Ready）
- [x] `/precommit-fast` 通過（✅ All Pass）

## Progress

| Phase | Status | Note |
|-------|--------|------|
| Analysis | Done | Tech spec 已通過 doc review ✅ Mergeable |
| Development | Done | 全部 9 個檔案已建立/修改 |
| Testing | Done | 10 unit tests + schema + coverage tests 全通過 |
| Acceptance | Done | 全部 15 項 AC 已完成 |

**Status**: Done

## References

- Tech Spec: [2-tech-spec.md](../2-tech-spec.md)
- Strategy: Nash Equilibrium — `npx skills add` + `codex-setup` skill + kernel generator
