# Tech Brief Output Template

## Header Metadata

```markdown
# Tech Brief: <feature title>

> Feature: <feature key>
> Depth: brief | normal | deep
> Generated: <ISO 8601 timestamp>
> Sources: <comma-separated list of docs actually read>
```

## Source Provenance Table

```markdown
## Source Provenance

| Section | Source Files | Confidence |
|---------|------------|------------|
| Background | <relative paths> | High/Medium/Low |
| Design Decisions | <relative paths> | High/Medium/Low |
| Implementation | <paths + git evidence> | High/Medium/Low |
| Limitations | <relative paths> | High/Medium/Low |
| Discussion | <relative paths or markers> | High/Medium/Low |
| Next Steps | <relative paths> | High/Medium/Low |
```

**Confidence levels**:

| Level | Condition |
|-------|-----------|
| High | Primary source exists and directly addresses section |
| Medium | Source exists but section content is inferred/partial |
| Low | No direct source; content derived from git log or sparse signals |

## Section Templates

### 1. Background & Problem

```markdown
## 1. Background & Problem

### Context
<What triggered this work — incident, feature request, tech debt>

### Problem Statement
<Specific problem being solved, impact, affected components>

### Scope
<What was addressed in this implementation>
```

### 2. Design Decisions & Trade-offs

```markdown
## 2. Design Decisions & Trade-offs

### Decision D1: <decision name>
- **Choice**: <what was decided>
- **Rationale**: <why this approach>
- **Trade-off**: <what was sacrificed, what was gained>
- **Source**: §<tech-spec or architecture section>

### Decision D2: <decision name>
...
```

### 3. Implementation Highlights

```markdown
## 3. Implementation Highlights

### Key Changes

| File | Change | Purpose |
|------|--------|---------|
| `<file:line>` | <brief description> | <why> |

### Architecture
<Mermaid diagram or simplified architecture description if available from source docs>

### Core Logic
<Key implementation details, algorithms, patterns used>
```

### 4. Limitations & Known Issues

```markdown
## 4. Limitations & Known Issues

| # | Limitation | Severity | Workaround |
|---|-----------|----------|------------|
| 1 | <description> | High/Medium/Low | <workaround or "None — planned for Phase N"> |

### Technical Debt
<Items deferred intentionally, with rationale>
```

### 5. Discussion & References

```markdown
## 5. Discussion & References

### Review History

| Type | Reference | Status |
|------|-----------|--------|
| Code review | Codex threadId: `<uuid>` | Passed |
| Doc review | Codex threadId: `<uuid>` | Passed |
| PR | <link or "N/A"> | Merged |

### External References
- <links to related docs, RFCs, external resources>
```

### 6. Next Steps

```markdown
## 6. Next Steps

| Phase | Description | Status | Dependencies |
|-------|-------------|--------|-------------|
| Phase 1 | <what was done> | Done | — |
| Phase 2 | <next planned work> | Planned | <dependencies> |
```

## Depth Matrix

| # | Section | brief | normal | deep |
|---|---------|:-----:|:------:|:----:|
| — | Source Provenance | Full | Full | Full |
| 1 | Background & Problem | 2-3 sentence summary | Full (Context + Problem + Scope) | Full + timeline of events |
| 2 | Design Decisions | Top 1-2 decisions only | All decisions with rationale | All decisions + rejected alternatives comparison |
| 3 | Implementation Highlights | File list only (from git diff) | file:line + description | file:line + code snippets (max 30 lines each) + diagram |
| 4 | Limitations & Known Issues | Top 3 items | Full list with severity | Full list + severity + workaround + tech debt section |
| 5 | Discussion & References | Links only | Links + one-line context | Links + context per reference |
| 6 | Next Steps | Bullet list | Phase breakdown table | Phase table + dependencies + timeline |

## Length Policy

| Depth | Max Length | Section Evidence Rule |
|-------|-----------|----------------------|
| brief | ~500 words (upper bound) | Each included section must cite at least 1 source |
| normal | ~1500 words (upper bound) | Each section must cite at least 1 source |
| deep | ~3000 words (upper bound) | Each section must cite at least 2 sources where available |

These are caps, not targets. If source documents are thin, output will be shorter.

## Evidence Insufficient Rule

When a section cannot be populated due to missing source data:

```markdown
[Source unavailable — no <type> found for this feature]
```

When a section has partial data:

```markdown
[Partial — <type> exists but lacks data for this subsection]
```

Never fabricate content not grounded in source documents or git history.

## Section Source Mapping

| Section | Primary Sources | Fallback |
|---------|----------------|----------|
| 1. Background | tech-spec §1 + request doc | Git log first commit message |
| 2. Design Decisions | tech-spec §3 + architecture AD-N + feasibility | tech-spec §3 only |
| 3. Implementation | Changed files (Read) + git diff + tech-spec §2 | Git log + diff stat only |
| 4. Limitations | tech-spec §4 + §7 + request AC unchecked items | tech-spec §7 only |
| 5. Discussion | request `## References` → git merge commits | `[No references found]` |
| 6. Next Steps | request `## Progress` + tech-spec §5 | `[No roadmap available]` |
