# Test Selection Strategy

## Git Diff Collection

| Context | Git Command | Use Case |
|---------|-------------|----------|
| Unstaged changes | `git diff --name-only` | Working tree vs index |
| Staged changes | `git diff --cached --name-only` | Staged for commit |
| Untracked files | `git ls-files --others --exclude-standard` | New files |
| Branch diff | `git diff --name-only $(git merge-base HEAD main)..HEAD` | `--branch` flag |

**Default**: Union of unstaged + staged + untracked. Branch mode via `--branch` flag.

## Filename Mapping Rules

Collect all matching candidates (deduplicate by path):

| Source File Pattern | Candidate Test Patterns |
|--------------------|-----------------------|
| `src/<path>/<name>.ts` | `test/<path>/<name>.test.ts`, `test/unit/<path>/<name>.test.ts` |
| `src/<path>/<name>.ts` | `test/integration/<path>/<name>.test.ts` |
| `src/<path>/<name>.ts` | `test/e2e/<path>/<name>.e2e.test.ts` |
| `lib/<name>.js` | `test/<name>.test.js`, `test/scripts/lib/<name>.test.js` |
| `scripts/<name>.sh` | `test/scripts/<name>.test.js` |
| `skills/<name>/**` | `test/skills/<name>.test.js` |

**Glob expansion**: For each candidate pattern, run `Glob` to confirm file exists. Only confirmed files enter the test set.

## Layer Classification

Classify confirmed test files by directory prefix:

| Directory Pattern | Layer |
|------------------|-------|
| `test/unit/**`, `test/scripts/lib/**` | unit |
| `test/integration/**` | integration |
| `test/e2e/**` | e2e |
| No match | unit (default) |

## Full Suite Escalation

Escalate to full suite when any condition matches:

| Condition | Detection |
|-----------|-----------|
| Config file changed | `*.config.*`, `tsconfig.*`, `.env*` in diff |
| CI/CD file changed | `.github/`, `Dockerfile` in diff |
| Package dependency changed | `package.json`, `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml` in diff |
| No test files mapped | Glob expansion returns empty for all candidates |
| `--all` flag | User explicitly requested |

## Framework Native Fallback

When primary mapping yields few results, attempt framework-native changed-file detection:

| Framework | Flag | Detection |
|-----------|------|-----------|
| Jest | `--changedSince=HEAD~1` | `package.json` has `jest` dependency |
| Vitest | `--changed HEAD~1` | `package.json` has `vitest` dependency |
| node:test | N/A (no native support) | `package.json` scripts use `node --test` |
