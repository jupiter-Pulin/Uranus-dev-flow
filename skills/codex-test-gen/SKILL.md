---
name: codex-test-gen
description: "Generate unit tests for specified functions using Codex MCP"
allowed-tools: mcp__codex__codex, mcp__codex__codex-reply, Read, Grep, Glob, Write
---

# Codex Test Gen

Thin entry-point skill — routes to the parent skill for full workflow.

## Parent Skill

This skill delegates to `test-review` for the underlying Codex MCP infrastructure. The generation-specific prompt template is at `@skills/test-review/references/codex-prompt-test-gen.md`.

See `@skills/test-review/SKILL.md`

## Variant

This is the **Generation** variant — creates new unit tests for specified functions.

## Trigger

- Keywords: generate tests, write tests, create tests, codex-test-gen

## When NOT to Use

- Reviewing existing test coverage (use `/codex-test-review`)
- Code review (use `/codex-review-fast`)
- Writing integration/e2e tests (use `/post-dev-test`)
