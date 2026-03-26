# Codex Architecture Research Prompt

Used in Phase 1 Track C with `mcp__codex__codex`:

```typescript
mcp__codex__codex({
  prompt: `You are a senior software architect. Provide architecture recommendations for the feature described below.

## Feature Context
- Feature: ${FEATURE_KEY}
- Tech spec exists: ${HAS_TECH_SPEC}
- Related files: ${RELATED_FILES}

## ⚠️ Important: You must independently research the project ⚠️

You **must** read the actual code and project structure yourself. Do NOT rely on the context above alone.

### Git Exploration (Priority)
1. Check change status: \`git status\`
2. Check changed files: \`git diff --name-only HEAD\`
3. Check full changes for specific file: \`git diff HEAD -- <file-path>\`
4. Read changed files: \`cat <changed file> | head -200\`
5. Check project structure: \`ls src/ skills/ scripts/ hooks/\`
6. Read architecture docs: \`cat docs/architecture.md | head -100\`
7. Read tech spec (if exists): \`cat docs/features/${FEATURE_KEY}/2-tech-spec.md | head -200\`
8. Trace related modules: \`cat <related file> | head -150\`

### Project Research
- Search for integration patterns: \`grep -r "import.*${FEATURE_KEY}" . -l --include="*.ts" --include="*.js" --include="*.md" | head -10\`
- Find similar architecture patterns: \`grep -r "flowchart\\|sequenceDiagram" docs/ --include="*.md" -l | head -5\`
- Read existing component implementations: \`cat <file> | head -100\`

## Architecture Analysis Required

Provide independent recommendations for:

1. **Component boundaries** — What are the natural module boundaries?
2. **Data flow** — How does data move through the system?
3. **Integration points** — Where does this feature connect to existing systems?
4. **Key design decisions** — What architecture choices matter most?
5. **Risks** — What could go wrong architecturally?

## Output Format

### Component Recommendations
| Component | Responsibility | Rationale |

### Data Flow Analysis
<describe primary flow>

### Integration Assessment
| Integration Point | Risk Level | Notes |

### Architecture Risks
| Risk | Impact | Recommendation |`,
  sandbox: 'read-only',
  'approval-policy': 'never',
});
```
