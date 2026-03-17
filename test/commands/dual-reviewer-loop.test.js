const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const root = resolve(__dirname, '../..');

// --- auto-loop.md ---

test('auto-loop.md has "Fixing ≠ Verifying" prohibited behavior', () => {
  const content = readFileSync(resolve(root, 'rules/auto-loop.md'), 'utf8');
  assert.match(content, /Fixing ≠ Verifying/, 'should have Fixing ≠ Verifying prohibition');
});

test('auto-loop.md has "Skipping dual dispatch" prohibited behavior', () => {
  const content = readFileSync(resolve(root, 'rules/auto-loop.md'), 'utf8');
  assert.match(content, /Skipping dual dispatch/, 'should have Skipping dual dispatch prohibition');
});

test('auto-loop.md has Cycle reset row in Dual Review Mode', () => {
  const content = readFileSync(resolve(root, 'rules/auto-loop.md'), 'utf8');
  assert.match(content, /Cycle reset/, 'should have Cycle reset rule');
  assert.match(content, /both reviewers must re-run/, 'Cycle reset should mandate both reviewers');
});

test('auto-loop.md Loop re-review mandates both reviewers', () => {
  const content = readFileSync(resolve(root, 'rules/auto-loop.md'), 'utf8');
  assert.match(content, /Loop re-review/, 'should have Loop re-review rule');
  assert.match(content, /re-dispatch both reviewers/, 'should mandate re-dispatch both');
  assert.match(content, /no skip exception/, 'should have no skip exception');
});

test('auto-loop.md correct behavior shows dual dispatch pattern', () => {
  const content = readFileSync(resolve(root, 'rules/auto-loop.md'), 'utf8');
  assert.match(content, /Secondary fresh/, 'correct behavior should show Secondary fresh dispatch');
  assert.match(content, /parallel dispatch/, 'correct behavior should mention parallel dispatch');
});

// --- .claude/rules/auto-loop.md (installed copy) ---

test('.claude/rules/auto-loop.md is in sync with rules/auto-loop.md', () => {
  const source = readFileSync(resolve(root, 'rules/auto-loop.md'), 'utf8');
  const installed = readFileSync(resolve(root, '.claude/rules/auto-loop.md'), 'utf8');
  assert.equal(source, installed, '.claude/rules/auto-loop.md should match rules/auto-loop.md');
});

// --- SKILL.md ---

test('SKILL.md Case B mandates dual dispatch in loops', () => {
  const content = readFileSync(resolve(root, 'skills/codex-code-review/SKILL.md'), 'utf8');
  assert.match(content, /Re-dispatch in parallel/, 'Case B should mandate re-dispatch in parallel');
  assert.match(content, /Always dispatched in v1/, 'Case B should say always dispatched in v1');
});

test('SKILL.md Dual Mode Loop Behavior re-dispatches secondary every iteration', () => {
  const content = readFileSync(resolve(root, 'skills/codex-code-review/SKILL.md'), 'utf8');
  assert.match(content, /Re-dispatched every iteration/, 'should re-dispatch secondary every iteration');
});

// --- review-common.md ---

test('review-common.md loop table re-dispatches secondary every iteration', () => {
  const content = readFileSync(resolve(root, 'skills/codex-code-review/references/review-common.md'), 'utf8');
  assert.match(content, /Re-dispatched every iteration/, 'secondary should be re-dispatched every iteration');
  assert.match(content, /no skip exception/, 'should have no skip exception');
});

test('review-common.md mentions pre-precommit checkpoint for aggregation', () => {
  const content = readFileSync(resolve(root, 'skills/codex-code-review/references/review-common.md'), 'utf8');
  assert.match(content, /pre-precommit checkpoint/, 'should mention pre-precommit checkpoint');
});

// --- Negative assertions (guard against legacy single-reviewer text) ---

test('SKILL.md does not contain "Codex --continue only" for re-review', () => {
  const content = readFileSync(resolve(root, 'skills/codex-code-review/SKILL.md'), 'utf8');
  assert.doesNotMatch(content, /Codex `--continue` only\)/, 'should not have Codex-only re-review in checkpoint');
});

test('SKILL.md does not contain "late result is advisory log"', () => {
  const content = readFileSync(resolve(root, 'skills/codex-code-review/SKILL.md'), 'utf8');
  assert.doesNotMatch(content, /late result is advisory log/, 'late secondary P0/P1 must re-open loop, not be advisory');
});
