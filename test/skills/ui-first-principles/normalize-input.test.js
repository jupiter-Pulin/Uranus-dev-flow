'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  normalize,
  fromJsonSample,
  fromManualList,
  inferType,
  projectSummary,
  MANUAL_LINE_RE,
  runCli: runNormalizeCli,
  DEFAULT_ALLOWED_PRINCIPLES,
  DEFAULT_ALLOWED_PRIORITIES,
  DEFAULT_ALLOWED_ANTI_PATTERNS,
} = require('../../../scripts/skills/ui-first-principles/normalize-input');

const {
  redact,
  runCli: runRedactCli,
} = require('../../../scripts/skills/ui-first-principles/redact');

// ---------- CLI helpers (shared by redact + normalize CLI tests) ----------

function inMemoryFs(initial = {}) {
  const files = { ...initial };
  return {
    files,
    readFileSync(p, _enc) {
      if (!(p in files)) {
        const err = new Error(`ENOENT: ${p}`);
        err.code = 'ENOENT';
        throw err;
      }
      return files[p];
    },
    writeFileSync(p, contents) {
      files[p] = contents;
    },
  };
}

function captureIO(fs) {
  const out = [];
  const err = [];
  let exitCode = null;
  return {
    stdout: { write: (s) => out.push(s) },
    stderr: { write: (s) => err.push(s) },
    exit: (c) => { exitCode = c; },
    fs,
    out, err,
    get exitCode() { return exitCode; },
  };
}

// ---------- normalize() — JSON sample path ----------

test('normalize: json_sample bundles top-level fields with type + sampleValue', () => {
  const raw = JSON.stringify({
    txHash: '0xabcdef01',
    counterparty: 'alice',
    amount: 1000,
    confirmed: true,
    metadata: { foo: 'bar' },
  });
  const r = redact(raw, { inputFormat: 'json_sample', domain: 'crypto' });
  const bundle = normalize({
    scenario: 'transaction history',
    maskedText: r.maskedText,
    fieldDecisions: r.fieldDecisions,
    inputFormat: 'json_sample',
    summary: r.summary,
  });

  assert.equal(bundle.scenario, 'transaction history');
  assert.equal(bundle.inputFormat, 'json_sample');
  const names = bundle.fields.map((f) => f.name);
  assert.deepEqual(names, ['txHash', 'counterparty', 'amount', 'confirmed', 'metadata']);

  const byName = Object.fromEntries(bundle.fields.map((f) => [f.name, f]));
  assert.equal(byName.txHash.type, 'string');
  assert.equal(byName.amount.type, 'number');
  assert.equal(byName.amount.sampleValue, '1000');
  assert.equal(byName.confirmed.type, 'boolean');
  assert.equal(byName.metadata.type, 'object');
  assert.ok(byName.metadata.sampleValue.startsWith('{'));
  assert.equal(byName.txHash.source, 'json_sample');
});

test('normalize: json_sample top-level fields include containers (object/array) but never their children', () => {
  // Build fieldDecisions manually mirroring what redact() emits for nested paths.
  // `user.email` and `transactions[0].amount` are nested decisions that must
  // NOT surface as their own top-level fields. `user` and `transactions`
  // themselves ARE top-level fields and must appear (typed as object/array)
  // so the LLM knows the schema shape.
  const fieldDecisions = [
    { path: 'scenario', fieldName: 'scenario', action: 'keep' },
    { path: 'user.email', fieldName: 'email', action: 'mask', piiClass: 'email' },
    { path: 'transactions[0].amount', fieldName: 'amount', action: 'keep' },
    { path: 'topField', fieldName: 'topField', action: 'keep' },
  ];
  const maskedText = JSON.stringify({
    scenario: 's1',
    user: { email: '<redacted:email>' },
    transactions: [{ amount: 1 }],
    topField: 'kept',
  });
  const fields = fromJsonSample(maskedText, fieldDecisions);
  const names = fields.map((f) => f.name);
  assert.deepEqual(names, ['scenario', 'user', 'transactions', 'topField']);
  // Nested children (`email`, `amount`) must not leak as separate fields.
  assert.equal(fields.find((f) => f.name === 'email'), undefined);
  // Container types are surfaced for LLM context.
  const byName = Object.fromEntries(fields.map((f) => [f.name, f]));
  assert.equal(byName.user.type, 'object');
  assert.equal(byName.transactions.type, 'array');
});

test('normalize: json_sample dedups field appearing twice in decisions', () => {
  const fieldDecisions = [
    { path: 'a', fieldName: 'a', action: 'keep' },
    { path: 'a', fieldName: 'a', action: 'keep' },
    { path: 'b', fieldName: 'b', action: 'keep' },
  ];
  const maskedText = JSON.stringify({ a: 1, b: 2 });
  const fields = fromJsonSample(maskedText, fieldDecisions);
  assert.equal(fields.length, 2);
  assert.deepEqual(
    fields.map((f) => f.name),
    ['a', 'b'],
  );
});

test('normalize: json_sample handles malformed maskedText (parse fails) — returns fields with empty sample', () => {
  const fieldDecisions = [
    { path: 'a', fieldName: 'a', action: 'keep' },
    { path: 'b', fieldName: 'b', action: 'keep' },
  ];
  const fields = fromJsonSample('not-json', fieldDecisions);
  assert.equal(fields.length, 2);
  assert.equal(fields[0].name, 'a');
  assert.equal(fields[0].sampleValue, '');
  assert.equal(fields[0].type, 'undefined');
  assert.equal(fields[0].source, 'json_sample');
});

test('normalize: json_sample handles parsed value is not an object (array) — fields empty samples', () => {
  const fieldDecisions = [{ path: 'x', fieldName: 'x', action: 'keep' }];
  const fields = fromJsonSample(JSON.stringify([1, 2, 3]), fieldDecisions);
  assert.equal(fields.length, 1);
  assert.equal(fields[0].sampleValue, '');
  assert.equal(fields[0].type, 'undefined');
});

test('normalize: json_sample handles null and primitive top-level values', () => {
  const fieldDecisions = [
    { path: 'maybe', fieldName: 'maybe', action: 'keep' },
    { path: 'count', fieldName: 'count', action: 'keep' },
    { path: 'flag', fieldName: 'flag', action: 'keep' },
    { path: 'tags', fieldName: 'tags', action: 'keep' },
  ];
  const maskedText = JSON.stringify({
    maybe: null,
    count: 0,
    flag: false,
    tags: ['a', 'b'],
  });
  const fields = fromJsonSample(maskedText, fieldDecisions);
  const byName = Object.fromEntries(fields.map((f) => [f.name, f]));
  assert.equal(byName.maybe.type, 'null');
  assert.equal(byName.maybe.sampleValue, 'null');
  assert.equal(byName.count.type, 'number');
  assert.equal(byName.count.sampleValue, '0');
  assert.equal(byName.flag.type, 'boolean');
  assert.equal(byName.flag.sampleValue, 'false');
  assert.equal(byName.tags.type, 'array');
  assert.equal(byName.tags.sampleValue, '["a","b"]');
});

test('normalize: json_sample reflects masked PII in sampleValue (LLM never sees raw)', () => {
  const raw = JSON.stringify({ email: 'alice@example.com', name: 'alice' });
  const r = redact(raw, { inputFormat: 'json_sample' });
  const bundle = normalize({
    scenario: 'profile',
    maskedText: r.maskedText,
    fieldDecisions: r.fieldDecisions,
    inputFormat: 'json_sample',
    summary: r.summary,
  });
  const email = bundle.fields.find((f) => f.name === 'email');
  assert.ok(email);
  assert.equal(email.sampleValue, '<redacted:email>');
  // Critical guarantee: raw email must not appear anywhere in the bundle
  const serialized = JSON.stringify(bundle);
  assert.equal(serialized.includes('alice@example.com'), false);
});

// ---------- normalize() — manual_list path ----------

test('normalize: manual_list parses fieldName: type lines', () => {
  const text = [
    'txHash: string',
    'amount: number',
    'confirmed: boolean',
  ].join('\n');
  const bundle = normalize({
    scenario: 'tx history',
    maskedText: text,
    fieldDecisions: [],
    inputFormat: 'manual_list',
  });
  assert.equal(bundle.fields.length, 3);
  assert.equal(bundle.fields[0].name, 'txHash');
  assert.equal(bundle.fields[0].type, 'string');
  assert.equal(bundle.fields[0].source, 'manual');
  assert.equal(bundle.fields[0].description, undefined);
});

test('normalize: manual_list preserves description in parentheses', () => {
  const text = [
    'amount: number (in wei, base unit of ETH)',
    'counterparty: string (alias if known, else address)',
  ].join('\n');
  const fields = fromManualList(text);
  assert.equal(fields.length, 2);
  assert.equal(fields[0].description, 'in wei, base unit of ETH');
  assert.equal(fields[1].description, 'alias if known, else address');
});

test('normalize: manual_list ignores blank lines and # / // comments', () => {
  const text = [
    '# top comment',
    '',
    'a: string',
    '// trailing comment',
    'b: number',
    '   ',
  ].join('\n');
  const fields = fromManualList(text);
  assert.equal(fields.length, 2);
  assert.deepEqual(
    fields.map((f) => f.name),
    ['a', 'b'],
  );
});

test('normalize: manual_list dedups duplicate field names (keeps first)', () => {
  const text = ['x: string', 'y: number', 'x: boolean'].join('\n');
  const fields = fromManualList(text);
  assert.equal(fields.length, 2);
  assert.equal(fields.find((f) => f.name === 'x').type, 'string');
});

test('normalize: manual_list skips malformed lines silently', () => {
  const text = [
    'good: string',
    'no-colon-line',
    ': missing-name',
    'bad spaces only',
    'also_good: number (with desc)',
  ].join('\n');
  const fields = fromManualList(text);
  assert.deepEqual(
    fields.map((f) => f.name),
    ['good', 'also_good'],
  );
});

test('normalize: manual_list handles complex type annotations', () => {
  const text = ['items: Array<string>', 'meta: Record<string, number>'].join('\n');
  const fields = fromManualList(text);
  assert.equal(fields.length, 2);
  assert.equal(fields[0].type, 'Array<string>');
  assert.equal(fields[1].type, 'Record<string, number>');
});

test('normalize: manual_list handles union types and string-literal types', () => {
  const text = [
    "status: 'pending' | 'confirmed' | 'failed'",
    'priority: number | null',
  ].join('\n');
  const fields = fromManualList(text);
  assert.equal(fields.length, 2);
  assert.equal(fields[0].name, 'status');
  assert.ok(fields[0].type.includes('pending'));
  assert.ok(fields[0].type.includes('|'));
  assert.equal(fields[1].name, 'priority');
  assert.equal(fields[1].type, 'number | null');
});

test('normalize: manual_list returns empty array for empty input', () => {
  assert.deepEqual(fromManualList(''), []);
  assert.deepEqual(fromManualList('   \n  \n'), []);
});

// ---------- inferType ----------

test('inferType: distinguishes null / array / object / primitive', () => {
  assert.equal(inferType(null), 'null');
  assert.equal(inferType([1, 2]), 'array');
  assert.equal(inferType({ a: 1 }), 'object');
  assert.equal(inferType('foo'), 'string');
  assert.equal(inferType(42), 'number');
  assert.equal(inferType(true), 'boolean');
  assert.equal(inferType(undefined), 'undefined');
});

// ---------- projectSummary ----------

test('projectSummary: passes through valid summary', () => {
  const s = projectSummary({
    totalMasks: 3,
    maskedClasses: ['email', 'phone'],
    cryptoAllowlistHits: 2,
    baseRedactHits: 1, // intentionally dropped
  });
  assert.equal(s.totalMasks, 3);
  assert.deepEqual(s.maskedClasses, ['email', 'phone']);
  assert.equal(s.cryptoAllowlistHits, 2);
  assert.equal('baseRedactHits' in s, false);
});

test('projectSummary: defaults missing fields safely', () => {
  assert.deepEqual(projectSummary(undefined), {
    totalMasks: 0,
    maskedClasses: [],
    cryptoAllowlistHits: 0,
  });
  assert.deepEqual(projectSummary(null), {
    totalMasks: 0,
    maskedClasses: [],
    cryptoAllowlistHits: 0,
  });
  assert.deepEqual(projectSummary({}), {
    totalMasks: 0,
    maskedClasses: [],
    cryptoAllowlistHits: 0,
  });
});

test('projectSummary: defends against wrong types', () => {
  const s = projectSummary({
    totalMasks: 'not-a-number',
    maskedClasses: 'not-an-array',
    cryptoAllowlistHits: null,
  });
  assert.equal(s.totalMasks, 0);
  assert.deepEqual(s.maskedClasses, []);
  assert.equal(s.cryptoAllowlistHits, 0);
});

test('projectSummary: clones maskedClasses array (no shared reference)', () => {
  const original = ['email'];
  const s = projectSummary({ maskedClasses: original });
  s.maskedClasses.push('phone');
  assert.deepEqual(original, ['email']);
});

// ---------- normalize() input validation ----------

test('normalize: throws on missing scenario', () => {
  assert.throws(
    () =>
      normalize({
        scenario: '',
        maskedText: '{}',
        fieldDecisions: [],
        inputFormat: 'json_sample',
      }),
    /scenario must be a non-empty string/,
  );
});

test('normalize: throws on unsupported inputFormat', () => {
  assert.throws(
    () =>
      normalize({
        scenario: 'x',
        maskedText: '',
        fieldDecisions: [],
        inputFormat: 'openapi',
      }),
    /unsupported inputFormat/,
  );
});

// ---------- Integration with redact() ----------

test('integration: redact → normalize end-to-end with crypto domain', () => {
  const raw = JSON.stringify({
    txHash: '0xabcd',
    from: '0x1111111111111111111111111111111111111111',
    amount: 100,
    email: 'bob@example.com',
  });
  const r = redact(raw, { inputFormat: 'json_sample', domain: 'crypto' });
  const bundle = normalize({
    scenario: 'tx history',
    maskedText: r.maskedText,
    fieldDecisions: r.fieldDecisions,
    inputFormat: 'json_sample',
    summary: r.summary,
  });
  // email should be masked even under crypto domain
  const emailField = bundle.fields.find((f) => f.name === 'email');
  assert.equal(emailField.sampleValue, '<redacted:email>');
  // crypto-allowlisted address should be kept
  const fromField = bundle.fields.find((f) => f.name === 'from');
  assert.equal(fromField.sampleValue, '0x1111111111111111111111111111111111111111');
  // summary projection
  assert.ok(bundle.redactionSummary.maskedClasses.includes('email'));
  assert.ok(bundle.redactionSummary.cryptoAllowlistHits >= 1);
});

// ---------- MANUAL_LINE_RE structural sanity ----------

test('MANUAL_LINE_RE: matches expected forms, rejects malformed', () => {
  assert.ok(MANUAL_LINE_RE.test('x: string'));
  assert.ok(MANUAL_LINE_RE.test('x: string (desc)'));
  assert.ok(MANUAL_LINE_RE.test('x:string'));
  assert.ok(!MANUAL_LINE_RE.test(''));
  assert.ok(!MANUAL_LINE_RE.test('no colon'));
  assert.ok(!MANUAL_LINE_RE.test(': missing-name'));
});

// ---------- redact.js CLI (Phase 1 contract) ----------

test('redact CLI: --input + --output writes phase1.json with forbiddenFingerprints array', () => {
  const fs = inMemoryFs({ '/in.json': JSON.stringify({ email: 'alice@example.com', amount: 100 }) });
  const io = captureIO(fs);
  runRedactCli(['--input', '/in.json', '--output', '/phase1.json'], io);
  assert.equal(io.exitCode, 0);
  const summary = JSON.parse(io.out.join(''));
  assert.equal(summary.ok, true);
  assert.equal(summary.output, '/phase1.json');
  const phase1 = JSON.parse(fs.files['/phase1.json']);
  assert.ok(typeof phase1.maskedText === 'string');
  assert.ok(Array.isArray(phase1.forbiddenFingerprints));
  assert.ok(phase1.forbiddenFingerprints.length > 0, 'email value should produce at least one fingerprint');
  assert.ok(phase1.maskedText.includes('<redacted:'), 'PII should be masked in maskedText');
  assert.ok(phase1.redactionSummary);
});

test('redact CLI: --domain crypto preserves 0x addresses', () => {
  const fs = inMemoryFs({
    '/in.json': JSON.stringify({ to: '0x1234567890123456789012345678901234567890' }),
  });
  const io = captureIO(fs);
  runRedactCli(['--input', '/in.json', '--output', '/p.json', '--domain', 'crypto'], io);
  assert.equal(io.exitCode, 0);
  const phase1 = JSON.parse(fs.files['/p.json']);
  assert.ok(phase1.maskedText.includes('0x1234567890123456789012345678901234567890'),
    'crypto domain must keep eth address visible');
});

test('redact CLI: missing --input → cli_args exit 2', () => {
  const io = captureIO(inMemoryFs());
  runRedactCli([], io);
  assert.equal(io.exitCode, 2);
  const parsed = JSON.parse(io.out.join(''));
  assert.equal(parsed.error, 'cli_args');
});

test('redact CLI: unreadable input → unreadable_input exit 2', () => {
  const io = captureIO(inMemoryFs());
  runRedactCli(['--input', '/missing', '--output', '/o.json'], io);
  assert.equal(io.exitCode, 2);
  const parsed = JSON.parse(io.out.join(''));
  assert.equal(parsed.error, 'unreadable_input');
});

// ---------- normalize-input.js CLI (Phase 2 contract) ----------

test('normalize CLI: writes bundle.json carrying forbiddenFingerprints + allowlists from phase1', () => {
  const phase1 = {
    maskedText: JSON.stringify({ txHash: '0xdeadbeef', amount: 100 }),
    forbiddenFingerprints: ['sha256:abc123def456', 'sha256:ffeeddccbbaa'],
    fieldDecisions: [],
    redactionSummary: { totalMasks: 2, maskedClasses: ['address'], cryptoAllowlistHits: 0 },
  };
  const fs = inMemoryFs({ '/p1.json': JSON.stringify(phase1) });
  const io = captureIO(fs);
  runNormalizeCli([
    '--phase1', '/p1.json',
    '--scenario', 'transaction history',
    '--inputFormat', 'json_sample',
    '--output', '/bundle.json',
  ], io);
  assert.equal(io.exitCode, 0);
  const bundle = JSON.parse(fs.files['/bundle.json']);
  assert.equal(bundle.scenario, 'transaction history');
  assert.equal(bundle.inputFormat, 'json_sample');
  // Critical: the bundle MUST carry the validator's security inputs
  // (fingerprints + closed-enum allowlists) — without these, Phase 7
  // silently no-ops Rule 1 / Rule 3 / Rule 5.
  assert.deepEqual(bundle.forbiddenFingerprints, phase1.forbiddenFingerprints);
  assert.deepEqual(bundle.allowedPrinciples, DEFAULT_ALLOWED_PRINCIPLES);
  assert.deepEqual(bundle.allowedPriorities, DEFAULT_ALLOWED_PRIORITIES);
  assert.deepEqual(bundle.allowedAntiPatterns, DEFAULT_ALLOWED_ANTI_PATTERNS);
  assert.ok(Array.isArray(bundle.fields));
});

test('normalize CLI: scenario with leading dashes is accepted (not parsed as flag)', () => {
  // `--scenario "user-profile"` — the value happens to start with `-` but is
  // not a flag; CLI must accept it.
  const phase1 = {
    maskedText: JSON.stringify({ name: '<redacted:email>' }),
    forbiddenFingerprints: [],
    fieldDecisions: [],
    redactionSummary: { totalMasks: 1, maskedClasses: ['email'], cryptoAllowlistHits: 0 },
  };
  const fs = inMemoryFs({ '/p1.json': JSON.stringify(phase1) });
  const io = captureIO(fs);
  runNormalizeCli([
    '--phase1', '/p1.json',
    '--scenario', '-edge case scenario',
    '--inputFormat', 'json_sample',
    '--output', '/b.json',
  ], io);
  assert.equal(io.exitCode, 0);
  const bundle = JSON.parse(fs.files['/b.json']);
  assert.equal(bundle.scenario, '-edge case scenario');
});

test('normalize CLI: missing --phase1 → cli_args exit 2', () => {
  const io = captureIO(inMemoryFs());
  runNormalizeCli([
    '--scenario', 'x', '--inputFormat', 'json_sample', '--output', '/o.json',
  ], io);
  assert.equal(io.exitCode, 2);
  const parsed = JSON.parse(io.out.join(''));
  assert.equal(parsed.error, 'cli_args');
});

test('normalize CLI: unreadable phase1 → unreadable_phase1 exit 2', () => {
  const io = captureIO(inMemoryFs());
  runNormalizeCli([
    '--phase1', '/missing.json',
    '--scenario', 'x',
    '--inputFormat', 'json_sample',
    '--output', '/o.json',
  ], io);
  assert.equal(io.exitCode, 2);
  const parsed = JSON.parse(io.out.join(''));
  assert.equal(parsed.error, 'unreadable_phase1');
});

// ---------- Phase 1 → 2 → 7 integration (real bundle shape) ----------

test('Phase 1→2→7 integration: real redact + normalize bundle drives validate() with Rule 3 enforcement', () => {
  const { validate } = require('../../../scripts/skills/ui-first-principles/validate-report');
  // Phase 1
  const fs = inMemoryFs({
    '/in.json': JSON.stringify({ counterparty: 'alice@example.com', amount: 50 }),
  });
  const io1 = captureIO(fs);
  runRedactCli(['--input', '/in.json', '--output', '/p1.json'], io1);
  assert.equal(io1.exitCode, 0);
  // Phase 2
  const io2 = captureIO(fs);
  runNormalizeCli([
    '--phase1', '/p1.json',
    '--scenario', 'transaction confirmation',
    '--inputFormat', 'json_sample',
    '--output', '/bundle.json',
  ], io2);
  assert.equal(io2.exitCode, 0);
  const bundle = JSON.parse(fs.files['/bundle.json']);
  // Phase 7: feed an LLM-output-style report with an invalid anchor —
  // bundle.allowedPrinciples must trigger invalid_anchor (proves the
  // Phase 2 → 7 wiring carries the whitelist).
  const md = [
    '## 2. Field Decision Table',
    '| Field | Priority | Principle Anchor | Rationale |',
    '|-------|----------|------------------|-----------|',
    '| counterparty | primary | InventedPrinciple | r |',
    '| amount | primary | JTBD | r |',
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
  const result = validate(md, {
    fieldNames: bundle.fields.map((f) => f.name),
    allowedPrinciples: bundle.allowedPrinciples,
    allowedPriorities: bundle.allowedPriorities,
    allowedAntiPatterns: bundle.allowedAntiPatterns,
    forbiddenFingerprints: new Set(bundle.forbiddenFingerprints),
  });
  const v = result.violations.find((x) => x.rule === 'invalid_anchor');
  assert.ok(v, 'integration: bundle allowlist must drive Rule 3 enforcement');
  assert.equal(v.detail[0].principleAnchor, 'InventedPrinciple');
});
