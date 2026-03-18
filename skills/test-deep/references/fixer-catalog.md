# Fixer Catalog

## Safety Tiers

| Tier | Auto-run? | Confirmation | Scope |
|------|-----------|-------------|-------|
| `safe` | Yes | None | No side effects beyond test artifacts |
| `side-effect` | No | AskUserQuestion | Modifies file system, processes, or external state |
| `destructive` | Blocked | Manual only | Irreversible data loss or state reset |

**Default-deny**: Unknown or unclassified fixer → `side-effect` tier (require confirmation).

## Core Fixers

Plugin-shipped fixers available in all projects:

| Fixer ID | Tier | Description | Auto-run? |
|----------|------|-------------|-----------|
| `retry` | safe | Re-run failing tests | Yes |
| `clear_cache` | safe | Clear build/test cache (`.cache/`, `dist/`, `.turbo/`) | Yes |
| `reinstall_deps` | side-effect | `rm -rf node_modules && npm install` | No, confirm |
| `restart_server` | side-effect | Kill + restart dev server | No, confirm |
| `port_cleanup` | side-effect | Kill process on conflicting port | No, confirm |

## Host Project Extensions

Projects can define domain-specific fixers in `.claude/test-deep/fixers.md`.

### Required Schema

Each fixer must include all required fields:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Unique ID (snake_case) |
| `tier` | enum | Yes | `safe` / `side-effect` / `destructive` |
| `description` | string | Yes | Human-readable description |
| `applies_when` | string | Yes | Trigger condition (classification + error pattern) |
| `action` | string | Yes | Execution instruction for LLM |
| `constraints` | string | No | Limitations (e.g., "testnet only") |

### Example Extension

```markdown
## faucet_fund
- **id**: faucet_fund
- **tier**: side-effect
- **description**: Fund testnet account via faucet API
- **applies_when**: classification=environment, error contains "insufficient" or "balance"
- **action**: Call faucet API to fund account with 1 APT
- **constraints**: testnet only (never mainnet)
```

### Validation Rules

| Rule | On Violation |
|------|-------------|
| Missing `id`, `tier`, `description`, `applies_when`, or `action` | Rejected with warning |
| `tier` not in `safe` / `side-effect` / `destructive` | Rejected with warning |
| Unknown fixer (not in core or extensions) | Default to `side-effect` tier |

## Fixer Execution Flow

```
LLM suggests fixer_id
  → Lookup in core catalog
  → If not found, lookup in host extensions
  → If not found, treat as side-effect (unknown)
  → Check tier
    → safe: auto-execute
    → side-effect: AskUserQuestion → execute on approval
    → destructive: report manual instruction only
  → After execution, re-run failed tests (max 1 retry)
```
