# Dimension 3: Generated types stay internal

## Summary

All 8 services correctly isolate generated types from the public surface. No leaks detected across public type definitions, service interface signatures, index.ts re-exports, JSDoc examples, or type aliases. Each service declares hand-written public types in `types.ts`, imports the generated `components` type only inside `mappers.ts` for internal consumption, and the mapper functions correctly transform from generated schemas to public output types. This audit found zero findings in Dimension 3 — the rule is uniformly enforced.

## Findings

None.

## Non-Findings

- **src/index.ts**: No imports from `src/generated/`; no re-exports of `components` or any generated namespace. All re-exported types are hand-written public types from individual service `types.ts` files. Severity: none.
- **Airline Lookup v1**: Service `types.ts` declares hand-written `Airline`, `LookupAirlinesInput`, `LookupAirlinesOutput`. Mappers import `components` from `generated/airline-lookup.js` for internal parsing but only emit public types to callers. Service interface signature uses public types. Severity: none.
- **Airline Alliance Lookup v1**: Service `types.ts` declares hand-written `AirlineAlliance`, `AirlineAllianceMember`, `LookupAirlineAlliancesInput`, `LookupAirlineAlliancesOutput`. Mappers consume generated types internally; service interface uses public types only. Severity: none.
- **Booking Management v1**: Largest service with ~160+ exported public types. Each declared in `types.ts` as hand-written. Mappers import `components` from `generated/booking-management.js` (internal only). Service interface methods (`createBooking`, `getBooking`, `modifyBooking`, etc.) all use public Input/Output types from `types.ts`. No `components['schemas']` aliases in public type definitions. Severity: none.
- **Bargain Finder Max v5**: Service `types.ts` declares hand-written input/output and sub-types (`SearchBargainFinderMaxInput`, `OriginDestination`, `PassengerCount`, `PointOfSale`, `TravelPreferences`, `SearchBargainFinderMaxOutput`, etc.). Mappers consume generated `components` internally. Service interface `search()` method uses public types only. Severity: none.
- **Get Ancillaries v2**: Service `types.ts` declares hand-written `GetAncillariesInput`, `GetAncillariesOutput`, and supporting types. Mappers import `components` from `generated/get-ancillaries.js` for response parsing. Service interface uses public types. Severity: none.
- **Get Seats v2**: Service `types.ts` declares hand-written discriminated-union input types (`GetSeatsInput` union of `GetSeatsOfferInput`, `GetSeatsOrderInput`, `GetSeatsPayloadInput`, `GetSeatsStatelessInput`) and `GetSeatsOutput` with child types. Mappers consume generated types internally. Service interface signature uses public types. Severity: none.
- **Multi-Airport City Lookup v1**: Service `types.ts` declares hand-written `LookupCitiesInput`, `LookupCitiesOutput`, `MultiAirportCity`. Mappers use `components` internally. Service interface uses public types. Severity: none.
- **Revalidate Itinerary v5**: Service `types.ts` declares hand-written `RevalidateItineraryInput`, `RevalidateItineraryOutput`, `RevalidateOriginDestination`. Mappers consume generated `components` internally only. Service interface `revalidate()` uses public types. Severity: none.
- **No JSDoc leaks**: All JSDoc examples and `@param`/`@returns` doc comments in service files reference public types (e.g., `LookupAirlinesInput`, `LookupAirlinesOutput`), not generated types. No mention of `components['schemas']` or generated paths in example code. Severity: none.
- **No type alias leaks**: No public type is defined as a direct alias to a generated type (e.g., `type Foo = components['schemas']['Foo']`). All public types are structurally declared as interfaces or unions and the mapping logic extracts/transforms fields as needed. Severity: none.
- **Mapper pattern**: All 8 services follow the same pattern: import `components` in mappers (internal file), use it to parse incoming JSON, transform to hand-written public types. No mapper exports generated types; all exports are hand-written public types or request/response mapper signatures typed with public types only. Severity: none.

