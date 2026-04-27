'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  buildTopic,
  parseDebateResponse,
  classifyEvidenceLocation,
} = require('../../../scripts/skills/necessity-audit/debate-topic');

function makePreflight(overrides = {}) {
  return {
    absPath: '/abs/docs/features/foo/1-requirements.md',
    relPath: 'docs/features/foo/1-requirements.md',
    featureKey: 'foo',
    docKind: 'requirements',
    greenfield: false,
    depth: 'normal',
    activeDimensions: [1, 2, 3, 4, 5, 6],
    ...overrides,
  };
}

test('buildTopic — normal depth includes all 6 dimensions + feature key', () => {
  const topic = buildTopic(makePreflight());
  assert.match(topic, /1\.\s+Necessity Now/);
  assert.match(topic, /6\.\s+Scope Drift/);
  assert.match(topic, /Feature key: foo/);
  assert.match(topic, /any termination accepted/);
});

test('buildTopic — deep depth marks equilibrium REQUIRED', () => {
  const topic = buildTopic(makePreflight({ depth: 'deep' }));
  assert.match(topic, /Nash equilibrium REQUIRED/);
});

test('buildTopic — greenfield uses REASONING-ONLY evidence note', () => {
  const topic = buildTopic(makePreflight({ greenfield: true }));
  assert.match(topic, /\[REASONING-ONLY\]/);
});

test('buildTopic — brief depth filters to dimensions 1-3 only', () => {
  const topic = buildTopic(makePreflight({ activeDimensions: [1, 2, 3] }));
  assert.match(topic, /1\.\s+Necessity Now/);
  assert.match(topic, /3\.\s+Extensibility/);
  assert.doesNotMatch(topic, /4\.\s+Configurability/);
});

test('parseDebateResponse — extracts verdict with file:line evidence + attaches elementId tag', () => {
  const raw = `
[VERDICT: Cut] FR-5 — Unused downstream — Evidence: src/foo.ts:42
## Conclusion
Nash equilibrium reached.
`;
  const parsed = parseDebateResponse(raw);
  assert.equal(parsed.perElementVerdicts.length, 1);
  assert.equal(parsed.perElementVerdicts[0].classification, 'Cut');
  assert.equal(parsed.perElementVerdicts[0].id, 'FR-5');
  assert.equal(parsed.perElementVerdicts[0].evidence, 'src/foo.ts:42');
  assert.equal(parsed.perElementVerdicts[0].evidenceCitation.type, 'file:line');
  assert.equal(parsed.perElementVerdicts[0].evidenceCitation.elementId, 'FR-5');
  assert.equal(parsed.perElementVerdicts[0].evidenceCitation.location, 'src/foo.ts:42');
});

test('parseDebateResponse — em-dash inside rationale does NOT terminate match', () => {
  const raw = `[VERDICT: Cut] FR-9 — feature — which has no consumers — is redundant — Evidence: doc:§3.2`;
  const parsed = parseDebateResponse(raw);
  assert.equal(parsed.perElementVerdicts.length, 1, 'must not silently drop verdict');
  assert.equal(parsed.perElementVerdicts[0].id, 'FR-9');
  assert.equal(parsed.perElementVerdicts[0].classification, 'Cut');
  assert.match(parsed.perElementVerdicts[0].rationale, /which has no consumers/);
  assert.equal(parsed.perElementVerdicts[0].evidence, 'doc:§3.2');
});

test('parseDebateResponse — verdict without Evidence tail still parses', () => {
  const raw = `[VERDICT: Keep] NFR-1 — baseline security requirement`;
  const parsed = parseDebateResponse(raw);
  assert.equal(parsed.perElementVerdicts.length, 1);
  assert.equal(parsed.perElementVerdicts[0].evidence, null);
  assert.equal(parsed.perElementVerdicts[0].evidenceCitation, null);
});

test('parseDebateResponse — equilibrium detection (nash keyword)', () => {
  const raw = '## Conclusion\nReached Nash equilibrium after 3 rounds.';
  const parsed = parseDebateResponse(raw);
  assert.equal(parsed.equilibriumReached, true);
  assert.equal(parsed.rounds, 3);
});

test('parseDebateResponse — threadId extraction', () => {
  const raw = 'threadId: 1234567890abcdef1234567890abcdef';
  const parsed = parseDebateResponse(raw);
  assert.equal(parsed.threadId, '1234567890abcdef1234567890abcdef');
});

test('parseDebateResponse — verdict evidenceCitation pushed into evidenceCitations list', () => {
  const raw = `[VERDICT: Cut] FR-5 — dead — Evidence: src/foo.ts:42`;
  const parsed = parseDebateResponse(raw);
  const tagged = parsed.evidenceCitations.filter(c => c.elementId === 'FR-5');
  assert.equal(tagged.length, 1);
  assert.equal(tagged[0].type, 'file:line');
  assert.equal(tagged[0].location, 'src/foo.ts:42');
});

test('parseDebateResponse — leading whitespace before verdict is tolerated', () => {
  const raw = '    [VERDICT: Cut] FR-5 — indented — Evidence: src/foo.ts:42';
  const parsed = parseDebateResponse(raw);
  assert.equal(parsed.perElementVerdicts.length, 1);
  assert.equal(parsed.perElementVerdicts[0].id, 'FR-5');
});

test('parseDebateResponse — tab-prefixed verdict is tolerated', () => {
  const raw = '\t[VERDICT: Keep] NFR-2 — necessary';
  const parsed = parseDebateResponse(raw);
  assert.equal(parsed.perElementVerdicts.length, 1);
  assert.equal(parsed.perElementVerdicts[0].id, 'NFR-2');
});

test('parseDebateResponse — bullet-list prefix (- * +) is tolerated', () => {
  const raw = [
    '- [VERDICT: Cut] FR-5 — dash bullet',
    '* [VERDICT: Keep] FR-6 — star bullet',
    '+ [VERDICT: Review] FR-7 — plus bullet',
    '1. [VERDICT: Cut] FR-8 — numbered bullet',
  ].join('\n');
  const parsed = parseDebateResponse(raw);
  assert.equal(parsed.perElementVerdicts.length, 4);
  assert.deepEqual(parsed.perElementVerdicts.map(v => v.id), ['FR-5', 'FR-6', 'FR-7', 'FR-8']);
});

test('parseDebateResponse — multi-verdict blob with headers and prose', () => {
  const raw = `
## Per-element verdicts

- [VERDICT: Cut] FR-5 — over-engineered — Evidence: src/foo.ts:42
- [VERDICT: Keep] FR-6 — essential — Evidence: doc:§3.1
- [VERDICT: Review] FR-7 — borderline — this has — em-dashes — Evidence: src/bar.ts:10

## Conclusion
Nash equilibrium reached.
`;
  const parsed = parseDebateResponse(raw);
  assert.equal(parsed.perElementVerdicts.length, 3);
  assert.equal(parsed.perElementVerdicts[2].evidence, 'src/bar.ts:10');
});

test('parseDebateResponse — file:line in verdict Evidence NOT duplicated in global sweep', () => {
  const raw = '[VERDICT: Cut] FR-5 — dead — Evidence: src/foo.ts:42';
  const parsed = parseDebateResponse(raw);
  const fileLine = parsed.evidenceCitations.filter(c => c.type === 'file:line' && c.location === 'src/foo.ts:42');
  assert.equal(fileLine.length, 1, 'evidence must appear exactly once despite being valid file:line in verdict tail');
});

test('parseDebateResponse — prose file:line outside verdicts still captured', () => {
  const raw = `
[VERDICT: Cut] FR-5 — dead — Evidence: src/foo.ts:42

See also src/elsewhere.ts:99 for related context.
`;
  const parsed = parseDebateResponse(raw);
  const locations = parsed.evidenceCitations.map(c => c.location);
  assert.ok(locations.includes('src/foo.ts:42'));
  assert.ok(locations.includes('src/elsewhere.ts:99'));
  const fooCount = locations.filter(l => l === 'src/foo.ts:42').length;
  assert.equal(fooCount, 1, 'verdict-embedded citation not duplicated');
});

test('parseDebateResponse — file:line inside rationale (not Evidence tail) IS captured', () => {
  const raw = '[VERDICT: Cut] FR-5 — see src/x.ts:10 for context — Evidence: src/bar.ts:99';
  const parsed = parseDebateResponse(raw);
  const locations = parsed.evidenceCitations.map(c => c.location);
  assert.ok(locations.includes('src/x.ts:10'), 'rationale-embedded cross-reference must stay visible');
  assert.ok(locations.includes('src/bar.ts:99'));
});

test('parseDebateResponse — literal "Evidence:" in rationale uses LAST occurrence as tail', () => {
  const raw = '[VERDICT: Cut] FR-5 — per Evidence: src/rationale.ts:5 — Evidence: src/tail.ts:99';
  const parsed = parseDebateResponse(raw);
  assert.equal(parsed.perElementVerdicts.length, 1);
  assert.equal(parsed.perElementVerdicts[0].evidence, 'src/tail.ts:99');
  const locations = parsed.evidenceCitations.map(c => c.location);
  assert.ok(locations.includes('src/tail.ts:99'));
  assert.ok(locations.includes('src/rationale.ts:5'), 'rationale-embedded citation must not be suppressed');
});

test('parseDebateResponse — repeated external file:line collapsed by dedup set', () => {
  const raw = `
Mentioned once: src/foo.ts:42
Mentioned again: src/foo.ts:42
`;
  const parsed = parseDebateResponse(raw);
  const fooCount = parsed.evidenceCitations.filter(c => c.location === 'src/foo.ts:42').length;
  assert.equal(fooCount, 1, 'repeated prose citations should dedup by type|location|elementId');
});

test('classifyEvidenceLocation — file:line pattern', () => {
  const c = classifyEvidenceLocation('src/foo.ts:42');
  assert.equal(c.type, 'file:line');
  assert.equal(c.location, 'src/foo.ts:42');
});

test('classifyEvidenceLocation — file:line-range pattern', () => {
  const c = classifyEvidenceLocation('src/foo.ts:42-50');
  assert.equal(c.type, 'file:line');
  assert.equal(c.location, 'src/foo.ts:42-50');
});

test('classifyEvidenceLocation — doc:section pattern', () => {
  const c = classifyEvidenceLocation('doc:§3.5');
  assert.equal(c.type, 'doc:section');
  assert.equal(c.location, '§3.5');
});

test('classifyEvidenceLocation — §-only pattern', () => {
  const c = classifyEvidenceLocation('§3.5');
  assert.equal(c.type, 'doc:section');
  assert.equal(c.location, '3.5');
});

test('classifyEvidenceLocation — unrecognized falls to raw', () => {
  const c = classifyEvidenceLocation('some freeform evidence');
  assert.equal(c.type, 'raw');
});
