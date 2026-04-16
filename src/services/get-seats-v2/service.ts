import type { SabreRequest, SabreResponse } from '../../http/types.js';
import type { ServiceDeps } from '../types.js';
import * as mappers from './mappers.js';
import type { GetSeatsInput, GetSeatsOutput } from './types.js';

/**
 * Sabre Get Seats v2.
 *
 * Retrieves seat availability and pricing information for a given offer,
 * order, flight payload, or PNR locator. The response includes seat maps
 * with cabin compartments and individual seats, optional a-la-carte
 * pricing, and reference data lists.
 *
 * Source: Sabre API "Get Seats" v2.0
 *   - Operation: `getSeats` (`POST /v1/offers/getseats`)
 *   - Docs: https://developer.sabre.com/docs/rest_apis/air/search/get-seats
 *
 * Construct via {@link createSabreClient}; do not implement this interface
 * yourself.
 */
export interface GetSeatsV2Service {
  /**
   * Retrieve seat availability and pricing.
   *
   * The input is a discriminated union — set `requestType` to one of
   * `'offerId'`, `'orderId'`, `'payload'`, or `'stateless'` to select
   * the appropriate request variant.
   *
   * @param input - One of the four request variants.
   * @returns Seat maps, pricing, reference data, and any errors/warnings.
   */
  getSeats(input: GetSeatsInput): Promise<GetSeatsOutput>;
}

/**
 * Internal implementation of {@link GetSeatsV2Service}. Not exported from
 * the package; consumers obtain instances exclusively via
 * {@link createSabreClient}.
 */
export class DefaultGetSeatsV2Service implements GetSeatsV2Service {
  readonly #baseUrl: string;
  readonly #request: (req: SabreRequest) => Promise<SabreResponse>;

  constructor(deps: ServiceDeps) {
    this.#baseUrl = deps.baseUrl;
    this.#request = deps.request;
  }

  async getSeats(input: GetSeatsInput): Promise<GetSeatsOutput> {
    const req = mappers.toGetSeatsRequest(this.#baseUrl, input);
    const res = await this.#request(req);
    return mappers.fromGetSeatsResponse(res);
  }
}
