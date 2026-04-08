/**
 * Public input/output types for the Airline Lookup v1 service.
 *
 * Hand-written intentionally — not derived from `src/generated/`. The
 * generated types are kept internal so consumer-facing types stay stable
 * across spec changes and use idiomatic TypeScript naming.
 */

/**
 * Optional input to {@link AirlineLookupV1Service.lookup}.
 *
 * If `codes` is omitted or empty, the operation returns information for
 * every airline Sabre knows about. Otherwise it returns information only
 * for the supplied IATA airline codes.
 */
export interface LookupAirlinesInput {
  /**
   * Two-character IATA airline codes to look up. When omitted or empty,
   * Sabre returns the entire list.
   */
  codes?: readonly string[];
}

/** Result of {@link AirlineLookupV1Service.lookup}. */
export interface LookupAirlinesOutput {
  /**
   * Airlines matching the request, in the order Sabre returned them. Empty
   * if Sabre returned no results for the supplied codes.
   */
  airlines: readonly Airline[];
}

/** A single airline as returned by the Airline Lookup v1 service. */
export interface Airline {
  /** Two-character IATA airline code. */
  code: string;
  /** Proper business name (e.g., "Air India Limited"). */
  name: string;
  /**
   * Common business name (e.g., "Air India"). Often present alongside
   * {@link name} but not always — Sabre omits this field for some
   * carriers.
   */
  alternativeName?: string;
}
