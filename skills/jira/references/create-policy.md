# Create Policy

## Description Format

Always use `contentFormat: "markdown"` when calling `createJiraIssue`. Jira API converts markdown to ADF (Atlassian Document Format) internally.

| Rule | Detail |
|------|--------|
| Format | `contentFormat: "markdown"` (never raw ADF in v1) |
| Newlines | Use actual newline characters, not `\n` literals |
| Headings | `## Heading` supported |
| Lists | `- item` and `1. item` supported |
| Bold/Italic | `**bold**` and `*italic*` supported |
| Code | Inline `` `code` `` and fenced code blocks supported |
| Links | `[text](url)` supported |

## Input Sources

Description content can come from two sources (both supported):

| Source | When |
|--------|------|
| `--description` flag | User provides explicit description text |
| Context inference | Extract from user's prompt — look for structured content (Background, Items, Requirements, etc.) |

When inferring from context, preserve the user's markdown structure. Do not flatten headings or remove formatting.

## Required Fields

| Field | Source | Required |
|-------|--------|----------|
| `projectKey` | First argument (e.g., `OK`) | Yes |
| `summary` | `--summary` flag or context inference | Yes |
| `issueTypeName` | `--type` flag or context inference | Yes |
| `description` | `--description` flag or context inference | No |

## Issue Type Validation

Validate issue type at runtime via `getJiraProjectIssueTypesMetadata(cloudId, projectKey)`:

1. Fetch available types for the project
2. Match user's `--type` value (case-insensitive) against available type names
3. If no match → error with available types list
4. If match → use the exact type name from metadata

Do NOT hardcode an enum — different Jira projects have different type configurations.

## Project Key Extraction

| Input | Extraction |
|-------|------------|
| Bare key: `OK` | Use directly |
| From issue key context: `OK-51513` | Extract prefix before `-` |
| From branch name: `feat/OK-51513-...` | Parse issue key, extract prefix |
