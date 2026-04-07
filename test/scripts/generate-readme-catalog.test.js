const { test } = require('node:test');
const assert = require('node:assert/strict');
const { resolve, join } = require('node:path');
const { readFileSync, existsSync, readdirSync, statSync } = require('node:fs');
const { execFileSync } = require('node:child_process');

const ROOT = resolve(__dirname, '../..');
const CATALOG_PATH = join(ROOT, 'docs', 'skill-catalog.yml');
const README_PATH = join(ROOT, 'README.md');
const SKILLS_DIR = join(ROOT, 'skills');
const GENERATOR_PATH = join(ROOT, 'scripts', 'generate-readme-catalog.js');

// ── Catalog validation ──────────────────────────────────

test('skill-catalog.yml exists and is readable', () => {
  assert.ok(existsSync(CATALOG_PATH), 'docs/skill-catalog.yml should exist');
  const content = readFileSync(CATALOG_PATH, 'utf8');
  assert.ok(content.includes('version:'), 'should have version field');
  assert.ok(content.includes('categories:'), 'should have categories section');
  assert.ok(content.includes('skills:'), 'should have skills section');
});

test('all skills/ directories have catalog entries', () => {
  const skillDirs = readdirSync(SKILLS_DIR)
    .filter(d => statSync(join(SKILLS_DIR, d)).isDirectory());
  const catalog = readFileSync(CATALOG_PATH, 'utf8');
  // Extract exact command names from catalog for precise matching
  const catalogCommands = new Set(
    [...catalog.matchAll(/command:\s*\/(\S+)/g)].map(m => m[1])
  );

  const missing = skillDirs.filter(dir => !catalogCommands.has(dir));
  assert.deepEqual(
    missing,
    [],
    `skills/ directories missing from catalog: ${missing.join(', ')}`
  );
});

test('all catalog entries have matching skills/ directories', () => {
  const skillDirs = new Set(
    readdirSync(SKILLS_DIR).filter(d => statSync(join(SKILLS_DIR, d)).isDirectory())
  );
  const catalog = readFileSync(CATALOG_PATH, 'utf8');
  const commands = [...catalog.matchAll(/command:\s*\/(\S+)/g)].map(m => m[1]);

  const orphaned = commands.filter(cmd => !skillDirs.has(cmd));
  assert.deepEqual(
    orphaned,
    [],
    `catalog entries without skills/ directory: ${orphaned.join(', ')}`
  );
});

test('all catalog entries have valid category', () => {
  const catalog = readFileSync(CATALOG_PATH, 'utf8');
  // Extract category IDs from the categories section (before skills section)
  const categoriesSection = catalog.split('skills:')[0];
  const categoryIds = [...categoriesSection.matchAll(/id:\s*(\S+)/g)].map(m => m[1]);
  const validCategories = new Set(categoryIds);

  // Extract skill categories from the skills section
  const skillsSection = catalog.split('skills:')[1] || '';
  const skillCategories = [...skillsSection.matchAll(/category:\s*(\S+)/g)].map(m => m[1]);
  const invalid = skillCategories.filter(c => !validCategories.has(c));
  assert.deepEqual(
    invalid,
    [],
    `invalid categories found: ${[...new Set(invalid)].join(', ')}`
  );
});

test('featured skills have use_when field', () => {
  const catalog = readFileSync(CATALOG_PATH, 'utf8');
  const entries = catalog.split(/\n\s{2}- command:/);
  const missing = [];
  for (const entry of entries.slice(1)) {
    const cmd = entry.match(/^\s*\/(\S+)/);
    const featured = entry.includes('featured: true');
    const hasUseWhen = entry.includes('use_when:');
    if (featured && !hasUseWhen && cmd) {
      missing.push(`/${cmd[1]}`);
    }
  }
  assert.deepEqual(
    missing,
    [],
    `featured skills missing use_when: ${missing.join(', ')}`
  );
});

test('featured skill count is 12-15', () => {
  const catalog = readFileSync(CATALOG_PATH, 'utf8');
  const count = (catalog.match(/featured: true/g) || []).length;
  assert.ok(count >= 12 && count <= 15, `expected 12-15 featured, got ${count}`);
});

// ── README marker tests ─────────────────────────────────

test('README.md has all 5 BEGIN/END marker pairs', () => {
  const readme = readFileSync(README_PATH, 'utf8');
  const markers = [
    'HERO-COUNT',
    'WHATS-INCLUDED-COUNT',
    'INSTALL-COVERAGE',
    'ESSENTIAL-SKILLS',
    'FULL-CATALOG',
  ];
  for (const m of markers) {
    assert.ok(
      readme.includes(`<!-- BEGIN:${m} -->`),
      `README should have BEGIN:${m} marker`
    );
    assert.ok(
      readme.includes(`<!-- END:${m} -->`),
      `README should have END:${m} marker`
    );
  }
});

test('no unmanaged skill count strings in README', () => {
  const readme = readFileSync(README_PATH, 'utf8');
  const cleaned = readme.replace(
    /<!-- BEGIN:\w[\w-]* -->[\s\S]*?<!-- END:\w[\w-]* -->/g,
    ''
  );
  const stale = cleaned.match(/\b\d+ skills\b/g);
  assert.equal(
    stale,
    null,
    `unmanaged skill count strings found: ${(stale || []).join(', ')}`
  );
});

// ── Generator tests ─────────────────────────────────────

test('generator is idempotent (--check exits 0)', () => {
  const result = execFileSync(
    'node',
    [GENERATOR_PATH, '--check'],
    { encoding: 'utf8', cwd: ROOT }
  );
  assert.ok(result.includes('up to date'), 'generator --check should report up to date');
});

test('README full catalog has Review category with Loop Support column', () => {
  const readme = readFileSync(README_PATH, 'utf8');
  assert.ok(
    readme.includes('| Loop Support |'),
    'Review category should have Loop Support column'
  );
});

test('README essential skills table uses Use when column', () => {
  const readme = readFileSync(README_PATH, 'utf8');
  const essentialMatch = readme.match(
    /<!-- BEGIN:ESSENTIAL-SKILLS -->([\s\S]*?)<!-- END:ESSENTIAL-SKILLS -->/
  );
  assert.ok(essentialMatch, 'Essential skills block should exist');
  assert.ok(
    essentialMatch[1].includes('| Use when |'),
    'Essential skills should have Use when column'
  );
});

test('README hero count matches summary count', () => {
  const readme = readFileSync(README_PATH, 'utf8');
  const heroMatch = readme.match(
    /<!-- BEGIN:HERO-COUNT -->\n(\d+) skills/
  );
  assert.ok(heroMatch, 'hero count should exist');
  const heroCount = parseInt(heroMatch[1], 10);

  const summaryMatch = readme.match(/All (\d+) skills/);
  assert.ok(summaryMatch, 'summary count should exist');
  const summaryCount = parseInt(summaryMatch[1], 10);

  assert.equal(heroCount, summaryCount, 'hero and summary counts should match');
});
