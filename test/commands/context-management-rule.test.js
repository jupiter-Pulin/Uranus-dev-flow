const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, existsSync } = require('node:fs');
const { resolve } = require('node:path');

const root = resolve(__dirname, '../..');

test('rules/context-management.md exists', () => {
  const path = resolve(root, 'rules/context-management.md');
  assert.ok(existsSync(path), 'context-management.md should exist in rules/');
});

test('context-management.md has required sections', () => {
  const content = readFileSync(resolve(root, 'rules/context-management.md'), 'utf8');
  assert.match(content, /## Prohibited Behaviors/, 'should have Prohibited Behaviors section');
  assert.match(content, /## Three-Tier Policy/, 'should have Three-Tier Policy section');
  assert.match(content, /## Compact Preservation/, 'should have Compact Preservation section');
  assert.match(content, /## Auto-Loop Precedence/, 'should have Auto-Loop Precedence section');
});

test('context-management.md defines three zones', () => {
  const content = readFileSync(resolve(root, 'rules/context-management.md'), 'utf8');
  assert.match(content, /Normal/, 'should define Normal zone');
  assert.match(content, /Compact/, 'should define Compact zone');
  assert.match(content, /Critical/, 'should define Critical zone');
  assert.match(content, /used < 80%/, 'Normal threshold should be <80%');
  assert.match(content, /used < 92%/, 'Compact upper threshold should be <92%');
});

test('context-management.md prohibits stopping without /context', () => {
  const content = readFileSync(resolve(root, 'rules/context-management.md'), 'utf8');
  assert.match(content, /without first running.*\/context/, 'should require /context before claiming exhaustion');
});

test('context-management.md has /context unavailable exception', () => {
  const content = readFileSync(resolve(root, 'rules/context-management.md'), 'utf8');
  assert.match(content, /unavailable.*proceed with work/, 'should have fallback for /context unavailability');
});

test('context-management.md preserves auto-loop precedence', () => {
  const content = readFileSync(resolve(root, 'rules/context-management.md'), 'utf8');
  assert.match(content, /auto-loop/, 'should reference auto-loop');
  assert.match(content, /review\/precommit/, 'should mention review/precommit obligations');
});

test('CLAUDE.md references context-management rule', () => {
  const content = readFileSync(resolve(root, 'CLAUDE.md'), 'utf8');
  assert.match(content, /@rules\/context-management\.md/, 'CLAUDE.md should reference context-management rule');
});

test('auto-loop.md cross-references context-management', () => {
  const content = readFileSync(resolve(root, 'rules/auto-loop.md'), 'utf8');
  assert.match(content, /@rules\/context-management\.md/, 'auto-loop should cross-reference context-management');
});

test('install-rules.md Phase 2 includes context-management', () => {
  const content = readFileSync(resolve(root, 'commands/install-rules.md'), 'utf8');
  assert.match(content, /context-management\.md.*Data-driven context monitoring/, 'install-rules Phase 2 should list context-management');
});

test('CLAUDE.template.md includes context-management', () => {
  const content = readFileSync(resolve(root, 'CLAUDE.template.md'), 'utf8');
  assert.match(content, /@rules\/context-management\.md/, 'template should include context-management reference');
});
