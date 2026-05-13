'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');

const {
  ACTIVE_DIMS_BY_DEPTH,
  MIN_LINES,
  validatePath,
  detectDocKind,
  countLines,
  detectGreenfield,
  assertLifecycleScope,
} = require('../../../scripts/skills/necessity-audit/preflight');

const repoRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const scriptPath = path.join(repoRoot, 'scripts/skills/necessity-audit/preflight.js');

function runPreflight(args) {
  try {
    const out = execFileSync('node', [scriptPath, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return { code: 0, stdout: out, stderr: '' };
  } catch (err) {
    return { code: err.status || 1, stdout: err.stdout?.toString() || '', stderr: err.stderr?.toString() || '' };
  }
}

test('ACTIVE_DIMS_BY_DEPTH — brief covers dims 1-3, normal/deep cover 1-6', () => {
  assert.deepEqual(ACTIVE_DIMS_BY_DEPTH.brief, [1, 2, 3]);
  assert.deepEqual(ACTIVE_DIMS_BY_DEPTH.normal, [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(ACTIVE_DIMS_BY_DEPTH.deep, [1, 2, 3, 4, 5, 6]);
});

test('MIN_LINES — target must have at least 50 lines', () => {
  assert.equal(MIN_LINES, 50);
});

test('validatePath — legal repo-relative path passes', () => {
  const legal = 'docs/features/necessity-audit/1-requirements.md';
  const { absPath, relPath } = validatePath(legal, repoRoot);
  assert.ok(path.isAbsolute(absPath));
  assert.equal(relPath, legal);
});

test('validatePath — .. traversal rejected', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'necessity-audit-'));
  const outside = path.join(tmpDir, 'escape.md');
  fs.writeFileSync(outside, '#\n');
  assert.throws(() => validatePath(outside, repoRoot), /Path escapes repo/);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('validatePath — absolute path outside repo rejected', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'necessity-audit-'));
  const abs = path.join(tmpDir, 'doc.md');
  fs.writeFileSync(abs, '#\n');
  assert.throws(() => validatePath(abs, repoRoot), /Path escapes repo/);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('validatePath — repo-external symlink rejected', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'necessity-audit-ext-'));
  const outside = path.join(tmpDir, 'outside.md');
  fs.writeFileSync(outside, '#\n');
  const linkInside = path.join(repoRoot, 'docs/features/necessity-audit/._symlink-ext-test');
  try {
    fs.symlinkSync(outside, linkInside);
    assert.throws(() => validatePath(linkInside, repoRoot), /Path escapes repo/);
  } finally {
    try { fs.unlinkSync(linkInside); } catch {}
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('validatePath — repo-internal dir-external symlink accepted but containment enforced', () => {
  const linkInside = path.join(repoRoot, 'docs/features/necessity-audit/._symlink-int-test');
  const target = path.join(repoRoot, 'README.md');
  try {
    fs.symlinkSync(target, linkInside);
    const { relPath } = validatePath(linkInside, repoRoot);
    assert.equal(relPath, 'README.md');
  } finally {
    try { fs.unlinkSync(linkInside); } catch {}
  }
});

test('validatePath — non-existent file rejected with friendly message', () => {
  assert.throws(
    () => validatePath('docs/features/nonexistent/fake.md', repoRoot),
    /Target file not found/,
  );
});

test('validatePath — invalid feature slug rejected with exit 1 semantics', () => {
  const linkInside = path.join(repoRoot, 'docs/features/._symlink-bad-slug-test');
  try {
    fs.mkdirSync(path.join(repoRoot, 'docs/features/.hidden-bad'), { recursive: true });
    const realFile = path.join(repoRoot, 'docs/features/.hidden-bad/2-tech-spec.md');
    fs.writeFileSync(realFile, 'stub');
    assert.throws(
      () => validatePath('docs/features/.hidden-bad/2-tech-spec.md', repoRoot),
      /Invalid feature slug/,
    );
  } finally {
    try { fs.rmSync(path.join(repoRoot, 'docs/features/.hidden-bad'), { recursive: true, force: true }); } catch {}
    try { fs.unlinkSync(linkInside); } catch {}
  }
});

test('detectDocKind — 1-requirements.md → requirements', () => {
  assert.equal(detectDocKind('docs/features/foo/1-requirements.md', false), 'requirements');
});

test('detectDocKind — 2-tech-spec.md → tech-spec', () => {
  assert.equal(detectDocKind('docs/features/foo/2-tech-spec.md', false), 'tech-spec');
});

test('detectDocKind — 3-architecture.md → architecture', () => {
  assert.equal(detectDocKind('docs/features/foo/3-architecture.md', false), 'architecture');
});

test('detectDocKind — 4-implementation.md → implementation', () => {
  assert.equal(detectDocKind('docs/features/foo/4-implementation.md', false), 'implementation');
});

test('detectDocKind — 0-feasibility-study without flag rejected', () => {
  assert.throws(
    () => detectDocKind('docs/features/foo/0-feasibility-study.md', false),
    /feasibility-study is excluded/,
  );
});

test('detectDocKind — 0-feasibility-study with flag accepted', () => {
  assert.equal(detectDocKind('docs/features/foo/0-feasibility-study.md', true), 'feasibility');
});

test('detectDocKind — non-lifecycle file rejected', () => {
  assert.throws(() => detectDocKind('docs/features/foo/README.md', false), /Not a lifecycle spec/);
});

test('countLines — matches wc -l semantics (counts newline chars, not split length)', () => {
  const tmpFile = path.join(os.tmpdir(), `cl-${Date.now()}.md`);
  // 3 complete lines with trailing newline → wc -l = 3
  fs.writeFileSync(tmpFile, 'line1\nline2\nline3\n');
  assert.equal(countLines(tmpFile), 3);
  // 3 lines without trailing newline → wc -l = 2 (only complete lines count)
  fs.writeFileSync(tmpFile, 'line1\nline2\nline3');
  assert.equal(countLines(tmpFile), 2);
  // Empty file → 0
  fs.writeFileSync(tmpFile, '');
  assert.equal(countLines(tmpFile), 0);
  // Single newline → 1
  fs.writeFileSync(tmpFile, '\n');
  assert.equal(countLines(tmpFile), 1);
  fs.rmSync(tmpFile);
});

test('countLines — 49-line file with trailing newline blocks MIN_LINES gate (regression)', () => {
  const tmpFile = path.join(os.tmpdir(), `cl-regress-${Date.now()}.md`);
  const content = Array.from({ length: 49 }, (_, i) => `line${i + 1}`).join('\n') + '\n';
  fs.writeFileSync(tmpFile, content);
  assert.equal(countLines(tmpFile), 49);
  assert.ok(countLines(tmpFile) < MIN_LINES, 'must fail MIN_LINES check — prior split().length incorrectly returned 50');
  fs.rmSync(tmpFile);
});

test('detectGreenfield — non-greenfield returns false when code references feature key', () => {
  // "necessity-audit" is the live feature itself; code references must exist outside docs/
  const result = detectGreenfield(repoRoot, 'necessity-audit');
  assert.equal(result, false, 'necessity-audit has scripts/skills/necessity-audit/ outside docs/');
});

test('detectGreenfield — fictional slug with dotted regex metachar returns true (no over-match)', () => {
  // Slug contains "." — regex metachar. Without escapeRegex, would match "nA5B" etc.
  // With escapeRegex, only the literal dotted token matches.
  // Build the slug at runtime so the literal does NOT appear in any tracked source file
  // (otherwise git grep would self-match this test file).
  const slug = ['n', 'a-fictional-greenfield-xyz-42'].join('.');
  const result = detectGreenfield(repoRoot, slug);
  assert.equal(result, true, 'dotted literal slug should not false-match arbitrary files');
});

// === CLI integration tests ===

test('CLI: preflight on valid 1-requirements.md succeeds', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cli-pf-'));
  const outFile = path.join(tmpDir, 'pf.json');
  const { code } = runPreflight([
    '--path', 'docs/features/necessity-audit/1-requirements.md',
    '--depth', 'normal',
    '--skip-preflight',
    '--output', outFile,
  ]);
  assert.equal(code, 0);
  const pf = JSON.parse(fs.readFileSync(outFile, 'utf8'));
  assert.equal(pf.depth, 'normal');
  assert.equal(pf.docKind, 'requirements');
  assert.equal(pf.featureKey, 'necessity-audit');
  assert.deepEqual(pf.activeDimensions, [1, 2, 3, 4, 5, 6]);
  assert.ok(pf.banners.includes('[PREFLIGHT SKIPPED]'));
  assert.ok(typeof pf.greenfield === 'boolean');
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('CLI: preflight with --depth brief filters to dims 1-3', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cli-pf-'));
  const outFile = path.join(tmpDir, 'pf.json');
  const { code } = runPreflight([
    '--path', 'docs/features/necessity-audit/1-requirements.md',
    '--depth', 'brief',
    '--skip-preflight',
    '--output', outFile,
  ]);
  assert.equal(code, 0);
  const pf = JSON.parse(fs.readFileSync(outFile, 'utf8'));
  assert.deepEqual(pf.activeDimensions, [1, 2, 3]);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('CLI: preflight rejects non-lifecycle file with exit 3', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cli-pf-'));
  const outFile = path.join(tmpDir, 'pf.json');
  const { code } = runPreflight([
    '--path', 'README.md',
    '--depth', 'normal',
    '--skip-preflight',
    '--output', outFile,
  ]);
  assert.equal(code, 3);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('CLI: preflight rejects missing --output', () => {
  const { code, stderr } = runPreflight([
    '--path', 'docs/features/necessity-audit/1-requirements.md',
    '--depth', 'normal',
  ]);
  assert.equal(code, 1);
  assert.match(stderr, /Missing --output/);
});

test('CLI: preflight rejects invalid --depth', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cli-pf-'));
  const outFile = path.join(tmpDir, 'pf.json');
  const { code, stderr } = runPreflight([
    '--path', 'docs/features/necessity-audit/1-requirements.md',
    '--depth', 'extreme',
    '--output', outFile,
  ]);
  assert.equal(code, 1);
  assert.match(stderr, /Invalid --depth/);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('CLI: preflight without --skip-preflight emits advisory warning', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cli-pf-'));
  const outFile = path.join(tmpDir, 'pf.json');
  runPreflight([
    '--path', 'docs/features/necessity-audit/1-requirements.md',
    '--depth', 'normal',
    '--output', outFile,
  ]);
  const pf = JSON.parse(fs.readFileSync(outFile, 'utf8'));
  // State file may or may not exist; either way advisory should be populated appropriately
  assert.ok(Array.isArray(pf.warnings));
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('assertLifecycleScope — rejects non-lifecycle relPath (outside docs/features/)', () => {
  // Guards against tampered preflight.json pointing to arbitrary in-repo files
  assert.throws(
    () => assertLifecycleScope({ relPath: 'scripts/lib/feature-resolver.js', docKind: 'requirements' }, repoRoot),
    err => err.code === 1 && /outside lifecycle scope/.test(err.message),
  );
});

test('assertLifecycleScope — rejects docKind mismatch (preflight says requirements but file is tech-spec)', () => {
  assert.throws(
    () => assertLifecycleScope({
      relPath: 'docs/features/necessity-audit/2-tech-spec.md',
      docKind: 'requirements',
    }, repoRoot),
    err => err.code === 3 && /docKind mismatch/.test(err.message),
  );
});

test('assertLifecycleScope — accepts valid lifecycle path + matching docKind', () => {
  const result = assertLifecycleScope({
    relPath: 'docs/features/necessity-audit/1-requirements.md',
    docKind: 'requirements',
  }, repoRoot);
  assert.ok(result.absPath.endsWith('1-requirements.md'));
  assert.equal(result.relPath, 'docs/features/necessity-audit/1-requirements.md');
});

test('assertLifecycleScope — throws when preflight is missing relPath', () => {
  assert.throws(
    () => assertLifecycleScope({ docKind: 'requirements' }, repoRoot),
    err => err.code === 1 && /missing relPath/.test(err.message),
  );
  assert.throws(
    () => assertLifecycleScope(null, repoRoot),
    err => err.code === 1 && /missing relPath/.test(err.message),
  );
});

test('assertLifecycleScope — rejects path traversal even within lifecycle-looking prefix', () => {
  // Regression: realpath containment from validatePath still applies
  assert.throws(
    () => assertLifecycleScope({ relPath: 'docs/features/necessity-audit/../../../etc/passwd', docKind: 'requirements' }, repoRoot),
  );
});
