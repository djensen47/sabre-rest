import { SabreParseError } from '../../errors/sabre-parse-error.js';
import type { components } from '../../generated/booking-management.js';
import type { SabreRequest, SabreResponse } from '../../http/types.js';
import type {
  AncillaryToModify,
  AssociatedFlightDetailsToModify,
  BookAncillary,
  BookCar,
  BookContactInfo,
  BookFlight,
  BookFlightDetails,
  BookFlightOffer,
  BookFormOfPayment,
  BookHotel,
  BookNotification,
  BookNotificationEmail,
  BookOtherService,
  BookPayment,
  BookQueue,
  BookRemark,
  BookTraveler,
  BookTravelerEmployer,
  Booking,
  BookingAccountingItem,
  BookingAncillary,
  BookingBaggageAllowance,
  BookingBaggagePolicy,
  BookingBrandAttribute,
  BookingCar,
  BookingCarRefundPenalty,
  BookingCarRentalSite,
  BookingCommission,
  BookingCruise,
  BookingError,
  BookingFare,
  BookingFareComponent,
  BookingFareDifferenceBreakdown,
  BookingFareOffer,
  BookingFareRule,
  BookingFareRulePenalty,
  BookingFareService,
  BookingFlight,
  BookingFlightCoupon,
  BookingFlightTicket,
  BookingFormOfPayment,
  BookingGenericTotalValues,
  BookingHiddenStop,
  BookingHotel,
  BookingHotelRefundPenalty,
  BookingIdentityDocument,
  BookingInitialSellingFare,
  BookingJourney,
  BookingLoyaltyProgram,
  BookingMeal,
  BookingNonElectronicTicket,
  BookingPayments,
  BookingRemark,
  BookingReturnOnly,
  BookingSegment,
  BookingSource,
  BookingSpecialService,
  BookingTaxComponent,
  BookingTicketCoupon,
  BookingToModify,
  BookingTotalValues,
  BookingTrain,
  BookingTraveler,
  CancelBookingInput,
  CancelBookingOutput,
  CancelBookingTicket,
  CancelErrorPolicy,
  CancelFlightRefund,
  CancelFlightTicketOperation,
  CancelOffer,
  CancelRefundTax,
  CarReference,
  CheckRefundFee,
  CheckTicketsInput,
  CheckTicketsOutput,
  CheckedTicket,
  CreateBookingInput,
  CreateBookingOutput,
  CreationDetailsToModify,
  CruiseReference,
  DocumentsType,
  FareToModify,
  FlightReference,
  FlightReferenceToModify,
  FlightToModify,
  FulfillAgency,
  FulfillBaggageAllowance,
  FulfillBrandedFare,
  FulfillEndorsements,
  FulfillFormOfPayment,
  FulfillFutureProcessing,
  FulfillMiscellaneousServiceFee,
  FulfillNetRemit,
  FulfillPaymentMethod,
  FulfillSpecificFare,
  FulfillStrongCustomerAuthentication,
  FulfillTicket,
  FulfillTicketPenalty,
  FulfillTicketingQualifiers,
  FulfillTicketsInput,
  FulfillTicketsOutput,
  FulfillTraveler,
  FulfillValidityPeriod,
  FulfillmentDetails,
  GetBookingExtraFeatures,
  GetBookingInput,
  GetBookingOutput,
  HotelPenaltyValue,
  HotelReference,
  HotelToModify,
  IdentityDocumentToModify,
  ModifyBookingExtraFeatures,
  ModifyBookingInput,
  ModifyBookingOutput,
  MonetaryValue,
  OtherServiceToModify,
  OverrideTax,
  PaymentToModify,
  PrinterAddress,
  RefundFlightTicket,
  RefundQualifiers,
  RefundTicket,
  RefundTicketsInput,
  RefundTicketsOutput,
  RemarkToModify,
  RoomToModify,
  SeatToModify,
  SegmentReference,
  SpecialServiceToModify,
  TrainReference,
  TravelerToModify,
  VoidTicketsInput,
  VoidTicketsOutput,
} from './types.js';

const CREATE_BOOKING_PATH = 'v1/trip/orders/createBooking';
const GET_BOOKING_PATH = 'v1/trip/orders/getBooking';
const MODIFY_BOOKING_PATH = 'v1/trip/orders/modifyBooking';
const CANCEL_BOOKING_PATH = 'v1/trip/orders/cancelBooking';
const FULFILL_TICKETS_PATH = 'v1/trip/orders/fulfillFlightTickets';
const VOID_TICKETS_PATH = 'v1/trip/orders/voidFlightTickets';
const CHECK_TICKETS_PATH = 'v1/trip/orders/checkFlightTickets';
const REFUND_TICKETS_PATH = 'v1/trip/orders/refundFlightTickets';

/**
 * Builds the outgoing {@link SabreRequest} for the `createBooking`
 * operation.
 *
 * The request body matches the `CreateBookingRequest` schema. Fields
 * with spec-defined defaults (`receivedFrom`, `asynchronousUpdateWaitTime`)
 * are always sent.
 */
export function toCreateBookingRequest(baseUrl: string, input: CreateBookingInput): SabreRequest {
  const url = new URL(CREATE_BOOKING_PATH, ensureTrailingSlash(baseUrl));

  const body: Record<string, unknown> = {
    receivedFrom: input.receivedFrom ?? 'Create Booking',
    asynchronousUpdateWaitTime: input.asynchronousUpdateWaitTime ?? 0,
  };

  if (input.errorHandlingPolicy && input.errorHandlingPolicy.length > 0) {
    body.errorHandlingPolicy = input.errorHandlingPolicy;
  }
  if (input.targetPcc !== undefined) body.targetPcc = input.targetPcc;
  if (input.profiles && input.profiles.length > 0) body.profiles = input.profiles;
  if (input.agency !== undefined) body.agency = buildAgencyBody(input.agency);
  if (input.flightOffer !== undefined) body.flightOffer = buildFlightOfferBody(input.flightOffer);
  if (input.flightDetails !== undefined) {
    body.flightDetails = buildFlightDetailsBody(input.flightDetails);
  }
  if (input.hotel !== undefined) body.hotel = buildHotelBody(input.hotel);
  if (input.car !== undefined) body.car = buildCarBody(input.car);
  if (input.travelers && input.travelers.length > 0) {
    body.travelers = input.travelers.map(buildTravelerBody);
  }
  if (input.contactInfo !== undefined) body.contactInfo = buildContactInfoBody(input.contactInfo);
  if (input.payment !== undefined) body.payment = buildPaymentBody(input.payment);
  if (input.remarks && input.remarks.length > 0) body.remarks = input.remarks.map(buildRemarkBody);
  if (input.notification !== undefined) {
    body.notification = buildNotificationBody(input.notification);
  }
  if (input.otherServices && input.otherServices.length > 0) {
    body.otherServices = input.otherServices.map(buildOtherServiceBody);
  }
  if (input.retentionEndDate !== undefined) body.retentionEndDate = input.retentionEndDate;
  if (input.retentionLabel !== undefined) body.retentionLabel = input.retentionLabel;
  if (input.travelersEmployers && input.travelersEmployers.length > 0) {
    body.travelersEmployers = input.travelersEmployers.map(buildTravelerEmployerBody);
  }
  if (input.sendLoyaltiesToAllAirlines !== undefined) {
    body.sendLoyaltiesToAllAirlines = input.sendLoyaltiesToAllAirlines;
  }

  return {
    method: 'POST',
    url: url.toString(),
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  };
}

/**
 * Parses the `createBooking` response into the public output shape.
 *
 * Throws {@link SabreParseError} when the body is not valid JSON or
 * not an object.
 */
export function fromCreateBookingResponse(res: SabreResponse): CreateBookingOutput {
  let parsed: components['schemas']['CreateBookingResponse'];
  try {
    parsed = JSON.parse(res.body) as components['schemas']['CreateBookingResponse'];
  } catch (err) {
    throw new SabreParseError('Failed to parse Create Booking response as JSON', res.body, {
      cause: err,
    });
  }

  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new SabreParseError('Create Booking response was not a JSON object', parsed);
  }

  const out: CreateBookingOutput = {};

  if (parsed.timestamp !== undefined) out.timestamp = parsed.timestamp;
  if (parsed.confirmationId !== undefined) out.confirmationId = parsed.confirmationId;
  if (parsed.booking !== undefined) out.booking = buildBooking(parsed.booking);
  if (parsed.errors !== undefined && parsed.errors.length > 0) {
    out.errors = parsed.errors.map(buildBookingError);
  }

  return out;
}

/**
 * Builds the outgoing {@link SabreRequest} for the `getBooking` operation.
 *
 * `confirmationId` is required; all other fields are forwarded only when
 * supplied by the caller. No fields in `GetBookingRequest` carry a
 * spec-defined default, so there is nothing to send on behalf of an
 * omitted value.
 */
export function toGetBookingRequest(baseUrl: string, input: GetBookingInput): SabreRequest {
  const url = new URL(GET_BOOKING_PATH, ensureTrailingSlash(baseUrl));

  const body: Record<string, unknown> = {
    confirmationId: input.confirmationId,
  };

  if (input.bookingSource !== undefined) body.bookingSource = input.bookingSource;
  if (input.targetPcc !== undefined) body.targetPcc = input.targetPcc;
  if (input.givenName !== undefined) body.givenName = input.givenName;
  if (input.middleName !== undefined) body.middleName = input.middleName;
  if (input.surname !== undefined) body.surname = input.surname;
  if (input.returnOnly && input.returnOnly.length > 0) {
    body.returnOnly = [...input.returnOnly];
  }
  if (input.extraFeatures !== undefined) {
    body.extraFeatures = buildExtraFeaturesBody(input.extraFeatures);
  }
  if (input.unmaskPaymentCardNumbers !== undefined) {
    body.unmaskPaymentCardNumbers = input.unmaskPaymentCardNumbers;
  }

  return {
    method: 'POST',
    url: url.toString(),
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  };
}

/**
 * Parses the `getBooking` response into the public output shape.
 *
 * The response wire format is `Booking & { timestamp, bookingSignature,
 * request, errors }`; this function maps both the booking fields and the
 * response-level metadata. Throws {@link SabreParseError} when the body
 * is not valid JSON or not an object.
 */
export function fromGetBookingResponse(res: SabreResponse): GetBookingOutput {
  let parsed: components['schemas']['GetBookingResponse'];
  try {
    parsed = JSON.parse(res.body) as components['schemas']['GetBookingResponse'];
  } catch (err) {
    throw new SabreParseError('Failed to parse Get Booking response as JSON', res.body, {
      cause: err,
    });
  }

  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new SabreParseError('Get Booking response was not a JSON object', parsed);
  }

  const booking = buildBooking(parsed);
  const out: GetBookingOutput = { ...booking };

  if (parsed.timestamp !== undefined) out.timestamp = parsed.timestamp;
  if (parsed.bookingSignature !== undefined) out.bookingSignature = parsed.bookingSignature;
  if (parsed.request !== undefined) out.request = buildGetBookingRequestEcho(parsed.request);
  if (parsed.errors !== undefined && parsed.errors.length > 0) {
    out.errors = parsed.errors.map(buildBookingError);
  }

  return out;
}

/**
 * Builds the outgoing {@link SabreRequest} for the `modifyBooking`
 * operation.
 *
 * The request body matches the `ModifyBookingRequest` schema. Fields
 * with spec-defined defaults (`receivedFrom`, `retrieveBooking`) are
 * always sent. `confirmationId`, `bookingSignature`, `before`, and
 * `after` are required by the spec and passed through verbatim.
 */
export function toModifyBookingRequest(baseUrl: string, input: ModifyBookingInput): SabreRequest {
  const url = new URL(MODIFY_BOOKING_PATH, ensureTrailingSlash(baseUrl));

  const body: Record<string, unknown> = {
    confirmationId: input.confirmationId,
    bookingSignature: input.bookingSignature,
    before: buildBookingToModifyBody(input.before),
    after: buildBookingToModifyBody(input.after),
    retrieveBooking: input.retrieveBooking ?? false,
    receivedFrom: input.receivedFrom ?? 'Modify Booking',
  };

  if (input.bookingSource !== undefined) body.bookingSource = input.bookingSource;
  if (input.targetPcc !== undefined) body.targetPcc = input.targetPcc;
  if (input.unmaskPaymentCardNumbers !== undefined) {
    body.unmaskPaymentCardNumbers = input.unmaskPaymentCardNumbers;
  }
  if (input.extraFeatures !== undefined) {
    body.extraFeatures = buildModifyExtraFeaturesBody(input.extraFeatures);
  }

  return {
    method: 'POST',
    url: url.toString(),
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  };
}

/**
 * Parses the `modifyBooking` response into the public output shape.
 *
 * Throws {@link SabreParseError} when the body is not valid JSON or
 * not an object.
 */
export function fromModifyBookingResponse(res: SabreResponse): ModifyBookingOutput {
  let parsed: components['schemas']['ModifyBookingResponse'];
  try {
    parsed = JSON.parse(res.body) as components['schemas']['ModifyBookingResponse'];
  } catch (err) {
    throw new SabreParseError('Failed to parse Modify Booking response as JSON', res.body, {
      cause: err,
    });
  }

  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new SabreParseError('Modify Booking response was not a JSON object', parsed);
  }

  const out: ModifyBookingOutput = {};

  if (parsed.timestamp !== undefined) out.timestamp = parsed.timestamp;
  if (parsed.booking !== undefined) out.booking = buildBooking(parsed.booking);
  if (parsed.request !== undefined) {
    out.request = buildModifyBookingRequestEcho(parsed.request);
  }
  if (parsed.errors !== undefined && parsed.errors.length > 0) {
    out.errors = parsed.errors.map(buildBookingError);
  }

  return out;
}

/**
 * Builds the outgoing {@link SabreRequest} for the `cancelBooking`
 * operation.
 *
 * The request body matches the `CancelBookingRequest` schema.
 * `confirmationId` is the only field Sabre marks as required. Fields
 * with spec-defined defaults (`retrieveBooking`, `cancelAll`,
 * `voidNonElectronicTickets`, `errorHandlingPolicy`,
 * `refundDocumentsType`) are always sent.
 */
export function toCancelBookingRequest(baseUrl: string, input: CancelBookingInput): SabreRequest {
  const url = new URL(CANCEL_BOOKING_PATH, ensureTrailingSlash(baseUrl));

  const body: Record<string, unknown> = {
    confirmationId: input.confirmationId,
    retrieveBooking: input.retrieveBooking ?? false,
    cancelAll: input.cancelAll ?? false,
    voidNonElectronicTickets: input.voidNonElectronicTickets ?? false,
    errorHandlingPolicy: input.errorHandlingPolicy ?? 'HALT_ON_ERROR',
    refundDocumentsType: input.refundDocumentsType ?? 'Tickets',
  };

  if (input.bookingSource !== undefined) body.bookingSource = input.bookingSource;
  if (input.receivedFrom !== undefined) body.receivedFrom = input.receivedFrom;
  if (input.flightTicketOperation !== undefined) {
    body.flightTicketOperation = input.flightTicketOperation;
  }
  if (input.flights && input.flights.length > 0) {
    body.flights = input.flights.map((f) => ({ itemId: f.itemId }));
  }
  if (input.hotels && input.hotels.length > 0) {
    body.hotels = input.hotels.map((h) => ({ itemId: h.itemId }));
  }
  if (input.cars && input.cars.length > 0) {
    body.cars = input.cars.map((c) => ({ itemId: c.itemId }));
  }
  if (input.trains && input.trains.length > 0) {
    body.trains = input.trains.map((t) => ({ itemId: t.itemId }));
  }
  if (input.cruises && input.cruises.length > 0) {
    body.cruises = input.cruises.map((c) => ({ itemId: c.itemId }));
  }
  if (input.segments && input.segments.length > 0) {
    body.segments = input.segments.map(buildSegmentReferenceBody);
  }
  if (input.targetPcc !== undefined) body.targetPcc = input.targetPcc;
  if (input.notification !== undefined) {
    body.notification = buildNotificationBody(input.notification);
  }
  if (input.designatePrinters && input.designatePrinters.length > 0) {
    body.designatePrinters = input.designatePrinters.map(buildPrinterAddressBody);
  }
  if (input.offerItemId !== undefined) body.offerItemId = input.offerItemId;
  if (input.retentionEndDate !== undefined) body.retentionEndDate = input.retentionEndDate;
  if (input.retentionLabel !== undefined) body.retentionLabel = input.retentionLabel;

  return {
    method: 'POST',
    url: url.toString(),
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  };
}

/**
 * Parses the `cancelBooking` response into the public output shape.
 *
 * Throws {@link SabreParseError} when the body is not valid JSON or
 * not an object.
 */
export function fromCancelBookingResponse(res: SabreResponse): CancelBookingOutput {
  let parsed: components['schemas']['CancelBookingResponse'];
  try {
    parsed = JSON.parse(res.body) as components['schemas']['CancelBookingResponse'];
  } catch (err) {
    throw new SabreParseError('Failed to parse Cancel Booking response as JSON', res.body, {
      cause: err,
    });
  }

  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new SabreParseError('Cancel Booking response was not a JSON object', parsed);
  }

  const out: CancelBookingOutput = {};

  if (parsed.timestamp !== undefined) out.timestamp = parsed.timestamp;
  if (parsed.request !== undefined) {
    out.request = buildCancelBookingRequestEcho(parsed.request);
  }
  if (parsed.booking !== undefined) out.booking = buildBooking(parsed.booking);
  if (parsed.tickets !== undefined) {
    out.tickets = parsed.tickets.map(buildCancelBookingTicket);
  }
  if (parsed.errors !== undefined && parsed.errors.length > 0) {
    out.errors = parsed.errors.map(buildBookingError);
  }
  if (parsed.voidedTickets !== undefined) {
    out.voidedTickets = [...parsed.voidedTickets];
  }
  if (parsed.refundedTickets !== undefined) {
    out.refundedTickets = [...parsed.refundedTickets];
  }
  if (parsed.flightRefunds !== undefined) {
    out.flightRefunds = parsed.flightRefunds.map(buildFlightRefund);
  }

  return out;
}

/**
 * Builds the outgoing {@link SabreRequest} for the `fulfillTickets`
 * operation.
 *
 * The request body matches the `FulfillTicketsRequest` schema.
 * `confirmationId` and `fulfillments` are required. Fields with
 * spec-defined defaults (`retainAccounting`, `receivedFrom`,
 * `generateSingleInvoice`, `commitTicketToBookingWaitTime`,
 * `acceptNegotiatedFare`, `acceptPriceChanges`) are always sent.
 */
export function toFulfillTicketsRequest(baseUrl: string, input: FulfillTicketsInput): SabreRequest {
  const url = new URL(FULFILL_TICKETS_PATH, ensureTrailingSlash(baseUrl));

  const body: Record<string, unknown> = {
    confirmationId: input.confirmationId,
    fulfillments: input.fulfillments.map(buildFulfillmentDetailsBody),
    retainAccounting: input.retainAccounting ?? false,
    receivedFrom: input.receivedFrom ?? 'Fulfill Flight Tickets',
    generateSingleInvoice: input.generateSingleInvoice ?? false,
    commitTicketToBookingWaitTime: input.commitTicketToBookingWaitTime ?? 0,
    acceptNegotiatedFare: input.acceptNegotiatedFare ?? true,
    acceptPriceChanges: input.acceptPriceChanges ?? true,
  };

  if (input.errorHandlingPolicy && input.errorHandlingPolicy.length > 0) {
    body.errorHandlingPolicy = [...input.errorHandlingPolicy];
  }
  if (input.bookingSource !== undefined) body.bookingSource = input.bookingSource;
  if (input.agency !== undefined) body.agency = buildFulfillAgencyBody(input.agency);
  if (input.targetPcc !== undefined) body.targetPcc = input.targetPcc;
  if (input.designatePrinters && input.designatePrinters.length > 0) {
    body.designatePrinters = input.designatePrinters.map(buildPrinterAddressBody);
  }
  if (input.formsOfPayment && input.formsOfPayment.length > 0) {
    body.formsOfPayment = input.formsOfPayment.map(buildFulfillFormOfPaymentBody);
  }
  if (input.travelers && input.travelers.length > 0) {
    body.travelers = input.travelers.map(buildFulfillTravelerBody);
  }
  if (input.backDatePriceQuoteMethod !== undefined) {
    body.backDatePriceQuoteMethod = input.backDatePriceQuoteMethod;
  }
  if (input.priceQuoteExpirationMethod !== undefined) {
    body.priceQuoteExpirationMethod = input.priceQuoteExpirationMethod;
  }
  if (input.notificationEmail !== undefined) body.notificationEmail = input.notificationEmail;

  return {
    method: 'POST',
    url: url.toString(),
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  };
}

/**
 * Parses the `fulfillTickets` response into the public output shape.
 *
 * Throws {@link SabreParseError} when the body is not valid JSON or
 * not an object.
 */
export function fromFulfillTicketsResponse(res: SabreResponse): FulfillTicketsOutput {
  let parsed: components['schemas']['FulfillTicketsResponse'];
  try {
    parsed = JSON.parse(res.body) as components['schemas']['FulfillTicketsResponse'];
  } catch (err) {
    throw new SabreParseError('Failed to parse Fulfill Tickets response as JSON', res.body, {
      cause: err,
    });
  }

  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new SabreParseError('Fulfill Tickets response was not a JSON object', parsed);
  }

  const out: FulfillTicketsOutput = {};

  if (parsed.timestamp !== undefined) out.timestamp = parsed.timestamp;
  if (parsed.tickets !== undefined) {
    out.tickets = parsed.tickets.map(buildFulfillTicket);
  }
  if (parsed.request !== undefined) {
    out.request = buildFulfillTicketsRequestEcho(parsed.request);
  }
  if (parsed.errors !== undefined && parsed.errors.length > 0) {
    out.errors = parsed.errors.map(buildBookingError);
  }

  return out;
}

/**
 * Builds the outgoing {@link SabreRequest} for the `voidTickets`
 * operation.
 *
 * The request body matches the `VoidTicketsRequest` schema. Every
 * field in the spec is optional; in practice at least `confirmationId`
 * or `tickets` should be supplied so Sabre can resolve the voiding
 * scope. Fields with spec-defined defaults (`voidNonElectronicTickets`)
 * are always sent, as is `errorHandlingPolicy` (whose enum carries a
 * `HALT_ON_ERROR` default in the spec — same convention as
 * `cancelBooking`).
 */
export function toVoidTicketsRequest(baseUrl: string, input: VoidTicketsInput): SabreRequest {
  const url = new URL(VOID_TICKETS_PATH, ensureTrailingSlash(baseUrl));

  const body: Record<string, unknown> = {
    voidNonElectronicTickets: input.voidNonElectronicTickets ?? false,
    errorHandlingPolicy: input.errorHandlingPolicy ?? 'HALT_ON_ERROR',
  };

  if (input.tickets && input.tickets.length > 0) body.tickets = [...input.tickets];
  if (input.confirmationId !== undefined) body.confirmationId = input.confirmationId;
  if (input.targetPcc !== undefined) body.targetPcc = input.targetPcc;
  if (input.receivedFrom !== undefined) body.receivedFrom = input.receivedFrom;
  if (input.notification !== undefined) {
    body.notification = buildNotificationBody(input.notification);
  }
  if (input.designatePrinters && input.designatePrinters.length > 0) {
    body.designatePrinters = input.designatePrinters.map(buildPrinterAddressBody);
  }

  return {
    method: 'POST',
    url: url.toString(),
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  };
}

/**
 * Parses the `voidTickets` response into the public output shape.
 *
 * Throws {@link SabreParseError} when the body is not valid JSON or
 * not an object.
 */
export function fromVoidTicketsResponse(res: SabreResponse): VoidTicketsOutput {
  let parsed: components['schemas']['VoidTicketsResponse'];
  try {
    parsed = JSON.parse(res.body) as components['schemas']['VoidTicketsResponse'];
  } catch (err) {
    throw new SabreParseError('Failed to parse Void Tickets response as JSON', res.body, {
      cause: err,
    });
  }

  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new SabreParseError('Void Tickets response was not a JSON object', parsed);
  }

  const out: VoidTicketsOutput = {};

  if (parsed.timestamp !== undefined) out.timestamp = parsed.timestamp;
  if (parsed.request !== undefined) {
    out.request = buildVoidTicketsRequestEcho(parsed.request);
  }
  if (parsed.errors !== undefined && parsed.errors.length > 0) {
    out.errors = parsed.errors.map(buildBookingError);
  }
  if (parsed.voidedTickets !== undefined) {
    out.voidedTickets = [...parsed.voidedTickets];
  }

  return out;
}

function buildVoidTicketsRequestEcho(
  req: components['schemas']['VoidTicketsRequest'],
): VoidTicketsInput {
  const out: VoidTicketsInput = {
    voidNonElectronicTickets: req.voidNonElectronicTickets,
  };
  if (req.tickets !== undefined) out.tickets = [...req.tickets];
  if (req.confirmationId !== undefined) out.confirmationId = req.confirmationId;
  if (req.errorHandlingPolicy !== undefined) out.errorHandlingPolicy = req.errorHandlingPolicy;
  if (req.targetPcc !== undefined) out.targetPcc = req.targetPcc;
  if (req.receivedFrom !== undefined) out.receivedFrom = req.receivedFrom;
  if (req.notification !== undefined) {
    const notification: BookNotification = {};
    if (req.notification.email !== undefined) notification.email = req.notification.email;
    if (req.notification.queuePlacement !== undefined) {
      notification.queuePlacement = req.notification.queuePlacement.map((q) => ({ ...q }));
    }
    out.notification = notification;
  }
  if (req.designatePrinters !== undefined) {
    out.designatePrinters = req.designatePrinters.map(buildPrinterAddressEcho);
  }
  return out;
}

// ---------------------------------------------------------------------------
// cancelBooking helpers
// ---------------------------------------------------------------------------

function buildSegmentReferenceBody(s: SegmentReference): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (s.sequence !== undefined) out.sequence = s.sequence;
  if (s.id !== undefined) out.id = s.id;
  return out;
}

function buildPrinterAddressBody(p: PrinterAddress): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (p.profileNumber !== undefined) out.profileNumber = p.profileNumber;
  if (p.hardcopy !== undefined) {
    const h: Record<string, unknown> = {};
    if (p.hardcopy.address !== undefined) h.address = p.hardcopy.address;
    if (p.hardcopy.spacing !== undefined) h.spacing = p.hardcopy.spacing;
    out.hardcopy = h;
  }
  if (p.invoiceItinerary !== undefined) out.invoiceItinerary = p.invoiceItinerary;
  if (p.ticket !== undefined) {
    const t: Record<string, unknown> = {};
    if (p.ticket.address !== undefined) t.address = p.ticket.address;
    if (p.ticket.countryCode !== undefined) t.countryCode = p.ticket.countryCode;
    out.ticket = t;
  }
  return out;
}

function buildCancelBookingRequestEcho(
  req: components['schemas']['CancelBookingRequest'],
): CancelBookingInput {
  const out: CancelBookingInput = {
    confirmationId: req.confirmationId,
    retrieveBooking: req.retrieveBooking,
    cancelAll: req.cancelAll,
    voidNonElectronicTickets: req.voidNonElectronicTickets,
  };
  if (req.bookingSource !== undefined) out.bookingSource = req.bookingSource as BookingSource;
  if (req.receivedFrom !== undefined) out.receivedFrom = req.receivedFrom;
  if (req.flightTicketOperation !== undefined) {
    out.flightTicketOperation = req.flightTicketOperation as CancelFlightTicketOperation;
  }
  if (req.errorHandlingPolicy !== undefined) {
    out.errorHandlingPolicy = req.errorHandlingPolicy as CancelErrorPolicy;
  }
  if (req.refundDocumentsType !== undefined) {
    out.refundDocumentsType = req.refundDocumentsType as DocumentsType;
  }
  if (req.flights !== undefined) {
    out.flights = req.flights.map((f): FlightReference => ({ itemId: f.itemId }));
  }
  if (req.hotels !== undefined) {
    out.hotels = req.hotels.map((h): HotelReference => ({ itemId: h.itemId }));
  }
  if (req.cars !== undefined) {
    out.cars = req.cars.map((c): CarReference => ({ itemId: c.itemId }));
  }
  if (req.trains !== undefined) {
    out.trains = req.trains.map((t): TrainReference => ({ itemId: t.itemId }));
  }
  if (req.cruises !== undefined) {
    out.cruises = req.cruises.map((c): CruiseReference => ({ itemId: c.itemId }));
  }
  if (req.segments !== undefined) {
    out.segments = req.segments.map((s): SegmentReference => {
      const ref: SegmentReference = {};
      if (s.sequence !== undefined) ref.sequence = s.sequence;
      if (s.id !== undefined) ref.id = s.id;
      return ref;
    });
  }
  if (req.targetPcc !== undefined) out.targetPcc = req.targetPcc;
  if (req.notification !== undefined) {
    const n: BookNotification = {};
    if (req.notification.email !== undefined) {
      n.email = req.notification.email as BookNotificationEmail;
    }
    if (req.notification.queuePlacement !== undefined) {
      n.queuePlacement = req.notification.queuePlacement as readonly BookQueue[];
    }
    out.notification = n;
  }
  if (req.designatePrinters !== undefined) {
    out.designatePrinters = req.designatePrinters.map((p): PrinterAddress => {
      const pa: PrinterAddress = {};
      if (p.profileNumber !== undefined) pa.profileNumber = p.profileNumber;
      if (p.hardcopy !== undefined) {
        const h: PrinterAddress['hardcopy'] = {};
        if (p.hardcopy.address !== undefined) h.address = p.hardcopy.address;
        if (p.hardcopy.spacing !== undefined) h.spacing = p.hardcopy.spacing;
        pa.hardcopy = h;
      }
      if (p.invoiceItinerary !== undefined) pa.invoiceItinerary = p.invoiceItinerary;
      if (p.ticket !== undefined) {
        const t: PrinterAddress['ticket'] = {};
        if (p.ticket.address !== undefined) t.address = p.ticket.address;
        if (p.ticket.countryCode !== undefined) t.countryCode = p.ticket.countryCode;
        pa.ticket = t;
      }
      return pa;
    });
  }
  if (req.offerItemId !== undefined) out.offerItemId = req.offerItemId;
  if (req.retentionEndDate !== undefined) out.retentionEndDate = req.retentionEndDate;
  if (req.retentionLabel !== undefined) out.retentionLabel = req.retentionLabel;
  return out;
}

function buildCancelBookingTicket(t: components['schemas']['Ticket']): CancelBookingTicket {
  const out: CancelBookingTicket = {};
  if (t.number !== undefined) out.number = t.number;
  if (t.isVoidable !== undefined) out.isVoidable = t.isVoidable;
  if (t.isRefundable !== undefined) out.isRefundable = t.isRefundable;
  if (t.isAutomatedRefundsEligible !== undefined) {
    out.isAutomatedRefundsEligible = t.isAutomatedRefundsEligible;
  }
  if (t.refundPenalties !== undefined) {
    out.refundPenalties = t.refundPenalties.map(buildPenaltyItem);
  }
  if (t.refundTaxes !== undefined) {
    out.refundTaxes = t.refundTaxes.map(buildCancelRefundTax);
  }
  if (t.refundTotals !== undefined) out.refundTotals = buildTotalValues(t.refundTotals);
  if (t.isChangeable !== undefined) out.isChangeable = t.isChangeable;
  if (t.exchangePenalties !== undefined) {
    out.exchangePenalties = t.exchangePenalties.map(buildPenaltyItem);
  }
  return out;
}

function buildPenaltyItem(p: components['schemas']['PenaltyItem']): BookingFareRulePenalty {
  const out: BookingFareRulePenalty = {
    applicability: p.applicability,
    conditionsApply: p.conditionsApply,
    penalty: buildMonetaryValue(p.penalty),
  };
  if (p.hasNoShowCost !== undefined) out.hasNoShowCost = p.hasNoShowCost;
  if (p.noShowPenalty?.penalty !== undefined) {
    out.noShowPenalty = buildMonetaryValue(p.noShowPenalty.penalty);
  }
  if (p.source !== undefined) out.source = p.source;
  return out;
}

function buildCancelRefundTax(t: components['schemas']['Tax']): CancelRefundTax {
  return { taxCode: t.taxCode, amount: t.amount };
}

function buildFlightRefund(f: components['schemas']['FlightRefund']): CancelFlightRefund {
  const out: CancelFlightRefund = {
    refundTotals: buildTotalValues(f.refundTotals),
  };
  if (f.airlineCode !== undefined) out.airlineCode = f.airlineCode;
  if (f.confirmationId !== undefined) out.confirmationId = f.confirmationId;
  return out;
}

// ---------------------------------------------------------------------------
// modifyBooking request body builders
// ---------------------------------------------------------------------------

function buildModifyExtraFeaturesBody(
  features: ModifyBookingExtraFeatures,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (features.returnFrequentRenter !== undefined) {
    out.returnFrequentRenter = features.returnFrequentRenter;
  }
  if (features.returnWalletFormsOfPayment !== undefined) {
    out.returnWalletFormsOfPayment = features.returnWalletFormsOfPayment;
  }
  if (features.returnFiscalId !== undefined) out.returnFiscalId = features.returnFiscalId;
  return out;
}

function buildBookingToModifyBody(snapshot: BookingToModify): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (snapshot.agencyCustomerNumber !== undefined) {
    out.agencyCustomerNumber = snapshot.agencyCustomerNumber;
  }
  if (snapshot.creationDetails !== undefined) {
    out.creationDetails = buildCreationDetailsToModifyBody(snapshot.creationDetails);
  }
  if (snapshot.flights !== undefined) {
    out.flights = snapshot.flights.map(buildFlightToModifyBody);
  }
  if (snapshot.remarks !== undefined) {
    out.remarks = snapshot.remarks.map(buildRemarkToModifyBody);
  }
  if (snapshot.hotels !== undefined) {
    out.hotels = snapshot.hotels.map(buildHotelToModifyBody);
  }
  if (snapshot.payments !== undefined) {
    out.payments = buildPaymentToModifyBody(snapshot.payments);
  }
  if (snapshot.specialServices !== undefined) {
    out.specialServices = snapshot.specialServices.map(buildSpecialServiceToModifyBody);
  }
  if (snapshot.travelers !== undefined) {
    out.travelers = snapshot.travelers.map(buildTravelerToModifyBody);
  }
  if (snapshot.retentionEndDate !== undefined) out.retentionEndDate = snapshot.retentionEndDate;
  if (snapshot.retentionLabel !== undefined) out.retentionLabel = snapshot.retentionLabel;
  if (snapshot.otherServices !== undefined) {
    out.otherServices = snapshot.otherServices.map(buildOtherServiceToModifyBody);
  }
  if (snapshot.fares !== undefined) {
    out.fares = snapshot.fares.map(buildFareToModifyBody);
  }
  return out;
}

function buildCreationDetailsToModifyBody(
  details: CreationDetailsToModify,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (details.agencyIataNumber !== undefined) out.agencyIataNumber = details.agencyIataNumber;
  return out;
}

function buildFlightToModifyBody(flight: FlightToModify): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (flight.seats !== undefined) {
    out.seats = flight.seats.map((seat) => (seat === null ? null : buildSeatToModifyBody(seat)));
  }
  if (flight.changeOfGaugeSeats !== undefined) {
    out.changeOfGaugeSeats = flight.changeOfGaugeSeats.map((seat) =>
      seat === null ? null : buildSeatToModifyBody(seat),
    );
  }
  return out;
}

function buildSeatToModifyBody(seat: SeatToModify): Record<string, unknown> {
  const out: Record<string, unknown> = { number: seat.number };
  if (seat.offerItemId !== undefined) out.offerItemId = seat.offerItemId;
  return out;
}

function buildRemarkToModifyBody(remark: RemarkToModify): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (remark.type !== undefined) out.type = remark.type;
  if (remark.alphaCode !== undefined) out.alphaCode = remark.alphaCode;
  if (remark.text !== undefined) out.text = remark.text;
  return out;
}

function buildHotelToModifyBody(hotel: HotelToModify): Record<string, unknown> {
  const out: Record<string, unknown> = {
    itemId: hotel.itemId,
    leadTravelerIndex: hotel.leadTravelerIndex,
    room: buildRoomToModifyBody(hotel.room),
    numberOfGuests: hotel.numberOfGuests,
    paymentPolicy: hotel.paymentPolicy,
  };
  if (hotel.bookingKey !== undefined) out.bookingKey = hotel.bookingKey;
  if (hotel.checkInDate !== undefined) out.checkInDate = hotel.checkInDate;
  if (hotel.checkOutDate !== undefined) out.checkOutDate = hotel.checkOutDate;
  if (hotel.corporateDiscountCode !== undefined) {
    out.corporateDiscountCode = hotel.corporateDiscountCode;
  }
  if (hotel.specialInstructions !== undefined) out.specialInstructions = hotel.specialInstructions;
  if (hotel.associatedFlightDetails !== undefined) {
    out.associatedFlightDetails = buildAssociatedFlightDetailsToModifyBody(
      hotel.associatedFlightDetails,
    );
  }
  if (hotel.formOfPaymentIndex !== undefined) out.formOfPaymentIndex = hotel.formOfPaymentIndex;
  return out;
}

function buildRoomToModifyBody(room: RoomToModify): Record<string, unknown> {
  const out: Record<string, unknown> = { travelerIndices: [...room.travelerIndices] };
  if (room.productCode !== undefined) out.productCode = room.productCode;
  return out;
}

function buildAssociatedFlightDetailsToModifyBody(
  details: AssociatedFlightDetailsToModify,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (details.arrivalAirlineCode !== undefined) out.arrivalAirlineCode = details.arrivalAirlineCode;
  if (details.arrivalFlightNumber !== undefined) {
    out.arrivalFlightNumber = details.arrivalFlightNumber;
  }
  if (details.arrivalTime !== undefined) out.arrivalTime = details.arrivalTime;
  if (details.departureAirlineCode !== undefined) {
    out.departureAirlineCode = details.departureAirlineCode;
  }
  if (details.departureFlightNumber !== undefined) {
    out.departureFlightNumber = details.departureFlightNumber;
  }
  if (details.departureTime !== undefined) out.departureTime = details.departureTime;
  return out;
}

function buildPaymentToModifyBody(payment: PaymentToModify): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (payment.formsOfPayment !== undefined) {
    out.formsOfPayment = payment.formsOfPayment.map(buildFormOfPaymentBody);
  }
  return out;
}

function buildSpecialServiceToModifyBody(service: SpecialServiceToModify): Record<string, unknown> {
  const out: Record<string, unknown> = { code: service.code };
  if (service.travelerIndices !== undefined) {
    out.travelerIndices = [...service.travelerIndices];
  }
  if (service.flights !== undefined) {
    out.flights = service.flights.map(buildFlightReferenceToModifyBody);
  }
  if (service.message !== undefined) out.message = service.message;
  return out;
}

function buildFlightReferenceToModifyBody(ref: FlightReferenceToModify): Record<string, unknown> {
  return { itemId: ref.itemId };
}

function buildTravelerToModifyBody(traveler: TravelerToModify): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (traveler.givenName !== undefined) out.givenName = traveler.givenName;
  if (traveler.middleName !== undefined) out.middleName = traveler.middleName;
  if (traveler.surname !== undefined) out.surname = traveler.surname;
  if (traveler.birthDate !== undefined) out.birthDate = traveler.birthDate;
  if (traveler.passengerCode !== undefined) out.passengerCode = traveler.passengerCode;
  if (traveler.nameReferenceCode !== undefined) out.nameReferenceCode = traveler.nameReferenceCode;
  if (traveler.isGrouped !== undefined) out.isGrouped = traveler.isGrouped;
  if (traveler.emails !== undefined) out.emails = [...traveler.emails];
  if (traveler.phones !== undefined) out.phones = traveler.phones.map((p) => ({ ...p }));
  if (traveler.remarks !== undefined) {
    out.remarks = traveler.remarks.map(buildRemarkToModifyBody);
  }
  if (traveler.identityDocuments !== undefined) {
    out.identityDocuments = traveler.identityDocuments.map(buildIdentityDocumentToModifyBody);
  }
  if (traveler.loyaltyPrograms !== undefined) {
    out.loyaltyPrograms = traveler.loyaltyPrograms.map((lp) => ({ ...lp }));
  }
  if (traveler.ancillaries !== undefined) {
    out.ancillaries = traveler.ancillaries.map(buildAncillaryToModifyBody);
  }
  return out;
}

function buildIdentityDocumentToModifyBody(doc: IdentityDocumentToModify): Record<string, unknown> {
  const out: Record<string, unknown> = { documentType: doc.documentType };
  if (doc.documentNumber !== undefined) out.documentNumber = doc.documentNumber;
  if (doc.expiryDate !== undefined) out.expiryDate = doc.expiryDate;
  if (doc.issuingCountryCode !== undefined) out.issuingCountryCode = doc.issuingCountryCode;
  if (doc.residenceCountryCode !== undefined) out.residenceCountryCode = doc.residenceCountryCode;
  if (doc.placeOfIssue !== undefined) out.placeOfIssue = doc.placeOfIssue;
  if (doc.placeOfBirth !== undefined) out.placeOfBirth = doc.placeOfBirth;
  if (doc.hostCountryCode !== undefined) out.hostCountryCode = doc.hostCountryCode;
  if (doc.issueDate !== undefined) out.issueDate = doc.issueDate;
  if (doc.givenName !== undefined) out.givenName = doc.givenName;
  if (doc.middleName !== undefined) out.middleName = doc.middleName;
  if (doc.surname !== undefined) out.surname = doc.surname;
  if (doc.birthDate !== undefined) out.birthDate = doc.birthDate;
  if (doc.gender !== undefined) out.gender = doc.gender;
  if (doc.isPrimaryDocumentHolder !== undefined) {
    out.isPrimaryDocumentHolder = doc.isPrimaryDocumentHolder;
  }
  if (doc.flights !== undefined) {
    out.flights = doc.flights.map(buildFlightReferenceToModifyBody);
  }
  return out;
}

function buildAncillaryToModifyBody(anc: AncillaryToModify): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (anc.itemId !== undefined) out.itemId = anc.itemId;
  if (anc.offerId !== undefined) out.offerId = anc.offerId;
  if (anc.description !== undefined) out.description = anc.description;
  if (anc.commercialName !== undefined) out.commercialName = anc.commercialName;
  if (anc.numberOfItems !== undefined) out.numberOfItems = anc.numberOfItems;
  if (anc.subcode !== undefined) out.subcode = anc.subcode;
  if (anc.airlineCode !== undefined) out.airlineCode = anc.airlineCode;
  if (anc.vendorCode !== undefined) out.vendorCode = anc.vendorCode;
  if (anc.source !== undefined) out.source = anc.source;
  if (anc.taxes !== undefined) out.taxes = anc.taxes.map((t) => ({ ...t }));
  if (anc.firstTravelDate !== undefined) out.firstTravelDate = anc.firstTravelDate;
  if (anc.lastTravelDate !== undefined) out.lastTravelDate = anc.lastTravelDate;
  if (anc.purchaseDateTime !== undefined) out.purchaseDateTime = anc.purchaseDateTime;
  if (anc.groupCode !== undefined) out.groupCode = anc.groupCode;
  if (anc.flights !== undefined) {
    out.flights = anc.flights.map(buildFlightReferenceToModifyBody);
  }
  if (anc.electronicMiscellaneousDocumentType !== undefined) {
    out.electronicMiscellaneousDocumentType = anc.electronicMiscellaneousDocumentType;
  }
  if (anc.reasonForIssuanceCode !== undefined) {
    out.reasonForIssuanceCode = anc.reasonForIssuanceCode;
  }
  if (anc.reasonForIssuanceName !== undefined) {
    out.reasonForIssuanceName = anc.reasonForIssuanceName;
  }
  return out;
}

function buildOtherServiceToModifyBody(osi: OtherServiceToModify): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (osi.airlineCode !== undefined) out.airlineCode = osi.airlineCode;
  if (osi.travelerIndex !== undefined) out.travelerIndex = osi.travelerIndex;
  if (osi.serviceMessage !== undefined) out.serviceMessage = osi.serviceMessage;
  return out;
}

function buildFareToModifyBody(fare: FareToModify): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (fare.recordId !== undefined) out.recordId = fare.recordId;
  return out;
}

// ---------------------------------------------------------------------------
// modifyBooking response echo (request roundtrip)
// ---------------------------------------------------------------------------

function buildModifyBookingRequestEcho(
  req: components['schemas']['ModifyBookingRequest'],
): ModifyBookingInput {
  const out: ModifyBookingInput = {
    confirmationId: req.confirmationId,
    bookingSignature: req.bookingSignature,
    before: buildBookingToModifyFromResponse(req.before),
    after: buildBookingToModifyFromResponse(req.after),
  };
  if (req.bookingSource !== undefined) out.bookingSource = req.bookingSource as BookingSource;
  if (req.retrieveBooking !== undefined) out.retrieveBooking = req.retrieveBooking;
  if (req.receivedFrom !== undefined) out.receivedFrom = req.receivedFrom;
  if (req.targetPcc !== undefined) out.targetPcc = req.targetPcc;
  if (req.unmaskPaymentCardNumbers !== undefined) {
    out.unmaskPaymentCardNumbers = req.unmaskPaymentCardNumbers;
  }
  if (req.extraFeatures !== undefined) {
    const ef: ModifyBookingExtraFeatures = {};
    if (req.extraFeatures.returnFrequentRenter !== undefined) {
      ef.returnFrequentRenter = req.extraFeatures.returnFrequentRenter;
    }
    if (req.extraFeatures.returnWalletFormsOfPayment !== undefined) {
      ef.returnWalletFormsOfPayment = req.extraFeatures.returnWalletFormsOfPayment;
    }
    if (req.extraFeatures.returnFiscalId !== undefined) {
      ef.returnFiscalId = req.extraFeatures.returnFiscalId;
    }
    out.extraFeatures = ef;
  }
  return out;
}

function buildBookingToModifyFromResponse(
  snapshot: components['schemas']['BookingToModify'],
): BookingToModify {
  return snapshot as unknown as BookingToModify;
}

function buildExtraFeaturesBody(features: GetBookingExtraFeatures): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (features.returnFrequentRenter !== undefined) {
    out.returnFrequentRenter = features.returnFrequentRenter;
  }
  if (features.returnWalletFormsOfPayment !== undefined) {
    out.returnWalletFormsOfPayment = features.returnWalletFormsOfPayment;
  }
  if (features.returnFiscalId !== undefined) out.returnFiscalId = features.returnFiscalId;
  if (features.returnEmptySeatObjects !== undefined) {
    out.returnEmptySeatObjects = features.returnEmptySeatObjects;
  }
  return out;
}

function buildGetBookingRequestEcho(
  req: components['schemas']['GetBookingRequest'],
): GetBookingInput {
  const out: GetBookingInput = { confirmationId: req.confirmationId };
  if (req.bookingSource !== undefined) out.bookingSource = req.bookingSource as BookingSource;
  if (req.targetPcc !== undefined) out.targetPcc = req.targetPcc;
  if (req.givenName !== undefined) out.givenName = req.givenName;
  if (req.middleName !== undefined) out.middleName = req.middleName;
  if (req.surname !== undefined) out.surname = req.surname;
  if (req.returnOnly !== undefined) {
    out.returnOnly = req.returnOnly as readonly BookingReturnOnly[];
  }
  if (req.extraFeatures !== undefined) {
    const ef: GetBookingExtraFeatures = {};
    if (req.extraFeatures.returnFrequentRenter !== undefined) {
      ef.returnFrequentRenter = req.extraFeatures.returnFrequentRenter;
    }
    if (req.extraFeatures.returnWalletFormsOfPayment !== undefined) {
      ef.returnWalletFormsOfPayment = req.extraFeatures.returnWalletFormsOfPayment;
    }
    if (req.extraFeatures.returnFiscalId !== undefined) {
      ef.returnFiscalId = req.extraFeatures.returnFiscalId;
    }
    if (req.extraFeatures.returnEmptySeatObjects !== undefined) {
      ef.returnEmptySeatObjects = req.extraFeatures.returnEmptySeatObjects;
    }
    out.extraFeatures = ef;
  }
  if (req.unmaskPaymentCardNumbers !== undefined) {
    out.unmaskPaymentCardNumbers = req.unmaskPaymentCardNumbers;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Request body builders
// ---------------------------------------------------------------------------

function buildAgencyBody(
  agency: NonNullable<CreateBookingInput['agency']>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (agency.address !== undefined) out.address = agency.address;
  if (agency.contactInfo !== undefined) out.contactInfo = agency.contactInfo;
  if (agency.ticketingPolicy !== undefined) out.ticketingPolicy = agency.ticketingPolicy;
  if (agency.futureTicketingPolicy !== undefined) {
    out.futureTicketingPolicy = agency.futureTicketingPolicy;
  }
  if (agency.ticketingTimeLimitPolicy !== undefined) {
    out.ticketingTimeLimitPolicy = agency.ticketingTimeLimitPolicy;
  }
  if (agency.agencyCustomerNumber !== undefined) {
    out.agencyCustomerNumber = agency.agencyCustomerNumber;
  }
  return out;
}

function buildFlightOfferBody(offer: BookFlightOffer): Record<string, unknown> {
  const out: Record<string, unknown> = {
    offerId: offer.offerId,
    selectedOfferItems: offer.selectedOfferItems,
  };
  if (offer.seatOffers && offer.seatOffers.length > 0) out.seatOffers = offer.seatOffers;
  return out;
}

function buildFlightDetailsBody(details: BookFlightDetails): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (details.flights && details.flights.length > 0) {
    out.flights = details.flights.map(buildFlightBody);
  }
  if (details.flightPricing && details.flightPricing.length > 0) {
    out.flightPricing = details.flightPricing;
  }
  if (details.haltOnFlightStatusCodes && details.haltOnFlightStatusCodes.length > 0) {
    out.haltOnFlightStatusCodes = details.haltOnFlightStatusCodes;
  }
  if (details.retryBookingUnconfirmedFlights !== undefined) {
    out.retryBookingUnconfirmedFlights = details.retryBookingUnconfirmedFlights;
  }
  return out;
}

function buildFlightBody(flight: BookFlight): Record<string, unknown> {
  const out: Record<string, unknown> = {
    flightNumber: flight.flightNumber,
    airlineCode: flight.airlineCode,
    fromAirportCode: flight.fromAirportCode,
    toAirportCode: flight.toAirportCode,
    departureDate: flight.departureDate,
    departureTime: flight.departureTime,
    bookingClass: flight.bookingClass,
    flightStatusCode: flight.flightStatusCode ?? 'NN',
  };
  if (flight.isMarriageGroup !== undefined) out.isMarriageGroup = flight.isMarriageGroup;
  if (flight.confirmationId !== undefined) out.confirmationId = flight.confirmationId;
  if (flight.arrivalDate !== undefined) out.arrivalDate = flight.arrivalDate;
  if (flight.arrivalTime !== undefined) out.arrivalTime = flight.arrivalTime;
  if (flight.source !== undefined) out.source = flight.source;
  if (flight.seats && flight.seats.length > 0) out.seats = flight.seats;
  if (flight.changeOfGaugeSeats && flight.changeOfGaugeSeats.length > 0) {
    out.changeOfGaugeSeats = flight.changeOfGaugeSeats;
  }
  return out;
}

function buildHotelBody(hotel: BookHotel): Record<string, unknown> {
  const out: Record<string, unknown> = {
    bookingKey: hotel.bookingKey,
    useCsl: hotel.useCsl ?? true,
  };
  if (hotel.corporateDiscountCode !== undefined) {
    out.corporateDiscountCode = hotel.corporateDiscountCode;
  }
  if (hotel.rooms && hotel.rooms.length > 0) out.rooms = hotel.rooms;
  if (hotel.specialInstruction !== undefined) out.specialInstruction = hotel.specialInstruction;
  if (hotel.paymentPolicy !== undefined) out.paymentPolicy = hotel.paymentPolicy;
  if (hotel.formOfPayment !== undefined) out.formOfPayment = hotel.formOfPayment;
  if (hotel.associatedFlightDetails !== undefined) {
    out.associatedFlightDetails = hotel.associatedFlightDetails;
  }
  return out;
}

function buildCarBody(car: BookCar): Record<string, unknown> {
  const out: Record<string, unknown> = {
    bookingKey: car.bookingKey,
    quantity: car.quantity ?? 1,
  };
  if (car.travelerIndex !== undefined) out.travelerIndex = car.travelerIndex;
  if (car.emailIndex !== undefined) out.emailIndex = car.emailIndex;
  if (car.collectionAddress !== undefined) out.collectionAddress = car.collectionAddress;
  if (car.collectionSite !== undefined) out.collectionSite = car.collectionSite;
  if (car.deliveryAddress !== undefined) out.deliveryAddress = car.deliveryAddress;
  if (car.deliverySite !== undefined) out.deliverySite = car.deliverySite;
  if (car.associatedFlightDetails !== undefined) {
    out.associatedFlightDetails = car.associatedFlightDetails;
  }
  if (car.paymentPolicy !== undefined) out.paymentPolicy = car.paymentPolicy;
  if (car.formOfPayment !== undefined) out.formOfPayment = car.formOfPayment;
  if (car.specialInstructions !== undefined) out.specialInstructions = car.specialInstructions;
  if (car.flightIndex !== undefined) out.flightIndex = car.flightIndex;
  return out;
}

function buildTravelerBody(traveler: BookTraveler): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (traveler.id !== undefined) out.id = traveler.id;
  if (traveler.title !== undefined) out.title = traveler.title;
  if (traveler.givenName !== undefined) out.givenName = traveler.givenName;
  if (traveler.surname !== undefined) out.surname = traveler.surname;
  if (traveler.birthDate !== undefined) out.birthDate = traveler.birthDate;
  if (traveler.gender !== undefined) out.gender = traveler.gender;
  if (traveler.age !== undefined) out.age = traveler.age;
  if (traveler.passengerCode !== undefined) out.passengerCode = traveler.passengerCode;
  if (traveler.nameReferenceCode !== undefined) out.nameReferenceCode = traveler.nameReferenceCode;
  if (traveler.identityDocuments && traveler.identityDocuments.length > 0) {
    out.identityDocuments = traveler.identityDocuments;
  }
  if (traveler.loyaltyPrograms && traveler.loyaltyPrograms.length > 0) {
    out.loyaltyPrograms = traveler.loyaltyPrograms;
  }
  if (traveler.useNotificationContactType !== undefined) {
    out.useNotificationContactType = traveler.useNotificationContactType;
  }
  if (traveler.emails && traveler.emails.length > 0) out.emails = traveler.emails;
  if (traveler.phones && traveler.phones.length > 0) out.phones = traveler.phones;
  if (traveler.specialServices && traveler.specialServices.length > 0) {
    out.specialServices = traveler.specialServices;
  }
  if (traveler.ancillaries && traveler.ancillaries.length > 0) {
    out.ancillaries = traveler.ancillaries.map(buildAncillaryBody);
  }
  if (traveler.formOfPaymentIndices && traveler.formOfPaymentIndices.length > 0) {
    out.formOfPaymentIndices = traveler.formOfPaymentIndices;
  }
  if (traveler.infantTravelerIndex !== undefined) {
    out.infantTravelerIndex = traveler.infantTravelerIndex;
  }
  if (traveler.employerIndex !== undefined) out.employerIndex = traveler.employerIndex;
  return out;
}

function buildAncillaryBody(anc: BookAncillary): Record<string, unknown> {
  const out: Record<string, unknown> = {
    subcode: anc.subcode,
    airlineCode: anc.airlineCode,
    electronicMiscellaneousDocumentType: anc.electronicMiscellaneousDocumentType,
    basePrice: anc.basePrice,
    currencyCode: anc.currencyCode,
    groupCode: anc.groupCode,
    flightIndices: anc.flightIndices,
    numberOfItems: anc.numberOfItems ?? 1,
  };
  if (anc.commercialName !== undefined) out.commercialName = anc.commercialName;
  if (anc.reasonForIssuance !== undefined) out.reasonForIssuance = anc.reasonForIssuance;
  if (anc.vendorCode !== undefined) out.vendorCode = anc.vendorCode;
  if (anc.source !== undefined) out.source = anc.source;
  if (anc.totalPrice !== undefined) out.totalPrice = anc.totalPrice;
  if (anc.taxes && anc.taxes.length > 0) out.taxes = anc.taxes;
  if (anc.firstTravelDate !== undefined) out.firstTravelDate = anc.firstTravelDate;
  if (anc.lastTravelDate !== undefined) out.lastTravelDate = anc.lastTravelDate;
  return out;
}

function buildContactInfoBody(info: BookContactInfo): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (info.emails && info.emails.length > 0) out.emails = info.emails;
  if (info.phones && info.phones.length > 0) out.phones = info.phones;
  if (info.faxes && info.faxes.length > 0) out.faxes = info.faxes;
  if (info.emergencyPhones && info.emergencyPhones.length > 0) {
    out.emergencyPhones = info.emergencyPhones;
  }
  return out;
}

function buildPaymentBody(payment: BookPayment): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (payment.billingAddress !== undefined) out.billingAddress = payment.billingAddress;
  if (payment.formsOfPayment && payment.formsOfPayment.length > 0) {
    out.formsOfPayment = payment.formsOfPayment.map(buildFormOfPaymentBody);
  }
  return out;
}

function buildFormOfPaymentBody(fop: BookFormOfPayment): Record<string, unknown> {
  const out: Record<string, unknown> = { type: fop.type };
  if (fop.cardTypeCode !== undefined) out.cardTypeCode = fop.cardTypeCode;
  if (fop.cardNumber !== undefined) out.cardNumber = fop.cardNumber;
  if (fop.cardSecurityCode !== undefined) out.cardSecurityCode = fop.cardSecurityCode;
  if (fop.expiryDate !== undefined) out.expiryDate = fop.expiryDate;
  if (fop.extendedPayment !== undefined) out.extendedPayment = fop.extendedPayment;
  if (fop.miscellaneousCreditCode !== undefined) {
    out.miscellaneousCreditCode = fop.miscellaneousCreditCode;
  }
  if (fop.numberOfInstallments !== undefined) out.numberOfInstallments = fop.numberOfInstallments;
  if (fop.airlinePlanCode !== undefined) out.airlinePlanCode = fop.airlinePlanCode;
  if (fop.installmentAmount !== undefined) out.installmentAmount = fop.installmentAmount;
  if (fop.cardHolder !== undefined) out.cardHolder = fop.cardHolder;
  if (fop.manualApproval !== undefined) out.manualApproval = fop.manualApproval;
  if (fop.authentications && fop.authentications.length > 0) {
    out.authentications = fop.authentications;
  }
  if (fop.virtualCard !== undefined) out.virtualCard = fop.virtualCard;
  if (fop.agencyIataNumber !== undefined) out.agencyIataNumber = fop.agencyIataNumber;
  if (fop.agencyAddress !== undefined) out.agencyAddress = fop.agencyAddress;
  if (fop.corporateId !== undefined) out.corporateId = fop.corporateId;
  if (fop.companyAddress !== undefined) out.companyAddress = fop.companyAddress;
  if (fop.voucher !== undefined) out.voucher = fop.voucher;
  if (fop.netBalance !== undefined) out.netBalance = fop.netBalance;
  if (fop.docketPrefix !== undefined) out.docketPrefix = fop.docketPrefix;
  if (fop.docketNumber !== undefined) out.docketNumber = fop.docketNumber;
  if (fop.docketIssuingAgentInitials !== undefined) {
    out.docketIssuingAgentInitials = fop.docketIssuingAgentInitials;
  }
  if (fop.docketDescription !== undefined) out.docketDescription = fop.docketDescription;
  if (fop.governmentTravelRequestDescription !== undefined) {
    out.governmentTravelRequestDescription = fop.governmentTravelRequestDescription;
  }
  if (fop.invoiceDescription !== undefined) out.invoiceDescription = fop.invoiceDescription;
  if (fop.useType !== undefined) out.useType = fop.useType;
  if (fop.tripType !== undefined) out.tripType = fop.tripType;
  if (fop.useTypes && fop.useTypes.length > 0) out.useTypes = fop.useTypes;
  if (fop.tripTypes && fop.tripTypes.length > 0) out.tripTypes = fop.tripTypes;
  if (fop.isAgencyPaymentCard !== undefined) out.isAgencyPaymentCard = fop.isAgencyPaymentCard;
  return out;
}

function buildRemarkBody(remark: BookRemark): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (remark.type !== undefined) out.type = remark.type;
  if (remark.alphaCode !== undefined) out.alphaCode = remark.alphaCode;
  if (remark.text !== undefined) out.text = remark.text;
  if (remark.queuePlacement !== undefined) out.queuePlacement = remark.queuePlacement;
  return out;
}

function buildNotificationBody(notification: BookNotification): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (notification.email !== undefined) out.email = notification.email;
  if (notification.queuePlacement && notification.queuePlacement.length > 0) {
    out.queuePlacement = notification.queuePlacement;
  }
  return out;
}

function buildOtherServiceBody(osi: BookOtherService): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (osi.airlineCode !== undefined) out.airlineCode = osi.airlineCode;
  if (osi.chainCode !== undefined) out.chainCode = osi.chainCode;
  if (osi.vendorCode !== undefined) out.vendorCode = osi.vendorCode;
  if (osi.text !== undefined) out.text = osi.text;
  return out;
}

function buildTravelerEmployerBody(emp: BookTravelerEmployer): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (emp.idType !== undefined) out.idType = emp.idType;
  if (emp.employerId !== undefined) out.employerId = emp.employerId;
  if (emp.employerName !== undefined) out.employerName = emp.employerName;
  if (emp.phones && emp.phones.length > 0) out.phones = emp.phones;
  if (emp.emails && emp.emails.length > 0) out.emails = emp.emails;
  if (emp.street !== undefined) out.street = emp.street;
  if (emp.city !== undefined) out.city = emp.city;
  if (emp.stateProvince !== undefined) out.stateProvince = emp.stateProvince;
  if (emp.postalCode !== undefined) out.postalCode = emp.postalCode;
  if (emp.countryCode !== undefined) out.countryCode = emp.countryCode;
  return out;
}

// ---------------------------------------------------------------------------
// Response builders
// ---------------------------------------------------------------------------

function buildBookingError(e: components['schemas']['Error']): BookingError {
  const out: BookingError = {
    category: e.category,
    type: e.type,
  };
  if (e.description !== undefined) out.description = e.description;
  if (e.fieldPath !== undefined) out.fieldPath = e.fieldPath;
  if (e.fieldName !== undefined) out.fieldName = e.fieldName;
  if (e.fieldValue !== undefined) out.fieldValue = e.fieldValue;
  return out;
}

function buildBooking(b: components['schemas']['Booking']): Booking {
  const out: Booking = {};
  if (b.bookingId !== undefined) out.bookingId = b.bookingId;
  if (b.startDate !== undefined) out.startDate = b.startDate;
  if (b.endDate !== undefined) out.endDate = b.endDate;
  if (b.isCancelable !== undefined) out.isCancelable = b.isCancelable;
  if (b.isTicketed !== undefined) out.isTicketed = b.isTicketed;
  if (b.agencyCustomerNumber !== undefined) out.agencyCustomerNumber = b.agencyCustomerNumber;
  if (b.creationDetails !== undefined)
    out.creationDetails = buildCreationDetails(b.creationDetails);
  if (b.contactInfo !== undefined) out.contactInfo = buildResponseContactInfo(b.contactInfo);
  if (b.travelers !== undefined) out.travelers = b.travelers.map(buildResponseTraveler);
  if (b.travelersGroup !== undefined) out.travelersGroup = b.travelersGroup;
  if (b.flights !== undefined) out.flights = b.flights.map(buildResponseFlight);
  if (b.journeys !== undefined) out.journeys = b.journeys.map(buildJourney);
  if (b.fareRules !== undefined) out.fareRules = b.fareRules.map(buildFareRule);
  if (b.fareOffers !== undefined) out.fareOffers = b.fareOffers.map(buildFareOffer);
  if (b.fares !== undefined) out.fares = b.fares.map(buildFare);
  if (b.remarks !== undefined) out.remarks = b.remarks.map(buildResponseRemark);
  if (b.hotels !== undefined) out.hotels = b.hotels.map(buildResponseHotel);
  if (b.cars !== undefined) out.cars = b.cars.map(buildResponseCar);
  if (b.trains !== undefined) out.trains = b.trains.map(buildResponseTrain);
  if (b.cruises !== undefined) out.cruises = b.cruises.map(buildResponseCruise);
  if (b.allSegments !== undefined) out.allSegments = b.allSegments.map(buildSegment);
  if (b.flightTickets !== undefined) out.flightTickets = b.flightTickets.map(buildFlightTicket);
  if (b.payments !== undefined) out.payments = buildPayments(b.payments);
  if (b.otherServices !== undefined) {
    out.otherServices = b.otherServices.map(buildResponseOtherService);
  }
  if (b.futureTicketingPolicy !== undefined) {
    out.futureTicketingPolicy = b.futureTicketingPolicy;
  }
  if (b.specialServices !== undefined) {
    out.specialServices = b.specialServices.map(buildSpecialService);
  }
  if (b.retentionEndDate !== undefined) out.retentionEndDate = b.retentionEndDate;
  if (b.retentionLabel !== undefined) out.retentionLabel = b.retentionLabel;
  if (b.accountingItems !== undefined) {
    out.accountingItems = b.accountingItems.map(buildAccountingItem);
  }
  if (b.nonElectronicTickets !== undefined) {
    out.nonElectronicTickets = b.nonElectronicTickets.map(buildNonElectronicTicket);
  }
  if (b.travelersEmployers !== undefined) {
    out.travelersEmployers = b.travelersEmployers.map(buildResponseTravelerEmployer);
  }
  if (b.profiles !== undefined) out.profiles = b.profiles;
  return out;
}

function buildCreationDetails(
  cd: NonNullable<components['schemas']['CreationDetails']>,
): Booking['creationDetails'] {
  return { ...cd };
}

function buildResponseContactInfo(
  ci: components['schemas']['ContactInformation'],
): Booking['contactInfo'] {
  return { ...ci };
}

function buildResponseTraveler(t: components['schemas']['Traveler']): BookingTraveler {
  const out: BookingTraveler = {
    givenName: t.givenName,
    surname: t.surname,
  };
  if (t.middleName !== undefined) out.middleName = t.middleName;
  if (t.birthDate !== undefined) out.birthDate = t.birthDate;
  if (t.gender !== undefined) out.gender = t.gender;
  if (t.type !== undefined) out.type = t.type;
  if (t.passengerCode !== undefined) out.passengerCode = t.passengerCode;
  if (t.nameAssociationId !== undefined) out.nameAssociationId = t.nameAssociationId;
  if (t.nameReferenceCode !== undefined) out.nameReferenceCode = t.nameReferenceCode;
  if (t.isGrouped !== undefined) out.isGrouped = t.isGrouped;
  if (t.emails !== undefined) out.emails = t.emails;
  if (t.phones !== undefined) out.phones = t.phones;
  if (t.remarks !== undefined) out.remarks = t.remarks.map(buildResponseRemark);
  if (t.address !== undefined) out.address = t.address;
  if (t.identityDocuments !== undefined) {
    out.identityDocuments = t.identityDocuments.map(buildResponseIdentityDocument);
  }
  if (t.loyaltyPrograms !== undefined) {
    out.loyaltyPrograms = t.loyaltyPrograms as BookingLoyaltyProgram[];
  }
  if (t.ancillaries !== undefined) out.ancillaries = t.ancillaries.map(buildResponseAncillary);
  if (t.formOfPaymentIndices !== undefined) out.formOfPaymentIndices = t.formOfPaymentIndices;
  if (t.employerIndex !== undefined) out.employerIndex = t.employerIndex;
  return out;
}

function buildResponseIdentityDocument(
  d: components['schemas']['IdentityDocument'],
): BookingIdentityDocument {
  const out: BookingIdentityDocument = {
    documentType: d.documentType,
  };
  if (d.documentNumber !== undefined) out.documentNumber = d.documentNumber;
  if (d.documentSubType !== undefined) out.documentSubType = d.documentSubType;
  if (d.passportType !== undefined) out.passportType = d.passportType;
  if (d.visaType !== undefined) out.visaType = d.visaType;
  if (d.expiryDate !== undefined) out.expiryDate = d.expiryDate;
  if (d.issuingCountryCode !== undefined) out.issuingCountryCode = d.issuingCountryCode;
  if (d.residenceCountryCode !== undefined) out.residenceCountryCode = d.residenceCountryCode;
  if (d.placeOfIssue !== undefined) out.placeOfIssue = d.placeOfIssue;
  if (d.placeOfBirth !== undefined) out.placeOfBirth = d.placeOfBirth;
  if (d.hostCountryCode !== undefined) out.hostCountryCode = d.hostCountryCode;
  if (d.issueDate !== undefined) out.issueDate = d.issueDate;
  if (d.givenName !== undefined) out.givenName = d.givenName;
  if (d.middleName !== undefined) out.middleName = d.middleName;
  if (d.surname !== undefined) out.surname = d.surname;
  if (d.birthDate !== undefined) out.birthDate = d.birthDate;
  if (d.gender !== undefined) out.gender = d.gender;
  if (d.isPrimaryDocumentHolder !== undefined) {
    out.isPrimaryDocumentHolder = d.isPrimaryDocumentHolder;
  }
  if (d.isLapChildDocument !== undefined) out.isLapChildDocument = d.isLapChildDocument;
  if (d.residenceDestinationAddress !== undefined) {
    out.residenceDestinationAddress = d.residenceDestinationAddress;
  }
  if (d.flightIndices !== undefined) out.flightIndices = d.flightIndices;
  if (d.itemId !== undefined) out.itemId = d.itemId;
  if (d.citizenshipCountryCode !== undefined) {
    out.citizenshipCountryCode = d.citizenshipCountryCode;
  }
  return out;
}

function buildResponseAncillary(a: components['schemas']['Ancillary']): BookingAncillary {
  const out: BookingAncillary = {};
  if (a.itemId !== undefined) out.itemId = a.itemId;
  if (a.commercialName !== undefined) out.commercialName = a.commercialName;
  if (a.numberOfItems !== undefined) out.numberOfItems = a.numberOfItems;
  if (a.reasonForIssuanceCode !== undefined) out.reasonForIssuanceCode = a.reasonForIssuanceCode;
  if (a.reasonForIssuanceName !== undefined) out.reasonForIssuanceName = a.reasonForIssuanceName;
  if (a.subcode !== undefined) out.subcode = a.subcode;
  if (a.airlineCode !== undefined) out.airlineCode = a.airlineCode;
  if (a.vendorCode !== undefined) out.vendorCode = a.vendorCode;
  if (a.source !== undefined) out.source = a.source;
  if (a.electronicMiscellaneousDocumentNumber !== undefined) {
    out.electronicMiscellaneousDocumentNumber = a.electronicMiscellaneousDocumentNumber;
  }
  if (a.isRefundable !== undefined) out.isRefundable = a.isRefundable;
  if (a.isCommissionable !== undefined) out.isCommissionable = a.isCommissionable;
  if (a.flightApplicabilityType !== undefined) {
    out.flightApplicabilityType = a.flightApplicabilityType;
  }
  if (a.flights !== undefined) out.flights = a.flights;
  if (a.statusCode !== undefined) out.statusCode = a.statusCode;
  if (a.statusName !== undefined) out.statusName = a.statusName;
  if (a.totals !== undefined) out.totals = buildTotalValues(a.totals);
  if (a.taxes !== undefined) {
    out.taxes = a.taxes.map((t) => {
      const tax: Record<string, unknown> = {};
      if (t.taxCode !== undefined) tax.taxCode = t.taxCode;
      if (t.amount !== undefined) tax.taxAmount = t.amount;
      return tax as NonNullable<BookingAncillary['taxes']>[number];
    });
  }
  if (a.specialServiceCode !== undefined) out.specialServiceCode = a.specialServiceCode;
  return out;
}

function buildResponseFlight(f: components['schemas']['Flight']): BookingFlight {
  const out: BookingFlight = {
    itemId: f.itemId,
    flightNumber: f.flightNumber,
    airlineCode: f.airlineCode,
    fromAirportCode: f.fromAirportCode,
    toAirportCode: f.toAirportCode,
    departureDate: f.departureDate,
    departureTime: f.departureTime,
    arrivalDate: f.arrivalDate,
    arrivalTime: f.arrivalTime,
  };
  if (f.confirmationId !== undefined) out.confirmationId = f.confirmationId;
  if (f.sourceType !== undefined) out.sourceType = f.sourceType;
  if (f.airlineName !== undefined) out.airlineName = f.airlineName;
  if (f.operatingFlightNumber !== undefined) out.operatingFlightNumber = f.operatingFlightNumber;
  if (f.operatingAirlineCode !== undefined) out.operatingAirlineCode = f.operatingAirlineCode;
  if (f.operatingAirlineName !== undefined) out.operatingAirlineName = f.operatingAirlineName;
  if (f.updatedDepartureDate !== undefined) out.updatedDepartureDate = f.updatedDepartureDate;
  if (f.updatedDepartureTime !== undefined) out.updatedDepartureTime = f.updatedDepartureTime;
  if (f.departureTerminalName !== undefined) out.departureTerminalName = f.departureTerminalName;
  if (f.departureGate !== undefined) out.departureGate = f.departureGate;
  if (f.updatedArrivalDate !== undefined) out.updatedArrivalDate = f.updatedArrivalDate;
  if (f.updatedArrivalTime !== undefined) out.updatedArrivalTime = f.updatedArrivalTime;
  if (f.arrivalTerminalName !== undefined) out.arrivalTerminalName = f.arrivalTerminalName;
  if (f.arrivalGate !== undefined) out.arrivalGate = f.arrivalGate;
  if (f.seats !== undefined) out.seats = f.seats;
  if (f.changeOfGaugeSeats !== undefined) out.changeOfGaugeSeats = f.changeOfGaugeSeats;
  if (f.numberOfSeats !== undefined) out.numberOfSeats = f.numberOfSeats;
  if (f.cabinTypeName !== undefined) out.cabinTypeName = f.cabinTypeName;
  if (f.cabinTypeCode !== undefined) out.cabinTypeCode = f.cabinTypeCode;
  if (f.aircraftTypeCode !== undefined) out.aircraftTypeCode = f.aircraftTypeCode;
  if (f.aircraftTypeName !== undefined) out.aircraftTypeName = f.aircraftTypeName;
  if (f.bookingClass !== undefined) out.bookingClass = f.bookingClass;
  if (f.meals !== undefined) out.meals = f.meals as BookingMeal[];
  if (f.flightStatusCode !== undefined) out.flightStatusCode = f.flightStatusCode;
  if (f.flightStatusName !== undefined) out.flightStatusName = f.flightStatusName;
  if (f.durationInMinutes !== undefined) out.durationInMinutes = f.durationInMinutes;
  if (f.distanceInMiles !== undefined) out.distanceInMiles = f.distanceInMiles;
  if (f.hiddenStops !== undefined) out.hiddenStops = f.hiddenStops as BookingHiddenStop[];
  if (f.travelerIndices !== undefined) out.travelerIndices = f.travelerIndices;
  if (f.identityDocuments !== undefined) out.identityDocuments = f.identityDocuments;
  if (f.isPast !== undefined) out.isPast = f.isPast;
  return out;
}

function buildJourney(j: components['schemas']['Journey']): BookingJourney {
  return {
    firstAirportCode: j.firstAirportCode,
    departureDate: j.departureDate,
    departureTime: j.departureTime,
    lastAirportCode: j.lastAirportCode,
    numberOfFlights: j.numberOfFlights,
  };
}

function buildFareRule(fr: components['schemas']['FareRule']): BookingFareRule {
  const out: BookingFareRule = {
    owningAirlineCode: fr.owningAirlineCode,
  };
  if (fr.originAirportCode !== undefined) out.originAirportCode = fr.originAirportCode;
  if (fr.destinationAirportCode !== undefined) {
    out.destinationAirportCode = fr.destinationAirportCode;
  }
  if (fr.passengerCode !== undefined) out.passengerCode = fr.passengerCode;
  if (fr.isRefundable !== undefined) out.isRefundable = fr.isRefundable;
  if (fr.refundPenalties !== undefined) {
    out.refundPenalties = fr.refundPenalties.map(buildFareRulePenalty);
  }
  if (fr.isChangeable !== undefined) out.isChangeable = fr.isChangeable;
  if (fr.exchangePenalties !== undefined) {
    out.exchangePenalties = fr.exchangePenalties.map(buildFareRulePenalty);
  }
  if (fr.isCancelable !== undefined) out.isCancelable = fr.isCancelable;
  if (fr.cancelPenalties !== undefined) {
    out.cancelPenalties = fr.cancelPenalties.map(buildFareRulePenalty);
  }
  return out;
}

function buildFareRulePenalty(p: components['schemas']['FareRulePenalty']): BookingFareRulePenalty {
  const out: BookingFareRulePenalty = {
    applicability: p.applicability,
    conditionsApply: p.conditionsApply,
    penalty: buildMonetaryValue(p.penalty),
  };
  if (p.hasNoShowCost !== undefined) out.hasNoShowCost = p.hasNoShowCost;
  if (p.noShowPenalty !== undefined) out.noShowPenalty = buildMonetaryValue(p.noShowPenalty);
  return out;
}

function buildMonetaryValue(v: components['schemas']['Value']): MonetaryValue {
  return { amount: v.amount, currencyCode: v.currencyCode };
}

function buildHotelPenaltyValue(v: components['schemas']['HotelPenaltyValue']): HotelPenaltyValue {
  const out: HotelPenaltyValue = { amount: v.amount, currencyCode: v.currencyCode };
  if (v.percentage !== undefined) out.percentage = v.percentage;
  if (v.numberOfNights !== undefined) out.numberOfNights = v.numberOfNights;
  return out;
}

function buildFareOffer(fo: components['schemas']['FareOffer']): BookingFareOffer {
  const out: BookingFareOffer = {};
  if (fo.travelerIndices !== undefined) out.travelerIndices = fo.travelerIndices;
  if (fo.flights !== undefined) out.flights = fo.flights;
  if (fo.cabinBaggageAllowance !== undefined) {
    out.cabinBaggageAllowance = buildBaggageAllowance(fo.cabinBaggageAllowance);
  }
  if (fo.checkedBaggageAllowance !== undefined) {
    out.checkedBaggageAllowance = buildBaggageAllowance(fo.checkedBaggageAllowance);
  }
  if (fo.cabinBaggageCharges !== undefined) {
    out.cabinBaggageCharges = fo.cabinBaggageCharges.map(buildBaggagePolicy);
  }
  if (fo.checkedBaggageCharges !== undefined) {
    out.checkedBaggageCharges = fo.checkedBaggageCharges.map(buildBaggagePolicy);
  }
  return out;
}

function buildBaggageAllowance(
  ba: components['schemas']['BaggageAllowance'],
): BookingBaggageAllowance {
  const out: BookingBaggageAllowance = {};
  if (ba.maximumPieces !== undefined) out.maximumPieces = ba.maximumPieces;
  if (ba.totalWeightInPounds !== undefined) out.totalWeightInPounds = ba.totalWeightInPounds;
  if (ba.totalWeightInKilograms !== undefined) {
    out.totalWeightInKilograms = ba.totalWeightInKilograms;
  }
  if (ba.baggagePieces !== undefined) {
    out.baggagePieces = ba.baggagePieces.map(buildBaggagePolicy);
  }
  return out;
}

function buildBaggagePolicy(bp: components['schemas']['BaggagePolicy']): BookingBaggagePolicy {
  const out: BookingBaggagePolicy = {
    numberOfPieces: bp.numberOfPieces,
  };
  if (bp.maximumSizeInInches !== undefined) out.maximumSizeInInches = bp.maximumSizeInInches;
  if (bp.maximumSizeInCentimeters !== undefined) {
    out.maximumSizeInCentimeters = bp.maximumSizeInCentimeters;
  }
  if (bp.maximumWeightInPounds !== undefined) out.maximumWeightInPounds = bp.maximumWeightInPounds;
  if (bp.maximumWeightInKilograms !== undefined) {
    out.maximumWeightInKilograms = bp.maximumWeightInKilograms;
  }
  if (bp.specialItemDescription !== undefined) {
    out.specialItemDescription = bp.specialItemDescription;
  }
  if (bp.isCheckInOnly !== undefined) out.isCheckInOnly = bp.isCheckInOnly;
  if (bp.fee !== undefined) out.fee = buildMonetaryValue(bp.fee);
  return out;
}

function buildFare(f: components['schemas']['Fare']): BookingFare {
  const out: BookingFare = {
    hasValidPricing: f.hasValidPricing,
  };
  if (f.creationDetails !== undefined) out.creationDetails = f.creationDetails;
  if (f.airlineCode !== undefined) out.airlineCode = f.airlineCode;
  if (f.fareCalculationLine !== undefined) out.fareCalculationLine = f.fareCalculationLine;
  if (f.tourCode !== undefined) out.tourCode = f.tourCode;
  if (f.isNegotiatedFare !== undefined) out.isNegotiatedFare = f.isNegotiatedFare;
  if (f.travelerIndices !== undefined) out.travelerIndices = f.travelerIndices;
  if (f.commission !== undefined) out.commission = f.commission as BookingCommission;
  if (f.fareConstruction !== undefined) {
    out.fareConstruction = f.fareConstruction.map(buildFareComponent);
  }
  if (f.taxBreakdown !== undefined) out.taxBreakdown = f.taxBreakdown.map(buildTaxComponent);
  if (f.totals !== undefined) out.totals = buildTotalValues(f.totals);
  if (f.bundledServicesAndFees !== undefined) {
    out.bundledServicesAndFees = f.bundledServicesAndFees as BookingFareService[];
  }
  if (f.originalTotalValues !== undefined) out.originalTotalValues = f.originalTotalValues;
  if (f.pricingTypeCode !== undefined) out.pricingTypeCode = f.pricingTypeCode;
  if (f.pricingTypeName !== undefined) out.pricingTypeName = f.pricingTypeName;
  if (f.pricingStatusCode !== undefined) out.pricingStatusCode = f.pricingStatusCode;
  if (f.pricingStatusName !== undefined) out.pricingStatusName = f.pricingStatusName;
  if (f.initialSellingFare !== undefined) {
    const isf: BookingInitialSellingFare = {};
    if (f.initialSellingFare.totals !== undefined) {
      isf.totals = buildGenericTotalValues(f.initialSellingFare.totals);
    }
    if (f.initialSellingFare.fareDifferenceBreakdown !== undefined) {
      const fdb = f.initialSellingFare.fareDifferenceBreakdown;
      const breakdown: BookingFareDifferenceBreakdown = {};
      if (fdb.adjustedAmount !== undefined) breakdown.adjustedAmount = fdb.adjustedAmount;
      if (fdb.currencyCode !== undefined) breakdown.currencyCode = fdb.currencyCode;
      isf.fareDifferenceBreakdown = breakdown;
    }
    out.initialSellingFare = isf;
  }
  if (f.requestedTravelerType !== undefined) out.requestedTravelerType = f.requestedTravelerType;
  if (f.pricedTravelerType !== undefined) out.pricedTravelerType = f.pricedTravelerType;
  if (f.recordTypeCode !== undefined) out.recordTypeCode = f.recordTypeCode;
  if (f.recordTypeName !== undefined) out.recordTypeName = f.recordTypeName;
  if (f.recordId !== undefined) out.recordId = f.recordId;
  return out;
}

function buildFareComponent(fc: components['schemas']['FareComponent']): BookingFareComponent {
  const out: BookingFareComponent = {};
  if (fc.flights !== undefined) out.flights = fc.flights;
  if (fc.flightIndices !== undefined) out.flightIndices = fc.flightIndices;
  if (fc.fareBasisCode !== undefined) out.fareBasisCode = fc.fareBasisCode;
  if (fc.baseRate !== undefined) out.baseRate = buildMonetaryValue(fc.baseRate);
  if (fc.brandFareCode !== undefined) out.brandFareCode = fc.brandFareCode;
  if (fc.brandFareName !== undefined) out.brandFareName = fc.brandFareName;
  if (fc.brandProgramCode !== undefined) out.brandProgramCode = fc.brandProgramCode;
  if (fc.brandProgramName !== undefined) out.brandProgramName = fc.brandProgramName;
  if (fc.brandAttributes !== undefined) {
    out.brandAttributes = fc.brandAttributes as BookingBrandAttribute[];
  }
  if (fc.isCurrentItinerary !== undefined) out.isCurrentItinerary = fc.isCurrentItinerary;
  if (fc.checkedBaggageAllowance !== undefined) {
    out.checkedBaggageAllowance = buildBaggageAllowance(fc.checkedBaggageAllowance);
  }
  if (fc.accountCode !== undefined) out.accountCode = fc.accountCode;
  return out;
}

function buildTaxComponent(tc: components['schemas']['TaxComponent']): BookingTaxComponent {
  const out: BookingTaxComponent = {};
  if (tc.taxCode !== undefined) out.taxCode = tc.taxCode;
  if (tc.taxAmount !== undefined) out.taxAmount = buildMonetaryValue(tc.taxAmount);
  if (tc.isPaid !== undefined) out.isPaid = tc.isPaid;
  return out;
}

function buildTotalValues(tv: components['schemas']['TotalValues']): BookingTotalValues {
  const out: BookingTotalValues = {
    total: tv.total,
    currencyCode: tv.currencyCode,
  };
  if (tv.subtotal !== undefined) out.subtotal = tv.subtotal;
  if (tv.taxes !== undefined) out.taxes = tv.taxes;
  if (tv.fees !== undefined) out.fees = tv.fees;
  if (tv.netRemit !== undefined) out.netRemit = tv.netRemit;
  return out;
}

function buildGenericTotalValues(
  tv: components['schemas']['GenericTotalValues'],
): BookingGenericTotalValues {
  const out: BookingGenericTotalValues = {
    total: tv.total,
    currencyCode: tv.currencyCode,
  };
  if (tv.subtotal !== undefined) out.subtotal = tv.subtotal;
  if (tv.taxes !== undefined) out.taxes = tv.taxes;
  return out;
}

function buildResponseRemark(r: components['schemas']['Remark']): BookingRemark {
  const out: BookingRemark = {};
  if (r.type !== undefined) out.type = r.type;
  if (r.alphaCode !== undefined) out.alphaCode = r.alphaCode;
  if (r.text !== undefined) out.text = r.text;
  return out;
}

function buildResponseHotel(h: components['schemas']['Hotel']): BookingHotel {
  const out: BookingHotel = {
    itemId: h.itemId,
    hotelName: h.hotelName,
    address: h.address,
    checkInDate: h.checkInDate,
    checkInTime: h.checkInTime,
    checkOutDate: h.checkOutDate,
    checkOutTime: h.checkOutTime,
    isRefundable: h.isRefundable,
  };
  if (h.confirmationId !== undefined) out.confirmationId = h.confirmationId;
  if (h.corporateDiscountCode !== undefined) out.corporateDiscountCode = h.corporateDiscountCode;
  if (h.leadTravelerIndex !== undefined) out.leadTravelerIndex = h.leadTravelerIndex;
  if (h.room !== undefined) out.room = h.room;
  if (h.refundPenalties !== undefined) {
    out.refundPenalties = h.refundPenalties.map(buildHotelRefundPenalty);
  }
  if (h.refundPenaltyPolicyCode !== undefined) {
    out.refundPenaltyPolicyCode = h.refundPenaltyPolicyCode;
  }
  if (h.hotelStatusCode !== undefined) out.hotelStatusCode = h.hotelStatusCode;
  if (h.hotelStatusName !== undefined) out.hotelStatusName = h.hotelStatusName;
  if (h.chainCode !== undefined) out.chainCode = h.chainCode;
  if (h.chainName !== undefined) out.chainName = h.chainName;
  if (h.propertyId !== undefined) out.propertyId = h.propertyId;
  if (h.sabrePropertyId !== undefined) out.sabrePropertyId = h.sabrePropertyId;
  if (h.contactInfo !== undefined) out.contactInfo = h.contactInfo;
  if (h.specialInstructions !== undefined) out.specialInstructions = h.specialInstructions;
  if (h.guaranteeTypeCode !== undefined) out.guaranteeTypeCode = h.guaranteeTypeCode;
  if (h.guaranteeTypeName !== undefined) out.guaranteeTypeName = h.guaranteeTypeName;
  if (h.guaranteePaymentNote !== undefined) out.guaranteePaymentNote = h.guaranteePaymentNote;
  if (h.paymentPolicy !== undefined) out.paymentPolicy = h.paymentPolicy;
  if (h.payment !== undefined) out.payment = buildTotalValues(h.payment);
  if (h.numberOfGuests !== undefined) out.numberOfGuests = h.numberOfGuests;
  if (h.associatedFlightDetails !== undefined) {
    out.associatedFlightDetails = h.associatedFlightDetails;
  }
  if (h.sourceTypeCode !== undefined) out.sourceTypeCode = h.sourceTypeCode;
  if (h.sourceTypeName !== undefined) out.sourceTypeName = h.sourceTypeName;
  return out;
}

function buildHotelRefundPenalty(
  p: components['schemas']['HotelDateRangeRefundPenalty'],
): BookingHotelRefundPenalty {
  const out: BookingHotelRefundPenalty = {};
  if (p.applicableFromDate !== undefined) out.startDate = p.applicableFromDate;
  if (p.applicableToDate !== undefined) out.endDate = p.applicableToDate;
  if (p.penalty !== undefined) out.penalty = buildHotelPenaltyValue(p.penalty);
  return out;
}

function buildResponseCar(c: components['schemas']['Car']): BookingCar {
  const out: BookingCar = {
    itemId: c.itemId,
    vendorName: c.vendorName,
    vendorCode: c.vendorCode,
    pickUpAddress: c.pickUpAddress,
    pickUpDate: c.pickUpDate,
    pickUpTime: c.pickUpTime,
    dropOffDate: c.dropOffDate,
    dropOffTime: c.dropOffTime,
    isRefundable: c.isRefundable,
  };
  if (c.confirmationId !== undefined) out.confirmationId = c.confirmationId;
  if (c.travelerIndex !== undefined) out.travelerIndex = c.travelerIndex;
  if (c.pickUpLocationCode !== undefined) out.pickUpLocationCode = c.pickUpLocationCode;
  if (c.pickUpContactInfo !== undefined) out.pickUpContactInfo = c.pickUpContactInfo;
  if (c.dropOffLocationCode !== undefined) out.dropOffLocationCode = c.dropOffLocationCode;
  if (c.dropOffAddress !== undefined) out.dropOffAddress = c.dropOffAddress;
  if (c.dropOffContactInfo !== undefined) out.dropOffContactInfo = c.dropOffContactInfo;
  if (c.collectionAddress !== undefined) out.collectionAddress = c.collectionAddress;
  if (c.collectionSite !== undefined) out.collectionSite = c.collectionSite as BookingCarRentalSite;
  if (c.deliveryAddress !== undefined) out.deliveryAddress = c.deliveryAddress;
  if (c.deliverySite !== undefined) out.deliverySite = c.deliverySite as BookingCarRentalSite;
  if (c.refundPenalties !== undefined) {
    out.refundPenalties = c.refundPenalties.map(buildCarRefundPenalty);
  }
  if (c.carStatusCode !== undefined) out.carStatusCode = c.carStatusCode;
  if (c.carStatusName !== undefined) out.carStatusName = c.carStatusName;
  if (c.vehicleTypeCode !== undefined) out.vehicleTypeCode = c.vehicleTypeCode;
  if (c.vehicleTypeName !== undefined) out.vehicleTypeName = c.vehicleTypeName;
  if (c.numberOfVehicles !== undefined) out.numberOfVehicles = c.numberOfVehicles;
  if (c.rateCode !== undefined) out.rateCode = c.rateCode;
  if (c.distanceAllowance !== undefined) out.distanceAllowance = c.distanceAllowance;
  if (c.guaranteePaymentNote !== undefined) out.guaranteePaymentNote = c.guaranteePaymentNote;
  if (c.specialInstructions !== undefined) out.specialInstructions = c.specialInstructions;
  if (c.payment !== undefined) out.payment = buildTotalValues(c.payment);
  if (c.guaranteePaymentType !== undefined) out.guaranteePaymentType = c.guaranteePaymentType;
  return out;
}

function buildCarRefundPenalty(
  p: components['schemas']['DateRangeRefundPenalty'],
): BookingCarRefundPenalty {
  const out: BookingCarRefundPenalty = {};
  if (p.applicableFromDate !== undefined) out.startDate = p.applicableFromDate;
  if (p.applicableToDate !== undefined) out.endDate = p.applicableToDate;
  if (p.penalty !== undefined) out.penalty = buildMonetaryValue(p.penalty);
  return out;
}

function buildResponseTrain(t: components['schemas']['Train']): BookingTrain {
  const out: BookingTrain = {
    itemId: t.itemId,
    trainNumber: t.trainNumber,
    vendorCode: t.vendorCode,
    fromStationCode: t.fromStationCode,
    toStationCode: t.toStationCode,
    departureDate: t.departureDate,
    departureTime: t.departureTime,
    arrivalDate: t.arrivalDate,
    arrivalTime: t.arrivalTime,
  };
  if (t.confirmationId !== undefined) out.confirmationId = t.confirmationId;
  if (t.trainName !== undefined) out.trainName = t.trainName;
  if (t.vendorName !== undefined) out.vendorName = t.vendorName;
  if (t.operatingVendorCode !== undefined) out.operatingVendorCode = t.operatingVendorCode;
  if (t.operatingVendorName !== undefined) out.operatingVendorName = t.operatingVendorName;
  if (t.fromStationName !== undefined) out.fromStationName = t.fromStationName;
  if (t.toStationName !== undefined) out.toStationName = t.toStationName;
  if (t.isRefundable !== undefined) out.isRefundable = t.isRefundable;
  if (t.trainStatusCode !== undefined) out.trainStatusCode = t.trainStatusCode;
  if (t.trainStatusName !== undefined) out.trainStatusName = t.trainStatusName;
  if (t.payment !== undefined) out.payment = buildTotalValues(t.payment);
  return out;
}

function buildResponseCruise(c: components['schemas']['Cruise']): BookingCruise {
  const out: BookingCruise = {
    itemId: c.itemId,
    vendorCode: c.vendorCode,
    fromPortCode: c.fromPortCode,
    departureDate: c.departureDate,
    arrivalDate: c.arrivalDate,
  };
  if (c.confirmationId !== undefined) out.confirmationId = c.confirmationId;
  if (c.shipCode !== undefined) out.shipCode = c.shipCode;
  if (c.shipName !== undefined) out.shipName = c.shipName;
  if (c.toPortCode !== undefined) out.toPortCode = c.toPortCode;
  if (c.departureTime !== undefined) out.departureTime = c.departureTime;
  if (c.arrivalTime !== undefined) out.arrivalTime = c.arrivalTime;
  if (c.numberOfGuests !== undefined) out.numberOfGuests = c.numberOfGuests;
  if (c.cabinNumber !== undefined) out.cabinNumber = c.cabinNumber;
  if (c.cruiseStatusCode !== undefined) out.cruiseStatusCode = c.cruiseStatusCode;
  if (c.cruiseStatusName !== undefined) out.cruiseStatusName = c.cruiseStatusName;
  return out;
}

function buildSegment(s: components['schemas']['SegmentBasics']): BookingSegment {
  const out: BookingSegment = {
    id: s.id,
    type: s.type,
  };
  if (s.text !== undefined) out.text = s.text;
  if (s.vendorCode !== undefined) out.vendorCode = s.vendorCode;
  if (s.date !== undefined) out.date = s.date;
  if (s.time !== undefined) out.time = s.time;
  if (s.locationCode !== undefined) out.locationCode = s.locationCode;
  if (s.address !== undefined) out.address = s.address;
  if (s.startDate !== undefined) out.startDate = s.startDate;
  if (s.startTime !== undefined) out.startTime = s.startTime;
  if (s.startLocationCode !== undefined) out.startLocationCode = s.startLocationCode;
  if (s.startAddress !== undefined) out.startAddress = s.startAddress;
  if (s.endDate !== undefined) out.endDate = s.endDate;
  if (s.endTime !== undefined) out.endTime = s.endTime;
  if (s.endLocationCode !== undefined) out.endLocationCode = s.endLocationCode;
  if (s.endAddress !== undefined) out.endAddress = s.endAddress;
  return out;
}

function buildFlightTicket(ft: components['schemas']['FlightTicket']): BookingFlightTicket {
  const out: BookingFlightTicket = {
    number: ft.number,
    date: ft.date,
    airlineCode: ft.airlineCode,
    travelerIndex: ft.travelerIndex,
    flightCoupons: ft.flightCoupons.map((c) => ({
      itemId: c.itemId,
      couponStatus: c.couponStatus,
      couponStatusCode: c.couponStatusCode,
    })) as BookingFlightCoupon[],
    payment: buildTotalValues(ft.payment),
  };
  if (ft.agencyIataNumber !== undefined) out.agencyIataNumber = ft.agencyIataNumber;
  if (ft.allCoupons !== undefined) {
    out.allCoupons = ft.allCoupons as BookingTicketCoupon[];
  }
  if (ft.isBundledTicket !== undefined) out.isBundledTicket = ft.isBundledTicket;
  if (ft.ticketStatusName !== undefined) out.ticketStatusName = ft.ticketStatusName;
  if (ft.ticketStatusCode !== undefined) out.ticketStatusCode = ft.ticketStatusCode;
  if (ft.ticketingPcc !== undefined) out.ticketingPcc = ft.ticketingPcc;
  if (ft.commission !== undefined) out.commission = ft.commission as BookingCommission;
  return out;
}

function buildPayments(p: components['schemas']['TotalPayments']): BookingPayments {
  const out: BookingPayments = {};
  if (p.flightTotals !== undefined) out.flightTotals = p.flightTotals.map(buildTotalValues);
  if (p.flightCurrentTotals !== undefined) {
    out.flightCurrentTotals = p.flightCurrentTotals.map(buildTotalValues);
  }
  if (p.hotelTotals !== undefined) out.hotelTotals = p.hotelTotals.map(buildTotalValues);
  if (p.carTotals !== undefined) out.carTotals = p.carTotals.map(buildTotalValues);
  if (p.trainTotals !== undefined) out.trainTotals = p.trainTotals.map(buildTotalValues);
  if (p.formsOfPayment !== undefined) {
    out.formsOfPayment = p.formsOfPayment as BookingFormOfPayment[];
  }
  if (p.ancillaryTotals !== undefined) {
    out.ancillaryTotals = p.ancillaryTotals.map(buildGenericTotalValues);
  }
  return out;
}

function buildResponseOtherService(
  osi: components['schemas']['OtherServiceInformation'],
): Booking['otherServices'] extends readonly (infer T)[] | undefined ? T : never {
  return { ...osi };
}

function buildSpecialService(ss: components['schemas']['SpecialService']): BookingSpecialService {
  const out: BookingSpecialService = {};
  if (ss.travelerIndices !== undefined) out.travelerIndices = ss.travelerIndices;
  if (ss.flights !== undefined) out.flights = ss.flights;
  if (ss.code !== undefined) out.code = ss.code;
  if (ss.name !== undefined) out.name = ss.name;
  if (ss.message !== undefined) out.message = ss.message;
  if (ss.statusCode !== undefined) out.statusCode = ss.statusCode;
  if (ss.statusName !== undefined) out.statusName = ss.statusName;
  return out;
}

function buildAccountingItem(ai: components['schemas']['AccountingItem']): BookingAccountingItem {
  const out: BookingAccountingItem = {};
  if (ai.fareApplicationType !== undefined) out.fareApplicationType = ai.fareApplicationType;
  if (ai.formOfPaymentType !== undefined) out.formOfPaymentType = ai.formOfPaymentType;
  if (ai.creationType !== undefined) out.creationType = ai.creationType;
  if (ai.airlineCode !== undefined) out.airlineCode = ai.airlineCode;
  if (ai.ticketNumber !== undefined) out.ticketNumber = ai.ticketNumber;
  if (ai.commission !== undefined) out.commission = ai.commission as BookingCommission;
  if (ai.fareAmount !== undefined) out.fareAmount = ai.fareAmount;
  if (ai.taxAmount !== undefined) out.taxAmount = ai.taxAmount;
  if (ai.travelerIndices !== undefined) out.travelerIndices = ai.travelerIndices;
  if (ai.tariffBasisType !== undefined) out.tariffBasisType = ai.tariffBasisType;
  if (ai.cardNumber !== undefined) out.cardNumber = ai.cardNumber;
  if (ai.cardTypeCode !== undefined) out.cardTypeCode = ai.cardTypeCode;
  if (ai.currencyCode !== undefined) out.currencyCode = ai.currencyCode;
  if (ai.goodsAndServicesTax !== undefined) out.goodsAndServicesTax = ai.goodsAndServicesTax;
  if (ai.invoiceNumber !== undefined) out.invoiceNumber = ai.invoiceNumber;
  if (ai.text !== undefined) out.text = ai.text;
  return out;
}

function buildNonElectronicTicket(
  t: components['schemas']['NonElectronicTicket'],
): BookingNonElectronicTicket {
  return { ...t };
}

function buildResponseTravelerEmployer(
  emp: components['schemas']['TravelersEmployer'],
): Booking['travelersEmployers'] extends readonly (infer T)[] | undefined ? T : never {
  return { ...emp };
}

// ---------------------------------------------------------------------------
// fulfillTickets helpers — request builders
// ---------------------------------------------------------------------------

function buildFulfillmentDetailsBody(d: FulfillmentDetails): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (d.ancillaryIds && d.ancillaryIds.length > 0) {
    out.ancillaryIds = [...d.ancillaryIds];
  }
  if (d.ticketingQualifiers !== undefined) {
    out.ticketingQualifiers = buildFulfillTicketingQualifiersBody(d.ticketingQualifiers);
  }
  if (d.serviceFee !== undefined) {
    out.serviceFee = buildFulfillMiscellaneousServiceFeeBody(d.serviceFee);
  }
  if (d.payment !== undefined) {
    out.payment = buildFulfillPaymentMethodBody(d.payment);
  }
  return out;
}

function buildFulfillTicketingQualifiersBody(
  q: FulfillTicketingQualifiers,
): Record<string, unknown> {
  const out: Record<string, unknown> = {
    priceWithTaxes: q.priceWithTaxes ?? true,
    returnFareFlexibilityDetails: q.returnFareFlexibilityDetails ?? false,
    isNetFareCommission: q.isNetFareCommission ?? false,
  };
  if (q.commissionAmount !== undefined) out.commissionAmount = q.commissionAmount;
  if (q.commissionPercentage !== undefined) out.commissionPercentage = q.commissionPercentage;
  if (q.endorsements !== undefined) {
    out.endorsements = buildFulfillEndorsementsBody(q.endorsements);
  }
  if (q.excludeFareFocusFares !== undefined) {
    out.excludeFareFocusFares = q.excludeFareFocusFares;
  }
  if (q.travelerIndices && q.travelerIndices.length > 0) {
    out.travelerIndices = [...q.travelerIndices];
  }
  if (q.tourCode !== undefined) out.tourCode = q.tourCode;
  if (q.tourCodeOverrides !== undefined) out.tourCodeOverrides = q.tourCodeOverrides;
  if (q.validatingAirlineCode !== undefined) out.validatingAirlineCode = q.validatingAirlineCode;
  if (q.brandedFares && q.brandedFares.length > 0) {
    out.brandedFares = q.brandedFares.map(buildFulfillBrandedFareBody);
  }
  if (q.exemptTaxes && q.exemptTaxes.length > 0) {
    out.exemptTaxes = [...q.exemptTaxes];
  }
  if (q.sideTripFlights && q.sideTripFlights.length > 0) {
    out.sideTripFlights = q.sideTripFlights.map(buildFlightReferenceBody);
  }
  if (q.penalties && q.penalties.length > 0) {
    out.penalties = q.penalties.map(buildFulfillTicketPenaltyBody);
  }
  if (q.priceQuoteRecordIds && q.priceQuoteRecordIds.length > 0) {
    out.priceQuoteRecordIds = [...q.priceQuoteRecordIds];
  }
  if (q.spanishLargeFamilyDiscountLevel !== undefined) {
    out.spanishLargeFamilyDiscountLevel = q.spanishLargeFamilyDiscountLevel;
  }
  if (q.specificFares && q.specificFares.length > 0) {
    out.specificFares = q.specificFares.map(buildFulfillSpecificFareBody);
  }
  if (q.validityDates && q.validityDates.length > 0) {
    out.validityDates = q.validityDates.map(buildFulfillValidityPeriodBody);
  }
  if (q.baggageAllowance && q.baggageAllowance.length > 0) {
    out.baggageAllowance = q.baggageAllowance.map(buildFulfillBaggageAllowanceBody);
  }
  if (q.discountApprovalCode !== undefined) out.discountApprovalCode = q.discountApprovalCode;
  if (q.futurePricingLines && q.futurePricingLines.length > 0) {
    out.futurePricingLines = q.futurePricingLines.map(buildFulfillFutureProcessingBody);
  }
  if (q.printDocuments !== undefined) out.printDocuments = q.printDocuments;
  if (q.netRemit !== undefined) out.netRemit = buildFulfillNetRemitBody(q.netRemit);
  return out;
}

function buildFulfillEndorsementsBody(e: FulfillEndorsements): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (e.description !== undefined) out.description = e.description;
  if (e.useOverride !== undefined) out.useOverride = e.useOverride;
  return out;
}

function buildFulfillBrandedFareBody(f: FulfillBrandedFare): Record<string, unknown> {
  const out: Record<string, unknown> = { brandCode: f.brandCode };
  if (f.flights && f.flights.length > 0) {
    out.flights = f.flights.map(buildFlightReferenceBody);
  }
  return out;
}

function buildFulfillSpecificFareBody(f: FulfillSpecificFare): Record<string, unknown> {
  const out: Record<string, unknown> = { fareBasisCode: f.fareBasisCode };
  if (f.flights && f.flights.length > 0) {
    out.flights = f.flights.map(buildFlightReferenceBody);
  }
  return out;
}

function buildFulfillValidityPeriodBody(v: FulfillValidityPeriod): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (v.startDate !== undefined) out.startDate = v.startDate;
  if (v.endDate !== undefined) out.endDate = v.endDate;
  if (v.flights && v.flights.length > 0) {
    out.flights = v.flights.map(buildFlightReferenceBody);
  }
  return out;
}

function buildFulfillBaggageAllowanceBody(b: FulfillBaggageAllowance): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (b.totalWeightInKilograms !== undefined) {
    out.totalWeightInKilograms = b.totalWeightInKilograms;
  }
  if (b.baggagePieces !== undefined) out.baggagePieces = b.baggagePieces;
  if (b.flights && b.flights.length > 0) {
    out.flights = b.flights.map(buildFlightReferenceBody);
  }
  return out;
}

function buildFulfillTicketPenaltyBody(p: FulfillTicketPenalty): Record<string, unknown> {
  const out: Record<string, unknown> = { type: p.type };
  if (p.applicability !== undefined) out.applicability = p.applicability;
  if (p.isChangeable !== undefined) out.isChangeable = p.isChangeable;
  if (p.maximumPenalty !== undefined) {
    out.maximumPenalty = {
      amount: p.maximumPenalty.amount,
      currencyCode: p.maximumPenalty.currencyCode,
    };
  }
  return out;
}

function buildFulfillFutureProcessingBody(f: FulfillFutureProcessing): Record<string, unknown> {
  const out: Record<string, unknown> = { firstLineNumber: f.firstLineNumber };
  if (f.lastLineNumber !== undefined) out.lastLineNumber = f.lastLineNumber;
  if (f.travelerIndex !== undefined) out.travelerIndex = f.travelerIndex;
  return out;
}

function buildFulfillNetRemitBody(n: FulfillNetRemit): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (n.netRemitCode !== undefined) out.netRemitCode = n.netRemitCode;
  if (n.commercialAgreementReferenceCode !== undefined) {
    out.commercialAgreementReferenceCode = n.commercialAgreementReferenceCode;
  }
  if (n.cashAmount !== undefined) out.cashAmount = n.cashAmount;
  if (n.creditAmount !== undefined) out.creditAmount = n.creditAmount;
  if (n.discountAmount !== undefined) out.discountAmount = n.discountAmount;
  if (n.sellingFareAmount !== undefined) out.sellingFareAmount = n.sellingFareAmount;
  if (n.tourCode !== undefined) out.tourCode = n.tourCode;
  return out;
}

function buildFulfillMiscellaneousServiceFeeBody(
  fee: FulfillMiscellaneousServiceFee,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (fee.overrideAmount !== undefined) out.overrideAmount = fee.overrideAmount;
  if (fee.currencyCode !== undefined) out.currencyCode = fee.currencyCode;
  if (fee.description !== undefined) out.description = fee.description;
  if (fee.customerReference !== undefined) out.customerReference = fee.customerReference;
  return out;
}

function buildFulfillPaymentMethodBody(p: FulfillPaymentMethod): Record<string, unknown> {
  const out: Record<string, unknown> = { primaryFormOfPayment: p.primaryFormOfPayment };
  if (p.secondaryFormOfPayment !== undefined) {
    out.secondaryFormOfPayment = p.secondaryFormOfPayment;
  }
  if (p.amountOnSecondFormOfPayment !== undefined) {
    out.amountOnSecondFormOfPayment = p.amountOnSecondFormOfPayment;
  }
  return out;
}

function buildFulfillFormOfPaymentBody(f: FulfillFormOfPayment): Record<string, unknown> {
  const out: Record<string, unknown> = { type: f.type };
  if (f.cardTypeCode !== undefined) out.cardTypeCode = f.cardTypeCode;
  if (f.cardNumber !== undefined) out.cardNumber = f.cardNumber;
  if (f.cardSecurityCode !== undefined) out.cardSecurityCode = f.cardSecurityCode;
  if (f.expiryDate !== undefined) out.expiryDate = f.expiryDate;
  if (f.extendedPayment !== undefined) out.extendedPayment = f.extendedPayment;
  if (f.miscellaneousCreditCode !== undefined) {
    out.miscellaneousCreditCode = f.miscellaneousCreditCode;
  }
  if (f.numberOfInstallments !== undefined) out.numberOfInstallments = f.numberOfInstallments;
  if (f.airlinePlanCode !== undefined) out.airlinePlanCode = f.airlinePlanCode;
  if (f.installmentAmount !== undefined) out.installmentAmount = f.installmentAmount;
  if (f.manualApprovalCode !== undefined) out.manualApprovalCode = f.manualApprovalCode;
  if (f.virtualCardCode !== undefined) out.virtualCardCode = f.virtualCardCode;
  if (f.authentications && f.authentications.length > 0) {
    out.authentications = f.authentications.map(buildFulfillStrongCustomerAuthenticationBody);
  }
  if (f.invoiceDescription !== undefined) out.invoiceDescription = f.invoiceDescription;
  if (f.addInvoiceDescriptionPrefix !== undefined) {
    out.addInvoiceDescriptionPrefix = f.addInvoiceDescriptionPrefix;
  }
  return out;
}

function buildFulfillStrongCustomerAuthenticationBody(
  a: FulfillStrongCustomerAuthentication,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (a.channelCode !== undefined) out.channelCode = a.channelCode;
  return out;
}

function buildFulfillTravelerBody(t: FulfillTraveler): Record<string, unknown> {
  const out: Record<string, unknown> = { givenName: t.givenName, surname: t.surname };
  if (t.middleName !== undefined) out.middleName = t.middleName;
  return out;
}

function buildFulfillAgencyBody(a: FulfillAgency): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (a.address !== undefined) {
    const addr: Record<string, unknown> = {};
    if (a.address.street !== undefined) addr.street = a.address.street;
    if (a.address.city !== undefined) addr.city = a.address.city;
    if (a.address.stateProvince !== undefined) addr.stateProvince = a.address.stateProvince;
    if (a.address.postalCode !== undefined) addr.postalCode = a.address.postalCode;
    if (a.address.countryCode !== undefined) addr.countryCode = a.address.countryCode;
    if (a.address.name !== undefined) addr.name = a.address.name;
    if (a.address.freeText !== undefined) addr.freeText = a.address.freeText;
    out.address = addr;
  }
  if (a.contactInfo !== undefined) {
    const contacts: Record<string, unknown> = {};
    if (a.contactInfo.emails && a.contactInfo.emails.length > 0) {
      contacts.emails = [...a.contactInfo.emails];
    }
    if (a.contactInfo.phones && a.contactInfo.phones.length > 0) {
      contacts.phones = [...a.contactInfo.phones];
    }
    if (a.contactInfo.includePhoneLabel !== undefined) {
      contacts.includePhoneLabel = a.contactInfo.includePhoneLabel;
    }
    out.contactInfo = contacts;
  }
  return out;
}

function buildFlightReferenceBody(f: FlightReference): Record<string, unknown> {
  return { itemId: f.itemId };
}

// ---------------------------------------------------------------------------
// fulfillTickets helpers — response builders
// ---------------------------------------------------------------------------

function buildFulfillTicket(t: components['schemas']['FulfillTicket']): FulfillTicket {
  const out: FulfillTicket = {
    number: t.number,
    date: t.date,
    payment: buildTotalValues(t.payment),
  };
  if (t.isCommitted !== undefined) out.isCommitted = t.isCommitted;
  if (t.travelerGivenName !== undefined) out.travelerGivenName = t.travelerGivenName;
  if (t.travelerSurname !== undefined) out.travelerSurname = t.travelerSurname;
  if (t.ticketStatusName !== undefined) out.ticketStatusName = t.ticketStatusName;
  if (t.ticketStatusCode !== undefined) out.ticketStatusCode = t.ticketStatusCode;
  if (t.ticketingPcc !== undefined) out.ticketingPcc = t.ticketingPcc;
  return out;
}

function buildFulfillTicketsRequestEcho(
  req: components['schemas']['FulfillTicketsRequest'],
): FulfillTicketsInput {
  const out: FulfillTicketsInput = {
    confirmationId: req.confirmationId,
    fulfillments: req.fulfillments.map(buildFulfillmentDetailsEcho),
    retainAccounting: req.retainAccounting,
    receivedFrom: req.receivedFrom,
    generateSingleInvoice: req.generateSingleInvoice,
    commitTicketToBookingWaitTime: req.commitTicketToBookingWaitTime,
    acceptNegotiatedFare: req.acceptNegotiatedFare,
    acceptPriceChanges: req.acceptPriceChanges,
  };
  if (req.errorHandlingPolicy !== undefined) {
    out.errorHandlingPolicy = [...req.errorHandlingPolicy];
  }
  if (req.bookingSource !== undefined) out.bookingSource = req.bookingSource;
  if (req.agency !== undefined) out.agency = buildFulfillAgencyEcho(req.agency);
  if (req.targetPcc !== undefined) out.targetPcc = req.targetPcc;
  if (req.designatePrinters !== undefined) {
    out.designatePrinters = req.designatePrinters.map(buildPrinterAddressEcho);
  }
  if (req.formsOfPayment !== undefined) {
    out.formsOfPayment = req.formsOfPayment.map(buildFulfillFormOfPaymentEcho);
  }
  if (req.travelers !== undefined) {
    out.travelers = req.travelers.map(buildFulfillTravelerEcho);
  }
  if (req.backDatePriceQuoteMethod !== undefined) {
    out.backDatePriceQuoteMethod = req.backDatePriceQuoteMethod;
  }
  if (req.priceQuoteExpirationMethod !== undefined) {
    out.priceQuoteExpirationMethod = req.priceQuoteExpirationMethod;
  }
  if (req.notificationEmail !== undefined) {
    out.notificationEmail = req.notificationEmail;
  }
  return out;
}

function buildFulfillmentDetailsEcho(
  d: components['schemas']['FulfillmentDetails'],
): FulfillmentDetails {
  const out: FulfillmentDetails = {};
  if (d.ancillaryIds !== undefined) out.ancillaryIds = [...d.ancillaryIds];
  if (d.ticketingQualifiers !== undefined) {
    out.ticketingQualifiers = buildFulfillTicketingQualifiersEcho(d.ticketingQualifiers);
  }
  if (d.serviceFee !== undefined) {
    out.serviceFee = { ...d.serviceFee };
  }
  if (d.payment !== undefined) {
    const payment: FulfillPaymentMethod = { primaryFormOfPayment: d.payment.primaryFormOfPayment };
    if (d.payment.secondaryFormOfPayment !== undefined) {
      payment.secondaryFormOfPayment = d.payment.secondaryFormOfPayment;
    }
    if (d.payment.amountOnSecondFormOfPayment !== undefined) {
      payment.amountOnSecondFormOfPayment = d.payment.amountOnSecondFormOfPayment;
    }
    out.payment = payment;
  }
  return out;
}

function buildFulfillTicketingQualifiersEcho(
  q: components['schemas']['FulfillQualifiers'],
): FulfillTicketingQualifiers {
  const out: FulfillTicketingQualifiers = {
    priceWithTaxes: q.priceWithTaxes,
    returnFareFlexibilityDetails: q.returnFareFlexibilityDetails,
    isNetFareCommission: q.isNetFareCommission,
  };
  if (q.commissionAmount !== undefined) out.commissionAmount = q.commissionAmount;
  if (q.commissionPercentage !== undefined) out.commissionPercentage = q.commissionPercentage;
  if (q.endorsements !== undefined) out.endorsements = { ...q.endorsements };
  if (q.excludeFareFocusFares !== undefined) out.excludeFareFocusFares = q.excludeFareFocusFares;
  if (q.travelerIndices !== undefined) out.travelerIndices = [...q.travelerIndices];
  if (q.tourCode !== undefined) out.tourCode = q.tourCode;
  if (q.tourCodeOverrides !== undefined) out.tourCodeOverrides = q.tourCodeOverrides;
  if (q.validatingAirlineCode !== undefined) out.validatingAirlineCode = q.validatingAirlineCode;
  if (q.brandedFares !== undefined) {
    out.brandedFares = q.brandedFares.map((b) => ({
      brandCode: b.brandCode,
      ...(b.flights !== undefined ? { flights: b.flights.map((f) => ({ itemId: f.itemId })) } : {}),
    }));
  }
  if (q.exemptTaxes !== undefined) out.exemptTaxes = [...q.exemptTaxes];
  if (q.sideTripFlights !== undefined) {
    out.sideTripFlights = q.sideTripFlights.map((f) => ({ itemId: f.itemId }));
  }
  if (q.penalties !== undefined) {
    out.penalties = q.penalties.map((p) => {
      const tp: FulfillTicketPenalty = { type: p.type };
      if (p.applicability !== undefined) tp.applicability = p.applicability;
      if (p.isChangeable !== undefined) tp.isChangeable = p.isChangeable;
      if (p.maximumPenalty !== undefined) {
        tp.maximumPenalty = {
          amount: p.maximumPenalty.amount,
          currencyCode: p.maximumPenalty.currencyCode,
        };
      }
      return tp;
    });
  }
  if (q.priceQuoteRecordIds !== undefined) {
    out.priceQuoteRecordIds = [...q.priceQuoteRecordIds];
  }
  if (q.spanishLargeFamilyDiscountLevel !== undefined) {
    out.spanishLargeFamilyDiscountLevel = q.spanishLargeFamilyDiscountLevel;
  }
  if (q.specificFares !== undefined) {
    out.specificFares = q.specificFares.map((f) => ({
      fareBasisCode: f.fareBasisCode,
      ...(f.flights !== undefined ? { flights: f.flights.map((x) => ({ itemId: x.itemId })) } : {}),
    }));
  }
  if (q.validityDates !== undefined) {
    out.validityDates = q.validityDates.map((v) => {
      const vp: FulfillValidityPeriod = {};
      if (v.startDate !== undefined) vp.startDate = v.startDate;
      if (v.endDate !== undefined) vp.endDate = v.endDate;
      if (v.flights !== undefined) vp.flights = v.flights.map((x) => ({ itemId: x.itemId }));
      return vp;
    });
  }
  if (q.baggageAllowance !== undefined) {
    out.baggageAllowance = q.baggageAllowance.map((b) => {
      const ba: FulfillBaggageAllowance = {};
      if (b.totalWeightInKilograms !== undefined) {
        ba.totalWeightInKilograms = b.totalWeightInKilograms;
      }
      if (b.baggagePieces !== undefined) ba.baggagePieces = b.baggagePieces;
      if (b.flights !== undefined) ba.flights = b.flights.map((x) => ({ itemId: x.itemId }));
      return ba;
    });
  }
  if (q.discountApprovalCode !== undefined) out.discountApprovalCode = q.discountApprovalCode;
  if (q.futurePricingLines !== undefined) {
    out.futurePricingLines = q.futurePricingLines.map((f) => {
      const fp: FulfillFutureProcessing = { firstLineNumber: f.firstLineNumber };
      if (f.lastLineNumber !== undefined) fp.lastLineNumber = f.lastLineNumber;
      if (f.travelerIndex !== undefined) fp.travelerIndex = f.travelerIndex;
      return fp;
    });
  }
  if (q.printDocuments !== undefined) out.printDocuments = q.printDocuments;
  if (q.netRemit !== undefined) out.netRemit = { ...q.netRemit };
  return out;
}

function buildFulfillAgencyEcho(a: components['schemas']['GenericAgency']): FulfillAgency {
  const out: FulfillAgency = {};
  if (a.address !== undefined) {
    const addr: FulfillAgency['address'] = {};
    const src = a.address;
    if (src.street !== undefined) addr.street = src.street;
    if (src.city !== undefined) addr.city = src.city;
    if (src.stateProvince !== undefined) addr.stateProvince = src.stateProvince;
    if (src.postalCode !== undefined) addr.postalCode = src.postalCode;
    if (src.countryCode !== undefined) addr.countryCode = src.countryCode;
    if (src.name !== undefined) addr.name = src.name;
    if (src.freeText !== undefined) addr.freeText = src.freeText;
    out.address = addr;
  }
  if (a.contactInfo !== undefined) {
    const ci: FulfillAgency['contactInfo'] = {};
    if (a.contactInfo.emails !== undefined) ci.emails = [...a.contactInfo.emails];
    if (a.contactInfo.phones !== undefined) ci.phones = [...a.contactInfo.phones];
    if (a.contactInfo.includePhoneLabel !== undefined) {
      ci.includePhoneLabel = a.contactInfo.includePhoneLabel;
    }
    out.contactInfo = ci;
  }
  return out;
}

function buildPrinterAddressEcho(p: components['schemas']['PrinterAddress']): PrinterAddress {
  const out: PrinterAddress = {};
  if (p.profileNumber !== undefined) out.profileNumber = p.profileNumber;
  if (p.hardcopy !== undefined) {
    const h: NonNullable<PrinterAddress['hardcopy']> = {};
    if (p.hardcopy.address !== undefined) h.address = p.hardcopy.address;
    if (p.hardcopy.spacing !== undefined) h.spacing = p.hardcopy.spacing;
    out.hardcopy = h;
  }
  if (p.invoiceItinerary !== undefined) out.invoiceItinerary = p.invoiceItinerary;
  if (p.ticket !== undefined) {
    const t: NonNullable<PrinterAddress['ticket']> = {};
    if (p.ticket.address !== undefined) t.address = p.ticket.address;
    if (p.ticket.countryCode !== undefined) t.countryCode = p.ticket.countryCode;
    out.ticket = t;
  }
  return out;
}

function buildFulfillFormOfPaymentEcho(
  f: components['schemas']['FulfillFormOfPayment'],
): FulfillFormOfPayment {
  const out: FulfillFormOfPayment = { type: f.type };
  if (f.cardTypeCode !== undefined) out.cardTypeCode = f.cardTypeCode;
  if (f.cardNumber !== undefined) out.cardNumber = f.cardNumber;
  if (f.cardSecurityCode !== undefined) out.cardSecurityCode = f.cardSecurityCode;
  if (f.expiryDate !== undefined) out.expiryDate = f.expiryDate;
  if (f.extendedPayment !== undefined) out.extendedPayment = f.extendedPayment;
  if (f.miscellaneousCreditCode !== undefined) {
    out.miscellaneousCreditCode = f.miscellaneousCreditCode;
  }
  if (f.numberOfInstallments !== undefined) out.numberOfInstallments = f.numberOfInstallments;
  if (f.airlinePlanCode !== undefined) out.airlinePlanCode = f.airlinePlanCode;
  if (f.installmentAmount !== undefined) out.installmentAmount = f.installmentAmount;
  if (f.manualApprovalCode !== undefined) out.manualApprovalCode = f.manualApprovalCode;
  if (f.virtualCardCode !== undefined) out.virtualCardCode = f.virtualCardCode;
  if (f.authentications !== undefined) {
    out.authentications = f.authentications.map((a) => ({ ...a }));
  }
  if (f.invoiceDescription !== undefined) out.invoiceDescription = f.invoiceDescription;
  if (f.addInvoiceDescriptionPrefix !== undefined) {
    out.addInvoiceDescriptionPrefix = f.addInvoiceDescriptionPrefix;
  }
  return out;
}

function buildFulfillTravelerEcho(t: components['schemas']['TravelerName']): FulfillTraveler {
  const out: FulfillTraveler = { givenName: t.givenName, surname: t.surname };
  if (t.middleName !== undefined) out.middleName = t.middleName;
  return out;
}

// ---------------------------------------------------------------------------
// checkTickets
// ---------------------------------------------------------------------------

/**
 * Builds the outgoing {@link SabreRequest} for the `checkTickets`
 * operation.
 *
 * The request body matches the `CheckTicketsRequest` schema. Every
 * field is optional and there are no spec-defined defaults, so
 * nothing is invented — only caller-supplied values are emitted.
 */
export function toCheckTicketsRequest(baseUrl: string, input: CheckTicketsInput): SabreRequest {
  const url = new URL(CHECK_TICKETS_PATH, ensureTrailingSlash(baseUrl));

  const body: Record<string, unknown> = {};
  if (input.targetPcc !== undefined) body.targetPcc = input.targetPcc;
  if (input.tickets && input.tickets.length > 0) {
    body.tickets = input.tickets.map(buildRefundFlightTicketBody);
  }
  if (input.confirmationId !== undefined) body.confirmationId = input.confirmationId;

  return {
    method: 'POST',
    url: url.toString(),
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  };
}

/**
 * Parses the `checkTickets` response into the public output shape.
 *
 * Throws {@link SabreParseError} when the body is not valid JSON or
 * not an object.
 */
export function fromCheckTicketsResponse(res: SabreResponse): CheckTicketsOutput {
  let parsed: components['schemas']['CheckTicketsResponse'];
  try {
    parsed = JSON.parse(res.body) as components['schemas']['CheckTicketsResponse'];
  } catch (err) {
    throw new SabreParseError('Failed to parse Check Tickets response as JSON', res.body, {
      cause: err,
    });
  }

  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new SabreParseError('Check Tickets response was not a JSON object', parsed);
  }

  const out: CheckTicketsOutput = {};

  if (parsed.timestamp !== undefined) out.timestamp = parsed.timestamp;
  if (parsed.request !== undefined) out.request = buildCheckTicketsRequestEcho(parsed.request);
  if (parsed.tickets !== undefined) out.tickets = parsed.tickets.map(buildCheckedTicket);
  if (parsed.errors !== undefined && parsed.errors.length > 0) {
    out.errors = parsed.errors.map(buildBookingError);
  }
  if (parsed.cancelOffers !== undefined) {
    out.cancelOffers = parsed.cancelOffers.map(buildCancelOffer);
  }
  if (parsed.flightRefunds !== undefined) {
    out.flightRefunds = parsed.flightRefunds.map(buildFlightRefund);
  }

  return out;
}

function buildRefundFlightTicketBody(t: RefundFlightTicket): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (t.number !== undefined) out.number = t.number;
  if (t.refundQualifiers !== undefined) {
    out.refundQualifiers = buildRefundQualifiersBody(t.refundQualifiers);
  }
  return out;
}

function buildRefundQualifiersBody(q: RefundQualifiers): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (q.overrideCancelFee !== undefined) out.overrideCancelFee = q.overrideCancelFee;
  if (q.overrideTaxes && q.overrideTaxes.length > 0) {
    out.overrideTaxes = q.overrideTaxes.map(buildOverrideTaxBody);
  }
  if (q.commissionAmount !== undefined) out.commissionAmount = q.commissionAmount;
  if (q.commissionPercentage !== undefined) out.commissionPercentage = q.commissionPercentage;
  if (q.commissionOnPenalty !== undefined) out.commissionOnPenalty = q.commissionOnPenalty;
  if (q.waiverCode !== undefined) out.waiverCode = q.waiverCode;
  if (q.tourCode !== undefined) out.tourCode = q.tourCode;
  if (q.splitRefundAmounts && q.splitRefundAmounts.length > 0) {
    out.splitRefundAmounts = q.splitRefundAmounts.map((s) => ({ ...s }));
  }
  if (q.journeyTypeCode !== undefined) out.journeyTypeCode = q.journeyTypeCode;
  return out;
}

function buildOverrideTaxBody(t: OverrideTax): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (t.taxCode !== undefined) out.taxCode = t.taxCode;
  if (t.taxAmount !== undefined) out.taxAmount = t.taxAmount;
  if (t.airportTaxBreakdowns && t.airportTaxBreakdowns.length > 0) {
    out.airportTaxBreakdowns = t.airportTaxBreakdowns.map((b) => ({ ...b }));
  }
  return out;
}

function buildCheckTicketsRequestEcho(
  req: components['schemas']['CheckTicketsRequest'],
): CheckTicketsInput {
  const out: CheckTicketsInput = {};
  if (req.targetPcc !== undefined) out.targetPcc = req.targetPcc;
  if (req.tickets !== undefined) out.tickets = req.tickets.map(buildRefundFlightTicketEcho);
  if (req.confirmationId !== undefined) out.confirmationId = req.confirmationId;
  return out;
}

function buildRefundFlightTicketEcho(
  t: components['schemas']['RefundFlightTicket'],
): RefundFlightTicket {
  const out: RefundFlightTicket = {};
  if (t.number !== undefined) out.number = t.number;
  if (t.refundQualifiers !== undefined) {
    out.refundQualifiers = buildRefundQualifiersEcho(t.refundQualifiers);
  }
  return out;
}

function buildRefundQualifiersEcho(q: components['schemas']['RefundQualifiers']): RefundQualifiers {
  const out: RefundQualifiers = {};
  if (q.overrideCancelFee !== undefined) out.overrideCancelFee = q.overrideCancelFee;
  if (q.overrideTaxes !== undefined) {
    out.overrideTaxes = q.overrideTaxes.map(buildOverrideTaxEcho);
  }
  if (q.commissionAmount !== undefined) out.commissionAmount = q.commissionAmount;
  if (q.commissionPercentage !== undefined) out.commissionPercentage = q.commissionPercentage;
  if (q.commissionOnPenalty !== undefined) out.commissionOnPenalty = q.commissionOnPenalty;
  if (q.waiverCode !== undefined) out.waiverCode = q.waiverCode;
  if (q.tourCode !== undefined) out.tourCode = q.tourCode;
  if (q.splitRefundAmounts !== undefined) {
    out.splitRefundAmounts = q.splitRefundAmounts.map((s) => ({ ...s }));
  }
  if (q.journeyTypeCode !== undefined) out.journeyTypeCode = q.journeyTypeCode;
  return out;
}

function buildOverrideTaxEcho(t: components['schemas']['OverrideTax']): OverrideTax {
  const out: OverrideTax = {};
  if (t.taxCode !== undefined) out.taxCode = t.taxCode;
  if (t.taxAmount !== undefined) out.taxAmount = t.taxAmount;
  if (t.airportTaxBreakdowns !== undefined) {
    out.airportTaxBreakdowns = t.airportTaxBreakdowns.map((b) => ({ ...b }));
  }
  return out;
}

function buildCheckedTicket(t: components['schemas']['CheckedTicket']): CheckedTicket {
  const out: CheckedTicket = {};
  if (t.number !== undefined) out.number = t.number;
  if (t.isVoidable !== undefined) out.isVoidable = t.isVoidable;
  if (t.isRefundable !== undefined) out.isRefundable = t.isRefundable;
  if (t.isAutomatedRefundsEligible !== undefined) {
    out.isAutomatedRefundsEligible = t.isAutomatedRefundsEligible;
  }
  if (t.refundPenalties !== undefined) {
    out.refundPenalties = t.refundPenalties.map(buildPenaltyItem);
  }
  if (t.refundTaxes !== undefined) {
    out.refundTaxes = t.refundTaxes.map(buildCancelRefundTax);
  }
  if (t.refundTotals !== undefined) out.refundTotals = buildTotalValues(t.refundTotals);
  if (t.isChangeable !== undefined) out.isChangeable = t.isChangeable;
  if (t.exchangePenalties !== undefined) {
    out.exchangePenalties = t.exchangePenalties.map(buildPenaltyItem);
  }
  if (t.refundFee !== undefined) out.refundFee = buildCheckRefundFee(t.refundFee);
  return out;
}

function buildCheckRefundFee(f: components['schemas']['RefundFee']): CheckRefundFee {
  const out: CheckRefundFee = {};
  if (f.amount !== undefined) out.amount = f.amount;
  if (f.currencyCode !== undefined) out.currencyCode = f.currencyCode;
  if (f.taxes !== undefined) out.taxes = f.taxes.map(buildCancelRefundTax);
  return out;
}

function buildCancelOffer(o: components['schemas']['CancelOffer']): CancelOffer {
  const out: CancelOffer = {};
  if (o.offerType !== undefined) out.offerType = o.offerType;
  if (o.offerItemId !== undefined) out.offerItemId = o.offerItemId;
  if (o.offerExpirationDate !== undefined) out.offerExpirationDate = o.offerExpirationDate;
  if (o.offerExpirationTime !== undefined) out.offerExpirationTime = o.offerExpirationTime;
  if (o.refundTotals !== undefined) out.refundTotals = buildTotalValues(o.refundTotals);
  return out;
}

// ---------------------------------------------------------------------------
// refundTickets
// ---------------------------------------------------------------------------

/**
 * Builds the outgoing {@link SabreRequest} for the `refundTickets`
 * operation.
 *
 * The request body matches the `RefundTicketsRequest` schema. Every
 * field is optional and there are no spec-defined defaults, so nothing
 * is invented — only caller-supplied values are emitted.
 */
export function toRefundTicketsRequest(baseUrl: string, input?: RefundTicketsInput): SabreRequest {
  const url = new URL(REFUND_TICKETS_PATH, ensureTrailingSlash(baseUrl));

  const body: Record<string, unknown> = {};
  if (input?.errorHandlingPolicy !== undefined) {
    body.errorHandlingPolicy = input.errorHandlingPolicy;
  }
  if (input?.targetPcc !== undefined) body.targetPcc = input.targetPcc;
  if (input?.tickets && input.tickets.length > 0) {
    body.tickets = input.tickets.map(buildRefundFlightTicketBody);
  }
  if (input?.receivedFrom !== undefined) body.receivedFrom = input.receivedFrom;
  if (input?.notification !== undefined) {
    body.notification = buildNotificationBody(input.notification);
  }
  if (input?.designatePrinters && input.designatePrinters.length > 0) {
    body.designatePrinters = input.designatePrinters.map(buildPrinterAddressBody);
  }
  if (input?.confirmationId !== undefined) body.confirmationId = input.confirmationId;
  if (input?.documentsType !== undefined) body.documentsType = input.documentsType;

  return {
    method: 'POST',
    url: url.toString(),
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  };
}

/**
 * Parses the `refundTickets` response into the public output shape.
 *
 * Throws {@link SabreParseError} when the body is not valid JSON or
 * not an object.
 */
export function fromRefundTicketsResponse(res: SabreResponse): RefundTicketsOutput {
  let parsed: components['schemas']['RefundTicketsResponse'];
  try {
    parsed = JSON.parse(res.body) as components['schemas']['RefundTicketsResponse'];
  } catch (err) {
    throw new SabreParseError('Failed to parse Refund Tickets response as JSON', res.body, {
      cause: err,
    });
  }

  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new SabreParseError('Refund Tickets response was not a JSON object', parsed);
  }

  const out: RefundTicketsOutput = {};

  if (parsed.timestamp !== undefined) out.timestamp = parsed.timestamp;
  if (parsed.request !== undefined) out.request = buildRefundTicketsRequestEcho(parsed.request);
  if (parsed.tickets !== undefined) out.tickets = parsed.tickets.map(buildRefundTicket);
  if (parsed.errors !== undefined && parsed.errors.length > 0) {
    out.errors = parsed.errors.map(buildBookingError);
  }
  if (parsed.refundedTickets !== undefined) {
    out.refundedTickets = [...parsed.refundedTickets];
  }

  return out;
}

function buildRefundTicketsRequestEcho(
  req: components['schemas']['RefundTicketsRequest'],
): RefundTicketsInput {
  const out: RefundTicketsInput = {};
  if (req.errorHandlingPolicy !== undefined) out.errorHandlingPolicy = req.errorHandlingPolicy;
  if (req.targetPcc !== undefined) out.targetPcc = req.targetPcc;
  if (req.tickets !== undefined) out.tickets = req.tickets.map(buildRefundFlightTicketEcho);
  if (req.receivedFrom !== undefined) out.receivedFrom = req.receivedFrom;
  if (req.notification !== undefined) {
    const notification: BookNotification = {};
    if (req.notification.email !== undefined) notification.email = req.notification.email;
    if (req.notification.queuePlacement !== undefined) {
      notification.queuePlacement = req.notification.queuePlacement.map((q) => ({ ...q }));
    }
    out.notification = notification;
  }
  if (req.designatePrinters !== undefined) {
    out.designatePrinters = req.designatePrinters.map(buildPrinterAddressEcho);
  }
  if (req.confirmationId !== undefined) out.confirmationId = req.confirmationId;
  if (req.documentsType !== undefined) out.documentsType = req.documentsType;
  return out;
}

function buildRefundTicket(t: components['schemas']['Ticket']): RefundTicket {
  const out: RefundTicket = {};
  if (t.number !== undefined) out.number = t.number;
  if (t.isVoidable !== undefined) out.isVoidable = t.isVoidable;
  if (t.isRefundable !== undefined) out.isRefundable = t.isRefundable;
  if (t.isAutomatedRefundsEligible !== undefined) {
    out.isAutomatedRefundsEligible = t.isAutomatedRefundsEligible;
  }
  if (t.refundPenalties !== undefined) {
    out.refundPenalties = t.refundPenalties.map(buildPenaltyItem);
  }
  if (t.refundTaxes !== undefined) {
    out.refundTaxes = t.refundTaxes.map(buildCancelRefundTax);
  }
  if (t.refundTotals !== undefined) out.refundTotals = buildTotalValues(t.refundTotals);
  if (t.isChangeable !== undefined) out.isChangeable = t.isChangeable;
  if (t.exchangePenalties !== undefined) {
    out.exchangePenalties = t.exchangePenalties.map(buildPenaltyItem);
  }
  return out;
}

function ensureTrailingSlash(url: string): string {
  return url.endsWith('/') ? url : `${url}/`;
}
