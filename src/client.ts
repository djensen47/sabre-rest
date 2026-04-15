import type { TokenProvider } from './auth/types.js';
import { buildChain } from './http/chain.js';
import type { Middleware, SabreRequest, SabreResponse } from './http/types.js';
import { createAuthMiddleware } from './middleware/auth.js';
import { createErrorMappingMiddleware } from './middleware/error-mapping.js';
import {
  type AirlineAllianceLookupV1Service,
  DefaultAirlineAllianceLookupV1Service,
} from './services/airline-alliance-lookup-v1/service.js';
import {
  type AirlineLookupV1Service,
  DefaultAirlineLookupV1Service,
} from './services/airline-lookup-v1/service.js';
import {
  type BargainFinderMaxV5Service,
  DefaultBargainFinderMaxV5Service,
} from './services/bargain-finder-max-v5/service.js';
import {
  DefaultGetAncillariesV2Service,
  type GetAncillariesV2Service,
} from './services/get-ancillaries-v2/service.js';
import {
  DefaultMultiAirportCityLookupV1Service,
  type MultiAirportCityLookupV1Service,
} from './services/multi-airport-city-lookup-v1/service.js';
import {
  DefaultRevalidateItineraryV5Service,
  type RevalidateItineraryV5Service,
} from './services/revalidate-itinerary-v5/service.js';
import type { ServiceDeps } from './services/types.js';

/**
 * The public Sabre REST client.
 *
 * Holds the configured HTTP transport and the constructed services. New
 * services appear as readonly properties on this interface as they are
 * added.
 *
 * Construct via {@link createSabreClient}; do not implement this interface
 * yourself.
 */
export interface SabreClient {
  /**
   * Sabre Airline Lookup v1.
   *
   * Returns the airline name(s) associated with one or more IATA airline
   * codes. With no codes supplied, returns every airline Sabre knows about.
   */
  readonly airlineLookupV1: AirlineLookupV1Service;

  /**
   * Sabre Airline Alliance Lookup v1.
   *
   * Returns the airline alliance group(s) and member airlines for one or
   * more alliance codes (`*A`, `*O`, `*S`). With no codes supplied,
   * returns every alliance.
   */
  readonly airlineAllianceLookupV1: AirlineAllianceLookupV1Service;

  /**
   * Sabre Bargain Finder Max v5.
   *
   * BFM is Sabre's flagship low-fare search product. Returns priced
   * itinerary options for one or more origin/destination legs and
   * passenger groups, ranked by Sabre's shopping engine.
   */
  readonly bargainFinderMaxV5: BargainFinderMaxV5Service;

  /**
   * Sabre Get Ancillaries v2.
   *
   * Retrieves ancillary services (baggage, seats, meals, etc.) for a
   * given Sabre order in NDC format.
   */
  readonly getAncillariesV2: GetAncillariesV2Service;

  /**
   * Sabre Multi-Airport City Lookup v1.
   *
   * Returns multi-airport city (MAC) codes, optionally filtered by country.
   */
  readonly multiAirportCityLookupV1: MultiAirportCityLookupV1Service;

  /**
   * Sabre Revalidate Itinerary v5.
   *
   * Rechecks availability and pricing for a specific itinerary option
   * without booking it. NDC content is not supported.
   */
  readonly revalidateItineraryV5: RevalidateItineraryV5Service;

  /**
   * Send a request through the configured middleware chain. Used by
   * service implementations; rarely useful to call directly.
   */
  request(req: SabreRequest): Promise<SabreResponse>;
}

/**
 * Options for {@link createSabreClient}.
 *
 * `baseUrl` is required. Use one of the constants in `SabreBaseUrls` for
 * a known Sabre environment, or pass any string to point at a recording
 * proxy or test server.
 *
 * `auth` is the {@link TokenProvider} the client will use for bearer
 * authentication on every API call. Construct it with `createOAuthV2`
 * (and eventually `createOAuthV3`).
 *
 * `middleware` is an optional list of consumer middlewares. They wrap the
 * baked-in middlewares (auth and error-mapping) outermost-first. Common
 * uses: logging, tracing, metrics, custom headers.
 *
 * `overrideMiddleware: true` opts out of the baked-in middlewares
 * entirely. The `middleware` array becomes the entire chain (minus the
 * `fetch` terminator). When `overrideMiddleware` is true, passing `auth`
 * is an error: you are responsible for installing
 * `createAuthMiddleware(provider)` yourself if you want auth.
 */
export interface SabreClientOptions {
  baseUrl: string;
  auth?: TokenProvider;
  middleware?: readonly Middleware[];
  overrideMiddleware?: boolean;
}

/**
 * Constructs a {@link SabreClient}.
 *
 * Eagerly builds the middleware chain and any registered services. Throws
 * synchronously on misconfiguration (e.g., missing required options,
 * conflicting flags).
 */
export function createSabreClient(opts: SabreClientOptions): SabreClient {
  if (!opts.baseUrl) {
    throw new Error('createSabreClient: baseUrl is required');
  }

  let middlewares: readonly Middleware[];

  if (opts.overrideMiddleware) {
    if (opts.auth !== undefined) {
      throw new Error(
        'createSabreClient: `auth` is incompatible with `overrideMiddleware: true`. ' +
          'When overriding middleware, install `createAuthMiddleware(provider)` yourself.',
      );
    }
    middlewares = opts.middleware ?? [];
  } else {
    if (!opts.auth) {
      throw new Error(
        'createSabreClient: `auth` is required unless `overrideMiddleware: true` is set',
      );
    }
    // Default chain (outermost → innermost):
    //   [...consumer middleware, errorMap, auth, fetch]
    middlewares = [
      ...(opts.middleware ?? []),
      createErrorMappingMiddleware(),
      createAuthMiddleware(opts.auth),
    ];
  }

  const chain = buildChain(middlewares);
  const deps: ServiceDeps = { baseUrl: opts.baseUrl, request: chain };

  const airlineLookupV1 = new DefaultAirlineLookupV1Service(deps);
  const airlineAllianceLookupV1 = new DefaultAirlineAllianceLookupV1Service(deps);
  const bargainFinderMaxV5 = new DefaultBargainFinderMaxV5Service(deps);
  const getAncillariesV2 = new DefaultGetAncillariesV2Service(deps);
  const multiAirportCityLookupV1 = new DefaultMultiAirportCityLookupV1Service(deps);
  const revalidateItineraryV5 = new DefaultRevalidateItineraryV5Service(deps);

  return new DefaultSabreClient(chain, {
    airlineLookupV1,
    airlineAllianceLookupV1,
    bargainFinderMaxV5,
    getAncillariesV2,
    multiAirportCityLookupV1,
    revalidateItineraryV5,
  });
}

interface SabreClientServices {
  airlineLookupV1: AirlineLookupV1Service;
  airlineAllianceLookupV1: AirlineAllianceLookupV1Service;
  bargainFinderMaxV5: BargainFinderMaxV5Service;
  getAncillariesV2: GetAncillariesV2Service;
  multiAirportCityLookupV1: MultiAirportCityLookupV1Service;
  revalidateItineraryV5: RevalidateItineraryV5Service;
}

/**
 * Internal implementation of {@link SabreClient}. Not exported from the
 * package; consumers obtain instances exclusively via
 * {@link createSabreClient} and hold references typed as the interface.
 */
class DefaultSabreClient implements SabreClient {
  readonly #run: (req: SabreRequest) => Promise<SabreResponse>;
  readonly airlineLookupV1: AirlineLookupV1Service;
  readonly airlineAllianceLookupV1: AirlineAllianceLookupV1Service;
  readonly bargainFinderMaxV5: BargainFinderMaxV5Service;
  readonly getAncillariesV2: GetAncillariesV2Service;
  readonly multiAirportCityLookupV1: MultiAirportCityLookupV1Service;
  readonly revalidateItineraryV5: RevalidateItineraryV5Service;

  constructor(run: (req: SabreRequest) => Promise<SabreResponse>, services: SabreClientServices) {
    this.#run = run;
    this.airlineLookupV1 = services.airlineLookupV1;
    this.airlineAllianceLookupV1 = services.airlineAllianceLookupV1;
    this.bargainFinderMaxV5 = services.bargainFinderMaxV5;
    this.getAncillariesV2 = services.getAncillariesV2;
    this.multiAirportCityLookupV1 = services.multiAirportCityLookupV1;
    this.revalidateItineraryV5 = services.revalidateItineraryV5;
  }

  request(req: SabreRequest): Promise<SabreResponse> {
    return this.#run(req);
  }
}
