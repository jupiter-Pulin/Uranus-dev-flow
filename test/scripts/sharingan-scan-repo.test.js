const { test } = require('node:test');
const assert = require('node:assert/strict');
const { resolve } = require('node:path');
const { mkdtempSync, mkdirSync, writeFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');

const scanRepo = require(resolve(__dirname, '../../skills/sharingan/scripts/scan-repo.js'));

// ═══════════════════════════════════════════════
// Group 1: URL Validation (7 tests)
// ═══════════════════════════════════════════════

test('validateGitHubUrl — valid URL returns owner and repo', () => {
  const r = scanRepo.validateGitHubUrl('https://github.com/anthropics/skills');
  assert.equal(r.valid, true);
  assert.equal(r.owner, 'anthropics');
  assert.equal(r.repo, 'skills');
});

test('validateGitHubUrl — valid URL with trailing slash', () => {
  const r = scanRepo.validateGitHubUrl('https://github.com/owner/repo/');
  assert.equal(r.valid, true);
  assert.equal(r.owner, 'owner');
});

test('validateGitHubUrl — rejects non-GitHub URL', () => {
  const r = scanRepo.validateGitHubUrl('https://gitlab.com/owner/repo');
  assert.equal(r.valid, false);
});

test('validateGitHubUrl — rejects URL without repo', () => {
  const r = scanRepo.validateGitHubUrl('https://github.com/owner');
  assert.equal(r.valid, false);
});

test('validateGitHubUrl — rejects SSH URL', () => {
  const r = scanRepo.validateGitHubUrl('git@github.com:owner/repo.git');
  assert.equal(r.valid, false);
});

test('validateGitHubUrl — rejects empty string', () => {
  const r = scanRepo.validateGitHubUrl('');
  assert.equal(r.valid, false);
});

test('validateGitHubUrl — rejects null/undefined', () => {
  assert.equal(scanRepo.validateGitHubUrl(null).valid, false);
  assert.equal(scanRepo.validateGitHubUrl(undefined).valid, false);
});

// ═══════════════════════════════════════════════
// Group 2: Target Directory Validation (4 tests)
// ═══════════════════════════════════════════════

const tempDirs = [];
function makeTempDir() {
  const d = mkdtempSync(resolve(tmpdir(), 'sharingan-test-'));
  tempDirs.push(d);
  return d;
}

test('validateTargetDir — valid relative path within project', () => {
  const root = makeTempDir();
  mkdirSync(resolve(root, 'skills'), { recursive: true });
  const r = scanRepo.validateTargetDir('skills/', root);
  assert.equal(r.valid, true);
});

test('validateTargetDir — rejects absolute path', () => {
  const root = makeTempDir();
  const r = scanRepo.validateTargetDir('/tmp/evil', root);
  assert.equal(r.valid, false);
});

test('validateTargetDir — rejects path traversal', () => {
  const root = makeTempDir();
  const r = scanRepo.validateTargetDir('../../../etc', root);
  assert.equal(r.valid, false);
});

test('validateTargetDir — valid nested dir within project', () => {
  const root = makeTempDir();
  mkdirSync(resolve(root, 'skills', 'sharingan', 'output'), { recursive: true });
  const r = scanRepo.validateTargetDir('skills/sharingan/output', root);
  assert.equal(r.valid, true);
});

// ═══════════════════════════════════════════════
// Group 3: Repo Classification (5 tests)
// ═══════════════════════════════════════════════

test('classifyRepo — detects plugin type', () => {
  const tree = [
    { path: '.claude-plugin/plugin.json', type: 'blob', size: 200 },
    { path: 'skills/foo/SKILL.md', type: 'blob', size: 500 },
  ];
  assert.equal(scanRepo.classifyRepo(tree), 'plugin');
});

test('classifyRepo — detects collection type', () => {
  const tree = [
    { path: 'skills/foo/SKILL.md', type: 'blob', size: 500 },
    { path: 'skills/bar/SKILL.md', type: 'blob', size: 300 },
  ];
  assert.equal(scanRepo.classifyRepo(tree), 'collection');
});

test('classifyRepo — detects single skill type', () => {
  const tree = [
    { path: 'SKILL.md', type: 'blob', size: 500 },
    { path: 'references/guide.md', type: 'blob', size: 200 },
  ];
  assert.equal(scanRepo.classifyRepo(tree), 'single');
});

test('classifyRepo — returns unknown for non-skill repo', () => {
  const tree = [
    { path: 'src/index.js', type: 'blob', size: 1000 },
    { path: 'package.json', type: 'blob', size: 200 },
  ];
  assert.equal(scanRepo.classifyRepo(tree), 'unknown');
});

test('classifyRepo — plugin takes priority over collection', () => {
  const tree = [
    { path: '.claude-plugin/plugin.json', type: 'blob', size: 200 },
    { path: 'skills/foo/SKILL.md', type: 'blob', size: 500 },
  ];
  assert.equal(scanRepo.classifyRepo(tree), 'plugin');
});

// ═══════════════════════════════════════════════
// Group 4: Dependency Graph (5 tests)
// ═══════════════════════════════════════════════

test('buildDependencyGraph — no deps produces all leaves', () => {
  const skills = [
    { name: 'a', dependencies: { skills: [], rules: [], tools: [], mcp_servers: [] } },
    { name: 'b', dependencies: { skills: [], rules: [], tools: [], mcp_servers: [] } },
    { name: 'c', dependencies: { skills: [], rules: [], tools: [], mcp_servers: [] } },
  ];
  const g = scanRepo.buildDependencyGraph(skills);
  assert.equal(g.leafSkills.length, 3);
  assert.equal(g.edges.length, 0);
  assert.equal(g.cycles.length, 0);
  assert.equal(g.batches.length, 1);
});

test('buildDependencyGraph — linear chain produces correct topo order', () => {
  const skills = [
    { name: 'a', dependencies: { skills: ['b'], rules: [], tools: [], mcp_servers: [] } },
    { name: 'b', dependencies: { skills: ['c'], rules: [], tools: [], mcp_servers: [] } },
    { name: 'c', dependencies: { skills: [], rules: [], tools: [], mcp_servers: [] } },
  ];
  const g = scanRepo.buildDependencyGraph(skills);
  assert.equal(g.leafSkills.length, 1);
  assert.ok(g.leafSkills.includes('c'));
  assert.equal(g.batches.length, 3);
  assert.ok(g.batches[0].includes('c'), 'c should be in first batch (leaf)');
  assert.ok(g.batches[2].includes('a'), 'a should be in last batch (root)');
});

test('buildDependencyGraph — 2-node cycle detected', () => {
  const skills = [
    { name: 'a', dependencies: { skills: ['b'], rules: [], tools: [], mcp_servers: [] } },
    { name: 'b', dependencies: { skills: ['a'], rules: [], tools: [], mcp_servers: [] } },
  ];
  const g = scanRepo.buildDependencyGraph(skills);
  assert.equal(g.cycles.length, 1);
  assert.equal(g.cycles[0].length, 2);
  assert.equal(g.needHuman, false, '2-node cycle should not trigger hard gate');
});

test('buildDependencyGraph — 4-node cycle triggers needHuman', () => {
  const skills = [
    { name: 'a', dependencies: { skills: ['b'], rules: [], tools: [], mcp_servers: [] } },
    { name: 'b', dependencies: { skills: ['c'], rules: [], tools: [], mcp_servers: [] } },
    { name: 'c', dependencies: { skills: ['d'], rules: [], tools: [], mcp_servers: [] } },
    { name: 'd', dependencies: { skills: ['a'], rules: [], tools: [], mcp_servers: [] } },
  ];
  const g = scanRepo.buildDependencyGraph(skills);
  assert.ok(g.cycles.length >= 1);
  assert.equal(g.needHuman, true, '4-node cycle should trigger hard gate');
});

test('findLeafSkills — identifies nodes with in-degree 0', () => {
  const nodes = ['a', 'b', 'c'];
  const edges = [
    { from: 'a', to: 'b', type: 'skill' },
    { from: 'a', to: 'c', type: 'skill' },
  ];
  const leaves = scanRepo.findLeafSkills(nodes, edges);
  assert.equal(leaves.length, 1);
  assert.ok(leaves.includes('a'));
});

// ═══════════════════════════════════════════════
// Group 5: Format Mapping (3 tests)
// ═══════════════════════════════════════════════

test('mapFormat — known tools produce no untranslatable', () => {
  const skill = {
    name: 'test-skill',
    dependencies: { skills: [], rules: [], tools: ['Read', 'Write'], mcp_servers: [] },
  };
  const { untranslatable } = scanRepo.mapFormat(skill, {
    localTools: ['Read', 'Write', 'Grep', 'Glob'],
  });
  assert.equal(untranslatable.length, 0);
});

test('mapFormat — unknown tool flagged as MISSING_TOOL', () => {
  const skill = {
    name: 'test-skill',
    dependencies: { skills: [], rules: [], tools: ['CustomTool'], mcp_servers: [] },
  };
  const { untranslatable } = scanRepo.mapFormat(skill, {
    localTools: ['Read', 'Write'],
  });
  assert.equal(untranslatable.length, 1);
  assert.ok(untranslatable[0].suggestion.includes('[MISSING_TOOL]'));
});

test('mapFormat — MCP server flagged as MISSING_MCP', () => {
  const skill = {
    name: 'test-skill',
    dependencies: { skills: [], rules: [], tools: [], mcp_servers: ['mcp__unknown__foo'] },
  };
  const { untranslatable } = scanRepo.mapFormat(skill, {});
  assert.equal(untranslatable.length, 1);
  assert.ok(untranslatable[0].suggestion.includes('[MISSING_MCP]'));
});

// ═══════════════════════════════════════════════
// Group 6: Parsers (3 tests)
// ═══════════════════════════════════════════════

test('parseFrontmatter — valid YAML block', () => {
  const content = `---
name: test-skill
description: "A test skill"
allowed-tools: Read, Write
---

# Test Skill`;
  const fm = scanRepo.parseFrontmatter(content);
  assert.ok(fm);
  assert.equal(fm.name, 'test-skill');
  assert.equal(fm['allowed-tools'], 'Read, Write');
});

test('parseFrontmatter — missing frontmatter returns null', () => {
  const content = '# Just a heading\n\nSome content';
  assert.equal(scanRepo.parseFrontmatter(content), null);
});

test('sanitize — strips control characters but keeps newlines', () => {
  const input = 'hello\x00world\nfoo\x07bar\ttab';
  const result = scanRepo.sanitize(input);
  assert.ok(!result.includes('\x00'));
  assert.ok(!result.includes('\x07'));
  assert.ok(result.includes('\n'));
  assert.ok(result.includes('\t'));
  assert.ok(result.includes('helloworld'));
});

// Cleanup
test.after(() => {
  for (const d of tempDirs) {
    try { rmSync(d, { recursive: true, force: true }); } catch {}
  }
});
