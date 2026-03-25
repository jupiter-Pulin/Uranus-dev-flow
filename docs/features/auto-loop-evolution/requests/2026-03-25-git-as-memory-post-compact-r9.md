# Git-as-Memory Post-Compact Injection

> **Created**: 2026-03-25
> **Status**: Spec Complete
> **Priority**: P2 (medium effort, hook change)
> **Brainstorm threadId**: `019d24b5-0085-74f3-b143-ae6b35060c95`
> **Origin**: autoresearch project analysis (deep-research 2026-03-25)
> **Equilibrium**: Pure Strategy Convergence (3 rounds)

## Background

autoresearch 用 `git log` 作為外部記憶體，每次 iteration 重建 context。sd0x-dev-flow 的 `post-compact-auto-loop.sh` 目前只注入 state file 狀態和 auto-loop 規則，缺少 git context。compaction 後 Claude 失去 conversation history，加入 git metadata 可以提供「什麼已經做了」的 grounding。

## Requirements

- 在 `hooks/post-compact-auto-loop.sh` 的 `[AUTO_LOOP_RESUME]` block 中加入 git context
- Fail-open: git 不可用時不輸出
- Output cap: 每個 command 限制 `head -10~15` + global 40-line total cap
- 只在有 pending step 時輸出（與現有 `$NEXT` 條件一致）
- Opt-in: 預設 off，需在 `auto-loop-project.md` 加 `## Git Memory: enabled`
- Secret filtering: 排除含 `.env`, `credential`, `token`, `secret` 的檔案路徑

## Scope

| In | Out |
|----|-----|
| `hooks/post-compact-auto-loop.sh` 修改 | State file schema 變更 |
| Git metadata 注入（log + diff + status） | 新增 hook 檔案 |

## Acceptance Criteria

- [ ] Post-compact injection 含 `[GIT_CONTEXT]` block
- [ ] `git log --oneline --no-merges -5` output (capped `head -20`)
- [ ] `git diff --stat` output (capped `head -20`)
- [ ] `git status --short` output (capped `head -20`)
- [ ] 所有 git command fail-open（command 失敗時靜默跳過）
- [ ] 只在 `$NEXT` 非空時輸出
- [ ] 現有 `[AUTO_LOOP_RESUME]` 行為不變
- [ ] Git context injection 預設 off，opt-in via `auto-loop-project.md` (`## Git Memory: enabled`)
- [ ] Git output 不含 secret-like patterns（`.env`, `credential`, `token`, `secret` in filenames filtered out）

## Design Decision

| Decision | Choice | Alternative | Rationale |
|----------|--------|------------|-----------|
| Git context 位置 | `[AUTO_LOOP_RESUME]` block 之後 | 之前 | State + next step 優先級高於 git context |
| Cap 策略 | `head -20` per command + global 40-line total cap | 無 cap | 防止大 repo 的 context pollution；global cap 確保 `[AUTO_LOOP_RESUME] + [GIT_CONTEXT]` 合計不超過合理 injection size |
| Fail mode | Fail-open（靜默跳過） | Fail-closed | git 不可用不應阻擋 auto-loop resume |
| 條件 | 與 `$NEXT` 相同 | 永遠輸出 | 只在 active loop 時才需要 context 重建 |

## Implementation

在 `hooks/post-compact-auto-loop.sh` 的 `exit 0` 之前加入：

```bash
# Git-as-memory: inject git context for post-compact grounding
# Opt-in gate: only inject if enabled in auto-loop-project.md
GIT_MEMORY_ENABLED=$(grep -q '## Git Memory: enabled' "${CLAUDE_PROJECT_DIR:-.}/rules/auto-loop-project.md" 2>/dev/null && echo "true" || echo "false")

if [[ "$GIT_MEMORY_ENABLED" == "true" && -n "$NEXT" ]]; then
  # Secret-like filename filter (exclude .env, credential, token, secret paths)
  FILTER='grep -v -iE "\.(env|pem|key|secret)|credential|token"'

  GIT_LOG=$(git log --oneline --no-merges -5 2>/dev/null | eval "$FILTER" | head -10) || true
  GIT_DIFF=$(git diff --stat 2>/dev/null | eval "$FILTER" | head -15) || true
  GIT_STATUS=$(git status --short 2>/dev/null | eval "$FILTER" | head -15) || true

  # Global cap: total output <= 40 lines
  GIT_BLOCK=""
  [[ -n "$GIT_LOG" ]] && GIT_BLOCK+="Recent commits:\n${GIT_LOG}\n"
  [[ -n "$GIT_DIFF" ]] && GIT_BLOCK+="Uncommitted changes:\n${GIT_DIFF}\n"
  [[ -n "$GIT_STATUS" ]] && GIT_BLOCK+="Working tree:\n${GIT_STATUS}\n"

  if [[ -n "$GIT_BLOCK" ]]; then
    echo "[GIT_CONTEXT]"
    echo -e "$GIT_BLOCK" | head -40
  fi
fi
```
