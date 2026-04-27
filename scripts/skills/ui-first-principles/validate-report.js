'use strict';

/**
 * validate-report.js — Phase 7 of ui-first-principles skill.
 *
 * Tech spec: docs/features/ui-first-principles/2-tech-spec.md §3.4 Phase 7
 *
 * Validation rules (severity in parens):
 *   1.  pii_leak_fingerprint (critical) — markdown contains a token whose
 *       SHA-256 prefix matches Phase 1 forbiddenFingerprints.
 *   1b. pii_leak_regex       (critical) — generic PII regex catches LLM
 *       hallucination of plausible-looking PII; relaxed for `0x...` patterns
 *       under domain=crypto so legitimate tx hashes are not false positives.
 *   2.  missing_decision     (critical) — every input field must have a
 *       decision row in the field decision table.
 *   3.  invalid_anchor       (soft)     — every row's principleAnchor must
 *       belong to allowedPrinciples.
 *   3b. invalid_priority     (soft)     — every row's priority must belong to
 *       allowedPriorities (closed enum: primary | secondary | on_demand | hidden).
 *   4.  gap_direction_missing (soft)    — Gap Report must surface BOTH the
 *       "UI needs but API missing" and "API provides but UI ignores"
 *       directions (each may be `none` / `[]`, but the heading must exist).
 *   5.  anti_pattern_missing / invalid_anti_pattern_id (soft) — Anti-Pattern
 *       section must exist and any listed IDs must be in allowedAntiPatterns.
 *
 * Retry policy (caller — SKILL.md):
 *   any critical violation → 1 retry with violation context → still critical
 *     → emit `⚠️ Need Human` (no warn-only fallback per OQ-5).
 *   soft only → write report with prepended `> ⚠️ Warnings: ...` block.
 */

const nodeCrypto = require('node:crypto');

// ---------- Public API ----------

/**
 * @param {string} markdown
 * @param {object} opts
 * @param {string[]} opts.fieldNames                    - Top-level fields expected in decision rows
 * @param {string[]} opts.allowedPrinciples             - Whitelist of principle anchor IDs
 * @param {string[]} [opts.allowedPriorities]           - Whitelist of priority values (closed enum); defaults to the four canonical priorities
 * @param {string[]} opts.allowedAntiPatterns           - Whitelist of anti-pattern IDs
 * @param {Set<string>|string[]} opts.forbiddenFingerprints - Phase 1 sensitive-value fingerprints
 * @param {'crypto'|null} [opts.domain=null]            - Affects generic regex desensitization
 * @returns {{ ok: boolean, violations: Array<{severity:'critical'|'soft', rule:string, detail?:any}> }}
 */
function validate(markdown, opts = {}) {
  const {
    fieldNames = [],
    allowedPrinciples = [],
    allowedPriorities = ['primary', 'secondary', 'on_demand', 'hidden'],
    allowedAntiPatterns = [],
    forbiddenFingerprints = new Set(),
    domain = null,
  } = opts;

  const violations = [];
  const md = typeof markdown === 'string' ? markdown : '';
  const fpSet = forbiddenFingerprints instanceof Set
    ? forbiddenFingerprints
    : new Set(Array.isArray(forbiddenFingerprints) ? forbiddenFingerprints : []);

  // Rule 1: fingerprint leak scan (precise, zero false-positive)
  const fpLeaks = scanByFingerprint(md, fpSet);
  if (fpLeaks.length) {
    violations.push({ severity: 'critical', rule: 'pii_leak_fingerprint', detail: fpLeaks });
  }

  // Rule 1b: generic PII regex rescan (catches LLM-fabricated PII)
  const regexLeaks = scanForPIIPatterns(md, { domain });
  if (regexLeaks.length) {
    violations.push({ severity: 'critical', rule: 'pii_leak_regex', detail: regexLeaks });
  }

  // Rule 2: every input field has a decision row
  const rows = parseDecisionRows(md);
  const rowFieldNames = new Set(rows.map((r) => r.fieldName));
  const missing = fieldNames.filter((n) => !rowFieldNames.has(n));
  if (missing.length) {
    violations.push({ severity: 'critical', rule: 'missing_decision', detail: missing });
  }

  // Rule 3: anchor whitelist. Tech spec §3.4 Phase 7 requires every row's
  // anchor ∈ allowedPrinciples; an empty/missing anchor is a violation, not
  // a free pass. Detail values are routed through safeEnumValue so an LLM
  // that put a sensitive token in the column does not re-leak it via the
  // soft-violation retry context.
  if (allowedPrinciples.length > 0 && rows.length > 0) {
    const allowedSet = new Set(allowedPrinciples);
    const invalid = rows.filter((r) => !allowedSet.has(r.principleAnchor));
    if (invalid.length) {
      violations.push({
        severity: 'soft',
        rule: 'invalid_anchor',
        detail: invalid.map((r) => ({
          fieldName: r.fieldName,
          principleAnchor: safeEnumValue(r.principleAnchor, { fpSet, domain }),
        })),
      });
    }
  }

  // Rule 3b: priority whitelist. The output template documents `Priority` as a
  // closed enum (primary | secondary | on_demand | hidden); enforce it so a
  // typo ("primay") or invented value ("tertiary") is caught the same way as a
  // bad anchor. Detail values are sanitized identically to Rule 3.
  if (allowedPriorities.length > 0 && rows.length > 0) {
    const allowedSet = new Set(allowedPriorities);
    const invalid = rows.filter((r) => !allowedSet.has(r.priority));
    if (invalid.length) {
      violations.push({
        severity: 'soft',
        rule: 'invalid_priority',
        detail: invalid.map((r) => ({
          fieldName: r.fieldName,
          priority: safeEnumValue(r.priority, { fpSet, domain }),
        })),
      });
    }
  }

  // Rule 4: gap report bidirectional
  const gap = parseGapReport(md);
  if (!gap.hasUIDirection || !gap.hasAPIDirection) {
    violations.push({
      severity: 'soft',
      rule: 'gap_direction_missing',
      detail: {
        hasUIDirection: gap.hasUIDirection,
        hasAPIDirection: gap.hasAPIDirection,
      },
    });
  }

  // Rule 5: anti-pattern section + ID whitelist
  const ap = parseAntiPatterns(md);
  if (!ap.present) {
    violations.push({ severity: 'soft', rule: 'anti_pattern_missing' });
  } else {
    if (ap.structured === false) {
      // Section exists but has neither table nor list structure — IDs cannot be
      // reliably extracted. Surface as soft warning so retry asks LLM to format.
      violations.push({ severity: 'soft', rule: 'anti_pattern_unstructured' });
    }
    if (allowedAntiPatterns.length > 0 && ap.ids.length > 0) {
      const allowedSet = new Set(allowedAntiPatterns);
      const invalid = ap.ids.filter((id) => !allowedSet.has(id));
      if (invalid.length) {
        // Route each invalid ID through safeEnumValue so an LLM that smuggles
        // a fingerprint-matched / PII-shaped token into the Pattern column
        // does not re-leak via the soft-violation retry context (mirrors the
        // sanitization Rule 3 / 3b apply to anchor + priority cells).
        violations.push({
          severity: 'soft',
          rule: 'invalid_anti_pattern_id',
          detail: invalid.map((id) => safeEnumValue(id, { fpSet, domain })),
        });
      }
    }
  }

  const ok = !violations.some((v) => v.severity === 'critical');
  return { ok, violations };
}

// ---------- Rule 1: fingerprint scan ----------

// Minimum candidate length avoids hashing single-char tokens (won't ever
// collide with a real secret) and keeps the scan fast on large reports.
const MIN_FP_CANDIDATE_LEN = 4;
// Tokenize on whitespace + common markdown/JSON delimiters; preserves the
// substring identity needed for sha256 prefix match.
const TOKEN_SPLIT_RE = /[\s,;|"`'\\<>(){}\[\]]+/;
// Punctuation that may "stick" to a token in markdown body text. We hash both
// the raw token AND the trim variants so leak forms like `supersecret.`,
// `secret,`, `pwd:secret`, `=secret` (whitespace-separated assignment) all
// hit the same fingerprint as `supersecret`. Includes assignment separators
// (`=` `:`) at the start so that `pwd =supersecret` (`=supersecret` token)
// is normalized to `supersecret`.
const TRIM_PUNCT_RE = /^[.,!?;:='"`)\]}>]+|[.,!?;:'"`(\[{<>]+$/g;

function scanByFingerprint(text, forbiddenFingerprints) {
  if (!forbiddenFingerprints || forbiddenFingerprints.size === 0) return [];
  const hits = [];
  const seenCandidates = new Set();
  const seenFingerprints = new Set();
  for (const rawToken of text.split(TOKEN_SPLIT_RE)) {
    if (!rawToken) continue;
    // Generate candidate variants: raw token, after assignment-RHS split, and
    // after stripping leading/trailing punctuation. Each candidate is hashed
    // independently — a raw value embedded inside any of these forms will be
    // caught.
    for (const candidate of candidateVariants(rawToken)) {
      if (candidate.length < MIN_FP_CANDIDATE_LEN) continue;
      if (seenCandidates.has(candidate)) continue;
      seenCandidates.add(candidate);
      const fp = sha256Prefix(candidate);
      if (forbiddenFingerprints.has(fp) && !seenFingerprints.has(fp)) {
        seenFingerprints.add(fp);
        // SECURITY: never return the raw matched value — it would re-expose
        // the leaked secret to the retry-context loop. Surface only the
        // fingerprint and a redacted preview hint (length + first/last 2 chars).
        hits.push({ fingerprint: fp, preview: previewMask(candidate) });
      }
    }
  }
  return hits;
}

function candidateVariants(rawToken) {
  const out = new Set();
  out.add(rawToken);
  // Strip surrounding punctuation (e.g., `supersecret.` → `supersecret`).
  const stripped = rawToken.replace(TRIM_PUNCT_RE, '');
  if (stripped.length > 0) out.add(stripped);
  // Assignment RHS: `pwd=secret`, `key:secret` → also hash `secret`.
  for (const sep of ['=', ':']) {
    const idx = rawToken.indexOf(sep);
    if (idx > 0 && idx < rawToken.length - 1) {
      const rhs = rawToken.slice(idx + 1).replace(TRIM_PUNCT_RE, '');
      if (rhs.length > 0) out.add(rhs);
    }
  }
  return out;
}

// Redact a leaked value to length-only metadata. No value-derived characters
// (not even first/last fragments) are emitted — for short secrets a 2-char
// fragment exposes most of the value, and the retry loop must never re-surface
// any value-derived character. Pattern class + length are enough for the LLM
// to understand "you leaked an N-char email" without re-leaking it.
function previewMask(value) {
  return `<redacted len=${value.length}>`;
}

function sha256Prefix(s) {
  const h = nodeCrypto.createHash('sha256').update(String(s)).digest('hex');
  return `sha256:${h.slice(0, 12)}`;
}

// ---------- Shared safe-detail formatter (Rules 3 / 3b) ----------

// Maximum length for an enum-like cell value to be safely echoed in
// soft-violation detail. Anything longer is treated as prose and length-only
// redacted to avoid re-surfacing arbitrary LLM output through retry context.
const MAX_ENUM_ECHO_LEN = 32;

// Returns a string safe to echo in soft-violation detail without re-leaking
// PII. Used by Rule 3 (invalid_anchor) and Rule 3b (invalid_priority).
//
// Discipline:
//   1. Empty / falsy → '<empty>' (preserves caller's pre-existing semantic).
//   2. Hits a Phase 1 fingerprint → previewMask (length only).
//   3. Hits Rule 1b PII regex → previewMask (length only).
//   4. Looks like prose / overlong cell → previewMask (length only).
//   5. Otherwise (genuine typo/invalid enum like `tertiary`) → echo as-is so
//      the retry context tells the LLM exactly which token to fix.
function safeEnumValue(rawValue, { fpSet, domain } = {}) {
  const value = typeof rawValue === 'string' ? rawValue.trim() : '';
  if (!value) return '<empty>';
  if (fpSet && fpSet.size > 0) {
    for (const candidate of candidateVariants(value)) {
      if (candidate.length < MIN_FP_CANDIDATE_LEN) continue;
      if (fpSet.has(sha256Prefix(candidate))) return previewMask(value);
    }
  }
  if (scanForPIIPatterns(value, { domain }).length > 0) return previewMask(value);
  if (value.length > MAX_ENUM_ECHO_LEN) return previewMask(value);
  return value;
}

// ---------- Rule 1b: generic PII regex rescan ----------

const EMAIL_PATTERN = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
const SSN_PATTERN = /\b\d{3}-\d{2}-\d{4}\b/g;
const TAIWAN_ID_PATTERN = /\b[A-Z][12]\d{8}\b/g;
// E.164: `+` followed by 8-15 digits. Negative look-around rejects adjacency
// to digits AND alphanumeric/underscore — without this, embedded forms like
// `abc+12345678def` would falsely match. Punctuation terminators
// (`;`, `!`, `?`, `]`, `}`, `"`, `'`, etc.) and whitespace are all accepted
// implicitly because they're not in the rejection class.
const E164_PATTERN = /(?<![+\dA-Za-z_])\+\d{8,15}(?![\dA-Za-z_])/g;
// Eth address & long hash — only enforced when domain != crypto, since under
// crypto domain these are legitimate first-class data and would create noise.
const ETH_ADDR_PATTERN = /\b0x[0-9a-fA-F]{40}\b/g;
const ETH_HASH_PATTERN = /\b0x[0-9a-fA-F]{64}\b/g;

function scanForPIIPatterns(text, { domain }) {
  const hits = [];
  collectMatches(text, EMAIL_PATTERN, 'email', hits);
  collectMatches(text, SSN_PATTERN, 'national_id', hits);
  collectMatches(text, TAIWAN_ID_PATTERN, 'national_id', hits);
  // E164 — preview-only (regex no longer uses a capture group; full match is the value)
  for (const m of cloneAndMatch(text, E164_PATTERN)) {
    hits.push({ pattern: 'phone', preview: previewMask(m[0]) });
  }
  if (domain !== 'crypto') {
    collectMatches(text, ETH_ADDR_PATTERN, 'eth_address', hits);
    collectMatches(text, ETH_HASH_PATTERN, 'eth_hash', hits);
  }
  return hits;
}

function collectMatches(text, pattern, label, hits) {
  for (const m of cloneAndMatch(text, pattern)) {
    // SECURITY: do not surface the raw matched value — emit only the pattern
    // class and a redacted preview, matching scanByFingerprint's discipline.
    hits.push({ pattern: label, preview: previewMask(m[0]) });
  }
}

// Always clone the regex so that shared `g`-flag patterns cannot leak
// `lastIndex` state between calls (mirrors the same defense in redact.js).
function cloneAndMatch(text, pattern) {
  const flags = pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g';
  const fresh = new RegExp(pattern.source, flags);
  return text.matchAll(fresh);
}

// ---------- Rule 2: decision row parser ----------

// Output template (T8) prescribes a `## Field Decision Table` section with a
// markdown table whose header columns are: Field | Priority | Principle Anchor | Rationale
// Parser is permissive on column order — it locates the column indexes from
// the header row by case-insensitive name match.
function parseDecisionRows(md) {
  const tables = extractTablesUnderHeading(md, /field\s+decision/i);
  const rows = [];
  for (const tbl of tables) {
    const header = tbl.header.map((h) => h.trim().toLowerCase());
    const fieldIdx = header.findIndex((h) => /^field\b/.test(h));
    const priorityIdx = header.findIndex((h) => /^priority\b/.test(h));
    const anchorIdx = header.findIndex((h) => /^principle\s*anchor\b/.test(h));
    if (fieldIdx === -1) continue;
    for (const cells of tbl.rows) {
      const fieldName = normalizeCell(cells[fieldIdx]);
      if (!fieldName) continue;
      rows.push({
        fieldName,
        priority: priorityIdx >= 0 ? normalizeCell(cells[priorityIdx]) : '',
        principleAnchor: anchorIdx >= 0 ? normalizeCell(cells[anchorIdx]) : '',
      });
    }
  }
  return rows;
}

// Strip common markdown decorations from table cells so that `` `txHash` ``,
// `**txHash**`, `[txHash](#anchor)` all reduce to `txHash`.
// IMPORTANT: underscores are NEVER stripped — leading underscores are part
// of legitimate API identifiers (`_id`, `__typename`, `_internal`). The
// only italic markers stripped here are backticks (inline code) and
// asterisks (bold/italic). Authors who prefer `_field_` italic styling
// inside table cells must wrap field names in backticks instead.
function normalizeCell(raw) {
  if (typeof raw !== 'string') return '';
  let s = raw.trim();
  // Markdown link `[text](url)` → `text`
  s = s.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
  // Backticks for inline code (greedy global strip — backticks never appear inside identifiers)
  s = s.replace(/`+/g, '');
  // Bold/italic asterisks: `**name**` / `*name*` (asterisks never appear inside identifiers)
  s = s.replace(/\*+/g, '');
  return s.trim();
}

// ---------- Rule 4: gap report parser ----------

function parseGapReport(md) {
  // Heading (## or ###) text containing "gap" — case-insensitive.
  const section = extractSectionByHeading(md, /gap\s*report/i);
  if (!section) return { hasUIDirection: false, hasAPIDirection: false };
  const lower = section.toLowerCase();
  // Direction A: "UI needs but API missing" (or close variants).
  const hasUIDirection =
    /ui\s*(needs?|requires?)\s*but\s*api\s*(missing|absent|lacks?)/i.test(section) ||
    /ui_needs_but_api_missing/i.test(lower);
  // Direction B: "API provides but UI ignores".
  const hasAPIDirection =
    /api\s*(provides?|returns?|exposes?)\s*but\s*ui\s*(ignores?|skips?|drops?)/i.test(section) ||
    /api_provides_but_ui_ignores/i.test(lower);
  return { hasUIDirection, hasAPIDirection };
}

// ---------- Rule 5: anti-pattern parser ----------

function parseAntiPatterns(md) {
  const section = extractSectionByHeading(md, /anti[-\s]*pattern/i);
  if (!section) return { present: false, ids: [] };
  // IDs are sourced ONLY from the dedicated `Pattern` (or `ID`/`Name`) column
  // of a markdown table inside this section. Free-text backtick scanning was
  // intentionally removed because affected-field cells (e.g.,
  // `` `raw_signature` ``) are also backticked snake_case and were polluting
  // the ID set with false positives. If no table is present, fall back to
  // any backticked snake_case token at the start of a list item line.
  const ids = [];
  const seen = new Set();
  const pushId = (raw) => {
    const id = String(raw || '').trim();
    if (!id || seen.has(id)) return;
    if (!/^[a-z][a-z0-9_]+$/.test(id)) return;
    seen.add(id);
    ids.push(id);
  };
  const tables = extractTablesFromText(section);
  if (tables.length > 0) {
    for (const tbl of tables) {
      const header = tbl.header.map((h) => h.trim().toLowerCase());
      const idx = header.findIndex((h) => /^(pattern|id|name)\b/.test(h));
      const colIdx = idx >= 0 ? idx : 0; // default to first column
      for (const cells of tbl.rows) {
        pushId(normalizeCell(cells[colIdx]));
      }
    }
    return { present: true, ids, structured: true };
  }

  // No table — second tier: scan list items like `- \`too_many_primary\`: ...`
  let foundListItems = false;
  for (const m of section.matchAll(/^\s*[-*]\s+`([a-z][a-z0-9_]+)`/gm)) {
    foundListItems = true;
    pushId(m[1]);
  }
  if (foundListItems) return { present: true, ids, structured: true };

  // No table AND no list: do NOT prose-scan backticked tokens — it would
  // false-positive on backticked field names like `raw_signature` mentioned
  // in narrative ("flags `too_many_primary` because fields `raw_signature`
  // and `gas_price` are noisy"). Surface the structural failure as a soft
  // warning (`anti_pattern_unstructured`) so the LLM is told to use a
  // table/list format on retry; do not invent IDs.
  return { present: true, ids: [], structured: false };
}

// ---------- Markdown table / section extractors ----------

// Extracts every markdown table that appears under a heading whose text matches
// `headingRe`. Returns array of `{ header: string[], rows: string[][] }`.
function extractTablesUnderHeading(md, headingRe) {
  const sections = extractAllSectionsByHeading(md, headingRe);
  const tables = [];
  for (const sec of sections) {
    tables.push(...extractTablesFromText(sec));
  }
  return tables;
}

function extractTablesFromText(text) {
  const lines = text.split(/\r?\n/);
  const tables = [];
  let i = 0;
  while (i < lines.length) {
    if (isTableRow(lines[i]) && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      const header = splitRow(lines[i]);
      const rows = [];
      let j = i + 2;
      while (j < lines.length && isTableRow(lines[j])) {
        rows.push(splitRow(lines[j]));
        j += 1;
      }
      tables.push({ header, rows });
      i = j;
    } else {
      i += 1;
    }
  }
  return tables;
}

function isTableRow(line) {
  return /^\s*\|.*\|\s*$/.test(line);
}

function isTableSeparator(line) {
  return /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?\s*$/.test(line);
}

function splitRow(line) {
  const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  return trimmed.split('|').map((c) => c.trim());
}

function extractAllSectionsByHeading(md, headingRe) {
  const lines = md.split(/\r?\n/);
  const out = [];
  let collecting = false;
  let buf = [];
  let activeLevel = 0;
  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const headingText = headingMatch[2];
      if (collecting && level <= activeLevel) {
        out.push(buf.join('\n'));
        collecting = false;
        buf = [];
      }
      if (headingRe.test(headingText)) {
        collecting = true;
        activeLevel = level;
        buf = [line];
        continue;
      }
    }
    if (collecting) buf.push(line);
  }
  if (collecting) out.push(buf.join('\n'));
  return out;
}

function extractSectionByHeading(md, headingRe) {
  const all = extractAllSectionsByHeading(md, headingRe);
  return all.length > 0 ? all[0] : null;
}

module.exports = {
  validate,
  // Exported for unit testing
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
};

// ---------- CLI ----------

// Invoked by SKILL.md Phase 7 as:
//   node scripts/skills/ui-first-principles/validate-report.js \
//     --report  <draft.md> \
//     --bundle  <bundle.json> \
//     --domain  <crypto|''>
//
// Prints the validate() result as JSON on stdout. Exit code is always 0 —
// SKILL.md decides retry vs `⚠️ Need Human` from the JSON `ok` + `violations`.
// A hard failure (missing flag, unreadable file, malformed bundle) exits 2 and
// writes a JSON error to stdout so the caller can still parse it.
function parseCliArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--report' || arg === '--bundle' || arg === '--domain') {
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) {
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
    args = parseCliArgs(argv);
  } catch (err) {
    stderr.write(`validate-report: ${err.message}\n`);
    stdout.write(JSON.stringify({ ok: false, error: 'cli_args', detail: err.message }) + '\n');
    return exit(2);
  }
  if (!args.report || !args.bundle) {
    const msg = 'usage: --report <draft.md> --bundle <bundle.json> [--domain crypto]';
    stderr.write(`validate-report: ${msg}\n`);
    stdout.write(JSON.stringify({ ok: false, error: 'cli_args', detail: msg }) + '\n');
    return exit(2);
  }
  let markdown;
  let bundle;
  try {
    markdown = fs.readFileSync(args.report, 'utf8');
  } catch (err) {
    stdout.write(JSON.stringify({ ok: false, error: 'unreadable_report', detail: err.message }) + '\n');
    return exit(2);
  }
  try {
    bundle = JSON.parse(fs.readFileSync(args.bundle, 'utf8'));
  } catch (err) {
    stdout.write(JSON.stringify({ ok: false, error: 'unreadable_bundle', detail: err.message }) + '\n');
    return exit(2);
  }
  // Defensive: a bundle that is null, an array, or a primitive would crash
  // the field/allowlist projection below with a confusing TypeError. Treat
  // anything that is not a plain object as `invalid_bundle` so the CLI exit
  // path is structured JSON instead of an uncaught stack trace.
  if (bundle === null || typeof bundle !== 'object' || Array.isArray(bundle)) {
    stdout.write(JSON.stringify({ ok: false, error: 'invalid_bundle', detail: 'bundle must be a JSON object' }) + '\n');
    return exit(2);
  }
  function rejectBundle(detail) {
    stdout.write(JSON.stringify({ ok: false, error: 'invalid_bundle', detail }) + '\n');
    return exit(2);
  }
  // forbiddenFingerprints must be an array of strings (or absent). Accept
  // missing → empty Set; reject any other shape so `new Set(non-iterable)`
  // cannot throw mid-validate. Element-shape check ensures Rule 1 (fingerprint
  // scan) cannot be silently disabled by smuggling a non-string entry that
  // sha256Prefix() would not match.
  let fpArray = [];
  if (bundle.forbiddenFingerprints !== undefined) {
    if (!Array.isArray(bundle.forbiddenFingerprints)) {
      return rejectBundle('forbiddenFingerprints must be an array');
    }
    if (!bundle.forbiddenFingerprints.every((x) => typeof x === 'string' && x.length > 0)) {
      return rejectBundle('forbiddenFingerprints must contain only non-empty strings');
    }
    fpArray = bundle.forbiddenFingerprints;
  }
  // Optional-but-array-shaped allowlist keys. Missing → validator falls back
  // to its own defaults; *present-but-malformed* would silently disable the
  // corresponding rule (Rules 3/3b/5) and is therefore rejected as
  // `invalid_bundle`. Three layers of malformation are caught:
  //   1. non-array (e.g. `"JTBD"`) — fails Array.isArray
  //   2. wrong element type (e.g. `[123, null]`) — fails every(string)
  //   3. empty array (e.g. `[]`) — would pass every() vacuously and then
  //      validate() skips the rule because it gates on `length > 0`
  //      (validate-report.js lines 88, 107, 145). Reject so callers cannot
  //      silently disable enforcement by sending an empty allowlist.
  const optionalStringArrayKeys = ['allowedPrinciples', 'allowedPriorities', 'allowedAntiPatterns'];
  for (const key of optionalStringArrayKeys) {
    if (bundle[key] === undefined) continue;
    if (!Array.isArray(bundle[key])) return rejectBundle(`${key} must be an array`);
    if (bundle[key].length === 0) return rejectBundle(`${key} must be a non-empty array`);
    if (!bundle[key].every((x) => typeof x === 'string' && x.length > 0)) {
      return rejectBundle(`${key} must contain only non-empty strings`);
    }
  }
  if (bundle.fields !== undefined) {
    // Asymmetry note: unlike the allowlist arrays above, an empty `fields`
    // array IS accepted. Allowlists are policy (empty = "no enforcement",
    // a silent-disable footgun). `fields` is domain input — Phase 2 may
    // legitimately emit `fields: []` when the API sample has no parseable
    // top-level keys, in which case Rule 2 (`missing_decision`) correctly
    // produces zero violations. Do not tighten without revisiting Phase 2.
    if (!Array.isArray(bundle.fields)) return rejectBundle('fields must be an array');
    const badField = bundle.fields.find(
      (f) => f === null || typeof f !== 'object' || Array.isArray(f) || typeof f.name !== 'string' || f.name.length === 0,
    );
    if (badField !== undefined) {
      return rejectBundle('fields must contain only objects with a non-empty string `name`');
    }
  }
  const domain = args.domain && args.domain.length > 0 ? args.domain : null;
  const opts = {
    // Element shape already enforced by the `bundle.fields` block above —
    // entries are guaranteed to be `{ name: <non-empty string>, ... }`.
    fieldNames: (bundle.fields || []).map((f) => f.name),
    allowedPrinciples: bundle.allowedPrinciples,
    allowedPriorities: bundle.allowedPriorities,
    allowedAntiPatterns: bundle.allowedAntiPatterns,
    forbiddenFingerprints: new Set(fpArray),
    domain,
  };
  // Drop undefined entries so validate() falls back to its own defaults
  // (e.g., the 4 canonical priorities) when the bundle does not pin a list.
  for (const k of Object.keys(opts)) if (opts[k] === undefined) delete opts[k];
  const result = validate(markdown, opts);
  stdout.write(JSON.stringify(result) + '\n');
  return exit(0);
}

if (require.main === module) {
  runCli();
}
