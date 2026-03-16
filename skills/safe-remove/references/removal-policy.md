# Removal Policy

## 2-Tier Classification

| Tier | Definition | Criteria |
|------|-----------|----------|
| **BLOCKER** | Structured runtime/config binding — removal breaks execution or loads | Machine-parsable syntax (YAML field, JSON path, `@` directive) |
| **PATCHABLE** | Prose/documentation reference — safe to auto-edit or remove | Free-text mention in tables, descriptions, or guidance text |

## BLOCKER Patterns

| Pattern | Location | Regex | Example |
|---------|----------|-------|---------|
| Command → Skill binding | `commands/*.md` | `@skills/<name>/` | `@skills/create-skill/SKILL.md` |
| Agent skills field | `agents/*.md` | `^skills:\s*.*<name>` (YAML frontmatter) | `skills: create-skill` |
| Hook command path | `hooks/hooks.json` | `"command":\s*".*<name>.*"` | `"command": "scripts/create-skill.sh"` |
| Allowed-tools binding | `commands/*.md`, `skills/*/SKILL.md` | `allowed-tools:.*<name>` (only if tool-specific) | Rare; usually generic tool names |

## PATCHABLE Patterns

| Pattern | Location | Patch Strategy |
|---------|----------|---------------|
| Command table row | `CLAUDE.md`, `.claude/CLAUDE.md`, `CLAUDE.template.md` | Remove entire row |
| README command row | `README.md` + 5 locale variants | Remove row + decrement count in summary line |
| Prose mention | `rules/*.md`, `skills/*/SKILL.md` | Remove or reword the mention |
| "When NOT to Use" | Other `skills/*/SKILL.md` | Remove the line referencing the target |
| Archived docs | `docs/features/*/requests/archived/*` | Skip (preserve history) |

## Per-Asset-Type Discovery Matrix

### skill

| Check | Command | Classification |
|-------|---------|---------------|
| Command binding | `grep -rn "@skills/<name>/" commands/ --include="*.md"` | BLOCKER |
| Agent preload | `grep -rn "^skills:.*<name>" agents/ --include="*.md"` | BLOCKER |
| CLAUDE.md table | `grep -n "/<name>" CLAUDE.md .claude/CLAUDE.md CLAUDE.template.md` | PATCHABLE |
| README tables | `grep -n "/<name>" README*.md` | PATCHABLE |
| Other skill refs | `grep -rn "/<name>\|<name>" skills/ --include="*.md"` | PATCHABLE |
| Rule mentions | `grep -rn "/<name>" rules/ --include="*.md"` | PATCHABLE |
| Hook refs | `grep -n "<name>" hooks/hooks.json` | BLOCKER (if command path) |

**Files to delete**: `skills/<name>/` (entire directory) + `commands/<name>.md` (if exists)

### command

| Check | Command | Classification |
|-------|---------|---------------|
| CLAUDE.md table | `grep -n "/<name>" CLAUDE.md .claude/CLAUDE.md CLAUDE.template.md` | PATCHABLE |
| README tables | `grep -n "/<name>" README*.md` | PATCHABLE |
| Skill references | `grep -rn "/<name>" skills/ --include="*.md"` | PATCHABLE |

**Files to delete**: `commands/<name>.md`

### agent

| Check | Command | Classification |
|-------|---------|---------------|
| Skill invocation | `grep -rn "strict-reviewer\|<name>" skills/ --include="*.md"` | PATCHABLE (usually) |
| Task tool usage | `grep -rn "subagent_type.*<name>" skills/ commands/ --include="*.md"` | BLOCKER |

**Files to delete**: `agents/<name>.md`, `.claude/agents/<name>.md` (if separate copy)

### rule

| Check | Command | Classification |
|-------|---------|---------------|
| CLAUDE.md reference | `grep -n "@rules/<name>" CLAUDE.md .claude/CLAUDE.md` | PATCHABLE |
| Skill references | `grep -rn "@rules/<name>\|rules/<name>" skills/ --include="*.md"` | PATCHABLE |

**Files to delete**: `rules/<name>.md`, `.claude/rules/<name>.md` (if mirror)

### script

| Check | Command | Classification |
|-------|---------|---------------|
| Hook command path | `grep -n "<name>" hooks/hooks.json` | BLOCKER |
| Skill script ref | `grep -rn "scripts/<name>" skills/ commands/ --include="*.md"` | BLOCKER |
| run-skill.sh usage | `grep -rn "run-skill.sh.*<name>" commands/ --include="*.md"` | BLOCKER |

**Files to delete**: `scripts/<name>.*`

### hook

| Check | Command | Classification |
|-------|---------|---------------|
| hooks.json entry | Read `hooks/hooks.json`, find entry | Direct removal from JSON |
| .claude/ mirror | Check `.claude/hooks/` or `.claude/settings.json` | PATCHABLE |
| Install-hooks ref | `grep -rn "<name>" commands/install-hooks.md skills/*/SKILL.md` | PATCHABLE |

**Files to delete**: Hook script file + JSON entry

## Verification Regexes (Post-Removal)

| Asset Type | Verification Commands |
|------------|----------------------|
| skill | `grep -rn "@skills/<name>/" . --include="*.md"` + `grep -rn "skills:.*<name>" agents/` + `grep -rn "/<name>" CLAUDE.md README*.md` |
| command | `grep -rn "/<name>" CLAUDE.md README*.md commands/` |
| agent | `grep -rn "<name>" skills/ commands/ --include="*.md"` + check `.claude/agents/` |
| rule | `grep -rn "@rules/<name>" . --include="*.md"` |
| script | `grep -rn "scripts/<name>" . --include="*.md"` + `grep -n "<name>" hooks/hooks.json` |
| hook | `grep -rn "<name>" hooks/ .claude/` |

All verification commands should exclude `docs/features/*/requests/archived/` (preserve historical references).
