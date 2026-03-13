# Transition Mapping — Event Vocabulary to Jira Transitions

## Event Vocabulary

| Event | Target Status Pattern |
|-------|----------------------|
| `start_work` | In Progress, In Development, Developing |
| `pr_opened` | In Review, Code Review, Review |
| `pr_merged` | Done, Closed, Resolved |

### Regex Patterns

```javascript
const EVENT_PATTERNS = {
  start_work: /in.*(progress|dev)/i,
  pr_opened:  /review/i,
  pr_merged:  /(done|closed|resolved)/i,
};
```

## Resolution Algorithm

```
1. Fetch available transitions: getTransitionsForJiraIssue(cloudId, issueKey)
2. For each transition, match target status name against event regex
3. If 1 match   → use it
4. If 0 matches → error: "No matching transition for event '<event>'. Available: ..."
5. If >1 matches → AskUserQuestion to choose
6. If current status already matches target regex → skip: "Already at <status>"
```

## `--comment` Flag

When `--comment <text>` is provided, call `addCommentToJiraIssue` after successful transition.

## Plan vs Execute

| Mode | Behavior |
|------|----------|
| Plan (default) | Show transition plan (issue, current status, event, target, transition id) |
| Execute (`--execute`) | AskUserQuestion for confirmation, then execute `transitionJiraIssue` |
