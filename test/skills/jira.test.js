const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, existsSync, readdirSync } = require('node:fs');
const { resolve, join } = require('node:path');

const root = resolve(__dirname, '../..');
const skillDir = resolve(root, 'skills/jira');

// --- Helper: Input parser (extracted from SKILL.md spec) ---

/**
* Parses user input to extract Jira issue key and optional host.
*
* @param {string} input - bare key, URL, or software URL
* @returns {{ issueKey: string, host?: string } | null}
 */
function parseInput(input) {
  if (!input || typeof input !== 'string') return null;

  const keyPattern = /([A-Z][A-Z0-9]+-\d+)/;
  const hostPattern = /https?:\/\/([^/]+\.atlassian\.net)/;

  const keyMatch = input.match(keyPattern);
  if (!keyMatch) return null;

  const hostMatch = input.match(hostPattern);
  return {
    issueKey: keyMatch[1],
    host: hostMatch ? hostMatch[1] : undefined,
  };
}

// --- Helper: Branch name generator (extracted from branch-policy.md) ---

const TYPE_PREFIX_MAP = {
  Bug: 'fix',
  Story: 'feat',
  Task: 'feat',
  'Sub-task': 'feat',
  Documentation: 'docs',
};

const VALID_TYPES = ['feat', 'fix', 'docs', 'refactor'];

/**
* Validates the --type override value.
*
* @param {string} type
* @returns {boolean}
 */
function validateType(type) {
  return VALID_TYPES.includes(type);
}

/**
* Generates a branch name from Jira issue details.
*
* @param {string} issueKey - e.g. "OK-51513"
* @param {string} summary - issue summary text
* @param {string} issueType - Jira issue type name
* @param {string} [typeOverride] - --type flag value
* @returns {string} branch name
 */
function generateBranchName(issueKey, summary, issueType, typeOverride) {
  const prefix = typeOverride || TYPE_PREFIX_MAP[issueType] || 'feat';
  const slug = summary
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 40);
  return `${prefix}/${issueKey}-${slug}`;
}

// --- Helper: Event → transition matcher (extracted from transition-mapping.md) ---

const EVENT_PATTERNS = {
  start_work: /in.*(progress|dev)/i,
  pr_opened: /review/i,
  pr_merged: /(done|closed|resolved)/i,
};

/**
* Matches an event to available Jira transitions.
*
* @param {string} event - event vocabulary name
* @param {Array<{ id: string, name: string }>} availableTransitions
* @returns {Array<{ id: string, name: string }>} matched transitions
 */
function matchTransition(event, availableTransitions) {
  const pattern = EVENT_PATTERNS[event];
  if (!pattern) return [];
  return availableTransitions.filter((t) => pattern.test(t.name));
}

// --- T1-T5: Input parser tests ---

test('T1: Bare key OK-51513 extracts correctly', () => {
  const result = parseInput('OK-51513');
  assert.deepEqual(result, { issueKey: 'OK-51513', host: undefined });
});

test('T2: Full URL extracts key + host', () => {
  const result = parseInput('<https://onekeyhq.atlassian.net/browse/OK-51513>');
  assert.deepEqual(result, { issueKey: 'OK-51513', host: 'onekeyhq.atlassian.net' });
});

test('T3: Software URL extracts key + host', () => {
  const result = parseInput(
    '<https://onekeyhq.atlassian.net/jira/software/projects/OK/boards/5/backlog?selectedIssue=OK-51513>'
  );
  assert.deepEqual(result, { issueKey: 'OK-51513', host: 'onekeyhq.atlassian.net' });
});

test('T4: Invalid input returns null', () => {
  assert.equal(parseInput('not-a-key'), null);
  assert.equal(parseInput(''), null);
  assert.equal(parseInput(null), null);
  assert.equal(parseInput(undefined), null);
});

test('T5: Lowercase key rejected (case sensitive)', () => {
  assert.equal(parseInput('ok-51513'), null);
  assert.equal(parseInput('Ok-123'), null);
});

// --- T6-T12: Branch name generator tests ---

test('T6: Bug issue type maps to fix/ prefix', () => {
  const branch = generateBranchName('BUG-123', 'Fix login crash', 'Bug');
  assert.ok(branch.startsWith('fix/'));
  assert.equal(branch, 'fix/BUG-123-fix-login-crash');
});

test('T7: Story issue type maps to feat/ prefix', () => {
  const branch = generateBranchName('OK-51513', 'Add user profile page', 'Story');
  assert.ok(branch.startsWith('feat/'));
  assert.equal(branch, 'feat/OK-51513-add-user-profile-page');
});

test('T8: --type override replaces issue type mapping', () => {
  const branch = generateBranchName('OK-51513', 'Add user profile page', 'Story', 'fix');
  assert.ok(branch.startsWith('fix/'));
  assert.equal(branch, 'fix/OK-51513-add-user-profile-page');
});

test('T9: Slug length capped at 40 characters', () => {
  const longSummary = 'This is a very long summary that should be truncated to forty characters maximum';
  const branch = generateBranchName('OK-1', longSummary, 'Story');
  const slug = branch.split('/')[1].replace('OK-1-', '');
  assert.ok(slug.length <= 40, `Slug too long: ${slug.length}`);
});

test('T10: Special characters removed from slug', () => {
  const branch = generateBranchName('OK-1', 'Add @user: profile & settings!', 'Task');
  assert.equal(branch, 'feat/OK-1-add-user-profile-settings');
});

test('T11: Invalid --type values rejected', () => {
  assert.equal(validateType('feature'), false);
  assert.equal(validateType('bugfix'), false);
  assert.equal(validateType(''), false);
  assert.equal(validateType('hotfix'), false);
});

test('T12: Valid --type enum', () => {
  assert.equal(validateType('feat'), true);
  assert.equal(validateType('fix'), true);
  assert.equal(validateType('docs'), true);
  assert.equal(validateType('refactor'), true);
});

// --- T13-T19: Event → transition matching tests ---

const MOCK_TRANSITIONS = [
  { id: '11', name: 'To Do' },
  { id: '21', name: 'In Progress' },
  { id: '31', name: 'In Review' },
  { id: '41', name: 'Done' },
];

test('T13: start_work matches In Progress', () => {
  const matches = matchTransition('start_work', MOCK_TRANSITIONS);
  assert.equal(matches.length, 1);
  assert.equal(matches[0].name, 'In Progress');
});

test('T14: start_work matches In Development', () => {
  const transitions = [
    { id: '21', name: 'In Development' },
    { id: '31', name: 'Code Review' },
  ];
  const matches = matchTransition('start_work', transitions);
  assert.equal(matches.length, 1);
  assert.equal(matches[0].name, 'In Development');
});

test('T15: pr_opened matches In Review', () => {
  const matches = matchTransition('pr_opened', MOCK_TRANSITIONS);
  assert.equal(matches.length, 1);
  assert.equal(matches[0].name, 'In Review');
});

test('T16: pr_merged matches Done', () => {
  const matches = matchTransition('pr_merged', MOCK_TRANSITIONS);
  assert.equal(matches.length, 1);
  assert.equal(matches[0].name, 'Done');
});

test('T17: pr_merged matches Closed', () => {
  const transitions = [
    { id: '41', name: 'Closed' },
    { id: '51', name: 'Reopened' },
  ];
  const matches = matchTransition('pr_merged', transitions);
  assert.equal(matches.length, 1);
  assert.equal(matches[0].name, 'Closed');
});

test('T18: No match returns empty array', () => {
  const transitions = [
    { id: '11', name: 'To Do' },
    { id: '51', name: 'Backlog' },
  ];
  const matches = matchTransition('start_work', transitions);
  assert.equal(matches.length, 0);
});

test('T19: Multiple matches returns all', () => {
  const transitions = [
    { id: '41', name: 'Done' },
    { id: '42', name: 'Closed' },
    { id: '43', name: 'Resolved' },
  ];
  const matches = matchTransition('pr_merged', transitions);
  assert.equal(matches.length, 3);
});

// --- T20: Unknown issue type falls back to feat/ ---

test('T20: Unknown issue type falls back to feat/ prefix', () => {
  const branch = generateBranchName('OK-1', 'Custom type issue', 'Epic');
  assert.ok(branch.startsWith('feat/'));
});

// --- T21-T24: Create subcommand tests ---

test('T21: SKILL.md has create subcommand with createJiraIssue', () => {
  const content = readFileSync(join(skillDir, 'SKILL.md'), 'utf8');
  assert.match(content, /Subcommand:.*`create`/i, 'should have create subcommand');
  assert.match(content, /createJiraIssue/, 'should reference createJiraIssue MCP tool');
});

test('T22: SKILL.md specifies contentFormat markdown', () => {
  const content = readFileSync(join(skillDir, 'SKILL.md'), 'utf8');
  assert.match(content, /contentFormat.*markdown/i, 'should specify markdown contentFormat');
});

// --- Structural tests ---

test('S1: SKILL.md exists with valid frontmatter', () => {
  const skillPath = join(skillDir, 'SKILL.md');
  assert.ok(existsSync(skillPath), 'skills/jira/SKILL.md missing');

  const content = readFileSync(skillPath, 'utf8');
  const fmMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
  assert.ok(fmMatch, 'SKILL.md missing frontmatter');

  const fm = fmMatch[1];
  assert.ok(/^name:\s*.+/m.test(fm), 'SKILL.md missing name');
  assert.ok(/^description:\s*.+/m.test(fm), 'SKILL.md missing description');
});

test('S2: SKILL.md does not use @references/ prefix', () => {
  const content = readFileSync(join(skillDir, 'SKILL.md'), 'utf8');
  const matches = content.match(/@references\//g);
  assert.ok(!matches, `SKILL.md uses @references/ (${matches?.length} occurrences)`);
});

test('S3: All reference files exist', () => {
  const refsDir = join(skillDir, 'references');
  assert.ok(existsSync(refsDir), 'references/ directory missing');

  const expected = ['branch-policy.md', 'transition-mapping.md', 'create-policy.md'];
  for (const ref of expected) {
    assert.ok(existsSync(join(refsDir, ref)), `references/${ref} missing`);
  }
});

test('T24: create-policy.md reference exists with markdown format', () => {
  const path = join(skillDir, 'references/create-policy.md');
  assert.ok(existsSync(path), 'create-policy.md should exist');
  const content = readFileSync(path, 'utf8');
  assert.match(content, /markdown/i, 'should mention markdown format');
});

test('S6: Test event vocabulary matches reference file events', () => {
  const refContent = readFileSync(
    join(skillDir, 'references/transition-mapping.md'),
    'utf8'
  );

  // All events in test helper must appear in reference doc
  const testEvents = Object.keys(EVENT_PATTERNS);
  for (const event of testEvents) {
    assert.ok(
      refContent.includes(event),
      `Event '${event}' in test helper not found in transition-mapping.md`
    );
  }

  // Parse events generically from reference code block (matches `key:` in JS object)
  const codeBlockMatch = refContent.match(/```javascript\s*([\s\S]*?)```/);
  assert.ok(codeBlockMatch, 'No JavaScript code block found in transition-mapping.md');
  const refEventMatches = codeBlockMatch[1].match(/^\s*(\w+):/gm);
  assert.ok(refEventMatches, 'No event keys found in code block');
  const refEvents = refEventMatches.map((m) => m.trim().replace(/:$/, ''));

  // Bidirectional: reference events must exist in test, and vice versa
  for (const event of refEvents) {
    assert.ok(
      EVENT_PATTERNS[event],
      `Event '${event}' in transition-mapping.md not found in test helper`
    );
  }
  assert.equal(
    testEvents.length,
    refEvents.length,
    `Event count mismatch: test has ${testEvents.length}, reference has ${refEvents.length}`
  );
});
