import type { SabreRequest, SabreResponse } from '../../http/types.js';
import type { ServiceDeps } from '../types.js';
import * as mappers from './mappers.js';
import type { FlightReshopInput, FlightReshopOutput } from './types.js';

/**
 * Sabre Flight Reshop v1.0.
 *
 * Shops for **priceable reissue offers** against an existing ticket (or
 * booking): given the journeys a traveler wants to change to, it
 * returns exchange offers with the fare difference, change fee, and new
 * flights — the REST replacement for the legacy `ExchangeShoppingRQ`
 * SOAP service. Use it to show "if you change to flight X, the new
 * price is $Y" before committing, instead of guessing replacement fares
 * that later fail Category-31 pricing in Exchange Booking.
 *
 * This is a **read-only** shopping call — it does not cancel, rebook, or
 * reissue. Pair it with Exchange Booking to commit the reissue and
 * Fulfill Flight Tickets to issue. The operation resolves with HTTP 200
 * even when no offers can be produced (the reason lands in
 * {@link FlightReshopOutput.errors}), so callers must check `errors`.
 *
 * Caveats (per Sabre, 2026): the API is **beta**, a **premium** product,
 * and limited to **ATPCO** content (NDC in progress). The endpoint
 * requires PCC entitlement, and the ticket must be provisioned for
 * automated reissue — a CAT-31-changeable ticket can still return
 * "Automated reissue not active for this ticket" if that capability is
 * not enabled.
 *
 * Source: Sabre API "Flight Reshop" v1.0
 *   - Operation: `flightReshop` (`POST /v1/offers/flightReshop`)
 *   - Docs: https://developer.sabre.com/rest-api/flight-reshop-api/1.0/index.html
 *
 * Construct via {@link createSabreClient}; do not implement this
 * interface yourself.
 */
export interface FlightReshopV1Service {
  /**
   * Shop for exchange/reissue offers for an existing ticket.
   *
   * @param input The journeys to change to, the ticket(s) to reprice,
   *   and optional qualifiers (booking id, target PCC, cabin,
   *   distribution model).
   * @returns The priceable offers (with fare difference and change
   *   fee), the flights/journeys they reference, and any errors or
   *   warnings Sabre returned.
   *
   * @see flightReshop (Sabre operationId)
   */
  reshop(input: FlightReshopInput): Promise<FlightReshopOutput>;
}

/**
 * Internal implementation of {@link FlightReshopV1Service}. Not exported
 * from the package; consumers obtain instances exclusively via
 * {@link createSabreClient}.
 */
export class DefaultFlightReshopV1Service implements FlightReshopV1Service {
  readonly #baseUrl: string;
  readonly #request: (req: SabreRequest) => Promise<SabreResponse>;

  constructor(deps: ServiceDeps) {
    this.#baseUrl = deps.baseUrl;
    this.#request = deps.request;
  }

  async reshop(input: FlightReshopInput): Promise<FlightReshopOutput> {
    const req = mappers.toReshopRequest(this.#baseUrl, input);
    const res = await this.#request(req);
    return mappers.fromReshopResponse(res);
  }
}
