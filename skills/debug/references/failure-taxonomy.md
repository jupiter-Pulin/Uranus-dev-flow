# Failure Taxonomy

## Problem Types

| Type | Detection Signals | First Probe | Escalation |
|------|------------------|-------------|------------|
| Script Bug | 腳本執行失敗、非預期輸出、exit code != 0 | `grep -n 'exit\|return\|echo' <script>` 靜態分析 → `[WRITE_PROBE]` `bash -x <script>` trace | `/code-explore` |
| API Error | HTTP 錯誤碼、回應格式異常、timeout | `curl -s -o /dev/null -w '%{http_code}'` 直接探測 | `/code-investigate` |
| Config Issue | 環境差異、路徑錯誤、變數未設定 | 列印有效配置 + `env` diff | `/git-investigate` |
| Silent Failure | 表面正常但結果錯誤、欄位缺失、資料不一致 | 追蹤 catch/fallback/default 路徑 | 強制 error surfacing |
| Race Condition | 間歇性失敗、時序相關、並發衝突 | 多次執行 + 時間戳記錄 | `/code-investigate` |
| Dependency Issue | 版本不符、升級後異常、相容性錯誤 | 檢查 lock file + changelog + `npm ls` | `/git-investigate` |

## Classification Decision Tree

```
觀察到的失敗
    │
    ├─ 有 error message / stack trace?
    │   ├─ Yes + 明確指向程式碼 → Script Bug
    │   ├─ Yes + HTTP status code → API Error
    │   └─ Yes + 模糊 / 被吞掉 → Silent Failure
    │
    ├─ 表面正常但結果錯誤?
    │   └─ Silent Failure
    │
    ├─ 時有時無?
    │   └─ Race Condition
    │
    ├─ 環境相關（其他環境正常）?
    │   └─ Config Issue
    │
    └─ 升級 / 更新後才出現?
        └─ Dependency Issue 或 Regression → `/git-investigate`
```

## First Probe Details

### Script Bug

```bash
# Read-only first probe (default)
grep -n 'exit\|return\|echo\|curl\|rm' <script> | head -30
cat <script> | head -100

# [WRITE_PROBE] — may have side effects, requires confirmation
bash -x <script> <args> 2>&1 | tail -50

# Check exit code [WRITE_PROBE]
<script> <args>; echo "EXIT: $?"

# Isolate function [WRITE_PROBE]
bash -c 'source <script>; <function_name> <args>'
```

### API Error

```bash
# Direct endpoint probe
curl -s -w '\n---HTTP_CODE:%{http_code}---' <url>

# With auth
curl -s -H "Authorization: Bearer $TOKEN" <url>

# Compare expected vs actual path
curl -s <correct_path> && curl -s <suspected_path>
```

### Config Issue

```bash
# Print effective config
env | grep -i <keyword> | sort

# Compare with expected
diff <(env | sort) <(cat .env.example | sort)

# Check file existence
test -f <config_path> && echo "exists" || echo "missing"
```

### Silent Failure

```bash
# Force error surfacing — remove fallback temporarily
# Inspect catch/fallback paths in code
grep -n 'catch\|fallback\|default\||| {' <file>

# Check for swallowed errors
grep -n '2>/dev/null\||| true\||| :' <file>

# Direct API/function call bypassing wrapper
<direct_call> 2>&1
```

### Race Condition

```bash
# Multiple runs with timing
for i in $(seq 1 10); do
  echo "Run $i: $(date +%s%N)"
  <command> 2>&1 | tail -1
done

# Check for lock files / PID files
ls /tmp/*lock* /tmp/*pid* 2>/dev/null
```

### Dependency Issue

```bash
# Check installed versions
npm ls <package> 2>/dev/null || pip show <package> 2>/dev/null

# Compare lock file
git diff HEAD -- package-lock.json | head -50

# Check changelog for breaking changes
npm view <package> versions --json | tail -5
```

## Escalation Paths

| From | To | Condition |
|------|----|-----------|
| Any type | `/code-explore` | 需要理解程式碼結構 |
| Any type | `/code-investigate` | 需要雙視角確認 |
| Any type | `/codex-brainstorm` | 多個競爭假設 |
| Script Bug / Config | `/git-investigate` | 疑似 regression |
| Silent Failure | `/seek-verdict` | 根因不確定 |
