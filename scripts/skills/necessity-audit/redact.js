#!/usr/bin/env node
'use strict';

/**
 * redact.js — necessity-audit output redaction filter (NFR-11).
 *
 * Reuses scripts/security-redact.js for high/medium-confidence patterns,
 * adds audit-specific patterns (full Ethereum addresses, email, long hex).
 *
 * CLI:
 *   node redact.js --input <file> --output <file>
 *
 * Exit codes:
 *   0 = OK (file written, possibly redacted)
 *   2 = high-confidence secret AbortError (emission blocked)
 */

const fs = require('fs');
const { redact: baseRedact, AbortError } = require('../../security-redact');

const AUDIT_PATTERNS = [
  // Full Ethereum address — keep first 6 + last 6
  {
    re: /\b(0x[0-9a-fA-F]{6})[0-9a-fA-F]{28}([0-9a-fA-F]{6})\b/g,
    replace: (_m, start, end) => `${start}...${end}`,
  },
  // Email — mask local part except first char
  {
    re: /\b([A-Za-z0-9])[A-Za-z0-9._%+-]*(@[A-Za-z0-9.-]+\.[A-Za-z]{2,})\b/g,
    replace: (_m, first, domain) => `${first}[REDACTED]${domain}`,
  },
  // Long hex string (>= 32 chars, not tied to 0x prefix) — replace middle
  {
    re: /\b([0-9a-fA-F]{6})[0-9a-fA-F]{20,}([0-9a-fA-F]{6})\b/g,
    replace: (_m, start, end) => `${start}[REDACTED]${end}`,
  },
];

function auditRedact(input) {
  let out = input;
  for (const { re, replace } of AUDIT_PATTERNS) out = out.replace(re, replace);
  return out;
}

function redactAll(input) {
  const stage1 = baseRedact(input);
  return auditRedact(stage1);
}

function argVal(flag) {
  const i = process.argv.indexOf(flag);
  return i > -1 && i + 1 < process.argv.length ? process.argv[i + 1] : null;
}

function main() {
  const inputFile = argVal('--input');
  const outputFile = argVal('--output');
  if (!inputFile || !outputFile) {
    process.stderr.write('Usage: redact.js --input <file> --output <file>\n');
    process.exit(1);
  }

  try {
    const raw = fs.readFileSync(inputFile, 'utf8');
    const redacted = redactAll(raw);
    fs.writeFileSync(outputFile, redacted);
    process.exit(0);
  } catch (err) {
    if (err instanceof AbortError || err.name === 'AbortError') {
      process.stderr.write(`High-confidence secret detected: ${err.message}\n`);
      process.exit(2);
    }
    process.stderr.write(`${err.message}\n`);
    process.exit(1);
  }
}

if (require.main === module) main();

module.exports = { redactAll, auditRedact, AUDIT_PATTERNS };
