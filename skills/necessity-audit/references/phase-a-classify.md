# Phase A — Claude classifies elements

## Input

`preflight.json` (absPath, relPath, docKind, activeDimensions, depth)

## Steps

| Step | Action |
|------|--------|
| 1 | Read target file via `fs.readFileSync(absPath)` |
| 2 | Extract elements by docKind: FR/NFR lines (requirements), §3 components (tech-spec), architecture blocks (architecture), module list (implementation) |
| 3 | For each element, assign `primary_dimension` (1-6) via dominant signal from `references/dimensions.md` |
| 4 | Rubric-score on active dimensions only → Keep / Review / Cut |
| 5 | Emit `{ elements: [{id, kind, primary_dimension, claude: {classification, rationale}, evidence}] }` |

## Output schema

```json
{
  "elements": [
    {
      "id": "FR-5",
      "kind": "FR",
      "primary_dimension": 3,
      "claude": { "classification": "Review", "rationale": "..." },
      "evidence": []
    }
  ]
}
```

## Constraints

- Do NOT cite file:line from Phase A; keep Claude classification reasoning-only. Codex provides file:line in Phase B.
- Skip elements whose primary dimension is NOT in `activeDimensions`.
- Each element MUST have a stable id (FR-N / NFR-N / Component:Name).
