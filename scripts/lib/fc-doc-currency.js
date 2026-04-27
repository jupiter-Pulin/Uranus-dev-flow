'use strict';

const { spawnSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

const SECONDS_PER_DAY = 86400;
const DEFAULT_THRESHOLD_DAYS = 14;

/**
 * Run `git log -1 --format=%ct -- <file>` relative to repoRoot and return the
 * commit timestamp (seconds since epoch) or null when unavailable.
 *
 * @param {string} repoRoot
 * @param {string} relPath - path relative to repo root
 * @param {function} [runner] - dependency-injection hook for tests
 * @returns {number|null}
 */
function latestGitCommitTimestamp(repoRoot, relPath, runner) {
  const run = runner || defaultRunner;
  const out = run(repoRoot, ['log', '-1', '--format=%ct', '--', relPath]);
  if (out == null) return null;
  const trimmed = String(out).trim();
  if (!trimmed) return null;
  const n = Number.parseInt(trimmed, 10);
  return Number.isFinite(n) ? n : null;
}

function defaultRunner(cwd, args) {
  try {
    const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
    if (r.status !== 0) return null;
    return r.stdout || null;
  } catch {
    return null;
  }
}

/**
 * Compare one doc path against a list of code paths and classify drift.
 *
 * Rules:
 *   - doc unknown mtime → unverified
 *   - no code paths provided → pass (nothing to compare against)
 *   - all code paths < doc mtime (or equal) → pass
 *   - some code paths newer than doc by < threshold days → partial (fresh drift)
 *   - some code paths newer than doc by >= threshold days → fail (stale doc)
 *
 * @param {object} params
 * @param {string} params.docPath - path relative to repoRoot
 * @param {string[]} params.codePaths - paths relative to repoRoot
 * @param {string} params.repoRoot - absolute repo root
 * @param {number} [params.thresholdDays] - default 14
 * @param {function} [params.runner] - dependency-injection for tests
 * @returns {{name: 'doc_currency', enabled: true, provider: 'self', status: string, applicable_items: number, summary: string, details: object}}
 */
function checkCurrency(params) {
  const {
    docPath,
    codePaths = [],
    repoRoot,
    thresholdDays = DEFAULT_THRESHOLD_DAYS,
    runner,
  } = params;

  const result = {
    name: 'doc_currency',
    enabled: true,
    provider: 'self',
    status: 'unverified',
    applicable_items: 1,
    summary: '',
    details: {
      doc_ts: null,
      drift_days: 0,
      stale_paths: [],
      threshold_days: thresholdDays,
    },
  };

  const docTs = latestGitCommitTimestamp(repoRoot, docPath, runner);
  if (docTs == null) {
    result.summary = `git log unavailable for ${docPath}`;
    return result;
  }
  result.details.doc_ts = docTs;

  if (!Array.isArray(codePaths) || codePaths.length === 0) {
    result.status = 'pass';
    result.summary = 'no code paths to compare';
    return result;
  }

  let maxCodeTs = 0;
  const stalePaths = [];
  for (const p of codePaths) {
    const ts = latestGitCommitTimestamp(repoRoot, p, runner);
    if (ts == null) continue;
    if (ts > maxCodeTs) maxCodeTs = ts;
    if (ts > docTs) stalePaths.push({ path: p, delta_days: toDays(ts - docTs) });
  }

  const driftSeconds = Math.max(0, maxCodeTs - docTs);
  const driftDays = toDays(driftSeconds);
  result.details.drift_days = driftDays;

  // Per tech-spec §3.4.3: drift-only → partial (reserve `fail` for an explicit
  // breaking-change signal, e.g. renamed function not reflected in doc — not
  // implemented in R1). Crossing the threshold escalates to a more pointed
  // partial summary but keeps the dimension status at `partial`.
  if (driftDays <= 0) {
    result.status = 'pass';
    result.summary = 'doc newer than or equal to all code paths';
    result.details.stale_paths = [];
  } else if (driftDays < thresholdDays) {
    result.status = 'partial';
    result.summary = `doc drifted ${driftDays.toFixed(1)}d (< ${thresholdDays}d threshold)`;
    result.details.stale_paths = stalePaths;
  } else {
    result.status = 'partial';
    result.summary = `doc stale by ${driftDays.toFixed(1)}d (>= ${thresholdDays}d threshold)`;
    result.details.stale_paths = stalePaths;
  }
  return result;
}

function toDays(seconds) {
  return Math.round((seconds / SECONDS_PER_DAY) * 10) / 10;
}

/**
 * Heuristic detector for squash-merge repos. If `auto-loop-project.md`
 * declares `## Git Memory: squash`, the caller may choose to widen the doc
 * timestamp source (e.g., grep commit messages). v1 only surfaces the signal;
 * widening is left to future work.
 *
 * Checks both `.claude/rules/auto-loop-project.md` (consumer deployments,
 * preferred) and `rules/auto-loop-project.md` (plugin source tree) so the
 * heuristic works regardless of where the skill executes.
 *
 * @param {string} repoRoot
 * @returns {boolean}
 */
function isSquashMergeRepo(repoRoot) {
  const candidates = [
    path.join(repoRoot, '.claude', 'rules', 'auto-loop-project.md'),
    path.join(repoRoot, 'rules', 'auto-loop-project.md'),
  ];
  for (const p of candidates) {
    try {
      const src = fs.readFileSync(p, 'utf8');
      if (/##\s+Git\s+Memory\s*\n[\s\S]{0,120}?squash/i.test(src)) return true;
    } catch { /* next candidate */ }
  }
  return false;
}

module.exports = {
  checkCurrency,
  latestGitCommitTimestamp,
  isSquashMergeRepo,
  DEFAULT_THRESHOLD_DAYS,
};
