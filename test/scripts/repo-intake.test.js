const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const {
  mkdtempSync,
  writeFileSync,
  mkdirSync,
  rmSync,
  existsSync,
  readFileSync,
} = require('node:fs');
const { join, resolve } = require('node:path');
const { tmpdir } = require('node:os');
const { execFileSync, spawnSync } = require('node:child_process');

const scanRepoPath = resolve(__dirname, '../../skills/repo-intake/scripts/scan_repo.js');
const scanDeltaPath = resolve(__dirname, '../../skills/repo-intake/scripts/scan_delta.js');
const intakeCachedPath = resolve(__dirname, '../../skills/repo-intake/scripts/intake_cached.js');

const tempDirs = [];

function createTempRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'sd0x-intake-'));
  tempDirs.push(dir);
  execFileSync('git', ['init'], { cwd: dir, stdio: 'ignore' });
  execFileSync(
    'git',
    ['-c', 'user.name=test', '-c', 'user.email=test@test', 'commit', '--allow-empty', '-m', 'init'],
    { cwd: dir, stdio: 'ignore' }
  );
  return dir;
}

function runScanner(script, dir, extraArgs = []) {
  const result = spawnSync('node', [script, ...extraArgs], {
    cwd: dir,
    encoding: 'utf8',
    env: { ...process.env },
  });
  return {
    ok: result.status === 0,
    status: result.status,
    stdout: (result.stdout || '').trim(),
    stderr: (result.stderr || '').trim(),
  };
}

function runScannerJson(script, dir, extraArgs = []) {
  const r = runScanner(script, dir, ['--format', 'json', ...extraArgs]);
  if (!r.ok) return { ...r, output: null };
  try {
    return { ...r, output: JSON.parse(r.stdout) };
  } catch {
    return { ...r, output: null };
  }
}

after(() => {
  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ============================================================================
// matchPattern() unit tests (exported from scan_repo.js)
// ============================================================================

const { matchPattern, compilePattern } = require(scanRepoPath);

test('matchPattern — {ts,js} brace expansion', () => {
  assert.ok(matchPattern('src/index.{ts,js}', 'src/index.ts'));
  assert.ok(matchPattern('src/index.{ts,js}', 'src/index.js'));
  assert.ok(!matchPattern('src/index.{ts,js}', 'src/index.py'));
});

test('matchPattern — * single-segment wildcard', () => {
  assert.ok(matchPattern('cmd/*/main.go', 'cmd/server/main.go'));
  assert.ok(matchPattern('cmd/*/main.go', 'cmd/cli/main.go'));
  assert.ok(!matchPattern('cmd/*/main.go', 'cmd/main.go'), '* should not match empty');
  assert.ok(!matchPattern('cmd/*/main.go', 'cmd/a/b/main.go'), '* should not cross /');
});

test('matchPattern — exact match', () => {
  assert.ok(matchPattern('package.json', 'package.json'));
  assert.ok(!matchPattern('package.json', 'src/package.json'));
  assert.ok(!matchPattern('package.json', 'package.jsonx'));
});

test('matchPattern — no implicit ** (no deep match)', () => {
  assert.ok(!matchPattern('main.go', 'src/main.go'));
  assert.ok(matchPattern('main.go', 'main.go'));
});

test('matchPattern — escaped special chars', () => {
  assert.ok(matchPattern('manage.py', 'manage.py'));
  assert.ok(!matchPattern('manage.py', 'managexpy'));
});

test('matchPattern — no match returns false', () => {
  assert.ok(!matchPattern('src/main.{ts,js}', 'lib/main.ts'));
  assert.ok(!matchPattern('*.go', 'main.ts'));
});

test('compilePattern — caches compiled regex', () => {
  const r1 = compilePattern('src/*.ts');
  const r2 = compilePattern('src/*.ts');
  assert.equal(r1, r2, 'Should return same RegExp instance from cache');
});

// ============================================================================
// detectEcosystems (exported from scan_repo.js)
// ============================================================================

const { detectEcosystems } = require(scanRepoPath);

test('detectEcosystems — Node (package.json)', () => {
  const dir = createTempRepo();
  writeFileSync(join(dir, 'package.json'), '{}');
  const ecos = detectEcosystems(dir);
  assert.ok(ecos.includes('node'), `Expected node, got: ${ecos}`);
});

test('detectEcosystems — Go (go.mod)', () => {
  const dir = createTempRepo();
  writeFileSync(join(dir, 'go.mod'), 'module example.com/test\n\ngo 1.21');
  const ecos = detectEcosystems(dir);
  assert.ok(ecos.includes('go'), `Expected go, got: ${ecos}`);
});

test('detectEcosystems — multi-ecosystem (Node + Go)', () => {
  const dir = createTempRepo();
  writeFileSync(join(dir, 'package.json'), '{}');
  writeFileSync(join(dir, 'go.mod'), 'module example.com/test\n\ngo 1.21');
  const ecos = detectEcosystems(dir);
  assert.ok(ecos.includes('node'), `Expected node in ${ecos}`);
  assert.ok(ecos.includes('go'), `Expected go in ${ecos}`);
});

test('detectEcosystems — empty dir returns empty', () => {
  const dir = createTempRepo();
  const ecos = detectEcosystems(dir);
  assert.equal(ecos.length, 0);
});

// ============================================================================
// scoreEntries (exported from scan_repo.js)
// ============================================================================

const { scoreEntries, loadIntakeConfig } = require(scanRepoPath);

test('scoreEntries — config pattern match and sort', () => {
  const config = loadIntakeConfig();
  const patterns = config?.entry_patterns || [];
  const files = ['src/main.ts', 'src/index.ts', 'README.md', 'package.json'];
  const scored = scoreEntries(files, patterns);
  assert.ok(scored.length >= 1, 'Should match at least one entry');
  assert.ok(scored[0].score >= scored[scored.length - 1].score, 'Should be sorted by score desc');
  assert.equal(scored[0].file, 'src/main.ts', 'src/main.ts should score highest');
});

test('scoreEntries — empty result when no match', () => {
  const patterns = [{ pattern: 'src/main.{ts,js}', score: 100, label: 'main' }];
  const files = ['README.md', 'package.json', 'docs/spec.md'];
  const scored = scoreEntries(files, patterns);
  assert.equal(scored.length, 0);
});

// ============================================================================
// scan_repo.js — full process tests
// ============================================================================

test('scan_repo.js — JSON output has schemaVersion 2', () => {
  const dir = createTempRepo();
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'test-project' }));
  writeFileSync(join(dir, 'README.md'), '# Test\n');
  execFileSync('git', ['-c', 'user.name=test', '-c', 'user.email=test@test', 'add', '-A'], { cwd: dir, stdio: 'ignore' });
  execFileSync('git', ['-c', 'user.name=test', '-c', 'user.email=test@test', 'commit', '-m', 'add files'], { cwd: dir, stdio: 'ignore' });

  const { output, ok } = runScannerJson(scanRepoPath, dir);
  assert.ok(ok, 'scan_repo.js should exit 0');
  assert.equal(output.schemaVersion, 2);
  assert.ok(Array.isArray(output.ecosystems));
});

test('scan_repo.js — detects Node ecosystem from package.json', () => {
  const dir = createTempRepo();
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'node-proj', scripts: { test: 'jest' } }));
  execFileSync('git', ['-c', 'user.name=test', '-c', 'user.email=test@test', 'add', '-A'], { cwd: dir, stdio: 'ignore' });
  execFileSync('git', ['-c', 'user.name=test', '-c', 'user.email=test@test', 'commit', '-m', 'add'], { cwd: dir, stdio: 'ignore' });

  const { output } = runScannerJson(scanRepoPath, dir);
  assert.ok(output.ecosystems.includes('node'));
  assert.equal(output.packageManager, 'npm');
});

test('scan_repo.js — Markdown output has expected sections', () => {
  const dir = createTempRepo();
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'md-test' }));
  writeFileSync(join(dir, 'README.md'), '# Test\n');
  execFileSync('git', ['-c', 'user.name=test', '-c', 'user.email=test@test', 'add', '-A'], { cwd: dir, stdio: 'ignore' });
  execFileSync('git', ['-c', 'user.name=test', '-c', 'user.email=test@test', 'commit', '-m', 'add'], { cwd: dir, stdio: 'ignore' });

  const { stdout, ok } = runScanner(scanRepoPath, dir, ['--format', 'md']);
  assert.ok(ok);
  assert.ok(stdout.includes('# Repo Intake Report (Full)'));
  assert.ok(stdout.includes('## 1) Project Overview'));
  assert.ok(stdout.includes('## 2) Documentation Map'));
  assert.ok(stdout.includes('## 3) Entry Points & Structure'));
  assert.ok(stdout.includes('## 4) Test Map'));
  assert.ok(stdout.includes('## 5) Suggested Next Steps'));
});

test('scan_repo.js — entry scoring detects src/main.ts', () => {
  const dir = createTempRepo();
  writeFileSync(join(dir, 'package.json'), '{}');
  mkdirSync(join(dir, 'src'));
  writeFileSync(join(dir, 'src', 'main.ts'), 'console.log("main");');
  writeFileSync(join(dir, 'src', 'index.ts'), 'console.log("index");');
  execFileSync('git', ['-c', 'user.name=test', '-c', 'user.email=test@test', 'add', '-A'], { cwd: dir, stdio: 'ignore' });
  execFileSync('git', ['-c', 'user.name=test', '-c', 'user.email=test@test', 'commit', '-m', 'add'], { cwd: dir, stdio: 'ignore' });

  const { output } = runScannerJson(scanRepoPath, dir);
  assert.ok(output.entrypoints.length >= 2);
  assert.equal(output.entrypoints[0].file, 'src/main.ts', 'src/main.ts should be highest scored');
});

test('scan_repo.js — doc discovery finds README', () => {
  const dir = createTempRepo();
  writeFileSync(join(dir, 'README.md'), '# My Project\n\nDescription here.\n');
  mkdirSync(join(dir, 'docs'));
  writeFileSync(join(dir, 'docs', 'architecture.md'), '# Architecture\n');
  execFileSync('git', ['-c', 'user.name=test', '-c', 'user.email=test@test', 'add', '-A'], { cwd: dir, stdio: 'ignore' });
  execFileSync('git', ['-c', 'user.name=test', '-c', 'user.email=test@test', 'commit', '-m', 'add'], { cwd: dir, stdio: 'ignore' });

  const { output } = runScannerJson(scanRepoPath, dir);
  assert.ok(output.readmeCount >= 1);
  assert.ok(output.readmePaths.some(p => p.toLowerCase().includes('readme')));
});

test('scan_repo.js — test grouping by path', () => {
  const dir = createTempRepo();
  writeFileSync(join(dir, 'package.json'), '{}');
  mkdirSync(join(dir, 'test', 'unit', 'service'), { recursive: true });
  mkdirSync(join(dir, 'test', 'integration', 'api'), { recursive: true });
  mkdirSync(join(dir, 'test', 'e2e'), { recursive: true });
  writeFileSync(join(dir, 'test', 'unit', 'service', 'foo.test.js'), 'test');
  writeFileSync(join(dir, 'test', 'integration', 'api', 'bar.test.js'), 'test');
  writeFileSync(join(dir, 'test', 'e2e', 'smoke.test.js'), 'test');
  execFileSync('git', ['-c', 'user.name=test', '-c', 'user.email=test@test', 'add', '-A'], { cwd: dir, stdio: 'ignore' });
  execFileSync('git', ['-c', 'user.name=test', '-c', 'user.email=test@test', 'commit', '-m', 'add'], { cwd: dir, stdio: 'ignore' });

  const { output } = runScannerJson(scanRepoPath, dir);
  assert.ok(output.testCounts.unit >= 1, `Expected unit tests, got ${output.testCounts.unit}`);
  assert.ok(output.testCounts.integration >= 1, `Expected integration tests, got ${output.testCounts.integration}`);
  assert.ok(output.testCounts.e2e >= 1, `Expected e2e tests, got ${output.testCounts.e2e}`);
});

test('scan_repo.js — no MidwayJS references in output', () => {
  const dir = createTempRepo();
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'test' }));
  execFileSync('git', ['-c', 'user.name=test', '-c', 'user.email=test@test', 'add', '-A'], { cwd: dir, stdio: 'ignore' });
  execFileSync('git', ['-c', 'user.name=test', '-c', 'user.email=test@test', 'commit', '-m', 'add'], { cwd: dir, stdio: 'ignore' });

  const mdResult = runScanner(scanRepoPath, dir, ['--format', 'md']);
  assert.ok(!mdResult.stdout.toLowerCase().includes('midway'), 'Markdown should not mention midway');

  const jsonResult = runScanner(scanRepoPath, dir, ['--format', 'json']);
  assert.ok(!jsonResult.stdout.toLowerCase().includes('midway'), 'JSON should not mention midway');
});

// ============================================================================
// scan_delta.js
// ============================================================================

test('scan_delta.js — topology change triggers shouldRunFull', () => {
  const dir = createTempRepo();
  writeFileSync(join(dir, 'package.json'), '{}');
  execFileSync('git', ['-c', 'user.name=test', '-c', 'user.email=test@test', 'add', '-A'], { cwd: dir, stdio: 'ignore' });
  execFileSync('git', ['-c', 'user.name=test', '-c', 'user.email=test@test', 'commit', '-m', 'add pkg'], { cwd: dir, stdio: 'ignore' });

  // Modify topology file
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'updated' }));
  execFileSync('git', ['-c', 'user.name=test', '-c', 'user.email=test@test', 'add', '-A'], { cwd: dir, stdio: 'ignore' });
  execFileSync('git', ['-c', 'user.name=test', '-c', 'user.email=test@test', 'commit', '-m', 'update pkg'], { cwd: dir, stdio: 'ignore' });

  const { output } = runScannerJson(scanDeltaPath, dir, ['--base', 'HEAD~1']);
  assert.ok(output.shouldRunFull, 'topology change should trigger full');
  assert.ok(output.reasons.includes('topology-changed'));
});

test('scan_delta.js — docs-only skips full scan', () => {
  const dir = createTempRepo();
  mkdirSync(join(dir, 'docs'));
  writeFileSync(join(dir, 'docs', 'guide.md'), '# Guide v1\n');
  execFileSync('git', ['-c', 'user.name=test', '-c', 'user.email=test@test', 'add', '-A'], { cwd: dir, stdio: 'ignore' });
  execFileSync('git', ['-c', 'user.name=test', '-c', 'user.email=test@test', 'commit', '-m', 'add docs'], { cwd: dir, stdio: 'ignore' });

  writeFileSync(join(dir, 'docs', 'guide.md'), '# Guide v2\n');
  execFileSync('git', ['-c', 'user.name=test', '-c', 'user.email=test@test', 'add', '-A'], { cwd: dir, stdio: 'ignore' });
  execFileSync('git', ['-c', 'user.name=test', '-c', 'user.email=test@test', 'commit', '-m', 'update docs'], { cwd: dir, stdio: 'ignore' });

  const { output } = runScannerJson(scanDeltaPath, dir, ['--base', 'HEAD~1']);
  assert.ok(!output.shouldRunFull, 'docs-only change should NOT trigger full');
  assert.ok(output.reasons.includes('docs-only'));
});

test('scan_delta.js — large diff triggers shouldRunFull', () => {
  const dir = createTempRepo();
  mkdirSync(join(dir, 'src'));
  writeFileSync(join(dir, 'src', 'init.js'), 'x');
  execFileSync('git', ['-c', 'user.name=test', '-c', 'user.email=test@test', 'add', '-A'], { cwd: dir, stdio: 'ignore' });
  execFileSync('git', ['-c', 'user.name=test', '-c', 'user.email=test@test', 'commit', '-m', 'init'], { cwd: dir, stdio: 'ignore' });

  // Create 80+ files to exceed threshold
  for (let i = 0; i < 85; i++) {
    writeFileSync(join(dir, 'src', `file${i}.js`), `module.exports = ${i};`);
  }
  execFileSync('git', ['-c', 'user.name=test', '-c', 'user.email=test@test', 'add', '-A'], { cwd: dir, stdio: 'ignore' });
  execFileSync('git', ['-c', 'user.name=test', '-c', 'user.email=test@test', 'commit', '-m', 'many files'], { cwd: dir, stdio: 'ignore' });

  const { output } = runScannerJson(scanDeltaPath, dir, ['--base', 'HEAD~1']);
  assert.ok(output.shouldRunFull, 'large diff should trigger full');
  assert.ok(output.reasons.includes('large-diff'));
});

test('scan_delta.js — git diff failure fallback', () => {
  const dir = createTempRepo();
  // Use invalid base ref to trigger git diff failure
  const { output } = runScannerJson(scanDeltaPath, dir, ['--base', 'nonexistent-ref']);
  assert.ok(output.shouldRunFull, 'git diff failure should trigger full');
  assert.ok(output.reasons.includes('git-diff-failed'));
});

test('scan_delta.js — Markdown output format', () => {
  const dir = createTempRepo();
  writeFileSync(join(dir, 'README.md'), '# Hello\n');
  execFileSync('git', ['-c', 'user.name=test', '-c', 'user.email=test@test', 'add', '-A'], { cwd: dir, stdio: 'ignore' });
  execFileSync('git', ['-c', 'user.name=test', '-c', 'user.email=test@test', 'commit', '-m', 'add readme'], { cwd: dir, stdio: 'ignore' });

  const { stdout, ok } = runScanner(scanDeltaPath, dir, ['--format', 'md', '--base', 'HEAD~1']);
  assert.ok(ok);
  assert.ok(stdout.includes('# Repo Intake Delta'));
  assert.ok(stdout.includes('shouldRunFull'));
});

// ============================================================================
// intake_cached.js
// ============================================================================

test('intake_cached.js — runs with mode=full and produces output', () => {
  const dir = createTempRepo();
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'cached-test' }));
  writeFileSync(join(dir, 'README.md'), '# Cached Test\n');
  execFileSync('git', ['-c', 'user.name=test', '-c', 'user.email=test@test', 'add', '-A'], { cwd: dir, stdio: 'ignore' });
  execFileSync('git', ['-c', 'user.name=test', '-c', 'user.email=test@test', 'commit', '-m', 'add files'], { cwd: dir, stdio: 'ignore' });

  const cacheDir = mkdtempSync(join(tmpdir(), 'sd0x-intake-cache-'));
  tempDirs.push(cacheDir);

  const { stdout, ok } = runScanner(intakeCachedPath, dir, [
    '--mode', 'full', '--format', 'md',
  ]);
  // intake_cached.js writes to cache and outputs to stdout
  assert.ok(ok || stdout.length > 0, 'Should produce output');
  assert.ok(stdout.includes('Repo Intake Report'), `Expected report header, got: ${stdout.slice(0, 200)}`);
});

test('intake_cached.js — JSON format works', () => {
  const dir = createTempRepo();
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'json-test' }));
  execFileSync('git', ['-c', 'user.name=test', '-c', 'user.email=test@test', 'add', '-A'], { cwd: dir, stdio: 'ignore' });
  execFileSync('git', ['-c', 'user.name=test', '-c', 'user.email=test@test', 'commit', '-m', 'add'], { cwd: dir, stdio: 'ignore' });

  const { stdout, ok } = runScanner(intakeCachedPath, dir, [
    '--mode', 'full', '--format', 'json',
  ]);
  assert.ok(ok || stdout.length > 0);
  const parsed = JSON.parse(stdout);
  assert.equal(parsed.schemaVersion, 2);
});

test('intake_cached.js — scanner version is repo-intake@2.0.0', () => {
  const dir = createTempRepo();
  writeFileSync(join(dir, 'package.json'), '{}');
  execFileSync('git', ['-c', 'user.name=test', '-c', 'user.email=test@test', 'add', '-A'], { cwd: dir, stdio: 'ignore' });
  execFileSync('git', ['-c', 'user.name=test', '-c', 'user.email=test@test', 'commit', '-m', 'add'], { cwd: dir, stdio: 'ignore' });

  // Run full to populate cache, then check meta
  runScanner(intakeCachedPath, dir, ['--mode', 'full', '--format', 'md']);

  // Read the source to verify version constant and scanner references
  const src = readFileSync(intakeCachedPath, 'utf8');
  assert.ok(src.includes("'repo-intake@2.0.0'"), 'SCANNER_VERSION should be repo-intake@2.0.0');
  assert.ok(!src.includes('scan_midway_repo'), 'Should not reference scan_midway_repo.js');
  assert.ok(!src.includes('scan_midway_delta'), 'Should not reference scan_midway_delta.js');
});

test('intake_cached.js — legacy migration triggers once then normal flow', () => {
  const dir = createTempRepo();
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'migration-test' }));
  writeFileSync(join(dir, 'README.md'), '# Migration Test\n');
  execFileSync('git', ['-c', 'user.name=test', '-c', 'user.email=test@test', 'add', '-A'], { cwd: dir, stdio: 'ignore' });
  execFileSync('git', ['-c', 'user.name=test', '-c', 'user.email=test@test', 'commit', '-m', 'add files'], { cwd: dir, stdio: 'ignore' });

  // Create temp dirs for new cache and fake legacy cache
  const newCacheDir = mkdtempSync(join(tmpdir(), 'sd0x-intake-new-'));
  const legacyCacheDir = mkdtempSync(join(tmpdir(), 'sd0x-intake-legacy-'));
  tempDirs.push(newCacheDir, legacyCacheDir);

  // Compute repo key matching intake_cached.js: safeSlug(basename)--sha1[repoRoot](0:8)
  // git rev-parse --show-toplevel resolves symlinks (macOS /var -> /private/var)
  const crypto = require('crypto');
  const path = require('path');
  const realDir = execFileSync('git', ['rev-parse', '--show-toplevel'], {
    cwd: dir, encoding: 'utf8',
  }).trim();
  const basename = path.basename(realDir);
  const hash = crypto.createHash('sha1').update(realDir).digest('hex').slice(0, 8);
  const key = `${basename}--${hash}`;

  // Seed fake legacy cache: legacyCacheDir/<key>/commits/<fakeHash>/meta.json
  const legacyCommitsDir = join(legacyCacheDir, key, 'commits', 'abc123');
  mkdirSync(legacyCommitsDir, { recursive: true });
  writeFileSync(join(legacyCommitsDir, 'meta.json'), JSON.stringify({ repoRoot: dir }));

  const envWithCache = {
    ...process.env,
    CLAUDE_REPO_INTAKE_CACHE_DIR: newCacheDir,
    CLAUDE_REPO_INTAKE_LEGACY_CACHE_DIR: legacyCacheDir,
  };

  // Run 1: should trigger legacy migration
  const run1 = spawnSync('node', [intakeCachedPath, '--mode', 'auto', '--format', 'md'], {
    cwd: dir,
    encoding: 'utf8',
    env: envWithCache,
  });
  assert.equal(run1.status, 0, `Run 1 should exit 0, stderr: ${run1.stderr.slice(0, 300)}`);
  assert.ok(
    run1.stderr.includes('Legacy cache detected'),
    `Run 1 should trigger legacy migration, stderr: ${run1.stderr.slice(0, 300)}`
  );
  assert.ok(run1.stdout.includes('Repo Intake Report'), 'Run 1 should produce output');

  // Make a new commit
  writeFileSync(join(dir, 'src.js'), 'const x = 1;');
  execFileSync('git', ['-c', 'user.name=test', '-c', 'user.email=test@test', 'add', '-A'], { cwd: dir, stdio: 'ignore' });
  execFileSync('git', ['-c', 'user.name=test', '-c', 'user.email=test@test', 'commit', '-m', 'add src'], { cwd: dir, stdio: 'ignore' });

  // Run 2: new cache now has prior commits, should NOT trigger legacy migration
  const run2 = spawnSync('node', [intakeCachedPath, '--mode', 'auto', '--format', 'md'], {
    cwd: dir,
    encoding: 'utf8',
    env: envWithCache,
  });
  assert.equal(run2.status, 0, `Run 2 should exit 0, stderr: ${run2.stderr.slice(0, 300)}`);
  assert.ok(
    !run2.stderr.includes('Legacy cache detected'),
    `Run 2 should NOT trigger legacy migration, stderr: ${run2.stderr.slice(0, 300)}`
  );
});

// ============================================================================
// Edge cases
// ============================================================================

test('scan_repo.js — empty repo (no files)', () => {
  const dir = createTempRepo();
  const { output, ok } = runScannerJson(scanRepoPath, dir);
  assert.ok(ok, 'Should not crash on empty repo');
  assert.equal(output.schemaVersion, 2);
  assert.ok(Array.isArray(output.ecosystems));
  assert.equal(output.entrypoints.length, 0);
});

test('scan_repo.js — non-git directory (fallback walk)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sd0x-intake-nogit-'));
  tempDirs.push(dir);
  writeFileSync(join(dir, 'README.md'), '# Hello\n');
  writeFileSync(join(dir, 'package.json'), '{}');

  const { output, ok } = runScannerJson(scanRepoPath, dir);
  assert.ok(ok, 'Should work without git');
  assert.equal(output.hasGit, false);
  assert.equal(output.schemaVersion, 2);
});

test('intake_cached.js — exits 2 for non-git directory', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sd0x-intake-nogit2-'));
  tempDirs.push(dir);

  const { status } = runScanner(intakeCachedPath, dir, ['--mode', 'full']);
  assert.equal(status, 2, 'Should exit 2 when not in a git repo');
});

test('scan_delta.js — no MidwayJS topology files in config', () => {
  // Verify that MidwayJS-specific files are NOT in the topology list
  const src = readFileSync(scanDeltaPath, 'utf8');
  assert.ok(!src.includes('configuration.ts'), 'Should not reference configuration.ts');
  assert.ok(!src.includes('midway.config'), 'Should not reference midway.config');
  assert.ok(!src.includes('bootstrap.'), 'Should not reference bootstrap files');
});

test('scan_delta.js — nested topology file (monorepo) triggers shouldRunFull', () => {
  const dir = createTempRepo();
  mkdirSync(join(dir, 'packages', 'api'), { recursive: true });
  writeFileSync(join(dir, 'packages', 'api', 'package.json'), '{}');
  execFileSync('git', ['-c', 'user.name=test', '-c', 'user.email=test@test', 'add', '-A'], { cwd: dir, stdio: 'ignore' });
  execFileSync('git', ['-c', 'user.name=test', '-c', 'user.email=test@test', 'commit', '-m', 'add nested pkg'], { cwd: dir, stdio: 'ignore' });

  // Modify nested topology file
  writeFileSync(join(dir, 'packages', 'api', 'package.json'), JSON.stringify({ name: 'api' }));
  execFileSync('git', ['-c', 'user.name=test', '-c', 'user.email=test@test', 'add', '-A'], { cwd: dir, stdio: 'ignore' });
  execFileSync('git', ['-c', 'user.name=test', '-c', 'user.email=test@test', 'commit', '-m', 'update nested pkg'], { cwd: dir, stdio: 'ignore' });

  const { output } = runScannerJson(scanDeltaPath, dir, ['--base', 'HEAD~1']);
  assert.ok(output.shouldRunFull, 'nested topology change should trigger full');
  assert.ok(output.reasons.includes('topology-changed'));
});

test('scan_repo.js — ignore_prefixes filters vendor/dist files', () => {
  const dir = createTempRepo();
  writeFileSync(join(dir, 'package.json'), '{}');
  mkdirSync(join(dir, 'dist'), { recursive: true });
  writeFileSync(join(dir, 'dist', 'index.js'), 'built');
  mkdirSync(join(dir, 'src'), { recursive: true });
  writeFileSync(join(dir, 'src', 'index.js'), 'source');
  execFileSync('git', ['-c', 'user.name=test', '-c', 'user.email=test@test', 'add', '-A'], { cwd: dir, stdio: 'ignore' });
  execFileSync('git', ['-c', 'user.name=test', '-c', 'user.email=test@test', 'commit', '-m', 'add'], { cwd: dir, stdio: 'ignore' });

  const { output } = runScannerJson(scanRepoPath, dir);
  // dist/ files should be excluded from entrypoints
  const entryFiles = output.entrypoints.map(e => e.file);
  assert.ok(!entryFiles.some(f => f.startsWith('dist/')), 'dist/ files should be filtered by ignore_prefixes');
});

test('scan_repo.js — Go ecosystem detected', () => {
  const dir = createTempRepo();
  writeFileSync(join(dir, 'go.mod'), 'module example.com/test\n\ngo 1.21');
  mkdirSync(join(dir, 'cmd', 'server'), { recursive: true });
  writeFileSync(join(dir, 'cmd', 'server', 'main.go'), 'package main');
  execFileSync('git', ['-c', 'user.name=test', '-c', 'user.email=test@test', 'add', '-A'], { cwd: dir, stdio: 'ignore' });
  execFileSync('git', ['-c', 'user.name=test', '-c', 'user.email=test@test', 'commit', '-m', 'add'], { cwd: dir, stdio: 'ignore' });

  const { output } = runScannerJson(scanRepoPath, dir);
  assert.ok(output.ecosystems.includes('go'));
  assert.ok(output.testRunner.runner === 'go test');
  // cmd/*/main.go should be detected as entry
  assert.ok(
    output.entrypoints.some(e => e.file === 'cmd/server/main.go'),
    `Expected cmd/server/main.go in entries, got: ${JSON.stringify(output.entrypoints)}`
  );
});
