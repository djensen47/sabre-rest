import type { SabreRequest, SabreResponse } from '../../http/types.js';
import type { ServiceDeps } from '../types.js';
import * as mappers from './mappers.js';
import type { SearchExchangeFlightsInput, SearchExchangeFlightsOutput } from './types.js';

/**
 * Sabre Stateless Exchanges Air Search v1.
 *
 * Shops alternate flight itineraries for an existing booking that the
 * consumer wants to exchange. The response carries the priced delta —
 * fare difference, tax difference, and a `totalFees` breakdown that
 * splits change-fees from other fees per Cat-31 evaluation. A fully
 * refundable / no-penalty fare comes back with `differenceType: 'Even'`
 * (or `'Refund'`) and an empty/zero `ChangeFees` entry; the same code
 * path covers both the priced and the no-fee case.
 *
 * This is a **read-only quote** — it does not cancel, rebook, or commit
 * a Price Quote Reissue (PQR) onto the PNR. To actually perform the
 * exchange, follow up with Sabre's `Exchange Booking` API.
 *
 * Source: Sabre API "Stateless Exchanges Air Search" v1.2
 *   - Operation: `AirExchangeSearch` (`POST /v1/dc/exchanges/getFlights`)
 *   - Docs: https://developer.sabre.com/product-catalog?query=exchange&type=REST+API
 *
 * Construct via {@link createSabreClient}; do not implement this interface
 * yourself.
 */
export interface StatelessExchangesAirSearchV1Service {
  /**
   * Shop alternate exchangeable itineraries and return the priced delta
   * Sabre found, including any change-fee / penalty breakdown.
   *
   * @param input PNR locator, shopping source, itinerary parts, client
   *   context, and optional documents/preferences.
   * @returns Priced exchange itineraries plus warning and error messages
   *   from the 200 envelope.
   */
  search(input: SearchExchangeFlightsInput): Promise<SearchExchangeFlightsOutput>;
}

/**
 * Internal implementation of {@link StatelessExchangesAirSearchV1Service}.
 * Not exported from the package; consumers obtain instances exclusively
 * via {@link createSabreClient}.
 */
export class DefaultStatelessExchangesAirSearchV1Service
  implements StatelessExchangesAirSearchV1Service
{
  readonly #baseUrl: string;
  readonly #request: (req: SabreRequest) => Promise<SabreResponse>;

  constructor(deps: ServiceDeps) {
    this.#baseUrl = deps.baseUrl;
    this.#request = deps.request;
  }

  async search(input: SearchExchangeFlightsInput): Promise<SearchExchangeFlightsOutput> {
    const req = mappers.toSearchRequest(this.#baseUrl, input);
    const res = await this.#request(req);
    return mappers.fromSearchResponse(res);
  }
}
