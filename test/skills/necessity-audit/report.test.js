'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const { buildMarkdown, compact, DIM_NAMES } = require('../../../scripts/skills/necessity-audit/report');

function makeReport(overrides = {}) {
  return {
    schema_version: 1,
    relative_path: 'docs/features/foo/2-tech-spec.md',
    feature_key: 'foo',
    greenfield: false,
    depth: 'normal',
    preflight: 'advisory',
    banners: [],
    warnings: [],
    dimensions: {
      1: { name: 'Necessity Now', severity: 'Clean', notes: '0 Cut, 0 Review, 2 total' },
      2: { name: 'Abstraction Justification', severity: 'Clean', notes: '0 Cut, 0 Review, 1 total' },
      3: { name: 'Extensibility Speculation', severity: 'Clean', notes: '0 Cut, 0 Review, 0 total' },
      4: { name: 'Configurability Excess', severity: 'Skipped', notes: 'inactive per depth' },
      5: { name: 'Premature Optimization', severity: 'Skipped', notes: 'inactive per depth' },
      6: { name: 'Scope Drift', severity: 'Skipped', notes: 'inactive per depth' },
    },
    elements: [
      { id: 'FR-1', kind: 'requirement', primary_dimension: 1, final: 'Keep', claude: { classification: 'Keep', rationale: 'Core requirement' } },
    ],
    debate: {
      threadId: '019dab42-abcd-1234-efgh-000000000000',
      rounds: 3,
      equilibrium_reached: true,
      conclusion: 'Round 2 concluded with Accept stance on FR-1.',
      skill_invocation: 'codex-brainstorm',
    },
    deterministic_checks: {
      rounds_ok: true,
      has_evidence_citation: true,
      has_explicit_stance: true,
      has_threadId: true,
      equilibrium_required_met: true,
      conclusion_references_rounds: true,
    },
    under_covered_dimensions: [],
    narrative: [],
    gate: '✅ Mergeable',
    suggested_next: [],
    ...overrides,
  };
}

test('buildMarkdown — output starts with ## Document Review header', () => {
  const md = buildMarkdown(makeReport());
  const firstLine = md.split('\n')[0];
  assert.equal(firstLine, '## Document Review', 'hook parser requires exact header');
});

test('buildMarkdown — output ends with gate sentinel (✅ Mergeable or ⛔ Needs revision)', () => {
  const mdReady = buildMarkdown(makeReport({ gate: '✅ Mergeable' }));
  const mdBlocked = buildMarkdown(makeReport({ gate: '⛔ Needs revision' }));
  const tailReady = mdReady.trim().split('\n').pop();
  const tailBlocked = mdBlocked.trim().split('\n').pop();
  assert.equal(tailReady, '✅ Mergeable');
  assert.equal(tailBlocked, '⛔ Needs revision');
});

test('buildMarkdown — ### Gate section appears exactly once just before sentinel', () => {
  const md = buildMarkdown(makeReport());
  const lines = md.split('\n');
  const gateIdx = lines.indexOf('### Gate');
  assert.ok(gateIdx > 0, '### Gate section must exist');
  assert.equal(lines.filter(l => l === '### Gate').length, 1, '### Gate must appear exactly once');
});

test('buildMarkdown — handles unknown final verdict without crash (defensive bucket)', () => {
  const report = makeReport({
    elements: [
      { id: 'FR-X', kind: 'requirement', primary_dimension: 1, final: 'UnknownVerdict', claude: { classification: 'Review', rationale: 'Malformed' } },
    ],
  });
  assert.doesNotThrow(() => buildMarkdown(report), 'must not crash on unexpected final values');
  const md = buildMarkdown(report);
  assert.match(md, /## Document Review/);
});

test('buildMarkdown — includes all 6 deterministic checks', () => {
  const md = buildMarkdown(makeReport());
  assert.match(md, /rounds_ok/);
  assert.match(md, /has_evidence_citation/);
  assert.match(md, /has_explicit_stance/);
  assert.match(md, /has_threadId/);
  assert.match(md, /equilibrium_required_met/);
  assert.match(md, /conclusion_references_rounds/);
});

test('buildMarkdown — renders banners as bold lines and warnings as blockquotes', () => {
  const md = buildMarkdown(makeReport({
    banners: ['[OVERRIDE: feasibility included]', '[PREFLIGHT SKIPPED]'],
    warnings: ['Dirty working tree on target; necessity audit reflects uncommitted state'],
  }));
  assert.match(md, /\*\*\[OVERRIDE: feasibility included\]\*\*/);
  assert.match(md, /\*\*\[PREFLIGHT SKIPPED\]\*\*/);
  assert.match(md, /> Dirty working tree/);
});

test('compact — truncates long text with ellipsis', () => {
  const long = 'x'.repeat(200);
  const result = compact(long, 50);
  assert.equal(result.length, 50);
  assert.ok(result.endsWith('…'));
});

test('compact — empty input returns empty string (no crash)', () => {
  assert.equal(compact(''), '');
  assert.equal(compact(undefined), '');
  assert.equal(compact(null), '');
});

test('DIM_NAMES — covers dimensions 1-6', () => {
  for (let d = 1; d <= 6; d++) {
    assert.ok(DIM_NAMES[d], `dimension ${d} must have a name`);
    assert.ok(typeof DIM_NAMES[d] === 'string');
  }
});
