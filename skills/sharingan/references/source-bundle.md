# SourceBundle — Normalized Intermediate Format

## Purpose

SourceBundle is the v2 canonical intermediate representation (IR). All source strategies normalize their output to this format before entering the Analyze → Generate → Validate pipeline. Functionally analogous to a compiler IR — decouples ingestion from synthesis.

## Schema

```javascript
const SourceBundle = {
  source: {
    type: 'github_repo|external_evidence|local_code_context',
    origin: 'string',           // URL, description, or path
    confidence: 'high|medium|low',
    fetched_at: 'string',       // ISO 8601
  },
  knowledge: {
    intent: 'string',           // 1-sentence: what this pattern/skill does
    patterns: [{
      name: 'string',           // e.g., "retry-with-backoff"
      description: 'string',
      workflow: 'string|null',  // Workflow steps (if extractable)
      code_examples: ['string'],
      source_ref: 'string',    // Provenance
    }],
    conventions: [{
      name: 'string',           // e.g., "error-classification"
      rule: 'string',
    }],
    tools_mentioned: ['string'],
  },
  repo_analysis: 'SourceAnalysis|null',  // v1 SourceAnalysis (github_repo only)
  synthesis_hints: {
    suggested_skill_name: 'string|null',
    suggested_triggers: ['string'],
    suggested_exclusions: ['string'],
    untranslatable: [{
      element: 'string',
      reason: 'string',
      suggestion: 'string',
    }],
  },
};
```

## Field Reference

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `source.type` | string | Yes | `github_repo` / `external_evidence` / `local_code_context` |
| `source.origin` | string | Yes | URL, description text, or local path |
| `source.confidence` | string | Yes | `high` / `medium` / `low` |
| `source.fetched_at` | string | Yes | ISO 8601 timestamp |
| `knowledge.intent` | string | Yes | 1-sentence summary of what the pattern/skill does |
| `knowledge.patterns[]` | array | Yes | Extracted patterns (min 1) |
| `knowledge.conventions[]` | array | No | Naming conventions, style rules |
| `knowledge.tools_mentioned[]` | array | No | Libraries/tools referenced |
| `repo_analysis` | object/null | Conditional | v1 SourceAnalysis — populated only for `github_repo`, null otherwise |
| `synthesis_hints.suggested_skill_name` | string/null | No | Auto-detected skill name |
| `synthesis_hints.suggested_triggers[]` | array | No | Trigger keywords |
| `synthesis_hints.suggested_exclusions[]` | array | No | When-NOT scenarios |
| `synthesis_hints.untranslatable[]` | array | No | Elements requiring manual handling |

## Normalization Rules

### Strategy 1: github_repo

Produced by `toSourceBundle(analysis)` in `scan-repo.js` (R2 implementation; not yet exported in v1).

| SourceAnalysis Field | SourceBundle Field |
|---------------------|-------------------|
| `repo.url` | `source.origin` |
| (deterministic) | `source.confidence = 'high'` |
| `skills[].name` | `knowledge.patterns[].name` |
| `skills[].frontmatter.description` | `knowledge.patterns[].description` |
| `skills[].body_sections` | `knowledge.patterns[].workflow` (joined) |
| `skills[].dependencies.tools` | `knowledge.tools_mentioned` (deduplicated) |
| Full `analysis` object | `repo_analysis` (preserved for backward compat) |
| `untranslatable[]` | `synthesis_hints.untranslatable[]` |

```json
{
  "source": {
    "type": "github_repo",
    "origin": "https://github.com/example/my-plugin",
    "confidence": "high",
    "fetched_at": "2026-04-02T10:00:00Z"
  },
  "knowledge": {
    "intent": "Replicate my-plugin as sd0x-dev-flow skill",
    "patterns": [{
      "name": "error-handler",
      "description": "Centralized error handling with retry and circuit breaker.",
      "workflow": "Trigger → Classify Error → Route → Retry/Break → Log",
      "code_examples": [],
      "source_ref": "skills/error-handler/SKILL.md"
    }],
    "conventions": [],
    "tools_mentioned": ["Read", "Grep", "Bash(node:*)"]
  },
  "repo_analysis": { "version": 1, "repo": { "...": "full v1 SourceAnalysis" } },
  "synthesis_hints": {
    "suggested_skill_name": "error-handler",
    "suggested_triggers": [],
    "suggested_exclusions": [],
    "untranslatable": []
  }
}
```

### Strategy 2: external_evidence

Produced from `/deep-research` output extraction.

| Research Output Field | SourceBundle Field |
|----------------------|-------------------|
| Topic URL / description | `source.origin` |
| Research confidence | `source.confidence` (mapped from source reliability) |
| Extracted patterns | `knowledge.patterns[]` |
| Best practices / conventions | `knowledge.conventions[]` |
| Libraries mentioned | `knowledge.tools_mentioned[]` |
| (always null) | `repo_analysis = null` |

```json
{
  "source": {
    "type": "external_evidence",
    "origin": "https://dev.to/article-about-retry-patterns",
    "confidence": "medium",
    "fetched_at": "2026-04-02T10:05:00Z"
  },
  "knowledge": {
    "intent": "Retry with exponential backoff pattern for resilient API calls",
    "patterns": [{
      "name": "retry-with-backoff",
      "description": "Retry failed operations with exponential delay and jitter.",
      "workflow": "Attempt → Fail → Wait (2^n + jitter) → Retry → Max retries → Circuit break",
      "code_examples": ["const delay = Math.min(baseDelay * 2 ** attempt + jitter, maxDelay);"],
      "source_ref": "https://dev.to/article-about-retry-patterns"
    }],
    "conventions": [
      { "name": "max-retries", "rule": "Default 3 retries, configurable per operation" }
    ],
    "tools_mentioned": ["fetch", "setTimeout"]
  },
  "repo_analysis": null,
  "synthesis_hints": {
    "suggested_skill_name": "retry-with-backoff",
    "suggested_triggers": ["retry", "backoff", "resilient"],
    "suggested_exclusions": ["simple one-shot requests"],
    "untranslatable": []
  }
}
```

### Strategy 3: local_code_context

Produced from Read/Grep analysis of local files.

| Code Analysis Output | SourceBundle Field |
|---------------------|-------------------|
| File path(s) | `source.origin` |
| (deterministic local read) | `source.confidence = 'high'` |
| Extracted functions/patterns | `knowledge.patterns[]` |
| Detected conventions | `knowledge.conventions[]` |
| Import/require references | `knowledge.tools_mentioned[]` |
| (always null) | `repo_analysis = null` |

```json
{
  "source": {
    "type": "local_code_context",
    "origin": "src/middleware/error-handler.ts",
    "confidence": "high",
    "fetched_at": "2026-04-02T10:10:00Z"
  },
  "knowledge": {
    "intent": "Error classification middleware with severity-based routing",
    "patterns": [{
      "name": "error-classifier",
      "description": "Classify errors by type and route to appropriate handler.",
      "workflow": "Catch → Classify (network/validation/auth/unknown) → Route → Respond",
      "code_examples": ["function classifyError(err) { if (err.code === 'ECONNREFUSED') return 'network'; }"],
      "source_ref": "src/middleware/error-handler.ts:15-42"
    }],
    "conventions": [
      { "name": "error-response-format", "rule": "Always return { error: { code, message, details } }" }
    ],
    "tools_mentioned": ["express", "winston"]
  },
  "repo_analysis": null,
  "synthesis_hints": {
    "suggested_skill_name": "error-classifier",
    "suggested_triggers": ["error handling", "classify error"],
    "suggested_exclusions": ["simple try-catch without classification"],
    "untranslatable": [
      { "element": "express", "reason": "Framework-specific middleware signature", "suggestion": "Adapt to target framework" }
    ]
  }
}
```

## Confidence Mapping

Two confidence concepts exist — they serve different purposes:

| Concept | Threshold | Purpose | Defined In |
|---------|-----------|---------|------------|
| **Routing threshold** | >= 0.7 | Proceed to adapter vs ask user | `input-classification.md` |
| **Enum mapping** | See table below | Stored in SourceBundle for downstream use | This file |

The routing threshold determines flow control (Phase 0B). The enum mapping determines the stored confidence level in the SourceBundle:

| Numeric Range | SourceBundle Enum | Description |
|--------------|-------------------|-------------|
| >= 0.8 | `high` | Strong signal |
| 0.5 - 0.79 | `medium` | Moderate signal (includes values that passed the 0.7 routing threshold) |
| < 0.5 | `low` | Weak signal |

`github_repo` strategy always uses `high` (deterministic regex match).

## Validation Rules

| Rule | Description |
|------|-------------|
| `source.type` must be one of 3 values | Reject unknown strategy types |
| `knowledge.intent` non-empty | Every SourceBundle must have an intent |
| `knowledge.patterns.length >= 1` | At least one pattern required |
| `repo_analysis` only for `github_repo` | Must be null for other strategies |
| `source.fetched_at` valid ISO 8601 | Timestamp must be parseable |
