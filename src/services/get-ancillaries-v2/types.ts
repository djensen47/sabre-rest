/**
 * Public input/output types for the Get Ancillaries v2 service.
 *
 * Hand-written intentionally — not derived from `src/generated/`. The
 * generated types are kept internal so consumer-facing types stay stable
 * across spec changes and use idiomatic TypeScript naming.
 *
 * Get Ancillaries retrieves ancillary services (baggage, seats, meals,
 * etc.) for a given Sabre order in NDC format. The response includes
 * service definitions, pricing, and the segments/passengers they apply
 * to.
 */

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

/**
 * Input to {@link GetAncillariesV2Service.getAncillaries}.
 *
 * At minimum, an `orderId` is required. Optional filters narrow the
 * response to specific segments, passengers, or service groups.
 */
export interface GetAncillariesInput {
  /**
   * The unique Sabre order ID to retrieve ancillaries for.
   */
  orderId: string;

  /**
   * Optional list of segment reference IDs. When provided, only
   * ancillaries for these segments are returned.
   */
  segmentRefs?: readonly string[];

  /**
   * Optional list of passenger reference IDs. When provided, only
   * ancillaries for these passengers are returned.
   */
  passengerRefs?: readonly string[];

  /**
   * Optional ATPCO group code to filter by (e.g., `BG` for baggage,
   * `PT` for pets, `ML` for meals). Two-character alphanumeric.
   */
  groupCode?: string;
}

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

/**
 * Result of {@link GetAncillariesV2Service.getAncillaries}.
 *
 * Contains the ancillary offer with service definitions, pricing,
 * and the segments/passengers they apply to. Errors and warnings
 * from the Sabre response are surfaced directly.
 */
export interface GetAncillariesOutput {
  /** Flight segments associated with the ancillaries. */
  segments: readonly AncillarySegment[];

  /** Passengers associated with the ancillaries. */
  passengers: readonly AncillaryPassenger[];

  /**
   * The Sabre offer store ID. Required to add ancillary offer items
   * to a reservation.
   */
  offerId?: string;

  /** Offer items linking service definitions to segments and passengers. */
  offerItems: readonly AncillaryOfferItem[];

  /** Service definitions describing each ancillary type. */
  serviceDefinitions: readonly AncillaryServiceDefinition[];

  /** Price definitions with fee breakdowns for offer items. */
  priceDefinitions: readonly AncillaryPriceDefinition[];

  /** Errors from the Sabre response, when present. */
  errors: readonly AncillaryError[];

  /** Warnings from the Sabre response, when present. */
  warnings: readonly AncillaryWarning[];
}

/** A flight segment associated with ancillary services. */
export interface AncillarySegment {
  /** Segment identifier within the response. */
  id?: string;
  /** Booking airline IATA code. */
  bookingAirlineCode?: string;
  /** Booking flight number. */
  bookingFlightNumber?: number;
  /** Three-letter IATA departure airport code. */
  departureAirportCode?: string;
  /** Three-letter IATA arrival airport code. */
  arrivalAirportCode?: string;
  /** Departure date in `YYYY-MM-DD` format. */
  departureDate?: string;
  /** Departure time in `HH:mm:ss` format. */
  departureTime?: string;
  /** Arrival date in `YYYY-MM-DD` format. */
  arrivalDate?: string;
  /** Arrival time in `HH:mm:ss` format. */
  arrivalTime?: string;
  /** Operating airline IATA code, when different from booking. */
  operatingAirlineCode?: string;
  /** Operating flight number, when different from booking. */
  operatingFlightNumber?: number;
  /** Booking class code (RBD). */
  bookingClassCode?: string;
  /** Operating booking class code. */
  operatingBookingClassCode?: string;
  /** Cabin code (e.g. `Y`, `J`, `F`). */
  cabinCode?: string;
  /** Reservation status as listed on the PNR (e.g. `HK`). */
  reservationStatus?: string;
  /** Whether there is a change of aircraft on this segment. */
  isChangeOfGauge?: boolean;
  /** Flight legs within this segment (for change-of-gauge). */
  flightLegs: readonly AncillaryFlightLeg[];
}

/** A leg within a multi-leg segment. */
export interface AncillaryFlightLeg {
  /** Leg identifier. */
  legId?: string;
  /** Three-letter IATA departure airport code. */
  departureAirportCode?: string;
  /** Three-letter IATA arrival airport code. */
  arrivalAirportCode?: string;
  /** Three-letter IATA aircraft type designator. */
  equipmentCode?: string;
}

/** A passenger associated with ancillary services. */
export interface AncillaryPassenger {
  /** Passenger identifier within the response. */
  passengerId?: string;
  /** Passenger type code (e.g. `ADT`, `CHD`, `INF`). */
  passengerTypeCode?: string;
  /** Title before the surname (e.g. `Mr`, `Mrs`). */
  title?: string;
  /** First name. */
  givenName?: string;
  /** Middle name or initial. */
  middleName?: string;
  /** Family name / last name. */
  surname?: string;
  /** Suffix (e.g. `Jr`, `III`). */
  suffixName?: string;
}

/**
 * An offer item linking a service definition to specific segments
 * and passengers.
 */
export interface AncillaryOfferItem {
  /** Unique offer item ID. */
  offerItemId?: string;
  /** Reference to a service definition ID in this response. */
  serviceDefinitionRef?: string;
  /** Reference to a price definition ID in this response. */
  priceDefinitionRef?: string;
  /** Segment IDs this offer item applies to. */
  segmentRefs: readonly string[];
  /** Passenger IDs this offer item applies to. */
  passengerRefs: readonly string[];
}

/** Definition of an ancillary service (baggage, seat, meal, etc.). */
export interface AncillaryServiceDefinition {
  /** Service definition ID within the response. */
  id?: string;
  /**
   * ATPCO service type code (SSR code). Single character, either
   * industry-defined or carrier-defined.
   */
  serviceCode?: string;
  /** Owning airline IATA code. */
  airlineCode?: string;
  /** Commercial name of the service (e.g. `SECOND BAG UPTO50LB 23KG`). */
  commercialName?: string;
  /** ATPCO group code (e.g. `BG` for baggage). */
  groupCode?: string;
  /** ATPCO subgroup code. */
  subGroup?: string;
  /**
   * Reason for issuing an EMD for this service. Values include
   * `Baggage`, `Airport Services`, `Merchandise`, `In-Flight Services`, etc.
   */
  reasonForIssuance?: string;
  /** Maximum weight limit in kilograms, for baggage. */
  upToWeightLimitInKilograms?: number;
  /** Maximum weight limit in pounds, for baggage. */
  upToWeightLimitInPounds?: number;
  /** Maximum quantity allowed by the airline. */
  maximumQuantity?: number;
  /**
   * Booking method. Values: `Special Service Request`,
   * `Auxiliary Segment`, `Contact Airline`, `No Booking Required`,
   * `Per Service Record`, `Any Allowed`.
   */
  bookingMethod?: string;
  /** Interline settlement method code. */
  settlementMethodCode?: string | null;
  /** NDC airline code responsible for this offer. */
  ownerCode?: string;
  /** Baggage description code (e.g. `GOLF`). */
  ancillaryBagDescriptionCode?: string;
  /** Free-text descriptions of the service. */
  descriptions: readonly AncillaryDescription[];
  /** Additional input requirements for booking (SSR pattern). */
  additionalInputRequirements?: AncillaryInputRequirements;
  /** Cabin upgrade instructions, when applicable. */
  cabinUpgrade?: AncillaryCabinUpgrade;
}

/** A free-text description line for a service definition. */
export interface AncillaryDescription {
  /** Description item identifier. */
  id?: string;
  /** Description text. */
  text?: string;
}

/** Additional input requirements for booking an ancillary. */
export interface AncillaryInputRequirements {
  /** Text-based SSR entry pattern (e.g. `%FREETEXT%`). */
  pattern?: string;
  /** Variables used in the pattern. */
  variables: readonly AncillaryPatternVariable[];
}

/** A variable within an additional input pattern. */
export interface AncillaryPatternVariable {
  /** Variable identifier as used in the pattern. */
  key?: string;
  /** Expression pattern of the variable. */
  value?: string;
  /** Human-readable explanation of the variable. */
  description?: string;
}

/** Cabin upgrade instructions for a service. */
export interface AncillaryCabinUpgrade {
  /** Service upgrade method code (PADIS 9750). */
  methodCode?: string | null;
  /** New cabin type code related to the upgrade. */
  reservationBookingDesignator?: string;
}

/** Price definition for an ancillary offer item. */
export interface AncillaryPriceDefinition {
  /** Price definition ID within the response. */
  id?: string;
  /** Final price after any markup/discount. */
  serviceFee?: AncillaryServiceFee;
  /** Base price before modification. */
  baseFee?: AncillaryServiceFee;
}

/** Fee information for an ancillary. */
export interface AncillaryServiceFee {
  /** Single unit price (when quantity > 1). */
  unitPrice?: AncillaryPrice;
  /** Total price including taxes. */
  totalPrice?: AncillaryPrice;
}

/** Price breakdown for an ancillary. */
export interface AncillaryPrice {
  /** Sale amount with taxes (in customer's currency). */
  saleAmount?: AncillaryAmount;
  /** Amount without taxes (in customer's currency). */
  amount?: AncillaryAmount;
  /** Amount without taxes in the airline's record currency. */
  ancillaryRecordAmount?: AncillaryAmount;
  /** Tax summary with individual tax line items. */
  taxSummary?: AncillaryTaxSummary;
}

/** A monetary amount with currency. */
export interface AncillaryAmount {
  /** Monetary value as a string (e.g. `"128.00"`). */
  amount?: string;
  /** Three-letter ISO 4217 currency code. */
  currencyCode?: string;
}

/** Tax summary for an ancillary price. */
export interface AncillaryTaxSummary {
  /** Total tax amount. */
  taxesTotal?: AncillaryAmount;
  /** Individual tax line items. */
  taxes: readonly AncillaryTax[];
  /** Whether all taxes are exempt. */
  isTaxExempt?: boolean;
}

/** An individual tax on an ancillary. */
export interface AncillaryTax {
  /** Tax amount. */
  taxAmount?: AncillaryAmount;
  /** Tax code (e.g. `AY`). */
  taxCode?: string;
  /** Tax description. */
  taxDescription?: string;
}

/** An error from the Get Ancillaries response. */
export interface AncillaryError {
  /** IATA error code (Code Table 9321). */
  code?: string;
  /** Free-text error description. */
  descriptionText?: string;
  /** ISO 639-2 language code. */
  languageCode?: string;
  /** Organization that owns the error codelist. */
  ownerName?: string;
  /** Processing status (`NotProcessed`, `Incomplete`, `Complete`, `Unknown`). */
  statusText?: string;
  /** Invalid elements found in the request. */
  tagText: readonly string[];
  /** Error type code. */
  typeCode?: string;
  /** Link to the online error description. */
  url?: string;
}

/** A warning from the Get Ancillaries response. */
export interface AncillaryWarning {
  /** Warning code. */
  code?: string;
  /** Free-text warning description. */
  descriptionText?: string;
  /** Organization that owns the warning codelist. */
  ownerName?: string;
}
