const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, existsSync } = require('node:fs');
const { resolve } = require('node:path');

const root = resolve(__dirname, '../..');
const skillPath = resolve(root, 'skills/codex-code-review/SKILL.md');
const fastPromptPath = resolve(root, 'skills/codex-code-review/references/codex-prompt-fast.md');
const fullPromptPath = resolve(root, 'skills/codex-code-review/references/codex-prompt-full.md');
const branchPromptPath = resolve(root, 'skills/codex-code-review/references/codex-prompt-branch.md');
const reviewCommonPath = resolve(root, 'skills/codex-code-review/references/review-common.md');

// --- Step 1.5: Feature & AC Detection ---

test('SKILL.md has Step 1.5 Feature Context & AC Detection', () => {
  const content = readFileSync(skillPath, 'utf8');
  assert.match(content, /Step 1\.5.*Feature Context.*AC Detection/i);
});

test('SKILL.md Step 1.5 references resolve-feature.sh', () => {
  const content = readFileSync(skillPath, 'utf8');
  assert.match(content, /resolve-feature\.sh/);
});

test('SKILL.md Step 1.5 has confidence threshold (medium)', () => {
  const content = readFileSync(skillPath, 'utf8');
  assert.match(content, /confidence.*medium/i);
});

test('SKILL.md Step 1.5 has quality-gate AC filter', () => {
  const content = readFileSync(skillPath, 'utf8');
  assert.match(content, /quality-gate ACs matching/);
  assert.match(content, /codex-review-fast/);
  assert.match(content, /precommit/);
});

test('SKILL.md Step 1.5 has AC cap (max 20)', () => {
  const content = readFileSync(skillPath, 'utf8');
  assert.match(content, /max 20 ACs/i);
});

test('SKILL.md Step 1.5 has graceful degradation', () => {
  const content = readFileSync(skillPath, 'utf8');
  assert.match(content, /SPEC_CHECKLIST = null.*skip silently/i);
});

// --- Step 1.6: Deferred Finding Context ---

test('SKILL.md has Step 1.6 Deferred Finding Context', () => {
  const content = readFileSync(skillPath, 'utf8');
  assert.match(content, /Step 1\.6.*Deferred Finding Context/i);
});

test('SKILL.md Step 1.6 has R4 prerequisite note', () => {
  const content = readFileSync(skillPath, 'utf8');
  assert.match(content, /Prerequisite.*R4.*Nit History/i);
});

test('SKILL.md Step 1.6 has sanitization contract', () => {
  const content = readFileSync(skillPath, 'utf8');
  assert.match(content, /Sanitize each entry.*mandatory/i);
  assert.match(content, /120 chars/);
  assert.match(content, /Strip markdown control chars/);
  assert.match(content, /No secrets/);
  assert.match(content, /shell metacharacters/);
});

test('SKILL.md Step 1.6 has deferred_context XML format', () => {
  const content = readFileSync(skillPath, 'utf8');
  assert.match(content, /<deferred_context>/);
});

test('SKILL.md Step 1.6 has max 10 entries cap', () => {
  const content = readFileSync(skillPath, 'utf8');
  assert.match(content, /max 10 entries/);
});

// --- Prompt Templates: SPEC_CHECKLIST injection ---

const promptVariants = [
  { name: 'fast', path: fastPromptPath },
  { name: 'full', path: fullPromptPath },
  { name: 'branch', path: branchPromptPath },
];

for (const variant of promptVariants) {
  test(`${variant.name} prompt has SPEC_CHECKLIST conditional injection`, () => {
    const content = readFileSync(variant.path, 'utf8');
    assert.match(content, /SPEC_CHECKLIST \?/);
    assert.match(content, /Specification Checklist/);
  });

  test(`${variant.name} prompt has REQUEST_DOC_PATH reference`, () => {
    const content = readFileSync(variant.path, 'utf8');
    assert.match(content, /REQUEST_DOC_PATH/);
  });

  test(`${variant.name} prompt has AC Coverage output section`, () => {
    const content = readFileSync(variant.path, 'utf8');
    assert.match(content, /AC Coverage/);
    assert.match(content, /Implemented.*Partial.*Missing/);
  });

  test(`${variant.name} prompt has DEFERRED_CONTEXT injection`, () => {
    const content = readFileSync(variant.path, 'utf8');
    assert.match(content, /DEFERRED_CONTEXT/);
  });

  test(`${variant.name} prompt SPEC_CHECKLIST is before research instructions`, () => {
    const content = readFileSync(variant.path, 'utf8');
    const specIdx = content.indexOf('Specification Checklist');
    const researchIdx = content.indexOf('independently research the project');
    assert.ok(specIdx > 0, 'Specification Checklist should exist');
    assert.ok(researchIdx > 0, 'Research instructions should exist');
    assert.ok(specIdx < researchIdx, 'Specification Checklist should appear before research instructions');
  });

  test(`${variant.name} prompt AC Coverage is before Merge Gate`, () => {
    const content = readFileSync(variant.path, 'utf8');
    const acIdx = content.indexOf('AC Coverage');
    const gateIdx = content.indexOf('Merge Gate');
    assert.ok(acIdx > 0, 'AC Coverage should exist');
    assert.ok(gateIdx > 0, 'Merge Gate should exist');
    assert.ok(acIdx < gateIdx, 'AC Coverage should appear before Merge Gate');
  });

  test(`${variant.name} prompt DEFERRED_CONTEXT is before Review Dimensions`, () => {
    const content = readFileSync(variant.path, 'utf8');
    const deferredIdx = content.indexOf('DEFERRED_CONTEXT');
    const dimIdx = content.indexOf('Review Dimensions');
    assert.ok(dimIdx > 0, 'Review Dimensions should exist');
    assert.ok(deferredIdx < dimIdx, 'DEFERRED_CONTEXT should appear before Review Dimensions');
  });
}

// --- review-common.md: AC Coverage Format ---

test('review-common.md has AC Coverage Format section', () => {
  const content = readFileSync(reviewCommonPath, 'utf8');
  assert.match(content, /AC Coverage Format.*Spec-Driven Review/);
});

test('review-common.md AC Coverage has status definitions', () => {
  const content = readFileSync(reviewCommonPath, 'utf8');
  assert.match(content, /Implemented/);
  assert.match(content, /Partial/);
  assert.match(content, /Missing/);
  assert.match(content, /not applicable/i);
});

test('review-common.md AC Coverage has omission conditions', () => {
  const content = readFileSync(reviewCommonPath, 'utf8');
  assert.match(content, /Omitted when.*No feature detected/i);
});

// --- Graceful degradation: null handling ---

test('all prompt templates use conditional injection (not unconditional)', () => {
  for (const variant of promptVariants) {
    const content = readFileSync(variant.path, 'utf8');
    // SPEC_CHECKLIST uses ternary
    assert.match(content, /SPEC_CHECKLIST \? [`'"]/, `${variant.name}: SPEC_CHECKLIST should use conditional`);
    // DEFERRED_CONTEXT uses ternary
    assert.match(content, /DEFERRED_CONTEXT \?/, `${variant.name}: DEFERRED_CONTEXT should use conditional`);
  }
});
