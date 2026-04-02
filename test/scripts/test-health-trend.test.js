const { test } = require('node:test');
const assert = require('node:assert/strict');
const { resolve, join } = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const {
  getRepoKey, getCacheDir, lock, unlock,
  readLatest, writeSnapshot, computeDelta, pruneHistory,
} = require(resolve(__dirname, '../../skills/test-health/scripts/trend'));

function makeTmpDir() {
  return fs.mkdtempSync(join(os.tmpdir(), 'test-health-trend-'));
}

// --- getRepoKey ---

test('getRepoKey returns slug--hash format', () => {
  const key = getRepoKey('/tmp/my-repo');
  assert.match(key, /^my-repo--[a-f0-9]{8}$/);
});

// --- lock / unlock ---

test('lock acquires and unlock releases', () => {
  const dir = makeTmpDir();
  try {
    const acquired = lock(dir, 1, 60);
    assert.equal(acquired, true);
    assert.ok(fs.existsSync(join(dir, '.lock')));
    unlock(dir);
    assert.ok(!fs.existsSync(join(dir, '.lock')));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('lock fails after timeout when already held', () => {
  const dir = makeTmpDir();
  try {
    fs.mkdirSync(join(dir, '.lock'));
    const start = Date.now();
    const acquired = lock(dir, 0.2, 9999);
    const elapsed = Date.now() - start;
    assert.equal(acquired, false);
    assert.ok(elapsed >= 150, `Expected timeout delay, got ${elapsed}ms`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('lock returns false on non-EEXIST error', () => {
  // Use a path that doesn't exist (no parent dir) to trigger ENOENT
  const dir = join(os.tmpdir(), 'nonexistent-' + Date.now(), 'nested');
  const result = lock(dir, 0.1, 60);
  assert.equal(result, false);
});

test('lock recovers stale lock', () => {
  const dir = makeTmpDir();
  try {
    const lockDir = join(dir, '.lock');
    fs.mkdirSync(lockDir);
    // Backdate mtime by 120s to simulate stale lock
    const past = new Date(Date.now() - 120_000);
    fs.utimesSync(lockDir, past, past);
    const acquired = lock(dir, 1, 60);
    assert.equal(acquired, true);
    unlock(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// --- writeSnapshot + readLatest ---

test('writeSnapshot + readLatest roundtrip', () => {
  const dir = makeTmpDir();
  try {
    const snapshot = {
      timestamp: '2026-04-01T10:00:00Z',
      sha: 'abc1234',
      code_coverage: { lines: { covered: 80, total: 100, pct: 80 }, source_type: 'lcov', tool_id: 'lcov' },
    };
    writeSnapshot(dir, snapshot);
    const latest = readLatest(dir);
    assert.deepEqual(latest.code_coverage, snapshot.code_coverage);
    assert.equal(latest.sha, 'abc1234');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('readLatest returns null when no snapshot exists', () => {
  const dir = makeTmpDir();
  try {
    assert.equal(readLatest(dir), null);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// --- computeDelta ---

test('computeDelta computes coverage improvement', () => {
  const current = {
    code_coverage: { lines: { pct: 85 }, branches: { pct: 70 }, tool_id: 'lcov', source_type: 'lcov' },
  };
  const previous = {
    code_coverage: { lines: { pct: 80 }, branches: { pct: 65 }, tool_id: 'lcov', source_type: 'lcov' },
  };
  const delta = computeDelta(current, previous);
  assert.equal(delta.line_coverage.value, 5);
  assert.equal(delta.line_coverage.direction, '\u2191');
  assert.equal(delta.branch_coverage.value, 5);
});

test('computeDelta returns coverage_reset when tool changes', () => {
  const current = {
    code_coverage: { lines: { pct: 85 }, tool_id: 'istanbul', source_type: 'istanbul-json' },
  };
  const previous = {
    code_coverage: { lines: { pct: 80 }, tool_id: 'lcov', source_type: 'lcov' },
  };
  const delta = computeDelta(current, previous);
  assert.ok(delta.coverage_reset);
  assert.match(delta.coverage_reset, /lcov.*istanbul/);
});

test('computeDelta returns null when no previous', () => {
  assert.equal(computeDelta({ code_coverage: {} }, null), null);
});

test('computeDelta handles count_level mismatch in test_counts', () => {
  const current = {
    test_inventory: { unit: { tests: 50, count_level: 'test_case' } },
  };
  const previous = {
    test_inventory: { unit: { tests: 10, count_level: 'package' } },
  };
  const delta = computeDelta(current, previous);
  assert.ok(delta.test_counts.unit.reset);
  assert.match(delta.test_counts.unit.reset, /package.*test_case/);
});

test('computeDelta computes test count delta when same count_level', () => {
  const current = {
    test_inventory: { unit: { tests: 50, count_level: 'test_case' }, integration: { tests: 10, count_level: 'test_case' } },
  };
  const previous = {
    test_inventory: { unit: { tests: 45, count_level: 'test_case' }, integration: { tests: 10, count_level: 'test_case' } },
  };
  const delta = computeDelta(current, previous);
  assert.equal(delta.test_counts.unit.value, 5);
  assert.equal(delta.test_counts.unit.direction, '\u2191');
  assert.equal(delta.test_counts.integration.value, 0);
  assert.equal(delta.test_counts.integration.direction, '\u2192');
});

// --- pruneHistory ---

test('pruneHistory removes oldest entries beyond maxItems', () => {
  const dir = makeTmpDir();
  try {
    const historyDir = join(dir, 'history');
    fs.mkdirSync(historyDir, { recursive: true });
    // Create 35 snapshot files
    for (let i = 0; i < 35; i++) {
      const ts = `2026-04-${String(i + 1).padStart(2, '0')}`;
      fs.writeFileSync(join(historyDir, `${ts}--sha${i}.json`), '{}');
    }
    const removed = pruneHistory(dir, 30);
    assert.equal(removed, 5);
    const remaining = fs.readdirSync(historyDir).filter(f => f.endsWith('.json'));
    assert.equal(remaining.length, 30);
    // Oldest files should be removed (sorted alphabetically, first 5 removed)
    assert.ok(!remaining.includes('2026-04-01--sha0.json'));
    assert.ok(remaining.includes('2026-04-06--sha5.json'));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('pruneHistory returns 0 when within limit', () => {
  const dir = makeTmpDir();
  try {
    const historyDir = join(dir, 'history');
    fs.mkdirSync(historyDir, { recursive: true });
    fs.writeFileSync(join(historyDir, 'snap1.json'), '{}');
    assert.equal(pruneHistory(dir, 30), 0);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('pruneHistory returns 0 when history dir missing', () => {
  const dir = makeTmpDir();
  try {
    assert.equal(pruneHistory(dir, 30), 0);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
