# Lightweight Correction Skill (`/remind`)

> **Created**: 2026-03-19
> **Status**: In Progress
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
| Out | Transcript NLP analysis（v2）, auto-execution of corrections（v2, use `/next-step --go`）, new hooks |

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

- [ ] `/remind auto-loop` 輸出 auto-loop rule 摘要 + 當前違規狀態
- [ ] `/remind git-workflow` 輸出 git 規則摘要
- [ ] `/remind <rule-name>` 支援所有 `rules/` 下的規則名稱
- [ ] 未知規則名稱回傳錯誤 + 可用規則列表

### AC2: Smart Detection Mode

- [ ] `/remind` (no args) 讀取 `.claude_review_state.json`
- [ ] 偵測：has_code_change + code_review.passed=false → 提醒跑 review
- [ ] 偵測：has_doc_change + doc_review.passed=false → 提醒跑 doc review
- [ ] 偵測：code_review.passed + precommit.passed=false → 提醒跑 precommit
- [ ] 偵測：git branch = main → 建議建分支
- [ ] 偵測：git status dirty + no review state → 提醒開始 review loop

### AC3: Output Format

- [ ] 輸出格式：finding list (priority + rule + correction action)
- [ ] 無遺漏時顯示 "All clear" 訊息
- [ ] 提供 copy-pasteable 修正指令（如 `/codex-review-fast`）

### AC4: Infrastructure

- [ ] Tests pass
- [ ] skills-schema.test.js pass
- [ ] CLAUDE.md command tables updated

## Progress

- [x] Deep research (2 agents, score 88/100)
- [x] Tech spec — `docs/features/remind/2-tech-spec.md`
- [ ] Implementation
- [ ] Testing
