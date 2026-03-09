# {PROJECT_NAME} — Development Rules (sd0x-dev-flow v{VERSION})

## Core Behavioral Requirements

- After editing code, you MUST run precommit checks before finishing
- Fix every issue found — no skipping with "unrelated" or "fix later"
- When reviewing code, independently research the project — do not accept fed conclusions
- Quality workflow: develop -> test -> verify -> precommit

## Available Scripts

| Script | Command | When |
|--------|---------|------|
| Precommit (fast) | `node .sd0x/scripts/precommit-runner.js --mode fast` | Before commit |
| Precommit (full) | `node .sd0x/scripts/precommit-runner.js --mode full` | Before PR |
| Verify | `node .sd0x/scripts/verify-runner.js --mode full` | After changes |

## Test Requirements

- Test command: `{TEST_COMMAND}`
- Required coverage: happy path + error handling + edge cases
- New code must have corresponding tests
- Bug fixes require regression tests

## Development Rules

1. Reference existing code — find similar files first, keep style consistent
2. Author attribution — use developer's GitHub username, never AI names
3. Git branching: `feat/*` | `fix/*` | `docs/*` | `refactor/*` -> main
4. Commit format: `<type>: <subject>` (feat/fix/docs/refactor/test/chore)
5. Do not commit secrets, credentials, or API keys

## Security Minimums

- No MD5/SHA1 for security purposes (use bcrypt/argon2)
- No direct execution of user input (use parameterized queries)
- No logging of private keys, passwords, or tokens
- Validate URLs before fetching (block internal network access)

## Sentinel Vocabulary

These markers appear in precommit output — use them to determine pass/fail:

| Sentinel | Meaning |
|----------|---------|
| `## Overall: ✅ PASS` | All precommit checks passed |
| `## Overall: ❌ FAIL` | One or more checks failed |

## Detailed Rules

For full rule details, see the installed sd0x-dev-flow skills:
- `best-practices` — Industry best practices audit
- `security-review` — OWASP Top 10 security review
- `codex-code-review` — Code review checklist
- `codex-brainstorm` — Adversarial brainstorming
