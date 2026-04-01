# sd0x-dev-flow

![sd0x-dev-flow banner](https://raw.githubusercontent.com/sd0xdev/sd0x-dev-flow/main/banner.jpg)

**语言**: [English](README.md) | [繁體中文](README.zh-TW.md) | 简体中文 | [日本語](README.ja.md) | [한국어](README.ko.md) | [Español](README.es.md)

> AI 能快速交付，但缺乏防护机制，速度令人不安。

**AI 跳不过的质量关卡。** 具备 hook 强制双审查、自动修复循环与 fail-closed 语义的 [Claude Code](https://claude.com/claude-code) 插件 — 让你的代码出得快，也出得对。

76 commands · 60 skills · 15 agents — 仅占 Claude context window 的 ~4%

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE) [![npm](https://img.shields.io/badge/npx-skills%20add-blue)](https://www.npmjs.com/package/skills)

## 为什么选择 sd0x-dev-flow？

| 没有防护时 | 有 sd0x-dev-flow |
|---|---|
| Context 过长时 AI 跳过审查 | **Hook 强制**：stop-guard 阻止未完成的审查 |
| 单一审查者遗漏问题 | **双审查分派**：Codex + 次要审查者并行 |
| 「已修复」却没有重新验证 | **Auto-loop**：修复 → 重新审查 → 通过 → 继续 |
| 审查状态在 compact 后丢失 | **状态追踪**：SessionStart hook 重新注入 |

## 快速开始

```bash
# 安装插件
/plugin marketplace add sd0xdev/sd0x-dev-flow
/plugin install sd0x-dev-flow@sd0xdev-marketplace

# 配置项目
/project-setup
```

一个命令自动检测框架、包管理器、数据库、入口文件和脚本命令。安装部分 rules 和 hooks；完整插件包含 14 条 rules + 9 个 hooks。

使用 `--lite` 仅配置 CLAUDE.md（跳过 rules/hooks）。

## 工作原理

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

**Auto-Loop 引擎**自动执行质量关卡——代码编辑后，review 命令会分派**双 Reviewer 并行审查**（Codex MCP + 次要 reviewer 同步进行）。Findings 会去重、severity 正规化，并汇整为单一 gate。在 strict 模式下，Hooks 强制 fail-closed 语义：汇整 gate 未完成时，stop-guard 会阻止停止。详见 [docs/hooks.md](docs/hooks.md)。

<details>
<summary>详细：双 Reviewer 时序图</summary>

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

## 功能亮点：双 Reviewer 架构

v2.0 并行分派两个独立 reviewer — 默认双 reviewer 并行审查，支持降级 fallback 模式：

| Reviewer | 角色 | 降级策略 |
|----------|------|----------|
| Codex MCP | 主要（sandbox，完整 diff） | 不可用时退回单 reviewer 模式 |
| 次要（pr-review-toolkit） | 置信度评分制审查 | strict-reviewer → 单 reviewer 模式 |

Findings 会**严重度正规化**（P0-Nit）、**去重**（file + issue key，±5 行容差），并**标记来源**（`codex` | `toolkit` | `both`）。

Gate：`✅ Ready` 或 `⛔ Blocked` — strict 模式下，未完成 gate = blocked。

## 如何比较

| 能力 | sd0x-dev-flow | gstack | 通用 prompts |
|---|---|---|---|
| 强制审查关卡 | Hook + 行为层 | 仅建议 | 无 |
| 双审查者 | Codex + 次要（并行） | 单一 /review | 无 |
| 自动修复循环 | 修复 → 重新审查 → 通过 | 手动 | 无 |
| 多 Agent 研究 | /deep-research（3 agents） | 无 | 无 |
| 对抗式验证 | 纳什均衡辩论 | 无 | 无 |
| 自我改进 | 教训记录 + 规则提升 | 仅 /retro 统计 | 无 |
| 跨工具支持 | Codex/Cursor/Windsurf | Claude/Codex/Gemini/Cursor | N/A |

## 适用场景

| 适合 | 不太适合 |
|------|----------|
| 使用 Claude Code 的个人或小团队项目 | 完全不使用 Claude Code 的团队 |
| 需要自动化审查关卡的项目 | 没有 CI 的一次性脚本 |
| Codex CLI / Cursor / Windsurf 用户（skills 子集） | 需要自定义 LLM provider 的项目 |
| 质量关卡可防止 regression 的仓库 | 没有测试基础设施的仓库 |

## 安装

### Codex CLI / 其他 AI Agent

```bash
# 通过 Agent Skills 标准安装单个 skill
npx skills add sd0xdev/sd0x-dev-flow

# 生成 AGENTS.md + 安装 hooks（在 Claude Code 中执行）
/codex-setup init
```

| 方式 | 适用工具 | 覆盖范围 |
|------|---------|---------|
| 插件安装 | Claude Code | 完整（76 commands、hooks、rules、auto-loop） |
| `npx skills add` | Codex CLI、Cursor、Windsurf、Aider | 仅 Skills（60 skills） |
| `/codex-setup init` | Codex CLI | AGENTS.md kernel + git hooks |

**环境要求**：Claude Code 2.1+ | [Codex MCP](https://github.com/openai/codex)（选用 — `/codex-*` 命令需要；未安装时退回单 reviewer 模式）

## 工作流路径

| 工作流 | 命令 | Gate | 执行层 |
|--------|------|------|--------|
| 功能开发 | `/feature-dev` → `/verify` → `/codex-review-fast` → `/precommit` | ✅/⛔ | Hook + 行为层 |
| 缺陷修复 | `/issue-analyze` → `/bug-fix` → `/verify` → `/precommit` | ✅/⛔ | Hook + 行为层 |
| Auto-Loop | 代码编辑 → `/codex-review-fast` → `/precommit` | ✅/⛔ | Hook |
| 文档审查 | `.md` 编辑 → `/codex-review-doc` | ✅/⛔ | Hook |
| 规划 | `/codex-brainstorm` → `/feasibility-study` → `/tech-spec` | — | — |
| 入门引导 | `/project-setup` → `/repo-intake` | — | — |

<details>
<summary>可视化：工作流程图</summary>

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

## 包含内容

| 类别 | 数量 | 示例 |
|------|------|------|
| 命令 | 76 | `/project-setup`, `/codex-review-fast`, `/verify`, `/smart-commit`, `/deep-research` |
| 技能 | 60 | project-setup, code-explore, smart-commit, contract-decode, deep-research, sharingan |
| 代理 | 15 | strict-reviewer, verify-app, coverage-analyst, architecture-designer |
| 钩子 | 9 | pre-edit-guard, auto-format, review state tracking, stop guard, namespace hint, post-compact-auto-loop, post-skill-auto-loop, user-prompt-review-guard, session-init |
| 规则 | 14 | auto-loop, auto-loop-project, codex-invocation, security, testing, git-workflow, self-improvement, context-management |
| 脚本 | 13 | precommit runner, verify runner, dep audit, namespace hint, skill runner, commit-msg guard, pre-push gate, utils, emit-review-gate, build-codex-artifacts, resolve-feature (CLI + shell), feature-resolver |

### 极小的 Context 占用

~4% 的 Claude 200k context window——96% 留给你的代码。

| 组件 | Tokens | 占 200k 比例 |
|------|--------|-------------|
| Rules（常驻加载） | 5.1k | 2.6% |
| Skills（按需加载） | 1.9k | 1.0% |
| Agents | 791 | 0.4% |
| **合计** | **~8k** | **~4%** |

Skills 按需加载。闲置 Skill 不占用任何 Token。

## 命令参考

| 命令 | 说明 |
|------|------|
| `/project-setup` | 自动检测并配置项目 |
| `/feature-dev` | 功能开发流程 |
| `/bug-fix` | 缺陷修复工作流 |
| `/codex-review-fast` | 快速审查（仅 diff） |
| `/codex-review-doc` | 文档审查 |
| `/precommit` | lint:fix → build → test |
| `/precommit-fast` | lint:fix → test（跳过 build） |
| `/verify` | 完整验证链 |
| `/smart-commit` | 智能批量 commit |
| `/push-ci` | 推送 + CI 监控 |
| `/create-pr` | 创建 GitHub PR |
| `/codex-brainstorm` | 对抗式头脑风暴（纳什均衡） |
| `/tech-spec` | 生成技术规格书 |
| `/pr-review` | PR 自查 |
| `/codex-security` | OWASP Top 10 审计 |

<details>
<summary>全部 76 个命令</summary>

### 开发

| 命令 | 说明 |
|------|------|
| `/project-setup` | 自动检测并配置项目 |
| `/repo-intake` | 一次性项目盘点扫描 |
| `/install-rules` | 安装插件规则到 `.claude/rules/` |
| `/install-hooks` | 安装插件 hooks 到 `.claude/` |
| `/install-scripts` | 安装插件 runner 脚本 |
| `/codex-setup` | 初始化 Codex CLI 基础设施（AGENTS.md + hooks） |
| `/bug-fix` | 缺陷修复工作流 |
| `/codex-implement` | Codex 编写代码 |
| `/codex-architect` | 架构建议（第三大脑） |
| `/code-explore` | 快速代码探索 |
| `/git-investigate` | 追踪代码历史 |
| `/issue-analyze` | 深度问题分析 |
| `/post-dev-test` | 开发后补充测试 |
| `/feature-dev` | 功能开发流程（设计 → 实现 → 验证 → 审查） |
| `/feature-verify` | 系统诊断（只读验证，双视角确认） |
| `/load-pr-review` | 加载 GitHub PR 审查评论到 session |
| `/pr-comment` | 在 GitHub PR 上发布友善的审查评论 |
| `/code-investigate` | 双视角代码调查（Claude + Codex 独立探索） |
| `/next-step` | 情境感知的下一步建议 |
| `/smart-commit` | 智能批量 commit（分组 + 消息 + 命令） |
| `/git-profile` | Git 身份与 GPG 签名 profile 管理 |
| `/push-ci` | 推送（需审批）+ CI 监控 |
| `/create-pr` | 从分支创建 GitHub PR |
| `/merge-prep` | 合并前分析与准备 |
| `/smart-rebase` | 智能局部 rebase（squash-merge 仓库适用） |
| `/deep-explore` | 多波段并行代码探索 |
| `/remind` | 轻量模型修正（加载规则） |
| `/bump-version` | 同步升级包与插件版本 |
| `/watch-ci` | 监控 GitHub Actions CI 运行 |
| `/jira` | Jira 集成（查看/创建分支/状态转换） |

### 审查（Codex MCP）

| 命令 | 说明 | 循环支持 |
|------|------|----------|
| `/codex-review-fast` | 快速审查（仅 diff） | `--continue <threadId>` |
| `/codex-review` | 完整审查（lint + build） | `--continue <threadId>` |
| `/codex-review-branch` | 完整分支审查 | - |
| `/codex-cli-review` | CLI 审查（全盘读取） | - |
| `/codex-review-doc` | 文档审查 | `--continue <threadId>` |
| `/codex-security` | OWASP Top 10 审计 | `--continue <threadId>` |
| `/codex-test-gen` | 生成单元测试 | - |
| `/codex-test-review` | 审查测试覆盖率 | `--continue <threadId>` |
| `/codex-explain` | 解释复杂代码 | - |
| `/seek-verdict` | 独立发现验证（dismiss/confirm/clarify） | - |

### 验证

| 命令 | 说明 |
|------|------|
| `/verify` | lint -> typecheck -> unit -> integration -> e2e |
| `/precommit` | lint:fix -> build -> test:unit |
| `/precommit-fast` | lint:fix -> test:unit |
| `/dep-audit` | 依赖安全审计 |
| `/project-audit` | 项目健康审计（确定性评分） |
| `/best-practices` | 行业最佳实践审计（含对抗式辩论） |
| `/risk-assess` | 未提交代码风险评估 |
| `/pre-pr-audit` | PR 前置信心审计（5 维度评分） |
| `/test-deep` | 上下文感知测试编排 |

### 规划

| 命令 | 说明 |
|------|------|
| `/codex-brainstorm` | 对抗式头脑风暴（纳什均衡） |
| `/feasibility-study` | 可行性分析 |
| `/tech-spec` | 生成技术规格书 |
| `/review-spec` | 审查技术规格书 |
| `/deep-analyze` | 深度分析 + 路线图 |
| `/architecture` | 架构设计 + 3-architecture.md |
| `/project-brief` | PM/CTO 执行摘要 |
| `/deep-research` | 多 agent 深度研究编排 |
| `/fp-brief` | 第一原理简报 |

### 文档与工具

| 命令 | 说明 |
|------|------|
| `/update-docs` | 同步文档与代码 |
| `/check-coverage` | 测试覆盖率分析 |
| `/create-request` | 创建/更新需求文档 |
| `/doc-refactor` | 精简文档 |
| `/simplify` | 代码精简 |
| `/de-ai-flavor` | 去除 AI 痕迹 |
| `/generate-runner` | 为任何生态系生成自定义 precommit runner |
| `/safe-remove` | 安全移除插件资产 |
| `/pr-review` | PR 自查 |
| `/pr-summary` | PR 状态摘要（按 ticket 分组） |
| `/contract-decode` | EVM 合约错误/calldata 解码器 |
| `/skill-health-check` | 验证 Skill 质量与 routing |
| `/sharingan` | 分析外部 repo 并生成等效 skill |
| `/statusline-config` | 自定义状态栏区段与主题 |
| `/claude-health` | Claude Code 配置健康检查 |
| `/op-session` | 初始化 1Password CLI session（避免重复生物识别提示） |
| `/obsidian-cli` | Obsidian vault 集成（通过官方 CLI） |
| `/zh-tw` | 改写为繁体中文 |

</details>

## 规则与钩子

14 条规则（常驻加载的规范）+ 9 个钩子（自动化防护栏）。

> **定制化**：编辑 `auto-loop-project.md` 可覆写项目的 auto-loop 行为。插件更新不会冲突 — 详见 [Rule Override Pattern](docs/features/rule-override-pattern/2-tech-spec.md)。

完整的规则、钩子与环境变量参考，请见 [docs/rules.md](docs/rules.md) 与 [docs/hooks.md](docs/hooks.md)。

## 自定义配置

运行 `/project-setup` 自动检测并配置所有占位符，或手动编辑 `.claude/CLAUDE.md`：

| 占位符 | 说明 | 示例 |
|--------|------|------|
| `{PROJECT_NAME}` | 项目名称 | my-app |
| `{FRAMEWORK}` | 框架 | MidwayJS 3.x, NestJS, Express |
| `{CONFIG_FILE}` | 主配置文件 | src/configuration.ts |
| `{BOOTSTRAP_FILE}` | 启动入口 | bootstrap.js, main.ts |
| `{DATABASE}` | 数据库 | MongoDB, PostgreSQL |
| `{TEST_COMMAND}` | 测试命令 | yarn test:unit |
| `{LINT_FIX_COMMAND}` | Lint 自动修复 | yarn lint:fix |
| `{BUILD_COMMAND}` | 构建命令 | yarn build |
| `{TYPECHECK_COMMAND}` | 类型检查 | yarn typecheck |

## 展示：多 Agent 研究

执行 `/deep-research` 可调度 2-3 个并行研究 agent，跨越网络来源、代码库与社区知识 — 搭配 claim registry 综合与条件式对抗辩论。

| 特性 | 内容 |
|------|------|
| Agents | 2-3 个并行（web + code + community） |
| 综合 | Claim registry 共识检测 |
| 验证 | 条件式 /codex-brainstorm 辩论 |
| 评分 | 4 信号完整度模型 |

[完整文档](docs/features/deep-research/)

## 架构

```
Command (entry) → Skill (capability) → Agent (environment)
```

- **Commands**：用户通过 `/...` 触发
- **Skills**：按需加载的知识库
- **Agents**：拥有特定工具的隔离子代理
- **Hooks**：自动化防护栏（格式化、审查状态、停止守卫）
- **Rules**：始终生效的规范（自动加载）

高级架构详情（agentic control stack、控制回路理论、沙箱规则）参见 [docs/architecture.md](docs/architecture.md)。

## 贡献

欢迎 PR。请：

1. 遵循现有命名规范（kebab-case）
2. 在技能中包含 `When to Use` / `When NOT to Use`
3. 对危险操作添加 `disable-model-invocation: true`
4. 提交前用 Claude Code 测试

## 许可证

MIT

## Star History

<a href="https://www.star-history.com/?repos=sd0xdev%2Fsd0x-dev-flow&type=date&legend=top-left">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/image?repos=sd0xdev/sd0x-dev-flow&type=date&theme=dark&legend=top-left" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/image?repos=sd0xdev/sd0x-dev-flow&type=date&legend=top-left" />
   <img alt="Star History Chart" src="https://api.star-history.com/image?repos=sd0xdev/sd0x-dev-flow&type=date&legend=top-left" />
 </picture>
</a>
