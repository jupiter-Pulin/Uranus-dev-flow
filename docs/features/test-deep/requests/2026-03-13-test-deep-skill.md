# Context-Aware Test Orchestration Skill (`/test-deep`)

> **Created**: 2026-03-13
> **Status**: Design
> **Priority**: P1
> **Tech Spec**: [2-tech-spec.md](../2-tech-spec.md)
> **Best Practices Audit**: Phase 4 Gap Report (conversation 2026-03-13)
> **Brainstorm threadId**: `019ce580-f0c1-75a3-96cf-92b57e837ce2`

## Background

現有 6 個測試相關 skills（`/verify`, `/post-dev-test`, `/codex-test-review`, `/codex-test-gen`, `/check-coverage`, `/precommit-fast`）各自處理測試流程的不同面向，但缺少一個能根據上下文智慧選擇測試、深度分析失敗、並導引修復的 orchestrator。

使用者範例：在 Aptos blockchain 專案中，跨 integration / e2e-mainnet / e2e-testnet 三環境執行測試，需要：
- 根據 git diff 自動選擇相關測試（不跑全部）
- 自動辨識 testnet 帳戶餘額不足 → 呼叫 faucet API 充值
- 區分 code bug vs environment issue vs flaky test
- 跨環境追蹤測試結果

## Requirements

| 需求 | 說明 |
|------|------|
| Context-aware test selection | 根據 git diff 變更檔案，mapping 到相關測試檔案 |
| Progressive confidence ladder | unit → integration → e2e 逐層執行，低層失敗即 fail-fast |
| Failure triage pipeline | Parser tags → LLM root cause → safety-gated action |
| Fixer catalog | Plugin 提供 generic capabilities，host project 擴展 domain-specific |
| Safety-tiered auto-fix | Safe=auto-run, Side-effect=confirmation, Destructive=blocked |
| Session artifacts | Per-run 結果快取，optional 上次比較 |
| Orchestrator pattern | 組合調用現有 skills，不取代 |

## Scope

| Scope | Description |
|-------|-------------|
| In | Test selection（git diff mapping + framework fallback + full suite safety net）、failure triage pipeline（parser + LLM + safety gate）、fixer catalog 框架（generic core）、session artifacts、progressive ladder |
| Out | Cross-session learning（v2）、framework-specific plugins（host project 責任）、test generation（use `/codex-test-gen`）、coverage review（use `/codex-test-review`） |

## Related Files

| File | Action | Description |
|------|--------|-------------|
| `skills/test-deep/SKILL.md` | New | Skill 定義（trigger, workflow, references） |
| `skills/test-deep/references/fixer-catalog.md` | New | Fixer catalog 規格 + safety tiers |
| `skills/test-deep/references/triage-pipeline.md` | New | Parser tags + LLM triage 規格 |
| `skills/test-deep/references/test-selection.md` | New | Git diff → test file mapping 策略 |
| `commands/test-deep.md` | New | Command entry point + `allowed-tools` |
| `test/commands/test-deep.test.js` | New | Command schema 測試 |
| `CLAUDE.template.md` | Modify | Command Quick Reference 加入 `/test-deep` |
| `CLAUDE.md` | Modify | Command Quick Reference 加入 `/test-deep` |
| `.claude/CLAUDE.md` | Modify | Command Quick Reference 加入 `/test-deep` |

## Acceptance Criteria

### AC1: Test Selection

- [ ] 根據 `git diff --name-only` 輸出，正確 mapping 到 candidate test files
- [ ] 支援多種命名慣例（`src/foo.ts` → `test/foo.test.ts`, `test/unit/foo.test.ts`, `test/integration/foo.test.ts`）
- [ ] 無 mapping 時 fallback 到 framework `--changedSince` 或 full suite
- [ ] 變更 config/infra 檔案時，escalate 到 full suite

### AC2: Progressive Ladder

- [ ] 按 unit → integration → e2e 順序執行
- [ ] 低層 failure 時 fail-fast，不繼續高層
- [ ] 各層結果獨立記錄

### AC3: Failure Triage

- [ ] Parser 正確從 test output 提取 structured tags（exit code, error signatures, failing tests, env hints）
- [ ] LLM 根據 tags + compressed output 產生 root cause classification（code_bug / infra / environment / flaky）
- [ ] Classification 附帶 reasoning explanation

### AC4: Fixer Catalog

- [ ] Core plugin 提供 generic fixers（restart dev server, clear cache, reinstall deps）
- [ ] Host project 可擴展 domain-specific fixers（faucet funding, DB migration）
- [ ] Safety tier 正確 gate：Safe=auto, Side-effect=confirm, Destructive=block
- [ ] Unknown fixers default to confirmation required（default-deny）

### AC5: Session Artifacts

- [ ] Run metadata 寫入 `.claude/cache/test-deep/<runId>/`
- [ ] 支援 optional previous-run comparison
- [ ] 無跨 session learning

### AC6: Orchestrator Integration

- [ ] 使用 dedicated test-deep executor 執行測試（reuse verify-runner 的 cache/log pattern，但自建 multi-target + fail-fast 邏輯）
- [ ] 不與 `/post-dev-test`, `/codex-test-review` 功能重疊

## Design Decisions（from Brainstorm）

| 決策 | 選擇 | 替代方案 | 理由 |
|------|------|----------|------|
| Triage method | Parser → LLM → Safety gate | Rule-based engine | LLM 可解釋推理，parser 只結構化不做決策 |
| Auto-fix model | Fixer catalog（LLM 選擇） | Pattern registry | Dependency inversion — plugin 提供 capabilities，不 hardcode vendor error strings |
| State scope | Session artifacts only | Cross-session learning | Plugin 應 stateless，cache 是特殊例外 |
| Scope boundary | Independent orchestrator | Merge into `/verify` | 最大化現有投資，最小化 scope creep |
| Test selection | git diff mapping first | Framework-native only | Filename matching 對所有 framework 通用 |

## Progress

- [x] Best practices audit（Phase 1-4）
- [x] Adversarial brainstorm（3 rounds, equilibrium reached）
- [x] Tech spec
- [ ] Implementation
- [ ] Testing
- [ ] Documentation
