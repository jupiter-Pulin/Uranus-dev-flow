# Rule Override Pattern — Technical Spec

## 1. Requirement Summary

- **Problem**: Plugin 更新 `auto-loop.md` 時，若使用者已客製化同一 `##` section（如 Auto-Trigger table），smart merge 會觸發 `CONFLICT` 狀態，需手動解決。使用者無法在不觸碰 plugin-managed 檔案的情況下客製化 auto-loop 行為。
- **Goals**:
  1. 使用者可在獨立檔案中定義 project-specific auto-loop 行為
  2. Plugin 更新 base rules 時不會與使用者客製化衝突
  3. `/install-rules` 安裝時自動建立客製化 template，不需手動操作
  4. `/claude-health` 提供 4 項 safeguard 檢查
- **Scope**:
  - v1: 僅 `auto-loop-project.md`（最常客製化的規則）
  - 命名慣例 `*-project.md` 保留給未來擴展
- **Non-goals**:
  - 不修改 smart merge 演算法本身
  - 不重新命名現有 `auto-loop.md`（避免大量 blast radius）
  - 不通用化到所有 rules（v1 scope）

## 2. Existing Code Analysis

### Related Modules

| File | Purpose | Impact |
|------|---------|--------|
| `rules/auto-loop.md` | Plugin source auto-loop rule | Add redirect comment at bottom |
| `.claude/rules/auto-loop.md` | Local installed copy | Same redirect comment |
| `commands/install-rules.md` | Rule installation flow | Add project override file creation |
| `skills/claude-health/SKILL.md` | Health check + sync | Add 4 safeguards |
| `skills/project-setup/SKILL.md` | Project onboarding | Add override file to setup flow |
| `CLAUDE.md` / `.claude/CLAUDE.md` | Rule reference list | Add `@rules/auto-loop-project.md` |
| `CLAUDE.template.md` | Template for new projects | Add project override reference |

### Reusable Components

- Smart merge 8-state classification（reuse `FRESH_INSTALL` for project file creation）
- Manifest `.claude/.sd0x-install-state.json`（project file explicitly NOT tracked）
- `/claude-health` S2 component classification（extend with override-aware checks）

## 3. Technical Solution

### 3.1 Architecture Design

```mermaid
sequenceDiagram
    participant U as User
    participant IR as /install-rules
    participant CH as /claude-health
    participant CM as CLAUDE.md

    IR->>IR: Install auto-loop.md (managed, smart merge)
    IR->>IR: Create auto-loop-project.md (unmanaged template)
    IR->>CM: Add @rules/auto-loop-project.md reference

    Note over U: User edits auto-loop-project.md

    U->>CH: /claude-health
    CH->>CH: Check 4 safeguards
    alt Override drift
        CH->>U: Warn: base updated since override authored
    end
    alt Wrong-layer edit
        CH->>U: Warn: base auto-loop.md locally modified
    end
```

### 3.2 File Ownership Model

```
.claude/rules/
├── auto-loop.md              ← plugin-managed (smart merge tracked)
├── auto-loop-project.md      ← user-owned (NOT manifest-tracked)
├── codex-invocation.md       ← plugin-managed
└── ...
```

| File | Owner | Manifest Tracked | Smart Merge |
|------|-------|-----------------|-------------|
| `auto-loop.md` | Plugin | Yes | Yes (8-state) |
| `auto-loop-project.md` | User | No | No (unmanaged) |

> **Note**: Template source exists in `rules/` for `/install-rules` to copy from, but the installed copy is explicitly excluded from manifest hash tracking.

### 3.3 Project Override File Contract

```markdown
# Auto-Loop Project Overrides

<!-- Precedence: When this file conflicts with auto-loop.md, this file takes precedence. -->
<!-- Based on: auto-loop.md @ <sha7> (<date>) -->

## Auto-Trigger

<!-- To override the Auto-Trigger table from auto-loop.md,
     restate the FULL section here (section-level replacement).
     Delete this section if you don't need to override. -->
```

**Override semantics**: Section-level full replacement（使用者重寫完整 `##` section 來覆蓋 base）。

> **Note**: Override section headings must exactly match base section headings for clear section-level replacement semantics.

| Design Decision | Choice | Rationale |
|----------------|--------|-----------|
| Override granularity | Section-level (`##`) | LLM 更容易理解完整 section；避免 row-level delta 的歧義 |
| Precedence mechanism | Self-contained header text | 不依賴 CLAUDE.md load order（`@` 引用無保證順序） |
| Manifest tracking | Not tracked | 避免 plugin 更新觸碰 user 檔案 |

### 3.4 Core Logic Changes

#### 3.4.1 `/install-rules` Changes

**Phase 3.5 extension** — after managed rule classification, add:

```
# Exclusion: *-project.md files are NOT part of the managed install set.
# They are copied as templates only, with no manifest hash entry written.
managed_rules = rules/*.md EXCLUDING *-project.md

# Explicit override template mapping (not suffix-derived from managed_rules)
override_templates = { "auto-loop.md": "auto-loop-project.md" }

For each (base_rule, project_file) in override_templates:
  if project_file NOT exists in .claude/rules/:
    Copy from rules/{project_file} as template
    Do NOT write manifest entry for project_file
    Log: "Created project override template: {project_file}"
  else:
    Skip (user already has it)
```

> **Important**: `/install-rules` must explicitly exclude `*-project.md` from the managed rule enumeration (`rules/*.md`) to prevent accidental manifest tracking. The template source `rules/auto-loop-project.md` is only a copy source, never a managed rule.

**New flag**: `--customize <rule-name>` — creates fuller template with examples.

#### 3.4.2 `/claude-health` Safeguard Checks

4 new checks in S2 component classification:

| # | Check | Severity | Detection | Recommendation |
|---|-------|----------|-----------|----------------|
| 1 | Override drift | P2 | `based_on` hash in project file vs current base hash | "Base auto-loop updated; review your overrides" |
| 2 | Policy contradiction | P1 | Override disables required check that hook enforces | "Override conflicts with stop-guard enforcement" |
| 3 | Missing reference | P1 | CLAUDE.md references `@rules/auto-loop-project.md` but file missing, OR file exists but not referenced in CLAUDE.md | `/install-rules` to recreate or add reference |
| 4 | Wrong-layer edit | P2 | Base `auto-loop.md` has `LOCAL_MODIFIED`, `CONFLICT`, or `LEGACY` doctor state (user modified base) | "Move customization to auto-loop-project.md" |

**Policy contradiction detection contract**: Parse the project override's Auto-Trigger table for required check commands. Cross-reference against hook-enforced sentinels (from `hooks/stop-guard.sh`): if override omits a command that stop-guard requires (e.g., removing `/codex-review-fast` for code changes), flag as P1 contradiction.

#### 3.4.3 Base `auto-loop.md` Redirect

Add at bottom of `rules/auto-loop.md`:

```markdown
## Project Customization

Project-specific overrides belong in `auto-loop-project.md` (not this file).
See `@rules/auto-loop-project.md` for your project's custom auto-loop behavior.
```

#### 3.4.4 CLAUDE.md / Template Updates

```markdown
## Rules

- @rules/auto-loop.md -- Auto review loop (highest priority)
- @rules/auto-loop-project.md -- Project-specific auto-loop overrides (user-owned)
```

**Backfill for existing projects**: `/install-rules` must perform idempotent missing-reference repair: if `@rules/auto-loop.md` reference exists in `## Rules` but `@rules/auto-loop-project.md` is absent, insert only the missing line. This ensures existing projects receive the reference on next `/install-rules` run without requiring manual CLAUDE.md edits.

### 3.5 Migration Strategy (Backward Compatibility)

| User State | Migration Path |
|-----------|---------------|
| No customization (base == manifest) | `/install-rules` creates empty project file → no behavioral change |
| Has local modifications (LOCAL_MODIFIED) | `/claude-health` detects wrong-layer → suggests moving to project file |
| Has CONFLICT state | Resolve conflict first, then move customizations to project file |

## 4. Risks and Dependencies

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| LLM ignores precedence instruction | Low | Medium | Section-level replacement (no overlapping content) + explicit header |
| User edits base instead of project file | Medium | Low | `/claude-health` wrong-layer detection + base redirect comment |
| Override drift (base updated, project stale) | Medium | Medium | `based_on` hash + health check warning |
| Scope creep to all rules | Low | Medium | v1 scoped to auto-loop; convention reserved |

### Dependencies

| Dependency | Status | Risk |
|-----------|--------|------|
| `@rules/` flat include semantics in Claude Code | Verified | Low — well-tested |
| Smart merge 8-state classification | Existing | None |
| `/claude-health` S2 classification | Existing | Low — extend, not rewrite |

## 5. Work Breakdown

| # | Task | Files | Effort | Depends On |
|---|------|-------|--------|-----------|
| 1 | Create template source `rules/auto-loop-project.md` (installed as unmanaged — no manifest entry) | `rules/auto-loop-project.md` (new) | S | — |
| 2 | Add redirect section to `auto-loop.md` | `rules/auto-loop.md` | S | — |
| 3 | Update `/install-rules` to create project file | `commands/install-rules.md` | M | 1 |
| 4 | Update `/claude-health` with 4 safeguards | `skills/claude-health/SKILL.md` | M | 1 |
| 5 | Update CLAUDE.md + template references | `CLAUDE.md`, `CLAUDE.template.md`, `.claude/CLAUDE.md` | S | 1 |
| 6 | Update `/project-setup` flow | `skills/project-setup/SKILL.md` | S | 1, 3 |
| 7 | Tests for override detection | `test/` | M | 3, 4 |

## 6. Testing Strategy

| Type | Scope | File |
|------|-------|------|
| Unit | Override file detection (exists/missing/drift) | `test/scripts/install-rules-override.test.js` |
| Unit | Wrong-layer detection (base modified + project exists) | `test/scripts/claude-health-override.test.js` |
| Unit | Policy contradiction detection (override removes required review step) | `test/scripts/claude-health-override.test.js` |
| Unit | Manifest exclusion (no `auto-loop-project.md` entry in `.claude/.sd0x-install-state.json`) | `test/commands/install-rules-override.test.js` |
| Integration | `/install-rules` creates project file on fresh install | Manual |
| Integration | Plugin update doesn't touch project file | Manual |

## 7. Open Questions

| # | Question | Decision Owner |
|---|---------|---------------|
| 1 | Should `--customize` flag be on `/install-rules` or a separate command? | Plugin maintainer |
| 2 | Should the project file template include all sections as commented-out stubs? | UX decision |
| 3 | v2: Extend to `codex-invocation-project.md`, `testing-project.md`? | Based on user demand |
