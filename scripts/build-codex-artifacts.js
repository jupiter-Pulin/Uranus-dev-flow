#!/usr/bin/env node
/**
 * build-codex-artifacts.js
 * Generates AGENTS.md kernel from template + host project context.
 * Reads the kernel template, detects host context (package.json, CLAUDE.md),
 * replaces placeholders, and outputs the result.
 *
 * Usage:
 *   node scripts/build-codex-artifacts.js [--project-dir <dir>] [--output <file>] [--template-path <file>]
 *   Default: project-dir=cwd, output=stdout, template-path=auto-detected
 */

const fs = require('node:fs');
const path = require('node:path');

const BYTE_LIMIT = 24576; // 24 KiB hard cap

function parseArgs(argv) {
  const args = { projectDir: process.cwd(), output: null, templatePath: null };
  const knownFlags = new Set(['--project-dir', '--output', '--template-path']);
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k.startsWith('--') && !knownFlags.has(k)) {
      process.stderr.write(`Error: unknown flag ${k}\nUsage: node build-codex-artifacts.js [--project-dir <dir>] [--output <file>] [--template-path <file>]\n`);
      process.exit(1);
    }
    if (knownFlags.has(k)) {
      const v = argv[i + 1];
      if (!v || v.startsWith('--')) {
        process.stderr.write(`Error: ${k} requires a value\n`);
        process.exit(1);
      }
      if (k === '--project-dir') { args.projectDir = path.resolve(v); }
      if (k === '--output') { args.output = path.resolve(v); }
      if (k === '--template-path') { args.templatePath = path.resolve(v); }
      i++;
    }
  }
  return args;
}

function readText(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
}

function detectProjectName(projectDir) {
  const pkgPath = path.join(projectDir, 'package.json');
  const pkg = readText(pkgPath);
  if (pkg) {
    try {
      const parsed = JSON.parse(pkg);
      if (parsed.name) return parsed.name;
    } catch { /* ignore parse errors */ }
  }
  return path.basename(projectDir);
}

function detectTestCommand(projectDir) {
  // Priority 1: package.json scripts.test
  const pkgPath = path.join(projectDir, 'package.json');
  const pkg = readText(pkgPath);
  if (pkg) {
    try {
      const parsed = JSON.parse(pkg);
      if (parsed.scripts && parsed.scripts.test) {
        return parsed.scripts.test;
      }
    } catch { /* ignore */ }
  }

  // Priority 2: CLAUDE.md test command pattern
  const claudePaths = [
    path.join(projectDir, '.claude', 'CLAUDE.md'),
    path.join(projectDir, 'CLAUDE.md'),
  ];
  for (const cp of claudePaths) {
    const content = readText(cp);
    if (content) {
      const match = content.match(/\*\*Test command\*\*\s*--\s*`([^`]+)`/);
      if (match) return match[1];
    }
  }

  return 'npm test';
}

function detectPluginVersion() {
  // Look for plugin.json relative to this script
  const scriptDir = __dirname;
  const pluginPaths = [
    path.join(scriptDir, '..', '.claude-plugin', 'plugin.json'),
    path.join(scriptDir, '..', 'plugin.json'),
  ];
  for (const pp of pluginPaths) {
    const content = readText(pp);
    if (content) {
      try {
        const parsed = JSON.parse(content);
        if (parsed.version) return parsed.version;
      } catch { /* ignore */ }
    }
  }
  return '0.0.0';
}

function findKernelTemplate() {
  const scriptDir = __dirname;
  const candidates = [
    path.join(scriptDir, '..', 'skills', 'codex-setup', 'references', 'agents-kernel.md'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  // Find and read kernel template
  const templatePath = args.templatePath || findKernelTemplate();
  if (!templatePath) {
    process.stderr.write('Error: kernel template not found at skills/codex-setup/references/agents-kernel.md\n');
    process.exit(1);
  }

  const template = readText(templatePath);
  if (!template) {
    process.stderr.write(`Error: could not read kernel template: ${templatePath}\n`);
    process.exit(1);
  }

  // Detect host context
  const projectName = detectProjectName(args.projectDir);
  const testCommand = detectTestCommand(args.projectDir);
  const version = detectPluginVersion();

  // Replace placeholders
  let output = template
    .replace(/\{PROJECT_NAME\}/g, projectName)
    .replace(/\{VERSION\}/g, version)
    .replace(/\{TEST_COMMAND\}/g, testCommand);

  // Byte budget check
  const byteSize = Buffer.byteLength(output, 'utf8');
  if (byteSize > BYTE_LIMIT) {
    process.stderr.write(
      `Error: output size ${byteSize} bytes exceeds ${BYTE_LIMIT} byte limit\n`
    );
    process.exit(1);
  }

  // Output
  if (args.output) {
    const dir = path.dirname(args.output);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(args.output, output, 'utf8');
    process.stdout.write(`Written ${byteSize} bytes to ${args.output}\n`);
  } else {
    process.stdout.write(output);
  }
}

main();
