# Precommit Test Tiering Technical Spec

## 1. Requirement Summary

- **Problem**: Auto-loop 每次 fix iteration 都執行完整測試套件（369 tests, ~8 min），嚴重拖慢開發速度。Integration tests 佔 95% 時間但在迭代修復迴圈中提供的邊際價值低。
- **Goals**:
  - 將 auto-loop 迭代路由從 `/precommit` 改為 `/precommit-fast`，使用 fast test tier
  - 建立 `test:fast`（unit + schema）和 `test:ci`（全套）分層
  - 確保 runner 和 command docs 同步更新，tiering 在兩條執行路徑都生效
  - 通用專案（無 `test:fast` script）fast mode graceful degradation 到現有行為；full mode intentionally 改為偏好 `test` 以獲得更完整覆蓋
- **Scope**:

| Scope | Description |
|-------|-------------|
| In | auto-loop routing、package.json scripts、runner preference chain、command docs、CLAUDE.md 更新 |
| Out | PR-boundary full precommit enforcement（追蹤為獨立 enhancement）、非 Node 專案 runner fallback（追蹤為獨立 enhancement）、jq process spawning 優化 |

## 2. Existing Code Analysis

### 2.1 Current Test Distribution

| Script | Glob | Files | Approx Time |
|--------|------|-------|-------------|
| `test:unit` | `test/scripts/lib/*.test.js` | 1 | <1s |
| `test:schema` | `test/commands/*.test.js` | 3 | <1s |
| `test:integration` | `test/scripts/*.test.js` | 13 | ~7.5 min |
| `test:hooks` | `test/hooks/*.test.js` | 4 | ~20s |
| `test` (all) | `test/**/*.test.js` | ~21 | ~8 min |

### 2.2 Execution Paths

Precommit 有兩條執行路徑：

```
Step 1: Glob check .claude/scripts/precommit-runner.js
        ├─ Found → Runner (precommit-runner.js)    ← 本專案走這條
        └─ Not found → Command markdown fallback   ← 通用專案走這條
```

- **Runner** (`scripts/precommit-runner.js:180-190`): 硬編碼 `test:unit → test` fallback
- **Command docs** (`commands/precommit-fast.md:14-18`, `commands/precommit.md:20-26`): YAML intent 定義 preferred/alternatives

兩者必須同時更新。

### 2.3 Hook State

`hooks/post-tool-review-state.sh:117`: `/precommit` 和 `/precommit-fast` 設定同一個 `precommit` bit — 這是正確的，hook 只需驗證「某種 precommit 檢查已通過」。

### 2.4 Auto-Loop Routing

`rules/auto-loop.md:18`: 目前 review pass 後路由到 `/precommit`（full）。

### 2.5 Related Files

| File | Current Role |
|------|-------------|
| `rules/auto-loop.md` | 定義 iterative fix loop 路由 |
| `scripts/precommit-runner.js` | Runner — test selection 硬編碼 |
| `commands/precommit-fast.md` | Fast precommit command（fallback 路徑） |
| `commands/precommit.md` | Full precommit command（fallback 路徑） |
| `package.json` | npm scripts 定義 |
| `CLAUDE.md` / `.claude/CLAUDE.md` / `CLAUDE.template.md` | Auto-loop 表格 |
| `test/scripts/precommit-runner.test.js` | Runner 測試 |

## 3. Technical Solution

### 3.1 Architecture Design

```
Auto-loop (iterative fix cycle)          PR lifecycle (final gate)
─────────────────────────────            ────────────────────────
review pass                              /precommit → /pr-review
    │                                        │
    ▼                                        ▼
/precommit-fast                          Runner --mode full
    │                                        │
    ▼                                        ▼
Runner --mode fast                       test:ci → test → test:fast → test:unit
    │                                    (all 369 tests, ~8min)
    ▼
test:fast → test:unit → test
(unit + schema, <2s)
```

### 3.2 Test Tier Hierarchy

```
test:ci  ⊇  test  ⊇  test:fast  ⊇  test:unit
 (all)      (all)    (unit+schema)   (unit only)
```

覆蓋範圍保證：full mode >= fast mode。在本專案中為嚴格包含；通用專案中若兩者 fallback 到同一 script（例如都只有 `test:unit`），則覆蓋相等。

### 3.3 Runner Test Selection Logic

```javascript
// Current (line 180-190)
if (hasScript(pkg, 'test:unit')) { ... }
else if (hasScript(pkg, 'test')) { ... }

// Proposed
const testPreference = args.mode === 'fast'
  ? ['test:fast', 'test:unit', 'test']
  : ['test:ci', 'test', 'test:fast', 'test:unit'];

const selectedScript = testPreference.find(s => hasScript(pkg, s));
```

### 3.4 Fallback Behavior (Generic Projects)

| Project Has | Fast Mode Runs | Full Mode Runs | full >= fast? |
|-------------|---------------|----------------|---------------|
| `test:fast` + `test:ci` | `test:fast` | `test:ci` | Yes |
| `test:fast` + `test` | `test:fast` | `test` | Yes |
| `test:fast` + `test:unit` (no `test`) | `test:fast` | `test:fast` | Equal |
| `test:unit` + `test` | `test:unit` | `test` | Yes |
| `test:unit` only | `test:unit` | `test:unit` | Equal |
| `test` only | `test` | `test` | Equal |
| None | skip | skip | N/A |

**Fast mode**: 通用專案不需要定義 `test:fast` — fallback chain 保留現有行為（偏好 `test:unit`）。

**Full mode**: Intentional behavior change — 現行 runner 偏好 `test:unit`，提案改為偏好 `test`（更完整）。對於同時有 `test:unit` 和 `test` 的專案，full mode 將從跑 unit-only 改為跑全套。這是預期的改進，非迴歸。

### 3.5 Package.json Scripts

```json
{
  "test:fast": "npm run test:unit && npm run test:schema",
  "test:ci": "npm test"
}
```

- `test:fast`: unit + schema（<2s）— 用於 auto-loop 迭代
- `test:ci`: 等同 `test`（all）— 語意別名，便於 runner 辨識

## 4. Risks and Dependencies

| Risk | Impact | Mitigation |
|------|--------|------------|
| `precommit.passed` 語意從 full 變 fast | Doc sync 可能在部分測試通過後觸發 | Doc sync 不依賴 full test coverage；安全閥（diff 比較）捕捉迴歸 |
| Fast tier 遺漏 integration regression | Bug 只在 full suite 發現 | PR gate 仍跑 full suite；CI 強制 full |
| Runner 和 command docs 不同步 | 行為不一致 | 同一 PR 更新兩者；新增 runner 測試驗證 preference chain |
| 多個 skill 硬編碼 `/precommit` | 路由不一致 | `auto-loop.md` 標記為最高優先級規則，衝突時 auto-loop 勝出 |

## 5. Work Breakdown

| # | Task | File(s) | Effort |
|---|------|---------|--------|
| W1 | 新增 `test:fast`, `test:ci` scripts | `package.json` | S |
| W2 | Runner: test preference chain by mode | `scripts/precommit-runner.js` | M |
| W3 | Command fast: 更新 preferred list + description + output table | `commands/precommit-fast.md` | S |
| W4 | Command full: 更新 preferred list + description + output table | `commands/precommit.md` | S |
| W5 | Auto-loop: iterative route 改 `/precommit-fast` | `rules/auto-loop.md` | S |
| W6 | CLAUDE.md 更新 auto-loop 表格 | `CLAUDE.md`, `.claude/CLAUDE.md`, `CLAUDE.template.md` | S |
| W7 | Runner 測試: 驗證 tier preference | `test/scripts/precommit-runner.test.js` | M |

### Execution Order

```
W1 (package.json) → W2 (runner) → W3+W4 (commands, parallel) → W5+W6 (docs, parallel) → W7 (tests)
```

## 6. Testing Strategy

### 6.1 Runner Tests (W7)

新增至 `test/scripts/precommit-runner.test.js`:

| Test Case | Description |
|-----------|-------------|
| fast mode prefers test:fast | 有 `test:fast` + `test:unit` 時，fast mode 選 `test:fast` |
| fast mode falls back to test:unit | 無 `test:fast` 時，fallback 到 `test:unit` |
| full mode prefers test:ci | 有 `test:ci` + `test` 時，full mode 選 `test:ci` |
| full mode falls back to test | 無 `test:ci` 時，fallback 到 `test` |
| full mode coverage >= fast mode | 驗證 hierarchy 正確性 |

### 6.2 Existing Tests

所有現有 precommit-runner 測試必須繼續通過（backward compatibility）。

### 6.3 Manual Verification

- `/precommit-fast` 在本專案跑 `test:fast`（unit + schema），<2s
- `/precommit` 在本專案跑 `test:ci`（全套），~8 min
- 在無 `test:fast` 的專案中：fast mode fallback 到 `test:unit`；full mode fallback 到 `test`（或 `test:unit` if no `test`）

## 7. Open Questions

| # | Question | Proposed Resolution |
|---|----------|-------------------|
| Q1 | PR-boundary 是否需要可執行的 full precommit enforcement？ | 追蹤為獨立 enhancement，不阻擋本次 |
| Q2 | `next-step` skill 的 `post_precommit` 語意是否需要區分 fast/full？ | 不需要 — doc sync 有安全閥；若未來需要，可在 hook state 增加 `precommit_mode` 欄位 |
| Q3 | 是否需要更新其他 skill 中硬編碼的 `/precommit` 參考？ | 不需要 — auto-loop 是最高優先級規則，衝突時 auto-loop 勝出 |
