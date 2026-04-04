const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const root = resolve(__dirname, '../..');
const skillPath = resolve(root, 'skills/create-request/SKILL.md');

// --- AC1: --verify-ac flag documented ---

test('SKILL.md has --verify-ac flag', () => {
  const content = readFileSync(skillPath, 'utf8');
  assert.match(content, /--verify-ac/, 'should document --verify-ac flag');
});

// --- AC2: Phase 2.5 agent dispatch with AC list + Related Files ---

test('SKILL.md has Phase 2.5 with Explore agent dispatch', () => {
  const content = readFileSync(skillPath, 'utf8');
  assert.match(content, /Phase 2\.5/, 'should have Phase 2.5 section');
  assert.match(content, /Explore/, 'should reference Explore agent');
});

test('SKILL.md Phase 2.5 has AC_LIST and RELATED_FILES input', () => {
  const content = readFileSync(skillPath, 'utf8');
  assert.match(content, /AC_LIST/, 'should have AC_LIST input');
  assert.match(content, /RELATED_FILES/, 'should have RELATED_FILES input');
});

// --- AC3: Agent output follows AC Coverage schema ---

test('SKILL.md agent output has Complete/Partial/Not Found/Inconclusive statuses', () => {
  const content = readFileSync(skillPath, 'utf8');
  assert.match(content, /Complete/, 'should have Complete status');
  assert.match(content, /Partial/, 'should have Partial status');
  assert.match(content, /Not Found/, 'should have Not Found status');
  assert.match(content, /Inconclusive/, 'should have Inconclusive status');
});

// --- AC4: Timeout 60 sec + Inconclusive fallback ---

test('SKILL.md documents 60 sec timeout and Inconclusive fallback', () => {
  const content = readFileSync(skillPath, 'utf8');
  assert.match(content, /60 sec/, 'should document 60 sec timeout');
  assert.match(content, /Inconclusive/, 'should document Inconclusive fallback');
});

// --- AC5: Candidate Complete status in lifecycle ---

test('SKILL.md has Candidate Complete in status lifecycle', () => {
  const content = readFileSync(skillPath, 'utf8');
  assert.match(content, /Candidate Complete/, 'should have Candidate Complete status');
  assert.match(
    content,
    /Pending.*In Progress.*Candidate Complete.*Completed/s,
    'lifecycle should be Pending → In Progress → Candidate Complete → Completed'
  );
});

// --- AC6: Scan mode groups Candidate Complete after In Progress ---

test('SKILL.md scan mode groups Candidate Complete after In Progress', () => {
  const content = readFileSync(skillPath, 'utf8');
  const ipIdx = content.indexOf('**In Progress**');
  const ccIdx = content.indexOf('**Candidate Complete**');
  const pendIdx = content.indexOf('**Pending**');
  assert.ok(ipIdx > 0, 'should have In Progress group');
  assert.ok(ccIdx > ipIdx, 'Candidate Complete should appear after In Progress');
  assert.ok(ccIdx < pendIdx, 'Candidate Complete should appear before Pending');
});

// --- AC7: --update-all marks heuristic completions as Candidate Complete ---

test('SKILL.md batch update uses Candidate Complete for heuristic completions', () => {
  const content = readFileSync(skillPath, 'utf8');
  assert.match(
    content,
    /ALL_CHECKED.*Candidate Complete/s,
    'ALL_CHECKED classification should use Candidate Complete'
  );
});

// --- Infrastructure: Agent in allowed-tools ---

test('SKILL.md has Agent in allowed-tools', () => {
  const content = readFileSync(skillPath, 'utf8');
  assert.match(content, /allowed-tools:.*Agent/, 'should have Agent in allowed-tools');
});
