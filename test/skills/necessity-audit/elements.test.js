'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  DIMENSION_KEYWORDS,
  detectDimension,
  extractRequirements,
  extractTechSpec,
  extractArchitecture,
  extractImplementation,
  extractElements,
} = require('../../../scripts/skills/necessity-audit/elements');

test('DIMENSION_KEYWORDS — covers all 6 dimensions with ≥1 pattern each', () => {
  for (let d = 1; d <= 6; d++) {
    assert.ok(DIMENSION_KEYWORDS[d], `dimension ${d} must have patterns`);
    assert.ok(DIMENSION_KEYWORDS[d].length >= 1, `dimension ${d} must have >= 1 pattern`);
  }
});

test('detectDimension — premature optimization keywords → dim 5', () => {
  assert.equal(detectDimension('Cache layer for throughput'), 5);
  assert.equal(detectDimension('Async batch processing'), 5);
  assert.equal(detectDimension('Optimize latency'), 5);
});

test('detectDimension — configurability keywords → dim 4', () => {
  assert.equal(detectDimension('Add a flag to toggle behavior'), 4);
  assert.equal(detectDimension('Environment variable for debug mode'), 4);
});

test('detectDimension — extensibility keywords → dim 3', () => {
  assert.equal(detectDimension('Extensible plugin system'), 3);
  assert.equal(detectDimension('Hook for future extenders'), 3);
});

test('detectDimension — abstraction keywords → dim 2', () => {
  assert.equal(detectDimension('Generic interface for reusable logic'), 2);
  assert.equal(detectDimension('Abstract base class with decoupled layers'), 2);
});

test('detectDimension — future/speculative keywords → dim 1', () => {
  assert.equal(detectDimension('Might need this someday'), 1);
  assert.equal(detectDimension('For future growth'), 1);
});

test('detectDimension — no keyword match defaults to dim 1', () => {
  assert.equal(detectDimension('A perfectly ordinary requirement'), 1);
});

test('extractRequirements — finds FR/NFR rows in markdown table', () => {
  const content = [
    '| ID | Description | Priority |',
    '|----|-------------|----------|',
    '| FR-1 | User login via OAuth | Must |',
    '| FR-2 | Optional email notification for future use | Should |',
    '| NFR-1 | Response time < 200ms | Must |',
    '| Not-a-match | Misc | Must |',
  ].join('\n');
  const elements = extractRequirements(content);
  assert.equal(elements.length, 3);
  assert.equal(elements[0].id, 'FR-1');
  assert.equal(elements[0].kind, 'FR');
  assert.equal(elements[1].id, 'FR-2');
  assert.equal(elements[1].primary_dimension, 1, 'FR-2 has "future use" → dim 1');
  assert.equal(elements[2].id, 'NFR-1');
  assert.equal(elements[2].kind, 'NFR');
  assert.equal(elements[2].primary_dimension, 5, 'NFR-1 mentions "response time" → dim 5 (latency)');
});

test('extractRequirements — empty content returns empty list', () => {
  assert.deepEqual(extractRequirements(''), []);
});

test('extractTechSpec — finds Component headings and §3.x sections at ## or ### levels', () => {
  const content = [
    '### 3.1 Overview',
    'Some text',
    '### Component:preflight.js',
    'More text',
    '## 3.2 Data Model',
    '### Component:consolidate.js',
    '### 3.2.1 Nested subsection',
  ].join('\n');
  const elements = extractTechSpec(content);
  assert.equal(elements.length, 5);
  assert.equal(elements[0].id, '§3.1');
  assert.equal(elements[0].kind, 'Component');
  assert.equal(elements[1].id, 'Component:preflight.js');
  assert.equal(elements[1].kind, 'Component');
  assert.equal(elements[2].id, '§3.2');
  assert.equal(elements[3].id, 'Component:consolidate.js');
  assert.equal(elements[4].id, '§3.2.1', 'must accept nested §3.N.M');
});

test('extractArchitecture — finds ### ComponentName headings', () => {
  const content = [
    '### PreflightModule',
    '### ConsolidateModule',
    '### lowercase-wont-match',
    '## NotAComponent',
  ].join('\n');
  const elements = extractArchitecture(content);
  assert.equal(elements.length, 2);
  assert.equal(elements[0].id, 'Component:PreflightModule');
  assert.equal(elements[1].id, 'Component:ConsolidateModule');
});

test('extractImplementation — finds module paths in tables', () => {
  const content = [
    '| Module | Purpose |',
    '|--------|---------|',
    '| `scripts/foo.js` | Core logic |',
    '| `lib/cache.js` | Optimize throughput |',
    '| Not-a-path | Misc |',
  ].join('\n');
  const elements = extractImplementation(content);
  assert.equal(elements.length, 2);
  assert.equal(elements[0].id, 'scripts/foo.js');
  assert.equal(elements[0].kind, 'Component');
  assert.equal(elements[1].primary_dimension, 5, 'cache + throughput → dim 5');
});

test('extractElements — unknown doc_kind throws', () => {
  assert.throws(() => extractElements('', 'unknown-kind'), /Unknown doc_kind/);
});

test('extractElements — dispatches by doc_kind', () => {
  const reqContent = '| FR-1 | A basic requirement | Must |';
  const elements = extractElements(reqContent, 'requirements');
  assert.equal(elements.length, 1);
  assert.equal(elements[0].id, 'FR-1');
});

test('extractElements — feasibility uses same extractor as requirements', () => {
  const content = '| FR-1 | test | x |';
  assert.deepEqual(
    extractElements(content, 'feasibility'),
    extractElements(content, 'requirements'),
  );
});

test('extractRequirements — source_line is 1-indexed', () => {
  const content = '\n\n| FR-1 | test | x |';
  const elements = extractRequirements(content);
  assert.equal(elements[0].source_line, 3);
});
