const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readdirSync, readFileSync, existsSync } = require('node:fs');
const { join, resolve } = require('node:path');

const skillsDir = resolve(__dirname, '../../skills');

function splitFrontmatter(content) {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n?/);
  if (!match) return { frontmatter: '', body: content };
  return {
    frontmatter: match[1],
    body: content.slice(match[0].length),
  };
}

function getSkillDirs() {
  return readdirSync(skillsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
}

test('every skill directory has a SKILL.md with valid frontmatter', () => {
  const dirs = getSkillDirs();
  assert.ok(dirs.length >= 20, `expected >= 20 skills, found ${dirs.length}`);

  for (const dir of dirs) {
    const skillPath = join(skillsDir, dir, 'SKILL.md');
    assert.ok(
      existsSync(skillPath),
      `skills/${dir}/ missing SKILL.md`
    );

    const content = readFileSync(skillPath, 'utf8');
    const { frontmatter } = splitFrontmatter(content);

    assert.ok(frontmatter, `skills/${dir}/SKILL.md missing frontmatter block`);

    const nameMatch = frontmatter.match(/^name:\s*(.+)\s*$/m);
    assert.ok(
      nameMatch && nameMatch[1].trim(),
      `skills/${dir}/SKILL.md missing name in frontmatter`
    );

    const descMatch = frontmatter.match(/^description:\s*(.+)\s*$/m);
    assert.ok(
      descMatch && descMatch[1].trim(),
      `skills/${dir}/SKILL.md missing description in frontmatter`
    );
  }
});

test('SKILL.md local references point to existing files', () => {
  const dirs = getSkillDirs();

  for (const dir of dirs) {
    const skillPath = join(skillsDir, dir, 'SKILL.md');
    if (!existsSync(skillPath)) continue;

    const content = readFileSync(skillPath, 'utf8');

    // Match references/xxx.md patterns: plain, @-prefixed, ./-prefixed, backtick-quoted
    // Group 1 captures cross-skill prefix (@skills/<name>/) — skip when present
    const refPattern = /`?(@skills\/[^/]+\/)?@?(?:\.\/)?references\/([^`\s)]+\.md)`?/g;
    let match;
    while ((match = refPattern.exec(content)) !== null) {
      if (match[1]) continue; // cross-skill reference — not local

      const refFile = join(skillsDir, dir, 'references', match[2]);
      assert.ok(
        existsSync(refFile),
        `skills/${dir}/SKILL.md references "references/${match[2]}" but file does not exist`
      );
    }
  }
});

test('hooks.json references point to existing hook scripts', () => {
  const hooksJsonPath = resolve(__dirname, '../../hooks/hooks.json');
  if (!existsSync(hooksJsonPath)) return;

  const hooksConfig = JSON.parse(readFileSync(hooksJsonPath, 'utf8'));
  const hooksDir = resolve(__dirname, '../../hooks');

  for (const [event, entries] of Object.entries(hooksConfig.hooks || {})) {
    for (const entry of entries) {
      for (const hook of entry.hooks || []) {
        if (hook.command) {
          // Extract script filename from ${CLAUDE_PLUGIN_ROOT}/hooks/<script>
          const scriptMatch = hook.command.match(/\/hooks\/([^/]+)$/);
          if (scriptMatch) {
            const scriptPath = join(hooksDir, scriptMatch[1]);
            assert.ok(
              existsSync(scriptPath),
              `hooks.json ${event} references "${scriptMatch[1]}" but file does not exist in hooks/`
            );
          }
        }
      }
    }
  }
});

test('skills with references/ directory have at least one .md file', () => {
  const dirs = getSkillDirs();

  for (const dir of dirs) {
    const refsDir = join(skillsDir, dir, 'references');
    if (!existsSync(refsDir)) continue;

    const refFiles = readdirSync(refsDir, { recursive: true }).filter((f) => String(f).endsWith('.md'));

    // If SKILL.md mentions @references/, the directory must not be empty
    const skillPath = join(skillsDir, dir, 'SKILL.md');
    if (existsSync(skillPath)) {
      const content = readFileSync(skillPath, 'utf8');
      if (/@?references\//.test(content)) {
        assert.ok(
          refFiles.length > 0,
          `skills/${dir}/references/ is empty but SKILL.md references it`
        );
      }
    }
  }
});

test('SKILL.md uses consistent reference syntax (no @references/ prefix)', () => {
  const dirs = getSkillDirs();

  for (const dir of dirs) {
    const skillPath = join(skillsDir, dir, 'SKILL.md');
    if (!existsSync(skillPath)) continue;

    const content = readFileSync(skillPath, 'utf8');

    // Forbid @references/ prefix (avoid confusion with command @skills/ directives)
    const atRefPattern = /@references\//g;
    const matches = content.match(atRefPattern);
    assert.ok(
      !matches,
      `skills/${dir}/SKILL.md uses @references/ syntax (${matches?.length} occurrences). ` +
        'Use `references/<file>.md` instead.'
    );
  }
});

test('SKILL.md reference mentions include references/ path prefix', () => {
  const dirs = getSkillDirs();

  for (const dir of dirs) {
    const skillPath = join(skillsDir, dir, 'SKILL.md');
    if (!existsSync(skillPath)) continue;

    const content = readFileSync(skillPath, 'utf8');
    const refsDir = join(skillsDir, dir, 'references');
    if (!existsSync(refsDir)) continue;

    const refFiles = readdirSync(refsDir).filter((f) => f.endsWith('.md'));

    // Strip References table section (bare filenames allowed as human-readable list)
    const bodyContent = content.replace(/## References[\s\S]*?(?=\n## |$)/g, '');

    for (const ref of refFiles) {
      const escaped = ref.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // Remove valid patterns:
      // 1. Markdown links where URL points to references/<file>.md (with optional ./ prefix and #fragment)
      let cleaned = bodyContent.replace(
        new RegExp(`\\[[^\\]]*\\]\\(\\.?\\/?\\.?\\/?references/${escaped}[^)]*\\)`, 'g'),
        ''
      );
      // 2. Inline references/<file>.md mentions (with optional ./ prefix)
      cleaned = cleaned.replace(
        new RegExp(`\\.?\\/?\\.?\\/?references/${escaped}`, 'g'),
        ''
      );
      const barePattern = new RegExp(`\\b${escaped}\\b`, 'g');
      const bareMatches = cleaned.match(barePattern) || [];

      assert.ok(
        bareMatches.length === 0,
        `skills/${dir}/SKILL.md has bare reference to "${ref}" without "references/" prefix`
      );
    }
  }
});
