const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, existsSync } = require('node:fs');
const { resolve } = require('node:path');

const root = resolve(__dirname, '../..');
const skillPath = resolve(root, 'skills/remind/SKILL.md');
const commandPath = resolve(root, 'commands/remind.md');

// --- SKILL.md content assertions ---

test('remind SKILL.md has smart detection with state file', () => {
  const content = readFileSync(skillPath, 'utf8');
  assert.match(content, /detection/i, 'should mention detection');
  assert.match(content, /state/i, 'should reference state file');
});

test('remind SKILL.md has rule loading via Read tool', () => {
  const content = readFileSync(skillPath, 'utf8');
  assert.match(content, /rules?\//i, 'should reference rules/ directory');
  assert.match(content, /Read/i, 'should use Read tool');
});

test('remind SKILL.md has --all nuclear mode', () => {
  const content = readFileSync(skillPath, 'utf8');
  assert.match(content, /--all/, 'should have --all flag');
});

test('remind SKILL.md has output format with Rule Context', () => {
  const content = readFileSync(skillPath, 'utf8');
  assert.match(content, /Finding/i, 'should have findings in output');
  assert.match(content, /Rule Context/i, 'should have Rule Context section');
});

test('remind SKILL.md under 500 lines', () => {
  const content = readFileSync(skillPath, 'utf8');
  const lineCount = content.split('\n').length;
  assert.ok(lineCount < 500, `SKILL.md has ${lineCount} lines, should be under 500`);
});

// --- Command assertions ---

test('commands/remind.md has allowed-tools with Read and Grep', () => {
  const content = readFileSync(commandPath, 'utf8');
  assert.match(content, /Read/, 'should have Read in allowed-tools');
  assert.match(content, /Grep/, 'should have Grep in allowed-tools');
});

// --- CLAUDE.md assertion ---

test('CLAUDE.md has /remind entry', () => {
  const content = readFileSync(resolve(root, 'CLAUDE.md'), 'utf8');
  assert.match(content, /remind/, 'should have remind in command reference');
});

// --- Reference file assertions ---

test('detection-rules.md exists with auto-loop mapping', () => {
  const path = resolve(root, 'skills/remind/references/detection-rules.md');
  assert.ok(existsSync(path), 'detection-rules.md should exist');
  const content = readFileSync(path, 'utf8');
  assert.match(content, /auto-loop/i, 'should reference auto-loop rule');
});
