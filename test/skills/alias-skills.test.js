const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, existsSync } = require('node:fs');
const { resolve, join } = require('node:path');

const skillsDir = resolve(__dirname, '../../skills');

/**
 * B1 thin alias skills must reference their parent skill.
 * This table defines the expected parent for each alias.
 */
const ALIAS_MAP = {
  'codex-review-fast': 'codex-code-review',
  'codex-review': 'codex-code-review',
  'codex-review-branch': 'codex-code-review',
  'codex-review-doc': 'doc-review',
  'codex-security': 'security-review',
  'codex-test-review': 'test-review',
  'codex-test-gen': 'test-review',
};

test('B1 alias skills reference their correct parent skill', () => {
  for (const [alias, parent] of Object.entries(ALIAS_MAP)) {
    const skillPath = join(skillsDir, alias, 'SKILL.md');
    assert.ok(
      existsSync(skillPath),
      `alias skill skills/${alias}/SKILL.md does not exist`
    );

    const content = readFileSync(skillPath, 'utf8');

    // Must include @skills/<parent>/SKILL.md cross-reference (strict)
    assert.ok(
      content.includes(`@skills/${parent}/SKILL.md`),
      `skills/${alias}/SKILL.md must contain "@skills/${parent}/SKILL.md" cross-reference`
    );
  }
});

test('B1 alias skill frontmatter has correct name', () => {
  for (const alias of Object.keys(ALIAS_MAP)) {
    const skillPath = join(skillsDir, alias, 'SKILL.md');
    if (!existsSync(skillPath)) continue;

    const content = readFileSync(skillPath, 'utf8');
    const nameMatch = content.match(/^name:\s*(.+)\s*$/m);

    assert.ok(nameMatch, `skills/${alias}/SKILL.md missing name in frontmatter`);
    assert.strictEqual(
      nameMatch[1].trim(),
      alias,
      `skills/${alias}/SKILL.md name "${nameMatch[1].trim()}" does not match directory "${alias}"`
    );
  }
});

test('parent skills exist for all aliases', () => {
  const parents = [...new Set(Object.values(ALIAS_MAP))];

  for (const parent of parents) {
    const parentPath = join(skillsDir, parent, 'SKILL.md');
    assert.ok(
      existsSync(parentPath),
      `parent skill skills/${parent}/SKILL.md does not exist`
    );
  }
});
