const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const {
  mkdtempSync,
  writeFileSync,
  readFileSync,
  rmSync,
} = require('node:fs');
const { join, resolve } = require('node:path');
const { tmpdir } = require('node:os');
const { execFileSync, spawnSync } = require('node:child_process');

const scriptPath = resolve(__dirname, '../../scripts/build-codex-artifacts.js');
const tempDirs = [];

function createTempDir() {
  const dir = mkdtempSync(join(tmpdir(), 'sd0x-codex-test-'));
  tempDirs.push(dir);
  return dir;
}

function runScript(args) {
  return execFileSync('node', [scriptPath, ...args], { encoding: 'utf8' });
}

function runScriptRaw(args) {
  return spawnSync('node', [scriptPath, ...args], { encoding: 'utf8' });
}

after(() => {
  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('kernel output is within 24 KiB byte limit', () => {
  const dir = createTempDir();
  writeFileSync(
    join(dir, 'package.json'),
    JSON.stringify({ name: 'test-project', scripts: { test: 'jest' } })
  );

  const output = runScript(['--project-dir', dir]);
  const byteSize = Buffer.byteLength(output, 'utf8');
  assert.ok(
    byteSize <= 24576,
    `Output ${byteSize} bytes exceeds 24 KiB limit`
  );
  assert.ok(byteSize > 0, 'Output should not be empty');
});

test('placeholders are replaced', () => {
  const dir = createTempDir();
  writeFileSync(
    join(dir, 'package.json'),
    JSON.stringify({ name: 'my-app', scripts: { test: 'vitest run' } })
  );

  const output = runScript(['--project-dir', dir]);
  assert.ok(!output.includes('{PROJECT_NAME}'), 'PROJECT_NAME not replaced');
  assert.ok(!output.includes('{TEST_COMMAND}'), 'TEST_COMMAND not replaced');
  assert.ok(!output.includes('{VERSION}'), 'VERSION not replaced');
  assert.ok(output.includes('my-app'), 'Project name should appear in output');
  assert.ok(
    output.includes('vitest run'),
    'Test command should appear in output'
  );
});

test('default project name from directory when no package.json', () => {
  const dir = createTempDir();
  const dirName = require('node:path').basename(dir);

  const output = runScript(['--project-dir', dir]);
  assert.ok(
    output.includes(dirName),
    `Should use directory name "${dirName}" as project name`
  );
});

test('test command detection from package.json', () => {
  const dir = createTempDir();
  writeFileSync(
    join(dir, 'package.json'),
    JSON.stringify({
      name: 'pkg-test',
      scripts: { test: 'node --test test/**/*.test.js' },
    })
  );

  const output = runScript(['--project-dir', dir]);
  assert.ok(
    output.includes('node --test test/**/*.test.js'),
    'Should extract test command from package.json'
  );
});

test('default test command when no package.json scripts.test', () => {
  const dir = createTempDir();
  writeFileSync(
    join(dir, 'package.json'),
    JSON.stringify({ name: 'no-test', scripts: {} })
  );

  const output = runScript(['--project-dir', dir]);
  assert.ok(
    output.includes('npm test'),
    'Should fall back to "npm test" when no test script found'
  );
});

test('exit 1 on oversize output', () => {
  const dir = createTempDir();

  // Write an oversized template (> 24 KiB) directly
  const hugeContent = '# {PROJECT_NAME}\n' + 'x'.repeat(25000) + '\n';
  const templateFile = join(dir, 'huge-kernel.md');
  writeFileSync(templateFile, hugeContent);
  writeFileSync(
    join(dir, 'package.json'),
    JSON.stringify({ name: 'oversize-test' })
  );

  // Use --template-path to test the actual script with oversized template
  const result = runScriptRaw([
    '--project-dir', dir,
    '--template-path', templateFile,
  ]);
  assert.equal(result.status, 1, 'Should exit with code 1 on oversize output');
  assert.ok(
    result.stderr.includes('exceeds'),
    'Should report size exceeded in stderr'
  );
});

test('template file missing produces error', () => {
  const dir = createTempDir();
  const missingPath = join(dir, 'nonexistent', 'agents-kernel.md');

  // Use --template-path pointing to a nonexistent file
  const result = runScriptRaw([
    '--project-dir', dir,
    '--template-path', missingPath,
  ]);
  assert.equal(result.status, 1, 'Should exit with code 1 when template missing');
  assert.ok(
    result.stderr.includes('could not read'),
    'Should report template read error'
  );
});

test('--output flag writes to file', () => {
  const dir = createTempDir();
  const outputFile = join(dir, 'AGENTS.md');
  writeFileSync(
    join(dir, 'package.json'),
    JSON.stringify({ name: 'output-test', scripts: { test: 'jest' } })
  );

  runScript(['--project-dir', dir, '--output', outputFile]);

  const content = readFileSync(outputFile, 'utf8');
  assert.ok(content.includes('output-test'), 'Output file should contain project name');
  assert.ok(content.includes('jest'), 'Output file should contain test command');
  const byteSize = Buffer.byteLength(content, 'utf8');
  assert.ok(byteSize <= 24576, `Output file ${byteSize} bytes exceeds limit`);
});

test('version is read from plugin.json', () => {
  const dir = createTempDir();
  writeFileSync(
    join(dir, 'package.json'),
    JSON.stringify({ name: 'version-test' })
  );

  const output = runScript(['--project-dir', dir]);
  assert.ok(
    output.includes('sd0x-dev-flow v'),
    'Should include version string from plugin.json'
  );
  assert.ok(!output.includes('{VERSION}'), 'VERSION placeholder should be replaced');
});

test('malformed flag value produces error', () => {
  const result = runScriptRaw(['--project-dir', '--output', '/tmp/test']);
  assert.equal(result.status, 1, 'Should exit with code 1 on malformed flags');
  assert.ok(
    result.stderr.includes('requires a value'),
    'Should report missing value for flag'
  );
});
