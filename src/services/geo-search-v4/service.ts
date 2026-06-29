import type { SabreRequest, SabreResponse } from '../../http/types.js';
import type { ServiceDeps } from '../types.js';
import * as mappers from './mappers.js';
import type { GeoSearchInput, GeoSearchOutput } from './types.js';

/**
 * Sabre Geo Search v4.
 *
 * Identifies airports, hotels, rail stations, and car rental locations
 * that fall within a given geographic search location using a radius
 * search. Supports lat/lon, named reference point, or address-based
 * anchors.
 *
 * Source: Sabre API "Geo Search" v4
 *   - Operation: `geoSearch` (`POST /v4/geo/search`)
 *   - Docs: https://developer.sabre.com/docs/rest_apis/utility/geo_search
 *
 * Construct via {@link createSabreClient}; do not implement this interface
 * yourself.
 */
export interface GeoSearchV4Service {
  /**
   * Search for locations (airports, hotels, rail stations, car rentals)
   * within a geographic radius.
   *
   * @param input Category, radius, unit of measure, and geographic anchor
   *   are required. Additional filters and pagination are optional.
   * @returns The matched locations and echoed search parameters.
   *
   * @see geoSearch (Sabre operationId)
   */
  search(input: GeoSearchInput): Promise<GeoSearchOutput>;
}

/**
 * Internal implementation of {@link GeoSearchV4Service}. Not exported
 * from the package; consumers obtain instances exclusively via
 * {@link createSabreClient}.
 */
export class DefaultGeoSearchV4Service implements GeoSearchV4Service {
  readonly #baseUrl: string;
  readonly #request: (req: SabreRequest) => Promise<SabreResponse>;

  constructor(deps: ServiceDeps) {
    this.#baseUrl = deps.baseUrl;
    this.#request = deps.request;
  }

  async search(input: GeoSearchInput): Promise<GeoSearchOutput> {
    const req = mappers.toSearchRequest(this.#baseUrl, input);
    const res = await this.#request(req);
    return mappers.fromSearchResponse(res);
  }
}
