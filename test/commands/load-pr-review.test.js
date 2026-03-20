const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const root = resolve(__dirname, '../..');
const skillPath = resolve(root, 'skills/load-pr-review/SKILL.md');
const commandPath = resolve(root, 'commands/load-pr-review.md');
const verdictTemplatePath = resolve(root, 'skills/load-pr-review/references/verdict-triage-prompt.md');

const skillContent = readFileSync(skillPath, 'utf-8');
const commandContent = readFileSync(commandPath, 'utf-8');
const verdictTemplateContent = readFileSync(verdictTemplatePath, 'utf-8');

// --- V1: SKILL.md has Non-Negotiable Rules section ---
test('V1 SKILL.md has Non-Negotiable Rules section', () => {
  assert.ok(
    skillContent.includes('Non-Negotiable Rules'),
    'SKILL.md must contain Non-Negotiable Rules section'
  );
});

// --- V2: Step 2 has MANDATORY marker ---
test('V2 Step 2 has MANDATORY marker', () => {
  assert.match(
    skillContent,
    /Step 2.*MANDATORY/,
    'Step 2 heading must include MANDATORY marker'
  );
});

// --- V3: Has "Declaring = Executing" principle ---
test('V3 has Declaring = Executing enforcement principle', () => {
  assert.ok(
    skillContent.includes('Declaring') && skillContent.includes('Executing'),
    'SKILL.md must contain Declaring/Executing enforcement principle'
  );
});

// --- V4: Has GATE marker between verdict and present ---
test('V4 has GATE marker between Step 2 and Step 3', () => {
  assert.match(
    skillContent,
    /GATE.*Verdict Complete/,
    'SKILL.md must contain GATE: Verdict Complete marker'
  );
});

// --- V5: Plan output has mandatory Codex Verdict Threads field ---
test('V5 plan output has mandatory Codex Verdict Threads field', () => {
  assert.ok(
    skillContent.includes('Codex Verdict Threads'),
    'SKILL.md must contain mandatory Codex Verdict Threads output field'
  );
  assert.ok(
    skillContent.includes('MANDATORY'),
    'Codex Verdict Threads must be marked as MANDATORY'
  );
});

// --- V6: Prohibited behaviors includes verdict skipping ---
test('V6 prohibited behaviors includes seek-verdict skipping', () => {
  assert.ok(
    skillContent.includes('Skipping `/seek-verdict`'),
    'Prohibited behaviors must include skipping /seek-verdict'
  );
});

// --- V7: Correct pattern shows Skill tool invocation ---
test('V7 correct pattern shows Skill tool invocation', () => {
  assert.ok(
    skillContent.includes('Skill tool: /seek-verdict'),
    'Correct pattern must show actual Skill tool: /seek-verdict invocation'
  );
});

// --- V8: Incorrect pattern shows Claude-only classification ---
test('V8 incorrect pattern shows Claude classifying without Codex', () => {
  assert.ok(
    skillContent.includes('Claude classifying without Codex'),
    'Incorrect pattern must show Claude classifying without Codex as prohibited'
  );
});

// --- V9: verdict-triage-prompt.md has enforcement header ---
test('V9 verdict-triage-prompt.md has Step 2 mandatory enforcement', () => {
  assert.ok(
    verdictTemplateContent.includes('Step 2 is mandatory'),
    'verdict-triage-prompt.md must state Step 2 is mandatory'
  );
});

// --- V10: Command file has MUST marker on Verdict Triage ---
test('V10 command file has MUST execute marker on Verdict Triage', () => {
  assert.ok(
    commandContent.includes('Verdict Triage'),
    'Command file must reference Verdict Triage step'
  );
  assert.ok(
    commandContent.includes('MUST execute'),
    'Command file must include MUST execute marker'
  );
});

// --- S1: SKILL.md exists with valid frontmatter ---
test('S1 SKILL.md has valid frontmatter with name and description', () => {
  assert.match(skillContent, /^---\n/, 'SKILL.md must start with frontmatter');
  assert.ok(skillContent.includes('name: load-pr-review'), 'frontmatter must have name');
  assert.ok(skillContent.includes('description:'), 'frontmatter must have description');
});

// --- S2: --no-verdict escape hatch documented ---
test('S2 --no-verdict escape hatch is documented', () => {
  assert.ok(
    skillContent.includes('--no-verdict'),
    'SKILL.md must document --no-verdict flag'
  );
  assert.ok(
    commandContent.includes('--no-verdict'),
    'Command file must document --no-verdict flag'
  );
});

// --- S3: Step numbering is sequential (0, 1, 2, GATE, 3, 4) ---
test('S3 step numbering uses integers (no Step 1.5)', () => {
  assert.ok(
    !skillContent.includes('Step 1.5'),
    'SKILL.md must not contain Step 1.5 (renamed to Step 2)'
  );
  assert.ok(skillContent.includes('## Step 0:'), 'Must have Step 0');
  assert.ok(skillContent.includes('## Step 1:'), 'Must have Step 1');
  assert.ok(skillContent.includes('## Step 2:'), 'Must have Step 2');
  assert.ok(skillContent.includes('## Step 3:'), 'Must have Step 3');
  assert.ok(skillContent.includes('## Step 4:'), 'Must have Step 4');
});
