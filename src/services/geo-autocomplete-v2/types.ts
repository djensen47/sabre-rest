/**
 * Public input/output types for the Geo Autocomplete v2 service.
 *
 * Hand-written intentionally — not derived from `src/generated/`. The
 * generated types are kept internal so consumer-facing types stay stable
 * across spec changes and use idiomatic TypeScript naming.
 *
 * Geo Autocomplete v2 returns a list of location predictions for
 * text-based geographic search queries (typeahead). Results are grouped
 * by category (AIR, RAIL, CITY, POI, LOCATION).
 */

/**
 * Input to {@link GeoAutocompleteV2Service.autocomplete}.
 *
 * Only `query` is required (minimum 3 characters). Everything else
 * narrows or limits the result set.
 */
export interface GeoAutocompleteInput {
  /**
   * The full word or substring to autocomplete. A minimum of three
   * characters is required.
   */
  query: string;

  /**
   * Restrict results to a specific category. Omit to search across all
   * categories.
   */
  category?: GeoAutocompleteCategory;

  /**
   * Maximum number of results to return per category. Range: 1-30.
   * Sabre defaults to 5 when omitted.
   */
  limit?: number;

  /**
   * Unique identifier for the client application. Omit if not
   * applicable.
   */
  clientId?: string;
}

/** Category filter for autocomplete results. */
export type GeoAutocompleteCategory = 'AIR' | 'CITY' | 'RAIL' | 'POI' | 'LOCATION';

/**
 * Output of {@link GeoAutocompleteV2Service.autocomplete}.
 *
 * Contains response metadata and grouped location predictions by
 * category. Every group Sabre returned is preserved.
 */
export interface GeoAutocompleteOutput {
  /** HTTP-level status code from Sabre's response header. */
  status?: number;
  /** Query execution time in seconds. */
  queryTime?: number;
  /** Location predictions grouped by category. */
  groups: readonly GeoAutocompleteGroup[];
}

/** A group of autocomplete results for a single category. */
export interface GeoAutocompleteGroup {
  /** Which category this group represents (e.g., `AIR`, `CITY`). */
  category: string;
  /** Total number of places that matched this category. */
  matches?: number;
  /** Total number of results found for the query in this category. */
  numFound?: number;
  /** Starting position in the result set. */
  start?: number;
  /** The matched places. */
  places: readonly GeoAutocompletePlace[];
}

/** A single location prediction. */
export interface GeoAutocompletePlace {
  /** Full name of the matched place. */
  name?: string;
  /** City name. */
  city?: string;
  /** Two-letter ISO 3166 country code. */
  country?: string;
  /** Full country name. */
  countryName?: string;
  /** Full state or province name. */
  stateName?: string;
  /** Abbreviated state or province code. */
  state?: string;
  /** Result category (e.g., `AIR`, `RAIL`, `CITY`). */
  category?: string;
  /** Unique identifier for this place (e.g., IATA airport code). */
  id?: string;
  /** Dataset type (e.g., `AIR`, `RAIL`, `LOCATION`). */
  dataset?: string;
  /** Data source (e.g., `INNOVATA`). */
  datasource?: string;
  /** Geocoding confidence factor as a string. */
  confidenceFactor?: string;
  /** Latitude as a string. */
  latitude?: string;
  /** Longitude as a string. */
  longitude?: string;
  /** Three-letter IATA city code for this location. */
  iataCityCode?: string;
  /**
   * Ranking (1-900) indicating population density (for cities) or
   * air traffic volume (for airports). Higher = more prominent.
   */
  ranking?: number;
}
