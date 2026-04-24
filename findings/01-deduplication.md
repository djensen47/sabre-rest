# Dimension 1: Deduplication Opportunities

## Summary

Eight identical helper functions (`ensureTrailingSlash`) and a test helper (`okResponse`) are defined separately in each service's mappers and mapper tests. The `ensureTrailingSlash` function is a safe consolidation candidate: it's a pure, context-free utility with no service-specific logic. The `okResponse` test helper is also identical across test files and could move to a shared test utilities module. A repeated JSON-parse-and-validate pattern appears in all response mappers but should remain distributed due to Sabre's inconsistent error envelopes. Mapper signatures follow a uniform `to<Operation>Request` / `from<Operation>Response` pattern with no structural duplication risk.

---

## Findings

### 1. ensureTrailingSlash duplicated across all 8 mappers — must-fix

**Where:**
- `src/services/airline-alliance-lookup-v1/mappers.ts:66–68`
- `src/services/airline-lookup-v1/mappers.ts:66–68`
- `src/services/bargain-finder-max-v5/mappers.ts:66–68`
- `src/services/booking-management-v1/mappers.ts:67–69`
- `src/services/get-ancillaries-v2/mappers.ts:66–68`
- `src/services/get-seats-v2/mappers.ts:1157–1159`
- `src/services/multi-airport-city-lookup-v1/mappers.ts:66–68`
- `src/services/revalidate-itinerary-v5/mappers.ts:66–68`

**What:** Identical function definition:
```typescript
function ensureTrailingSlash(url: string): string {
  return url.endsWith('/') ? url : `${url}/`;
}
```

**Severity:** must-fix

**Proposed fix:** Extract to shared utility module `src/http/ensure-trailing-slash.ts`, export as named function, import in all mappers.

---

### 2. okResponse test helper duplicated across all mapper tests — should-fix

**Where:**
- `src/services/airline-alliance-lookup-v1/mappers.test.ts:6–11`
- `src/services/airline-lookup-v1/mappers.test.ts:6–11`
- `src/services/bargain-finder-max-v5/mappers.test.ts:14–19`
- `src/services/booking-management-v1/mappers.test.ts:33`
- `src/services/get-ancillaries-v2/mappers.test.ts:6–11`
- `src/services/get-seats-v2/mappers.test.ts:14–19`
- `src/services/multi-airport-city-lookup-v1/mappers.test.ts:6–11`
- `src/services/revalidate-itinerary-v5/mappers.test.ts:6–11`

**What:** Identical test helper factory across all 8 services:
```typescript
const okResponse = (body: unknown): SabreResponse => ({
  status: 200,
  statusText: 'OK',
  headers: {},
  body: typeof body === 'string' ? body : JSON.stringify(body),
});
```

**Severity:** should-fix

**Proposed fix:** Extract to `src/http/test-utils.ts` or `src/testing.ts`, export as named function, import in all mapper test files. Reduces boilerplate and centralizes response mock factory.

---

## Non-Findings

### JSON parse + validate pattern checked, no consolidation

**What:** All response mappers follow a similar pattern:
1. `try { JSON.parse(...) } catch { throw SabreParseError }`
2. `if (parsed === null || typeof parsed !== 'object') { throw SabreParseError }`

**Why no consolidation:** While syntactically similar, the pattern is intentionally distributed because:
- Sabre's error envelopes vary significantly across APIs (structured `{ errors: [...] }`, OTA-style `{ OTA_AirLowFareSearchRS: ... }`, plain text).
- Early consolidation into a shared wrapper would require per-API error extraction logic, violating the "generated types stay internal" rule.
- A generic `parseJsonObject()` helper would hide the schema-specific validation and make it harder to spot when Sabre returns unexpected shapes.
- `docs/decisions.md` ("Sabre's error envelope inconsistency") explicitly documents this trade-off.

Leave as-is. If a real pattern emerges after implementation of more services, add the helper then.

---

### Mapper function signatures checked, no structural duplication

**What:** All mappers export `to<Operation>Request(baseUrl, input)` and `from<Operation>Response(res)` with consistent signatures.

**Why no consolidation:** This is a naming convention, not duplicate code. Each mapper's request and response transforms are operation-specific and properly distributed. Centralizing would require a generic routing layer that adds indirection without benefit.

No action needed.

