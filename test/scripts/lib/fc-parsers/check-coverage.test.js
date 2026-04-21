'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parse } = require('../../../../scripts/lib/fc-parsers/check-coverage');

const HAPPY = `# Test Coverage Analysis Report

## Current Coverage
| Module | Status |

## Coverage Gaps
### 🔴 Critical
### 🟠 Major
### 🟡 Minor
### ⚪ Nice-to-have
`;

const CRITICAL_GAPS = `# Test Coverage Analysis Report

## Coverage Gaps

### 🔴 Critical
- Missing test for computeFee in src/fee.js
- Missing test for settleTxn in src/settle.js

### 🟠 Major
- Uncovered error path in src/network.js

### 🟡 Minor

### ⚪ Nice-to-have
`;

const MINOR_ONLY = `# Test Coverage Analysis Report

## Coverage Gaps

### 🔴 Critical

### 🟠 Major

### 🟡 Minor
- Missing test for format() utility

### ⚪ Nice-to-have
- Logging util untested
`;

test('check-coverage parse: pass when no gaps', () => {
  const r = parse(HAPPY);
  assert.equal(r.name, 'test_coverage');
  assert.equal(r.provider, '/check-coverage');
  assert.equal(r.status, 'pass');
  assert.equal(r.applicable_items, 0);
  assert.match(r.summary, /no coverage gaps/);
});

test('check-coverage parse: fail when Critical or Major gaps present', () => {
  const r = parse(CRITICAL_GAPS);
  assert.equal(r.status, 'fail');
  assert.equal(r.applicable_items, 3);
  assert.match(r.summary, /2 critical/);
  assert.match(r.summary, /1 major/);
});

test('check-coverage parse: partial when only Minor gaps', () => {
  const r = parse(MINOR_ONLY);
  assert.equal(r.status, 'partial');
  assert.equal(r.applicable_items, 2);
  assert.match(r.summary, /1 minor/);
  assert.match(r.summary, /1 nice-to-have/);
});

test('check-coverage parse: unverified on empty input', () => {
  assert.equal(parse('').status, 'unverified');
  assert.equal(parse(null).status, 'unverified');
  assert.equal(parse('random text without header').status, 'unverified');
});
