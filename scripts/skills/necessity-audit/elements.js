#!/usr/bin/env node
'use strict';

/**
 * elements.js — necessity-audit Phase A element extraction.
 *
 * Extracts structured spec elements by doc_kind (requirements / tech-spec /
 * architecture / implementation) and assigns a primary dimension via keyword
 * heuristics per references/dimensions.md.
 *
 * This is a deterministic alternative to the LLM inline classification
 * described in SKILL.md Phase A. Used mainly by integration tests and
 * CI pipelines where reproducibility matters.
 *
 * CLI:
 *   node elements.js --preflight <preflight.json> --output <phase-a.json>
 *
 * Output schema (subset of ClassifiedElement; classify.js fills the rest):
 *   { elements: [{ id, kind, primary_dimension, source_line }] }
 */

const fs = require('fs');
const { execFileSync } = require('child_process');
const { assertLifecycleScope } = require('./preflight');

function repoRoot() {
  return execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
}

const DIMENSION_KEYWORDS = {
  5: [/cache/i, /batch/i, /async/i, /throughput/i, /latency/i, /optimiz/i, /perform/i, /benchmark/i, /response\s+time/i],
  4: [/\bflag\b/i, /\bconfig(?:urab)/i, /\boption\b/i, /\btoggle\b/i, /\benv[_ -]?var/i, /environment\s+variable/i],
  3: [/extensib/i, /\bplugin\b/i, /\bhook\b/i, /pluggable/i, /adapter/i, /extend/i],
  2: [/abstract/i, /interface\b/i, /generic/i, /reusable/i, /decoupl/i, /layer/i],
  6: [/scope\s+drift/i, /while\s+we'?re\s+here/i, /additionally/i, /nice[- ]to[- ]have/i],
  1: [/might\s+need/i, /may\s+need/i, /future/i, /someday/i, /speculat/i, /eventually/i],
};

function detectDimension(text) {
  const order = [5, 4, 3, 2, 6, 1];
  for (const dim of order) {
    for (const re of DIMENSION_KEYWORDS[dim]) {
      if (re.test(text)) return dim;
    }
  }
  return 1;
}

function extractRequirements(content) {
  const elements = [];
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    const frMatch = line.match(/^\|\s*(FR-\d+)\s*\|([^|]+)\|/);
    const nfrMatch = line.match(/^\|\s*(NFR-\d+)\s*\|([^|]+)\|/);
    const match = frMatch || nfrMatch;
    if (match) {
      const id = match[1];
      const rationale = match[2].trim();
      const kind = frMatch ? 'FR' : 'NFR';
      elements.push({ id, kind, primary_dimension: detectDimension(rationale), source_line: idx + 1 });
    }
  });
  return elements;
}

function extractTechSpec(content) {
  const elements = [];
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    const compMatch = line.match(/^#{2,4}\s+Component:\s*(\S+)/);
    const numMatch = line.match(/^#{2,3}\s+3\.(\d+(?:\.\d+)?)\s+(.+)$/);
    if (compMatch) {
      const name = compMatch[1].trim();
      elements.push({
        id: `Component:${name}`,
        kind: 'Component',
        primary_dimension: detectDimension(line),
        source_line: idx + 1,
      });
    } else if (numMatch) {
      const num = numMatch[1];
      const title = numMatch[2].trim();
      elements.push({
        id: `§3.${num}`,
        kind: 'Component',
        primary_dimension: detectDimension(title),
        source_line: idx + 1,
      });
    }
  });
  return elements;
}

function extractArchitecture(content) {
  const elements = [];
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    const match = line.match(/^###\s+([A-Z][A-Za-z0-9_-]+)\s*$/);
    if (match) {
      const name = match[1];
      elements.push({
        id: `Component:${name}`,
        kind: 'Component',
        primary_dimension: detectDimension(name),
        source_line: idx + 1,
      });
    }
  });
  return elements;
}

function extractImplementation(content) {
  const elements = [];
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    const match = line.match(/^\|\s*`?([A-Za-z][A-Za-z0-9._/-]*\.[a-z]+)`?\s*\|([^|]+)\|/);
    if (match) {
      const path = match[1];
      const desc = match[2].trim();
      elements.push({
        id: path,
        kind: 'Component',
        primary_dimension: detectDimension(desc),
        source_line: idx + 1,
      });
    }
  });
  return elements;
}

const EXTRACTORS = {
  requirements: extractRequirements,
  'tech-spec': extractTechSpec,
  architecture: extractArchitecture,
  implementation: extractImplementation,
  feasibility: extractRequirements,
};

function extractElements(content, docKind) {
  const fn = EXTRACTORS[docKind];
  if (!fn) throw new Error(`Unknown doc_kind: ${docKind}`);
  return fn(content);
}

function argVal(flag) {
  const i = process.argv.indexOf(flag);
  return i > -1 && i + 1 < process.argv.length ? process.argv[i + 1] : null;
}

function main() {
  const preflightFile = argVal('--preflight');
  const outputFile = argVal('--output');
  if (!preflightFile || !outputFile) {
    process.stderr.write('Usage: elements.js --preflight <file> --output <file>\n');
    process.exit(1);
  }
  const preflight = JSON.parse(fs.readFileSync(preflightFile, 'utf8'));
  const { absPath } = assertLifecycleScope(preflight, repoRoot());
  const content = fs.readFileSync(absPath, 'utf8');
  const elements = extractElements(content, preflight.docKind);
  fs.writeFileSync(outputFile, JSON.stringify({ elements }, null, 2));
  process.exit(0);
}

if (require.main === module) main();

module.exports = {
  DIMENSION_KEYWORDS,
  detectDimension,
  extractRequirements,
  extractTechSpec,
  extractArchitecture,
  extractImplementation,
  extractElements,
};
