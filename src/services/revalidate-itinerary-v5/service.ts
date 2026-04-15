import type { SabreRequest, SabreResponse } from '../../http/types.js';
import type { ServiceDeps } from '../types.js';
import * as mappers from './mappers.js';
import type { RevalidateItineraryInput, RevalidateItineraryOutput } from './types.js';

/**
 * Sabre Revalidate Itinerary v5.
 *
 * Rechecks availability and pricing for a specific itinerary option
 * without booking it. The consumer provides exact flight details
 * (airline, flight number, times, optional booking class) and Sabre
 * confirms whether the itinerary is still valid for purchase at the
 * returned price. NDC content is not supported.
 *
 * Source: Sabre API "Revalidate Itinerary" v5
 *   - Operation: `CreateRevalidateItinerary` (`POST /v5/shop/flights/revalidate`)
 *   - Docs: https://developer.sabre.com/docs/rest_apis/air/search/revalidate_itinerary
 *
 * Construct via {@link createSabreClient}; do not implement this interface
 * yourself.
 */
export interface RevalidateItineraryV5Service {
  /**
   * Revalidate a specific itinerary and return pricing if still
   * available.
   *
   * @param input Origin/destination legs with exact flight details,
   *   passenger groups, and point of sale.
   * @returns The priced itineraries (typically one, confirming the
   *   revalidated option) plus any server messages.
   */
  revalidate(input: RevalidateItineraryInput): Promise<RevalidateItineraryOutput>;
}

/**
 * Internal implementation of {@link RevalidateItineraryV5Service}. Not
 * exported from the package; consumers obtain instances exclusively via
 * {@link createSabreClient}.
 */
export class DefaultRevalidateItineraryV5Service implements RevalidateItineraryV5Service {
  readonly #baseUrl: string;
  readonly #request: (req: SabreRequest) => Promise<SabreResponse>;

  constructor(deps: ServiceDeps) {
    this.#baseUrl = deps.baseUrl;
    this.#request = deps.request;
  }

  async revalidate(input: RevalidateItineraryInput): Promise<RevalidateItineraryOutput> {
    const req = mappers.toRevalidateRequest(this.#baseUrl, input);
    const res = await this.#request(req);
    return mappers.fromRevalidateResponse(res);
  }
}
