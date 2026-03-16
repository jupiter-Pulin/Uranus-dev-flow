# Token Budget — Load PR Review

## Budget Defaults

| Parameter | Default | `--all` | Hard Cap |
|-----------|---------|---------|----------|
| Max loaded threads | 30 | 200 | 200 (post-fetch budget; GraphQL ceiling: 100) |
| Per-comment body | 2000 chars | 2000 chars | 2000 chars |

## Truncation Priority

When total threads exceed budget, select in this order:

1. **Unresolved** before resolved
2. **Not outdated** before outdated
3. **Newest** (`createdAt` DESC) before oldest

## Per-Comment Body Truncation

If a single comment body exceeds 2000 characters:

```
{first 2000 chars}... [truncated]
```

## Summary Metadata

The `summary` object in output tracks truncation state:

```json
{
  "total": 15,
  "unresolved": 8,
  "outdated": 3,
  "loaded": 8,
  "truncated": 7,
  "degraded": false
}
```

| Field | Description |
|-------|-------------|
| `total` | All threads found |
| `unresolved` | Threads with `isResolved === false` |
| `outdated` | Threads with `isOutdated === true` |
| `loaded` | Threads included in output (after budget) |
| `truncated` | `total - loaded` |
| `degraded` | `true` when using REST fallback |

## Verdict Triage Cost

The verdict triage phase (Step 1.5) adds 1 Codex MCP batch call when in plan/fix mode.

| Parameter | Impact |
|-----------|--------|
| Codex calls | +1 (batch, all threads in single call) |
| Per-thread body in prompt | 500 chars (truncated from 2000) |
| Cost scaling | Proportional to loaded thread count |

**Cost optimization**: Use `--no-verdict` to skip the triage phase for budget-sensitive runs or when thread count is large.

| Threads | Recommendation |
|---------|---------------|
| 1-15 | Verdict on (default) |
| 16-30 | Verdict on, but consider `--no-verdict` if cost-sensitive |
| 30+ | Consider `--no-verdict` or reduce `--budget` |
