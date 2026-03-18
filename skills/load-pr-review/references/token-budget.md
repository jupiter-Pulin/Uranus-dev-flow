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

The verdict triage phase (Step 1.5) invokes `/seek-verdict` **per thread** (each gets an independent Codex call) when in plan/fix mode.

| Parameter | Impact |
|-----------|--------|
| Codex calls | 1 per unresolved thread (independent, parallel where possible) |
| Per-thread comment in finding | 500 chars (truncated from 2000) |
| Cost scaling | Linear: N threads = N Codex calls |

**Cost optimization**: Use `--no-verdict` to skip the triage phase for budget-sensitive runs or when thread count is large.

| Threads | Recommendation |
|---------|---------------|
| 1-5 | Verdict on (default, low cost) |
| 6-15 | Verdict on (default) |
| 16-30 | Verdict on, but warn user about cost; consider `--no-verdict` |
| 30+ | Recommend `--no-verdict` or reduce `--budget` |
