# Close Testing Gaps After Coding

## Use this when

You've finished coding a feature and need to identify and fill testing gaps before the code review gate.

## Core skills

| Skill | Role |
|-------|------|
| `/check-coverage` | Assess Unit / Integration / E2E coverage layers |
| `/test-health` | Holistic test health measurement with trends |
| `/codex-test-gen` | Generate unit tests for specific functions |
| `/post-dev-test` | Write integration and E2E tests |
| `/verify` | Run all tests to confirm they pass |
| `/codex-test-review` | Review test adequacy (mandatory before code review) |

## Command flow

1. `/check-coverage` or `/test-health` — assess current state across Unit / Integration / E2E layers
2. Identify gaps: which functions lack unit tests? Which flows lack integration tests?
3. `/codex-test-gen <function>` — generate unit tests for uncovered functions
4. `/post-dev-test` — write integration or E2E tests for uncovered flows
5. `/verify` — run all tests, fix any failures
6. `/codex-test-review` — mandatory adequacy review; if gaps remain, repeat from step 3

## Decision points

| Situation | Choice |
|-----------|--------|
| Isolated function without tests? | `/codex-test-gen` for unit tests |
| Cross-module flow untested? | `/post-dev-test` for integration tests |
| Test review still finds gaps after generation? | `/codex-test-review --continue` after adding more tests |
| Coverage is good but tests are fragile? | `/simplify` to refactor test code |

## Gates

| Gate | Enforced by | Sentinel |
|------|------------|----------|
| Test adequacy | Behavior | `✅ Tests sufficient` / `⛔ Needs additions` |

## Expected outcome

- Clear picture of test coverage across all layers
- Generated unit tests for uncovered functions
- Integration tests for key flows
- Test adequacy review passed
- Ready for code review (`/codex-review-fast`)

## Related scenarios

- [Implement a new feature](new-feature.md) — the full workflow including test closure
- [Security pre-merge](security-pre-merge.md) — if you also need security validation
