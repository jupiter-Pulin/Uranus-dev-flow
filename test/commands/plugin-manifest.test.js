const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const pluginJsonPath = resolve(__dirname, '../../.claude-plugin/plugin.json');
const packageJsonPath = resolve(__dirname, '../../package.json');

const ALLOWED_FIELDS = new Set([
  'name', 'version', 'description', 'author', 'homepage',
  'repository', 'license', 'keywords',
  'commands', 'agents', 'skills', 'hooks',
  'mcpServers', 'outputStyles', 'lspServers',
]);

const COMPONENT_FIELDS = [
  'commands', 'agents', 'skills', 'hooks',
  'mcpServers', 'outputStyles', 'lspServers',
];

test('T1: plugin.json is valid JSON', () => {
  const raw = readFileSync(pluginJsonPath, 'utf8');
  assert.doesNotThrow(() => JSON.parse(raw), 'plugin.json is not valid JSON');
});

test('T2: name exists and is kebab-case', () => {
  const plugin = JSON.parse(readFileSync(pluginJsonPath, 'utf8'));
  assert.ok(plugin.name, 'plugin.json missing "name" field');
  assert.match(
    plugin.name,
    /^[a-z0-9]+(-[a-z0-9]+)*$/,
    `plugin.json name "${plugin.name}" is not kebab-case`
  );
});

test('T3: version synced with package.json', () => {
  const plugin = JSON.parse(readFileSync(pluginJsonPath, 'utf8'));
  const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
  assert.equal(
    plugin.version,
    pkg.version,
    `plugin.json version "${plugin.version}" does not match package.json version "${pkg.version}"`
  );
});

test('T4: no unknown fields', () => {
  const plugin = JSON.parse(readFileSync(pluginJsonPath, 'utf8'));
  const unknownFields = Object.keys(plugin).filter((k) => !ALLOWED_FIELDS.has(k));
  assert.equal(
    unknownFields.length,
    0,
    `plugin.json has unknown fields: ${unknownFields.join(', ')}`
  );
});

test('T5: component path values start with ./', () => {
  const plugin = JSON.parse(readFileSync(pluginJsonPath, 'utf8'));

  for (const field of COMPONENT_FIELDS) {
    const val = plugin[field];
    if (val === undefined) continue;

    if (typeof val === 'string') {
      assert.ok(
        val.startsWith('./'),
        `plugin.json "${field}" value "${val}" must start with "./"`
      );
    } else if (Array.isArray(val)) {
      for (const item of val) {
        assert.ok(
          typeof item === 'string' && item.startsWith('./'),
          `plugin.json "${field}" array item "${item}" must be a string starting with "./"`
        );
      }
    }
  }
});

test('T6: component fields are string, string[], or object[]', () => {
  const plugin = JSON.parse(readFileSync(pluginJsonPath, 'utf8'));

  for (const field of COMPONENT_FIELDS) {
    const val = plugin[field];
    if (val === undefined) continue;

    const isString = typeof val === 'string';
    const isStringArray = Array.isArray(val) && val.every((v) => typeof v === 'string');
    assert.ok(
      isString || isStringArray,
      `plugin.json "${field}" must be string or string[], got ${typeof val}`
    );
  }
});

test('T7: version is valid semver [recommended]', () => {
  const plugin = JSON.parse(readFileSync(pluginJsonPath, 'utf8'));
  assert.ok(plugin.version, '[recommended] plugin.json missing "version" field');
  assert.match(
    plugin.version,
    /^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?(\+[a-zA-Z0-9.]+)?$/,
    `[recommended] plugin.json version "${plugin.version}" is not valid semver`
  );
});

test('T8: description is non-empty string [recommended]', () => {
  const plugin = JSON.parse(readFileSync(pluginJsonPath, 'utf8'));
  assert.ok(
    typeof plugin.description === 'string' && plugin.description.trim(),
    '[recommended] plugin.json "description" must be a non-empty string'
  );
});

test('T9: keywords is string array [recommended]', () => {
  const plugin = JSON.parse(readFileSync(pluginJsonPath, 'utf8'));
  if (plugin.keywords === undefined) return;
  assert.ok(
    Array.isArray(plugin.keywords) && plugin.keywords.every((k) => typeof k === 'string'),
    '[recommended] plugin.json "keywords" must be an array of strings'
  );
});
