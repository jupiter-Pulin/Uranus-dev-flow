# StatusLine JSON Schema

Claude Code pipes this JSON to your script's stdin on every update.

## Model

| Field | Type | Description |
|-------|------|-------------|
| `model.id` | string | Model identifier, e.g. `claude-opus-4-6` |
| `model.display_name` | string | Display name, e.g. `Opus` |

## Workspace

| Field | Type | Description |
|-------|------|-------------|
| `cwd` | string | Current working directory (alias for `workspace.current_dir`) |
| `workspace.current_dir` | string | Current working directory (preferred over `cwd`) |
| `workspace.project_dir` | string | Directory where Claude Code was launched |

## Context Window

| Field | Type | Description |
|-------|------|-------------|
| `context_window.used_percentage` | number\|null | Pre-calculated context used % |
| `context_window.remaining_percentage` | number\|null | Pre-calculated context remaining % |
| `context_window.context_window_size` | number | Total context window size in tokens (200000 or 1000000) |
| `context_window.total_input_tokens` | number | Cumulative input tokens across the session |
| `context_window.total_output_tokens` | number | Cumulative output tokens across the session |
| `context_window.current_usage` | object\|null | Token counts from the last API call (see sub-fields below) |

### `current_usage` Sub-fields

| Field | Type | Description |
|-------|------|-------------|
| `context_window.current_usage.input_tokens` | number | Input tokens in current context |
| `context_window.current_usage.output_tokens` | number | Output tokens generated |
| `context_window.current_usage.cache_creation_input_tokens` | number | Tokens written to cache |
| `context_window.current_usage.cache_read_input_tokens` | number | Tokens read from cache |

`used_percentage` is calculated from input tokens only: `input_tokens + cache_creation_input_tokens + cache_read_input_tokens`. It does not include `output_tokens`.

## Cost

| Field | Type | Description |
|-------|------|-------------|
| `cost.total_cost_usd` | number | Session cumulative cost (USD) |
| `cost.total_duration_ms` | number | Wall-clock time since session start (ms) |
| `cost.total_api_duration_ms` | number | Total API wait time (ms) |
| `cost.total_lines_added` | number | Lines added this session |
| `cost.total_lines_removed` | number | Lines removed this session |

## Session

| Field | Type | Description |
|-------|------|-------------|
| `session_id` | string | Unique session identifier |
| `version` | string | Claude Code version |
| `transcript_path` | string | Path to conversation transcript file |
| `output_style.name` | string | Current output style name |

## Conditional Fields

These fields are only present under specific conditions.

| Field | Type | Condition | Description |
|-------|------|-----------|-------------|
| `exceeds_200k_tokens` | boolean | Always present | Whether total tokens from last API response exceed 200k |
| `vim.mode` | string | Only when vim mode enabled | `NORMAL` or `INSERT` |
| `agent.name` | string | Only with `--agent` flag or agent settings configured | Name of the running agent |
| `worktree.name` | string | Only during `--worktree` sessions | Active worktree name |
| `worktree.path` | string | Only during `--worktree` sessions | Absolute path to worktree directory |
| `worktree.branch` | string | Only during `--worktree` sessions; absent for hook-based worktrees | Git branch name for the worktree |
| `worktree.original_cwd` | string | Only during `--worktree` sessions | Directory before entering the worktree |
| `worktree.original_branch` | string | Only during `--worktree` sessions; absent for hook-based worktrees | Branch before entering the worktree |

## Rate Limits

These fields are only present for OAuth users (Pro/Max plans). Added in Claude Code 2.1.80.

| Field | Type | Description |
|-------|------|-------------|
| `rate_limits` | object\|undefined | Rate limit usage (only for OAuth users) |
| `rate_limits.five_hour.used_percentage` | number | 5-hour window usage percentage (0-100) |
| `rate_limits.five_hour.resets_at` | string (ISO 8601) | When the 5-hour window resets |
| `rate_limits.seven_day.used_percentage` | number | 7-day window usage percentage (0-100) |
| `rate_limits.seven_day.resets_at` | string (ISO 8601) | When the 7-day window resets |

## Null / Undefined Handling

| Pattern | Fields | jq Guard | Behavior |
|---------|--------|----------|----------|
| `null` before first API call | `context_window.current_usage`, `used_percentage`, `remaining_percentage` | `// empty` | Hide segment until data available |
| Key absent (undefined) | `agent.name`, `worktree.*`, `vim.mode`, `rate_limits.*` | `// empty` | Hide segment when not applicable |
| Zero-value present | `cost.total_cost_usd` | `>= 0.005` threshold | Hide when negligible |

Always use jq fallback for nullable fields: `jq -r '.field // empty'` (hides) or `jq -r '.field // 0'` (defaults).
