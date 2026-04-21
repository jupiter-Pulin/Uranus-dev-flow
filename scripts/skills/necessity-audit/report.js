#!/usr/bin/env node
'use strict';

/**
 * report.js — necessity-audit Markdown / JSON report assembler.
 *
 * Output MUST start with `## Document Review` header and end with `✅ Mergeable`
 * or `⛔ Needs revision` sentinel for hook parsing (hooks/post-tool-review-state.sh:641).
 *
 * CLI:
 *   node report.js --input <file> --format markdown|json --output <file>
 */

const fs = require('fs');

const DIM_NAMES = {
  1: 'Necessity Now',
  2: 'Abstraction Justification',
  3: 'Extensibility Speculation',
  4: 'Configurability Excess',
  5: 'Premature Optimization',
  6: 'Scope Drift',
};

function buildMarkdown(report) {
  const lines = [];
  lines.push('## Document Review');
  lines.push('');

  for (const banner of report.banners || []) lines.push(`**${banner}**`);
  if ((report.banners || []).length > 0) lines.push('');

  lines.push(`**Target**: \`${report.relative_path}\``);
  lines.push(`**Feature**: \`${report.feature_key}\` (greenfield: ${report.greenfield})`);
  lines.push(`**Depth**: ${report.depth} · **Preflight**: ${report.preflight}`);
  lines.push(`**Schema**: v${report.schema_version}`);
  lines.push('');

  for (const warning of report.warnings || []) lines.push(`> ${warning}`);
  if ((report.warnings || []).length > 0) lines.push('');

  lines.push('### Dimension Overview');
  lines.push('');
  lines.push('| # | Dimension | Severity | Notes |');
  lines.push('|---|-----------|----------|-------|');
  for (let d = 1; d <= 6; d++) {
    const dim = report.dimensions[d];
    if (!dim) continue;
    lines.push(`| ${d} | ${DIM_NAMES[d]} | ${dim.severity} | ${dim.notes} |`);
  }
  lines.push('');

  lines.push('### Classification');
  lines.push('');
  const byFinal = { Keep: [], Review: [], Cut: [] };
  for (const el of report.elements) {
    const bucket = ['Keep', 'Review', 'Cut'].includes(el.final) ? el.final : 'Review';
    byFinal[bucket].push(el);
  }

  lines.push(`#### Keep (${byFinal.Keep.length} items)`);
  if (byFinal.Keep.length > 0) {
    lines.push('');
    lines.push('| ID | Kind | Rationale |');
    lines.push('|----|------|-----------|');
    for (const el of byFinal.Keep) {
      lines.push(`| ${el.id} | ${el.kind} | ${compact(el.claude.rationale)} |`);
    }
  }
  lines.push('');

  lines.push(`#### Review (${byFinal.Review.length} items)`);
  if (byFinal.Review.length > 0) {
    lines.push('');
    lines.push('| ID | Kind | Dim | Claude | Codex | Evidence |');
    lines.push('|----|------|-----|--------|-------|----------|');
    for (const el of byFinal.Review) {
      const ev = (el.codex?.evidence?.[0]?.location) || (el.evidence?.[0]?.location) || '—';
      lines.push(`| ${el.id} | ${el.kind} | ${el.primary_dimension} | ${el.claude.classification} | ${el.codex?.classification || '—'} | \`${ev}\` |`);
    }
  }
  lines.push('');

  lines.push(`#### Cut (${byFinal.Cut.length} items — unless overridden)`);
  if (byFinal.Cut.length > 0) {
    lines.push('');
    lines.push('| ID | Kind | Dim | Codex rationale | Evidence | Override? |');
    lines.push('|----|------|-----|-----------------|----------|-----------|');
    for (const el of byFinal.Cut) {
      const ev = (el.codex?.evidence?.[0]?.location) || (el.evidence?.[0]?.location) || '—';
      const override = el.user_override ? `✅ "${compact(el.user_override.kept_reason)}"` : '❌';
      lines.push(`| ${el.id} | ${el.kind} | ${el.primary_dimension} | ${compact(el.codex?.rationale || el.claude.rationale)} | \`${ev}\` | ${override} |`);
    }
  }
  lines.push('');

  lines.push('### Debate');
  lines.push('');
  lines.push(`- **Thread**: \`${report.debate.threadId || '(none)'}\` (provider: ${report.debate.skill_invocation})`);
  lines.push(`- **Rounds**: ${report.debate.rounds} · **Equilibrium**: ${report.debate.equilibrium_reached ? '✅' : '❌'}`);
  lines.push(`- **Conclusion**: ${compact(report.debate.conclusion, 300)}`);
  lines.push('');

  lines.push('### Deterministic Checks (NFR-10)');
  lines.push('');
  lines.push('| Check | Result |');
  lines.push('|-------|--------|');
  for (const [k, v] of Object.entries(report.deterministic_checks)) {
    lines.push(`| ${k} | ${v ? '✅' : '❌'} |`);
  }
  lines.push('');

  if (report.under_covered_dimensions.length > 0) {
    lines.push(`**Under-covered dimensions**: ${report.under_covered_dimensions.map(d => `${d} (${DIM_NAMES[d]})`).join(', ')}`);
    lines.push('');
  }

  if (report.narrative.length > 0) {
    lines.push('### Narrative');
    lines.push('');
    for (const n of report.narrative) lines.push(`- ${n}`);
    lines.push('');
  }

  if (report.suggested_next.length > 0) {
    lines.push('### Suggested Next');
    lines.push('');
    for (const s of report.suggested_next) lines.push(`- ${s}`);
    lines.push('');
  }

  lines.push('### Gate');
  lines.push('');
  lines.push(report.gate);
  lines.push('');

  return lines.join('\n');
}

function compact(text, max = 140) {
  if (!text) return '';
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > max ? flat.slice(0, max - 1) + '…' : flat;
}

function argVal(flag) {
  const i = process.argv.indexOf(flag);
  return i > -1 && i + 1 < process.argv.length ? process.argv[i + 1] : null;
}

function main() {
  const inputFile = argVal('--input');
  const format = argVal('--format') || 'markdown';
  const outputFile = argVal('--output');
  if (!inputFile || !outputFile) {
    process.stderr.write('Usage: report.js --input <file> [--format markdown|json] --output <file>\n');
    process.exit(1);
  }
  const report = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
  const out = format === 'json' ? JSON.stringify(report, null, 2) : buildMarkdown(report);
  fs.writeFileSync(outputFile, out);
  process.exit(0);
}

if (require.main === module) main();

module.exports = { buildMarkdown, compact, DIM_NAMES };
