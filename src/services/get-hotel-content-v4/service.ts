import type { SabreRequest, SabreResponse } from '../../http/types.js';
import type { ServiceDeps } from '../types.js';
import * as mappers from './mappers.js';
import type { GetHotelContentInput, GetHotelContentOutput } from './types.js';

/**
 * Sabre Get Hotel Content v4.
 *
 * Returns descriptive content (property info, location, amenities, security
 * features, free-text descriptions) and/or media content (images,
 * panoramics, videos) for a single hotel property. Unlike the other hotel
 * services, this API carries no rate or pricing data and has no "rerun by
 * opaque key" mode — it is a standalone content lookup by hotel reference.
 *
 * Source: Sabre API "Get Hotel Content" v4
 *   - Operation: `getHotelContent` (`POST /v4.0.0/get/hotelcontent`)
 *   - Docs: https://developer.sabre.com/docs/rest_apis/hotel/search/get_hotel_content
 *
 * Construct via {@link createSabreClient}; do not implement this interface
 * yourself.
 */
export interface GetHotelContentV4Service {
  /**
   * Fetch descriptive and/or media content for a single hotel property.
   *
   * @param input Hotel reference plus opt-in descriptive-info and media
   *   request blocks. Sabre returns neither block unless requested.
   * @returns Application diagnostics, hotel identity + summary metadata,
   *   and whichever descriptive / media content blocks were requested.
   *
   * @see getHotelContent (Sabre operationId)
   */
  getContent(input: GetHotelContentInput): Promise<GetHotelContentOutput>;
}

/**
 * Internal implementation of {@link GetHotelContentV4Service}. Not exported
 * from the package; consumers obtain instances exclusively via
 * {@link createSabreClient}.
 */
export class DefaultGetHotelContentV4Service implements GetHotelContentV4Service {
  readonly #baseUrl: string;
  readonly #request: (req: SabreRequest) => Promise<SabreResponse>;

  constructor(deps: ServiceDeps) {
    this.#baseUrl = deps.baseUrl;
    this.#request = deps.request;
  }

  async getContent(input: GetHotelContentInput): Promise<GetHotelContentOutput> {
    const req = mappers.toGetContentRequest(this.#baseUrl, input);
    const res = await this.#request(req);
    return mappers.fromGetContentResponse(res);
  }
}
