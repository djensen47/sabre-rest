import type { SabreRequest, SabreResponse } from '../../http/types.js';
import type { ServiceDeps } from '../types.js';
import * as mappers from './mappers.js';
import type { GetHotelRateInfoInput, GetHotelRateInfoOutput } from './types.js';

/**
 * Sabre Get Hotel Rate Info v5.
 *
 * Returns **all available rates for a single hotel property**. This is the
 * per-property drill-down counterpart to
 * {@link GetHotelAvailV5Service.getAvail} (which returns lead rates across
 * many properties). It is the optional third step in the hotel shopping
 * flow:
 *
 *   hotel-search → get-hotel-avail → get-hotel-rate-info → hotel-price-check → booking
 *
 * The OAS request body is a `oneOf` between a fresh shop
 * (`SearchByHotelRefsAndRateInfoRef` — hotel code + rate criteria) and a
 * rerun (`SearchByRateKey` — the opaque rate key from a prior response).
 * The public input mirrors that as a discriminated union on `kind`.
 *
 * Source: Sabre API "Get Hotel Rate Info" v5
 *   - Operation: `getHotelRateInfo` (`POST /v5/get/hotelrateinfo`)
 *   - Docs: https://developer.sabre.com/docs/rest_apis/hotel/search/get_hotel_rate_info
 *
 * Construct via {@link createSabreClient}; do not implement this interface
 * yourself.
 */
export interface GetHotelRateInfoV5Service {
  /**
   * Fetch all available rates for a single hotel property.
   *
   * @param input Either (a) a hotel reference plus rate criteria (stay
   *   window, rooms, filters, sort) for a fresh shop, or (b) an opaque
   *   `rateKey` from a prior response to rerun the same search, with the
   *   handful of optional refinements Sabre accepts on that path.
   * @returns The hotel's full rate graph — application diagnostics,
   *   identity codes, native and converted rate entries, per-room detail
   *   (or grouped room-set detail), alternate property suggestions, and
   *   unavailability fallbacks.
   *
   * @see getHotelRateInfo (Sabre operationId)
   */
  getRateInfo(input: GetHotelRateInfoInput): Promise<GetHotelRateInfoOutput>;
}

/**
 * Internal implementation of {@link GetHotelRateInfoV5Service}. Not
 * exported from the package; consumers obtain instances exclusively via
 * {@link createSabreClient}.
 */
export class DefaultGetHotelRateInfoV5Service implements GetHotelRateInfoV5Service {
  readonly #baseUrl: string;
  readonly #request: (req: SabreRequest) => Promise<SabreResponse>;

  constructor(deps: ServiceDeps) {
    this.#baseUrl = deps.baseUrl;
    this.#request = deps.request;
  }

  async getRateInfo(input: GetHotelRateInfoInput): Promise<GetHotelRateInfoOutput> {
    const req = mappers.toGetRateInfoRequest(this.#baseUrl, input);
    const res = await this.#request(req);
    return mappers.fromGetRateInfoResponse(res);
  }
}
