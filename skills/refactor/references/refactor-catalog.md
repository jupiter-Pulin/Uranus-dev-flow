# Refactor Catalog

## Safety Tiers

| Tier | Definition | Approval |
|------|-----------|----------|
| safe | No behavioral change possible | Auto-apply |
| side-effect | Could affect behavior if wrong | Apply + verify |
| destructive | Structural change, high risk | User confirmation required |

Default-deny: unknown refactor type maps to `side-effect`.

## v1 Refactor Types (R01-R09)

| ID | Type Name | Target | Safety Tier | Dispatch Skill | Verification |
|----|-----------|--------|-------------|----------------|-------------|
| R01 | Remove dead code | code | safe | `/simplify` | `/verify fast` |
| R02 | Extract duplicates (3+ repeats) | code | safe | `/simplify` | `/verify fast` |
| R03 | Simplify nesting (>3 levels → early return) | code | safe | `/simplify` | `/verify fast` |
| R04 | Rename for clarity | code | side-effect | `/simplify` | `/verify fast` |
| R05 | Extract function/method | code | side-effect | `/simplify` | `/verify fast` |
| R06 | Inline variable | code | safe | `/simplify` | `/verify fast` |
| R07 | Simplify conditionals (guard clause) | code | safe | `/simplify` | `/verify fast` |
| R08 | Remove AI artifacts | doc | safe | `/de-ai-flavor` | `/codex-review-doc` |
| R09 | Condense verbose docs (table/diagram) | doc | safe | `/doc-refactor` | `/codex-review-doc` |

## v2 Future Types (not dispatched in v1)

| ID | Type Name | Target | Safety Tier | Dispatch |
|----|-----------|--------|-------------|----------|
| R10 | Deduplicate config blocks | config | side-effect | v2 |
| R11 | Flatten deep nesting (>4 levels) | config | side-effect | v2 |
| R12 | Modernize shell idioms | shell | side-effect | v2 |
| R13 | Add error handling (`set -euo pipefail`) | shell | side-effect | v2 |
| R14 | Extract test fixtures | test | side-effect | v2 |
| R15 | Remove test duplication | test | safe | v2 |
