---
name: bump-version
description: "Bump package and plugin version in sync. Updates package.json, .claude-plugin/plugin.json, and install-state manifest to the same version. Use when: user says 'bump version', 'update version', '更新版本', '版本 +1', or /bump-version"
---

# Bump Version

Update `package.json`, `.claude-plugin/plugin.json`, and `.sd0x/install-state.json` versions in sync.

## Workflow

1. Read current versions from all files
2. Determine new version (from argument or auto-increment)
3. Update all files to the same version
4. Report result

## Step 1: Read Current Versions

```bash
grep '"version"' package.json .claude-plugin/plugin.json
```

Also check manifest:

```bash
grep '"plugin_version"' .sd0x/install-state.json 2>/dev/null || echo "(no manifest)"
```

If versions are already out of sync, warn user before proceeding.

## Step 2: Determine New Version

| Input | Action |
|-------|--------|
| Explicit version (e.g., `1.9.0`) | Use as-is |
| `major` | Bump major: `1.8.1` → `2.0.0` |
| `minor` | Bump minor: `1.8.1` → `1.9.0` |
| `patch` (default) | Bump patch: `1.8.1` → `1.8.2` |
| No argument | Default to `patch` |

## Step 3: Update All Files

Use Edit tool to update version fields:

1. `package.json` — `"version"` field
2. `.claude-plugin/plugin.json` — `"version"` field
3. `.sd0x/install-state.json` — `"plugin_version"` field (if file exists)

All must be set to the **exact same version string**.

The manifest update prevents the SessionStart drift sentinel from firing false warnings after every version bump in the plugin source repo.

## Step 4: Report

```
## Version Bump

| File | Field | Before | After |
|------|-------|--------|-------|
| package.json | version | x.y.z | a.b.c |
| .claude-plugin/plugin.json | version | x.y.z | a.b.c |
| .sd0x/install-state.json | plugin_version | x.y.z | a.b.c |
```

## Prohibited

- Never set different versions across the files
- Never modify other fields in the JSON files
