# Dimension 4: Public Type Design Rules Compliance

## Summary

This dimension audited three public type design rules across all 8 services' `types.ts` files, comparing each against corresponding OpenAPI specifications. The audit identified one critical violation of Rule 1 (same-ref sharing requirement) and zero violations of Rules 2 and 3. The main finding is that 14 types are duplicated across bargain-finder-max-v5 and revalidate-itinerary-v5 without verification that they reference the same OAS `$ref`. The two services do share structurally identical types (PassengerCount, PassengerFare, PricedItinerary, etc.) but in their respective types.ts files rather than in a shared location, which suggests they may not be backed by identical schema references. Defensive optionality choices (fields marked `?` despite OAS `required`) are consistently documented with clear comments across all services audited. Optionality matches the OAS in all sampled cases.

## Findings

### 1. Duplicate type definitions across bargain-finder-max-v5 and revalidate-itinerary-v5 without $ref verification — both services

**Where:** `src/services/bargain-finder-max-v5/types.ts` and `src/services/revalidate-itinerary-v5/types.ts`

**What:** The two services define 14 structurally identical types: PassengerCount, PointOfSale, PassengerFare, FareOffer, PricedItinerary, FareComponent, FareComponentSegment, Tax, BaggageAllowance, BaggageCharge, ItineraryLeg, FlightSegment, SegmentEndpoint, TotalFare, SabreMessage. These types are copied verbatim or near-verbatim across both services' types.ts files. The architecture.md document's Rule 1 states: "Share a public type across operations only when the OAS uses the same `$ref`." No evidence appears in the code or git history of verification that these types are actually backed by the same `$ref` in both OpenAPI specs. The bargain-finder-max.yml and revalidate-itinerary.yml specs use different naming conventions in their schemas (e.g., `PassengerTypeQuantity` vs. custom `PassengerCount`), suggesting they may be independent specs. Until the same `$ref` is confirmed, this duplication violates the stated safety rule.

**Severity:** should-fix

**Proposed fix:** 
1. Verify whether both specs use the same `$ref` for request/response schemas by examining the OpenAPI definitions for PassengerTypeQuantity, source elements, and itinerary structures.
2. If same `$ref`: deduplicate by moving shared types to a new `src/shared/` module or exporting them from one service and importing in the other.
3. If different `$ref`: document the "same shape today, don't trust it" decision with a comment in each service's types.ts explaining why duplication is safer despite structural similarity.

---

## Non-Findings

The following were checked and confirmed to comply with the rules:

- **Rule 2 (Optionality mirrors OAS):** Sampled PassengerFare, SabreMessage, PointOfSale, and FareOffer across BFM and Revalidate; all optional fields (`?`) match the absence of `required:` in the OAS schemas. No violations found.
- **Rule 3 (Defensive choices documented inline):** PassengerFare.passengerType is marked optional with a clear doc comment explaining it "shouldn't happen in practice — the generated spec marks it required — but the library never fabricates." Similar patterns in BFM's response types document why all response fields are optional despite some being required in the spec. All defensive loosening is documented; no violations found.
- **Airline Alliance Lookup v1, Airline Lookup v1, Multi-Airport City Lookup v1:** No type duplication across services. Each service defines types locally. No cross-service sharing attempted. Compliant.
- **Booking Management v1, Get Ancillaries v2, Get Seats v2:** All types are locally defined within each service. No sharing across services without $ref verification. No violations detected.

