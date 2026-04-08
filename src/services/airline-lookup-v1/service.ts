import type { SabreRequest, SabreResponse } from '../../http/types.js';
import * as mappers from './mappers.js';
import type { LookupAirlinesInput, LookupAirlinesOutput } from './types.js';

/**
 * Sabre Airline Lookup v1.
 *
 * Returns the airline name(s) associated with one or more IATA airline
 * codes. With no codes supplied, returns every airline Sabre knows about.
 *
 * Source: Sabre API "Airline Lookup" v1
 *   - Operation: `airlinesLookup` (`GET /v1/lists/utilities/airlines`)
 *   - Docs: https://developer.sabre.com/docs/rest_apis/utility/lookup/airline_lookup
 *
 * Construct via {@link createSabreClient}; do not implement this interface
 * yourself.
 */
export interface AirlineLookupV1Service {
  /**
   * Look up airlines by IATA code.
   *
   * @param input Optional input. Omit or pass an empty `codes` array to
   *   retrieve every airline; pass one or more two-character IATA codes
   *   (e.g., `["AA", "DL"]`) to look up specific carriers.
   * @returns The airlines Sabre returned. Empty if none of the supplied
   *   codes matched.
   */
  lookup(input?: LookupAirlinesInput): Promise<LookupAirlinesOutput>;
}

/**
 * Dependencies a service needs from the constructing client.
 *
 * Lives here for now; will move to a shared `src/services/types.ts` once
 * a second service exists and the shape is proven.
 */
export interface AirlineLookupV1ServiceDeps {
  baseUrl: string;
  request: (req: SabreRequest) => Promise<SabreResponse>;
}

/**
 * Internal implementation of {@link AirlineLookupV1Service}. Not exported
 * from the package; consumers obtain instances exclusively via
 * {@link createSabreClient}.
 */
export class DefaultAirlineLookupV1Service implements AirlineLookupV1Service {
  readonly #baseUrl: string;
  readonly #request: (req: SabreRequest) => Promise<SabreResponse>;

  constructor(deps: AirlineLookupV1ServiceDeps) {
    this.#baseUrl = deps.baseUrl;
    this.#request = deps.request;
  }

  async lookup(input?: LookupAirlinesInput): Promise<LookupAirlinesOutput> {
    const req = mappers.toLookupRequest(this.#baseUrl, input);
    const res = await this.#request(req);
    return mappers.fromLookupResponse(res);
  }
}
