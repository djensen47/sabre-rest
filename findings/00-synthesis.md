# Audit Synthesis

Reconciles all 9 dimension findings into a single prioritized punch
list. This is the source of truth for the implementation phase
(methodology step 5).

## How this was produced

1. Re-read all 9 dimension files.
2. Resolved cross-dimension overlaps (the `**Belongs in:** Dimension N`
   tags pointed at these explicitly).
3. Closed two open questions left by the wave passes:
   - **BFM/Revalidate `$ref` check.** Both specs define
     `PassengerTypeQuantity` and related shapes as inline schemas
     under their operations (BFM lines 6611, 7727; Revalidate lines
     4572, 5748). No cross-file `$ref`s exist between the two specs.
     The 14 "duplicated" types are backed by **different `$ref`s in
     independent specs** — per the rule, do not consolidate.
   - **Booking-mgmt mapper purity gap.** Full-file scan across 3,018
     lines of `booking-management-v1/mappers.ts`: zero console/logger
     calls, zero `Date.now`/`new Date`, zero randomness, zero input
     mutation, zero file/network. The spot-check conclusion was
     correct.
4. Prioritized by severity × effort × risk.

## Reconciled overlaps

- **ensureTrailingSlash duplication.** D1 #1 (must-fix) is canonical;
  D5 #5 was tagged `Belongs in: Dimension 1`. Treated as one item.
- **Assertions module / tests asymmetry.** D5 #1 (file-layout drift:
  only booking has `assertions.ts`) and D8 #1 (only booking has
  `assertions.test.ts`) are two views of the same situation.
  Combined into one item. The OOP audit (D2 #7 in non-findings)
  established that `SabreBookingErrorResponseError` is justified by
  booking's HTTP-200-with-errors quirk, so the assertions module is
  intentionally booking-specific — the action is to **document the
  rationale**, not to scaffold assertions in the other 7 services.
- **Test line-count variance.** D5 #4 was tagged
  `Belongs in: Dimension 8`. D8 then concluded the variance is
  justified by complexity. Dropped from the punch list.
- **JSON parse pattern.** D1's non-finding documents that the
  pattern is intentionally distributed. D9 #2's "envelope
  validation depth" variance and D8 #2's "JSON parse error tests
  inconsistent" both touch this area but at different levels (impl
  vs test). Both retained as distinct items.

## Punch list (prioritized)

Checkbox marks shipping status. PR number appears next to items that
have landed on `main`.

### Tier 1 — must-fix

- [x] **T1.1. Extract `ensureTrailingSlash` to a shared utility.** — shipped in #66.
  - Source: D1 #1.
  - Where: all 8 services' `mappers.ts` define this 3-line pure
    function identically.
  - Action: extract to `src/http/ensure-trailing-slash.ts`, import in
    each mapper, delete the local copies.
  - Risk: minimal — pure function, no per-service variation.
  - Estimated PR size: small (8 file edits + 1 new file + 1 test).

### Tier 2 — should-fix

- [x] **T2.1. Extract `okResponse` test helper to a shared test util.** — shipped in #68
  - Source: D1 #2.
  - Where: all 8 services' `mappers.test.ts` (line numbers in D1 file).
  - Action: extract to `src/http/test-utils.ts` (or `src/testing.ts`),
    import in each test file, delete local copies.
  - Risk: minimal — test-only code.
  - Estimated PR size: small (8 test file edits + 1 new file).

- [x] **T2.2. Document the BFM/Revalidate intentional type duplication.** — shipped in #XXXX.
  - Source: D4 #1, with `$ref` verification (above) confirming
    independent specs.
  - Where: top of `bargain-finder-max-v5/types.ts` and
    `revalidate-itinerary-v5/types.ts`.
  - Action: add a doc comment explaining that the 14 structurally
    identical types (PassengerCount, PassengerFare, PricedItinerary,
    FareComponent, FareComponentSegment, Tax, BaggageAllowance,
    BaggageCharge, ItineraryLeg, FlightSegment, SegmentEndpoint,
    TotalFare, PointOfSale, FareOffer, SabreMessage) are intentionally
    duplicated because each spec defines them as independent inline
    schemas. Note that diverging shapes are an explicit possibility,
    not a bug. Reference `docs/architecture.md` Public type design
    rule #1.
  - Risk: doc-only, zero behavior change.
  - Estimated PR size: small (2 file edits, comment blocks only).

- [x] **T2.3. Document the assertions-module rationale.** — shipped in #XXXX.
  - Source: D5 #1 + D8 #1 (combined).
  - Where: top of `booking-management-v1/assertions.ts`.
  - Action: add a doc comment explaining that this module exists
    because Sabre booking responses can return HTTP 200 with hard
    failures in `errors[]` — a quirk specific to this API. Document
    the criterion under which other services should add an analogous
    module ("only when the upstream API has a similar
    success-status-with-failure-payload pattern"). This closes the
    "is this drift?" question without scaffolding empty assertion
    files in the other 7 services.
  - Risk: doc-only, zero behavior change.
  - Estimated PR size: tiny (1 file edit, comment block only).

- [ ] **T2.4. Standardize JSON-parse error tests across services.**
  - Source: D8 #2.
  - Where: each service's `mappers.test.ts`.
  - Action: for each service, add the missing parse-error categories
    (non-JSON string body, null, array) per D8's matrix. Aim for the
    same 3-4 negative-path tests per service.
  - Risk: low — additive tests only.
  - Estimated PR size: small-medium (~8 test files, ~3 tests each).

### Tier 3 — nice-to-have

- [ ] **T3.1. Document the mapper function naming convention.**
  - Source: D5 #2.
  - Where: `docs/architecture.md` (mapper section).
  - Action: add a paragraph explaining that mapper function names
    follow the operation's natural verb/noun (e.g., `toLookupRequest`,
    `toCreateBookingRequest`) rather than a mechanical pattern.

- [ ] **T3.2. Document the request-input optionality variance.**
  - Source: D5 #3.
  - Where: existing service-method JSDoc already covers this. D5
    flagged it as informational only ("no fix needed"). Defer; could
    drop entirely.

- [ ] **T3.3. Thicken booking-management-v1 service-level tests.**
  - Source: D8 #3.
  - Where: `booking-management-v1/service.test.ts`.
  - Action: add edge-case tests at the service level for each of the
    8 operations (currently ~2 tests per operation). Mapper tests
    carry the bulk of coverage so this is a small marginal gain.

- [ ] **T3.4. Document booking's stricter array-rejection.**
  - Source: D9 #1.
  - Where: doc comment in `booking-management-v1/mappers.ts` near the
    `Array.isArray()` check, OR in `assertions.ts` if the rationale
    fits there.
  - Action: explain why booking explicitly rejects array responses
    while other services accept them (because booking endpoints
    always return objects, not arrays).

- [ ] **T3.5. Document BFM/Revalidate envelope validation depth.**
  - Source: D9 #2.
  - Where: doc comment near the `groupedItineraryResponse` validation
    in each mapper.
  - Action: brief note explaining the deeper validation reflects the
    OTA-style nested response shape.

## Suggested action PR sequence

The PRs are mostly independent. A natural shipping order:

1. ~~**PR 1: T1.1** — `ensureTrailingSlash` extraction.~~ **Shipped in #66.**
2. ~~**PR 2: T2.1** — `okResponse` test helper extraction. Same pattern,
   same risk profile, can land independently.~~
3. ~~**PR 3: T2.2 + T2.3** (bundle) — both are doc-only edits that
   document intentional duplication / specialization. Bundling makes
   sense since neither changes behavior.~~ **Shipped in #XXXX.**
4. **PR 4: T2.4** — JSON-parse-error test standardization. Touches
   8 test files but is purely additive.
5. **PR 5: T3.1 + T3.4 + T3.5** (bundle) — documentation cluster
   in architecture.md and mapper comments.
6. **PR 6: T3.3** (optional) — thicker booking service tests, only
   if appetite exists.
7. **Drop T3.2** unless the user wants it.

Remaining expected PRs: 4–5. All small.

## Overall assessment

The codebase is in **good shape**. Of 9 dimensions audited:
- 4 had zero findings (OOP, generated-types-internal, mapper purity,
  public surface).
- 1 had one substantive finding (public type rules, resolved as
  documentation rather than consolidation).
- The rest had small, addressable items.

There are no architectural problems. The findings are mostly small
hygiene improvements and documentation gaps. The single must-fix
(`ensureTrailingSlash`) is ~10 minutes of work.
