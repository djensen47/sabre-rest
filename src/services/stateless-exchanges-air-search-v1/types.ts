/**
 * Public input/output types for the Stateless Exchanges Air Search v1
 * service.
 *
 * Hand-written intentionally — not derived from `src/generated/`. The
 * generated types are kept internal so consumer-facing types stay stable
 * across spec changes and use idiomatic TypeScript naming.
 *
 * SEAS shops alternate flights for an in-flight booking that the consumer
 * wants to exchange. The response carries the priced delta — fare
 * difference, tax difference, and a `totalFees` breakdown that splits
 * change-fees out from other fees per Cat-31 evaluation. A fully
 * refundable / no-penalty fare comes back with `differenceType: 'Even'`
 * (or `'Refund'`) and an empty/zero `ChangeFees` entry; the same code
 * path covers both the priced and the no-fee case.
 *
 * The library does not invent its own required-field rubric and does not
 * drop records based on which fields are populated — every priced
 * itinerary, every fare, every fee Sabre returned is preserved exactly
 * as Sabre returned it.
 */

/**
 * Input to {@link StatelessExchangesAirSearchV1Service.search}.
 *
 * Models an exchange-shop request: the booking to exchange (PNR + ticket
 * documents), the legs to consider rebooking, and a client context
 * identifying the point of sale. Optional travel preferences narrow the
 * result set.
 */
export interface SearchExchangeFlightsInput {
  /**
   * Existing PNR record locator (1–8 characters, uppercase letters and
   * digits). The booking that will be exchanged.
   */
  pnrLocator: string;

  /**
   * Whether to shop via Interline Branded Fares or Exchange Context
   * Shopping. Most exchange flows use `ExchangeShop`; `InterlineBrandedFaresShopping`
   * is for interline-aware searches.
   */
  shoppingSource: 'InterlineBrandedFaresShopping' | 'ExchangeShop';

  /**
   * Itinerary parts (legs) being shopped. Sabre permits 1–8. Each part is
   * either being held in place (`shopForExchange: false`) or being
   * shopped for an alternate (`shopForExchange: true`).
   */
  itineraryParts: readonly ItineraryPart[];

  /**
   * Client context identifying the agent's PCC, OAC, and other
   * point-of-sale data Sabre uses to route and price the request.
   */
  clientContext: ClientContext;

  /**
   * Documents (tickets) eligible for exchange, identified by document
   * number and the passenger they belong to. Sabre permits 0–9 entries.
   */
  exchangeDocuments?: readonly ExchangeDocument[];

  /** Optional travel preferences. Omit for an unconstrained search. */
  travelPreferences?: ExchangeTravelPreferences;

  /**
   * If true, requests Sabre to compute self-service reaccommodation
   * rules — telling the consumer whether the change fee or price
   * difference is waived under an airline-specific rule.
   */
  calculateReaccommodationRules?: boolean;

  /**
   * Allow exchange shopping for checked-in (CKIN) reservations. Defaults
   * to `false` per Sabre's spec; the library sends the documented
   * default explicitly when omitted.
   */
  overrideCkinStatus?: boolean;
}

/** A ticket document that may be exchanged. */
export interface ExchangeDocument {
  /** 13-digit ticket document number (e.g., `7952164246136`). */
  number: string;
  /**
   * Passenger name number associating this document to a traveller in
   * the PNR (e.g., `01.01`).
   */
  passengerNameNumber: string;
  /**
   * Optional ATPCO passenger type code (e.g., `ADT`, `CHD`).
   */
  passengerTypeCode?: string;
}

/**
 * Optional shopping preferences for an exchange search.
 *
 * Most fields tighten Sabre's search (cabin, carriers, connections);
 * `returnNoPenaltyFares` is the one that's load-bearing for "show me
 * only no-fee alternates" use cases.
 */
export interface ExchangeTravelPreferences {
  /** Brand IDs to narrow the search to specific branded fares. */
  includeBrandCodes?: readonly string[];
  /** Single-letter IATA cabin code (e.g., `Y`, `C`, `F`). */
  preferredCabinCode?: string;
  /** Maximum number of plane-change connections per leg (0–3). */
  maximumConnections?: number;
  /** ISO-4217 currency override for the response prices. */
  currencyOverrideCode?: string;
  /** Restrict to `Nonstop`, `Direct`, or `Connection` itineraries. */
  flightType?: 'Nonstop' | 'Direct' | 'Connection';
  /** Maximum stops per leg (0–3) including hidden stops. */
  maximumStopsQuantity?: number;
  /** Vendor (carrier) codes to exclude from the search (≤5). */
  excludeVendors?: readonly string[];
  /**
   * Account code applied at the request level to surface negotiated
   * (private) fares.
   */
  accountCode?: string;
  /**
   * Corporate ID (5 alphanumeric chars) applied at the itinerary level
   * to surface negotiated (private) fares.
   */
  corporateId?: string;
  /** If true, only return private (negotiated) fares. */
  shouldReturnNegotiatedFaresOnly?: boolean;
  /**
   * If true, restrict to single-carrier itineraries; otherwise Cat-31
   * may permit interline alternates.
   */
  returnOnlineServiceOnly?: boolean;
  /** If true, include multi-carrier interline itineraries. */
  includeInterlineFlights?: boolean;
  /**
   * If true, only return fares with **no refund penalty**. Useful for
   * surfacing fully-refundable alternates only.
   */
  returnNoPenaltyFares?: boolean;
  /** If true, return per-leg fares for each passenger type. */
  splitFaresByLeg?: boolean;
}

/**
 * One itinerary part (leg) being considered in the exchange shop.
 *
 * Sabre uses two flavours within the same shape:
 *  - **Retained legs**: `shopForExchange: false` and the existing
 *    segments listed in {@link segments}.
 *  - **Rebooked legs**: `shopForExchange: true` to ask Sabre to find
 *    alternates between the airports/dates given.
 */
export interface ItineraryPart {
  /** Sequence number identifying this leg within the request (≥1). */
  referenceNumber: number;
  /** Departure date in `YYYY-MM-DD` format. */
  departureDate: string;
  /** Three-letter IATA departure airport code. */
  departureAirportCode: string;
  /** Three-letter IATA arrival airport code. */
  arrivalAirportCode: string;
  /** If true, Sabre shops alternate flights for this leg. */
  shopForExchange?: boolean;
  /** If true, Sabre returns full-diversity fares for this leg. */
  returnFullDiversityFares?: boolean;
  /** If true, the leg was already selected from a prior shop. */
  isPreselected?: boolean;
  /**
   * Number of alternate days (±) around the departure date Sabre may
   * search for a better fare.
   */
  numberOfDateFlexibilityDays?: number;
  /** Maximum number of one-way options to return. */
  maximumOneWayOptions?: number;
  /** Number of one-way options for the requested date. */
  numberOfOneWayOptions?: number;
  /** Connection cities to favour or restrict (≤3). */
  connections?: readonly Connection[];
  /** Connection time bounds for the leg. */
  connectionTime?: ConnectionTime;
  /** Specific marketing carriers Sabre should consider for this leg. */
  includeVendors?: readonly string[];
  /**
   * If true, Sabre limits alternates to the same connecting cities the
   * existing booking uses. Cannot be combined with {@link connections}.
   */
  shouldPreserveConnections?: boolean;
  /** Existing or proposed segments for the leg (≤16). */
  segments?: readonly Segment[];
}

/** Connection city preference within an itinerary part. */
export interface Connection {
  /** Three-letter IATA code for the connection airport/city. */
  locationCode: string;
  /** If true, Sabre considers only this location for connections. */
  isPreferred?: boolean;
}

/** Connection time bounds (in minutes) for an itinerary part. */
export interface ConnectionTime {
  /** Minimum allowed connection time. */
  minimumTimeInMinutes?: number;
  /** Maximum allowed connection time. */
  maximumTimeInMinutes?: number;
}

/**
 * A flight segment used either as part of the existing itinerary or as a
 * proposed alternate. Sabre treats this as the lowest-level flight unit
 * within {@link ItineraryPart.segments}.
 */
export interface Segment {
  /** Booking class code (RBD), 1–2 uppercase letters. */
  bookingClassCode: string;
  /** Brand code (≥2 alphanumeric) used to price this segment. */
  brandCode: string;
  /** Three-letter operating airline IATA code. */
  operatingAirlineCode: string;
  /** Three-letter booking (marketing) airline IATA code. */
  bookingAirlineCode: string;
  /** Marketing flight number. */
  bookingFlightNumber: string;
  /** Local departure datetime in `YYYY-MM-DDTHH:MM:SS` format. */
  departureDateTime: string;
  /** Local arrival datetime in `YYYY-MM-DDTHH:MM:SS` format. */
  arrivalDateTime: string;
  /** Three-letter IATA departure airport code. */
  departureAirportCode: string;
  /** Three-letter IATA arrival airport code. */
  arrivalAirportCode: string;
}

/**
 * Client point-of-sale context. PCC is typically required by your Sabre
 * configuration; the rest are optional and only used for specific
 * routing or accounting cases.
 */
export interface ClientContext {
  /** Three-letter Pseudo City Code identifying the agent's office. */
  pseudoCityCode?: string;
  /** Two-letter ISO-3166 country code. */
  countryCode?: string;
  /** Two-letter state/province abbreviation. */
  stateProvinceCode?: string;
  /** 8-digit office station identifier. */
  stationNumber?: string;
  /** Two-character Office Accounting Code (OAC). */
  accountingCode?: string;
  /** Three-letter accounting city used for OAC carriers. */
  accountingCity?: string;
  /** Agent duty code. */
  dutyCode?: string;
}

/**
 * Result of {@link StatelessExchangesAirSearchV1Service.search}.
 *
 * Every field on the response-side types is optional, including fields
 * Sabre's spec marks as required. The library does not invent its own
 * required-field rubric and does not drop records based on which fields
 * are populated. Consumers should defensively handle `undefined` values.
 */
export interface SearchExchangeFlightsOutput {
  /**
   * Priced exchange itineraries Sabre returned, in wire order. Empty
   * when Sabre returned no priceable alternates.
   */
  pricedItineraries: readonly ExchangePricedItinerary[];
  /**
   * Non-fatal warning messages Sabre attached to the response.
   */
  warnings: readonly ResponseMessage[];
  /**
   * Application-layer error messages held in the 200 response. These
   * are distinct from transport-level (4xx/5xx) errors which surface
   * via {@link SabreApiResponseError}; SEAS commonly reports
   * "ineligible PNR" / "no eligible documents" here on a 200.
   */
  errors: readonly ResponseMessage[];
}

/** A priced exchange itinerary alternative. */
export interface ExchangePricedItinerary {
  /** Itinerary structure (legs and segments). */
  itinerary?: Itinerary;
  /** Pricing block — fares, fee breakdown, and per-passenger detail. */
  airItineraryPricing?: AirItineraryPricing;
}

/** Itinerary structure on a priced alternative. */
export interface Itinerary {
  /** Legs in trip order. */
  itineraryParts: readonly ExchangeOriginDestination[];
}

/** A leg of the priced itinerary, with its operating segments. */
export interface ExchangeOriginDestination {
  /** Total elapsed leg time in minutes. */
  elapsedTime?: number;
  /** Three-letter IATA departure airport code. */
  departureAirportCode?: string;
  /** Three-letter IATA arrival airport code. */
  arrivalAirportCode?: string;
  /** Segments on this leg, in operating order. */
  segments: readonly ReservationSegment[];
}

/** A flight segment on a priced itinerary leg. */
export interface ReservationSegment {
  /** Segment elapsed time in minutes. */
  elapsedTime?: number;
  /** Whether electronic ticketing is supported on this segment. */
  supportsElectronicTicket?: boolean;
  /** Local arrival datetime in `YYYY-MM-DDTHH:MM:SS` format. */
  arrivalDateTime?: string;
  /** Three-letter IATA arrival airport code. */
  arrivalAirportCode?: string;
  /** Marketing flight number. */
  bookingFlightNumber?: string;
  /** Three-letter booking (marketing) airline IATA code. */
  bookingAirlineCode?: string;
  /** Three-letter operating airline IATA code. */
  operatingAirlineCode?: string;
  /** Operating flight number when the segment is code-shared. */
  operatingFlightNumber?: string;
  /** Marriage group identifier linking segments as a single unit. */
  marriageGroup?: string;
  /** Sequence number used to link segments to fare detail. */
  sequence?: number;
  /** Local departure datetime in `YYYY-MM-DDTHH:MM:SS` format. */
  departureDateTime?: string;
  /** Three-letter IATA departure airport code. */
  departureAirportCode?: string;
  /** Number of stops on this segment. */
  stopQuantity?: number;
}

/** Pricing data on a priced itinerary alternative. */
export interface AirItineraryPricing {
  /**
   * Fares Sabre filed for this alternative, in wire order. Each fare
   * carries its own price-difference and per-passenger breakdown — most
   * responses ship a single fare, branded shopping may ship several.
   */
  fares: readonly Fare[];
}

/**
 * One fare offer on a priced exchange itinerary.
 *
 * The {@link totalPriceDifference} block is what answers "what does this
 * change cost?" — fare diff, tax diff, and the change-fee/other-fee
 * split that drives the refundable-vs-penalty UX.
 */
export interface Fare {
  /** Brand code used to price this fare, when populated. */
  brandCode?: string;
  /** Brand name (e.g., `Flex`), when populated. */
  brandName?: string;
  /** Brand program ID, when populated. */
  brandProgramId?: string;
  /** Brand program code (e.g., `VAC`), when populated. */
  brandProgramCode?: string;
  /** Brand program description (e.g., `BUSINESS FLEXIBLE`). */
  brandProgramDescription?: string;
  /** Brand program system code, when populated. */
  brandProgramSystemCode?: string;
  /** True when this fare is sold out. */
  isSoldOut?: boolean;
  /**
   * False when no valid fare was found — see {@link invalidReason} for
   * the disposition code Sabre returned in that case.
   */
  isValid?: boolean;
  /** Disposition code when {@link isValid} is false. */
  invalidReason?:
    | 'NoSeatsAvailable'
    | 'BrandNotOffered'
    | 'NoApplicableFareFound'
    | 'UnknownReason';
  /**
   * True when individual passenger prices use different currencies — in
   * that case use {@link passengersPriceDetails} rather than
   * {@link totalPriceDifference}.
   */
  isPassengersPricedInDifferentCurrencies?: boolean;
  /** Reservation-segment detail for this fare (per-passenger booking data). */
  reservationSegmentsDetails: readonly ReservationSegmentDetails[];
  /**
   * Per-passenger price detail. Only populated for the Exchange Context
   * Shopping path (`shoppingSource: 'ExchangeShop'`).
   */
  passengersPriceDetails: readonly PassengerPriceDetail[];
  /**
   * Total price difference across all passengers — fare diff, tax diff,
   * and change-fee/other-fee breakdown. **The primary place to read for
   * "what does this exchange cost?"**.
   */
  totalPriceDifference?: TotalPriceDifference;
  /** Per-passenger fares for the Interline Branded Fares path. */
  passengerFares: readonly FareType[];
  /** Aggregate total fare for the Interline Branded Fares path. */
  totalFare?: ExchangeTotalFare;
}

/** Per-segment booking detail attached to a {@link Fare}. */
export interface ReservationSegmentDetails {
  /** Sequence number tying this detail back to a {@link ReservationSegment}. */
  segmentNumber?: number;
  /** Per-passenger booking-class and fare-basis information. */
  passengersBookingDetails: readonly PassengerBookingDetails[];
}

/** Per-passenger booking detail within a {@link ReservationSegmentDetails}. */
export interface PassengerBookingDetails {
  /** Internal Branded Fare passenger-fare reference. */
  passengerFareRef?: string;
  /** Brand code, when populated. */
  brandCode?: string;
  /** Brand name, when populated. */
  brandName?: string;
  /** Brand program ID, when populated. */
  brandProgramId?: string;
  /** Brand program code, when populated. */
  brandProgramCode?: string;
  /** Brand program description, when populated. */
  brandProgramDescription?: string;
  /** Brand program system code, when populated. */
  brandProgramSystemCode?: string;
  /** Single-letter cabin code (`Y`, `C`, `F`, …). */
  cabinCode?: string;
  /** Booking class code (RBD), 1–2 uppercase letters. */
  bookingClassCode?: string;
  /** Document being exchanged/reissued for this passenger. */
  documentNumber?: string;
  /** Fare basis code (e.g., `WI7AUEY8`). */
  fareBasisCode?: string;
  /** Meal code, 1–4 uppercase letters. */
  mealCode?: string;
  /** Three-letter IATA departure airport code. */
  departureAirportCode?: string;
  /** Three-letter IATA arrival airport code. */
  arrivalAirportCode?: string;
  /** Direction the fare is consumed in (`From` or `To`). */
  directionality?: 'From' | 'To';
}

/**
 * Per-passenger price detail on a fare (Exchange Context Shopping path).
 *
 * Contains the per-passenger {@link passengerPriceDifference} block and,
 * when calculated, an attached {@link reaccommodationRule} indicating
 * whether the change fee or price difference is waived under a self-
 * service reaccommodation rule.
 */
export interface PassengerPriceDetail {
  /** Document number identifying the passenger. */
  documentNumber?: string;
  /** Passenger's first name. */
  givenName?: string;
  /** Passenger's last name. */
  surname?: string;
  /** ATPCO passenger type code (e.g., `ADT`). */
  typeCode?: string;
  /** Per-passenger price difference. */
  passengerPriceDifference?: PassengerPriceDifference;
  /** Self-service reaccommodation rule disposition. */
  reaccommodationRule?: ReaccommodationRule;
}

/**
 * Per-passenger price difference on an exchange.
 *
 * Same shape as {@link TotalPriceDifference} but scoped to one
 * passenger — used when individual passengers price in different
 * currencies, where a single aggregate doesn't make sense.
 */
export interface PassengerPriceDifference {
  /**
   * Difference disposition. `AddCollect` → consumer owes more,
   * `Even` → no change in price (typical when a fully refundable
   * fare swaps for an equivalent), `Refund` → refund due.
   */
  differenceType?: 'AddCollect' | 'Even' | 'Refund';
  /** Last day to ticket the solution (`YYYY-MM-DD`). */
  lastDayToTicket?: string;
  /** Total price difference for this passenger. */
  total?: AmountCurrency;
  /** Itemized breakdown — fare, tax, fees, non-refundable. */
  totalBreakdown?: PriceCalculationDetails;
}

/**
 * Aggregate price difference across all passengers on an exchange.
 *
 * The headline "what does this exchange cost?" answer. The interesting
 * fields are nested in {@link totalBreakdown}, which splits change fees
 * from other fees and reports the non-refundable amount.
 */
export interface TotalPriceDifference {
  /**
   * Difference disposition. `AddCollect` → additional collection,
   * `Even` → no charge (typical for fully refundable swaps),
   * `Refund` → refund due.
   */
  differenceType?: 'AddCollect' | 'Even' | 'Refund';
  /** Last day to ticket the solution (`YYYY-MM-DD`). */
  lastDayToTicket?: string;
  /** Total amount + currency. */
  total?: AmountCurrency;
  /** Itemized breakdown — fare, tax, fees, non-refundable. */
  totalBreakdown?: PriceCalculationDetails;
}

/**
 * Price-difference breakdown.
 *
 * `totalFees` is the load-bearing field for the fee story — Sabre
 * tags each entry with `feeType: 'ChangeFees' | 'OtherFees'`. A fully
 * refundable fare typically returns an empty `totalFees` (or a zero
 * `ChangeFees` entry); a penalty fare returns a populated `ChangeFees`
 * entry. The same code path covers both, so consumers never need to
 * branch on "is this refundable?".
 */
export interface PriceCalculationDetails {
  /** Fare difference between old and new itinerary. */
  fare?: AmountCurrency;
  /** Tax difference between old and new itinerary. */
  tax?: AmountCurrency;
  /**
   * Total change-in-fare and penalty fees, split by type. Empty when
   * Sabre reported no fees (typical for fully refundable swaps).
   */
  totalFees: readonly TotalFee[];
  /** Tax on the fees, when populated. */
  totalFeeTax?: AmountCurrency;
  /** Non-refundable amount when performing the exchange. */
  nonRefundableAmount?: AmountCurrency;
}

/** A single fee entry within {@link PriceCalculationDetails.totalFees}. */
export interface TotalFee {
  /** Fee amount. */
  amount?: string;
  /** ISO-4217 currency code. */
  currencyCode?: string;
  /** Number of decimal places in the currency. */
  decimalPlaces?: number;
  /**
   * Fee type. `ChangeFees` is the airline change/penalty fee — empty
   * or zero indicates a refundable / no-penalty exchange.
   */
  feeType?: 'ChangeFees' | 'OtherFees';
}

/** A monetary amount + ISO-4217 currency code. */
export interface AmountCurrency {
  /** Amount as a string with up to three decimal places. */
  amount?: string;
  /** ISO-4217 currency code (e.g., `USD`). */
  currencyCode?: string;
  /** Number of decimal places in the currency. */
  decimalPlaces?: number;
}

/**
 * Self-service reaccommodation rule disposition for a passenger.
 *
 * When Sabre evaluates `calculateReaccommodationRules: true`, this
 * surfaces whether change-fee / price-difference are waived under an
 * airline rule, and which rule ID granted the waiver.
 */
export interface ReaccommodationRule {
  /** True when the change fee is waived under a reaccommodation rule. */
  isChangeFeeWaived?: boolean;
  /** Rule ID(s) that granted the change-fee waiver. */
  changeFeeRuleId?: string;
  /** True when the price difference is waived under a reaccommodation rule. */
  isPriceDifferenceWaived?: boolean;
  /** Rule ID(s) that granted the price-difference waiver. */
  priceDifferenceRuleId?: string;
}

/**
 * A passenger's fare for the Interline Branded Fares search path.
 *
 * Only populated when `shoppingSource: 'InterlineBrandedFaresShopping'`.
 * Carries base fare, taxes, fees, and currency-conversion data. Heavy
 * detail; consumers using only Exchange Context Shopping can ignore.
 */
export interface FareType {
  /** Unique passenger fare ID for mapping back to booking detail. */
  passengerFareId?: string;
  /** ATPCO passenger type code (e.g., `ADT`). */
  passengerTypeCode?: string;
  /** Number of passengers of this type. */
  passengerQuantity?: number;
  /** Base fare. */
  baseFare?: AmountCurrency;
  /** Non-refundable portion of the base fare. */
  nonRefundableBaseFare?: AmountCurrency;
  /** Fare construction amount. */
  fareConstruction?: AmountCurrency;
  /** Equivalent fare in the payable currency. */
  equivalentFare?: EquivalentAmountCurrency;
  /** Tax detail. */
  taxes?: Taxes;
  /** Additional fees not shown on the ticket. */
  fees: readonly Fee[];
  /** OB fees. */
  obFees: readonly ObFee[];
  /** Exchange rate applied. */
  rateOfExchange?: number;
  /** Currency conversion entries. */
  currencyConversions: readonly Conversion[];
  /** Total fare for this passenger. */
  totalFare?: AmountCurrency;
  /** Per-leg fare detail. */
  legFares: readonly Leg[];
  /** Self-service reaccommodation rule disposition. */
  reaccommodationRule?: ReaccommodationRule;
}

/** Total fare for the Interline Branded Fares search path. */
export interface ExchangeTotalFare {
  /** Unique passenger fare ID for mapping. */
  passengerFareId?: string;
  /** ATPCO passenger type code. */
  passengerType?: string;
  /** Number of passengers of this type. */
  passengerQuantity?: number;
  /** Base fare. */
  baseFare?: AmountCurrency;
  /** Non-refundable portion of base fare. */
  nonRefundableBaseFare?: AmountCurrency;
  /** Fare construction amount. */
  fareConstruction?: AmountCurrency;
  /** Equivalent fare in payable currency. */
  equivFare?: EquivalentAmountCurrency;
  /** Tax detail. */
  taxes?: Taxes;
  /** Additional fees not shown on the ticket. */
  fees: readonly Fee[];
  /** OB fees. */
  obFees: readonly ObFee[];
  /** Exchange rate applied. */
  rateOfExchange?: number;
  /** Currency conversion entries. */
  currencyConversions: readonly Conversion[];
  /** Aggregate total fare. */
  totalFare?: AmountCurrency;
  /** Per-leg fare detail. */
  legFares: readonly Leg[];
}

/** Equivalent amount in the payable currency. */
export interface EquivalentAmountCurrency {
  /** Amount. */
  amount?: string;
  /** ISO-4217 currency code. */
  currencyCode?: string;
  /** Number of decimal places. */
  decimalPlaces?: number;
  /** Effective price deviation amount. */
  effectivePriceDeviation?: number;
  /** Whether the deviation is `Percentage` or `Amount`. */
  effectiveDeviationType?: 'Percentage' | 'Amount';
}

/** Tax detail block on a fare. */
export interface Taxes {
  /** Per-fare-component taxes. */
  fareComponentsTaxes: readonly FareComponentTaxes[];
  /** Per-leg taxes. */
  legsTaxes: readonly LegTaxes[];
  /** Individual tax line items. */
  taxes: readonly Tax[];
  /** Tax summary entries. */
  taxSummaries: readonly TaxSummary[];
  /** Aggregate total tax. */
  totalTax?: AmountCurrency;
}

/** Per-fare-component tax block. */
export interface FareComponentTaxes {
  /** Flight segments covered by this component. */
  flightSegments: readonly ExchangeFlightSegment[];
  /** Individual taxes. */
  taxes: readonly Tax[];
  /** Tax summary entries. */
  taxSummaries: readonly TaxSummary[];
}

/** A flight segment within a fare-component tax block. */
export interface ExchangeFlightSegment {
  /** Three-letter IATA departure airport code. */
  departureAirportCode?: string;
  /** Three-letter IATA arrival airport code. */
  arrivalAirportCode?: string;
}

/** Per-leg tax block. */
export interface LegTaxes {
  /** Individual taxes. */
  taxes: readonly Tax[];
  /** Tax summaries. */
  taxSummaries: readonly TaxSummary[];
  /** Leg number this block applies to. */
  legNumber?: number;
}

/** A single tax line item. */
export interface Tax {
  /** Tax code (e.g., `TOTALTAX`, `XF`). */
  code?: string;
  /** Tax amount. */
  amount?: AmountCurrency;
  /** Carrier this tax applies to. */
  airlineCode?: string;
  /** Minimum tax amount (for capped taxes). */
  minimumAmount?: number;
  /** Maximum tax amount. */
  maximumAmount?: number;
  /** Currency for min/max bounds. */
  currencyCode?: string;
  /** Tax rate applied. */
  rateUsed?: number;
  /** Station/airport code where the tax applies. */
  stationCode?: string;
  /** ISO-3166 country code where the tax originates. */
  countryCode?: string;
  /** True when this tax applies to a change fee. */
  hasTaxOnChangeFee?: boolean;
  /** True when the tax amount is refundable on exchange. */
  isRefundable?: boolean;
  /** Reissue-specific tax restrictions. */
  airTaxReissue?: AirTaxReissue;
}

/** Reissue-specific restrictions on a tax. */
export interface AirTaxReissue {
  /** Reissue tax type code. */
  code?: string;
  /** True when reissue restrictions apply. */
  hasRestriction?: boolean;
  /** True when the tax is refundable on reissue. */
  isRefundable?: boolean;
  /** True when "apply to reissue" applies. */
  shouldApplyToReissue?: boolean;
  /** Maximum reissue amount. */
  maximumAmount?: number;
  /** Currency for the reissue amount. */
  currencyCode?: string;
  /** Published amount. */
  publishedAmount?: number;
  /** Published currency. */
  publishedCurrencyCode?: string;
}

/** Tax summary entry. */
export interface TaxSummary {
  /** Tax code. */
  code?: string;
  /** Tax amount. */
  amount?: AmountCurrency;
  /** Station/airport code. */
  stationCode?: string;
  /** ISO-3166 country code. */
  countryCode?: string;
  /** Published amount. */
  publishedAmount?: number;
  /** Published currency. */
  publishedCurrencyCode?: string;
}

/** A fee (non-OB) attached to a fare. */
export interface Fee {
  /** Amount. */
  amount?: string;
  /** Currency code. */
  currencyCode?: string;
  /** Decimal places. */
  decimalPlaces?: number;
  /** Fee code. */
  feeCode?: string;
}

/** An OB (operator booking) fee. */
export interface ObFee {
  /** Amount. */
  amount?: string;
  /** Currency code. */
  currencyCode?: string;
  /** Decimal places. */
  decimalPlaces?: number;
  /** OB fee subtype code. */
  obFeeType?: string;
  /** OB fee description. */
  description?: string;
}

/** A currency conversion entry. */
export interface Conversion {
  /** Original currency. */
  from?: string;
  /** Converted currency. */
  to?: string;
  /** Exchange rate applied. */
  rateOfExchange?: number;
}

/** Per-leg fare detail (Interline Branded Fares path). */
export interface Leg {
  /** Base fare. */
  baseFare?: AmountCurrency;
  /** Equivalent fare in payable currency. */
  equivFare?: EquivalentAmountCurrency;
  /** Individual taxes. */
  taxes: readonly Tax[];
  /** Total fare for this leg. */
  totalFare?: AmountCurrency;
  /** Leg number. */
  number?: number;
}

/**
 * A response message Sabre attached to the 200 envelope
 * (`warnings` or `errors`).
 *
 * SEAS reports application-layer errors here on a 200 response —
 * "ineligible PNR", "no eligible documents", etc. Distinct from
 * 4xx/5xx transport errors which surface as `SabreApiResponseError`.
 */
export interface ResponseMessage {
  /** General category of the message (e.g., `BAD_REQUEST`). */
  category?: string;
  /** Type/class of the message (e.g., `REQUIRED_FIELD_MISSING`). */
  type?: string;
  /** Human-readable description. */
  description?: string;
  /** Object/value path that triggered the message. */
  fieldPath?: string;
  /** Field name that triggered the message. */
  fieldName?: string;
  /** Source field value. */
  fieldValue?: string;
}
