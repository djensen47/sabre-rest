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
export type { BookingManagementV1Service } from './services/booking-management-v1/service.js';
export type {
  BookAddress,
  BookAgency,
  BookAncillary,
  BookCar,
  BookContactInfo,
  BookFlight,
  BookFlightDetails,
  BookFlightOffer,
  BookFormOfPayment,
  BookHotel,
  BookIdentityDocument,
  BookLoyaltyProgram,
  BookNotification,
  BookOtherService,
  BookPayment,
  BookPhone,
  BookProfile,
  BookRemark,
  BookSpecialService,
  BookTraveler,
  BookTravelerEmployer,
  Booking,
  BookingAccountingItem,
  BookingAncillary,
  BookingBaggageAllowance,
  BookingBaggagePolicy,
  BookingCar,
  BookingCommission,
  BookingContactInfo,
  BookingCreationDetails,
  BookingCruise,
  BookingError,
  BookingFare,
  BookingFareComponent,
  BookingFareOffer,
  BookingFareRule,
  BookingFareRulePenalty,
  BookingFlight,
  BookingFlightTicket,
  BookingFormOfPayment,
  BookingHotel,
  BookingJourney,
  BookingMonetaryValue,
  BookingNonElectronicTicket,
  BookingPayments,
  BookingProfile,
  BookingRemark,
  BookingReturnOnly,
  BookingSegment,
  BookingSource,
  BookingSpecialService,
  BookingTotalValues,
  BookingTrain,
  BookingTraveler,
  BookingTravelersGroup,
  CreateBookingInput,
  CreateBookingOutput,
  GetBookingExtraFeatures,
  GetBookingInput,
  GetBookingOutput,
} from './services/booking-management-v1/types.js';
export type { BargainFinderMaxV5Service } from './services/bargain-finder-max-v5/service.js';
export type { GetAncillariesV2Service } from './services/get-ancillaries-v2/service.js';
export type {
  AncillaryError,
  AncillaryOfferItem,
  AncillaryPassenger,
  AncillaryPriceDefinition,
  AncillarySegment,
  AncillaryServiceDefinition,
  AncillaryWarning,
  GetAncillariesInput,
  GetAncillariesOutput,
} from './services/get-ancillaries-v2/types.js';
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
export type { GetSeatsV2Service } from './services/get-seats-v2/service.js';
export type {
  GetSeatsInput,
  GetSeatsOfferInput,
  GetSeatsOrderInput,
  GetSeatsOutput,
  GetSeatsPayloadInput,
  GetSeatsStatelessInput,
  Seat,
  SeatALaCarteOffer,
  SeatALaCarteOfferItem,
  SeatCabinCompartment,
  SeatCabinLayout,
  SeatCabinType,
  SeatCharacteristic,
  SeatDataLists,
  SeatError,
  SeatMap,
  SeatPaxSegmentRS,
  SeatPayloadAttributes,
  SeatPointOfSale,
  SeatPrice,
  SeatProfile,
  SeatRow,
  SeatServiceDefinition,
  SeatShoppingResponse,
  SeatWarning,
} from './services/get-seats-v2/types.js';
export type { MultiAirportCityLookupV1Service } from './services/multi-airport-city-lookup-v1/service.js';
export type {
  CityLink,
  LookupCitiesInput,
  LookupCitiesOutput,
  MultiAirportCity,
} from './services/multi-airport-city-lookup-v1/types.js';
export type { RevalidateItineraryV5Service } from './services/revalidate-itinerary-v5/service.js';
export type {
  RevalidateFlight,
  RevalidateItineraryInput,
  RevalidateItineraryOutput,
  RevalidateOriginDestination,
} from './services/revalidate-itinerary-v5/types.js';
