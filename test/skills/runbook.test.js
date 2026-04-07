const { test } = require('node:test');
const assert = require('node:assert/strict');
const { resolve } = require('node:path');
const { readFileSync, existsSync } = require('node:fs');

const skillPath = resolve(__dirname, '../../skills/runbook/SKILL.md');
const templatePath = resolve(__dirname, '../../skills/runbook/references/template.md');
const discoveryPath = resolve(__dirname, '../../skills/runbook/references/discovery-heuristics.md');
const checkOutputPath = resolve(__dirname, '../../skills/runbook/references/check-output.md');
const docsNumberingPath = resolve(__dirname, '../../rules/docs-numbering.md');
const taxonomyPath = resolve(__dirname, '../../scripts/config/doc-taxonomy.json');

test('runbook SKILL.md exists with valid frontmatter', () => {
  assert.ok(existsSync(skillPath), 'SKILL.md should exist');
  const content = readFileSync(skillPath, 'utf8');
  assert.ok(content.startsWith('---'), 'should start with frontmatter');
  assert.ok(content.includes('name: runbook'), 'should have name field');
  assert.ok(content.includes('description:'), 'should have description field');
  assert.ok(content.includes('allowed-tools:'), 'should have allowed-tools field');
});

test('runbook SKILL.md has required sections', () => {
  const content = readFileSync(skillPath, 'utf8');
  assert.ok(content.includes('## Trigger'), 'should have Trigger section');
  assert.ok(content.includes('## When NOT to Use'), 'should have When NOT to Use section');
  assert.ok(content.includes('## Workflow'), 'should have Workflow section');
  assert.ok(content.includes('## Verification'), 'should have Verification section');
});

test('runbook SKILL.md defines create/update/check modes', () => {
  const content = readFileSync(skillPath, 'utf8');
  assert.ok(content.includes('Create Mode'), 'should define Create Mode');
  assert.ok(content.includes('Update Mode'), 'should define Update Mode');
  assert.ok(content.includes('Check Mode'), 'should define Check Mode');
});

test('runbook SKILL.md integrates feature resolver', () => {
  const content = readFileSync(skillPath, 'utf8');
  assert.ok(
    content.includes('resolve-feature-cli.js'),
    'should reference feature resolver CLI'
  );
  assert.ok(
    content.includes('doc_inventory'),
    'should use doc_inventory for runbook detection'
  );
});

test('runbook SKILL.md defines --request flag for multi-request selection', () => {
  const content = readFileSync(skillPath, 'utf8');
  assert.ok(content.includes('--request'), 'should define --request flag');
  assert.ok(
    content.includes('AskUserQuestion'),
    'should use AskUserQuestion for multi-request selection'
  );
});

test('runbook SKILL.md includes redaction rules', () => {
  const content = readFileSync(skillPath, 'utf8');
  assert.ok(content.includes('Redaction'), 'should have redaction section');
  assert.ok(content.includes('${ENV_VAR_NAME}'), 'should have env var placeholder pattern');
});

test('runbook template has all 9 sections', () => {
  assert.ok(existsSync(templatePath), 'template.md should exist');
  const content = readFileSync(templatePath, 'utf8');
  const requiredSections = [
    'Release Summary',
    'SRE Quick Reference',
    'Scope / Blast Radius',
    'Preconditions Checklist',
    'Deployment Procedure',
    'Verification / Smoke Tests',
    'Monitoring Signals',
    'Rollback Plan',
    'Open Risks / Human Checks',
  ];
  for (const section of requiredSections) {
    assert.ok(
      content.includes(section),
      `template should include "${section}" section`
    );
  }
});

test('runbook template includes provenance block', () => {
  const content = readFileSync(templatePath, 'utf8');
  assert.ok(
    content.includes('runbook-provenance'),
    'template should include provenance HTML comment'
  );
  assert.ok(
    content.includes('sources:'),
    'provenance should use multi-source array format'
  );
  assert.ok(
    content.includes('sha:'),
    'provenance should track SHA per source'
  );
});

test('discovery heuristics defines 4-priority scoped cascade', () => {
  assert.ok(existsSync(discoveryPath), 'discovery-heuristics.md should exist');
  const content = readFileSync(discoveryPath, 'utf8');
  assert.ok(content.includes('Related Files'), 'P1: should reference Related Files');
  assert.ok(content.includes('Canonical docs'), 'P2: should reference Canonical docs');
  assert.ok(content.includes('Feature-local'), 'P3: should reference Feature-local paths');
  assert.ok(content.includes('Repo-wide'), 'P4: should reference Repo-wide grep');
});

test('discovery heuristics includes redaction rules', () => {
  const content = readFileSync(discoveryPath, 'utf8');
  assert.ok(content.includes('Redaction'), 'should have redaction section');
  assert.ok(content.includes('API keys'), 'should mention API keys');
  assert.ok(content.includes('placeholder'), 'should specify placeholder replacement');
});

test('check output template defines Fresh/Stale/Missing/Unknown statuses', () => {
  assert.ok(existsSync(checkOutputPath), 'check-output.md should exist');
  const content = readFileSync(checkOutputPath, 'utf8');
  assert.ok(content.includes('Fresh'), 'should define Fresh status');
  assert.ok(content.includes('Stale'), 'should define Stale status');
  assert.ok(content.includes('Missing'), 'should define Missing status');
  assert.ok(content.includes('Unknown'), 'should define Unknown status');
});

test('check output template defines verdict logic', () => {
  const content = readFileSync(checkOutputPath, 'utf8');
  assert.ok(content.includes('Ready'), 'should define Ready verdict');
  assert.ok(content.includes('Stale'), 'should define Stale verdict');
  assert.ok(content.includes('Incomplete'), 'should define Incomplete verdict');
});

test('docs-numbering rule supports ancillary semantic naming', () => {
  const content = readFileSync(docsNumberingPath, 'utf8');
  assert.ok(
    content.includes('Ancillary'),
    'should have Ancillary Documents section'
  );
  assert.ok(
    content.includes('runbook-'),
    'should list runbook naming pattern'
  );
  assert.ok(
    content.includes('semantic'),
    'should mention semantic prefixes'
  );
});

test('doc-taxonomy.json has runbook type in ancillary namespace', () => {
  const taxonomy = JSON.parse(readFileSync(taxonomyPath, 'utf8'));
  const runbookType = taxonomy.types.find(t => t.id === 'runbook');
  assert.ok(runbookType, 'should have runbook type');
  assert.equal(runbookType.namespace, 'ancillary', 'runbook should be ancillary namespace');
  assert.ok(
    runbookType.semantic_pattern,
    'runbook should have semantic_pattern'
  );
  assert.match(
    'runbook-release.md',
    new RegExp(runbookType.semantic_pattern),
    'runbook-release.md should match semantic_pattern'
  );
});
