# Runner Auto-Install + Generation Technical Spec

## 1. Requirement Summary

- **Problem**: 使用者 `/project-setup` 後沒有 runner，`/precommit-fast` 走 fallback，模型跳過 lint 導致 CI 失敗
- **Goals**: (1) 消除 runner 缺失問題 (2) 改善通用 runner 彈性 (3) 提供客製化/non-Node 支援
- **Scope**: 3-phase 漸進式：auto-install → harden → generate

## 2. Existing Code Analysis

### Related Modules

| File | Purpose | Lines |
|------|---------|-------|
| `scripts/precommit-runner.js` | 通用 precommit runner | ~318 |
| `scripts/verify-runner.js` | 通用 verify runner | ~344 |
| `scripts/lib/utils.js` | Runner 共享工具函式 | ~350 |
| `commands/precommit-fast.md` | Precommit fast command | ~94 |
| `commands/precommit.md` | Precommit full command | ~105 |
| `commands/install-scripts.md` | Script 安裝指令 | ~215 |
| `skills/project-setup/SKILL.md` | 專案初始化 skill | ~373 |

### Current Flow

```mermaid
flowchart TD
    PC[/precommit-fast] --> CHK{runner exists?}
    CHK -->|Yes| RUN[node .claude/scripts/precommit-runner.js --mode fast]
    CHK -->|No| FB[Fallback: detect ecosystem manually]
    FB --> LINT{lint:fix script?}
    LINT -->|Yes| RL[Run lint:fix]
    LINT -->|No| SKIP[Skip lint ⚠️]
    SKIP --> TEST[Run test]
    RL --> TEST
    RUN --> DONE[Output report]
    TEST --> DONE
```

### Gap: `/project-setup` Missing Scripts Phase

```
Phase 1-4: Detect + Confirm + CLAUDE.md
Phase 5:   Install rules ✅
Phase 6:   Install hooks ✅
Phase 6.5: Install scripts ❌ (不存在)
Phase 7:   Final report
```

## 3. Technical Solution

### 3.1 Architecture: Phase 1 (Auto-Install)

```mermaid
flowchart TD
    subgraph "project-setup (modified)"
        P5[Phase 5: Rules] --> P6[Phase 6: Hooks]
        P6 --> P65[Phase 6.5: Scripts NEW]
        P65 --> P7[Phase 7: Report]
    end

    subgraph "precommit-fast (modified)"
        PC2[/precommit-fast] --> CHK2{runner exists?}
        CHK2 -->|Yes| RUN2[Run runner]
        CHK2 -->|No| AI{package.json exists?}
        AI -->|Yes| AUTO[Auto-install from plugin]
        AI -->|No| FB2[Ecosystem fallback]
        AUTO --> RUN2
    end
```

#### 3.1.1 `/project-setup` Phase 6.5: Install Scripts

在 Phase 6 (hooks) 之後、Phase 7 (report) 之前，新增：

```
### Phase 6.5: Install Scripts

**Skip if**: `--lite` or `--detect-only` (reuses existing project-setup skip flags, no new flags needed).

1. Locate plugin scripts directory (same 3-level fallback as Phase 5.1)
2. Install core scripts: `precommit-runner.js`, `verify-runner.js`, `lib/utils.js`
3. Conflict strategy: same as Phase 5.2 (install new / skip identical / warn on conflict)
4. Update manifest `.claude/.sd0x-install-state.json`
5. Output scripts install report
```

**Files to modify**: `skills/project-setup/SKILL.md`

#### 3.1.2 `/precommit-fast` Auto-Install

修改 `commands/precommit-fast.md` Step 1：

```markdown
### Step 1: Check for runner script

Use Glob to check if `.claude/scripts/precommit-runner.js` exists in the project root.

- **Found** → run: `node .claude/scripts/precommit-runner.js --mode fast --tail 60`
- **NOT found** → **Auto-install attempt**:
  1. Check if `package.json` exists (Node.js project gate)
  2. If yes: locate plugin scripts dir (Glob fallback chain)
  3. If found: `mkdir -p .claude/scripts/lib` then copy:
     - `precommit-runner.js` → `.claude/scripts/precommit-runner.js`
     - `lib/utils.js` → `.claude/scripts/lib/utils.js`
     (runner requires `./lib/utils` relative import)
     Conflict handling per file:
     - Target missing → copy
     - Target exists, content identical → skip (already installed)
     - Target exists, content differs → skip + warn (no overwrite without `--force`)
  4. Log: `> auto-installing missing runner...`
  5. Run the newly installed runner
  6. If plugin scripts not locatable: fall through to Step 2 (ecosystem fallback)
- Runner **fails** → treat as real precommit failure (no silent fallback)
```

**Implementation note**: Auto-install uses `node -e` with `fs.mkdirSync`/`fs.copyFileSync` to copy files. This stays within the existing `Bash(node:*)` permission — no `cp`/`mkdir` shell permission expansion needed.

**Files to modify**: `commands/precommit-fast.md`, `commands/precommit.md`

### 3.2 Architecture: Phase 2 (Harden Runner)

#### 3.2.1 Configurable Lint Globs

Current (hardcoded in `precommit-runner.js:138-144`):

```javascript
const lintGlobs = [
  'src/**/*.{ts,tsx,js,jsx}',
  'test/**/*.{ts,tsx,js,jsx}',
  // ...
];
```

New: read from config with fallback:

```javascript
function loadLintGlobs(repoRoot) {
  // Priority 1: .claude/runner-config.json
  const configPath = path.join(repoRoot, '.claude', 'runner-config.json');
  try {
    const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    if (Array.isArray(cfg.lintGlobs) && cfg.lintGlobs.length > 0) {
      return cfg.lintGlobs;
    }
  } catch {}

  // Priority 2: package.json "sd0x.lintGlobs"
  const pkg = readPackageJson(repoRoot);
  if (pkg?.sd0x?.lintGlobs?.length > 0) {
    return pkg.sd0x.lintGlobs;
  }

  // Fallback: default globs
  return DEFAULT_LINT_GLOBS;
}
```

#### 3.2.2 Dynamic Test Recipes

Current (hardcoded Jest at line 300-305):

```javascript
lines.push('## Single-test recipes (this repo)');
lines.push('- Unit: `npx jest test/unit/...`');
```

New: derive from detected test framework:

```javascript
function buildRecipes(pkg, pm) {
  const recipes = [];
  if (hasScript(pkg, 'test:unit')) {
    recipes.push(`- Unit: \`${pm} test:unit -- <path>\``);
  }
  if (hasScript(pkg, 'test:integration')) {
    recipes.push(`- Integration: \`${pm} test:integration -- <path>\``);
  }
  // ... derive from actual scripts, not hardcoded framework
  return recipes;
}
```

**Files to modify**: `scripts/precommit-runner.js` (both lint globs + recipes), `scripts/verify-runner.js` (lint globs only — verify-runner has no recipe block)

### 3.3 Architecture: Phase 3 (Generate Runner)

新 skill: `/generate-runner`

```
skills/generate-runner/
├── SKILL.md
└── references/
    └── templates.md    # Per-ecosystem runner templates
```

#### Workflow

```mermaid
flowchart TD
    GR[/generate-runner] --> DET[Detect ecosystem]
    DET --> NODE{Node.js?}
    DET --> PY{Python?}
    DET --> RS{Rust?}
    DET --> GO{Go?}
    NODE -->|Yes| TN[Load Node template]
    PY -->|Yes| TP[Load Python template]
    RS -->|Yes| TR[Load Rust template]
    GO -->|Yes| TG[Load Go template]
    TN --> CUST[Customize: PM, scripts, globs, framework]
    TP --> CUST
    TR --> CUST
    TG --> CUST
    CUST --> WRITE[Write .claude/scripts/precommit-runner.js]
    WRITE --> HDR[Add eject header metadata]
```

#### Eject Header

```javascript
#!/usr/bin/env node
/**
 * Generated by /generate-runner
 * This file is user-owned — plugin updates will NOT overwrite it.
 *
 * @generated_at 2026-03-20T10:00:00Z
 * @plugin_version 2.0.18
 * @template node-yarn-jest
 * @ecosystem node
 */
```

#### Template Selection

| Ecosystem | Detection | Template ID |
|-----------|-----------|-------------|
| Node.js (npm) | `package-lock.json` | `node-npm` |
| Node.js (yarn) | `yarn.lock` | `node-yarn` |
| Node.js (pnpm) | `pnpm-lock.yaml` | `node-pnpm` |
| Python | `pyproject.toml` or `setup.py` | `python` |
| Rust | `Cargo.toml` | `rust` |
| Go | `go.mod` | `go` |

## 4. Risks and Dependencies

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| Auto-install 寫檔令人驚訝 | Med | Low | 明確 log + no --force + skip on conflict |
| Non-Node 專案誤觸 auto-install | Low | Low | Gate by `package.json` |
| Generated runner drift | Med | Low | Eject header + `generated_at` metadata |
| Phase 2 breaking change | Low | Med | Configurable globs 有 fallback to defaults |

## 5. Work Breakdown

### Phase 1: Auto-Install (P0)

| # | Task | File | Estimate |
|---|------|------|----------|
| 1.1 | `/project-setup` Phase 6.5 | `skills/project-setup/SKILL.md` | 修改 SKILL.md |
| 1.2 | `/precommit-fast` auto-install | `commands/precommit-fast.md` | 修改 Step 1 |
| 1.3 | `/precommit` auto-install | `commands/precommit.md` | 同上 |
| 1.4 | Phase 7 report 加入 scripts 狀態 | `skills/project-setup/SKILL.md` | 小修改 |
| 1.5 | Tests | `test/commands/project-setup.test.js` | 新增/更新 |

### Phase 2: Harden Runner (P1)

| # | Task | File | Estimate |
|---|------|------|----------|
| 2.1 | Configurable lint globs | `scripts/precommit-runner.js` | 修改 |
| 2.2 | Dynamic test recipes | `scripts/precommit-runner.js` | 修改 |
| 2.3 | Configurable lint globs for verify-runner (no recipe block) | `scripts/verify-runner.js` | 修改 |
| 2.4 | Tests | `test/scripts/` | 新增 |

### Phase 3: Generate Runner (P2)

| # | Task | File | Estimate |
|---|------|------|----------|
| 3.1 | SKILL.md | `skills/generate-runner/SKILL.md` | 新建 |
| 3.2 | Templates reference | `skills/generate-runner/references/templates.md` | 新建 |
| 3.3 | Command entry | `commands/generate-runner.md` | 新建 |
| 3.4 | CLAUDE.md entries | `CLAUDE.md`, `CLAUDE.template.md` | 修改 |
| 3.5 | Tests | `test/commands/generate-runner.test.js` | 新建 |

## 6. Testing Strategy

| Phase | Test Type | Test Case | Coverage |
|-------|-----------|-----------|----------|
| 1 | Unit | project-setup SKILL.md mentions Phase 6.5 + scripts install | AC1 |
| 1 | Unit | precommit-fast.md contains auto-install description | AC2 |
| 1 | Unit | precommit.md contains auto-install description | AC3 |
| 1 | Unit | Auto-install log string matches AC4 | AC4 |
| 1 | Scenario | Auto-install success: fast mode + runner not present → install + run | AC2 |
| 1 | Scenario | Auto-install success: full mode + runner not present → install + run | AC3 |
| 1 | Scenario | Plugin source not found → fallback to ecosystem detection | AC2 edge |
| 1 | Scenario | `lib/utils.js` installed at correct relative path (`./lib/utils`) | AC2 |
| 1 | Scenario | Existing `lib/utils.js` differs while runner missing → skip + warn (no --force) | AC5 |
| 2 | Unit | `loadLintGlobs()` reads from runner-config.json | AC7 |
| 2 | Unit | `loadLintGlobs()` falls back to defaults when no config | AC7 |
| 2 | Unit | `buildRecipes()` derives from pkg.scripts, not hardcoded | AC8 |
| 3 | Unit | SKILL.md schema + template file validation | AC10 |
| 3 | Unit | Eject header contains required metadata fields | AC11 |

## 7. Open Questions

| # | Question | Impact | Decision |
|---|----------|--------|----------|
| 1 | Phase 2 的 `runner-config.json` 格式要不要支援 verify-runner 的 config？ | Med | 建議統一為 `runner-config.json` 同時涵蓋 precommit + verify |
| 2 | Phase 3 的 non-Node templates 是否需要 `lib/utils.js` 等價物？ | Med | Python/Rust/Go 版本可以用原生 shell script，不需 utils |
| 3 | Auto-install 是否要更新 manifest？ | Low | 建議 yes，保持 `/claude-health` 能追蹤 |
