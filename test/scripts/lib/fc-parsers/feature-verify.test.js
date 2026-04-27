'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parse } = require('../../../../scripts/lib/fc-parsers/feature-verify');

const L1_ONLY = `Feature verify result

Level: L1
Verdict: N/A (no runtime access)
`;

const L3_PASS = `Feature verify result

Level: L3
Integrated Verdict: ✅ PASS
`;

const L4_FAIL = `Feature verify result

Level: L4
Integrated Verdict: ⛔ FAIL — endpoint returned 500
`;

const L2_OBS = `## Feature Verify Report

Level: L2-OBS
Log scan complete.
`;

test('feature-verify parse: partial for L1', () => {
  const r = parse(L1_ONLY);
  assert.equal(r.name, 'runtime_verification');
  assert.equal(r.provider, '/feature-verify');
  assert.equal(r.status, 'partial');
  assert.match(r.summary, /L1/);
});

test('feature-verify parse: pass for L3+ with pass verdict', () => {
  const r = parse(L3_PASS);
  assert.equal(r.status, 'pass');
  assert.match(r.summary, /verdict=pass/);
});

test('feature-verify parse: fail for L3+ with fail verdict', () => {
  const r = parse(L4_FAIL);
  assert.equal(r.status, 'fail');
  assert.match(r.summary, /verdict=fail/);
});

test('feature-verify parse: L2-OBS variant is partial', () => {
  const r = parse(L2_OBS);
  assert.equal(r.status, 'partial');
});

test('feature-verify parse: unverified on empty or no-level', () => {
  assert.equal(parse('').status, 'unverified');
  assert.equal(parse('no level marker').status, 'unverified');
});
