import type { SabreRequest, SabreResponse } from '../../http/types.js';
import type { ServiceDeps } from '../types.js';
import * as mappers from './mappers.js';
import type { GetHotelDetailsInput, GetHotelDetailsOutput } from './types.js';

/**
 * Sabre Get Hotel Details v5.
 *
 * Returns a single property's full rate grid (room types × rate plans),
 * optional descriptive content (property info, location, amenities, hotel
 * policies, descriptions), optional media (images, panoramics, videos), and
 * alternate-property suggestions. This is the canonical "Refine" step in
 * the CSL orchestrated hotel booking flow:
 *
 *   hotel-search → get-hotel-avail → **get-hotel-details** → hotel-price-check → create-PNR
 *
 * The OAS request body is a `oneOf` between a fresh shop
 * (`SearchByHotelRefsAndRateInfoRef` — hotel code + rate criteria) and a
 * rerun (`SearchByRateKey` — the opaque rate key from a prior response).
 * The public input mirrors that as a discriminated union on `kind` and
 * adds an optional `contentRef` that opts in to descriptive / media
 * content in the response.
 *
 * Source: Sabre API "Get Hotel Details" v5.1
 *   - Operation: `getHotelDetails` (`POST /v5/get/hoteldetails`)
 *   - Docs: https://developer.sabre.com/docs/rest_apis/hotel/search/get_hotel_details
 *
 * Construct via {@link createSabreClient}; do not implement this interface
 * yourself.
 */
export interface GetHotelDetailsV5Service {
  /**
   * Fetch the full rate grid and optional descriptive / media content for
   * a single hotel property.
   *
   * @param input Either (a) a hotel reference plus rate criteria (stay
   *   window, rooms, filters, sort) for a fresh shop, or (b) an opaque
   *   `rateKey` from a prior response to rerun the same search. Both
   *   variants accept an optional `contentRef` that requests descriptive
   *   / media blocks in the response.
   * @returns The hotel's full rate + content graph — application
   *   diagnostics, identity codes, native and converted rate entries,
   *   per-room detail (or grouped room-set detail), descriptive
   *   content, media items, and alternate property suggestions.
   *
   * @see getHotelDetails (Sabre operationId)
   */
  getDetails(input: GetHotelDetailsInput): Promise<GetHotelDetailsOutput>;
}

/**
 * Internal implementation of {@link GetHotelDetailsV5Service}. Not exported
 * from the package; consumers obtain instances exclusively via
 * {@link createSabreClient}.
 */
export class DefaultGetHotelDetailsV5Service implements GetHotelDetailsV5Service {
  readonly #baseUrl: string;
  readonly #request: (req: SabreRequest) => Promise<SabreResponse>;

  constructor(deps: ServiceDeps) {
    this.#baseUrl = deps.baseUrl;
    this.#request = deps.request;
  }

  async getDetails(input: GetHotelDetailsInput): Promise<GetHotelDetailsOutput> {
    const req = mappers.toGetDetailsRequest(this.#baseUrl, input);
    const res = await this.#request(req);
    return mappers.fromGetDetailsResponse(res);
  }
}
