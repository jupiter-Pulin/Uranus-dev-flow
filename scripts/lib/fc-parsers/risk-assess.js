'use strict';

/**
 * Parse `/risk-assess --mode fast` output into a DimensionResult.
 *
 * Mapping (simplified; cross-parser "zero coverage × HIGH risk" rule is the
 * aggregator's responsibility — see fc-aggregator.js hard-fail overrides):
 *   HIGH / CRITICAL → fail (surface signal strongly)
 *   MEDIUM → partial
 *   LOW → pass
 *   unparseable → unverified
 *
 * @param {string} text
 * @returns {object}
 */
function parse(text) {
  const base = {
    name: 'risk_alignment',
    enabled: true,
    provider: '/risk-assess',
    status: 'unverified',
    applicable_items: 0,
    summary: '',
    top_affected: [],
  };
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    base.summary = 'empty output';
    return base;
  }

  const level = extractRiskLevel(text);
  if (!level) {
    base.summary = 'no risk level detected';
    return base;
  }
  base.applicable_items = 1;

  if (level === 'HIGH' || level === 'CRITICAL') base.status = 'fail';
  else if (level === 'MEDIUM') base.status = 'partial';
  else if (level === 'LOW') base.status = 'pass';

  base.top_affected = extractTopAffected(text);
  base.summary = `risk=${level}${base.top_affected.length ? ` top=${base.top_affected.length}` : ''}`;
  return base;
}

const LEVEL_CLASS = '(CRITICAL|HIGH|MEDIUM|LOW)';
const LEVEL_WITH_OPT_ICON = `(?:[^\\w\\s|]+\\s*)?${LEVEL_CLASS}`;

function extractRiskLevel(text) {
  // Prefer structured JSON output when present.
  const json = text.match(/"risk_level"\s*:\s*"(CRITICAL|HIGH|MEDIUM|LOW)"/i);
  if (json) return json[1].toUpperCase();
  // Markdown table row from `/risk-assess` SKILL.md template:
  //   | Risk Level | 🟢 LOW |   or   | Risk Level | LOW |
  const table = text.match(new RegExp(
    `\\|\\s*Risk\\s*Level\\s*\\|\\s*${LEVEL_WITH_OPT_ICON}\\s*\\|`,
    'i',
  ));
  if (table) return table[1].toUpperCase();
  // Colon/dash form: "Risk Level: HIGH"
  const colon = text.match(new RegExp(
    `Risk\\s*Level\\s*[:—-]\\s*${LEVEL_WITH_OPT_ICON}`,
    'i',
  ));
  if (colon) return colon[1].toUpperCase();
  // Last-resort: bare "<level> risk"
  const bare = text.match(new RegExp(`\\b${LEVEL_CLASS}\\s+risk\\b`, 'i'));
  return bare ? bare[1].toUpperCase() : null;
}

function extractTopAffected(text) {
  const lines = text.split('\n');
  const files = [];
  let inSection = false;
  const headerRe = /top[_ -]?affected/i;
  for (const line of lines) {
    if (headerRe.test(line)) {
      inSection = true;
      continue;
    }
    if (!inSection) continue;
    if (/^##\s+|^###\s+/.test(line) && !headerRe.test(line)) {
      // new section → stop
      break;
    }
    const m = line.match(/^\s*[-*]\s+([A-Za-z0-9_./-]+\.[A-Za-z0-9]+)/);
    if (m) files.push(m[1]);
  }
  return files.slice(0, 10);
}

module.exports = { parse };
