# Triage Pipeline

## Step 1: Output Parser

Extract structured tags from test runner output. Parser does **not** classify — it only structures.

### Tag Schema

| Tag | Type | Source | Example |
|-----|------|--------|---------|
| `exit_code` | number | Process exit code | `1` |
| `error_signatures[]` | string[] | Regex on stderr/stdout | `ECONNREFUSED`, `TypeError` |
| `failing_tests[]` | string[] | Test name extraction | `estimateFee returns gasLimit >= MIN` |
| `failing_files[]` | string[] | File path extraction | `test/e2e/gas-fee.e2e.test.ts` |
| `env_hints[]` | string[] | Environment clues | `testnet`, `localhost:8545` |
| `stack_depth` | number | Stack trace line count | `15` |

### Error Signature Regex

```
/error|Error|FAIL|fail|TypeError|ReferenceError|ECONNREFUSED|ETIMEDOUT|insufficient|balance|timeout/i
```

### Output Compression

Use patterns from `scripts/lib/utils.js`:

| Technique | Reference | Strategy |
|-----------|-----------|----------|
| Filter PASS lines | `testStdoutFilter()` | Keep only FAIL + summary |
| Tail truncation | `tailLinesFromFile()` | stderr: first 100 + last 50 lines |

## Step 2: Secret Redaction (Mandatory)

Before any output is sent to LLM or written to artifacts, apply redaction per `@rules/logging.md`:

| Pattern | Regex | Replacement |
|---------|-------|-------------|
| API keys | `/[A-Za-z0-9_-]{32,}/` (high entropy) | `[REDACTED_KEY]` |
| Private keys | `/-----BEGIN.*PRIVATE KEY-----/` | `[REDACTED_PRIVATE_KEY]` |
| Tokens | `/((?:Bearer\s+\|token[=:]\s*))[A-Za-z0-9._-]+/i` | `[REDACTED_TOKEN]` |
| Known env vars | `/(API_KEY\|SECRET\|PASSWORD\|PRIVATE_KEY\|MNEMONIC)[=:]\s*\S+/i` | `$1=[REDACTED]` |
| URLs with creds | `/https?:\/\/[^:]+:[^@]+@/` | `[REDACTED_URL]` |

## Step 3: LLM Root Cause Analysis

Feed parser tags + compressed (redacted) output to LLM.

### Prompt Template

```
You are a test failure analyst. Given structured tags and compressed output from a test run, classify the root cause.

## Parser Tags
{tags_json}

## Compressed Output (redacted)
{compressed_output}

## Instructions
1. Classify the root cause into exactly one category
2. Suggest a fixer from the available catalog
3. Explain your reasoning

Output JSON:
{
  "classification": "code_bug | infra | environment | flaky",
  "confidence": 0.0-1.0,
  "root_cause": "brief description",
  "suggested_fixer": "fixer_id or null",
  "reasoning": "explanation"
}
```

### Classification Enum

| Classification | Definition | Typical Action |
|---------------|------------|----------------|
| `code_bug` | Logic error in application code | Fix code directly |
| `infra` | Infrastructure issue (port conflict, missing dep) | Restart / reinstall |
| `environment` | External precondition unmet (balance, API access) | Fixer catalog action |
| `flaky` | Non-deterministic failure (timing, race) | Retry + quarantine tag |

### LLM Output Schema

```json
{
  "classification": "environment",
  "confidence": 0.85,
  "root_cause": "Testnet account balance 0, simulation reports insufficient funds",
  "suggested_fixer": "faucet_fund",
  "reasoning": "Error signature matches insufficient funds, env_hints indicate testnet"
}
```

## Step 4: Safety Gate Decision

Route LLM's `suggested_fixer` through tier-based gate:

| Tier | Action | UI |
|------|--------|-----|
| `safe` | Auto-execute | Log only |
| `side-effect` | Require confirmation | AskUserQuestion |
| `destructive` | Block auto-execution | Manual instruction only |

**Default-deny**: Unknown or unclassified fixer → `side-effect` tier.

**No fixer suggested**: Report triage result, suggest manual investigation.

**Max retries**: 1 fixer attempt per failure. If fixer doesn't resolve, report as unresolved.
