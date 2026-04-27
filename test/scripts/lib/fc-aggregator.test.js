'use strict';

const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, rmSync, existsSync, readFileSync, readdirSync } = require('node:fs');
const { join } = require('node:path');
const { tmpdir } = require('node:os');

const {
  aggregate,
  computeVerdict,
  writeSnapshot,
  repoKey,
  BASELINE_DIMS,
  OPTIN_DIMS,
  SNAPSHOT_VERSION,
} = require('../../../scripts/lib/fc-aggregator');

const tempDirs = [];

function makeTempDir(prefix = 'sd0x-fc-agg-') {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

after(() => {
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
});

function dim(name, status, extra = {}) {
  return { name, enabled: true, provider: 'self', status, applicable_items: 1, summary: '', ...extra };
}

function baselinePass() {
  return BASELINE_DIMS.map(name => dim(name, 'pass'));
}

test('verdict: full pass when all baseline dims are pass', () => {
  const { verdict, hardFails } = computeVerdict({
    specState: 'full-spec',
    dimensions: baselinePass(),
    items: [],
  });
  assert.equal(verdict.status, 'Feature-Complete');
  assert.equal(verdict.icon, '✅');
  assert.deepEqual(hardFails, []);
});

test('verdict: partial when any baseline dim is partial/unverified', () => {
  const dims = baselinePass();
  dims[2] = dim('test_coverage', 'partial');
  const { verdict } = computeVerdict({ specState: 'full-spec', dimensions: dims, items: [] });
  assert.equal(verdict.status, 'Partial');
  assert.equal(verdict.icon, '⚠️');
});

test('verdict: incomplete when any baseline dim is fail', () => {
  const dims = baselinePass();
  dims[1] = dim('code_implementation', 'fail');
  const { verdict } = computeVerdict({ specState: 'full-spec', dimensions: dims, items: [] });
  assert.equal(verdict.status, 'Incomplete');
  assert.equal(verdict.icon, '⛔');
});

test('verdict: opt-in fail downgrades to partial but not incomplete', () => {
  const dims = [...baselinePass(), dim('security_review', 'fail')];
  const { verdict } = computeVerdict({ specState: 'full-spec', dimensions: dims, items: [] });
  assert.equal(verdict.status, 'Partial');
});

test('verdict: codex_challenge is excluded from verdict math', () => {
  const dims = [...baselinePass(), dim('codex_challenge', 'fail', { provider: '/challenge-codex' })];
  const { verdict } = computeVerdict({ specState: 'full-spec', dimensions: dims, items: [] });
  assert.equal(verdict.status, 'Feature-Complete');
});

test('verdict: spec-state no-spec forces incomplete via hard-fail', () => {
  const { verdict, hardFails } = computeVerdict({
    specState: 'no-spec',
    dimensions: baselinePass(),
    items: [],
  });
  assert.equal(verdict.status, 'Incomplete');
  assert.deepEqual(hardFails, ['spec_missing']);
});

test('verdict: spec-state unresolved yields Need Human', () => {
  const { verdict } = computeVerdict({
    specState: 'unresolved',
    dimensions: baselinePass(),
    items: [],
  });
  assert.equal(verdict.status, 'Need Human');
  assert.equal(verdict.icon, '⚠️');
});

test('verdict: prohibited-domain AC INADEQUATE forces incomplete', () => {
  const items = [{
    id: 'AC-3',
    type: 'AC',
    domains: ['security'],
    text: 'Implement token-based auth',
  }];
  const acEvidence = dim('ac_evidence', 'partial', {
    provider: '/codex-test-review',
    per_ac: [{ id: 'AC-3', verdict: 'INADEQUATE' }],
  });
  const dims = baselinePass().map(d => (d.name === 'ac_evidence' ? acEvidence : d));
  const { verdict, hardFails } = computeVerdict({
    specState: 'full-spec',
    dimensions: dims,
    items,
  });
  assert.equal(verdict.status, 'Incomplete');
  assert.equal(hardFails[0], 'prohibited_domain:AC-3:security');
});

test('verdict: prohibited-domain AC with ADEQUATE does not trigger hard-fail', () => {
  const items = [{ id: 'AC-3', type: 'AC', domains: ['security'], text: 'Implement auth' }];
  const acEvidence = dim('ac_evidence', 'pass', {
    provider: '/codex-test-review',
    per_ac: [{ id: 'AC-3', verdict: 'ADEQUATE' }],
  });
  const dims = baselinePass().map(d => (d.name === 'ac_evidence' ? acEvidence : d));
  const { verdict, hardFails } = computeVerdict({
    specState: 'full-spec',
    dimensions: dims,
    items,
  });
  assert.equal(verdict.status, 'Feature-Complete');
  assert.deepEqual(hardFails, []);
});

test('aggregate: snapshot schema includes required fields', () => {
  const snapshot = aggregate({
    items: [],
    dimensions: baselinePass(),
    specState: 'full-spec',
    featureKey: 'demo',
    mode: 'standard',
    repoRoot: '/tmp/fake',
    sources: { requirements: 'docs/features/demo/1-requirements.md', tech_spec: 'docs/features/demo/2-tech-spec.md' },
    requestsScope: { mode: 'open', included: ['docs/features/demo/requests/2026-01-01-r1.md'] },
  });
  assert.equal(snapshot.version, SNAPSHOT_VERSION);
  assert.equal(snapshot.feature_key, 'demo');
  assert.equal(snapshot.mode, 'standard');
  assert.equal(snapshot.spec_state, 'full-spec');
  assert.equal(snapshot.verdict.status, 'Feature-Complete');
  assert.equal(snapshot.source_of_truth.requests_scope, 'open');
  assert.equal(snapshot.source_of_truth.requests_included.length, 1);
  assert.equal(snapshot.redaction_applied, false);
  assert.match(snapshot.timestamp, /^\d{4}-\d{2}-\d{2}T/);
});

test('writeSnapshot writes latest.json + history file under repoKey', () => {
  const root = makeTempDir();
  const snapshot = aggregate({
    items: [],
    dimensions: baselinePass(),
    specState: 'full-spec',
    featureKey: 'demo',
    mode: 'standard',
    repoRoot: root,
  });
  const { cacheDir, latestPath, historyPath } = writeSnapshot(snapshot, {
    repoRoot: root,
    remoteUrl: 'https://github.com/example/sd0x-dev-flow.git',
    headSha: 'abcdef1234567890',
  });
  assert.ok(cacheDir.startsWith(join(root, '.claude', 'cache', 'feature-completeness')));
  assert.ok(existsSync(latestPath));
  assert.ok(existsSync(historyPath));
  const latest = JSON.parse(readFileSync(latestPath, 'utf8'));
  assert.equal(latest.feature_key, 'demo');
  assert.equal(latest.verdict.status, 'Feature-Complete');
  const historyFiles = readdirSync(join(cacheDir, 'history'));
  assert.equal(historyFiles.length, 1);
  assert.match(historyFiles[0], /-abcdef1-demo\.json$/);
});

test('repoKey is stable given same remote', () => {
  const a = repoKey('/tmp/repo-a', 'https://github.com/example/sd0x-dev-flow.git');
  const b = repoKey('/tmp/repo-a', 'https://github.com/example/sd0x-dev-flow.git');
  assert.equal(a, b);
  const c = repoKey('/tmp/repo-a', 'https://github.com/other/sd0x-dev-flow.git');
  assert.notEqual(a, c);
  assert.match(a, /^[a-zA-Z0-9._-]+--[a-f0-9]{8}$/);
});

test('aggregate + writeSnapshot: full §3.2.1 CompletenessSnapshot schema shape', () => {
  // AC-5: verify the snapshot contract aligns with tech-spec §3.2.1 — all
  // top-level fields present, source_of_truth nested shape, verdict carries
  // hard_fail_triggers, and persisted JSON round-trips without loss.
  const root = makeTempDir();
  const items = [{
    id: 'AC-1',
    type: 'AC',
    domains: ['security'],
    text: 'enforce token auth',
    source_doc: 'docs/features/demo/requests/r1.md',
    source_line: 42,
  }];
  const acEvidence = dim('ac_evidence', 'fail', {
    provider: '/codex-test-review',
    per_ac: [{ id: 'AC-1', verdict: 'INADEQUATE', source_doc: 'docs/features/demo/requests/r1.md' }],
  });
  const dims = baselinePass().map(d => (d.name === 'ac_evidence' ? acEvidence : d));
  const snapshot = aggregate({
    items,
    dimensions: dims,
    specState: 'full-spec',
    featureKey: 'demo',
    mode: 'deep',
    repoRoot: root,
    sources: {
      requirements: 'docs/features/demo/1-requirements.md',
      tech_spec: 'docs/features/demo/2-tech-spec.md',
    },
    requestsScope: { mode: 'open', included: ['docs/features/demo/requests/r1.md'] },
  });

  // Top-level schema
  assert.equal(snapshot.version, SNAPSHOT_VERSION);
  assert.equal(snapshot.feature_key, 'demo');
  assert.equal(snapshot.mode, 'deep');
  assert.equal(snapshot.spec_state, 'full-spec');
  assert.match(snapshot.timestamp, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(snapshot.redaction_applied, false);

  // source_of_truth nested shape
  assert.ok(snapshot.source_of_truth);
  assert.equal(snapshot.source_of_truth.requests_scope, 'open');
  assert.deepEqual(snapshot.source_of_truth.requests_included, ['docs/features/demo/requests/r1.md']);
  assert.ok(snapshot.source_of_truth.canonical_docs);
  assert.equal(snapshot.source_of_truth.canonical_docs.requirements, 'docs/features/demo/1-requirements.md');
  assert.equal(snapshot.source_of_truth.canonical_docs.tech_spec, 'docs/features/demo/2-tech-spec.md');

  // items / dimensions arrays
  assert.ok(Array.isArray(snapshot.items));
  assert.equal(snapshot.items.length, 1);
  assert.ok(Array.isArray(snapshot.dimensions));
  assert.equal(snapshot.dimensions.length, 5);

  // Verdict shape — §3.2.1 requires status/icon/rationale/hard_fail_triggers.
  // Prohibited-domain + INADEQUATE AC forces Incomplete + populates triggers.
  assert.ok(snapshot.verdict);
  assert.equal(snapshot.verdict.status, 'Incomplete');
  assert.equal(snapshot.verdict.icon, '⛔');
  assert.ok(typeof snapshot.verdict.rationale === 'string');
  assert.ok(Array.isArray(snapshot.hard_fail_triggers));
  assert.equal(snapshot.hard_fail_triggers.length, 1);
  assert.match(snapshot.hard_fail_triggers[0], /prohibited_domain:AC-1/);

  // Persisted JSON round-trip — must not drop fields through write/read
  const { latestPath } = writeSnapshot(snapshot, {
    repoRoot: root,
    remoteUrl: 'https://github.com/example/demo.git',
    headSha: 'deadbeefcafebabe',
  });
  const roundTrip = JSON.parse(require('node:fs').readFileSync(latestPath, 'utf8'));
  assert.deepEqual(roundTrip, snapshot);
});

test('aggregate: exports BASELINE_DIMS and OPTIN_DIMS', () => {
  assert.equal(BASELINE_DIMS.length, 5);
  assert.equal(OPTIN_DIMS.length, 4);
  assert.ok(BASELINE_DIMS.includes('ac_evidence'));
  assert.ok(OPTIN_DIMS.includes('spec_review'));
});

test('verdict: missing baseline dims fall through to Partial (no silent Feature-Complete)', () => {
  // Only one baseline dim provided — the other four should be treated as
  // unverified gaps, so verdict must be Partial, not Feature-Complete.
  const { verdict, hardFails } = computeVerdict({
    specState: 'full-spec',
    dimensions: [dim('spec_presence', 'pass')],
    items: [],
  });
  assert.equal(verdict.status, 'Partial');
  assert.deepEqual(hardFails, []);
  assert.match(verdict.rationale, /missing baseline dims/);
});

test('verdict: disabled baseline dim treated as missing', () => {
  const dims = baselinePass();
  dims[0] = { ...dims[0], enabled: false };
  const { verdict } = computeVerdict({ specState: 'full-spec', dimensions: dims, items: [] });
  assert.equal(verdict.status, 'Partial');
  assert.match(verdict.rationale, /missing baseline dims/);
});

test('verdict: same AC id in two request docs uses composite key (no overwrite)', () => {
  // Two ACs share id AC-1 across different source_docs. Only the one in
  // doc B has INADEQUATE verdict. Aggregator should hard-fail only the
  // breaching AC, not both.
  const items = [
    { id: 'AC-1', type: 'AC', domains: ['security'], text: 'auth in doc A', source_doc: 'docs/features/f/requests/a.md' },
    { id: 'AC-1', type: 'AC', domains: ['security'], text: 'auth in doc B', source_doc: 'docs/features/f/requests/b.md' },
  ];
  const acEvidence = dim('ac_evidence', 'fail', {
    provider: '/codex-test-review',
    per_ac: [
      { id: 'AC-1', verdict: 'ADEQUATE', source_doc: 'docs/features/f/requests/a.md' },
      { id: 'AC-1', verdict: 'INADEQUATE', source_doc: 'docs/features/f/requests/b.md' },
    ],
  });
  const dims = baselinePass().map(d => (d.name === 'ac_evidence' ? acEvidence : d));
  const { verdict, hardFails } = computeVerdict({ specState: 'full-spec', dimensions: dims, items });
  assert.equal(verdict.status, 'Incomplete');
  assert.equal(hardFails.length, 1);
  assert.match(hardFails[0], /prohibited_domain:AC-1@docs\/features\/f\/requests\/b\.md:security/);
});

test('verdict: hardFails include source_doc suffix + dedupe duplicates', () => {
  // Same AC id appears twice with INADEQUATE verdict across two docs → two
  // distinct trigger strings. If the same (id, source_doc) breach appears
  // twice internally it must collapse to one entry in hardFails.
  const items = [
    { id: 'AC-1', type: 'AC', domains: ['security'], text: 'auth a', source_doc: 'docs/features/f/requests/a.md' },
    { id: 'AC-1', type: 'AC', domains: ['security'], text: 'auth b', source_doc: 'docs/features/f/requests/b.md' },
  ];
  const acEvidence = dim('ac_evidence', 'fail', {
    provider: '/codex-test-review',
    per_ac: [
      { id: 'AC-1', verdict: 'INADEQUATE', source_doc: 'docs/features/f/requests/a.md' },
      { id: 'AC-1', verdict: 'INADEQUATE', source_doc: 'docs/features/f/requests/b.md' },
    ],
  });
  const dims = baselinePass().map(d => (d.name === 'ac_evidence' ? acEvidence : d));
  const { hardFails } = computeVerdict({ specState: 'full-spec', dimensions: dims, items });
  assert.equal(hardFails.length, 2);
  assert.ok(hardFails.every(h => /@docs\/features\/f\/requests\/[ab]\.md/.test(h)));
  assert.notEqual(hardFails[0], hardFails[1]);
});

test('verdict: prohibited-domain AC with no verdict row escalates to hard-fail', () => {
  // Codex run missed the AC entirely. A security AC with no evidence is
  // indistinguishable from silent failure — must block merge.
  const items = [{
    id: 'AC-7',
    type: 'AC',
    domains: ['data-integrity'],
    text: 'migration must be rollback-safe',
    source_doc: 'docs/features/f/requests/r1.md',
  }];
  const acEvidence = dim('ac_evidence', 'partial', {
    provider: '/codex-test-review',
    per_ac: [{ id: 'AC-9', verdict: 'ADEQUATE', source_doc: 'docs/features/f/requests/r1.md' }],
  });
  const dims = baselinePass().map(d => (d.name === 'ac_evidence' ? acEvidence : d));
  const { verdict, hardFails } = computeVerdict({ specState: 'full-spec', dimensions: dims, items });
  assert.equal(verdict.status, 'Incomplete');
  assert.equal(hardFails.length, 1);
  assert.match(hardFails[0], /prohibited_domain:AC-7@docs\/features\/f\/requests\/r1\.md:data-integrity/);
});
