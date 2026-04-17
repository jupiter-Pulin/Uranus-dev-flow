const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, existsSync } = require('node:fs');
const { resolve } = require('node:path');

const skillPath = resolve(__dirname, '../../skills/watch-ci/SKILL.md');

function readSkill() {
  assert.ok(existsSync(skillPath), `skills/watch-ci/SKILL.md does not exist at ${skillPath}`);
  // Normalize CRLF so assertions work on any line ending.
  return readFileSync(skillPath, 'utf8').replace(/\r\n/g, '\n');
}

// Split a SKILL.md into { frontmatter, body }. Tolerates any whitespace after the
// fence markers. Fails loudly if no frontmatter block is present — all skills in
// this project must have one.
function splitSkill(content) {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
  assert.ok(match, 'skills/watch-ci/SKILL.md missing YAML frontmatter block');
  return { frontmatter: match[1], body: match[2] };
}

// Detect whether the frontmatter declares a top-level `context` key at all,
// regardless of YAML form. Matches plain/quoted top-level variants:
//   context:        'context':        "context":        context :
// Restricted to column 0 (no leading whitespace) so nested keys inside a block
// scalar (e.g. a multi-line `description: |` that happens to mention the word
// "context:") do not trigger a false positive. SKILL.md frontmatter uses only
// flat top-level keys, so this is the correct invariant.
function hasContextKey(frontmatter) {
  return /^["']?context["']?\s*:/m.test(frontmatter);
}

// Extract allowed-tools entries from either scalar form (`allowed-tools: A, B, C`)
// or YAML sequence form (`allowed-tools:\n  - A\n  - B`). Strips inline `# comment`
// from each item. Returns an array of trimmed tool names.
function allowedTools(frontmatter) {
  const stripComment = (s) => s.replace(/\s*#.*$/, '').trim();
  const scalarRe = /^\s*allowed-tools\s*:\s*(.+?)\s*$/m;
  const scalarMatch = frontmatter.match(scalarRe);
  if (scalarMatch) {
    const raw = stripComment(scalarMatch[1]);
    if (raw.length > 0) {
      return raw.split(',').map((s) => stripComment(s)).filter(Boolean);
    }
  }
  // Sequence form: collect following `  - Name` lines. Skip blank lines and
  // comment-only lines; stop on any other non-list, non-blank, non-comment line.
  const seqStart = frontmatter.match(/^\s*allowed-tools\s*:\s*$/m);
  if (!seqStart) return [];
  const rest = frontmatter.slice(seqStart.index + seqStart[0].length);
  const items = [];
  for (const line of rest.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;
    if (trimmed.startsWith('#')) continue;
    const itemMatch = line.match(/^\s*-\s*(.+?)\s*$/);
    if (itemMatch) {
      const cleaned = stripComment(itemMatch[1]).replace(/^["']|["']$/g, '');
      if (cleaned) items.push(cleaned);
    } else {
      break;
    }
  }
  return items;
}

test('watch-ci frontmatter must not declare any `context` key (Monitor + fork is broken)', () => {
  const { frontmatter } = splitSkill(readSkill());
  assert.strictEqual(
    hasContextKey(frontmatter),
    false,
    'skills/watch-ci/SKILL.md must not declare any `context` key — watch-ci must run in the parent session so Monitor tool streaming notifications reach the user conversation'
  );
});

test('watch-ci frontmatter still lists Monitor in allowed-tools', () => {
  const { frontmatter } = splitSkill(readSkill());
  const tools = allowedTools(frontmatter);
  assert.ok(
    tools.includes('Monitor'),
    `allowed-tools must include Monitor for streaming CI progress (got: ${tools.join(', ') || '<empty>'})`
  );
});

test('watch-ci body removes contradictory forked-context warnings', () => {
  const { body } = splitSkill(readSkill());
  // Broad negative pattern — catches any claim that fork-context notifications
  // are unreliable/broken/not-guaranteed. These sentiments contradict the
  // post-fix reality where watch-ci runs in the parent session.
  const forbiddenPatterns = [
    /forked context are unreliable/i,
    /not guaranteed in forked context/i,
    /unreliable in forked context/i,
  ];
  for (const pattern of forbiddenPatterns) {
    assert.doesNotMatch(
      body,
      pattern,
      `watch-ci body must not contain forked-context reliability warnings — matched: ${pattern}`
    );
  }
});

test('watch-ci body documents --interval argument with default 30 seconds', () => {
  const { body } = splitSkill(readSkill());
  // The Arguments table row must declare the --interval flag. We match loosely
  // on the row pattern so future cosmetic reshuffles (column order, wording)
  // don't cause false failures — the load-bearing invariants are the flag name
  // and the default value of 30.
  const rowRe = /^\|\s*`--interval\s+<sec>`\s*\|[^\n]*\|\s*30\s*\|/m;
  assert.match(
    body,
    rowRe,
    'watch-ci Arguments table must document `--interval <sec>` with Default = 30 (noise-reduction regression guard)'
  );
});

test('watch-ci body threads $INTERVAL into the gh run watch command', () => {
  const { body } = splitSkill(readSkill());
  // Primary canonical command block (Step 3b).
  const primaryRe = /gh run watch[^\n]*--exit-status[^\n]*-i\s+"\$INTERVAL"/;
  assert.match(
    body,
    primaryRe,
    'Step 3b must invoke `gh run watch ... --exit-status -i "$INTERVAL"` so the poll cadence is driven by the --interval argument (not hard-coded)'
  );
  // Guard against hard-coded 30 sneaking into the canonical command — the
  // interval must come from the $INTERVAL variable so --interval can override.
  const hardCodedRe = /gh run watch[^\n]*-i\s+30\b/;
  assert.doesNotMatch(
    body,
    hardCodedRe,
    'watch-ci must not hard-code `-i 30` on gh run watch; use `-i "$INTERVAL"` so --interval actually overrides the default'
  );
});

test('watch-ci body still declares Monitor as the default streaming mode', () => {
  const { body } = splitSkill(readSkill());
  // Canonical positive patterns — each explicitly asserts Monitor=default with
  // no room for negation between the two tokens.
  const positivePatterns = [
    /Monitor\s+streaming\s+is\s+the\s+default/i,
    /Monitor\s*\(default\)/i,
    /default\s+is\s+Monitor\s+streaming/i,
  ];
  // Anti-default patterns — would invalidate a match even if a positive phrase
  // appears elsewhere in the same body.
  const antiDefaultPatterns = [
    /Monitor[^.\n]{0,40}(?:is\s+not|isn['’]t)[^.\n]{0,20}default/i,
    /Monitor[^.\n]{0,40}no\s+longer[^.\n]{0,20}default/i,
    /default[^.\n]{0,40}no\s+longer[^.\n]{0,20}Monitor/i,
  ];
  const hasPositive = positivePatterns.some((p) => p.test(body));
  const hasAntiDefault = antiDefaultPatterns.some((p) => p.test(body));
  assert.ok(
    hasPositive && !hasAntiDefault,
    `watch-ci body must keep Monitor as the default streaming mode (regression guard against reverting to blocking default). positive=${hasPositive} anti=${hasAntiDefault}`
  );
});
