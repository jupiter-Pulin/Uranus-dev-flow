# Feature Completeness — R3 Interactive Modes + E2E Tests

> **Doc class**: Request ticket (date-prefixed non-lifecycle — per `@rules/docs-numbering.md`). Per-task work breakdown unit for progress tracking. **Not** a feature-level requirements doc — for that see `../1-requirements.md`.
> **Created**: 2026-04-20
> **Status**: Pending
> **Priority**: P2
> **Tech Spec**: [2-tech-spec.md](../2-tech-spec.md)
> **Depends On**: [R2 Skill Entry](./2026-04-20-feature-completeness-r2.md)
> **Requirements**: [1-requirements.md](../1-requirements.md)

## Background

完成 `feature-completeness` skill 的互動層：`--discuss` Q&A loop（bounded context，參 `/recap-ask` 模式）、`--challenge` Codex 對抗（遵循 `@rules/codex-invocation.md` 獨立研究 + NFR-9 redaction），以及三個 fixture feature 的 E2E 測試（happy / missing-spec / partial）。

## Requirements

- `fc-discussion.js` — `--discuss` Q&A loop，max_rounds=3 default（NFR-7），bounded by lifecycle docs
- `--challenge` Codex prompt — metadata only，no 餵養結論，附獨立研究指令（`@rules/codex-invocation.md`）
- NFR-9 redaction pipeline — 經 `scripts/security-redact.js`；高信心密鑰 abort，中信心 `[REDACTED]`
- 3 個 fixture feature 的 E2E 測試：(a) 完整 spec+code+test → Feature-Complete、(b) 缺 AC evidence → Partial、(c) 缺 spec → Incomplete
- `discussion-prompts.md` reference 具體化（R2 stub → R3 填入）

## Scope

| Scope | Description |
|-------|-------------|
| In  | `fc-discussion.js` + test；`--challenge` prompt + Codex invocation test；NFR-9 redaction integration test；3 個 E2E fixture feature tests；`discussion-prompts.md` 具體化 |
| Out | Core pipeline（R1）；SKILL.md / catalog / hook regression（R2）；FR-11 JSON schema（post-MVP）；FR-12 `/update-docs` 自動建議（post-MVP） |

## Related Files

| File | Action | Description |
|------|--------|-------------|
| `scripts/lib/fc-discussion.js` | New | `--discuss` loop、意圖分類、bounded 回答（複用 `/recap-ask` 模式） |
| `skills/feature-completeness/references/discussion-prompts.md` | Modify | R2 stub 填入具體 Q&A prompt + `--challenge` Codex prompt |
| `test/scripts/lib/fc-discussion.test.js` | New | max_rounds=3 default + `--max-rounds N` 邊界 |
| `test/skills/feature-completeness.challenge.test.js` | New | Codex prompt checklist 驗證（不含結論、`sandbox: read-only`） |
| `test/skills/feature-completeness.redaction.test.js` | New | NFR-9 redaction — 含 `sk-` / `ghp_` / `/Users/<name>/` fixture |
| `test/skills/feature-completeness.e2e.test.js` | New | 3 個 fixture feature：happy / missing-spec / partial |
| `test/fixtures/feature-completeness/happy/` | New | 完整 spec + code + test fixture |
| `test/fixtures/feature-completeness/missing-spec/` | New | 僅有 code，無 1-requirements/2-tech-spec fixture |
| `test/fixtures/feature-completeness/partial/` | New | spec + code 存在，測試缺口 fixture |

## Acceptance Criteria

- [ ] `--discuss` Q&A 至少觸發一輪 AskUserQuestion；user 回答能影響最終 verdict（S-3）
- [ ] `--challenge` prompt 通過 `@rules/codex-invocation.md` enforcement checklist（無 spec 全文、無 Claude 結論、含獨立研究指令、`sandbox: read-only` / `approval-policy: never`）
- [ ] NFR-9 redaction — 對含 `sk-` / `ghp_` / `-----BEGIN` / `/Users/<name>/` / `/home/<name>/` 的 fixture output 經 redaction 後 grep 零命中（S-11；涵蓋 macOS 與 Linux 家目錄前綴）
- [ ] 3 個 E2E fixture：happy → `✅ Feature-Complete`、missing-spec → `⛔ Incomplete`、partial → `⚠️ Partial`（§3.4.4 mapping）
- [ ] max_rounds default=3；`--max-rounds N`（1 ≤ N ≤ 10）邊界驗證通過（NFR-7）
- [ ] `discussion-prompts.md` 具體化後通過 `/codex-review-doc`
- [ ] Pass /codex-review-fast
- [ ] Pass /codex-test-review

## Progress

| Phase | Status | Note |
|-------|--------|------|
| Analysis | Done | 模式沿用 `/recap-ask`（Phase 2 意圖分類）+ `@rules/codex-invocation.md` |
| Development | - | Blocked by R2 |
| Testing | - | |
| Acceptance | - | |

## References

- Tech Spec: [../2-tech-spec.md](../2-tech-spec.md) §3.4.6, §4 R5, §5 T7/T8/T10, §6 Testing Strategy
- Requirements: [../1-requirements.md](../1-requirements.md) FR-5/10, NFR-7/9, §S-3/S-11
- Pattern reference: `skills/recap-ask/SKILL.md` Phase 2 意圖分類
- Sibling: [R1 Core pipeline](./2026-04-20-feature-completeness-r1.md) · [R2 Skill entry](./2026-04-20-feature-completeness-r2.md)
