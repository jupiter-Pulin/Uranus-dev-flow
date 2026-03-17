---
description: Install plugin rules into project .claude/rules/ for persistent use without plugin loaded
argument-hint: [--all] [--list] [--dry-run] [--force] [--legacy-strategy <strategy>] [rule-names...]
allowed-tools: Read, Grep, Glob, Write, AskUserQuestion, Bash(mkdir:*), Bash(diff:*), Bash(git:*), Bash(ls:*)
---

## Context

- Repo root: !`git rev-parse --show-toplevel`
- Existing local rules: !`ls .claude/rules/ 2>/dev/null || echo "(none)"`

## Task

Install sd0x-dev-flow plugin rules into the current project's `.claude/rules/` directory so they persist even without the plugin loaded. Uses manifest-tracked smart merge to auto-upgrade unchanged rules, preserve user edits, and intelligently handle conflicts.

> **Note**: Installed rules are behavioral guidance for Claude. They reference commands in short form (`/codex-review-fast`). When the sd0x-dev-flow plugin is loaded, commands are auto-namespaced as `/sd0x-dev-flow:codex-review-fast`. For full command execution support without the plugin, also run `/install-hooks` to set up the hook scripts locally.

### Workflow

```mermaid
sequenceDiagram
    participant C as Claude
    participant M as .claude/.sd0x-install-state.json
    participant S as Plugin rules/
    participant T as .claude/rules/
    participant U as User (AskUserQuestion)

    C->>S: Phase 1: Locate plugin rules dir
    C->>S: Phase 2: Enumerate *.md
    C->>C: Phase 3: Determine install set
    C->>M: Phase 3.5: Read manifest + classify
    alt Manifest missing
        alt Target files exist
            C->>C: Legacy migration mode
        else No target files
            C->>C: Fresh install mode
        end
    end
    loop Each rule in install set
        C->>T: Hash local (git hash-object)
        C->>S: Hash plugin source
        C->>M: Compare vs manifest base hash
        alt !local_changed && plugin_changed
            C->>T: Auto-update
        else local_changed && !plugin_changed
            C->>C: Keep local
        else local_changed && plugin_changed
            alt Has ## headings
                C->>C: Section merge
                alt Has conflicts
                    C->>U: AskUserQuestion per file
                end
            else Flat
                C->>U: AskUserQuestion
            end
        else Neither changed
            C->>C: Skip
        end
    end
    C->>M: Phase 4.5: Write updated manifest
    C->>T: Phase 4.6: Backfill CLAUDE.md
    C->>C: Phase 5: Output report
```

### Arguments

```
$ARGUMENTS
```

| Argument | Description |
|----------|-------------|
| `--all` | Install all available rules |
| `--list` | List available rules without installing |
| `--dry-run` | Show what would be installed, no changes |
| `--force` | Overwrite all rules with plugin source + update manifest |
| `--legacy-strategy prompt\|keep-local\|use-plugin\|unmanaged` | Strategy for legacy migration (no manifest, files exist). Default: `prompt` |
| `rule-names...` | Space-separated rule names (without .md extension) |

### Phase 1: Locate Plugin Rules Directory

Find the plugin's `rules/` directory using this priority:

1. **Glob search** — search known Claude plugin locations in order, short-circuit on first match:

   ```
   Glob: ~/.claude/plugins/**/sd0x-dev-flow/rules/auto-loop.md
   Glob: ${REPO_ROOT}/node_modules/sd0x-dev-flow/rules/auto-loop.md
   ```

2. **Plugin-relative fallback** — since this command is loaded from the plugin, try reading `@rules/auto-loop.md` to confirm the plugin's rules are accessible. If readable, derive the rules directory by resolving the path returned (parent of `auto-loop.md`).
3. **Error** — if no rules directory found, report error and stop.

The `rules/` directory is the parent of whichever `auto-loop.md` is found first.

### Phase 2: Enumerate Available Rules

Read all `.md` files from the discovered rules directory. The expected rules are:

| Rule | Purpose |
|------|---------|
| `auto-loop.md` | Auto review loop enforcement |
| `codex-invocation.md` | Codex independent research requirement |
| `fix-all-issues.md` | Zero tolerance for unfixed issues |
| `framework.md` | Framework conventions |
| `testing.md` | Test structure and requirements |
| `security.md` | OWASP security checklist |
| `git-workflow.md` | Git branch and commit conventions |
| `logging.md` | Structured logging standards |
| `docs-writing.md` | Documentation writing conventions |
| `docs-numbering.md` | Document numbering scheme |
| `self-improvement.md` | Self-improvement loop (corrected → record → prevent) |

> **Exclusion**: `*-project.md` files (e.g., `auto-loop-project.md`) are NOT managed rules. They are user-owned override templates — see Phase 3.6.

If `--list` is specified, output this table and **stop**.

### Phase 3: Determine Installation Set

- `--all`: install all rules found in Phase 2
- Specific `rule-names`: install only those (validate they exist in the enumerated list)
- Neither: present the list and use AskUserQuestion to let the user select

### Phase 3.5: Read Manifest and Classify

1. **Read manifest**: `Read` tool to read `.claude/.sd0x-install-state.json`
   - Not found → `{}`
   - JSON parse fails → warn + treat as missing

2. **Read plugin version**: `.claude-plugin/plugin.json` → `package.json` → `"unknown"`

3. **Compute hashes**: Per rule in install set:

   ```bash
   # manifest_hash: from manifest.rules[filename].hash (null if missing)
   # local_hash:
   git hash-object --no-filters ${REPO_ROOT}/.claude/rules/<filename>   # null if file missing
   # plugin_hash:
   git hash-object --no-filters <plugin-rules-dir>/<filename>
   ```

4. **Multi-state classification** (single if/elif chain, first match wins):

   | Priority | Condition | Classification |
   |----------|-----------|---------------|
   | 0 | `deleted:true` AND local missing | SKIP_DELETED |
   | 0b | `deleted:true` AND local exists | Clear flag, re-classify |
   | 1 | manifest_hash is null AND local missing | FRESH_INSTALL |
   | 2 | manifest_hash is null AND local exists | LEGACY |
   | 3 | local_hash is null | DELETED_LOCAL |
   | 4 | local==manifest AND plugin==manifest | SKIP |
   | 5 | local==manifest AND plugin!=manifest | AUTO_UPDATE |
   | 6 | local!=manifest AND plugin==manifest | KEEP_LOCAL |
   | 7 | local!=manifest AND plugin!=manifest | CONFLICT |

   Note: treat missing manifest entry as `{ deleted: false }`

5. **DELETED_LOCAL sub-handling**:
   - plugin changed (plugin_hash != manifest_hash) → AskUserQuestion: "Rule `<file>` was deleted locally but plugin has updates." Options: "Reinstall (Recommended)" / "Keep deleted"
   - plugin unchanged → keep deleted silently + write tombstone

6. Store classifications in memory for Phase 4.

### Phase 3.6: Override Template Creation

After processing managed rules, create unmanaged override templates:

```
# Override templates are NOT part of the managed install set
override_templates = { "auto-loop.md": "auto-loop-project.md" }

For each (base_rule, project_file) in override_templates:
  if project_file NOT exists in .claude/rules/:
    Copy from rules/{project_file} as template
    Do NOT write manifest entry for project_file
    Log: "Created project override template: {project_file}"
  else:
    Skip (user already has it)
```

> **Important**: `*-project.md` files must be explicitly excluded from the managed rule enumeration (`rules/*.md`). They are template sources only, never manifest-tracked.

### Phase 3.7: CLAUDE.md Reference Backfill

After override template creation, perform idempotent reference check:

```
If @rules/auto-loop.md reference exists in CLAUDE.md ## Rules
  AND @rules/auto-loop-project.md is absent:
    Insert @rules/auto-loop-project.md line after @rules/auto-loop.md
    Log: "Added project override reference to CLAUDE.md"
```

### Phase 4: Smart Merge and Install

**4.0** Ensure target directory exists:

```bash
mkdir -p ${REPO_ROOT}/.claude/rules
```

**4.1** `--dry-run` gate → output classification table (see Phase 5 dry-run format) and **stop**.

**4.2** `--force` short-circuit → overwrite all files with plugin source + set manifest hash = plugin_hash + clear all deleted flags. Status = `Forced`.

**4.3** Per-file action table:

| Classification | Action | Manifest Update |
|---------------|--------|-----------------|
| SKIP | No action | Unchanged |
| SKIP_DELETED | No action | Unchanged (tombstone stays) |
| FRESH_INSTALL | Write plugin source | hash = plugin_hash |
| AUTO_UPDATE | Write plugin source | hash = plugin_hash |
| KEEP_LOCAL | No file change | Unchanged |
| CONFLICT | Merge strategy (4.3a/4.3b) | hash = plugin_hash |
| LEGACY | Legacy migration (4.3c) | Per user choice |
| DELETED_LOCAL | Per AskUserQuestion from Phase 3.5 | reinstall: hash=plugin_hash / keep: tombstone |

**4.3a** Section merge (structured rules — has `##` headings):

- Parse both files by `^##` into ordered sections (heading text = key)
- Preamble (content before first `##`): keep local
- Plugin sections in order:
  - identical → keep
  - both-differ → conflict
  - plugin-only → add
- Append local-only sections
- If conflicts → AskUserQuestion per file:
  - "Keep local version (Recommended)"
  - "Use plugin version"
  - "Apply non-conflicting merge + keep local for conflicts"

**4.3b** Flat file conflict (no `##` headings):

- AskUserQuestion: "Rule `<filename>` was modified both locally and in the plugin update."
  - "Keep local version (Recommended)"
  - "Use plugin version"

**4.3c** Legacy migration (no manifest, local file exists):

- hash equal → auto-adopt (write manifest hash, no file change)
- hash differs → `--legacy-strategy` or AskUserQuestion:
  - `keep-local` → manifest hash = plugin_hash (enroll for future tracking)
  - `use-plugin` → overwrite + manifest hash = plugin_hash
  - `unmanaged` → no manifest entry (opt out)
  - `prompt` (default) → AskUserQuestion with above 3 options

### Phase 4.5: Write Manifest

1. Re-read existing manifest via `Read` tool (reduce race window)
2. Update in-memory:
   - `schema_version: 1`
   - `installed_at`: current ISO-8601
   - `plugin_version`: from Phase 3.5
   - `rules`: update each processed file's hash/deleted flag
   - Preserve `hook_scripts` / `scripts` keys from existing manifest
3. Write via `Write` tool to `.claude/.sd0x-install-state.json`
4. Error: warn + continue (next run → legacy migration)

### Phase 4.6: Backfill CLAUDE.md (Closed-Loop Guarantee)

Ensure `.claude/CLAUDE.md` contains `@rules/` references so the auto-loop engine can activate. This guarantees a closed loop even when `/install-rules` is run standalone (without `/project-setup`).

1. Grep `.claude/CLAUDE.md` for `@rules/auto-loop.md`
2. **Found** → check if `@rules/auto-loop-project.md` also present:
   - **Both present** → skip (fully configured)
   - **`auto-loop.md` present, `auto-loop-project.md` missing** → insert `- @rules/auto-loop-project.md -- Project-specific auto-loop overrides (user-owned)` after the `auto-loop.md` line
3. **Not found but file exists** → append the following `## Rules` block at end of file:

   ```markdown
   ## Rules

   - @rules/auto-loop.md -- Auto review loop (highest priority)
   - @rules/auto-loop-project.md -- Project-specific auto-loop overrides (user-owned)
   - @rules/codex-invocation.md -- Codex must independently research (critical)
   - @rules/fix-all-issues.md -- Zero tolerance
   - @rules/testing.md
   - @rules/framework.md
   - @rules/security.md
   - @rules/docs-writing.md
   - @rules/docs-numbering.md
   - @rules/git-workflow.md
   - @rules/logging.md
   - @rules/self-improvement.md -- Corrected → record → prevent recurrence
   ```

4. **File does not exist** → extract from plugin's `CLAUDE.template.md`: `## Required Checks` through `### Auto-Loop Rule` sections + `## Rules` section → create minimal `.claude/CLAUDE.md`. Remove ecosystem block markers and leave unresolved placeholders as `{PLACEHOLDER}`.

### Phase 5: Output Report

## Output

### Dry-run output (when `--dry-run`):

```markdown
## Smart Merge Dry Run

**Plugin**: v<old> → v<new>
**Manifest**: .claude/.sd0x-install-state.json (found|missing)

| Rule | Local | Plugin | Classification | Action |
|------|-------|--------|---------------|--------|
| auto-loop.md | modified | updated | CONFLICT | Section merge (2 conflicts) |
| security.md | original | updated | AUTO_UPDATE | Auto-update |
| git-workflow.md | modified | original | KEEP_LOCAL | Keep local |
| testing.md | original | original | SKIP | Skip |
| docs-writing.md | — | new | FRESH_INSTALL | Install |
| framework.md | deleted | — | SKIP_DELETED | Skip (tombstone) |

**Summary**: 1 auto-update, 1 install, 1 section merge (needs interaction), 1 keep, 1 skip, 1 skip-deleted
```

### Report output (normal run):

```markdown
## Install Rules Report (Smart Merge)

**Source**: <plugin-rules-path>
**Target**: <repo-root>/.claude/rules/
**Plugin**: v<old> → v<new>
**Manifest**: .claude/.sd0x-install-state.json

| Rule | Status | Detail |
|------|--------|--------|
| auto-loop.md | ✅ Merged | 2 sections merged, 0 conflicts |
| security.md | ✅ Auto-updated | Plugin updated, no local edits |
| git-workflow.md | ⏭️ Kept local | User edited, plugin unchanged |
| testing.md | ⏭️ Skipped | No changes |
| docs-writing.md | ✅ Installed | New file |
| framework.md | 🗑️ Skip (deleted) | User previously deleted; tombstone active |

**Auto-updated**: N / **Merged**: N / **Kept local**: N / **Installed**: N / **Skipped**: N / **Skip-deleted**: N
```

Status icons: ✅=Installed/Auto-updated/Merged/Adopted, ⏭️=Kept/Skipped/Enrolled, 🗑️=Skip-deleted, ⚡=Forced, ➖=Unmanaged

### Next Steps

- Review any conflicts or skipped items manually
- Rules in `.claude/rules/` are auto-loaded by Claude Code for this project
- Use `--force` to overwrite all rules with plugin versions
- Manifest tracks installed state at `.claude/.sd0x-install-state.json`

## Examples

```bash
# List available rules
/install-rules --list

# Install all rules
/install-rules --all

# Install specific rules only
/install-rules auto-loop fix-all-issues security

# Preview what would happen (smart merge classification)
/install-rules --all --dry-run

# Force overwrite existing rules
/install-rules --all --force

# Smart merge with legacy migration (keep all local)
/install-rules --all --legacy-strategy keep-local
```
