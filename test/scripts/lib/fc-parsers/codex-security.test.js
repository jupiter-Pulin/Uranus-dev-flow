'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parse } = require('../../../../scripts/lib/fc-parsers/codex-security');

const P0_PRESENT = `# Security Review (OWASP Top 10)

## Findings

- [P0] SQL injection in login endpoint
- [P1] Missing CSRF token on transfer API
- [P2] Verbose error message leaks stack
`;

const P2_ONLY = `# Security Review

## Findings

- [P2] Weak password policy
- [Nit] Comment typo
`;

const CLEAN = `# Security Review

## Findings

No findings.
`;

test('codex-security parse: fail when P0 present', () => {
  const r = parse(P0_PRESENT);
  assert.equal(r.name, 'security_review');
  assert.equal(r.provider, '/codex-security');
  assert.equal(r.status, 'fail');
  assert.equal(r.applicable_items, 3);
  assert.match(r.summary, /1 P0/);
  assert.match(r.summary, /1 P1/);
});

test('codex-security parse: partial when only P2/Nit', () => {
  const r = parse(P2_ONLY);
  assert.equal(r.status, 'partial');
  assert.equal(r.applicable_items, 2);
});

test('codex-security parse: pass when no findings', () => {
  const r = parse(CLEAN);
  assert.equal(r.status, 'pass');
  assert.match(r.summary, /no findings/);
});

test('codex-security parse: unverified on empty', () => {
  assert.equal(parse('').status, 'unverified');
  assert.equal(parse('no header').status, 'unverified');
});
