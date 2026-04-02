#!/usr/bin/env node
'use strict';

/**
 * trend.js
 * Trend snapshot read/write + delta computation + rolling window pruning.
 * Uses lockdir + atomic write pattern (mtime-based TTL, no pid/ts files).
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

// Reuse safeSlug + sha1 from shared utils if available, else inline
let safeSlug, sha1;
try {
  const pluginRoot = (() => {
    const sentinel = p => fs.existsSync(path.join(p, 'scripts', 'lib', 'utils.js'));
    const marker = p => fs.existsSync(path.join(p, '.claude-plugin', 'plugin.json'));
    let d = __dirname;
    while (d !== path.dirname(d)) {
      if (sentinel(d) && marker(d)) return d;
      d = path.dirname(d);
    }
    return null;
  })();
  if (pluginRoot) {
    const utils = require(path.join(pluginRoot, 'scripts', 'lib', 'utils'));
    safeSlug = utils.safeSlug;
    sha1 = utils.sha1;
  }
} catch { /* fallback below */ }

if (!safeSlug) {
  const crypto = require('crypto');
  sha1 = s => crypto.createHash('sha1').update(String(s)).digest('hex');
  safeSlug = s => String(s || '').trim().replace(/\s+/g, '-').replace(/[^\w.-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
}

function getRepoKey(repoRoot) {
  const repoBase = path.basename(repoRoot);
  let remote;
  try {
    remote = execFileSync('git', ['remote', 'get-url', 'origin'], { cwd: repoRoot, encoding: 'utf8' }).trim();
  } catch {
    remote = repoRoot;
  }
  return `${safeSlug(repoBase)}--${sha1(remote).slice(0, 8)}`;
}

function getCacheDir(repoRoot) {
  const key = getRepoKey(repoRoot);
  return path.join(repoRoot, '.claude', 'cache', 'test-health', key);
}

// --- Lock (mkdir-based, mtime TTL) ---

function lock(cacheDir, timeout = 5, ttl = 60) {
  const lockDir = path.join(cacheDir, '.lock');
  const start = Date.now();
  while (true) {
    try {
      fs.mkdirSync(lockDir);
      return true;
    } catch (err) {
      if (err.code !== 'EEXIST') return false;
      // Check stale lock via mtime
      try {
        const stat = fs.statSync(lockDir);
        const age = Math.floor((Date.now() - stat.mtimeMs) / 1000);
        if (age > ttl) {
          fs.rmSync(lockDir, { recursive: true, force: true });
          continue;
        }
      } catch { /* lock dir gone, retry */ continue; }
      if (Date.now() - start > timeout * 1000) return false;
      // busy-wait 100ms (acceptable for CLI tool, bounded by timeout)
      const end = Date.now() + 100;
      while (Date.now() < end) { /* spin */ }
    }
  }
}

function unlock(cacheDir) {
  const lockDir = path.join(cacheDir, '.lock');
  try { fs.rmSync(lockDir, { recursive: true, force: true }); } catch { /* ignore */ }
}

// --- Read/Write ---

function readLatest(cacheDir) {
  const latestPath = path.join(cacheDir, 'latest.json');
  try {
    return JSON.parse(fs.readFileSync(latestPath, 'utf8'));
  } catch {
    return null;
  }
}

function writeSnapshot(cacheDir, snapshot) {
  const historyDir = path.join(cacheDir, 'history');
  fs.mkdirSync(historyDir, { recursive: true });

  if (!lock(cacheDir)) {
    // fail-open: write without lock
    _doWrite(cacheDir, historyDir, snapshot);
    pruneHistory(cacheDir, 30);
    return;
  }
  try {
    _doWrite(cacheDir, historyDir, snapshot);
    pruneHistory(cacheDir, 30);
  } finally {
    unlock(cacheDir);
  }
}

function _doWrite(cacheDir, historyDir, snapshot) {
  const ts = snapshot.timestamp ? snapshot.timestamp.replace(/[:.]/g, '-').slice(0, 19) : new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const sha = snapshot.sha || 'unknown';
  const filename = `${ts.replace(/T/, '-')}--${sha}.json`;
  const tmpPath = path.join(historyDir, filename + '.tmp');
  const finalPath = path.join(historyDir, filename);
  const latestPath = path.join(cacheDir, 'latest.json');

  fs.writeFileSync(tmpPath, JSON.stringify(snapshot, null, 2));
  fs.renameSync(tmpPath, finalPath);
  // Update latest.json (copy, not symlink)
  fs.copyFileSync(finalPath, latestPath);
}

// --- Delta computation ---

function computeDelta(current, previous) {
  if (!previous) return null;
  const delta = {};

  // Coverage delta (only same tool_id + source_type)
  if (current.code_coverage && previous.code_coverage) {
    const cc = current.code_coverage;
    const pc = previous.code_coverage;
    if (cc.tool_id === pc.tool_id && cc.source_type === pc.source_type) {
      delta.line_coverage = _diff(cc.lines?.pct, pc.lines?.pct);
      delta.branch_coverage = _diff(cc.branches?.pct, pc.branches?.pct);
    } else {
      delta.coverage_reset = `Tool changed: ${pc.tool_id} → ${cc.tool_id}`;
    }
  }

  // Test count delta (only same count_level per layer)
  if (current.test_inventory && previous.test_inventory) {
    delta.test_counts = {};
    for (const layer of ['unit', 'integration', 'e2e']) {
      const cl = current.test_inventory[layer];
      const pl = previous.test_inventory[layer];
      if (cl && pl && cl.count_level === pl.count_level) {
        delta.test_counts[layer] = _diff(cl.tests, pl.tests);
      } else if (cl && pl) {
        delta.test_counts[layer] = { reset: `count_level changed: ${pl.count_level} → ${cl.count_level}` };
      }
    }
  }

  return delta;
}

function _diff(current, previous) {
  if (current == null || previous == null) return null;
  const value = current - previous;
  const direction = value > 0 ? '↑' : value < 0 ? '↓' : '→';
  return { previous, current, value, direction };
}

// --- Pruning ---

function pruneHistory(cacheDir, maxItems = 30) {
  const historyDir = path.join(cacheDir, 'history');
  if (!fs.existsSync(historyDir)) return 0;
  const files = fs.readdirSync(historyDir)
    .filter(f => f.endsWith('.json') && !f.endsWith('.tmp'))
    .sort();
  const toRemove = files.length > maxItems ? files.slice(0, files.length - maxItems) : [];
  for (const f of toRemove) {
    fs.unlinkSync(path.join(historyDir, f));
  }
  return toRemove.length;
}

module.exports = {
  getRepoKey,
  getCacheDir,
  lock,
  unlock,
  readLatest,
  writeSnapshot,
  computeDelta,
  pruneHistory,
};
