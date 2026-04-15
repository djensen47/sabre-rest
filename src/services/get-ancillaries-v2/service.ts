import type { SabreRequest, SabreResponse } from '../../http/types.js';
import type { ServiceDeps } from '../types.js';
import * as mappers from './mappers.js';
import type { GetAncillariesInput, GetAncillariesOutput } from './types.js';

/**
 * Sabre Get Ancillaries v2.
 *
 * Retrieves ancillary services (baggage, seats, meals, etc.) for a
 * given Sabre order in NDC format. Returns service definitions,
 * pricing, and the segments/passengers they apply to.
 *
 * Source: Sabre API "Get Ancillaries" v2.2
 *   - Operation: `getAncillaries` (`POST /v2/offers/getAncillaries`)
 *   - Docs: https://developer.sabre.com/docs/rest_apis/air/fulfill/get_ancillaries
 *
 * Construct via {@link createSabreClient}; do not implement this interface
 * yourself.
 */
export interface GetAncillariesV2Service {
  /**
   * Retrieve ancillary services available for a Sabre order.
   *
   * @param input Order ID and optional segment/passenger/group filters.
   * @returns Ancillary offer items, service definitions, pricing,
   *   plus any errors or warnings from the response.
   */
  getAncillaries(input: GetAncillariesInput): Promise<GetAncillariesOutput>;
}

/**
 * Internal implementation of {@link GetAncillariesV2Service}. Not
 * exported from the package; consumers obtain instances exclusively via
 * {@link createSabreClient}.
 */
export class DefaultGetAncillariesV2Service implements GetAncillariesV2Service {
  readonly #baseUrl: string;
  readonly #request: (req: SabreRequest) => Promise<SabreResponse>;

  constructor(deps: ServiceDeps) {
    this.#baseUrl = deps.baseUrl;
    this.#request = deps.request;
  }

  async getAncillaries(input: GetAncillariesInput): Promise<GetAncillariesOutput> {
    const req = mappers.toGetAncillariesRequest(this.#baseUrl, input);
    const res = await this.#request(req);
    return mappers.fromGetAncillariesResponse(res);
  }
}
