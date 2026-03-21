const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const {
  mkdtempSync,
  writeFileSync,
  mkdirSync,
  symlinkSync,
  readFileSync,
  readlinkSync,
  existsSync,
  lstatSync,
  rmSync,
} = require('node:fs');
const { join, resolve } = require('node:path');
const { tmpdir } = require('node:os');
const { spawnSync } = require('node:child_process');

const scriptPath = resolve(__dirname, '../../scripts/worktree-claude-sync.sh');
const tempDirs = [];

function makeTempDir(prefix) {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

/**
 * Build a fake main worktree with .claude/ structure.
 * Returns { mainRoot, worktreeRoot } paths.
 */
function setupFixture(options = {}) {
  const {
    withSource = true,
    withRootClaudeMd = true,
    symlinks = ['agents', 'commands', 'hooks', 'rules', 'scripts', 'skills'],
    extraSymlinks = {},  // { name: target }
    copyFiles = ['.gitignore', 'settings.local.json'],
    skipGitInit = false,
  } = options;

  const root = makeTempDir('sd0x-wt-test-');
  const mainRoot = join(root, 'main-repo');
  const worktreeRoot = join(root, 'wt-test');

  mkdirSync(mainRoot, { recursive: true });
  mkdirSync(worktreeRoot, { recursive: true });

  // Initialize git in main so git rev-parse works
  if (!skipGitInit) {
    spawnSync('git', ['init'], { cwd: mainRoot, encoding: 'utf8' });
    // Create a commit so we can add a worktree
    writeFileSync(join(mainRoot, '.gitkeep'), '');
    spawnSync('git', ['add', '.'], { cwd: mainRoot, encoding: 'utf8' });
    spawnSync('git', ['commit', '-m', 'init', '--no-gpg-sign'], {
      cwd: mainRoot,
      encoding: 'utf8',
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: 'Test',
        GIT_AUTHOR_EMAIL: 'test@test.com',
        GIT_COMMITTER_NAME: 'Test',
        GIT_COMMITTER_EMAIL: 'test@test.com',
      },
    });
  }

  // Create tracked directories in main
  for (const dir of symlinks) {
    mkdirSync(join(mainRoot, dir), { recursive: true });
    writeFileSync(join(mainRoot, dir, '.gitkeep'), '');
  }

  // Create tracked directories in worktree (simulating git checkout)
  for (const dir of symlinks) {
    mkdirSync(join(worktreeRoot, dir), { recursive: true });
    writeFileSync(join(worktreeRoot, dir, '.gitkeep'), '');
  }

  if (withRootClaudeMd) {
    writeFileSync(join(mainRoot, 'CLAUDE.md'), '# Main CLAUDE.md');
    writeFileSync(join(worktreeRoot, 'CLAUDE.md'), '# Main CLAUDE.md');
  }

  if (withSource) {
    const sourceDir = join(mainRoot, '.claude');
    mkdirSync(sourceDir, { recursive: true });

    // Create symlinks
    for (const dir of symlinks) {
      symlinkSync(`../${dir}`, join(sourceDir, dir));
    }

    // Extra symlinks (for non-canonical tests)
    for (const [name, target] of Object.entries(extraSymlinks)) {
      symlinkSync(target, join(sourceDir, name));
    }

    // Create copy files
    for (const file of copyFiles) {
      if (file === '.gitignore') {
        writeFileSync(join(sourceDir, file), '.claude/cache/\n');
      } else if (file === 'settings.local.json') {
        writeFileSync(join(sourceDir, file), JSON.stringify({ allowedTools: [] }));
      }
    }

    // CLAUDE.md in .claude/
    writeFileSync(join(sourceDir, 'CLAUDE.md'), '# .claude CLAUDE.md');
  }

  // Make worktree look like a git worktree by linking .git
  // Point worktree's .git to main's .git dir
  if (!skipGitInit) {
    const mainGitDir = join(mainRoot, '.git');
    const wtGitFile = join(worktreeRoot, '.git');
    // Real git worktrees use a file: gitdir: /path/to/main/.git/worktrees/name
    // For testing, we create a minimal worktree structure
    const worktreesDir = join(mainGitDir, 'worktrees', 'wt-test');
    mkdirSync(worktreesDir, { recursive: true });
    writeFileSync(join(worktreesDir, 'gitdir'), wtGitFile);
    writeFileSync(join(worktreesDir, 'commondir'), '../..');
    // HEAD file
    writeFileSync(join(worktreesDir, 'HEAD'), 'ref: refs/heads/main');
    // worktree .git file points to worktrees dir
    writeFileSync(wtGitFile, `gitdir: ${worktreesDir}\n`);
  }

  return { mainRoot, worktreeRoot, root };
}

function runSync(worktreePath, extraArgs = [], envOverrides = {}) {
  const result = spawnSync('bash', [scriptPath, worktreePath, ...extraArgs], {
    encoding: 'utf8',
    env: { ...process.env, ...envOverrides },
    timeout: 10000,
  });
  return result;
}

after(() => {
  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
});

// --- T1: Happy path ---
test('T1: happy path — full sync with symlinks and copies', () => {
  const { worktreeRoot } = setupFixture();
  const result = runSync(worktreeRoot);

  assert.equal(result.status, 0, `stderr: ${result.stderr}`);
  assert.match(result.stdout, /Status: SYNCED/);

  // Verify symlinks
  for (const dir of ['agents', 'commands', 'hooks', 'rules', 'scripts', 'skills']) {
    const link = join(worktreeRoot, '.claude', dir);
    assert.ok(lstatSync(link).isSymbolicLink(), `${dir} should be symlink`);
    assert.equal(readlinkSync(link), `../${dir}`);
  }

  // Verify CLAUDE.md symlink
  const claudeMdLink = join(worktreeRoot, '.claude', 'CLAUDE.md');
  assert.ok(lstatSync(claudeMdLink).isSymbolicLink(), 'CLAUDE.md should be symlink');
  assert.equal(readlinkSync(claudeMdLink), '../CLAUDE.md');

  // Verify copies
  assert.ok(existsSync(join(worktreeRoot, '.claude', '.gitignore')));
  assert.ok(existsSync(join(worktreeRoot, '.claude', 'settings.local.json')));
  // .sd0x-install-state.json removed from copy list (now at .sd0x/install-state.json, project root)

  // Verify marker
  assert.ok(existsSync(join(worktreeRoot, '.claude', '.sync-complete')));
});

// --- T2: Idempotent ---
test('T2: idempotent — already synced skips', () => {
  const { worktreeRoot } = setupFixture();

  // First sync
  const first = runSync(worktreeRoot);
  assert.equal(first.status, 0);
  assert.match(first.stdout, /Status: SYNCED/);

  // Second sync
  const second = runSync(worktreeRoot);
  assert.equal(second.status, 0);
  assert.match(second.stdout, /Status: SKIPPED/);
  assert.match(second.stdout, /already synced/);
});

// --- T3: User-managed .claude/ ---
test('T3: user-managed .claude/ exists — skip', () => {
  const { worktreeRoot } = setupFixture();

  // Create user-managed .claude/ before sync
  mkdirSync(join(worktreeRoot, '.claude'), { recursive: true });
  writeFileSync(join(worktreeRoot, '.claude', 'my-custom-config'), 'user data');

  const result = runSync(worktreeRoot);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /Status: SKIPPED/);
  assert.match(result.stdout, /user-managed/);

  // User data preserved
  assert.ok(existsSync(join(worktreeRoot, '.claude', 'my-custom-config')));
});

// --- T4: Source .claude/ missing ---
test('T4: source .claude/ missing — SKIPPED_NO_SOURCE', () => {
  const { worktreeRoot } = setupFixture({ withSource: false });
  const result = runSync(worktreeRoot);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Status: SKIPPED_NO_SOURCE/);
  // No .claude/ should be created
  assert.ok(!existsSync(join(worktreeRoot, '.claude')));
  // No staging should exist
  assert.ok(!existsSync(join(worktreeRoot, '.claude-staging')));
});

// --- T5: --dry-run ---
test('T5: --dry-run does not create any files', () => {
  const { worktreeRoot } = setupFixture();
  const result = runSync(worktreeRoot, ['--dry-run']);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /DRY RUN/);
  assert.match(result.stdout, /Status: DRY_RUN/);

  // Nothing created
  assert.ok(!existsSync(join(worktreeRoot, '.claude')));
  assert.ok(!existsSync(join(worktreeRoot, '.claude-staging')));
});

// --- T6: Symlink target validation (exact match) ---
test('T6: non-canonical symlink target — skip with warning', () => {
  const root = makeTempDir('sd0x-wt-noncanon-');
  const mainRoot = join(root, 'main-repo');
  const worktreeRoot = join(root, 'wt-test');

  mkdirSync(mainRoot, { recursive: true });
  mkdirSync(worktreeRoot, { recursive: true });

  // Init git
  spawnSync('git', ['init'], { cwd: mainRoot, encoding: 'utf8' });
  writeFileSync(join(mainRoot, '.gitkeep'), '');
  spawnSync('git', ['add', '.'], { cwd: mainRoot, encoding: 'utf8' });
  spawnSync('git', ['commit', '-m', 'init', '--no-gpg-sign'], {
    cwd: mainRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: 'Test',
      GIT_AUTHOR_EMAIL: 'test@test.com',
      GIT_COMMITTER_NAME: 'Test',
      GIT_COMMITTER_EMAIL: 'test@test.com',
    },
  });

  // Setup worktree git
  const mainGitDir = join(mainRoot, '.git');
  const worktreesDir = join(mainGitDir, 'worktrees', 'wt-test');
  mkdirSync(worktreesDir, { recursive: true });
  const wtGitFile = join(worktreeRoot, '.git');
  writeFileSync(join(worktreesDir, 'gitdir'), wtGitFile);
  writeFileSync(join(worktreesDir, 'commondir'), '../..');
  writeFileSync(join(worktreesDir, 'HEAD'), 'ref: refs/heads/main');
  writeFileSync(wtGitFile, `gitdir: ${worktreesDir}\n`);

  // Create source .claude/ with one non-canonical symlink
  const sourceDir = join(mainRoot, '.claude');
  mkdirSync(sourceDir);
  // agents uses absolute path instead of relative
  mkdirSync(join(mainRoot, 'agents'));
  symlinkSync(join(mainRoot, 'agents'), join(sourceDir, 'agents'));  // absolute!
  // commands is correct
  mkdirSync(join(mainRoot, 'commands'));
  mkdirSync(join(worktreeRoot, 'commands'), { recursive: true });
  symlinkSync('../commands', join(sourceDir, 'commands'));

  writeFileSync(join(sourceDir, 'CLAUDE.md'), '# test');
  writeFileSync(join(worktreeRoot, 'CLAUDE.md'), '# test');

  const result = runSync(worktreeRoot);
  assert.equal(result.status, 0, `stderr: ${result.stderr}\nstdout: ${result.stdout}`);
  assert.match(result.stdout, /non-canonical/);
  // agents should be skipped as non-canonical (absolute path)
  assert.match(result.stdout, /agents.*non-canonical/);
  // commands should succeed (correct relative symlink)
  assert.match(result.stdout, /commands.*symlink.*✅/);
});

// --- T7: Symlink boundary check ---
test('T7: symlink boundary escape — skip with warning', () => {
  const root = makeTempDir('sd0x-wt-boundary-');
  const mainRoot = join(root, 'main-repo');
  const worktreeRoot = join(root, 'wt-test');
  const outsideDir = join(root, 'outside');

  mkdirSync(mainRoot, { recursive: true });
  mkdirSync(worktreeRoot, { recursive: true });
  mkdirSync(outsideDir, { recursive: true });

  // Init git
  spawnSync('git', ['init'], { cwd: mainRoot, encoding: 'utf8' });
  writeFileSync(join(mainRoot, '.gitkeep'), '');
  spawnSync('git', ['add', '.'], { cwd: mainRoot, encoding: 'utf8' });
  spawnSync('git', ['commit', '-m', 'init', '--no-gpg-sign'], {
    cwd: mainRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: 'Test',
      GIT_AUTHOR_EMAIL: 'test@test.com',
      GIT_COMMITTER_NAME: 'Test',
      GIT_COMMITTER_EMAIL: 'test@test.com',
    },
  });

  // Setup worktree git
  const mainGitDir = join(mainRoot, '.git');
  const worktreesDir = join(mainGitDir, 'worktrees', 'wt-test');
  mkdirSync(worktreesDir, { recursive: true });
  const wtGitFile = join(worktreeRoot, '.git');
  writeFileSync(join(worktreesDir, 'gitdir'), wtGitFile);
  writeFileSync(join(worktreesDir, 'commondir'), '../..');
  writeFileSync(join(worktreesDir, 'HEAD'), 'ref: refs/heads/main');
  writeFileSync(wtGitFile, `gitdir: ${worktreesDir}\n`);

  // Source .claude/ — agents points to outside dir via crafted relative path
  const sourceDir = join(mainRoot, '.claude');
  mkdirSync(sourceDir);
  // Normal symlink but point agents target to ../agents which resolves outside worktree
  // The expected target is ../agents, which from .claude-staging/ would be wt-test/agents
  // To test escape: create a worktree without an 'agents' dir so realpath -m resolves
  // but we can't really test boundary escape with ../agents since it resolves within wt-test/
  // Instead, test with a custom target that escapes
  // Actually the script checks exact match first, so non-matching targets are caught by T6.
  // The boundary check only fires when target matches expected but resolves outside.
  // This is a very edge case (e.g., worktree root has a symlink named 'agents' pointing elsewhere)
  // For this test, we make '../agents' in worktree a symlink to outside
  symlinkSync('../agents', join(sourceDir, 'agents'));
  symlinkSync(outsideDir, join(worktreeRoot, 'agents'));  // agents → outside

  writeFileSync(join(sourceDir, 'CLAUDE.md'), '# test');
  writeFileSync(join(worktreeRoot, 'CLAUDE.md'), '# test');

  const result = runSync(worktreeRoot);
  assert.equal(result.status, 0);
  // The boundary check should catch this since agents resolves outside worktree
  assert.match(result.stdout, /boundary escape/);
});

// --- T8: Partial failure recovery ---
test('T8: stale staging cleaned and retry succeeds', () => {
  const { worktreeRoot } = setupFixture();

  // Create stale staging
  mkdirSync(join(worktreeRoot, '.claude-staging'), { recursive: true });
  writeFileSync(join(worktreeRoot, '.claude-staging', 'leftover'), 'stale');

  const result = runSync(worktreeRoot);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /Status: SYNCED/);
  // Staging should be gone (renamed to .claude)
  assert.ok(!existsSync(join(worktreeRoot, '.claude-staging')));
  assert.ok(existsSync(join(worktreeRoot, '.claude')));
});

// --- T9: CLAUDE.md symlink target ---
test('T9: CLAUDE.md symlinks to ../CLAUDE.md', () => {
  const { worktreeRoot } = setupFixture();
  const result = runSync(worktreeRoot);
  assert.equal(result.status, 0);

  const link = join(worktreeRoot, '.claude', 'CLAUDE.md');
  assert.ok(lstatSync(link).isSymbolicLink());
  assert.equal(readlinkSync(link), '../CLAUDE.md');
});

// --- T10: .gitignore is copied (not symlinked) ---
test('T10: .gitignore is copied not symlinked', () => {
  const { worktreeRoot } = setupFixture();
  runSync(worktreeRoot);

  const target = join(worktreeRoot, '.claude', '.gitignore');
  assert.ok(existsSync(target));
  assert.ok(!lstatSync(target).isSymbolicLink(), '.gitignore should be a file, not symlink');
});

// --- T11: settings.local.json is copied (isolated) ---
test('T11: settings.local.json is copied and isolated', () => {
  const { mainRoot, worktreeRoot } = setupFixture();
  runSync(worktreeRoot);

  const source = join(mainRoot, '.claude', 'settings.local.json');
  const target = join(worktreeRoot, '.claude', 'settings.local.json');
  assert.ok(existsSync(target));
  assert.ok(!lstatSync(target).isSymbolicLink());

  // Modify target, source should not change
  const originalSource = readFileSync(source, 'utf8');
  writeFileSync(target, '{"modified": true}');
  assert.equal(readFileSync(source, 'utf8'), originalSource);
});

// --- T12: .sd0x-install-state.json no longer copied (moved to .sd0x/install-state.json at project root) ---
test('T12: .sd0x-install-state.json is NOT copied (path unified to .sd0x/)', () => {
  const { worktreeRoot, mainRoot } = setupFixture();
  // Create old-path file to ensure it's NOT copied
  const sourceDir = join(mainRoot, '.claude');
  writeFileSync(join(sourceDir, '.sd0x-install-state.json'), '{"legacy": true}');
  runSync(worktreeRoot);

  const target = join(worktreeRoot, '.claude', '.sd0x-install-state.json');
  assert.ok(!existsSync(target), '.sd0x-install-state.json should NOT be copied to worktree');
});

// --- T13: Staging → atomic rename succeeds ---
test('T13: staging directory is atomically renamed to .claude', () => {
  const { worktreeRoot } = setupFixture();
  const result = runSync(worktreeRoot);

  assert.equal(result.status, 0);
  // No staging directory should remain
  assert.ok(!existsSync(join(worktreeRoot, '.claude-staging')));
  // .claude should exist with marker
  assert.ok(existsSync(join(worktreeRoot, '.claude', '.sync-complete')));
});

// --- T14: Invalid worktree path ---
test('T14: invalid worktree path — error exit 1', () => {
  const result = runSync('/nonexistent/path/abc123');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /does not exist/);
});

// --- T15: Staging + user .claude/ coexist ---
test('T15: staging + user .claude/ coexist — clean staging, preserve .claude/', () => {
  const { worktreeRoot } = setupFixture();

  // Create user-managed .claude/ and stale staging
  mkdirSync(join(worktreeRoot, '.claude'), { recursive: true });
  writeFileSync(join(worktreeRoot, '.claude', 'user-file'), 'precious');
  mkdirSync(join(worktreeRoot, '.claude-staging'), { recursive: true });
  writeFileSync(join(worktreeRoot, '.claude-staging', 'stale'), 'old');

  const result = runSync(worktreeRoot);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /Status: SKIPPED/);

  // User data preserved
  assert.ok(existsSync(join(worktreeRoot, '.claude', 'user-file')));
  assert.equal(readFileSync(join(worktreeRoot, '.claude', 'user-file'), 'utf8'), 'precious');
  // Staging cleaned
  assert.ok(!existsSync(join(worktreeRoot, '.claude-staging')));
});

// --- Extra: --help ---
test('--help exits 0 and shows usage', () => {
  const result = spawnSync('bash', [scriptPath, '--help'], { encoding: 'utf8' });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /Usage:/);
});

// --- Extra: no args ---
test('no arguments exits 2', () => {
  const result = spawnSync('bash', [scriptPath], { encoding: 'utf8' });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /required/);
});

// --- Extra: CLAUDE.md fallback when root CLAUDE.md missing ---
test('CLAUDE.md fallback — copy from source when root file missing', () => {
  const { worktreeRoot } = setupFixture({ withRootClaudeMd: false });

  // Remove worktree CLAUDE.md (simulating it doesn't exist)
  if (existsSync(join(worktreeRoot, 'CLAUDE.md'))) {
    rmSync(join(worktreeRoot, 'CLAUDE.md'));
  }

  const result = runSync(worktreeRoot);
  assert.equal(result.status, 0);

  const claudeMd = join(worktreeRoot, '.claude', 'CLAUDE.md');
  assert.ok(existsSync(claudeMd));
  // Should be a copy, not symlink (fallback)
  assert.ok(!lstatSync(claudeMd).isSymbolicLink());
  assert.match(result.stdout, /copy \(fallback\)/);
});
