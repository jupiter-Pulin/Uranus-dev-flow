#!/usr/bin/env node
'use strict';

/**
 * classify.js — necessity-audit Phase A rubric scoring.
 *
 * For each extracted element, scores severity (Clean/Low/Med/High) on each
 * active dimension via keyword heuristics against references/dimensions.md
 * indicators, then maps to Keep/Review/Cut using the classification thresholds:
 *
 *   - Cut    if ≥1 active dimension scores High
 *   - Review if ≥2 active dimensions score Med (and no High)
 *   - Keep   otherwise
 *
 * Deterministic alternative to LLM inline classification. Used by integration
 * tests and CI pipelines for reproducibility.
 *
 * CLI:
 *   node classify.js --preflight <preflight.json> --elements <phase-a-raw.json> --output <phase-a.json>
 */

const fs = require('fs');
const { execFileSync } = require('child_process');
const { assertLifecycleScope } = require('./preflight');

function repoRoot() {
  return execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
}

const HIGH_PATTERNS = {
  1: [/in\s+the\s+future/i, /for\s+potential\s+growth/i, /someday/i, /\bspeculat/i],
  2: [/no\s+consumer/i, /zero\s+consumers/i, /conceptual\s+only/i],
  3: [/zero\s+named\s+extenders?/i, /no\s+announced\s+plugin/i],
  4: [/no\s+known\s+consumer/i, /adds\s+complexity/i],
  5: [/without\s+any\s+performance\s+data/i, /no\s+measurement/i, /precautionary/i, /could\s+be\s+slow/i],
  6: [/while\s+we'?re\s+here/i, /unrelated\s+concern/i],
};

const MED_PATTERNS = {
  1: [/might\s+need/i, /may\s+need/i, /eventually/i, /\bfuture\b/i],
  2: [/one\s+consumer/i, /1\s+consumer/i, /future\s+x/i, /allows?\s+future/i],
  3: [/generic\s+plugin/i, /plugin\s+interface/i, /might\s+want\s+to\s+extend/i],
  4: [/for\s+flexibility/i, /no\s+named/i, /could\s+be\s+useful/i],
  5: [/this\s+could\s+be\s+slow/i, /preempt/i, /in\s+case/i],
  6: [/additionally/i, /nice[- ]to[- ]have/i, /adjacent/i],
};

const LOW_PATTERNS = {
  1: [/current\s+need\s+plausible/i, /implied/i],
  2: [/2\s+consumers\s+planned/i, /1\s+implemented/i],
  3: [/named\s+extension\s+plan/i, /roadmap/i],
  4: [/used\s+in\s+tests/i, /dev.*prod/i],
  5: [/known\s+bottleneck/i, /production\s+metrics/i],
  6: [/acceptance\s+signal/i, /supports/i],
};

function scoreDimension(rationale, dim) {
  const text = rationale || '';
  if (HIGH_PATTERNS[dim]?.some(re => re.test(text))) return 'High';
  if (MED_PATTERNS[dim]?.some(re => re.test(text))) return 'Med';
  if (LOW_PATTERNS[dim]?.some(re => re.test(text))) return 'Low';
  return 'Clean';
}

function classifyElement(element, activeDimensions, rationale) {
  const scores = {};
  for (const dim of activeDimensions) {
    scores[dim] = scoreDimension(rationale, dim);
  }
  const severities = Object.values(scores);
  const highCount = severities.filter(s => s === 'High').length;
  const medCount = severities.filter(s => s === 'Med').length;

  let classification;
  let why;
  if (highCount >= 1) {
    classification = 'Cut';
    const highDim = Object.keys(scores).find(d => scores[d] === 'High');
    why = `dim ${highDim} scored High`;
  } else if (medCount >= 2) {
    classification = 'Review';
    const medDims = Object.keys(scores).filter(d => scores[d] === 'Med');
    why = `dims ${medDims.join(',')} scored Med`;
  } else {
    classification = 'Keep';
    why = 'no High and <2 Med';
  }

  return {
    ...element,
    claude: {
      classification,
      rationale: `Deterministic rubric: ${why}`,
      dimension_scores: scores,
    },
    evidence: [],
  };
}

function classifyAll(elements, activeDimensions, content) {
  return elements
    .filter(el => activeDimensions.includes(el.primary_dimension))
    .map(el => {
      const rationale = getElementContext(el, content);
      return classifyElement(el, activeDimensions, rationale);
    });
}

function getElementContext(element, content) {
  if (!content || !element.source_line) return '';
  const lines = content.split('\n');
  const idx = element.source_line - 1;
  if (idx < 0 || idx >= lines.length) return '';
  return lines[idx];
}

function argVal(flag) {
  const i = process.argv.indexOf(flag);
  return i > -1 && i + 1 < process.argv.length ? process.argv[i + 1] : null;
}

function main() {
  const preflightFile = argVal('--preflight');
  const elementsFile = argVal('--elements');
  const outputFile = argVal('--output');
  if (!preflightFile || !elementsFile || !outputFile) {
    process.stderr.write('Usage: classify.js --preflight <file> --elements <file> --output <file>\n');
    process.exit(1);
  }
  const preflight = JSON.parse(fs.readFileSync(preflightFile, 'utf8'));
  const { elements } = JSON.parse(fs.readFileSync(elementsFile, 'utf8'));
  const { absPath } = assertLifecycleScope(preflight, repoRoot());
  const content = fs.readFileSync(absPath, 'utf8');
  const classified = classifyAll(elements, preflight.activeDimensions, content);
  fs.writeFileSync(outputFile, JSON.stringify({ elements: classified }, null, 2));
  process.exit(0);
}

if (require.main === module) main();

module.exports = {
  HIGH_PATTERNS,
  MED_PATTERNS,
  LOW_PATTERNS,
  scoreDimension,
  classifyElement,
  classifyAll,
  getElementContext,
};
