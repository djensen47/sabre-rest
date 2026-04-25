# Code Audit — 2026-04-24

A cross-cutting review of `src/services/*` and the shared infrastructure
around them, completed 2026-04-24. The goal was a punch list of small,
revertable improvements — not a single mega-PR.

Future audits should follow the same date-stamped filename pattern
(`docs/code-audit-YYYY-MM-DD.md`) so this report stays a snapshot in
time rather than drifting as the codebase evolves.

## What was checked

Nine dimensions, each a focused read-only pass across all 8 services
(airline-alliance, airline-lookup, multi-airport-city, BFM, revalidate,
get-ancillaries, get-seats, booking-management):

1. Deduplication opportunities (cautious — never merge on "looks the
   same today"; only when the OAS uses the same `$ref`).
2. OOP guideline compliance (rules in `docs/architecture.md`).
3. Generated types staying internal (hard rule from `docs/decisions.md`).
4. Public type design rule compliance.
5. Cross-service drift (file layout, naming, mapper signatures, test
   structure).
6. Mapper purity & symmetry.
7. Public surface hygiene (`src/index.ts`).
8. Test coverage parity (consistency, not 100%).
9. Error handling consistency.

## Outcome

The codebase came out in **good shape**. Of the 9 dimensions, 4 had
zero findings (OOP, generated-types-internal, mapper purity, public
surface), 1 had a single finding resolved as documentation, and the
rest produced small hygiene items.

### Shipped

| Tier | Item | PR |
|---|---|---|
| 1 (must-fix) | Extract `ensureTrailingSlash` to a shared utility | [#66](https://github.com/djensen47/sabre-rest/pull/66) |
| 2 (should-fix) | Extract `okResponse` test helper | [#68](https://github.com/djensen47/sabre-rest/pull/68) |
| 2 (should-fix) | Document BFM/Revalidate intentional type duplication | [#69](https://github.com/djensen47/sabre-rest/pull/69) |
| 2 (should-fix) | Document the assertions-module rationale | [#69](https://github.com/djensen47/sabre-rest/pull/69) |
| 2 (should-fix) | Standardize JSON-parse error tests across services | [#71](https://github.com/djensen47/sabre-rest/pull/71) |
| 3 (nice) | Document mapper function naming convention | [#70](https://github.com/djensen47/sabre-rest/pull/70) |
| 3 (nice) | Document booking's stricter array-rejection | [#70](https://github.com/djensen47/sabre-rest/pull/70) |
| 3 (nice) | Document BFM/Revalidate envelope validation depth | [#70](https://github.com/djensen47/sabre-rest/pull/70) |

The audit working docs (synthesis + 9 dimension files) lived under
`findings/` and were removed alongside this wrap-up. Their contents
are preserved in the git history at the merge of
[#65](https://github.com/djensen47/sabre-rest/pull/65) and the PRs
above.

### Dropped

Two Tier-3 items were intentionally not shipped:

- **Document the request-input optionality variance** — the per-service
  JSDoc already covers it; the synthesis flagged this as "could drop
  entirely."
- **Thicken booking-management-v1 service-level tests** — mapper tests
  carry the edge-case load (130+ test cases). Synthesis tagged this
  "small marginal gain"; appetite did not materialize.

## Methodology (for any future round)

The shape worked well and is worth repeating verbatim if a similar
review is run later:

1. **Read-only investigation, one dimension at a time.** No source
   changes during this phase — the only writes are findings files.
2. **Findings as individual files** under `findings/`, one per
   dimension. Self-contained so each can be read without conversation
   context.
3. **Cadence: calibration + waves.** Run dimension 1 solo to validate
   the prompt template, then fan out the rest in waves of 3 parallel
   read-only Explore subagents.
4. **Synthesis pass.** Read all findings together; deduplicate
   overlaps, reconcile cross-dimension tags, prioritize by severity ×
   effort × risk.
5. **Action PRs by theme, one at a time.** Bundle doc-only items;
   keep behavior-changing items separate.
6. **Sabre is finicky.** Never deduplicate on the basis of "looks the
   same today" — see the BFM/Revalidate intentional duplication
   ([#69](https://github.com/djensen47/sabre-rest/pull/69)) for why.
   When in doubt, leave the duplication.

### Finding template (for next time)

Per finding inside a dimension file:

```
### short title — service(s)

**Where:** `src/services/foo/mappers.ts:123`
**What:** description of the issue
**Severity:** must-fix / should-fix / nice-to-have
**Belongs in:** Dimension N (only if more naturally a different dimension)
**Proposed fix:** brief sketch (or "TBD")
```

Cross-dimension findings stay where they were spotted (with a
`Belongs in:` tag); the synthesis pass reconciles. Findings with
severity `none` go in a "Non-Findings" list at the bottom of each
dimension file — useful for documenting what was checked, but not
part of the punch list.
