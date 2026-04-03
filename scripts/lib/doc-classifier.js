#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

let _taxonomy = null;

function loadTaxonomy() {
  if (_taxonomy) return _taxonomy;
  const p = path.join(__dirname, '..', 'config', 'doc-taxonomy.json');
  _taxonomy = JSON.parse(fs.readFileSync(p, 'utf8'));
  return _taxonomy;
}

/**
 * Classify a filename against the taxonomy using 7-step precedence.
 * Pure function — no file I/O.
 *
 * @param {string} filename - e.g. "2-tech-spec.md", "checklist-cross-service.md"
 * @param {object} [taxonomy] - Loaded doc-taxonomy.json (auto-loaded if omitted)
 * @returns {{ type: string, namespace: string, confidence: string, is_canonical: boolean }}
 */
function classifyByPath(filename, taxonomy) {
  const tax = taxonomy || loadTaxonomy();
  const types = tax.types;

  // Step 1: exclude check — reject files matching any type's exclude_pattern
  // (checked per-type in later steps)

  // Step 2+3: canonical_filename exact match + exclude
  for (const t of types) {
    if (t.exclude_pattern && new RegExp(t.exclude_pattern).test(filename)) continue;
    if (t.canonical_filename && filename === t.canonical_filename) {
      return { type: t.id, namespace: t.namespace, confidence: 'high', is_canonical: true };
    }
  }

  // Step 4: variant_pattern or semantic_pattern match
  for (const t of types) {
    if (t.exclude_pattern && new RegExp(t.exclude_pattern).test(filename)) continue;
    const pattern = t.variant_pattern || t.semantic_pattern;
    if (pattern && new RegExp(pattern).test(filename)) {
      return { type: t.id, namespace: t.namespace, confidence: 'medium', is_canonical: false };
    }
  }

  // Step 5: lifecycle prefix fallback — /^([0-4])-/
  const prefixMatch = filename.match(/^([0-4])-/);
  if (prefixMatch) {
    const phase = parseInt(prefixMatch[1], 10);
    const lifecycleType = types.find(t => t.namespace === 'lifecycle' && t.phase === phase);
    if (lifecycleType) {
      return { type: lifecycleType.id, namespace: 'lifecycle', confidence: 'medium', is_canonical: false };
    }
  }

  // Step 6: heading_signal — skipped in fast mode (no file I/O here)
  // Step 7: fallback
  return { type: tax.fallback_type, namespace: 'unknown', confidence: 'low', is_canonical: false };
}

/**
 * Classify by heading signals (deep mode). Reads first N lines of a file.
 *
 * @param {string} filePath - Absolute path to .md file
 * @param {object} [taxonomy]
 * @param {number} [maxLines=20]
 * @returns {{ type: string, namespace: string, confidence: string, is_canonical: boolean }|null}
 */
function classifyByHeading(filePath, taxonomy, maxLines) {
  const tax = taxonomy || loadTaxonomy();
  const limit = maxLines || 20;
  let content;
  try {
    const buf = fs.readFileSync(filePath, 'utf8');
    content = buf.split('\n').slice(0, limit).join('\n').toLowerCase();
  } catch { return null; }

  for (const t of tax.types) {
    if (!t.heading_signals || t.heading_signals.length === 0) continue;
    for (const signal of t.heading_signals) {
      if (content.includes(signal.toLowerCase())) {
        return { type: t.id, namespace: t.namespace, confidence: 'low', is_canonical: false };
      }
    }
  }
  return null;
}

/**
 * Scan a feature docs directory and return full inventory.
 *
 * @param {string} featureDir - Absolute path to docs/features/<key>/
 * @param {object} [taxonomy]
 * @param {object} [options]
 * @param {boolean} [options.deep=false] - Use heading signals for fallback classification
 * @param {object} [options.overrides] - filepath → type overrides
 * @returns {{ doc_inventory: Array, canonical_docs: object }}
 */
function scanFeatureDocs(featureDir, taxonomy, options) {
  const tax = taxonomy || loadTaxonomy();
  const opts = options || {};
  const deep = opts.deep || false;
  const overrides = opts.overrides || {};
  const inventory = [];

  let entries;
  try {
    entries = fs.readdirSync(featureDir, { withFileTypes: true });
  } catch { return { doc_inventory: [], canonical_docs: pickCanonicalDocs([], tax.canonical_roles) }; }

  for (const entry of entries) {
    // Skip requests/ and archived/
    if (entry.name === 'requests' || entry.name === 'archived') continue;

    if (entry.isSymbolicLink()) continue;

    if (entry.isFile() && entry.name.endsWith('.md')) {
      const relPath = entry.name;
      const item = _classifyEntry(relPath, path.join(featureDir, entry.name), tax, deep, overrides);
      inventory.push(item);
    } else if (entry.isDirectory()) {
      // Folder-backed lifecycle phase (e.g. 0-feasibility-study/)
      _scanSubdir(featureDir, entry.name, tax, deep, overrides, inventory);
    }
  }

  const canonical_docs = pickCanonicalDocs(inventory, tax.canonical_roles);
  return { doc_inventory: inventory, canonical_docs };
}

function _classifyEntry(relPath, absPath, tax, deep, overrides) {
  // Override check
  if (overrides[relPath]) {
    const t = tax.types.find(t => t.id === overrides[relPath]);
    if (t) return { file: relPath, type: t.id, namespace: t.namespace, confidence: 'high', is_canonical: false };
  }

  const filename = path.basename(relPath);
  let result = classifyByPath(filename, tax);

  // Deep mode: if fast path returned fallback, try heading signals
  if (deep && result.type === tax.fallback_type) {
    const headingResult = classifyByHeading(absPath, tax);
    if (headingResult) result = headingResult;
  }

  return { file: relPath, ...result };
}

function _scanSubdir(featureDir, dirName, tax, deep, overrides, inventory) {
  const subPath = path.join(featureDir, dirName);
  let subEntries;
  try {
    subEntries = fs.readdirSync(subPath, { withFileTypes: true });
  } catch { return; }

  // Determine parent phase context from directory name
  const parentType = _inferParentType(dirName, tax);

  for (const sub of subEntries) {
    if (sub.isSymbolicLink()) continue;

    if (sub.isFile() && sub.name.endsWith('.md')) {
      const relPath = path.join(dirName, sub.name);
      const absPath = path.join(subPath, sub.name);
      let item = _classifyEntry(relPath, absPath, tax, deep, overrides);

      // If sub-file classified as a different lifecycle type via prefix fallback,
      // override with parent phase context (folder semantics take precedence)
      if (parentType && item.type !== parentType.id) {
        const isCanonical = parentType.canonical_filename && sub.name === parentType.canonical_filename;
        item = { file: relPath, type: parentType.id, namespace: parentType.namespace, confidence: isCanonical ? 'high' : 'medium', is_canonical: isCanonical };
      }

      inventory.push(item);
    } else if (sub.isDirectory() && sub.name !== 'requests' && sub.name !== 'archived') {
      // Recurse into nested subdirectories, carrying parent type context
      _scanSubdir(featureDir, path.join(dirName, sub.name), tax, deep, overrides, inventory);
    }
  }
}

function _inferParentType(dirName, tax) {
  // Check if dirName matches a lifecycle canonical_dirname or variant_pattern
  for (const t of tax.types) {
    if (t.canonical_dirname && dirName === t.canonical_dirname) return t;
  }
  // Lifecycle prefix fallback for directories
  const prefixMatch = dirName.match(/^([0-4])-/);
  if (prefixMatch) {
    const phase = parseInt(prefixMatch[1], 10);
    return tax.types.find(t => t.namespace === 'lifecycle' && t.phase === phase) || null;
  }
  return null;
}

/**
 * Derive canonical document map from inventory.
 *
 * @param {Array} inventory - Array of { file, type, namespace, confidence, is_canonical }
 * @param {object} canonicalRoles - Map of role → type id (from taxonomy)
 * @returns {object} Map of role → { file, path } | null
 */
function pickCanonicalDocs(inventory, canonicalRoles) {
  const result = {};
  for (const [role, typeId] of Object.entries(canonicalRoles)) {
    const candidates = inventory.filter(i => i.type === typeId);
    if (candidates.length === 0) {
      result[role] = null;
      continue;
    }
    // Priority: is_canonical=true > higher confidence > lexicographic first
    candidates.sort((a, b) => {
      if (a.is_canonical !== b.is_canonical) return a.is_canonical ? -1 : 1;
      const confOrder = { high: 0, medium: 1, low: 2 };
      const ca = confOrder[a.confidence] ?? 3;
      const cb = confOrder[b.confidence] ?? 3;
      if (ca !== cb) return ca - cb;
      return a.file.localeCompare(b.file);
    });
    result[role] = { file: candidates[0].file, path: candidates[0].file };
  }
  return result;
}

module.exports = { classifyByPath, classifyByHeading, scanFeatureDocs, pickCanonicalDocs, loadTaxonomy };
