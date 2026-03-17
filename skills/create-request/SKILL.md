---
name: create-request
description: "Create or update request documents. Use when: planning features, tracking requests, updating progress. Not for: tech specs (use tech-spec), code implementation (use feature-dev). Output: request document with status tracking."
allowed-tools: Read, Grep, Glob, Write, Bash, AskUserQuestion
---

# Create/Update Request Skill

## Trigger

- Keywords: create request, new request, write request, build request, update request, sync progress

## Modes

| Mode     | Trigger Condition             | Action                          |
| -------- | ----------------------------- | ------------------------------- |
| `create` | No file specified / new request | Gather info -> Fill template -> Create file |
| `update` | File specified / update request | Read current state -> Check implementation -> Update progress |

## When NOT to Use

- Viewing request structure (use request-tracking)
- Writing tech spec (use /tech-spec)
- Code development (use feature-dev)

---

## Create Mode Workflow

```
Phase 1: Gather     -> Collect feature, title, priority, requirements
Phase 1.5a: Quick   -> AC count + layer keyword scan (pre-Explore)
Phase 2: Explore    -> Search related code + tech specs
Phase 1.5b: Refined -> Layer mixing (Related Files) + scope breadth + WBS (post-Explore)
Phase 3: Generate   -> Fill template + create file(s)
Phase 4: Confirm    -> Display result + suggest next steps
```

## Phase 1.5: Granularity Check

Assess whether the request should be split into multiple focused tickets. This runs in two passes to balance early detection with accurate analysis.

### Signal Detection

| Signal | Detection | Weight |
|--------|-----------|--------|
| **AC count > 8** | Count `- [ ]` items. Exclude quality-gate ACs matching: `/codex-review-fast`, `/codex-review-doc`, `/codex-review`, `/precommit`, `/precommit-fast`, `/pr-review` | Primary |
| **Layer mixing** | **1.5a**: keyword scan for `rules/`, `hooks/`, `scripts/` in requirements text. **1.5b**: classify Related Files into behavior-layer (`.md` rules/skills/commands) vs code-layer (`.sh`/`.js` hooks/scripts) | Primary |
| **Scope breadth** | Requirements has 3+ functionally independent areas | Primary |
| **WBS groups ≥ 2** | Tech spec has `Work Breakdown` heading with 2+ independent task groups (secondary, high-confidence only) | Secondary (×0.5) |
| **Effort > 3 days** | Tech spec WBS has multiple M/L items | Secondary (×0.5) |

### Decision Logic

```
signal_count = primary_count + 0.5 × secondary_count

< 2  → proceed as single request (no suggestion)
≥ 2  → suggest split (advisory AskUserQuestion)
≥ 3  → strongly recommend split
```

### Split Suggestion

When triggered, use AskUserQuestion:

```
## Granularity Assessment

This request has {N} acceptance criteria (target: ≤8) and {layer_info}.

Suggested split:
1. {Title A} — {scope A} ({AC_count_A} AC)
2. {Title B} — {scope B} ({AC_count_B} AC)

Options:
- "Split into {N} requests" (Recommended)
- "Keep as 1 request"
```

Split by: **layer** (behavior vs code) if detected, then **functional area** if scope breadth detected, then **balanced AC groups** as fallback.

### Sibling Request Output

When user accepts split, create N files: `YYYY-MM-DD-{title-slug}-r{N}.md`. Each gets its own AC subset (target ≤8), scoped Related Files, and conditional `> **Depends On**:` header if dependency exists between siblings.

## Create Mode: Interaction

If incomplete info, ask:

```
1. Feature area: Which feature? (e.g., auth, billing, notifications)
2. Title: Brief description
3. Priority: P0 (urgent) / P1 (high) / P2 (medium)
4. Background: Why is this needed?
5. Requirements: What needs to be done? (list)
6. Acceptance criteria: How do we know it's done?
```

---

## Update Mode Workflow

```
Phase 1: Load      -> Read existing request document
Phase 2: Analyze   -> Analyze Related Files + git changes
Phase 3: Map       -> Compare implementation with Acceptance Criteria
Phase 4: Update    -> Update Progress / Status / Checkboxes
Phase 5: Report    -> Output change summary
```

### Phase 2: Analyze Implementation Progress

```bash
# Get changes for Related Files from request document
git log --oneline --since="<created_date>" -- <related_files>

# Check test status
grep -r "describe\|it\(" test/ --include="*<feature>*"

# Check review status
git log --oneline --grep="codex-review" -- <related_files>
```

### Phase 3: Progress Mapping Rules

| Implementation Status               | Progress Update      |
| ------------------------------------ | -------------------- |
| Related Files have commits           | Development -> In Progress |
| Test files added/modified            | Testing -> In Progress |
| `/codex-review-fast` passed          | Development -> Done  |
| `/precommit` passed                  | Testing -> Done      |
| All Acceptance Criteria checked      | Acceptance -> Done   |

### Phase 4: Auto-Update Items

| Section               | Update Logic                              |
| --------------------- | ----------------------------------------- |
| `Status`              | Pending -> In Development -> Completed    |
| `Progress` table      | Update each phase status based on git changes |
| `Acceptance Criteria` | Check checkboxes based on implementation/test results |
| `Progress.Note`       | Add latest commit message summary         |

### Update Mode: Interaction

If confirmation needed, ask:

```
1. Confirm target request document path
2. Any manually completed items to check off?
3. Any blocked items to mark?
```

## File Naming

**Format**: `YYYY-MM-DD-kebab-case-title.md`

**Location**: `docs/features/{feature}/requests/`

## Output

- Request document at `docs/features/<feature>/requests/YYYY-MM-DD-<title>.md`
- Sections: Background, Requirements, Acceptance Criteria, Priority
- Status: New or Updated

## Verification

- File naming follows convention
- All template sections are filled
- Related file links are correct
- Acceptance criteria use checkboxes

## After Creation

Suggest next steps:

1. `/tech-spec` - Create technical specification
2. `/codex-architect` - Get architecture advice
3. Start implementation

## References

- `references/template.md` - Request template + naming convention

## Related Skills

| Skill              | Purpose                   |
| ------------------ | ------------------------- |
| `request-tracking` | Request structure knowledge base |
| `tech-spec`        | Tech spec writing         |
| `feature-dev`      | Development workflow      |

## Examples

### Create Mode

```
Input: /create-request Feature: Auth Title: Fix validation Priority: P1
Action: Explore related code -> Fill template -> Create file -> Suggest next steps
```

```
Input: Create a request document
Action: Ask for required info -> Explore -> Create -> Confirm
```

### Update Mode

```
Input: /create-request --update docs/features/auth/requests/2026-01-23-fix-login-validation.md
Action: Read request -> Analyze git changes -> Update Progress -> Output summary
```

```
Input: Update request progress
Action: Identify request from context -> Analyze implementation -> Auto-update -> Confirm
```

```
Input: (after development complete) Sync request document
Action:
  1. Read Related Files
  2. git log to check changes
  3. Update: Development unchecked -> done, Testing unchecked -> in progress
  4. Check completed Acceptance Criteria
  5. Status: Pending -> In Development
```
