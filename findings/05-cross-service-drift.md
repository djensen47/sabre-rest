# Dimension 5: Cross-Service Drift

## Summary

Minimal drift found across services — architecture discipline is strong. The most significant issue is **file-layout drift in booking-management-v1** (only service with assertions), and **test-line-count variance** suggesting uneven coverage depth. All services follow a consistent mapper function pattern, consistent test structure (imports, describe blocks), and consistent type-naming conventions (Input/Output). A few minor inconsistencies in mapper function naming and parameter optionality are documented below.

---

## Findings

### 1. File layout: assertions.ts missing in 7 of 8 services — booking-management-v1

**Where:** `src/services/booking-management-v1/`; absent from all other 7 services

**What:** Only `booking-management-v1` has `assertions.ts` (98 lines) and `assertions.test.ts` (74 lines). The file exports `assertBookingSucceeded()` and related helpers. The spec has complex `errors[]` handling that benefits from an opt-in assertion helper, but it's unclear whether other services *should* also have assertion files or whether this is intentional specialization.

**Severity:** should-fix

**Proposed fix:** Document the rationale in a code comment in `booking-management-v1/assertions.ts` (is this file specific to booking's error-handling quirk, or should all services follow the pattern?). If pattern-worthy, scaffold assertions for services that handle complex response validation; if booking-specific, leave as-is.

---

### 2. Mapper function naming inconsistency: no stable prefix pattern

**Where:** All 8 services' mappers.ts

**What:** Mapper function names vary inconsistently:
- Lookup-style services use `toLookupRequest()` + `fromLookupResponse()` (airline-alliance-lookup, airline-lookup, multi-airport-city-lookup)
- Search-style services use `toSearchRequest()` + `fromSearchResponse()` (bargain-finder-max)
- Explicit-operation names: `toCreateBookingRequest()`, `toGetBookingRequest()`, etc. (booking-management)
- Abbreviated names: `toGetAncillariesRequest()`, `toGetSeatsRequest()`, `toRevalidateRequest()`

The naming follows the operation's semantic meaning rather than a fixed pattern (good for readability), but a reader scanning multiple services has no predictable mapping-function name to look for.

**Severity:** nice-to-have

**Proposed fix:** Document the convention in `docs/architecture.md` → Generated types section: "Mapper function names reflect the operation name for clarity; e.g., `toLookupRequest()` for a lookup operation, `toCreateBookingRequest()` for a create-booking operation. No mechanical derivation — rely on the operation's natural verb/noun."

---

### 3. Mapper parameter optionality drift: inconsistent input? handling

**Where:** `src/services/airline-alliance-lookup-v1/mappers.ts:22` vs. booking-management-v1 multi-operation methods

**What:** 
- `toLookupRequest(baseUrl, input?: LookupAirlineAlliancesInput)` – input is optional
- `toCreateBookingRequest(baseUrl, input: CreateBookingInput)` – input is required
- `toRevalidateRequest(baseUrl, input: RevalidateItineraryInput)` – input is required

Lookup services naturally accept optional input (no codes = return all); booking and revalidate require input. Each service's choice matches its operation's semantics. Not a bug, but a reader scanning service.ts files will see both patterns without a clear rule.

**Severity:** nice-to-have

**Proposed fix:** Document this in JSDoc on the service method: "Optional input (omit or pass empty array to retrieve all); required input (call will fail if omitted)." Already present in service.ts docs, so this is informational drift only — no fix needed.

---

### 4. Test file line-count variance: uneven mapper coverage depth

**Where:** All services; summary:
- airline-alliance-lookup-v1: 245 lines (service + mappers)
- airline-lookup-v1: 216 lines
- multi-airport-city-lookup-v1: 255 lines
- get-ancillaries-v2: 325 lines
- revalidate-itinerary-v5: 617 lines
- get-seats-v2: 642 lines
- bargain-finder-max-v5: 1577 lines
- booking-management-v1: 2825 lines

**What:** BFM and Booking have 5–10x more test coverage than lookup services. BFM tests complex itinerary assembly (multiple pricingInfo variants, baggage rules, etc.). Booking tests 8 operations with varied response shapes. Lookups are simpler (one operation, small response). The variance is justified by complexity but makes it hard to spot coverage gaps: are lookup services under-tested or appropriately tested for their simplicity?

**Severity:** nice-to-have

**Belongs in:** Dimension 8 (test coverage parity) — line-count variance is a coverage-parity signal more than a drift signal.

**Proposed fix:** Add a `test-coverage-baseline.md` in docs/ that lists expected test patterns by operation complexity: "Simple GET lookups: ~150–200 lines (mappers + service). Multi-step operations or OTA-style envelopes: 300–500+ lines." Use this as a checklist when adding new services.

---

### 5. Helper function duplication: ensureTrailingSlash replicated in all 8 services

**Where:** `src/services/*/mappers.ts` (each defines its own private function)

**What:** All 8 services define `function ensureTrailingSlash(url: string): string` identically. This is internal to each mappers.ts module and not exported, so no public-surface pollution, but the duplication is unnecessary.

**Severity:** nice-to-have

**Belongs in:** Dimension 1 (deduplication) — this is identical-code repetition, the canonical dedup signal.

**Proposed fix:** Extract to a shared `src/internal/http-url-utils.ts` and import from there. The win is small (8 lines of duplication) and the risk of centralizing is if a future service needs a variant. Decide during synthesis whether the consolidation is worth it.

---

## Non-Findings (drift checked, none found)

- **Mapper signature shape:** All `to*Request()` return `SabreRequest` with `baseUrl` as first param. All `from*Response()` take `SabreResponse` and return the public Output type.
- **Import organization:** All services use namespace import `import * as mappers` in service.ts.
- **Type export patterns:** No I-prefixed interfaces; all public types exported from types.ts.
- **Generated type usage:** Generated types used only in mappers.ts (via `components` import) and not re-exported.
- **Test structure:** All services follow identical patterns — `describe`/`it` layout, fixture loading, and the `import { describe, expect, it } from 'vitest'` + `okResponse` helper convention.
- **Service method naming:** All services use `<Operation>Input` / `<Operation>Output` type names, `<ApiName>Service` interfaces, and `Default<InterfaceName>` implementation classes.
- **Mapper response error handling:** All `from*Response()` handlers follow the same `JSON.parse` → typeof check → throw `SabreParseError` pattern.

