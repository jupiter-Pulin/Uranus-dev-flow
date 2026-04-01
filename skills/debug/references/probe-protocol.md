# Probe Protocol

## Probe Loop Structure

每個 probe 是一個假設測試：

```
┌─ 1. 定義假設 H
│  2. 設計探測命令 C
│  3. 預測「若 H 成立 → 期望 O」
│  4. 執行 C → 觀察實際結果
│  5. 比對預期 vs 實際 → 更新假設集合
└─ 6. 選下一個最具鑑別力的探測
```

## Probe Journal Format

每輪記錄：

```markdown
### Probe R<N>
- **Hypothesis**: <假設內容>
- **Command**: `<探測命令>`
- **Expected**: <預期結果>
- **Actual**: <實際結果>
- **Conclusion**: Confirmed / Refuted / Inconclusive — <簡述>
```

## Termination Criteria

| Condition | Action |
|-----------|--------|
| 根因已定位 + ≥1 個執行結果佐證 | **Stop** — 進入 Phase 3 |
| 多個競爭假設（≥2 同等可信） | **Brainstorm** — `/codex-brainstorm` 對抗辯論 |
| 連續 2 輪無新資訊（stagnation） | **Escalate** — `⚠️ Need Human` |
| 達到 max rounds | **Escalate** — `⚠️ Need Human`，輸出已知資訊 |

## Config

| Key | Default | Override |
|-----|---------|----------|
| `debug.max_probe_rounds` | 6 | SKILL.md `## Config` section |

## `/codex-brainstorm` Integration

當 probe loop 產生 ≥2 個同等可信的根因假設：

1. 暫停 probe loop
2. 調度 `/codex-brainstorm`，topic = 各假設的比較
3. 辯論收斂（Nash equilibrium）後，以收斂結果作為新的主假設
4. 回到 probe loop 驗證收斂假設

## Probe Selection Strategy

選擇下一個 probe 時，優先選擇**最具鑑別力**的探測：

| Priority | Strategy | Description |
|----------|----------|-------------|
| 1 | Binary elimination | 一個探測可排除 ≥50% 假設 |
| 2 | Direct verification | 直接驗證最可能的假設 |
| 3 | Error path tracing | 追蹤 error → catch → fallback 路徑 |
| 4 | Differential | 比較 working vs broken 狀態 |

## Anti-Patterns

| Anti-Pattern | Correct Alternative |
|-------------|-------------------|
| Shotgun probing（隨機嘗試） | 先排序假設，選最具鑑別力的 probe |
| 重複同一個 probe | 若結果不變，換不同角度探測 |
| 忽略矛盾結果 | 矛盾 = 假設有誤，重新分析 |
| 未記錄 probe 結果 | 每輪必填 Probe Journal |
