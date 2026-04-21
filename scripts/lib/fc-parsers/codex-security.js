'use strict';

/**
 * Parse `/codex-security` OWASP review output into a DimensionResult.
 *
 * Mapping:
 *   any P0 / P1 finding → fail
 *   only P2 / Nit → partial
 *   no findings → pass
 *   empty/unparseable → unverified
 *
 * @param {string} text
 * @returns {object}
 */
function parse(text) {
  const base = {
    name: 'security_review',
    enabled: true,
    provider: '/codex-security',
    status: 'unverified',
    applicable_items: 0,
    summary: '',
  };
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    base.summary = 'empty output';
    return base;
  }

  const hasHeader = /Security\s+Review|OWASP/i.test(text);
  if (!hasHeader) {
    base.summary = 'no security-review header';
    return base;
  }

  const counts = countFindings(text);
  base.applicable_items = counts.total;

  if (counts.p0 > 0 || counts.p1 > 0) base.status = 'fail';
  else if (counts.p2 > 0 || counts.nit > 0) base.status = 'partial';
  else base.status = 'pass';

  base.summary = formatSummary(counts);
  return base;
}

function countFindings(text) {
  const counts = { p0: 0, p1: 0, p2: 0, nit: 0 };
  const bulletRe = /^\s*-\s*\[?(P0|P1|P2|Nit)\]?/im;
  for (const line of text.split('\n')) {
    const m = line.match(bulletRe);
    if (!m) continue;
    const key = m[1].toLowerCase();
    if (counts[key] != null) counts[key] += 1;
  }
  counts.total = counts.p0 + counts.p1 + counts.p2 + counts.nit;
  return counts;
}

function formatSummary(counts) {
  if (counts.total === 0) return 'no findings';
  const parts = [];
  if (counts.p0) parts.push(`${counts.p0} P0`);
  if (counts.p1) parts.push(`${counts.p1} P1`);
  if (counts.p2) parts.push(`${counts.p2} P2`);
  if (counts.nit) parts.push(`${counts.nit} Nit`);
  return parts.join(', ');
}

module.exports = { parse };
