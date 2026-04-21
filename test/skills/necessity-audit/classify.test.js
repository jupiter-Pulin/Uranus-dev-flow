'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  HIGH_PATTERNS,
  MED_PATTERNS,
  LOW_PATTERNS,
  scoreDimension,
  classifyElement,
  classifyAll,
  getElementContext,
} = require('../../../scripts/skills/necessity-audit/classify');

test('HIGH/MED/LOW_PATTERNS — cover all 6 dimensions', () => {
  for (let d = 1; d <= 6; d++) {
    assert.ok(HIGH_PATTERNS[d], `HIGH_PATTERNS must cover dim ${d}`);
    assert.ok(MED_PATTERNS[d], `MED_PATTERNS must cover dim ${d}`);
    assert.ok(LOW_PATTERNS[d], `LOW_PATTERNS must cover dim ${d}`);
  }
});

test('scoreDimension — High pattern wins over Med/Low', () => {
  const text = 'in the future someone might need this someday';
  assert.equal(scoreDimension(text, 1), 'High');
});

test('scoreDimension — dim 5: "without any performance data" → High', () => {
  assert.equal(scoreDimension('Cache added without any performance data', 5), 'High');
});

test('scoreDimension — dim 2: "zero consumers" → High', () => {
  assert.equal(scoreDimension('Abstract interface with zero consumers', 2), 'High');
});

test('scoreDimension — Med pattern when no High', () => {
  assert.equal(scoreDimension('We might need this eventually', 1), 'Med');
});

test('scoreDimension — dim 4: "for flexibility" → Med', () => {
  assert.equal(scoreDimension('Added for flexibility', 4), 'Med');
});

test('scoreDimension — Low pattern when no High/Med', () => {
  assert.equal(scoreDimension('Current need plausible for user flow', 1), 'Low');
});

test('scoreDimension — no match returns Clean', () => {
  assert.equal(scoreDimension('A perfectly reasonable requirement', 1), 'Clean');
});

test('scoreDimension — empty text returns Clean', () => {
  assert.equal(scoreDimension('', 1), 'Clean');
  assert.equal(scoreDimension(undefined, 1), 'Clean');
});

test('classifyElement — ≥1 High → Cut', () => {
  const el = { id: 'FR-1', kind: 'FR', primary_dimension: 1 };
  const result = classifyElement(el, [1, 2, 3], 'in the future someone might want this');
  assert.equal(result.claude.classification, 'Cut');
  assert.match(result.claude.rationale, /scored High/);
  assert.equal(result.claude.dimension_scores[1], 'High');
});

test('classifyElement — ≥2 Med and no High → Review', () => {
  const el = { id: 'FR-2', kind: 'FR', primary_dimension: 1 };
  // dim 1 Med ("might need"), dim 4 Med ("for flexibility") — 2 Meds
  const result = classifyElement(el, [1, 4], 'Might need a flag for flexibility');
  assert.equal(result.claude.classification, 'Review');
  assert.match(result.claude.rationale, /scored Med/);
});

test('classifyElement — only 1 Med → Keep', () => {
  const el = { id: 'FR-3', kind: 'FR', primary_dimension: 1 };
  const result = classifyElement(el, [1, 2, 3], 'Might need this eventually');
  assert.equal(result.claude.classification, 'Keep');
});

test('classifyElement — no signals → Keep', () => {
  const el = { id: 'FR-4', kind: 'FR', primary_dimension: 1 };
  const result = classifyElement(el, [1, 2, 3], 'A solid, well-scoped requirement');
  assert.equal(result.claude.classification, 'Keep');
});

test('classifyElement — emits dimension_scores for all active dims only', () => {
  const el = { id: 'FR-5', kind: 'FR', primary_dimension: 1 };
  const result = classifyElement(el, [1, 4], 'plain');
  assert.deepEqual(Object.keys(result.claude.dimension_scores).sort(), ['1', '4']);
});

test('classifyElement — preserves original element fields', () => {
  const el = { id: 'FR-6', kind: 'FR', primary_dimension: 3, source_line: 42 };
  const result = classifyElement(el, [1, 2, 3], 'solid');
  assert.equal(result.id, 'FR-6');
  assert.equal(result.source_line, 42);
  assert.deepEqual(result.evidence, []);
});

test('classifyAll — filters out elements whose primary_dimension is inactive', () => {
  const elements = [
    { id: 'FR-1', kind: 'FR', primary_dimension: 1 },
    { id: 'FR-4', kind: 'FR', primary_dimension: 4 }, // inactive when active=[1,2,3]
    { id: 'FR-5', kind: 'FR', primary_dimension: 5 }, // inactive
  ];
  const result = classifyAll(elements, [1, 2, 3], '');
  assert.equal(result.length, 1);
  assert.equal(result[0].id, 'FR-1');
});

test('classifyAll — empty active dims returns empty', () => {
  const elements = [{ id: 'FR-1', kind: 'FR', primary_dimension: 1 }];
  assert.deepEqual(classifyAll(elements, [], ''), []);
});

test('getElementContext — returns only the source_line text (no forward spillover)', () => {
  const content = 'A\nB\nC\nD\nE';
  const ctx = getElementContext({ source_line: 2 }, content);
  assert.equal(ctx, 'B', 'must not include neighboring lines (would contaminate table rows)');
});

test('getElementContext — missing source_line returns empty', () => {
  assert.equal(getElementContext({}, 'content'), '');
  assert.equal(getElementContext({ source_line: 1 }, ''), '');
});

test('getElementContext — out-of-range source_line returns empty', () => {
  assert.equal(getElementContext({ source_line: 99 }, 'A\nB'), '');
  assert.equal(getElementContext({ source_line: 0 }, 'A\nB'), '');
});

test('classifyAll — neighboring-line contamination regression', () => {
  // Two rows on adjacent lines with different signals — contamination would
  // cause incorrect shared scoring.
  const elements = [
    { id: 'FR-1', kind: 'FR', primary_dimension: 1, source_line: 1 },
    { id: 'FR-2', kind: 'FR', primary_dimension: 1, source_line: 2 },
  ];
  const content = 'A solid requirement\nmight need this in the future';
  const result = classifyAll(elements, [1], content);
  assert.equal(result[0].claude.classification, 'Keep', 'FR-1 must not be contaminated by FR-2 signals');
  // FR-2 line has both "might need" (Med) and "in the future" (High-inline for dim 1)
  assert.notEqual(result[1].claude.classification, 'Keep');
});
