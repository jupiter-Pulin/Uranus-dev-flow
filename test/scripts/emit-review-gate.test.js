const { test } = require('node:test');
const assert = require('node:assert/strict');
const { resolve } = require('node:path');
const { statSync } = require('node:fs');
const { execFileSync } = require('node:child_process');

const scriptPath = resolve(__dirname, '../../scripts/emit-review-gate.sh');

test('emit-review-gate.sh exists and is executable', () => {
  const stat = statSync(scriptPath);
  assert.ok(stat.isFile(), 'script should be a file');
  assert.ok((stat.mode & 0o100) !== 0, 'script should be executable');
});

test('emits REVIEW_GATE=PENDING for PENDING arg', () => {
  const output = execFileSync('bash', [scriptPath, 'PENDING'], { encoding: 'utf8' });
  assert.equal(output.trim(), 'REVIEW_GATE=PENDING');
});

test('emits REVIEW_GATE=READY for READY arg', () => {
  const output = execFileSync('bash', [scriptPath, 'READY'], { encoding: 'utf8' });
  assert.equal(output.trim(), 'REVIEW_GATE=READY');
});

test('emits REVIEW_GATE=BLOCKED for BLOCKED arg', () => {
  const output = execFileSync('bash', [scriptPath, 'BLOCKED'], { encoding: 'utf8' });
  assert.equal(output.trim(), 'REVIEW_GATE=BLOCKED');
});

test('exits non-zero with no arguments', () => {
  try {
    execFileSync('bash', [scriptPath], { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    assert.fail('should have thrown');
  } catch (err) {
    if (err.code === 'ERR_ASSERTION') throw err;
    assert.ok(err.status !== 0, 'exit code should be non-zero');
    const output = (err.stdout || '') + (err.stderr || '');
    assert.ok(output.includes('Usage:'), `should show usage, got: ${output}`);
  }
});

test('exits non-zero with invalid argument', () => {
  try {
    execFileSync('bash', [scriptPath, 'INVALID'], { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    assert.fail('should have thrown');
  } catch (err) {
    if (err.code === 'ERR_ASSERTION') throw err;
    assert.ok(err.status !== 0, 'exit code should be non-zero');
    const output = (err.stdout || '') + (err.stderr || '');
    assert.ok(output.includes('invalid gate value'), `should show error, got: ${output}`);
  }
});

test('exits non-zero with extra arguments', () => {
  try {
    execFileSync('bash', [scriptPath, 'READY', 'extra'], { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    assert.fail('should have thrown');
  } catch (err) {
    if (err.code === 'ERR_ASSERTION') throw err;
    assert.ok(err.status !== 0, 'exit code should be non-zero');
    const output = (err.stdout || '') + (err.stderr || '');
    assert.ok(output.includes('Usage:'), `should show usage, got: ${output}`);
  }
});

test('rejects lowercase variants', () => {
  for (const val of ['pending', 'ready', 'blocked']) {
    try {
      execFileSync('bash', [scriptPath, val], { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
      assert.fail(`should reject '${val}'`);
    } catch (err) {
      if (err.code === 'ERR_ASSERTION') throw err;
      assert.ok(err.status !== 0, `'${val}' should exit non-zero`);
    }
  }
});
