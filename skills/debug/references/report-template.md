# Debug Report Template

## Console Output（預設）

```markdown
## Debug Report: <問題標題>

### Classification
- **Type**: <問題分類>
- **Severity**: <嚴重度>

### Probe Journal
<所有 Probe R1-RN 記錄>

### Root Cause
- **What**: <具體缺陷描述>
- **Why**: <根本原因（非表面原因）>
- **Impact**: <影響範圍>
- **Evidence**: <佐證的 probe 結果>
- **Verdict**: <`/seek-verdict` 結果 — ACTIONABLE / UNCERTAIN>

### Fix
- **Change**: <修改內容>
- **Files**: <修改的檔案列表>
- **Verification**: <驗證結果>

### Prevention
- <如何避免同類問題>
```

## Export File（`--export`）

與 console output 相同格式，額外加入 metadata header：

```markdown
---
generated: <YYYY-MM-DDTHH:mm:ssZ>
type: debug-report
feature: <feature-key or "standalone">
---
```

### Export Path Resolution

| Condition | Default Path |
|-----------|-------------|
| Feature context detected | `docs/features/<feature>/debug-report-<YYYY-MM-DD>.md` |
| No feature context | `.debug-report-<YYYY-MM-DD>.md` |
| Explicit path provided | Use as-is |

## Redaction Rules

Export 檔案遵循 `@rules/security.md`：

| Must Redact | Replace With |
|-------------|-------------|
| API keys, tokens | `[REDACTED]` |
| Passwords, secrets | `[REDACTED]` |
| Full credentials | `[REDACTED]` |
| Internal URLs with auth | `[REDACTED_URL]` |

Probe Journal 中的 Command 和 Actual 欄位是最可能包含敏感資料的位置。
