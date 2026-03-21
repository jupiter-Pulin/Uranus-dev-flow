const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const ROOT = resolve(__dirname, '../..');
const precommitFast = readFileSync(resolve(ROOT, 'commands/precommit-fast.md'), 'utf8');
const precommitFull = readFileSync(resolve(ROOT, 'commands/precommit.md'), 'utf8');
const skillMd = readFileSync(resolve(ROOT, 'skills/project-setup/SKILL.md'), 'utf8');

test('precommit-fast.md contains auto-install logic', () => {
  assert.ok(
    precommitFast.includes('Auto-install attempt'),
    'precommit-fast.md should contain "Auto-install attempt"'
  );
});

test('precommit.md contains auto-install logic', () => {
  assert.ok(
    precommitFull.includes('Auto-install attempt'),
    'precommit.md should contain "Auto-install attempt"'
  );
});

test('both precommit commands include Node.js gate and 3-level fallback', () => {
  for (const [name, content] of [['precommit-fast', precommitFast], ['precommit', precommitFull]]) {
    assert.ok(
      content.includes('package.json'),
      `${name}.md should reference package.json gate`
    );
    assert.ok(
      content.includes('sd0x-dev-flow/scripts/precommit-runner.js'),
      `${name}.md should include 3-level fallback glob pattern`
    );
    assert.ok(
      content.includes('Plugin-relative'),
      `${name}.md should include plugin-relative fallback`
    );
  }
});

test('both precommit commands include conflict handling without --force', () => {
  for (const [name, content] of [['precommit-fast', precommitFast], ['precommit', precommitFull]]) {
    assert.ok(
      content.includes('Skip + warn'),
      `${name}.md should describe skip + warn conflict handling`
    );
    assert.ok(
      content.includes('no overwrite'),
      `${name}.md should explicitly state no overwrite without force`
    );
  }
});

test('both precommit commands include auto-install log message', () => {
  for (const [name, content] of [['precommit-fast', precommitFast], ['precommit', precommitFull]]) {
    assert.ok(
      content.includes('auto-installing missing runner'),
      `${name}.md should contain "auto-installing missing runner" log`
    );
  }
});

test('precommit auto-install does not install verify-runner', () => {
  const step1Fast = precommitFast.slice(0, precommitFast.indexOf('### Step 2'));
  assert.ok(
    !step1Fast.includes('verify-runner'),
    'precommit-fast.md Step 1 should not reference verify-runner'
  );
});

test('project-setup SKILL.md contains Phase 6.5', () => {
  assert.ok(
    skillMd.includes('Phase 6.5'),
    'SKILL.md should contain "Phase 6.5"'
  );
  assert.ok(
    skillMd.includes('Install Scripts'),
    'SKILL.md should contain "Install Scripts"'
  );
});

test('project-setup Phase 6.5 installs 3 scripts', () => {
  assert.ok(
    skillMd.includes('precommit-runner.js'),
    'SKILL.md should reference precommit-runner.js'
  );
  assert.ok(
    skillMd.includes('verify-runner.js'),
    'SKILL.md should reference verify-runner.js'
  );
  assert.ok(
    skillMd.includes('lib/utils.js'),
    'SKILL.md should reference lib/utils.js'
  );
});

test('project-setup Phase 6.5 updates manifest', () => {
  const phase65Start = skillMd.indexOf('## Phase 6.5');
  const phase7Start = skillMd.indexOf('## Phase 7');
  const phase65Section = skillMd.slice(phase65Start, phase7Start);
  assert.ok(
    phase65Section.includes('.sd0x/install-state.json'),
    'Phase 6.5 should reference canonical manifest path .sd0x/install-state.json'
  );
});

test('project-setup Phase 7 includes Scripts status row', () => {
  const phase7Start = skillMd.indexOf('## Phase 7');
  const phase7Section = skillMd.slice(phase7Start);
  assert.ok(
    phase7Section.includes('| Scripts |'),
    'Phase 7 report should include Scripts row'
  );
});
