const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const {
  mkdtempSync,
  writeFileSync,
  readFileSync,
  mkdirSync,
  chmodSync,
  rmSync,
  symlinkSync,
} = require('node:fs');
const { join, resolve } = require('node:path');
const { tmpdir } = require('node:os');
const { spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');

const SCRIPT = resolve(
  __dirname,
  '../../skills/pr-comment/scripts/pr-comment.js'
);

const tempDirs = [];

function makeTempDir(prefix) {
  const dir = mkdtempSync(join(tmpdir(), `sd0x-prc-${prefix}-`));
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

// ---------------------------------------------------------------------------
// Sample data
// ---------------------------------------------------------------------------
const SAMPLE_PR_META = {
  number: 42,
  title: 'Test PR',
  url: 'https://github.com/owner/repo/pull/42',
  headRefName: 'feat/test',
  baseRefName: 'main',
  state: 'OPEN',
};

const SAMPLE_CHANGED_FILES = [
  {
    filename: 'src/foo.go',
    status: 'modified',
    patch: '@@ -10,5 +10,8 @@ func main() {\n line1\n line2\n+added\n line3',
  },
  {
    filename: 'src/bar.go',
    status: 'modified',
    patch: '@@ -1,3 +1,5 @@ package bar\n line1\n+added\n line2',
  },
  {
    filename: 'assets/logo.png',
    status: 'added',
  },
];

const HEAD_SHA = 'abc123def456789012345678901234567890abcd';

const SAMPLE_PR_DETAIL = {
  head: { sha: HEAD_SHA },
};

const SUBMIT_SUCCESS_RESPONSE = {
  id: 9999,
  html_url: 'https://github.com/owner/repo/pull/42#pullrequestreview-9999',
};

// ---------------------------------------------------------------------------
// Stub setup
// ---------------------------------------------------------------------------
function setupStubBin(options = {}) {
  const {
    prMeta = SAMPLE_PR_META,
    prMetaExitCode = 0,
    changedFiles = SAMPLE_CHANGED_FILES,
    changedFilesExitCode = 0,
    headSha = HEAD_SHA,
    shaExitCode = 0,
    submitExitCode = 0,
    submitStderr = '',
    submitResponse = SUBMIT_SUCCESS_RESPONSE,
    jqExitCode = 0,
    repoViewExitCode = 0,
    driftSha = null,
  } = options;

  const binDir = makeTempDir('bin');
  const dataDir = makeTempDir('data');

  writeFileSync(join(dataDir, 'meta.json'), JSON.stringify(prMeta));
  writeFileSync(join(dataDir, 'files.json'), JSON.stringify(changedFiles));
  writeFileSync(join(dataDir, 'pr-detail.json'), JSON.stringify({ head: { sha: headSha } }));
  writeFileSync(join(dataDir, 'submit-response.json'), JSON.stringify(submitResponse));

  // For drift tests: different SHA on second call
  const driftShaVal = driftSha || headSha;
  writeFileSync(join(dataDir, 'drift-sha.txt'), driftShaVal);

  const stubGh = `#!/bin/sh
case "$1" in
  pr)
    case "$2" in
      view)
        if [ "${prMetaExitCode}" != "0" ]; then exit ${prMetaExitCode}; fi
        cat "${join(dataDir, 'meta.json')}"
        exit 0
        ;;
    esac
    ;;
  repo)
    if [ "${repoViewExitCode}" != "0" ]; then exit ${repoViewExitCode}; fi
    echo "owner/repo"
    exit 0
    ;;
  api)
    shift  # consume 'api'
    case "$1" in
      --method)
        # submit POST
        # Find --input file
        INPUT_FILE=""
        shift  # --method
        shift  # POST
        shift  # endpoint
        while [ $# -gt 0 ]; do
          case "$1" in
            --input) INPUT_FILE="$2"; shift 2 ;;
            *) shift ;;
          esac
        done
        if [ "${submitExitCode}" != "0" ]; then
          echo "${submitStderr}" >&2
          exit ${submitExitCode}
        fi
        cat "${join(dataDir, 'submit-response.json')}"
        exit 0
        ;;
      --jq)
        # SHA fetch: return the drift sha (for submit drift test)
        cat "${join(dataDir, 'drift-sha.txt')}"
        exit ${shaExitCode}
        ;;
      repos/*/pulls/*/files)
        if [ "${changedFilesExitCode}" != "0" ]; then exit ${changedFilesExitCode}; fi
        cat "${join(dataDir, 'files.json')}"
        exit 0
        ;;
      repos/*/pulls/*)
        # PR detail / SHA fetch
        if [ "${shaExitCode}" != "0" ]; then exit ${shaExitCode}; fi
        cat "${join(dataDir, 'drift-sha.txt')}"
        exit 0
        ;;
    esac
    echo "Unknown gh api call: $*" >&2
    exit 1
    ;;
esac
echo "Unknown gh command: $*" >&2
exit 1
`;
  writeExecutable(join(binDir, 'gh'), stubGh);

  // Real jq or stub
  if (jqExitCode !== 0) {
    const stubJq = `#!/bin/sh
echo "jq error" >&2
exit ${jqExitCode}
`;
    writeExecutable(join(binDir, 'jq'), stubJq);
  } else {
    linkSystemCommand(binDir, 'jq');
  }

  for (const cmd of ['bash', 'node', 'cat', 'grep', 'printf', 'echo']) {
    linkSystemCommand(binDir, cmd);
  }

  return binDir;
}

function runScript(args, binDir, envOverrides = {}) {
  const nodeResult = spawnSync('which', ['node'], { encoding: 'utf8' });
  const nodeBin = nodeResult.stdout.trim();

  const env = {
    PATH: `${binDir}:/usr/bin:/bin`,
    HOME: makeTempDir('home'),
    TMPDIR: tmpdir(),
    ...envOverrides,
  };
  const result = spawnSync(nodeBin, [SCRIPT, ...args], {
    encoding: 'utf8',
    env,
    timeout: 30000,
  });
  return result;
}

function writeCommentsFile(comments) {
  const dir = makeTempDir('input');
  const filePath = join(dir, 'comments.json');
  writeFileSync(filePath, JSON.stringify({ comments }));
  return filePath;
}

function sha256(str) {
  return createHash('sha256').update(str).digest('hex');
}

// Default target for stub (matches --pr 42 --repo owner/repo)
const STUB_TARGET = { owner: 'owner', repo: 'repo', number: 42 };

function writePayloadFile(data, { skipHash = false, skipSession = false } = {}) {
  const dir = makeTempDir('payload');
  const filePath = join(dir, 'payload.json');
  // Create session file with nonce (simulates what prepare does)
  // Uses the real $TMPDIR/prc-session-<id>.key path so submit can find it
  if (!skipSession && data.payload && !data.sessionId) {
    const nonce = createHash('sha256').update(String(Date.now()) + String(Math.random())).digest('hex').slice(0, 32);
    const sessionId = createHash('sha256').update(String(Math.random())).digest('hex').slice(0, 32);
    const sessionFile = join(tmpdir(), `prc-session-${sessionId}.key`);
    writeFileSync(sessionFile, nonce, { mode: 0o600 });
    tempDirs.push(sessionFile); // track for cleanup
    data.sessionId = sessionId;
    if (!skipHash && !data.payloadHash) {
      const target = data.target || STUB_TARGET;
      data.payloadHash = sha256(nonce + JSON.stringify(data.payload) + JSON.stringify(target));
    }
  } else if (!skipHash && data.payload && !data.payloadHash) {
    const target = data.target || STUB_TARGET;
    data.payloadHash = sha256(JSON.stringify(data.payload) + JSON.stringify(target));
  }
  writeFileSync(filePath, JSON.stringify(data));
  return filePath;
}

after(() => {
  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ============================================================
// prepare subcommand tests
// ============================================================

test('prepare: valid comments', () => {
  const binDir = setupStubBin();
  const inputPath = writeCommentsFile([
    { path: 'src/foo.go', line: 12, body: 'Consider extracting this logic.' },
    { path: 'src/bar.go', line: 3, body: 'Is this intentional?' },
  ]);
  const result = runScript([
    'prepare', '--pr', '42', '--repo', 'owner/repo', '--input', inputPath,
  ], binDir);
  assert.equal(result.status, 0, `stderr: ${result.stderr}`);
  const data = JSON.parse(result.stdout);
  assert.equal(data.payload.comments.length, 2);
  assert.equal(data.payload.event, 'COMMENT');
  assert.equal(data.payload.commit_id, HEAD_SHA);
  assert.equal(data.validation.valid, 2);
  assert.equal(data.validation.invalid, 0);
  assert.equal(data.pr.number, 42);
  assert.equal(data.pr.title, 'Test PR');
});

test('prepare: invalid path excluded', () => {
  const binDir = setupStubBin();
  const inputPath = writeCommentsFile([
    { path: 'src/nonexistent.go', line: 10, body: 'This file does not exist.' },
    { path: 'src/foo.go', line: 12, body: 'Valid comment.' },
  ]);
  const result = runScript([
    'prepare', '--pr', '42', '--repo', 'owner/repo', '--input', inputPath,
  ], binDir);
  assert.equal(result.status, 0, `stderr: ${result.stderr}`);
  const data = JSON.parse(result.stdout);
  assert.equal(data.validation.valid, 1);
  assert.equal(data.validation.invalid, 1);
  assert.equal(data.payload.comments.length, 1);
  assert.equal(data.invalidComments[0].path, 'src/nonexistent.go');
});

test('prepare: invalid line excluded', () => {
  const binDir = setupStubBin();
  const inputPath = writeCommentsFile([
    { path: 'src/foo.go', line: -1, body: 'Negative line.' },
    { path: 'src/foo.go', line: 0, body: 'Zero line.' },
    { path: 'src/foo.go', line: 12, body: 'Valid.' },
  ]);
  const result = runScript([
    'prepare', '--pr', '42', '--repo', 'owner/repo', '--input', inputPath,
  ], binDir);
  assert.equal(result.status, 0, `stderr: ${result.stderr}`);
  const data = JSON.parse(result.stdout);
  assert.equal(data.validation.valid, 1);
  assert.equal(data.validation.invalid, 2);
});

test('prepare: empty body excluded', () => {
  const binDir = setupStubBin();
  const inputPath = writeCommentsFile([
    { path: 'src/foo.go', line: 12, body: '' },
    { path: 'src/foo.go', line: 12, body: '   ' },
    { path: 'src/foo.go', line: 12, body: 'Valid.' },
  ]);
  const result = runScript([
    'prepare', '--pr', '42', '--repo', 'owner/repo', '--input', inputPath,
  ], binDir);
  assert.equal(result.status, 0, `stderr: ${result.stderr}`);
  const data = JSON.parse(result.stdout);
  assert.equal(data.validation.valid, 1);
  assert.equal(data.validation.invalid, 2);
});

test('prepare: empty comments array exits 2', () => {
  const binDir = setupStubBin();
  const inputPath = writeCommentsFile([]);
  const result = runScript([
    'prepare', '--pr', '42', '--repo', 'owner/repo', '--input', inputPath,
  ], binDir);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /no comments/i);
});

test('prepare: side=LEFT preserved', () => {
  const binDir = setupStubBin();
  const inputPath = writeCommentsFile([
    { path: 'src/foo.go', line: 12, side: 'LEFT', body: 'Deleted line comment.' },
  ]);
  const result = runScript([
    'prepare', '--pr', '42', '--repo', 'owner/repo', '--input', inputPath,
  ], binDir);
  assert.equal(result.status, 0, `stderr: ${result.stderr}`);
  const data = JSON.parse(result.stdout);
  assert.equal(data.payload.comments[0].side, 'LEFT');
});

test('prepare: side defaults to RIGHT', () => {
  const binDir = setupStubBin();
  const inputPath = writeCommentsFile([
    { path: 'src/foo.go', line: 12, body: 'No side specified.' },
  ]);
  const result = runScript([
    'prepare', '--pr', '42', '--repo', 'owner/repo', '--input', inputPath,
  ], binDir);
  assert.equal(result.status, 0, `stderr: ${result.stderr}`);
  const data = JSON.parse(result.stdout);
  assert.equal(data.payload.comments[0].side, 'RIGHT');
});

test('prepare: mixed valid/invalid only includes valid in payload', () => {
  const binDir = setupStubBin();
  const inputPath = writeCommentsFile([
    { path: 'src/foo.go', line: 12, body: 'Valid 1.' },
    { path: 'src/nonexistent.go', line: 10, body: 'Invalid path.' },
    { path: 'src/bar.go', line: -5, body: 'Invalid line.' },
    { path: 'src/bar.go', line: 3, body: 'Valid 2.' },
  ]);
  const result = runScript([
    'prepare', '--pr', '42', '--repo', 'owner/repo', '--input', inputPath,
  ], binDir);
  assert.equal(result.status, 0, `stderr: ${result.stderr}`);
  const data = JSON.parse(result.stdout);
  assert.equal(data.validation.valid, 2);
  assert.equal(data.validation.invalid, 2);
  assert.equal(data.payload.comments.length, 2);
  assert.equal(data.payload.comments[0].body, 'Valid 1.');
  assert.equal(data.payload.comments[1].body, 'Valid 2.');
});

test('prepare: all invalid exits 2', () => {
  const binDir = setupStubBin();
  const inputPath = writeCommentsFile([
    { path: 'nonexistent.go', line: 1, body: 'Bad path.' },
  ]);
  const result = runScript([
    'prepare', '--pr', '42', '--repo', 'owner/repo', '--input', inputPath,
  ], binDir);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /no valid comments/i);
});

test('prepare: non-object comment entries classified as invalid', () => {
  const binDir = setupStubBin();
  const dir = makeTempDir('input');
  const inputPath = join(dir, 'comments.json');
  writeFileSync(inputPath, JSON.stringify({
    comments: [
      null,
      42,
      'string-entry',
      [1, 2],
      { path: 'src/foo.go', line: 12, body: 'Valid.' },
    ],
  }));
  const result = runScript([
    'prepare', '--pr', '42', '--repo', 'owner/repo', '--input', inputPath,
  ], binDir);
  assert.equal(result.status, 0, `stderr: ${result.stderr}`);
  const data = JSON.parse(result.stdout);
  assert.equal(data.validation.valid, 1);
  assert.equal(data.validation.invalid, 4);
});

test('prepare: PR not found exits 2', () => {
  const binDir = setupStubBin({ prMetaExitCode: 1 });
  const inputPath = writeCommentsFile([
    { path: 'src/foo.go', line: 12, body: 'Test.' },
  ]);
  const result = runScript([
    'prepare', '--pr', '999', '--repo', 'owner/repo', '--input', inputPath,
  ], binDir);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /not found/i);
});

test('prepare: missing input file exits 2', () => {
  const binDir = setupStubBin();
  const result = runScript([
    'prepare', '--pr', '42', '--repo', 'owner/repo', '--input', '/nonexistent/file.json',
  ], binDir);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /not found/i);
});

test('prepare: corrupt input JSON exits 2', () => {
  const dir = makeTempDir('input');
  const inputPath = join(dir, 'bad.json');
  writeFileSync(inputPath, 'not-json!!!');

  const binDir = setupStubBin();
  const result = runScript([
    'prepare', '--pr', '42', '--repo', 'owner/repo', '--input', inputPath,
  ], binDir);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /parse.*json/i);
});

test('prepare: --pr without --repo infers repo', () => {
  const binDir = setupStubBin();
  const inputPath = writeCommentsFile([
    { path: 'src/foo.go', line: 12, body: 'Test.' },
  ]);
  const result = runScript([
    'prepare', '--pr', '42', '--input', inputPath,
  ], binDir);
  assert.equal(result.status, 0, `stderr: ${result.stderr}`);
  const data = JSON.parse(result.stdout);
  assert.equal(data.pr.number, 42);
});

test('prepare: binary file path gets warning', () => {
  const binDir = setupStubBin();
  const inputPath = writeCommentsFile([
    { path: 'assets/logo.png', line: 1, body: 'Binary file comment.' },
  ]);
  const result = runScript([
    'prepare', '--pr', '42', '--repo', 'owner/repo', '--input', inputPath,
  ], binDir);
  assert.equal(result.status, 0, `stderr: ${result.stderr}`);
  const data = JSON.parse(result.stdout);
  assert.equal(data.validation.warnings, 1);
  assert.match(data.warningComments[0].warning, /binary|patch unavailable/i);
});

// ============================================================
// submit subcommand tests
// ============================================================

test('submit: success', () => {
  const binDir = setupStubBin();
  const payloadPath = writePayloadFile({
    payload: {
      commit_id: HEAD_SHA,
      event: 'COMMENT',
      body: '',
      comments: [
        { path: 'src/foo.go', line: 12, side: 'RIGHT', body: 'Test comment.' },
      ],
    },
  });
  const result = runScript([
    'submit', '--pr', '42', '--repo', 'owner/repo', '--input', payloadPath,
  ], binDir);
  assert.equal(result.status, 0, `stderr: ${result.stderr}`);
  const data = JSON.parse(result.stdout);
  assert.equal(data.success, true);
  assert.equal(data.commentsPosted, 1);
  assert.ok(data.reviewUrl);
});

test('submit: SHA drift exits 3', () => {
  const binDir = setupStubBin({ driftSha: 'different_sha_12345678901234567890' });
  const payloadPath = writePayloadFile({
    payload: {
      commit_id: HEAD_SHA,
      event: 'COMMENT',
      body: '',
      comments: [
        { path: 'src/foo.go', line: 12, side: 'RIGHT', body: 'Test.' },
      ],
    },
  });
  const result = runScript([
    'submit', '--pr', '42', '--repo', 'owner/repo', '--input', payloadPath,
  ], binDir);
  assert.equal(result.status, 3);
  assert.match(result.stderr, /sha drift/i);
});

test('submit: 422 error exits 2', () => {
  const binDir = setupStubBin({
    submitExitCode: 1,
    submitStderr: '422 Unprocessable Entity: pull_request_review_thread.line must be part of the diff',
  });
  const payloadPath = writePayloadFile({
    payload: {
      commit_id: HEAD_SHA,
      event: 'COMMENT',
      body: '',
      comments: [
        { path: 'src/foo.go', line: 999, side: 'RIGHT', body: 'Bad line.' },
      ],
    },
  });
  const result = runScript([
    'submit', '--pr', '42', '--repo', 'owner/repo', '--input', payloadPath,
  ], binDir);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /422/i);
});

test('submit: network error exits 2', () => {
  const binDir = setupStubBin({
    submitExitCode: 1,
    submitStderr: 'network timeout',
  });
  const payloadPath = writePayloadFile({
    payload: {
      commit_id: HEAD_SHA,
      event: 'COMMENT',
      body: '',
      comments: [
        { path: 'src/foo.go', line: 12, side: 'RIGHT', body: 'Test.' },
      ],
    },
  });
  const result = runScript([
    'submit', '--pr', '42', '--repo', 'owner/repo', '--input', payloadPath,
  ], binDir);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /failed to submit/i);
});

test('submit: jq failure exits 2', () => {
  const binDir = setupStubBin({ jqExitCode: 1 });
  const payloadPath = writePayloadFile({
    payload: {
      commit_id: HEAD_SHA,
      event: 'COMMENT',
      body: '',
      comments: [
        { path: 'src/foo.go', line: 12, side: 'RIGHT', body: 'Test.' },
      ],
    },
  });
  const result = runScript([
    'submit', '--pr', '42', '--repo', 'owner/repo', '--input', payloadPath,
  ], binDir);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /jq failed/i);
});

test('submit: missing input file exits 2', () => {
  const binDir = setupStubBin();
  const result = runScript([
    'submit', '--pr', '42', '--repo', 'owner/repo', '--input', '/nonexistent.json',
  ], binDir);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /not found/i);
});

test('submit: missing payloadHash exits 2', () => {
  const binDir = setupStubBin();
  const payloadPath = writePayloadFile({
    payload: {
      commit_id: HEAD_SHA,
      event: 'COMMENT',
      body: '',
      comments: [{ path: 'a', line: 1, side: 'RIGHT', body: 'x' }],
    },
  }, { skipHash: true, skipSession: true });
  const result = runScript([
    'submit', '--pr', '42', '--repo', 'owner/repo', '--input', payloadPath,
  ], binDir);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /payloadHash/i);
});

test('submit: missing sessionId exits 2', () => {
  const binDir = setupStubBin();
  const payload = {
    commit_id: HEAD_SHA,
    event: 'COMMENT',
    body: '',
    comments: [{ path: 'a', line: 1, side: 'RIGHT', body: 'x' }],
  };
  const payloadPath = writePayloadFile({
    payload,
    payloadHash: sha256(JSON.stringify(payload) + JSON.stringify(STUB_TARGET)),
  }, { skipHash: true, skipSession: true });
  const result = runScript([
    'submit', '--pr', '42', '--repo', 'owner/repo', '--input', payloadPath,
  ], binDir);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /sessionId/i);
});

test('submit: expired session (nonexistent sessionId) exits 2', () => {
  const binDir = setupStubBin();
  const payload = {
    commit_id: HEAD_SHA,
    event: 'COMMENT',
    body: '',
    comments: [{ path: 'a', line: 1, side: 'RIGHT', body: 'x' }],
  };
  const payloadPath = writePayloadFile({
    payload,
    sessionId: 'deadbeefdeadbeefdeadbeefdeadbeef',
    payloadHash: sha256('fake' + JSON.stringify(payload) + JSON.stringify(STUB_TARGET)),
  }, { skipHash: true, skipSession: true });
  const result = runScript([
    'submit', '--pr', '42', '--repo', 'owner/repo', '--input', payloadPath,
  ], binDir);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /session.*not found|expired/i);
});

test('submit: tampered payload (hash mismatch) exits 2', () => {
  const binDir = setupStubBin();
  // Create a session file with a known nonce via opaque sessionId
  const sessionId = 'aabbccdd11223344aabbccdd11223344';
  const sessionFile = join(tmpdir(), `prc-session-${sessionId}.key`);
  writeFileSync(sessionFile, 'known-nonce', { mode: 0o600 });
  tempDirs.push(sessionFile);
  const payloadPath = writePayloadFile({
    payload: {
      commit_id: HEAD_SHA,
      event: 'COMMENT',
      body: '',
      comments: [{ path: 'a', line: 1, side: 'RIGHT', body: 'x' }],
    },
    sessionId,
    payloadHash: 'deadbeef_wrong_hash',
  }, { skipHash: true, skipSession: true });
  const result = runScript([
    'submit', '--pr', '42', '--repo', 'owner/repo', '--input', payloadPath,
  ], binDir);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /hash mismatch|tampered/i);
});

test('submit: invalid payload (no commit_id) exits 2', () => {
  const binDir = setupStubBin();
  const payload = { comments: [{ path: 'a', line: 1, body: 'x' }] };
  const nonce = 'test-nonce-no-commit-id-check00';
  const sessionId = 'ee11ff22ee33ff44ee55ff66ee77ff88';
  const sessionFile = join(tmpdir(), `prc-session-${sessionId}.key`);
  writeFileSync(sessionFile, nonce, { mode: 0o600 });
  tempDirs.push(sessionFile);
  const payloadPath = writePayloadFile({
    payload,
    sessionId,
    payloadHash: sha256(nonce + JSON.stringify(payload) + JSON.stringify(STUB_TARGET)),
  }, { skipHash: true, skipSession: true });
  const result = runScript([
    'submit', '--pr', '42', '--repo', 'owner/repo', '--input', payloadPath,
  ], binDir);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /invalid payload/i);
});

test('submit: invalid payload (no comments) exits 2', () => {
  const binDir = setupStubBin();
  const payload = { commit_id: HEAD_SHA, comments: [] };
  const nonce = 'test-nonce-no-comments-check000';
  const sessionId = 'aa99bb88cc77dd66ee55ff44aa33bb22';
  const sessionFile = join(tmpdir(), `prc-session-${sessionId}.key`);
  writeFileSync(sessionFile, nonce, { mode: 0o600 });
  tempDirs.push(sessionFile);
  const payloadPath = writePayloadFile({
    payload,
    sessionId,
    payloadHash: sha256(nonce + JSON.stringify(payload) + JSON.stringify(STUB_TARGET)),
  }, { skipHash: true, skipSession: true });
  const result = runScript([
    'submit', '--pr', '42', '--repo', 'owner/repo', '--input', payloadPath,
  ], binDir);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /invalid payload/i);
});

// ============================================================
// edge case tests
// ============================================================

test('edge: no subcommand exits 2', () => {
  const binDir = setupStubBin();
  const result = runScript([], binDir);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /unknown subcommand/i);
});

test('edge: invalid subcommand exits 2', () => {
  const binDir = setupStubBin();
  const result = runScript(['invalidcmd'], binDir);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /unknown subcommand/i);
});

test('edge: invalid --repo format exits 2', () => {
  const binDir = setupStubBin();
  const inputPath = writeCommentsFile([
    { path: 'src/foo.go', line: 12, body: 'Test.' },
  ]);
  const result = runScript([
    'prepare', '--pr', '42', '--repo', 'invalid-no-slash', '--input', inputPath,
  ], binDir);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /invalid.*--repo/i);
});

test('edge: non-numeric --pr exits 2', () => {
  const binDir = setupStubBin();
  const inputPath = writeCommentsFile([
    { path: 'src/foo.go', line: 12, body: 'Test.' },
  ]);
  const result = runScript([
    'prepare', '--pr', 'abc', '--repo', 'owner/repo', '--input', inputPath,
  ], binDir);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /positive integer/i);
});

test('edge: negative --pr exits 2', () => {
  const binDir = setupStubBin();
  const inputPath = writeCommentsFile([
    { path: 'src/foo.go', line: 12, body: 'Test.' },
  ]);
  const result = runScript([
    'prepare', '--pr', '-5', '--repo', 'owner/repo', '--input', inputPath,
  ], binDir);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /positive integer/i);
});

test('edge: --pr 42abc (trailing chars) exits 2', () => {
  const binDir = setupStubBin();
  const inputPath = writeCommentsFile([
    { path: 'src/foo.go', line: 12, body: 'Test.' },
  ]);
  const result = runScript([
    'prepare', '--pr', '42abc', '--repo', 'owner/repo', '--input', inputPath,
  ], binDir);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /positive integer/i);
});

test('edge: --pr 0 exits 2', () => {
  const binDir = setupStubBin();
  const inputPath = writeCommentsFile([
    { path: 'src/foo.go', line: 12, body: 'Test.' },
  ]);
  const result = runScript([
    'prepare', '--pr', '0', '--repo', 'owner/repo', '--input', inputPath,
  ], binDir);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /positive integer/i);
});

test('prepare: bracket-heavy patch content parsed correctly', () => {
  const changedFiles = [
    {
      filename: 'src/parser.go',
      status: 'modified',
      patch: '@@ -10,5 +10,8 @@ func parse() {\n line1\n+arr := []string{"[test]", "[foo]"}\n+m := map[string]int{}\n line3',
    },
  ];
  const binDir = setupStubBin({ changedFiles });
  const inputPath = writeCommentsFile([
    { path: 'src/parser.go', line: 12, body: 'Brackets in patch should not break parsing.' },
  ]);
  const result = runScript([
    'prepare', '--pr', '42', '--repo', 'owner/repo', '--input', inputPath,
  ], binDir);
  assert.equal(result.status, 0, `stderr: ${result.stderr}`);
  const data = JSON.parse(result.stdout);
  assert.equal(data.validation.valid, 1);
});

test('prepare: output includes sessionId and verifiable payloadHash', () => {
  const binDir = setupStubBin();
  const inputPath = writeCommentsFile([
    { path: 'src/foo.go', line: 12, body: 'Check session id presence.' },
  ]);
  const result = runScript([
    'prepare', '--pr', '42', '--repo', 'owner/repo', '--input', inputPath,
  ], binDir);
  assert.equal(result.status, 0, `stderr: ${result.stderr}`);
  const data = JSON.parse(result.stdout);
  assert.ok(data.sessionId, 'sessionId should be present');
  assert.match(data.sessionId, /^[0-9a-f]+$/, 'sessionId should be hex');
  assert.ok(data.payloadHash, 'payloadHash should be present');
  // Reconstruct session file path and read nonce to verify hash
  const sessionFile = join(tmpdir(), `prc-session-${data.sessionId}.key`);
  tempDirs.push(sessionFile); // track for cleanup
  const nonce = readFileSync(sessionFile, 'utf8');
  assert.equal(nonce.length, 32);
  const expectedHash = sha256(nonce + JSON.stringify(data.payload) + JSON.stringify(data.target));
  assert.equal(data.payloadHash, expectedHash);
  // nonce should NOT be in the output JSON
  assert.equal(data.nonce, undefined, 'nonce should not be in output');
  // sessionFile path should NOT be in output (opaque sessionId only)
  assert.equal(data.sessionFile, undefined, 'sessionFile should not be in output');
});

test('submit: session file consumed after successful submit', () => {
  const { existsSync } = require('node:fs');
  const binDir = setupStubBin();
  const payloadPath = writePayloadFile({
    payload: {
      commit_id: HEAD_SHA,
      event: 'COMMENT',
      body: '',
      comments: [
        { path: 'src/foo.go', line: 12, side: 'RIGHT', body: 'Test.' },
      ],
    },
  });
  const data = JSON.parse(readFileSync(payloadPath, 'utf8'));
  const sessionFile = join(tmpdir(), `prc-session-${data.sessionId}.key`);
  assert.ok(existsSync(sessionFile), 'session file should exist before submit');
  const result = runScript([
    'submit', '--pr', '42', '--repo', 'owner/repo', '--input', payloadPath,
  ], binDir);
  assert.equal(result.status, 0, `stderr: ${result.stderr}`);
  assert.ok(!existsSync(sessionFile), 'session file should be consumed after submit');
});

test('prepare: paginated changed files (concatenated arrays)', () => {
  const binDir = makeTempDir('bin');
  const dataDir = makeTempDir('data');

  writeFileSync(join(dataDir, 'meta.json'), JSON.stringify(SAMPLE_PR_META));
  writeFileSync(join(dataDir, 'drift-sha.txt'), HEAD_SHA);

  // Simulate gh api --paginate output: two concatenated JSON arrays
  const page1 = [{ filename: 'src/foo.go', status: 'modified', patch: '@@ -10,5 +10,8 @@ func main() {\n line1\n+added' }];
  const page2 = [{ filename: 'src/bar.go', status: 'modified', patch: '@@ -1,3 +1,5 @@ package bar\n line1\n+added' }];
  const paginatedOutput = JSON.stringify(page1) + '\n' + JSON.stringify(page2);
  writeFileSync(join(dataDir, 'files-paginated.json'), paginatedOutput);

  const stubGh = `#!/bin/sh
case "$1" in
  pr)
    cat "${join(dataDir, 'meta.json')}"
    exit 0
    ;;
  repo)
    echo "owner/repo"
    exit 0
    ;;
  api)
    shift
    case "$1" in
      --jq)
        cat "${join(dataDir, 'drift-sha.txt')}"
        exit 0
        ;;
      repos/*/pulls/*/files)
        cat "${join(dataDir, 'files-paginated.json')}"
        exit 0
        ;;
      repos/*/pulls/*)
        cat "${join(dataDir, 'drift-sha.txt')}"
        exit 0
        ;;
    esac
    ;;
esac
exit 1
`;
  writeExecutable(join(binDir, 'gh'), stubGh);
  linkSystemCommand(binDir, 'jq');
  for (const cmd of ['bash', 'node', 'cat', 'grep', 'printf', 'echo']) {
    linkSystemCommand(binDir, cmd);
  }

  const inputPath = writeCommentsFile([
    { path: 'src/foo.go', line: 12, body: 'Comment on foo.' },
    { path: 'src/bar.go', line: 3, body: 'Comment on bar.' },
  ]);
  const result = runScript([
    'prepare', '--pr', '42', '--repo', 'owner/repo', '--input', inputPath,
  ], binDir);
  assert.equal(result.status, 0, `stderr: ${result.stderr}`);
  const data = JSON.parse(result.stdout);
  assert.equal(data.validation.valid, 2);
  assert.equal(data.payload.comments.length, 2);
});
