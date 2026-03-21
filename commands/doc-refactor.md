---
description: Refactor documents — simplify without losing information, visualize flows with sequenceDiagram.
argument-hint: <file path>
allowed-tools: Read, Grep, Glob, Edit, Agent
---

## Agent Dispatch

Dispatch to the dedicated `doc-refactor` agent:

Agent({
  description: "Refactor document — simplify without losing information",
  subagent_type: "doc-refactor",
  prompt: `Refactor the document at: $ARGUMENTS
Follow the task steps and simplification standards defined in this command.`
})

## Task

For the file specified by `$ARGUMENTS`:

1. **Analyze original content**

   - Count lines
   - Identify core information vs redundancy

2. **Refactor**

   - Long paragraphs -> tables
   - Steps -> sequenceDiagram
   - Duplicates -> single source

3. **Validate**
   - Key information preserved
   - Line count reduced

## Simplification Standards

| File Type      | Target Lines |
| -------------- | ------------ |
| CLAUDE.md      | < 50         |
| rules/\*.md    | < 30         |
| agents/\*.md   | < 50         |
| commands/\*.md | < 40         |

## Output

```markdown
## Refactoring Result

- Original: X lines
- Simplified: Y lines (-Z%)

## Changes

- <summary>
```
