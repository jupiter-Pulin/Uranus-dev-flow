const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const root = resolve(__dirname, '../..');

test('SKILL.md has Phase 1.5 granularity check', () => {
  const content = readFileSync(resolve(root, 'skills/create-request/SKILL.md'), 'utf8');
  assert.match(content, /Phase 1\.5/, 'should have Phase 1.5');
  assert.match(content, /Granularity Check/, 'should have Granularity Check section');
});

test('SKILL.md has AskUserQuestion in allowed-tools', () => {
  const content = readFileSync(resolve(root, 'skills/create-request/SKILL.md'), 'utf8');
  assert.match(content, /AskUserQuestion/, 'should have AskUserQuestion in allowed-tools');
});

test('SKILL.md defines three primary signals', () => {
  const content = readFileSync(resolve(root, 'skills/create-request/SKILL.md'), 'utf8');
  assert.match(content, /AC count/, 'should have AC count signal');
  assert.match(content, /Layer mixing/, 'should have Layer mixing signal');
  assert.match(content, /Scope breadth/, 'should have Scope breadth signal');
});

test('SKILL.md defines decision logic with >= 2 threshold', () => {
  const content = readFileSync(resolve(root, 'skills/create-request/SKILL.md'), 'utf8');
  assert.match(content, /< 2/, 'should have < 2 threshold');
  assert.match(content, /[≥>]=?\s*2/, 'should have >= 2 or ≥ 2 threshold');
  assert.match(content, /[≥>]=?\s*3/, 'should have >= 3 or ≥ 3 threshold');
});

test('SKILL.md has quality-gate AC exclusion list', () => {
  const content = readFileSync(resolve(root, 'skills/create-request/SKILL.md'), 'utf8');
  assert.match(content, /codex-review-fast/, 'should list codex-review-fast');
  assert.match(content, /codex-review-doc/, 'should list codex-review-doc');
  assert.match(content, /precommit-fast/, 'should list precommit-fast');
  assert.match(content, /pr-review/, 'should list pr-review');
});

test('template.md has granularity guide', () => {
  const content = readFileSync(resolve(root, 'skills/create-request/references/template.md'), 'utf8');
  assert.match(content, /Granularity Guide/, 'should have Granularity Guide section');
  assert.match(content, /≤ 8/, 'should mention ≤ 8 AC target');
});

test('template.md has Depends On field', () => {
  const content = readFileSync(resolve(root, 'skills/create-request/references/template.md'), 'utf8');
  assert.match(content, /Depends On/, 'should have Depends On field');
});
