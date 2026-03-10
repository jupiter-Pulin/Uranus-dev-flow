# seek-verdict: Dismiss-with-Evidence Verification Skill

> **Created**: 2026-03-09
> **Status**: Completed
> **Priority**: P1
> **Tech Spec**: [2-tech-spec.md](../2-tech-spec.md)

## Background

Claude Code 在 review loop 中判斷 P2 finding 為 false positive 時，缺乏輕量的獨立驗證機制。目前只能手動呼叫 `/codex-brainstorm`（過重）或直接 `⚠️ Need Human`（過嚴）。需要一個 optional 的 blind verification skill 填補這個空缺。

## Requirements

- 建立 `/seek-verdict` skill，採用 3-phase blind verification protocol（Candidate Packaging → Blind Independent Verdict → Policy Mapping）
- Codex 使用 fresh thread 獨立研究，不接收 Claude 的結論（遵循 `codex-invocation.md`）
- 支援 P2 findings 的 dismiss 驗證（P0/P1 不可 dismiss，Nit 保留 `[NIT_DEFERRED]`）
- 產出 `[DISMISS_VERDICT]` 結構化 audit trail
- 內建 anti-abuse guard（3 連續 dismiss 觸發 warning + 提高門檻）
- Optional invocation — 不強制整合 auto-loop
- 支援 1 輪 rebuttal mechanism

## Scope

| Scope | Description |
|-------|-------------|
| In | SKILL.md + references + command + fix-all-issues exception + review-common format update + tests |
| Out | Auto-loop mandatory integration（v2 考慮）、dismiss accuracy feedback loop（P3）、hook parser 修改 |

## Related Files

| File | Action | Description |
|------|--------|-------------|
| `skills/seek-verdict/SKILL.md` | New | 主要 skill 指引 |
| `skills/seek-verdict/references/verdict-prompt.md` | New | Codex blind verification prompt template |
| `skills/seek-verdict/references/policy-mapping.md` | New | Confidence threshold → verdict mapping + output format |
| `commands/seek-verdict.md` | New | Command 入口 |
| `rules/fix-all-issues.md` | Modify | 新增 "P2 dismiss verified via /seek-verdict" exception |
| `skills/codex-code-review/references/review-common.md` | Modify | 新增 `[DISMISS_VERDICT]` 格式定義 |
| `test/commands/seek-verdict.test.js` | New | 13 test cases（T1-T13） |
| `rules/auto-loop.md` | Reference | v1 不修改，但 insertion point 依賴此檔（見 tech spec） |

## Acceptance Criteria

- [x] `skills/seek-verdict/SKILL.md` 建立，含 3-phase protocol 描述
- [x] `skills/seek-verdict/references/verdict-prompt.md` 包含 blind verification prompt（含 independent research block）
- [x] `skills/seek-verdict/references/policy-mapping.md` 定義 asymmetric thresholds（dismiss ≥ 0.80, fix ≥ 0.70）
- [x] `commands/seek-verdict.md` 建立，支援 `<finding-key>` 位置參數和 `--thread` 參數
- [x] Prompt template 不含 Claude 結論（anti-anchoring enforcement）
- [x] `[DISMISS_VERDICT]` audit trail 格式含 redaction rules
- [x] Anti-abuse guard 實作（streak ≥ 3 → warning；warning 狀態：confidence ≥ 0.85 + evidence refs ≥ 3）
- [x] Rebuttal mechanism 限制 1 輪
- [x] `fix-all-issues.md` 新增 verified dismiss exception
- [x] `review-common.md` 新增 `[DISMISS_VERDICT]` 格式
- [x] 13 test cases 全部通過（T1-T13，含 threshold boundary + anti-abuse）
- [x] Pass `/codex-review-fast`
- [x] Pass `/precommit-fast`

## Progress

| Phase | Status | Note |
|-------|--------|------|
| Analysis | Done | Best practices audit + adversarial debate (threadId: 019cd149-6fce-7e12-8cb6-2db73637a106) |
| Development | Done | `36e13a3` feat: Adds seek-verdict skill for P2 blind verification |
| Testing | Done | 13 tests passed (T1-T13) |
| Acceptance | Done | All AC checked, shipped in v1.8.17 |

## References

- Tech Spec: [2-tech-spec.md](../2-tech-spec.md)
- Best Practices Audit: Debate threadId `019cd149-6fce-7e12-8cb6-2db73637a106` (3 rounds → Nash Equilibrium)
- Industry Sources: [Qodo multi-agent review](https://www.qodo.ai/blog/single-agent-vs-multi-agent-code-review/), [arXiv adversarial debate](https://arxiv.org/html/2410.04663v1), [Graphite false positive management](https://graphite.com/guides/ai-code-review-false-positives)
