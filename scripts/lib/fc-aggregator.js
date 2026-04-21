'use strict';

const path = require('node:path');
const { spawnSync } = require('node:child_process');

const { safeSlug, sha1, ensureDir, writeJson, nowISO } = require('./utils');

const BASELINE_DIMS = [
  'spec_presence',
  'code_implementation',
  'test_coverage',
  'ac_evidence',
  'doc_currency',
];

const OPTIN_DIMS = [
  'security_review',
  'runtime_verification',
  'risk_alignment',
  'spec_review',
];

const NON_VERDICT_DIMS = new Set(['codex_challenge']);

const PROHIBITED_DOMAINS = new Set(['security', 'data-integrity', 'regression']);

const SNAPSHOT_VERSION = 1;

/**
 * Aggregate items + dimension results into a CompletenessSnapshot with a
 * 3-tier verdict, applying hard-fail overrides.
 *
 * @param {object} params
 * @param {Array} params.items - from fc-extractor
 * @param {Array} params.dimensions - DimensionResult[]
 * @param {'unresolved' | 'no-spec' | 'partial-spec' | 'full-spec'} params.specState
 * @param {string} params.featureKey
 * @param {'quick' | 'standard' | 'deep'} [params.mode]
 * @param {string} params.repoRoot
 * @param {object} [params.sources]
 * @param {object} [params.requestsScope]
 * @returns {object} CompletenessSnapshot
 */
function aggregate(params) {
  const {
    items = [],
    dimensions = [],
    specState,
    featureKey,
    mode = 'standard',
    repoRoot,
    sources = { requirements: null, tech_spec: null },
    requestsScope = { mode: 'open', included: [] },
  } = params;

  const { verdict, hardFails } = computeVerdict({ specState, dimensions, items });

  return {
    version: SNAPSHOT_VERSION,
    feature_key: featureKey,
    timestamp: nowISO(),
    mode,
    spec_state: specState,
    source_of_truth: {
      canonical_docs: sources,
      requests_scope: requestsScope.mode || 'open',
      requests_included: requestsScope.included || [],
    },
    items,
    dimensions,
    verdict,
    hard_fail_triggers: hardFails,
    redaction_applied: false,
  };
}

/**
 * Compute the verdict given spec state and dimension results.
 *
 * @param {object} params
 * @returns {{verdict: object, hardFails: string[]}}
 */
function computeVerdict({ specState, dimensions, items }) {
  const hardFails = [];

  if (specState === 'unresolved') {
    return {
      verdict: makeVerdict('Need Human', '⚠️', 'feature key unresolved — no spec source'),
      hardFails,
    };
  }
  if (specState === 'no-spec') {
    hardFails.push('spec_missing');
    return {
      verdict: makeVerdict('Incomplete', '⛔', 'no 1-requirements.md or 2-tech-spec.md'),
      hardFails,
    };
  }

  const prohibitedBreaches = findProhibitedDomainInadequate(items, dimensions);
  if (prohibitedBreaches.length > 0) {
    const seen = new Set();
    for (const b of prohibitedBreaches) {
      // Include source_doc in the emitted trigger so the string distinguishes
      // same-id ACs across multiple request docs. Collapse repeats so the
      // rationale line stays readable even when several breaches share all
      // attributes.
      const suffix = b.source_doc ? `@${b.source_doc}` : '';
      const emitted = `prohibited_domain:${b.ac_id}${suffix}:${b.domains.join(',')}`;
      if (seen.has(emitted)) continue;
      seen.add(emitted);
      hardFails.push(emitted);
    }
  }

  // Baseline presence check: any required baseline dim not provided (or disabled)
  // is treated as 'unverified' so verdict math cannot short-circuit to
  // Feature-Complete when callers forget dims.
  const presentBaseline = new Map();
  for (const d of dimensions) {
    if (!d || !BASELINE_DIMS.includes(d.name)) continue;
    if (!d.enabled) continue;
    presentBaseline.set(d.name, d);
  }
  const missingBaseline = BASELINE_DIMS.filter(name => !presentBaseline.has(name));

  let baselineHasFail = false;
  let baselineHasGap = missingBaseline.length > 0;
  let optHasFail = false;

  for (const d of dimensions) {
    if (!d || NON_VERDICT_DIMS.has(d.name)) continue;
    if (!d.enabled) continue;
    const isBaseline = BASELINE_DIMS.includes(d.name);
    const isOpt = OPTIN_DIMS.includes(d.name);
    if (!isBaseline && !isOpt) continue;

    if (isBaseline) {
      if (d.status === 'fail') baselineHasFail = true;
      else if (d.status === 'partial' || d.status === 'unverified') baselineHasGap = true;
    } else if (d.status === 'fail') {
      optHasFail = true;
    }
  }

  // Hard-fail override forces ⛔ Incomplete
  if (hardFails.length > 0) {
    return {
      verdict: makeVerdict(
        'Incomplete',
        '⛔',
        `hard-fail override: ${hardFails.join('; ')}`,
      ),
      hardFails,
    };
  }

  if (baselineHasFail) {
    return {
      verdict: makeVerdict('Incomplete', '⛔', 'one or more baseline dimensions failing'),
      hardFails,
    };
  }
  if (baselineHasGap) {
    const reasonDetail = missingBaseline.length > 0
      ? `missing baseline dims: ${missingBaseline.join(', ')}`
      : 'baseline dimensions have gaps / unverified';
    return {
      verdict: makeVerdict('Partial', '⚠️', reasonDetail),
      hardFails,
    };
  }
  if (optHasFail) {
    return {
      verdict: makeVerdict('Partial', '⚠️', 'opt-in dimension failing (baseline ok)'),
      hardFails,
    };
  }
  return {
    verdict: makeVerdict('Feature-Complete', '✅', 'all verdict-contributing dimensions pass'),
    hardFails,
  };
}

function makeVerdict(status, icon, rationale) {
  return { status, icon, rationale };
}

function findProhibitedDomainInadequate(items, dimensions) {
  const acDim = dimensions.find(d => d && d.name === 'ac_evidence');
  if (!acDim || !Array.isArray(acDim.per_ac)) return [];

  // Multi-request safety: the same AC id (e.g. AC-1) can legitimately appear
  // in multiple request docs. Id-only lookup would overwrite per Map
  // semantics; composite key (source_doc + id) preserves each verdict.
  // When the parser omits source_doc, fall back to id-scoped Set so any
  // INADEQUATE verdict still triggers a hard-fail (conservative over-report
  // is safer than silent under-report for prohibited domains).
  const compositeVerdict = new Map();
  const idVerdicts = new Map();
  for (const row of acDim.per_ac) {
    if (!row || !row.id || !row.verdict) continue;
    if (row.source_doc) {
      compositeVerdict.set(`${row.source_doc}#${row.id}`, row.verdict);
    }
    if (!idVerdicts.has(row.id)) idVerdicts.set(row.id, new Set());
    idVerdicts.get(row.id).add(row.verdict);
  }

  const breaches = [];
  const seenBreach = new Set();
  for (const item of items) {
    if (!item || item.type !== 'AC') continue;
    if (!Array.isArray(item.domains) || item.domains.length === 0) continue;
    const protectedDomains = item.domains.filter(d => PROHIBITED_DOMAINS.has(d));
    if (protectedDomains.length === 0) continue;

    let triggered = false;
    let reason = 'INADEQUATE';
    const compKey = item.source_doc ? `${item.source_doc}#${item.id}` : null;
    if (compKey && compositeVerdict.has(compKey)) {
      triggered = compositeVerdict.get(compKey) === 'INADEQUATE';
    } else if (idVerdicts.has(item.id)) {
      const set = idVerdicts.get(item.id);
      if (set.has('INADEQUATE')) triggered = true;
    } else {
      // Prohibited-domain AC with no verdict row at all. Missing evidence is
      // indistinguishable from silent failure for security / data-integrity /
      // regression ACs, so escalate to hard-fail (safer to block merge than
      // let a silent omission pass).
      triggered = true;
      reason = 'NO_VERDICT';
    }

    if (!triggered) continue;
    const dedupeKey = `${item.source_doc || ''}#${item.id}`;
    if (seenBreach.has(dedupeKey)) continue;
    seenBreach.add(dedupeKey);
    breaches.push({
      ac_id: item.id,
      source_doc: item.source_doc || null,
      domains: protectedDomains,
      reason,
    });
  }
  return breaches;
}

/**
 * Compute a stable repo-key (matching test-health convention) for
 * cache directory naming.
 *
 * @param {string} repoRoot
 * @param {string} [remoteUrl]
 * @returns {string}
 */
function repoKey(repoRoot, remoteUrl) {
  const remote = remoteUrl != null ? remoteUrl : detectRemote(repoRoot);
  const base = path.basename(repoRoot);
  return `${safeSlug(base)}--${sha1(remote || repoRoot).slice(0, 8)}`;
}

function detectRemote(repoRoot) {
  try {
    const r = spawnSync('git', ['remote', 'get-url', 'origin'], { cwd: repoRoot, encoding: 'utf8' });
    if (r.status === 0 && r.stdout) return r.stdout.trim();
  } catch { /* ignore */ }
  return null;
}

/**
 * Write the snapshot to `.claude/cache/feature-completeness/<repoKey>/`.
 * Returns the directory paths written.
 *
 * @param {object} snapshot - from aggregate()
 * @param {object} [options]
 * @param {string} options.repoRoot
 * @param {string} [options.remoteUrl] - override for stable-key derivation in tests
 * @param {string} [options.headSha] - override current HEAD sha for history filename
 * @returns {{ cacheDir: string, latestPath: string, historyPath: string }}
 */
function writeSnapshot(snapshot, options) {
  const { repoRoot, remoteUrl, headSha } = options || {};
  if (!repoRoot) throw new Error('writeSnapshot requires options.repoRoot');

  const key = repoKey(repoRoot, remoteUrl);
  const cacheDir = path.join(repoRoot, '.claude', 'cache', 'feature-completeness', key);
  ensureDir(cacheDir);
  ensureDir(path.join(cacheDir, 'history'));

  const latestPath = path.join(cacheDir, 'latest.json');
  writeJson(latestPath, snapshot);

  const ts = snapshot.timestamp || nowISO();
  const datePart = ts.slice(0, 10).replace(/-/g, '');
  const sha = headSha || detectHeadSha(repoRoot) || 'nohead';
  const featurePart = safeSlug(snapshot.feature_key || 'unknown');
  const historyPath = path.join(cacheDir, 'history', `${datePart}-${sha.slice(0, 7)}-${featurePart}.json`);
  writeJson(historyPath, snapshot);

  return { cacheDir, latestPath, historyPath };
}

function detectHeadSha(repoRoot) {
  try {
    const r = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' });
    if (r.status === 0 && r.stdout) return r.stdout.trim();
  } catch { /* ignore */ }
  return null;
}

module.exports = {
  aggregate,
  computeVerdict,
  writeSnapshot,
  repoKey,
  BASELINE_DIMS,
  OPTIN_DIMS,
  NON_VERDICT_DIMS,
  PROHIBITED_DOMAINS,
  SNAPSHOT_VERSION,
};
