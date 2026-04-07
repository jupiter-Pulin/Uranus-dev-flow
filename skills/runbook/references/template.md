# Runbook Template

## Output Template

```markdown
<!-- runbook-provenance
sections:
  - name: "Release Summary"
    sources:
      - file: "{tech_spec_path}"
        sha: "{sha}"
      - file: "{request_path}"
        sha: "{sha}"
  - name: "SRE Quick Reference"
    sources: []
    note: "{Not defined in repo | source details}"
  - name: "Scope / Blast Radius"
    sources:
      - file: "{architecture_path}"
        sha: "{sha}"
      - file: "{request_path}"
        sha: "{sha}"
  - name: "Preconditions Checklist"
    sources:
      - file: "{request_path}"
        sha: "{sha}"
  - name: "Deployment Procedure"
    sources:
      - file: "{workflow_path}"
        sha: "{sha}"
  - name: "Verification / Smoke Tests"
    sources:
      - file: "{tech_spec_path}"
        sha: "{sha}"
  - name: "Monitoring Signals"
    sources: []
    note: "{Not defined in repo | source details}"
  - name: "Rollback Plan"
    sources:
      - file: "{architecture_path}"
        sha: "{sha}"
  - name: "Open Risks / Human Checks"
    sources:
      - file: "{tech_spec_path}"
        sha: "{sha}"
last_generated: "{ISO 8601 timestamp}"
-->

# {Feature Name} Release Runbook

> Generated from: {source doc paths}
> Last updated: {YYYY-MM-DD}

## 1. Release Summary

| Field | Value |
|-------|-------|
| Feature | {feature key} |
| Version | {target version or TBD} |
| Request | [{request title}]({relative request path}) |
| Owner | {from git log author or TBD} |
| Status | Draft |

{1-2 sentence description from tech-spec §1}

## 2. SRE Quick Reference

| Signal | Threshold | Rollback Action | Escalation |
|--------|-----------|-----------------|------------|
| {metric/alert or "Not defined in repo"} | {condition} | {action — see §8 for details} | {contact or TBD} |

> Under pressure: For full rollback procedure, see §8.

## 3. Scope / Blast Radius

| Component | Impact | Confidence |
|-----------|--------|------------|
| {from architecture §4 or request scope} | {description} | {High/Medium/Low} |

**In scope**: {from request scope table}
**Out of scope**: {from request scope table}

## 4. Preconditions Checklist

- [ ] Code review passed (`/codex-review-fast`)
- [ ] Precommit passed (`/precommit`)
- [ ] Tests adequate (`/codex-test-review`)
- [ ] Version bumped (`/bump-version`) — if applicable
- [ ] {Feature flag configured — if applicable}
- [ ] {Database migration prepared — if applicable}
- [ ] {Dependent service notified — if applicable}

## 5. Deployment Procedure

> CI triggers: `ci.yml` runs on `pull_request` to `main` and `push` to `main`.
> Feature branch push alone does **not** trigger CI.

| Step | Owner | Action | Evidence | Abort Trigger |
|------|-------|--------|----------|---------------|
| 1 | Dev | `/merge-prep` — pre-merge analysis | No conflicts | Unresolvable conflict |
| 2 | Dev | Push feature branch | Branch visible on remote | Push rejected |
| 3 | Dev | `/create-pr` — create PR targeting main | PR URL | — |
| 4 | Dev | `/watch-ci` — monitor PR CI checks | CI pass | CI failure |
| 5 | Dev | PR review + merge to main | Merge commit | Review rejection |
| 6* | Dev | `/watch-ci` — post-merge CI | CI pass | CI failure → rollback |
| 7* | Dev | Verify release (conditional on `/bump-version`) | GitHub Release | Workflow failure |
| {N} | {role} | {feature-specific step} | {evidence} | {abort condition} |

> *Steps 6-7 conditional. Step 7 only when `release.yml` triggers (requires `package.json` changes on `main`).

## 6. Verification / Smoke Tests

| Test | Command / Steps | Expected Result |
|------|----------------|-----------------|
| {from tech-spec §6 or "TBD"} | {concrete command} | {expected output} |

## 7. Monitoring Signals

| Signal Type | Name | Location | Alert Threshold |
|-------------|------|----------|-----------------|
| {metric/log/flag or "Not defined in repo"} | {name} | {file:line or dashboard URL} | {threshold} |

> Items marked "Not defined in repo" require monitoring setup before release.

## 8. Rollback Plan

**Trigger conditions**: {from SRE Quick Reference §2}

| Step | Action | Verification |
|------|--------|-------------|
| 1 | {revert/rollback action or "TBD"} | {how to verify success} |

**Data considerations**: {migration/state concerns from architecture AD-N, or "None identified"}

## 9. Open Risks / Human Checks

| Risk | Source | Mitigation | Owner |
|------|--------|-----------|-------|
| {from tech-spec §7 or "No open risks identified"} | {doc reference} | {mitigation or "Needs decision"} | {owner or TBD} |
```

## Template Rules

| Rule | Description |
|------|-------------|
| Provenance required | Every generated runbook must include `<!-- runbook-provenance -->` HTML comment |
| SHA tracking | Use `git hash-object <file>` for each source file SHA |
| Multi-source | Each section can have multiple sources (array format) |
| Empty sources | Use `sources: []` with `note:` for sections with no available data |
| Fallback text | Use "Not defined in repo", "TBD", or "None identified" — never invent content |
| Redaction | Never copy secrets, tokens, internal URLs — use placeholders per SKILL.md redaction rules |

## File Location

```
docs/features/{feature}/runbook-release.md
```

Naming follows `doc-taxonomy.json` ancillary semantic pattern: `^runbook-`.
