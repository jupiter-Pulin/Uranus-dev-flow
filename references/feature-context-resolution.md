# Feature Context Resolution

Shared algorithm for resolving "current feature" across document lifecycle skills (`/update-docs`, `/tech-spec`, `/create-request`).

**Canonical implementation**: `scripts/lib/feature-resolver.js`
**CLI**: `node scripts/resolve-feature-cli.js [--feature <key>]`

## Resolution Cascade

Two layers work together: the **behavior layer** (command `.md` files handle `$ARGUMENTS`) and the **code layer** (`feature-resolver.js` handles programmatic detection).

### Behavior Layer (command `.md` responsibility)

| Priority | Signal | Handling |
|----------|--------|----------|
| 0 | `$ARGUMENTS` is a docs path (e.g. `docs/features/auth/`) | Use path directly — bypass resolver |
| 0 | `$ARGUMENTS` is a feature keyword | Pass as `--feature <key>` to resolver |

### Code Layer (feature-resolver.js — 4 programmatic levels)

| Level | Signal | Detection | Confidence |
|-------|--------|-----------|------------|
| 1 | `--feature <key>` | Explicit key parameter | high |
| 2 | Branch name | `git branch --show-current` matches `feat/<key>` | high |
| 3 | Changed paths | `git diff --name-only HEAD` matches `docs/features/<key>/`, `skills/<key>/`, or `commands/<key>.md` | medium |
| 4 | Single feature dir | `ls docs/features/` has exactly 1 directory | low |
| - | Not found | None of the above | null — Gate: Need Human |

**Slug validation**: `/^[a-z0-9][a-z0-9._-]*$/i` — rejects path traversal (`../`, `/`, `.hidden`).

## Shell Equivalent (for `!` context blocks)

```bash
# Get feature context as JSON
node scripts/resolve-feature-cli.js 2>/dev/null || echo '{}'

# With explicit key
node scripts/resolve-feature-cli.js --feature statusline-config
```

**Output schema**:

```json
{
  "key": "statusline-config",
  "source": "branch",
  "confidence": "high",
  "docs_path": "docs/features/statusline-config",
  "has_tech_spec": true,
  "has_requests": true
}
```

## Upsert Decision Table

When a skill resolves a feature context, use filesystem state to decide create vs update:

| Target | Exists? | Action | Confirmation |
|--------|---------|--------|-------------|
| `docs/features/<key>/2-tech-spec.md` | Yes | Update (incremental) | None |
| `docs/features/<key>/2-tech-spec.md` | No | Create from template | None |
| `docs/features/<key>/requests/*.md` (1 active) | Yes | Update that request | None |
| `docs/features/<key>/requests/*.md` (N active) | Yes | AskUserQuestion: which? | Required |
| `docs/features/<key>/requests/*.md` (0 active) | No | Create new request | None |
| `docs/features/<key>/` directory | No | Create directory + target file | Gate confirmation |

**Active request**: Status not in `[Completed, Done, Superseded]`.

## Cross-Link Invariants

When creating or updating documents, enforce bidirectional links:

| When creating... | Must link to... | Link format |
|-----------------|----------------|-------------|
| Request doc | Tech spec (if exists) | `> **Tech Spec**: [Link](../2-tech-spec.md)` |
| Tech spec | Active request(s) | `> **Requests**: [Title](./requests/YYYY-MM-DD-*.md)` |
| Update-docs report | Both | In report summary section |

**Lazy repair**: On any skill invocation, check existing links are valid. Fix broken relative paths silently.

## Ambiguity Handling

| Condition | Action |
|-----------|--------|
| confidence = `high` | Proceed automatically |
| confidence = `medium` | Proceed, note source in output |
| confidence = `low` | Proceed with warning |
| confidence = `null` (not found) | Gate: Need Human — do not guess |
| Multiple active requests for `--update` | AskUserQuestion with numbered list |

## Integration with Existing Workflows

| Workflow | How it uses context |
|----------|-------------------|
| `/feature-dev` doc sync | After precommit pass, auto-detect feature for `/update-docs` + `/create-request --update` |
| `/next-step` | `analyze.js` uses same resolver for doc-sync and request-stale suggestions |
| Auto-loop | Doc sync target detection uses this cascade (replaces ad-hoc 3-level fallback) |
