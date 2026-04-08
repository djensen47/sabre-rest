/**
 * Public input/output types for the Airline Alliance Lookup v1 service.
 *
 * Hand-written; not derived from `src/generated/`. The generated types
 * stay internal so consumer-facing types remain stable across spec
 * changes and use idiomatic TypeScript naming.
 */

/**
 * Optional input to {@link AirlineAllianceLookupV1Service.lookup}.
 *
 * If `codes` is omitted or empty, the operation returns information for
 * every airline alliance Sabre knows about. Otherwise it returns
 * information only for the supplied alliance codes.
 *
 * Known alliance codes:
 * - `*A` — Star Alliance
 * - `*O` — oneworld
 * - `*S` — SkyTeam
 */
export interface LookupAirlineAlliancesInput {
  codes?: readonly string[];
}

/** Result of {@link AirlineAllianceLookupV1Service.lookup}. */
export interface LookupAirlineAlliancesOutput {
  /**
   * Alliances matching the request, in the order Sabre returned them.
   * Empty if Sabre returned no results for the supplied codes.
   */
  alliances: readonly AirlineAlliance[];
}

/**
 * A single airline alliance as returned by the Airline Alliance Lookup
 * v1 service.
 *
 * Every field is optional because Sabre's spec marks every field
 * optional. The library does not invent its own required-field rubric;
 * it surfaces records exactly as Sabre returned them. Consumers should
 * defensively handle `undefined` values.
 */
export interface AirlineAlliance {
  /** Alliance group code (e.g., `*A`, `*O`, `*S`), when populated. */
  code?: string;
  /**
   * Alliance name (e.g., "Star Alliance", "oneworld", "SkyTeam"), when
   * populated.
   */
  name?: string;
  /**
   * Member airlines, in the order Sabre returned them. Each entry mirrors
   * Sabre's response — the `code` field is optional because Sabre's spec
   * marks it optional. To resolve member codes to names, pass them to
   * {@link AirlineLookupV1Service.lookup}.
   */
  members: readonly AirlineAllianceMember[];
}

/** A single member of an airline alliance. */
export interface AirlineAllianceMember {
  /** Two-character IATA airline code, when populated. */
  code?: string;
}
