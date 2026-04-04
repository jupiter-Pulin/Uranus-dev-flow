const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { resolve, join } = require('node:path');
const { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } = require('node:fs');
const { spawnSync } = require('node:child_process');
const { tmpdir } = require('node:os');

const hookPath = resolve(__dirname, '../../hooks/user-prompt-review-guard.sh');

const tempDirs = [];
after(() => {
  for (const dir of tempDirs) {
    try { rmSync(dir, { recursive: true }); } catch {}
  }
});

function createWorkDir(stateJson, cooldownAge) {
  const dir = mkdtempSync(join(tmpdir(), 'ups-test-'));
  tempDirs.push(dir);

  // Init git repo (required for git status)
  spawnSync('git', ['init', '--initial-branch=main'], { cwd: dir });
  spawnSync('git', ['config', 'user.email', 'test@test.com'], { cwd: dir });
  spawnSync('git', ['config', 'user.name', 'test'], { cwd: dir });
  writeFileSync(join(dir, '.gitignore'), '');
  spawnSync('git', ['add', '.'], { cwd: dir });
  spawnSync('git', ['-c', 'commit.gpgsign=false', 'commit', '-m', 'init'], { cwd: dir });

  // Create tracked files so modifications show in `git status -uno`
  writeFileSync(join(dir, 'app.js'), '// placeholder');
  writeFileSync(join(dir, 'README.md'), '# placeholder');
  spawnSync('git', ['add', '.'], { cwd: dir });
  spawnSync('git', ['-c', 'commit.gpgsign=false', 'commit', '-m', 'add tracked files'], { cwd: dir });

  if (stateJson !== null) {
    writeFileSync(join(dir, '.claude_review_state.json'), JSON.stringify(stateJson));
  }

  // Create cooldown file if specified (seconds ago)
  const cooldownFile = join(dir, '.cooldown_test');
  if (cooldownAge !== undefined) {
    const timestamp = Math.floor(Date.now() / 1000) - cooldownAge;
    writeFileSync(cooldownFile, String(timestamp));
  }

  return { dir, cooldownFile };
}

function runHook(cwd, env) {
  return spawnSync('bash', [hookPath], {
    encoding: 'utf8',
    cwd,
    env: {
      ...process.env,
      TMPDIR: tmpdir(),
      ...env,
    },
  });
}

test('pending code review → output contains [PENDING_REVIEW] and /codex-review-fast', () => {
  const { dir, cooldownFile } = createWorkDir({
    has_code_change: true,
    code_review: { passed: false },
    precommit: { passed: false },
  });
  writeFileSync(join(dir, 'app.js'), 'console.log("dirty")'); // modify tracked file

  const result = runHook(dir, { REVIEW_GUARD_COOLDOWN: '0', REVIEW_GUARD_COOLDOWN_FILE: cooldownFile });
  assert.equal(result.status, 0);
  assert.ok(result.stdout.includes('[PENDING_REVIEW]'), 'should contain [PENDING_REVIEW]');
  assert.ok(result.stdout.includes('/codex-review-fast'), 'should suggest /codex-review-fast');
});

test('pending precommit → output contains /precommit', () => {
  const { dir, cooldownFile } = createWorkDir({
    has_code_change: true,
    code_review: { passed: true },
    precommit: { passed: false },
  });
  writeFileSync(join(dir, 'app.js'), 'console.log("dirty")'); // modify tracked file

  const result = runHook(dir, { REVIEW_GUARD_COOLDOWN: '0', REVIEW_GUARD_COOLDOWN_FILE: cooldownFile });
  assert.equal(result.status, 0);
  assert.ok(result.stdout.includes('/precommit'), 'should suggest /precommit');
});

test('pending doc review → output contains /codex-review-doc', () => {
  const { dir, cooldownFile } = createWorkDir({
    has_doc_change: true,
    doc_review: { passed: false },
    has_code_change: false,
  });
  writeFileSync(join(dir, 'README.md'), '# modified'); // modify tracked file

  const result = runHook(dir, { REVIEW_GUARD_COOLDOWN: '0', REVIEW_GUARD_COOLDOWN_FILE: cooldownFile });
  assert.equal(result.status, 0);
  assert.ok(result.stdout.includes('/codex-review-doc'), 'should suggest /codex-review-doc');
});

test('all gates pass → silent (no stdout)', () => {
  const { dir, cooldownFile } = createWorkDir({
    has_code_change: true,
    code_review: { passed: true },
    precommit: { passed: true },
  });

  const result = runHook(dir, { REVIEW_GUARD_COOLDOWN_FILE: cooldownFile });
  assert.equal(result.status, 0);
  assert.equal(result.stdout.trim(), '', 'should be silent when all gates pass');
});

test('no state file → silent', () => {
  const { dir, cooldownFile } = createWorkDir(null);

  const result = runHook(dir, { REVIEW_GUARD_COOLDOWN_FILE: cooldownFile });
  assert.equal(result.status, 0);
  assert.equal(result.stdout.trim(), '', 'should be silent without state file');
});

test('no changes tracked → silent', () => {
  const { dir, cooldownFile } = createWorkDir({
    has_code_change: false,
    has_doc_change: false,
  });

  const result = runHook(dir, { REVIEW_GUARD_COOLDOWN_FILE: cooldownFile });
  assert.equal(result.status, 0);
  assert.equal(result.stdout.trim(), '', 'should be silent when no changes tracked');
});

test('cooldown active (recent injection) → silent', () => {
  const { dir, cooldownFile } = createWorkDir({
    has_code_change: true,
    code_review: { passed: false },
  }, 60); // injected 60 seconds ago
  writeFileSync(join(dir, 'app.js'), 'console.log("dirty")'); // modify tracked file

  const result = runHook(dir, { REVIEW_GUARD_COOLDOWN: '300', REVIEW_GUARD_COOLDOWN_FILE: cooldownFile });
  assert.equal(result.status, 0);
  assert.equal(result.stdout.trim(), '', 'should be silent during cooldown');
});

test('cooldown expired → inject', () => {
  const { dir, cooldownFile } = createWorkDir({
    has_code_change: true,
    code_review: { passed: false },
  }, 400); // injected 400 seconds ago (> 300s cooldown)
  writeFileSync(join(dir, 'app.js'), 'console.log("dirty")'); // modify tracked file

  const result = runHook(dir, { REVIEW_GUARD_COOLDOWN: '300', REVIEW_GUARD_COOLDOWN_FILE: cooldownFile });
  assert.equal(result.status, 0);
  assert.ok(result.stdout.includes('[PENDING_REVIEW]'), 'should inject after cooldown expires');
});

test('stale state: git clean but state says code changed → reconcile to false → silent', () => {
  const { dir, cooldownFile } = createWorkDir({
    has_code_change: true,
    code_review: { passed: false },
  });
  // No dirty files — git is clean, state is stale

  const result = runHook(dir, { REVIEW_GUARD_COOLDOWN: '0', REVIEW_GUARD_COOLDOWN_FILE: cooldownFile });
  assert.equal(result.status, 0);
  assert.equal(result.stdout.trim(), '', 'should reconcile stale state and stay silent');
});

test('sidecar .blocked marker forces doc review reminder', () => {
  const { dir, cooldownFile } = createWorkDir({
    has_doc_change: true,
    has_code_change: false,
    doc_review: { passed: true },
    code_review: { passed: false },
    precommit: { passed: false },
  });
  writeFileSync(join(dir, 'README.md'), '# modified');
  writeFileSync(join(dir, '.claude_review_state.json.blocked'), 'lock_failure');
  const result = runHook(dir, { REVIEW_GUARD_COOLDOWN: '0', REVIEW_GUARD_COOLDOWN_FILE: cooldownFile });
  assert.equal(result.status, 0);
  assert.ok(
    result.stdout.includes('/codex-review-doc'),
    'sidecar should force doc review reminder despite doc_review.passed=true'
  );
});

test('hook always exits 0 (non-blocking)', () => {
  const { dir, cooldownFile } = createWorkDir({
    has_code_change: true,
    code_review: { passed: false },
  });
  writeFileSync(join(dir, 'app.js'), 'console.log("dirty")'); // modify tracked file

  const result = runHook(dir, { REVIEW_GUARD_COOLDOWN: '0', REVIEW_GUARD_COOLDOWN_FILE: cooldownFile });
  assert.equal(result.status, 0, 'hook must always exit 0');
});
