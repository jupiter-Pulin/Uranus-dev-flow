# Security-Focused Pre-Merge Pass

## Use this when

You're about to merge a change and want a thorough security review — especially for code touching auth, user input, external APIs, or dependencies.

## Core skills

| Skill | Role |
|-------|------|
| `/codex-security` | OWASP Top 10 security audit via Codex |
| `/dep-audit` | Dependency vulnerability scan |
| `/risk-assess` | Blast radius and breaking change analysis |
| `/pre-pr-audit` | 5-dimension confidence scoring before PR |

## Command flow

1. `/codex-security` — OWASP Top 10 review: injection, auth bypass, data leaks, SSRF, etc.
2. `/dep-audit` — scan dependencies for known vulnerabilities (`npm audit` / equivalent)
3. `/risk-assess` — assess blast radius, breaking changes, and scope metrics
4. Fix any findings from steps 1-3
5. `/pre-pr-audit` — final 5-dimension confidence score (code quality, test coverage, security, risk, documentation)
6. If confidence is high → proceed to PR

## Decision points

| Situation | Choice |
|-----------|--------|
| Security review finds P0/P1? | Fix immediately; `/codex-security --continue` to re-verify |
| Dependency has critical CVE? | Update dependency or document mitigation |
| Blast radius is large? | Consider splitting the change |
| Dev workstation may be compromised? | `/dev-security-audit` for full workstation scan |

## Gates

| Gate | Enforced by | Sentinel |
|------|------------|----------|
| Security review | Behavior | `✅ Mergeable` / `⛔ Must fix` |
| Dependency audit | Behavior | `✅ PASS` / `❌ FAIL` |
| Pre-PR audit | Behavior | `✅ PR-Ready` / `⚠️ PR-Caution` / `⛔ PR-Blocked` |

## Expected outcome

- OWASP Top 10 review passed
- No known dependency vulnerabilities (or documented exceptions)
- Risk assessment with clear blast radius understanding
- Confidence score above threshold
- Ready to create PR with security assurance

## Related scenarios

- [Implement a new feature](new-feature.md) — the development flow before security review
- [Finish and ship a change](ship-change.md) — the merge flow after security passes
