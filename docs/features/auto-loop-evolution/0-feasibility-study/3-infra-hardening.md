# Batch 3: Infrastructure Hardening

## 1. Problem Essence

### 1.1 Surface Requirement

強化 auto-loop 的可靠性：Adequacy Gate hook 強制執行、lesson compact 後重新注入、hook 故障恢復能力。

### 1.2 Underlying Problem (5 Why)

1. **Why** — Adequacy Gate 和 Lesson 是 behavior-layer only，模型可以跳過
2. **Why** — Hook 三層防禦在某些故障模式下會級聯失敗
3. **Why** — 用戶遇到 state corruption 時無恢復手段
4. **Why** — 原始設計假設 hook 永遠正常工作
5. **Root cause** — Hook 基礎設施缺乏 **自檢能力** 和 **graceful degradation 文件化**

### 1.3 Success Criteria

| Criterion | Target |
|-----------|--------|
| Adequacy Gate 在 strict mode 下 hook-enforced | stop-guard 阻止未通過 |
| Compact 後 lesson 重新注入 | 最近 5 條 lessons 可見 |
| `/diagnose-hooks` 可偵測所有已知故障 | jq/state/lock/registration |
| Hook 故障恢復 SOP 文件化 | runbook 完成 |

## 2. Constraints

| Type | Constraint | Source | Flexibility |
|------|-----------|--------|-------------|
| Technical | Hook 不可做 HTTP call（< 1s 執行時間） | UX | None |
| Technical | `post-compact-auto-loop.sh` stdout 有 line limit | Claude Code | Low |
| Compat | Lesson file 可能不存在（首次 session） | `self-improvement.md` | High |
| Compat | `/diagnose-hooks` 必須是 read-only（analysis-only skill） | skill safety | None |

## 3. Existing Capability Inventory

### 3.1 Related Modules

| File | Reusable Logic |
|------|---------------|
| `hooks/post-compact-auto-loop.sh` | SessionStart injection pattern |
| `hooks/stop-guard.sh:94-104` | State file reading + field checking |
| `skills/claude-health/SKILL.md` | Health check skill pattern |
| `skills/skill-health-check/SKILL.md` | Validation skill pattern |
| `.claude/sd0x-dev-flow-lessons.md` | Lesson log（if exists） |

### 3.2 Design Patterns

- **Graceful degradation** — 所有 hook 在 `jq` 缺失時 `exit 0`
- **Health check skill** — `/claude-health` 已有 config validation pattern
- **Analysis-only mode** — `[ANALYSIS_ONLY_DEFERRED]` sentinel for read-only skills

### 3.3 Tech Debt

- Hook failure cascade 未文件化
- `HOOK_BYPASS=1` 只在 stop-guard 生效，其他 hook 不認
- Lesson file 無法被 compact hook 讀取（路徑可能因 plugin vs local 不同）

## 4. Possible Solutions

### Item #4: Adequacy Gate Hook Upgrade

#### Option A: State File Extension + Stop Guard Check

**Core idea**: State file 新增 `adequacy_gate` 欄位，stop-guard 在 strict mode 下檢查。

**Implementation path**:
1. State schema 新增 `adequacy_gate: { executed, passed, mode, last_run }`
2. `/codex-test-review --ac-trace` 完成後，behavior-layer 呼叫小 script 更新 state
3. `stop-guard.sh` 在 `STOP_GUARD_MODE=strict` + `testing-project.md ## Adequacy Mode = strict` 時檢查
4. 新 sentinel：`ADEQUACY_GATE=(ADEQUATE|INADEQUATE)` 由 hook parse

**Feasibility**:

| Dimension | Rating | Notes |
|-----------|:------:|-------|
| Technical Feasibility | Green | 現有 state + stop-guard pattern 直接擴展 |
| Effort | Yellow | ~3 person-days（state + hook + sentinel） |
| Risk | Yellow | 需要 `testing-project.md` 設定 strict（opt-in） |
| Extensibility | Green | 可加入更多 gate types |
| Maintenance Cost | Green | 與現有 gate 維護一致 |

#### Option B: Standalone Adequacy Hook

**Core idea**: 新增獨立 hook `post-precommit-adequacy.sh`，在 precommit pass 後自動觸發。

**Feasibility**:

| Dimension | Rating | Notes |
|-----------|:------:|-------|
| Technical Feasibility | Yellow | Claude Code hook 觸發點有限（無 post-precommit event） |
| Effort | Yellow | ~4 person-days |
| Risk | Red | 依賴未存在的 hook event type |
| Extensibility | Yellow | 綁定特定 hook event |
| Maintenance Cost | Yellow | 新 hook 維護 |

---

### Item #6: Lesson Re-injection Post-Compact

#### Option A: Compact Hook Extension

**Core idea**: 修改 `post-compact-auto-loop.sh`，在有 pending step 時額外注入最近 5 條 lessons。

**Implementation path**:
1. 在 compact hook 的 NEXT 判斷後加入 lesson reading logic
2. 用 `grep -E '^## L[0-9]+'` 提取 lesson headers（current format: `## L1 —`）
3. 用 `tail -5` 取最近 5 條
4. 注入格式：`[LESSONS_RESUME] Recent corrections: L5, L6, L7...`
5. 處理 lesson file 不存在的情況（graceful skip）

**Feasibility**:

| Dimension | Rating | Notes |
|-----------|:------:|-------|
| Technical Feasibility | Green | 純 bash grep/tail，無新依賴 |
| Effort | Green | < 1 person-day |
| Risk | Green | File not found = graceful skip |
| Extensibility | Green | 可調整注入數量（5 -> N） |
| Maintenance Cost | Green | 最小維護 |

#### Option B: Lesson File Always Loaded

**Core idea**: 將 lesson file 加入 `.claude/CLAUDE.md` 的 `@rules/` reference，讓 Claude Code 自動載入。

**Feasibility**:

| Dimension | Rating | Notes |
|-----------|:------:|-------|
| Technical Feasibility | Green | 加一行 `@.claude/sd0x-dev-flow-lessons.md` |
| Effort | Green | < 0.5 person-day |
| Risk | Yellow | Lesson file 可能很長（20 active lessons），浪費 context |
| Extensibility | Yellow | 無法控制注入數量 |
| Maintenance Cost | Green | 零維護 |

---

### Item #9: Diagnose Hooks Skill

#### Option A: `/diagnose-hooks` Read-Only Skill

**Core idea**: 新增 analysis-only skill，檢查 hook 基礎設施健康狀態。

**Implementation path**:
1. 建立 `skills/diagnose-hooks/SKILL.md`（analysis-only mode constraint）
2. 檢查項目：
   - jq 是否安裝
   - State file 是否 valid JSON
   - Lockdir 是否 stale
   - Sidecar marker 是否存在
   - Hook 是否在 settings.json 中註冊
   - STOP_GUARD_MODE 當前值
3. 輸出 health report table
4. 建議修復步驟（不自動修復）

**Feasibility**:

| Dimension | Rating | Notes |
|-----------|:------:|-------|
| Technical Feasibility | Green | Read-only，複用 claude-health pattern |
| Effort | Green | ~2 person-days |
| Risk | Green | Analysis-only，零副作用 |
| Extensibility | Green | 可逐步加入更多 check items |
| Maintenance Cost | Green | 與 claude-health 一致 |

#### Option B: Hook Self-Test in SessionStart

**Core idea**: 在 SessionStart hook 中加入 self-test，自動偵測問題。

**Feasibility**:

| Dimension | Rating | Notes |
|-----------|:------:|-------|
| Technical Feasibility | Yellow | SessionStart 執行時間限制 |
| Effort | Green | ~1 person-day |
| Risk | Yellow | 每次 session start 都執行，overhead |
| Extensibility | Yellow | 無法按需執行 |
| Maintenance Cost | Green | 與 SessionStart hook 一致 |

## 5. Codex Discussion

> Deferred — 將在此批次獨立探討時執行 `/codex-brainstorm`。

## 6. Solution Comparison

| Dimension | #4-A State | #4-B Hook | #6-A Compact | #6-B Always Load | #9-A Skill | #9-B SessionStart |
|-----------|:-:|:-:|:-:|:-:|:-:|:-:|
| Technical | Green | Yellow | Green | Green | Green | Yellow |
| Effort | Yellow (3d) | Yellow (4d) | Green (<1d) | Green (<0.5d) | Green (2d) | Green (1d) |
| Risk | Yellow | Red | Green | Yellow | Green | Yellow |
| Extensibility | Green | Yellow | Green | Yellow | Green | Yellow |
| Maintenance | Green | Yellow | Green | Green | Green | Green |

## 7. Initial Recommendation

| Item | Recommended | Rationale |
|------|------------|-----------|
| #4 Adequacy Gate | Option A (State Extension) | 與 Batch 1 state schema evolution 合併，一次性升級 |
| #6 Lesson Re-inject | Option A (Compact Hook) | 精確控制注入量，不浪費 context |
| #9 Diagnose Hooks | Option A (Skill) + B (SessionStart) | Skill for on-demand，SessionStart for critical-only checks |

**Quick wins**: #6-A (< 1 day) 可立即實施，不依賴其他 batch。

## 8. Open Questions

- [ ] Adequacy gate sentinel 格式（`ADEQUACY_GATE=ADEQUATE` vs `## Adequacy: Pass`）
- [ ] Lesson 注入的格式（完整 lesson body vs headers only?）
- [ ] `/diagnose-hooks` 是否也要檢查 plugin vs local hook 衝突？
- [ ] Hook failure cascade 的正式 runbook 放在哪裡？（`docs/` or `rules/`）
- [ ] `HOOK_BYPASS=1` 是否應擴展到所有 hook layers？

## 9. Next Steps

1. 立即實施 #6-A（< 1 day，零依賴）
2. `/tech-spec` — Adequacy gate state schema（與 Batch 1 合併）
3. `/tech-spec` — Diagnose hooks skill definition
