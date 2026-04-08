import type { SabreRequest, SabreResponse } from '../../http/types.js';
import type { ServiceDeps } from '../types.js';
import * as mappers from './mappers.js';
import type { LookupAirlineAlliancesInput, LookupAirlineAlliancesOutput } from './types.js';

/**
 * Sabre Airline Alliance Lookup v1.
 *
 * Returns the airline alliance group(s) and their member airlines for one
 * or more alliance codes (`*A`, `*O`, `*S`). With no codes supplied,
 * returns every alliance Sabre knows about.
 *
 * Source: Sabre API "Airline Alliance Lookup" v1
 *   - Operation: `airlinesAlliancesLookup`
 *     (`GET /v1/lists/utilities/airlines/alliances`)
 *   - Docs: https://developer.sabre.com/docs/rest_apis/utility/lookup/airline_alliance_lookup
 *
 * Construct via {@link createSabreClient}; do not implement this interface
 * yourself.
 */
export interface AirlineAllianceLookupV1Service {
  /**
   * Look up airline alliances by group code.
   *
   * @param input Optional input. Omit or pass an empty `codes` array to
   *   retrieve every alliance; pass one or more alliance group codes
   *   (e.g., `["*A", "*O"]`) to look up specific alliances.
   * @returns The alliances Sabre returned, each with its member airline
   *   codes. Empty if none of the supplied codes matched.
   */
  lookup(input?: LookupAirlineAlliancesInput): Promise<LookupAirlineAlliancesOutput>;
}

/**
 * Internal implementation of {@link AirlineAllianceLookupV1Service}. Not
 * exported from the package; consumers obtain instances exclusively via
 * {@link createSabreClient}.
 */
export class DefaultAirlineAllianceLookupV1Service implements AirlineAllianceLookupV1Service {
  readonly #baseUrl: string;
  readonly #request: (req: SabreRequest) => Promise<SabreResponse>;

  constructor(deps: ServiceDeps) {
    this.#baseUrl = deps.baseUrl;
    this.#request = deps.request;
  }

  async lookup(input?: LookupAirlineAlliancesInput): Promise<LookupAirlineAlliancesOutput> {
    const req = mappers.toLookupRequest(this.#baseUrl, input);
    const res = await this.#request(req);
    return mappers.fromLookupResponse(res);
  }
}
