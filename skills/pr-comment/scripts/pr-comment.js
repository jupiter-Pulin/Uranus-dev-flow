#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

// Resolve plugin root: validated env var → walk-up with marker → legacy fallback
const _pluginRoot = (() => {
  const sentinel = p => fs.existsSync(path.join(p, 'scripts', 'lib', 'utils.js'));
  const marker = p => fs.existsSync(path.join(p, '.claude-plugin', 'plugin.json'));
  const envRoot = process.env.PLUGIN_ROOT;
  if (envRoot && sentinel(envRoot) && marker(envRoot)) return envRoot;
  let d = __dirname;
  while (d !== path.dirname(d)) {
    if (sentinel(d) && marker(d)) return d;
    d = path.dirname(d);
  }
  return path.resolve(__dirname, '..', '..', '..');
})();

const { runCapture } = require(path.join(_pluginRoot, 'scripts', 'lib', 'utils'));

function sha256(s) {
  return crypto.createHash('sha256').update(String(s)).digest('hex');
}

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------
function argVal(flag) {
  const i = process.argv.indexOf(flag);
  return i > -1 && i + 1 < process.argv.length ? process.argv[i + 1] : null;
}

const SUBCOMMAND = process.argv[2] || '';

// ---------------------------------------------------------------------------
// Pagination helper
// ---------------------------------------------------------------------------
/**
 * Parse potentially concatenated JSON arrays from `gh api --paginate`.
 * Single page: valid JSON array. Multi-page: one array per line.
 * Uses line-buffering to avoid bracket-counting issues with brackets in strings.
 */
function parsePaginatedArray(raw) {
  const trimmed = raw.trim();
  if (!trimmed) return [];
  // Single page: direct parse
  try {
    const parsed = JSON.parse(trimmed);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    // Multi-page: gh api --paginate emits one compact JSON array per page
    // Use line-buffering: accumulate lines until we get valid JSON
    const results = [];
    let buffer = '';
    for (const line of trimmed.split('\n')) {
      buffer += (buffer ? '\n' : '') + line;
      try {
        const parsed = JSON.parse(buffer);
        if (Array.isArray(parsed)) results.push(...parsed);
        else results.push(parsed);
        buffer = '';
      } catch {
        // Incomplete JSON, keep buffering
      }
    }
    if (results.length === 0) throw new Error('Failed to parse paginated response');
    if (buffer.trim()) throw new Error('Truncated paginated response (trailing unparsed data)');
    return results;
  }
}

// ---------------------------------------------------------------------------
// PR target resolution
// ---------------------------------------------------------------------------
function parseRepoArg(repoStr) {
  const parts = repoStr.split('/');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  return { owner: parts[0], repo: parts[1] };
}

async function resolvePrTarget() {
  const prArg = argVal('--pr');
  const repoArg = argVal('--repo');

  if (prArg) {
    if (!/^[1-9]\d*$/.test(prArg)) {
      console.error('Error: --pr must be a positive integer');
      process.exit(2);
    }
    let rp = null;
    if (repoArg) {
      rp = parseRepoArg(repoArg);
      if (!rp) {
        console.error('Error: Invalid --repo format. Expected owner/repo');
        process.exit(2);
      }
    } else {
      const repoView = await runCapture('gh', [
        'repo', 'view', '--json', 'nameWithOwner', '--jq', '.nameWithOwner',
      ]);
      if (repoView.code === 0) rp = parseRepoArg(repoView.stdout.trim());
      if (!rp) {
        console.error('Error: --pr requires --repo or a git remote');
        process.exit(2);
      }
    }
    return { ...rp, number: parseInt(prArg, 10) };
  }

  // --repo without --pr is ignored (auto-detect always uses current repo)
  if (repoArg) {
    console.error('Warning: --repo is ignored without --pr; using current branch PR');
  }

  // Try current branch PR
  const prView = await runCapture('gh', [
    'pr', 'view', '--json', 'number',
  ]);
  if (prView.code === 0) {
    try {
      const data = JSON.parse(prView.stdout);
      const repoView = await runCapture('gh', [
        'repo', 'view', '--json', 'nameWithOwner', '--jq', '.nameWithOwner',
      ]);
      if (repoView.code === 0) {
        const rp = parseRepoArg(repoView.stdout.trim());
        if (rp) return { ...rp, number: data.number };
      }
    } catch { /* fall through */ }
  }

  console.error('Error: Cannot resolve PR. Use --pr <N> --repo <owner/repo>');
  process.exit(2);
}

// ---------------------------------------------------------------------------
// Subcommand: prepare
// ---------------------------------------------------------------------------
async function cmdPrepare() {
  const inputPath = argVal('--input');
  if (!inputPath || !fs.existsSync(inputPath)) {
    console.error('Error: --input file not found');
    process.exit(2);
  }

  let inputData;
  try { inputData = JSON.parse(fs.readFileSync(inputPath, 'utf8')); } catch {
    console.error('Error: Failed to parse input JSON');
    process.exit(2);
  }

  const comments = inputData.comments;
  if (!Array.isArray(comments) || comments.length === 0) {
    console.error('Error: No comments provided');
    process.exit(2);
  }

  const { owner, repo, number } = await resolvePrTarget();

  // Fetch PR metadata
  const metaR = await runCapture('gh', [
    'pr', 'view', String(number),
    '--repo', `${owner}/${repo}`,
    '--json', 'number,title,url,headRefName,baseRefName,state',
  ]);
  if (metaR.code !== 0) {
    console.error(`Error: PR #${number} not found in ${owner}/${repo}`);
    process.exit(2);
  }

  let meta;
  try { meta = JSON.parse(metaR.stdout); } catch {
    console.error('Error: Failed to parse PR metadata');
    process.exit(2);
  }

  // Fetch changed files
  const filesR = await runCapture('gh', [
    'api', `repos/${owner}/${repo}/pulls/${number}/files`,
    '--paginate',
  ]);
  if (filesR.code !== 0) {
    console.error('Error: Failed to fetch PR changed files');
    process.exit(2);
  }

  let changedFiles;
  try { changedFiles = parsePaginatedArray(filesR.stdout); } catch {
    console.error('Error: Failed to parse changed files');
    process.exit(2);
  }

  const changedPaths = new Set(changedFiles.map(f => f.filename));

  // Build patch line ranges per file for hunk validation
  const patchRanges = new Map();
  for (const f of changedFiles) {
    if (!f.patch) {
      patchRanges.set(f.filename, null);
      continue;
    }
    const lines = new Set();
    const hunkRegex = /^@@\s+-\d+(?:,\d+)?\s+\+(\d+)(?:,(\d+))?\s+@@/gm;
    let match;
    while ((match = hunkRegex.exec(f.patch)) !== null) {
      const start = parseInt(match[1], 10);
      const count = match[2] !== undefined ? parseInt(match[2], 10) : 1;
      for (let i = start; i < start + count; i++) {
        lines.add(i);
      }
    }
    patchRanges.set(f.filename, lines);
  }

  // Validate each comment
  const valid = [];
  const invalid = [];
  const warnings = [];

  for (const c of comments) {
    // Shape guard: skip non-object entries
    if (!c || typeof c !== 'object' || Array.isArray(c)) {
      invalid.push({ raw: c, issues: ['entry is not an object'] });
      continue;
    }

    const issues = [];

    if (!c.path || !changedPaths.has(c.path)) {
      issues.push(`path "${c.path || ''}" not in changed files`);
    }

    if (!Number.isInteger(c.line) || c.line <= 0) {
      issues.push(`line ${c.line} is invalid (must be positive integer)`);
    }

    if (!c.body || typeof c.body !== 'string' || c.body.trim().length === 0) {
      issues.push('body is empty');
    }

    if (issues.length > 0) {
      invalid.push({ ...c, issues });
      continue;
    }

    // Hunk range check (warning only)
    const range = patchRanges.get(c.path);
    if (range === null) {
      warnings.push({ ...c, warning: 'patch unavailable (binary/large file)' });
    } else if (range && !range.has(c.line)) {
      warnings.push({ ...c, warning: `line ${c.line} outside diff hunk range` });
    }

    // Validate side: only LEFT/RIGHT/undefined are valid
    const side = c.side === 'LEFT' ? 'LEFT' : 'RIGHT';
    if (c.side && c.side !== 'LEFT' && c.side !== 'RIGHT') {
      warnings.push({ ...c, warning: `unknown side "${c.side}", defaulting to RIGHT` });
    }

    valid.push({
      path: c.path,
      line: c.line,
      side,
      body: c.body,
    });
  }

  if (valid.length === 0) {
    console.error('Error: No valid comments after validation');
    process.exit(2);
  }

  // Fetch head SHA
  const shaR = await runCapture('gh', [
    'api', `repos/${owner}/${repo}/pulls/${number}`,
    '--jq', '.head.sha',
  ]);
  if (shaR.code !== 0 || !shaR.stdout.trim()) {
    console.error('Error: Failed to fetch PR head SHA');
    process.exit(2);
  }
  const headSha = shaR.stdout.trim();

  // Build payload
  const payload = {
    commit_id: headSha,
    event: 'COMMENT',
    body: '',
    comments: valid,
  };

  const target = { owner, repo, number };
  const nonce = crypto.randomBytes(16).toString('hex');
  const payloadHash = sha256(nonce + JSON.stringify(payload) + JSON.stringify(target));

  // Write nonce to a managed session file (one-time token for submit)
  // Uses opaque sessionId — submit constructs path internally from fixed prefix
  const sessionId = crypto.randomBytes(16).toString('hex');
  const sessionFile = path.join(os.tmpdir(), `prc-session-${sessionId}.key`);
  fs.writeFileSync(sessionFile, nonce, { mode: 0o600 });

  const result = {
    pr: {
      number: meta.number,
      title: meta.title,
      url: meta.url,
      head: meta.headRefName,
      base: meta.baseRefName,
      state: meta.state,
    },
    target,
    payload,
    sessionId,
    payloadHash,
    validation: {
      total: comments.length,
      valid: valid.length,
      invalid: invalid.length,
      warnings: warnings.length,
    },
    invalidComments: invalid,
    warningComments: warnings,
  };

  console.log(JSON.stringify(result, null, 2));
}

// ---------------------------------------------------------------------------
// Subcommand: submit
// ---------------------------------------------------------------------------
async function cmdSubmit() {
  const inputPath = argVal('--input');
  if (!inputPath || !fs.existsSync(inputPath)) {
    console.error('Error: --input file not found');
    process.exit(2);
  }

  let inputData;
  try { inputData = JSON.parse(fs.readFileSync(inputPath, 'utf8')); } catch {
    console.error('Error: Failed to parse input JSON');
    process.exit(2);
  }

  const { owner, repo, number } = await resolvePrTarget();
  const payload = inputData.payload;

  if (!payload || !payload.commit_id || !Array.isArray(payload.comments) || payload.comments.length === 0) {
    console.error('Error: Invalid payload (missing commit_id or comments)');
    process.exit(2);
  }

  // Verify PR target matches the prepare output (prevents wrong-PR posting)
  if (inputData.target) {
    const t = inputData.target;
    if (t.owner !== owner || t.repo !== repo || t.number !== number) {
      console.error(`Error: PR target mismatch — payload was prepared for ${t.owner}/${t.repo}#${t.number}, but submit targets ${owner}/${repo}#${number}`);
      process.exit(2);
    }
  }

  // Verify payload came from prepare (sessionId + payloadHash integrity check)
  if (!inputData.payloadHash) {
    console.error('Error: Missing payloadHash — payload must come from prepare command');
    process.exit(2);
  }
  if (!inputData.sessionId) {
    console.error('Error: Missing sessionId — payload must come from prepare command');
    process.exit(2);
  }
  // Validate sessionId is hex-only to prevent path traversal
  if (!/^[0-9a-f]+$/.test(inputData.sessionId)) {
    console.error('Error: Invalid sessionId format');
    process.exit(2);
  }
  // Construct session file path internally (never accept raw paths from input)
  const sessionFile = path.join(os.tmpdir(), `prc-session-${inputData.sessionId}.key`);
  // Verify it's a regular file (not a symlink)
  let stat;
  try { stat = fs.lstatSync(sessionFile); } catch {
    console.error('Error: Session not found or expired — re-run prepare');
    process.exit(2);
  }
  if (!stat.isFile() || stat.isSymbolicLink()) {
    console.error('Error: Invalid session file');
    process.exit(2);
  }
  let nonce;
  try { nonce = fs.readFileSync(sessionFile, 'utf8'); } catch {
    console.error('Error: Failed to read session file');
    process.exit(2);
  }
  const target = { owner, repo, number };
  const expectedHash = sha256(nonce + JSON.stringify(payload) + JSON.stringify(target));
  if (inputData.payloadHash !== expectedHash) {
    console.error('Error: Payload hash mismatch — payload may have been tampered with');
    process.exit(2);
  }
  // Consume session file (one-time use)
  try { fs.unlinkSync(sessionFile); } catch { /* ignore */ }

  // Re-fetch current head SHA for drift check
  const shaR = await runCapture('gh', [
    'api', `repos/${owner}/${repo}/pulls/${number}`,
    '--jq', '.head.sha',
  ]);
  if (shaR.code !== 0 || !shaR.stdout.trim()) {
    console.error('Error: Failed to fetch current PR head SHA');
    process.exit(2);
  }
  const currentSha = shaR.stdout.trim();

  if (currentSha !== payload.commit_id) {
    console.error(`Error: SHA drift detected. Payload: ${payload.commit_id.slice(0, 8)}, Current: ${currentSha.slice(0, 8)}`);
    process.exit(3);
  }

  // Build JSON body via jq (shell injection prevention)
  const jqR = await runCapture('jq', [
    '-n',
    '--arg', 'commit_id', payload.commit_id,
    '--arg', 'event', 'COMMENT',
    '--argjson', 'comments', JSON.stringify(payload.comments),
    '{commit_id: $commit_id, event: $event, body: "", comments: $comments}',
  ]);
  if (jqR.code !== 0) {
    console.error('Error: jq failed to build review body');
    process.exit(2);
  }

  const tmpFile = path.join(os.tmpdir(), `prc-submit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.json`);
  fs.writeFileSync(tmpFile, jqR.stdout, 'utf8');

  const postR = await runCapture('gh', [
    'api', '--method', 'POST',
    `repos/${owner}/${repo}/pulls/${number}/reviews`,
    '--input', tmpFile,
  ]);

  // Clean up temp file
  try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }

  if (postR.code !== 0) {
    const errBody = postR.stderr || '';
    if (errBody.includes('422') || errBody.includes('Unprocessable')) {
      console.error(`Error: GitHub rejected the review (422). ${errBody}`);
      process.exit(2);
    }
    console.error(`Error: Failed to submit review. ${errBody}`);
    process.exit(2);
  }

  // Parse success response
  let response;
  try { response = JSON.parse(postR.stdout); } catch {
    response = {};
  }

  const result = {
    success: true,
    reviewUrl: response.html_url || `https://github.com/${owner}/${repo}/pull/${number}`,
    reviewId: response.id || null,
    commentsPosted: payload.comments.length,
  };

  console.log(JSON.stringify(result, null, 2));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  switch (SUBCOMMAND) {
    case 'prepare':
      await cmdPrepare();
      break;
    case 'submit':
      await cmdSubmit();
      break;
    default:
      console.error('Error: Unknown subcommand. Use: prepare | submit');
      process.exit(2);
  }
}

main().catch(err => {
  console.error(`Error: ${err.message}`);
  process.exit(2);
});
