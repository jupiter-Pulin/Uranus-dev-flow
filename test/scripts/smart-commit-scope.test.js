'use strict';

const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const {
  mkdtempSync,
  writeFileSync,
  rmSync,
} = require('node:fs');
const { join, resolve } = require('node:path');
const { tmpdir } = require('node:os');
const { spawnSync } = require('node:child_process');

const { resolveSessionScope } = require(resolve(__dirname, '../../scripts/lib/session-scope-resolver.js'));

const tempDirs = [];

function makeTempDir(prefix) {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

function setupGitRepo(dir) {
  spawnSync('git', ['init', '--initial-branch=main'], { cwd: dir });
  spawnSync('git', ['config', 'user.email', 'test@test.com'], { cwd: dir });
  spawnSync('git', ['config', 'user.name', 'test'], { cwd: dir });
  writeFileSync(join(dir, '.gitignore'), '');
  spawnSync('git', ['add', '.'], { cwd: dir });
  spawnSync('git', ['-c', 'commit.gpgsign=false', 'commit', '-m', 'init'], { cwd: dir });
}

after(() => {
  for (const d of tempDirs) {
    try { rmSync(d, { recursive: true, force: true }); } catch {}
  }
});

// =============================================================================
// session-aware mode tests
// =============================================================================

test('scope-resolver: session-aware includes only touched unstaged files', () => {
  const workDir = makeTempDir('sd0x-scope-resolver-aware-');
  setupGitRepo(workDir);

  // Create dirty files
  writeFileSync(join(workDir, 'touched.ts'), 'export const x = 1;');
  writeFileSync(join(workDir, 'untouched.ts'), 'export const y = 2;');

  writeFileSync(
    join(workDir, '.claude_review_state.json'),
    JSON.stringify({
      session_id: 'sess-1',
      session_commit_scope: {
        session_id: 'sess-1',
        baseline_dirty_files: [],
        touched_files: ['touched.ts'],
      },
    })
  );

  const result = resolveSessionScope({ cwd: workDir });
  assert.equal(result.mode, 'session-aware');
  assert.ok(result.included.includes('touched.ts'), 'touched file should be included');
  assert.ok(result.excluded.includes('untouched.ts'), 'untouched file should be excluded');
});

test('scope-resolver: staged files always included regardless of touched', () => {
  const workDir = makeTempDir('sd0x-scope-resolver-staged-');
  setupGitRepo(workDir);

  writeFileSync(join(workDir, 'staged.ts'), 'export const a = 1;');
  spawnSync('git', ['add', 'staged.ts'], { cwd: workDir });

  writeFileSync(
    join(workDir, '.claude_review_state.json'),
    JSON.stringify({
      session_id: 'sess-2',
      session_commit_scope: {
        session_id: 'sess-2',
        baseline_dirty_files: [],
        touched_files: [],  // not in touched_files
      },
    })
  );

  const result = resolveSessionScope({ cwd: workDir });
  assert.equal(result.mode, 'session-aware');
  assert.ok(result.included.includes('staged.ts'), 'staged file should be included');
});

test('scope-resolver: pre-existing + touched produces warning', () => {
  const workDir = makeTempDir('sd0x-scope-resolver-warn-');
  setupGitRepo(workDir);

  writeFileSync(join(workDir, 'mixed.ts'), 'export const z = 3;');

  writeFileSync(
    join(workDir, '.claude_review_state.json'),
    JSON.stringify({
      session_id: 'sess-3',
      session_commit_scope: {
        session_id: 'sess-3',
        baseline_dirty_files: ['mixed.ts'],
        touched_files: ['mixed.ts'],
      },
    })
  );

  const result = resolveSessionScope({ cwd: workDir });
  assert.equal(result.mode, 'session-aware');
  assert.ok(result.included.includes('mixed.ts'), 'touched file included even if baseline');
  assert.ok(result.warned.includes('mixed.ts'), 'should be in warned set');
});

// =============================================================================
// --all mode tests
// =============================================================================

test('scope-resolver: --all includes all dirty files', () => {
  const workDir = makeTempDir('sd0x-scope-resolver-all-');
  setupGitRepo(workDir);

  writeFileSync(join(workDir, 'a.ts'), 'a');
  writeFileSync(join(workDir, 'b.ts'), 'b');

  writeFileSync(
    join(workDir, '.claude_review_state.json'),
    JSON.stringify({
      session_id: 'sess-4',
      session_commit_scope: {
        session_id: 'sess-4',
        baseline_dirty_files: [],
        touched_files: ['a.ts'],  // only a.ts touched
      },
    })
  );

  const result = resolveSessionScope({ cwd: workDir, all: true });
  assert.equal(result.mode, 'all');
  assert.ok(result.included.includes('a.ts'));
  assert.ok(result.included.includes('b.ts'));
  assert.deepEqual(result.excluded, []);
});

// =============================================================================
// Fallback tests
// =============================================================================

test('scope-resolver: missing state file falls back to all mode', () => {
  const workDir = makeTempDir('sd0x-scope-resolver-nostate-');
  setupGitRepo(workDir);

  writeFileSync(join(workDir, 'orphan.ts'), 'x');

  const result = resolveSessionScope({ cwd: workDir });
  assert.equal(result.mode, 'all');
  assert.ok(result.included.includes('orphan.ts'));
});

test('scope-resolver: stale scope (session_id mismatch) falls back to all', () => {
  const workDir = makeTempDir('sd0x-scope-resolver-stale-');
  setupGitRepo(workDir);

  writeFileSync(join(workDir, 'file.ts'), 'y');

  writeFileSync(
    join(workDir, '.claude_review_state.json'),
    JSON.stringify({
      session_id: 'current-sess',
      session_commit_scope: {
        session_id: 'old-sess',  // mismatched
        baseline_dirty_files: [],
        touched_files: [],
      },
    })
  );

  const result = resolveSessionScope({ cwd: workDir });
  assert.equal(result.mode, 'all');
});

test('scope-resolver: null baseline_dirty_files falls back to all', () => {
  const workDir = makeTempDir('sd0x-scope-resolver-nullbl-');
  setupGitRepo(workDir);

  writeFileSync(join(workDir, 'file.ts'), 'z');

  writeFileSync(
    join(workDir, '.claude_review_state.json'),
    JSON.stringify({
      session_id: 'sess-null',
      session_commit_scope: {
        session_id: 'sess-null',
        baseline_dirty_files: null,  // non-git repo fallback
        touched_files: [],
      },
    })
  );

  const result = resolveSessionScope({ cwd: workDir });
  assert.equal(result.mode, 'all');
});

test('scope-resolver: empty touched_files includes only staged', () => {
  const workDir = makeTempDir('sd0x-scope-resolver-notouch-');
  setupGitRepo(workDir);

  writeFileSync(join(workDir, 'unstaged.ts'), 'a');

  writeFileSync(
    join(workDir, '.claude_review_state.json'),
    JSON.stringify({
      session_id: 'sess-empty',
      session_commit_scope: {
        session_id: 'sess-empty',
        baseline_dirty_files: [],
        touched_files: [],
      },
    })
  );

  const result = resolveSessionScope({ cwd: workDir });
  assert.equal(result.mode, 'session-aware');
  assert.deepEqual(result.included, [], 'nothing staged, nothing touched');
  assert.ok(result.excluded.includes('unstaged.ts'));
});
