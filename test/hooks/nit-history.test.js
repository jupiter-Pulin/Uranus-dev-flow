const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const {
  mkdtempSync,
  writeFileSync,
  readFileSync,
  existsSync,
  rmSync,
  chmodSync,
} = require('node:fs');
const { join, resolve } = require('node:path');
const { tmpdir } = require('node:os');
const { spawnSync, execFileSync } = require('node:child_process');

const hookPath = resolve(__dirname, '../../hooks/post-tool-review-state.sh');
const tempDirs = [];

function makeTempDir(prefix) {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

after(() => {
  for (const d of tempDirs) {
    rmSync(d, { recursive: true, force: true });
  }
});

// Check if real jq is available
const hasJq = (() => {
  try {
    execFileSync('jq', ['--version'], { encoding: 'utf8', stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
})();

// Check if shasum is available
const hasShasum = (() => {
  try {
    const result = spawnSync('bash', ['-c', 'command -v shasum || command -v sha256sum'], {
      encoding: 'utf8',
      stdio: 'pipe',
    });
    return result.status === 0;
  } catch {
    return false;
  }
})();

// Helper: run a bash snippet that sources the hook functions
function runNitFunction(workDir, fnCall) {
  const script = `
    set -euo pipefail
    NIT_HISTORY_FILE="${workDir}/.claude_nit_history.json"
    STATE_FILE="${workDir}/.claude_review_state.json"
    LOCKDIR="${workDir}/.claude_review_state.json.lockdir"
    LOCK_TIMEOUT=5
    LOCK_TTL=30
    HAVE_LOCK=0
    _lock() { HAVE_LOCK=1; return 0; }
    _unlock() { HAVE_LOCK=0; }
    NIT_LOCKDIR="${workDir}/.claude_nit_history.json.lockdir"
    NIT_HAVE_LOCK=0
    eval "$(awk '/^_nit_lock\(\)/,/^check_passed\(\)/' "${hookPath}" | sed '$ d')"
    ${fnCall}
  `;
  return spawnSync('bash', ['-c', script], {
    cwd: workDir,
    encoding: 'utf8',
    env: { ...process.env },
  });
}

function readNitHistory(workDir) {
  const p = join(workDir, '.claude_nit_history.json');
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, 'utf8'));
}

const skipMsg = !hasJq ? 'jq not available' : (!hasShasum ? 'shasum not available' : undefined);

// --- Canonicalization ---

test('_canonicalize_issue normalizes text correctly', { skip: skipMsg }, () => {
  const workDir = makeTempDir('sd0x-nit-canon-');
  const result = runNitFunction(workDir, '_canonicalize_issue "Line 42 error in Method"');
  assert.equal(result.status, 0, `stderr: ${result.stderr}`);
  const output = result.stdout.trim();
  assert.ok(!output.includes('42'), 'should replace numbers with N');
  assert.ok(!output.includes('Line'), 'should lowercase');
  assert.ok(output.includes('error'), 'should preserve words');
  assert.ok(output.includes('method'), 'should lowercase method');
});

test('_canonicalize_issue strips markdown control chars', { skip: skipMsg }, () => {
  const workDir = makeTempDir('sd0x-nit-canon2-');
  // Use printf to avoid shell interpretation of special chars
  const result = runNitFunction(workDir, `_canonicalize_issue 'some **bold** text with a #heading and >quote'`);
  assert.equal(result.status, 0, `stderr: ${result.stderr}`);
  const output = result.stdout.trim();
  assert.ok(!output.includes('**'), 'should strip bold markers');
  assert.ok(!output.includes('#'), 'should strip heading markers');
  assert.ok(!output.includes('>'), 'should strip quote markers');
  assert.ok(output.includes('some'), 'should preserve content words');
  assert.ok(output.includes('bold'), 'should preserve bold text');
});

test('_canonicalize_issue truncates to 120 chars', { skip: skipMsg }, () => {
  const workDir = makeTempDir('sd0x-nit-trunc-');
  const longIssue = 'a'.repeat(200);
  const result = runNitFunction(workDir, `_canonicalize_issue "${longIssue}"`);
  assert.equal(result.status, 0, `stderr: ${result.stderr}`);
  assert.ok(result.stdout.trim().length <= 120, 'should truncate to 120 chars');
});

// --- Hash ---

test('_compute_hash produces deterministic 16-char hex', { skip: skipMsg }, () => {
  const workDir = makeTempDir('sd0x-nit-hash-');
  const r1 = runNitFunction(workDir, '_compute_hash "src/a.ts" "naming convention"');
  const r2 = runNitFunction(workDir, '_compute_hash "src/a.ts" "naming convention"');
  assert.equal(r1.status, 0, `stderr: ${r1.stderr}`);
  assert.equal(r2.status, 0);
  const h1 = r1.stdout.trim();
  const h2 = r2.stdout.trim();
  assert.equal(h1.length, 16, 'hash should be 16 chars');
  assert.match(h1, /^[0-9a-f]{16}$/, 'hash should be hex');
  assert.equal(h1, h2, 'same input should produce same hash');
});

test('_compute_hash differs for different files', { skip: skipMsg }, () => {
  const workDir = makeTempDir('sd0x-nit-hash2-');
  const r1 = runNitFunction(workDir, '_compute_hash "src/a.ts" "naming"');
  const r2 = runNitFunction(workDir, '_compute_hash "src/b.ts" "naming"');
  assert.equal(r1.status, 0);
  assert.equal(r2.status, 0);
  assert.notEqual(r1.stdout.trim(), r2.stdout.trim(), 'different files should produce different hashes');
});

// --- Init ---

test('_init_nit_history creates file with correct schema', { skip: skipMsg }, () => {
  const workDir = makeTempDir('sd0x-nit-init-');
  const result = runNitFunction(workDir, '_init_nit_history');
  assert.equal(result.status, 0, `stderr: ${result.stderr}`);
  const data = readNitHistory(workDir);
  assert.ok(data, 'file should exist');
  assert.equal(data.schema_version, 1);
  assert.deepEqual(data.deferred, []);
  assert.deepEqual(data.dismissed_via_verdict, []);
});

test('_init_nit_history recreates corrupted file', { skip: skipMsg }, () => {
  const workDir = makeTempDir('sd0x-nit-corrupt-');
  writeFileSync(join(workDir, '.claude_nit_history.json'), 'NOT_JSON{{{');
  const result = runNitFunction(workDir, '_init_nit_history');
  assert.equal(result.status, 0, `stderr: ${result.stderr}`);
  const data = readNitHistory(workDir);
  assert.equal(data.schema_version, 1, 'should recreate with valid schema');
});

// --- Upsert deferred ---

test('_upsert_nit_deferred inserts new entry', { skip: skipMsg }, () => {
  const workDir = makeTempDir('sd0x-nit-upsert-');
  const sentinel = '[NIT_DEFERRED] src/a.ts:10 | naming convention violation | reason: possible-false-positive | 2026-03-24T10:00:00Z';
  const result = runNitFunction(workDir, `_upsert_nit_deferred '${sentinel}'`);
  assert.equal(result.status, 0, `stderr: ${result.stderr}`);
  const data = readNitHistory(workDir);
  assert.equal(data.deferred.length, 1, 'should have 1 deferred entry');
  assert.equal(data.deferred[0].file, 'src/a.ts');
  assert.equal(data.deferred[0].defer_count, 1);
  assert.equal(data.deferred[0].severity, 'Nit');
  assert.equal(data.deferred[0].ttl_days, 14);
  assert.ok(data.deferred[0].hash, 'should have hash');
  assert.equal(data.deferred[0].hash.length, 16, 'hash should be 16 chars');
});

test('_upsert_nit_deferred increments on same finding', { skip: skipMsg }, () => {
  const workDir = makeTempDir('sd0x-nit-incr-');
  const sentinel = '[NIT_DEFERRED] src/a.ts:10 | naming convention | reason: possible-false-positive | 2026-03-24T10:00:00Z';
  runNitFunction(workDir, `_upsert_nit_deferred '${sentinel}'`);
  runNitFunction(workDir, `_upsert_nit_deferred '${sentinel}'`);
  const data = readNitHistory(workDir);
  assert.equal(data.deferred.length, 1, 'should still have 1 entry (not duplicated)');
  assert.equal(data.deferred[0].defer_count, 2, 'defer_count should be 2');
});

test('_upsert_nit_deferred rejects suspicious paths', { skip: skipMsg }, () => {
  const workDir = makeTempDir('sd0x-nit-inject-');
  const sentinel = '[NIT_DEFERRED] src/a.ts;rm -rf /:10 | test | reason: test | 2026-03-24T10:00:00Z';
  const result = runNitFunction(workDir, `_upsert_nit_deferred '${sentinel}'`);
  assert.equal(result.status, 0);
  assert.ok(result.stderr.includes('Rejected'), 'should log rejection');
});

// --- Dismiss verdict ---

test('_upsert_dismiss_verdict inserts entry', { skip: skipMsg }, () => {
  const workDir = makeTempDir('sd0x-nit-dismiss-');
  const fresh = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  const sentinel = `[DISMISS_VERDICT] key=src/util.ts|error handling | severity=P2 | verdict=DISMISS_VERIFIED | confidence=0.85 | timestamp=${fresh}`;
  const result = runNitFunction(workDir, `_upsert_dismiss_verdict '${sentinel}'`);
  assert.equal(result.status, 0, `stderr: ${result.stderr}`);
  const data = readNitHistory(workDir);
  assert.equal(data.dismissed_via_verdict.length, 1);
  assert.equal(data.dismissed_via_verdict[0].file, 'src/util.ts');
  assert.equal(data.dismissed_via_verdict[0].verdict, 'DISMISS_VERIFIED');
  assert.equal(data.dismissed_via_verdict[0].confidence, 0.85);
  assert.equal(data.dismissed_via_verdict[0].ttl_days, 30);
});

test('_upsert_dismiss_verdict produces distinct hashes for same file different issues', { skip: skipMsg }, () => {
  const workDir = makeTempDir('sd0x-nit-dismiss-hash-');
  const fresh = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  const s1 = `[DISMISS_VERDICT] key=src/util.ts|error handling | severity=P2 | verdict=DISMISS_VERIFIED | confidence=0.85 | timestamp=${fresh}`;
  const s2 = `[DISMISS_VERDICT] key=src/util.ts|naming convention | severity=Nit | verdict=DISMISS_VERIFIED | confidence=0.70 | timestamp=${fresh}`;
  runNitFunction(workDir, `_upsert_dismiss_verdict '${s1}'`);
  runNitFunction(workDir, `_upsert_dismiss_verdict '${s2}'`);
  const data = readNitHistory(workDir);
  assert.equal(data.dismissed_via_verdict.length, 2, 'should have 2 distinct entries');
  assert.notEqual(data.dismissed_via_verdict[0].hash, data.dismissed_via_verdict[1].hash, 'hashes should differ');
});

// --- Parse sentinels ---

test('_parse_nit_sentinels processes NIT_DEFERRED from output', { skip: skipMsg }, () => {
  const workDir = makeTempDir('sd0x-nit-parse-');
  const output = 'Some review text\n[NIT_DEFERRED] src/a.ts:5 | naming issue | reason: false-positive | 2026-03-24T10:00:00Z\nMore text';
  const result = runNitFunction(workDir, `_parse_nit_sentinels '${output}'`);
  assert.equal(result.status, 0, `stderr: ${result.stderr}`);
  const data = readNitHistory(workDir);
  assert.ok(data, 'nit history should be created');
  assert.equal(data.deferred.length, 1, 'should have 1 deferred');
});

// --- TTL GC ---

// --- Hook-level Skill routing ---

test('hook processes Skill tool_name with DISMISS_VERDICT sentinel', { skip: skipMsg }, () => {
  const workDir = makeTempDir('sd0x-nit-skill-');
  // Create minimal state file so hook doesn't fail
  writeFileSync(join(workDir, '.claude_review_state.json'), JSON.stringify({
    session_id: '', updated_at: '', review_mode: 'single',
    has_code_change: false, has_doc_change: false,
    code_review: { executed: false, passed: false, last_run: '' },
    doc_review: { executed: false, passed: false, last_run: '' },
    precommit: { executed: false, passed: false, last_run: '' },
    aggregate_gate: { executed: false, gate: null, source: null, reason: null, last_run: '' },
    schema_version: 2,
    iteration_history: { current_round: 0, max_rounds: 10, findings_by_round: [] },
  }));
  const fresh = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  const input = {
    tool_name: 'Skill',
    tool_input: { skill: 'sd0x-dev-flow:seek-verdict' },
    tool_output: `[DISMISS_VERDICT] key=src/x.ts|naming | severity=Nit | verdict=DISMISS_VERIFIED | confidence=0.80 | timestamp=${fresh}`,
  };
  const result = spawnSync('bash', [hookPath], {
    cwd: workDir,
    input: JSON.stringify(input),
    encoding: 'utf8',
    env: { ...process.env },
  });
  assert.equal(result.status, 0, `stderr: ${result.stderr}`);
  const data = readNitHistory(workDir);
  assert.ok(data, 'nit history should exist');
  assert.equal(data.dismissed_via_verdict.length, 1, 'should have 1 dismissed entry');
});

test('hook with Skill tool_name without sentinels does not create nit history', { skip: skipMsg }, () => {
  const workDir = makeTempDir('sd0x-nit-skill-no-');
  writeFileSync(join(workDir, '.claude_review_state.json'), JSON.stringify({
    session_id: '', updated_at: '', review_mode: 'single',
    has_code_change: false, has_doc_change: false,
    code_review: { executed: false, passed: false, last_run: '' },
    doc_review: { executed: false, passed: false, last_run: '' },
    precommit: { executed: false, passed: false, last_run: '' },
    aggregate_gate: { executed: false, gate: null, source: null, reason: null, last_run: '' },
    schema_version: 2,
    iteration_history: { current_round: 0, max_rounds: 10, findings_by_round: [] },
  }));
  const input = {
    tool_name: 'Skill',
    tool_input: { skill: 'sd0x-dev-flow:codex-review-fast' },
    tool_output: '## Codex Review\n### Findings\nNone\n### Merge Gate\n✅ Ready',
  };
  const result = spawnSync('bash', [hookPath], {
    cwd: workDir,
    input: JSON.stringify(input),
    encoding: 'utf8',
    env: { ...process.env },
  });
  assert.equal(result.status, 0, `stderr: ${result.stderr}`);
  const data = readNitHistory(workDir);
  assert.equal(data, null, 'nit history should NOT be created when no sentinels');
});

// --- TTL GC ---

test('_gc_nit_history removes expired deferred entries', { skip: skipMsg }, () => {
  const workDir = makeTempDir('sd0x-nit-gc-');
  const fifteenDaysAgo = new Date(Date.now() - 15 * 86400 * 1000).toISOString().replace(/\.\d{3}Z$/, 'Z');
  const fresh = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  const data = {
    schema_version: 1,
    deferred: [
      {
        hash: 'expired000000000',
        file: 'src/old.ts',
        severity: 'Nit',
        canonical_issue: 'old issue',
        reason: 'false-positive',
        defer_count: 3,
        first_seen: fifteenDaysAgo,
        last_seen: fifteenDaysAgo,
        ttl_days: 14,
      },
      {
        hash: 'fresh00000000000',
        file: 'src/new.ts',
        severity: 'Nit',
        canonical_issue: 'new issue',
        reason: 'false-positive',
        defer_count: 1,
        first_seen: fresh,
        last_seen: fresh,
        ttl_days: 14,
      },
    ],
    dismissed_via_verdict: [],
  };
  writeFileSync(join(workDir, '.claude_nit_history.json'), JSON.stringify(data));
  const result = runNitFunction(workDir, '_gc_nit_history');
  assert.equal(result.status, 0, `stderr: ${result.stderr}`);
  const updated = readNitHistory(workDir);
  assert.equal(updated.deferred.length, 1, 'expired entry should be removed');
  assert.equal(updated.deferred[0].hash, 'fresh00000000000', 'fresh entry should remain');
});
