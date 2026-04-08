/**
 * Public entry point for `sabre-rest`.
 *
 * Service factories will be added here as services are implemented. See
 * AGENTS.md and docs/architecture.md for the architectural conventions
 * this package follows.
 */

// Constants
export { SabreBaseUrls } from './constants.js';

// Client
export { createSabreClient } from './client.js';
export type { SabreClient, SabreClientOptions } from './client.js';

// Auth
export { createOAuthV2 } from './auth/oauth-v2.js';
export type { OAuthV2Options } from './auth/oauth-v2.js';
export { createMemoryTokenStore } from './auth/memory-store.js';
export type { StoredToken, TokenProvider, TokenStore } from './auth/types.js';

// HTTP / middleware types (consumers writing their own middleware need these)
export type { Middleware, SabreHttpMethod, SabreRequest, SabreResponse } from './http/types.js';

// Building blocks for consumers using `overrideMiddleware: true`
export { createAuthMiddleware } from './middleware/auth.js';
export { createErrorMappingMiddleware } from './middleware/error-mapping.js';

// Errors
export {
  SabreApiResponseError,
  SabreAuthenticationError,
  SabreError,
  SabreNetworkError,
  SabreParseError,
  SabreTimeoutError,
} from './errors/index.js';

// Services — interface types only (concrete classes are internal)
export type { AirlineLookupV1Service } from './services/airline-lookup-v1/service.js';
export type {
  Airline,
  LookupAirlinesInput,
  LookupAirlinesOutput,
} from './services/airline-lookup-v1/types.js';
export type { AirlineAllianceLookupV1Service } from './services/airline-alliance-lookup-v1/service.js';
export type {
  AirlineAlliance,
  AirlineAllianceMember,
  LookupAirlineAlliancesInput,
  LookupAirlineAlliancesOutput,
} from './services/airline-alliance-lookup-v1/types.js';
export type { BargainFinderMaxV5Service } from './services/bargain-finder-max-v5/service.js';
export type {
  CabinClass,
  FlightSegment,
  ItineraryLeg,
  OriginDestination,
  PassengerCount,
  PointOfSale,
  PricedItinerary,
  SabreMessage,
  SearchBargainFinderMaxInput,
  SearchBargainFinderMaxOutput,
  SegmentEndpoint,
  TotalFare,
  TravelPreferences,
} from './services/bargain-finder-max-v5/types.js';
