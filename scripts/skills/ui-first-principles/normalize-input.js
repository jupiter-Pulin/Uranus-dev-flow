'use strict';

/**
 * normalize-input.js — Phase 2 of ui-first-principles skill.
 *
 * Tech spec: docs/features/ui-first-principles/2-tech-spec.md §3.4 Phase 2
 *
 * Converts Phase 1 (`redact.js`) output into a `ScenarioBundle` — the only
 * surface the LLM sees in Phases 3–6. This guarantees the LLM never reads
 * the raw input.
 *
 * Two input formats:
 *   1. json_sample:   maskedText is a JSON string; field set comes from
 *                     fieldDecisions (top-level only in v1; nested = v2).
 *                     Type is inferred from the parsed JSON top-level value.
 *   2. manual_list:   maskedText is line-based `fieldName: type (description)`.
 *                     Description is preserved as-is on RedactedField.
 */

const TOP_LEVEL_PATH_RE = /[.\[\]]/;

/**
 * @param {object} input
 * @param {string} input.scenario              - Natural-language scenario
 * @param {string} input.maskedText            - From redact() result.maskedText
 * @param {Array}  input.fieldDecisions        - From redact() result.fieldDecisions
 * @param {'json_sample'|'manual_list'} input.inputFormat
 * @param {object} [input.summary]             - From redact() result.summary (optional projection source)
 * @returns {{
 *   scenario: string,
 *   fields: Array<{name:string, type?:string, sampleValue:string, description?:string, source:'json_sample'|'manual'}>,
 *   inputFormat: 'json_sample'|'manual_list',
 *   redactionSummary: {totalMasks:number, maskedClasses:string[], cryptoAllowlistHits:number},
 * }}
 */
function normalize({ scenario, maskedText, fieldDecisions, inputFormat, summary } = {}) {
  if (typeof scenario !== 'string' || scenario.length === 0) {
    throw new TypeError('normalize: scenario must be a non-empty string');
  }
  if (inputFormat !== 'json_sample' && inputFormat !== 'manual_list') {
    throw new TypeError(`normalize: unsupported inputFormat "${inputFormat}"`);
  }

  const fields =
    inputFormat === 'json_sample'
      ? fromJsonSample(maskedText, fieldDecisions || [])
      : fromManualList(maskedText);

  return {
    scenario,
    fields,
    inputFormat,
    redactionSummary: projectSummary(summary),
  };
}

// ---------- JSON sample path ----------

// Source of truth for "what fields exist" is the parsed JSON top-level keys —
// `redact.fieldDecisions` only emits traces for string leaves, so non-string
// fields (numbers, booleans, nested objects/arrays) would be invisible if we
// relied on decisions alone. Decisions are still consulted to surface mask
// metadata (`piiClass` / fingerprint) per field.
function fromJsonSample(maskedText, fieldDecisions) {
  let parsed = null;
  if (typeof maskedText === 'string' && maskedText.length > 0) {
    try {
      parsed = JSON.parse(maskedText);
    } catch {
      parsed = null;
    }
  }
  const isPlainObject =
    parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed);

  if (!isPlainObject) {
    // Parse failed or top-level is array/primitive — fall back to top-level
    // string-leaf field decisions so callers still see *some* field set.
    return decisionsAsFields(fieldDecisions);
  }

  // Index decisions by top-level fieldName for quick mask-metadata lookup.
  const decisionByName = new Map();
  for (const d of fieldDecisions || []) {
    if (!d || typeof d.path !== 'string') continue;
    if (TOP_LEVEL_PATH_RE.test(d.path)) continue;
    if (!decisionByName.has(d.fieldName)) decisionByName.set(d.fieldName, d);
  }

  return Object.keys(parsed).map((name) => {
    const rawValue = parsed[name];
    return {
      name,
      type: inferType(rawValue),
      sampleValue: stringifySample(rawValue),
      source: 'json_sample',
    };
    // (decision metadata available via decisionByName.get(name) for downstream
    // consumers; v1 SKILL.md does not surface it on the bundle to keep schema
    // narrow — extend here if Phase 5 needs explicit mask flags per field.)
  });
}

function decisionsAsFields(fieldDecisions) {
  const seen = new Set();
  const fields = [];
  for (const d of fieldDecisions || []) {
    if (!d || typeof d.path !== 'string') continue;
    if (TOP_LEVEL_PATH_RE.test(d.path)) continue;
    const name = d.fieldName;
    if (!name || seen.has(name)) continue;
    seen.add(name);
    fields.push({
      name,
      type: 'undefined',
      sampleValue: '',
      source: 'json_sample',
    });
  }
  return fields;
}

function inferType(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value; // 'string' | 'number' | 'boolean' | 'object' | 'undefined'
}

function stringifySample(value) {
  if (value === undefined) return '';
  if (value === null) return 'null';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  // For objects/arrays at top level we surface the JSON form so the LLM can
  // see structural shape without descending into nested PII (already masked).
  try {
    return JSON.stringify(value);
  } catch {
    return '';
  }
}

// ---------- Manual list path ----------

// `fieldName: type (description)` where description is optional. Type allows
// generics, union pipe `|`, quoted string-literal types, and bracket forms so
// that Examples like the following all parse:
//   txHash: string
//   counterparty: string (recipient or sender alias)
//   amount: number (in wei)
//   status: 'pending' | 'confirmed' | 'failed'
//   meta: Record<string, number>
const MANUAL_LINE_RE = /^\s*([A-Za-z_][\w.-]*)\s*:\s*([A-Za-z_'"][\w<>,\s\[\]|"'.]*?)(?:\s*\(([^)]*)\))?\s*$/;

function fromManualList(maskedText) {
  if (typeof maskedText !== 'string' || maskedText.length === 0) return [];
  const seen = new Set();
  const fields = [];
  for (const rawLine of maskedText.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.length === 0 || line.startsWith('#') || line.startsWith('//')) continue;
    const match = line.match(MANUAL_LINE_RE);
    if (!match) continue;
    const [, name, typeRaw, descriptionRaw] = match;
    if (seen.has(name)) continue;
    seen.add(name);
    const type = typeRaw.trim();
    const field = {
      name,
      type: type.length > 0 ? type : undefined,
      sampleValue: '',
      source: 'manual',
    };
    if (descriptionRaw && descriptionRaw.trim().length > 0) {
      field.description = descriptionRaw.trim();
    }
    fields.push(field);
  }
  return fields;
}

// ---------- Summary projection ----------

function projectSummary(summary) {
  const safe = summary && typeof summary === 'object' ? summary : {};
  return {
    totalMasks: typeof safe.totalMasks === 'number' ? safe.totalMasks : 0,
    maskedClasses: Array.isArray(safe.maskedClasses) ? [...safe.maskedClasses] : [],
    cryptoAllowlistHits:
      typeof safe.cryptoAllowlistHits === 'number' ? safe.cryptoAllowlistHits : 0,
  };
}

// ---------- Allowlist defaults (carried into bundle.json) ----------

// These constants are the source of truth for the closed enums Phase 7
// validates. They live here (not in a separate config) so the Phase 2 → 7
// bundle is self-contained — `validate-report.js --bundle <bundle.json>`
// can read every whitelist it needs without re-loading reference markdown.
const DEFAULT_ALLOWED_PRINCIPLES = [
  'JTBD',
  'CognitiveLoadTheory',
  'HicksLaw',
  'MillersLaw',
  'ProgressiveDisclosure',
];
const DEFAULT_ALLOWED_PRIORITIES = ['primary', 'secondary', 'on_demand', 'hidden'];
const DEFAULT_ALLOWED_ANTI_PATTERNS = [
  'too_many_primary',
  'scenario_field_mismatch',
  'pure_aesthetic_over_utility',
  'hidden_critical_info',
  'redundant_fields',
];

module.exports = {
  normalize,
  // Exported for unit testing
  fromJsonSample,
  fromManualList,
  inferType,
  projectSummary,
  MANUAL_LINE_RE,
  runCli,
  DEFAULT_ALLOWED_PRINCIPLES,
  DEFAULT_ALLOWED_PRIORITIES,
  DEFAULT_ALLOWED_ANTI_PATTERNS,
};

// ---------- CLI ----------

// Invoked by SKILL.md Phase 2 as:
//   node scripts/skills/ui-first-principles/normalize-input.js \
//     --phase1      <phase1.json> \
//     --scenario    "<free text>" \
//     --inputFormat <json_sample|manual_list> \
//     --output      <bundle.json>
//
// Reads Phase 1 output and writes a `ScenarioBundle` JSON file that the LLM
// (Phases 3–6) and the validator (Phase 7) both consume:
//
//   {
//     "scenario": "<free text>",
//     "fields": [{ "name": "...", "type": "...", "sampleValue": "...", ... }],
//     "inputFormat": "json_sample" | "manual_list",
//     "redactionSummary": { ... },
//     "forbiddenFingerprints": ["sha256:abc...", ...],   // ← carried from phase1
//     "allowedPrinciples":   [...],                      // ← Phase 7 whitelist
//     "allowedPriorities":   [...],                      // ← Phase 7 whitelist
//     "allowedAntiPatterns": [...]                       // ← Phase 7 whitelist
//   }
//
// Exit 0 on success, 2 on argument or filesystem error.
function parseNormalizeCliArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--phase1' || arg === '--scenario' || arg === '--inputFormat' || arg === '--output') {
      const next = argv[i + 1];
      if (next === undefined || (arg !== '--scenario' && next.startsWith('--'))) {
        throw new Error(`missing value for ${arg}`);
      }
      out[arg.slice(2)] = next;
      i += 1;
    }
  }
  return out;
}

function runCli(argv = process.argv.slice(2), io = {}) {
  const stdout = io.stdout || process.stdout;
  const stderr = io.stderr || process.stderr;
  const fs = io.fs || require('node:fs');
  const exit = io.exit || ((code) => process.exit(code));
  let args;
  try {
    args = parseNormalizeCliArgs(argv);
  } catch (err) {
    stderr.write(`normalize-input: ${err.message}\n`);
    stdout.write(JSON.stringify({ ok: false, error: 'cli_args', detail: err.message }) + '\n');
    return exit(2);
  }
  for (const k of ['phase1', 'scenario', 'inputFormat', 'output']) {
    if (!args[k]) {
      const msg = `usage: --phase1 <phase1.json> --scenario "<text>" --inputFormat <json_sample|manual_list> --output <bundle.json>`;
      stderr.write(`normalize-input: ${msg}\n`);
      stdout.write(JSON.stringify({ ok: false, error: 'cli_args', detail: msg }) + '\n');
      return exit(2);
    }
  }
  let phase1;
  try {
    phase1 = JSON.parse(fs.readFileSync(args.phase1, 'utf8'));
  } catch (err) {
    stdout.write(JSON.stringify({ ok: false, error: 'unreadable_phase1', detail: err.message }) + '\n');
    return exit(2);
  }
  let bundle;
  try {
    const base = normalize({
      scenario: args.scenario,
      maskedText: phase1.maskedText,
      fieldDecisions: phase1.fieldDecisions || [],
      inputFormat: args.inputFormat,
      summary: phase1.redactionSummary || phase1.summary,
    });
    bundle = {
      ...base,
      forbiddenFingerprints: Array.isArray(phase1.forbiddenFingerprints) ? phase1.forbiddenFingerprints : [],
      allowedPrinciples: DEFAULT_ALLOWED_PRINCIPLES,
      allowedPriorities: DEFAULT_ALLOWED_PRIORITIES,
      allowedAntiPatterns: DEFAULT_ALLOWED_ANTI_PATTERNS,
    };
  } catch (err) {
    stdout.write(JSON.stringify({ ok: false, error: 'normalize_failed', detail: err.message }) + '\n');
    return exit(2);
  }
  try {
    fs.writeFileSync(args.output, JSON.stringify(bundle) + '\n', 'utf8');
  } catch (err) {
    stdout.write(JSON.stringify({ ok: false, error: 'write_failed', detail: err.message }) + '\n');
    return exit(2);
  }
  stdout.write(JSON.stringify({
    ok: true,
    output: args.output,
    fieldCount: bundle.fields.length,
    fingerprintCount: bundle.forbiddenFingerprints.length,
  }) + '\n');
  return exit(0);
}

if (require.main === module) {
  runCli();
}
