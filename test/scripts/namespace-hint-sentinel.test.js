const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { resolve, join } = require('node:path');
const { mkdtempSync, mkdirSync, writeFileSync, rmSync } = require('node:fs');
const { execFileSync } = require('node:child_process');
const { tmpdir } = require('node:os');

const scriptPath = resolve(__dirname, '../../scripts/namespace-hint.sh');
const pluginRoot = resolve(__dirname, '../..');

const tempDirs = [];
after(() => {
  for (const dir of tempDirs) {
    try { rmSync(dir, { recursive: true }); } catch {}
  }
});

function createTempRepo(manifest) {
  const dir = mkdtempSync(join(tmpdir(), 'sentinel-test-'));
  tempDirs.push(dir);

  // Initialize git repo (required for git rev-parse)
  execFileSync('git', ['init', '--initial-branch=main'], { cwd: dir });
  execFileSync('git', ['config', 'user.email', 'test@test.com'], { cwd: dir });
  execFileSync('git', ['config', 'user.name', 'test'], { cwd: dir });

  // Create .claude/ with manifest
  const claudeDir = join(dir, '.claude');
  mkdirSync(claudeDir, { recursive: true });
  if (manifest !== null) {
    writeFileSync(join(claudeDir, '.sd0x-install-state.json'), manifest);
  }

  // Create initial commit so git rev-parse works
  writeFileSync(join(dir, '.gitignore'), '');
  execFileSync('git', ['add', '.'], { cwd: dir });
  execFileSync('git', ['-c', 'commit.gpgsign=false', 'commit', '-m', 'init'], { cwd: dir });

  return dir;
}

function runSentinel(repoDir) {
  return execFileSync('bash', [scriptPath], {
    encoding: 'utf8',
    cwd: repoDir,
    env: {
      ...process.env,
      CLAUDE_PLUGIN_ROOT: pluginRoot,
    },
  });
}

test('sentinel: no manifest → no warning', () => {
  const dir = createTempRepo(null);
  const output = runSentinel(dir);
  assert.ok(output.includes('sd0x-dev-flow'), 'should have namespace hint');
  assert.ok(!output.includes('⚠️'), 'should not have warning');
});

test('sentinel: version match → no warning', () => {
  // Read current plugin version (mirror runtime precedence: plugin.json → package.json)
  const fs = require('node:fs');
  const pluginJsonPath = join(pluginRoot, '.claude-plugin', 'plugin.json');
  const pkgJsonPath = join(pluginRoot, 'package.json');
  const currentVer = fs.existsSync(pluginJsonPath)
    ? require(pluginJsonPath).version
    : require(pkgJsonPath).version;

  const manifest = JSON.stringify({
    schema_version: 1,
    plugin_version: currentVer,
    rules: {},
  });
  const dir = createTempRepo(manifest);
  const output = runSentinel(dir);
  assert.ok(!output.includes('⚠️'), 'should not have warning when versions match');
});

test('sentinel: version mismatch → warning with versions', () => {
  const manifest = JSON.stringify({
    schema_version: 1,
    plugin_version: '0.0.1-stale',
    rules: {},
  });
  const dir = createTempRepo(manifest);
  const output = runSentinel(dir);
  assert.ok(output.includes('⚠️'), 'should have warning');
  assert.ok(output.includes('0.0.1-stale'), 'should show old version');
  assert.ok(output.includes('/sd0x-dev-flow:claude-health'), 'should suggest namespaced claude-health');
});

test('sentinel: corrupt manifest → no crash, no warning', () => {
  const dir = createTempRepo('{ invalid json !!!');
  const output = runSentinel(dir);
  assert.ok(!output.includes('⚠️'), 'should not crash or warn on invalid JSON');
  assert.ok(output.includes('sd0x-dev-flow'), 'should still have namespace hint');
});

test('sentinel: manifest without plugin_version → no warning', () => {
  const manifest = JSON.stringify({ schema_version: 1, rules: {} });
  const dir = createTempRepo(manifest);
  const output = runSentinel(dir);
  assert.ok(!output.includes('⚠️'), 'should not warn when no plugin_version in manifest');
});
