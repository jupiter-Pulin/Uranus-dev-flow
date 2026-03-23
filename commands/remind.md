---
description: Lightweight model correction with context-aware rule loading. Detects skipped steps, loads relevant rules, executes corrections immediately.
argument-hint: [<rule-name>] [--all]
allowed-tools: Read, Grep, Glob, Bash(git:*), Bash(cat:*), Bash(jq:*), Bash(bash:*), Skill
---

**Must read and follow the skill below before executing this command:**

@skills/remind/SKILL.md
@skills/remind/references/detection-rules.md

## Context

- Review state: !`cat .claude_review_state.json 2>/dev/null || echo "{}"`
- Git status: !`git status -sb`
- Branch: !`git rev-parse --abbrev-ref HEAD 2>/dev/null`
- Available rules: !`bash -c 'ls rules/*.md 2>/dev/null | sed "s|rules/||;s|\.md||" | paste -sd, -'`

## ⚠️ CRITICAL: This skill EXECUTES corrections, not just reports them

After detecting a violation, you MUST invoke the correction command via Skill tool in this same reply.
Do NOT ask "要執行嗎？" — auto-loop rules mandate immediate execution without permission.
Do NOT output findings and stop — the findings are traceability, not the final output.

## Task

Run model correction based on mode, then **execute the correction**:

### Arguments

```
$ARGUMENTS
```

| Flag | Default | Description |
|------|---------|-------------|
| `<rule>` | — | Specific rule to remind (e.g., `auto-loop`, `git-workflow`) |
| `--all` | false | Load ALL rules + CLAUDE.md (nuclear mode) |
| (no args) | — | Smart detection with context-aware rule loading |

### Mode Detection

```
Has --all        → Nuclear mode: load CLAUDE.md + all rules
Has <rule> arg   → Specific rule mode: load rules/<rule>.md
No args          → Smart detection: state + git → auto-load relevant rules
```

## Examples

```bash
# Smart detection (most common)
/remind

# Specific rule reminder
/remind auto-loop
/remind git-workflow
/remind testing

# Nuclear option (when model keeps drifting)
/remind --all
```
