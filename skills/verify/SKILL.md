---
name: verify
description: "Verification loop — lint -> typecheck -> unit -> integration -> e2e"
allowed-tools: Bash(node:*), Bash(pnpm:*), Bash(yarn:*), Bash(npm:*), Bash(npx:*), Bash(git:*), Bash(python*:*), Bash(pytest:*), Bash(ruff:*), Bash(mypy:*), Bash(cargo:*), Bash(go:*), Bash(golangci-lint:*), Bash(./gradlew:*), Bash(mvn:*), Bash(bundle:*), Read, Grep, Glob
---

# Verification Loop

## Trigger

- Keywords: verify, run tests, check, lint, typecheck, verification

## When NOT to Use

- Pre-commit gate (use `/precommit` or `/precommit-fast`)
- Test coverage review (use `/codex-test-review`)
- Running a single specific test (run directly)

## Workflow Steps

| Step | Goal | Safety | Skip if Missing |
|------|------|--------|----------------|
| lint | Check code style (read-only) | read-only | yes |
| typecheck | Static type checking (full only) | read-only | yes |
| test-unit | Run unit test suite | read-only | yes |
| test-integration | Run integration tests (full only) | read-only | yes |
| test-e2e | Run end-to-end tests (full only) | read-only | yes |

**Failure behavior**: continue-all (run all steps, report all results)

## Task

### Step 1: Check for runner script

Use Glob to check if `.claude/scripts/verify-runner.js` exists in the project root.

- **Found** → run: `node .claude/scripts/verify-runner.js $ARGUMENTS`
  - If runner succeeds, use its output and skip to the Output section.
  - If runner **fails**, treat as a real verification failure (do not silently fallback).
- **NOT found** → skip to Step 2 (do NOT attempt to run the runner).

### Step 2: Fallback (no runner script)

If the runner was not found in Step 1, detect the project ecosystem to run steps manually.

**Ecosystem detection** (check project root for manifest files):

| Manifest | Ecosystem | Lint | Typecheck | Test |
|----------|-----------|------|-----------|------|
| `package.json` | Node.js | `{pm} lint` | `{pm} typecheck` | `{pm} test:unit` |
| `pyproject.toml` | Python | `ruff check .` | `mypy .` | `pytest` |
| `Cargo.toml` | Rust | `cargo clippy` | _(implicit)_ | `cargo test` |
| `go.mod` | Go | `golangci-lint run` | `go vet ./...` | `go test ./...` |
| `build.gradle` | Java | `./gradlew spotlessCheck` | _(implicit)_ | `./gradlew test` |

For Node.js projects, auto-detect package manager from lockfile.

**`$ARGUMENTS` == "fast"**: lint + unit only

**Otherwise (full)**: lint -> typecheck -> unit -> integration -> e2e

| Step | package.json script | If missing |
|------|---------------------|------------|
| lint | `lint` | Skip with note |
| typecheck | `typecheck` | Skip with note |
| unit | `test:unit`, fallback to `test` | Skip with note |
| integration | `test:integration` | Skip (requires explicit path) |
| e2e | `test:e2e` | Skip (requires explicit path) |

### Graceful Skip Rules

| Scenario | Behavior |
|----------|----------|
| No `lint` script | Skip, log "no lint script — skipped" |
| No `typecheck` script | Skip, log "no typecheck script — skipped" |
| No `test:unit` or `test` script | Skip, log "no test script — skipped" |
| No `package.json` | Report error, cannot run checks |

## Output

For **fast** mode:

```markdown
## Verify (fast)

| Step | Status | Notes |
|------|--------|-------|
| lint | ✅/❌/⏭️ | |
| unit | ✅/❌/⏭️ | |

## Overall: ✅ PASS / ❌ FAIL
```

For **full** mode:

```markdown
## Verify (full)

| Step | Status | Notes |
|------|--------|-------|
| lint | ✅/❌/⏭️ | |
| typecheck | ✅/❌/⏭️ | |
| unit | ✅/❌/⏭️ | |
| integration | ✅/❌/⏭️ | skipped unless path specified |
| e2e | ✅/❌/⏭️ | skipped unless path specified |

## Failures (if any)

- Root cause: <first error>
- Fix: <suggestion>

## Overall: ✅ PASS / ❌ FAIL
```
