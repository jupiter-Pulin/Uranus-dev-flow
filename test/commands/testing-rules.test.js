const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, existsSync } = require('node:fs');
const { resolve } = require('node:path');

const root = resolve(__dirname, '../..');

// --- rules/testing.md content assertions ---

test('testing.md has AAA convention rule', () => {
  const content = readFileSync(resolve(root, 'rules/testing.md'), 'utf8');
  assert.match(content, /AAA/, 'should mention AAA pattern');
  assert.match(content, /Arrange/, 'should mention Arrange');
  assert.match(content, /Act/, 'should mention Act');
  assert.match(content, /Assert/, 'should mention Assert');
});

test('testing.md has naming convention', () => {
  const content = readFileSync(resolve(root, 'rules/testing.md'), 'utf8');
  assert.match(content, /when.*then/i, 'should have when/then naming pattern');
});

test('testing.md has Evidence Model table', () => {
  const content = readFileSync(resolve(root, 'rules/testing.md'), 'utf8');
  assert.match(content, /Evidence Model/, 'should have Evidence Model section');
  assert.match(content, /Automated test/, 'should list automated test evidence');
  assert.match(content, /Runtime verification/, 'should list runtime verification evidence');
  assert.match(content, /Manual exception/, 'should list manual exception evidence');
});

test('testing.md has exception rules with closed enum', () => {
  const content = readFileSync(resolve(root, 'rules/testing.md'), 'utf8');
  assert.match(content, /ENV_UNAVAILABLE/, 'should have ENV_UNAVAILABLE reason');
  assert.match(content, /UNSAFE_TO_AUTOMATE/, 'should have UNSAFE_TO_AUTOMATE reason');
  assert.match(content, /ONE_TIME_MIGRATION/, 'should have ONE_TIME_MIGRATION reason');
  assert.doesNotMatch(content, /\bOTHER\b.*short text/, 'should NOT have OTHER as open-ended reason class');
});

test('testing.md has prohibited domains for exceptions', () => {
  const content = readFileSync(resolve(root, 'rules/testing.md'), 'utf8');
  assert.match(content, /Security AC.*Never/i, 'security ACs should never allow exceptions');
  assert.match(content, /Data-integrity AC.*Never/i, 'data-integrity ACs should never allow exceptions');
  assert.match(content, /Regression AC.*Never/i, 'regression ACs should never allow exceptions');
});

test('testing.md has 4-state Adequacy Gate Sentinels', () => {
  const content = readFileSync(resolve(root, 'rules/testing.md'), 'utf8');
  assert.match(content, /✅ Adequate/, 'should have Adequate sentinel');
  assert.match(content, /⚠️ Adequate with exceptions/, 'should have Adequate with exceptions sentinel');
  assert.match(content, /⚠️ Need Human/, 'should have Need Human sentinel');
  assert.match(content, /⛔ Inadequate/, 'should have Inadequate sentinel');
});

test('testing.md references testing-project.md for overrides', () => {
  const content = readFileSync(resolve(root, 'rules/testing.md'), 'utf8');
  assert.match(content, /testing-project\.md/, 'should reference testing-project.md');
});

// --- rules/testing-project.md ---

test('testing-project.md exists with precedence header', () => {
  const path = resolve(root, 'rules/testing-project.md');
  assert.ok(existsSync(path), 'testing-project.md should exist');
  const content = readFileSync(path, 'utf8');
  assert.match(content, /Precedence:.*this file.*takes precedence/i, 'should have precedence header');
  assert.match(content, /user-owned/i, 'should state user-owned');
});

test('testing-project.md has commented override sections', () => {
  const content = readFileSync(resolve(root, 'rules/testing-project.md'), 'utf8');
  assert.match(content, /<!--.*## Test Pyramid/s, 'should have commented Test Pyramid section');
  assert.match(content, /<!--.*## Adequacy Mode/s, 'should have commented Adequacy Mode section');
});

// --- CLAUDE.md references ---

test('CLAUDE.md references testing-project.md', () => {
  const content = readFileSync(resolve(root, 'CLAUDE.md'), 'utf8');
  assert.match(content, /@rules\/testing-project\.md/, 'should reference testing-project.md');
});

test('.claude/CLAUDE.md references testing-project.md', {
  skip: !existsSync(resolve(root, '.claude/CLAUDE.md')),
}, () => {
  const content = readFileSync(resolve(root, '.claude/CLAUDE.md'), 'utf8');
  assert.match(content, /@rules\/testing-project\.md/, 'should reference testing-project.md');
});
