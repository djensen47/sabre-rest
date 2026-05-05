import type { SabreRequest, SabreResponse } from '../../http/types.js';
import type { ServiceDeps } from '../types.js';
import * as mappers from './mappers.js';
import type { CheckHotelPriceInput, CheckHotelPriceOutput } from './types.js';

/**
 * Sabre Hotel Price Check v5.
 *
 * Revalidates the price returned by a prior hotel shop / price response.
 * Sabre confirms whether the quoted rate is still available, returns a
 * `bookingKey` for the downstream booking call, and surfaces any price
 * change, refreshed rate details, taxes, fees, penalties, and guarantee
 * policies.
 *
 * Source: Sabre API "Hotel Price Check" v5
 *   - Operation: `hotelPriceCheck` (`POST /v5/hotel/pricecheck`)
 *   - Docs: https://developer.sabre.com/docs/rest_apis/hotel/search/hotel_price_check
 *
 * Construct via {@link createSabreClient}; do not implement this interface
 * yourself.
 */
export interface HotelPriceCheckV5Service {
  /**
   * Revalidate a shopped hotel rate and return refreshed price / room /
   * penalty details.
   *
   * @param input Opaque `rateKey` from the prior shop response, plus
   *   optional context (POS, corporate number, stay window, rooms).
   * @returns The booking key, price-change status, refreshed hotel
   *   identity, the refreshed rate / room / penalty tree, and any
   *   application diagnostics Sabre returned.
   *
   * @see hotelPriceCheck (Sabre operationId)
   */
  check(input: CheckHotelPriceInput): Promise<CheckHotelPriceOutput>;
}

/**
 * Internal implementation of {@link HotelPriceCheckV5Service}. Not
 * exported from the package; consumers obtain instances exclusively via
 * {@link createSabreClient}.
 */
export class DefaultHotelPriceCheckV5Service implements HotelPriceCheckV5Service {
  readonly #baseUrl: string;
  readonly #request: (req: SabreRequest) => Promise<SabreResponse>;

  constructor(deps: ServiceDeps) {
    this.#baseUrl = deps.baseUrl;
    this.#request = deps.request;
  }

  async check(input: CheckHotelPriceInput): Promise<CheckHotelPriceOutput> {
    const req = mappers.toCheckRequest(this.#baseUrl, input);
    const res = await this.#request(req);
    return mappers.fromCheckResponse(res);
  }
}
