const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  chmodSync,
  rmSync,
  readFileSync,
  existsSync,
} = require('node:fs');
const { join, resolve } = require('node:path');
const { tmpdir } = require('node:os');
const { spawnSync } = require('node:child_process');

const hookPath = resolve(__dirname, '../../hooks/post-tool-review-state.sh');
const tempDirs = [];

function makeTempDir(prefix) {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

function writeExecutable(filePath, content) {
  writeFileSync(filePath, content);
  chmodSync(filePath, 0o755);
}

function setupStubBin() {
  const binDir = makeTempDir('sd0x-post-tool-bin-');
  const stubJq = `#!/usr/bin/env node
const fs = require('fs');
const args = process.argv.slice(2);
let query;
let file;
const vars = {};
let hasExitFlag = false;
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '-r') continue;
  if (arg === '-e') { hasExitFlag = true; continue; }
  if (arg === '--arg') {
    vars[args[i + 1]] = args[i + 2];
    i += 2;
    continue;
  }
  if (arg === '--argjson') {
    const key = args[i + 1];
    const val = args[i + 2];
    try {
      vars[key] = JSON.parse(val);
    } catch {
      if (val === 'true') vars[key] = true;
      else if (val === 'false') vars[key] = false;
      else vars[key] = val;
    }
    i += 2;
    continue;
  }
  if (!query) {
    query = arg;
    continue;
  }
  if (!file) {
    file = arg;
    continue;
  }
}
let input = '';
try {
  input = file ? fs.readFileSync(file, 'utf8') : fs.readFileSync(0, 'utf8');
} catch {}
let data = {};
try {
  data = input ? JSON.parse(input) : {};
} catch {}

function asBoolString(val) {
  return val === true || val === 'true' ? 'true' : 'false';
}

// Mirror jq's type builtin for diagnostic queries
function jqType(val) {
  if (val === null) return 'null';
  if (Array.isArray(val)) return 'array';
  if (typeof val === 'object') return 'object';
  if (typeof val === 'string') return 'string';
  if (typeof val === 'number') return 'number';
  if (typeof val === 'boolean') return 'boolean';
  return 'null';
}

function outputValue(val) {
  if (val === undefined || val === null) {
    process.stdout.write('');
    return;
  }
  if (typeof val === 'string') {
    process.stdout.write(val);
    return;
  }
  if (typeof val === 'boolean') {
    process.stdout.write(asBoolString(val));
    return;
  }
  process.stdout.write(JSON.stringify(val));
}

// Handle aggregate_gate PENDING mutation (review_mode + executed=false)
if (query && query.includes('review_mode') && query.includes('aggregate_gate.executed = false')) {
  data.review_mode = 'dual';
  if (!data.aggregate_gate) data.aggregate_gate = {};
  data.aggregate_gate.executed = false;
  data.aggregate_gate.gate = null;
  data.aggregate_gate.source = null;
  data.aggregate_gate.reason = null;
  data.aggregate_gate.last_run = vars.now || '';
  data.updated_at = vars.now || '';
  process.stdout.write(JSON.stringify(data));
  process.exit(0);
}

// Handle aggregate_gate READY/BLOCKED mutation (executed=true + gate=$gate)
if (query && query.includes('aggregate_gate.executed = true') && query.includes('aggregate_gate.gate = $gate')) {
  if (!data.aggregate_gate) data.aggregate_gate = {};
  data.aggregate_gate.executed = true;
  data.aggregate_gate.gate = vars.gate || '';
  data.aggregate_gate.reason = null;
  data.aggregate_gate.last_run = vars.now || '';
  data.updated_at = vars.now || '';
  process.stdout.write(JSON.stringify(data));
  process.exit(0);
}

// Handle aggregate_gate BLOCKED with reason (lock-failure path)
if (query && query.includes('aggregate_gate.gate = "BLOCKED"') && query.includes('aggregate_gate.reason = $reason')) {
  data.review_mode = 'dual';
  if (!data.aggregate_gate) data.aggregate_gate = {};
  data.aggregate_gate.executed = true;
  data.aggregate_gate.gate = 'BLOCKED';
  data.aggregate_gate.reason = vars.reason || '';
  data.aggregate_gate.last_run = vars.now || '';
  data.updated_at = vars.now || '';
  process.stdout.write(JSON.stringify(data));
  process.exit(0);
}

if (query && query.includes('[$key]') && vars.key) {
  if (!data || typeof data !== 'object') data = {};
  if (!data[vars.key] || typeof data[vars.key] !== 'object') data[vars.key] = {};
  data[vars.key].executed = vars.executed;
  data[vars.key].passed = vars.passed;
  data[vars.key].last_run = vars.now;
  data.updated_at = vars.now;
  process.stdout.write(JSON.stringify(data));
  process.exit(0);
}

if (query && query.includes('.transcript_path')) {
  outputValue(data.transcript_path ?? '');
  process.exit(0);
}
if (query && query.includes('.tool_name')) {
  outputValue(data.tool_name ?? '');
  process.exit(0);
}
if (query && query.includes('.tool_input')) {
  outputValue(data.tool_input ?? '');
  process.exit(0);
}
// (Removed v3.0.12) Stale MCP-only content branch — superseded by the unified
// coalesce handler below, which handles Bash {stdout}, MCP {content} (string/array),
// and plain strings via the same logic as production hook L83.
// Diagnostic helpers: has(tool_response) / has(tool_output) -> emit type or absent
if (query && query.includes('has("tool_response")')) {
  if (data.tool_response === undefined) {
    outputValue('absent');
  } else {
    outputValue(jqType(data.tool_response));
  }
  process.exit(0);
}
if (query && query.includes('has("tool_output")')) {
  if (data.tool_output === undefined) {
    outputValue('absent');
  } else {
    outputValue(jqType(data.tool_output));
  }
  process.exit(0);
}
// Coalesce read mirroring jq // operator: fall back only on null/false (not empty string).
// Also handles the unified normalize at hook L83+: Bash {stdout,...} -> stdout,
// MCP {content: string} -> content, MCP {content: [{type,text}]} -> joined text.
if (query && (query.includes('.tool_response') || query.includes('.tool_output'))) {
  const tr = data.tool_response;
  const useTr = tr !== undefined && tr !== null && tr !== false;
  const picked = useTr ? tr : (data.tool_output ?? '');
  if (picked && typeof picked === 'object' && !Array.isArray(picked)) {
    if (typeof picked.stdout === 'string') {
      process.stdout.write(picked.stdout);
    } else if (typeof picked.content === 'string') {
      process.stdout.write(picked.content);
    } else if (Array.isArray(picked.content)) {
      const text = picked.content
        .filter(c => c && c.type === 'text')
        .map(c => c.text)
        .join('\\n');
      process.stdout.write(text);
    } else {
      process.stdout.write(JSON.stringify(picked));
    }
  } else if (typeof picked === 'string') {
    process.stdout.write(picked);
  } else {
    process.stdout.write('');
  }
  process.exit(0);
}
if (query && query.includes('.command')) {
  outputValue(data.command ?? '');
  process.exit(0);
}
if (query && query.includes('.skill')) {
  outputValue(data.skill ?? '');
  process.exit(0);
}

if (query && query.includes('.code_review.passed')) {
  outputValue(asBoolString(data.code_review && data.code_review.passed));
  process.exit(0);
}
if (query && query.includes('.doc_review.passed')) {
  outputValue(asBoolString(data.doc_review && data.doc_review.passed));
  process.exit(0);
}
if (query && query.includes('.precommit.passed')) {
  outputValue(asBoolString(data.precommit && data.precommit.passed));
  process.exit(0);
}
if (query && query.includes('.has_code_change')) {
  outputValue(asBoolString(data.has_code_change));
  process.exit(0);
}
if (query && query.includes('.has_doc_change')) {
  outputValue(asBoolString(data.has_doc_change));
  process.exit(0);
}

// Handle contains query (arbitration guard)
if (query && query.includes('contains(')) {
  const m = query.match(/contains\\("([^"]+)"\\)/);
  if (m) {
    const needle = m[1];
    function findStrings(obj) {
      if (typeof obj === 'string') return [obj];
      if (Array.isArray(obj)) return obj.flatMap(findStrings);
      if (obj && typeof obj === 'object') return Object.values(obj).flatMap(findStrings);
      return [];
    }
    const allStrings = findStrings(data);
    const matched = allStrings.filter(s => s.includes(needle));
    if (matched.length > 0) {
      process.stdout.write(matched.map(s => JSON.stringify(s)).join('\\n'));
      process.exit(0);
    }
    if (hasExitFlag) process.exit(1);
    process.stdout.write('null');
    process.exit(0);
  }
}

// Handle schema_version read (migration check)
if (query && query.includes('schema_version // 1')) {
  const ver = data.schema_version || 1;
  process.stdout.write(String(ver));
  process.exit(0);
}

// Handle schema migration: .schema_version = 2 | .iteration_history //= {...}
if (query && query.includes('schema_version = 2') && query.includes('iteration_history')) {
  data.schema_version = 2;
  if (!data.iteration_history) {
    data.iteration_history = { current_round: 0, max_rounds: 10, findings_by_round: [], total_rounds_session: 0, strategic_reset_fired: false };
  }
  process.stdout.write(JSON.stringify(data));
  process.exit(0);
}

// Handle iteration update: .iteration_history.current_round += 1
if (query && query.includes('iteration_history.current_round += 1')) {
  if (!data.iteration_history) {
    data.iteration_history = { current_round: 0, max_rounds: 10, findings_by_round: [], total_rounds_session: 0, strategic_reset_fired: false };
  }
  data.iteration_history.current_round += 1;
  data.iteration_history.total_rounds_session = (data.iteration_history.total_rounds_session || 0) + 1;
  const entry = { round: data.iteration_history.current_round, total: vars.total || 0, p0: vars.p0 || 0, p1: vars.p1 || 0, p2: vars.p2 || 0, nit: vars.nit || 0, timestamp: vars.now || '' };
  data.iteration_history.findings_by_round.push(entry);
  data.updated_at = vars.now || '';
  process.stdout.write(JSON.stringify(data));
  process.exit(0);
}

process.stdout.write('');
`;
  writeExecutable(join(binDir, 'jq'), stubJq);
  return binDir;
}

function runHook({ cwd, binDir, input, env = {} }) {
  return spawnSync('bash', [hookPath], {
    cwd,
    input: JSON.stringify(input),
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${binDir}:${process.env.PATH}`,
      ...env,
    },
  });
}

function readState(cwd) {
  const statePath = join(cwd, '.claude_review_state.json');
  if (!existsSync(statePath)) return null;
  return JSON.parse(readFileSync(statePath, 'utf8'));
}

after(() => {
  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('/codex-review-fast pass sets code_review passed true', () => {
  const workDir = makeTempDir('sd0x-post-tool-');
  const binDir = setupStubBin();
  const result = runHook({
    cwd: workDir,
    binDir,
    input: {
      tool_name: 'Bash',
      tool_input: { command: '/codex-review-fast' },
      tool_output: '## Gate: \u2705',
    },
  });
  assert.equal(result.status, 0);
  const state = readState(workDir);
  assert.equal(state.code_review.passed, true);
});

test('/codex-review-fast block sets code_review passed false', () => {
  const workDir = makeTempDir('sd0x-post-tool-block-');
  const binDir = setupStubBin();
  const result = runHook({
    cwd: workDir,
    binDir,
    input: {
      tool_name: 'Bash',
      tool_input: { command: '/codex-review-fast' },
      tool_output: '## Gate: \u26d4',
    },
  });
  assert.equal(result.status, 0);
  const state = readState(workDir);
  assert.equal(state.code_review.passed, false);
});

test('/codex-review-doc pass sets doc_review passed true', () => {
  const workDir = makeTempDir('sd0x-post-tool-doc-');
  const binDir = setupStubBin();
  const result = runHook({
    cwd: workDir,
    binDir,
    input: {
      tool_name: 'Bash',
      tool_input: { command: '/codex-review-doc' },
      tool_output: '\u2705 All Pass',
    },
  });
  assert.equal(result.status, 0);
  const state = readState(workDir);
  assert.equal(state.doc_review.passed, true);
});

test('/precommit pass sets precommit passed true', () => {
  const workDir = makeTempDir('sd0x-post-tool-precommit-');
  const binDir = setupStubBin();
  const result = runHook({
    cwd: workDir,
    binDir,
    input: {
      tool_name: 'Bash',
      tool_input: { command: '/precommit' },
      tool_output: '## Overall: \u2705 PASS',
    },
  });
  assert.equal(result.status, 0);
  const state = readState(workDir);
  assert.equal(state.precommit.passed, true);
});

test('non-review tool does not write state', () => {
  const workDir = makeTempDir('sd0x-post-tool-nonreview-');
  const binDir = setupStubBin();
  const result = runHook({
    cwd: workDir,
    binDir,
    input: {
      tool_name: 'Read',
      tool_input: { path: 'README.md' },
      tool_output: 'ok',
    },
  });
  assert.equal(result.status, 0);
  const statePath = join(workDir, '.claude_review_state.json');
  assert.equal(existsSync(statePath), false);
});

test('re-run flips code_review passed from false to true', () => {
  const workDir = makeTempDir('sd0x-post-tool-rerun-');
  const binDir = setupStubBin();

  runHook({
    cwd: workDir,
    binDir,
    input: {
      tool_name: 'Bash',
      tool_input: { command: '/codex-review-fast' },
      tool_output: '## Gate: \u26d4',
    },
  });
  let state = readState(workDir);
  assert.equal(state.code_review.passed, false);

  runHook({
    cwd: workDir,
    binDir,
    input: {
      tool_name: 'Bash',
      tool_input: { command: '/codex-review-fast' },
      tool_output: '## Gate: \u2705',
    },
  });
  state = readState(workDir);
  assert.equal(state.code_review.passed, true);
});

test('/codex-review (without -fast) sets code_review', () => {
  const workDir = makeTempDir('sd0x-post-tool-review-full-');
  const binDir = setupStubBin();
  const result = runHook({
    cwd: workDir,
    binDir,
    input: {
      tool_name: 'Bash',
      tool_input: { command: '/codex-review' },
      tool_output: '## Gate: \u2705',
    },
  });
  assert.equal(result.status, 0);
  const state = readState(workDir);
  assert.equal(state.code_review.passed, true);
});

test('/precommit-fast sets precommit passed', () => {
  const workDir = makeTempDir('sd0x-post-tool-precommit-fast-');
  const binDir = setupStubBin();
  const result = runHook({
    cwd: workDir,
    binDir,
    input: {
      tool_name: 'Bash',
      tool_input: { command: '/precommit-fast' },
      tool_output: '## Overall: \u2705 PASS',
    },
  });
  assert.equal(result.status, 0);
  const state = readState(workDir);
  assert.equal(state.precommit.passed, true);
});

test('/review-spec sets doc_review passed', () => {
  const workDir = makeTempDir('sd0x-post-tool-review-spec-');
  const binDir = setupStubBin();
  const result = runHook({
    cwd: workDir,
    binDir,
    input: {
      tool_name: 'Bash',
      tool_input: { command: '/review-spec' },
      tool_output: '\u2705 All Pass',
    },
  });
  assert.equal(result.status, 0);
  const state = readState(workDir);
  assert.equal(state.doc_review.passed, true);
});

// =============================================================================
// MCP tool tests
// =============================================================================

test('MCP code review pass (\u2705 Ready) sets code_review passed true', () => {
  const workDir = makeTempDir('sd0x-post-tool-mcp-code-pass-');
  const binDir = setupStubBin();
  const result = runHook({
    cwd: workDir,
    binDir,
    input: {
      tool_name: 'mcp__codex__codex',
      tool_input: { prompt: 'review code' },
      tool_output: { content: '## Review\nAll good\n\u2705 Ready' },
    },
  });
  assert.equal(result.status, 0);
  const state = readState(workDir);
  assert.ok(state, 'state file should exist');
  assert.equal(state.code_review.passed, true);
});

test('MCP doc review pass (\u2705 Mergeable) sets doc_review passed true', () => {
  const workDir = makeTempDir('sd0x-post-tool-mcp-doc-pass-');
  const binDir = setupStubBin();
  const result = runHook({
    cwd: workDir,
    binDir,
    input: {
      tool_name: 'mcp__codex__codex',
      tool_input: { prompt: 'review docs' },
      tool_output: { content: '## Document Review\n\u2705 Mergeable' },
    },
  });
  assert.equal(result.status, 0);
  const state = readState(workDir);
  assert.ok(state, 'state file should exist');
  assert.equal(state.doc_review.passed, true);
});

test('MCP code review block (\u26d4 Blocked) sets code_review passed false', () => {
  const workDir = makeTempDir('sd0x-post-tool-mcp-code-block-');
  const binDir = setupStubBin();
  const result = runHook({
    cwd: workDir,
    binDir,
    input: {
      tool_name: 'mcp__codex__codex',
      tool_input: { prompt: 'review code' },
      tool_output: { content: '## Review\n\u26d4 Blocked\nP0 issues found' },
    },
  });
  assert.equal(result.status, 0);
  const state = readState(workDir);
  assert.ok(state, 'state file should exist');
  assert.equal(state.code_review.passed, false);
});

test('MCP doc review block (\u26d4 Needs revision) via codex-reply sets doc_review passed false', () => {
  const workDir = makeTempDir('sd0x-post-tool-mcp-doc-block-');
  const binDir = setupStubBin();
  const result = runHook({
    cwd: workDir,
    binDir,
    input: {
      tool_name: 'mcp__codex__codex-reply',
      tool_input: { prompt: 'continue review' },
      tool_output: { content: '## Document Review\n\u26d4 Needs revision\nMissing sections' },
    },
  });
  assert.equal(result.status, 0);
  const state = readState(workDir);
  assert.ok(state, 'state file should exist');
  assert.equal(state.doc_review.passed, false);
});

test('MCP \u2705 All Pass routes to code_review', () => {
  const workDir = makeTempDir('sd0x-post-tool-mcp-allpass-');
  const binDir = setupStubBin();
  const result = runHook({
    cwd: workDir,
    binDir,
    input: {
      tool_name: 'mcp__codex__codex',
      tool_input: { prompt: 'review' },
      tool_output: { content: '\u2705 All Pass' },
    },
  });
  assert.equal(result.status, 0);
  const state = readState(workDir);
  assert.ok(state, 'state file should exist');
  assert.equal(state.code_review.passed, true);
});

test('MCP ambiguous ## Gate: \u2705 alone does not create state', () => {
  const workDir = makeTempDir('sd0x-post-tool-mcp-ambiguous-');
  const binDir = setupStubBin();
  const result = runHook({
    cwd: workDir,
    binDir,
    input: {
      tool_name: 'mcp__codex__codex',
      tool_input: { prompt: 'review' },
      tool_output: { content: '## Gate: \u2705' },
    },
  });
  assert.equal(result.status, 0);
  const statePath = join(workDir, '.claude_review_state.json');
  assert.equal(existsSync(statePath), false, 'ambiguous gate alone should not create state');
});

test('MCP content as array format sets code_review', () => {
  const workDir = makeTempDir('sd0x-post-tool-mcp-array-');
  const binDir = setupStubBin();
  const result = runHook({
    cwd: workDir,
    binDir,
    input: {
      tool_name: 'mcp__codex__codex',
      tool_input: { prompt: 'review' },
      tool_output: { content: [{ type: 'text', text: '\u2705 Ready' }] },
    },
  });
  assert.equal(result.status, 0);
  const state = readState(workDir);
  assert.ok(state, 'state file should exist');
  assert.equal(state.code_review.passed, true);
});

test('MCP security review \u2705 Mergeable: No P0 does NOT set doc_review', () => {
  const workDir = makeTempDir('sd0x-post-tool-mcp-sec-');
  const binDir = setupStubBin();
  const result = runHook({
    cwd: workDir,
    binDir,
    input: {
      tool_name: 'mcp__codex__codex',
      tool_input: { prompt: 'security review' },
      tool_output: { content: '### Gate\n\u2705 Mergeable: No P0\n\u26d4 Must fix: Has P0' },
    },
  });
  assert.equal(result.status, 0);
  const statePath = join(workDir, '.claude_review_state.json');
  assert.equal(existsSync(statePath), false, 'security review should not create doc_review state');
});

test('MCP plain string tool_output does not crash hook', () => {
  const workDir = makeTempDir('sd0x-post-tool-mcp-string-');
  const binDir = setupStubBin();
  const result = runHook({
    cwd: workDir,
    binDir,
    input: {
      tool_name: 'mcp__codex__codex',
      tool_input: { prompt: 'brainstorm' },
      tool_output: 'Some plain text output without sentinels',
    },
  });
  assert.equal(result.status, 0, 'hook should not crash on plain string tool_output');
  const statePath = join(workDir, '.claude_review_state.json');
  assert.equal(existsSync(statePath), false, 'no sentinel means no state update');
});

test('MCP precommit FAIL sets precommit passed false', () => {
  const workDir = makeTempDir('sd0x-post-tool-mcp-precommit-fail-');
  const binDir = setupStubBin();
  const result = runHook({
    cwd: workDir,
    binDir,
    input: {
      tool_name: 'mcp__codex__codex',
      tool_input: { prompt: 'precommit' },
      tool_output: { content: '## Overall: \u26d4 FAIL\ntest:unit failed' },
    },
  });
  assert.equal(result.status, 0);
  const state = readState(workDir);
  assert.ok(state, 'state file should exist');
  assert.equal(state.precommit.executed, true);
  assert.equal(state.precommit.passed, false);
});

test('MCP precommit PASS sets precommit passed true', () => {
  const workDir = makeTempDir('sd0x-post-tool-mcp-precommit-pass-');
  const binDir = setupStubBin();
  const result = runHook({
    cwd: workDir,
    binDir,
    input: {
      tool_name: 'mcp__codex__codex',
      tool_input: { prompt: 'precommit' },
      tool_output: { content: '## Overall: \u2705 PASS\nall checks passed' },
    },
  });
  assert.equal(result.status, 0);
  const state = readState(workDir);
  assert.ok(state, 'state file should exist');
  assert.equal(state.precommit.executed, true);
  assert.equal(state.precommit.passed, true);
});

test('D1: security review with ✅ Mergeable but no ## Document Review does NOT set doc_review', () => {
  const workDir = makeTempDir('sd0x-post-tool-d1-sec-collision-');
  const binDir = setupStubBin();
  const result = runHook({
    cwd: workDir,
    binDir,
    input: {
      tool_name: 'mcp__codex__codex',
      tool_input: { prompt: 'security review' },
      tool_output: { content: '## Security Review Report\n### Gate\n\u2705 Mergeable\nNo critical issues' },
    },
  });
  assert.equal(result.status, 0);
  const statePath = join(workDir, '.claude_review_state.json');
  assert.equal(existsSync(statePath), false, 'security review without ## Document Review header should not set doc_review');
});

test('D1: doc review with ## Document Review + ✅ Mergeable sets doc_review', () => {
  const workDir = makeTempDir('sd0x-post-tool-d1-doc-ok-');
  const binDir = setupStubBin();
  const result = runHook({
    cwd: workDir,
    binDir,
    input: {
      tool_name: 'mcp__codex__codex',
      tool_input: { prompt: 'review docs' },
      tool_output: { content: '## Document Review Report\nAll sections present\n\u2705 Mergeable' },
    },
  });
  assert.equal(result.status, 0);
  const state = readState(workDir);
  assert.ok(state, 'state file should exist');
  assert.equal(state.doc_review.passed, true, 'doc review with correct header should set doc_review.passed');
});

test('D1: security review with ⛔ Needs revision but no ## Document Review does NOT set doc_review', () => {
  const workDir = makeTempDir('sd0x-post-tool-d1-sec-needs-rev-');
  const binDir = setupStubBin();
  const result = runHook({
    cwd: workDir,
    binDir,
    input: {
      tool_name: 'mcp__codex__codex',
      tool_input: { prompt: 'security review' },
      tool_output: { content: '## Security Review Report\n### Gate\n\u26d4 Needs revision\nCritical issues found' },
    },
  });
  assert.equal(result.status, 0);
  const statePath = join(workDir, '.claude_review_state.json');
  assert.equal(existsSync(statePath), false, 'security review with ⛔ Needs revision but no ## Document Review header should not set doc_review');
});

// =============================================================================
// Qualified (namespaced) command tests — /sd0x-dev-flow:command
// =============================================================================

test('/sd0x-dev-flow:codex-review-fast pass sets code_review passed true', () => {
  const workDir = makeTempDir('sd0x-post-tool-qual-code-');
  const binDir = setupStubBin();
  const result = runHook({
    cwd: workDir,
    binDir,
    input: {
      tool_name: 'Bash',
      tool_input: { command: '/sd0x-dev-flow:codex-review-fast' },
      tool_output: '## Gate: \u2705',
    },
  });
  assert.equal(result.status, 0);
  const state = readState(workDir);
  assert.equal(state.code_review.passed, true, 'qualified codex-review-fast should set code_review');
});

test('/sd0x-dev-flow:codex-review-doc pass sets doc_review passed true', () => {
  const workDir = makeTempDir('sd0x-post-tool-qual-doc-');
  const binDir = setupStubBin();
  const result = runHook({
    cwd: workDir,
    binDir,
    input: {
      tool_name: 'Bash',
      tool_input: { command: '/sd0x-dev-flow:codex-review-doc' },
      tool_output: '\u2705 All Pass',
    },
  });
  assert.equal(result.status, 0);
  const state = readState(workDir);
  assert.equal(state.doc_review.passed, true, 'qualified codex-review-doc should set doc_review');
});

test('/sd0x-dev-flow:precommit pass sets precommit passed true', () => {
  const workDir = makeTempDir('sd0x-post-tool-qual-pre-');
  const binDir = setupStubBin();
  const result = runHook({
    cwd: workDir,
    binDir,
    input: {
      tool_name: 'Bash',
      tool_input: { command: '/sd0x-dev-flow:precommit' },
      tool_output: '## Overall: \u2705 PASS',
    },
  });
  assert.equal(result.status, 0);
  const state = readState(workDir);
  assert.equal(state.precommit.passed, true, 'qualified precommit should set precommit');
});

test('/sd0x-dev-flow:review-spec pass sets doc_review passed true', () => {
  const workDir = makeTempDir('sd0x-post-tool-qual-review-spec-');
  const binDir = setupStubBin();
  const result = runHook({
    cwd: workDir,
    binDir,
    input: {
      tool_name: 'Bash',
      tool_input: { command: '/sd0x-dev-flow:review-spec' },
      tool_output: '\u2705 All Pass',
    },
  });
  assert.equal(result.status, 0);
  const state = readState(workDir);
  assert.equal(state.doc_review.passed, true, 'qualified review-spec should set doc_review');
});

test('MCP doc review mentioning OWASP still sets doc_review (regression)', () => {
  const workDir = makeTempDir('sd0x-post-tool-mcp-doc-owasp-');
  const binDir = setupStubBin();
  const result = runHook({
    cwd: workDir,
    binDir,
    input: {
      tool_name: 'mcp__codex__codex',
      tool_input: { prompt: 'review docs' },
      tool_output: { content: '## Document Review\nThis doc covers OWASP guidelines\n### Gate\n\u2705 Mergeable: No \ud83d\udd34 items' },
    },
  });
  assert.equal(result.status, 0);
  const state = readState(workDir);
  assert.ok(state, 'state file should exist');
  assert.equal(state.doc_review.passed, true, 'doc mentioning OWASP should still route to doc_review');
});

// =============================================================================
// emit-review-gate aggregate_gate tests (dual-mode)
// =============================================================================

test('emit-review-gate PENDING sets review_mode=dual and aggregate_gate.executed=false', () => {
  const workDir = makeTempDir('sd0x-post-tool-gate-pending-');
  const binDir = setupStubBin();
  const result = runHook({
    cwd: workDir,
    binDir,
    input: {
      tool_name: 'Bash',
      tool_input: { command: 'bash scripts/emit-review-gate.sh PENDING' },
      tool_output: 'REVIEW_GATE=PENDING',
    },
  });
  assert.equal(result.status, 0);
  const state = readState(workDir);
  assert.ok(state, 'state file should exist');
  assert.equal(state.review_mode, 'dual');
  assert.equal(state.aggregate_gate.executed, false);
  assert.equal(state.aggregate_gate.gate, null);
});

test('emit-review-gate READY sets aggregate_gate.executed=true and gate=READY', () => {
  const workDir = makeTempDir('sd0x-post-tool-gate-ready-');
  const binDir = setupStubBin();
  const result = runHook({
    cwd: workDir,
    binDir,
    input: {
      tool_name: 'Bash',
      tool_input: { command: 'bash scripts/emit-review-gate.sh READY' },
      tool_output: 'REVIEW_GATE=READY',
    },
  });
  assert.equal(result.status, 0);
  const state = readState(workDir);
  assert.ok(state, 'state file should exist');
  assert.equal(state.aggregate_gate.executed, true);
  assert.equal(state.aggregate_gate.gate, 'READY');
});

test('emit-review-gate BLOCKED sets aggregate_gate.executed=true and gate=BLOCKED', () => {
  const workDir = makeTempDir('sd0x-post-tool-gate-blocked-');
  const binDir = setupStubBin();
  const result = runHook({
    cwd: workDir,
    binDir,
    input: {
      tool_name: 'Bash',
      tool_input: { command: 'bash scripts/emit-review-gate.sh BLOCKED' },
      tool_output: 'REVIEW_GATE=BLOCKED',
    },
  });
  assert.equal(result.status, 0);
  const state = readState(workDir);
  assert.ok(state, 'state file should exist');
  assert.equal(state.aggregate_gate.executed, true);
  assert.equal(state.aggregate_gate.gate, 'BLOCKED');
});

test('emit-review-gate with extra output still parses correctly', () => {
  const workDir = makeTempDir('sd0x-post-tool-gate-extra-');
  const binDir = setupStubBin();
  const result = runHook({
    cwd: workDir,
    binDir,
    input: {
      tool_name: 'Bash',
      tool_input: { command: 'bash scripts/emit-review-gate.sh READY' },
      tool_output: 'Some other output\nREVIEW_GATE=READY\nMore output',
    },
  });
  assert.equal(result.status, 0);
  const state = readState(workDir);
  assert.ok(state, 'state file should exist');
  assert.equal(state.aggregate_gate.executed, true);
  assert.equal(state.aggregate_gate.gate, 'READY');
});

test('non-emit-review-gate Bash command does not write aggregate_gate', () => {
  const workDir = makeTempDir('sd0x-post-tool-gate-nogate-');
  const binDir = setupStubBin();
  const result = runHook({
    cwd: workDir,
    binDir,
    input: {
      tool_name: 'Bash',
      tool_input: { command: 'npm test' },
      tool_output: 'all tests passed',
    },
  });
  assert.equal(result.status, 0);
  const statePath = join(workDir, '.claude_review_state.json');
  assert.equal(existsSync(statePath), false, 'non-gate command should not create state');
});

// =============================================================================
// Arbitration guard (plugin-defers-to-local)
// =============================================================================

function setupLocalHook(dir, scriptName) {
  const hooksDir = join(dir, '.claude', 'hooks');
  mkdirSync(hooksDir, { recursive: true });
  writeExecutable(join(hooksDir, scriptName), '#!/bin/bash\nexit 0');
}

function writeSettingsWithHook(dir, scriptName, fileName) {
  const claudeDir = join(dir, '.claude');
  mkdirSync(claudeDir, { recursive: true });
  writeFileSync(
    join(claudeDir, fileName || 'settings.json'),
    JSON.stringify({
      hooks: {
        PostToolUse: [
          {
            matcher: 'Bash',
            hooks: [
              {
                type: 'command',
                command: `"$CLAUDE_PROJECT_DIR"/.claude/hooks/${scriptName}`,
              },
            ],
          },
        ],
      },
    })
  );
}

test('arbitration: defers when local hook exists and registered in settings', () => {
  const workDir = makeTempDir('sd0x-post-tool-arb-defer-');
  const binDir = setupStubBin();
  setupLocalHook(workDir, 'post-tool-review-state.sh');
  writeSettingsWithHook(workDir, 'post-tool-review-state.sh');
  const result = runHook({
    cwd: workDir,
    binDir,
    input: {
      tool_name: 'Bash',
      tool_input: { command: '/codex-review-fast' },
      tool_output: '## Gate: \u2705',
    },
    env: { CLAUDE_PROJECT_DIR: workDir },
  });
  assert.equal(result.status, 0, 'should defer to local hook');
  // Deferred means no state file created
  assert.equal(readState(workDir), null, 'should not create state when deferred');
});

test('arbitration: dev mode bypass when hooks/hooks.json exists', () => {
  const workDir = makeTempDir('sd0x-post-tool-arb-dev-');
  const binDir = setupStubBin();
  mkdirSync(join(workDir, 'hooks'), { recursive: true });
  writeFileSync(join(workDir, 'hooks', 'hooks.json'), '{}');
  setupLocalHook(workDir, 'post-tool-review-state.sh');
  writeSettingsWithHook(workDir, 'post-tool-review-state.sh');
  const result = runHook({
    cwd: workDir,
    binDir,
    input: {
      tool_name: 'Bash',
      tool_input: { command: '/codex-review-fast' },
      tool_output: '## Gate: \u2705',
    },
    env: { CLAUDE_PROJECT_DIR: workDir },
  });
  assert.equal(result.status, 0);
  const state = readState(workDir);
  assert.ok(state, 'should run normally and create state in dev mode');
  assert.equal(state.code_review.passed, true);
});

test('arbitration: no local hook runs normally', () => {
  const workDir = makeTempDir('sd0x-post-tool-arb-nohook-');
  const binDir = setupStubBin();
  writeSettingsWithHook(workDir, 'post-tool-review-state.sh');
  const result = runHook({
    cwd: workDir,
    binDir,
    input: {
      tool_name: 'Bash',
      tool_input: { command: '/codex-review-fast' },
      tool_output: '## Gate: \u2705',
    },
    env: { CLAUDE_PROJECT_DIR: workDir },
  });
  const state = readState(workDir);
  assert.ok(state, 'should run normally when no local hook');
  assert.equal(state.code_review.passed, true);
});

test('arbitration: CLAUDE_PROJECT_DIR unset runs normally', () => {
  const workDir = makeTempDir('sd0x-post-tool-arb-noenv-');
  const binDir = setupStubBin();
  const result = runHook({
    cwd: workDir,
    binDir,
    input: {
      tool_name: 'Bash',
      tool_input: { command: '/codex-review-fast' },
      tool_output: '## Gate: \u2705',
    },
  });
  const state = readState(workDir);
  assert.ok(state, 'should run normally without CLAUDE_PROJECT_DIR');
  assert.equal(state.code_review.passed, true);
});

test('arbitration: local hook exists but not in settings runs normally', () => {
  const workDir = makeTempDir('sd0x-post-tool-arb-noreg-');
  const binDir = setupStubBin();
  setupLocalHook(workDir, 'post-tool-review-state.sh');
  const result = runHook({
    cwd: workDir,
    binDir,
    input: {
      tool_name: 'Bash',
      tool_input: { command: '/codex-review-fast' },
      tool_output: '## Gate: \u2705',
    },
    env: { CLAUDE_PROJECT_DIR: workDir },
  });
  const state = readState(workDir);
  assert.ok(state, 'should run normally when not registered');
  assert.equal(state.code_review.passed, true);
});

test('arbitration: registered in settings.local.json defers', () => {
  const workDir = makeTempDir('sd0x-post-tool-arb-local-');
  const binDir = setupStubBin();
  setupLocalHook(workDir, 'post-tool-review-state.sh');
  writeSettingsWithHook(workDir, 'post-tool-review-state.sh', 'settings.local.json');
  const result = runHook({
    cwd: workDir,
    binDir,
    input: {
      tool_name: 'Bash',
      tool_input: { command: '/codex-review-fast' },
      tool_output: '## Gate: \u2705',
    },
    env: { CLAUDE_PROJECT_DIR: workDir },
  });
  assert.equal(result.status, 0, 'should defer via settings.local.json');
  assert.equal(readState(workDir), null, 'should not create state when deferred');
});

// --- R10: total_rounds_session ---

test('total_rounds_session increments on code review iteration', () => {
  const workDir = makeTempDir('sd0x-post-tool-trs-');
  const binDir = setupStubBin();

  // Seed state with iteration_history including total_rounds_session
  writeFileSync(
    join(workDir, '.claude_review_state.json'),
    JSON.stringify({
      schema_version: 2,
      has_code_change: true,
      code_review: { executed: false, passed: false, last_run: '' },
      doc_review: { executed: false, passed: false, last_run: '' },
      precommit: { executed: false, passed: false, last_run: '' },
      iteration_history: {
        current_round: 0,
        max_rounds: 10,
        findings_by_round: [],
        total_rounds_session: 0,
        strategic_reset_fired: false,
      },
    })
  );

  const result = runHook({
    cwd: workDir,
    binDir,
    input: {
      tool_name: 'Bash',
      tool_input: { command: '/codex-review-fast' },
      tool_output: '## Gate: ✅ Ready\n- [P2] Minor issue',
    },
    env: { CLAUDE_PROJECT_DIR: workDir },
  });
  assert.equal(result.status, 0);
  const state = readState(workDir);
  assert.equal(
    state.iteration_history.total_rounds_session,
    1,
    'total_rounds_session should increment to 1 after first review'
  );
  assert.equal(
    state.iteration_history.current_round,
    1,
    'current_round should also increment to 1'
  );
});

// =============================================================================
// R6: max_rounds project override applied on init (post-tool-review-state mirror)
// =============================================================================

test('R6: init reads override with real template shape (comment block between heading and value)', () => {
  const workDir = makeTempDir('sd0x-ptrs-r6-realshape-');
  const binDir = setupStubBin();
  mkdirSync(join(workDir, 'rules'), { recursive: true });
  writeFileSync(
    join(workDir, 'rules', 'auto-loop-project.md'),
    '# Auto-Loop Project Overrides\n\n## Max Rounds\n\n<!-- Override description.\n     Range: 3-50. -->\n\n20\n\n## Git Memory\n'
  );
  const result = runHook({
    cwd: workDir,
    binDir,
    input: {
      tool_name: 'Bash',
      tool_input: { command: '/codex-review-fast' },
      tool_output: '## Gate: ✅',
    },
  });
  assert.equal(result.status, 0);
  const state = readState(workDir);
  assert.ok(state);
  assert.equal(
    state.iteration_history.max_rounds, 20,
    'parser must scan past HTML comment block to find bare integer override'
  );
});

test('R6: init ignores commented placeholder and falls back to default', () => {
  const workDir = makeTempDir('sd0x-ptrs-r6-commented-');
  const binDir = setupStubBin();
  mkdirSync(join(workDir, 'rules'), { recursive: true });
  writeFileSync(
    join(workDir, 'rules', 'auto-loop-project.md'),
    '# Auto-Loop Project Overrides\n\n## Max Rounds\n\n<!-- Override description. -->\n\n<!-- 10 -->\n\n## Git Memory\n'
  );
  const result = runHook({
    cwd: workDir,
    binDir,
    input: {
      tool_name: 'Bash',
      tool_input: { command: '/codex-review-fast' },
      tool_output: '## Gate: ✅',
    },
  });
  assert.equal(result.status, 0);
  const state = readState(workDir);
  assert.ok(state);
  assert.equal(
    state.iteration_history.max_rounds, 10,
    'commented-out placeholder must NOT be treated as an override'
  );
});

test('R6: init ignores integer inside multi-line HTML comment', () => {
  const workDir = makeTempDir('sd0x-ptrs-r6-multiline-');
  const binDir = setupStubBin();
  mkdirSync(join(workDir, 'rules'), { recursive: true });
  writeFileSync(
    join(workDir, 'rules', 'auto-loop-project.md'),
    '# Auto-Loop Project Overrides\n\n## Max Rounds\n<!--\n30\n-->\n\n## Git Memory\n'
  );
  const result = runHook({
    cwd: workDir,
    binDir,
    input: {
      tool_name: 'Bash',
      tool_input: { command: '/codex-review-fast' },
      tool_output: '## Gate: ✅',
    },
  });
  assert.equal(result.status, 0);
  const state = readState(workDir);
  assert.ok(state);
  assert.equal(
    state.iteration_history.max_rounds, 10,
    'integer inside multi-line HTML comment must be treated as commented-out'
  );
});

test('R6: init rejects out-of-range override (100) and uses default', () => {
  const workDir = makeTempDir('sd0x-ptrs-r6-reject-');
  const binDir = setupStubBin();
  mkdirSync(join(workDir, 'rules'), { recursive: true });
  writeFileSync(
    join(workDir, 'rules', 'auto-loop-project.md'),
    '# Overrides\n\n## Max Rounds\n100\n'
  );
  const result = runHook({
    cwd: workDir,
    binDir,
    input: {
      tool_name: 'Bash',
      tool_input: { command: '/codex-review-fast' },
      tool_output: '## Gate: ✅',
    },
  });
  assert.equal(result.status, 0);
  const state = readState(workDir);
  assert.ok(state);
  assert.equal(
    state.iteration_history.max_rounds, 10,
    'out-of-range override must fall back to default'
  );
});

// =============================================================================
// v3.0.12: PostToolUse field rename — tool_response (current) // tool_output (legacy)
// =============================================================================

test('v3.0.12: tool_response Bash shape drives review state', () => {
  const workDir = makeTempDir('sd0x-post-tool-tr-bash-');
  const binDir = setupStubBin();
  const result = runHook({
    cwd: workDir,
    binDir,
    input: {
      tool_name: 'Bash',
      tool_input: { command: '/codex-review-fast' },
      tool_response: '## Gate: ✅',
    },
  });
  assert.equal(result.status, 0);
  const state = readState(workDir);
  assert.ok(state, 'state file must be written');
  assert.equal(state.code_review.executed, true);
  assert.equal(state.code_review.passed, true);
});

test('v3.0.12: tool_response Skill shape captures gate', () => {
  const workDir = makeTempDir('sd0x-post-tool-tr-skill-');
  const binDir = setupStubBin();
  const result = runHook({
    cwd: workDir,
    binDir,
    input: {
      tool_name: 'Skill',
      tool_input: { skill: 'codex-review-fast' },
      tool_response: '## Gate: ✅ Ready',
    },
  });
  assert.equal(result.status, 0);
  const state = readState(workDir);
  assert.ok(state);
  assert.equal(state.code_review.passed, true);
});

test('v3.0.12: tool_response MCP object .content string', () => {
  const workDir = makeTempDir('sd0x-post-tool-tr-mcp-str-');
  const binDir = setupStubBin();
  const result = runHook({
    cwd: workDir,
    binDir,
    input: {
      tool_name: 'mcp__codex__codex',
      tool_input: { prompt: 'review' },
      tool_response: { content: '## Gate: ✅ Ready' },
    },
  });
  assert.equal(result.status, 0);
  const state = readState(workDir);
  assert.ok(state);
  assert.equal(state.code_review.passed, true);
});

test('v3.0.12: tool_response MCP content array joins text parts', () => {
  const workDir = makeTempDir('sd0x-post-tool-tr-mcp-arr-');
  const binDir = setupStubBin();
  const result = runHook({
    cwd: workDir,
    binDir,
    input: {
      tool_name: 'mcp__codex__codex-reply',
      tool_input: { threadId: 'abc' },
      tool_response: {
        content: [
          { type: 'text', text: '✅ Ready' },
          { type: 'text', text: 'all green' },
        ],
      },
    },
  });
  assert.equal(result.status, 0);
  const state = readState(workDir);
  assert.ok(state);
  assert.equal(state.code_review.passed, true);
});

test('v3.0.12: both tool_response and tool_output missing -> stderr diagnostic, exit 0', () => {
  const workDir = makeTempDir('sd0x-post-tool-missing-');
  const binDir = setupStubBin();
  const result = runHook({
    cwd: workDir,
    binDir,
    input: {
      tool_name: 'Bash',
      tool_input: { command: '/codex-review-fast' },
    },
  });
  assert.equal(result.status, 0, 'hook must not crash on missing fields');
  assert.match(
    result.stderr,
    /\[post-tool-review-state\] empty output: tool=Bash tool_response=absent tool_output=absent/,
    'diagnostic must surface tool name and field absence'
  );
  assert.doesNotMatch(
    result.stderr,
    /codex-review-fast/,
    'diagnostic must not leak tool_input.command'
  );
});

test('v3.0.12: tool_response takes precedence over legacy tool_output', () => {
  const workDir = makeTempDir('sd0x-post-tool-precedence-');
  const binDir = setupStubBin();
  const result = runHook({
    cwd: workDir,
    binDir,
    input: {
      tool_name: 'Bash',
      tool_input: { command: '/codex-review-fast' },
      tool_response: '## Gate: ✅',
      tool_output: '## Gate: ⛔ Blocked (stale legacy field)',
    },
  });
  assert.equal(result.status, 0);
  const state = readState(workDir);
  assert.ok(state);
  assert.equal(state.code_review.passed, true, 'tool_response (passed) must win over tool_output (blocked)');
});

test('v3.0.12: Bash structured tool_response normalizes stdout', () => {
  const workDir = makeTempDir('sd0x-post-tool-bash-obj-');
  const binDir = setupStubBin();
  const result = runHook({
    cwd: workDir,
    binDir,
    input: {
      tool_name: 'Bash',
      tool_input: { command: '/codex-review-fast' },
      tool_response: {
        stdout: '## Gate: ✅\n',
        stderr: '',
        interrupted: false,
        isImage: false,
      },
    },
  });
  assert.equal(result.status, 0);
  const state = readState(workDir);
  assert.ok(state, 'Bash structured object must be normalized to stdout');
  assert.equal(state.code_review.passed, true);
});

test('v3.0.12: Bash structured tool_response routes /precommit pass marker', () => {
  const workDir = makeTempDir('sd0x-post-tool-bash-pc-');
  const binDir = setupStubBin();
  const result = runHook({
    cwd: workDir,
    binDir,
    input: {
      tool_name: 'Bash',
      tool_input: { command: '/precommit' },
      tool_response: {
        stdout: '## Overall: ✅ PASS\n',
        stderr: '',
        interrupted: false,
        isImage: false,
      },
    },
  });
  assert.equal(result.status, 0);
  const state = readState(workDir);
  assert.ok(state, 'precommit state must be set from Bash structured stdout');
  assert.equal(state.precommit.executed, true);
  assert.equal(state.precommit.passed, true);
});

test('v3.0.12: Bash structured tool_response routes emit-review-gate sentinel', () => {
  const workDir = makeTempDir('sd0x-post-tool-bash-gate-');
  const binDir = setupStubBin();
  const result = runHook({
    cwd: workDir,
    binDir,
    input: {
      tool_name: 'Bash',
      tool_input: { command: 'bash scripts/emit-review-gate.sh READY' },
      tool_response: {
        stdout: 'REVIEW_GATE=READY\n',
        stderr: '',
        interrupted: false,
        isImage: false,
      },
    },
  });
  assert.equal(result.status, 0);
  const state = readState(workDir);
  assert.ok(state, 'aggregate_gate must be set from structured stdout');
  assert.equal(state.aggregate_gate?.gate, 'READY');
});

test('v3.0.12: empty-string tool_response does NOT fall back to tool_output (jq // semantics)', () => {
  const workDir = makeTempDir('sd0x-post-tool-empty-str-');
  const binDir = setupStubBin();
  const result = runHook({
    cwd: workDir,
    binDir,
    input: {
      tool_name: 'Bash',
      tool_input: { command: '/codex-review-fast' },
      tool_response: '',
      tool_output: '## Gate: ✅',
    },
  });
  assert.equal(result.status, 0);
  const state = readState(workDir);
  // tool_response="" is not null/false → jq `//` does NOT fall back. State should
  // remain unset because empty string yields no gate match.
  if (state && state.code_review) {
    assert.notEqual(state.code_review.passed, true, 'empty tool_response must not yield passed=true via legacy fallback');
  }
});
