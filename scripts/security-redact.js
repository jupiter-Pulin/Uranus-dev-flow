'use strict';

const crypto = require('crypto');

/**
 * security-redact.js — 2-tier secret redaction utility for post-dev-recap.
 *
 * Tiers:
 *   - high-confidence: well-known token prefixes and PEM private key markers
 *     → throws AbortError (callers stop processing)
 *   - medium-confidence: `password=`, `token:`, `api_key=`, long hex strings
 *     → replaced with `[REDACTED]`
 *
 * Used by: detect-scope.js, /recap-doc, /recap-ask
 * Tech spec: docs/features/post-dev-recap/2-tech-spec.md §3.4.0
 */

const HIGH_CONFIDENCE_PATTERNS = [
  { name: 'RSA private key', re: /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/ },
  { name: 'AWS access key', re: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: 'OpenAI-style API key', re: /\bsk-[A-Za-z0-9_-]{20,}\b/ },
  { name: 'GitHub PAT', re: /\bghp_[A-Za-z0-9]{36}\b/ },
  { name: 'GitHub fine-grained PAT', re: /\bgithub_pat_[A-Za-z0-9_]{22,}\b/ },
  { name: 'Slack token', re: /\bxox[aboprs]-[A-Za-z0-9-]{10,}\b/ },
  { name: 'Google API key', re: /\bAIza[0-9A-Za-z_-]{35}\b/ },
];

const MEDIUM_CONFIDENCE_PATTERNS = [
  { name: 'password assignment', re: /\b(password|passwd|pwd)\s*[:=]\s*['"]?([^\s'"`]+)['"]?/gi, group: 2 },
  { name: 'token assignment', re: /\b(token|api[_-]?key|secret)\s*[:=]\s*['"]?([^\s'"`]+)['"]?/gi, group: 2 },
  // 40-char hex is excluded (standard git SHA-1 length) to avoid redacting
  // commit SHAs cited in recap evidence. Still catches MD5 (32), SHA-256 (64),
  // and arbitrary longer tokens.
  { name: 'long hex string', re: /\b(?![a-f0-9]{40}\b)[a-f0-9]{32,}\b/gi },
  { name: 'JWT-like', re: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g },
];

class AbortError extends Error {
  constructor(message, pattern) {
    super(message);
    this.name = 'AbortError';
    this.pattern = pattern;
  }
}

/**
 * Scan text for high-confidence secrets. If any found, throw AbortError.
 * Returns the first match info for diagnostics (pattern name + match preview).
 */
function scanHighConfidence(text) {
  if (typeof text !== 'string' || text.length === 0) return null;
  for (const { name, re } of HIGH_CONFIDENCE_PATTERNS) {
    const m = text.match(re);
    if (m) {
      return { name, fingerprint: fingerprint(m[0]) };
    }
  }
  return null;
}

/**
 * Apply medium-confidence redaction. Returns redacted text.
 */
function maskMediumConfidence(text) {
  if (typeof text !== 'string' || text.length === 0) return text;
  let out = text;
  for (const { re, group } of MEDIUM_CONFIDENCE_PATTERNS) {
    out = out.replace(re, (match, ...args) => {
      if (typeof group === 'number') {
        const captured = args[group - 1];
        if (!captured) return match;
        return match.replace(captured, '[REDACTED]');
      }
      return '[REDACTED]';
    });
  }
  return out;
}

/**
 * Full 2-tier redact: abort on high, mask on medium.
 * Callers should wrap in try/catch to handle AbortError.
 *
 * @param {string} text
 * @param {object} [options]
 * @param {boolean} [options.abortOnHigh=true] — if false, mask high-confidence instead of throwing
 * @returns {string}
 */
function redact(text, options = {}) {
  const { abortOnHigh = true } = options;
  if (typeof text !== 'string') return text;

  const high = scanHighConfidence(text);
  if (high) {
    if (abortOnHigh) {
      throw new AbortError(
        `High-confidence secret detected (${high.name}). Refusing to process. Fingerprint: ${high.fingerprint}`,
        high,
      );
    }
    // fallback: mask high-confidence patterns too
    let out = text;
    for (const { re } of HIGH_CONFIDENCE_PATTERNS) {
      out = out.replace(new RegExp(re, 'g'), '[REDACTED]');
    }
    return maskMediumConfidence(out);
  }

  return maskMediumConfidence(text);
}

/**
 * Opaque fingerprint for diagnostics — reveals neither prefix nor suffix of
 * the matched secret, so error logs do not leak partial tokens.
 */
function fingerprint(s) {
  if (!s) return '***';
  const hash = crypto.createHash('sha256').update(String(s)).digest('hex');
  return `sha256:${hash.slice(0, 8)}`;
}

module.exports = {
  redact,
  scanHighConfidence,
  maskMediumConfidence,
  AbortError,
  HIGH_CONFIDENCE_PATTERNS,
  MEDIUM_CONFIDENCE_PATTERNS,
};
