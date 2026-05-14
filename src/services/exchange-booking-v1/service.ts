import type { SabreRequest, SabreResponse } from '../../http/types.js';
import type { ServiceDeps } from '../types.js';
import * as mappers from './mappers.js';
import type { ExchangeFlightInput, ExchangeFlightOutput } from './types.js';

/**
 * Sabre Exchange Booking v1.1.0.
 *
 * Runs an entire ticket-exchange transaction against an existing PNR
 * in a single call: optionally cancel selected segments, optionally
 * sell new segments, price the exchange (creating a Price Quote
 * Reissue), optionally collect form-of-payment, and end-transact.
 *
 * Exchange Booking does **not** search for alternative flights — pair
 * it with {@link BargainFinderMaxV5Service.search} and
 * {@link RevalidateItineraryV5Service.revalidate} for the full
 * change-flight flow. Omit `confirm` to *quote* the exchange (PQR
 * stored, no FOP collection); pass `confirm` to *commit* (FOP
 * collected, ticket issued).
 *
 * Source: Sabre API "Exchange Booking" v1.1.0
 *   - Operation: `exchangeBooking` (`POST /v1.1.0/exchange/booking`)
 *   - Docs: https://developer.sabre.com/rest-api/exchange-booking/1.1.0/index.html
 *
 * Construct via {@link createSabreClient}; do not implement this
 * interface yourself.
 */
export interface ExchangeBookingV1Service {
  /**
   * Run an exchange transaction against an existing PNR.
   *
   * @param input PNR locator, original ticket number, segments to
   *   cancel and/or sell, pricing knobs, optional form-of-payment to
   *   commit.
   * @returns Application diagnostics, one entry per confirmed PQR,
   *   the priced PQR records (totals + change fee + baggage), and the
   *   full parsed response body.
   *
   * @see exchangeBooking (Sabre operationId)
   */
  exchange(input: ExchangeFlightInput): Promise<ExchangeFlightOutput>;
}

/**
 * Internal implementation of {@link ExchangeBookingV1Service}. Not
 * exported from the package; consumers obtain instances exclusively
 * via {@link createSabreClient}.
 */
export class DefaultExchangeBookingV1Service implements ExchangeBookingV1Service {
  readonly #baseUrl: string;
  readonly #request: (req: SabreRequest) => Promise<SabreResponse>;

  constructor(deps: ServiceDeps) {
    this.#baseUrl = deps.baseUrl;
    this.#request = deps.request;
  }

  async exchange(input: ExchangeFlightInput): Promise<ExchangeFlightOutput> {
    const req = mappers.toExchangeRequest(this.#baseUrl, input);
    const res = await this.#request(req);
    return mappers.fromExchangeResponse(res);
  }
}
