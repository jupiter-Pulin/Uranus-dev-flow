# sd0x-dev-flow Lesson Log

## L1 — Never use context/token limits as excuse to skip auto-loop

- **Context**: After completing rule-override-pattern feature implementation (9 files modified), suggested deferring `/codex-review-doc` to "next session" due to long context
- **Error pattern**: Used "context is very long" as justification to skip mandatory review step, violating auto-loop Prohibited Behaviors
- **Correct approach**: Always invoke the review command in the same reply. If context is genuinely exhausted, attempt anyway — the tool invocation itself may succeed even if the model's internal context is compressed
- **Prevention**: Added explicit prohibition to `rules/auto-loop.md`: "Context/token excuse" is now a named violation. No circumstance (session length, context pressure, token budget) justifies skipping review
- **Source**: 2026-03-17 — rule-override-pattern feature-dev session, auto-loop violation after 9-file implementation
