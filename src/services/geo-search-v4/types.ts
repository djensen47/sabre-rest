/**
 * Public input/output types for the Geo Search v4 service.
 *
 * Hand-written intentionally — not derived from `src/generated/`. The
 * generated types are kept internal so consumer-facing types stay stable
 * across spec changes and use idiomatic TypeScript naming.
 *
 * Geo Search v4 identifies airports, hotels, rail stations, and car rental
 * locations that fall within a given geographic search location using a
 * radius search. Supports lat/lon, named reference point, or address-based
 * anchors.
 */

/**
 * Input to {@link GeoSearchV4Service.search}.
 *
 * A search requires a category, radius, unit of measure, and exactly one
 * geographic anchor (`geoRef`). Everything else is optional refinement.
 */
export interface GeoSearchInput {
  /**
   * What type of location to search for: airports, hotels, rail stations,
   * or car rental locations.
   */
  category: GeoSearchCategory;

  /**
   * Maximum distance from the geographic anchor. Scaled by {@link uom}.
   */
  radius: number;

  /** Unit of measure for {@link radius}. */
  uom: GeoSearchDistanceUnit;

  /**
   * Geographic anchor — exactly one of three variants: lat/lon coordinates,
   * a named reference point, or a street address.
   */
  geoRef: GeoSearchRef;

  /**
   * Compass direction from which the search begins. Omit to search in all
   * directions.
   */
  direction?: GeoSearchDirection;

  /**
   * Maximum number of results allowed in the search pool. Omit to let
   * Sabre apply its default.
   */
  maxResults?: number;

  /**
   * Maximum number of results returned in the response. Omit to let
   * Sabre apply its default.
   */
  maxSearchResults?: number;

  /**
   * Pagination offset — the starting position within the result set.
   * Omit for the first page.
   */
  offset?: number;

  /**
   * When `true`, filters out hotel properties from aggregator sources.
   * Defaults to `false` when omitted.
   */
  returnNonAggregatorPropertiesOnly?: boolean;

  /**
   * Post-filter attributes applied to the result set (e.g., CHAIN=HC).
   * Omit for unfiltered results.
   */
  attributes?: readonly GeoSearchAttribute[];
}

/** Category of location to search for. */
export type GeoSearchCategory = 'HOTEL' | 'CAR' | 'AIR' | 'RAIL';

/** Unit of distance measurement. */
export type GeoSearchDistanceUnit = 'MI' | 'KM';

/** Compass direction for directional searches. */
export type GeoSearchDirection = 'N' | 'S' | 'E' | 'W' | 'NE' | 'NW' | 'SE' | 'SW';

/**
 * Geographic anchor for the search. Exactly one variant per request:
 * `geoCode` for raw latitude/longitude, `refPoint` for a named reference
 * (airport, hotel, attraction, etc.), or `addressRef` for an address match.
 */
export type GeoSearchRef = GeoSearchGeoCodeRef | GeoSearchRefPointRef | GeoSearchAddressRef;

/** Search by latitude / longitude. */
export interface GeoSearchGeoCodeRef {
  kind: 'geoCode';
  /** Latitude in decimal degrees. */
  latitude: number;
  /** Longitude in decimal degrees. */
  longitude: number;
}

/**
 * Search by named reference point.
 *
 * The `refPointType` is an OTA code: `6` (airport), `7` (rail station),
 * `11` (hotel), `16` (attraction), `18` (car rental location), `37` (other).
 */
export interface GeoSearchRefPointRef {
  kind: 'refPoint';
  /** The reference value (e.g., `DFW` for an airport code). */
  value: string;
  /** How to interpret {@link value}: `NAME` or `CODE`. */
  valueContext: 'NAME' | 'CODE';
  /** OTA reference-point type code. */
  refPointType: '6' | '7' | '11' | '16' | '18' | '37';
  /** Optional state/province disambiguator. */
  stateProv?: string;
  /** Optional country code disambiguator. */
  countryCode?: string;
  /** Optional postal code disambiguator. */
  postalCode?: string;
  /** Optional city name disambiguator. */
  cityName?: string;
  /** Code context: `SABRE` or `GLOBAL`. */
  codeContext?: 'SABRE' | 'GLOBAL';
}

/**
 * Search by street address. `countryCode` is the only required field;
 * other components narrow the match.
 */
export interface GeoSearchAddressRef {
  kind: 'addressRef';
  /** ISO country code (required). */
  countryCode: string;
  /** Street name. */
  street?: string;
  /** City name. */
  city?: string;
  /** County name. */
  county?: string;
  /** Postal code. */
  postalCode?: string;
  /** State or province code. */
  stateProv?: string;
}

/** A name/value attribute used as a post-filter on the search. */
export interface GeoSearchAttribute {
  /** Attribute name (e.g., `CHAIN`). */
  name: string;
  /** Attribute value (e.g., `HC`). */
  value: string;
}

/**
 * Output of {@link GeoSearchV4Service.search}.
 *
 * Contains the matched locations and echoed search parameters. Every record
 * Sabre returned is preserved; undercooked records are not filtered out.
 */
export interface GeoSearchOutput {
  /** Echoed search radius. */
  radius?: number;
  /** Echoed unit of measure. */
  uom?: GeoSearchDistanceUnit;
  /** Echoed category. */
  category?: string;
  /** Echoed anchor latitude. */
  latitude?: number;
  /** Echoed anchor longitude. */
  longitude?: number;
  /** Echoed maximum search results. */
  maxSearchResults?: number;
  /** Echoed offset. */
  offset?: number;
  /** Locations found within the search radius. */
  results: readonly GeoSearchResult[];
}

/** A single location result. */
export interface GeoSearchResult {
  /** Distance from the search anchor. */
  distance?: number;
  /** Compass direction from the search anchor. */
  direction?: string;
  /** Latitude of this location. */
  latitude?: number;
  /** Longitude of this location. */
  longitude?: number;
  /** Display name of the location. */
  name?: string;
  /** Unique ID of the location. */
  id?: string;
  /** Street address. */
  street?: string;
  /** Zip / postal code. */
  zip?: string;
  /** City name. */
  city?: string;
  /** State code. */
  state?: string;
  /** Country code. */
  country?: string;
  /** Confidence factor (0-10) for the geocoding accuracy. */
  confidenceFactor?: number;
  /** Location-specific attributes (e.g., LOCALAREA). */
  attributes?: readonly GeoSearchResultAttribute[];
}

/** An attribute on a search result. */
export interface GeoSearchResultAttribute {
  /** Attribute name (e.g., `LOCALAREA`). */
  name?: string;
  /** Attribute ID. */
  id?: string;
  /** Attribute value. */
  value?: string;
}
