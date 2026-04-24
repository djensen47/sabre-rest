# Dimension 7: Public surface hygiene

## Summary

The public surface defined in `src/index.ts` is clean and well-maintained. All 15 exports (constants, factory functions, error classes, and types) are intentional and actively used by either test code or downstream consumers. No dead exports were found. No internal modules, mappers, generated types, or Default* classes leak into the public surface. The exports align cleanly with the architectural rule that the public API consists exclusively of interfaces and factory functions, with all implementations remaining internal.

## Findings

None.

## Non-Findings

The following checks were performed with no actionable issues found:

1. **Dead exports audit.** All 15 function/constant exports from `src/index.ts` are used somewhere in the codebase: `SabreBaseUrls` (tested in constants.test.ts and referenced in docs), `createSabreClient` (primary entry point, used in every service test), `createOAuthV2` (used in auth tests and client tests), `createMemoryTokenStore` (used in auth tests), `createAuthMiddleware` and `createErrorMappingMiddleware` (used internally by client.ts and exported for override-mode consumers), `assertBookingSucceeded` and `defaultBookingHardFailurePredicate` (tested and exported for booking-management consumers). Severity: none.

2. **Type exports completeness.** All type exports needed by public functions are exposed: `SabreClient`, `SabreClientOptions` (required to call `createSabreClient`), `OAuthV2Options` (required to call `createOAuthV2`), `TokenProvider`, `TokenStore`, `StoredToken` (required for custom token storage implementations), `Middleware`, `SabreHttpMethod`, `SabreRequest`, `SabreResponse` (required for override-mode custom middleware), and service types (`AirlineLookupV1Service`, etc.) plus all their input/output and helper types (e.g., `AssertBookingSucceededOptions`, `BookingErrorPredicate`). Severity: none.

3. **No mapper exports.** Verified that no mapper functions from `*/mappers.ts` files are re-exported from `src/index.ts`. Mappers remain internal to each service. Severity: none.

4. **No generated-type leaks.** Verified that `src/index.ts` has no imports from `src/generated/`, no re-exports of `components` types, and no aliases to generated schemas. Public types are hand-written and separate from the generated layer. Severity: none.

5. **No Default* class leaks.** No concrete classes (`DefaultSabreClient`, `Default*Service`, etc.) are exported from `src/index.ts`. They are defined in their respective modules but only instantiated internally by factory functions. Consumers never construct or reference concrete classes by name. Severity: none.

6. **No internal module leaks.** Verified there is no `src/internal/` folder and no exports of any hypothetical internal module. All service modules are cohesive and follow consistent public/private boundaries. Severity: none.

7. **Service interface consistency.** All 8 services export a single interface type (e.g., `AirlineLookupV1Service`, `BookingManagementV1Service`) and related input/output types from their `types.ts` files. No service exports are inconsistent in depth or pattern. Severity: none.

8. **HTTP and middleware types are appropriate.** The exported HTTP types (`Middleware`, `SabreRequest`, `SabreResponse`, `SabreHttpMethod`) are correctly exposed to enable consumers to write custom middleware when using `overrideMiddleware: true`. These are essential to the override contract and properly placed on the public surface. Severity: none.

9. **Assertions types are necessary.** The assertion-helper types (`AssertBookingSucceededInput`, `AssertBookingSucceededOptions`, `BookingErrorPredicate`) are exported and necessary: consumers calling `assertBookingSucceeded` need to reference `AssertBookingSucceededOptions` to pass a custom predicate, and `BookingErrorPredicate` is the type of that predicate. All three are tested. Severity: none.

10. **Error hierarchy is complete.** All error types in the small, focused hierarchy are exported: `SabreError` (base), `SabreApiResponseError`, `SabreAuthenticationError`, `SabreNetworkError`, `SabreTimeoutError`, `SabreParseError`, and opt-in `SabreBookingErrorResponseError`. No per-service error subclasses exist; all consumers work with the shared hierarchy. Severity: none.

11. **Auth composition is exported correctly.** `createOAuthV2` (factory), `createMemoryTokenStore` (factory), `TokenProvider`, `TokenStore`, and `StoredToken` are all exported. This is the correct minimal set to support custom token storage implementations without forcing all consumers to use the in-memory store. Severity: none.

12. **Constants are exported and used.** `SabreBaseUrls` is a frozen object with `cert` and `prod` properties, tested and accessible to consumers as a convenience constant. Severity: none.

