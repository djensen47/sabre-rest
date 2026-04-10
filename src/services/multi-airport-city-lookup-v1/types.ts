/**
 * Public input/output types for the Multi-Airport City Lookup v1 service.
 *
 * Hand-written intentionally — not derived from `src/generated/`. The
 * generated types are kept internal so consumer-facing types stay stable
 * across spec changes and use idiomatic TypeScript naming.
 */

/**
 * Optional input to {@link MultiAirportCityLookupV1Service.lookup}.
 *
 * If `country` is omitted, the operation returns all MAC codes Sabre knows
 * about. Otherwise it returns only MACs for the specified country.
 */
export interface LookupCitiesInput {
  /**
   * 2-letter ISO 3166-1 alpha-2 country code to filter by (e.g. `"US"`,
   * `"DE"`). When omitted, Sabre returns every multi-airport city.
   *
   * Sabre returns 400 if an unsupported country code is supplied.
   */
  country?: string;
}

/** Result of {@link MultiAirportCityLookupV1Service.lookup}. */
export interface LookupCitiesOutput {
  /**
   * Multi-airport cities matching the request, in the order Sabre returned
   * them. Empty if Sabre returned no results.
   */
  cities: readonly MultiAirportCity[];
}

/**
 * A single multi-airport city (MAC) as returned by the Multi-Airport City
 * Lookup v1 service.
 *
 * Every field is optional because Sabre's spec marks every field optional.
 * The library does not invent its own required-field rubric; it surfaces
 * records exactly as Sabre returned them. Consumers should defensively
 * handle `undefined` values.
 */
export interface MultiAirportCity {
  /** Multi-airport city (MAC) code, e.g. `"BER"`. */
  code?: string;
  /** City name associated with the MAC code, e.g. `"Berlin"`. */
  name?: string;
  /** ISO country code associated with the MAC, e.g. `"DE"`. */
  countryCode?: string;
  /** Full country name corresponding to `countryCode`, e.g. `"Germany"`. */
  countryName?: string;
  /** Region name assigned to the country, e.g. `"Europe"`. */
  regionName?: string;
  /**
   * Links related to this city, when populated. The `"airportsInCity"` rel
   * points to the Sabre endpoint that lists airports within this MAC.
   */
  links?: readonly CityLink[];
}

/**
 * A hypermedia link attached to a {@link MultiAirportCity}.
 *
 * The only documented `rel` value is `"airportsInCity"`, which points to the
 * Sabre endpoint listing the airports that make up this multi-airport city.
 */
export interface CityLink {
  /**
   * Describes the relationship between `href` and the current resource.
   * Sabre documents `"airportsInCity"` as the only value for city-level links.
   */
  rel?: string;
  /** URL of the related API resource. */
  href?: string;
}
