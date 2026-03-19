const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, existsSync } = require('node:fs');
const { resolve } = require('node:path');

const root = resolve(__dirname, '../..');
const skillPath = resolve(root, 'skills/deep-research/SKILL.md');
const commandPath = resolve(root, 'commands/deep-research.md');

// --- SKILL.md content assertions ---

test('deep-research SKILL.md has 4-phase pipeline', () => {
  const content = readFileSync(skillPath, 'utf8');
  assert.match(content, /Phase 0/i, 'should have Phase 0');
  assert.match(content, /Phase 1/i, 'should have Phase 1');
  assert.match(content, /Phase 2/i, 'should have Phase 2');
  assert.match(content, /Phase 3/i, 'should have Phase 3');
});

test('deep-research SKILL.md has 3 roles (researcher, synthesizer, validator)', () => {
  const content = readFileSync(skillPath, 'utf8');
  assert.match(content, /researcher.*synthesizer.*validator/is, 'should mention all 3 roles');
});

test('deep-research SKILL.md has claim registry', () => {
  const content = readFileSync(skillPath, 'utf8');
  assert.match(content, /claim/i, 'should mention claim');
  assert.match(content, /registry/i, 'should mention registry');
});

test('deep-research SKILL.md has completeness scoring', () => {
  const content = readFileSync(skillPath, 'utf8');
  assert.match(content, /completeness/i, 'should mention completeness');
});

test('deep-research SKILL.md has mode system', () => {
  const content = readFileSync(skillPath, 'utf8');
  assert.match(content, /--mode/, 'should have --mode flag');
  assert.match(content, /exploratory.*compliance.*decision/is, 'should list all 3 modes');
});

test('deep-research SKILL.md has conditional debate', () => {
  const content = readFileSync(skillPath, 'utf8');
  assert.match(content, /--debate/, 'should have --debate flag');
  assert.match(content, /auto.*force.*off/is, 'should list all 3 debate options');
});

test('deep-research SKILL.md has web research cascade', () => {
  const content = readFileSync(skillPath, 'utf8');
  assert.match(content, /WebSearch/i, 'should mention web research');
});

test('deep-research SKILL.md under 500 lines', () => {
  const content = readFileSync(skillPath, 'utf8');
  const lineCount = content.split('\n').length;
  assert.ok(lineCount < 500, `SKILL.md has ${lineCount} lines, should be under 500`);
});

// --- Command assertions ---

test('commands/deep-research.md has --mode and --debate flags', () => {
  const content = readFileSync(commandPath, 'utf8');
  assert.match(content, /--mode/, 'should have --mode');
  assert.match(content, /--debate/, 'should have --debate');
});

test('commands/deep-research.md has --agents and --budget flags', () => {
  const content = readFileSync(commandPath, 'utf8');
  assert.match(content, /--agents/, 'should have --agents');
  assert.match(content, /--budget/, 'should have --budget');
});

// --- CLAUDE.md assertion ---

test('CLAUDE.md has /deep-research entry', () => {
  const content = readFileSync(resolve(root, 'CLAUDE.md'), 'utf8');
  assert.match(content, /deep-research/, 'should have deep-research in command reference');
});

// --- Reference file assertions ---

test('research-roles.md exists with 3 roles', () => {
  const path = resolve(root, 'skills/deep-research/references/research-roles.md');
  assert.ok(existsSync(path), 'research-roles.md should exist');
  const content = readFileSync(path, 'utf8');
  assert.match(content, /researcher/i, 'should mention researcher role');
  assert.match(content, /synthesizer/i, 'should mention synthesizer role');
  assert.match(content, /validator/i, 'should mention validator role');
});

test('scoring-model.md exists with 4-signal model', () => {
  const path = resolve(root, 'skills/deep-research/references/scoring-model.md');
  assert.ok(existsSync(path), 'scoring-model.md should exist');
  const content = readFileSync(path, 'utf8');
  assert.match(content, /source.diversity/i, 'should mention source diversity signal');
});

test('claim-registry.md exists with evidence model', () => {
  const path = resolve(root, 'skills/deep-research/references/claim-registry.md');
  assert.ok(existsSync(path), 'claim-registry.md should exist');
  const content = readFileSync(path, 'utf8');
  assert.match(content, /evidence/i, 'should describe evidence model');
  assert.match(content, /URL/i, 'should support URL evidence');
});
