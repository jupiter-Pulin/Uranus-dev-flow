'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');

const { redactAll, auditRedact, AUDIT_PATTERNS } = require('../../../scripts/skills/necessity-audit/redact');

const repoRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const scriptPath = path.join(repoRoot, 'scripts/skills/necessity-audit/redact.js');

function runRedact(input) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'redact-'));
  const inFile = path.join(tmpDir, 'in.md');
  const outFile = path.join(tmpDir, 'out.md');
  fs.writeFileSync(inFile, input);
  let code = 0;
  let stderr = '';
  try {
    execFileSync('node', [scriptPath, '--input', inFile, '--output', outFile], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (err) {
    code = err.status || 1;
    stderr = err.stderr?.toString() || '';
  }
  const out = code === 2 ? '' : fs.readFileSync(outFile, 'utf8');
  fs.rmSync(tmpDir, { recursive: true, force: true });
  return { code, out, stderr };
}

test('auditRedact — full Ethereum address keeps first 6 + last 6 hex', () => {
  const addr = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEB1';
  const redacted = auditRedact(`User address: ${addr} here`);
  assert.ok(!redacted.includes(addr));
  assert.match(redacted, /0x742d.*0bEB1/);
});

test('auditRedact — email local part masked', () => {
  const raw = 'Contact us at john.doe@example.com for support.';
  const redacted = auditRedact(raw);
  assert.ok(!redacted.includes('john.doe@example.com'));
  assert.match(redacted, /j\[REDACTED\]@example\.com/);
});

test('auditRedact — long hex string middle masked', () => {
  const hash = 'abcdef' + 'f'.repeat(40) + 'abcdef';
  const raw = `Commit hash: ${hash}`;
  const redacted = auditRedact(raw);
  assert.ok(!redacted.includes('f'.repeat(40)));
  assert.match(redacted, /abcdef\[REDACTED\]abcdef/);
});

test('auditRedact — leaves short hex strings untouched', () => {
  const raw = 'short hash: abc123 and deadbeef';
  const redacted = auditRedact(raw);
  assert.ok(redacted.includes('abc123'));
  assert.ok(redacted.includes('deadbeef'));
});

test('redactAll — AWS access key triggers high-confidence AbortError', () => {
  const raw = 'AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE';
  assert.throws(() => redactAll(raw), /AWS access key/);
});

test('redactAll — combination of email + address + plain text', () => {
  const raw = 'Contact alice@example.com at 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEB1 for question';
  const redacted = redactAll(raw);
  assert.ok(!redacted.includes('alice@example.com'));
  assert.ok(!redacted.includes('0x742d35Cc6634C0532925a3b844Bc9e7595f0bEB1'));
  assert.ok(redacted.includes('for question'));
});

test('AUDIT_PATTERNS — non-empty regex list', () => {
  assert.ok(AUDIT_PATTERNS.length >= 3);
  for (const p of AUDIT_PATTERNS) {
    assert.ok(p.re instanceof RegExp);
    assert.ok(typeof p.replace === 'function');
  }
});

test('CLI: redact.js masks secrets in input file', () => {
  const input = 'Email: test@example.com\nClean text.\n';
  const { code, out } = runRedact(input);
  assert.equal(code, 0);
  assert.ok(!out.includes('test@example.com'));
  assert.match(out, /t\[REDACTED\]@example\.com/);
});

test('CLI: redact.js exits 2 on high-confidence secret', () => {
  const input = 'AWS key: AKIAIOSFODNN7EXAMPLE\n';
  const { code, stderr } = runRedact(input);
  assert.equal(code, 2);
  assert.match(stderr, /High-confidence secret/);
});
