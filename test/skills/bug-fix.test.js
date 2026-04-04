const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, existsSync } = require('node:fs');
const { resolve } = require('node:path');

const root = resolve(__dirname, '../..');
const skillPath = resolve(root, 'skills/bug-fix/SKILL.md');
const testingGuidePath = resolve(root, 'skills/bug-fix/references/testing-guide.md');

// --- SKILL.md content assertions ---

test('bug-fix SKILL.md has Prohibited block with git restrictions', () => {
  const content = readFileSync(skillPath, 'utf8');
  assert.match(content, /git add.*git commit.*git push/, 'should prohibit git add, commit, push');
  assert.match(content, /Prohibited Actions/, 'should have Prohibited Actions section');
});

test('bug-fix SKILL.md has exact allowed-tools (Bash, not scoped)', () => {
  const content = readFileSync(skillPath, 'utf8');
  assert.match(content, /allowed-tools:.*Read, Grep, Glob, Edit, Write, Bash/, 'should have full tool list');
  assert.doesNotMatch(content, /Bash\(git/, 'should not have scoped Bash(git:*)');
});

test('bug-fix SKILL.md has mandatory /codex-test-review with gap closure', () => {
  const content = readFileSync(skillPath, 'utf8');
  assert.match(content, /mandatory/i, 'should mention mandatory');
  assert.match(content, /codex-test-review/, 'should reference codex-test-review');
  assert.match(content, /gap closure/i, 'should mention gap closure');
});

test('bug-fix SKILL.md has freshness rule', () => {
  const content = readFileSync(skillPath, 'utf8');
  assert.match(content, /freshness/i, 'should have freshness rule');
});

test('bug-fix SKILL.md references @rules/testing.md', () => {
  const content = readFileSync(skillPath, 'utf8');
  assert.match(content, /rules\/testing\.md/, 'should reference testing.md rules');
});

test('bug-fix SKILL.md has bug-type matrix including cross-service', () => {
  const content = readFileSync(skillPath, 'utf8');
  assert.match(content, /Cross-service/, 'should have Cross-service/data flow row');
  assert.match(content, /Logic error/, 'should have Logic error row');
  assert.match(content, /API issue/, 'should have API issue row');
});

test('bug-fix SKILL.md has auto-loop Doc Sync pointer', () => {
  const content = readFileSync(skillPath, 'utf8');
  assert.match(content, /auto-loop/, 'should reference auto-loop');
  assert.match(content, /Doc Sync/, 'should have Doc Sync section');
});

test('bug-fix SKILL.md verification checklist includes no-git', () => {
  const content = readFileSync(skillPath, 'utf8');
  assert.match(content, /No.*git add\/commit\/push/, 'should have no-git checklist item');
});

test('bug-fix SKILL.md does not reference testing-guide.md', () => {
  const content = readFileSync(skillPath, 'utf8');
  assert.doesNotMatch(content, /testing-guide\.md/, 'should not reference deleted testing-guide.md');
});

// --- File existence assertions ---

test('testing-guide.md does not exist (deleted after migration)', () => {
  assert.equal(existsSync(testingGuidePath), false, 'testing-guide.md should have been deleted');
});
