const { test } = require('node:test');
const assert = require('node:assert/strict');
const { resolve } = require('node:path');
const { readFileSync, existsSync } = require('node:fs');

const root = resolve(__dirname, '../..');
const skillPath = resolve(root, 'skills/sharingan/SKILL.md');
const commandPath = resolve(root, 'commands/sharingan.md');
const scriptPath = resolve(root, 'skills/sharingan/scripts/scan-repo.js');
const refDir = resolve(root, 'skills/sharingan/references');

const refFiles = [
  'format-mapping.md',
  'dependency-graph-algorithm.md',
  'output-template.md',
  'quality-checklist.md',
  'source-bundle.md',
  'input-classification.md',
];

// ═══════════════════════════════════════════════
// SKILL.md validation (6 tests)
// ═══════════════════════════════════════════════

test('sharingan SKILL.md exists with valid frontmatter', () => {
  assert.ok(existsSync(skillPath), 'SKILL.md should exist');
  const content = readFileSync(skillPath, 'utf8');
  assert.ok(content.startsWith('---'), 'should start with frontmatter');
  assert.ok(content.includes('name: sharingan'), 'should have name field');
  assert.ok(content.includes('description:'), 'should have description field');
  assert.ok(content.includes('allowed-tools:'), 'should have allowed-tools field');
});

test('sharingan SKILL.md has Phase 0-4 workflow', () => {
  const content = readFileSync(skillPath, 'utf8');
  assert.ok(content.includes('Phase 0'), 'should have Phase 0: Input Validation');
  assert.ok(content.includes('Phase 1'), 'should have Phase 1: SCAN');
  assert.ok(content.includes('Phase 2'), 'should have Phase 2: ANALYZE');
  assert.ok(content.includes('Phase 3'), 'should have Phase 3: GENERATE');
  assert.ok(content.includes('Phase 4'), 'should have Phase 4: VALIDATE');
});

test('sharingan SKILL.md has Verification checklist', () => {
  const content = readFileSync(skillPath, 'utf8');
  assert.ok(content.includes('## Verification'), 'should have Verification section');
  assert.ok(content.includes('- [ ]'), 'should have checklist items');
});

test('sharingan SKILL.md has When NOT section', () => {
  const content = readFileSync(skillPath, 'utf8');
  assert.ok(content.includes('When NOT to Use'), 'should have When NOT to Use section');
});

test('sharingan SKILL.md references scan-repo.js', () => {
  const content = readFileSync(skillPath, 'utf8');
  assert.ok(content.includes('scan-repo.js'), 'should reference scan-repo.js script');
});

test('sharingan SKILL.md references all 4 reference files', () => {
  const content = readFileSync(skillPath, 'utf8');
  for (const ref of refFiles) {
    assert.ok(content.includes(ref), `should reference ${ref}`);
  }
});

// ═══════════════════════════════════════════════
// Command validation (3 tests)
// ═══════════════════════════════════════════════

test('sharingan command exists with valid frontmatter', () => {
  assert.ok(existsSync(commandPath), 'commands/sharingan.md should exist');
  const content = readFileSync(commandPath, 'utf8');
  assert.ok(content.startsWith('---'), 'should start with frontmatter');
  assert.ok(content.includes('description:'), 'should have description');
  assert.ok(content.includes('argument-hint:'), 'should have argument-hint');
});

test('sharingan command references SKILL.md', () => {
  const content = readFileSync(commandPath, 'utf8');
  assert.ok(content.includes('@skills/sharingan/SKILL.md'), 'should reference skill');
});

test('sharingan command preloads all references', () => {
  const content = readFileSync(commandPath, 'utf8');
  for (const ref of refFiles) {
    assert.ok(
      content.includes(`@skills/sharingan/references/${ref}`),
      `should preload ${ref}`
    );
  }
});

// ═══════════════════════════════════════════════
// File existence (2 tests)
// ═══════════════════════════════════════════════

test('all 4 reference files exist', () => {
  for (const ref of refFiles) {
    const p = resolve(refDir, ref);
    assert.ok(existsSync(p), `${ref} should exist`);
  }
});

test('scan-repo.js script exists', () => {
  assert.ok(existsSync(scriptPath), 'scan-repo.js should exist');
});

// ═══════════════════════════════════════════════
// v2 validation (3 tests)
// ═══════════════════════════════════════════════

test('sharingan command has <input> in argument-hint', () => {
  const content = readFileSync(commandPath, 'utf8');
  assert.ok(content.includes('<input>'), 'argument-hint should use <input>');
});

test('sharingan command has --source flag', () => {
  const content = readFileSync(commandPath, 'utf8');
  assert.ok(content.includes('--source'), 'should document --source flag');
});

test('sharingan allowed-tools match between SKILL.md and command', () => {
  const skillContent = readFileSync(skillPath, 'utf8');
  const cmdContent = readFileSync(commandPath, 'utf8');
  const parseTools = c => {
    const m = c.match(/allowed-tools:\s*(.+)/);
    return m ? m[1].split(',').map(t => t.trim()).sort() : [];
  };
  const skillTools = parseTools(skillContent);
  const cmdTools = parseTools(cmdContent);
  assert.deepEqual(skillTools, cmdTools, 'SKILL.md and command allowed-tools should match');
});
