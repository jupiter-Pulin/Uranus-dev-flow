'use strict';

/**
 * Parse `/check-coverage` skill output (see skills/check-coverage/SKILL.md
 * §Output) into a DimensionResult.
 *
 * Mapping:
 *   🔴 Critical / 🟠 Major → fail
 *   🟡 Minor only → partial
 *   ⚪ Nice-to-have only / no gaps → pass
 *   empty/unparseable → unverified
 *
 * @param {string} text - raw output of /check-coverage
 * @returns {{name: 'test_coverage', enabled: true, provider: '/check-coverage', status: string, applicable_items: number, summary: string}}
 */
function parse(text) {
  const base = {
    name: 'test_coverage',
    enabled: true,
    provider: '/check-coverage',
    status: 'unverified',
    applicable_items: 0,
    summary: '',
  };
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    base.summary = 'empty output';
    return base;
  }

  const hasHeader = /Test\s+Coverage\s+Analysis\s+Report/i.test(text)
    || /Coverage\s+Gaps/i.test(text)
    || /Current\s+Coverage/i.test(text);
  if (!hasHeader) {
    base.summary = 'no recognisable coverage-report header';
    return base;
  }

  const counts = countGapsBySeverity(text);
  base.applicable_items = counts.total;

  if (counts.critical > 0 || counts.major > 0) {
    base.status = 'fail';
  } else if (counts.minor > 0) {
    base.status = 'partial';
  } else {
    base.status = 'pass';
  }
  base.summary = formatSummary(counts);
  return base;
}

function countGapsBySeverity(text) {
  const buckets = {
    critical: extractSectionItemCount(text, /###\s+🔴\s+Critical/),
    major: extractSectionItemCount(text, /###\s+🟠\s+Major/),
    minor: extractSectionItemCount(text, /###\s+🟡\s+Minor/),
    nice: extractSectionItemCount(text, /###\s+⚪\s+Nice[- ]to[- ]have/i),
  };
  buckets.total = buckets.critical + buckets.major + buckets.minor + buckets.nice;
  return buckets;
}

function extractSectionItemCount(text, headingRe) {
  const match = text.match(headingRe);
  if (!match || match.index == null) return 0;
  const after = text.slice(match.index + match[0].length);
  const nextHeading = after.match(/^##\s+|^###\s+/m);
  const body = nextHeading ? after.slice(0, nextHeading.index) : after;
  const bullets = body.match(/^\s*-\s+\S.*$/gm);
  return bullets ? bullets.length : 0;
}

function formatSummary(counts) {
  const parts = [];
  if (counts.critical) parts.push(`${counts.critical} critical`);
  if (counts.major) parts.push(`${counts.major} major`);
  if (counts.minor) parts.push(`${counts.minor} minor`);
  if (counts.nice) parts.push(`${counts.nice} nice-to-have`);
  if (parts.length === 0) return 'no coverage gaps';
  return parts.join(', ');
}

module.exports = { parse };
