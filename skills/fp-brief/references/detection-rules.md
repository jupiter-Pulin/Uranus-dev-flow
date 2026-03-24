# Format Auto-Detection Rules

## Detection Strategy

Hybrid approach: path patterns first (fast, high confidence), then content heuristics (slower, medium confidence), then fallback.

**Tie-break**: First match wins (priority order).

## Detection Table

| Priority | Method | Match Pattern | Result | Confidence |
|----------|--------|--------------|--------|------------|
| 1 | Path | `docs/features/*/2-tech-spec.md` | tech-spec | high |
| 2 | Path | `docs/features/*/0-feasibility-study*.md` | feasibility-study | high |
| 3 | Path | `docs/features/*/requests/*.md` | request-doc | high |
| 4 | Content heading | Has `## Technical Solution` or `## Architecture` | tech-spec | medium |
| 5 | Content heading | Has `## Acceptance Criteria` | request-doc | medium |
| 6 | Content heading | Has `## Possible Solutions` or `## Recommendation` | feasibility-study | medium |
| 7 | Fallback | None of the above matched | unknown | low |

## Confidence Behavior

| Confidence | Output Header | Behavior |
|-----------|--------------|----------|
| high | `Format detected: tech-spec (confidence: high)` | Use format-specific extraction template |
| medium | `Format detected: tech-spec (confidence: medium)` | Use format-specific template with generic fallback sections |
| low | `Format detected: unknown (confidence: low)` | Use generic extraction template |

## Format-Specific Extraction Hints

| Format | Root Problem Source | Assumptions Source | Alternatives Source |
|--------|-------------------|-------------------|-------------------|
| tech-spec | §1 Requirement Summary | §2 Design Constraints, §4 Risks | §3 Technical Solution (implicit rejections) |
| feasibility-study | §1 Problem Essence | §2 Constraints | §4 Possible Solutions (explicit comparisons) |
| request-doc | Problem statement, Background | §Acceptance Criteria (implicit assumptions) | §Alternatives (if present) |
| unknown | First `## Problem` or `## Overview` heading | Scan for "assume", "given", "constraint" | Scan for "alternative", "option", "instead" |
