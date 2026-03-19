# Claim Registry

The claim registry is the backbone of research synthesis. It transforms scattered findings from multiple agents into a structured, de-duplicated, conflict-aware knowledge base. Adapted from `deep-explore/references/synthesis.md` for web + code research.

## Evidence Model

Each claim entry:

```json
{
  "claim": "Anthropic uses orchestrator-worker pattern for multi-agent research",
  "evidence": "https://www.anthropic.com/engineering/multi-agent-research-system",
  "source_type": "official_doc",
  "agent": "A",
  "confidence": "High"
}
```

## Evidence Types

| Type | Format | Example | Canonical Source |
|------|--------|---------|-----------------|
| URL | `https://...` | Web source | `domain + path` (strip query/fragment) |
| File:line | `src/foo.ts:42` | Codebase | `canonical_file_path` |
| Standard | `RFC-XXXX`, `OWASP-XX` | Industry standard | `standard_id` |

## Algorithm

### Step 1: Normalize

Each agent finding → structured entry with required fields (claim, evidence, source_type, confidence).

### Step 2: Dedup

Key = `normalized_claim_text + canonical_source`

| Evidence Type | Canonical Source |
|--------------|-----------------|
| File:line | `canonical_file_path` (same as deep-explore) |
| URL | `domain + path` (strip query params, fragments) |
| Standard | `standard_id` |

Rules:
- Same claim from different agents → merge as `[consensus]`
- Similar claims (>80% text overlap, same canonical domain) → merge, keep highest confidence

### Step 3: Consensus Detection

Claims appearing from 2+ independent agents are marked `[consensus]` — higher reliability.

### Step 4: Conflict Resolution

When agents produce contradicting claims:

| Evidence Weight | Description |
|----------------|-------------|
| High | Direct citation from official doc or file:line with code quote |
| Medium | Indirect inference from related source |
| Low | Community opinion without citation |

Higher weight wins. If tied → mark `[divergence]`.

### Step 5: Divergence

Unresolvable contradictions go to explicit divergence section with:
- Both claims and evidence
- Source agents
- Suggested resolution approach (validator check or debate)
