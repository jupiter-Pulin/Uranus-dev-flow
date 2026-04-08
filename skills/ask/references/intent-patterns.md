# Intent Classification Patterns

Reference for classifying ambiguous questions in `/ask`.

## Intent Examples

| Intent | Example Questions | Key Signals |
|--------|-------------------|-------------|
| `code` | "這個 function 做什麼？", "module X 怎麼運作？", "show me the implementation" | File paths, function/class names, "how does X work" |
| `git` | "最近改了什麼？", "誰改了這個檔案？", "上次 commit 是什麼？" | 時間詞（最近、上次）、git 動詞（改、commit、push） |
| `docs` | "需求是什麼？", "tech spec 怎麼寫的？", "有沒有 request doc？" | doc 類型名詞（spec、requirement、request、architecture） |
| `rules` | "這個規則是什麼？", "有什麼 convention？", "allowed-tools 怎麼設？" | rule / convention / policy / allowed / prohibited |
| `skill` | "有沒有 skill 可以做 X？", "怎麼用 /Y？", "這個 command 做什麼？" | skill / command / `/` prefix / "怎麼用" |
| `arch` | "系統架構是什麼？", "整體設計怎麼樣？", "modules 之間怎麼互動？" | 架構 / 設計 / 系統 / overview / modules |
| `multi` | "auto-loop 規則是什麼？哪些 skill 用到？" | 跨多個 intent 的複合問題 |

## Edge Cases

| Question | Seems Like | Actually | Reason |
|----------|-----------|---------|--------|
| "auto-loop 怎麼運作？" | `code` | `rules` | auto-loop 是 rule，不是 code module |
| "SKILL.md 怎麼寫？" | `docs` | `skill` | SKILL.md 是 skill 定義格式 |
| "git hooks 做什麼？" | `git` | `code` | 問的是 hook 的實作，不是 git history |
| "為什麼這裡用 Bash(git:*)？" | `code` | `rules` | 問的是 allowed-tools convention |
| "這個 PR 改了什麼？" | `git` | `multi` (git + code) | 需要 git diff + code context |

## Multi-Intent Resolution

When a question spans multiple intents:

| Rule | Description |
|------|-------------|
| Primary intent first | Execute the primary intent's pipeline first |
| Parallel when independent | If intents are independent, run pipelines in parallel |
| Merge results | Combine all gathered context before synthesis |
| Hard limit | Total file reads across all intents: max 8 |

## Conversation Context Signals

| Prior Turn Signal | Impact on Classification |
|-------------------|------------------------|
| User was editing a specific file | Default `code` intent scope to that file |
| `/code-explore` just ran | Follow-up likely about the same module |
| `/codex-review-fast` just ran | Follow-up likely about review findings |
| Feature resolver detected feature X | Scope `docs` intent to that feature's docs |
| User was on `feat/*` branch | Scope to that feature area |
