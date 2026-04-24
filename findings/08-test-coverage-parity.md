# Dimension 8: Test Coverage Parity

## Summary

Test coverage across the 8 Sabre services shows good structural parity in test file presence and basic test categories, but reveals two significant gaps:

1. **Assertions tests are exclusive to booking-management-v1.** Seven services lack dedicated assertions tests for business logic validation (error categorization, required-field checks). Only booking-management-v1 has an `assertions.test.ts` file testing its `assertBookingSucceeded` function.

2. **Error path testing variance.** Simple lookup services (airline-alliance, airline-lookup, multi-airport-city) test JSON parsing errors consistently. However, more complex services (bargain-finder-max, get-seats, revalidate-itinerary, get-ancillaries) have incomplete or inconsistent error path coverage relative to their mapper complexity.

Service test coverage is appropriate to operation complexity — single-operation services have 2-3 service-level tests; booking-management-v1 with 8 operations has 17. Mapper line count variance (144 lines for airline-lookup vs. 2045 for booking-management) is justified by feature richness, not testing gaps.

## Findings

### 1. Assertions tests missing from 7 services — all

**Where:** 7 services have no `assertions.test.ts`; only `booking-management-v1/assertions.test.ts` exists

**What:** Booking Management v1 is the only service with dedicated tests for assertions functions (`assertBookingSucceeded`, `defaultBookingHardFailurePredicate`). All 7 other services lack assertions files entirely, meaning any error-categorization or required-field validation logic in those services (if present) is not tested in isolation.

**Severity:** should-fix

**Proposed fix:** Audit each service's mappers and types to identify whether business-logic assertions exist (e.g., checks for required response fields, error categorization). If present, create `assertions.test.ts` files for affected services and test them in isolation.

### 2. JSON parse error tests inconsistent across services — mappers

**Where:** Services vary in which JSON error cases they cover in mapper tests:
- `airline-alliance-lookup-v1`, `airline-lookup-v1`, `multi-airport-city-lookup-v1`: cover "non-JSON string" (e.g., HTML) 
- `bargain-finder-max-v5`, `revalidate-itinerary-v5`: do NOT test non-JSON body case
- `get-ancillaries-v2`, `get-seats-v2`: test only null/array cases, not HTML-like strings
- `booking-management-v1`: tests null/array but uses a different assertion pattern (no "throws SabreParseError when the body is not valid JSON" test)

**What:** Simpler services consistently test that malformed (non-JSON string) response bodies throw `SabreParseError`. More complex services either skip this test entirely (bargain-finder-max, revalidate-itinerary) or test only edge cases like null/array payloads. This creates asymmetric coverage: a developer adding a new simple lookup service would copy the complete error path pattern, but adding a complex service like BFM might miss the non-JSON case.

**Severity:** should-fix

**Proposed fix:** Standardize JSON error testing across all services: every mapper response test should cover (1) non-JSON string body, (2) null body, (3) array body. Add missing tests to bargain-finder-max-v5, revalidate-itinerary-v5, and align booking-management-v1 to use a consistent test title pattern.

### 3. Service-level test operations coverage incomplete — booking-management-v1

**Where:** `booking-management-v1/service.test.ts` has 8 operation describe blocks and 17 it() blocks; only 2-3 tests per operation on average

**What:** Each operation (createBooking, getBooking, modifyBooking, cancelBooking, fulfillTickets, voidTickets, checkTickets, refundTickets) has ~2 tests: typically one happy path and one error path. No edge cases are tested at the service level (e.g., missing optional fields, unusual response shapes). Contrast this with mapper tests, which have 130 test cases and cover missing fields, unresolved references, and partial data.

**Severity:** nice-to-have

**Proposed fix:** This is low-severity because mapper tests carry the edge-case load. If service-level tests were extended, consider: (1) test each operation with minimal required input only, (2) test each operation with all optional fields populated, (3) test API response error handling per operation (e.g., 400, 500 status codes with different error body shapes).

### 4. Multi-operation services lack operation-level test parity — bargain-finder-max-v5, revalidate-itinerary-v5

**Where:** `bargain-finder-max-v5/mappers.test.ts` contains 35 test cases but splits them across 3 describe blocks. `revalidate-itinerary-v5/mappers.test.ts` has 14 test cases across 2 blocks.

**What:** These complex services organize mapper tests into request, response, and (for BFM) offer tests, rather than by operation or flavor. Bargain Finder Max v5 only has one operation (`search`), but internally maps two distinct request/response types (shop + offer); revalidate-itinerary-v5 has one operation with one mapper pair. This organization is semantically correct, but the describe block structure differs from single-operation services (airline-lookup, airline-alliance), which describe the mapper function directly. No inconsistency in *what* is tested, but organization is less uniform.

**Severity:** none

**Proposed fix:** No action required. The structure is justified by complexity: multi-internal-flavor mappers need describe block organization by flavor/intent, not by operation (which doesn't exist as a variable).

## Non-Findings

- **Test file presence:** All 8 services have `mappers.test.ts` and `service.test.ts`. Booking-management-v1 uniquely has `assertions.test.ts`, which is appropriate to its error-handling complexity. Parity in structure achieved.
- **Service operation test coverage:** Single-operation services (7) are tested once at service level. Booking-management-v1 (8 operations) is tested comprehensively per operation. No asymmetry — each service's test count matches its operation count.
- **Happy path mapper tests:** All services test at least one success case mapping request and response. No service is missing happy path coverage.
- **Empty/missing field handling:** All services' mapper tests cover at least some cases of missing optional fields (empty arrays, absent objects, null fields). Consistent approach across services.
- **Bearer auth and headers:** All service-level tests mock fetch and verify Authorization and Accept headers. Consistent pattern across all 8 services.
- **Fixture richness:** Services vary in fixture complexity (single lookup vs. booking with multiple nested structures), but this is justified by API endpoint richness and not a parity issue.

