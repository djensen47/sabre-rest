import type { SabreRequest, SabreResponse } from '../../http/types.js';
import type { ServiceDeps } from '../types.js';
import * as mappers from './mappers.js';
import type { LookupCitiesInput, LookupCitiesOutput } from './types.js';

/**
 * Sabre Multi-Airport City Lookup v1.
 *
 * Returns a list of multi-airport city (MAC) codes, optionally filtered by
 * country. A multi-airport city is a metropolitan area served by more than
 * one airport (e.g. `"BER"` for Berlin).
 *
 * Source: Sabre API "Multi-Airport City Lookup" v1
 *   - Operation: `multiAirportCityLookup` (`GET /v1/lists/supported/cities`)
 *   - Docs: https://developer.sabre.com/docs/read/rest_apis/air/utility/multiairport_city_lookup
 *
 * Construct via {@link createSabreClient}; do not implement this interface
 * yourself.
 */
export interface MultiAirportCityLookupV1Service {
  /**
   * Retrieves multi-airport city (MAC) codes.
   *
   * @param input Optional filter. Supply `country` to limit results to a
   *   single ISO 3166-1 alpha-2 country code (e.g. `"DE"`). Omit to return
   *   all MACs Sabre knows about.
   * @returns List of multi-airport cities matching the request.
   */
  lookup(input?: LookupCitiesInput): Promise<LookupCitiesOutput>;
}

/**
 * Internal implementation of {@link MultiAirportCityLookupV1Service}. Not
 * exported from the package; consumers obtain instances exclusively via
 * {@link createSabreClient}.
 */
export class DefaultMultiAirportCityLookupV1Service implements MultiAirportCityLookupV1Service {
  readonly #baseUrl: string;
  readonly #request: (req: SabreRequest) => Promise<SabreResponse>;

  constructor(deps: ServiceDeps) {
    this.#baseUrl = deps.baseUrl;
    this.#request = deps.request;
  }

  async lookup(input?: LookupCitiesInput): Promise<LookupCitiesOutput> {
    const req = mappers.toLookupCitiesRequest(this.#baseUrl, input);
    const res = await this.#request(req);
    return mappers.fromLookupCitiesResponse(res);
  }
}
