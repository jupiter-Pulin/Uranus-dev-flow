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

    // Match @references/xxx.md and references/xxx.md (backtick-quoted or plain)
    const refPattern = /`?@?references\/([^`\s)]+\.md)`?/g;
    let match;
    while ((match = refPattern.exec(content)) !== null) {
      const refFile = join(skillsDir, dir, 'references', match[1]);
      assert.ok(
        existsSync(refFile),
        `skills/${dir}/SKILL.md references "references/${match[1]}" but file does not exist`
      );
    }
  }
});

test('command @skills/ references point to existing files', () => {
  const commandsDir = resolve(__dirname, '../../commands');
  const projectRoot = resolve(__dirname, '../..');

  const files = readdirSync(commandsDir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => join(commandsDir, f));

  for (const file of files) {
    const content = readFileSync(file, 'utf8');

    // Match @skills/xxx/yyy.md patterns
    const skillRefPattern = /@skills\/([^\s)]+\.md)/g;
    let match;
    while ((match = skillRefPattern.exec(content)) !== null) {
      const refFile = join(projectRoot, 'skills', match[1]);
      assert.ok(
        existsSync(refFile),
        `${file} references "@skills/${match[1]}" but file does not exist`
      );
    }

    // Match @skills/xxx (directory references, no extension)
    const skillDirPattern = /@skills\/([a-z0-9-]+)(?:\s|$)/g;
    while ((match = skillDirPattern.exec(content)) !== null) {
      const refDir = join(projectRoot, 'skills', match[1]);
      assert.ok(
        existsSync(refDir),
        `${file} references "@skills/${match[1]}" but directory does not exist`
      );
    }
  }
});

test('no command uses dead skills: frontmatter field', () => {
  const commandsDir = resolve(__dirname, '../../commands');
  const files = readdirSync(commandsDir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => join(commandsDir, f));

  for (const file of files) {
    const content = readFileSync(file, 'utf8');
    const { frontmatter } = splitFrontmatter(content);
    if (!frontmatter) continue;

    const hasSkillsFm = /^skills:\s/m.test(frontmatter);
    assert.ok(
      !hasSkillsFm,
      `${file} has dead "skills:" frontmatter — use @skills/ body reference instead`
    );
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

test('commands preload all reference files for their bound skills', () => {
  const commandsDir = resolve(__dirname, '../../commands');
  const commandFiles = readdirSync(commandsDir).filter((f) => f.endsWith('.md'));

  for (const file of commandFiles) {
    const content = readFileSync(join(commandsDir, file), 'utf8');

    // Find the skill this command binds to
    const skillMatch = content.match(/@skills\/([^/]+)\/SKILL\.md/);
    if (!skillMatch) continue; // Skip commands without skill binding

    const skillName = skillMatch[1];
    const refsDir = join(skillsDir, skillName, 'references');
    if (!existsSync(refsDir)) continue;

    // List all reference files for this skill
    const refFiles = readdirSync(refsDir).filter((f) => f.endsWith('.md'));

    // Every reference file must be preloaded by the command
    for (const ref of refFiles) {
      const directive = `@skills/${skillName}/references/${ref}`;
      assert.ok(
        content.includes(directive),
        `${file} binds skill "${skillName}" but does not preload "${ref}". ` +
          `Add: ${directive}`
      );
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
