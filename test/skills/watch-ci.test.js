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

test('watch-ci body documents --interval argument with default 30 seconds in Arguments section', () => {
  const { body } = splitSkill(readSkill());
  // Scope to the `## Arguments` section so an example table elsewhere can't
  // false-pass this invariant. The section ends at the next `## ` heading, or
  // at end-of-file if `## Arguments` is the last section.
  const argsSectionRe = /\n## Arguments\n([\s\S]*?)(?=\n## |$)/;
  const argsSection = body.match(argsSectionRe)?.[1] ?? '';
  assert.ok(argsSection.length > 0, 'SKILL.md must retain a `## Arguments` section');
  const rowRe = /^\|\s*`--interval\s+<sec>`\s*\|[^\n]*\|\s*30\s*\|/m;
  assert.match(
    argsSection,
    rowRe,
    'watch-ci Arguments section must document `--interval <sec>` with Default = 30 (noise-reduction regression guard)'
  );
});

test('watch-ci declares INTERVAL=${ARG_INTERVAL:-30} in Step 1 Resolve Target so --interval can override the default', () => {
  const { body } = splitSkill(readSkill());
  // AC #1 — argument-driven resolution. Scope the assertion to the Step 1
  // (Resolve Target) fenced bash block so an example snippet elsewhere in the
  // doc cannot false-pass this invariant. Mirrors the Step 3b scoping pattern.
  const stepRe = /### Step 1: Resolve Target[^\n]*\n([\s\S]*?)(?=\n### |\n## )/;
  const step = body.match(stepRe)?.[1] ?? '';
  assert.ok(step.length > 0, 'SKILL.md must retain a `### Step 1: Resolve Target` section');
  const bashBlockRe = /```bash\n([\s\S]*?)\n```/;
  const bashBlock = step.match(bashBlockRe)?.[1] ?? '';
  assert.ok(bashBlock.length > 0, 'Step 1 must contain a fenced bash command block');
  assert.match(
    bashBlock,
    /^\s*INTERVAL=\$\{ARG_INTERVAL:-30\}\s*$/m,
    'Step 1 bash block must declare `INTERVAL=${ARG_INTERVAL:-30}` so --interval arg flows into gh run watch -i'
  );
});

// Shared helper for the two mode-consistency tests below. Extracting it keeps
// each individual test under the 7-assertion budget from @rules/testing.md.
// Accepts the Unicode em dash (`—`) or an ASCII hyphen (`-`) as the separator
// before `behavior`, so cosmetic punctuation tweaks do not cause false failures.
function extractModeSections(body) {
  const sectionRes = {
    Monitor: /\*\*Monitor mode[^*]*[—-]\s*behavior\*\*:\n([\s\S]*?)(?=\n\*\*|\n## )/,
    Foreground: /\*\*Foreground mode[^*]*[—-]\s*behavior\*\*:\n([\s\S]*?)(?=\n\*\*|\n## )/,
    Background: /\*\*Background mode[^*]*\*\*:\n([\s\S]*?)(?=\n\*\*|\n## )/,
  };
  const sections = {};
  for (const [mode, re] of Object.entries(sectionRes)) {
    sections[mode] = body.match(re)?.[1] ?? '';
  }
  return sections;
}

test('watch-ci Monitor/Foreground/Background mode sections each invoke -i "$INTERVAL" (AC #3)', () => {
  const { body } = splitSkill(readSkill());
  // AC #3 positive leg — each mode's behavior block must exist AND use the
  // same $INTERVAL wiring; a silent revert in any one mode would break UX
  // consistency.
  const sections = extractModeSections(body);
  const intervalWiringRe = /gh run watch[^\n]*--exit-status[^\n]*-i\s+"\$INTERVAL"/;
  for (const [mode, section] of Object.entries(sections)) {
    assert.ok(section, `${mode} mode behavior block must exist in SKILL.md`);
    assert.match(
      section,
      intervalWiringRe,
      `${mode} mode must invoke \`gh run watch ... --exit-status -i "$INTERVAL"\` for three-mode consistency (AC #3)`
    );
  }
});

test('watch-ci mode sections must not hard-code a numeric -i (AC #3 anti-regression)', () => {
  const { body } = splitSkill(readSkill());
  // AC #3 negative leg — scoped to the canonical mode behavior command blocks
  // only. A global sweep would false-fail on explanatory prose that
  // legitimately mentions `gh run watch ... -i 3` as an example.
  const sections = extractModeSections(body);
  const hardCodedRe = /gh run watch[^\n]*-i\s+\d+\b/;
  for (const [mode, section] of Object.entries(sections)) {
    assert.doesNotMatch(
      section,
      hardCodedRe,
      `${mode} mode must not hard-code a numeric interval (e.g. \`-i 30\`); use \`-i "$INTERVAL"\` so --interval actually overrides it`
    );
  }
});

test('watch-ci documents the 3s-vs-30s poll-interval trade-off (rationale guard)', () => {
  const { body } = splitSkill(readSkill());
  // AC #4 — the trade-off justification must stay visible so future maintainers
  // can't silently regress the default without acknowledging the impact. Scope
  // the check to the `**Poll interval**` paragraph so deleting the rationale
  // block would actually fail the test (a global sweep would false-pass when
  // the two numbers happen to appear anywhere else in the doc).
  const paragraphRe = /\*\*Poll interval\*\*[^\n]*\n([\s\S]*?)(?=\n\n|\n## |\n### )/;
  const paragraph = body.match(paragraphRe)?.[0] ?? '';
  assert.ok(
    paragraph.length > 0,
    'SKILL.md must retain a `**Poll interval**` paragraph documenting the trade-off'
  );
  assert.match(
    paragraph,
    /\b30\s*second/i,
    'Poll interval paragraph must state the 30-second default'
  );
  assert.match(
    paragraph,
    /\b3\s*second/i,
    'Poll interval paragraph must mention gh\'s 3-second baseline for comparison'
  );
  assert.match(
    paragraph,
    /(poll\w*|notification|lag|completion-detection|noisy|cost)/i,
    'Poll interval paragraph must frame the change as a trade-off (poll/notification/lag rationale)'
  );
});

test('watch-ci frontmatter allowed-tools includes Bash(gh:*) to cover gh run watch -i', () => {
  const { frontmatter } = splitSkill(readSkill());
  // AC #5 — verifies the existing permission grant truly covers `gh run watch -i`
  // without requiring a hook change. If someone narrows `Bash(gh:*)` to a more
  // specific pattern (e.g. `Bash(gh run:*)`) we want the test to flag it so the
  // interval flag isn't silently rejected at runtime.
  const tools = allowedTools(frontmatter);
  assert.ok(
    tools.includes('Bash(gh:*)'),
    `allowed-tools must include \`Bash(gh:*)\` so \`gh run watch -i "$INTERVAL"\` runs under existing permission grant (got: ${tools.join(', ') || '<empty>'})`
  );
});

test('watch-ci Step 3b threads $INTERVAL into the gh run watch command', () => {
  const { body } = splitSkill(readSkill());
  // Scope to the Step 3b canonical command block so unrelated explanatory
  // prose (which may legitimately reference `gh run watch -i 3` as an example)
  // doesn't interfere with this invariant. The block is the fenced bash block
  // immediately under the `### Step 3b: Watch Runs` heading.
  const stepRe = /### Step 3b[^\n]*\n([\s\S]*?)(?=\n### |\n## )/;
  const step = body.match(stepRe)?.[1] ?? '';
  assert.ok(step.length > 0, 'SKILL.md must retain a `### Step 3b` section');
  const bashBlockRe = /```bash\n([\s\S]*?)\n```/;
  const bashBlock = step.match(bashBlockRe)?.[1] ?? '';
  assert.ok(bashBlock.length > 0, 'Step 3b must contain a fenced bash command block');
  assert.match(
    bashBlock,
    /gh run watch[^\n]*--exit-status[^\n]*-i\s+"\$INTERVAL"/,
    'Step 3b bash block must invoke `gh run watch ... --exit-status -i "$INTERVAL"` so the poll cadence is driven by the --interval argument (not hard-coded)'
  );
  assert.doesNotMatch(
    bashBlock,
    /gh run watch[^\n]*-i\s+\d+\b/,
    'Step 3b bash block must not hard-code a numeric `-i <N>` on gh run watch; use `-i "$INTERVAL"` so --interval actually overrides the default'
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
