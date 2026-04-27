'use strict';

/**
 * Parse `/test-health` output (quick or full dashboard) into a DimensionResult.
 *
 * Heuristics:
 *   - Look for Quick Verdicts / Verdicts section
 *   - Count OK / WARN / FAIL entries
 *   - FAIL present → fail
 *   - WARN present (no FAIL) → partial
 *   - OK only → pass
 *   - no verdict section → unverified
 *
 * @param {string} text
 * @returns {object}
 */
function parse(text) {
  const base = {
    name: 'test_coverage',
    enabled: true,
    provider: '/test-health',
    status: 'unverified',
    applicable_items: 0,
    summary: '',
  };
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    base.summary = 'empty output';
    return base;
  }

  const hasHeader = /Test\s+Health/i.test(text);
  if (!hasHeader) {
    base.summary = 'no test-health header';
    return base;
  }

  const verdicts = parseVerdictTable(text);
  base.applicable_items = verdicts.total;

  if (verdicts.fail > 0) base.status = 'fail';
  else if (verdicts.warn > 0) base.status = 'partial';
  else if (verdicts.ok > 0) base.status = 'pass';
  else base.status = 'unverified';

  base.summary = formatSummary(verdicts);
  return base;
}

function parseVerdictTable(text) {
  const counts = { ok: 0, warn: 0, fail: 0 };
  // Match markdown table rows whose last meaningful cell is OK/WARN/FAIL
  const rowRe = /^\|\s*([^|]+?)\s*\|\s*(OK|WARN|FAIL)\b/;
  for (const line of text.split('\n')) {
    const m = line.match(rowRe);
    if (!m) continue;
    const v = m[2].toLowerCase();
    if (counts[v] != null) counts[v] += 1;
  }
  counts.total = counts.ok + counts.warn + counts.fail;
  return counts;
}

function formatSummary(counts) {
  if (counts.total === 0) return 'no verdict rows found';
  return `ok=${counts.ok} warn=${counts.warn} fail=${counts.fail}`;
}

module.exports = { parse };
