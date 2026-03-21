#!/usr/bin/env node
'use strict';

// Generate skills array in .claude-plugin/plugin.json
// by scanning skills/<name>/SKILL.md frontmatter.
//
// Usage: node scripts/generate-skills-manifest.js [--check]
//   --check  Validate only (exit 1 if out of sync, for CI)

const { readdirSync, readFileSync, writeFileSync, existsSync } = require('node:fs');
const { resolve, join } = require('node:path');

const ROOT = resolve(__dirname, '..');
const SKILLS_DIR = join(ROOT, 'skills');
const PLUGIN_JSON = join(ROOT, '.claude-plugin', 'plugin.json');
const CHECK_MODE = process.argv.includes('--check');

function extractName(skillDir) {
  const skillMd = join(SKILLS_DIR, skillDir, 'SKILL.md');
  if (!existsSync(skillMd)) return null;
  const content = readFileSync(skillMd, 'utf8');
  const match = content.match(/^name:\s*"?([^"\n]+)"?\s*$/m);
  return match ? match[1].trim() : null;
}

function generateSkillsArray() {
  const dirs = readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name)
    .sort();

  const skills = [];
  for (const dir of dirs) {
    const name = extractName(dir);
    if (name) {
      skills.push({ name, path: `skills/${dir}` });
    }
  }
  return skills;
}

function main() {
  const skills = generateSkillsArray();
  const plugin = JSON.parse(readFileSync(PLUGIN_JSON, 'utf8'));

  if (CHECK_MODE) {
    const current = JSON.stringify(plugin.skills || []);
    const expected = JSON.stringify(skills);
    if (current !== expected) {
      const currentNames = (plugin.skills || []).map(s => s.name);
      const expectedNames = skills.map(s => s.name);
      const missing = expectedNames.filter(n => !currentNames.includes(n));
      const extra = currentNames.filter(n => !expectedNames.includes(n));
      console.error('plugin.json skills array is out of sync!');
      if (missing.length) console.error(`  Missing: ${missing.join(', ')}`);
      if (extra.length) console.error(`  Extra: ${extra.join(', ')}`);
      console.error(`  Expected ${skills.length} skills, found ${(plugin.skills || []).length}`);
      console.error('Run: node scripts/generate-skills-manifest.js');
      process.exit(1);
    }
    console.log(`plugin.json skills array is in sync (${skills.length} skills)`);
    return;
  }

  const before = (plugin.skills || []).length;
  plugin.skills = skills;

  const json = JSON.stringify(plugin, null, 2) + '\n';
  writeFileSync(PLUGIN_JSON, json, 'utf8');
  console.log(`Updated plugin.json: ${before} → ${skills.length} skills`);
}

main();
