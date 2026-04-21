#!/usr/bin/env node
'use strict';

/**
 * debate-topic.js — necessity-audit Phase B helper.
 *
 * Subcommands:
 *   build  — construct the /codex-brainstorm topic string from preflight.json
 *   parse  — extract debate metadata from a raw /codex-brainstorm response
 *            { threadId, rounds, equilibriumReached, conclusion, evidenceCitations, roundsText, perElementVerdicts }
 *
 * CLI:
 *   node debate-topic.js build --preflight <file> --output <file>
 *   node debate-topic.js parse --input <file> --output <file>
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

function buildTopic(preflight) {
  const { absPath, relPath, featureKey, docKind, greenfield, depth, activeDimensions } = preflight;
  const terminationPref = depth === 'deep'
    ? 'Nash equilibrium REQUIRED (convergence / max-rounds will fail the gate)'
    : 'any termination accepted';
  const dimBullets = activeDimensions.map(d => `${d}. ${DIM_NAMES[d]}`).join('\n');
  const greenfieldNote = greenfield
    ? '- no implementation yet; challenge via doc:section only, mark evidence [REASONING-ONLY]'
    : `- git grep -l -E "${featureKey}" -- . ':(exclude)docs/**' ':(exclude)**/*.md'`;

  return `## Topic — necessity audit of ${relPath}

Determine which elements in the spec are over-designed. Challenge necessity across the ACTIVE dimensions only:

${dimBullets}

## Constraints
- Target file: ${relPath} (absolute: ${absPath})
- Feature key: ${featureKey}
- Doc kind: ${docKind}
- Greenfield: ${greenfield}
- Depth: ${depth}
- Termination preference: ${terminationPref}
- Forbidden: you are NOT given Claude's pre-classification. Do not ask for it. Independently classify.
- Required evidence format: file:line (if code exists) or doc:section + [REASONING-ONLY] (if greenfield)

## Classification output contract (per-element)
For each element you identify (FR/NFR/Component/Abstraction/Extensibility/Config), emit a line of the form:
  [VERDICT: <Keep|Review|Cut>] <ID> — <one-sentence rationale> — Evidence: <file:line | doc:section>
Emit these BEFORE the Conclusion section so the Parser can extract them.

## ⚠️ Research independently ⚠️
- cat ${relPath}
- ls docs/features/${featureKey}/
${greenfieldNote}

## Rounds
This skill does NOT control round count. /codex-brainstorm uses its own ~3-5 round window. Run until equilibrium, convergence, or max-rounds per that skill's termination logic. Report actual rounds.

## Coverage requirement
Each active dimension must receive >=1 challenge-response cycle. Coverage is verified post-hoc via keyword match on the final conclusion + rounds transcript.

## Output structure
1. Per-element verdict lines (format above)
2. "## Conclusion" section describing the Nash equilibrium / convergence state
3. Raw rounds transcript (optional; helps coverage check)
`;
}

const VERDICT_LINE_RE = /^[ \t]*(?:[-*+]\s+|\d+\.\s+)?\[VERDICT:\s*(Keep|Review|Cut)\]\s*([A-Za-z0-9_:.\-]+)\s*[—\-]\s*([^\r\n]*?)(?:\s*[—\-]\s*Evidence:\s*([^\r\n]+?))?\s*$/gm;

function classifyEvidenceLocation(raw) {
  const s = raw.trim();
  const fileLineMatch = s.match(/^([A-Za-z0-9_./-]+\.[A-Za-z0-9]+):(\d+)(?:-(\d+))?/);
  if (fileLineMatch) {
    return { type: 'file:line', location: `${fileLineMatch[1]}:${fileLineMatch[2]}${fileLineMatch[3] ? `-${fileLineMatch[3]}` : ''}` };
  }
  const docMatch = s.match(/^(?:doc:|§)(.+?)(?:\s*\[REASONING-ONLY\])?$/i);
  if (docMatch) {
    return { type: 'doc:section', location: docMatch[1].trim() };
  }
  return { type: 'raw', location: s };
}

function parseDebateResponse(raw) {
  const threadIdMatch = raw.match(/threadId['":\s]+([0-9a-f-]{20,})/i)
    || raw.match(/thread[_ ]?id['":\s]+([0-9a-f-]{20,})/i);
  const threadId = threadIdMatch ? threadIdMatch[1] : '';

  const roundsMatch = raw.match(/(\d+)\s+rounds?/i) || raw.match(/rounds?['":\s]+(\d+)/i);
  const rounds = roundsMatch ? parseInt(roundsMatch[1], 10) : 0;

  const equilibriumReached = /nash\s+equilibrium/i.test(raw) || /\bequilibrium\s+reached\b/i.test(raw);

  const concMatch = raw.match(/##\s*(?:Conclusion|結論|Final)([\s\S]*?)(?:\n##|\n---|$)/i);
  const conclusion = concMatch ? concMatch[1].trim() : raw.slice(-2000).trim();

  const perElementVerdicts = [];
  const evidenceTailRanges = [];
  const verdictRe = new RegExp(VERDICT_LINE_RE.source, VERDICT_LINE_RE.flags);
  let vm;
  while ((vm = verdictRe.exec(raw)) !== null) {
    const evidenceRaw = (vm[4] || '').trim();
    const evidenceCitation = evidenceRaw ? { ...classifyEvidenceLocation(evidenceRaw), elementId: vm[2].trim() } : null;
    perElementVerdicts.push({
      classification: vm[1],
      id: vm[2].trim(),
      rationale: (vm[3] || '').trim(),
      evidence: evidenceRaw || null,
      evidenceCitation,
    });
    if (evidenceRaw) {
      const tailOffset = vm[0].lastIndexOf('Evidence:');
      if (tailOffset >= 0) {
        evidenceTailRanges.push([vm.index + tailOffset, vm.index + vm[0].length]);
      }
    }
  }

  const isInEvidenceTail = (idx) => evidenceTailRanges.some(([s, e]) => idx >= s && idx < e);

  const evidenceCitations = [];
  const seenCitations = new Set();
  const pushCitation = (cit) => {
    const key = `${cit.type}|${cit.location}|${cit.elementId || ''}`;
    if (seenCitations.has(key)) return;
    seenCitations.add(key);
    evidenceCitations.push(cit);
  };
  for (const v of perElementVerdicts) {
    if (v.evidenceCitation) pushCitation(v.evidenceCitation);
  }
  const fileLineRe = /([A-Za-z0-9_./-]+\.[A-Za-z0-9]+):(\d+)(?:-(\d+))?/g;
  const docSectionRe = /(?:doc:|§)([A-Za-z0-9.\-/_§]+)(?:\s*\[REASONING-ONLY\])?/gi;
  let m;
  while ((m = fileLineRe.exec(raw)) !== null) {
    if (isInEvidenceTail(m.index)) continue;
    pushCitation({ type: 'file:line', location: `${m[1]}:${m[2]}${m[3] ? `-${m[3]}` : ''}` });
  }
  while ((m = docSectionRe.exec(raw)) !== null) {
    if (isInEvidenceTail(m.index)) continue;
    pushCitation({ type: 'doc:section', location: m[1].trim() });
  }

  return { threadId, rounds, equilibriumReached, conclusion, evidenceCitations, roundsText: raw, perElementVerdicts };
}

function argVal(flag) {
  const i = process.argv.indexOf(flag);
  return i > -1 && i + 1 < process.argv.length ? process.argv[i + 1] : null;
}

function main() {
  const sub = process.argv[2];
  if (sub === 'build') {
    const preflightFile = argVal('--preflight');
    const outputFile = argVal('--output');
    if (!preflightFile || !outputFile) {
      process.stderr.write('Usage: debate-topic.js build --preflight <file> --output <file>\n');
      process.exit(1);
    }
    const pf = JSON.parse(fs.readFileSync(preflightFile, 'utf8'));
    fs.writeFileSync(outputFile, buildTopic(pf));
    process.exit(0);
  } else if (sub === 'parse') {
    const inputFile = argVal('--input');
    const outputFile = argVal('--output');
    if (!inputFile || !outputFile) {
      process.stderr.write('Usage: debate-topic.js parse --input <file> --output <file>\n');
      process.exit(1);
    }
    const raw = fs.readFileSync(inputFile, 'utf8');
    fs.writeFileSync(outputFile, JSON.stringify(parseDebateResponse(raw), null, 2));
    process.exit(0);
  } else {
    process.stderr.write('Usage: debate-topic.js <build|parse> ...\n');
    process.exit(1);
  }
}

if (require.main === module) main();

module.exports = { buildTopic, parseDebateResponse, classifyEvidenceLocation, DIM_NAMES, VERDICT_LINE_RE };
