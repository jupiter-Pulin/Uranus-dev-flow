# sd0x-dev-flow

![sd0x-dev-flow banner](https://raw.githubusercontent.com/sd0xdev/sd0x-dev-flow/main/banner.jpg)

**언어**: [English](README.md) | [繁體中文](README.zh-TW.md) | [简体中文](README.zh-CN.md) | [日本語](README.ja.md) | 한국어 | [Español](README.es.md)

> AI는 빠르게 코드를 작성할 수 있습니다. 하지만 가드레일 없이는, 그 속도가 두렵습니다.

**AI가 건너뛸 수 없는 품질 게이트.** Hook 강제 듀얼 리뷰, 자동 수정 루프, fail-closed 시맨틱을 갖춘 [Claude Code](https://claude.com/claude-code) 플러그인 — 코드를 빠르게, 그리고 올바르게 출시합니다.

87 skills · 15 agents — Claude context window의 ~4%만 사용

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE) [![npm](https://img.shields.io/badge/npx-skills%20add-blue)](https://www.npmjs.com/package/skills)

## 왜 sd0x-dev-flow인가?

| 가드레일 없을 때 | sd0x-dev-flow 사용 시 |
|---|---|
| 컨텍스트가 길면 AI가 리뷰를 건너뜀 | **Hook 강제**: stop-guard가 미완료 리뷰를 차단 |
| 단일 리뷰어가 문제를 놓침 | **듀얼 디스패치**: Codex + 보조 리뷰어 병렬 실행 |
| "수정 완료"인데 재검증 없음 | **Auto-loop**: 수정 → 재리뷰 → 통과 → 계속 |
| compact 후 리뷰 상태 소실 | **상태 추적**: SessionStart hook이 재주입 |

## 빠른 시작

```bash
# 플러그인 설치
/plugin marketplace add sd0xdev/sd0x-dev-flow
/plugin install sd0x-dev-flow@sd0xdev-marketplace

# 프로젝트 설정
/project-setup
```

하나의 명령어로 프레임워크, 패키지 매니저, 데이터베이스, 엔트리포인트, 스크립트를 자동 감지합니다. Rules와 Hooks의 서브셋을 설치합니다. 전체 플러그인에는 14개 Rules + 9개 Hooks가 포함됩니다.

`--lite`로 CLAUDE.md만 설정 (Rules/Hooks 스킵).

## 작동 원리

```mermaid
flowchart LR
    P["🎯 Plan"] --> B["🔨 Build"]
    B --> G["🛡️ Gate"]
    G --> S["🚀 Ship"]

    P -.- P1["/codex-brainstorm<br/>/feasibility-study<br/>/tech-spec"]
    B -.- B1["/feature-dev<br/>/bug-fix<br/>/codex-implement"]
    G -.- G1["/codex-review-fast<br/>/precommit<br/>/codex-test-review"]
    S -.- S1["/smart-commit<br/>/push-ci<br/>/create-pr<br/>/pr-review"]
```

**Auto-Loop 엔진**이 품질 Gate를 자동으로 적용합니다. 코드 편집 후 리뷰 명령어가 **듀얼 리뷰**(Codex MCP + 보조 리뷰어 병렬 실행)를 디스패치합니다. Findings는 중복 제거, 심각도 정규화 후 단일 gate로 집계됩니다. strict 모드에서 Hooks는 fail-closed를 강제합니다: 집계 gate가 미완료이면 stop-guard가 차단합니다. 자세한 내용은 [docs/hooks.md](docs/hooks.md) 참조.

<details>
<summary>상세: 듀얼 리뷰 시퀀스 다이어그램</summary>

```mermaid
sequenceDiagram
    participant D as Developer
    participant C as Claude
    participant X as Codex MCP
    participant T as Secondary Reviewer
    participant H as Hooks

    D->>C: Edit code
    H->>H: Track file change
    C->>H: emit-review-gate PENDING
    par Dual Review
        C->>X: Codex review (sandbox)
    and
        C->>T: Task(code-reviewer)
    end
    X-->>C: Findings (primary)
    T-->>C: Findings (secondary)
    C->>C: Aggregate + dedup + gate
    C->>H: emit-review-gate READY/BLOCKED

    alt Issues found
        C->>C: Fix all issues
        C->>X: --continue threadId
        X-->>C: Re-verify
    end

    C->>C: /precommit (auto)
    C-->>D: ✅ All gates passed

    Note over H: Strict mode: incomplete gate → blocked
```

</details>

## 기능 하이라이트: 듀얼 리뷰어 아키텍처

v2.0은 두 개의 독립적인 리뷰어를 병렬로 디스패치합니다 — 단일 장애점 제로:

| 리뷰어 | 역할 | 폴백 |
|--------|------|------|
| Codex MCP | 기본적으로 듀얼 리뷰, 저하 폴백 모드 지원 | 사용 불가 시 싱글 리뷰어 모드로 폴백 |
| 보조 (pr-review-toolkit) | 신뢰도 스코어링 리뷰 | strict-reviewer → 싱글 모드 |

Findings는 **심각도 정규화** (P0-Nit), **중복 제거** (파일 + 이슈 키, ±5줄 허용), **소스 귀속** (`codex` | `toolkit` | `both`)됩니다.

Gate: `✅ Ready` 또는 `⛔ Blocked` — strict 모드에서, 미완료 gate = blocked.

## 비교표

| 기능 | sd0x-dev-flow | gstack | 일반 프롬프트 |
|---|---|---|---|
| 강제 리뷰 게이트 | Hook + 동작 레이어 | 제안만 | 없음 |
| 듀얼 리뷰어 | Codex + 보조 (병렬) | 단일 /review | 없음 |
| 자동 수정 루프 | 수정 → 재리뷰 → 통과 | 수동 | 없음 |
| 멀티 에이전트 리서치 | /deep-research (3 에이전트) | 없음 | 없음 |
| 적대적 검증 | 내시 균형 디베이트 | 없음 | 없음 |
| 자기 개선 | 교훈 로그 + 규칙 승격 | /retro 통계만 | 없음 |
| 크로스 툴 지원 | Codex/Cursor/Windsurf | Claude/Codex/Gemini/Cursor | N/A |

## 사용 시나리오

| 적합 | 부적합 |
|------|--------|
| Claude Code를 사용하는 개인/소규모 팀 프로젝트 | Claude Code를 전혀 사용하지 않는 팀 |
| 자동화된 리뷰 게이트가 필요한 프로젝트 | CI가 없는 일회성 스크립트 |
| Codex CLI / Cursor / Windsurf 사용자 (skills 서브셋) | 커스텀 LLM 프로바이더가 필요한 프로젝트 |
| 품질 게이트로 리그레션을 방지하는 리포지토리 | 테스트 인프라가 없는 리포지토리 |

## 설치

### Codex CLI / 기타 AI 에이전트

```bash
# Agent Skills 표준으로 개별 스킬 설치
npx skills add sd0xdev/sd0x-dev-flow

# AGENTS.md 생성 + hooks 설치 (Claude Code 내에서 실행)
/codex-setup init
```

| 방법 | 지원 도구 | 커버리지 |
|------|----------|---------|
| 플러그인 설치 | Claude Code | 전체 (87 skills, hooks, rules, auto-loop) |
| `npx skills add` | Codex CLI, Cursor, Windsurf, Aider | Skills만 (87 skills) |
| `/codex-setup init` | Codex CLI | AGENTS.md 커널 + git hooks |

**요구 사항**: Claude Code 2.1+ | [Codex MCP](https://github.com/openai/codex)（선택 — `/codex-*` skill에 필요; 미설치 시 싱글 리뷰어 모드로 폴백）

## 워크플로 트랙

| 워크플로 | 명령어 | Gate | 적용 방식 |
|----------|--------|------|-----------|
| 기능 개발 | `/feature-dev` → `/verify` → `/codex-review-fast` → `/precommit` | ✅/⛔ | Hook + Behavior |
| 버그 수정 | `/issue-analyze` → `/bug-fix` → `/verify` → `/precommit` | ✅/⛔ | Hook + Behavior |
| Auto-Loop | 코드 편집 → `/codex-review-fast` → `/precommit` | ✅/⛔ | Hook |
| 문서 리뷰 | `.md` 편집 → `/codex-review-doc` | ✅/⛔ | Hook |
| 기획 | `/codex-brainstorm` → `/feasibility-study` → `/tech-spec` | — | — |
| 온보딩 | `/project-setup` → `/repo-intake` | — | — |

<details>
<summary>시각화: 워크플로 플로차트</summary>

```mermaid
flowchart TD
    subgraph feat ["🔨 Feature Development"]
        F1["/feature-dev"] --> F2["Code + Tests"]
        F2 --> F3["/verify"]
        F3 --> F4["/codex-review-fast"]
        F4 --> F5["/precommit"]
        F5 --> F6["/update-docs"]
    end

    subgraph fix ["🐛 Bug Fix"]
        B1["/issue-analyze"] --> B2["/bug-fix"]
        B2 --> B3["Fix + Regression test"]
        B3 --> B4["/verify"]
        B4 --> B5["/codex-review-fast"]
        B5 --> B6["/precommit"]
    end

    subgraph docs ["📝 Docs Only"]
        D1["Edit .md"] --> D2["/codex-review-doc"]
        D2 --> D3["Done"]
    end

    subgraph plan ["🎯 Planning"]
        P1["/codex-brainstorm"] --> P2["/feasibility-study"]
        P2 --> P3["/tech-spec"]
        P3 --> P4["/codex-architect"]
        P4 --> P5["Implementation ready"]
    end

    subgraph ops ["⚙️ Operations"]
        O1["/project-setup"] --> O2["/repo-intake"]
        O2 --> O3["Develop"]
        O3 --> O4["/project-audit"]
        O3 --> O7["/best-practices"]
        O3 --> O5["/risk-assess"]
        O4 --> O6["/next-step --go"]
        O5 --> O6
        O7 --> O6
    end
```

</details>

## 포함 내용

| 카테고리 | 수량 | 예시 |
|----------|------|------|
| Skills | 87 | `/project-setup`, `/codex-review-fast`, `/verify`, `/smart-commit`, `/deep-research` |
| Agents | 15 | strict-reviewer, verify-app, coverage-analyst, architecture-designer |
| Hooks | 9 | pre-edit-guard, auto-format, review state tracking, stop guard, namespace hint, post-compact-auto-loop, post-skill-auto-loop, user-prompt-review-guard, session-init |
| Rules | 14 | auto-loop, auto-loop-project, codex-invocation, security, testing, git-workflow, self-improvement, context-management |
| Scripts | 13 | precommit runner, verify runner, dep audit, namespace hint, skill runner, commit-msg guard, pre-push gate, utils, emit-review-gate, build-codex-artifacts, resolve-feature (CLI + shell), feature-resolver |

### 최소한의 Context 사용량

Claude의 200k context window 중 ~4%만 사용합니다. 나머지 96%는 코드에 활용할 수 있습니다.

| 구성 요소 | 토큰 수 | 200k 대비 비율 |
|-----------|---------|---------------|
| Rules (상시 로드) | 5.1k | 2.6% |
| Skills (온디맨드) | 1.9k | 1.0% |
| Agents | 791 | 0.4% |
| **합계** | **~8k** | **~4%** |

Skills는 온디맨드로 로드됩니다. 미사용 Skills는 토큰을 소비하지 않습니다.

## Skill 레퍼런스

| Skill | 설명 |
|--------|------|
| `/project-setup` | 프로젝트 자동 감지 및 설정 |
| `/feature-dev` | 기능 개발 워크플로 |
| `/bug-fix` | Bug/Issue 수정 워크플로 |
| `/codex-review-fast` | 빠른 리뷰 (diff만) |
| `/codex-review-doc` | 문서 리뷰 |
| `/precommit` | lint:fix → build → test |
| `/precommit-fast` | lint:fix → test (빌드 없음) |
| `/verify` | 전체 검증 체인 |
| `/smart-commit` | 스마트 배치 커밋 |
| `/push-ci` | 푸시 + CI 모니터링 |
| `/create-pr` | GitHub PR 생성 |
| `/codex-brainstorm` | 대립형 브레인스토밍 (내시 균형) |
| `/tech-spec` | 기술 스펙 작성 |
| `/pr-review` | PR 셀프 리뷰 |
| `/codex-security` | OWASP Top 10 감사 |

<details>
<summary>전체 87개 Skill</summary>

### 개발

| Skill | 설명 |
|--------|------|
| `/project-setup` | 프로젝트 자동 감지 및 설정 |
| `/repo-intake` | 프로젝트 초기 스캔 (최초 1회) |
| `/install-rules` | 플러그인 규칙을 `.claude/rules/`에 설치 |
| `/install-hooks` | 플러그인 hooks를 `.claude/`에 설치 |
| `/install-scripts` | 플러그인 러너 스크립트 설치 |
| `/codex-setup` | Codex CLI 인프라 초기화 (AGENTS.md + hooks) |
| `/bug-fix` | Bug/Issue 수정 워크플로 |
| `/codex-implement` | Codex가 코드 작성 |
| `/codex-architect` | 아키텍처 자문 (제3의 두뇌) |
| `/code-explore` | 코드베이스 빠른 탐색 |
| `/git-investigate` | 코드 변경 이력 추적 |
| `/issue-analyze` | Issue 심층 분석 |
| `/post-dev-test` | 개발 후 테스트 보완 |
| `/feature-dev` | 기능 개발 워크플로 (설계 → 구현 → 검증 → 리뷰) |
| `/feature-verify` | 시스템 진단 (읽기 전용 검증, 이중 관점 확인) |
| `/load-pr-review` | GitHub PR 리뷰 코멘트를 세션에 로드 |
| `/pr-comment` | GitHub PR에 친절한 리뷰 코멘트 게시 |
| `/code-investigate` | 이중 관점 코드 조사 (Claude + Codex 독립 탐색) |
| `/next-step` | 컨텍스트 인식 다음 단계 어드바이저 |
| `/smart-commit` | 스마트 배치 커밋 (그룹화 + 메시지 + 명령어) |
| `/git-profile` | Git 아이덴티티 및 GPG 서명 프로파일 관리 |
| `/push-ci` | 푸시 (승인 필요) + CI 모니터링 |
| `/create-pr` | 브랜치에서 GitHub PR 생성 |
| `/merge-prep` | 병합 전 분석 및 준비 |
| `/smart-rebase` | squash-merge 리포지토리용 스마트 부분 rebase |
| `/deep-explore` | 멀티웨이브 병렬 코드 탐색 |
| `/remind` | 경량 모델 교정 (규칙 재로딩) |
| `/bump-version` | 패키지 + 플러그인 버전 동기 업데이트 |
| `/watch-ci` | GitHub Actions CI 실행 모니터링 |
| `/jira` | Jira 연동 (조회/브랜치 생성/상태 전환) |

### 리뷰 (Codex MCP)

| Skill | 설명 | Loop 지원 |
|--------|------|-----------|
| `/codex-review-fast` | 빠른 리뷰 (diff만) | `--continue <threadId>` |
| `/codex-review` | 전체 리뷰 (lint + build) | `--continue <threadId>` |
| `/codex-review-branch` | 브랜치 전체 리뷰 | - |
| `/codex-cli-review` | CLI 리뷰 (전체 디스크 읽기) | - |
| `/codex-review-doc` | 문서 리뷰 | `--continue <threadId>` |
| `/codex-security` | OWASP Top 10 감사 | `--continue <threadId>` |
| `/codex-test-gen` | 유닛 테스트 생성 | - |
| `/codex-test-review` | 테스트 커버리지 리뷰 | `--continue <threadId>` |
| `/codex-explain` | 복잡한 코드 설명 | - |
| `/seek-verdict` | 독립 검증 (dismiss/confirm/clarify) | - |

### 검증

| Skill | 설명 |
|--------|------|
| `/verify` | lint -> typecheck -> unit -> integration -> e2e |
| `/precommit` | lint:fix -> build -> test:unit |
| `/precommit-fast` | lint:fix -> test:unit |
| `/dep-audit` | 디펜던시 보안 감사 |
| `/project-audit` | 프로젝트 헬스 감사 (결정론적 스코어링) |
| `/best-practices` | 업계 모범 사례 감사 (적대적 토론 포함) |
| `/risk-assess` | 미커밋 코드 리스크 평가 |
| `/pre-pr-audit` | PR 전 신뢰도 감사 (5차원 스코어링) |
| `/test-deep` | 컨텍스트 인식 테스트 오케스트레이션 |

### 기획

| Skill | 설명 |
|--------|------|
| `/codex-brainstorm` | 대립형 브레인스토밍 (내시 균형) |
| `/feasibility-study` | 타당성 분석 |
| `/tech-spec` | 기술 스펙 작성 |
| `/review-spec` | 기술 스펙 리뷰 |
| `/deep-analyze` | 심층 분석 + 로드맵 |
| `/architecture` | 아키텍처 설계 + 3-architecture.md |
| `/project-brief` | PM/CTO용 요약 보고서 |
| `/deep-research` | 멀티 에이전트 심층 리서치 오케스트레이션 |
| `/fp-brief` | 기술 문서 첫 원칙 브리핑 |

### 문서 & 도구

| Skill | 설명 |
|--------|------|
| `/update-docs` | 문서-코드 동기화 |
| `/check-coverage` | 테스트 커버리지 분석 |
| `/create-request` | 요구사항 문서 생성/업데이트 |
| `/doc-refactor` | 문서 간소화 |
| `/simplify` | 코드 간소화 |
| `/de-ai-flavor` | AI 생성 흔적 제거 |
| `/generate-runner` | 모든 에코시스템을 위한 맞춤형 precommit runner 생성 |
| `/safe-remove` | 플러그인 에셋 안전 제거 |
| `/pr-review` | PR 셀프 리뷰 |
| `/pr-summary` | PR 상태 요약 (티켓별 그룹) |
| `/contract-decode` | EVM 컨트랙트 에러/calldata 디코더 |
| `/skill-health-check` | 스킬 품질 및 라우팅 검증 |
| `/sharingan` | 외부 리포지토리 분석 및 동등한 스킬 생성 |
| `/statusline-config` | 상태 표시줄 세그먼트 및 테마 커스터마이즈 |
| `/claude-health` | Claude Code 설정 상태 점검 |
| `/op-session` | 1Password CLI 세션 초기화 (반복 생체 인증 방지) |
| `/obsidian-cli` | Obsidian vault 연동 (공식 CLI 경유) |
| `/zh-tw` | 번체 중국어로 변환 |

</details>

## 규칙 & Hook

14개 규칙 (상시 로드 컨벤션) + 9개 Hook (자동 가드레일).

> **커스터마이징**: `auto-loop-project.md`를 편집하여 프로젝트별 auto-loop 동작을 오버라이드할 수 있습니다. 플러그인 업데이트와 충돌하지 않습니다 — [Rule Override Pattern](docs/features/rule-override-pattern/2-tech-spec.md) 참조.

전체 규칙, Hook, 환경 변수 레퍼런스는 [docs/rules.md](docs/rules.md)와 [docs/hooks.md](docs/hooks.md)를 참조하세요.

## 커스터마이즈

`/project-setup`으로 모든 placeholder를 자동 감지/설정하거나, `.claude/CLAUDE.md`를 직접 편집하세요:

| Placeholder | 설명 | 예시 |
|-------------|------|------|
| `{PROJECT_NAME}` | 프로젝트 이름 | my-app |
| `{FRAMEWORK}` | 프레임워크 | MidwayJS 3.x, NestJS, Express |
| `{CONFIG_FILE}` | 메인 설정 파일 | src/configuration.ts |
| `{BOOTSTRAP_FILE}` | 부트스트랩 엔트리 | bootstrap.js, main.ts |
| `{DATABASE}` | 데이터베이스 | MongoDB, PostgreSQL |
| `{TEST_COMMAND}` | 테스트 명령어 | yarn test:unit |
| `{LINT_FIX_COMMAND}` | Lint 자동 수정 | yarn lint:fix |
| `{BUILD_COMMAND}` | 빌드 명령어 | yarn build |
| `{TYPECHECK_COMMAND}` | 타입 체크 | yarn typecheck |

## 쇼케이스: 멀티 에이전트 리서치

`/deep-research`를 실행하면 2-3개의 병렬 리서치 에이전트가 웹 소스, 코드베이스, 커뮤니티 지식을 횡단 조사합니다 — claim registry 통합과 조건부 적대적 디베이트를 지원합니다.

| 특징 | 내용 |
|------|------|
| 에이전트 | 2-3 병렬 (web + code + community) |
| 통합 | Claim registry 합의 탐지 |
| 검증 | 조건부 /codex-brainstorm 디베이트 |
| 스코어링 | 4-시그널 완전성 모델 |

[전체 문서](docs/features/deep-research/)

## 아키텍처

```
Command (진입점) → Skill (기능) → Agent (실행 환경)
```

- **Commands**: 사용자가 `/...`로 실행
- **Skills**: 요청 시 로드되는 지식 베이스
- **Agents**: 전용 도구를 가진 격리된 서브에이전트
- **Hooks**: 자동화 가드레일 (포맷팅, 리뷰 상태, 스톱 가드)
- **Rules**: 항상 활성화된 컨벤션 (자동 로드)

고급 아키텍처에 대한 자세한 내용(agentic control stack, 제어 루프 이론, 샌드박스 규칙)은 [docs/architecture.md](docs/architecture.md)를 참고하세요.

## 기여

PR 환영합니다. 다음 사항을 지켜주세요:

1. 기존 네이밍 컨벤션 준수 (kebab-case)
2. 스킬에 `When to Use` / `When NOT to Use` 포함
3. 위험한 작업에는 `disable-model-invocation: true` 추가
4. 제출 전 Claude Code로 테스트

## 라이선스

MIT

## Star History

<a href="https://www.star-history.com/?repos=sd0xdev%2Fsd0x-dev-flow&type=date&legend=top-left">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/image?repos=sd0xdev/sd0x-dev-flow&type=date&theme=dark&legend=top-left" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/image?repos=sd0xdev/sd0x-dev-flow&type=date&legend=top-left" />
   <img alt="Star History Chart" src="https://api.star-history.com/image?repos=sd0xdev/sd0x-dev-flow&type=date&legend=top-left" />
 </picture>
</a>
