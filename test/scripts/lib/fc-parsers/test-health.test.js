'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parse } = require('../../../../scripts/lib/fc-parsers/test-health');

const QUICK_OK = `## Test Health (Quick)

### Quick Verdicts
| Dimension | Status |
|-----------|--------|
| Has tests for changed files | OK |
| Coverage artifact exists | OK |
| Trend direction | OK |
`;

const QUICK_WARN = `## Test Health (Quick)

### Quick Verdicts
| Dimension | Status |
|-----------|--------|
| Has tests for changed files | OK |
| Coverage artifact exists | WARN |
| Trend direction | OK |
`;

const FULL_FAIL = `## Test Health Report (Full)

### Phase D: Aggregate Dashboard

#### Verdicts
| Dimension | Status | Detail |
|-----------|--------|--------|
| Test inventory | WARN | No E2E tests |
| Code coverage | OK | 82.3% lines |
| Feature coverage | OK | 80% features |
| Quality | FAIL | 1 P0 finding |
| Trend | OK | Improving |
| Changed-file coverage | OK | All covered |
`;

test('test-health parse: pass when all verdicts OK', () => {
  const r = parse(QUICK_OK);
  assert.equal(r.name, 'test_coverage');
  assert.equal(r.provider, '/test-health');
  assert.equal(r.status, 'pass');
  assert.equal(r.applicable_items, 3);
});

test('test-health parse: partial when WARN present', () => {
  const r = parse(QUICK_WARN);
  assert.equal(r.status, 'partial');
  assert.match(r.summary, /warn=1/);
});

test('test-health parse: fail when FAIL present', () => {
  const r = parse(FULL_FAIL);
  assert.equal(r.status, 'fail');
  assert.match(r.summary, /fail=1/);
  assert.equal(r.applicable_items, 6);
});

test('test-health parse: unverified on empty', () => {
  assert.equal(parse('').status, 'unverified');
  assert.equal(parse('random text').status, 'unverified');
});
