# Lightweight Correction Skill (`/remind`)

> **Created**: 2026-03-19
> **Status**: Candidate Complete
> **Priority**: P1
> **Deep Research**: conversation 2026-03-19 (2 agents, score 88/100)

## Background

模型在長 session 中會忘記 CLAUDE.md 和 Rules 的指示——特別是 behavior-layer 規則（auto-loop、doc sync、adequacy gate 等）。現有 hooks（stop-guard、post-tool-review-state）可以 enforce **completeness**（是否完成了必要步驟），但無法 enforce **timing**（是否在同一 reply 中執行）或偵測 **reasoning-level** 違規（"Declaring ≠ Executing"）。

`/next-step` 已有 16 個 deterministic heuristics，但它的定位是 "what to do next"——不是 "what you forgot"。需要一個輕量級 correction skill 填補 reasoning-level 盲點。

## Requirements

| 需求 | 說明 |
|------|------|
| User-invoked correction | `/remind auto-loop` 告訴模型忘了什麼 |
| Smart detection | `/remind` (no args) 讀取 state + git + context 智慧判斷遺漏 |
| Lightweight | 不做 research，只做檢查（< 5s） |
| Reuse existing infra | 重用 stop-guard state parsing + next-step heuristics |

## Scope

| Scope | Description |
|-------|-------------|
| In | State-based detection (review/precommit/doc-review), git status checks, user-specified rule reminders, correction action output |
| Out | Transcript NLP analysis（v2）, new hooks |

> **Note**: v1 實作包含 correction execution（偵測到違規時自動執行修正指令），原 scope 規劃為 v2，但實作過程中決定納入 v1（見 SKILL.md:13 execution mandate）。
>
> **Security**: `<rule-name>` 解析為 `rules/<rule>.md`（直接路徑建構）。安全邊界為 Claude 的 Read tool（僅允許讀取 repo 內檔案）+ Glob fallback 列出可用規則。未來可增加 slug 格式驗證（`^[a-z0-9-]+$`）作為額外防護。

## Related Files

| File | Action | Description |
|------|--------|-------------|
| `skills/remind/SKILL.md` | New | Skill definition（detection heuristics + correction output） |
| `skills/remind/references/detection-rules.md` | New | Detection rule table + state file parsing |
| `commands/remind.md` | New | Command entry point |
| `test/commands/remind.test.js` | New | Schema + content tests |
| `CLAUDE.template.md` | Modify | Command Quick Reference 加入 `/remind` |
| `CLAUDE.md` | Modify | Command Quick Reference 加入 `/remind` |
| `.claude/CLAUDE.md` | Modify | Command Quick Reference 加入 `/remind` |

## Acceptance Criteria

### AC1: User-Invoked Mode

- [x] `/remind auto-loop` 輸出 auto-loop rule 摘要 + 當前違規狀態
- [x] `/remind git-workflow` 輸出 git 規則摘要
- [x] `/remind <rule-name>` 支援所有 `rules/` 下的規則名稱（解析為 `rules/<rule>.md`，fallback Glob 列出可用規則）
- [x] 未知規則名稱回傳錯誤 + 可用規則列表

### AC2: Smart Detection Mode

- [x] `/remind` (no args) 讀取 `.claude_review_state.json`
- [x] 偵測：has_code_change + code_review.passed=false → 提醒跑 review
- [x] 偵測：has_doc_change + doc_review.passed=false → 提醒跑 doc review
- [x] 偵測：code_review.passed + precommit.passed=false → 提醒跑 precommit
- [x] 偵測：git branch = main → 建議建分支
- [x] 偵測：git status dirty + no review state → 提醒開始 review loop

### AC3: Output Format

- [x] 輸出格式：finding list (priority + rule + correction action)
- [x] 無遺漏時顯示 "All clear" 訊息
- [x] 提供 copy-pasteable 修正指令（如 `/codex-review-fast`）

### AC4: Infrastructure

- [x] Tests pass
- [x] skills-schema.test.js pass
- [x] CLAUDE.md command tables updated

## Progress

| Phase | Status | Note |
|-------|--------|------|
| Deep research | Done | 2 agents, score 88/100 |
| Tech spec | Done | `docs/features/remind/2-tech-spec.md` |
| Implementation | Done | SKILL.md (195 lines) + detection-rules.md + commands/remind.md |
| Testing | Done | 8 tests passing (`test/commands/remind.test.js`) |
| Acceptance | Done | Codex review + precommit pass |
