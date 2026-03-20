---
description: Research current code state then update corresponding docs, ensuring docs stay in sync with code.
argument-hint: [<docs-path | feature-keyword>]
allowed-tools: Read, Write, Edit, Grep, Glob, Bash(ls:*), Bash(git:*), Bash(find:*), Bash(node:*)
---

@skills/tech-spec/references/feature-context-resolution.md

## Auto-Trigger

Auto-triggered after precommit Pass, only when the change maps to a feature under `docs/features/` (see @rules/auto-loop.md Doc Sync Note). Can also be invoked manually.

## Context

- Goal: Update docs based on current code state, ensuring docs stay in sync with implementation.
- Input: Document path (e.g. `docs/features/auth`), feature keyword (e.g. `auth`), or empty (auto-detect)

## Task

### Step 1: Locate Docs and Related Code (5-Level Cascade)

**Key principle: can't find target → `## Gate: ⚠️ Need Human` — don't guess or create new docs.**

Use the shared feature context resolution algorithm (see `@skills/tech-spec/references/feature-context-resolution.md`):

```bash
# Auto-detect feature context (5-level cascade)
node scripts/resolve-feature-cli.js 2>/dev/null || echo '{}'

# If $ARGUMENTS is a docs path (starts with docs/), use path directly — skip resolver
# If $ARGUMENTS is a keyword (no /), use as --feature override
node scripts/resolve-feature-cli.js --feature "<keyword>" 2>/dev/null
```

**Path vs keyword**: If `$ARGUMENTS` starts with `docs/features/`, treat as an explicit docs path (bypass resolver). Otherwise, treat as a feature keyword and pass to `--feature`.

| Confidence | Action |
|------------|--------|
| high/medium | Proceed with detected feature |
| low | Proceed with warning |
| null (not found) | Output `## Gate: ⚠️ Need Human` — do not guess |

### Step 2: Research Current Code State

```bash
# Find changed files for this feature (project-agnostic — no hard-coded src/ paths)
git diff --name-only $(git merge-base HEAD main)..HEAD | head -30

# Search for related code using feature keyword
grep -rl "<keyword>" skills/ commands/ scripts/ --include="*.js" --include="*.sh" --include="*.md" | head -20

# Check recent changes related to the feature
git log --oneline -20 --all -- "skills/<keyword>*" "commands/<keyword>*" "scripts/*<keyword>*"
```

Key research items:

- [ ] Any new scripts / skills / commands added?
- [ ] Any modified logic in existing files?
- [ ] Any new configuration or rules added?
- [ ] Any API or interface changes?

### Step 3: Compare Docs vs Code Differences

| Item       | Doc Description | Current Code | Status         |
| ---------- | --------------- | ------------ | -------------- |
| Service    | ...             | ...          | ✅/⚠️ Outdated |
| API        | ...             | ...          | ✅/⚠️ Outdated |
| Data Model | ...             | ...          | ✅/⚠️ Outdated |
| Flow Chart | ...             | ...          | ✅/⚠️ Outdated |
| Test Paths | ...             | ...          | ✅/⚠️ Outdated |

### Step 4: Update Docs

Update document content based on differences:

1. **Architecture diagrams**: If changed, update Mermaid sequenceDiagram / flowchart
2. **Core service table**: Added/removed/renamed Services
3. **API description**: Added/modified API endpoints
4. **Data model**: Added/modified Entity / Field
5. **Test paths**: Update test file paths

### Step 5: Produce Change Summary

## Output

```markdown
# Document Update Report

## Update Scope

- Document path: $ARGUMENTS
- Research time: <timestamp>

## Research Findings

### Code Changes

| Change Type | File           | Description |
| ----------- | -------------- | ----------- |
| Added       | src/service/.. | ...         |
| Modified    | src/entity/... | New field   |

### Document Differences

| Item       | Before   | After    |
| ---------- | -------- | -------- |
| Service    | A, B     | A, B, C  |
| API        | /v1/...  | /v2/...  |
| Test Paths | test/... | test/... |

## Updated Content

<specific document change diff>

## Suggested Follow-ups

- [ ] <items needing further updates>
```

## Safety Valve

Before doc sync, snapshot the full code diff hash. After doc sync, compare to detect any code change (new files or additional hunks in existing files):

```bash
# Before doc sync: hash the full code diff content (project-agnostic — excludes .md docs)
PRE_HASH=$(git diff -- ':!*.md' ':!docs/' | md5sum | cut -d' ' -f1)

# ... run /update-docs + /create-request --update ...

# After doc sync: compare diff hash
POST_HASH=$(git diff -- ':!*.md' ':!docs/' | md5sum | cut -d' ' -f1)
```

If `PRE_HASH != POST_HASH` (code diff changed during doc sync), return to the review loop (@rules/auto-loop.md). Doc-only changes (`.md`) do not re-trigger the code review loop.

## Usage Examples

```bash
# Update related docs
/update-docs docs/features/auth

# Find and update docs by keyword
/update-docs auth

# Update a specific document
/update-docs docs/features/auth/auth-implementation-architecture.md

# Auto-triggered after precommit Pass (feature-dev workflow)
# Claude auto-detects target via 3-level fallback
```
