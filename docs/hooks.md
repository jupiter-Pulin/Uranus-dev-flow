# Hooks Reference

| Hook | Trigger | Purpose |
|------|---------|---------|
| `namespace-hint` | SessionStart | Inject plugin command namespace guidance into Claude context |
| `post-edit-format` | After Edit/Write | Auto prettier + invalidate review state on edit |
| `post-tool-review-state` | After Bash / MCP tools | Track review state (sentinel routing, supports namespaced commands) |
| `pre-edit-guard` | Before Edit/Write | Prevent editing .env/.git |
| `stop-guard` | Before stop | Block or warn on incomplete reviews + stale-state git check (strict after install, warn in plugin runtime) |
| `post-compact-auto-loop` | After context compact | Re-inject auto-loop rules from state file |

Hooks are safe by default. Use environment variables to customize:

| Variable | Default | Description |
|----------|---------|-------------|
| `STOP_GUARD_MODE` | `strict` (installed) / `warn` (plugin runtime) | `strict` blocks stop on missing review steps; `warn` only warns |
| `HOOK_NO_FORMAT` | (unset) | Set `1` to disable auto-formatting |
| `HOOK_BYPASS` | (unset) | Set `1` to skip all stop-guard checks |
| `HOOK_DEBUG` | (unset) | Set `1` to output debug info |
| `GUARD_EXTRA_PATTERNS` | (unset) | Regex patterns for extra protected paths (e.g. `src/locales/.*\.json$`) |

**Dependencies**: Hooks require `jq`. Auto-format requires `prettier`. Missing dependencies are handled gracefully.
