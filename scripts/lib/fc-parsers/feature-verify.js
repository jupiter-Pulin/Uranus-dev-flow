'use strict';

/**
 * Parse `/feature-verify` output (L1-L5 confidence report) into a
 * DimensionResult.
 *
 * Mapping per tech-spec §3.4.3:
 *   L1 or L2 level → partial (low-confidence runtime check)
 *   L3+ with pass verdict → pass
 *   L3+ with fail verdict → fail
 *   unparseable → unverified
 *
 * @param {string} text
 * @returns {object}
 */
function parse(text) {
  const base = {
    name: 'runtime_verification',
    enabled: true,
    provider: '/feature-verify',
    status: 'unverified',
    applicable_items: 0,
    summary: '',
  };
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    base.summary = 'empty output';
    return base;
  }

  const level = extractLevel(text);
  if (!level) {
    base.summary = 'no L1-L5 level detected';
    return base;
  }
  base.applicable_items = 1;

  const levelNum = Number(level.slice(1, 2));
  const verdict = extractVerdict(text);
  if (levelNum <= 2) {
    base.status = 'partial';
  } else if (verdict === 'pass') {
    base.status = 'pass';
  } else if (verdict === 'fail') {
    base.status = 'fail';
  } else {
    base.status = 'partial';
  }
  base.summary = verdict ? `level=${level} verdict=${verdict}` : `level=${level}`;
  return base;
}

function extractLevel(text) {
  // Accept L1, L2, L3, L4, L5, L2-API, L2-OBS (as per skills/feature-verify)
  const m = text.match(/\bL([1-5])(?:-[A-Z]+)?\b/);
  return m ? m[0] : null;
}

function extractVerdict(text) {
  if (/(?:Integrated\s+Verdict|Verdict)\s*[:—-]\s*(?:✅|PASS|Pass)/.test(text)) return 'pass';
  if (/(?:Integrated\s+Verdict|Verdict)\s*[:—-]\s*(?:⛔|❌|FAIL|Fail)/.test(text)) return 'fail';
  if (/✅\s*Pass\b/i.test(text)) return 'pass';
  if (/⛔\s*Fail|❌\s*Fail/i.test(text)) return 'fail';
  return null;
}

module.exports = { parse };
