'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parse } = require('../../../../scripts/lib/fc-parsers/risk-assess');

const HIGH_RISK = `# Risk Assessment

Risk Level: HIGH

## Top Affected
- scripts/lib/critical.js
- scripts/lib/settle.js
`;

const MEDIUM_RISK = `# Risk Assessment

Risk Level: MEDIUM
`;

const LOW_RISK = `Risk Level: LOW`;

const CRITICAL_RISK = `Risk Level: CRITICAL

## Top Affected
- src/pay/core.ts
- src/pay/settle.ts
- src/pay/refund.ts
`;

test('risk-assess parse: HIGH risk → fail with top_affected', () => {
  const r = parse(HIGH_RISK);
  assert.equal(r.name, 'risk_alignment');
  assert.equal(r.provider, '/risk-assess');
  assert.equal(r.status, 'fail');
  assert.deepEqual(r.top_affected, ['scripts/lib/critical.js', 'scripts/lib/settle.js']);
});

test('risk-assess parse: MEDIUM risk → partial', () => {
  const r = parse(MEDIUM_RISK);
  assert.equal(r.status, 'partial');
  assert.deepEqual(r.top_affected, []);
});

test('risk-assess parse: LOW risk → pass', () => {
  const r = parse(LOW_RISK);
  assert.equal(r.status, 'pass');
});

test('risk-assess parse: CRITICAL treated as fail', () => {
  const r = parse(CRITICAL_RISK);
  assert.equal(r.status, 'fail');
  assert.equal(r.top_affected.length, 3);
});

test('risk-assess parse: unverified on empty or no level', () => {
  assert.equal(parse('').status, 'unverified');
  assert.equal(parse('no risk info').status, 'unverified');
});

// Real `/risk-assess` SKILL.md template uses a markdown table.
const TABLE_LOW = `# Risk Assessment Report

| Metric | Value |
|--------|-------|
| Risk Level | 🟢 LOW |
| Gate | PASS |
`;

const TABLE_HIGH_PLAIN = `| Metric | Value |
|--------|-------|
| Risk Level | HIGH |
`;

const JSON_OUTPUT = `Some preamble text
{"risk_level":"MEDIUM","top_affected":["a.js"]}
`;

test('risk-assess parse: table row with icon → LOW pass', () => {
  const r = parse(TABLE_LOW);
  assert.equal(r.status, 'pass');
});

test('risk-assess parse: table row without icon → HIGH fail', () => {
  const r = parse(TABLE_HIGH_PLAIN);
  assert.equal(r.status, 'fail');
});

test('risk-assess parse: prefers JSON field over free text', () => {
  const r = parse(JSON_OUTPUT);
  assert.equal(r.status, 'partial');
});
