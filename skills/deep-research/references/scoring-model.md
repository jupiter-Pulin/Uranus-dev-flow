# Completeness Scoring Model

## 4-Signal Model

The scoring model measures how thoroughly the research covered the topic. Different modes weight signals differently because their goals differ — exploratory research values breadth, compliance values verification, decisions value conflict resolution.

| Signal | Exploratory | Compliance | Decision | Measurement |
|--------|------------|------------|----------|-------------|
| Source diversity | 30% | 20% | 25% | `covered_source_types / 3` |
| Cross-verification | 30% | 35% | 35% | `verified_claims / critical_claims` |
| Gap coverage | 25% | 25% | 20% | `1 - (gaps / expected_dimensions)` |
| Question closure | 15% | 20% | 20% | `answered_questions / total_questions` |

## Score Calculation

```
raw_score = sum(signal_value × weight) × 100
final_score = raw_score × confidence_cap
```

## Confidence Cap

Confidence degrades when research infrastructure is incomplete — the score can't be trusted as much if some agents failed or tools were unavailable.

| Condition | Cap | Reason |
|-----------|-----|--------|
| All agents successful + web tools available | 1.0 | Full evidence |
| 1 agent failed or no web tools | 0.9 | Partial coverage gap |
| 2+ agents failed or code-only research | 0.75 | Significant degradation |

**Edge case clarification**: "web tools available" means at least one tool in the web cascade (Priority 1-3: agent-browser, WebSearch, or WebFetch) succeeded for at least one web-focused agent. If agent-browser is unavailable but WebSearch or WebFetch works, cap remains 1.0. If all web tools are unavailable (cascade exhausted at Priority 4) but code agents succeed, cap is 0.9 (partial coverage gap in source diversity).

## Phase 3 Trigger Thresholds

| Score Range | Condition | Gate |
|-------------|-----------|------|
| >= 80 | No P0/P1 conflict, cross-verification >= 50% | Skip debate → output report |
| >= 60 | Minor conflicts only | Validator micro-loop → output |
| < 60 | OR any P0/P1 conflict | Full debate via `/codex-brainstorm` |

## Auto-Trigger Conditions

Debate triggers regardless of score when ANY condition is met:

1. **Unresolved P0/P1 conflict** — critical claim has two contradicting high-evidence sources
2. **Low cross-verification** — < 50% (exploratory) or < 70% (decision) of critical claims verified
3. **High blast-radius** — recommendation involves irreversible cost, security impact, or architecture change
4. **Compliance mode** — always forces debate (auto behaves as force)
