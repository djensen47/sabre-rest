import type { SabreRequest, SabreResponse } from '../../http/types.js';
import type { ServiceDeps } from '../types.js';
import * as mappers from './mappers.js';
import type { SearchBargainFinderMaxInput, SearchBargainFinderMaxOutput } from './types.js';

/**
 * Sabre Bargain Finder Max v5.
 *
 * BFM is Sabre's flagship low-fare search product. It returns priced
 * itinerary options for one or more origin/destination legs and one or
 * more passenger groups, ranked by Sabre's shopping engine.
 *
 * Source: Sabre API "Bargain Finder Max" v5
 *   - Operation: `CreateBargainFinderMax` (`POST /v5/offers/shop`)
 *   - Docs: https://developer.sabre.com/docs/rest_apis/air/search/bargain_finder_max
 *
 * The public input/output types are a deliberately small slice of BFM's
 * surface area focused on the common shopping use case. Less-common
 * features (NDC brand programs, baggage subcategories, Universal Product
 * Attributes, exchange/reissue, handling markups, statistics) are not
 * surfaced in this version and may be added later non-breakingly.
 *
 * Construct via {@link createSabreClient}; do not implement this interface
 * yourself.
 */
export interface BargainFinderMaxV5Service {
  /**
   * Run a low-fare shop request and return the priced itineraries Sabre
   * found.
   *
   * @param input Origin/destination legs, passenger groups, point of
   *   sale, and optional shopping preferences.
   * @returns The priced itineraries (in Sabre's response order) plus any
   *   server messages from the response envelope.
   */
  search(input: SearchBargainFinderMaxInput): Promise<SearchBargainFinderMaxOutput>;
}

/**
 * Internal implementation of {@link BargainFinderMaxV5Service}. Not
 * exported from the package; consumers obtain instances exclusively via
 * {@link createSabreClient}.
 */
export class DefaultBargainFinderMaxV5Service implements BargainFinderMaxV5Service {
  readonly #baseUrl: string;
  readonly #request: (req: SabreRequest) => Promise<SabreResponse>;

  constructor(deps: ServiceDeps) {
    this.#baseUrl = deps.baseUrl;
    this.#request = deps.request;
  }

  async search(input: SearchBargainFinderMaxInput): Promise<SearchBargainFinderMaxOutput> {
    const req = mappers.toSearchRequest(this.#baseUrl, input);
    const res = await this.#request(req);
    return mappers.fromSearchResponse(res);
  }
}
