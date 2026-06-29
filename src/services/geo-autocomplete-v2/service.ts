import type { SabreRequest, SabreResponse } from '../../http/types.js';
import type { ServiceDeps } from '../types.js';
import * as mappers from './mappers.js';
import type { AutocompleteInput, AutocompleteOutput } from './types.js';

/**
 * Sabre Geo Autocomplete v2.
 *
 * Returns location predictions for text-based geographic search queries,
 * covering airports, cities, rail stations, points of interest, and general
 * locations. Results are grouped by category.
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
   * Returns an on-the-fly list of location predictions to aid the traveler
   * in selecting a desired place.
   *
   * @param input - The search query and optional filters (category, limit, clientId).
   * @returns Grouped location predictions organized by category.
   */
  autocomplete(input: AutocompleteInput): Promise<AutocompleteOutput>;
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

  async autocomplete(input: AutocompleteInput): Promise<AutocompleteOutput> {
    const req = mappers.toAutocompleteRequest(this.#baseUrl, input);
    const res = await this.#request(req);
    return mappers.fromAutocompleteResponse(res);
  }
}
