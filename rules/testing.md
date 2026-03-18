# Testing Rules

## Test Pyramid

| Type | Directory | Mock Policy | When |
|------|-----------|-------------|------|
| Unit | `test/unit/` (or project convention) | ✅ Any | Isolated logic |
| Integration | `test/integration/` (or project convention) | ⚠️ External only | Cross-module |
| E2E | `test/e2e/` (or project convention) | ❌ Forbidden | Full system |

Execution: Integration/E2E defaults to running a single file only; use `/verify` to execute

## Conventions

| Convention | Rule |
|-----------|------|
| Structure | AAA (Arrange → Act → Assert) per test case |
| Naming | `'<unit> <condition> → <expected>'` or `'when <X> then <Y>'` |
| Assertion | `assert/strict` (or ecosystem equivalent); no empty assertions |
| Size | ≤ 7 assertions per test case |
| Data | Realistic inputs; no `"test"`, `"foo"`, `123` without justification |

## Evidence Model

Every non-quality-gate AC must map to evidence.

| Evidence Type | Priority | Requirement |
|--------------|----------|-------------|
| Automated test | 1 (preferred) | Test file + assertion covering AC behavior |
| Runtime verification | 2 | `/feature-verify` result at L3+ confidence |
| Manual exception | 3 (verified only) | See Exception Rules below |

### Exception Rules (v1: 3-gate)

| Gate | Requirement |
|------|-------------|
| Reason class | Closed enum: `ENV_UNAVAILABLE` / `UNSAFE_TO_AUTOMATE` / `ONE_TIME_MIGRATION` |
| Codex verification | `/codex-test-review --ac-trace` must emit `VALID_EXCEPTION` |
| Expiry | Required (ISO 8601); default +14d; expired = ⛔ in strict, ⚠️ in advisory |

| AC Count | Max Exceptions |
|----------|---------------|
| 1-8 (standard) | 1 |
| 9-12 (legacy) | 2 |
| 13+ (should split) | 2 (hard cap) |

| Domain | Exception Allowed? |
|--------|-------------------|
| Security AC | ❌ Never |
| Data-integrity AC | ❌ Never |
| Regression AC | ❌ Never |
| All others | ✅ Within cap |

## Adequacy Gate Sentinels

| Sentinel | Meaning | Parsed by |
|----------|---------|-----------|
| `✅ Adequate` | All ACs covered by evidence | Behavior-layer |
| `⚠️ Adequate with exceptions` | Validated exceptions within cap | Behavior-layer |
| `⚠️ Need Human` | Codex unavailable or inconclusive | Behavior-layer |
| `⛔ Inadequate` | Unverified/expired exception, cap breach, or prohibited domain | Behavior-layer |

## Execution

Pre-PR required: `{LINT_FIX_COMMAND} && {TEST_COMMAND}`
Failure report format: `Command: <cmd> | Error: <cause> | Fix: <fix>`

## Project Customization

Project-specific overrides belong in `testing-project.md` (not this file).
See `@rules/testing-project.md` for your project's custom testing conventions.
