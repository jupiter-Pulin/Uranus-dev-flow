const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const {
  mkdtempSync,
  writeFileSync,
  readFileSync,
  existsSync,
  chmodSync,
  rmSync,
} = require('node:fs');
const { join, resolve } = require('node:path');
const { tmpdir } = require('node:os');
const { spawnSync } = require('node:child_process');

const hookPath = resolve(__dirname, '../../hooks/session-init.sh');
const tempDirs = [];

function makeTempDir(prefix) {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

// Uses real jq (required: jq >= 1.6)

function runHook({ cwd, input }) {
  return spawnSync('bash', [hookPath], {
    cwd,
    input: JSON.stringify(input),
    encoding: 'utf8',
    env: { ...process.env },
  });
}

after(() => {
  for (const d of tempDirs) {
    try { rmSync(d, { recursive: true, force: true }); } catch {}
  }
});

// ---------------------------------------------------------------------------
// D-2: Session Lifecycle Reset tests
// ---------------------------------------------------------------------------

test('session-init: new session resets review state', () => {
  const workDir = makeTempDir('sd0x-session-init-reset-');

  writeFileSync(
    join(workDir, '.claude_review_state.json'),
    JSON.stringify({
      schema_version: 2,
      session_id: 'old-session-abc',
      has_code_change: true,
      has_doc_change: true,
      code_review: { executed: true, passed: true },
      precommit: { executed: true, passed: true },
      iteration_history: {
        current_round: 5,
        total_rounds_session: 8,
        strategic_reset_fired: false,
        findings_by_round: [{ round: 1, total: 3 }],
      },
    })
  );
  const result = runHook({
    cwd: workDir,
    input: { session_id: 'new-session-xyz' },
  });
  assert.equal(result.status, 0);
  const state = JSON.parse(readFileSync(join(workDir, '.claude_review_state.json'), 'utf8'));
  assert.equal(state.session_id, 'new-session-xyz');
  assert.equal(state.has_code_change, false);
  assert.equal(state.code_review.passed, false);
  assert.equal(state.iteration_history.current_round, 0);
  // total_rounds_session should be preserved
  assert.equal(state.iteration_history.total_rounds_session, 8);
});

test('session-init: same session does not reset', () => {
  const workDir = makeTempDir('sd0x-session-init-same-');

  const original = {
    schema_version: 2,
    session_id: 'same-session',
    has_code_change: true,
    code_review: { executed: true, passed: true },
  };
  writeFileSync(join(workDir, '.claude_review_state.json'), JSON.stringify(original));
  const result = runHook({
    cwd: workDir,
    input: { session_id: 'same-session' },
  });
  assert.equal(result.status, 0);
  const state = JSON.parse(readFileSync(join(workDir, '.claude_review_state.json'), 'utf8'));
  assert.equal(state.has_code_change, true, 'should not reset for same session');
  assert.equal(state.code_review.passed, true, 'should preserve review state');
});

test('session-init: no state file creates minimal', () => {
  const workDir = makeTempDir('sd0x-session-init-new-');

  const result = runHook({
    cwd: workDir,
    input: { session_id: 'first-session' },
  });
  assert.equal(result.status, 0);
  assert.ok(existsSync(join(workDir, '.claude_review_state.json')));
  const state = JSON.parse(readFileSync(join(workDir, '.claude_review_state.json'), 'utf8'));
  assert.equal(state.schema_version, 2);
  assert.equal(state.session_id, 'first-session');
});

test('session-init: empty session_id is a no-op', () => {
  const workDir = makeTempDir('sd0x-session-init-empty-');

  const result = runHook({
    cwd: workDir,
    input: {},
  });
  assert.equal(result.status, 0);
  assert.ok(!existsSync(join(workDir, '.claude_review_state.json')), 'should not create state file');
});

test('session-init: empty session_id legacy state gets full reset', () => {
  const workDir = makeTempDir('sd0x-session-init-legacy-');

  writeFileSync(
    join(workDir, '.claude_review_state.json'),
    JSON.stringify({
      schema_version: 2,
      session_id: '',
      has_code_change: true,
      code_review: { executed: true, passed: true },
    })
  );
  const result = runHook({
    cwd: workDir,
    input: { session_id: 'new-session' },
  });
  assert.equal(result.status, 0);
  const state = JSON.parse(readFileSync(join(workDir, '.claude_review_state.json'), 'utf8'));
  assert.equal(state.session_id, 'new-session');
  assert.equal(state.has_code_change, false, 'should reset stale flags');
  assert.equal(state.code_review.passed, false, 'should reset review state');
});
