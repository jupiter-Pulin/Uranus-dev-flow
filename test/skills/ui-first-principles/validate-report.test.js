'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  validate,
  scanByFingerprint,
  scanForPIIPatterns,
  parseDecisionRows,
  parseGapReport,
  parseAntiPatterns,
  extractTablesFromText,
  extractSectionByHeading,
  sha256Prefix,
  safeEnumValue,
  runCli,
} = require('../../../scripts/skills/ui-first-principles/validate-report');

const ALLOWED_PRINCIPLES = [
  'JTBD',
  'CognitiveLoadTheory',
  'HicksLaw',
  'MillersLaw',
  'ProgressiveDisclosure',
];

const ALLOWED_ANTI_PATTERNS = [
  'too_many_primary',
  'scenario_field_mismatch',
  'pure_aesthetic_over_utility',
  'hidden_critical_info',
  'redundant_fields',
];

// ---------- Helpers to build reports ----------

function buildReport({
  scenario = 'transaction history',
  rows = [
    { field: 'txHash', priority: 'primary', anchor: 'JTBD', rationale: 'identity' },
    { field: 'amount', priority: 'primary', anchor: 'CognitiveLoadTheory', rationale: 'core' },
    { field: 'gasUsed', priority: 'on_demand', anchor: 'ProgressiveDisclosure', rationale: 'detail' },
  ],
  antiPatterns = [
    { id: 'too_many_primary', fields: 'txHash, amount, gasUsed', rationale: 'over Miller 7±2' },
  ],
  gapBlock = `**UI needs but API missing**: counterparty_alias\n**API provides but UI ignores**: rawSignature\n`,
  includeFieldDecisionHeading = true,
  includeAntiPatternSection = true,
  includeGapSection = true,
} = {}) {
  const parts = [`# UI First-Principles Analysis: ${scenario}`, ''];
  if (includeFieldDecisionHeading) {
    parts.push('## 2. Field Decision Table', '');
    parts.push('| Field | Priority | Principle Anchor | Rationale |');
    parts.push('|-------|----------|------------------|-----------|');
    for (const r of rows) {
      parts.push(`| ${r.field} | ${r.priority} | ${r.anchor} | ${r.rationale} |`);
    }
    parts.push('');
  }
  if (includeAntiPatternSection) {
    parts.push('## 3. Anti-Pattern Findings', '');
    parts.push('| Pattern | Affected Fields | Severity | Rationale |');
    parts.push('|---------|----------------|----------|-----------|');
    for (const ap of antiPatterns) {
      parts.push(`| \`${ap.id}\` | ${ap.fields} | warning | ${ap.rationale} |`);
    }
    parts.push('');
  }
  if (includeGapSection) {
    parts.push('## 4. Gap Report', '');
    parts.push(gapBlock);
  }
  return parts.join('\n');
}

// ---------- Rule 1: pii_leak_fingerprint ----------

test('Rule 1: clean report → no fingerprint violation', () => {
  const md = buildReport();
  const fpForbidden = new Set([sha256Prefix('alice@example.com')]);
  const result = validate(md, {
    fieldNames: ['txHash', 'amount', 'gasUsed'],
    allowedPrinciples: ALLOWED_PRINCIPLES,
    allowedAntiPatterns: ALLOWED_ANTI_PATTERNS,
    forbiddenFingerprints: fpForbidden,
  });
  assert.equal(result.ok, true);
  assert.equal(result.violations.find((v) => v.rule === 'pii_leak_fingerprint'), undefined);
});

test('Rule 1: leaked sensitive value → critical fingerprint violation', () => {
  const leakedValue = 'alice@example.com';
  // Build a report that accidentally contains the raw value (LLM hallucination scenario).
  const md = buildReport({
    rows: [
      { field: 'txHash', priority: 'primary', anchor: 'JTBD', rationale: `mentions ${leakedValue}` },
      { field: 'amount', priority: 'primary', anchor: 'CognitiveLoadTheory', rationale: 'core' },
      { field: 'gasUsed', priority: 'on_demand', anchor: 'ProgressiveDisclosure', rationale: 'detail' },
    ],
  });
  const fpForbidden = new Set([sha256Prefix(leakedValue)]);
  const result = validate(md, {
    fieldNames: ['txHash', 'amount', 'gasUsed'],
    allowedPrinciples: ALLOWED_PRINCIPLES,
    allowedAntiPatterns: ALLOWED_ANTI_PATTERNS,
    forbiddenFingerprints: fpForbidden,
  });
  // The raw value also matches the email regex (Rule 1b), so two critical
  // violations are expected. Verify both.
  const critical = result.violations.filter((v) => v.severity === 'critical');
  const rules = new Set(critical.map((v) => v.rule));
  assert.ok(rules.has('pii_leak_fingerprint'), 'fingerprint rule should fire');
  assert.equal(result.ok, false);
});

test('scanByFingerprint: ignores tokens shorter than minimum', () => {
  const fp = new Set([sha256Prefix('a')]);
  const hits = scanByFingerprint('a a a', fp);
  assert.deepEqual(hits, []);
});

test('scanByFingerprint: dedups identical token occurrences', () => {
  const value = 'alicewatson@example.com';
  const fp = new Set([sha256Prefix(value)]);
  const hits = scanByFingerprint(`${value} ${value} ${value}`, fp);
  assert.equal(hits.length, 1);
  // SECURITY: must NOT return raw token in violation detail
  assert.equal('token' in hits[0], false);
  assert.equal(typeof hits[0].fingerprint, 'string');
  // Preview is length-only — no value-derived characters
  assert.match(hits[0].preview, /^<redacted len=\d+>$/);
});

test('scanByFingerprint: catches trailing punctuation variants (secret. / secret, / secret;)', () => {
  const value = 'supersecret';
  const fp = new Set([sha256Prefix(value)]);
  for (const form of [`${value}.`, `${value},`, `${value};`, `(${value})`, `[${value}]`]) {
    const hits = scanByFingerprint(`prefix ${form} suffix`, fp);
    assert.equal(hits.length, 1, `form=${form} should be caught`);
    assert.equal(hits[0].fingerprint, sha256Prefix(value));
  }
});

test('scanByFingerprint: catches assignment RHS variants (key=secret / key:secret / key =secret)', () => {
  const value = 'supersecret';
  const fp = new Set([sha256Prefix(value)]);
  for (const form of [
    `pwd=${value}`,
    `apikey:${value}`,
    `token=${value}.`,
    `pwd =${value}`,        // whitespace before `=` → token starts with `=`
    `key  : ${value}`,      // whitespace around `:`
  ]) {
    const hits = scanByFingerprint(`some ${form} more`, fp);
    assert.equal(hits.length, 1, `form=${JSON.stringify(form)} should be caught`);
    assert.equal(hits[0].fingerprint, sha256Prefix(value));
  }
});

test('scanByFingerprint: preview is length-only — never reveals any value-derived chars', () => {
  const secret = 'do-not-leak-this-secret-value';
  const fp = new Set([sha256Prefix(secret)]);
  const hits = scanByFingerprint(`embedded ${secret}. trailing`, fp);
  assert.equal(hits.length, 1);
  const serialized = JSON.stringify(hits[0]);
  // Neither full secret nor any 2+ char fragment of it appears
  assert.equal(serialized.includes(secret), false);
  // Specifically: the first 2 chars `do` and last 2 chars `ue` must NOT leak
  assert.equal(hits[0].preview, '<redacted len=29>');
});

test('scanByFingerprint: short secrets get bare length preview', () => {
  const secret = 'abcd';
  const fp = new Set([sha256Prefix(secret)]);
  const hits = scanByFingerprint(`see ${secret} here`, fp);
  assert.equal(hits.length, 1);
  assert.equal(hits[0].preview, '<redacted len=4>');
});

test('scanByFingerprint: empty fingerprint set short-circuits', () => {
  const hits = scanByFingerprint('any text here', new Set());
  assert.deepEqual(hits, []);
});

test('scanByFingerprint: tokenizes on markdown delimiters', () => {
  const value = 'secret-token-X';
  const fp = new Set([sha256Prefix(value)]);
  const md = `quoted "${value}", piped |${value}|, parens (${value})`;
  const hits = scanByFingerprint(md, fp);
  // All three occurrences are the same token after tokenization → dedup → 1 hit
  assert.equal(hits.length, 1);
});

// ---------- Rule 1b: pii_leak_regex ----------

test('Rule 1b: report with email → critical regex violation', () => {
  const md = buildReport({
    rows: [
      { field: 'txHash', priority: 'primary', anchor: 'JTBD', rationale: 'see test@example.org' },
      { field: 'amount', priority: 'primary', anchor: 'CognitiveLoadTheory', rationale: 'core' },
      { field: 'gasUsed', priority: 'on_demand', anchor: 'ProgressiveDisclosure', rationale: 'detail' },
    ],
  });
  const result = validate(md, {
    fieldNames: ['txHash', 'amount', 'gasUsed'],
    allowedPrinciples: ALLOWED_PRINCIPLES,
    allowedAntiPatterns: ALLOWED_ANTI_PATTERNS,
    forbiddenFingerprints: new Set(),
  });
  const v = result.violations.find((x) => x.rule === 'pii_leak_regex');
  assert.ok(v, 'pii_leak_regex must fire on email');
  assert.equal(v.severity, 'critical');
  assert.ok(v.detail.some((d) => d.pattern === 'email'));
  // SECURITY: detail must not surface raw matched value
  assert.ok(v.detail.every((d) => !('value' in d)));
  assert.ok(v.detail.every((d) => typeof d.preview === 'string'));
});

test('Rule 1b: SSN format triggers national_id (no raw value in hit)', () => {
  const hits = scanForPIIPatterns('user data: 123-45-6789 in body', { domain: null });
  const ssn = hits.find((h) => h.pattern === 'national_id');
  assert.ok(ssn);
  assert.equal('value' in ssn, false);
  assert.equal(ssn.preview, '<redacted len=11>');
});

test('Rule 1b: Taiwan national ID triggers national_id (no raw value in hit)', () => {
  const hits = scanForPIIPatterns('id A123456789 was found', { domain: null });
  const tid = hits.find((h) => h.pattern === 'national_id');
  assert.ok(tid);
  assert.equal('value' in tid, false);
  assert.equal(tid.preview, '<redacted len=10>');
});

test('Rule 1b: E.164 phone in markdown context (preview only)', () => {
  const hits = scanForPIIPatterns('call (+886912345678) now', { domain: null });
  const phone = hits.find((h) => h.pattern === 'phone');
  assert.ok(phone);
  assert.equal('value' in phone, false);
  assert.equal(phone.preview, '<redacted len=13>');
});

test('Rule 1b: E.164 phone tolerates wider terminator set', () => {
  for (const terminator of [';', '!', '?', '"', "'", ']', '}', ':']) {
    const hits = scanForPIIPatterns(`phone +886912345678${terminator} foo`, { domain: null });
    const phone = hits.find((h) => h.pattern === 'phone');
    assert.ok(phone, `terminator=${JSON.stringify(terminator)} must still match`);
  }
});

test('Rule 1b: E.164 phone rejects letter-adjacent embeddings (abc+12345678def → no match)', () => {
  const hitsEmbedded = scanForPIIPatterns('abc+12345678def and foo+886912345678bar', {
    domain: null,
  });
  assert.equal(hitsEmbedded.find((h) => h.pattern === 'phone'), undefined);
});

test('Rule 1b: E.164 phone still detects standalone numbers around prose', () => {
  const hits = scanForPIIPatterns('please call +886912345678 if needed', { domain: null });
  assert.ok(hits.find((h) => h.pattern === 'phone'));
});

test('Rule 1b: domain=crypto desensitizes 0x... addresses and hashes', () => {
  const md = `tx 0x1111111111111111111111111111111111111111 hash 0x${'a'.repeat(64)}`;
  const cryptoHits = scanForPIIPatterns(md, { domain: 'crypto' });
  assert.equal(cryptoHits.find((h) => h.pattern === 'eth_address'), undefined);
  assert.equal(cryptoHits.find((h) => h.pattern === 'eth_hash'), undefined);
  const nonCryptoHits = scanForPIIPatterns(md, { domain: null });
  assert.ok(nonCryptoHits.some((h) => h.pattern === 'eth_address'));
  assert.ok(nonCryptoHits.some((h) => h.pattern === 'eth_hash'));
});

// ---------- Rule 2: missing_decision ----------

test('Rule 2: every fieldName has a row → no missing_decision violation', () => {
  const md = buildReport();
  const result = validate(md, {
    fieldNames: ['txHash', 'amount', 'gasUsed'],
    allowedPrinciples: ALLOWED_PRINCIPLES,
    allowedAntiPatterns: ALLOWED_ANTI_PATTERNS,
    forbiddenFingerprints: new Set(),
  });
  assert.equal(result.violations.find((v) => v.rule === 'missing_decision'), undefined);
});

test('Rule 2: missing fieldName → critical violation', () => {
  const md = buildReport(); // contains txHash, amount, gasUsed
  const result = validate(md, {
    fieldNames: ['txHash', 'amount', 'gasUsed', 'counterparty'],
    allowedPrinciples: ALLOWED_PRINCIPLES,
    allowedAntiPatterns: ALLOWED_ANTI_PATTERNS,
    forbiddenFingerprints: new Set(),
  });
  const v = result.violations.find((x) => x.rule === 'missing_decision');
  assert.ok(v);
  assert.equal(v.severity, 'critical');
  assert.deepEqual(v.detail, ['counterparty']);
  assert.equal(result.ok, false);
});

test('Rule 2: empty fieldNames passes (no enforcement)', () => {
  const md = buildReport();
  const result = validate(md, {
    fieldNames: [],
    allowedPrinciples: ALLOWED_PRINCIPLES,
    allowedAntiPatterns: ALLOWED_ANTI_PATTERNS,
    forbiddenFingerprints: new Set(),
  });
  assert.equal(result.violations.find((v) => v.rule === 'missing_decision'), undefined);
});

test('Rule 2: leading-underscore field names (_id, __typename) survive cell normalization', () => {
  const md = [
    '## 2. Field Decision Table',
    '',
    '| Field | Priority | Principle Anchor | Rationale |',
    '|-------|----------|------------------|-----------|',
    '| `_id` | primary | JTBD | mongo identifier |',
    '| `__typename` | secondary | CognitiveLoadTheory | graphql discriminator |',
    '| `account_id` | primary | JTBD | account ref |',
    '',
    '## 3. Anti-Pattern Findings',
    '',
    '| Pattern | Affected | Severity | Rationale |',
    '|---------|----------|----------|-----------|',
    '| `too_many_primary` | a | warning | r |',
    '',
    '## 4. Gap Report',
    '**UI needs but API missing**: x',
    '**API provides but UI ignores**: y',
  ].join('\n');
  const result = validate(md, {
    fieldNames: ['_id', '__typename', 'account_id'],
    allowedPrinciples: ALLOWED_PRINCIPLES,
    allowedAntiPatterns: ALLOWED_ANTI_PATTERNS,
    forbiddenFingerprints: new Set(),
  });
  assert.equal(result.violations.find((v) => v.rule === 'missing_decision'), undefined);
  assert.equal(result.ok, true);
});

test('Rule 2: backticked field names in table cells match plain fieldNames (no false missing_decision)', () => {
  // Real markdown reports commonly wrap field names in backticks for inline-code styling.
  // This must not trigger missing_decision. Italic underscores (`_x_`) are
  // intentionally NOT stripped (would break `_id` etc.); use backticks.
  const md = [
    '## 2. Field Decision Table',
    '',
    '| Field | Priority | Principle Anchor | Rationale |',
    '|-------|----------|------------------|-----------|',
    '| `txHash` | primary | JTBD | identity |',
    '| **amount** | primary | CognitiveLoadTheory | core |',
    '| `gasUsed` | on_demand | ProgressiveDisclosure | detail |',
    '',
    '## 3. Anti-Pattern Findings',
    '',
    '| Pattern | Affected Fields | Severity | Rationale |',
    '|---------|-----------------|----------|-----------|',
    '| `too_many_primary` | a, b | warning | r |',
    '',
    '## 4. Gap Report',
    '',
    '**UI needs but API missing**: x',
    '**API provides but UI ignores**: y',
  ].join('\n');
  const result = validate(md, {
    fieldNames: ['txHash', 'amount', 'gasUsed'],
    allowedPrinciples: ALLOWED_PRINCIPLES,
    allowedAntiPatterns: ALLOWED_ANTI_PATTERNS,
    forbiddenFingerprints: new Set(),
  });
  assert.equal(result.ok, true);
  assert.equal(result.violations.find((v) => v.rule === 'missing_decision'), undefined);
});

test('Rule 2: markdown link wrapper [name](url) normalizes to bare name', () => {
  const md = [
    '## 2. Field Decision Table',
    '',
    '| Field | Priority | Principle Anchor | Rationale |',
    '|-------|----------|------------------|-----------|',
    '| [txHash](#tx) | primary | JTBD | id |',
    '',
  ].join('\n');
  const rows = parseDecisionRows(md);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].fieldName, 'txHash');
});

test('parseDecisionRows: tolerates column reorder', () => {
  const md = [
    '## 2. Field Decision Table',
    '',
    '| Priority | Field | Rationale | Principle Anchor |',
    '|----------|-------|-----------|------------------|',
    '| primary | txHash | identity | JTBD |',
    '',
  ].join('\n');
  const rows = parseDecisionRows(md);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].fieldName, 'txHash');
  assert.equal(rows[0].priority, 'primary');
  assert.equal(rows[0].principleAnchor, 'JTBD');
});

test('parseDecisionRows: ignores tables outside the decision section', () => {
  const md = [
    '## Other Section',
    '',
    '| Field | Priority |',
    '|-------|----------|',
    '| irrelevant | primary |',
    '',
    '## 2. Field Decision Table',
    '',
    '| Field | Priority | Principle Anchor | Rationale |',
    '|-------|----------|------------------|-----------|',
    '| txHash | primary | JTBD | identity |',
    '',
  ].join('\n');
  const rows = parseDecisionRows(md);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].fieldName, 'txHash');
});

// ---------- Rule 3: invalid_anchor ----------

test('Rule 3: anchor outside whitelist → soft violation', () => {
  const md = buildReport({
    rows: [
      { field: 'txHash', priority: 'primary', anchor: 'JTBD', rationale: 'a' },
      { field: 'amount', priority: 'primary', anchor: 'GestaltLaw', rationale: 'b' }, // not in whitelist
      { field: 'gasUsed', priority: 'on_demand', anchor: 'ProgressiveDisclosure', rationale: 'c' },
    ],
  });
  const result = validate(md, {
    fieldNames: ['txHash', 'amount', 'gasUsed'],
    allowedPrinciples: ALLOWED_PRINCIPLES,
    allowedAntiPatterns: ALLOWED_ANTI_PATTERNS,
    forbiddenFingerprints: new Set(),
  });
  const v = result.violations.find((x) => x.rule === 'invalid_anchor');
  assert.ok(v);
  assert.equal(v.severity, 'soft');
  assert.equal(v.detail.length, 1);
  assert.equal(v.detail[0].fieldName, 'amount');
  assert.equal(v.detail[0].principleAnchor, 'GestaltLaw');
  // Ok stays true because no critical violations
  assert.equal(result.ok, true);
});

test('Rule 3: all anchors valid → no violation', () => {
  const md = buildReport();
  const result = validate(md, {
    fieldNames: ['txHash', 'amount', 'gasUsed'],
    allowedPrinciples: ALLOWED_PRINCIPLES,
    allowedAntiPatterns: ALLOWED_ANTI_PATTERNS,
    forbiddenFingerprints: new Set(),
  });
  assert.equal(result.violations.find((v) => v.rule === 'invalid_anchor'), undefined);
});

test('Rule 3: empty principleAnchor cell triggers invalid_anchor (must not silently pass)', () => {
  const md = [
    '## 2. Field Decision Table',
    '',
    '| Field | Priority | Principle Anchor | Rationale |',
    '|-------|----------|------------------|-----------|',
    '| txHash | primary |  | identity |',
    '',
    '## 3. Anti-Pattern Findings',
    '',
    '| Pattern | Affected |',
    '|---------|----------|',
    '| `too_many_primary` | a |',
    '',
    '## 4. Gap Report',
    '**UI needs but API missing**: x',
    '**API provides but UI ignores**: y',
  ].join('\n');
  const result = validate(md, {
    fieldNames: ['txHash'],
    allowedPrinciples: ALLOWED_PRINCIPLES,
    allowedAntiPatterns: ALLOWED_ANTI_PATTERNS,
    forbiddenFingerprints: new Set(),
  });
  const v = result.violations.find((x) => x.rule === 'invalid_anchor');
  assert.ok(v);
  assert.equal(v.severity, 'soft');
  assert.equal(v.detail.length, 1);
  assert.equal(v.detail[0].fieldName, 'txHash');
  assert.equal(v.detail[0].principleAnchor, '<empty>');
});

test('Rule 3: empty allowedPrinciples skips the rule', () => {
  const md = buildReport({
    rows: [{ field: 'x', priority: 'primary', anchor: 'AnythingGoes', rationale: '-' }],
  });
  const result = validate(md, {
    fieldNames: ['x'],
    allowedPrinciples: [],
    allowedAntiPatterns: ALLOWED_ANTI_PATTERNS,
    forbiddenFingerprints: new Set(),
  });
  assert.equal(result.violations.find((v) => v.rule === 'invalid_anchor'), undefined);
});

// ---------- Rule 3b: invalid_priority ----------

test('Rule 3b: priority outside whitelist → soft violation', () => {
  const md = buildReport({
    rows: [
      { field: 'txHash', priority: 'primary', anchor: 'JTBD', rationale: 'a' },
      // `tertiary` is not in the closed enum (primary|secondary|on_demand|hidden)
      { field: 'amount', priority: 'tertiary', anchor: 'JTBD', rationale: 'b' },
      { field: 'gasUsed', priority: 'on_demand', anchor: 'ProgressiveDisclosure', rationale: 'c' },
    ],
  });
  const result = validate(md, {
    fieldNames: ['txHash', 'amount', 'gasUsed'],
    allowedPrinciples: ALLOWED_PRINCIPLES,
    allowedAntiPatterns: ALLOWED_ANTI_PATTERNS,
    forbiddenFingerprints: new Set(),
  });
  const v = result.violations.find((x) => x.rule === 'invalid_priority');
  assert.ok(v);
  assert.equal(v.severity, 'soft');
  assert.equal(v.detail.length, 1);
  assert.equal(v.detail[0].fieldName, 'amount');
  assert.equal(v.detail[0].priority, 'tertiary');
  // Soft violation does not flip ok=false
  assert.equal(result.ok, true);
});

test('Rule 3b: empty priority cell triggers invalid_priority', () => {
  const md = [
    '## 2. Field Decision Table',
    '',
    '| Field | Priority | Principle Anchor | Rationale |',
    '|-------|----------|------------------|-----------|',
    '| txHash | | JTBD | identity |',
    '',
    '## 3. Anti-Pattern Findings',
    '',
    '| Pattern | Affected |',
    '|---------|----------|',
    '| `too_many_primary` | a |',
    '',
    '## 4. Gap Report',
    '**UI needs but API missing**: x',
    '**API provides but UI ignores**: y',
  ].join('\n');
  const result = validate(md, {
    fieldNames: ['txHash'],
    allowedPrinciples: ALLOWED_PRINCIPLES,
    allowedAntiPatterns: ALLOWED_ANTI_PATTERNS,
    forbiddenFingerprints: new Set(),
  });
  const v = result.violations.find((x) => x.rule === 'invalid_priority');
  assert.ok(v);
  assert.equal(v.severity, 'soft');
  assert.equal(v.detail[0].fieldName, 'txHash');
  assert.equal(v.detail[0].priority, '<empty>');
});

test('Rule 3b: all four canonical priorities pass without violation', () => {
  const md = buildReport({
    rows: [
      { field: 'a', priority: 'primary', anchor: 'JTBD', rationale: '-' },
      { field: 'b', priority: 'secondary', anchor: 'JTBD', rationale: '-' },
      { field: 'c', priority: 'on_demand', anchor: 'ProgressiveDisclosure', rationale: '-' },
      { field: 'd', priority: 'hidden', anchor: 'JTBD', rationale: '-' },
    ],
  });
  const result = validate(md, {
    fieldNames: ['a', 'b', 'c', 'd'],
    allowedPrinciples: ALLOWED_PRINCIPLES,
    allowedAntiPatterns: ALLOWED_ANTI_PATTERNS,
    forbiddenFingerprints: new Set(),
  });
  assert.equal(result.violations.find((v) => v.rule === 'invalid_priority'), undefined);
});

test('Rule 3b: empty allowedPriorities skips the rule', () => {
  const md = buildReport({
    rows: [{ field: 'x', priority: 'tertiary', anchor: 'JTBD', rationale: '-' }],
  });
  const result = validate(md, {
    fieldNames: ['x'],
    allowedPrinciples: ALLOWED_PRINCIPLES,
    allowedPriorities: [],
    allowedAntiPatterns: ALLOWED_ANTI_PATTERNS,
    forbiddenFingerprints: new Set(),
  });
  assert.equal(result.violations.find((v) => v.rule === 'invalid_priority'), undefined);
});

test('Rule 3b: backticked + asterisk-wrapped priority cells normalize before whitelist check', () => {
  const md = [
    '# UI First-Principles Analysis',
    '',
    '## 2. Field Decision Table',
    '',
    '| Field | Priority | Principle Anchor | Rationale |',
    '|-------|----------|------------------|-----------|',
    '| a | `primary` | JTBD | r1 |',
    '| b | **secondary** | JTBD | r2 |',
    '| c | *on_demand* | JTBD | r3 |',
    '',
    '## 3. Anti-Pattern Findings',
    '',
    '| Pattern | Affected Fields | Severity | Rationale |',
    '|---------|----------------|----------|-----------|',
    '| (none detected) | — | info | clean |',
    '',
    '## 4. Gap Report',
    '**UI needs but API missing**: none',
    '**API provides but UI ignores**: none',
  ].join('\n');
  const result = validate(md, {
    fieldNames: ['a', 'b', 'c'],
    allowedPrinciples: ALLOWED_PRINCIPLES,
    allowedAntiPatterns: ALLOWED_ANTI_PATTERNS,
    forbiddenFingerprints: new Set(),
  });
  assert.equal(result.violations.find((v) => v.rule === 'invalid_priority'), undefined);
});

test('Rule 3b: priority column appearing after anchor (reordered) still validates', () => {
  const md = [
    '# UI First-Principles Analysis',
    '',
    '## 2. Field Decision Table',
    '',
    '| Field | Principle Anchor | Priority | Rationale |',
    '|-------|------------------|----------|-----------|',
    '| a | JTBD | tertiary | r1 |',
    '',
    '## 3. Anti-Pattern Findings',
    '',
    '| Pattern | Affected Fields | Severity | Rationale |',
    '|---------|----------------|----------|-----------|',
    '| (none detected) | — | info | clean |',
    '',
    '## 4. Gap Report',
    '**UI needs but API missing**: none',
    '**API provides but UI ignores**: none',
  ].join('\n');
  const result = validate(md, {
    fieldNames: ['a'],
    allowedPrinciples: ALLOWED_PRINCIPLES,
    allowedAntiPatterns: ALLOWED_ANTI_PATTERNS,
    forbiddenFingerprints: new Set(),
  });
  const v = result.violations.find((x) => x.rule === 'invalid_priority');
  assert.ok(v, 'should still flag tertiary even with reordered columns');
  assert.equal(v.detail[0].priority, 'tertiary');
});

// ---------- Shared safeEnumValue (Rules 3 / 3b PII discipline) ----------

test('safeEnumValue: empty / whitespace → "<empty>"', () => {
  assert.equal(safeEnumValue('', { fpSet: new Set(), domain: null }), '<empty>');
  assert.equal(safeEnumValue('   ', { fpSet: new Set(), domain: null }), '<empty>');
  assert.equal(safeEnumValue(undefined, { fpSet: new Set(), domain: null }), '<empty>');
});

test('safeEnumValue: enum-like typo echoes as-is so retry context is actionable', () => {
  assert.equal(safeEnumValue('tertiary', { fpSet: new Set(), domain: null }), 'tertiary');
  assert.equal(safeEnumValue('Primary', { fpSet: new Set(), domain: null }), 'Primary');
});

test('safeEnumValue: fingerprint-matched cell is length-only redacted (no re-leak)', () => {
  const secret = 'supersecret-token';
  const fp = sha256Prefix(secret);
  const out = safeEnumValue(secret, { fpSet: new Set([fp]), domain: null });
  assert.match(out, /^<redacted len=\d+>$/);
  assert.ok(!out.includes('supersecret'));
});

test('safeEnumValue: PII-shaped cell (email) is length-only redacted', () => {
  const out = safeEnumValue('attacker@example.com', { fpSet: new Set(), domain: null });
  assert.match(out, /^<redacted len=\d+>$/);
  assert.ok(!out.includes('@'));
});

test('safeEnumValue: long prose cell is length-only redacted', () => {
  const prose = 'a'.repeat(64);
  const out = safeEnumValue(prose, { fpSet: new Set(), domain: null });
  assert.match(out, /^<redacted len=64>$/);
});

test('Rule 3 / 3b detail must not echo a fingerprint-matched value', () => {
  // LLM smuggles a sensitive token into both the Priority and Anchor cells.
  // Without safeEnumValue routing, the soft violation would re-expose `secret`
  // in retry context. With it, both report only `<redacted len=N>`.
  const secret = 'pwd-1234abcd';
  const fp = sha256Prefix(secret);
  const md = [
    '# UI First-Principles Analysis',
    '',
    '## 2. Field Decision Table',
    '',
    '| Field | Priority | Principle Anchor | Rationale |',
    '|-------|----------|------------------|-----------|',
    `| a | ${secret} | ${secret} | rationale |`,
    '',
    '## 3. Anti-Pattern Findings',
    '',
    '| Pattern | Affected Fields | Severity | Rationale |',
    '|---------|----------------|----------|-----------|',
    '| (none detected) | — | info | clean |',
    '',
    '## 4. Gap Report',
    '**UI needs but API missing**: none',
    '**API provides but UI ignores**: none',
  ].join('\n');
  const result = validate(md, {
    fieldNames: ['a'],
    allowedPrinciples: ALLOWED_PRINCIPLES,
    allowedAntiPatterns: ALLOWED_ANTI_PATTERNS,
    forbiddenFingerprints: new Set([fp]),
  });
  const anchor = result.violations.find((v) => v.rule === 'invalid_anchor');
  const priority = result.violations.find((v) => v.rule === 'invalid_priority');
  assert.ok(anchor, 'invalid_anchor should fire');
  assert.ok(priority, 'invalid_priority should fire');
  assert.match(anchor.detail[0].principleAnchor, /^<redacted len=\d+>$/);
  assert.match(priority.detail[0].priority, /^<redacted len=\d+>$/);
  assert.ok(!JSON.stringify(result.violations).includes(secret));
});

// ---------- Rule 4: gap_direction_missing ----------

test('Rule 4: both directions present → no violation', () => {
  const md = buildReport();
  const result = validate(md, {
    fieldNames: ['txHash', 'amount', 'gasUsed'],
    allowedPrinciples: ALLOWED_PRINCIPLES,
    allowedAntiPatterns: ALLOWED_ANTI_PATTERNS,
    forbiddenFingerprints: new Set(),
  });
  assert.equal(result.violations.find((v) => v.rule === 'gap_direction_missing'), undefined);
});

test('Rule 4: only UI direction → soft violation', () => {
  const md = buildReport({
    gapBlock: '**UI needs but API missing**: counterparty_alias',
  });
  const result = validate(md, {
    fieldNames: ['txHash', 'amount', 'gasUsed'],
    allowedPrinciples: ALLOWED_PRINCIPLES,
    allowedAntiPatterns: ALLOWED_ANTI_PATTERNS,
    forbiddenFingerprints: new Set(),
  });
  const v = result.violations.find((x) => x.rule === 'gap_direction_missing');
  assert.ok(v);
  assert.equal(v.detail.hasUIDirection, true);
  assert.equal(v.detail.hasAPIDirection, false);
});

test('Rule 4: missing entire Gap Report section → both directions missing', () => {
  const md = buildReport({ includeGapSection: false });
  const result = validate(md, {
    fieldNames: ['txHash', 'amount', 'gasUsed'],
    allowedPrinciples: ALLOWED_PRINCIPLES,
    allowedAntiPatterns: ALLOWED_ANTI_PATTERNS,
    forbiddenFingerprints: new Set(),
  });
  const v = result.violations.find((x) => x.rule === 'gap_direction_missing');
  assert.ok(v);
  assert.equal(v.detail.hasUIDirection, false);
  assert.equal(v.detail.hasAPIDirection, false);
});

test('Rule 4: snake_case key form ui_needs_but_api_missing also recognized', () => {
  const md = buildReport({
    gapBlock:
      '`ui_needs_but_api_missing: ["x"]`\n`api_provides_but_ui_ignores: ["y"]`',
  });
  const result = validate(md, {
    fieldNames: ['txHash', 'amount', 'gasUsed'],
    allowedPrinciples: ALLOWED_PRINCIPLES,
    allowedAntiPatterns: ALLOWED_ANTI_PATTERNS,
    forbiddenFingerprints: new Set(),
  });
  assert.equal(result.violations.find((v) => v.rule === 'gap_direction_missing'), undefined);
});

// ---------- Rule 5: anti-pattern ----------

test('Rule 5: anti-pattern section present + IDs whitelisted → no violation', () => {
  const md = buildReport();
  const result = validate(md, {
    fieldNames: ['txHash', 'amount', 'gasUsed'],
    allowedPrinciples: ALLOWED_PRINCIPLES,
    allowedAntiPatterns: ALLOWED_ANTI_PATTERNS,
    forbiddenFingerprints: new Set(),
  });
  assert.equal(result.violations.find((v) => v.rule === 'anti_pattern_missing'), undefined);
  assert.equal(result.violations.find((v) => v.rule === 'invalid_anti_pattern_id'), undefined);
});

test('Rule 5: missing anti-pattern section → soft anti_pattern_missing', () => {
  const md = buildReport({ includeAntiPatternSection: false });
  const result = validate(md, {
    fieldNames: ['txHash', 'amount', 'gasUsed'],
    allowedPrinciples: ALLOWED_PRINCIPLES,
    allowedAntiPatterns: ALLOWED_ANTI_PATTERNS,
    forbiddenFingerprints: new Set(),
  });
  const v = result.violations.find((x) => x.rule === 'anti_pattern_missing');
  assert.ok(v);
  assert.equal(v.severity, 'soft');
});

test('Rule 5: invalid ID triggers invalid_anti_pattern_id', () => {
  const md = buildReport({
    antiPatterns: [
      { id: 'too_many_primary', fields: 'a, b', rationale: 'r' },
      { id: 'invented_pattern', fields: 'c', rationale: 'r' },
    ],
  });
  const result = validate(md, {
    fieldNames: ['txHash', 'amount', 'gasUsed'],
    allowedPrinciples: ALLOWED_PRINCIPLES,
    allowedAntiPatterns: ALLOWED_ANTI_PATTERNS,
    forbiddenFingerprints: new Set(),
  });
  const v = result.violations.find((x) => x.rule === 'invalid_anti_pattern_id');
  assert.ok(v);
  assert.deepEqual(v.detail, ['invented_pattern']);
});

test('parseAntiPatterns: extracts IDs from Pattern column only — backticked field names in other cells ignored', () => {
  const text = [
    '## Anti-Pattern Findings',
    '',
    '| Pattern | Affected Fields | Severity | Rationale |',
    '|---------|-----------------|----------|-----------|',
    '| `too_many_primary` | `txHash`, `raw_signature`, `gas_price` | warning | r1 |',
    '| `redundant_fields` | `from_addr`, `sender_addr` | info | r2 |',
  ].join('\n');
  const ap = parseAntiPatterns(text);
  assert.equal(ap.present, true);
  // Only IDs from the `Pattern` column — `raw_signature`, `gas_price`, etc.
  // (which appear backticked in the Affected Fields column) must NOT leak in.
  assert.deepEqual(ap.ids.sort(), ['redundant_fields', 'too_many_primary']);
});

test('parseAntiPatterns: falls back to backticked list-item IDs when no table is present', () => {
  const text = [
    '## Anti-Pattern Findings',
    '',
    'Detected:',
    '- `too_many_primary`: too many primaries',
    '- `redundant_fields`: same info twice',
    '',
    'Mention of `unrelated_token` in prose should not count.',
  ].join('\n');
  const ap = parseAntiPatterns(text);
  assert.deepEqual(ap.ids.sort(), ['redundant_fields', 'too_many_primary']);
});

test('parseAntiPatterns: prose-only section reports structured=false (no ID extraction)', () => {
  // Prose-only is intentionally NOT scanned for backticked IDs — narrative
  // could mention backticked field names like `raw_signature` and pollute IDs.
  // Instead, mark structured=false so the validator emits anti_pattern_unstructured.
  const text = [
    '## Anti-Pattern Findings',
    '',
    'The report flags `too_many_primary` because fields `raw_signature` and `gas_price` are noisy.',
  ].join('\n');
  const ap = parseAntiPatterns(text);
  assert.equal(ap.present, true);
  assert.equal(ap.structured, false);
  assert.deepEqual(ap.ids, []);
});

test('Rule 5: anti_pattern_unstructured fires when section has prose but no table/list', () => {
  const md = [
    '## 2. Field Decision Table',
    '',
    '| Field | Priority | Principle Anchor | Rationale |',
    '|-------|----------|------------------|-----------|',
    '| txHash | primary | JTBD | identity |',
    '',
    '## 3. Anti-Pattern Findings',
    '',
    'No structured findings — prose only mentioning `too_many_primary`.',
    '',
    '## 4. Gap Report',
    '**UI needs but API missing**: x',
    '**API provides but UI ignores**: y',
  ].join('\n');
  const result = validate(md, {
    fieldNames: ['txHash'],
    allowedPrinciples: ALLOWED_PRINCIPLES,
    allowedAntiPatterns: ALLOWED_ANTI_PATTERNS,
    forbiddenFingerprints: new Set(),
  });
  const v = result.violations.find((x) => x.rule === 'anti_pattern_unstructured');
  assert.ok(v, 'must emit anti_pattern_unstructured');
  assert.equal(v.severity, 'soft');
  // Must NOT emit invalid_anti_pattern_id from prose-scanned `too_many_primary`
  assert.equal(result.violations.find((x) => x.rule === 'invalid_anti_pattern_id'), undefined);
});

// ---------- Combined / integration ----------

test('integration: multiple critical violations → ok=false', () => {
  const md = buildReport({
    rows: [
      { field: 'txHash', priority: 'primary', anchor: 'JTBD', rationale: 'has alice@example.com' },
    ],
  });
  const result = validate(md, {
    fieldNames: ['txHash', 'amount', 'gasUsed'],
    allowedPrinciples: ALLOWED_PRINCIPLES,
    allowedAntiPatterns: ALLOWED_ANTI_PATTERNS,
    forbiddenFingerprints: new Set([sha256Prefix('alice@example.com')]),
  });
  assert.equal(result.ok, false);
  const ruleNames = new Set(result.violations.map((v) => v.rule));
  assert.ok(ruleNames.has('pii_leak_fingerprint'));
  assert.ok(ruleNames.has('pii_leak_regex'));
  assert.ok(ruleNames.has('missing_decision'));
});

test('integration: clean report → ok=true with empty violations', () => {
  const md = buildReport();
  const result = validate(md, {
    fieldNames: ['txHash', 'amount', 'gasUsed'],
    allowedPrinciples: ALLOWED_PRINCIPLES,
    allowedAntiPatterns: ALLOWED_ANTI_PATTERNS,
    forbiddenFingerprints: new Set(),
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.violations, []);
});

test('integration: clean report under crypto domain (legitimate addresses kept)', () => {
  const md = buildReport({
    rows: [
      {
        field: 'from',
        priority: 'primary',
        anchor: 'JTBD',
        rationale: 'sender 0x1111111111111111111111111111111111111111',
      },
      { field: 'amount', priority: 'primary', anchor: 'CognitiveLoadTheory', rationale: 'core' },
      { field: 'gasUsed', priority: 'on_demand', anchor: 'ProgressiveDisclosure', rationale: 'detail' },
    ],
  });
  const result = validate(md, {
    fieldNames: ['from', 'amount', 'gasUsed'],
    allowedPrinciples: ALLOWED_PRINCIPLES,
    allowedAntiPatterns: ALLOWED_ANTI_PATTERNS,
    forbiddenFingerprints: new Set(),
    domain: 'crypto',
  });
  assert.equal(result.ok, true);
  assert.equal(result.violations.find((v) => v.rule === 'pii_leak_regex'), undefined);
});

test('integration: domain=null treats 0x address as eth_address PII (critical)', () => {
  const md = buildReport({
    rows: [
      { field: 'txHash', priority: 'primary', anchor: 'JTBD', rationale: 'see 0x1111111111111111111111111111111111111111' },
      { field: 'amount', priority: 'primary', anchor: 'CognitiveLoadTheory', rationale: 'a' },
      { field: 'gasUsed', priority: 'on_demand', anchor: 'ProgressiveDisclosure', rationale: 'b' },
    ],
  });
  const result = validate(md, {
    fieldNames: ['txHash', 'amount', 'gasUsed'],
    allowedPrinciples: ALLOWED_PRINCIPLES,
    allowedAntiPatterns: ALLOWED_ANTI_PATTERNS,
    forbiddenFingerprints: new Set(),
    domain: null,
  });
  const v = result.violations.find((x) => x.rule === 'pii_leak_regex');
  assert.ok(v);
  assert.ok(v.detail.some((d) => d.pattern === 'eth_address'));
});

// ---------- Robustness ----------

test('validate: handles non-string markdown defensively', () => {
  const result = validate(null, {
    fieldNames: ['x'],
    allowedPrinciples: ALLOWED_PRINCIPLES,
    allowedAntiPatterns: ALLOWED_ANTI_PATTERNS,
    forbiddenFingerprints: new Set(),
  });
  // No markdown means missing_decision must fire (critical)
  assert.equal(result.ok, false);
  assert.ok(result.violations.find((v) => v.rule === 'missing_decision'));
});

test('validate: forbiddenFingerprints accepts array form', () => {
  const md = `something secret-token-X here`;
  const result = validate(md, {
    fieldNames: [],
    allowedPrinciples: ALLOWED_PRINCIPLES,
    allowedAntiPatterns: ALLOWED_ANTI_PATTERNS,
    forbiddenFingerprints: [sha256Prefix('secret-token-X')],
  });
  const v = result.violations.find((x) => x.rule === 'pii_leak_fingerprint');
  assert.ok(v);
});

// ---------- Markdown helpers ----------

test('extractTablesFromText: parses simple table', () => {
  const t = [
    '| A | B |',
    '|---|---|',
    '| 1 | 2 |',
    '| 3 | 4 |',
  ].join('\n');
  const tables = extractTablesFromText(t);
  assert.equal(tables.length, 1);
  assert.deepEqual(tables[0].header, ['A', 'B']);
  assert.equal(tables[0].rows.length, 2);
});

test('extractSectionByHeading: captures content until next same-or-higher heading', () => {
  const md = [
    '# Top',
    'intro',
    '## Target Section',
    'body line 1',
    'body line 2',
    '## Other',
    'should not capture',
  ].join('\n');
  const sec = extractSectionByHeading(md, /target/i);
  assert.ok(sec.includes('body line 1'));
  assert.ok(sec.includes('body line 2'));
  assert.equal(sec.includes('should not capture'), false);
});

test('sha256Prefix: deterministic + fixed format', () => {
  const a = sha256Prefix('hello');
  const b = sha256Prefix('hello');
  assert.equal(a, b);
  assert.match(a, /^sha256:[0-9a-f]{12}$/);
});

// ---------- CLI entry point (Phase 7 invocation contract) ----------

function inMemoryFs(files) {
  return {
    readFileSync(p, _enc) {
      if (!(p in files)) {
        const err = new Error(`ENOENT: ${p}`);
        err.code = 'ENOENT';
        throw err;
      }
      return files[p];
    },
  };
}

function captureIO() {
  const out = [];
  const err = [];
  let exitCode = null;
  return {
    stdout: { write: (s) => out.push(s) },
    stderr: { write: (s) => err.push(s) },
    exit: (c) => { exitCode = c; },
    out, err,
    get exitCode() { return exitCode; },
  };
}

test('CLI: --report + --bundle drives validate() and emits JSON on stdout', () => {
  const md = [
    '## 2. Field Decision Table',
    '',
    '| Field | Priority | Principle Anchor | Rationale |',
    '|-------|----------|------------------|-----------|',
    '| txHash | primary | JTBD | identity |',
    '',
    '## 3. Anti-Pattern Findings',
    '| Pattern | Affected Fields | Severity | Rationale |',
    '|---------|----------------|----------|-----------|',
    '| (none detected) | — | info | clean |',
    '',
    '## 4. Gap Report',
    '**UI needs but API missing**: none',
    '**API provides but UI ignores**: none',
  ].join('\n');
  const bundle = JSON.stringify({
    fields: [{ name: 'txHash' }],
    allowedPrinciples: ALLOWED_PRINCIPLES,
    allowedAntiPatterns: ALLOWED_ANTI_PATTERNS,
    forbiddenFingerprints: [],
  });
  const io = captureIO();
  io.fs = inMemoryFs({ '/r.md': md, '/b.json': bundle });
  runCli(['--report', '/r.md', '--bundle', '/b.json'], io);
  assert.equal(io.exitCode, 0);
  const parsed = JSON.parse(io.out.join(''));
  assert.equal(parsed.ok, true);
  assert.deepEqual(parsed.violations, []);
});

test('CLI: missing flags exits 2 with structured error', () => {
  const io = captureIO();
  io.fs = inMemoryFs({});
  runCli([], io);
  assert.equal(io.exitCode, 2);
  const parsed = JSON.parse(io.out.join(''));
  assert.equal(parsed.ok, false);
  assert.equal(parsed.error, 'cli_args');
});

test('CLI: unreadable bundle exits 2 with unreadable_bundle error', () => {
  const io = captureIO();
  io.fs = inMemoryFs({ '/r.md': '# empty' });
  runCli(['--report', '/r.md', '--bundle', '/missing.json'], io);
  assert.equal(io.exitCode, 2);
  const parsed = JSON.parse(io.out.join(''));
  assert.equal(parsed.error, 'unreadable_bundle');
});

test('CLI: malformed bundle (null) → invalid_bundle exit 2', () => {
  const io = captureIO();
  io.fs = inMemoryFs({ '/r.md': '# x', '/b.json': 'null' });
  runCli(['--report', '/r.md', '--bundle', '/b.json'], io);
  assert.equal(io.exitCode, 2);
  const parsed = JSON.parse(io.out.join(''));
  assert.equal(parsed.error, 'invalid_bundle');
});

test('CLI: malformed bundle (forbiddenFingerprints not array) → invalid_bundle exit 2', () => {
  const io = captureIO();
  io.fs = inMemoryFs({
    '/r.md': '# x',
    '/b.json': JSON.stringify({ fields: [], forbiddenFingerprints: { sha: 'sha256:abc' } }),
  });
  runCli(['--report', '/r.md', '--bundle', '/b.json'], io);
  assert.equal(io.exitCode, 2);
  const parsed = JSON.parse(io.out.join(''));
  assert.equal(parsed.error, 'invalid_bundle');
  assert.match(parsed.detail, /forbiddenFingerprints/);
});

test('CLI: malformed bundle (top-level array) → invalid_bundle exit 2', () => {
  const io = captureIO();
  io.fs = inMemoryFs({ '/r.md': '# x', '/b.json': '[]' });
  runCli(['--report', '/r.md', '--bundle', '/b.json'], io);
  assert.equal(io.exitCode, 2);
  const parsed = JSON.parse(io.out.join(''));
  assert.equal(parsed.error, 'invalid_bundle');
  assert.match(parsed.detail, /must be a JSON object/);
});

test('CLI: malformed bundle (top-level primitive) → invalid_bundle exit 2', () => {
  const io = captureIO();
  io.fs = inMemoryFs({ '/r.md': '# x', '/b.json': '"oops"' });
  runCli(['--report', '/r.md', '--bundle', '/b.json'], io);
  assert.equal(io.exitCode, 2);
  const parsed = JSON.parse(io.out.join(''));
  assert.equal(parsed.error, 'invalid_bundle');
  assert.match(parsed.detail, /must be a JSON object/);
});

// Bundle allowlist hardening: a non-array `allowedPrinciples` (or any of the
// peers below) would silently disable Rules 2/3/3b/5 in the validator,
// turning soft enforcement into a no-op — exactly the failure mode that
// Codex flagged as P2. These cover all four required-array slots.
for (const key of ['fields', 'allowedPrinciples', 'allowedPriorities', 'allowedAntiPatterns']) {
  test(`CLI: malformed bundle (${key} non-array) → invalid_bundle exit 2`, () => {
    const io = captureIO();
    const bundle = { fields: [], allowedPrinciples: ['JTBD'], allowedPriorities: ['primary'], allowedAntiPatterns: ['too_many_primary'] };
    bundle[key] = 'not-an-array';
    io.fs = inMemoryFs({ '/r.md': '# x', '/b.json': JSON.stringify(bundle) });
    runCli(['--report', '/r.md', '--bundle', '/b.json'], io);
    assert.equal(io.exitCode, 2);
    const parsed = JSON.parse(io.out.join(''));
    assert.equal(parsed.error, 'invalid_bundle');
    assert.match(parsed.detail, new RegExp(key));
  });
}

// Element-shape hardening: array-with-wrong-element-type would silently
// disable rules. Codex's deeper P2: `fields: ["amount"]` → map(f=>f.name)
// yields undefined → filter(Boolean) → [] → Rule 2 sees no fields.
test('CLI: malformed bundle (fields: array of strings) → invalid_bundle exit 2', () => {
  const io = captureIO();
  io.fs = inMemoryFs({
    '/r.md': '# x',
    '/b.json': JSON.stringify({ fields: ['amount', 'symbol'] }),
  });
  runCli(['--report', '/r.md', '--bundle', '/b.json'], io);
  assert.equal(io.exitCode, 2);
  const parsed = JSON.parse(io.out.join(''));
  assert.equal(parsed.error, 'invalid_bundle');
  assert.match(parsed.detail, /fields/);
});

test('CLI: malformed bundle (fields: [null]) → invalid_bundle exit 2', () => {
  const io = captureIO();
  io.fs = inMemoryFs({
    '/r.md': '# x',
    '/b.json': JSON.stringify({ fields: [null] }),
  });
  runCli(['--report', '/r.md', '--bundle', '/b.json'], io);
  assert.equal(io.exitCode, 2);
  const parsed = JSON.parse(io.out.join(''));
  assert.equal(parsed.error, 'invalid_bundle');
  assert.match(parsed.detail, /fields/);
});

test('CLI: malformed bundle (fields: [{name: ""}]) → invalid_bundle exit 2', () => {
  const io = captureIO();
  io.fs = inMemoryFs({
    '/r.md': '# x',
    '/b.json': JSON.stringify({ fields: [{ name: '' }] }),
  });
  runCli(['--report', '/r.md', '--bundle', '/b.json'], io);
  assert.equal(io.exitCode, 2);
  const parsed = JSON.parse(io.out.join(''));
  assert.equal(parsed.error, 'invalid_bundle');
});

test('CLI: malformed bundle (forbiddenFingerprints: [{}]) → invalid_bundle exit 2', () => {
  const io = captureIO();
  io.fs = inMemoryFs({
    '/r.md': '# x',
    '/b.json': JSON.stringify({ fields: [], forbiddenFingerprints: [{ sha: 'abc' }] }),
  });
  runCli(['--report', '/r.md', '--bundle', '/b.json'], io);
  assert.equal(io.exitCode, 2);
  const parsed = JSON.parse(io.out.join(''));
  assert.equal(parsed.error, 'invalid_bundle');
  assert.match(parsed.detail, /forbiddenFingerprints/);
});

for (const key of ['allowedPrinciples', 'allowedPriorities', 'allowedAntiPatterns']) {
  test(`CLI: malformed bundle (${key}: array of non-strings) → invalid_bundle exit 2`, () => {
    const io = captureIO();
    const bundle = { fields: [], allowedPrinciples: ['JTBD'], allowedPriorities: ['primary'], allowedAntiPatterns: ['too_many_primary'] };
    bundle[key] = [123, null];
    io.fs = inMemoryFs({ '/r.md': '# x', '/b.json': JSON.stringify(bundle) });
    runCli(['--report', '/r.md', '--bundle', '/b.json'], io);
    assert.equal(io.exitCode, 2);
    const parsed = JSON.parse(io.out.join(''));
    assert.equal(parsed.error, 'invalid_bundle');
    assert.match(parsed.detail, new RegExp(key));
  });
}

// Empty-allowlist hardening: validate() gates Rules 3/3b/5 on
// `allowed*.length > 0`, so an explicit `[]` would silently disable
// enforcement. CLI rejects empty allowlists when the key is present.
for (const key of ['allowedPrinciples', 'allowedPriorities', 'allowedAntiPatterns']) {
  test(`CLI: malformed bundle (${key}: []) → invalid_bundle exit 2`, () => {
    const io = captureIO();
    const bundle = { fields: [], allowedPrinciples: ['JTBD'], allowedPriorities: ['primary'], allowedAntiPatterns: ['too_many_primary'] };
    bundle[key] = [];
    io.fs = inMemoryFs({ '/r.md': '# x', '/b.json': JSON.stringify(bundle) });
    runCli(['--report', '/r.md', '--bundle', '/b.json'], io);
    assert.equal(io.exitCode, 2);
    const parsed = JSON.parse(io.out.join(''));
    assert.equal(parsed.error, 'invalid_bundle');
    assert.match(parsed.detail, new RegExp(key));
    assert.match(parsed.detail, /non-empty array/);
  });
}

// Parametric breadth: cover null/object/number variants for the non-array
// rejection path, not just the 'not-an-array' string variant. JSON-stringified
// upstream values commonly become null when undefined.
for (const key of ['fields', 'allowedPrinciples', 'allowedPriorities', 'allowedAntiPatterns']) {
  for (const badValue of [null, { fake: 'object' }, 42]) {
    test(`CLI: malformed bundle (${key}=${JSON.stringify(badValue)}) → invalid_bundle exit 2`, () => {
      const io = captureIO();
      const bundle = { fields: [], allowedPrinciples: ['JTBD'], allowedPriorities: ['primary'], allowedAntiPatterns: ['too_many_primary'] };
      bundle[key] = badValue;
      io.fs = inMemoryFs({ '/r.md': '# x', '/b.json': JSON.stringify(bundle) });
      runCli(['--report', '/r.md', '--bundle', '/b.json'], io);
      assert.equal(io.exitCode, 2);
      const parsed = JSON.parse(io.out.join(''));
      assert.equal(parsed.error, 'invalid_bundle');
      assert.match(parsed.detail, new RegExp(key));
    });
  }
}

// Order claim: when forbiddenFingerprints is a valid array AND allowedPrinciples
// is malformed, the loop downstream of the FP check must fire. Locks the
// short-circuit ordering against future refactors.
test('CLI: valid forbiddenFingerprints + non-array allowedPrinciples → reports allowedPrinciples error', () => {
  const io = captureIO();
  io.fs = inMemoryFs({
    '/r.md': '# x',
    '/b.json': JSON.stringify({ fields: [], forbiddenFingerprints: ['sha256:abc'], allowedPrinciples: 'bad' }),
  });
  runCli(['--report', '/r.md', '--bundle', '/b.json'], io);
  assert.equal(io.exitCode, 2);
  const parsed = JSON.parse(io.out.join(''));
  assert.equal(parsed.error, 'invalid_bundle');
  assert.match(parsed.detail, /allowedPrinciples/);
  assert.doesNotMatch(parsed.detail, /forbiddenFingerprints/);
});

test('CLI: legit bundle with array of valid field objects still passes', () => {
  // Anti-regression: ensure the new element-shape checks don't reject the
  // canonical Phase 2 bundle shape (fields[] of {name,...}).
  const io = captureIO();
  io.fs = inMemoryFs({
    '/r.md': [
      '## 2. Field Decision Table',
      '| Field | Priority | Principle Anchor | Rationale |',
      '|-------|----------|------------------|-----------|',
      '| amount | primary | JTBD | r |',
      '',
      '## 3. Anti-Pattern Findings',
      '_None._',
      '',
      '## 4. Gap Report',
      '**UI needs but API missing**: none',
      '**API provides but UI ignores**: none',
    ].join('\n'),
    '/b.json': JSON.stringify({
      fields: [{ name: 'amount', type: 'string' }],
      allowedPrinciples: ['JTBD'],
      allowedPriorities: ['primary'],
      allowedAntiPatterns: ['too_many_primary'],
      forbiddenFingerprints: [],
    }),
  });
  runCli(['--report', '/r.md', '--bundle', '/b.json'], io);
  assert.equal(io.exitCode, 0);
  const parsed = JSON.parse(io.out.join(''));
  assert.equal(parsed.ok, true);
});

test('Rule 5: invalid_anti_pattern_id detail must not echo a fingerprint-matched ID', () => {
  // LLM smuggles a sensitive token (snake_case so it survives the strict
  // ID regex `^[a-z][a-z0-9_]+$` in parseAntiPatterns.pushId) into the
  // Pattern column. Without safeEnumValue routing, the soft violation
  // would re-expose the token in retry context.
  const secret = 'leaktoken_9876';
  const fp = sha256Prefix(secret);
  const md = [
    '## 2. Field Decision Table',
    '| Field | Priority | Principle Anchor | Rationale |',
    '|-------|----------|------------------|-----------|',
    '| a | primary | JTBD | r |',
    '',
    '## 3. Anti-Pattern Findings',
    '| Pattern | Affected Fields | Severity | Rationale |',
    '|---------|----------------|----------|-----------|',
    `| ${secret} | a | warning | r |`,
    '',
    '## 4. Gap Report',
    '**UI needs but API missing**: none',
    '**API provides but UI ignores**: none',
  ].join('\n');
  const result = validate(md, {
    fieldNames: ['a'],
    allowedPrinciples: ALLOWED_PRINCIPLES,
    allowedAntiPatterns: ALLOWED_ANTI_PATTERNS,
    forbiddenFingerprints: new Set([fp]),
  });
  const v = result.violations.find((x) => x.rule === 'invalid_anti_pattern_id');
  assert.ok(v, 'must flag invented Pattern ID');
  // The detail array should contain a redacted preview, not the raw token.
  assert.ok(Array.isArray(v.detail));
  assert.match(v.detail[0], /^<redacted len=\d+>$/);
  // Specifically: the soft-violation detail (Rule 5) does not contain `secret`.
  // (Rule 1 critical detail uses fingerprint+previewMask too, so the violations
  // array as a whole never echoes the raw token.)
  const rule5Json = JSON.stringify(v);
  assert.ok(!rule5Json.includes(secret));
});

test('CLI: --domain crypto allowlists 0x addresses', () => {
  const md = [
    '## 2. Field Decision Table',
    '| Field | Priority | Principle Anchor | Rationale |',
    '|-------|----------|------------------|-----------|',
    '| from | primary | JTBD | sender 0x1111111111111111111111111111111111111111 |',
    '',
    '## 3. Anti-Pattern Findings',
    '| Pattern | Affected Fields | Severity | Rationale |',
    '|---------|----------------|----------|-----------|',
    '| (none detected) | — | info | clean |',
    '',
    '## 4. Gap Report',
    '**UI needs but API missing**: none',
    '**API provides but UI ignores**: none',
  ].join('\n');
  const bundle = JSON.stringify({
    fields: [{ name: 'from' }],
    allowedPrinciples: ALLOWED_PRINCIPLES,
    allowedAntiPatterns: ALLOWED_ANTI_PATTERNS,
    forbiddenFingerprints: [],
  });
  const io = captureIO();
  io.fs = inMemoryFs({ '/r.md': md, '/b.json': bundle });
  runCli(['--report', '/r.md', '--bundle', '/b.json', '--domain', 'crypto'], io);
  assert.equal(io.exitCode, 0);
  const parsed = JSON.parse(io.out.join(''));
  assert.equal(parsed.violations.find((v) => v.rule === 'pii_leak_regex'), undefined);
});
