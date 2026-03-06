const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const {
  mkdtempSync,
  writeFileSync,
  chmodSync,
  rmSync,
  readFileSync,
} = require('node:fs');
const { join, resolve } = require('node:path');
const { tmpdir } = require('node:os');
const { execSync } = require('node:child_process');

const runnerPath = resolve(__dirname, '../../scripts/precommit-runner.js');
const tempDirs = [];

function createTempRepo(pkgJson, lockfile) {
  const dir = mkdtempSync(join(tmpdir(), 'sd0x-test-'));
  tempDirs.push(dir);
  execSync('git init', { cwd: dir, stdio: 'ignore' });
  execSync(
    'git -c user.name="test" -c user.email="test@test" commit --allow-empty -m "init"',
    { cwd: dir, stdio: 'ignore' }
  );
  writeFileSync(join(dir, 'package.json'), JSON.stringify(pkgJson));
  if (lockfile === 'pnpm') writeFileSync(join(dir, 'pnpm-lock.yaml'), '');
  if (lockfile === 'yarn') writeFileSync(join(dir, 'yarn.lock'), '');
  return dir;
}

function writeScript(dir, name, exitCode) {
  const scriptPath = join(dir, name);
  writeFileSync(scriptPath, `#!/bin/sh\nexit ${exitCode}\n`);
  chmodSync(scriptPath, 0o755);
  return `./${name}`;
}

function runPrecommit(dir, mode) {
  const cacheDir = mkdtempSync(join(tmpdir(), 'sd0x-cache-'));
  tempDirs.push(cacheDir);
  const env = {
    ...process.env,
    CLAUDE_PRECOMMIT_CACHE_DIR: cacheDir,
  };
  const stdout = execSync(`node ${runnerPath} --mode ${mode}`, {
    cwd: dir,
    env,
    encoding: 'utf8',
  });
  const match = stdout.match(/- logs: `([^`]+)`/);
  assert.ok(match, 'log dir not found in output');
  const logDir = match[1];
  const summary = JSON.parse(
    readFileSync(join(logDir, 'summary.json'), 'utf8')
  );
  return { stdout, summary, logDir };
}

after(() => {
  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('full precommit with all scripts passes', () => {
  const pkg = {
    name: 'temp',
    version: '1.0.0',
    scripts: {
      'lint:fix': './pass.sh',
      build: './pass.sh',
      'test:unit': './pass.sh',
    },
  };
  const dir = createTempRepo(pkg);
  writeScript(dir, 'pass.sh', 0);

  const { summary } = runPrecommit(dir, 'full');
  assert.equal(summary.overallPass, true);
  assert.deepEqual(
    summary.steps.map(step => step.name),
    ['lint_fix', 'build', 'test_unit']
  );
});

test('missing lint:fix still passes with fewer steps', () => {
  const pkg = {
    name: 'temp',
    version: '1.0.0',
    scripts: {
      'test:unit': './pass.sh',
    },
  };
  const dir = createTempRepo(pkg);
  writeScript(dir, 'pass.sh', 0);

  const { summary } = runPrecommit(dir, 'fast');
  assert.equal(summary.overallPass, true);
  assert.deepEqual(summary.steps.map(step => step.name), ['test_unit']);
});

test('fallback to test script when test:unit missing', () => {
  const pkg = {
    name: 'temp',
    version: '1.0.0',
    scripts: {
      test: './pass.sh',
    },
  };
  const dir = createTempRepo(pkg);
  writeScript(dir, 'pass.sh', 0);

  const { stdout, summary } = runPrecommit(dir, 'fast');
  assert.match(stdout, /test: using "test" \(fast mode\)/);
  assert.equal(summary.overallPass, true);
  assert.deepEqual(summary.steps.map(step => step.name), ['test_unit']);
});

test('build failure makes overallPass false', () => {
  const pkg = {
    name: 'temp',
    version: '1.0.0',
    scripts: {
      'lint:fix': './pass.sh',
      build: './fail.sh',
      'test:unit': './pass.sh',
    },
  };
  const dir = createTempRepo(pkg);
  writeScript(dir, 'pass.sh', 0);
  writeScript(dir, 'fail.sh', 1);

  const { summary } = runPrecommit(dir, 'full');
  assert.equal(summary.overallPass, false);
  const buildStep = summary.steps.find(step => step.name === 'build');
  assert.ok(buildStep, 'build step missing');
  assert.equal(buildStep.code, 1);
});

test('fast mode skips build step', () => {
  const pkg = {
    name: 'temp',
    version: '1.0.0',
    scripts: {
      'lint:fix': './pass.sh',
      build: './pass.sh',
      'test:unit': './pass.sh',
    },
  };
  const dir = createTempRepo(pkg);
  writeScript(dir, 'pass.sh', 0);

  const { summary } = runPrecommit(dir, 'fast');
  assert.equal(summary.overallPass, true);
  const buildStep = summary.steps.find(step => step.name === 'build');
  assert.equal(buildStep, undefined, 'build step should not exist in fast mode');
  assert.deepEqual(
    summary.steps.map(step => step.name),
    ['lint_fix', 'test_unit']
  );
});

// --- Test tiering preference chain tests ---

test('fast mode prefers test:fast over test:unit', () => {
  const pkg = {
    name: 'temp',
    version: '1.0.0',
    scripts: {
      'test:fast': './pass.sh',
      'test:unit': './fail.sh',
      test: './fail.sh',
    },
  };
  const dir = createTempRepo(pkg);
  writeScript(dir, 'pass.sh', 0);
  writeScript(dir, 'fail.sh', 1);

  const { stdout, summary } = runPrecommit(dir, 'fast');
  assert.equal(summary.overallPass, true, 'should run test:fast (pass) not test:unit (fail)');
  assert.match(stdout, /test: using "test:fast" \(fast mode\)/);
});

test('fast mode falls back to test:unit when no test:fast', () => {
  const pkg = {
    name: 'temp',
    version: '1.0.0',
    scripts: {
      'test:unit': './pass.sh',
      test: './fail.sh',
    },
  };
  const dir = createTempRepo(pkg);
  writeScript(dir, 'pass.sh', 0);
  writeScript(dir, 'fail.sh', 1);

  const { summary } = runPrecommit(dir, 'fast');
  assert.equal(summary.overallPass, true, 'should run test:unit (pass) not test (fail)');
});

test('full mode prefers test:ci over test', () => {
  const pkg = {
    name: 'temp',
    version: '1.0.0',
    scripts: {
      'test:ci': './pass.sh',
      test: './fail.sh',
      'test:unit': './fail.sh',
    },
  };
  const dir = createTempRepo(pkg);
  writeScript(dir, 'pass.sh', 0);
  writeScript(dir, 'fail.sh', 1);

  const { stdout, summary } = runPrecommit(dir, 'full');
  assert.equal(summary.overallPass, true, 'should run test:ci (pass) not test (fail)');
  assert.match(stdout, /test: using "test:ci" \(full mode\)/);
});

test('full mode falls back to test when no test:ci', () => {
  const pkg = {
    name: 'temp',
    version: '1.0.0',
    scripts: {
      test: './pass.sh',
      'test:unit': './fail.sh',
    },
  };
  const dir = createTempRepo(pkg);
  writeScript(dir, 'pass.sh', 0);
  writeScript(dir, 'fail.sh', 1);

  const { stdout, summary } = runPrecommit(dir, 'full');
  assert.equal(summary.overallPass, true, 'should run test (pass) not test:unit (fail)');
  assert.match(stdout, /test: using "test" \(full mode\)/);
});

test('full mode falls back to test:fast when no test:ci or test', () => {
  const pkg = {
    name: 'temp',
    version: '1.0.0',
    scripts: {
      'test:fast': './pass.sh',
      'test:unit': './fail.sh',
    },
  };
  const dir = createTempRepo(pkg);
  writeScript(dir, 'pass.sh', 0);
  writeScript(dir, 'fail.sh', 1);

  const { stdout, summary } = runPrecommit(dir, 'full');
  assert.equal(summary.overallPass, true, 'should run test:fast (pass) not test:unit (fail)');
  assert.match(stdout, /test: using "test:fast" \(full mode\)/);
});
