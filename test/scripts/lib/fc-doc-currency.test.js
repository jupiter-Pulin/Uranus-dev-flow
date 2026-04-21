'use strict';

const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, writeFileSync, mkdirSync, rmSync } = require('node:fs');
const { join } = require('node:path');
const { tmpdir } = require('node:os');

const {
  checkCurrency,
  isSquashMergeRepo,
  DEFAULT_THRESHOLD_DAYS,
} = require('../../../scripts/lib/fc-doc-currency');

const tempDirs = [];

function makeTempDir(prefix = 'sd0x-fc-cur-') {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

after(() => {
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
});

/**
 * Build a fake git runner from a timestamp map keyed by relative path.
 */
function fakeRunner(map) {
  return (_cwd, args) => {
    // args like: ['log', '-1', '--format=%ct', '--', '<path>']
    const sep = args.indexOf('--');
    if (sep === -1) return null;
    const key = args[sep + 1];
    if (!(key in map)) return null;
    return `${map[key]}\n`;
  };
}

const NOW = 1_700_000_000;

test('checkCurrency: pass when doc newer than code', () => {
  const r = checkCurrency({
    repoRoot: '/fake',
    docPath: 'docs/x.md',
    codePaths: ['scripts/x.js'],
    runner: fakeRunner({
      'docs/x.md': NOW,
      'scripts/x.js': NOW - 3600,
    }),
  });
  assert.equal(r.status, 'pass');
  assert.equal(r.details.drift_days, 0);
  assert.equal(r.details.stale_paths.length, 0);
});

test('checkCurrency: partial when drift < threshold', () => {
  const r = checkCurrency({
    repoRoot: '/fake',
    docPath: 'docs/x.md',
    codePaths: ['scripts/a.js', 'scripts/b.js'],
    runner: fakeRunner({
      'docs/x.md': NOW - 5 * 86400,
      'scripts/a.js': NOW - 1 * 86400,
      'scripts/b.js': NOW - 10 * 86400,
    }),
  });
  assert.equal(r.status, 'partial');
  assert.ok(r.details.drift_days >= 3 && r.details.drift_days < DEFAULT_THRESHOLD_DAYS);
  assert.equal(r.details.stale_paths.length, 1);
  assert.equal(r.details.stale_paths[0].path, 'scripts/a.js');
});

test('checkCurrency: partial with stale summary when drift >= threshold', () => {
  // Per tech-spec §3.4.3: drift-only maps to `partial`; `fail` is reserved for
  // explicit breaking-change signal (not implemented in R1).
  const r = checkCurrency({
    repoRoot: '/fake',
    docPath: 'docs/x.md',
    codePaths: ['scripts/a.js'],
    runner: fakeRunner({
      'docs/x.md': NOW - 30 * 86400,
      'scripts/a.js': NOW - 5 * 86400,
    }),
  });
  assert.equal(r.status, 'partial');
  assert.ok(r.details.drift_days >= DEFAULT_THRESHOLD_DAYS);
  assert.match(r.summary, /stale by/);
});

test('checkCurrency: partial with custom thresholdDays crossing', () => {
  const r = checkCurrency({
    repoRoot: '/fake',
    docPath: 'docs/x.md',
    codePaths: ['scripts/a.js'],
    thresholdDays: 1,
    runner: fakeRunner({
      'docs/x.md': NOW - 5 * 86400,
      'scripts/a.js': NOW - 1 * 86400,
    }),
  });
  assert.equal(r.status, 'partial');
  assert.match(r.summary, /stale by/);
  assert.equal(r.details.threshold_days, 1);
});

test('checkCurrency: unverified when git log missing for doc', () => {
  const r = checkCurrency({
    repoRoot: '/fake',
    docPath: 'docs/x.md',
    codePaths: ['scripts/a.js'],
    runner: fakeRunner({ 'scripts/a.js': NOW }),
  });
  assert.equal(r.status, 'unverified');
  assert.match(r.summary, /git log unavailable/);
});

test('checkCurrency: pass when no code paths provided', () => {
  const r = checkCurrency({
    repoRoot: '/fake',
    docPath: 'docs/x.md',
    codePaths: [],
    runner: fakeRunner({ 'docs/x.md': NOW }),
  });
  assert.equal(r.status, 'pass');
  assert.match(r.summary, /no code paths/);
});

test('checkCurrency: ignores code paths with unknown mtime', () => {
  const r = checkCurrency({
    repoRoot: '/fake',
    docPath: 'docs/x.md',
    codePaths: ['scripts/known.js', 'scripts/unknown.js'],
    runner: fakeRunner({
      'docs/x.md': NOW,
      'scripts/known.js': NOW - 1,
      // scripts/unknown.js missing
    }),
  });
  assert.equal(r.status, 'pass');
});

test('isSquashMergeRepo: detects squash directive', () => {
  const root = makeTempDir();
  mkdirSync(join(root, 'rules'), { recursive: true });
  writeFileSync(
    join(root, 'rules', 'auto-loop-project.md'),
    '# Auto-Loop Project Overrides\n\n## Git Memory\n\nsquash\n',
  );
  assert.equal(isSquashMergeRepo(root), true);
});

test('isSquashMergeRepo: returns false when directive absent', () => {
  const root = makeTempDir();
  mkdirSync(join(root, 'rules'), { recursive: true });
  writeFileSync(
    join(root, 'rules', 'auto-loop-project.md'),
    '# Auto-Loop Project Overrides\n\n## Git Memory\n\nmerge\n',
  );
  assert.equal(isSquashMergeRepo(root), false);
});

test('isSquashMergeRepo: returns false when file missing', () => {
  const root = makeTempDir();
  assert.equal(isSquashMergeRepo(root), false);
});

test('isSquashMergeRepo: detects directive under .claude/rules/ (consumer deployment)', () => {
  const root = makeTempDir();
  mkdirSync(join(root, '.claude', 'rules'), { recursive: true });
  writeFileSync(
    join(root, '.claude', 'rules', 'auto-loop-project.md'),
    '# Auto-Loop Project Overrides\n\n## Git Memory\n\nsquash\n',
  );
  assert.equal(isSquashMergeRepo(root), true);
});

test('isSquashMergeRepo: prefers .claude/rules/ over plugin-source rules/', () => {
  const root = makeTempDir();
  mkdirSync(join(root, '.claude', 'rules'), { recursive: true });
  mkdirSync(join(root, 'rules'), { recursive: true });
  writeFileSync(
    join(root, '.claude', 'rules', 'auto-loop-project.md'),
    '# Auto-Loop Project Overrides\n\n## Git Memory\n\nsquash\n',
  );
  writeFileSync(
    join(root, 'rules', 'auto-loop-project.md'),
    '# Auto-Loop Project Overrides\n\n## Git Memory\n\nmerge\n',
  );
  assert.equal(isSquashMergeRepo(root), true);
});

test('checkCurrency: pass result clears stale_paths', () => {
  const r = checkCurrency({
    repoRoot: '/fake',
    docPath: 'docs/x.md',
    codePaths: ['scripts/x.js'],
    runner: fakeRunner({
      'docs/x.md': NOW,
      'scripts/x.js': NOW - 60,
    }),
  });
  assert.equal(r.status, 'pass');
  assert.deepEqual(r.details.stale_paths, []);
});

test('checkCurrency + isSquashMergeRepo: squash-merge PR where doc + code share same commit returns pass (no false-positive)', () => {
  // AC-4 (per tech-spec R7): in a squash-merge repo, a single PR that edits
  // both the doc and the code collapses to one commit, so `git log -1 %ct`
  // returns identical timestamps. The v1 contract is: identical ts → pass,
  // not a spurious `partial`. The isSquashMergeRepo signal is surfaced so
  // callers can widen the mtime strategy if desired, but the default path
  // must not false-positive.
  const root = makeTempDir();
  mkdirSync(join(root, '.claude', 'rules'), { recursive: true });
  writeFileSync(
    join(root, '.claude', 'rules', 'auto-loop-project.md'),
    '# Auto-Loop Project Overrides\n\n## Git Memory\n\nsquash\n',
  );
  assert.equal(isSquashMergeRepo(root), true);
  const SAME_COMMIT_TS = NOW;
  const r = checkCurrency({
    repoRoot: root,
    docPath: 'docs/feature.md',
    codePaths: ['scripts/feature.js', 'scripts/helper.js'],
    runner: fakeRunner({
      'docs/feature.md': SAME_COMMIT_TS,
      'scripts/feature.js': SAME_COMMIT_TS,
      'scripts/helper.js': SAME_COMMIT_TS,
    }),
  });
  assert.equal(r.status, 'pass');
  assert.equal(r.details.drift_days, 0);
  assert.deepEqual(r.details.stale_paths, []);
});
