/**
 * Public input/output types for the Get Seats v2 service.
 *
 * Hand-written intentionally — not derived from `src/generated/`. The
 * generated types are kept internal so consumer-facing types stay stable
 * across spec changes and use idiomatic TypeScript naming.
 *
 * Get Seats retrieves seat availability and pricing information for a
 * given offer, order, payload, or PNR locator. The response includes
 * seat maps with cabin compartments, rows, and individual seats, plus
 * optional pricing via an a-la-carte offer and reference data in data
 * lists.
 */

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

/**
 * Discriminated-union input to {@link GetSeatsV2Service.getSeats}.
 *
 * The `requestType` discriminant selects the variant:
 *
 * - `'offerId'`   — look up seats by NDC offer ID
 * - `'orderId'`   — look up seats by NDC order ID
 * - `'payload'`   — look up seats by flight payload (segments, passengers, fares)
 * - `'stateless'` — look up seats by PNR locator
 */
export type GetSeatsInput =
  | GetSeatsOfferInput
  | GetSeatsOrderInput
  | GetSeatsPayloadInput
  | GetSeatsStatelessInput;

/**
 * Look up seat availability by NDC offer ID.
 *
 * Requires a point of sale and the offer ID from a prior shopping
 * response. Optionally include passenger details with loyalty info.
 */
export interface GetSeatsOfferInput {
  /** Discriminant — must be `'offerId'`. */
  requestType: 'offerId';

  /** Point of sale location. */
  pointOfSale: SeatPointOfSale;

  /** The NDC offer ID from a prior shopping response. */
  offerId: string;

  /**
   * Optional passenger details. When provided, loyalty program
   * accounts can influence seat pricing.
   */
  passengers?: readonly SeatOfferPassenger[];

  /** Optional payload attributes for troubleshooting/correlation. */
  payloadAttributes?: SeatPayloadAttributes;
}

/**
 * Look up seat availability by NDC order ID.
 *
 * Requires a point of sale and the order ID.
 */
export interface GetSeatsOrderInput {
  /** Discriminant — must be `'orderId'`. */
  requestType: 'orderId';

  /** Point of sale location. */
  pointOfSale: SeatPointOfSale;

  /** The NDC order ID. */
  orderId: string;

  /** Optional payload attributes for troubleshooting/correlation. */
  payloadAttributes?: SeatPayloadAttributes;
}

/**
 * Look up seat availability by flight payload.
 *
 * Requires segment references, origin/destination details, and
 * passenger definitions. Optionally include fare components,
 * currency, and custom attributes.
 */
export interface GetSeatsPayloadInput {
  /** Discriminant — must be `'payload'`. */
  requestType: 'payload';

  /** Segment reference IDs for the seat map. */
  segmentRefIds: readonly string[];

  /** Origin/destination with journey and segment details. */
  originDest: SeatOriginDest;

  /** Passenger definitions with fare associations. */
  passengers: readonly SeatPayloadPassenger[];

  /** Optional fare component definitions. */
  fareComponents?: readonly SeatFareComponent[];

  /** Optional ISO 4217 currency code for pricing. */
  currency?: string;

  /** Optional data bin value. */
  dataBin?: string;

  /** Optional custom key-value attributes. */
  customAttributes?: readonly SeatKeyValuePair[];

  /**
   * Whether the request is for booking or check-in.
   * Defaults to `'BOOKING'` when omitted.
   */
  requestMode?: 'BOOKING' | 'CHECKIN';

  /** Optional payload attributes for troubleshooting/correlation. */
  payloadAttributes?: SeatPayloadAttributes;
}

/**
 * Look up seat availability by PNR locator (stateless).
 *
 * Requires only the PNR locator string.
 */
export interface GetSeatsStatelessInput {
  /** Discriminant — must be `'stateless'`. */
  requestType: 'stateless';

  /** The PNR locator. */
  pnrLocator: string;

  /** Optional data bin value. */
  dataBin?: string;

  /** Optional custom key-value attributes. */
  customAttributes?: readonly SeatKeyValuePair[];

  /**
   * Whether the request is for booking or check-in.
   * Defaults to `'BOOKING'` when omitted.
   */
  requestMode?: 'BOOKING' | 'CHECKIN';

  /** Optional payload attributes for troubleshooting/correlation. */
  payloadAttributes?: SeatPayloadAttributes;
}

// ---------------------------------------------------------------------------
// Shared input types
// ---------------------------------------------------------------------------

/** Point of sale location for the seat request. */
export interface SeatPointOfSale {
  /** ISO 3166-1 two-character country code. */
  countryCode: string;

  /** Three-letter IATA city/airport code. */
  cityCode: string;

  /**
   * Agent duty code defining the authority to request changes.
   * @example "read"
   */
  agentDutyCode?: string;
}

/** Optional payload attributes for troubleshooting and correlation. */
export interface SeatPayloadAttributes {
  /** Echo token — Sabre echoes this back in the response. */
  echoTokenText?: string;

  /** Message creation timestamp in UTC. */
  timeStamp?: string;

  /** Unique transaction ID (max 32 characters). */
  transactionId?: string;

  /** Correlation ID for end-to-end flow tracing. */
  correlationId?: string;
}

/** A passenger in an offer-based seat request. */
export interface SeatOfferPassenger {
  /** Passenger ID. */
  paxId: string;

  /** Passenger's given (first) name. */
  givenName?: string;

  /** Passenger's family (last) name. */
  surname?: string;

  /** Loyalty program accounts for the passenger. */
  loyaltyProgramAccounts?: readonly SeatLoyaltyAccount[];
}

/** A passenger in a payload-based seat request. */
export interface SeatPayloadPassenger {
  /** Passenger ID. */
  paxId: string;

  /** Three-character IATA passenger type code (e.g. `ADT`, `CHD`, `INF`). */
  ptc: string;

  /** Date of birth in `YYYY-MM-DD` format. */
  birthday?: string;

  /** Passenger's given (first) name. */
  givenName?: string;

  /** Passenger's family (last) name. */
  surname?: string;

  /** Whether the passenger is accompanied by a lap infant. */
  accompaniedByInfant?: boolean;

  /** Associations between fare components and segments. */
  fareComponentsAndSegmentIds?: readonly SeatFareComponentSegmentLink[];

  /** Loyalty program accounts for the passenger. */
  loyaltyProgramAccounts?: readonly SeatLoyaltyAccount[];

  /** Custom key-value attributes for the passenger. */
  customAttributes?: readonly SeatKeyValuePair[];
}

/** A loyalty program account. */
export interface SeatLoyaltyAccount {
  /** IATA or ICAO airline code. */
  airline: string;

  /** Loyalty program account number. */
  accountNumber: string;

  /**
   * Tier level (e.g. `Platinum`, `Executive`).
   */
  tierPriority?: string;

  /** Partner program name (e.g. `Eurobonus`). */
  partnerProgram?: string;
}

/** Links a fare component to a segment. */
export interface SeatFareComponentSegmentLink {
  /** Reference to a segment ID. */
  segmentRefId: string;

  /** Reference to a fare component ID. */
  fareComponentRefId: string;
}

/** A fare component definition for the payload request. */
export interface SeatFareComponent {
  /** Unique fare component ID. */
  fareComponentId: string;

  /** The fare basis code. */
  fareBasisCode: string;

  /** Governing carrier airline code. */
  governingCarrier?: string;

  /**
   * Fare vendor code.
   * @example "AY"
   */
  vendorCode?: string;

  /** Fare price amount. */
  priceAmount?: number;

  /** Brand code. */
  brandCode?: string;

  /** Additional fare detail. */
  fareDetail?: SeatFareDetail;
}

/** Additional fare detail for a fare component. */
export interface SeatFareDetail {
  /** Fare type code. */
  fareType?: string;

  /** Fare tariff. */
  fareTariff?: string;

  /** Fare rule. */
  fareRule?: string;

  /** Fare indicator (numeric). */
  fareIndicator?: number;

  /** Fare type bitmap from ticketing. */
  fareTypeBitmap?: string;

  /** Whether the tariff is private (not publicly available). */
  privateTariffIndicator?: boolean;
}

/** Origin/destination container with journey and segment details. */
export interface SeatOriginDest {
  /** The passenger journey containing segment definitions. */
  paxJourney: SeatPaxJourney;
}

/** A passenger journey containing one or more segments. */
export interface SeatPaxJourney {
  /** Segment definitions for the journey. */
  paxSegments: readonly SeatPaxSegmentInput[];
}

/**
 * A segment definition in a payload request.
 *
 * **Important:** for `payload` requests, Sabre requires at least one of
 * {@link SeatCarrierInfo.bookingCode | marketingCarrierInfo.bookingCode}
 * or {@link cabinType} on each segment. If both are omitted, the request
 * will be rejected with error 914: *"No marketing bookingCode or
 * cabinType within one of segment"*. Both values are available in BFM
 * and Revalidate Itinerary responses.
 */
export interface SeatPaxSegmentInput {
  /** Unique segment ID. */
  paxSegmentId: string;

  /** Departure location and date. */
  departure: SeatTransportInput;

  /** Arrival location and date. */
  arrival: SeatTransportInput;

  /** Marketing carrier information. */
  marketingCarrierInfo: SeatCarrierInfo;

  /** Operating carrier information (when different from marketing). */
  operatingCarrierInfo?: SeatCarrierInfo;

  /**
   * Cabin type for this segment.
   *
   * At least one of this or
   * {@link SeatCarrierInfo.bookingCode | marketingCarrierInfo.bookingCode}
   * is required for `payload` requests.
   */
  cabinType?: SeatCabinType;
}

/** A departure or arrival point in a payload request. */
export interface SeatTransportInput {
  /** Three-letter IATA city or station code. */
  locationCode: string;

  /** Scheduled date in `YYYY-MM-DD` format. */
  date: string;
}

/**
 * Carrier information for a segment in a payload request.
 *
 * For `payload` requests, at least one of {@link bookingCode} or
 * {@link SeatPaxSegmentInput.cabinType | cabinType} must be present on
 * each segment.
 */
export interface SeatCarrierInfo {
  /** Two or three character airline code. */
  carrierCode: string;

  /** Flight number. */
  carrierFlightNumber: string;

  /**
   * Booking class code (RBD), e.g. `Y`, `V`, `M`.
   *
   * At least one of this or
   * {@link SeatPaxSegmentInput.cabinType | cabinType} is required for
   * `payload` requests. Available in BFM and Revalidate Itinerary
   * responses.
   */
  bookingCode?: string;
}

/** A key-value pair for custom attributes. */
export interface SeatKeyValuePair {
  /** Property name. */
  key: string;

  /** Property value. */
  value: string;
}

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

/**
 * Result of {@link GetSeatsV2Service.getSeats}.
 *
 * Contains seat maps with cabin layouts, optional pricing via the
 * a-la-carte offer, reference data in data lists, and any errors or
 * warnings from the Sabre response.
 */
export interface GetSeatsOutput {
  /** Seat maps, one per segment. */
  seatMaps: readonly SeatMap[];

  /** A-la-carte offer with pricing for individual seats. */
  aLaCarteOffer?: SeatALaCarteOffer;

  /** Reference data lists (segments, journeys, passengers, services, seat profiles). */
  dataLists?: SeatDataLists;

  /** Shopping response identifiers. */
  shoppingResponse?: SeatShoppingResponse;

  /** Payload attributes echoed back from the request. */
  payloadAttributes?: SeatPayloadAttributes;

  /** Errors from the Sabre response. */
  errors: readonly SeatError[];

  /** Warnings from the Sabre response. */
  warnings: readonly SeatWarning[];
}

// ---------------------------------------------------------------------------
// Seat map hierarchy
// ---------------------------------------------------------------------------

/** A seat map for a single segment. */
export interface SeatMap {
  /** Reference to the passenger segment this map applies to. */
  paxSegmentRefId: string;

  /** Reference to the dated operating leg, if applicable. */
  datedOperatingLegRefId?: string;

  /** Cabin compartments within this seat map. */
  cabinCompartments: readonly SeatCabinCompartment[];

  /** Whether seats in this map can be added to the order. */
  sellable?: boolean;

  /** Whether the carrier does not support change of gauge. */
  changeOfGaugeNotSupported?: boolean;
}

/** A physical cabin compartment within an aircraft. */
export interface SeatCabinCompartment {
  /** Aircraft deck code (e.g. upper, main, lower). */
  deckCode?: string;

  /** First row number in this compartment. */
  firstRow?: number;

  /** Last row number in this compartment. */
  lastRow?: number;

  /** Column identifiers (e.g. `['A', 'B', 'C', 'D', 'E', 'F']`). */
  columnIds?: readonly string[];

  /** Cabin type (code and name). */
  cabinType?: SeatCabinType;

  /** Cabin layout with column positions, row ranges, and facilities. */
  cabinLayout?: SeatCabinLayout;

  /** Rows of seats in this compartment. */
  seatRows: readonly SeatRow[];
}

/** Aircraft cabin type. */
export interface SeatCabinType {
  /** PADIS cabin type code (e.g. `Y`, `J`, `F`). */
  cabinTypeCode?: string;

  /** Cabin type name (e.g. `Economy`, `Business`). */
  cabinTypeName?: string;
}

/** Layout information for a cabin compartment. */
export interface SeatCabinLayout {
  /** Column definitions with position indicators. */
  columns: readonly SeatCabinLayoutColumn[];

  /** Overall row range for the cabin. */
  rows: SeatCabinLayoutRowPosition;

  /** Wing row positions. */
  wingRowPositions?: readonly SeatCabinLayoutRowPosition[];

  /** Exit row positions. */
  exitRowPositions?: readonly SeatCabinLayoutRowPosition[];

  /** Total number of seats in the cabin. */
  seatCount?: number;

  /** Number of seats authorized for booking. */
  authorizedSeatCount?: number;

  /** Row numbers missing from the seat map. */
  missingRowNumbers?: readonly string[];

  /** Seat identifiers missing from the seat map. */
  missingSeatList?: readonly string[];

  /** Facilities (galleys, lavatories, etc.) in the cabin. */
  facilities?: readonly SeatFacility[];
}

/** A column within a cabin layout. */
export interface SeatCabinLayoutColumn {
  /** Column identifier (e.g. `A`). */
  id: string;

  /** Column position: `A` (aisle), `C` (central), `W` (window). */
  position?: string;
}

/** A first/last row range within a cabin. */
export interface SeatCabinLayoutRowPosition {
  /** Index of the first row. */
  firstRow: number;

  /** Index of the last row. */
  lastRow: number;
}

/** A row of seats within a cabin compartment. */
export interface SeatRow {
  /** Row number. */
  row: number;

  /** Row-level characteristics (e.g. exit row, bulkhead). */
  characteristics?: readonly SeatRowCharacteristic[];

  /** Individual seats in this row. */
  seats: readonly Seat[];
}

/** A characteristic of a seat row (PADIS 9864). */
export interface SeatRowCharacteristic {
  /** PADIS 9864 row characteristic code. */
  code: string;

  /** Human-readable description. */
  description?: string;
}

/** An individual seat within a row. */
export interface Seat {
  /** Column identifier for this seat. */
  column: string;

  /** PADIS 9865 seat occupation status code. */
  occupationStatusCode?: string;

  /** Seat-level characteristics (PADIS 9825). */
  characteristics?: readonly SeatCharacteristic[];

  /** References to seat profile IDs in `dataLists.seatProfiles`. */
  seatProfileRefIds?: readonly string[];

  /** References to offer item IDs in `aLaCarteOffer.aLaCarteOfferItems`. */
  offerItemRefIds?: readonly string[];
}

/** A characteristic of an individual seat (PADIS 9825). */
export interface SeatCharacteristic {
  /** PADIS 9825 seat characteristic code. */
  code: string;

  /** Human-readable description. */
  description?: string;
}

/** A facility (galley, lavatory, etc.) in the cabin. */
export interface SeatFacility {
  /** Facility location within the cabin. */
  location: SeatFacilityLocation;

  /** Facility type description. */
  facilityType: string;
}

/** Location of a facility within a cabin. */
export interface SeatFacilityLocation {
  /** Beginning row. */
  beginRow: string;

  /** Ending row. */
  endRow: string;

  /** Column positions the facility spans. */
  columnPositions: readonly string[];

  /** Orientation of the facility. */
  orientation: string;
}

// ---------------------------------------------------------------------------
// A-la-carte offer (pricing)
// ---------------------------------------------------------------------------

/** A-la-carte offer with pricing for individual seats. */
export interface SeatALaCarteOffer {
  /** Unique offer ID. */
  offerId: string;

  /** Airline owner code. */
  ownerCode: string;

  /** Owner type code (e.g. `ORA`, `POA`). */
  ownerTypeCode?: string;

  /** Validating carrier airline code. */
  validatingCarrierCode?: string;

  /** Whether the offer is for the requested date. */
  requestedDateIndicator?: boolean;

  /** URL to complete the transaction externally. */
  webAddressUrl?: string;

  /** Whether the offer must be redeemed (not purchased). */
  redemptionIndicator?: boolean;

  /** Match application text (`ATTRIBUTE`, `AFFINITY`, `OTHER`). */
  matchAppText?: string;

  /** Offer match type (`Full`, `None`, `Partial`, `Other`). */
  matchType?: string;

  /** Percentage of how closely the offer matches criteria. */
  matchPercent?: number;

  /** Offer expiration date/time. */
  offerExpirationDateTime?: string;

  /** Payment time limit date/time. */
  paymentTimeLimitDateTime?: string;

  /** Payment time limit as text. */
  paymentTimeLimitText?: string;

  /** Price guarantee time limit date/time. */
  priceGuaranteeTimeLimitDateTime?: string;

  /** Baggage disclosure reference IDs. */
  baggageDisclosureRefIds?: readonly string[];

  /** Disclosure reference ID. */
  disclosureRefId?: string;

  /** Penalty reference IDs. */
  penaltyRefIds?: readonly string[];

  /** Passenger type code offer parameters. */
  ptcOfferParameters?: readonly SeatPtcOfferParameters[];

  /** Total price of the offer. */
  totalPrice?: SeatPrice;

  /** Individual offer items with per-seat pricing. */
  aLaCarteOfferItems: readonly SeatALaCarteOfferItem[];
}

/** Passenger type code parameters for an offer. */
export interface SeatPtcOfferParameters {
  /** Priced PTC code. */
  ptcPricedCode?: string;

  /** Requested PTC code. */
  ptcRequestedCode?: string;

  /** Number of passengers requested. */
  requestedPaxNumber?: number;

  /** Number of passengers priced. */
  pricedPaxNumber?: number;
}

/** A single offer item (one non-flight service priced per unit). */
export interface SeatALaCarteOfferItem {
  /** Unique offer item ID. */
  offerItemId: string;

  /**
   * Source of the offer.
   * Values: `LCC`, `ATPCO`, `NDC`, `SSG`, `UNKNOWN`.
   */
  source?: string;

  /** Unit price for this offer item. */
  unitPrice: SeatPrice;

  /** Service information for the offer item. */
  service?: SeatALaCarteOfferService;

  /** Eligibility criteria (passengers, segments, journeys). */
  eligibility: SeatEligibility;
}

/** Service reference within an a-la-carte offer item. */
export interface SeatALaCarteOfferService {
  /** Unique service ID. */
  serviceId: string;

  /** Reference to another service ID. */
  serviceRefId?: string;

  /** Reference to a service definition in `dataLists.serviceDefinitions`. */
  serviceDefinitionRefId: string;
}

/** Eligibility criteria for an offer item. */
export interface SeatEligibility {
  /** Eligible passenger reference IDs. */
  paxRefIds?: readonly string[];

  /** Eligible price class reference IDs. */
  priceClassRefIds?: readonly string[];

  /** Flight associations (segments and/or journeys). */
  flightAssociations?: SeatFlightAssociations;
}

/** Flight associations for offer item eligibility. */
export interface SeatFlightAssociations {
  /** Eligible segment reference IDs. */
  paxSegmentRefIds?: readonly string[];

  /** Eligible journey reference IDs. */
  paxJourneyRefIds?: readonly string[];
}

/** Price breakdown with amounts, taxes, fees, and surcharges. */
export interface SeatPrice {
  /** Total amount including taxes, fees, and surcharges. */
  totalAmount?: SeatAmount;

  /** Base amount excluding taxes, fees, and surcharges. */
  baseAmount?: SeatAmount;

  /** Equivalent amount in the local or requested currency. */
  equivAmount?: SeatAmount;

  /** Amount in loyalty units (miles, points). */
  loyaltyUnitAmount?: SeatAmount;

  /** Name of the loyalty unit (e.g. `miles`, `points`). */
  loyaltyUnitName?: string;

  /** Discount applied to the price. */
  discount?: SeatDiscount;

  /** Fees applied to the total amount. */
  fees?: readonly SeatFee[];

  /** Tax summary with individual tax line items. */
  taxSummary?: SeatTaxSummary;

  /** Surcharges applied to the total amount. */
  surcharges?: readonly SeatSurcharge[];
}

/** A monetary amount with currency code. */
export interface SeatAmount {
  /** Numeric amount. */
  amount: number;

  /** ISO 4217 currency code. */
  currencyCode?: string;
}

/** Discount information for a price. */
export interface SeatDiscount {
  /** Discount rule ID. */
  ruleId?: string;

  /** Discount amount. */
  discountAmount?: SeatAmount;

  /** Discount percentage. */
  discountPercent?: number;

  /** Original price before discount. */
  preDiscountedAmount?: SeatAmount;

  /** What the discount applies to. */
  appText?: string;

  /** Description of the discount. */
  descriptionText?: string;

  /** Contextual key-value pairs for the discount. */
  discountContexts?: readonly SeatDiscountContext[];
}

/** Contextual key-value pair for a discount. */
export interface SeatDiscountContext {
  /** Key word. */
  keyWordText?: string;

  /** Value text. */
  valueText?: string;
}

/** A fee applied to a price. */
export interface SeatFee {
  /** Fee amount. */
  amount?: SeatAmount;

  /** Fee amount in local currency. */
  localAmount?: SeatAmount;

  /** Fee designator code (e.g. `USC`). */
  designator?: string;

  /** Description of the fee. */
  description?: string;

  /** Fee nature (e.g. `OBFCA`). */
  nature?: string;
}

/** Tax summary with total and individual tax items. */
export interface SeatTaxSummary {
  /** Total of all applicable taxes. */
  totalTaxAmount?: SeatAmount;

  /** Individual tax line items. */
  taxes: readonly SeatTax[];
}

/** An individual tax line item. */
export interface SeatTax {
  /** Tax amount. */
  amount?: SeatAmount;

  /** Tax code (e.g. `AY`, `GB`). */
  taxCode?: string;

  /** Description of the tax. */
  descText?: string;
}

/** A surcharge applied to a price. */
export interface SeatSurcharge {
  /** Total surcharge amount. */
  total?: SeatAmount;

  /** Breakdown of individual fees within the surcharge. */
  breakdown?: readonly SeatFee[];
}

// ---------------------------------------------------------------------------
// Data lists (reference data)
// ---------------------------------------------------------------------------

/** Reference data lists for cross-referencing seat map data. */
export interface SeatDataLists {
  /** Origin/destination pairs. */
  originDests?: readonly SeatOriginDestRS[];

  /** Flight segments. */
  paxSegments?: readonly SeatPaxSegmentRS[];

  /** Passenger journeys. */
  paxJourneys?: readonly SeatPaxJourneyRS[];

  /** Passengers. */
  paxes?: readonly SeatPaxRS[];

  /** Service definitions (seat products). */
  serviceDefinitions?: readonly SeatServiceDefinition[];

  /** Seat profiles with characteristics and dimensions. */
  seatProfiles?: readonly SeatProfile[];
}

/** An origin/destination pair in the response data lists. */
export interface SeatOriginDestRS {
  /** Origin/destination ID. */
  originDestId?: string;

  /** IATA departure city/station code. */
  originCode?: string;

  /** IATA arrival city/station code. */
  destCode?: string;

  /** Journey reference IDs. */
  paxJourneyRefIds?: readonly string[];
}

/** A flight segment in the response data lists. */
export interface SeatPaxSegmentRS {
  /** Segment ID. */
  paxSegmentId: string;

  /** Whether there is a gap from a previous segment arrival. */
  arrivalUnknown?: boolean;

  /** Whether no ticket records are expected for this segment. */
  ticketless?: boolean;

  /** Whether this segment is subject to US TSA Secure Flight. */
  secureFlight?: boolean;

  /** Total segment time including air and connection time. */
  duration?: string;

  /** Segment type code (`Open`, `Passive`, `Service`). */
  segmentTypeCode?: string;

  /** Cabin type for the segment. */
  cabinType?: SeatCabinType;

  /** Departure details. */
  departure: SeatTransportRS;

  /** Arrival details. */
  arrival: SeatTransportRS;

  /** Marketing carrier information. */
  marketingCarrierInfo: SeatMarketingCarrier;

  /** Operating carrier information. */
  operatingCarrierInfo?: SeatOperatingCarrier;

  /** Dated operating legs within this segment. */
  datedOperatingLegs?: readonly SeatDatedOperatingLeg[];
}

/** Departure or arrival details in a response segment. */
export interface SeatTransportRS {
  /** IATA city/station code. */
  iataLocationCode?: string;

  /** Airport or station name. */
  stationName?: string;

  /** Terminal name. */
  terminalName?: string;

  /** Boarding gate ID. */
  boardingGateId?: string;

  /** Scheduled date/time. */
  aircraftScheduledDateTime?: string;
}

/** Marketing carrier information for a response segment. */
export interface SeatMarketingCarrier {
  /** IATA or ICAO carrier designator code. */
  carrierDesignatorCode: string;

  /** Commercial carrier name. */
  carrierName?: string;

  /** Marketing flight number. */
  marketingCarrierFlightNumberText: string;

  /** Operational suffix to distinguish same-number flights. */
  operationalSuffixText?: string;

  /** Reservation booking designator (RBD) code. */
  rbdCode?: string;
}

/** Operating carrier information for a response segment. */
export interface SeatOperatingCarrier {
  /** IATA or ICAO carrier designation code. */
  carrierDesignationCode?: string;

  /** Commercial carrier name. */
  carrierName?: string;

  /** Operating flight number. */
  operatingCarrierFlightNumberText?: string;

  /** Operational suffix. */
  operationalSuffixText?: string;

  /** Reservation booking designator (RBD) code. */
  rbdCode?: string;
}

/** A dated operating leg within a segment. */
export interface SeatDatedOperatingLeg {
  /** Operating leg ID. */
  datedOperatingLegId: string;

  /** Aircraft type information. */
  carrierAircraftType?: SeatCarrierAircraftType;

  /** Departure details. */
  departure: SeatTransportRS;

  /** Arrival details. */
  arrival: SeatTransportRS;
}

/** Carrier-defined aircraft type. */
export interface SeatCarrierAircraftType {
  /** Internal carrier aircraft type code (e.g. `32A`). */
  carrierAircraftTypeCode?: string;

  /** Internal carrier aircraft type name (e.g. `Airbus A320`). */
  carrierAircraftTypeName?: string;
}

/** A passenger journey in the response data lists. */
export interface SeatPaxJourneyRS {
  /** Journey ID. */
  paxJourneyId?: string;

  /** Total journey distance. */
  distanceMeasure?: SeatMeasure;

  /** Total journey duration. */
  duration?: string;

  /** Segment reference IDs composing this journey. */
  paxSegmentRefIds: readonly string[];
}

/** A numeric measurement with unit. */
export interface SeatMeasure {
  /** Numeric value. */
  measure: number;

  /** Unit code. */
  unitCode?: string;
}

/** A passenger in the response data lists. */
export interface SeatPaxRS {
  /** Passenger ID. */
  paxId: string;

  /** Passenger type code (e.g. `ADT`, `CHD`, `INF`). */
  ptc?: string;

  /** Loyalty program accounts. */
  loyaltyProgramAccounts?: readonly SeatLoyaltyAccountRS[];
}

/** A loyalty program account in a response passenger. */
export interface SeatLoyaltyAccountRS {
  /** Airline code. */
  airline?: string;

  /** Account number. */
  accountNumber?: string;

  /** Tier priority level. */
  tierPriority?: string;

  /** Partner program name. */
  partnerProgram?: string;

  /** Non-airline loyalty program provider name. */
  providerName?: string;

  /** Marketing program name. */
  programName?: string;

  /** Program code. */
  programCode?: string;
}

// ---------------------------------------------------------------------------
// Service definitions
// ---------------------------------------------------------------------------

/** A service definition (seat product) in the response data lists. */
export interface SeatServiceDefinition {
  /** Service definition ID. */
  serviceDefinitionId: string;

  /** Owner airline code. */
  ownerCode?: string;

  /** Service name (e.g. `Lounge Pass`). */
  name: string;

  /** Descriptive content for the service. */
  descriptions: readonly SeatDescription[];

  /** Service definition association (seat profile refs or service bundle). */
  serviceDefinitionAssociation?: SeatServiceDefinitionAssociation;

  /** Booking instructions for the service. */
  bookingInstructions?: SeatBookingInstructions;

  /** Detailed service information. */
  detail?: SeatServiceDefinitionDetail;

  /** Deposit time limit. */
  depositTimeLimitDateTime?: string;

  /** Naming time limit. */
  namingTimeLimitDateTime?: string;

  /** Payment time limit. */
  paymentTimeLimitDateTime?: string;

  /** Ticketing time limit. */
  ticketingTimeLimitDateTime?: string;

  /** Bilateral process time limits. */
  bilateralProcessTimeLimits?: readonly SeatBilateralProcessTimeLimit[];

  /** Validating carrier airline code. */
  validatingCarrierCode?: string;
}

/** A description block for a service definition. */
export interface SeatDescription {
  /** Description ID. */
  descriptionId: string;

  /** Description text. */
  descriptionText?: string;

  /** Markup style of the text (e.g. `HTML`). */
  markupStyleText?: string;

  /** URL source for the description. */
  url?: string;
}

/** Association for a service definition (seat profiles or bundle). */
export interface SeatServiceDefinitionAssociation {
  /** References to seat profile IDs. */
  seatProfileRefIds?: readonly string[];

  /** Service bundle definition. */
  serviceBundle?: SeatServiceBundle;
}

/** A service bundle within a service definition association. */
export interface SeatServiceBundle {
  /** Maximum quantity of bundle services selectable per passenger. */
  maxQuantity?: number;

  /** Service definition reference IDs in the bundle. */
  serviceDefinitionRefIds: readonly string[];
}

/** Booking instructions for a service. */
export interface SeatBookingInstructions {
  /** SSR codes (four-character IATA codes). */
  ssrCodes?: readonly string[];

  /** OSI (Other Service Information) text lines. */
  osiText?: readonly string[];

  /** PNR booking method code (PADIS 9750). */
  method?: string;

  /** Upgrade method when upgrading to a new class. */
  upgradeMethod?: SeatUpgradeMethod;

  /** Data center instructions. */
  text?: readonly string[];

  /** Aircraft equipment information. */
  equipment?: string;
}

/** Upgrade method for a class upgrade. */
export interface SeatUpgradeMethod {
  /** Upgrade method value. */
  value: string;

  /** New class code. */
  newClass?: string;
}

/** Detailed service definition information. */
export interface SeatServiceDefinitionDetail {
  /** Service combinations (permitted/not permitted). */
  serviceCombinations?: readonly SeatServiceCombination[];

  /** Service coupon information. */
  serviceCoupon?: SeatServiceCoupon;

  /** Service fulfillment information. */
  serviceFulfillment?: SeatServiceFulfillment;

  /** Quantity rules (min/max). */
  serviceItemQuantityRules?: SeatServiceItemQuantityRules;
}

/** A service combination rule. */
export interface SeatServiceCombination {
  /** Combination rule: `Permitted`, `NotPermitted`, or `Other`. */
  rule: string;

  /** Service IDs in the combination. */
  serviceIds?: readonly SeatServiceId[];

  /** Service references. */
  serviceReferences?: readonly string[];
}

/** A service ID within a combination. */
export interface SeatServiceId {
  /** Service ID value. */
  value: string;

  /** Owner airline code. */
  owner: string;

  /** Object key. */
  objectKey?: string;
}

/** Service coupon information. */
export interface SeatServiceCoupon {
  /** Instant purchase type code (`CC`, `NO`, `TT`). */
  instantPurchase?: string;

  /** Service fee basis (`DIS`, `FEE`, `FNA`, `INC`, `NAP`, `SUR`). */
  feeBasis?: string;

  /** Coupon type (`EMD Associated`, `EMD Standalone`, `No EMD`, `Electronic Ticket`). */
  couponType?: string;
}

/** Service fulfillment information. */
export interface SeatServiceFulfillment {
  /** Valid date range for the service. */
  offerValidDates?: SeatOfferValidDates;

  /** Fulfillment provider company. */
  provider?: SeatFulfillmentPartner;

  /** Fulfillment location. */
  location?: SeatFulfillmentLocation;
}

/** Valid date range for a service. */
export interface SeatOfferValidDates {
  /** Earliest date the service is available. */
  start?: string;

  /** Latest date the service is available. */
  end?: string;
}

/** Fulfillment provider company. */
export interface SeatFulfillmentPartner {
  /** Partner company ID. */
  partnerId: string;

  /** Partner company name. */
  name?: string;

  /** Partner company type (`ServiceProvider`, `ServiceFulfillment`, `Merchandise`). */
  type?: string;

  /** Fulfillment entries. */
  fulfillments?: readonly SeatFulfillment[];
}

/** A fulfillment entry. */
export interface SeatFulfillment {
  /** Valid date range. */
  offerValidDates?: SeatOfferValidDates;

  /** Fulfillment location. */
  location?: SeatAirportAndAddress;
}

/** Airport and address for fulfillment. */
export interface SeatAirportAndAddress {
  /** Three-letter IATA airport code. */
  airportCode?: string;

  /** Structured address. */
  address?: SeatStructuredAddress;
}

/** Structured address for fulfillment. */
export interface SeatStructuredAddress {
  /** Whether this is an origin or destination address. */
  application?: 'AddressAtOrigin' | 'AddressAtDestination';

  /** Street lines. */
  street?: readonly string[];

  /** P.O. box number. */
  poBox?: string;

  /** Building, room, apartment, or suite. */
  buildingRoom?: string;

  /** City name. */
  city?: string;

  /** State or province code. */
  stateProv?: string;

  /** Postal code. */
  postalCode?: string;

  /** Country code. */
  countryCode?: string;

  /** County name. */
  county?: string;
}

/** Fulfillment location with airport and optional address. */
export interface SeatFulfillmentLocation {
  /** Airport fulfillment code. */
  airportCode?: string;

  /** Other fulfillment address. */
  otherAddress?: SeatStructuredAddress;
}

/** Quantity rules for a service. */
export interface SeatServiceItemQuantityRules {
  /** Minimum order quantity. */
  minimum?: number;

  /** Maximum order quantity. */
  maximum?: number;
}

/** A bilateral process time limit. */
export interface SeatBilateralProcessTimeLimit {
  /** Time limit name. */
  name: string;

  /** Time limit date/time. */
  timeLimitDateTime?: string;

  /** Supplemental description. */
  descriptionText?: string;
}

// ---------------------------------------------------------------------------
// Seat profiles
// ---------------------------------------------------------------------------

/** A seat profile describing seat characteristics and dimensions. */
export interface SeatProfile {
  /** Seat profile ID. */
  seatProfileId: string;

  /** PADIS 9825 characteristic codes (e.g. `E`, `M`, `A`, `L`, `Q`). */
  characteristicCodes?: readonly string[];

  /** Seat width measurement. */
  seatWidthMeasure?: SeatMeasure;

  /** Seat pitch measurement. */
  seatPitchMeasure?: SeatMeasure;

  /** Descriptive text about the seat profile. */
  descriptionText?: readonly string[];

  /** Marketing information descriptions. */
  marketingInformation?: readonly SeatDescription[];

  /** Keywords associated with the seat profile. */
  seatKeywords?: readonly SeatKeyWord[];
}

/** A keyword describing a seat profile. */
export interface SeatKeyWord {
  /** Key word text (e.g. `SKYC`). */
  keyWordText: string;

  /** Value text (e.g. `SkyCouch`). */
  valueText: string;
}

// ---------------------------------------------------------------------------
// Shopping response
// ---------------------------------------------------------------------------

/** Shopping response identifiers. */
export interface SeatShoppingResponse {
  /** Unique shopping response ID. */
  shoppingResponseId: string;

  /** Owner airline code. */
  ownerCode?: string;
}

// ---------------------------------------------------------------------------
// Errors and warnings
// ---------------------------------------------------------------------------

/** An error from the Get Seats response. */
export interface SeatError {
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

/** A warning from the Get Seats response. */
export interface SeatWarning {
  /** Warning code. */
  code?: string;

  /** Free-text warning description. */
  descriptionText?: string;

  /** Organization that owns the warning codelist. */
  ownerName?: string;
}
