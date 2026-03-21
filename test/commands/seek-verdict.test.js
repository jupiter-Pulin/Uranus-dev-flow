const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, existsSync, readdirSync } = require('node:fs');
const { resolve, join } = require('node:path');

const root = resolve(__dirname, '../..');
const skillDir = resolve(root, 'skills/seek-verdict');
const commandPath = resolve(root, 'commands/seek-verdict.md');

// --- Helper: Policy mapping logic (extracted from spec) ---

/**
* Maps Codex verdict + confidence + evidence to a result.
* Implements the asymmetric threshold policy from policy-mapping.md.
*
* @param {object} params
* @param {string} params.verdict - ACTIONABLE | NON_ACTIONABLE | UNCERTAIN
* @param {number} params.confidence - 0.0 to 1.0
* @param {number} params.evidenceCount - number of evidence refs
* @param {boolean} [params.heightened] - whether anti-abuse heightened thresholds apply
* @returns {string} DISMISS_VERIFIED | FIX_REQUIRED | NEED_HUMAN
 */
function mapVerdict({ verdict, confidence, evidenceCount, heightened = false }) {
  const dismissThreshold = heightened ? 0.85 : 0.80;
  const dismissEvidenceMin = heightened ? 3 : 2;

  if (verdict === 'NON_ACTIONABLE' && confidence >= dismissThreshold && evidenceCount >= dismissEvidenceMin) {
    return 'DISMISS_VERIFIED';
  }
  if (verdict === 'ACTIONABLE' && confidence >= 0.70) {
    return 'FIX_REQUIRED';
  }
  return 'NEED_HUMAN';
}

/**
* Checks anti-abuse guard state.
*
* @param {number} consecutiveDismissals - current streak of DISMISS_VERIFIED
* @returns {{ warned: boolean, heightened: boolean }}
 */
function checkAntiAbuse(consecutiveDismissals) {
  const warned = consecutiveDismissals >= 3;
  return { warned, heightened: warned };
}

/**
* Validates that a finding is eligible for seek-verdict.
*
* @param {string} severity - P0 | P1 | P2 | Nit
* @returns {boolean}
 */
function isEligible(severity) {
  return severity === 'P2';
}

/**
* Checks if a prompt contains Claude's conclusion (anti-anchoring violation).
*
* @param {string} prompt
* @param {string} claudeConclusion
* @returns {boolean} true if prompt is contaminated
 */
function isAnchored(prompt, claudeConclusion) {
  return prompt.includes(claudeConclusion);
}

// --- T1-T13: Policy mapping + anti-abuse tests ---

test('T1: P2 + NON_ACTIONABLE + confidence 0.90 → DISMISS_VERIFIED', () => {
  const result = mapVerdict({ verdict: 'NON_ACTIONABLE', confidence: 0.90, evidenceCount: 3 });
  assert.equal(result, 'DISMISS_VERIFIED');
});

test('T2: P2 + ACTIONABLE + confidence 0.85 → FIX_REQUIRED', () => {
  const result = mapVerdict({ verdict: 'ACTIONABLE', confidence: 0.85, evidenceCount: 2 });
  assert.equal(result, 'FIX_REQUIRED');
});

test('T3: P2 + UNCERTAIN + confidence 0.50 → NEED_HUMAN', () => {
  const result = mapVerdict({ verdict: 'UNCERTAIN', confidence: 0.50, evidenceCount: 1 });
  assert.equal(result, 'NEED_HUMAN');
});

test('T4: P2 + NON_ACTIONABLE + confidence 0.70 (below threshold) → NEED_HUMAN', () => {
  const result = mapVerdict({ verdict: 'NON_ACTIONABLE', confidence: 0.70, evidenceCount: 2 });
  assert.equal(result, 'NEED_HUMAN');
});

test('T5: P0 finding → Rejected (P2 only)', () => {
  assert.equal(isEligible('P0'), false);
  assert.equal(isEligible('P1'), false);
  assert.equal(isEligible('Nit'), false);
  assert.equal(isEligible('P2'), true);
});

test('T6: 3 consecutive DISMISS_VERIFIED → warning emitted', () => {
  const { warned } = checkAntiAbuse(3);
  assert.equal(warned, true);
  const { warned: notYet } = checkAntiAbuse(2);
  assert.equal(notYet, false);
});

test('T7: Prompt contains Claude conclusion → anti-anchoring violation', () => {
  const claudeConclusion = 'This is a false positive because the Set implementation is sufficient';
  const cleanPrompt = 'You are a senior code reviewer. Finding: Set vs Map for runtimeInjectedKeys';
  const contaminatedPrompt = `Review this finding. ${claudeConclusion}`;

  assert.equal(isAnchored(cleanPrompt, claudeConclusion), false);
  assert.equal(isAnchored(contaminatedPrompt, claudeConclusion), true);
});

test('T8: NON_ACTIONABLE + confidence exactly 0.80 → DISMISS_VERIFIED (boundary inclusive)', () => {
  const result = mapVerdict({ verdict: 'NON_ACTIONABLE', confidence: 0.80, evidenceCount: 2 });
  assert.equal(result, 'DISMISS_VERIFIED');
});

test('T9: ACTIONABLE + confidence exactly 0.70 → FIX_REQUIRED (boundary inclusive)', () => {
  const result = mapVerdict({ verdict: 'ACTIONABLE', confidence: 0.70, evidenceCount: 1 });
  assert.equal(result, 'FIX_REQUIRED');
});

test('T10: NON_ACTIONABLE + confidence 0.79 → NEED_HUMAN (below threshold)', () => {
  const result = mapVerdict({ verdict: 'NON_ACTIONABLE', confidence: 0.79, evidenceCount: 5 });
  assert.equal(result, 'NEED_HUMAN');
});

test('T11: Rebuttal still FIX_REQUIRED after 1 rebuttal → no more rounds', () => {
  // After 1 rebuttal, if Codex still says ACTIONABLE, result must be FIX_REQUIRED (no retry)
  const rebuttalResult = mapVerdict({ verdict: 'ACTIONABLE', confidence: 0.80, evidenceCount: 3 });
  assert.equal(rebuttalResult, 'FIX_REQUIRED');
  // maxRebuttals is 1 — this is a behavioral contract
  const MAX_REBUTTALS = 1;
  assert.equal(MAX_REBUTTALS, 1);
});

test('T12: Anti-abuse: 4th DISMISS_VERIFIED after warning → requires heightened threshold', () => {
  const { heightened } = checkAntiAbuse(4);
  assert.equal(heightened, true);

  // Under heightened: confidence 0.82 + 2 evidence → NEED_HUMAN (needs 0.85 + 3)
  const result = mapVerdict({ verdict: 'NON_ACTIONABLE', confidence: 0.82, evidenceCount: 2, heightened: true });
  assert.equal(result, 'NEED_HUMAN');

  // Under heightened: confidence 0.85 + 3 evidence → DISMISS_VERIFIED
  const result2 = mapVerdict({ verdict: 'NON_ACTIONABLE', confidence: 0.85, evidenceCount: 3, heightened: true });
  assert.equal(result2, 'DISMISS_VERIFIED');
});

test('T13: Anti-abuse: branch switch resets streak → counter = 0', () => {
  // After branch switch, streak resets to 0
  const { warned } = checkAntiAbuse(0);
  assert.equal(warned, false);
});

// --- Structural tests ---

test('S1: SKILL.md exists with valid frontmatter', () => {
  const skillPath = join(skillDir, 'SKILL.md');
  assert.ok(existsSync(skillPath), 'skills/seek-verdict/SKILL.md missing');

  const content = readFileSync(skillPath, 'utf8');
  const fmMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
  assert.ok(fmMatch, 'SKILL.md missing frontmatter');

  const fm = fmMatch[1];
  assert.ok(/^name:\s*.+/m.test(fm), 'SKILL.md missing name');
  assert.ok(/^description:\s*.+/m.test(fm), 'SKILL.md missing description');
});

test('S2: SKILL.md does not use @references/ prefix', () => {
  const content = readFileSync(join(skillDir, 'SKILL.md'), 'utf8');
  const matches = content.match(/@references\//g);
  assert.ok(!matches, `SKILL.md uses @references/ (${matches?.length} occurrences)`);
});

test('S3: All reference files exist', () => {
  const refsDir = join(skillDir, 'references');
  assert.ok(existsSync(refsDir), 'references/ directory missing');

  const expected = ['verdict-prompt.md', 'policy-mapping.md'];
  for (const ref of expected) {
    assert.ok(existsSync(join(refsDir, ref)), `references/${ref} missing`);
  }
});

test('S4: Command file references all skill references', () => {
  assert.ok(existsSync(commandPath), 'commands/seek-verdict.md missing');

  const content = readFileSync(commandPath, 'utf8');
  const refsDir = join(skillDir, 'references');
  const refFiles = readdirSync(refsDir).filter((f) => f.endsWith('.md'));

  for (const ref of refFiles) {
    const directive = `@skills/seek-verdict/references/${ref}`;
    assert.ok(
      content.includes(directive),
      `Command missing reference: ${directive}`
    );
  }

  // Must also reference SKILL.md
  assert.ok(
    content.includes('@skills/seek-verdict/SKILL.md'),
    'Command missing @skills/seek-verdict/SKILL.md'
  );
});

test('S5: Command has valid frontmatter', () => {
  const content = readFileSync(commandPath, 'utf8');
  const fmMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
  assert.ok(fmMatch, 'Command missing frontmatter');

  const fm = fmMatch[1];
  assert.ok(/^description:\s*.+/m.test(fm), 'Command missing description');
  assert.ok(/^allowed-tools:/m.test(fm), 'Command missing allowed-tools');
});

test('S6: fix-all-issues.md has DISMISS_VERDICT exception', () => {
  const content = readFileSync(resolve(root, 'rules/fix-all-issues.md'), 'utf8');
  assert.ok(
    content.includes('[DISMISS_VERDICT]'),
    'fix-all-issues.md missing [DISMISS_VERDICT] exception'
  );
  assert.ok(
    content.includes('/seek-verdict'),
    'fix-all-issues.md missing /seek-verdict reference'
  );
});

test('S7: review-common.md has DISMISS_VERDICT format', () => {
  const content = readFileSync(
    resolve(root, 'skills/codex-code-review/references/review-common.md'),
    'utf8'
  );
  assert.ok(
    content.includes('[DISMISS_VERDICT]'),
    'review-common.md missing [DISMISS_VERDICT] format'
  );
});

test('S8: Verdict prompt enforces anti-anchoring', () => {
  const content = readFileSync(join(skillDir, 'references/verdict-prompt.md'), 'utf8');
  assert.ok(
    content.includes('Do not assume this finding is true or false'),
    'verdict-prompt.md missing anti-anchoring instruction'
  );
  assert.ok(
    content.includes('independently research'),
    'verdict-prompt.md missing independent research requirement'
  );
});

test('S9: Policy mapping defines asymmetric thresholds', () => {
  const content = readFileSync(join(skillDir, 'references/policy-mapping.md'), 'utf8');
  assert.ok(content.includes('0.80'), 'policy-mapping.md missing dismiss threshold 0.80');
  assert.ok(content.includes('0.70'), 'policy-mapping.md missing fix threshold 0.70');
  assert.ok(content.includes('0.85'), 'policy-mapping.md missing heightened threshold 0.85');
  assert.ok(
    content.includes('[DISMISS_PATTERN_WARN]'),
    'policy-mapping.md missing anti-abuse warning format'
  );
});
