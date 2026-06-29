/**
 * The geographic category used to filter autocomplete results.
 *
 * - `AIR` — airports
 * - `CITY` — cities
 * - `RAIL` — rail stations
 * - `POI` — points of interest
 * - `LOCATION` — general locations
 */
export type GeoCategory = 'AIR' | 'CITY' | 'RAIL' | 'POI' | 'LOCATION';

/**
 * Input for the geo autocomplete operation.
 *
 * At minimum, `query` must be provided (minimum 3 characters). The other
 * fields narrow or configure the result set.
 */
export interface AutocompleteInput {
  /**
   * The full word or substring to be autocompleted. A minimum of three
   * characters is required.
   *
   * @example "Dall"
   */
  query: string;

  /**
   * Restricts results to places in the specified category. When omitted,
   * Sabre returns results across all categories.
   */
  category?: GeoCategory;

  /**
   * The number of search results to return per category. Valid range is
   * 1–30; Sabre defaults to 5 when not specified.
   */
  limit?: number;

  /**
   * The unique identifier for the client application.
   *
   * @example "devstudio"
   */
  clientId?: string;
}

/**
 * Output of the geo autocomplete operation.
 *
 * Results are organized by category group. Each group contains a list of
 * matching places for that category.
 */
export interface AutocompleteOutput {
  /** The category groups returned by Sabre, one per category present in the response. */
  groups: AutocompleteCategoryGroup[];
}

/**
 * A group of autocomplete results for a single category (AIR, RAIL, CITY,
 * POI, or LOCATION).
 */
export interface AutocompleteCategoryGroup {
  /**
   * The category this group represents (e.g. `"AIR"`, `"CITY"`).
   * Derived from the response key.
   */
  category?: string;

  /** Total number of places matching this category across all results. */
  totalMatches?: number;

  /** The place results for this category. */
  places: AutocompletePlace[];
}

/**
 * A single location prediction returned by the Geo Autocomplete API.
 *
 * All fields are optional because Sabre's spec does not mark any response
 * fields as required. The mapper preserves every place Sabre returns
 * regardless of which fields are populated.
 */
export interface AutocompletePlace {
  /**
   * Unique identifier for the place (e.g. IATA airport code like `"DFW"`).
   */
  id?: string;

  /** Complete name of the place (e.g. `"Dallas/Fort Worth Intl."`). */
  name?: string;

  /** City name (e.g. `"Dallas"`). */
  city?: string;

  /** Abbreviated state/province code (e.g. `"TX"`). */
  state?: string;

  /** Full state/province name (e.g. `"Texas"`). */
  stateName?: string;

  /** Two-letter ISO 3166 country code (e.g. `"US"`). */
  country?: string;

  /** Full country name (e.g. `"United States Of America"`). */
  countryName?: string;

  /** Category classification (e.g. `"AIR"`, `"CITY"`). */
  category?: string;

  /** Geographic latitude as a string (e.g. `"32.896111"`). */
  latitude?: string;

  /** Geographic longitude as a string (e.g. `"-97.041111"`). */
  longitude?: string;

  /** Three-letter IATA city code (e.g. `"QDF"`). */
  iataCityCode?: string;

  /**
   * Popularity ranking from 1–900. For cities this indicates population
   * density; for airports it indicates air traffic volume. Higher is more
   * popular.
   */
  ranking?: number;

  /** The type of data (e.g. `"AIR"`, `"RAIL"`, `"CITY"`). */
  dataset?: string;

  /** The source providing the geographic data (e.g. `"INNOVATA"`). */
  datasource?: string;

  /** Degree of accuracy in the latitude/longitude coordinates. */
  confidenceFactor?: string;
}
