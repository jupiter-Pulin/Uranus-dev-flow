# Jobs-to-be-Done (JTBD) — Three-Dimension Framework

Authoritative framework for `/ui-first-principles` Phase 3 (JTBD analysis), driving Phase 5 field decisions.

> **Source of truth**: This framework operationalises [requirements §FR-3](../../../docs/features/ui-first-principles/1-requirements.md). FR-3 mandates identifying **functional**, **emotional**, and **social** jobs. This file does not redefine those — it tells you **how to elicit and apply them**.

## The Three Dimensions

| Dimension | Question | Why it matters |
|-----------|----------|----------------|
| **Functional** | What is the user trying to **accomplish** in this scenario? | Without this, every other dimension is decoration. |
| **Emotional** | What does the user need to **feel** to complete the task confidently? | Drives trust signals, reassurance, urgency framing. |
| **Social** | What is the user trying to **signal** to others, or have others perceive about them? | Drives identity-bearing fields (avatars, badges, addresses). |

**You must analyse all three** for every scenario, even if some come back empty. When a dimension is genuinely empty, write the literal `none in this scenario` (matches `references/output-template.md`'s expected wording). The longer prose form `no significant social job in this scenario` reads naturally but is **non-canonical** — prefer the literal so downstream tooling can detect the empty-dimension case structurally.

---

## Phase 3 Output Template

```
### Functional Job
The user wants to <verb> <object> so they can <outcome>.
(Example: "confirm a transaction succeeded so they can move on with their next task")

### Emotional Job
The user needs to feel <emotion> because <source of friction>.
(Example: "feel certain the funds left their wallet because crypto transfers are irreversible")

### Social Job
The user wants others to perceive them as <signal>, or wants to display <attribute>.
(Example: "none in this scenario")
```

---

## Eliciting Each Dimension

### Functional — easiest

The functional job is usually directly stated in the scenario name:
- `transaction history list` → "review past transactions to verify or audit"
- `NFT detail page` → "evaluate whether to buy / display / transfer this NFT"
- `wallet balance dashboard` → "check liquidity before committing to an action"

If the functional job is unclear, ask: **"If the user could do only ONE thing on this screen, what would it be?"**

### Emotional — easy to overlook

Emotional jobs surface most clearly when there is **friction**:
- **Irreversibility** (sending crypto, signing contracts) → need to feel **certain**
- **Asymmetric loss** (security action, password change) → need to feel **safe**
- **Time pressure** (settlement window, auction end) → need to feel **calm and informed**
- **Foreign domain** (first-time user, technical concept) → need to feel **competent**
- **High stakes** (large amount, important counterparty) → need to feel **confirmed**

If you cannot articulate any emotional friction, the screen may genuinely have none — but verify by asking **"what could go wrong from the user's perspective, and what reassures them?"**

### Social — most often dismissed (incorrectly)

Social jobs are rarely "the main job" but they shape **which fields rise to primary**:
- Profile / identity screens: avatar, display name, role badge → social
- NFT collection / portfolio: rarity rank, collection prestige → social signalling
- Transaction record (public chain): wallet alias vs raw address → social (alias preserves anonymity vs reputation)

Even on private screens, social jobs may exist:
- "I want to be perceived as **financially competent**" → drives surfacing of net worth, allocation breakdown
- "I want to be perceived as **secure / careful**" → drives 2FA badges, recent-activity display

If absent: state it using the literal `none in this scenario` (matches `references/output-template.md` and is what downstream tooling detects). Avoid prose alternatives like "no significant social job in this scenario — confirmation is private"; explanatory text belongs in the rationale, not the dimension value.

---

## Web3 / Crypto Scenario Specialisation

Crypto/Web3 scenarios have **unique JTBD patterns** worth naming explicitly:

| Web3 trigger | Likely emotional job | Likely social job |
|--------------|---------------------|-------------------|
| Sending tokens | "irreversibility anxiety — want to feel certain destination is correct" | (often none in confirmation, but counterparty alias matters for activity log) |
| Signing transactions | "trust gap — what does this signature actually authorise?" | "want to appear technically competent — don't want to look confused" |
| NFT viewing | "novelty / aesthetic appreciation" | "identity signalling — collection membership, rarity, provenance" |
| DEX swap quote | "FOMO + fear of slippage" | (usually none — execution is private) |
| Wallet onboarding | "competence anxiety — afraid of losing keys" | "want to be perceived as legitimate user, not a bot" |
| Portfolio / dashboard | "loss anxiety after market moves" | "competence display — proof of holdings, allocation strategy" |

**Anti-pattern signal**: a Web3 scenario that surfaces **only functional fields** (raw hex address, raw amount in wei) usually fails the emotional dimension — users cannot **feel certain** about a 42-character hex string. Surfacing a derived form (alias, formatted decimal) is an emotional-job intervention, not a styling preference.

---

## Mapping JTBD to Field Priority

Each identified job dictates which fields become `primary`. **Social fields obey a context rule** — promote to `primary` only when identity/status is central to the scenario; otherwise demote to `secondary` or `on_demand` (see `references/principle-anchors.md` § JTBD lever table for the canonical rule):

| Job dimension | Field examples | Default disposition |
|---------------|----------------|---------------------|
| Functional | The state the user is checking or the action they are performing | `primary` |
| Emotional | Reassurance signals (confirmation count, alias, derived friendly form) | `primary` |
| Social — identity-driven scenario (NFT detail, profile, public activity) | Avatar, badge, alias, rarity, ENS name | `primary` |
| Social — non-identity scenario (private confirm, dashboard) | Same fields | `secondary` or `on_demand` |

A field **without** a JTBD anchor is a candidate for `hidden` or `on_demand` — it may exist in the API for technical reasons (gasUsed, raw signature, internal IDs) but does not earn screen real estate.

---

## Common Mistakes

| Mistake | Symptom | Fix |
|---------|---------|-----|
| Conflating functional with emotional | "Functional job: feel safe" | Functional jobs use action verbs (`verify`, `confirm`, `select`); emotional jobs name feelings (`feel certain`, `feel calm`) |
| Inventing a social job that does not exist | "Social: user wants to display they paid the gas fee" (false) | Empty social job is fine — say `"none in this scenario"` |
| Functional job written as a feature | "Functional job: see a transaction history list" (tautological) | Write outcome, not feature: "audit past transactions to detect unauthorised activity" |
| Skipping JTBD entirely and jumping to fields | Phase 5 rationale invokes no JTBD anchors | Phase 5 audit rule: every primary field's rationale must trace back to a job stated in Phase 3 |

---

## Cross-References

- Whitelist enforcement: `references/principle-anchors.md` § JTBD section + Phase 7 `validate-report.js`
- Anti-pattern interaction: `scenario_field_mismatch` and `pure_aesthetic_over_utility` in `references/anti-patterns.md` are direct JTBD violations
- Output structure: `references/output-template.md` § JTBD section
