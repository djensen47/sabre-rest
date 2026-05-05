import type { SabreRequest, SabreResponse } from '../../http/types.js';
import type { ServiceDeps } from '../types.js';
import * as mappers from './mappers.js';
import type { SearchHotelsInput, SearchHotelsOutput } from './types.js';

/**
 * Sabre Hotel Search v2.
 *
 * Performs property discovery given a geographic anchor (lat/lon,
 * reference point, or address) plus a radius. Returns matching hotel
 * properties and their static metadata — this API does not return
 * availability or rates.
 *
 * Source: Sabre API "Hotel Search" v2
 *   - Operation: `hotelSearch` (`POST /v2.0.0/hotel/search`)
 *   - Docs: https://developer.sabre.com/docs/rest_apis/hotel/search/hotel_search
 *
 * Construct via {@link createSabreClient}; do not implement this interface
 * yourself.
 */
export interface HotelSearchV2Service {
  /**
   * Search for hotel properties matching the given geographic anchor,
   * radius, and optional filters.
   *
   * @param input Geographic anchor plus optional sort / filter / image
   *   preferences. `geoSearch.geoRef` is required.
   * @returns The matching hotels (in Sabre's response order) and the
   *   application-results diagnostic envelope when present.
   *
   * @see hotelSearch (Sabre operationId)
   */
  search(input: SearchHotelsInput): Promise<SearchHotelsOutput>;
}

/**
 * Internal implementation of {@link HotelSearchV2Service}. Not exported
 * from the package; consumers obtain instances exclusively via
 * {@link createSabreClient}.
 */
export class DefaultHotelSearchV2Service implements HotelSearchV2Service {
  readonly #baseUrl: string;
  readonly #request: (req: SabreRequest) => Promise<SabreResponse>;

  constructor(deps: ServiceDeps) {
    this.#baseUrl = deps.baseUrl;
    this.#request = deps.request;
  }

  async search(input: SearchHotelsInput): Promise<SearchHotelsOutput> {
    const req = mappers.toSearchRequest(this.#baseUrl, input);
    const res = await this.#request(req);
    return mappers.fromSearchResponse(res);
  }
}
