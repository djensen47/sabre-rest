/**
 * Public input/output types for the Booking Management v1 service.
 *
 * Hand-written intentionally — not derived from `src/generated/`. The
 * generated types are kept internal so consumer-facing types stay stable
 * across spec changes and use idiomatic TypeScript naming.
 *
 * The Booking Management API manages Sabre reservations through
 * operations like create, get, modify, and cancel. This file defines
 * the public types for the `createBooking` operation. The `Booking`
 * response type and its children are shared across all booking
 * operations and will be reused as additional methods are added.
 */

// ---------------------------------------------------------------------------
// Enum types (string unions)
// ---------------------------------------------------------------------------

/**
 * Error handling policies for the create booking request.
 *
 * - `HALT_ON_ERROR` — default; stop on any error.
 * - `DO_NOT_HALT_ON_FLIGHT_PRICING_ERROR` — ATPCO/traditional only.
 * - `DO_NOT_HALT_ON_HOTEL_BOOKING_ERROR` — continue if hotel fails.
 * - `DO_NOT_HALT_ON_CAR_BOOKING_ERROR` — continue if car fails.
 * - `DO_NOT_HALT_ON_ANCILLARY_BOOKING_ERROR` — continue if ancillary fails.
 * - `DO_NOT_HALT_ON_SEAT_BOOKING_ERROR` — continue if seat fails.
 * - `HALT_ON_INVALID_MINIMUM_CONNECTING_TIME_ERROR` — ATPCO only.
 * - `DO_NOT_HALT_ON_IDENTITY_DOCUMENT_WARNING` — NDC only.
 */
export type CreateBookingErrorPolicy =
  | 'HALT_ON_ERROR'
  | 'DO_NOT_HALT_ON_FLIGHT_PRICING_ERROR'
  | 'DO_NOT_HALT_ON_HOTEL_BOOKING_ERROR'
  | 'DO_NOT_HALT_ON_CAR_BOOKING_ERROR'
  | 'DO_NOT_HALT_ON_ANCILLARY_BOOKING_ERROR'
  | 'DO_NOT_HALT_ON_SEAT_BOOKING_ERROR'
  | 'HALT_ON_INVALID_MINIMUM_CONNECTING_TIME_ERROR'
  | 'DO_NOT_HALT_ON_IDENTITY_DOCUMENT_WARNING';

/** Ticketing arrangement policy for the agency. */
export type BookTicketingPolicy =
  | 'TODAY'
  | 'ALREADY_TICKETED'
  | 'FUTURE_TICKETING'
  | 'TICKETING_TIME_LIMIT';

/** Source for an ATPCO or LCC flight booking. */
export type BookFlightSource = 'ATPCO' | 'LCC';

/**
 * Flight status codes indicating the desired booking status.
 * Unacceptable codes can be configured via `haltOnFlightStatusCodes`.
 */
export type BookHaltOnFlightStatusCode = 'NO' | 'NN' | 'UC' | 'US' | 'UN' | 'UU' | 'LL' | 'HL';

/** Seat area preference for seat assignment. */
export type BookSeatAreaPreference =
  | 'AISLE'
  | 'BULKHEAD'
  | 'FRONT'
  | 'LEFT_SIDE'
  | 'RIGHT_SIDE'
  | 'TAIL'
  | 'WINDOW';

/** Hotel payment policy type. */
export type BookHotelPaymentPolicy = 'DEPOSIT' | 'GUARANTEE' | 'LATE';

/** Car payment policy type. */
export type BookCarPaymentPolicy = 'DEPOSIT' | 'GUARANTEE';

/** Title for a traveler. */
export type BookTitle =
  | 'Mr'
  | 'Mrs'
  | 'Ms'
  | 'Dr'
  | 'Miss'
  | 'Mstr'
  | 'Mlle'
  | 'Sir'
  | 'Father'
  | 'Sister'
  | 'Brother'
  | 'Reverend'
  | 'Lt'
  | 'Capt'
  | 'Congressman'
  | 'Duke'
  | 'Duchess'
  | 'Prof';

/** Gender of a traveler. */
export type BookGender =
  | 'FEMALE'
  | 'MALE'
  | 'INFANT_FEMALE'
  | 'INFANT_MALE'
  | 'UNDISCLOSED'
  | 'UNDEFINED';

/** Identity document type. */
export type BookDocumentType =
  | 'PASSPORT'
  | 'VISA'
  | 'SECURE_FLIGHT_PASSENGER_DATA'
  | 'RESIDENCE_ADDRESS'
  | 'DESTINATION_ADDRESS'
  | 'KNOWN_TRAVELER_NUMBER'
  | 'REDRESS_NUMBER'
  | 'ALIEN_RESIDENT'
  | 'PERMANENT_RESIDENT'
  | 'FACILITATION_DOCUMENT'
  | 'NATIONAL_ID_CARD'
  | 'NEXUS_CARD'
  | 'MILITARY'
  | 'NATURALIZATION_CERTIFICATE'
  | 'REFUGEE_REENTRY_PERMIT'
  | 'BORDER_CROSSING_CARD'
  | 'FISCAL_ID';

/** Sub-type for fiscal identity documents. */
export type BookDocumentSubType = 'RUC' | 'CUIT/CUIL' | 'NIT';

/** Passport type classification. */
export type BookPassportType =
  | 'National Passport'
  | 'Emergency Passport'
  | 'Diplomatic Passport'
  | 'Official/Service Passport'
  | 'Refugee Passport'
  | 'Alien Passport'
  | 'Stateless/Special Passport'
  | 'Laissez-passer Passport'
  | 'Mission/Service Passport'
  | 'Single Sheet Emergency Passport'
  | 'Passport';

/** Loyalty program type. */
export type BookProgramType =
  | 'FREQUENT_FLYER'
  | 'FREQUENT_RENTER'
  | 'LOYALTY_ID'
  | 'CORPORATE_LOYALTY_ID';

/** Reason for issuance of an ancillary EMD. */
export type BookReasonForIssuance =
  | 'AIR_TRANSPORTATION'
  | 'SURFACE_TRANSPORTATION_NON_AIR_SERVICES'
  | 'BAGGAGE'
  | 'FINANCIAL_IMPACT'
  | 'AIRPORT_SERVICES'
  | 'MERCHANDISE'
  | 'INFLIGHT_SERVICES'
  | 'INDIVIDUAL_AIRLINE_USE'
  | 'UNKNOWN';

/** Source of an ancillary offer. */
export type BookAncillarySource = 'ATPCO' | 'MERCHANDISING_MANAGER';

/** EMD type for ancillary services. */
export type BookElectronicMiscellaneousDocumentType =
  | 'STANDALONE'
  | 'FLIGHT_COUPON_ASSOCIATED'
  | 'STANDALONE_TICKET_ASSOCIATED'
  | 'OTHER_THAN_EMD'
  | 'ETICKET';

/** Form of payment type. */
export type BookFormOfPaymentType =
  | 'PAYMENTCARD'
  | 'CASH'
  | 'CHECK'
  | 'MISCELLANEOUS'
  | 'INSTALLMENTS'
  | 'VIRTUAL_CARD'
  | 'AGENCY_NAME'
  | 'AGENCY_IATA'
  | 'CORPORATE'
  | 'COMPANY_NAME'
  | 'VOUCHER'
  | 'DOCKET'
  | 'GOVERNMENT_TRAVEL_REQUEST'
  | 'INVOICE';

/** Use type for a form of payment. */
export type BookFormOfPaymentUseType =
  | 'All'
  | 'Ancillary'
  | 'Airline'
  | 'Bus/Ground Transportation'
  | 'Car'
  | 'Cruise'
  | 'Hotel'
  | 'Insurance'
  | 'Low-Cost Carrier'
  | 'Other'
  | 'Rail'
  | 'Specialty Service'
  | 'Tour'
  | 'Interface Record'
  | 'Unknown';

/** Trip type for a form of payment. */
export type BookFormOfPaymentTripType =
  | 'All'
  | 'Corporate/Business'
  | 'Leisure'
  | 'Emergency'
  | 'Family'
  | 'Group'
  | 'Unknown';

/** Remark type for booking remarks. */
export type BookRemarkType =
  | 'GENERAL'
  | 'HISTORICAL'
  | 'CLIENT_ADDRESS'
  | 'ALPHA_CODED'
  | 'DELIVERY_ADDRESS'
  | 'ITINERARY'
  | 'INVOICE'
  | 'HIDDEN'
  | 'CORPORATE'
  | 'FORM_OF_PAYMENT'
  | 'PRINT_ON_TICKET'
  | 'FILLER_STRIP'
  | 'INTERFACE'
  | 'QUEUE_PLACE';

/** Email notification type. */
export type BookNotificationEmail =
  | 'DEFAULT'
  | 'INVOICE'
  | 'ETICKET'
  | 'ETICKET_PDF'
  | 'ITINERARY'
  | 'ITINERARY_PDF';

/** Employer ID type. */
export type BookEmployerIdType = 'GST' | 'Unknown';

/** Passenger status for pricing qualifiers. */
export type BookPassengerStatus = 'RESIDENT' | 'NATIONALITY' | 'EMPLOYEE';

/** Comparison type for price overrides. */
export type BookComparisonType =
  | 'INCREASE_BY_AMOUNT'
  | 'INCREASE_BY_PERCENT'
  | 'DECREASE_BY_AMOUNT'
  | 'DECREASE_BY_PERCENT';

/** Tour code override option. */
export type BookTourCodeOverrideOption =
  | 'REPLACE_WITH_BT'
  | 'REPLACE_WITH_IT'
  | 'SUPPRESS_IT'
  | 'SUPPRESS_IT_AND_FARE';

// -- Response enums --

/** Source of the booking (Sabre PNR or NDC order). */
export type BookingSource = 'SABRE' | 'SABRE_ORDER';

/** Flight content source type. */
export type BookingFlightSource = 'ATPCO' | 'LCC' | 'NDC';

/** Gender values in the response. */
export type BookingGender =
  | 'FEMALE'
  | 'MALE'
  | 'INFANT_FEMALE'
  | 'INFANT_MALE'
  | 'UNDISCLOSED'
  | 'UNDEFINED';

/** Traveler type classification. */
export type BookingTravelerType =
  | 'ADULT'
  | 'AGENT'
  | 'AIRLINE'
  | 'CHILD'
  | 'EDUCATION'
  | 'GOVERNMENT'
  | 'GROUP'
  | 'INFANT'
  | 'MILITARY'
  | 'SENIOR'
  | 'SPECIAL'
  | 'YOUTH';

/** Identity document type in the response. Includes types not in request. */
export type BookingDocumentType =
  | 'PASSPORT'
  | 'VISA'
  | 'SECURE_FLIGHT_PASSENGER_DATA'
  | 'RESIDENCE_ADDRESS'
  | 'DESTINATION_ADDRESS'
  | 'KNOWN_TRAVELER_NUMBER'
  | 'REDRESS_NUMBER'
  | 'ALIEN_RESIDENT'
  | 'PERMANENT_RESIDENT'
  | 'FACILITATION_DOCUMENT'
  | 'NATIONAL_ID_CARD'
  | 'NEXUS_CARD'
  | 'MILITARY'
  | 'NATURALIZATION_CERTIFICATE'
  | 'REFUGEE_REENTRY_PERMIT'
  | 'BORDER_CROSSING_CARD'
  | 'FISCAL_ID';

/** Passport type in response, includes 'Unknown' variant. */
export type BookingPassportType =
  | 'National Passport'
  | 'Emergency Passport'
  | 'Diplomatic Passport'
  | 'Official/Service Passport'
  | 'Refugee Passport'
  | 'Alien Passport'
  | 'Stateless/Special Passport'
  | 'Laissez-passer Passport'
  | 'Mission/Service Passport'
  | 'Single Sheet Emergency Passport'
  | 'Passport'
  | 'Unknown';

/** Visa type in response. */
export type BookingVisaType =
  | 'U.S. Non Immigrant Visa'
  | 'U.S. Immigrant Visa'
  | 'Visa'
  | 'Unknown';

/** Remark type in the response. Same values as request. */
export type BookingRemarkType =
  | 'GENERAL'
  | 'HISTORICAL'
  | 'CLIENT_ADDRESS'
  | 'ALPHA_CODED'
  | 'DELIVERY_ADDRESS'
  | 'ITINERARY'
  | 'INVOICE'
  | 'HIDDEN'
  | 'CORPORATE'
  | 'FORM_OF_PAYMENT'
  | 'PRINT_ON_TICKET'
  | 'FILLER_STRIP'
  | 'INTERFACE'
  | 'QUEUE_PLACE';

/** Status name for flights, hotels, cars, trains, cruises, and special services. */
export type BookingStatusName =
  | 'Confirmed'
  | 'Waitlisted'
  | 'On Request'
  | 'Pending'
  | 'Cancelled'
  | 'Infant/No Seat'
  | 'Priority Waitlist'
  | 'Quote'
  | 'Space Available'
  | 'Unconfirmed'
  | 'Pending Quote'
  | 'No Seat'
  | 'Standby'
  | 'Unknown';

/** Meal description for in-flight services. */
export type BookingMealDescription =
  | 'Alcoholic beverages for purchase'
  | 'Breakfast'
  | 'Cold meal'
  | 'Complimentary alcoholic beverages'
  | 'Continental breakfast'
  | 'Dinner'
  | 'Food for purchase'
  | 'Food and beverage for purchase'
  | 'Hot meal'
  | 'Lunch'
  | 'Meal'
  | 'No meal service'
  | 'Refreshment'
  | 'Refreshment for purchase'
  | 'Snack';

/** Ticket status for electronic flight tickets. */
export type BookingTicketStatus = 'Issued' | 'Voided' | 'Refunded/Exchanged';

/** Coupon status for ticket coupons. */
export type BookingCouponStatus =
  | 'Airport Control'
  | 'Lifted'
  | 'Checked In'
  | 'Exchanged'
  | 'Flown'
  | 'Not Flown'
  | 'Refunded'
  | 'Voided'
  | 'Printed'
  | 'Okay'
  | 'Reactivated'
  | 'Irregular Operations'
  | 'Print Exchange'
  | 'Paper Ticket'
  | 'Suspended'
  | 'Locked';

/** Coupon status code for ticket coupons. */
export type BookingCouponStatusCode =
  | 'AL'
  | 'BD'
  | 'CK'
  | 'E'
  | 'B'
  | 'I'
  | 'RF'
  | 'V'
  | 'PR'
  | 'IO'
  | 'P'
  | 'PE'
  | 'T'
  | 'S'
  | 'XX';

/** Fare rule penalty applicability. */
export type BookingFareRulePenaltyApplicability = 'BEFORE_DEPARTURE' | 'AFTER_DEPARTURE';

/** Penalty source category. */
export type BookingPenaltySource = 'Category 33' | 'Category 31' | 'Category 16' | 'Unknown';

/** Pricing type code for saved fares. */
export type BookingPricingTypeCode = 'S' | 'A' | 'M';

/** Pricing type name for saved fares. */
export type BookingPricingTypeName = 'System' | 'Amended' | 'Manual' | 'Unknown';

/** Pricing status code. */
export type BookingPricingStatusCode = 'A' | 'H';

/** Pricing status name. */
export type BookingPricingStatusName = 'Active' | 'History';

/** Ancillary status in the response. */
export type BookingAncillaryStatusName =
  | 'Confirmed'
  | 'Confirmed with EMD issued'
  | 'On Request'
  | 'Pending'
  | 'Cancelled'
  | 'Unconfirmed'
  | 'Confirmed with pending payment'
  | 'Schedule change';

/** Flight applicability type for ancillaries. */
export type BookingFlightApplicabilityType = 'Single' | 'Multiple' | 'Unknown';

/** Vehicle type name for car rentals. */
export type BookingVehicleTypeName =
  | 'Two/Three Door'
  | 'Two/Four Door'
  | 'Four/Five Door'
  | 'Wagon/Estate'
  | 'Passenger Van'
  | 'Limousine/Sedan'
  | 'Sport'
  | 'Convertible'
  | 'SUV'
  | 'Open Air All Terrain'
  | 'Special'
  | 'Pick up single/extended cab 2 door'
  | 'Pick up double cab 4 door'
  | 'Special Offer Car'
  | 'Coupe'
  | 'Monospace'
  | 'Recreational Vehicle'
  | 'Motor Home'
  | 'Two Wheel Vehicle'
  | 'Roadster'
  | 'Crossover'
  | 'Commercial Van/Truck';

/** Guarantee type name for hotels. */
export type BookingGuaranteeTypeName =
  | 'Credit card'
  | 'Travel agency name/address'
  | 'Travel agency IATA number'
  | 'Company name/address'
  | 'Corporate ID/CD number'
  | 'Virtual card';

/** Car guarantee payment type. */
export type BookingGuaranteePaymentType = 'Guarantee' | 'Deposit' | 'Unknown';

/** Hotel source type. */
export type BookingHotelSource =
  | 'Legacy'
  | 'Sabre GDS'
  | 'Expedia Associate Network'
  | 'HotelBeds.com'
  | 'Booking.com'
  | 'CMNet'
  | 'Unknown';

/** Fare application type for accounting items. */
export type BookingFareApplicationType = 'Single Traveler' | 'All Travelers' | 'Each Traveler';

/** Form of payment type for accounting items. */
export type BookingAccountingFormOfPaymentType =
  | 'Cash'
  | 'Check'
  | 'Check or Cash'
  | 'Payment Card'
  | 'Masked Payment Card'
  | 'Unknown';

/** Tariff basis type for accounting. */
export type BookingTariffBasisType = 'Domestic' | 'Foreign' | 'International';

/** Non-electronic ticket status. */
export type BookingNonElectronicTicketStatus = 'Active' | 'Inactive' | 'Unknown';

/** Accounting item creation type. */
export type BookingAccountingItemCreationType = 'First Issuance' | 'Exchange' | 'Refund';

/** Reason for issuance enum for response ancillaries. */
export type BookingReasonForIssuance =
  | 'AIR_TRANSPORTATION'
  | 'SURFACE_TRANSPORTATION_NON_AIR_SERVICES'
  | 'BAGGAGE'
  | 'FINANCIAL_IMPACT'
  | 'AIRPORT_SERVICES'
  | 'MERCHANDISE'
  | 'INFLIGHT_SERVICES'
  | 'INDIVIDUAL_AIRLINE_USE'
  | 'UNKNOWN';

/** Ancillary source in response. */
export type BookingAncillarySource = 'ATPCO' | 'MERCHANDISING_MANAGER';

/** Document sub-type in response. */
export type BookingDocumentSubType = 'RUC' | 'CUIT/CUIL' | 'NIT';

/** Loyalty program type in response. */
export type BookingProgramType =
  | 'FREQUENT_FLYER'
  | 'FREQUENT_RENTER'
  | 'LOYALTY_ID'
  | 'CORPORATE_LOYALTY_ID';

/** Employer ID type in response. */
export type BookingEmployerIdType = 'GST' | 'Unknown';

/** Form of payment type in response. */
export type BookingFormOfPaymentType =
  | 'PAYMENTCARD'
  | 'CASH'
  | 'CHECK'
  | 'MISCELLANEOUS'
  | 'INSTALLMENTS'
  | 'VIRTUAL_CARD'
  | 'AGENCY_NAME'
  | 'AGENCY_IATA'
  | 'CORPORATE'
  | 'COMPANY_NAME'
  | 'VOUCHER'
  | 'DOCKET'
  | 'GOVERNMENT_TRAVEL_REQUEST'
  | 'INVOICE';

/** Form of payment use type in response. */
export type BookingFormOfPaymentUseType =
  | 'All'
  | 'Ancillary'
  | 'Airline'
  | 'Bus/Ground Transportation'
  | 'Car'
  | 'Cruise'
  | 'Hotel'
  | 'Insurance'
  | 'Low-Cost Carrier'
  | 'Other'
  | 'Rail'
  | 'Specialty Service'
  | 'Tour'
  | 'Interface Record'
  | 'Unknown';

/** Form of payment trip type in response. */
export type BookingFormOfPaymentTripType =
  | 'All'
  | 'Corporate/Business'
  | 'Leisure'
  | 'Emergency'
  | 'Family'
  | 'Group'
  | 'Unknown';

/** Hotel payment policy in response. */
export type BookingHotelPaymentPolicy = 'DEPOSIT' | 'GUARANTEE' | 'LATE';

// ---------------------------------------------------------------------------
// Common types
// ---------------------------------------------------------------------------

/** A postal address. */
export interface BookAddress {
  /** Street address line. */
  street?: string;
  /** City name. */
  city?: string;
  /** State or province. */
  stateProvince?: string;
  /** Postal or ZIP code. */
  postalCode?: string;
  /** Two-letter ISO 3166 country code. */
  countryCode?: string;
}

/** A named postal address (extends {@link BookAddress}). */
export interface BookNamedAddress extends BookAddress {
  /** Address name or label. */
  name?: string;
}

/** A phone number with an optional label. */
export interface BookPhone {
  /** Phone number. Digits, plus signs, and hyphens only. */
  number: string;
  /**
   * Phone type label. Single letter:
   * - `H` — home
   * - `B` — business
   * - `C` — cell
   * - `M` — mobile
   */
  label?: string;
}

/** A tax entry for ancillary pricing. */
export interface BookTax {
  /** Three-letter tax code. */
  taxCode?: string;
  /** Tax amount as a decimal string. */
  taxAmount?: string;
  /** Three-letter ISO 4217 currency code for the tax. */
  taxCurrencyCode?: string;
}

// ---------------------------------------------------------------------------
// Request input types
// ---------------------------------------------------------------------------

/**
 * Input to {@link BookingManagementV1Service.createBooking}.
 *
 * Creates an air booking (NDC, ATPCO, or LCC). At minimum, either
 * `flightOffer` (NDC) or `flightDetails` (ATPCO/LCC) should be
 * provided along with `travelers`.
 */
export interface CreateBookingInput {
  /**
   * Error handling policies. Defaults to `['HALT_ON_ERROR']` when
   * omitted.
   */
  errorHandlingPolicy?: readonly CreateBookingErrorPolicy[];

  /**
   * Pseudo city code for the target location. The API does not
   * revert context after completing the booking. 3–4 alphanumeric
   * characters.
   */
  targetPcc?: string;

  /**
   * The entity authorizing changes in the PNR. Defaults to
   * `'Create Booking'` when omitted.
   */
  receivedFrom?: string;

  /**
   * Maximum wait time in milliseconds for asynchronous updates
   * (e.g., NDC booking redisplay). Range: 0–10000. Defaults to `0`.
   */
  asynchronousUpdateWaitTime?: number;

  /** User profile details to apply. 1–13 items. */
  profiles?: readonly BookProfile[];

  /** Agency information. */
  agency?: BookAgency;

  /** NDC flight offer to book. Mutually exclusive with `flightDetails`. */
  flightOffer?: BookFlightOffer;

  /** ATPCO/LCC flight details to book. Mutually exclusive with `flightOffer`. */
  flightDetails?: BookFlightDetails;

  /** Hotel to book. */
  hotel?: BookHotel;

  /** Car to book. */
  car?: BookCar;

  /** Personal information of the travelers. */
  travelers?: readonly BookTraveler[];

  /** Contact information for the booking. */
  contactInfo?: BookContactInfo;

  /** Payment information. */
  payment?: BookPayment;

  /** Remarks to add to the booking. */
  remarks?: readonly BookRemark[];

  /** Post-booking notification (queue placement or email). */
  notification?: BookNotification;

  /** Other Service Information (OSI) for airlines. Not for hotels/cars. */
  otherServices?: readonly BookOtherService[];

  /**
   * Retention date to keep the booking active past the last
   * itinerary date. Format: `YYYY-MM-DD`.
   */
  retentionEndDate?: string;

  /** Label for the retention date. Up to 215 characters. */
  retentionLabel?: string;

  /** Details of the travelers' employers. */
  travelersEmployers?: readonly BookTravelerEmployer[];

  /**
   * If `true`, all frequent flyer loyalty programs in the payload or
   * profiles are sent to all carriers in the booking.
   */
  sendLoyaltiesToAllAirlines?: boolean;
}

/** User profile to apply to the booking. */
export interface BookProfile {
  /** Unique profile name. Cannot combine with `domainId`. */
  profileName?: string;
  /** Profile type code (max 3 characters, e.g., `'TVL'`). */
  profileTypeCode: string;
  /** Unique profile ID. */
  uniqueId?: string;
  /** Usually the user PCC or customer code. */
  domainId: string;
  /** Filter ID for a predefined profile subset. */
  filterId?: string;
}

/** Agency information for the booking. */
export interface BookAgency {
  /** Agency address. */
  address?: BookNamedAddress;
  /** Agency contact information. */
  contactInfo?: BookAgencyContacts;
  /** General ticketing policy. */
  ticketingPolicy?: BookTicketingPolicy;
  /** Detailed future ticketing arrangement. */
  futureTicketingPolicy?: BookFutureTicketingPolicy;
  /** Ticketing time limit policies. */
  ticketingTimeLimitPolicy?: BookTicketingTimeLimitPolicy;
  /**
   * Agency customer/DK number. 6, 7, or 10 characters.
   */
  agencyCustomerNumber?: string;
}

/** Agency contact information. */
export interface BookAgencyContacts {
  /** Email addresses. */
  emails?: readonly string[];
  /** Phone numbers. */
  phones?: readonly string[];
}

/** Future ticketing arrangement for the agency. */
export interface BookFutureTicketingPolicy {
  /** Ticketing PCC. */
  ticketingPcc?: string;
  /** Queue number for ticketing. */
  queueNumber?: string;
  /** Ticketing date in `YYYY-MM-DD` format. */
  ticketingDate?: string;
  /** Ticketing time in `HH:MM` format. */
  ticketingTime?: string;
  /** Free-text comment. */
  comment?: string;
}

/** Ticketing time limit policy. */
export interface BookTicketingTimeLimitPolicy {
  /** Whether to use the airline-imposed ticketing time limit. */
  useAirlineTimeLimit?: boolean;
}

/** NDC flight offer to book. */
export interface BookFlightOffer {
  /**
   * Unique offer ID from the shopping response. 2–49 characters.
   */
  offerId: string;
  /** Selected offer item IDs. 1–9 items. */
  selectedOfferItems: readonly string[];
  /** Seat offers to book. */
  seatOffers?: readonly BookSeatOffer[];
}

/** NDC seat offer for booking. */
export interface BookSeatOffer {
  /** Seat number. */
  number?: string;
  /** Seat row number. */
  rowNumber?: number;
  /** Seat column letter. */
  columnLetter?: string;
  /** NDC seat availability offer ID. 2–49 characters. */
  seatOfferId?: string;
}

/** ATPCO/LCC flight details for booking. */
export interface BookFlightDetails {
  /** Individual flights to book. 1–16 items. */
  flights?: readonly BookFlight[];
  /** Pricing qualifiers. 1–10 items. */
  flightPricing?: readonly BookPricingDetails[];
  /**
   * Flight status codes that are unacceptable. The booking will halt
   * if a flight returns one of these codes. Defaults to
   * `['NO', 'UC', 'US', 'UN', 'UU', 'LL', 'HL']`.
   */
  haltOnFlightStatusCodes?: readonly BookHaltOnFlightStatusCode[];
  /** If `true`, rebook unconfirmed flights at the lowest fare. */
  retryBookingUnconfirmedFlights?: boolean;
}

/** An individual ATPCO/LCC flight to book. */
export interface BookFlight {
  /** Flight number (1–9999). */
  flightNumber: number;
  /** Two-letter IATA airline code. */
  airlineCode: string;
  /** Three-letter IATA departure airport code. */
  fromAirportCode: string;
  /** Three-letter IATA arrival airport code. */
  toAirportCode: string;
  /** Departure date in `YYYY-MM-DD` format. */
  departureDate: string;
  /** Departure time in `HH:MM` format (24-hour). */
  departureTime: string;
  /** Booking class code (e.g., `'Y'`, `'J'`). */
  bookingClass: string;
  /** Desired flight status code. Defaults to `'NN'`. */
  flightStatusCode?: string;
  /** If `true`, this flight is part of a married connection. */
  isMarriageGroup?: boolean;
  /** Booking reference for passive bookings. 5+ characters. */
  confirmationId?: string;
  /** Arrival date for passive bookings in `YYYY-MM-DD` format. */
  arrivalDate?: string;
  /** Arrival time for passive bookings in `HH:MM` format. */
  arrivalTime?: string;
  /** Booking source: `'ATPCO'` (default) or `'LCC'`. */
  source?: BookFlightSource;
  /** Seats to book on this flight. */
  seats?: readonly BookSeat[];
  /** Seats on the change-of-gauge aircraft. */
  changeOfGaugeSeats?: readonly BookGenericSeat[];
}

/** A seat to book, with optional area preferences. */
export interface BookSeat extends BookGenericSeat {
  /**
   * Seat area preferences. 1–3 items. Cannot combine with a
   * specific seat number.
   */
  areaPreferences?: readonly BookSeatAreaPreference[];
}

/** Base seat specification. */
export interface BookGenericSeat {
  /** Seat number (e.g., `'12A'`). */
  number?: string;
  /** Row number. */
  rowNumber?: number;
  /** Column letter. */
  columnLetter?: string;
}

/** Pricing details/qualifiers for ATPCO flights. */
export interface BookPricingDetails {
  /** Traveler indices (1-based) this pricing applies to. */
  travelerIndices?: readonly number[];
  /** Fare type code (e.g., `'PUB'` for published, `'NET'` for net). */
  fareType?: string;
  /** Validating carrier airline code. */
  validatingAirlineCode?: string;
  /** Account code for negotiated fares. */
  accountCode?: string;
  /** Override pricing amounts. */
  priceComparisons?: readonly BookPriceComparison[];
  /** Tour code override options. */
  tourCodeOverrides?: BookTourCodeOverrides;
  /** Passenger status (for resident/nationality pricing). */
  passengerStatus?: BookPassengerStatus;
  /** Country code for passenger status. */
  passengerStatusCountryCode?: string;
  /** Brand fare IDs to price with. */
  brandFareIds?: readonly string[];
}

/** Price comparison for pricing overrides. */
export interface BookPriceComparison {
  /** Comparison type (increase/decrease by amount/percent). */
  type: BookComparisonType;
  /** Amount or percentage value. */
  value: string;
}

/** Tour code override options for pricing. */
export interface BookTourCodeOverrides {
  /** Tour code to apply. */
  tourCode?: string;
  /** Override option. */
  option?: BookTourCodeOverrideOption;
}

/** Hotel to book. */
export interface BookHotel {
  /**
   * Booking key from the Hotel Price Check API. 1–240 characters.
   */
  bookingKey: string;
  /**
   * If `true`, use Content Services for Lodging. Defaults to
   * `true`.
   */
  useCsl?: boolean;
  /** Corporate discount code. */
  corporateDiscountCode?: number;
  /** Rooms to book. 1–99 items. */
  rooms?: readonly BookRoom[];
  /** Special instructions for the property. */
  specialInstruction?: string;
  /** Payment policy: DEPOSIT, GUARANTEE, or LATE. */
  paymentPolicy?: BookHotelPaymentPolicy;
  /** Index (1-based) into the `formsOfPayment` array. 1–11. */
  formOfPayment?: number;
  /** Flight details to share with the hotel vendor. */
  associatedFlightDetails?: BookAssociatedFlightDetails;
}

/** A hotel room to book. */
export interface BookRoom {
  /** Guest count for this room. */
  numberOfGuests?: number;
  /** Room type code from the price check response. */
  roomTypeCode?: string;
}

/** Flight details associated with a hotel or car booking. */
export interface BookAssociatedFlightDetails {
  /** Arrival flight airline code. */
  arrivalAirlineCode?: string;
  /** Arrival flight number. */
  arrivalFlightNumber?: string;
  /** Departure flight airline code. */
  departureAirlineCode?: string;
  /** Departure flight number. */
  departureFlightNumber?: string;
}

/** Car to book. */
export interface BookCar {
  /**
   * Booking key from the Vehicle Price Check API. 1–240 characters.
   */
  bookingKey: string;
  /** Associated traveler index (1-based). */
  travelerIndex?: number;
  /** Traveler email index (1-based). */
  emailIndex?: number;
  /** Custom collection address. */
  collectionAddress?: BookAddress;
  /** Custom collection site. */
  collectionSite?: BookCarRentalSite;
  /** Custom delivery address. */
  deliveryAddress?: BookAddress;
  /** Custom delivery site. */
  deliverySite?: BookCarRentalSite;
  /** Flight details for the car vendor. */
  associatedFlightDetails?: BookAssociatedArrivalFlight;
  /** Payment policy: DEPOSIT or GUARANTEE. */
  paymentPolicy?: BookCarPaymentPolicy;
  /** Index (1-based) into the `formsOfPayment` array. 1–11. */
  formOfPayment?: number;
  /** Number of cars. Defaults to `1`. */
  quantity?: number;
  /** Special instructions for the vendor. */
  specialInstructions?: string;
  /** Flight index (1-based) for flight details to share with vendor. */
  flightIndex?: number;
}

/** Car rental site location. */
export interface BookCarRentalSite {
  /** Location name. */
  name?: string;
  /** Location ID/code. */
  id?: string;
}

/** Associated arrival flight for car booking. */
export interface BookAssociatedArrivalFlight {
  /** Arrival airline code. */
  arrivalAirlineCode?: string;
  /** Arrival flight number. */
  arrivalFlightNumber?: string;
}

/** Traveler information for booking. */
export interface BookTraveler {
  /** Price traveler ID from the Offer Price response (NDC). */
  id?: string;
  /** Traveler title (Mr, Mrs, Ms, Dr, etc.). */
  title?: BookTitle;
  /** First name. */
  givenName?: string;
  /** Last name. */
  surname?: string;
  /** Date of birth in `YYYY-MM-DD` format. Required for infants. */
  birthDate?: string;
  /** Gender. UNDISCLOSED and UNDEFINED are NDC only. */
  gender?: BookGender;
  /** Age (1–120). Required for hotel child travelers. */
  age?: number;
  /**
   * Passenger type code (e.g., `'ADT'` for adult, `'INF'` for
   * infant). Three-character alphanumeric.
   */
  passengerCode?: string;
  /** MAN number. Up to 29 characters. */
  nameReferenceCode?: string;
  /** Identity documents (passport, visa, etc.). */
  identityDocuments?: readonly BookIdentityDocument[];
  /** Frequent flyer and loyalty programs. */
  loyaltyPrograms?: readonly BookLoyaltyProgram[];
  /** If `true`, use the Notification contact type (NDC only). */
  useNotificationContactType?: boolean;
  /** Traveler email addresses. */
  emails?: readonly string[];
  /** Traveler phone numbers. */
  phones?: readonly BookPhone[];
  /** Special service requests (SSR). */
  specialServices?: readonly BookSpecialService[];
  /** Ancillary services to book. */
  ancillaries?: readonly BookAncillary[];
  /** Indices (1-based) into the `formsOfPayment` array. */
  formOfPaymentIndices?: readonly number[];
  /** Index (1-based) of the infant assigned to this adult. */
  infantTravelerIndex?: number;
  /** Index (1-based) into the `travelersEmployers` array. */
  employerIndex?: number;
}

/** Identity document for a traveler. */
export interface BookIdentityDocument {
  /** Document number. Alphanumeric only. */
  documentNumber?: string;
  /** Document type (passport, visa, etc.). */
  documentType: BookDocumentType;
  /** Sub-type for fiscal ID documents. */
  documentSubType?: BookDocumentSubType;
  /** Passport classification. */
  passportType?: BookPassportType;
  /** Document expiry date in `YYYY-MM-DD` format. */
  expiryDate?: string;
  /** Issuing country code (2–3 letter ISO 3166). */
  issuingCountryCode?: string;
  /** Residence country code (2–3 letter ISO 3166). */
  residenceCountryCode?: string;
  /** Place of issue (ISO 3166 code or place name). */
  placeOfIssue?: string;
  /** Place of birth (max 35 characters). */
  placeOfBirth?: string;
  /** Host country code for visa documents. */
  hostCountryCode?: string;
  /** Issue date in `YYYY-MM-DD` format. */
  issueDate?: string;
  /** First name on the document. */
  givenName?: string;
  /** Middle name on the document. */
  middleName?: string;
}

/** Frequent flyer or loyalty program. */
export interface BookLoyaltyProgram {
  /** Two-letter supplier code (e.g., airline code). */
  supplierCode?: string;
  /** Program type. */
  programType?: BookProgramType;
  /** Membership number (e.g., frequent flyer number). */
  programNumber: string;
  /** Program tier level. */
  tierLevel?: number;
  /** Two-letter receiver code. */
  receiverCode?: string;
}

/** Special service request (SSR) for an airline. */
export interface BookSpecialService {
  /** Four-letter SSR code (e.g., `'XBAG'`). */
  code: string;
  /** SSR text or description. */
  message?: string;
  /** Indices (1-based) of associated flights. */
  flightIndices?: readonly number[];
}

/** Ancillary service to book for a traveler. */
export interface BookAncillary {
  /** Commercial name of the ancillary. */
  commercialName?: string;
  /** IATA Reason For Issuance Code (RFIC). */
  reasonForIssuance?: BookReasonForIssuance;
  /** Three-character RFISC subcode (e.g., `'05Z'`). */
  subcode: string;
  /** Two-letter IATA airline code. */
  airlineCode: string;
  /** Two-letter vendor code. Mutually exclusive with `source`. */
  vendorCode?: string;
  /** Application source. Mutually exclusive with `vendorCode`. */
  source?: BookAncillarySource;
  /** EMD or document type. */
  electronicMiscellaneousDocumentType: BookElectronicMiscellaneousDocumentType;
  /** Total price after tax. Decimal string. */
  totalPrice?: string;
  /** Base cost before tax. Decimal string. */
  basePrice: string;
  /** Three-letter ISO 4217 currency code. */
  currencyCode: string;
  /** Tax breakdown. 1–99 items. */
  taxes?: readonly BookTax[];
  /** Quantity. Defaults to `1`. */
  numberOfItems?: number;
  /** First valid travel date in `YYYY-MM-DD` format. */
  firstTravelDate?: string;
  /** Last valid travel date in `YYYY-MM-DD` format. */
  lastTravelDate?: string;
  /** Group code for the ancillary. */
  groupCode: string;
  /** Indices (1-based) of associated flights. */
  flightIndices: readonly number[];
}

/** Contact information for the booking. */
export interface BookContactInfo {
  /** Email addresses. */
  emails?: readonly string[];
  /** Phone numbers. Digits, plus signs, and hyphens only. */
  phones?: readonly string[];
  /** Fax numbers. */
  faxes?: readonly string[];
  /** Emergency contact phone numbers. */
  emergencyPhones?: readonly string[];
}

/** Payment details for the booking. */
export interface BookPayment {
  /** Billing address for credit card payments. */
  billingAddress?: BookNamedAddress;
  /** Forms of payment. 1–10 items. */
  formsOfPayment?: readonly BookFormOfPayment[];
}

/** A form of payment for the booking. */
export interface BookFormOfPayment {
  /** Payment method type. */
  type: BookFormOfPaymentType;
  /** Card vendor code (e.g., `'VI'` for Visa). Two letters. */
  cardTypeCode?: string;
  /** Card number (12–19 digits, or masked format). */
  cardNumber?: string;
  /** Card security code (3–4 digits). */
  cardSecurityCode?: string;
  /** Card expiry date in `YYYY-MM` format. */
  expiryDate?: string;
  /** Number of months for extended payment (1–96). */
  extendedPayment?: number;
  /** Miscellaneous credit code (2–18 characters). */
  miscellaneousCreditCode?: string;
  /** Number of installments (1–96). */
  numberOfInstallments?: number;
  /** Airline plan code for installments. */
  airlinePlanCode?: string;
  /** First installment amount. */
  installmentAmount?: string;
  /** Card holder information. */
  cardHolder?: BookCardHolder;
  /** Manual approval details. */
  manualApproval?: BookManualApproval;
  /** Strong customer authentication details. 1–10 items. */
  authentications?: readonly BookStrongCustomerAuthentication[];
  /** Virtual card details. */
  virtualCard?: BookVirtualCard;
  /** Agency IATA number (1–12 characters). For `AGENCY_IATA` type. */
  agencyIataNumber?: string;
  /** Agency address. For `AGENCY_NAME` type. */
  agencyAddress?: BookNamedAddress;
  /** Corporate ID. For `CORPORATE` or `PAYMENTCARD` type. */
  corporateId?: string;
  /** Company address. For `COMPANY_NAME` type. */
  companyAddress?: BookNamedAddress;
  /** Voucher details. For `VOUCHER` type. */
  voucher?: BookVoucher;
  /** Net balance for installments. Decimal string. */
  netBalance?: string;
  /** Docket prefix (`'D'` or `'AGT*V'`). For `DOCKET` type. */
  docketPrefix?: string;
  /** Docket number (6 digits). For `DOCKET` type. */
  docketNumber?: string;
  /** Agent initials for docket. For `DOCKET` type. */
  docketIssuingAgentInitials?: string;
  /** Docket description. For `DOCKET` type. */
  docketDescription?: string;
  /** GTR details. For `GOVERNMENT_TRAVEL_REQUEST` type. */
  governmentTravelRequestDescription?: string;
  /** Invoice details. For `INVOICE` type. */
  invoiceDescription?: string;
  /** @deprecated Use `useTypes` instead. */
  useType?: BookFormOfPaymentUseType;
  /** @deprecated Use `tripTypes` instead. */
  tripType?: BookFormOfPaymentTripType;
  /** Permitted use types for this payment method. */
  useTypes?: readonly BookFormOfPaymentUseType[];
  /** Trip types for this payment method. */
  tripTypes?: readonly BookFormOfPaymentTripType[];
  /** If `true`, the card belongs to the travel agency. */
  isAgencyPaymentCard?: boolean;
}

/** Card holder details for a payment card. */
export interface BookCardHolder {
  /** First name. */
  givenName: string;
  /** Last name. */
  surname: string;
  /** Email address. */
  email?: string;
  /** Phone number. */
  phone?: string;
  /** Card holder address. */
  address?: BookAddress;
}

/** Manual approval details for a payment card. */
export interface BookManualApproval {
  /** Approval code from the card issuer. */
  code?: string;
}

/** Strong customer authentication (SCA) details. */
export interface BookStrongCustomerAuthentication {
  /** Authentication value (e.g., CAVV). */
  authenticationValue?: string;
  /** E-commerce indicator. */
  eCommerceIndicator?: string;
  /** Transaction ID (e.g., XID or DS Transaction ID). */
  transactionId?: string;
  /** Authentication version. */
  version?: string;
}

/** Virtual card details. */
export interface BookVirtualCard {
  /** Virtual card provider. */
  provider?: string;
  /** Account type. */
  accountType?: string;
}

/** Voucher details for payment. */
export interface BookVoucher {
  /** Voucher number. */
  number?: string;
  /** Voucher type. */
  type?: string;
}

/** A remark to add to the booking PNR. */
export interface BookRemark {
  /** Remark type. */
  type?: BookRemarkType;
  /** Single-letter alpha code for `ALPHA_CODED` type. */
  alphaCode?: string;
  /** Remark text. */
  text?: string;
  /** Queue placement details for `QUEUE_PLACE` type. */
  queuePlacement?: BookQueue;
}

/** Queue placement details. */
export interface BookQueue {
  /** Queue number (0–999). */
  queueNumber?: number;
  /** Queue name. */
  queueName?: string;
  /** Pseudo city code. */
  pcc?: string;
  /** Prefatory instruction code (0–254). */
  prefatoryInstructionCode: number;
  /** Future queue placement date in `YYYY-MM-DD` format. */
  futureQueuePlacementDate?: string;
}

/** Post-booking notification settings. */
export interface BookNotification {
  /** Email notification type. */
  email?: BookNotificationEmail;
  /** Queue placements for notification. 1–3 items. */
  queuePlacement?: readonly BookQueue[];
}

/** Other Service Information (OSI) sent to a vendor. */
export interface BookOtherService {
  /** Two-letter IATA airline code. */
  airlineCode?: string;
  /** Two-character hotel chain code. */
  chainCode?: string;
  /** Two-letter car vendor code. */
  vendorCode?: string;
  /** Free-text message. */
  text?: string;
}

/** Traveler employer details. */
export interface BookTravelerEmployer {
  /** Employer ID type. */
  idType?: BookEmployerIdType;
  /** Unique employer ID. */
  employerId?: string;
  /** Employer name. */
  employerName?: string;
  /** Employer phone numbers. */
  phones?: readonly BookPhone[];
  /** Employer email addresses. */
  emails?: readonly string[];
  /** Street address. */
  street?: string;
  /** City. */
  city?: string;
  /** State or province. */
  stateProvince?: string;
  /** Postal code. */
  postalCode?: string;
  /** Country code (2–3 letter ISO 3166). */
  countryCode?: string;
}

// ---------------------------------------------------------------------------
// Response output types
// ---------------------------------------------------------------------------

/**
 * Result of {@link BookingManagementV1Service.createBooking}.
 *
 * Contains the confirmation ID, the full booking state after
 * creation, and any errors encountered during processing.
 */
export interface CreateBookingOutput {
  /**
   * Response timestamp, UTC. Nominal format `YYYY-MM-DDTHH:MM:SSZ`,
   * but cert has been observed to return the value without the
   * trailing `Z` (e.g. `2026-04-22T21:16:58`). Treat the timezone as
   * UTC regardless.
   */
  timestamp?: string;

  /**
   * The booking ID/PNR locator generated by the Create Booking API.
   * 6+ alphanumeric characters.
   */
  confirmationId?: string;

  /** Complete booking information after creation. */
  booking?: Booking;

  /**
   * Errors Sabre returned alongside this response. Present on *some*
   * 200-OK responses — Sabre uses `errors[]` for both hard failures
   * (e.g. `APPLICATION_ERROR / TIMEOUT`, `BAD_REQUEST`) and benign
   * entries (warnings, informational rule ids). The library does not
   * classify or throw on these by default; consumers that want
   * "looks-like-a-failure → throw" semantics can call
   * `assertBookingSucceeded(result)` at their gateway layer.
   */
  errors?: readonly BookingError[];
}

/**
 * An error from the Booking Management API response.
 *
 * These appear in the `errors` array of the response when
 * something went wrong during processing.
 */
export interface BookingError {
  /** Error category (e.g., `'BAD_REQUEST'`). */
  category: string;
  /** Error type (e.g., `'REQUIRED_FIELD_MISSING'`). */
  type: string;
  /** Detailed error description. */
  description?: string;
  /** Request field path where the error occurred. */
  fieldPath?: string;
  /** Field name where the error occurred. */
  fieldName?: string;
  /** Field value that caused the error. */
  fieldValue?: string;
}

/**
 * A Sabre booking (reservation).
 *
 * This is the normalized view of a Sabre PNR or NDC order, returned
 * by createBooking, getBooking, modifyBooking, and cancelBooking.
 * All fields are optional because the response content depends on
 * the operation and any `returnOnly` filters.
 */
export interface Booking {
  /**
   * Booking reference ID. For Sabre, this is the PNR locator or
   * NDC order ID, depending on content type. 6–14 alphanumeric
   * characters.
   */
  bookingId?: string;

  /** Booking start date in `YYYY-MM-DD` format. */
  startDate?: string;

  /** Booking end date in `YYYY-MM-DD` format. */
  endDate?: string;

  /**
   * If `true`, the booking is cancelable (in full or by segment).
   *
   * Note: after a successful `cancelBooking` call, Sabre may continue
   * to return the booking with `isCancelable: true` on subsequent
   * `getBooking` retrievals. Do not rely on this flag alone to
   * determine whether a prior cancellation succeeded — use the
   * response of the `cancelBooking` call itself (and
   * `assertBookingSucceeded`) instead.
   */
  isCancelable?: boolean;

  /** If `true`, at least one ticket has been issued. */
  isTicketed?: boolean;

  /** Agency customer/DK number. */
  agencyCustomerNumber?: string;

  /** Booking creation details. */
  creationDetails?: BookingCreationDetails;

  /** Contact information for the booking. */
  contactInfo?: BookingContactInfo;

  /** Travelers in the booking. */
  travelers?: readonly BookingTraveler[];

  /** Travelers group information. */
  travelersGroup?: BookingTravelersGroup;

  /** Flights in the booking, in chronological order. */
  flights?: readonly BookingFlight[];

  /** Journey groupings (one-way, round-trip, multi-city). */
  journeys?: readonly BookingJourney[];

  /** Most restrictive fare rules at time of purchase. */
  fareRules?: readonly BookingFareRule[];

  /** Ancillary fare offers with baggage allowances. */
  fareOffers?: readonly BookingFareOffer[];

  /** Saved fares (from Price Quotes or Order Items). */
  fares?: readonly BookingFare[];

  /** Remarks in the PNR. */
  remarks?: readonly BookingRemark[];

  /** Hotel reservations. */
  hotels?: readonly BookingHotel[];

  /** Car rentals. */
  cars?: readonly BookingCar[];

  /** Train reservations. */
  trains?: readonly BookingTrain[];

  /** Cruise reservations. */
  cruises?: readonly BookingCruise[];

  /**
   * All segments including non-product segments. Overlaps with
   * flights, hotels, cars, etc.
   */
  allSegments?: readonly BookingSegment[];

  /** Electronic flight tickets. */
  flightTickets?: readonly BookingFlightTicket[];

  /** Total payment amounts across all product types. */
  payments?: BookingPayments;

  /** Other Service Information (OSI). */
  otherServices?: readonly BookingOtherService[];

  /** Future ticketing policy. */
  futureTicketingPolicy?: BookingFutureTicketingPolicy;

  /** Special services (SSR). */
  specialServices?: readonly BookingSpecialService[];

  /** Retention date in `YYYY-MM-DD` format. */
  retentionEndDate?: string;

  /** Retention date label. */
  retentionLabel?: string;

  /** Accounting items. ATPCO content only. */
  accountingItems?: readonly BookingAccountingItem[];

  /** Non-electronic (paper) tickets. ATPCO content only. */
  nonElectronicTickets?: readonly BookingNonElectronicTicket[];

  /** Traveler employer details. */
  travelersEmployers?: readonly BookingTravelerEmployer[];

  /** Profiles used in the booking. */
  profiles?: readonly BookingProfile[];
}

/** Booking creation details. */
export interface BookingCreationDetails {
  /** User sine of the creator. */
  creationUserSine?: string;
  /** Creation date in `YYYY-MM-DD` format. */
  creationDate?: string;
  /** Creation time in `HH:MM` format. */
  creationTime?: string;
  /** Purchase deadline date. */
  purchaseDeadlineDate?: string;
  /** Purchase deadline time. */
  purchaseDeadlineTime?: string;
  /** Agency IATA number. */
  agencyIataNumber?: string;
  /** User's work PCC. */
  userWorkPcc?: string;
  /** User's home PCC. */
  userHomePcc?: string;
  /** Prime host ID. */
  primeHostId?: string;
  /** Last update date. */
  lastUpdateDate?: string;
  /** Last update time. */
  lastUpdateTime?: string;
  /** Number of updates to the booking. */
  numberOfUpdates?: number;
}

/** Contact information in the booking response. */
export interface BookingContactInfo {
  /** Email addresses. */
  emails?: readonly string[];
  /** Phone numbers. */
  phones?: readonly string[];
  /** Fax numbers. */
  faxes?: readonly string[];
  /** Emergency phone numbers. */
  emergencyPhones?: readonly string[];
}

/** A traveler in the booking response. */
export interface BookingTraveler {
  /** First name. */
  givenName: string;
  /** Middle name. */
  middleName?: string;
  /** Last name. */
  surname: string;
  /** Date of birth in `YYYY-MM-DD` format. */
  birthDate?: string;
  /** Gender. */
  gender?: BookingGender;
  /** Traveler type classification. */
  type?: BookingTravelerType;
  /** Passenger type code (e.g., `'ADT'`). */
  passengerCode?: string;
  /** Name association ID. */
  nameAssociationId?: string;
  /** MAN number. */
  nameReferenceCode?: string;
  /** If `true`, this traveler is part of a group. */
  isGrouped?: boolean;
  /** Email addresses. */
  emails?: readonly string[];
  /** Phone numbers. */
  phones?: readonly BookingPhone[];
  /** Remarks associated with this traveler. */
  remarks?: readonly BookingRemark[];
  /** Traveler address. */
  address?: BookingNamedAddress;
  /** Identity documents. */
  identityDocuments?: readonly BookingIdentityDocument[];
  /** Loyalty programs. */
  loyaltyPrograms?: readonly BookingLoyaltyProgram[];
  /** Ancillary services associated with this traveler. */
  ancillaries?: readonly BookingAncillary[];
  /** Indices into the `formsOfPayment` array. */
  formOfPaymentIndices?: readonly number[];
  /** Index into the `travelersEmployers` array. */
  employerIndex?: number;
}

/** A phone number in the booking response. */
export interface BookingPhone {
  /** Phone number. */
  number: string;
  /** Phone type label. */
  label?: string;
}

/** A named address in the booking response. */
export interface BookingNamedAddress {
  /** Address name or label. */
  name?: string;
  /** Street address. */
  street?: string;
  /** City name. */
  city?: string;
  /** State or province. */
  stateProvince?: string;
  /** Postal code. */
  postalCode?: string;
  /** Country code. */
  countryCode?: string;
}

/** An address in the booking response. */
export interface BookingAddress {
  /** Street address. */
  street?: string;
  /** City name. */
  city?: string;
  /** State or province. */
  stateProvince?: string;
  /** Postal code. */
  postalCode?: string;
  /** Country code. */
  countryCode?: string;
}

/** An identity document in the booking response. */
export interface BookingIdentityDocument {
  /** Document number. */
  documentNumber?: string;
  /** Document type. */
  documentType: BookingDocumentType;
  /** Document sub-type (for fiscal IDs). */
  documentSubType?: BookingDocumentSubType;
  /** Passport type classification. */
  passportType?: BookingPassportType;
  /** Visa type classification. */
  visaType?: BookingVisaType;
  /** Expiry date in `YYYY-MM-DD` format. */
  expiryDate?: string;
  /** Issuing country code. */
  issuingCountryCode?: string;
  /** Residence country code. */
  residenceCountryCode?: string;
  /** Place of issue. */
  placeOfIssue?: string;
  /** Place of birth. */
  placeOfBirth?: string;
  /** Host country code (for visas). */
  hostCountryCode?: string;
  /** Issue date in `YYYY-MM-DD` format. */
  issueDate?: string;
  /** First name on document. */
  givenName?: string;
  /** Middle name on document. */
  middleName?: string;
  /** Last name on document. */
  surname?: string;
  /** Date of birth on document. */
  birthDate?: string;
  /** Gender on document. */
  gender?: BookingGender;
  /** If `true`, this is the primary document holder. */
  isPrimaryDocumentHolder?: boolean;
  /** If `true`, this is a lap child document. */
  isLapChildDocument?: boolean;
  /** Residence or destination address. */
  residenceDestinationAddress?: BookingAddress;
  /** Flight indices this document applies to. */
  flightIndices?: readonly number[];
  /** Document item ID. */
  itemId?: string;
  /** Citizenship country code. */
  citizenshipCountryCode?: string;
}

/** A loyalty program in the booking response. */
export interface BookingLoyaltyProgram {
  /** Supplier code. */
  supplierCode?: string;
  /** Program type. */
  programType?: BookingProgramType;
  /** Membership number. */
  programNumber: string;
  /** Tier level. */
  tierLevel?: number;
  /** Receiver code. */
  receiverCode?: string;
}

/** An ancillary service in the booking response. */
export interface BookingAncillary {
  /** Ancillary item ID. */
  itemId?: string;
  /** Commercial name. */
  commercialName?: string;
  /** Number of items. */
  numberOfItems?: number;
  /** Reason for issuance code. */
  reasonForIssuanceCode?: string;
  /** Reason for issuance name. */
  reasonForIssuanceName?: BookingReasonForIssuance;
  /** RFISC subcode. */
  subcode?: string;
  /** Airline code. */
  airlineCode?: string;
  /** Vendor code. */
  vendorCode?: string;
  /** Ancillary source. */
  source?: BookingAncillarySource;
  /** EMD number. */
  electronicMiscellaneousDocumentNumber?: string;
  /** If `true`, the ancillary is refundable. */
  isRefundable?: boolean;
  /** If `true`, the ancillary is commissionable. */
  isCommissionable?: boolean;
  /** Flight applicability. */
  flightApplicabilityType?: BookingFlightApplicabilityType;
  /** Associated flights by item ID. */
  flights?: readonly BookingFlightRef[];
  /** Status code. */
  statusCode?: string;
  /** Status name. */
  statusName?: BookingAncillaryStatusName;
  /** Payment totals. */
  totals?: BookingTotalValues;
  /** Tax breakdown. */
  taxes?: readonly BookingTaxEntry[];
  /** Special service code. */
  specialServiceCode?: string;
}

/** Travelers group information. */
export interface BookingTravelersGroup {
  /** Group item ID. */
  itemId?: string;
  /** Group name. */
  name?: string;
  /** Total travelers in group. */
  numberOfTravelers?: number;
  /** Remaining travelers in group. */
  numberOfTravelersRemaining?: number;
}

/** A flight in the booking response. */
export interface BookingFlight {
  /** Flight item ID (unique within the booking). */
  itemId: string;
  /** Confirmation ID for this flight segment. */
  confirmationId?: string;
  /** Content source type (ATPCO, LCC, or NDC). */
  sourceType?: BookingFlightSource;
  /** Flight number. */
  flightNumber: number;
  /** Marketing airline code. */
  airlineCode: string;
  /** Marketing airline name. */
  airlineName?: string;
  /** Operating flight number. */
  operatingFlightNumber?: number;
  /** Operating airline code. */
  operatingAirlineCode?: string;
  /** Operating airline name. */
  operatingAirlineName?: string;
  /** Departure airport code. */
  fromAirportCode: string;
  /** Arrival airport code. */
  toAirportCode: string;
  /** Departure date in `YYYY-MM-DD` format. */
  departureDate: string;
  /** Departure time in `HH:MM` format. */
  departureTime: string;
  /** Updated departure date (schedule change). */
  updatedDepartureDate?: string;
  /** Updated departure time (schedule change). */
  updatedDepartureTime?: string;
  /** Departure terminal name. */
  departureTerminalName?: string;
  /** Departure gate. */
  departureGate?: string;
  /** Arrival date. */
  arrivalDate: string;
  /** Arrival time. */
  arrivalTime: string;
  /** Updated arrival date (schedule change). */
  updatedArrivalDate?: string;
  /** Updated arrival time (schedule change). */
  updatedArrivalTime?: string;
  /** Arrival terminal name. */
  arrivalTerminalName?: string;
  /** Arrival gate. */
  arrivalGate?: string;
  /** Assigned seats. */
  seats?: readonly BookingSeat[];
  /** Change-of-gauge seats. */
  changeOfGaugeSeats?: readonly BookingSeat[];
  /** Number of seats. */
  numberOfSeats?: number;
  /** Cabin type name (e.g., Economy, Business). */
  cabinTypeName?: string;
  /** Cabin type code. */
  cabinTypeCode?: string;
  /** Aircraft type code (IATA). */
  aircraftTypeCode?: string;
  /** Aircraft type name. */
  aircraftTypeName?: string;
  /** Booking class code. */
  bookingClass?: string;
  /** In-flight meals. */
  meals?: readonly BookingMeal[];
  /** Flight status code (e.g., `'HK'` for confirmed). */
  flightStatusCode?: string;
  /** Flight status name. */
  flightStatusName?: BookingStatusName;
  /** Flight duration in minutes. */
  durationInMinutes?: number;
  /** Flight distance in miles. */
  distanceInMiles?: number;
  /** @deprecated Use `hiddenStops` array instead. */
  hiddenStopAircraftTypeCode?: string;
  /** @deprecated Use `hiddenStops` array instead. */
  hiddenStopAircraftTypeName?: string;
  /** @deprecated Use `hiddenStops` array instead. */
  hiddenStopAirportCode?: string;
  /** @deprecated Use `hiddenStops` array instead. */
  hiddenStopArrivalDate?: string;
  /** @deprecated Use `hiddenStops` array instead. */
  hiddenStopArrivalTime?: string;
  /** @deprecated Use `hiddenStops` array instead. */
  hiddenStopDepartureDate?: string;
  /** @deprecated Use `hiddenStops` array instead. */
  hiddenStopDepartureTime?: string;
  /** Hidden stops (connections not requiring deplaning). */
  hiddenStops?: readonly BookingHiddenStop[];
  /** Traveler indices this flight applies to. */
  travelerIndices?: readonly number[];
  /** Identity document references. */
  identityDocuments?: readonly BookingIdentityDocumentRef[];
  /** If `true`, this flight is in the past. */
  isPast?: boolean;
}

/** A seat in the booking response. */
export interface BookingSeat {
  /** Seat number. */
  number?: string;
}

/** An in-flight meal. */
export interface BookingMeal {
  /** Meal code. */
  code?: string;
  /** Meal description. */
  description?: BookingMealDescription;
}

/** A hidden stop (technical stop) on a flight. */
export interface BookingHiddenStop {
  /** Airport code of the hidden stop. */
  airportCode?: string;
  /** Arrival date at the hidden stop. */
  arrivalDate?: string;
  /** Arrival time at the hidden stop. */
  arrivalTime?: string;
  /** Departure date from the hidden stop. */
  departureDate?: string;
  /** Departure time from the hidden stop. */
  departureTime?: string;
  /** Aircraft type code at the hidden stop. */
  aircraftTypeCode?: string;
  /** Aircraft type name at the hidden stop. */
  aircraftTypeName?: string;
}

/** A reference to an identity document by item ID and flight index. */
export interface BookingIdentityDocumentRef {
  /** Document item ID. */
  itemId?: string;
}

/** A flight reference by item ID. Used in fare offers, special services, etc. */
export interface BookingFlightRef {
  /** Flight item ID. */
  itemId: string;
}

/** A journey (grouping of flights for one-way/round-trip/multi-city). */
export interface BookingJourney {
  /** First airport code. */
  firstAirportCode: string;
  /** Departure date. */
  departureDate: string;
  /** Departure time. */
  departureTime: string;
  /** Last airport code. */
  lastAirportCode: string;
  /** Number of flights in this journey. */
  numberOfFlights: number;
}

/** Fare rule with penalty information. */
export interface BookingFareRule {
  /** Origin airport code. */
  originAirportCode?: string;
  /** Destination airport code. */
  destinationAirportCode?: string;
  /** Owning airline code. */
  owningAirlineCode: string;
  /** Passenger type code. */
  passengerCode?: string;
  /** If `true`, the fare is refundable. */
  isRefundable?: boolean;
  /** Refund penalties. */
  refundPenalties?: readonly BookingFareRulePenalty[];
  /** If `true`, the fare is changeable. */
  isChangeable?: boolean;
  /** Exchange/change penalties. */
  exchangePenalties?: readonly BookingFareRulePenalty[];
  /** If `true`, the fare is cancelable. */
  isCancelable?: boolean;
  /** Cancellation penalties. */
  cancelPenalties?: readonly BookingFareRulePenalty[];
}

/** A fare rule penalty. */
export interface BookingFareRulePenalty {
  /** When the penalty applies. */
  applicability: BookingFareRulePenaltyApplicability;
  /** If `true`, conditions apply beyond the stated penalty. */
  conditionsApply: boolean;
  /** Penalty amount. */
  penalty: BookingMonetaryValue;
  /** If `true`, a no-show has additional cost. */
  hasNoShowCost?: boolean;
  /** No-show penalty amount. */
  noShowPenalty?: BookingMonetaryValue;
  /**
   * Source of the penalty rule. Present only for `cancelBooking` ticket
   * penalties (derived from Sabre's `PenaltyItem`).
   */
  source?: BookingPenaltySource;
}

/** A monetary value with amount and currency. */
export interface BookingMonetaryValue {
  /** Amount as a decimal string. */
  amount?: string;
  /** Three-letter ISO 4217 currency code. */
  currencyCode?: string;
}

/** Fare offer with baggage information. */
export interface BookingFareOffer {
  /** Traveler indices this offer applies to. */
  travelerIndices?: readonly number[];
  /** Flight references. */
  flights?: readonly BookingFlightRef[];
  /** Cabin baggage allowance. */
  cabinBaggageAllowance?: BookingBaggageAllowance;
  /** Checked baggage allowance. */
  checkedBaggageAllowance?: BookingBaggageAllowance;
  /** Cabin baggage charges. */
  cabinBaggageCharges?: readonly BookingBaggagePolicy[];
  /** Checked baggage charges. */
  checkedBaggageCharges?: readonly BookingBaggagePolicy[];
}

/** Baggage allowance. */
export interface BookingBaggageAllowance {
  /** Maximum number of pieces. */
  maximumPieces?: number;
  /** Total weight limit in pounds. */
  totalWeightInPounds?: number;
  /** Total weight limit in kilograms. */
  totalWeightInKilograms?: number;
  /** Individual piece policies. */
  baggagePieces?: readonly BookingBaggagePolicy[];
}

/** Baggage piece policy with size/weight limits. */
export interface BookingBaggagePolicy {
  /** Max size in inches (L+W+H). */
  maximumSizeInInches?: number;
  /** Max size in centimeters. */
  maximumSizeInCentimeters?: number;
  /** Max weight in pounds. */
  maximumWeightInPounds?: number;
  /** Max weight in kilograms. */
  maximumWeightInKilograms?: number;
  /** Number of pieces. */
  numberOfPieces: number;
  /** Special item description. */
  specialItemDescription?: string;
  /** If `true`, only allowed at check-in. */
  isCheckInOnly?: boolean;
  /** Fee for this baggage piece. */
  fee?: BookingMonetaryValue;
}

/** A saved fare (price quote or order item). */
export interface BookingFare {
  /** Fare creation details. */
  creationDetails?: BookingFareCreationDetails;
  /** Airline code. */
  airlineCode?: string;
  /** Fare calculation line. */
  fareCalculationLine?: string;
  /** Tour code. */
  tourCode?: string;
  /** If `true`, this is a negotiated fare. */
  isNegotiatedFare?: boolean;
  /** Traveler indices this fare applies to. */
  travelerIndices?: readonly number[];
  /** Commission details. */
  commission?: BookingCommission;
  /** Fare construction with per-component details. */
  fareConstruction?: readonly BookingFareComponent[];
  /** Tax breakdown. */
  taxBreakdown?: readonly BookingTaxComponent[];
  /** Total payment values. */
  totals?: BookingTotalValues;
  /** Bundled services and fees. */
  bundledServicesAndFees?: readonly BookingFareService[];
  /** Original total values before exchange. */
  originalTotalValues?: BookingOriginalTotalValues;
  /** Pricing type code (S=System, A=Amended, M=Manual). */
  pricingTypeCode?: BookingPricingTypeCode;
  /** Pricing type name. */
  pricingTypeName?: BookingPricingTypeName;
  /** Pricing status code (A=Active, H=History). */
  pricingStatusCode?: BookingPricingStatusCode;
  /** Pricing status name. */
  pricingStatusName?: BookingPricingStatusName;
  /** If `true`, the pricing is valid. */
  hasValidPricing: boolean;
  /** Initial selling fare before exchange. */
  initialSellingFare?: BookingInitialSellingFare;
  /** Requested traveler type code. */
  requestedTravelerType?: string;
  /** Priced traveler type code. */
  pricedTravelerType?: string;
  /** Record type code. */
  recordTypeCode?: string;
  /** Record type name. */
  recordTypeName?: string;
  /** Record ID. */
  recordId?: string;
}

/** Fare creation details. */
export interface BookingFareCreationDetails {
  /** Creator user sine. */
  creationUserSine?: string;
  /** Creation date. */
  creationDate?: string;
  /** Creation time. */
  creationTime?: string;
  /** Purchase deadline date. */
  purchaseDeadlineDate?: string;
  /** Purchase deadline time. */
  purchaseDeadlineTime?: string;
  /** Agency IATA number. */
  agencyIataNumber?: string;
  /** User work PCC. */
  userWorkPcc?: string;
  /** User home PCC. */
  userHomePcc?: string;
  /** Prime host ID. */
  primeHostId?: string;
}

/** Commission details. */
export interface BookingCommission {
  /** Commission amount. */
  commissionAmount?: string;
  /** Currency code. */
  currencyCode?: string;
  /** Commission percentage. */
  commissionPercentage?: string;
}

/** A fare component (per-segment pricing). */
export interface BookingFareComponent {
  /** Flight references. */
  flights?: readonly BookingFlightRef[];
  /** Flight indices. */
  flightIndices?: readonly number[];
  /** Fare basis code. */
  fareBasisCode?: string;
  /** Base rate. */
  baseRate?: BookingMonetaryValue;
  /** Brand fare code. */
  brandFareCode?: string;
  /** Brand fare name. */
  brandFareName?: string;
  /** Brand program code. */
  brandProgramCode?: string;
  /** Brand program name. */
  brandProgramName?: string;
  /** Brand attributes. */
  brandAttributes?: readonly BookingBrandAttribute[];
  /** If `true`, this is the current itinerary component. */
  isCurrentItinerary?: boolean;
  /** Checked baggage allowance for this fare component. */
  checkedBaggageAllowance?: BookingBaggageAllowance;
  /** Account code for negotiated fares. */
  accountCode?: string;
}

/** A brand attribute (e.g., seat selection included). */
export interface BookingBrandAttribute {
  /** Attribute code. */
  code?: string;
  /** Attribute description. */
  description?: string;
  /** Attribute classification. */
  classification?: string;
}

/** A tax component in the fare. */
export interface BookingTaxComponent {
  /** Tax code. */
  taxCode?: string;
  /** Tax amount. */
  taxAmount?: BookingMonetaryValue;
  /** If `true`, the tax has been paid. */
  isPaid?: boolean;
}

/**
 * Total payment values: subtotal, taxes, fees, total.
 *
 * Extends {@link BookingGenericTotalValues} with fees and net remit.
 */
export interface BookingTotalValues {
  /** Subtotal (base fare). */
  subtotal?: string;
  /** Total taxes. */
  taxes?: string;
  /** Total amount. */
  total: string;
  /** Three-letter ISO 4217 currency code. */
  currencyCode: string;
  /** Total fees. */
  fees?: string;
  /** Net remit amount. */
  netRemit?: string;
}

/** Generic total values without fees. */
export interface BookingGenericTotalValues {
  /** Subtotal. */
  subtotal?: string;
  /** Taxes. */
  taxes?: string;
  /** Total. */
  total: string;
  /** Currency code. */
  currencyCode: string;
}

/** A bundled service or fee in a fare. */
export interface BookingFareService {
  /** Service type. */
  type?: string;
  /** Service code. */
  code?: string;
  /** Quantity. */
  quantity: number;
  /** Amount. */
  amount?: string;
  /** Currency code. */
  currencyCode?: string;
  /** Description. */
  description?: string;
}

/** Original total values before exchange. */
export interface BookingOriginalTotalValues {
  /** Original total. */
  total?: string;
  /** Original currency code. */
  currencyCode?: string;
}

/** Initial selling fare (before exchange). */
export interface BookingInitialSellingFare {
  /** Total values. */
  totals?: BookingGenericTotalValues;
  /** Fare difference breakdown. */
  fareDifferenceBreakdown?: BookingFareDifferenceBreakdown;
}

/** Fare difference breakdown for exchanges. */
export interface BookingFareDifferenceBreakdown {
  /** Fare difference amount. */
  fareDifference?: BookingMonetaryValue;
  /** Tax difference amount. */
  taxDifference?: BookingMonetaryValue;
}

/** A remark in the booking response. */
export interface BookingRemark {
  /** Remark type. */
  type?: BookingRemarkType;
  /** Alpha code for ALPHA_CODED type. */
  alphaCode?: string;
  /** Remark text. */
  text?: string;
}

/** A hotel reservation in the booking response. */
export interface BookingHotel {
  /** Hotel item ID. */
  itemId: string;
  /** Confirmation number. */
  confirmationId?: string;
  /** Hotel name. */
  hotelName: string;
  /** Hotel address. */
  address: BookingHotelAddress;
  /** Check-in date. */
  checkInDate: string;
  /** Check-in time. */
  checkInTime: string;
  /** Check-out date. */
  checkOutDate: string;
  /** Check-out time. */
  checkOutTime: string;
  /** Corporate discount code. */
  corporateDiscountCode?: number;
  /** Lead traveler index. */
  leadTravelerIndex?: number;
  /** Room details. */
  room?: BookingRoom;
  /** If `true`, the reservation is refundable. */
  isRefundable: boolean;
  /** Refund penalties. */
  refundPenalties?: readonly BookingHotelRefundPenalty[];
  /** Refund penalty policy code. */
  refundPenaltyPolicyCode?: string;
  /** Hotel status code. */
  hotelStatusCode?: string;
  /** Hotel status name. */
  hotelStatusName?: BookingStatusName;
  /** Hotel chain code. */
  chainCode?: string;
  /** Hotel chain name. */
  chainName?: string;
  /** Property ID. */
  propertyId?: string;
  /** Sabre property ID. */
  sabrePropertyId?: string;
  /** Hotel contact information. */
  contactInfo?: BookingContactInfo;
  /** Special instructions. */
  specialInstructions?: string;
  /** Guarantee type code. */
  guaranteeTypeCode?: number;
  /** Guarantee type name. */
  guaranteeTypeName?: BookingGuaranteeTypeName;
  /** Guarantee payment note. */
  guaranteePaymentNote?: string;
  /** Payment policy. */
  paymentPolicy?: BookingHotelPaymentPolicy;
  /** Payment totals. */
  payment?: BookingTotalValues;
  /** Number of guests. */
  numberOfGuests?: number;
  /** Associated flight details. */
  associatedFlightDetails?: BookingAssociatedFlightDetails;
  /** Source type code. */
  sourceTypeCode?: number;
  /** Source type name. */
  sourceTypeName?: BookingHotelSource;
}

/** Hotel address. */
export interface BookingHotelAddress {
  /** Street. */
  street?: string;
  /** City. */
  cityName?: string;
  /** State or province. */
  stateProvince?: string;
  /** Country code. */
  countryCode?: string;
  /** Postal code. */
  postalCode?: string;
  /** Phone number. */
  phone?: string;
  /** Fax number. */
  fax?: string;
}

/** Room details in a hotel booking. */
export interface BookingRoom {
  /** Room type code. */
  roomTypeCode?: string;
  /** Room type name/description. */
  roomTypeName?: string;
  /** Number of rooms. */
  numberOfRooms?: number;
  /** Bed type code. */
  bedTypeCode?: string;
  /** Bed type name. */
  bedTypeName?: string;
}

/** Hotel refund penalty (date-range based). */
export interface BookingHotelRefundPenalty {
  /** Start date of the penalty period. */
  startDate?: string;
  /** End date of the penalty period. */
  endDate?: string;
  /** Penalty amount. */
  penalty?: BookingMonetaryValue;
}

/** Associated flight details for hotel/car. */
export interface BookingAssociatedFlightDetails {
  /** Arrival airline code. */
  arrivalAirlineCode?: string;
  /** Arrival flight number. */
  arrivalFlightNumber?: number;
  /** Arrival time in `HH:MM` format. */
  arrivalTime?: string;
  /** Departure airline code. */
  departureAirlineCode?: string;
  /** Departure flight number. */
  departureFlightNumber?: number;
  /** Departure time in `HH:MM` format. */
  departureTime?: string;
}

/** A car rental in the booking response. */
export interface BookingCar {
  /** Car item ID. */
  itemId: string;
  /** Confirmation number. */
  confirmationId?: string;
  /** Traveler index. */
  travelerIndex?: number;
  /** Vendor name. */
  vendorName: string;
  /** Vendor code. */
  vendorCode: string;
  /** Pick-up location code. */
  pickUpLocationCode?: string;
  /** Pick-up address. */
  pickUpAddress: BookingNamedAddress;
  /** Pick-up date. */
  pickUpDate: string;
  /** Pick-up time. */
  pickUpTime: string;
  /** Pick-up contact info. */
  pickUpContactInfo?: BookingContactInfo;
  /** Drop-off location code. */
  dropOffLocationCode?: string;
  /** Drop-off address. */
  dropOffAddress?: BookingNamedAddress;
  /** Drop-off date. */
  dropOffDate: string;
  /** Drop-off time. */
  dropOffTime: string;
  /** Drop-off contact info. */
  dropOffContactInfo?: BookingContactInfo;
  /** Custom collection address. */
  collectionAddress?: BookingAddress;
  /** Custom collection site. */
  collectionSite?: BookingCarRentalSite;
  /** Custom delivery address. */
  deliveryAddress?: BookingAddress;
  /** Custom delivery site. */
  deliverySite?: BookingCarRentalSite;
  /** If `true`, the rental is refundable. */
  isRefundable: boolean;
  /** Refund penalties. */
  refundPenalties?: readonly BookingCarRefundPenalty[];
  /** Car status code. */
  carStatusCode?: string;
  /** Car status name. */
  carStatusName?: BookingStatusName;
  /** Vehicle type code. */
  vehicleTypeCode?: string;
  /** Vehicle type name. */
  vehicleTypeName?: BookingVehicleTypeName;
  /** Number of vehicles. */
  numberOfVehicles?: number;
  /** Rate code. */
  rateCode?: string;
  /** Distance allowance description. */
  distanceAllowance?: string;
  /** Guarantee payment note. */
  guaranteePaymentNote?: string;
  /** Special instructions. */
  specialInstructions?: string;
  /** Payment totals. */
  payment?: BookingTotalValues;
  /** Guarantee payment type. */
  guaranteePaymentType?: BookingGuaranteePaymentType;
}

/** Car rental site. */
export interface BookingCarRentalSite {
  /** Site name. */
  name?: string;
  /** Site ID. */
  id?: string;
}

/** Car rental refund penalty (date-range based). */
export interface BookingCarRefundPenalty {
  /** Start date. */
  startDate?: string;
  /** End date. */
  endDate?: string;
  /** Penalty amount. */
  penalty?: BookingMonetaryValue;
}

/** A train reservation in the booking response. */
export interface BookingTrain {
  /** Train item ID. */
  itemId: string;
  /** Confirmation number. */
  confirmationId?: string;
  /** Train number. */
  trainNumber: string;
  /** Train name. */
  trainName?: string;
  /** Vendor code. */
  vendorCode: string;
  /** Vendor name. */
  vendorName?: string;
  /** Operating vendor code. */
  operatingVendorCode?: string;
  /** Operating vendor name. */
  operatingVendorName?: string;
  /** Departure station code. */
  fromStationCode: string;
  /** Departure station name. */
  fromStationName?: string;
  /** Arrival station code. */
  toStationCode: string;
  /** Arrival station name. */
  toStationName?: string;
  /** Departure date. */
  departureDate: string;
  /** Departure time. */
  departureTime: string;
  /** Arrival date. */
  arrivalDate: string;
  /** Arrival time. */
  arrivalTime: string;
  /** If `true`, refundable. */
  isRefundable?: boolean;
  /** Train status code. */
  trainStatusCode?: string;
  /** Train status name. */
  trainStatusName?: BookingStatusName;
  /** Payment totals. */
  payment?: BookingTotalValues;
}

/** A cruise reservation in the booking response. */
export interface BookingCruise {
  /** Cruise item ID. */
  itemId: string;
  /** Confirmation number. */
  confirmationId?: string;
  /** Vendor code. */
  vendorCode: string;
  /** Ship code. */
  shipCode?: string;
  /** Ship name. */
  shipName?: string;
  /** Departure port code. */
  fromPortCode: string;
  /** Arrival port code. */
  toPortCode?: string;
  /** Departure date. */
  departureDate: string;
  /** Departure time. */
  departureTime?: string;
  /** Arrival date. */
  arrivalDate: string;
  /** Arrival time. */
  arrivalTime?: string;
  /** Number of guests. */
  numberOfGuests?: number;
  /** Cabin number. */
  cabinNumber?: string;
  /** Cruise status code. */
  cruiseStatusCode?: string;
  /** Cruise status name. */
  cruiseStatusName?: BookingStatusName;
}

/** A generic segment in the booking response. */
export interface BookingSegment {
  /** Segment ID. */
  id: string;
  /** Segment type. */
  type: string;
  /** Segment text. */
  text?: string;
  /** Vendor code. */
  vendorCode?: string;
  /** Date. */
  date?: string;
  /** Time. */
  time?: string;
  /** Location code. */
  locationCode?: string;
  /** Address. */
  address?: BookingNamedAddress;
  /** Start date. */
  startDate?: string;
  /** Start time. */
  startTime?: string;
  /** Start location code. */
  startLocationCode?: string;
  /** Start address. */
  startAddress?: BookingNamedAddress;
  /** End date. */
  endDate?: string;
  /** End time. */
  endTime?: string;
  /** End location code. */
  endLocationCode?: string;
  /** End address. */
  endAddress?: BookingNamedAddress;
}

/** An electronic flight ticket. */
export interface BookingFlightTicket {
  /** Ticket number. */
  number: string;
  /** Ticket issue date. */
  date: string;
  /** Agency IATA number. */
  agencyIataNumber?: string;
  /** Airline code. */
  airlineCode: string;
  /** Traveler index (1-based). */
  travelerIndex: number;
  /** Flight coupons with status. */
  flightCoupons: readonly BookingFlightCoupon[];
  /** All coupons (including non-flight). */
  allCoupons?: readonly BookingTicketCoupon[];
  /** Payment totals for this ticket. */
  payment: BookingTotalValues;
  /** If `true`, this is a bundled ticket. */
  isBundledTicket?: boolean;
  /** Ticket status name. */
  ticketStatusName?: BookingTicketStatus;
  /** Ticket status code. */
  ticketStatusCode?: string;
  /** Ticketing PCC. */
  ticketingPcc?: string;
  /** Commission details. */
  commission?: BookingCommission;
}

/** A flight coupon on a ticket (references a flight by itemId). */
export interface BookingFlightCoupon {
  /** Flight item ID. */
  itemId: string;
  /** Coupon status name. */
  couponStatus: BookingCouponStatus;
  /** Coupon status code. */
  couponStatusCode: BookingCouponStatusCode;
}

/** A generic ticket coupon. */
export interface BookingTicketCoupon {
  /** Coupon item ID. */
  itemId?: string;
  /** Coupon status name. */
  couponStatus: BookingCouponStatus;
  /** Coupon status code. */
  couponStatusCode: BookingCouponStatusCode;
}

/** Total payments across all product types. */
export interface BookingPayments {
  /** Flight payment totals. */
  flightTotals?: readonly BookingTotalValues[];
  /** Current flight totals. */
  flightCurrentTotals?: readonly BookingTotalValues[];
  /** Hotel payment totals. */
  hotelTotals?: readonly BookingTotalValues[];
  /** Car payment totals. */
  carTotals?: readonly BookingTotalValues[];
  /** Train payment totals. */
  trainTotals?: readonly BookingTotalValues[];
  /** Forms of payment used. */
  formsOfPayment?: readonly BookingFormOfPayment[];
  /** Ancillary payment totals. */
  ancillaryTotals?: readonly BookingGenericTotalValues[];
}

/** A form of payment in the booking response. */
export interface BookingFormOfPayment {
  /** Payment method type. */
  type: BookingFormOfPaymentType;
  /** Card type code. */
  cardTypeCode?: string;
  /** Card number (may be masked). */
  cardNumber?: string;
  /** Card security code. */
  cardSecurityCode?: string;
  /** Expiry date in `YYYY-MM` format. */
  expiryDate?: string;
  /** Extended payment months. */
  extendedPayment?: number;
  /** Miscellaneous credit code. */
  miscellaneousCreditCode?: string;
  /** Number of installments. */
  numberOfInstallments?: number;
  /** Airline plan code. */
  airlinePlanCode?: string;
  /** First installment amount. */
  installmentAmount?: string;
  /** Card holder. */
  cardHolder?: BookingCardHolder;
  /** Virtual card details. */
  virtualCard?: BookingVirtualCard;
  /** Agency IATA number. */
  agencyIataNumber?: string;
  /** Agency address. */
  agencyAddress?: BookingNamedAddress;
  /** Corporate ID. */
  corporateId?: string;
  /** Company address. */
  companyAddress?: BookingNamedAddress;
  /** Voucher. */
  voucher?: BookingVoucher;
  /** Net balance. */
  netBalance?: string;
  /** Docket prefix. */
  docketPrefix?: string;
  /** Docket number. */
  docketNumber?: string;
  /** Docket agent initials. */
  docketIssuingAgentInitials?: string;
  /** Docket description. */
  docketDescription?: string;
  /** GTR description. */
  governmentTravelRequestDescription?: string;
  /** Invoice description. */
  invoiceDescription?: string;
  /** @deprecated Use `useTypes`. */
  useType?: BookingFormOfPaymentUseType;
  /** @deprecated Use `tripTypes`. */
  tripType?: BookingFormOfPaymentTripType;
  /** Use types. */
  useTypes?: readonly BookingFormOfPaymentUseType[];
  /** Trip types. */
  tripTypes?: readonly BookingFormOfPaymentTripType[];
  /** If `true`, card belongs to agency. */
  isAgencyPaymentCard?: boolean;
}

/** Card holder in the response. */
export interface BookingCardHolder {
  /** First name. */
  givenName: string;
  /** Last name. */
  surname: string;
  /** Email. */
  email?: string;
  /** Phone. */
  phone?: string;
  /** Address. */
  address?: BookingAddress;
}

/** Virtual card in the response. */
export interface BookingVirtualCard {
  /** Provider. */
  provider?: string;
  /** Account type. */
  accountType?: string;
}

/** Voucher in the response. */
export interface BookingVoucher {
  /** Voucher number. */
  number?: string;
  /** Voucher type. */
  type?: string;
}

/** A tax entry in the response. */
export interface BookingTaxEntry {
  /** Tax code. */
  taxCode?: string;
  /** Tax amount. */
  taxAmount?: string;
  /** Tax currency code. */
  taxCurrencyCode?: string;
}

/** Other Service Information in the booking response. */
export interface BookingOtherService {
  /** Airline code. */
  airlineCode?: string;
  /** Hotel chain code. */
  chainCode?: string;
  /** Car vendor code. */
  vendorCode?: string;
  /** OSI text. */
  text?: string;
}

/** Future ticketing policy in the response. */
export interface BookingFutureTicketingPolicy {
  /** Ticketing PCC. */
  ticketingPcc?: string;
  /** Queue number. */
  queueNumber?: string;
  /** Ticketing date. */
  ticketingDate?: string;
  /** Ticketing time. */
  ticketingTime?: string;
  /** Comment. */
  comment?: string;
}

/** A special service (SSR) in the booking response. */
export interface BookingSpecialService {
  /** Traveler indices. */
  travelerIndices?: readonly number[];
  /** Associated flights. */
  flights?: readonly BookingFlightRef[];
  /** SSR code. */
  code?: string;
  /** SSR name. */
  name?: string;
  /** SSR message text. */
  message?: string;
  /** Status code. */
  statusCode?: string;
  /** Status name. */
  statusName?: BookingStatusName;
}

/** An accounting item from the booking. ATPCO only. */
export interface BookingAccountingItem {
  /** Fare application type. */
  fareApplicationType?: BookingFareApplicationType;
  /** Form of payment type. */
  formOfPaymentType?: BookingAccountingFormOfPaymentType;
  /** Creation type. */
  creationType?: BookingAccountingItemCreationType;
  /** Airline code. */
  airlineCode?: string;
  /** Ticket number. */
  ticketNumber?: string;
  /** Commission. */
  commission?: BookingCommission;
  /** Fare amount. */
  fareAmount?: string;
  /** Tax amount. */
  taxAmount?: string;
  /** Traveler indices. */
  travelerIndices?: readonly number[];
  /** Tariff basis type. */
  tariffBasisType?: BookingTariffBasisType;
  /** Card number (may be masked). */
  cardNumber?: string;
  /** Card type code. */
  cardTypeCode?: string;
  /** Currency code. */
  currencyCode?: string;
  /** Goods and services tax details. */
  goodsAndServicesTax?: BookingGoodsAndServicesTax;
  /** Invoice number. */
  invoiceNumber?: string;
  /** Free-text. */
  text?: string;
}

/** Goods and services tax. */
export interface BookingGoodsAndServicesTax {
  /** Tax code. */
  code?: string;
  /** Tax amount. */
  amount?: string;
  /** Tax percentage. */
  percentage?: string;
}

/** A non-electronic (paper) ticket. ATPCO only. */
export interface BookingNonElectronicTicket {
  /** Ticket status. */
  ticketStatus?: BookingNonElectronicTicketStatus;
  /** Ticket number. */
  ticketNumber?: string;
  /** Traveler index. */
  travelerIndex?: number;
  /** Ticketing user code. */
  ticketingUserCode?: string;
  /** Ticketing PCC. */
  ticketingPcc?: string;
  /** Issue date. */
  date?: string;
  /** Issue time. */
  time?: string;
}

/** A traveler's employer in the booking response. */
export interface BookingTravelerEmployer {
  /** Employer ID type. */
  idType?: BookingEmployerIdType;
  /** Employer ID. */
  employerId?: string;
  /** Employer name. */
  employerName?: string;
  /** Phone numbers. */
  phones?: readonly BookingPhone[];
  /** Email addresses. */
  emails?: readonly string[];
  /** Street address. */
  street?: string;
  /** City. */
  city?: string;
  /** State or province. */
  stateProvince?: string;
  /** Postal code. */
  postalCode?: string;
  /** Country code. */
  countryCode?: string;
}

/** A profile used in the booking. */
export interface BookingProfile {
  /** Profile type code. */
  profileTypeCode?: string;
  /** Unique profile ID. */
  uniqueId?: string;
  /** Traveler index. */
  travelerIndex?: number;
}

// ---------------------------------------------------------------------------
// getBooking
// ---------------------------------------------------------------------------

/**
 * Identifies a portion of the Get Booking response that should be included.
 *
 * When `GetBookingInput.returnOnly` is supplied, only the listed sections
 * are populated in the response. Useful for reducing payload size and
 * latency when a caller only needs a subset of the booking data.
 */
export type BookingReturnOnly =
  | 'FLIGHTS'
  | 'FLIGHT_PENALTY'
  | 'BAGGAGE_POLICY'
  | 'JOURNEYS'
  | 'HOTELS'
  | 'HOTEL_ADDRESS'
  | 'CARS'
  | 'CAR_RENTAL_ADDRESS'
  | 'CAR_RENTAL_PENALTY'
  | 'TRAINS'
  | 'CRUISES'
  | 'ALL_SEGMENTS'
  | 'TRAVELERS'
  | 'TICKETS'
  | 'PAYMENTS'
  | 'PENALTIES'
  | 'REMARKS'
  | 'IS_CANCELABLE'
  | 'IS_TICKETED'
  | 'CONTACT_INFO'
  | 'OTHER_SERVICES'
  | 'SPECIAL_SERVICES'
  | 'FARES'
  | 'CREATION_DETAILS'
  | 'ANCILLARIES'
  | 'FORMS_OF_PAYMENT'
  | 'RETENTION_DATE'
  | 'ACCOUNTING_ITEMS'
  | 'NON_ELECTRONIC_TICKETS'
  | 'TRAVELERS_EMPLOYERS'
  | 'PROFILES';

/**
 * Additional Get Booking features whose use requires explicit opt-in for
 * backward compatibility. All fields default to Sabre's documented defaults
 * when omitted; these will be folded into a future major version of the API.
 */
export interface GetBookingExtraFeatures {
  /**
   * If `true`, the additional loyalty program type `FREQUENT_RENTER` is
   * supported. Spec default: `false`.
   */
  returnFrequentRenter?: boolean;
  /**
   * If `true`, returns the additional forms of payment `DOCKET`,
   * `GOVERNMENT_TRAVEL_REQUEST`, and `INVOICE`. Spec default: `false`.
   */
  returnWalletFormsOfPayment?: boolean;
  /**
   * If `true`, the additional identity document `FISCAL_ID` is supported.
   * Spec default: `false`.
   */
  returnFiscalId?: boolean;
  /**
   * If `true`, a lack of seat assignation to the corresponding traveler
   * is marked as an empty `Seat` object. If `false`, empty objects are
   * replaced with `null` values. Applies to NDC content only. Spec
   * default: `true`.
   */
  returnEmptySeatObjects?: boolean;
}

/**
 * Input for the `getBooking` operation.
 *
 * `confirmationId` is required; everything else narrows or tunes the
 * response.
 */
export interface GetBookingInput {
  /**
   * The booking reference ID as shown in the source supplier/vendor
   * system. For `SABRE`, this is the PNR Locator value. 6+ uppercase
   * alphanumeric characters.
   */
  confirmationId: string;

  /**
   * Source of the booking. Defaults to `SABRE` when omitted.
   */
  bookingSource?: BookingSource;

  /**
   * The pseudo city code of the target destination in which the booking
   * retrieval is requested. 3–4 uppercase alphanumeric characters.
   */
  targetPcc?: string;

  /** The traveler's first name. */
  givenName?: string;

  /** The middle name or initial of the traveler. */
  middleName?: string;

  /** The traveler's last name. */
  surname?: string;

  /**
   * Restrict the response to the listed sections only. If omitted or
   * empty, the full structure is returned. Using this option can
   * significantly improve response time by skipping downstream calls.
   */
  returnOnly?: readonly BookingReturnOnly[];

  /**
   * Additional features to enable on the response. See
   * {@link GetBookingExtraFeatures} for per-field defaults.
   */
  extraFeatures?: GetBookingExtraFeatures;

  /**
   * If `true`, payment card numbers stored in the booking are returned
   * unmasked. Requires the Employee Profile Record (EPR) to include the
   * `CCVIEW` keyword.
   */
  unmaskPaymentCardNumbers?: boolean;
}

/**
 * Output of the `getBooking` operation.
 *
 * Extends {@link Booking} with response-level metadata. All booking
 * fields are optional because their presence depends on the booking's
 * contents and the `returnOnly` filter in the request.
 */
export interface GetBookingOutput extends Booking {
  /**
   * Response timestamp, UTC. Nominal format `YYYY-MM-DDTHH:MM:SSZ`,
   * but cert has been observed to return the value without the
   * trailing `Z` (e.g. `2026-04-22T21:16:58`). Treat the timezone as
   * UTC regardless.
   */
  timestamp?: string;

  /**
   * Unique ID of the Get Booking response. Used to verify the booking
   * state during subsequent modification. Available only when retrieval
   * did not produce any errors.
   */
  bookingSignature?: string;

  /**
   * Echo of the request that produced this response. Useful for tracing
   * and debugging.
   */
  request?: GetBookingInput;

  /**
   * Errors Sabre returned alongside this response. Sabre uses
   * `errors[]` for both hard failures and benign entries (warnings,
   * informational) on 200-OK responses — see
   * `assertBookingSucceeded` for the opt-in helper that throws on
   * hard failures.
   */
  errors?: readonly BookingError[];
}

// ---------------------------------------------------------------------------
// modifyBooking — input / output and sub-types
// ---------------------------------------------------------------------------

/**
 * Additional Modify Booking features whose use requires explicit opt-in for
 * backward compatibility. Defaults follow Sabre's documented defaults when
 * the field is omitted; these will be folded into a future major version.
 */
export interface ModifyBookingExtraFeatures {
  /**
   * If `true`, the additional loyalty program type `FREQUENT_RENTER` is
   * supported. Spec default: `false`.
   */
  returnFrequentRenter?: boolean;
  /**
   * If `true`, returns the additional forms of payment `DOCKET`,
   * `GOVERNMENT_TRAVEL_REQUEST`, and `INVOICE`. Spec default: `false`.
   */
  returnWalletFormsOfPayment?: boolean;
  /**
   * If `true`, the additional identity document `FISCAL_ID` is supported.
   * Spec default: `false`.
   */
  returnFiscalId?: boolean;
}

/**
 * Input for the `modifyBooking` operation.
 *
 * The API diffs `before` and `after` and performs the appropriate add,
 * update, or delete operations on the booking. `before` should reflect
 * the current state (typically as returned by `getBooking`); `after`
 * reflects the target state. `bookingSignature` is the value returned by
 * the preceding `getBooking` call and is used to verify that the booking
 * has not changed since.
 */
export interface ModifyBookingInput {
  /**
   * The booking reference ID as shown in the source supplier/vendor
   * system. For `SABRE`, this is the PNR Locator value. 6+ uppercase
   * alphanumeric characters.
   */
  confirmationId: string;

  /**
   * The unique identifier of a booking, obtained via `getBooking`. Used
   * to verify the state of the booking prior to a modification operation.
   */
  bookingSignature: string;

  /** Original booking details, prior to modification. */
  before: BookingToModify;

  /** Target booking details after the modification has been applied. */
  after: BookingToModify;

  /** Source of the booking. Defaults to `SABRE` when omitted. */
  bookingSource?: BookingSource;

  /**
   * If `true`, the response includes the current state of the booking.
   * Spec default: `false`.
   */
  retrieveBooking?: boolean;

  /**
   * The entity authorizing the changes in the booking. Defaults to
   * `'Modify Booking'` when omitted.
   */
  receivedFrom?: string;

  /**
   * Pseudo city code for the target location. The API does not revert
   * context after completing the modification. 3–4 alphanumeric
   * characters.
   */
  targetPcc?: string;

  /**
   * If `true`, unmasks payment card information during the
   * `bookingSignature` verification step. Requires the Employee Profile
   * Record (EPR) to include the `CCVIEW` keyword.
   */
  unmaskPaymentCardNumbers?: boolean;

  /**
   * Additional features to enable on the response. See
   * {@link ModifyBookingExtraFeatures} for per-field defaults.
   */
  extraFeatures?: ModifyBookingExtraFeatures;
}

/**
 * Output of the `modifyBooking` operation.
 *
 * `booking` is populated only when the request was made with
 * `retrieveBooking: true` (or when Sabre otherwise returns booking
 * contents for this modification).
 */
export interface ModifyBookingOutput {
  /**
   * Response timestamp, UTC. Nominal format `YYYY-MM-DDTHH:MM:SSZ`,
   * but cert has been observed to return the value without the
   * trailing `Z` (e.g. `2026-04-22T21:16:58`). Treat the timezone as
   * UTC regardless.
   */
  timestamp?: string;

  /**
   * Current booking state. Present when `retrieveBooking` was `true`
   * in the request.
   */
  booking?: Booking;

  /**
   * Echo of the request that produced this response. Useful for tracing
   * and debugging.
   */
  request?: ModifyBookingInput;

  /**
   * Errors Sabre returned alongside this response. Sabre uses
   * `errors[]` for both hard failures and benign entries (warnings,
   * informational) on 200-OK responses — see
   * `assertBookingSucceeded` for the opt-in helper that throws on
   * hard failures.
   */
  errors?: readonly BookingError[];
}

/**
 * A snapshot of booking contents used in the `before` or `after` fields
 * of a {@link ModifyBookingInput}. All fields are optional — supply
 * only the sections that participate in the modification.
 */
export interface BookingToModify {
  /** Agency customer/DK number. */
  agencyCustomerNumber?: string;
  /** Booking creation details. */
  creationDetails?: CreationDetailsToModify;
  /** Flights associated with the booking. */
  flights?: readonly FlightToModify[];
  /**
   * Remarks stored in the booking. The `FORM_OF_PAYMENT` remark type is
   * handled automatically by Sabre and should not be set manually.
   */
  remarks?: readonly RemarkToModify[];
  /** Hotels associated with the booking. */
  hotels?: readonly HotelToModify[];
  /** Payment information. */
  payments?: PaymentToModify;
  /** Special service requests (SSRs). */
  specialServices?: readonly SpecialServiceToModify[];
  /** Travelers in the booking. */
  travelers?: readonly TravelerToModify[];
  /**
   * Retention date to keep the booking active past the last itinerary
   * item. After this date the booking is set for purging. Format:
   * `YYYY-MM-DD`.
   */
  retentionEndDate?: string;
  /** Label associated with the retention date. */
  retentionLabel?: string;
  /** Other Service Information (OSI) messages. */
  otherServices?: readonly OtherServiceToModify[];
  /** Saved fares. */
  fares?: readonly FareToModify[];
}

/** Creation details that can be modified. */
export interface CreationDetailsToModify {
  /** IATA-accredited agency number (7 or 8 digits). */
  agencyIataNumber?: string;
}

/** A flight to modify. Identifies seats to assign or change. */
export interface FlightToModify {
  /**
   * Seats assigned to the travelers. The array index matches the
   * traveler index in the `travelers` array. A `null` entry indicates
   * no seat for the corresponding traveler — to produce such entries
   * from `getBooking`, set `extraFeatures.returnEmptySeatObjects` to
   * `false`. Combined with `changeOfGaugeSeats`, this array represents
   * seats on the first aircraft of a change-of-gauge or funnel flight.
   */
  seats?: readonly (SeatToModify | null)[];
  /**
   * Seats for the departing aircraft on a change-of-gauge or funnel
   * flight. Indexed the same way as `seats`.
   */
  changeOfGaugeSeats?: readonly (SeatToModify | null)[];
}

/** A seat assignment to modify. */
export interface SeatToModify {
  /** Assigned seat number (e.g., `'13A'`). */
  number: string;
  /** NDC seat availability offer item ID. */
  offerItemId?: string;
}

/**
 * A hotel reservation to modify, referenced by `itemId`. Retain the
 * values of required fields (`room`, `numberOfGuests`,
 * `leadTravelerIndex`, `paymentPolicy`) from the source booking; supply
 * `bookingKey` only when changing room type, guest count, or a date
 * outside the original range.
 */
export interface HotelToModify {
  /** The ID of the hotel reservation. Uppercase alphanumeric. */
  itemId: string;
  /**
   * Booking key from the Hotel Price Check API. Required when
   * modifying room type, guest count, or check-in/check-out dates
   * outside the original range. 1–240 characters.
   */
  bookingKey?: string;
  /** Check-in date in the hotel's local time zone. `YYYY-MM-DD`. */
  checkInDate?: string;
  /** Check-out date in the hotel's local time zone. `YYYY-MM-DD`. */
  checkOutDate?: string;
  /** Corporate discount code (usually tied to a negotiated rate). */
  corporateDiscountCode?: number;
  /**
   * Index (1-based) of the lead traveler in the `travelers` array.
   * Required when modifying the hotel.
   */
  leadTravelerIndex: number;
  /** Room details. Required when modifying the hotel. */
  room: RoomToModify;
  /** Special instructions for the property. */
  specialInstructions?: string;
  /** Number of guests. Required when modifying the hotel. */
  numberOfGuests: number;
  /** Flight details associated with the hotel booking. */
  associatedFlightDetails?: AssociatedFlightDetailsToModify;
  /**
   * Payment policy. Required when modifying the hotel.
   * Applicable forms: `PAYMENTCARD`, `AGENCY_NAME`, `AGENCY_IATA`,
   * `CORPORATE`, `COMPANY_NAME`, `VIRTUAL_CARD`.
   */
  paymentPolicy: BookHotelPaymentPolicy;
  /** Index (1-based) of the payment type in `payments.formsOfPayment`. */
  formOfPaymentIndex?: number;
}

/** A hotel room to modify. */
export interface RoomToModify {
  /** Inventory block code returned by the hotel supplier. */
  productCode?: string;
  /** Indices (1-based) of travelers assigned to the room. 1+ items. */
  travelerIndices: readonly number[];
}

/** Flight details associated with a hotel or car booking to modify. */
export interface AssociatedFlightDetailsToModify {
  /** Arrival airline code. */
  arrivalAirlineCode?: string;
  /** Arrival flight number. */
  arrivalFlightNumber?: number;
  /** Arrival time in `HH:MM`. */
  arrivalTime?: string;
  /** Departure airline code. */
  departureAirlineCode?: string;
  /** Departure flight number. */
  departureFlightNumber?: number;
  /** Departure time in `HH:MM`. */
  departureTime?: string;
}

/** Payment information to modify. */
export interface PaymentToModify {
  /**
   * Forms of payment associated with the booking. 1–10 items. Uses
   * the same shape as {@link BookFormOfPayment}.
   */
  formsOfPayment?: readonly BookFormOfPayment[];
}

/**
 * A special service request (SSR) to modify. `code` is required; use
 * `travelerIndices` and `flights` to narrow the scope of the SSR.
 */
export interface SpecialServiceToModify {
  /** Four-letter SSR code (e.g., `'WCHR'`). */
  code: string;
  /** Indices (1-based) of associated travelers. */
  travelerIndices?: readonly number[];
  /** Flights referenced by `itemId`. */
  flights?: readonly FlightReferenceToModify[];
  /** Free-text SSR detail (e.g., `'/PREPAID'`). */
  message?: string;
}

/** A flight reference, used by SSRs and identity documents. */
export interface FlightReferenceToModify {
  /** The `itemId` of a flight as returned by `getBooking`. */
  itemId: string;
}

/** A traveler to modify. All fields are optional for partial updates. */
export interface TravelerToModify {
  /** Traveler's first name. */
  givenName?: string;
  /** Traveler's middle name (NDC content only). */
  middleName?: string;
  /** Traveler's last name. */
  surname?: string;
  /** Traveler's birth date in `YYYY-MM-DD` format. */
  birthDate?: string;
  /** Passenger type code (e.g., `'ADT'`, `'CNN'`). */
  passengerCode?: string;
  /** Optional identifier used for accounting (MAN number). */
  nameReferenceCode?: string;
  /** If `true`, the traveler is associated with a group booking. */
  isGrouped?: boolean;
  /** Email addresses. */
  emails?: readonly string[];
  /** Phone numbers. */
  phones?: readonly BookPhone[];
  /** Remarks associated with this traveler. */
  remarks?: readonly RemarkToModify[];
  /** Identity documents applicable to the traveler. */
  identityDocuments?: readonly IdentityDocumentToModify[];
  /** Loyalty programs the traveler participates in. */
  loyaltyPrograms?: readonly BookLoyaltyProgram[];
  /** Ancillaries to be added or deleted. */
  ancillaries?: readonly AncillaryToModify[];
}

/**
 * An identity document to modify. `documentType` is required per the
 * spec; all other fields are optional for partial updates.
 */
export interface IdentityDocumentToModify {
  /** Document type (passport, visa, etc.). */
  documentType: BookDocumentType;
  /** Document number. Alphanumeric. */
  documentNumber?: string;
  /** Document expiry date in `YYYY-MM-DD` format. */
  expiryDate?: string;
  /** Issuing country code (2–3 letter ISO 3166). */
  issuingCountryCode?: string;
  /** Residence country code (2–3 letter ISO 3166). */
  residenceCountryCode?: string;
  /** Place of issue (ISO 3166 code or place name). */
  placeOfIssue?: string;
  /** Place of birth. */
  placeOfBirth?: string;
  /** Host country code for visas. */
  hostCountryCode?: string;
  /** Issue date in `YYYY-MM-DD` format. */
  issueDate?: string;
  /** First name on the document. */
  givenName?: string;
  /** Middle name on the document. */
  middleName?: string;
  /** Surname on the document. */
  surname?: string;
  /** Birth date on the document in `YYYY-MM-DD` format. */
  birthDate?: string;
  /** Gender on the document. */
  gender?: BookGender;
  /** If `true`, this document belongs to the primary holder. */
  isPrimaryDocumentHolder?: boolean;
  /** Flights this document is associated with. */
  flights?: readonly FlightReferenceToModify[];
}

/** An ancillary to add or delete during modification. */
export interface AncillaryToModify {
  /** Existing ancillary item ID (required to reference an ancillary for deletion). */
  itemId?: string;
  /** NDC offer item ID (for NDC content). */
  offerId?: string;
  /** Free-text description of the ancillary (NDC content only). */
  description?: string;
  /** Commercial name of the ancillary (ATPCO only). */
  commercialName?: string;
  /** Quantity to book (ATPCO only). */
  numberOfItems?: number;
  /** Issuance subcode (RFISC); e.g., `'05Z'`. ATPCO only. */
  subcode?: string;
  /** Two-letter airline code owning the service. ATPCO only. */
  airlineCode?: string;
  /** Two-letter airline code providing the service. ATPCO only. */
  vendorCode?: string;
  /** Ancillary source. ATPCO only. */
  source?: BookAncillarySource;
  /** Tax entries. 1–99 items. ATPCO only. */
  taxes?: readonly BookTax[];
  /** First valid travel date in `YYYY-MM-DD`. */
  firstTravelDate?: string;
  /** Last valid travel date in `YYYY-MM-DD`. */
  lastTravelDate?: string;
  /** Latest allowed purchase datetime in ISO 8601. */
  purchaseDateTime?: string;
  /** Two-letter IATA group code (e.g., `'BG'`). ATPCO only. */
  groupCode?: string;
  /** Flights associated with the ancillary. */
  flights?: readonly FlightReferenceToModify[];
  /** EMD or document type. */
  electronicMiscellaneousDocumentType?: BookElectronicMiscellaneousDocumentType;
  /** Reason For Issuance Code (RFIC). */
  reasonForIssuanceCode?: string;
  /** Reason For Issuance enumeration. */
  reasonForIssuanceName?: BookReasonForIssuance;
}

/** A remark to modify. */
export interface RemarkToModify {
  /** Remark type. */
  type?: BookRemarkType;
  /** Single-letter code for `ALPHA_CODED` remarks. */
  alphaCode?: string;
  /** Remark text. */
  text?: string;
}

/** Other Service Information (OSI) to modify. */
export interface OtherServiceToModify {
  /** Two-letter IATA airline code. */
  airlineCode?: string;
  /** Index (1-based) of the associated traveler. */
  travelerIndex?: number;
  /** Text of the OSI message. */
  serviceMessage?: string;
}

/** A saved fare to modify, referenced by its source record ID. */
export interface FareToModify {
  /** Fare source record ID. Uppercase alphanumeric. */
  recordId?: string;
}

// ---------------------------------------------------------------------------
// cancelBooking enums
// ---------------------------------------------------------------------------

/**
 * Flight ticket operations that can be bundled with a cancellation
 * request. `VOID` voids associated tickets; `REFUND` refunds them.
 */
export type CancelFlightTicketOperation = 'VOID' | 'REFUND';

/**
 * Error handling policy for the `cancelBooking` service. Spec default
 * is `HALT_ON_ERROR`.
 */
export type CancelErrorPolicy = 'HALT_ON_ERROR' | 'ALLOW_PARTIAL_CANCEL';

/**
 * Type(s) of electronic documents to refund when `flightTicketOperation`
 * is `REFUND`. Spec default is `Tickets`.
 */
export type CancelDocumentsType = 'Tickets' | 'EMDs' | 'Tickets and EMDs';

// ---------------------------------------------------------------------------
// cancelBooking input helper types
// ---------------------------------------------------------------------------

/** Reference to a flight item by its booking `itemId`. */
export interface FlightReference {
  /** The ID of the flight. Uppercase alphanumeric. */
  itemId: string;
}

/** Reference to a hotel reservation by its booking `itemId`. */
export interface HotelReference {
  /** The ID of the hotel reservation. Uppercase alphanumeric. */
  itemId: string;
}

/** Reference to a car reservation by its booking `itemId`. */
export interface CarReference {
  /** The ID of the car reservation. Uppercase alphanumeric. */
  itemId: string;
}

/** Reference to a train reservation by its booking `itemId`. */
export interface TrainReference {
  /** The ID of the train reservation. Uppercase alphanumeric. */
  itemId: string;
}

/** Reference to a cruise reservation by its booking `itemId`. */
export interface CruiseReference {
  /** The ID of the cruise reservation. Uppercase alphanumeric. */
  itemId: string;
}

/**
 * Reference to a booking segment for cancellation. Identified either by
 * `sequence` or by `id`; supply one of the two.
 */
export interface SegmentReference {
  /** Segment sequence number within the booking. */
  sequence?: number;
  /** Unique segment item ID. Uppercase alphanumeric. */
  id?: string;
}

/** Hardcopy printer details used when designating printers. */
export interface PrinterHardcopy {
  /** Hardcopy printer LNIATA. 6 uppercase alphanumeric characters. */
  address?: string;
  /** Hardcopy printer spacing. `'1'` or `'2'`. */
  spacing?: string;
}

/** Ticket printer details used when designating printers. */
export interface PrinterTicket {
  /** Ticket printer LNIATA. 6 uppercase alphanumeric characters. */
  address?: string;
  /** Two-character ticket stock country code. */
  countryCode?: string;
}

/**
 * Printer or printer profile designation. Provide `profileNumber` for a
 * profile lookup, or the individual printer fields for explicit
 * addressing.
 */
export interface PrinterAddress {
  /** Printer profile number to be designated. */
  profileNumber?: number;
  /** Hardcopy printer designation. */
  hardcopy?: PrinterHardcopy;
  /** Invoice and itinerary printer LNIATA. 6 uppercase alphanumeric. */
  invoiceItinerary?: string;
  /** Ticket printer designation. */
  ticket?: PrinterTicket;
}

// ---------------------------------------------------------------------------
// cancelBooking input/output
// ---------------------------------------------------------------------------

/**
 * Input for the `cancelBooking` operation.
 *
 * `confirmationId` is the only required field. Supply a combination of
 * `cancelAll`, per-type references (`flights`, `hotels`, etc.), or
 * `segments` to scope the cancellation. Use `flightTicketOperation` to
 * optionally void or refund associated tickets in the same call.
 */
export interface CancelBookingInput {
  /**
   * The booking reference ID as shown in the source supplier/vendor
   * system. For `SABRE`, this is the PNR Locator value. 6+ uppercase
   * alphanumeric characters.
   */
  confirmationId: string;
  /** Source of the booking. Defaults to `SABRE` when omitted. */
  bookingSource?: BookingSource;
  /**
   * If `true`, the response includes the current state of the booking.
   * Spec default: `false`.
   */
  retrieveBooking?: boolean;
  /** The entity authorizing the changes in the booking. */
  receivedFrom?: string;
  /** Ticket operation to perform alongside the cancellation. */
  flightTicketOperation?: CancelFlightTicketOperation;
  /**
   * Policy for handling errors. Spec default: `HALT_ON_ERROR`.
   */
  errorHandlingPolicy?: CancelErrorPolicy;
  /**
   * If `true`, cancels segments of all kinds (flights, hotels, cars,
   * trains, cruises, and any other segments) — the per-type reference
   * arrays are ignored. Spec default: `false`.
   */
  cancelAll?: boolean;
  /** Flights to cancel. */
  flights?: readonly FlightReference[];
  /** Hotels to cancel. */
  hotels?: readonly HotelReference[];
  /** Cars to cancel. */
  cars?: readonly CarReference[];
  /** Trains to cancel. */
  trains?: readonly TrainReference[];
  /** Cruises to cancel. */
  cruises?: readonly CruiseReference[];
  /** Generic booking segments to cancel. */
  segments?: readonly SegmentReference[];
  /**
   * Pseudo city code for the target location. Context is not reverted
   * after the cancellation completes. 3–4 alphanumeric characters.
   */
  targetPcc?: string;
  /** Post-operation notification configuration. */
  notification?: BookNotification;
  /** Printers or printer profiles to designate. */
  designatePrinters?: readonly PrinterAddress[];
  /**
   * Offer ID for a void or refund offer obtained from
   * `checkFlightTicketsResponse`. Applicable only for NDC orders.
   */
  offerItemId?: string;
  /**
   * Retention date to keep the booking active past the last itinerary
   * item. After this date the booking is set for purging. Format:
   * `YYYY-MM-DD`.
   */
  retentionEndDate?: string;
  /** Label associated with the retention date. 0–215 characters. */
  retentionLabel?: string;
  /**
   * If `true`, nonelectronic (paper) tickets are included in the void
   * process. Spec default: `false`.
   */
  voidNonElectronicTickets?: boolean;
  /**
   * Type of electronic documents to refund. Applicable when
   * `flightTicketOperation` is `REFUND`. Spec default: `Tickets`.
   */
  refundDocumentsType?: CancelDocumentsType;
}

/**
 * Output of the `cancelBooking` operation.
 *
 * `booking` is populated only when the request was made with
 * `retrieveBooking: true`. `voidedTickets`, `refundedTickets`, and
 * `flightRefunds` are populated based on the ticket operation
 * performed.
 */
export interface CancelBookingOutput {
  /**
   * Response timestamp, UTC. Nominal format `YYYY-MM-DDTHH:MM:SSZ`,
   * but cert has been observed to return the value without the
   * trailing `Z` (e.g. `2026-04-22T21:16:58`). Treat the timezone as
   * UTC regardless.
   */
  timestamp?: string;
  /** Echo of the request that produced this response. */
  request?: CancelBookingInput;
  /**
   * Current booking state. Present when `retrieveBooking` was `true`
   * in the request.
   */
  booking?: Booking;
  /**
   * Per-ticket cancellation eligibility and refundable amounts, in the
   * order of the request.
   */
  tickets?: readonly CancelBookingTicket[];
  /**
   * Errors Sabre returned alongside this response. Sabre uses
   * `errors[]` for both hard failures and benign entries (warnings,
   * informational) on 200-OK responses. Additionally, a successful
   * `ALLOW_PARTIAL_CANCEL` response can legitimately carry per-item
   * errors describing the items that were not cancelled — so
   * non-empty `errors[]` is not by itself proof of failure. See
   * `assertBookingSucceeded` for the opt-in helper (and its
   * overridable classification predicate) that throws on hard
   * failures.
   */
  errors?: readonly BookingError[];
  /** Numbers of tickets that were successfully voided. */
  voidedTickets?: readonly string[];
  /** Numbers of tickets that were successfully refunded. */
  refundedTickets?: readonly string[];
  /** Per-flight refund details for successfully refunded bookings. */
  flightRefunds?: readonly CancelFlightRefund[];
}

/**
 * Cancellation eligibility, refundable amounts, and exchangeability
 * data for a single ticket returned by `cancelBooking`.
 */
export interface CancelBookingTicket {
  /** The electronic flight ticket number. */
  number?: string;
  /**
   * If `true`, the ticket meets the requirements for the void
   * procedure.
   */
  isVoidable?: boolean;
  /**
   * If `true`, the ticket is fully or partially refundable. Refer to
   * `refundPenalties` for details. Not guaranteed when the penalty
   * source indicates `Category 16`.
   */
  isRefundable?: boolean;
  /**
   * If `true`, the ticket meets the requirements for an automated
   * refund.
   */
  isAutomatedRefundsEligible?: boolean;
  /**
   * Estimated refund-penalty details. Estimates assume the highest
   * possible refund penalty is applied.
   */
  refundPenalties?: readonly BookingFareRulePenalty[];
  /**
   * Tax information associated with a refund. Applicable to automated
   * refunds only.
   */
  refundTaxes?: readonly CancelRefundTax[];
  /** Refundable totals for the ticket. */
  refundTotals?: BookingTotalValues;
  /**
   * If `true`, the fare can be exchanged (with or without additional
   * cost). Not guaranteed when the penalty source indicates
   * `Category 16`.
   */
  isChangeable?: boolean;
  /**
   * Estimated exchange-penalty details. Estimates assume that all fare
   * components are changed and the highest applicable penalty is
   * applied.
   */
  exchangePenalties?: readonly BookingFareRulePenalty[];
}

/** A single refundable tax code and amount. */
export interface CancelRefundTax {
  /** Two-character tax code. */
  taxCode: string;
  /** Tax amount as a decimal string in the original ticket's currency. */
  amount: string;
}

/** A per-flight refund entry in the `cancelBooking` response. */
export interface CancelFlightRefund {
  /** Two-letter IATA airline code of the marketing airline. */
  airlineCode?: string;
  /** Booking reference ID in the supplier/vendor system. */
  confirmationId?: string;
  /** Total refund amounts for this flight. */
  refundTotals: BookingTotalValues;
}
