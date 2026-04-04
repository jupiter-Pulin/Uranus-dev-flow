const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const skillPath = resolve(__dirname, '../../skills/generate-runner/SKILL.md');
const templatesPath = resolve(__dirname, '../../skills/generate-runner/references/templates.md');

const skillContent = readFileSync(skillPath, 'utf8');
const templatesContent = readFileSync(templatesPath, 'utf8');

// Schema tests
test('SKILL.md has valid frontmatter', () => {
  assert.ok(skillContent.includes('name: generate-runner'));
  assert.ok(skillContent.includes('allowed-tools:'));
});

// Content tests
test('SKILL.md documents ecosystem detection table', () => {
  assert.ok(skillContent.includes('package-lock.json'));
  assert.ok(skillContent.includes('pyproject.toml'));
  assert.ok(skillContent.includes('Cargo.toml'));
  assert.ok(skillContent.includes('go.mod'));
});

test('SKILL.md documents eject header fields', () => {
  assert.ok(skillContent.includes('@generated_at'));
  assert.ok(skillContent.includes('@plugin_version'));
  assert.ok(skillContent.includes('@template'));
  assert.ok(skillContent.includes('@ecosystem'));
});

test('SKILL.md has When NOT to Use section', () => {
  assert.ok(skillContent.includes('When NOT to Use'));
});

test('templates.md has all 4 ecosystem templates', () => {
  assert.ok(templatesContent.includes('## Node.js Template'));
  assert.ok(templatesContent.includes('## Python Template'));
  assert.ok(templatesContent.includes('## Rust Template'));
  assert.ok(templatesContent.includes('## Go Template'));
});

test('templates.md documents eject header contract', () => {
  assert.ok(templatesContent.includes('Eject Header Contract'));
  assert.ok(templatesContent.includes('@generated_at'));
});
