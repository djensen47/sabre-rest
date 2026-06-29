import type { SabreRequest, SabreResponse } from '../../http/types.js';
import type { ServiceDeps } from '../types.js';
import * as mappers from './mappers.js';
import type { GeoAutocompleteInput, GeoAutocompleteOutput } from './types.js';

/**
 * Sabre Geo Autocomplete v2.
 *
 * Returns a list of location predictions for text-based geographic search
 * queries (typeahead). Results are grouped by category (AIR, RAIL, CITY,
 * POI, LOCATION) with up to the requested limit per group.
 *
 * Source: Sabre API "Geo Autocomplete" v2
 *   - Operation: `geoAutocomplete` (`GET /v2/geo/autocomplete`)
 *   - Docs: https://developer.sabre.com/docs/rest_apis/utility/geo_autocomplete
 *
 * Construct via {@link createSabreClient}; do not implement this interface
 * yourself.
 */
export interface GeoAutocompleteV2Service {
  /**
   * Get location predictions for a text query.
   *
   * @param input The query string (min 3 chars) plus optional category
   *   filter, result limit, and client ID.
   * @returns Grouped location predictions by category.
   *
   * @see geoAutocomplete (Sabre operationId)
   */
  autocomplete(input: GeoAutocompleteInput): Promise<GeoAutocompleteOutput>;
}

/**
 * Internal implementation of {@link GeoAutocompleteV2Service}. Not exported
 * from the package; consumers obtain instances exclusively via
 * {@link createSabreClient}.
 */
export class DefaultGeoAutocompleteV2Service implements GeoAutocompleteV2Service {
  readonly #baseUrl: string;
  readonly #request: (req: SabreRequest) => Promise<SabreResponse>;

  constructor(deps: ServiceDeps) {
    this.#baseUrl = deps.baseUrl;
    this.#request = deps.request;
  }

  async autocomplete(input: GeoAutocompleteInput): Promise<GeoAutocompleteOutput> {
    const req = mappers.toAutocompleteRequest(this.#baseUrl, input);
    const res = await this.#request(req);
    return mappers.fromAutocompleteResponse(res);
  }
}
