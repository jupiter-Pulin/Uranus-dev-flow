#!/usr/bin/env node
'use strict';

const { resolveFeatureContext } = require('./lib/feature-resolver');
const { runCapture, gitRepoRoot } = require('./lib/utils');

function argVal(flag) {
  const i = process.argv.indexOf(flag);
  return i > -1 && i + 1 < process.argv.length ? process.argv[i + 1] : null;
}

async function main() {
  const root = await gitRepoRoot();
  if (!root) {
    console.log('{}');
    process.exit(0);
  }

  const [branchRes, diffRes] = await Promise.all([
    runCapture('git', ['branch', '--show-current'], { cwd: root }),
    runCapture('git', ['diff', '--name-only', 'HEAD'], { cwd: root }),
  ]);

  const branch = (branchRes.stdout || '').trim();
  const changedPaths = (diffRes.stdout || '').split('\n').filter(Boolean);
  const featureKey = argVal('--feature') || undefined;

  const result = resolveFeatureContext(root, branch, changedPaths, { featureKey });
  console.log(JSON.stringify(result));
}

main().catch(() => {
  console.log('{}');
  process.exit(0);
});
