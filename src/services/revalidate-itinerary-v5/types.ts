/**
 * Public input/output types for the Revalidate Itinerary v5 service.
 *
 * Hand-written intentionally — not derived from `src/generated/`. The
 * generated types are kept internal so consumer-facing types stay stable
 * across spec changes and use idiomatic TypeScript naming.
 *
 * Revalidate Itinerary rechecks availability and pricing for a specific
 * itinerary option without booking it. Unlike BFM (an open-ended shop),
 * revalidation takes exact flight details and confirms whether the
 * itinerary is still valid for purchase at the returned price.
 *
 * NDC content is not supported by Revalidate Itinerary.
 *
 * ## Why these types are duplicated with Bargain Finder Max v5
 *
 * Revalidate Itinerary and BFM share a wire format (Sabre's GIR —
 * Grouped Itinerary Response), so 14 of the public types declared
 * here are structurally identical to the same-named types in
 * `src/services/bargain-finder-max-v5/types.ts`:
 *
 * `PassengerCount`, `PassengerFare`, `PricedItinerary`, `FareComponent`,
 * `FareComponentSegment`, `Tax`, `BaggageAllowance`, `BaggageCharge`,
 * `ItineraryLeg`, `FlightSegment`, `SegmentEndpoint`, `TotalFare`,
 * `PointOfSale`, `FareOffer`, `SabreMessage`.
 *
 * The duplication is intentional, not drift. Each spec defines these
 * shapes as independent inline schemas under its own operations — there
 * are no cross-spec `$ref`s — so per `docs/architecture.md` "Public
 * type design rule #1" ("same `$ref` → share; same shape today → don't
 * trust it"), the two services must each own their copy. The two
 * surfaces are free to evolve independently; if BFM grows a new field
 * or Revalidate loosens a type for a cert-observed quirk, neither
 * change should ripple into the other service. Sharing by coincidence
 * would hide that future divergence.
 */

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

/**
 * Input to {@link RevalidateItineraryV5Service.revalidate}.
 *
 * Models a revalidation request: one or more origin/destination legs
 * with exact flight details, one or more passenger groups, and a
 * point-of-sale identifier.
 */
export interface RevalidateItineraryInput {
  /**
   * Trip legs in order, each containing the exact flights to revalidate.
   * One entry for a one-way, two for a round-trip, more for multi-city.
   * Sabre permits up to 10 entries.
   */
  originDestinations: readonly RevalidateOriginDestination[];

  /**
   * Passenger groups, keyed by Sabre passenger type code (e.g., `ADT`,
   * `CHD`, `INF`). At least one entry is required.
   */
  passengers: readonly PassengerCount[];

  /**
   * Point-of-sale identifier. The requesting agency's company code and
   * optional pseudo city code.
   */
  pointOfSale: PointOfSale;
}

/**
 * A single origin/destination leg with the exact flights to revalidate.
 *
 * Unlike BFM's open-ended search, revalidation requires specifying the
 * precise flight segments via {@link flights}.
 */
export interface RevalidateOriginDestination {
  /**
   * Three-character IATA code for the origin (airport or city).
   */
  from: string;

  /** Three-character IATA code for the destination. */
  to: string;

  /**
   * Local departure date and time in the form `YYYY-MM-DDTHH:MM:SS`,
   * with no timezone. The library passes this string through verbatim.
   */
  departureDateTime: string;

  /**
   * The exact flight segments to revalidate on this leg. At least one
   * flight is required. For a connecting itinerary, list each segment
   * in order.
   *
   * These map to the OTA `TPA_Extensions/Flight` elements on each
   * `OriginDestinationInformation` entry.
   */
  flights: readonly RevalidateFlight[];
}

/**
 * A single flight segment to revalidate within an origin/destination leg.
 *
 * All fields that Sabre marks as required on the
 * `TPA_Extensions.Flight` element are required here. Optional fields
 * (like {@link classOfService}) enable additional Sabre validation
 * paths when provided.
 */
export interface RevalidateFlight {
  /**
   * Three-character IATA code for the segment's departure airport.
   */
  from: string;

  /** Three-character IATA code for the segment's arrival airport. */
  to: string;

  /**
   * Marketing carrier IATA code (e.g., `AA`, `BA`). Required by Sabre.
   */
  marketingCarrier: string;

  /**
   * Operating carrier IATA code, when different from the marketing
   * carrier. Optional — omit for non-codeshare flights.
   */
  operatingCarrier?: string;

  /**
   * Flight number. Required by Sabre.
   */
  flightNumber: number;

  /**
   * Local departure date and time in `YYYY-MM-DDTHH:MM:SS` format.
   * Required by Sabre.
   */
  departureDateTime: string;

  /**
   * Local arrival date and time in `YYYY-MM-DDTHH:MM:SS` format.
   * Required by Sabre.
   */
  arrivalDateTime: string;

  /**
   * Booking class (Reservation Booking Designator), e.g. `Y`, `J`, `M`.
   * When provided, Sabre uses the verification path to check whether
   * this specific class of service is still available. Optional per the
   * spec but recommended for accurate revalidation results.
   */
  classOfService?: string;

  /**
   * Flight type. `A` = Air (default), `K` = ARUNK (surface segment),
   * `O` = Open. The spec defaults to `A`; omit unless the segment is
   * not a normal air leg.
   */
  type?: 'A' | 'K' | 'O';
}

/** Number of passengers of a given Sabre passenger type code. */
export interface PassengerCount {
  /**
   * Sabre passenger type code (PTC). Common values: `ADT` (adult),
   * `CHD` (child), `INF` (infant in lap), `INS` (infant in seat).
   */
  type: string;
  /** Number of passengers of this type. Sabre accepts 1 through 9. */
  quantity: number;
}

/**
 * Point-of-sale identification carried in the OTA `POS/Source` element.
 *
 * Both fields are optional because Sabre's spec marks every field of
 * `RequestorID` other than `ID` and `Type` (which the library fills in
 * with the documented "not used for processing" value of `1`) as
 * optional. Supply only the fields your account actually requires.
 */
export interface PointOfSale {
  /**
   * Two-character ATA/IATA company code identifying the requesting
   * agency (e.g., `TN`). Optional per the spec — the field maps to the
   * OTA `RequestorID/CompanyName/Code` element.
   */
  companyCode?: string;

  /**
   * Optional four-character pseudo city code (PCC) for agencies that
   * book through a specific Sabre office.
   */
  pseudoCityCode?: string;
}

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

/**
 * Result of {@link RevalidateItineraryV5Service.revalidate}.
 *
 * Every field on the response-side types below is optional, including
 * fields Sabre's spec marks as required. The library does not invent its
 * own required-field rubric and does not drop records based on which
 * fields are populated — every itinerary, every leg, every segment, and
 * every endpoint Sabre returned is preserved exactly as Sabre returned
 * it. Consumers should defensively handle `undefined` values.
 */
export interface RevalidateItineraryOutput {
  /**
   * Priced itineraries Sabre returned, in the order they appeared in
   * the response. Empty when the itinerary is no longer valid.
   */
  itineraries: readonly PricedItinerary[];

  /**
   * Server messages from the response (informational, warning, etc.).
   * Revalidate Itinerary frequently surfaces non-fatal diagnostics
   * here even on a successful response — inspect them for context but
   * do not treat their presence as a failure.
   */
  messages: readonly SabreMessage[];
}

/** A priced itinerary returned by Revalidate Itinerary. */
export interface PricedItinerary {
  /** Sabre's sequence id for the itinerary within the response, when populated. */
  id?: number;

  /**
   * Itinerary legs in trip order. Each entry corresponds to one of the
   * input {@link RevalidateOriginDestination} legs.
   */
  legs: readonly ItineraryLeg[];

  /** Total fare across all passengers, when Sabre populated it. */
  totalFare?: TotalFare;

  /** Validating carrier code, when Sabre populated it on the priced fare. */
  validatingCarrierCode?: string;

  /**
   * Content distribution model — `ATPCO` (traditional published fares)
   * or `API` (carrier-hosted API content). NDC is not supported by
   * Revalidate Itinerary.
   */
  distributionModel?: 'ATPCO' | 'NDC' | 'API';

  /**
   * All fare offers Sabre returned for this itinerary, in wire order.
   * Most revalidation responses carry a single offer. The top-level
   * {@link totalFare}, {@link validatingCarrierCode}, and
   * {@link distributionModel} fields mirror `fareOffers[0]` for
   * convenience.
   */
  fareOffers: readonly FareOffer[];
}

/**
 * A single fare offer on a priced itinerary.
 */
export interface FareOffer {
  /**
   * Per-passenger fare detail. One entry per priced passenger.
   */
  passengerFares: readonly PassengerFare[];

  /** Aggregate total fare across all passengers for this offer, when populated. */
  totalFare?: TotalFare;

  /** Validating carrier for this offer, when populated. */
  validatingCarrierCode?: string;

  /** Content model for this offer, when populated. */
  distributionModel?: 'ATPCO' | 'NDC' | 'API';
}

/**
 * Per-passenger fare detail within a {@link FareOffer}.
 */
export interface PassengerFare {
  /** Sabre passenger type code, e.g. `ADT`, `CHD`, `INF`. */
  passengerType?: string;

  /** Sabre's passenger number within the offer, when populated. */
  passengerNumber?: number;

  /** Number of passengers of this type covered by this fare entry. */
  passengerCount?: number;

  /** Flat per-passenger total fare, when populated. */
  total?: PassengerTotal;

  /** Last date to ticket (`YYYY-MM-DD`), when populated. */
  lastTicketDate?: string;

  /** Last time to ticket (`HH:MM`), when populated. */
  lastTicketTime?: string;

  /** True when Sabre marked the fare as non-refundable. */
  nonRefundable?: boolean;

  /** Fare components in pricing order. */
  fareComponents: readonly FareComponent[];

  /** Baggage allowances attached to this passenger, in wire order. */
  baggageAllowances: readonly BaggageAllowance[];

  /** Baggage charges attached to this passenger, in wire order. */
  baggageCharges: readonly BaggageCharge[];

  /** Individual tax line items for this passenger, in wire order. */
  taxes: readonly Tax[];
}

/**
 * Flat per-passenger total fare.
 */
export interface PassengerTotal {
  /** Total fare for this passenger, when populated. */
  totalAmount?: number;
  /** ISO 4217 currency code, when populated. */
  currency?: string;
  /** Base fare amount before taxes, when populated. */
  baseFareAmount?: number;
  /** Currency for {@link baseFareAmount}, when different from {@link currency}. */
  baseFareCurrency?: string;
  /** Total taxes, when populated. */
  totalTaxAmount?: number;
}

/**
 * A single fare component within a {@link PassengerFare}.
 */
export interface FareComponent {
  /** Fare basis code (e.g. `TKEE4M`), when populated. */
  fareBasisCode?: string;
  /** Cabin code as filed on the fare (e.g. `Y`, `C`, `F`), when populated. */
  cabinCode?: string;
  /** Governing carrier IATA code, when populated. */
  governingCarrier?: string;
  /** Passenger type this fare was filed for (e.g. `ADT`), when populated. */
  farePassengerType?: string;
  /** IATA code of the first airport covered by the component, when populated. */
  beginAirport?: string;
  /** IATA code of the last airport covered by the component, when populated. */
  endAirport?: string;
  /** Per-segment detail in wire order. */
  segments: readonly FareComponentSegment[];
}

/** Per-segment fare detail within a {@link FareComponent}. */
export interface FareComponentSegment {
  /** Booking class (RBD) Sabre assigned to this segment for this fare. */
  bookingCode?: string;
  /** Cabin code (e.g. `Y`, `B`) for this segment, when populated. */
  cabinCode?: string;
  /** Meal code, when populated. */
  mealCode?: string;
}

/** Baggage allowance attached to a priced passenger. */
export interface BaggageAllowance {
  /** 0-based itinerary-wide segment indices this allowance covers. */
  segmentIndices: readonly number[];
  /** Airline that owns the baggage (IATA code), when populated. */
  airlineCode?: string;
  /** Provision type code (e.g. `A` = check-in allowance). */
  provisionType?: string;
  /** Total pieces allowed, when populated. */
  pieceCount?: number;
  /** Total allowed weight, when populated. */
  weight?: number;
  /** Weight unit — Sabre returns `lbs` or `kg`. */
  weightUnit?: string;
  /** Free-text description lines, in wire order. */
  descriptions: readonly string[];
}

/**
 * Baggage charge for a specific piece range, attached to a priced passenger.
 */
export interface BaggageCharge {
  /** 0-based itinerary-wide segment indices this charge covers. */
  segmentIndices: readonly number[];
  /** Airline that owns the baggage (IATA code), when populated. */
  airlineCode?: string;
  /** Provision type code from the wire (e.g. `C` for charges). */
  provisionType?: string;
  /** First piece number this charge applies to. */
  firstPiece?: number;
  /** Last piece number this charge applies to. */
  lastPiece?: number;
  /** Charge amount, when populated. */
  amount?: number;
  /** ISO 4217 currency code for the charge, when populated. */
  currency?: string;
  /**
   * Status code when charges are unavailable or free. Values: `X` = not
   * available, `F` = free (no EMD), `E` = free (EMD issued), `G` = free
   * (no booking required, no EMD), `H` = free (no booking required, EMD
   * issued).
   */
  noChargeNotAvailable?: string;
  /** Free-text description lines from the wire, in order. */
  descriptions: readonly string[];
}

/** A single tax line item on a priced passenger. */
export interface Tax {
  /** Tax code (e.g. `US`, `XF`, `YC`), when populated. */
  code?: string;
  /** Tax amount, when populated. */
  amount?: number;
  /** ISO 4217 currency code, when populated. */
  currency?: string;
  /** Two-letter country code where the tax originates, when populated. */
  country?: string;
  /** Descriptive text for the tax, when populated. */
  description?: string;
  /** Station/airport code where the tax applies, when populated. */
  station?: string;
  /** Published tax amount before currency conversion, when populated. */
  publishedAmount?: number;
  /** Published tax currency, when different from {@link currency}. */
  publishedCurrency?: string;
}

/** A single leg of an itinerary, made up of zero or more flight segments. */
export interface ItineraryLeg {
  /** Sabre's `LegDesc` reference id from the itinerary. */
  ref?: number;
  /** Total elapsed travel time for the leg in minutes. */
  elapsedMinutes?: number;
  /** Flight segments in operating order. */
  segments: readonly FlightSegment[];
}

/** A single flight segment within an itinerary leg. */
export interface FlightSegment {
  /** Sabre's `ScheduleDesc` reference id. */
  ref?: number;
  /** Marketing carrier IATA code, when populated. */
  marketingCarrier?: string;
  /** Marketing flight number, when populated. */
  marketingFlightNumber?: number;
  /** Operating carrier IATA code, when present and different from marketing. */
  operatingCarrier?: string;
  /** Operating flight number, when Sabre reported one. */
  operatingFlightNumber?: number;
  /** Departure information, when Sabre populated it. */
  departure?: SegmentEndpoint;
  /** Arrival information, when Sabre populated it. */
  arrival?: SegmentEndpoint;
  /** Elapsed segment time in minutes. */
  elapsedMinutes?: number;
  /** Number of intermediate stops on this segment. */
  stopCount?: number;
  /** Schedule-level booking class (RBD), when present. */
  scheduleBookingClass?: string;
}

/** Departure or arrival point for a flight segment. */
export interface SegmentEndpoint {
  /** Three-letter IATA airport code, when populated. */
  airport?: string;
  /** Local time, as Sabre returned it. */
  time?: string;
  /** Days the date shifts relative to the leg start (overnight flights). */
  dateAdjustment?: number;
  /** Terminal name, when reported. */
  terminal?: string;
}

/** Total fare for a priced itinerary, across all passengers. */
export interface TotalFare {
  /** Total price across all passengers and legs, when populated. */
  totalAmount?: number;
  /** ISO 4217 currency code, when populated. */
  currency?: string;
  /** Base fare amount (before taxes), when Sabre reported it. */
  baseFareAmount?: number;
  /** Currency for {@link baseFareAmount}, when different from {@link currency}. */
  baseFareCurrency?: string;
  /** Total taxes, when reported. */
  totalTaxAmount?: number;
}

/** A single message from the response envelope. */
export interface SabreMessage {
  /** Message severity (`Info`, `Warning`, `Error`, `Diagnostic`, etc.). */
  severity?: string;
  /** Sabre message code, when populated. */
  code?: string;
  /** Message text. */
  text?: string;
}
