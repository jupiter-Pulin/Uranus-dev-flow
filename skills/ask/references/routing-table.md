# Skill Routing Decision Table

Reference for determining when `/ask` should suggest a specialized skill instead.

## Routing Rules

| Signal Pattern | Route To | Confidence | Reason |
|---------------|----------|------------|--------|
| 修改/實作/新增/建立意圖 | `/feature-dev` | High | Action-oriented, not Q&A |
| "review", "check code", "PR" | `/codex-review-fast` | High | Code review workflow |
| "review spec", "檢查規格" | `/review-spec` | High | Spec review workflow |
| "review doc", "檢查文件" | `/codex-review-doc` | High | Doc review workflow |
| "bug", "fix", "error", "broken" | `/bug-fix` | Medium | Bug fix workflow |
| "下一步", "該做什麼", "what next" | `/next-step` | High | Advisory workflow |
| "research", "survey", "深入研究" | `/deep-research` | Medium | Heavy research |
| "trace", "完整追蹤", "deep dive" | `/code-explore` | Medium | Systematic exploration |

## Routing Behavior

- **Suggest, never redirect**: Output "這個問題更適合 `/X`，要改用嗎？"
- **User decides**: If user says "繼續用 /ask"，proceed with normal pipeline
- **Low confidence**: If routing confidence is Medium, mention the alternative but proceed with `/ask` by default

## Non-Routable Questions

These always stay in `/ask` (no routing suggestion):

- Pure information questions: "是什麼？", "有哪些？", "在哪裡？"
- Explanation questions: "為什麼？", "怎麼運作？"
- Comparison questions: "X 跟 Y 有什麼不同？"
- Status questions: "目前狀態？", "進度？"
