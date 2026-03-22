const { describe, test, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const {
  mkdtempSync,
  writeFileSync,
  readFileSync,
  mkdirSync,
  chmodSync,
  rmSync,
  existsSync,
  symlinkSync,
} = require('node:fs');
const { join, resolve } = require('node:path');
const { tmpdir } = require('node:os');
const { spawnSync } = require('node:child_process');

const SCRIPT = resolve(
  __dirname,
  '../../skills/git-profile/scripts/git-profile.sh'
);

const tempDirs = [];

function makeTempDir(prefix) {
  const dir = mkdtempSync(join(tmpdir(), `sd0x-gp-${prefix}-`));
  tempDirs.push(dir);
  return dir;
}

function writeExecutable(filePath, content) {
  writeFileSync(filePath, content);
  chmodSync(filePath, 0o755);
}

function linkSystemCommand(binDir, name) {
  const result = spawnSync('which', [name], { encoding: 'utf8' });
  if (result.status !== 0) return false;
  const target = result.stdout.trim();
  if (!target) return false;
  try {
    symlinkSync(target, join(binDir, name));
    return true;
  } catch {
    return false;
  }
}

// Run the script with stubbed git/gpg
function runScript(args, opts = {}) {
  const {
    binDir,
    registryDir,
    gitDir,
    env = {},
  } = opts;

  const pathParts = [];
  if (binDir) pathParts.push(binDir);
  pathParts.push(process.env.PATH);

  const finalEnv = {
    ...process.env,
    PATH: pathParts.join(':'),
    // Isolate from real global/system git config
    GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_CONFIG_SYSTEM: '/dev/null',
    ...env,
  };

  if (registryDir) {
    finalEnv.XDG_CONFIG_HOME = registryDir;
  }

  const spawnOpts = {
    encoding: 'utf8',
    env: finalEnv,
    timeout: 60000,
  };

  if (gitDir) {
    spawnOpts.cwd = gitDir;
  }

  const result = spawnSync('bash', [SCRIPT, ...args], spawnOpts);
  return result;
}

// Create a minimal git repo for testing
function createGitRepo(opts = {}) {
  const {
    userName = 'TestUser',
    userEmail = 'test@example.com',
    signingKey = '',
    gpgSign = '',
  } = opts;

  const dir = makeTempDir('repo');
  spawnSync('git', ['init', '--initial-branch=main'], { cwd: dir });
  if (userName) {
    spawnSync('git', ['config', 'user.name', userName], { cwd: dir });
  }
  if (userEmail) {
    spawnSync('git', ['config', 'user.email', userEmail], { cwd: dir });
  }
  if (signingKey) {
    spawnSync('git', ['config', 'user.signingkey', signingKey], { cwd: dir });
  }
  if (gpgSign) {
    spawnSync('git', ['config', 'commit.gpgsign', gpgSign], { cwd: dir });
  }
  return dir;
}

// Create stub binaries
function createStubBin(opts = {}) {
  const {
    gpgOutput = '',
    gpgExitCode = 0,
  } = opts;

  const binDir = makeTempDir('bin');

  // Stub gpg
  writeExecutable(join(binDir, 'gpg'), `#!/bin/bash
exit ${gpgExitCode}
`);

  if (gpgOutput) {
    writeExecutable(join(binDir, 'gpg'), `#!/bin/bash
case "$*" in
  *--list-secret-keys*--with-colons*)
    cat <<'GPGEOF'
${gpgOutput}
GPGEOF
    exit ${gpgExitCode}
    ;;
  *)
    exit 0
    ;;
esac
`);
  }

  // Link real system commands needed
  for (const cmd of ['git', 'jq', 'cut', 'awk', 'sed', 'head', 'date', 'mktemp', 'chmod', 'mv', 'cp', 'cat', 'grep', 'wc', 'tr', 'printf', 'shasum', 'sha256sum', 'mkdir', 'test', 'bash']) {
    linkSystemCommand(binDir, cmd);
  }

  return binDir;
}

// Sample GPG colon output for active key
const GPG_ACTIVE_KEY = `sec:-:4096:1:A0EEF23730D2BE5B:1708416000:1835020800::-:::scESC:::+:::23::0:
fpr:::::::::D7B9FB02CAEB3E7819633AD4A0EEF23730D2BE5B:
uid:-::::1708416000::ABCD1234::SD0 <107539203+sd0xdev@users.noreply.github.com>::::::::::0:
ssb:-:4096:1:1234567890ABCDEF:1708416000::::::e:::+:::23:`;

// Sample GPG output for expired key
const GPG_EXPIRED_KEY = `sec:e:4096:1:EXPIRED4337E823:1585094400:1711612800::-:::scESC:::+:::23::0:
fpr:::::::::AAAA1111BBBB2222CCCC3333EXPIRED4337E823:
uid:e::::1585094400::EFGH5678::olduser <old@example.com>::::::::::0:`;

// Two keys: one active, one expired
const GPG_MIXED_KEYS = GPG_ACTIVE_KEY + '\n' + GPG_EXPIRED_KEY;

after(() => {
  for (const dir of tempDirs) {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch { /*ignore*/ }
  }
});

// ── doctor ──

describe('doctor', () => {
  test('reports ok with complete config', () => {
    const gitDir = createGitRepo({
      userName: 'SD0',
      userEmail: '107539203+sd0xdev@users.noreply.github.com',
      signingKey: 'D7B9FB02CAEB3E7819633AD4A0EEF23730D2BE5B',
      gpgSign: 'true',
    });
    const binDir = createStubBin({ gpgOutput: GPG_ACTIVE_KEY });

    const result = runScript(['doctor'], { binDir, gitDir });
    assert.equal(result.status, 0);
    const out = JSON.parse(result.stdout);
    assert.equal(out.status, 'ok');
    assert.equal(out.effective_identity.name, 'SD0');
    assert.equal(out.signing.enabled, true);
    assert.equal(out.signing.key_status, 'active');
    assert.equal(out.issues.length, 0);
  });

  test('reports halt when user.name is missing', () => {
    const gitDir = createGitRepo({ userName: '', userEmail: 'test@example.com' });
    // Unset user.name explicitly
    spawnSync('git', ['config', '--unset', 'user.name'], { cwd: gitDir });
    const binDir = createStubBin();

    const result = runScript(['doctor'], { binDir, gitDir });
    assert.equal(result.status, 0);
    const out = JSON.parse(result.stdout);
    assert.equal(out.status, 'halt');
    const codes = out.issues.map(i => i.code);
    assert.ok(codes.includes('MISSING_NAME'));
  });

  test('reports halt when user.email is missing', () => {
    const gitDir = createGitRepo({ userName: 'Test', userEmail: '' });
    spawnSync('git', ['config', '--unset', 'user.email'], { cwd: gitDir });
    const binDir = createStubBin();

    const result = runScript(['doctor'], { binDir, gitDir });
    assert.equal(result.status, 0);
    const out = JSON.parse(result.stdout);
    assert.equal(out.status, 'halt');
    const codes = out.issues.map(i => i.code);
    assert.ok(codes.includes('MISSING_EMAIL'));
  });

  test('reports warn when no signing key', () => {
    const gitDir = createGitRepo({ userName: 'Test', userEmail: 'test@test.com' });
    const binDir = createStubBin();

    const result = runScript(['doctor'], { binDir, gitDir });
    assert.equal(result.status, 0);
    const out = JSON.parse(result.stdout);
    assert.equal(out.status, 'warn');
    const codes = out.issues.map(i => i.code);
    assert.ok(codes.includes('NO_SIGNING_KEY'));
  });

  test('reports warn when key is expired', () => {
    const gitDir = createGitRepo({
      userName: 'Test',
      userEmail: 'old@example.com',
      signingKey: 'AAAA1111BBBB2222CCCC3333EXPIRED4337E823',
      gpgSign: 'true',
    });
    const binDir = createStubBin({ gpgOutput: GPG_EXPIRED_KEY });

    const result = runScript(['doctor'], { binDir, gitDir });
    assert.equal(result.status, 0);
    const out = JSON.parse(result.stdout);
    assert.equal(out.signing.key_status, 'expired');
    const codes = out.issues.map(i => i.code);
    assert.ok(codes.includes('KEY_EXPIRED'));
  });

  test('reports warn when signing key not found in GPG keyring', () => {
    const gitDir = createGitRepo({
      userName: 'Test',
      userEmail: 'test@test.com',
      signingKey: 'AAAA0000BBBB1111CCCC2222DDDD3333EEEE4444',
      gpgSign: 'true',
    });
    // GPG has an active key, but it doesn't match the signing key configured
    const binDir = createStubBin({ gpgOutput: GPG_ACTIVE_KEY });

    const result = runScript(['doctor'], { binDir, gitDir });
    assert.equal(result.status, 0);
    const out = JSON.parse(result.stdout);
    assert.equal(out.status, 'warn');
    const codes = out.issues.map(i => i.code);
    assert.ok(codes.includes('KEY_NOT_FOUND'));
  });

  test('detects multi-value identity conflict', () => {
    const gitDir = createGitRepo({ userName: 'LocalName', userEmail: 'local@test.com' });
    // Add a second different value via --add to simulate scope conflict
    spawnSync('git', ['config', '--add', 'user.name', 'OtherName'], { cwd: gitDir });
    const binDir = createStubBin();

    const result = runScript(['doctor'], { binDir, gitDir });
    assert.equal(result.status, 0);
    const out = JSON.parse(result.stdout);
    assert.equal(out.status, 'warn');
    const codes = out.issues.map(i => i.code);
    assert.ok(codes.includes('MULTI_VALUE_NAME'));
  });

  test('does not warn when multi-value identity has same values', () => {
    const gitDir = createGitRepo({ userName: 'SameName', userEmail: 'same@test.com' });
    // Add the exact same value again
    spawnSync('git', ['config', '--add', 'user.name', 'SameName'], { cwd: gitDir });
    const binDir = createStubBin();

    const result = runScript(['doctor'], { binDir, gitDir });
    assert.equal(result.status, 0);
    const out = JSON.parse(result.stdout);
    const codes = out.issues.map(i => i.code);
    assert.ok(!codes.includes('MULTI_VALUE_NAME'), 'should not warn when values are identical');
  });

  test('detects environment variable override', () => {
    const gitDir = createGitRepo({ userName: 'Test', userEmail: 'test@test.com' });
    const binDir = createStubBin();

    const result = runScript(['doctor'], {
      binDir,
      gitDir,
      env: { GIT_AUTHOR_NAME: 'OverrideName' },
    });
    assert.equal(result.status, 0);
    const out = JSON.parse(result.stdout);
    const codes = out.issues.map(i => i.code);
    assert.ok(codes.includes('ENV_OVERRIDE'));
  });

  test('handles gpg unavailable gracefully', () => {
    const gitDir = createGitRepo({
      userName: 'Test',
      userEmail: 'test@test.com',
      signingKey: 'ABCDEF1234567890',
    });
    const binDir = makeTempDir('nobin');
    // Link everything except gpg
    for (const cmd of ['git', 'jq', 'cut', 'awk', 'sed', 'head', 'date', 'mktemp', 'chmod', 'mv', 'cp', 'cat', 'grep', 'wc', 'tr', 'printf', 'shasum', 'mkdir', 'test', 'bash']) {
      linkSystemCommand(binDir, cmd);
    }
    // gpg stub that pretends command not found
    writeExecutable(join(binDir, 'gpg'), '#!/bin/bash\nexit 127\n');

    const result = runScript(['doctor'], { binDir, gitDir });
    assert.equal(result.status, 0);
    const out = JSON.parse(result.stdout);
    // Should not crash, key_status should be missing
    assert.equal(out.signing.key_status, 'missing');
  });
});

// ── list ──

describe('list', () => {
  test('lists profiles from registry', () => {
    const gitDir = createGitRepo({ userName: 'Test', userEmail: 'test@example.com' });
    const binDir = createStubBin();
    const registryDir = makeTempDir('cfg');
    const regPath = join(registryDir, 'sd0x-dev-flow');
    mkdirSync(regPath, { recursive: true });
    writeFileSync(join(regPath, 'git-profiles.json'), JSON.stringify({
      version: 1,
      profiles: {
        'test-profile': {
          name: 'Test',
          email: 'test@example.com',
          signingkey: 'ABCD1234',
          gpg_format: 'openpgp',
          mru: null,
          source: 'manual',
        },
      },
      active_repos: {},
    }));

    const result = runScript(['list'], { binDir, gitDir, registryDir });
    assert.equal(result.status, 0);
    const out = JSON.parse(result.stdout);
    assert.equal(out.count, 1);
    assert.equal(out.profiles[0].id, 'test-profile');
    assert.equal(out.profiles[0].is_current_match, true);
  });

  test('returns empty list when registry missing', () => {
    const gitDir = createGitRepo({ userName: 'Test', userEmail: 'test@test.com' });
    const binDir = createStubBin();
    const registryDir = makeTempDir('emptycfg');

    const result = runScript(['list'], { binDir, gitDir, registryDir });
    assert.equal(result.status, 0);
    const out = JSON.parse(result.stdout);
    assert.equal(out.count, 0);
    assert.equal(out.profiles.length, 0);
  });

  test('marks active profile', () => {
    const gitDir = createGitRepo({ userName: 'Test', userEmail: 'test@example.com' });
    const binDir = createStubBin();
    const registryDir = makeTempDir('cfg');
    const regPath = join(registryDir, 'sd0x-dev-flow');
    mkdirSync(regPath, { recursive: true });

    // Get the repo path as git sees it
    const repoPath = spawnSync('git', ['rev-parse', '--show-toplevel'], {
      cwd: gitDir,
      encoding: 'utf8',
    }).stdout.trim();

    writeFileSync(join(regPath, 'git-profiles.json'), JSON.stringify({
      version: 1,
      profiles: {
        'my-profile': {
          name: 'Test',
          email: 'test@example.com',
          signingkey: '',
          gpg_format: 'openpgp',
          mru: null,
          source: 'manual',
        },
      },
      active_repos: { [repoPath]: 'my-profile' },
    }));

    const result = runScript(['list'], { binDir, gitDir, registryDir });
    assert.equal(result.status, 0);
    const out = JSON.parse(result.stdout);
    assert.equal(out.active_profile, 'my-profile');
    assert.equal(out.profiles[0].is_active, true);
  });
});

// ── use (resolve + apply) ──

describe('use (resolve + apply)', () => {
  test('resolve returns plan and hash', () => {
    const gitDir = createGitRepo({ userName: 'OldName', userEmail: 'old@test.com' });
    const binDir = createStubBin({ gpgOutput: GPG_ACTIVE_KEY });
    const registryDir = makeTempDir('cfg');
    const regPath = join(registryDir, 'sd0x-dev-flow');
    mkdirSync(regPath, { recursive: true });
    writeFileSync(join(regPath, 'git-profiles.json'), JSON.stringify({
      version: 1,
      profiles: {
        'target': {
          name: 'NewName',
          email: 'new@test.com',
          signingkey: 'D7B9FB02CAEB3E7819633AD4A0EEF23730D2BE5B',
          gpg_format: 'openpgp',
          mru: null,
          source: 'manual',
        },
      },
      active_repos: {},
    }));

    const result = runScript(['resolve', 'target'], { binDir, gitDir, registryDir });
    assert.equal(result.status, 0);
    const out = JSON.parse(result.stdout);
    assert.equal(out.profile_id, 'target');
    assert.ok(out.plan_hash);
    assert.equal(out.plan_hash.length, 8);
    assert.equal(out.profile.name, 'NewName');
    assert.equal(out.current.name, 'OldName');
  });

  test('resolve fails for unknown profile', () => {
    const gitDir = createGitRepo();
    const binDir = createStubBin();
    const registryDir = makeTempDir('cfg');
    const regPath = join(registryDir, 'sd0x-dev-flow');
    mkdirSync(regPath, { recursive: true });
    writeFileSync(join(regPath, 'git-profiles.json'), JSON.stringify({
      version: 1,
      profiles: {},
      active_repos: {},
    }));

    const result = runScript(['resolve', 'nonexistent'], { binDir, gitDir, registryDir });
    assert.equal(result.status, 2);
    assert.ok(result.stderr.includes('Unknown profile'));
  });

  test('apply writes local config and updates registry', () => {
    const gitDir = createGitRepo({ userName: 'OldName', userEmail: 'old@test.com' });
    const binDir = createStubBin();
    const registryDir = makeTempDir('cfg');
    const regPath = join(registryDir, 'sd0x-dev-flow');
    mkdirSync(regPath, { recursive: true });
    writeFileSync(join(regPath, 'git-profiles.json'), JSON.stringify({
      version: 1,
      profiles: {
        'target': {
          name: 'NewName',
          email: 'new@test.com',
          signingkey: '',
          gpg_format: 'openpgp',
          mru: null,
          source: 'manual',
        },
      },
      active_repos: {},
    }));

    // First resolve to get the hash
    const resolveResult = runScript(['resolve', 'target'], { binDir, gitDir, registryDir });
    assert.equal(resolveResult.status, 0);
    const plan = JSON.parse(resolveResult.stdout);

    // Then apply
    const applyResult = runScript(['apply', '--plan-hash', plan.plan_hash], {
      binDir,
      gitDir,
      registryDir,
    });
    assert.equal(applyResult.status, 0, `Apply failed: ${applyResult.stderr}`);
    const out = JSON.parse(applyResult.stdout);
    assert.equal(out.applied, true);
    assert.equal(out.verified, true);
    assert.equal(out.effective.name, 'NewName');
    assert.equal(out.effective.email, 'new@test.com');

    // Verify git config was actually written
    const nameCheck = spawnSync('git', ['config', '--local', '--get', 'user.name'], {
      cwd: gitDir,
      encoding: 'utf8',
    });
    assert.equal(nameCheck.stdout.trim(), 'NewName');

    // Verify registry updated
    const reg = JSON.parse(readFileSync(join(regPath, 'git-profiles.json'), 'utf8'));
    assert.ok(reg.profiles.target.mru);
    const repoPath = spawnSync('git', ['rev-parse', '--show-toplevel'], {
      cwd: gitDir,
      encoding: 'utf8',
    }).stdout.trim();
    assert.equal(reg.active_repos[repoPath], 'target');
  });

  test('apply rejects stale plan hash', () => {
    const gitDir = createGitRepo({ userName: 'Test', userEmail: 'test@test.com' });
    const binDir = createStubBin();
    const registryDir = makeTempDir('cfg');
    const regPath = join(registryDir, 'sd0x-dev-flow');
    mkdirSync(regPath, { recursive: true });
    writeFileSync(join(regPath, 'git-profiles.json'), JSON.stringify({
      version: 1,
      profiles: {
        'target': {
          name: 'NewName',
          email: 'new@test.com',
          signingkey: '',
          gpg_format: 'openpgp',
          mru: null,
          source: 'manual',
        },
      },
      active_repos: {},
    }));

    const result = runScript(['apply', '--plan-hash', 'deadbeef'], {
      binDir,
      gitDir,
      registryDir,
    });
    assert.equal(result.status, 2);
    assert.ok(result.stderr.includes('Plan hash mismatch'));
  });

  test('apply clears signing config when switching to keyless profile', () => {
    const gitDir = createGitRepo({
      userName: 'OldName',
      userEmail: 'old@test.com',
      signingKey: 'D7B9FB02CAEB3E7819633AD4A0EEF23730D2BE5B',
      gpgSign: 'true',
    });
    const binDir = createStubBin();
    const registryDir = makeTempDir('cfg');
    const regPath = join(registryDir, 'sd0x-dev-flow');
    mkdirSync(regPath, { recursive: true });
    writeFileSync(join(regPath, 'git-profiles.json'), JSON.stringify({
      version: 1,
      profiles: {
        'keyless': {
          name: 'KeylessUser',
          email: 'keyless@test.com',
          signingkey: '',
          gpg_format: 'openpgp',
          mru: null,
          source: 'manual',
        },
      },
      active_repos: {},
    }));

    // Resolve
    const resolveResult = runScript(['resolve', 'keyless'], { binDir, gitDir, registryDir });
    assert.equal(resolveResult.status, 0);
    const plan = JSON.parse(resolveResult.stdout);

    // Verify keyless plan contains unset actions
    const signingkeyCmd = plan.plan.commands.find(c => c.key === 'user.signingkey');
    assert.ok(signingkeyCmd, 'plan should include user.signingkey command');
    assert.equal(signingkeyCmd.action, 'unset', 'keyless profile should unset signingkey');
    const gpgsignCmd = plan.plan.commands.find(c => c.key === 'commit.gpgsign');
    assert.ok(gpgsignCmd, 'plan should include commit.gpgsign command');
    assert.equal(gpgsignCmd.action, 'unset', 'keyless profile should unset gpgsign');

    // Apply
    const applyResult = runScript(['apply', '--plan-hash', plan.plan_hash], {
      binDir, gitDir, registryDir,
    });
    assert.equal(applyResult.status, 0, `Apply failed: ${applyResult.stderr}`);
    const out = JSON.parse(applyResult.stdout);
    assert.equal(out.applied, true);
    assert.equal(out.effective.name, 'KeylessUser');

    // Verify signing config was cleared
    const signCheck = spawnSync('git', ['config', '--local', '--get', 'user.signingkey'], {
      cwd: gitDir, encoding: 'utf8',
    });
    assert.notEqual(signCheck.status, 0, 'user.signingkey should be unset');

    const gpgsignCheck = spawnSync('git', ['config', '--local', '--get', 'commit.gpgsign'], {
      cwd: gitDir, encoding: 'utf8',
    });
    assert.notEqual(gpgsignCheck.status, 0, 'commit.gpgsign should be unset');
  });

  test('resolve warns about expired key', () => {
    const gitDir = createGitRepo({ userName: 'Test', userEmail: 'old@example.com' });
    const binDir = createStubBin({ gpgOutput: GPG_EXPIRED_KEY });
    const registryDir = makeTempDir('cfg');
    const regPath = join(registryDir, 'sd0x-dev-flow');
    mkdirSync(regPath, { recursive: true });
    writeFileSync(join(regPath, 'git-profiles.json'), JSON.stringify({
      version: 1,
      profiles: {
        'expired-profile': {
          name: 'olduser',
          email: 'old@example.com',
          signingkey: 'AAAA1111BBBB2222CCCC3333EXPIRED4337E823',
          gpg_format: 'openpgp',
          mru: null,
          source: 'manual',
        },
      },
      active_repos: {},
    }));

    const result = runScript(['resolve', 'expired-profile'], { binDir, gitDir, registryDir });
    assert.equal(result.status, 0);
    const out = JSON.parse(result.stdout);
    assert.equal(out.key_warning, 'GPG key is expired');
  });
});

// ── remove ──

describe('remove', () => {
  test('remove-check reports safe for inactive profile', () => {
    const gitDir = createGitRepo();
    const binDir = createStubBin();
    const registryDir = makeTempDir('cfg');
    const regPath = join(registryDir, 'sd0x-dev-flow');
    mkdirSync(regPath, { recursive: true });
    writeFileSync(join(regPath, 'git-profiles.json'), JSON.stringify({
      version: 1,
      profiles: {
        'unused': {
          name: 'Unused',
          email: 'unused@test.com',
          signingkey: '',
          gpg_format: 'openpgp',
          mru: null,
          source: 'manual',
        },
      },
      active_repos: {},
    }));

    const result = runScript(['remove-check', 'unused'], { binDir, gitDir, registryDir });
    assert.equal(result.status, 0);
    const out = JSON.parse(result.stdout);
    assert.equal(out.safe_to_remove, true);
    assert.equal(out.active_count, 0);
  });

  test('remove-exec refuses active profile without force', () => {
    const gitDir = createGitRepo();
    const binDir = createStubBin();
    const registryDir = makeTempDir('cfg');
    const regPath = join(registryDir, 'sd0x-dev-flow');
    mkdirSync(regPath, { recursive: true });
    writeFileSync(join(regPath, 'git-profiles.json'), JSON.stringify({
      version: 1,
      profiles: {
        'active': {
          name: 'Active',
          email: 'active@test.com',
          signingkey: '',
          gpg_format: 'openpgp',
          mru: null,
          source: 'manual',
        },
      },
      active_repos: { '/some/repo': 'active' },
    }));

    const result = runScript(['remove-exec', 'active'], { binDir, gitDir, registryDir });
    assert.equal(result.status, 2);
    assert.ok(result.stderr.includes('active'));
  });

  test('remove-exec removes with force', () => {
    const gitDir = createGitRepo();
    const binDir = createStubBin();
    const registryDir = makeTempDir('cfg');
    const regPath = join(registryDir, 'sd0x-dev-flow');
    mkdirSync(regPath, { recursive: true });
    writeFileSync(join(regPath, 'git-profiles.json'), JSON.stringify({
      version: 1,
      profiles: {
        'active': {
          name: 'Active',
          email: 'active@test.com',
          signingkey: '',
          gpg_format: 'openpgp',
          mru: null,
          source: 'manual',
        },
      },
      active_repos: { '/some/repo': 'active' },
    }));

    const result = runScript(['remove-exec', 'active', '--force'], {
      binDir,
      gitDir,
      registryDir,
    });
    assert.equal(result.status, 0);
    const out = JSON.parse(result.stdout);
    assert.equal(out.removed, true);
    assert.equal(out.forced, true);

    // Verify registry updated
    const reg = JSON.parse(readFileSync(join(regPath, 'git-profiles.json'), 'utf8'));
    assert.equal(Object.keys(reg.profiles).length, 0);
    assert.equal(Object.keys(reg.active_repos).length, 0);
  });
});

// ── verify ──

describe('verify', () => {
  test('all pass returns ok', () => {
    const gitDir = createGitRepo({
      userName: 'SD0',
      userEmail: '107539203+sd0xdev@users.noreply.github.com',
      signingKey: 'D7B9FB02CAEB3E7819633AD4A0EEF23730D2BE5B',
      gpgSign: 'true',
    });
    const binDir = createStubBin({ gpgOutput: GPG_ACTIVE_KEY });

    const result = runScript(['verify'], { binDir, gitDir });
    assert.equal(result.status, 0);
    const out = JSON.parse(result.stdout);
    assert.equal(out.status, 'ok');
    assert.ok(out.checks_run.includes('identity'));
    assert.ok(out.checks_run.includes('key_expiry'));
    assert.ok(!out.checks_run.includes('config_scope'), 'config_scope should not be in checks_run (unimplemented)');
  });

  test('detects email mismatch', () => {
    const gitDir = createGitRepo({
      userName: 'Test',
      userEmail: 'different@example.com',
      signingKey: 'D7B9FB02CAEB3E7819633AD4A0EEF23730D2BE5B',
      gpgSign: 'true',
    });
    const binDir = createStubBin({ gpgOutput: GPG_ACTIVE_KEY });

    const result = runScript(['verify'], { binDir, gitDir });
    assert.equal(result.status, 0);
    const out = JSON.parse(result.stdout);
    const codes = out.issues.map(i => i.code);
    assert.ok(codes.includes('EMAIL_MISMATCH'));
  });

  test('detects registry mismatch', () => {
    const gitDir = createGitRepo({
      userName: 'Test',
      userEmail: 'current@test.com',
    });
    const binDir = createStubBin();
    const registryDir = makeTempDir('cfg');
    const regPath = join(registryDir, 'sd0x-dev-flow');
    mkdirSync(regPath, { recursive: true });

    const repoPath = spawnSync('git', ['rev-parse', '--show-toplevel'], {
      cwd: gitDir,
      encoding: 'utf8',
    }).stdout.trim();

    writeFileSync(join(regPath, 'git-profiles.json'), JSON.stringify({
      version: 1,
      profiles: {
        'stale': {
          name: 'Stale',
          email: 'stale@test.com',
          signingkey: '',
          gpg_format: 'openpgp',
          mru: null,
          source: 'manual',
        },
      },
      active_repos: { [repoPath]: 'stale' },
    }));

    const result = runScript(['verify'], { binDir, gitDir, registryDir });
    assert.equal(result.status, 0);
    const out = JSON.parse(result.stdout);
    const codes = out.issues.map(i => i.code);
    assert.ok(codes.includes('REGISTRY_MISMATCH'));
  });
});

// ── registry ──

describe('registry', () => {
  test('auto-creates registry on discover', () => {
    const gitDir = createGitRepo({
      userName: 'Test',
      userEmail: 'test@test.com',
    });
    const binDir = createStubBin({ gpgOutput: GPG_ACTIVE_KEY });
    const registryDir = makeTempDir('newcfg');

    const result = runScript(['discover'], { binDir, gitDir, registryDir });
    assert.equal(result.status, 0);
    const out = JSON.parse(result.stdout);
    assert.ok(out.count > 0);

    // Registry file should exist now
    const regFile = join(registryDir, 'sd0x-dev-flow', 'git-profiles.json');
    assert.ok(existsSync(regFile));
  });

  test('handles corrupt registry JSON', () => {
    const gitDir = createGitRepo({ userName: 'Test', userEmail: 'test@test.com' });
    const binDir = createStubBin();
    const registryDir = makeTempDir('cfg');
    const regPath = join(registryDir, 'sd0x-dev-flow');
    mkdirSync(regPath, { recursive: true });
    writeFileSync(join(regPath, 'git-profiles.json'), '{corrupt json!!!');

    // list should fail or gracefully handle
    const result = runScript(['list'], { binDir, gitDir, registryDir });
    // jq will fail on corrupt JSON
    assert.notEqual(result.status, 0);
  });

  test('unknown subcommand returns error', () => {
    const gitDir = createGitRepo();
    const binDir = createStubBin();

    const result = runScript(['nonexistent-cmd'], { binDir, gitDir });
    assert.equal(result.status, 1);
    assert.ok(result.stderr.includes('Unknown subcommand'));
  });
});
