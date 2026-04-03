const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { resolve } = require('node:path');

const cliPath = resolve(__dirname, '../../scripts/classify-docs-cli.js');

test('CLI --feature returns valid JSON with doc_inventory', () => {
  const output = execFileSync('node', [cliPath, '--feature', 'doc-classification'], {
    encoding: 'utf8',
    timeout: 5000,
  }).trim();
  const result = JSON.parse(output);
  assert.ok('doc_inventory' in result, 'must have doc_inventory');
  assert.ok('canonical_docs' in result, 'must have canonical_docs');
  assert.ok(Array.isArray(result.doc_inventory), 'doc_inventory must be array');
});

test('CLI with invalid feature returns empty object', () => {
  const output = execFileSync('node', [cliPath, '--feature', '../escape'], {
    encoding: 'utf8',
    timeout: 5000,
  }).trim();
  const result = JSON.parse(output);
  assert.ok(Array.isArray(result.doc_inventory) && result.doc_inventory.length === 0);
});
