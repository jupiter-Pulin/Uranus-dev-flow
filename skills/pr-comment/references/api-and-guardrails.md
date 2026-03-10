# PR Comment — API Contract & Guardrails

## GitHub REST API: Create a Review

```
POST /repos/{owner}/{repo}/pulls/{pull_number}/reviews
```

| Parameter | Type | Description |
| --------- | ---- | ----------- |
| `commit_id` | string | PR head SHA (fetched at submit time) |
| `event` | string | v1 hard-lock `"COMMENT"` |
| `body` | string | Review summary (v1: empty string) |
| `comments` | array | Inline comments |
| `comments[].path` | string | File path (repo-relative) |
| `comments[].line` | number | Line number |
| `comments[].side` | string | `RIGHT` (new) or `LEFT` (deleted) |
| `comments[].body` | string | Comment content |

### Token Requirements

| Token Type | Required Scope |
|------------|---------------|
| Classic PAT | `repo` |
| Fine-grained PAT | `Pull requests: Read and write` |

## Body Transmission (Shell Injection Prevention)

Always use `jq` to construct JSON body, then pass via temp file + `--input`:

```javascript
// 1. Build JSON safely via jq (no shell interpolation)
const jqR = await runCapture('jq', ['-n',
  '--arg', 'commit_id', headSha,
  '--arg', 'event', 'COMMENT',
  '--argjson', 'comments', JSON.stringify(comments),
  '{commit_id: $commit_id, event: $event, body: "", comments: $comments}',
]);
// 2. Write to temp file
fs.writeFileSync(tmpFile, jqR.stdout, 'utf8');
// 3. POST via gh api --input <tmpFile>
await runCapture('gh', ['api', '--method', 'POST', endpoint, '--input', tmpFile]);
// 4. Clean up temp file
fs.unlinkSync(tmpFile);
```

**Prohibited patterns:**

```bash
# Never interpolate comment body directly into shell arguments
gh api ... -f body="$COMMENT"        # shell expansion risk
gh api ... --raw-field body=$COMMENT  # unquoted risk
```

## Exit Code Convention

| Code | Meaning | SKILL.md Action |
|------|---------|-----------------|
| 0 | Success | Report review URL |
| 2 | Error (invalid input, network, jq, 422) | Report error |
| 3 | SHA drift (head SHA changed) | Re-confirm flow |

## Safety Rules

| Rule | Enforcement |
|------|-------------|
| Dry-run first | `prepare` must run before `submit` |
| User gate | AskUserQuestion required before `submit` |
| Atomic batch | Single `POST /reviews` call (no notification bombing) |
| SHA drift check | Re-fetch head SHA before submit, compare with payload |
| COMMENT only | v1 hard-locks `event: "COMMENT"` (no APPROVE/REQUEST_CHANGES) |

## Comment Validation (prepare subcommand)

| Check | Result if Failed |
|-------|-----------------|
| `path` not in changed files | INVALID (excluded from payload) |
| `line` <= 0 or non-integer | INVALID (excluded from payload) |
| `body` empty | INVALID (excluded from payload) |
| `line` outside diff hunk range | WARNING (included, may fail at GitHub) |
| Diff patch unavailable (binary/large) | UNKNOWN (warning only, included) |
| 0 valid comments after validation | exit 2 |
