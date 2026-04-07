const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readdirSync, readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const root = resolve(__dirname, '../..');
const skillsDir = resolve(root, 'skills');
const templatePath = resolve(root, 'CLAUDE.template.md');
const claudeMdPath = resolve(root, 'CLAUDE.md');

/**
* Extract the Command Quick Reference section from markdown content.
 */
function extractCommandSection(content) {
  const start = content.indexOf('## Command Quick Reference');
  if (start === -1) return '';
  const rest = content.slice(start);
  const nextSection = rest.indexOf('\n## ', 1);
  return nextSection === -1 ? rest : rest.slice(0, nextSection);
}

/**
* Extract command names from a CLAUDE.md-style Command Quick Reference table.
* Returns an array (preserving duplicates for detection).
* Matches rows like: | `/some-command` | description | when |
 */
function extractTableCommands(content) {
  const section = extractCommandSection(content);
  const commands = [];
  const re = /^\|\s*`\/([^`]+)`\s*\|/gm;
  let m;
  while ((m = re.exec(section)) !== null) {
    commands.push(m[1]);
  }
  return commands;
}

/**
* Get all skill directory names from skills/ dir.
 */
function getSkillDirs() {
  return readdirSync(skillsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
}

// Parent/internal skills that are invoked by alias skills, not directly via slash-command.
// These don't need entries in the Command Quick Reference table.
const INTERNAL_SKILLS = new Set([
  'codex-code-review', 'doc-review', 'security-review', 'test-review',
  'portfolio', 'request-tracking', 'req-analyze', 'dev-security-audit',
  'readme-i18n-sync', // local-only skill, not committed to repo
]);

test('every skill directory is listed in CLAUDE.template.md', () => {
  const templateContent = readFileSync(templatePath, 'utf8');
  const tableCommands = new Set(extractTableCommands(templateContent));
  const skills = getSkillDirs();

  const missing = skills.filter((skill) => !tableCommands.has(skill) && !INTERNAL_SKILLS.has(skill));
  assert.deepStrictEqual(
    missing,
    [],
    `skills/ directories missing from CLAUDE.template.md table: ${missing.join(', ')}`
  );
});

test('every CLAUDE.template.md table entry has a skills/<dir>/ directory', () => {
  const templateContent = readFileSync(templatePath, 'utf8');
  const tableCommands = extractTableCommands(templateContent);
  const fileSkills = new Set(getSkillDirs());

  const orphaned = tableCommands.filter((cmd) => !fileSkills.has(cmd));
  assert.deepStrictEqual(
    orphaned,
    [],
    `CLAUDE.template.md table entries without skills/ directory: ${orphaned.join(', ')}`
  );
});

test('no duplicate commands in CLAUDE.template.md table', () => {
  const templateContent = readFileSync(templatePath, 'utf8');
  const tableCommands = extractTableCommands(templateContent);
  const seen = new Set();
  const duplicates = [];
  for (const cmd of tableCommands) {
    if (seen.has(cmd)) duplicates.push(cmd);
    seen.add(cmd);
  }
  assert.deepStrictEqual(
    duplicates,
    [],
    `Duplicate commands in CLAUDE.template.md: ${duplicates.join(', ')}`
  );
});

test('CLAUDE.md table matches CLAUDE.template.md table', () => {
  const templateContent = readFileSync(templatePath, 'utf8');
  const claudeContent = readFileSync(claudeMdPath, 'utf8');

  const templateCommands = [...extractTableCommands(templateContent)].sort();
  const claudeCommands = [...extractTableCommands(claudeContent)].sort();

  assert.deepStrictEqual(
    claudeCommands,
    templateCommands,
    `CLAUDE.md and CLAUDE.template.md command tables differ.\n` +
      `Only in template: ${templateCommands.filter((c) => !claudeCommands.includes(c)).join(', ') || 'none'}\n` +
      `Only in CLAUDE.md: ${claudeCommands.filter((c) => !templateCommands.includes(c)).join(', ') || 'none'}`
  );
});
