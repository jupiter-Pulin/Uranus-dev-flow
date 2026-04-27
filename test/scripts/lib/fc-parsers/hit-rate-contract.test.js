'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

// AC-3 regression contract (per request doc 2026-04-20-feature-completeness-r1.md):
//   "6 個 fc-parsers/* 各自通過 fixture input → expected output 契約測試；
//    命中率 < 90% 視為 unverified (R2)"
//
// This file pins the lower-bound contract each parser must honour: when the
// sub-skill output format drifts enough that the parser cannot recognise any
// of its structural markers, the parse result must be `unverified` — not a
// spurious pass/fail. A dedicated test at this layer prevents future parser
// refactors from silently downgrading the fallback to pass/fail/partial.
//
// v1 implements the strict subset (0-recognition → unverified). The softer
// "< 90% token recognition → unverified" variant is captured in tech-spec
// §7 R2 and is not yet implemented; this file is the anchor for upgrading
// later without regressing the baseline.

const PARSERS = [
  { name: 'check-coverage', path: '../../../../scripts/lib/fc-parsers/check-coverage' },
  { name: 'test-review', path: '../../../../scripts/lib/fc-parsers/test-review' },
  { name: 'test-health', path: '../../../../scripts/lib/fc-parsers/test-health' },
  { name: 'codex-security', path: '../../../../scripts/lib/fc-parsers/codex-security' },
  { name: 'feature-verify', path: '../../../../scripts/lib/fc-parsers/feature-verify' },
  { name: 'risk-assess', path: '../../../../scripts/lib/fc-parsers/risk-assess' },
];

const MALFORMED_INPUTS = [
  '',
  '   \n\n\t\n  ',
  'this is a plain sentence with zero structural markers',
  '{"unrelated": "shape", "array": [1,2,3]}',
];

for (const p of PARSERS) {
  test(`hit-rate contract: ${p.name} returns unverified on unrecognised input`, () => {
    const { parse } = require(p.path);
    for (const input of MALFORMED_INPUTS) {
      const r = parse(input);
      assert.equal(
        r.status,
        'unverified',
        `${p.name}.parse(${JSON.stringify(input).slice(0, 40)}...) expected status=unverified, got ${r.status}`,
      );
      assert.equal(typeof r.name, 'string');
      assert.equal(typeof r.provider, 'string');
      assert.equal(r.enabled, true);
      assert.ok(typeof r.summary === 'string');
    }
  });
}
