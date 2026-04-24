# Error Handling Consistency (Dimension 9)

## Summary

All 8 services uniformly throw Sabre error subclasses through the shared hierarchy with consistent metadata. Two findings flag inconsistencies in validation patterns: booking-management-v1 explicitly rejects arrays in JSON parsing (while others tolerate them), and bargain-finder-max-v5 + revalidate-itinerary-v5 check for missing required envelope fields at a level other services do not. No service throws raw `Error` objects. Error wrapping in mappers (try-catch around JSON.parse) is comprehensive and uniform. Network and timeout errors are translated consistently by the http chain. The audit confirms full adherence to the shared error hierarchy as declared in decisions.md: all `SabreParseError` throws include responseBody, all JSON parse failures include cause, and error messages follow service-specific naming conventions.

## Findings

### 1. Inconsistent array rejection in response validation — booking-management-v1

**Where:** `src/services/booking-management-v1/mappers.ts:225, 300, 374, 475, 579, 657, 2742, 2951`

**What:** Booking Management v1 explicitly checks `Array.isArray(parsed)` and throws SabreParseError when the response body is an array. All other services (7 of 8) check only `typeof parsed !== 'object'` and `parsed === null`, which technically allows arrays (arrays are typeof `object` in JavaScript). This creates inconsistent resilience: BM v1 rejects `[]` or `[{}]` responses while other services would attempt to process them.

**Severity:** nice-to-have

**Proposed fix:** Align all services on one approach. Either (a) add `Array.isArray(parsed)` to all services that accept JSON objects as responses, or (b) remove it from BM v1 if arrays are genuinely impossible per the OAS. Check the BookingManagement spec to determine if responses can ever be arrays; if not, the check is defensive but non-standard. If yes, add to others for consistency.

---

### 2. Deep envelope validation only in OTA-style responses — bargain-finder-max-v5, revalidate-itinerary-v5

**Where:** `src/services/bargain-finder-max-v5/mappers.ts:170-174` (checks `groupedItineraryResponse`), `src/services/revalidate-itinerary-v5/mappers.ts:146-150` (same check)

**What:** BFM v5 and Revalidate v5 throw SabreParseError if `parsed.groupedItineraryResponse` is missing or not an object. No other service validates envelope structure beyond the top level. Lookup services, get-ancillaries, get-seats, and booking-management stop after validating the top-level object. This is inconsistent but possibly justified: BFM and Revalidate use OTA-style deeply nested envelopes, while others use flat schemas. Without this check, BFM/Revalidate would fail silently downstream when trying to iterate over missing descriptor arrays.

**Severity:** nice-to-have

**Proposed fix:** Document why BFM/Revalidate check the envelope and others don't. If it's because those two APIs have non-flat, deeply-nested OTA envelopes with required top-level keys, add inline comments to `bargain-finder-max-v5/mappers.ts` and `revalidate-itinerary-v5/mappers.ts` explaining the rationale. Consider whether get-seats and get-ancillaries (which also use nested responses) should do the same check for consistency.

---

## Non-Findings

- **Catch coverage in mappers** (severity: none) — All 8 services wrap `JSON.parse()` in try-catch blocks and throw `SabreParseError` with `cause: err` on parse failure. Coverage is 100%.

- **Cause field preservation** (severity: none) — All services that catch a thrown error include it in the `cause` field of the Sabre error. No unhandled rejection paths found.

- **Raw Error throws** (severity: none) — No service throws `new Error(...)` directly. All error throwing uses the shared Sabre error classes (`SabreParseError`, `SabreBookingErrorResponseError`, etc.).

- **Response body preservation** (severity: none) — All `SabreParseError` throws that occur inside mappers pass the raw `res.body` or parsed value as the second argument (`responseBody`), preserving the response for debugging.

- **Service.ts error wrapping** (severity: none) — Service method implementations (e.g., `lookup()`, `createBooking()`) all delegate directly to mappers without wrapping or re-throwing. Error propagation is transparent and consistent across services.

- **HTTP error mapping** (severity: none) — Network failures, timeouts, and non-2xx responses are consistently translated to `SabreNetworkError`, `SabreTimeoutError`, `SabreAuthenticationError`, or `SabreApiResponseError` by the error-mapping middleware in `src/middleware/error-mapping.ts`. All services benefit from this shared infrastructure.

- **Booking-specific error throwing** (severity: none) — Booking Management v1's `assertBookingSucceeded()` helper correctly throws `SabreBookingErrorResponseError` with the filtered errors array. This is the only opt-in error throwing in the library and is properly isolated to `src/services/booking-management-v1/assertions.ts`.

- **Type consistency in error classes** (severity: none) — All error subclasses carry comparable metadata. `SabreParseError` consistently includes `responseBody?`. `SabreApiResponseError` consistently includes `statusCode`, `responseBody?`, and `responseHeaders?`. `SabreAuthenticationError` includes `statusCode?`. No metadata drift between services.
