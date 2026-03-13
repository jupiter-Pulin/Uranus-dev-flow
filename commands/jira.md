---
description: Jira integration — view issues, generate branches from tickets, transition status via event vocabulary
argument-hint: <subcommand> <issue-key-or-url> [--event <event>] [--type <type>] [--execute] [--comment <text>]
allowed-tools: mcp__claude_ai_Atlassian__getAccessibleAtlassianResources, mcp__claude_ai_Atlassian__getJiraIssue, mcp__claude_ai_Atlassian__getTransitionsForJiraIssue, mcp__claude_ai_Atlassian__transitionJiraIssue, mcp__claude_ai_Atlassian__addCommentToJiraIssue, mcp__claude_ai_Atlassian__searchJiraIssuesUsingJql, Bash(git:*), AskUserQuestion
---

**Must read and follow the skill below before executing this command:**

@skills/jira/SKILL.md
@skills/jira/references/branch-policy.md
@skills/jira/references/transition-mapping.md

## Context

- Current branch: !`git branch --show-current`
- Git status: !`git status -sb`

## Task

Follow the `jira` skill workflow based on the subcommand.

### Subcommands

| Subcommand | Usage | Description |
|------------|-------|-------------|
| `view` | `/jira view <key-or-url>` | Display issue details |
| `branch` | `/jira branch <key-or-url> [--type <type>] [--execute]` | Generate branch name from ticket |
| `transition` | `/jira transition <key-or-url> --event <event> [--execute] [--comment <text>]` | Transition issue status |

### Arguments

```
$ARGUMENTS
```

### Execution Flow

1. Parse input → extract issueKey (+ host if URL provided)
2. Resolve cloudId via `getAccessibleAtlassianResources`
3. Execute subcommand (see SKILL.md for detailed steps)
4. Output result (plan mode by default, `--execute` for write operations)

## Examples

```bash
# View issue details
/jira view OK-51513

# View issue from URL
/jira view https://myorg.atlassian.net/browse/OK-51513

# Generate branch name (plan mode)
/jira branch OK-51513

# Generate branch with type override and execute
/jira branch OK-51513 --type fix --execute

# Transition status (plan mode)
/jira transition OK-51513 --event start_work

# Transition with execute and comment
/jira transition OK-51513 --event pr_merged --execute --comment "Merged via PR #42"
```
