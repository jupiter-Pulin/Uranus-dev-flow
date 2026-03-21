'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const { join, resolve } = require('node:path');
const { mkdtempSync, writeFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');

const {
  checkAgentEntitlement,
  checkTaskEntitlement,
  detectInvalidAgentRefs,
  detectAgentToolsSyntax,
} = require('../../skills/skill-health-check/scripts/skill-lint.js');

// ---------------------------------------------------------------------------
// checkAgentEntitlement
// ---------------------------------------------------------------------------

describe('checkAgentEntitlement', () => {
  test('when body has Agent() and allowed-tools has Agent -> pass', () => {
    const body = 'Use Agent({ subagent_type: "Explore", prompt: "..." })';
    const fm = { 'allowed-tools': 'Read, Grep, Agent' };
    const result = checkAgentEntitlement(body, fm);
    assert.equal(result.pass, true);
  });

  test('when body has Agent() but allowed-tools lacks Agent -> P2', () => {
    const body = 'Use Agent({ subagent_type: "Explore", prompt: "..." })';
    const fm = { 'allowed-tools': 'Read, Grep, Glob' };
    const result = checkAgentEntitlement(body, fm);
    assert.equal(result.pass, false);
    assert.equal(result.severity, 'P2');
  });

  test('when body has subagent_type only (Task dispatch) -> pass (not Agent)', () => {
    const body = '  subagent_type: "strict-reviewer"';
    const fm = { 'allowed-tools': 'Read, Grep, Task' };
    const result = checkAgentEntitlement(body, fm);
    assert.equal(result.pass, true);
  });

  test('when body has no agent references -> pass', () => {
    const body = 'This skill does simple file operations.';
    const fm = { 'allowed-tools': 'Read, Grep' };
    const result = checkAgentEntitlement(body, fm);
    assert.equal(result.pass, true);
  });

  test('when fm is null -> pass', () => {
    const body = 'Agent({ prompt: "hello" })';
    const result = checkAgentEntitlement(body, null);
    assert.equal(result.pass, true);
  });
});

// ---------------------------------------------------------------------------
// checkTaskEntitlement
// ---------------------------------------------------------------------------

describe('checkTaskEntitlement', () => {
  test('when body has Task() and allowed-tools has Task -> pass', () => {
    const body = 'Launch Task({ prompt: "run tests" })';
    const fm = { 'allowed-tools': 'Read, Task, Bash' };
    const result = checkTaskEntitlement(body, fm);
    assert.equal(result.pass, true);
  });

  test('when body has Task() but allowed-tools lacks Task -> P2', () => {
    const body = 'Launch Task({ prompt: "run tests" })';
    const fm = { 'allowed-tools': 'Read, Bash' };
    const result = checkTaskEntitlement(body, fm);
    assert.equal(result.pass, false);
    assert.equal(result.severity, 'P2');
  });

  test('when body has TaskCreate but no Task in allowed-tools -> P2', () => {
    const body = 'Use TaskCreate to track progress';
    const fm = { 'allowed-tools': 'Read, Bash' };
    const result = checkTaskEntitlement(body, fm);
    assert.equal(result.pass, false);
    assert.equal(result.severity, 'P2');
  });

  test('when no task references -> pass', () => {
    const body = 'Simple skill with no task dispatch.';
    const fm = { 'allowed-tools': 'Read' };
    const result = checkTaskEntitlement(body, fm);
    assert.equal(result.pass, true);
  });
});

// ---------------------------------------------------------------------------
// detectInvalidAgentRefs
// ---------------------------------------------------------------------------

describe('detectInvalidAgentRefs', () => {
  const realAgentsDir = resolve(join(__dirname, '../../agents'));

  test('valid reference to existing agent -> no findings', () => {
    const skillResults = [{
      name: 'test-skill',
      body: 'Use Agent({ subagent_type: "strict-reviewer", prompt: "review" })',
    }];
    const findings = detectInvalidAgentRefs(skillResults, [], realAgentsDir);
    assert.equal(findings.length, 0);
  });

  test('built-in type Explore -> skip (no finding)', () => {
    const skillResults = [{
      name: 'deep-explore',
      body: 'Agent({ subagent_type: "Explore", prompt: "search" })',
    }];
    const findings = detectInvalidAgentRefs(skillResults, [], realAgentsDir);
    assert.equal(findings.length, 0);
  });

  test('built-in type general-purpose -> skip', () => {
    const skillResults = [{
      name: 'fallback-skill',
      body: 'subagent_type: "general-purpose"',
    }];
    const findings = detectInvalidAgentRefs(skillResults, [], realAgentsDir);
    assert.equal(findings.length, 0);
  });

  test('external plugin ref with colon -> skip', () => {
    const skillResults = [{
      name: 'review-skill',
      body: 'subagent_type: "pr-review-toolkit:code-reviewer"',
    }];
    const findings = detectInvalidAgentRefs(skillResults, [], realAgentsDir);
    assert.equal(findings.length, 0);
  });

  test('nonexistent agent -> P1 finding', () => {
    const skillResults = [{
      name: 'broken-skill',
      body: 'Agent({ subagent_type: "nonexistent-agent-xyz", prompt: "help" })',
    }];
    const findings = detectInvalidAgentRefs(skillResults, [], realAgentsDir);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].severity, 'P1');
    assert.ok(findings[0].message.includes('nonexistent-agent-xyz'));
  });

  test('multiple refs with one invalid -> 1 finding (valid skipped)', () => {
    const skillResults = [{
      name: 'multi-ref',
      body: 'subagent_type: "Explore"\nsubagent_type: "missing-bot"',
    }];
    const findings = detectInvalidAgentRefs(skillResults, [], realAgentsDir);
    assert.equal(findings.length, 1);
    assert.ok(findings[0].message.includes('missing-bot'));
  });

  test('unquoted subagent_type (markdown table text) -> skip by design', () => {
    const skillResults = [{
      name: 'table-skill',
      body: '| subagent_type: strict-reviewer | used in table |',
    }];
    const findings = detectInvalidAgentRefs(skillResults, [], realAgentsDir);
    assert.equal(findings.length, 0);
  });

  test('no subagent_type refs -> no findings', () => {
    const skillResults = [{
      name: 'simple-skill',
      body: 'This skill uses no agents at all.',
    }];
    const findings = detectInvalidAgentRefs(skillResults, [], realAgentsDir);
    assert.equal(findings.length, 0);
  });
});

// ---------------------------------------------------------------------------
// detectAgentToolsSyntax
// ---------------------------------------------------------------------------

describe('detectAgentToolsSyntax', () => {
  let tmpDir;

  test('canonical bare tools -> no findings', () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'lint-test-'));
    writeFileSync(join(tmpDir, 'good-agent.md'), '---\nname: good-agent\ntools: Read, Grep, Glob, Bash\n---\n');
    const findings = detectAgentToolsSyntax(tmpDir);
    assert.equal(findings.length, 0);
    rmSync(tmpDir, { recursive: true });
  });

  test('canonical scoped Bash -> no findings', () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'lint-test-'));
    writeFileSync(join(tmpDir, 'scoped-agent.md'), '---\nname: scoped-agent\ntools: Read, Bash(git:*)\n---\n');
    const findings = detectAgentToolsSyntax(tmpDir);
    assert.equal(findings.length, 0);
    rmSync(tmpDir, { recursive: true });
  });

  test('non-canonical tool format flagged as P2', () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'lint-test-'));
    writeFileSync(join(tmpDir, 'bad-agent.md'), '---\nname: bad-agent\ntools: Read, Bash(codex *)\n---\n');
    const findings = detectAgentToolsSyntax(tmpDir);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].severity, 'P2');
    assert.ok(findings[0].message.includes('Bash(codex *)'));
    rmSync(tmpDir, { recursive: true });
  });

  test('empty tools field -> no findings', () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'lint-test-'));
    writeFileSync(join(tmpDir, 'empty-agent.md'), '---\nname: empty-agent\ntools: \n---\n');
    const findings = detectAgentToolsSyntax(tmpDir);
    assert.equal(findings.length, 0);
    rmSync(tmpDir, { recursive: true });
  });
});
