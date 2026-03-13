---
name: jira
description: "Jira integration — view issues, generate branches, transition status. Use when: user mentions Jira ticket key (XX-123), says /jira, wants to create branch from ticket, or update Jira status. Not for: GitHub issues (use issue-analyze), creating new Jira tickets (v2)."
allowed-tools: mcp__claude_ai_Atlassian__getAccessibleAtlassianResources, mcp__claude_ai_Atlassian__getJiraIssue, mcp__claude_ai_Atlassian__getTransitionsForJiraIssue, mcp__claude_ai_Atlassian__transitionJiraIssue, mcp__claude_ai_Atlassian__addCommentToJiraIssue, mcp__claude_ai_Atlassian__searchJiraIssuesUsingJql, Bash(git:*), AskUserQuestion
---

# Jira Skill

View Jira issues, generate branch names from tickets, transition issue status — all via Atlassian MCP.

## Trigger

- Keywords: jira, ticket, issue key (`[A-Z][A-Z0-9]+-\d+`), branch from ticket, transition status, start work, pr opened, pr merged
- User says `/jira`

## When NOT to Use

- GitHub Issues → use `/issue-analyze`
- Creating new Jira tickets → v2 (deferred)
- Searching Jira issues → v1.1 (deferred)
- Generic project management

## Input Parsing

Extract `issueKey` and optional `host` from user input:

| Input Format | Example | Extraction |
|-------------|---------|------------|
| Bare key | `OK-51513` | key=`OK-51513` |
| Full URL | `https://foo.atlassian.net/browse/OK-51513` | key=`OK-51513`, host=`foo.atlassian.net` |
| Software URL | `https://foo.atlassian.net/jira/software/.../OK-51513` | key=`OK-51513`, host=`foo.atlassian.net` |
| Branch context | (auto from `git branch --show-current`) | key via `{TICKET_PATTERN}` regex |

**Regex**:
- Issue key: `([A-Z][A-Z0-9]+-\d+)`
- Host: `https?://([^/]+\.atlassian\.net)`

## CloudId Resolution

```
1. Call getAccessibleAtlassianResources()
2. 0 results → error: "Atlassian MCP not configured or unauthorized"
3. 1 result  → use its cloudId automatically
4. N results →
     Host provided and matches?    → use matching cloudId
     Host provided but no match?   → warn: "Host '<host>' not found. Available: ..." → AskUserQuestion to select or abort
     No host?                      → AskUserQuestion to choose instance
```

Do NOT persist cloudId. Resolve at runtime each time; Claude context naturally caches within a session.

## Subcommand: `view`

| Step | Action |
|------|--------|
| 1 | Parse input → issueKey (+ host if URL) |
| 2 | Resolve cloudId |
| 3 | `getJiraIssue(cloudId, issueKey)` |
| 4 | Format output |

**Output format**:

```markdown
## KEY: Summary

| Field | Value |
|-------|-------|
| Status | ... |
| Assignee | ... |
| Priority | ... |
| Type | ... |
| Created | ... |

### Description
(first 500 chars, truncated if longer)
```

## Subcommand: `branch`

| Step | Action |
|------|--------|
| 1 | Parse input → issueKey |
| 2 | Resolve cloudId |
| 3 | `getJiraIssue` → get summary + issuetype |
| 4 | Map issue type → branch prefix (see `references/branch-policy.md`) |
| 5 | Apply `--type` override if provided |
| 6 | Generate slug from summary |
| 7 | Assemble branch name: `${prefix}/${issueKey}-${slug}` |
| 8 | Check collision (local + remote) |
| 9 | Plan mode: output branch name + command. Execute mode: run `git checkout -b` |

See `references/branch-policy.md` for full mapping table, slug algorithm, and collision detection.

**Plan output** (default):

```
Branch: feat/OK-51513-add-user-profile-page
From: OK-51513 "Add user profile page" (Story)

To create: git checkout -b feat/OK-51513-add-user-profile-page
```

**Execute mode** (`--execute`): run `git checkout -b <branch>` directly.

## Subcommand: `transition`

| Step | Action |
|------|--------|
| 1 | Parse input → issueKey + `--event` value |
| 2 | Resolve cloudId |
| 3 | `getJiraIssue` → current status |
| 4 | `getTransitionsForJiraIssue` → available transitions |
| 5 | Match event → target transition (see `references/transition-mapping.md`) |
| 6 | Plan mode: show plan. Execute mode: AskUserQuestion → `transitionJiraIssue` |

See `references/transition-mapping.md` for event vocabulary, regex patterns, and resolution algorithm.

**Plan output** (default):

```markdown
## Transition Plan

- Issue: OK-51513 "Add user profile page"
- Current: To Do
- Event: start_work
- Target: In Progress (transition id: 21)

Execute? /jira transition OK-51513 --event start_work --execute
```

## Graceful Degradation

| Failure | Message |
|---------|---------|
| MCP tools not available | "Atlassian MCP not connected. Enable Atlassian integration in claude.ai settings." |
| OAuth expired | "Atlassian authorization expired. Please re-authorize." |
| Issue not found | "Issue `<KEY>` not found. Verify the key and your access permissions." |
| Transition not available | "Cannot execute `<event>` from current status `<status>`. Available transitions: ..." |
| Network error | "Atlassian API unreachable. Please retry later." |

## Examples

```
/jira view OK-51513
→ Displays issue details (summary, status, assignee, priority, type, description)

/jira branch OK-51513
→ Plan: feat/OK-51513-add-user-profile-page

/jira branch OK-51513 --type fix --execute
→ Executes: git checkout -b fix/OK-51513-add-user-profile-page

/jira transition OK-51513 --event start_work
→ Plan: To Do → In Progress

/jira transition OK-51513 --event pr_merged --execute --comment "Merged via PR #42"
→ Executes transition + adds comment
```
