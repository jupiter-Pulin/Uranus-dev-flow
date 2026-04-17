'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  redact,
  scanHighConfidence,
  maskMediumConfidence,
  AbortError,
} = require('../../scripts/security-redact');

// ---------------------------------------------------------------------------
// High-confidence: abort path
// ---------------------------------------------------------------------------

test('redact throws AbortError on RSA private key header', () => {
  const input = 'config line\n-----BEGIN RSA PRIVATE KEY-----\nabc\n-----END RSA PRIVATE KEY-----';
  assert.throws(() => redact(input), AbortError);
});

test('redact throws AbortError on AWS access key', () => {
  const input = 'export AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE';
  assert.throws(() => redact(input), AbortError);
});

test('redact throws AbortError on OpenAI-style sk- token', () => {
  const input = 'const key = "sk-proj-abcdef1234567890ghijklmn"';
  assert.throws(() => redact(input), AbortError);
});

test('redact throws AbortError on GitHub PAT', () => {
  const input = 'token: ghp_aBcDeFgHiJkLmNoPqRsTuVwXyZ0123456789';
  assert.throws(() => redact(input), AbortError);
});

test('redact throws AbortError on GitHub fine-grained PAT', () => {
  const input = 'GH_TOKEN=github_pat_11ABCDEFG1234567890abcdef';
  assert.throws(() => redact(input), AbortError);
});

test('redact throws AbortError on Google API key', () => {
  const input = 'GOOGLE_API_KEY=AIzaSyAbCdEfGhIjKlMnOpQrStUvWxYz0123456';
  assert.throws(() => redact(input), AbortError);
});

test('abort error includes pattern name for diagnostics', () => {
  try {
    redact('-----BEGIN PRIVATE KEY-----\nXXX\n-----END PRIVATE KEY-----');
    assert.fail('should have thrown');
  } catch (err) {
    assert.equal(err.name, 'AbortError');
    assert.match(err.message, /High-confidence secret detected/);
    assert.ok(err.pattern);
    assert.equal(err.pattern.name, 'RSA private key');
  }
});

// ---------------------------------------------------------------------------
// Medium-confidence: mask path
// ---------------------------------------------------------------------------

test('redact masks password assignment with [REDACTED]', () => {
  const input = 'password=hunter2';
  const out = redact(input);
  assert.equal(out, 'password=[REDACTED]');
});

test('redact masks token assignment preserving surrounding format', () => {
  const input = 'token: "abc123def456"';
  const out = redact(input);
  assert.match(out, /\[REDACTED\]/);
  assert.doesNotMatch(out, /abc123def456/);
});

test('redact masks long hex strings (>=32 chars)', () => {
  const input = 'sha: a1b2c3d4e5f67890a1b2c3d4e5f67890';
  const out = redact(input);
  assert.match(out, /\[REDACTED\]/);
  assert.doesNotMatch(out, /a1b2c3d4e5f67890a1b2c3d4e5f67890/);
});

test('redact masks JWT-like strings', () => {
  const input = 'Authorization: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abcdefghij';
  const out = redact(input);
  assert.match(out, /\[REDACTED\]/);
});

test('redact preserves non-secret content intact', () => {
  const input = 'function foo() { return 42; }';
  const out = redact(input);
  assert.equal(out, input);
});

test('redact handles empty input gracefully', () => {
  assert.equal(redact(''), '');
  assert.equal(redact(null), null);
  assert.equal(redact(undefined), undefined);
});

// ---------------------------------------------------------------------------
// Component helpers
// ---------------------------------------------------------------------------

test('scanHighConfidence returns null when no match', () => {
  assert.equal(scanHighConfidence('hello world'), null);
});

test('scanHighConfidence returns name + opaque fingerprint on match', () => {
  const hit = scanHighConfidence('AKIAIOSFODNN7EXAMPLE');
  assert.ok(hit);
  assert.equal(hit.name, 'AWS access key');
  assert.match(hit.fingerprint, /^sha256:[a-f0-9]{8}$/);
  // Fingerprint must not reveal the actual secret
  assert.doesNotMatch(hit.fingerprint, /AKIA/);
});

test('abort error message does not leak secret prefix or suffix', () => {
  try {
    redact('AKIAIOSFODNN7EXAMPLE');
    assert.fail('should have thrown');
  } catch (err) {
    assert.doesNotMatch(err.message, /AKIA/, 'message must not include secret prefix');
    assert.doesNotMatch(err.message, /EXAMPLE/, 'message must not include secret suffix');
    assert.match(err.message, /sha256:/, 'message should include opaque fingerprint');
  }
});

test('maskMediumConfidence does not throw on high-confidence patterns', () => {
  // mask path should never throw — only redact() does
  const input = 'AKIAIOSFODNN7EXAMPLE';
  const out = maskMediumConfidence(input);
  assert.equal(typeof out, 'string');
});

// ---------------------------------------------------------------------------
// Fallback mode: abortOnHigh=false
// ---------------------------------------------------------------------------

test('redact with abortOnHigh=false masks high-confidence instead of throwing', () => {
  const input = 'AKIAIOSFODNN7EXAMPLE and hunter2 password=secret';
  const out = redact(input, { abortOnHigh: false });
  assert.match(out, /\[REDACTED\]/);
  assert.doesNotMatch(out, /AKIAIOSFODNN7EXAMPLE/);
});

// ---------------------------------------------------------------------------
// Additional pattern coverage
// ---------------------------------------------------------------------------

test('redact throws AbortError on Slack xoxb- token', () => {
  const input = 'SLACK_BOT_TOKEN=xoxb-123456789-abcdefghijk';
  assert.throws(() => redact(input), AbortError);
});

test('hex boundary: 31 chars does not redact, 32 chars redacts', () => {
  const hex31 = 'a'.repeat(31);
  const hex32 = 'a'.repeat(32);
  assert.equal(redact(hex31), hex31, '31-char hex should pass through');
  const out = redact(hex32);
  assert.match(out, /\[REDACTED\]/, '32-char hex should redact');
});

test('40-char hex (git SHA-1) is preserved — not mistaken for a secret', () => {
  const gitSha = 'a1b2c3d4e5f67890a1b2c3d4e5f67890a1b2c3d4';
  assert.equal(gitSha.length, 40);
  const input = `Commit ${gitSha} deployed at 10:00`;
  assert.equal(redact(input), input, '40-char git SHA must survive redaction');
});

test('64-char hex (SHA-256) still redacted — not exempted', () => {
  const sha256Hex = 'a'.repeat(64);
  const out = redact(`digest=${sha256Hex}`);
  assert.match(out, /\[REDACTED\]/, '64-char hex should redact');
});
