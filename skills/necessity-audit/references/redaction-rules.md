# Redaction rules — NFR-11 pre-emit filter

## Purpose

Before emitting the Markdown/JSON report (or any artifact Codex returns), scan for secrets and sensitive strings. Reuse `scripts/security-redact.js` for high-confidence patterns; `scripts/skills/necessity-audit/redact.js` adds audit-domain patterns.

## Pipeline

| Step | Source | Action on match |
|------|--------|----------------|
| 1 | `scripts/security-redact.js::HIGH_CONFIDENCE_PATTERNS` | Abort with `AbortError` (exit code 2), never emit |
| 2 | `scripts/security-redact.js::MEDIUM_CONFIDENCE_PATTERNS` | Replace with `[REDACTED]` token |
| 3 | `redact.js::AUDIT_PATTERNS` (this skill) | Replace with `[REDACTED]` |

## AUDIT_PATTERNS (skill-specific)

| Pattern | Example | Why mask |
|---------|---------|---------|
| `\\b0x[a-fA-F0-9]{40}\\b` | Ethereum address | Wallet privacy in spec examples |
| `\\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}\\b` | Email | PII in stakeholder lists |
| `\\b0x[a-fA-F0-9]{64,}\\b` | Long hex (≥64) | Private keys, tx hashes, signatures |

High-confidence patterns (AWS keys, Stripe keys, PEM blocks, GitHub tokens, JWT) are enforced upstream by `security-redact.js`.

## CLI

```bash
node scripts/skills/necessity-audit/redact.js --input <report.md> --output <redacted.md>
# exit 0 = clean or medium-only masked
# exit 2 = high-confidence secret detected, refused to emit
```

## Guarantees

- Report never ships with a `AKIA...`, `-----BEGIN ... PRIVATE KEY-----`, or similar unambiguous secret.
- Medium-confidence strings (email, address) are masked but do not block emission.
- Logs emit only the mask ("Redacted 3 matches"), never the secret itself, per `rules/logging.md`.
