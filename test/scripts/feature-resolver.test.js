const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, mkdirSync, writeFileSync, rmSync } = require('node:fs');
const { join, resolve } = require('node:path');
const { tmpdir } = require('node:os');
const { execFileSync } = require('node:child_process');

const { resolveFeatureContext, SLUG_RE } = require('../../scripts/lib/feature-resolver');

const cliPath = resolve(__dirname, '../../scripts/resolve-feature-cli.js');
const tempDirs = [];

function createTempRoot() {
  const dir = mkdtempSync(join(tmpdir(), 'sd0x-fr-'));
  tempDirs.push(dir);
  return dir;
}

function setupFeatureDir(root, featureName, opts = {}) {
  const featureDir = join(root, 'docs', 'features', featureName);
  mkdirSync(featureDir, { recursive: true });
  if (opts.techSpec) {
    writeFileSync(join(featureDir, '2-tech-spec.md'), '# Tech Spec\n');
  }
  if (opts.requirements) {
    writeFileSync(join(featureDir, '1-requirements.md'), '# Requirements\n');
  }
  if (opts.requests) {
    mkdirSync(join(featureDir, 'requests'), { recursive: true });
  }
  return featureDir;
}

after(() => {
  for (const d of tempDirs) {
    rmSync(d, { recursive: true, force: true });
  }
});

// --- SLUG_RE validation ---

test('SLUG_RE accepts valid feature slugs', () => {
  assert.ok(SLUG_RE.test('auth'));
  assert.ok(SLUG_RE.test('statusline-config'));
  assert.ok(SLUG_RE.test('bug-fix-redesign'));
  assert.ok(SLUG_RE.test('v2.0'));
  assert.ok(SLUG_RE.test('my_feature'));
});

test('SLUG_RE rejects path traversal attempts', () => {
  assert.ok(!SLUG_RE.test('../etc'));
  assert.ok(!SLUG_RE.test('../../passwd'));
  assert.ok(!SLUG_RE.test('/absolute'));
  assert.ok(!SLUG_RE.test('.hidden'));
  assert.ok(!SLUG_RE.test('-leading-dash'));
});

// --- Level 1: explicit featureKey ---

test('Level 1 featureKey resolves to existing feature dir', () => {
  const root = createTempRoot();
  setupFeatureDir(root, 'auth', { techSpec: true, requests: true });

  const result = resolveFeatureContext(root, 'main', [], { featureKey: 'auth' });
  assert.equal(result.key, 'auth');
  assert.equal(result.source, 'cli');
  assert.equal(result.confidence, 'high');
  assert.equal(result.has_tech_spec, true);
  assert.equal(result.has_requests, true);
});

test('Level 1 featureKey with non-existent dir still returns high confidence', () => {
  const root = createTempRoot();
  mkdirSync(join(root, 'docs', 'features'), { recursive: true });

  const result = resolveFeatureContext(root, 'main', [], { featureKey: 'new-feature' });
  assert.equal(result.key, 'new-feature');
  assert.equal(result.source, 'cli');
  assert.equal(result.confidence, 'high');
  assert.equal(result.has_tech_spec, false);
});

test('Level 1 featureKey with invalid slug returns null', () => {
  const root = createTempRoot();
  const result = resolveFeatureContext(root, 'main', [], { featureKey: '../escape' });
  assert.equal(result.key, null);
  assert.equal(result.source, 'none');
});

// --- has_requirements detection ---

test('has_requirements is true when 1-requirements.md exists', () => {
  const root = createTempRoot();
  const featureDir = setupFeatureDir(root, 'req-test', { techSpec: true, requests: true });
  writeFileSync(join(featureDir, '1-requirements.md'), '# Requirements\n');

  const result = resolveFeatureContext(root, 'main', [], { featureKey: 'req-test' });
  assert.equal(result.has_requirements, true);
  assert.equal(result.has_tech_spec, true);
  assert.equal(result.has_requests, true);
});

test('has_requirements is false when no requirements file exists', () => {
  const root = createTempRoot();
  setupFeatureDir(root, 'no-req', { techSpec: true, requests: true });

  const result = resolveFeatureContext(root, 'main', [], { featureKey: 'no-req' });
  assert.equal(result.has_requirements, false);
});

test('has_requirements detects variant filenames like 1-requirements-v2.md', () => {
  const root = createTempRoot();
  const featureDir = setupFeatureDir(root, 'req-variant', {});
  writeFileSync(join(featureDir, '1-requirements-v2.md'), '# Requirements v2\n');

  const result = resolveFeatureContext(root, 'main', [], { featureKey: 'req-variant' });
  assert.equal(result.has_requirements, true);
});

// --- Level 2: branch name ---

test('Level 2 branch feat/<key> resolves correctly', () => {
  const root = createTempRoot();
  setupFeatureDir(root, 'billing', { techSpec: true, requests: false });

  const result = resolveFeatureContext(root, 'feat/billing', []);
  assert.equal(result.key, 'billing');
  assert.equal(result.source, 'branch');
  assert.equal(result.confidence, 'high');
  assert.equal(result.has_tech_spec, true);
  assert.equal(result.has_requests, false);
});

test('Level 2 branch with nested path does not match', () => {
  const root = createTempRoot();
  setupFeatureDir(root, 'evil', {});

  const result = resolveFeatureContext(root, 'feat/evil/nested', []);
  assert.notEqual(result.source, 'branch');
});

test('Level 2 non-feat branch does not match', () => {
  const root = createTempRoot();
  setupFeatureDir(root, 'auth', {});

  const result = resolveFeatureContext(root, 'fix/auth', []);
  assert.notEqual(result.source, 'branch');
});

// --- Level 3: changed paths ---

test('Level 3 changed docs/features/<key>/ path resolves', () => {
  const root = createTempRoot();
  setupFeatureDir(root, 'notifications', { techSpec: false, requests: true });

  const result = resolveFeatureContext(root, 'main', ['docs/features/notifications/requests/2026-01-01-test.md']);
  assert.equal(result.key, 'notifications');
  assert.equal(result.source, 'diff');
  assert.equal(result.confidence, 'medium');
});

test('Level 3b changed skills/<key>/ path resolves when feature dir exists', () => {
  const root = createTempRoot();
  setupFeatureDir(root, 'smart-commit', { techSpec: true });

  const result = resolveFeatureContext(root, 'main', ['skills/smart-commit/SKILL.md']);
  assert.equal(result.key, 'smart-commit');
  assert.equal(result.source, 'diff');
  assert.equal(result.confidence, 'medium');
});

test('Level 3b changed commands/<key>.md path resolves when feature dir exists', () => {
  const root = createTempRoot();
  setupFeatureDir(root, 'smart-commit', { techSpec: true });

  const result = resolveFeatureContext(root, 'main', ['commands/smart-commit.md']);
  assert.equal(result.key, 'smart-commit');
  assert.equal(result.source, 'diff');
  assert.equal(result.confidence, 'medium');
});

test('Level 3b skills path does not match when no feature dir exists', () => {
  const root = createTempRoot();
  mkdirSync(join(root, 'docs', 'features'), { recursive: true });

  const result = resolveFeatureContext(root, 'main', ['skills/nonexistent/SKILL.md']);
  assert.notEqual(result.key, 'nonexistent');
});

// --- Level 4: single feature dir ---

test('Level 4 single feature dir resolves with low confidence', () => {
  const root = createTempRoot();
  setupFeatureDir(root, 'only-feature', { techSpec: true, requests: true });

  const result = resolveFeatureContext(root, 'main', []);
  assert.equal(result.key, 'only-feature');
  assert.equal(result.source, 'single_dir');
  assert.equal(result.confidence, 'low');
});

test('Level 4 does not match when multiple feature dirs exist', () => {
  const root = createTempRoot();
  setupFeatureDir(root, 'feature-a', {});
  setupFeatureDir(root, 'feature-b', {});

  const result = resolveFeatureContext(root, 'main', []);
  assert.equal(result.key, null);
  assert.equal(result.source, 'none');
});

// --- Level 5: not found ---

test('Level 5 returns null when no docs/features/ dir exists', () => {
  const root = createTempRoot();

  const result = resolveFeatureContext(root, 'main', []);
  assert.equal(result.key, null);
  assert.equal(result.source, 'none');
  assert.equal(result.confidence, null);
});

// --- Options ---

test('Custom docsBase overrides default', () => {
  const root = createTempRoot();
  const customBase = join(root, 'custom', 'docs');
  mkdirSync(join(customBase, 'my-feat'), { recursive: true });
  writeFileSync(join(customBase, 'my-feat', '2-tech-spec.md'), '');

  const result = resolveFeatureContext(root, 'feat/my-feat', [], { docsBase: customBase });
  assert.equal(result.key, 'my-feat');
  assert.equal(result.has_tech_spec, true);
});

test('Custom techSpecPattern matches alternative naming', () => {
  const root = createTempRoot();
  const featureDir = join(root, 'docs', 'features', 'alt');
  mkdirSync(featureDir, { recursive: true });
  writeFileSync(join(featureDir, 'spec.md'), '');

  const result = resolveFeatureContext(root, 'feat/alt', [], { techSpecPattern: /^spec/ });
  assert.equal(result.has_tech_spec, true);
});

// --- Priority order ---

test('featureKey (Level 1) takes priority over branch (Level 2)', () => {
  const root = createTempRoot();
  setupFeatureDir(root, 'from-cli', {});
  setupFeatureDir(root, 'from-branch', {});

  const result = resolveFeatureContext(root, 'feat/from-branch', [], { featureKey: 'from-cli' });
  assert.equal(result.key, 'from-cli');
  assert.equal(result.source, 'cli');
});

test('branch (Level 2) takes priority over diff (Level 3)', () => {
  const root = createTempRoot();
  setupFeatureDir(root, 'from-branch', { techSpec: true });
  setupFeatureDir(root, 'from-diff', {});

  const result = resolveFeatureContext(root, 'feat/from-branch', ['docs/features/from-diff/requests/test.md']);
  assert.equal(result.key, 'from-branch');
  assert.equal(result.source, 'branch');
});

// --- CLI integration tests ---

test('CLI --feature returns valid JSON with correct key', () => {
  const output = execFileSync('node', [cliPath, '--feature', 'statusline-config'], {
    encoding: 'utf8',
    timeout: 5000,
  }).trim();
  const result = JSON.parse(output);
  assert.equal(result.key, 'statusline-config');
  assert.equal(result.source, 'cli');
  assert.equal(result.confidence, 'high');
});

test('CLI with invalid feature key returns null key', () => {
  const output = execFileSync('node', [cliPath, '--feature', '../escape'], {
    encoding: 'utf8',
    timeout: 5000,
  }).trim();
  const result = JSON.parse(output);
  assert.equal(result.key, null);
  assert.equal(result.source, 'none');
});

test('CLI without args returns valid JSON (auto-detect mode)', () => {
  const output = execFileSync('node', [cliPath], {
    encoding: 'utf8',
    timeout: 5000,
  }).trim();
  const result = JSON.parse(output);
  assert.ok('key' in result, 'output must have key field');
  assert.ok('source' in result, 'output must have source field');
  assert.ok('confidence' in result, 'output must have confidence field');
});
