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
// Handle MCP content extraction (tool_output.content string or array, with type guard)
if (query && query.includes('tool_output') && query.includes('type') && query.includes('content')) {
  const to = data.tool_output;
  if (to && typeof to === 'object' && !Array.isArray(to)) {
    const content = to.content;
    if (typeof content === 'string') {
      process.stdout.write(content);
    } else if (Array.isArray(content)) {
      const text = content.filter(c => c.type === 'text').map(c => c.text).join('\\n');
      process.stdout.write(text);
    } else {
      process.stdout.write(JSON.stringify(to));
    }
  } else if (typeof to === 'string') {
    process.stdout.write(to);
  } else {
    process.stdout.write('');
  }
  process.exit(0);
}
if (query && query.includes('.tool_output')) {
  outputValue(data.tool_output ?? '');
  process.exit(0);
}
if (query && query.includes('.command')) {
  outputValue(data.command ?? '');
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
