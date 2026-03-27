---
description: Create, update, or scan request documents. Auto-fill template on creation, sync with implementation progress on update, scan all incomplete requests with --status.
argument-hint: [--update <file-path>] [--update-all] [--verify-ac] [--feature <name>] [--status]
allowed-tools: Read, Grep, Glob, Write, Bash, AskUserQuestion, Agent
---

⚠️ **Must read and follow the skill below before executing this command:**

@skills/create-request/SKILL.md
@skills/create-request/references/template.md
@skills/create-request/references/feature-context-resolution.md

## Context

- Git status: !`git status -sb`
- Recent commits: !`git log --oneline -5`
- Existing requests: !`ls docs/features/*/requests/*.md 2>/dev/null | tail -5`

## Task

Determine mode based on $ARGUMENTS:

### Arguments

```
$ARGUMENTS
```

| Parameter          | Description                       |
| ------------------ | --------------------------------- |
| `--status`         | Scan mode: report all incomplete requests |
| `--update-all`     | Batch update: scan all incomplete + git verify + batch edit |
| `--update <path>`  | Update mode: specify request path |
| `--verify-ac`      | Update mode: dispatch Explore agent for AC verification |
| `--feature <name>` | Create mode: specify feature area |
| No parameter       | Auto-determine from context       |

### Mode Detection

```
Has --status        -> Scan Mode
Has --update-all    -> Batch Update Mode
Has --update        -> Update Mode (+ --verify-ac triggers Phase 2.5)
Has --feature       -> Create Mode
Context references request doc -> Update Mode (after confirmation)
Other               -> Create Mode (ask for info)
```

### Scan Mode

Follow the Scan Mode Workflow in the skill:

1. **Discover**: Glob `docs/features/*/requests/*.md`, exclude `archived/`
2. **Parse**: Extract Status, Priority, Created, AC progress from each doc
3. **Filter**: Keep incomplete (Status not in: Completed, Done, Superseded)
4. **Report**: Output grouped markdown report (console-only, no file creation)

### Create Mode

Follow the Create Mode Workflow in the skill:

1. **Gather**: Collect feature, title, priority, requirements
2. **Quick Granularity Check (1.5a)**: AC count + layer keyword scan
3. **Explore**: Search related code + tech spec
4. **Refined Granularity Check (1.5b)**: Layer mixing (Related Files) + scope breadth
5. **Generate**: Fill template + create file(s)
6. **Confirm**: Show result + suggest next steps

### Update Mode

Follow the Update Mode Workflow in the skill:

1. **Load**: Read existing request document
2. **Analyze**: Analyze Related Files + git changes
3. **Verify** (`--verify-ac` only): Dispatch Explore agent for AC verification
4. **Map**: Compare implementation with Acceptance Criteria
5. **Update**: Update Progress / Status / Checkboxes
6. **Report**: Output change summary

## Output

### Create Mode Output

```markdown
## Request Document Created

- Path: `docs/features/{feature}/requests/YYYY-MM-DD-title.md`
- Status: Pending

### Suggested Next Steps

1. `/tech-spec` - Write technical spec
2. `/codex-architect` - Get architecture advice
```

### Update Mode Output

```markdown
## Request Document Update Report

### File

`docs/features/{feature}/requests/YYYY-MM-DD-title.md`

### Change Summary

| Section             | Changes                  |
| ------------------- | ------------------------ |
| Status              | Pending -> In Progress   |
| Progress.Development| ⬜ -> 🔄 In Progress      |
| Progress.Testing    | ⬜ -> 🔄 In Progress      |
| Acceptance Criteria | 2/5 -> 4/5 ✅            |

### Git Activity

- `abc1234` feat: Implement token branch fix
- `def5678` test: Add near-zero denominator test

### Next Steps

- [ ] Complete remaining Acceptance Criteria
- [ ] Run `/codex-review-fast`
- [ ] Run `/precommit`
```

### Scan Mode Output

```markdown
## Request Status Report

> N incomplete / M total (K archived excluded) | Generated: YYYY-MM-DD

### In Progress ({count})

| # | Request | Feature | Priority | Created | AC | Path |
|---|---------|---------|----------|---------|-----|------|
| 1 | {title} | {feature} | P1 | 2026-03-13 | 3/8 | `docs/features/...` |

### Candidate Complete ({count})

| # | Request | Feature | Priority | Created | AC | Path |
|---|---------|---------|----------|---------|-----|------|
| 1 | {title} | {feature} | P2 | 2026-03-20 | 8/8 | `docs/features/...` |

### Pending ({count})

| # | Request | Feature | Priority | Created | AC | Stale | Path |
|---|---------|---------|----------|---------|-----|-------|------|
| 1 | {title} | {feature} | P1 | 2026-02-19 | 0/12 | [stale] | `...` |

### Design / Proposed ({count})

| # | Request | Feature | Priority | Created | AC | Path |
|---|---------|---------|----------|---------|-----|------|

### Summary

| Status | Count | Avg Age (days) |
|--------|-------|---------------|
| In Progress | N | N |
| Candidate Complete | N | N |
| Pending | N | N |
| Design/Proposed | N | N |
| **Total Incomplete** | **N** | **N** |
| Stale (>30d) | N | N |
```

## Examples

```bash
# Create new request (interactive)
/create-request

# Create request for specific feature
/create-request --feature auth

# Scan all incomplete requests
/create-request --status

# Batch update all stale request docs
/create-request --update-all

# Update specific request
/create-request --update docs/features/auth/requests/2026-01-23-fix-login-validation.md

# Auto-update from context (after development)
/create-request --update
```

## Workflow Position

```
Requirements -> /create-request -> /tech-spec -> /feature-dev -> /create-request --update
                     |                                                    ↑
                     |                                              (sync progress)
                     +-- --status --> Request Status Report (read-only)
```
