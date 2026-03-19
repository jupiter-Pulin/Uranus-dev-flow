---
description: Jira integration — view issues, generate branches, create tickets, transition status via event vocabulary
argument-hint: <subcommand> <key-or-project> [--summary "..."] [--type <type>] [--description "..."] [--event <event>] [--execute] [--comment <text>]
allowed-tools: mcp__claude_ai_Atlassian__getAccessibleAtlassianResources, mcp__claude_ai_Atlassian__getJiraIssue, mcp__claude_ai_Atlassian__getTransitionsForJiraIssue, mcp__claude_ai_Atlassian__transitionJiraIssue, mcp__claude_ai_Atlassian__addCommentToJiraIssue, mcp__claude_ai_Atlassian__searchJiraIssuesUsingJql, mcp__claude_ai_Atlassian__createJiraIssue, mcp__claude_ai_Atlassian__getJiraProjectIssueTypesMetadata, Bash(git:*), AskUserQuestion
---

**Must read and follow the skill below before executing this command:**

@skills/jira/SKILL.md
@skills/jira/references/branch-policy.md
@skills/jira/references/transition-mapping.md
@skills/jira/references/create-policy.md

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
| `create` | `/jira create <project> --summary "..." --type <type> [--description "..."] [--execute]` | Create new issue |
| `transition` | `/jira transition <key-or-url> --event <event> [--execute] [--comment <text>]` | Transition issue status |

### Arguments

```
$ARGUMENTS
```

### Execution Flow

1. Parse input → extract issueKey or projectKey (depending on subcommand)
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

# Create issue (plan mode)
/jira create OK --summary "Fix timeout" --type Bug

# Create with description and execute
/jira create OK --summary "Add dashboard" --type Story --description "..." --execute
```
