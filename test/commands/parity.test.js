const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readdirSync, existsSync } = require('node:fs');
const { resolve } = require('node:path');

const commandsDir = resolve(__dirname, '../../commands');
const skillsDir = resolve(__dirname, '../../skills');

// Phase A known gap: commands awaiting skill creation in Batch 4-5.
// Remove entries as skills are created. When empty, parity is achieved.
// Phase A complete: all 23 commands now have matching skills.
// Keep this set for future use if new commands are added before skills.
const PHASE_A_KNOWN_GAP = new Set([]);

function getCommandNames() {
  return readdirSync(commandsDir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => f.replace(/\.md$/, ''))
    .sort();
}

function getSkillNames() {
  return readdirSync(skillsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
}

test('every command has a same-name skill directory (excluding Phase A known gap)', () => {
  const commands = getCommandNames();
  const skills = new Set(getSkillNames());
  const missing = commands.filter((cmd) => !skills.has(cmd) && !PHASE_A_KNOWN_GAP.has(cmd));

  assert.deepStrictEqual(
    missing,
    [],
    `Unexpected gap: ${missing.length} command(s) without matching skill: ${missing.join(', ')}`
  );
});

test('Phase A known gap is shrinking (no false entries)', () => {
  const skills = new Set(getSkillNames());
  const resolved = [...PHASE_A_KNOWN_GAP].filter((cmd) => skills.has(cmd));

  assert.deepStrictEqual(
    resolved,
    [],
    `These are in PHASE_A_KNOWN_GAP but already have skills — remove from gap list: ${resolved.join(', ')}`
  );
});

// Note: "every skill directory has a SKILL.md" is already covered by
// skills-schema.test.js — no need to duplicate here.
