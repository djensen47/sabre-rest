import type { SabreRequest, SabreResponse } from '../../http/types.js';
import type { ServiceDeps } from '../types.js';
import * as mappers from './mappers.js';
import type { GetHotelAvailInput, GetHotelAvailOutput } from './types.js';

/**
 * Sabre Get Hotel Avail v5.
 *
 * Returns lead rates across multiple hotel properties in a single call
 * and produces the opaque rate keys required by Hotel Price Check. This
 * is the middle step in Sabre's hotel shopping flow:
 *
 *   hotel-search → get-hotel-avail → hotel-price-check → hotel booking
 *
 * Source: Sabre API "Get Hotel Avail" v5
 *   - Operation: `getHotelAvail` (`POST /v5/get/hotelavail`)
 *   - Docs: https://developer.sabre.com/docs/rest_apis/hotel/search/get_hotel_avail
 *
 * Construct via {@link createSabreClient}; do not implement this interface
 * yourself.
 */
export interface GetHotelAvailV5Service {
  /**
   * Fetch lead rates for hotel properties matching the given search
   * criteria.
   *
   * @param input Search anchor (geo or hotel refs) plus rate criteria
   *   (currency, best-only, stay window, rooms) and optional filters.
   * @returns Matching hotels with their rate info. The opaque `rateKey`
   *   on each {@link AvailRateEntry} (and each {@link AvailRatePlan})
   *   is the handoff to {@link HotelPriceCheckV5Service.check}.
   *
   * @see getHotelAvail (Sabre operationId)
   */
  getAvail(input: GetHotelAvailInput): Promise<GetHotelAvailOutput>;
}

/**
 * Internal implementation of {@link GetHotelAvailV5Service}. Not
 * exported from the package; consumers obtain instances exclusively via
 * {@link createSabreClient}.
 */
export class DefaultGetHotelAvailV5Service implements GetHotelAvailV5Service {
  readonly #baseUrl: string;
  readonly #request: (req: SabreRequest) => Promise<SabreResponse>;

  constructor(deps: ServiceDeps) {
    this.#baseUrl = deps.baseUrl;
    this.#request = deps.request;
  }

  async getAvail(input: GetHotelAvailInput): Promise<GetHotelAvailOutput> {
    const req = mappers.toGetAvailRequest(this.#baseUrl, input);
    const res = await this.#request(req);
    return mappers.fromGetAvailResponse(res);
  }
}
