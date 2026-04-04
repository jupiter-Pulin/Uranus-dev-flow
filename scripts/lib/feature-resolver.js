#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { scanFeatureDocs, loadTaxonomy } = require('./doc-classifier');

// Validate feature key (prevent path traversal)
const SLUG_RE = /^[a-z0-9][a-z0-9._-]*$/i;

/**
 * Probe a feature directory for doc inventory and requests.
 * @param {string} docsBase - Absolute path to docs/features/
 * @param {string} key - Feature slug
 * @returns {object|null}
 */
function probe(docsBase, key) {
  const docsPath = path.join(docsBase, key);
  try {
    if (!fs.statSync(docsPath).isDirectory()) return null;
  } catch { return null; }
  let hasRequests = false;
  let doc_inventory = [];
  let canonical_docs = { tech_spec: null, architecture: null, feasibility: null, requirements: null };
  try {
    const entries = fs.readdirSync(docsPath);
    hasRequests = entries.includes('requests');
    const tax = loadTaxonomy();
    const scan = scanFeatureDocs(docsPath, tax);
    doc_inventory = scan.doc_inventory;
    canonical_docs = scan.canonical_docs;
  } catch { /* ignore */ }
  const hasTechSpec = canonical_docs.tech_spec != null;
  const hasRequirements = canonical_docs.requirements != null;
  return { key, docs_path: `docs/features/${key}`, doc_inventory, canonical_docs, has_tech_spec: hasTechSpec, has_requirements: hasRequirements, has_requests: hasRequests };
}

/**
 * 5-level feature context resolution with confidence scoring.
 *
 * @param {string} root - Repository root (absolute path)
 * @param {string} branch - Current git branch name
 * @param {string[]} changedPaths - List of changed file paths (relative to root)
 * @param {object} [options]
 * @param {string} [options.docsBase] - Override docs base directory (default: <root>/docs/features)
 * @param {string} [options.featureKey] - Explicit feature key (Level 1 override)
 * @returns {{ key: string|null, source: string, confidence: string|null, docs_path: string|null, doc_inventory: Array, canonical_docs: object, has_tech_spec: boolean, has_requirements: boolean, has_requests: boolean }}
 */
function resolveFeatureContext(root, branch, changedPaths, options) {
  const opts = options || {};
  const docsBase = opts.docsBase || path.join(root, 'docs', 'features');
  const featureKey = opts.featureKey || null;

  const emptyCanonical = { tech_spec: null, architecture: null, feasibility: null, requirements: null };
  const nullResult = { key: null, source: 'none', confidence: null, docs_path: null, doc_inventory: [], canonical_docs: emptyCanonical, has_tech_spec: false, has_requirements: false, has_requests: false };

  // Level 1: explicit feature key
  if (featureKey) {
    if (!SLUG_RE.test(featureKey)) return nullResult;
    const info = probe(docsBase, featureKey);
    if (info) return { ...info, source: 'cli', confidence: 'high' };
    return { key: featureKey, source: 'cli', confidence: 'high', docs_path: `docs/features/${featureKey}`, doc_inventory: [], canonical_docs: emptyCanonical, has_tech_spec: false, has_requirements: false, has_requests: false };
  }

  // Level 2: branch feat/<key> (single segment only to prevent path issues)
  const branchMatch = branch.match(/^feat\/([^/]+)$/);
  if (branchMatch && SLUG_RE.test(branchMatch[1])) {
    const key = branchMatch[1];
    const info = probe(docsBase, key);
    if (info) return { ...info, source: 'branch', confidence: 'high' };
    return { key, source: 'branch', confidence: 'high', docs_path: `docs/features/${key}`, doc_inventory: [], canonical_docs: emptyCanonical, has_tech_spec: false, has_requirements: false, has_requests: false };
  }

  // Level 3: changed paths under docs/features/<key>/
  const featurePathMatch = changedPaths
    .map(p => p.match(/^docs\/features\/([^/]+)\//))
    .find(m => m);
  if (featurePathMatch && SLUG_RE.test(featurePathMatch[1])) {
    const key = featurePathMatch[1];
    const info = probe(docsBase, key);
    if (info) return { ...info, source: 'diff', confidence: 'medium' };
    return { key, source: 'diff', confidence: 'medium', docs_path: `docs/features/${key}`, doc_inventory: [], canonical_docs: emptyCanonical, has_tech_spec: false, has_requirements: false, has_requests: false };
  }

  // Level 3b: changed paths under skills/<key>/
  const skillPathMatch = changedPaths
    .map(p => p.match(/^skills\/([^/.]+)/))
    .find(m => m);
  if (skillPathMatch && SLUG_RE.test(skillPathMatch[1])) {
    const key = skillPathMatch[1];
    const info = probe(docsBase, key);
    if (info) return { ...info, source: 'diff', confidence: 'medium' };
  }

  // Level 4: single feature dir
  try {
    const dirs = fs.readdirSync(docsBase).filter(d => {
      try { return fs.statSync(path.join(docsBase, d)).isDirectory(); } catch { return false; }
    });
    if (dirs.length === 1) {
      const info = probe(docsBase, dirs[0]);
      if (info) return { ...info, source: 'single_dir', confidence: 'low' };
    }
  } catch { /* docs/features/ doesn't exist */ }

  // Level 5: not found
  return nullResult;
}

module.exports = { resolveFeatureContext, SLUG_RE };
