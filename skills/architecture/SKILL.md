---
name: architecture
description: "Architecture design and documentation. Produces 3-architecture.md with component diagrams, data flow, integration points, and architecture decisions. Reads existing tech-spec as input. Use when: designing system architecture, documenting component interactions, creating architecture docs, producing 3-architecture.md. Not for: tech spec writing (use tech-spec), code implementation (use feature-dev), architecture consulting only (use codex-architect)."
allowed-tools: Read, Grep, Glob, Bash(git:*), Bash(node:*), Bash(bash:*), Write, Agent, Skill, AskUserQuestion, mcp__codex__codex, mcp__codex__codex-reply
---

# Architecture Design Skill

## Trigger

- Keywords: architecture, architecture design, architecture doc, component diagram, 3-architecture, system design, document architecture

## When NOT to Use

- Tech spec writing (use `/tech-spec`)
- Code implementation (use `/feature-dev`)
- Architecture consulting only (use `/codex-architect`)
- Implementation roadmap (use `/deep-analyze`)

## Usage

```bash
/architecture                          # Auto-detect feature, create/update
/architecture <feature-keyword>        # Specify feature
/architecture --skip-debate            # Skip Phase 3 adversarial debate
```

## Workflow

```mermaid
sequenceDiagram
    participant U as User
    participant C as Claude
    participant E as Explore Agent
    participant X as Codex
    participant D as Architecture Designer
    participant B as /codex-brainstorm

    C->>C: Phase 0: Context Resolution
    par Phase 1: Research
        C->>E: Track A: Code pattern analysis (background)
        C->>C: Track B: Read tech-spec (inline)
    end
    E-->>C: Component list + dependencies
    C->>X: Track C: Architecture advice
    X-->>C: Independent recommendations
    C->>D: Phase 2: Architecture Design
    D-->>C: Component + flow + decisions
    C->>B: Phase 3: Verification (debate)
    B-->>C: Equilibrium conclusion
    C->>C: Phase 4: Write 3-architecture.md
    C->>U: Auto-trigger /codex-review-doc
```

## Phase 0: Context Resolution

Detect the target feature using the 5-level cascade.

See `@skills/tech-spec/references/feature-context-resolution.md` for the full algorithm.

```bash
node scripts/resolve-feature-cli.js 2>/dev/null || echo '{}'
```

| State | Mode |
|-------|------|
| `3-architecture.md` exists | Update (incremental) |
| `3-architecture.md` absent + `2-tech-spec.md` exists | Create (tech-spec-informed) |
| `3-architecture.md` absent + no tech-spec | Create (code-only research) |
| Feature not resolved | Gate: Need Human |

### Scope Gate

For small features (tech-spec WBS has only 1 task, or no tech-spec and < 3 related files), suggest keeping architecture in tech-spec Section 3 instead of creating a separate document. Use AskUserQuestion to confirm.

## Phase 1: Architecture Research (parallel)

Launch research tracks. Tracks A and B run in parallel; Track C runs after both complete.

### Track A: Code Pattern Analysis (background)

```
Agent({
  description: "Analyze architecture patterns for <feature>",
  subagent_type: "Explore",
  run_in_background: true,
  prompt: "Analyze the codebase architecture for feature <key>:
    1. Trace execution paths of related modules
    2. Map component dependencies (imports, calls)
    3. Identify integration points with other features
    4. Read docs/architecture.md for global context
    Output: component list + dependency graph + integration points"
})
```

Fallback: `subagent_type: "general-purpose"` if Explore unavailable.

### Track B: Tech-spec Extraction (inline)

If `2-tech-spec.md` exists:
- Read Section 3 (Technical Solution) — architecture diagram, data model, API design
- Read Section 4 (Risks) — constraints, dependencies
- Read Section 7 (Open Questions) — unresolved design decisions

If no tech-spec: skip (code-only mode).

### Track C: Codex Architecture Advice (after A+B)

```
mcp__codex__codex({
  prompt: <from references/codex-prompt.md>,
  sandbox: 'read-only',
  'approval-policy': 'never',
})
```

Provide feature context metadata only — never feed Claude's conclusions (per `@rules/codex-invocation.md`).

Save `threadId` for potential follow-up.

Graceful degradation: Codex unavailable → proceed without (warn in output).

## Phase 2: Architecture Design

Dispatch architecture-designer agent with merged research results:

```
Agent({
  description: "Design architecture for <feature>",
  subagent_type: "architecture-designer",
  prompt: `Design the architecture for <feature>.

  ## Input Context
  ${TECH_SPEC_SUMMARY}
  ${CODE_ANALYSIS}
  ${CODEX_ADVICE}

  ## Required Output
  Follow the output template at @skills/architecture/references/template.md:
  1. Component diagram (Mermaid flowchart)
  2. Component responsibility table
  3. Data flow (Mermaid sequence diagram)
  4. Integration points with existing systems
  5. Architecture decisions (AD-N: context → options → decision → rationale)
  6. Deployment considerations (if applicable)

  ## Constraints
  - Follow @rules/docs-writing.md conventions
  - Reference actual code (file:line, not invented)
  - Mark assumptions explicitly
  - Redact credentials/secrets per @rules/security.md`
})
```

Fallback: if architecture-designer agent unavailable, use `solution-architect` agent.

## Phase 3: Verification (conditional)

Invoke `/codex-brainstorm` via Skill tool:

```
Skill("codex-brainstorm", `Evaluate the proposed architecture for <feature>.

Focus: scalability, maintainability, integration complexity, testability.

Constraints:
- Component diagram from Phase 2
- Tech-spec constraints from Phase 1
- Known risks`)
```

Must produce: threadId + equilibrium conclusion.

### Skip Conditions

| Condition | Action |
|-----------|--------|
| `--skip-debate` flag | Skip Phase 3 |
| Scope gate triggered (small feature) | Skip Phase 3 |
| Update mode (incremental change) | Skip Phase 3 |

Graceful degradation: `/codex-brainstorm` timeout → record timeout in Verification section, still output document.

## Phase 4: Output

Write `docs/features/<key>/3-architecture.md` using the output template.

See `references/template.md` for the full template.

### Cross-References

Auto-insert links:
- `> **Source**: [Tech Spec](./2-tech-spec.md)` (if exists)
- `> **Request**: [Request](./requests/YYYY-MM-DD-*.md)` (if active request found)

### Auto-Trigger

After Write completes, auto-trigger `/codex-review-doc` per `@rules/auto-loop.md`.

## Arguments

| Argument | Default | Description |
|----------|---------|-------------|
| `<feature-keyword>` | auto-detect | Target feature |
| `--skip-debate` | false | Skip Phase 3 adversarial debate |

## Verification

- [ ] Feature context resolved (create/update mode determined)
- [ ] Research completed (code + tech-spec + Codex)
- [ ] Architecture design includes all required sections
- [ ] Mermaid diagrams are valid
- [ ] Architecture decisions use AD-N format with rationale
- [ ] Cross-references to tech-spec and request docs included
- [ ] `/codex-review-doc` passed (auto-triggered)
- [ ] No `git add/commit/push` executed

## References

- `references/template.md` — Output template for `3-architecture.md`
- `references/codex-prompt.md` — Codex independent architecture research prompt
- `@skills/tech-spec/references/feature-context-resolution.md` — 5-level feature detection

## Examples

```
Input: /architecture
Action: Auto-detect feature → research (code + spec + Codex) → design → debate → write 3-architecture.md → /codex-review-doc

Input: /architecture statusline-config
Action: Resolve "statusline-config" → read tech-spec → research code → design → write → review

Input: /architecture --skip-debate
Action: Auto-detect → research → design → skip debate → write → review
```
