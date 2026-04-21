'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parse } = require('../../../../scripts/lib/fc-parsers/test-review');

const TABLE_INPUT = `# AC Trace

| AC | Description | Verdict |
|----|-------------|---------|
| AC-1 | first criterion | ADEQUATE |
| AC-2 | second criterion | INADEQUATE |
| AC-3 | third criterion | VALID_EXCEPTION |
`;

const BULLET_INPUT = `## AC Coverage

- AC-1: ADEQUATE — has unit test
- AC-2: ADEQUATE — covered by integration
- AC-3: VALID_EXCEPTION — environment unavailable
`;

const ALL_ADEQUATE = `
| AC-1 | foo | ADEQUATE |
| AC-2 | bar | ADEQUATE |
`;

const FREEFORM = `Overall this looks ADEQUATE but AC-3 is INADEQUATE on regression coverage.`;

test('test-review parse: fail when any INADEQUATE verdict', () => {
  const r = parse(TABLE_INPUT);
  assert.equal(r.name, 'ac_evidence');
  assert.equal(r.provider, '/codex-test-review');
  assert.equal(r.status, 'fail');
  assert.equal(r.applicable_items, 3);
  assert.match(r.summary, /1 adequate/);
  assert.match(r.summary, /1 exception/);
  assert.match(r.summary, /1 inadequate/);
});

test('test-review parse: partial when mix of ADEQUATE + VALID_EXCEPTION', () => {
  const r = parse(BULLET_INPUT);
  assert.equal(r.status, 'partial');
  assert.equal(r.applicable_items, 3);
});

test('test-review parse: pass when all ADEQUATE', () => {
  const r = parse(ALL_ADEQUATE);
  assert.equal(r.status, 'pass');
  assert.equal(r.applicable_items, 2);
});

test('test-review parse: free-form fallback infers status', () => {
  const r = parse(FREEFORM);
  assert.equal(r.status, 'fail');
  assert.match(r.summary, /free-form/);
});

test('test-review parse: unverified on empty input', () => {
  assert.equal(parse('').status, 'unverified');
  assert.equal(parse('no verdicts here').status, 'unverified');
});

// Real Codex AC-trace output format (per skills/test-review/references/codex-prompt-ac-trace.md)
const CODEX_PER_AC_YAML = `- ac_number: 1
  ac_text: Auth returns JWT
  evidence_type: automated_test
  evidence_location: test/auth.test.js:42
  status: COVERED

- ac_number: 2
  ac_text: Migration rollback
  evidence_type: none
  status: UNCOVERED

- ac_number: 3
  ac_text: Env-dependent smoke
  evidence_type: manual_exception
  status: EXCEPTION_VALID

gate: Adequate_with_exceptions
gaps: []
exception_count: 1 / 2
`;

test('test-review parse: recognises COVERED / UNCOVERED / EXCEPTION_VALID tokens', () => {
  const r = parse(CODEX_PER_AC_YAML);
  assert.equal(r.applicable_items, 3);
  const byId = Object.fromEntries(r.per_ac.map(a => [a.id, a.verdict]));
  assert.equal(byId['AC-1'], 'ADEQUATE');
  assert.equal(byId['AC-2'], 'INADEQUATE');
  assert.equal(byId['AC-3'], 'VALID_EXCEPTION');
  assert.equal(r.status, 'fail');
  assert.match(r.summary, /gate=Adequate_with_exceptions/);
});

test('test-review parse: INCONCLUSIVE token lifts status to partial', () => {
  const input = `| AC-1 | foo | COVERED |
| AC-2 | bar | INCONCLUSIVE |`;
  const r = parse(input);
  assert.equal(r.status, 'partial');
});

test('test-review parse: gate-only output with no per-AC rows', () => {
  const r = parse('\n\ngate: Inadequate\n');
  assert.equal(r.status, 'fail');
  assert.equal(r.applicable_items, 0);
  assert.match(r.summary, /gate=Inadequate/);
});

test('test-review parse: EXCEPTION_INVALID token maps to fail', () => {
  const r = parse('- AC-4: EXCEPTION_INVALID — missing expiry');
  assert.equal(r.applicable_items, 1);
  assert.equal(r.status, 'fail');
  assert.equal(r.per_ac[0].verdict, 'INADEQUATE');
});

test('test-review parse: space-form gate sentinel maps to partial (not pass)', () => {
  // rules/testing.md sentinel: "⚠️ Adequate with exceptions" (icon + spaces).
  // The bare word "Adequate" appears inside it but must NOT trick the parser
  // into returning pass.
  const r = parse('\nGate: ⚠️ Adequate with exceptions\n');
  assert.equal(r.status, 'partial');
  assert.match(r.summary, /gate=Adequate with exceptions/);
});

test('test-review parse: Need Human gate variant yields unverified', () => {
  assert.equal(parse('gate: Need Human').status, 'unverified');
  assert.equal(parse('gate: Need_Human').status, 'unverified');
});

test('test-review parse: bare Adequate gate maps to pass (no exceptions present)', () => {
  assert.equal(parse('gate: ✅ Adequate').status, 'pass');
});
