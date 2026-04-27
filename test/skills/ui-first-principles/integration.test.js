'use strict';

/**
 * Integration smoke + FR-9 oracle + NFR-8 fixture sanity for ui-first-principles.
 *
 * Covers tech-spec §5 T10 (smoke E2E), §5 T11 (NFR-8 fixture shape), §5 T12
 * (FR-9 anti-pattern fixtures).
 *
 * The skill itself runs LLM-driven Phases 3–6, which cannot execute in CI.
 * This test exercises the deterministic pipeline (Phase 1 redact → Phase 2
 * normalize → Phase 7 validate) end-to-end and asserts the validator accepts
 * hand-crafted reports that represent ideal LLM output for each anti-pattern.
 *
 * Phase 2 bundle assembly mirrors `normalize-input.js` `runCli`: the exported
 * `normalize()` only produces the LLM-facing core; the CLI then layers on
 * `forbiddenFingerprints` and the three allowlists. The test follows the same
 * pattern so a regression in the bundle contract surfaces here.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { redact } = require('../../../scripts/skills/ui-first-principles/redact');
const {
  normalize,
  DEFAULT_ALLOWED_PRINCIPLES,
  DEFAULT_ALLOWED_PRIORITIES,
  DEFAULT_ALLOWED_ANTI_PATTERNS,
} = require('../../../scripts/skills/ui-first-principles/normalize-input');
const {
  validate,
  parseAntiPatterns,
} = require('../../../scripts/skills/ui-first-principles/validate-report');

const FIXTURE_ROOT = path.resolve(__dirname, '../../fixtures/ui-first-principles/scenarios');
const SMOKE_ROOT = path.join(FIXTURE_ROOT, 'smoke');
const FR9_ROOT = path.join(FIXTURE_ROOT, 'fr9-anti-patterns');
const NFR8_ROOT = path.join(FIXTURE_ROOT, 'nfr8-rationale-quality');

// Mirror the production Phase 1 → Phase 2 path with a true serialization
// round-trip. The redact CLI writes a file with `forbiddenFingerprints: Array`
// + `redactionSummary: Object` (see redact.js:488–494); the normalize CLI then
// reads that file back with `phase1.redactionSummary || phase1.summary` and
// `Array.isArray(phase1.forbiddenFingerprints) ? ...` (normalize-input.js:300,
// :309). If we hand `normalize()` the in-memory `redact()` shape directly we
// silently bypass that contract — a regression in the CLI serialize/deserialize
// pair would not surface here. Round-tripping through JSON.parse(JSON.stringify)
// reproduces the file boundary exactly without touching disk.
function buildBundleLikeCli({ scenario, phase1, inputFormat }) {
  const serialized = JSON.parse(JSON.stringify({
    maskedText: phase1.maskedText,
    forbiddenFingerprints: [...(phase1.fingerprints || [])],
    fieldDecisions: phase1.fieldDecisions || [],
    redactionSummary: phase1.summary,
  }));

  const base = normalize({
    scenario,
    maskedText: serialized.maskedText,
    fieldDecisions: serialized.fieldDecisions || [],
    inputFormat,
    summary: serialized.redactionSummary || serialized.summary,
  });
  return {
    ...base,
    forbiddenFingerprints: Array.isArray(serialized.forbiddenFingerprints)
      ? serialized.forbiddenFingerprints
      : [],
    allowedPrinciples: DEFAULT_ALLOWED_PRINCIPLES,
    allowedPriorities: DEFAULT_ALLOWED_PRIORITIES,
    allowedAntiPatterns: DEFAULT_ALLOWED_ANTI_PATTERNS,
  };
}

// ---------- T10 — smoke E2E (deterministic Phase 1 → 2 → 7 pipeline) ----------

const smokeScenarios = fs.readdirSync(SMOKE_ROOT).filter((d) =>
  fs.statSync(path.join(SMOKE_ROOT, d)).isDirectory()
);

assert.ok(smokeScenarios.length >= 2, 'smoke must cover at least 2 scenarios');

for (const dir of smokeScenarios) {
  const inputPath = path.join(SMOKE_ROOT, dir, 'input.json');
  const expectedPath = path.join(SMOKE_ROOT, dir, 'expected.json');
  const rawInput = fs.readFileSync(inputPath, 'utf8');
  const expected = JSON.parse(fs.readFileSync(expectedPath, 'utf8'));

  test(`smoke ${dir} → Phase 1 redact + Phase 2 normalize produce a CLI-shape bundle`, () => {
    const phase1 = redact(rawInput, {
      domain: expected.domain || null,
      inputFormat: 'json_sample',
    });

    assert.equal(typeof phase1.maskedText, 'string');
    assert.ok(phase1.maskedText.length > 0, 'maskedText must not be empty');
    assert.ok(phase1.fingerprints instanceof Set, 'fingerprints must be a Set');
    assert.ok(Array.isArray(phase1.fieldDecisions), 'fieldDecisions must be an array');

    if (typeof expected.expected.totalMasksMin === 'number') {
      assert.ok(
        phase1.summary.totalMasks >= expected.expected.totalMasksMin,
        `expected ≥${expected.expected.totalMasksMin} masks, got ${phase1.summary.totalMasks}`,
      );
    }
    if (typeof expected.expected.cryptoAllowlistHitsMin === 'number') {
      assert.ok(
        phase1.summary.cryptoAllowlistHits >= expected.expected.cryptoAllowlistHitsMin,
        `expected ≥${expected.expected.cryptoAllowlistHitsMin} crypto allowlist hits, got ${phase1.summary.cryptoAllowlistHits}`,
      );
    }

    const bundle = buildBundleLikeCli({
      scenario: expected.scenario,
      phase1,
      inputFormat: 'json_sample',
    });

    // Bundle contract — schema the LLM and Phase 7 both depend on.
    assert.equal(bundle.scenario, expected.scenario);
    assert.equal(bundle.inputFormat, 'json_sample');
    assert.ok(Array.isArray(bundle.fields));
    assert.ok(bundle.redactionSummary && typeof bundle.redactionSummary === 'object',
      'bundle.redactionSummary must be present');
    assert.ok(Array.isArray(bundle.forbiddenFingerprints));
    assert.deepEqual(bundle.allowedPrinciples, DEFAULT_ALLOWED_PRINCIPLES);
    assert.deepEqual(bundle.allowedPriorities, DEFAULT_ALLOWED_PRIORITIES);
    assert.deepEqual(bundle.allowedAntiPatterns, DEFAULT_ALLOWED_ANTI_PATTERNS);

    const actualNames = bundle.fields.map((f) => f.name).sort();
    const expectedNames = [...expected.expected.fields].sort();
    assert.deepEqual(actualNames, expectedNames, `field set mismatch for ${dir}`);
    assert.equal(bundle.fields.length, expected.expected.fieldCount);

    // The CLI projects redact summary into bundle — ensure no information was
    // dropped between Phase 1 and Phase 2 for the dimensions the LLM consumes.
    assert.equal(bundle.redactionSummary.totalMasks, phase1.summary.totalMasks);
    assert.equal(
      bundle.redactionSummary.cryptoAllowlistHits,
      phase1.summary.cryptoAllowlistHits,
    );
  });

  test(`smoke ${dir} → Phase 7 accepts a minimal valid report against the bundle`, () => {
    const phase1 = redact(rawInput, {
      domain: expected.domain || null,
      inputFormat: 'json_sample',
    });
    const bundle = buildBundleLikeCli({
      scenario: expected.scenario,
      phase1,
      inputFormat: 'json_sample',
    });

    const fieldNames = bundle.fields.map((f) => f.name);
    const report = renderMinimalValidReport(bundle.scenario, fieldNames);

    const result = validate(report, {
      fieldNames,
      allowedPrinciples: bundle.allowedPrinciples,
      allowedPriorities: bundle.allowedPriorities,
      allowedAntiPatterns: bundle.allowedAntiPatterns,
      forbiddenFingerprints: new Set(bundle.forbiddenFingerprints),
      domain: expected.domain || null,
    });

    assert.equal(result.ok, true,
      `validator returned violations: ${JSON.stringify(result.violations)}`);
  });
}

// ---------- T12 — FR-9 anti-pattern oracle fixtures ----------

const fr9Files = fs.readdirSync(FR9_ROOT)
  .filter((f) => f.endsWith('.json'))
  .sort();

assert.ok(fr9Files.length >= 5, 'FR-9 fixture set must cover at least 5 anti-patterns');

for (const file of fr9Files) {
  const fixture = JSON.parse(fs.readFileSync(path.join(FR9_ROOT, file), 'utf8'));

  test(`fr9 ${fixture.id} → validator returns no violations against the hand-crafted report`, () => {
    const result = validate(fixture.report, {
      fieldNames: fixture.fields,
      allowedPrinciples: DEFAULT_ALLOWED_PRINCIPLES,
      allowedPriorities: DEFAULT_ALLOWED_PRIORITIES,
      allowedAntiPatterns: DEFAULT_ALLOWED_ANTI_PATTERNS,
      forbiddenFingerprints: new Set(),
      domain: null,
    });

    // FR-9 fixtures represent the *ideal* LLM output. They must satisfy every
    // rule — critical AND soft — so a fixture that drifts from the spec
    // (e.g., bullet list with no leading backticked ID, missing gap direction,
    // invalid priority) fails this test loudly.
    assert.deepEqual(result.violations, [],
      `fixture must produce zero violations; got: ${JSON.stringify(result.violations, null, 2)}`);
    assert.equal(result.ok, true);
  });

  test(`fr9 ${fixture.id} → parsed anti-pattern IDs include every oracle ID`, () => {
    const parsed = parseAntiPatterns(fixture.report);
    assert.equal(parsed.present, true, 'anti-pattern section must be present');
    const idSet = new Set(parsed.ids);
    for (const expectedId of fixture.oracle.expectedAntiPatternIds) {
      assert.ok(idSet.has(expectedId),
        `oracle expected ${expectedId} in parsed table; parsed=${JSON.stringify(parsed.ids)}`);
    }
  });
}

// ---------- T11 — NFR-8 fixture shape sanity ----------

// Rubric defines 5 scenarios × 10 fields. The runtime cannot evaluate
// rationale quality (LLM-driven Phases 3–6), but the fixtures must be
// well-formed JSON with the field count the rubric expects so the manual
// review step has a deterministic input set.
const nfr8Files = fs.existsSync(NFR8_ROOT)
  ? fs.readdirSync(NFR8_ROOT).filter((f) => f.endsWith('.json')).sort()
  : [];

test('nfr8 fixture set contains 5 scenarios with 10 fields each', () => {
  assert.equal(nfr8Files.length, 5,
    `NFR-8 rubric requires exactly 5 scenarios; found ${nfr8Files.length}`);
  for (const file of nfr8Files) {
    const fixture = JSON.parse(fs.readFileSync(path.join(NFR8_ROOT, file), 'utf8'));
    assert.equal(typeof fixture.scenario, 'string',
      `${file}: scenario must be a string`);
    assert.equal(fixture.fieldCount, 10,
      `${file}: fieldCount must be 10 (rubric pre-condition)`);
    const inputKeyCount = Object.keys(fixture.input || {}).length;
    assert.equal(inputKeyCount, 10,
      `${file}: input must contain exactly 10 top-level fields, got ${inputKeyCount}`);
  }
});

// ---------- helpers ----------

function renderMinimalValidReport(scenario, fields) {
  const rows = fields.map((f) =>
    `| ${f} | primary | JTBD | Required to satisfy the functional job for the ${scenario} scenario. |`
  ).join('\n');
  const hierarchy = fields.map((f) => `- ${f}: required by the functional job`).join('\n');

  return [
    `# UI First-Principles Analysis: ${scenario}`,
    '',
    `> Scenario: ${scenario}`,
    `> Domain: none`,
    `> Generated: 2026-04-25T10:00:00Z`,
    `> Input format: json_sample`,
    '',
    '## 1. JTBD Analysis',
    '',
    '### Functional Job',
    `The user wants to complete the ${scenario} job.`,
    '',
    '### Emotional Job',
    'none in this scenario',
    '',
    '### Social Job',
    'none in this scenario',
    '',
    '## 2. Field Decision Table',
    '',
    '| Field | Priority | Principle Anchor | Rationale |',
    '|-------|----------|------------------|-----------|',
    rows,
    '',
    '## 3. Anti-Pattern Findings',
    '',
    '| Pattern | Affected Fields | Severity | Rationale |',
    '|---------|-----------------|----------|-----------|',
    '| (none detected) | — | info | All fields pass anti-pattern checks. |',
    '',
    '## 4. Gap Report',
    '',
    '**UI needs but API missing**: none',
    '',
    '**API provides but UI ignores**: none',
    '',
    '## 5. Information Hierarchy',
    '',
    '### Primary Zone',
    hierarchy,
    '',
    '### Secondary Zone',
    '- (none)',
    '',
    '### On-Demand Zone',
    '- (none)',
    '',
    '### Hidden (not surfaced)',
    '- (none)',
    '',
  ].join('\n');
}
