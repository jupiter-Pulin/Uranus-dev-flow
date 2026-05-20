# Tech Spec Template

```markdown
# [Feature Name] Technical Spec

## 1. Requirement Summary

- Problem:
- Goals:
- Scope:

## 2. Existing Code Analysis

- Related modules:
- Reusable components:
- Files requiring changes:

## 3. Technical Solution

### 3.1 Architecture Design (Mermaid)

### 3.2 Data Model

### 3.3 API Design

### 3.4 Core Logic

### 3.5 UI/UX Contract (omit when feature has no user-facing surface)

Sub-tables to fill (skip irrelevant ones, mark "N/A"):

- Field naming & units (API response → frontend type / example / handling)
- Status → user-visible mapping (backend status → user-visible state → button behavior)
- Empty / boundary states (scenario → response → frontend behavior)
- Error message contract (error code → toast / inline / dialog)

## 4. Risks and Dependencies

## 5. Work Breakdown

## 6. Testing Strategy

## 7. Open Questions
```

## Review Report Template

```markdown
# Tech Spec Review Report

## Review Summary

| Dimension | Score | Notes |
| --------- | ----- | ----- |

## Overall Assessment

Pass / Needs Revision / Needs Redesign

## Issues and Recommendations

### Blocker (Must Fix)

### Improvement (Suggested)

### Nice to Have (Optional)
```

## Architecture Layers

| Layer      | Responsibility              | Pattern            |
| ---------- | --------------------------- | ------------------ |
| Controller | API endpoints (thin layer)  | `*.controller.ts`  |
| Service    | Business logic (core)       | `*.service.ts`     |
| Provider   | External service wrappers   | `provider/**/*.ts` |
| Entity     | MongoDB models              | `entity/*.ts`      |

## Design Checklist

- [ ] Reusing existing Service/Provider?
- [ ] Following DI patterns?
- [ ] Unified error handling?
- [ ] Performance considered (cache, batching)?
- [ ] Testing strategy complete?

## Review Dimensions

| Dimension          | Check Items                                | Weight |
| ------------------ | ------------------------------------------ | ------ |
| Completeness       | Requirement coverage, edge cases, error handling | High   |
| Feasibility        | Technically feasible, timeline reasonable, dependencies clear | High   |
| **Concision**      | Content lines ≤ 600 (HTML total minus `<style>` and `<script>` blocks); top-level `<h2>` ≤ 7; `<h3>` inside `§3` ≤ 5; each `§3.x` Core Logic `<ol>` step ≤ 10 lines. No made-up pseudocode (use `file:line` refs); no version churn / ops commands in body (belongs in git log / ops runbook). | **High** |
| Risk Assessment    | Risks identified, mitigation strategies    | Medium |
| Code Consistency   | Consistent with existing architecture      | Medium |
| Testing Strategy   | Test plan complete                         | Medium |

### Concision Anti-Patterns (auto-flag as P1)

| Anti-pattern | Example | Fix |
|--------------|---------|-----|
| **Full function body in spec** | 80-line `insertNativeSnapshots()` TypeScript | Replace with `<ol>` of 5-7 business steps + `file:line` ref |
| **Ops command in spec** | `db.EarnConfigs.updateOne(...)` mongo shell block | Move to ops runbook, link from spec |
| **Version churn in body** | `<blockquote>v4 vs v3: 砍掉 ledger…</blockquote>` | Move to git log / CHANGELOG; spec describes current state only |
| **Appendix section (§8+)** | "8. 附录" with formulas / Phase 0 artifacts | Move formulas to `0-feasibility-study/`; spec stays at 7 sections |
| **Implementation diary tone** | "实施前请勿按本 spec 直接做代码审查（v4 spec vs v2 code 噪声）" | Spec must reflect the agreed design, not be a draft running ahead of code |
