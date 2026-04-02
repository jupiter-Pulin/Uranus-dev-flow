const { test } = require('node:test');
const assert = require('node:assert/strict');
const { resolve } = require('node:path');

const {
  parseLcov, parseIstanbulJson, parseJestSummary,
  parseCoberturaXml, parseGoCoverProfile, parseTarpaulinJson,
  parseJacocoXml, parseJacocoCsv, detectArtifacts, selectBest,
} = require(resolve(__dirname, '../../skills/test-health/scripts/artifact-parser'));

test('parseLcov extracts line and branch counts', () => {
  const content = 'SF:src/a.js\nLF:10\nLH:8\nBRF:4\nBRH:3\nend_of_record\nSF:src/b.js\nLF:5\nLH:5\nBRF:2\nBRH:1\nend_of_record';
  const result = parseLcov(content);
  assert.equal(result.lines.covered, 13);
  assert.equal(result.lines.total, 15);
  assert.equal(result.lines.pct, 86.7);
  assert.equal(result.branches.covered, 4);
  assert.equal(result.branches.total, 6);
  assert.equal(result.branches.pct, 66.7);
});

test('parseLcov handles empty content', () => {
  const result = parseLcov('');
  assert.equal(result.lines.total, 0);
  assert.equal(result.lines.pct, 0);
});

test('parseIstanbulJson extracts statement and branch counts', () => {
  const content = JSON.stringify({
    'src/a.js': { s: { '0': 1, '1': 0, '2': 3 }, b: { '0': [1, 0] } },
    'src/b.js': { s: { '0': 5 }, b: {} },
  });
  const result = parseIstanbulJson(content);
  assert.equal(result.lines.covered, 3);
  assert.equal(result.lines.total, 4);
  assert.equal(result.branches.covered, 1);
  assert.equal(result.branches.total, 2);
});

test('parseJestSummary extracts total coverage', () => {
  const content = JSON.stringify({
    total: {
      lines: { total: 100, covered: 82, pct: 82 },
      branches: { total: 50, covered: 38, pct: 76 },
    },
  });
  const result = parseJestSummary(content);
  assert.equal(result.lines.pct, 82);
  assert.equal(result.branches.pct, 76);
});

test('parseCoberturaXml extracts rates', () => {
  const content = '<coverage line-rate="0.823" branch-rate="0.76"><packages/></coverage>';
  const result = parseCoberturaXml(content);
  assert.equal(result.lines.pct, 82.3);
  assert.equal(result.branches.pct, 76);
});

test('parseGoCoverProfile counts covered statements', () => {
  const content = 'mode: set\ngithub.com/pkg/a.go:1.1,5.1 3 1\ngithub.com/pkg/a.go:6.1,10.1 2 0\ngithub.com/pkg/b.go:1.1,3.1 1 1';
  const result = parseGoCoverProfile(content);
  assert.equal(result.lines.covered, 2);
  assert.equal(result.lines.total, 3);
  assert.equal(result.lines.pct, 66.7);
});

test('parseTarpaulinJson extracts covered/coverable', () => {
  const content = JSON.stringify({ covered: 45, coverable: 60 });
  const result = parseTarpaulinJson(content);
  assert.equal(result.lines.covered, 45);
  assert.equal(result.lines.total, 60);
  assert.equal(result.lines.pct, 75);
});

test('parseJacocoXml extracts instruction and branch counters', () => {
  const content = '<report><counter type="INSTRUCTION" missed="20" covered="80"/><counter type="BRANCH" missed="10" covered="30"/></report>';
  const result = parseJacocoXml(content);
  assert.equal(result.lines.covered, 80);
  assert.equal(result.lines.total, 100);
  assert.equal(result.lines.pct, 80);
  assert.equal(result.branches.covered, 30);
  assert.equal(result.branches.total, 40);
});

test('parseJacocoCsv sums instruction and branch columns', () => {
  const content = 'GROUP,PACKAGE,CLASS,INSTRUCTION_MISSED,INSTRUCTION_COVERED,BRANCH_MISSED,BRANCH_COVERED\napp,pkg,A,10,90,5,15\napp,pkg,B,20,80,10,10';
  const result = parseJacocoCsv(content);
  assert.equal(result.lines.covered, 170);
  assert.equal(result.lines.total, 200);
  assert.equal(result.branches.covered, 25);
  assert.equal(result.branches.total, 40);
});

test('parseJacocoCsv handles empty content', () => {
  const result = parseJacocoCsv('');
  assert.equal(result.lines.total, 0);
});

test('selectBest returns null for empty candidates', () => {
  assert.equal(selectBest([]), null);
});

test('selectBest picks freshest parseable artifact', () => {
  const candidates = [
    { format: 'lcov', mtime: 100, depth: 1, tool: 'c8' },
    { format: 'istanbul', mtime: 200, depth: 1, tool: 'nyc' },
    { format: 'coverage-db', mtime: 300, depth: 0, tool: 'coverage.py', unparseable: true },
  ];
  const best = selectBest(candidates);
  assert.equal(best.format, 'istanbul');
  assert.equal(best.mtime, 200);
});

test('selectBest skips unparseable artifacts', () => {
  const candidates = [
    { format: 'coverage-db', mtime: 999, depth: 0, unparseable: true },
  ];
  assert.equal(selectBest(candidates), null);
});
