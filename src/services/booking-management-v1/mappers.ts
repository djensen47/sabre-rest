import { SabreParseError } from '../../errors/sabre-parse-error.js';
import type { components } from '../../generated/booking-management.js';
import type { SabreRequest, SabreResponse } from '../../http/types.js';
import type {
  BookAncillary,
  BookCar,
  BookContactInfo,
  BookFlight,
  BookFlightDetails,
  BookFlightOffer,
  BookFormOfPayment,
  BookHotel,
  BookNotification,
  BookOtherService,
  BookPayment,
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
  BookingJourney,
  BookingLoyaltyProgram,
  BookingMeal,
  BookingMonetaryValue,
  BookingNonElectronicTicket,
  BookingPayments,
  BookingRemark,
  BookingSegment,
  BookingSpecialService,
  BookingTaxComponent,
  BookingTicketCoupon,
  BookingTotalValues,
  BookingTrain,
  BookingTraveler,
  CreateBookingInput,
  CreateBookingOutput,
} from './types.js';

const PATH = 'v1/trip/orders/createBooking';

/**
 * Builds the outgoing {@link SabreRequest} for the `createBooking`
 * operation.
 *
 * The request body matches the `CreateBookingRequest` schema. Fields
 * with spec-defined defaults (`receivedFrom`, `asynchronousUpdateWaitTime`)
 * are always sent.
 */
export function toCreateBookingRequest(baseUrl: string, input: CreateBookingInput): SabreRequest {
  const url = new URL(PATH, ensureTrailingSlash(baseUrl));

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

function buildMonetaryValue(v: components['schemas']['Value']): BookingMonetaryValue {
  const out: BookingMonetaryValue = {};
  if (v.amount !== undefined) out.amount = v.amount;
  if (v.currencyCode !== undefined) out.currencyCode = v.currencyCode;
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
    const isf: Record<string, unknown> = {};
    if (f.initialSellingFare.totals !== undefined) {
      isf.totals = buildGenericTotalValues(f.initialSellingFare.totals);
    }
    if (f.initialSellingFare.fareDifferenceBreakdown !== undefined) {
      const fdb = f.initialSellingFare.fareDifferenceBreakdown;
      const breakdown: Record<string, unknown> = {};
      if (fdb.adjustedAmount !== undefined) {
        breakdown.fareDifference = { amount: fdb.adjustedAmount, currencyCode: fdb.currencyCode };
      }
      isf.fareDifferenceBreakdown = breakdown;
    }
    out.initialSellingFare = isf as BookingFare['initialSellingFare'];
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
  if (p.penalty !== undefined)
    out.penalty = { amount: p.penalty.amount, currencyCode: p.penalty.currencyCode };
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

function ensureTrailingSlash(url: string): string {
  return url.endsWith('/') ? url : `${url}/`;
}
