'use strict';

const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, writeFileSync, mkdirSync, rmSync } = require('node:fs');
const { join } = require('node:path');
const { tmpdir } = require('node:os');

const {
  extractItems,
  classifyAcDomains,
  filterOpenRequests,
  classifySpecState,
  parseRequestStatus,
  CLOSED_REQUEST_STATUS,
} = require('../../../scripts/lib/fc-extractor');

const tempDirs = [];

function makeTempDir(prefix = 'sd0x-fc-ext-') {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

after(() => {
  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function setupFeatureFixture(root, key, { requirements, techSpec, requests = {} } = {}) {
  const featureDir = join(root, 'docs', 'features', key);
  mkdirSync(featureDir, { recursive: true });
  if (requirements != null) writeFileSync(join(featureDir, '1-requirements.md'), requirements);
  if (techSpec != null) writeFileSync(join(featureDir, '2-tech-spec.md'), techSpec);
  if (Object.keys(requests).length > 0) {
    const requestsDir = join(featureDir, 'requests');
    mkdirSync(requestsDir, { recursive: true });
    for (const [name, body] of Object.entries(requests)) {
      writeFileSync(join(requestsDir, name), body);
    }
  }
  return featureDir;
}

function canonicalFor({ requirements = false, techSpec = false } = {}) {
  return {
    requirements: requirements ? { file: '1-requirements.md', path: '1-requirements.md' } : null,
    tech_spec: techSpec ? { file: '2-tech-spec.md', path: '2-tech-spec.md' } : null,
    architecture: null,
    feasibility: null,
  };
}

const REQUIREMENTS_SAMPLE = `# Requirements: Test

## 5. Functional Requirements

| ID | Requirement | Priority | Rationale |
|----|-------------|----------|-----------|
| FR-1 | First requirement with token authentication | Must | Security basis |
| FR-2 | Second requirement for transaction atomicity | Should | Data integrity |
| FR-3 | Third requirement about logging | Could | Nice to have |

## 6. Non-Functional Requirements

| ID | Category | Requirement | Metric |
|----|----------|-------------|--------|
| NFR-1 | Performance | Response < 200ms p95 | p95 sampling |
| NFR-2 | Security | Redact PII in logs | grep scan |

## 7. Open Questions

- [ ] Something
`;

const REQUEST_OPEN = `# Request R1

> **Status**: Pending
> **Priority**: P1

## Acceptance Criteria

- [ ] Implement token-based auth login
- [ ] Ensure no regression in existing logout flow
- [x] Add migration rollback path for legacy sessions
- [ ] Pass /codex-review-fast
`;

const REQUEST_DONE = `# Request done

> **Status**: Completed

## Acceptance Criteria

- [x] Something completed
`;

const REQUEST_ARCHIVED = `# Request archived

> **Status**: Archived

## Acceptance Criteria

- [x] Archived work
`;

const REQUEST_NO_STATUS = `# Request no status

## Acceptance Criteria

- [ ] Some work
`;

test('classifyAcDomains matches multiple domains', () => {
  assert.deepEqual(
    classifyAcDomains('Implement token-based auth with encryption'),
    ['security'],
  );
  assert.deepEqual(
    classifyAcDomains('Ensure transaction consistency on migration rollback'),
    ['data-integrity'],
  );
  assert.deepEqual(
    classifyAcDomains('Must not break existing behavior'),
    ['regression'],
  );
  assert.deepEqual(
    classifyAcDomains('Auth token migration must not break existing behavior'),
    ['security', 'data-integrity', 'regression'],
  );
  assert.deepEqual(classifyAcDomains('Simple refactor'), []);
  assert.deepEqual(classifyAcDomains(''), []);
  assert.deepEqual(classifyAcDomains(null), []);
});

test('classifySpecState covers all four states', () => {
  assert.equal(classifySpecState(null), 'unresolved');
  assert.equal(classifySpecState(undefined), 'unresolved');
  assert.equal(classifySpecState({ requirements: null, tech_spec: null }), 'no-spec');
  assert.equal(classifySpecState({ requirements: { file: 'x' }, tech_spec: null }), 'partial-spec');
  assert.equal(classifySpecState({ requirements: null, tech_spec: { file: 'x' } }), 'partial-spec');
  assert.equal(classifySpecState({ requirements: { file: 'x' }, tech_spec: { file: 'y' } }), 'full-spec');
});

test('parseRequestStatus finds status in blockquote', () => {
  assert.equal(parseRequestStatus('# Foo\n> **Status**: Pending\n'), 'Pending');
  assert.equal(parseRequestStatus('> **Status**: Completed'), 'Completed');
  assert.equal(parseRequestStatus('# No status here'), null);
  assert.equal(parseRequestStatus(''), null);
});

test('parseRequestStatus finds status in heading form (## Status:)', () => {
  // Real repo convention seen in docs/features/runner-auto-install/requests/
  assert.equal(
    parseRequestStatus('# Runner Auto-Install\n\n## Status: Completed\n\n## Background\n'),
    'Completed',
  );
  // Case-insensitivity on the word "Status"
  assert.equal(parseRequestStatus('## status: Active'), 'Active');
  // Ignore heading "Status" lines without colon
  assert.equal(parseRequestStatus('# Title\n\n## Status Overview\nWords\n'), null);
});

test('parseRequestStatus ignores status tokens past the head window', () => {
  const longBody = '# T\n' + '\n'.repeat(40) + '## Status: Done\n';
  assert.equal(parseRequestStatus(longBody), null);
});

test('filterOpenRequests excludes closed statuses', () => {
  const root = makeTempDir();
  const featureDir = setupFeatureFixture(root, 'sample', {
    requests: {
      '2026-01-01-open.md': REQUEST_OPEN,
      '2026-01-02-done.md': REQUEST_DONE,
      '2026-01-03-archived.md': REQUEST_ARCHIVED,
      '2026-01-04-no-status.md': REQUEST_NO_STATUS,
    },
  });
  const open = filterOpenRequests(join(featureDir, 'requests'));
  assert.equal(open.length, 2);
  assert.ok(open.some(p => p.endsWith('2026-01-01-open.md')));
  assert.ok(open.some(p => p.endsWith('2026-01-04-no-status.md')));
  assert.ok(!open.some(p => p.endsWith('2026-01-02-done.md')));
  assert.ok(!open.some(p => p.endsWith('2026-01-03-archived.md')));
});

test('filterOpenRequests recognises all four closed statuses', () => {
  // CLOSED_REQUEST_STATUS is a Set, not an array — iterate via spread
  const closed = [...CLOSED_REQUEST_STATUS];
  assert.deepEqual(closed.sort(), ['Archived', 'Completed', 'Done', 'Superseded']);
  const root = makeTempDir();
  const requests = {};
  for (const status of closed) {
    requests[`2026-01-01-${status.toLowerCase()}.md`] = `# T\n> **Status**: ${status}\n`;
  }
  const featureDir = setupFeatureFixture(root, 'closed-only', { requests });
  assert.deepEqual(filterOpenRequests(join(featureDir, 'requests')), []);
});

test('filterOpenRequests on missing directory returns empty', () => {
  const root = makeTempDir();
  assert.deepEqual(filterOpenRequests(join(root, 'does-not-exist')), []);
  assert.deepEqual(filterOpenRequests(''), []);
  assert.deepEqual(filterOpenRequests(null), []);
});

test('extractItems pulls FRs and NFRs from requirements doc', () => {
  const root = makeTempDir();
  setupFeatureFixture(root, 'sample', {
    requirements: REQUIREMENTS_SAMPLE,
  });
  const { items, specState, sources } = extractItems({
    repoRoot: root,
    featureKey: 'sample',
    canonicalDocs: canonicalFor({ requirements: true }),
  });
  assert.equal(specState, 'partial-spec');
  assert.equal(sources.requirements, 'docs/features/sample/1-requirements.md');
  const frs = items.filter(i => i.type === 'FR');
  const nfrs = items.filter(i => i.type === 'NFR');
  assert.equal(frs.length, 3);
  assert.equal(nfrs.length, 2);
  assert.equal(frs[0].id, 'FR-1');
  assert.equal(frs[0].priority, 'Must');
  assert.match(frs[0].text, /token authentication/);
  assert.equal(nfrs[0].id, 'NFR-1');
  assert.equal(nfrs[0].category, 'Performance');
  assert.match(nfrs[0].metric, /p95/);
  // source_line should be greater than 0 and within reasonable range
  assert.ok(frs[0].source_line > 0);
  assert.ok(nfrs[0].source_line > frs[0].source_line);
});

test('extractItems pulls ACs from open requests with synthetic IDs and domain tags', () => {
  const root = makeTempDir();
  setupFeatureFixture(root, 'sample', {
    requirements: REQUIREMENTS_SAMPLE,
    requests: {
      '2026-01-01-r1.md': REQUEST_OPEN,
      '2026-01-02-done.md': REQUEST_DONE,
    },
  });
  const { items, requestsIncluded } = extractItems({
    repoRoot: root,
    featureKey: 'sample',
    canonicalDocs: canonicalFor({ requirements: true }),
  });
  const acs = items.filter(i => i.type === 'AC');
  // Open request has 4 checkbox rows (including quality-gate one)
  assert.equal(acs.length, 4);
  assert.equal(acs[0].id, 'AC-1');
  assert.equal(acs[0].checked, false);
  assert.deepEqual(acs[0].domains, ['security']);
  assert.equal(acs[1].id, 'AC-2');
  assert.deepEqual(acs[1].domains, ['regression']);
  assert.equal(acs[2].checked, true);
  assert.deepEqual(acs[2].domains, ['data-integrity']);
  // Quality-gate AC has no domain
  assert.equal(acs[3].id, 'AC-4');
  assert.deepEqual(acs[3].domains, []);
  // Only open request is included
  assert.equal(requestsIncluded.length, 1);
  assert.match(requestsIncluded[0], /2026-01-01-r1\.md$/);
});

test('extractItems with no canonical docs returns empty items + no-spec state', () => {
  const root = makeTempDir();
  setupFeatureFixture(root, 'empty');
  const { items, specState, sources } = extractItems({
    repoRoot: root,
    featureKey: 'empty',
    canonicalDocs: null,
  });
  assert.deepEqual(items, []);
  assert.equal(specState, 'unresolved');
  assert.equal(sources.requirements, null);
  assert.equal(sources.tech_spec, null);
});

test('extractItems with full-spec canonical records both sources', () => {
  const root = makeTempDir();
  setupFeatureFixture(root, 'full', {
    requirements: REQUIREMENTS_SAMPLE,
    techSpec: '# Tech Spec\n\n## 1. Overview\nStub.\n',
  });
  const { specState, sources } = extractItems({
    repoRoot: root,
    featureKey: 'full',
    canonicalDocs: canonicalFor({ requirements: true, techSpec: true }),
  });
  assert.equal(specState, 'full-spec');
  assert.equal(sources.requirements, 'docs/features/full/1-requirements.md');
  assert.equal(sources.tech_spec, 'docs/features/full/2-tech-spec.md');
});

test('extractItems relaxed section headings absorb numbering variants', () => {
  // Real in-repo variant: "## 4. Functional Requirements (MoSCoW)" — numeric
  // prefix ≠ 5, qualifier after the heading text.
  const root = makeTempDir();
  const variant = `# Requirements\n\n## 4. Functional Requirements (MoSCoW)\n
| ID | Requirement | Priority | Rationale |
|----|-------------|----------|-----------|
| FR-1 | token auth | Must | sec |

## 7. Non-Functional Requirements

| ID | Category | Requirement | Metric |
|----|----------|-------------|--------|
| NFR-1 | Performance | fast | p95 |
`;
  setupFeatureFixture(root, 'variant', { requirements: variant });
  const { items } = extractItems({
    repoRoot: root,
    featureKey: 'variant',
    canonicalDocs: canonicalFor({ requirements: true }),
  });
  const frs = items.filter(i => i.type === 'FR');
  const nfrs = items.filter(i => i.type === 'NFR');
  assert.equal(frs.length, 1);
  assert.equal(frs[0].id, 'FR-1');
  assert.equal(nfrs.length, 1);
  assert.equal(nfrs[0].id, 'NFR-1');
});

test('extractItems parses unnumbered + Non Functional variants', () => {
  const root = makeTempDir();
  const unnumbered = `# Spec\n\n## Functional Requirements\n
| ID | Requirement | Priority | Rationale |
|----|-------------|----------|-----------|
| FR-9 | bare | Should | — |

## Non Functional Requirements

| ID | Category | Requirement | Metric |
|----|----------|-------------|--------|
| NFR-9 | Reliability | ok | test |
`;
  setupFeatureFixture(root, 'bare', { requirements: unnumbered });
  const { items } = extractItems({
    repoRoot: root,
    featureKey: 'bare',
    canonicalDocs: canonicalFor({ requirements: true }),
  });
  assert.equal(items.filter(i => i.type === 'FR').length, 1);
  assert.equal(items.filter(i => i.type === 'NFR').length, 1);
});

test('extractItems preserves explicit AC-N ids from checkbox rows', () => {
  // Spec §3.4.2 expects explicit AC ids. Re-ordered / skipped ids must be
  // preserved as-written rather than renumbered positionally.
  const root = makeTempDir();
  const req = `# R
> **Status**: Pending

## Acceptance Criteria

- [ ] AC-3: auth is enforced
- [x] AC-1: logout flow intact
- [ ] bare item without explicit id
- [ ] AC-7 — migration rollback
`;
  setupFeatureFixture(root, 'explicit', {
    requirements: REQUIREMENTS_SAMPLE,
    requests: { '2026-01-01-r.md': req },
  });
  const { items } = extractItems({
    repoRoot: root,
    featureKey: 'explicit',
    canonicalDocs: canonicalFor({ requirements: true }),
  });
  const acs = items.filter(i => i.type === 'AC');
  // Explicit ids preserved; synthetic (row 3) skips existing explicit ids to
  // avoid collision, so it lands on AC-2 (AC-1 / AC-3 / AC-7 are taken).
  assert.deepEqual(acs.map(a => a.id), ['AC-3', 'AC-1', 'AC-2', 'AC-7']);
  assert.equal(acs[2].text, 'bare item without explicit id');
  assert.equal(acs[1].checked, true);
});

test('extractItems against real 1-requirements.md fixture satisfies AC-1 counts (>=12 FR / >=9 NFR)', () => {
  // Per request AC-1: extractor must pull >=12 FRs / >=9 NFRs from the live
  // docs/features/feature-completeness/1-requirements.md — not from an
  // in-memory sample. This exercises the parser against the same section
  // layout the skill will see at runtime.
  const { resolve } = require('node:path');
  const repoRoot = resolve(__dirname, '..', '..', '..');
  const canonicalDocs = {
    requirements: { file: '1-requirements.md', path: '1-requirements.md' },
    tech_spec: { file: '2-tech-spec.md', path: '2-tech-spec.md' },
    architecture: null,
    feasibility: null,
  };
  const { items, specState } = extractItems({
    repoRoot,
    featureKey: 'feature-completeness',
    canonicalDocs,
  });
  const frs = items.filter(i => i.type === 'FR');
  const nfrs = items.filter(i => i.type === 'NFR');
  assert.equal(specState, 'full-spec');
  assert.ok(frs.length >= 12, `expected >=12 FR, got ${frs.length}`);
  assert.ok(nfrs.length >= 9, `expected >=9 NFR, got ${nfrs.length}`);
  // Spot-check that ids are preserved verbatim (not renumbered positionally)
  assert.ok(frs.some(f => f.id === 'FR-1'));
  assert.ok(nfrs.some(n => n.id === 'NFR-1'));
});

test('extractItems accepts explicit includedRequests override', () => {
  const root = makeTempDir();
  const featureDir = setupFeatureFixture(root, 'override', {
    requirements: REQUIREMENTS_SAMPLE,
    requests: {
      '2026-01-01-r1.md': REQUEST_OPEN,
      '2026-01-02-done.md': REQUEST_DONE,
    },
  });
  const { items, requestsIncluded } = extractItems({
    repoRoot: root,
    featureKey: 'override',
    canonicalDocs: canonicalFor({ requirements: true }),
    includedRequests: [join(featureDir, 'requests', '2026-01-02-done.md')],
  });
  // Override bypasses open filter — pulls AC from closed request instead
  const acs = items.filter(i => i.type === 'AC');
  assert.equal(acs.length, 1);
  assert.equal(acs[0].text, 'Something completed');
  assert.equal(requestsIncluded.length, 1);
  assert.match(requestsIncluded[0], /2026-01-02-done\.md$/);
});
