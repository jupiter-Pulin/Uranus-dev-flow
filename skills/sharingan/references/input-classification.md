# Input Classification — LLM Classifier Reference

## Purpose

Phase 0B classifier for non-GitHub inputs. When `GITHUB_URL_RE` does not match (Phase 0A miss), this LLM classifier determines the source strategy and confidence level.

## Classification Flow

```
Input → Phase 0A: GITHUB_URL_RE test
         │
         ├─ Match → github_repo (skip classifier)
         │
         └─ Miss → Phase 0B: LLM Semantic Classifier
                    │
                    ├─ confidence >= 0.7 → proceed to strategy adapter
                    │
                    └─ confidence < 0.7 → AskUserQuestion (1 clarifying question)
                                           │
                                           ├─ Re-classify with augmented input
                                           │
                                           └─ Still < 0.7 → default external_evidence + warn
```

## Prompt Template

```markdown
You are an input classifier for the Sharingan skill. Classify the user's input into one of two non-GitHub source strategies. (GitHub URLs are handled by Phase 0A regex and never reach this classifier.)

## Strategies

1. **external_evidence** — The input refers to external knowledge: a non-GitHub URL, an article, a paper, a blog post, a concept description, or an abstract pattern idea.
2. **local_code_context** — The input refers to local code: a file path, a directory, a module name in the current project, or uses words like "our code", "this project", "my module".

## Rules

- If the input contains a non-GitHub HTTPS URL → `external_evidence` (high confidence)
- If the input contains a relative file path or directory reference → `local_code_context` (high confidence)
- If the input describes a concept without a URL or path → `external_evidence` (lower confidence)
- If ambiguous between local and external → prefer the one with stronger lexical signals

## Output Format

Respond with exactly:
```json
{
  "strategy": "external_evidence|local_code_context",
  "confidence": <number between 0.0 and 1.0>,
  "reasoning": "<1-sentence explanation>"
}
```

## User Input

{INPUT}

```

## Confidence Threshold

| Threshold | Value | Behavior |
|-----------|-------|----------|
| High confidence | >= 0.7 | Proceed to strategy adapter directly |
| Low confidence | < 0.7 | Trigger low-confidence guard (see below) |

## Low-Confidence Guard

When classifier confidence < 0.7:

1. Generate 1 clarifying AskUserQuestion based on the ambiguity source
2. User answers → re-classify with original input + user clarification
3. If still < 0.7 after 1 retry → default to `external_evidence` with warning: "Low confidence classification. Proceeding as external evidence — results may need manual review."

Maximum 1 clarifying question per invocation. No retry loops.

## Classification Examples

| # | Input | Strategy | Confidence | Reasoning |
|---|-------|----------|------------|-----------|
| 1 | `https://github.com/owner/repo` | (Phase 0A fast-path) | 1.0 | `GITHUB_URL_RE` match — does not enter classifier |
| 2 | `https://dev.to/article-about-error-handling` | `external_evidence` | 0.9 | Non-GitHub HTTPS URL with article path |
| 3 | `src/middleware/error-handler.ts has great patterns` | `local_code_context` | 0.85 | Explicit local file path reference |
| 4 | `I read an article about retry with backoff patterns` | `external_evidence` | 0.6 | Vague reference to article, no URL → low confidence |
| 5 | `The error handling in our auth module` | `local_code_context` | 0.8 | "our" + module reference = local code context |
| 6 | `retry with exponential backoff concept` | `external_evidence` | 0.5 | Abstract concept, no URL or path → low confidence → ask |
| 7 | `https://arxiv.org/abs/2301.12345` | `external_evidence` | 0.95 | Non-GitHub HTTPS URL, academic paper |

## Strategy Descriptions

| Strategy | Detection Signals | Source Handler |
|----------|------------------|---------------|
| `github_repo` | Phase 0A: `GITHUB_URL_RE` regex match | `scan-repo.js` via `gh api` |
| `external_evidence` | Non-GitHub URL, article/paper/blog mention, abstract concept, pattern description | `/deep-research --budget low` delegation |
| `local_code_context` | Local file path, "our code", "this project", relative path, module/directory reference | Read/Grep tools |

## Integration Notes

- Phase 0A is always checked first (deterministic, zero LLM cost)
- The classifier only runs for Phase 0A misses
- `github_repo` is never a classifier output — it is handled exclusively by Phase 0A
- The prompt template above is the canonical source; SKILL.md Phase 0B references this file
