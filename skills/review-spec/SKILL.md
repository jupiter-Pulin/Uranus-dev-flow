---
name: review-spec
description: "Review technical spec documents from completeness, feasibility, risk, and code consistency perspectives."
allowed-tools: Read, Grep, Glob, Bash(git:*), Bash(node:*), Agent
---

# Review Spec

## Trigger

- Keywords: review spec, spec review, tech spec review, review-spec

## When NOT to Use

- Code review (use `/codex-review-fast`)
- Document review (use `/codex-review-doc`)
- Writing a new spec (use `/tech-spec`)

## Agent Dispatch

```
Agent({
  description: "Review technical spec for completeness, feasibility, and risk",
  subagent_type: "tech-spec-reviewer",
  prompt: `Review the following technical spec document.
Follow the review dimensions and output format defined in this skill.`
})
```

## Task

### Document to Review

```
$ARGUMENTS
```

### Review Flow

| Step | Focus |
|------|-------|
| 1 | Read the technical spec |
| 2 | Research related code |
| 3 | Completeness check |
| 4 | Feasibility assessment |
| 5 | Risk review |
| 6 | Code consistency |
| 7 | Test strategy |

## Output

```markdown
# Technical Spec Review Report

**Reviewed Document**: `$ARGUMENTS`

## Review Summary
| Dimension | Rating | Notes |
|-----------|--------|-------|
| Completeness | ⭐⭐⭐⭐☆ | |
| Feasibility | ⭐⭐⭐☆☆ | |
| Risk Assessment | ⭐⭐⭐⭐☆ | |
| Code Consistency | ⭐⭐⭐⭐⭐ | |
| Test Strategy | ⭐⭐⭐☆☆ | |

## Overall Verdict
✅ Approved / ⚠️ Needs revision / ❌ Needs redesign

## Strengths
-

## Issues & Recommendations
### 🔴 Must Fix (Blocker)
### 🟡 Suggested Changes
### 🟢 Optional Improvements
```
