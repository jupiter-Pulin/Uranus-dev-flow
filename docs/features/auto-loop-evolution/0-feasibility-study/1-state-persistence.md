# Batch 1: State Persistence & Loop Control

## 1. Problem Essence

### 1.1 Surface Requirement

Auto-loop 的迭代計數、P2/Nit 歷史、dual review 時序需要跨 session/compact 持久化。

### 1.2 Underlying Problem (5 Why)

1. **Why** — 模型在 context compaction 後遺忘迭代次數，可能無限循環
2. **Why** — `.claude_review_state.json` 只追蹤 pass/fail，不追蹤歷史
3. **Why** — 設計時假設 session 不會被 compact，但生產環境中 compact 是常態
4. **Why** — 原始 auto-loop 是 behavior-layer rule，state file 是後來補強的
5. **Root cause** — State schema 設計時缺乏「歷史維度」，只有「當前快照」

### 1.3 Success Criteria

| Criterion | Target |
|-----------|--------|
| 迭代計數 compact 存活率 | 100% (state file persisted) |
| 同一 issue 3 輪後自動 exit | 可驗證 (test) |
| P2/Nit 跨 session 去重 | 不重複嘗試已 deferred 的 Nit |
| Dual review timeout | Secondary hang 120s 後自動 proceed |

## 2. Constraints

| Type | Constraint | Source | Flexibility |
|------|-----------|--------|-------------|
| Technical | State file 必須向後相容（舊 hook 讀新 schema 不 crash） | hook ecosystem | Low |
| Technical | Lock 機制已是 `mkdir`-based，不能改用 `flock`（macOS） | `post-tool-review-state.sh:36` | None |
| Resource | Hook 執行時間 < 1s（不可做 HTTP call） | UX | Low |
| Compat | 必須同時支援 single/dual review mode | `stop-guard.sh:119` | None |

## 3. Existing Capability Inventory

### 3.1 Related Modules

| File | Reusable Logic |
|------|---------------|
| `hooks/post-tool-review-state.sh` | `_lock/_unlock` pattern, `update_state()` |
| `hooks/stop-guard.sh:150-187` | Stale-state git reconciliation |
| `hooks/post-compact-auto-loop.sh` | Re-injection template |
| `scripts/emit-review-gate.sh` | Aggregate gate write pattern |

### 3.2 Design Patterns

- **Sidecar marker** (`${STATE_FILE}.blocked`) — atomic fail-closed signal，可擴展為其他 sidecar files
- **One-way reconciliation** — `true -> false` only via git status，防止 false positive
- **Lock-with-TTL** — mkdir + pid + timestamp，可加 retry-with-backoff

### 3.3 Tech Debt

- `[NIT_DEFERRED]` 只輸出到 stdout，無持久化機制
- `iteration_count` 不存在於 schema
- `secondary_review.pending` 不存在於 schema
- State file 無 `version` 欄位，無法做 migration

## 4. Possible Solutions

### Item #1: Iteration Counter Persistence

#### Option A: State File Schema Extension

**Core idea**: 在 `.claude_review_state.json` 新增 `iteration_history` 欄位。

**Implementation path**:
1. 定義新 schema（加入 `version`, `iteration_history`）
2. `post-tool-review-state.sh` 在偵測到 review sentinel 時 increment counter
3. `post-compact-auto-loop.sh` 讀取 counter 並注入
4. `stop-guard.sh` 在 counter >= 3 時允許 exit（`Need Human`）
5. 加入 `findings_per_round[]` array 供收斂偵測

**Feasibility**:

| Dimension | Rating | Notes |
|-----------|:------:|-------|
| Technical Feasibility | Green | 現有 jq + state file pattern 可直接擴展 |
| Effort | Green | ~2 person-days（hook 修改 + tests） |
| Risk | Green | 向後相容（新欄位 optional，舊 hook 忽略） |
| Extensibility | Green | `findings_per_round` 直接支援 Batch 2 收斂度量 |
| Maintenance Cost | Green | 與現有 state file 維護成本一致 |

#### Option B: Separate History File

**Core idea**: 新增 `.claude_review_history.json`，與 state file 分離。

**Implementation path**:
1. 建立獨立 history file，記錄每輪 findings 和 issue fingerprints
2. State file 保持不變（最小化破壞）
3. Hook 在每次 review 完成時 append 到 history

**Feasibility**:

| Dimension | Rating | Notes |
|-----------|:------:|-------|
| Technical Feasibility | Green | 新檔案，零相容風險 |
| Effort | Yellow | ~4 person-days（新 file + 新 lock + hook 修改） |
| Risk | Green | 完全不影響現有 state file |
| Extensibility | Yellow | 需要額外的 GC/rotation 機制 |
| Maintenance Cost | Yellow | 多一個 file 要維護，多一個 lock |

---

### Item #3: P2/Nit History Persistence

#### Option A: Nit History in State File

**Core idea**: State file 新增 `deferred_findings[]` array。

**Implementation path**:
1. `post-tool-review-state.sh` 偵測 `[NIT_DEFERRED]` sentinel，解析並存入 state
2. Review prompt 注入已 deferred 的 finding keys（避免重複嘗試）
3. `post-compact-auto-loop.sh` 在重新注入時包含 deferred list

**Data minimization policy**:
- 僅儲存 `file + hashed_issue_key`，禁止原始程式碼片段
- 不可包含 secrets/PII（per `rules/security.md`）
- 預設 TTL 14 天，過期自動清除

**Feasibility**:

| Dimension | Rating | Notes |
|-----------|:------:|-------|
| Technical Feasibility | Yellow | 需要 sentinel parsing（regex for `[NIT_DEFERRED]`） |
| Effort | Yellow | ~3 person-days（sentinel + state + compact hook） |
| Risk | Yellow | Sentinel format 必須穩定，否則 parsing 失敗 |
| Extensibility | Green | 可同時支援 seek-verdict dismissed findings |
| Maintenance Cost | Yellow | Sentinel 格式變更需同步更新 hook |

#### Option B: Standalone `.claude_nit_history.json`

**Core idea**: 獨立檔案追蹤所有 deferred/dismissed findings。

**Data minimization policy**:
- 僅儲存 `file + hashed_issue_key + status + timestamp`，禁止原始程式碼片段
- 不可包含 secrets/PII（per `rules/security.md`）
- 預設 TTL 14 天，過期項目由 hook GC 清除

**Feasibility**:

| Dimension | Rating | Notes |
|-----------|:------:|-------|
| Technical Feasibility | Green | 獨立新檔，無相容問題 |
| Effort | Yellow | ~3 person-days |
| Risk | Green | 不影響 state file |
| Extensibility | Green | 可加入 TTL/expiry |
| Maintenance Cost | Yellow | 需要 GC 機制 |

---

### Item #8: Dual Review Timeout & Recovery

#### Option A: State File Secondary Tracking

**Core idea**: State file 新增 `secondary_review.pending` + `dispatched_at`，pre-precommit checkpoint 加 timeout。

**Implementation path**:
1. `emit-review-gate.sh PENDING` 時寫入 `secondary_review.pending=true, dispatched_at=now`
2. Pre-precommit checkpoint（behavior-layer）比較 `dispatched_at + timeout_ms` vs now
3. Timeout 後以 primary (Codex) gate 為準繼續（與現有 SKILL.md 行為一致：「Task still running → Proceed with Codex gate (authoritative)」）；late result 到達時若有 P0/P1 仍重開 fix loop；strict mode 下 timeout 觸發 `Need Human` audit signal
4. `post-compact-auto-loop.sh` 注入 secondary 狀態

**Feasibility**:

| Dimension | Rating | Notes |
|-----------|:------:|-------|
| Technical Feasibility | Green | 現有 pattern（emit-review-gate + jq） |
| Effort | Green | ~2 person-days |
| Risk | Yellow | Timeout 以 primary gate 為準（非 fail-open pass），strict mode 需 audit signal |
| Extensibility | Green | Timeout 值可配置於 settings |
| Maintenance Cost | Green | 與現有 dual review 維護一致 |

#### Option B: Background Agent Polling

**Core idea**: 使用 `TaskOutput` 機制 poll secondary agent 狀態。

**Feasibility**:

| Dimension | Rating | Notes |
|-----------|:------:|-------|
| Technical Feasibility | Yellow | 依賴 Claude Code TaskOutput API 穩定性 |
| Effort | Yellow | ~3 person-days |
| Risk | Yellow | API 行為可能變更 |
| Extensibility | Green | 可擴展到其他 background agent |
| Maintenance Cost | Yellow | 綁定 Claude Code 特定 API |

## 5. Codex Discussion

> Deferred — 將在此批次獨立探討時執行 `/codex-brainstorm`。

## 6. Solution Comparison

| Dimension | #1-A State Ext | #1-B History File | #3-A State Ext | #3-B Nit File | #8-A State Track | #8-B Polling |
|-----------|:-:|:-:|:-:|:-:|:-:|:-:|
| Technical | Green | Green | Yellow | Green | Green | Yellow |
| Effort | Green (2d) | Yellow (4d) | Yellow (3d) | Yellow (3d) | Green (2d) | Yellow (3d) |
| Risk | Green | Green | Yellow | Green | Yellow | Yellow |
| Extensibility | Green | Yellow | Green | Green | Green | Green |
| Maintenance | Green | Yellow | Yellow | Yellow | Green | Yellow |

## 7. Initial Recommendation

| Item | Recommended | Rationale |
|------|------------|-----------|
| #1 Iteration Counter | Option A (State Extension) | 與現有 pattern 一致，effort 最低，直接支援收斂度量 |
| #3 P2/Nit History | Option B (Standalone File) | 避免 state file 過度膨脹，支援 TTL/expiry |
| #8 Dual Timeout | Option A (State Tracking) | 與 emit-review-gate 流程自然整合 |

**Backup**: 若 state file schema 變更太頻繁導致相容問題，所有 item 退回 Option B (standalone files)。

## 8. Open Questions

- [ ] State file version migration 策略（是否加 `"schema_version": 2`？）
- [ ] `findings_per_round` 的 issue fingerprint 演算法（file + canonical text? hash?）
- [ ] Nit history TTL 預設值（14d? 30d? never expire?）
- [ ] Secondary timeout 時 primary-gate-authoritative 策略是否需要用戶配置？（strict mode 自動觸發 `Need Human` audit signal）
- [ ] 是否需要 `/reset-review-state` 手動重置命令？

## 9. Next Steps

1. `/codex-brainstorm` — 對 state schema evolution 做對抗性辯論
2. `/tech-spec` — 定義 state schema v2
3. Implementation（估計總計 ~7 person-days for 3 items）
