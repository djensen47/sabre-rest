/**
 * Public input/output types for the Bargain Finder Max v5 service.
 *
 * Hand-written intentionally — not derived from `src/generated/`. The
 * generated types are kept internal so consumer-facing types stay stable
 * across spec changes and use idiomatic TypeScript naming.
 *
 * BFM is a large API; this v1 of the public surface deliberately covers
 * only the common low-fare-search use case (origin/destination, dates,
 * passenger types, basic preferences) and the corresponding priced
 * itinerary results. Less-common features (NDC brand programs, baggage
 * subcategories, Universal Product Attributes, exchange/reissue, handling
 * markups, statistics) are intentionally omitted and may be added later
 * non-breakingly.
 */

/**
 * Input to {@link BargainFinderMaxV5Service.search}.
 *
 * Models a low-fare shop request: one or more origin/destination legs,
 * one or more passenger groups, and a point-of-sale identifier. Optional
 * travel preferences narrow the result set.
 */
export interface SearchBargainFinderMaxInput {
  /**
   * Trip legs in order. One entry for a one-way, two for a round-trip,
   * more for multi-city. Sabre permits up to 10 entries.
   */
  originDestinations: readonly OriginDestination[];

  /**
   * Passenger groups, keyed by Sabre passenger type code (e.g., `ADT`,
   * `CHD`, `INF`). At least one entry is required.
   */
  passengers: readonly PassengerCount[];

  /**
   * Point-of-sale identifier. BFM requires the requesting agency's
   * company code; some configurations also require a pseudo city code.
   */
  pointOfSale: PointOfSale;

  /**
   * Optional shopping preferences. Omit for an unconstrained search.
   */
  travelPreferences?: TravelPreferences;
}

/** A single origin/destination leg of the shop request. */
export interface OriginDestination {
  /**
   * Three-character IATA code for the origin (airport or city). Sabre
   * defaults to city when ambiguous.
   */
  from: string;
  /** Three-character IATA code for the destination. */
  to: string;
  /**
   * Local departure date or date-time in ISO 8601 form. The Sabre API
   * accepts either `YYYY-MM-DD` or `YYYY-MM-DDTHH:MM:SS`; the value is
   * passed through verbatim.
   */
  departureDateTime: string;
  /**
   * Optional arrival date-time. Mutually exclusive with
   * {@link departureDateTime} on Sabre's side; supply only when you need
   * to anchor on arrival rather than departure.
   */
  arrivalDateTime?: string;
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
 * Both fields are optional because Sabre's BFM v5 spec marks every
 * field of `RequestorID` other than `ID` and `Type` (which the library
 * fills in with the documented "not used for processing" value of `1`)
 * as optional. Supply only the fields your account actually requires.
 */
export interface PointOfSale {
  /**
   * Two-character ATA/IATA company code identifying the requesting
   * agency (e.g., `TN`). Optional per the spec — the field maps to the
   * OTA `RequestorID/CompanyName/Code` element, which Sabre marks as
   * not required. Sabre's runtime may still demand it for some account
   * types; supply it if your shop requests are rejected without it.
   */
  companyCode?: string;
  /**
   * Optional four-character pseudo city code (PCC) for agencies that
   * book through a specific Sabre office. Maps to the OTA
   * `Source/PseudoCityCode` element.
   */
  pseudoCityCode?: string;
}

/** Optional shopping preferences. */
export interface TravelPreferences {
  /** Preferred cabin class for all legs. */
  cabin?: CabinClass;
  /**
   * Restrict shopping to these marketing carriers (two-letter IATA
   * codes). All listed carriers are marked as `Preferred`.
   */
  preferredCarriers?: readonly string[];
  /**
   * Maximum number of stops permitted on each leg. Mutually exclusive
   * with {@link nonStopOnly}; supplying both is a programming error and
   * `nonStopOnly` wins.
   */
  maxStopsPerLeg?: number;
  /**
   * If true, only non-stop itineraries are returned (equivalent to
   * `maxStopsPerLeg: 0`).
   */
  nonStopOnly?: boolean;
}

/**
 * Sabre cabin class identifiers. The long-form names match Sabre's OAS
 * enum exactly; consumers should prefer these over the single-letter
 * shortcuts (`Y`, `C`, `F`) which Sabre also accepts but which read
 * less well at the call site.
 */
export type CabinClass =
  | 'PremiumFirst'
  | 'First'
  | 'PremiumBusiness'
  | 'Business'
  | 'PremiumEconomy'
  | 'Economy';

/**
 * Result of {@link BargainFinderMaxV5Service.search}.
 *
 * Every field on the response-side types below is optional, including
 * fields Sabre's spec marks as required. The library does not invent its
 * own required-field rubric and does not drop records based on which
 * fields are populated — every itinerary, every leg, every segment, and
 * every endpoint Sabre returned is preserved exactly as Sabre returned
 * it. Consumers should defensively handle `undefined` values, and any
 * decision about whether an undercooked record is "useful enough" to
 * display, sell, or filter belongs in the consumer's code.
 */
export interface SearchBargainFinderMaxOutput {
  /**
   * Priced itineraries Sabre returned, in the order they appeared in
   * the response. Empty when no priced options match the search.
   */
  itineraries: readonly PricedItinerary[];
  /**
   * Server messages from the response (informational, warning, etc.).
   * BFM frequently surfaces non-fatal diagnostics here even on a
   * successful response — inspect them for context but do not treat
   * their presence as a failure.
   */
  messages: readonly SabreMessage[];
}

/** A priced itinerary returned by Bargain Finder Max. */
export interface PricedItinerary {
  /** Sabre's sequence id for the itinerary within the response, when populated. */
  id?: number;
  /**
   * Itinerary legs in trip order. Each entry corresponds to one of the
   * input {@link OriginDestination} legs. Empty when Sabre returned no
   * leg references.
   */
  legs: readonly ItineraryLeg[];
  /** Total fare across all passengers, when Sabre populated it. */
  totalFare?: TotalFare;
  /**
   * Validating carrier code, when Sabre populated it on the priced
   * fare.
   */
  validatingCarrierCode?: string;
  /**
   * Content distribution model — `ATPCO` (traditional published fares),
   * `NDC` (New Distribution Capability), or `API` (carrier-hosted API
   * content).
   */
  distributionModel?: 'ATPCO' | 'NDC' | 'API';
}

/** A single leg of an itinerary, made up of zero or more flight segments. */
export interface ItineraryLeg {
  /**
   * Sabre's `LegDesc` reference id from the itinerary. Present whenever
   * Sabre's itinerary entry carried a `ref`, even if the leg description
   * itself wasn't found in the response — preserving the orphaned ref so
   * consumers can see and report it instead of having it silently
   * disappear.
   */
  ref?: number;
  /**
   * Total elapsed travel time for the leg in minutes (Sabre's GIR-format
   * elapsed time). Absent when Sabre did not report it.
   */
  elapsedMinutes?: number;
  /**
   * Flight segments in operating order. Empty when Sabre returned no
   * schedule references for the leg, or when none of the references
   * resolved (in which case the unresolved schedule ids appear on the
   * segments via {@link FlightSegment.ref}).
   */
  segments: readonly FlightSegment[];
}

/**
 * A single flight segment within an itinerary leg.
 *
 * BFM exposes booking class and cabin code per *fare* rather than per
 * schedule, so this v1 surface intentionally omits them — surfacing the
 * fare-level RBD requires choosing a fare offer to attribute, which is
 * a separate design decision. Schedule-level information (carrier,
 * flight number, times, terminals) is included.
 */
export interface FlightSegment {
  /**
   * Sabre's `ScheduleDesc` reference id. Present whenever Sabre's
   * schedule entry carried a `ref`, even if the schedule description
   * itself wasn't found in the response — preserving the orphaned ref
   * so consumers can see and report it instead of having it silently
   * disappear.
   */
  ref?: number;
  /** Marketing carrier IATA code, when populated. */
  marketingCarrier?: string;
  /** Marketing flight number, when populated. */
  marketingFlightNumber?: number;
  /**
   * Operating carrier IATA code, when present and different from the
   * marketing carrier (i.e., a code-shared flight).
   */
  operatingCarrier?: string;
  /** Operating flight number, when Sabre reported one. */
  operatingFlightNumber?: number;
  /** Departure information, when Sabre populated it. */
  departure?: SegmentEndpoint;
  /** Arrival information, when Sabre populated it. */
  arrival?: SegmentEndpoint;
  /**
   * Elapsed segment time in minutes (Sabre's GIR format). Absent when
   * Sabre did not report it.
   */
  elapsedMinutes?: number;
  /**
   * Number of intermediate stops on this segment, when Sabre reported
   * it. Most non-stop segments report `0` or omit the field entirely.
   */
  stopCount?: number;
  /**
   * Schedule-level booking class (RBD) from `bookingDetails.classOfService`,
   * when present. This is the schedule's default RBD; the actual booking
   * class for a priced fare may differ.
   */
  scheduleBookingClass?: string;
}

/** Departure or arrival point for a flight segment. */
export interface SegmentEndpoint {
  /** Three-letter IATA airport code, when populated. */
  airport?: string;
  /**
   * Local time of departure or arrival, as Sabre returned it. Format
   * varies by content source (e.g., `12:40:00`, `12:40:00+04:00`).
   */
  time?: string;
  /**
   * Days the calendar date should shift relative to the leg start (for
   * overnight or multi-day itineraries). Absent when zero or unreported.
   */
  dateAdjustment?: number;
  /** Terminal name, when reported. */
  terminal?: string;
}

/** Total fare for a priced itinerary, across all passengers. */
export interface TotalFare {
  /** Total price across all passengers and legs, when populated. */
  totalAmount?: number;
  /** ISO 4217 currency code for {@link totalAmount} and {@link totalTaxAmount}, when populated. */
  currency?: string;
  /**
   * Base fare amount (before taxes), when Sabre reported it. Currency
   * is given by {@link baseFareCurrency} when different from
   * {@link currency}.
   */
  baseFareAmount?: number;
  /** Currency for {@link baseFareAmount}, when different from {@link currency}. */
  baseFareCurrency?: string;
  /** Total taxes in {@link currency}, when reported. */
  totalTaxAmount?: number;
}

/** A single message from the BFM response envelope. */
export interface SabreMessage {
  /**
   * Message severity. Sabre commonly returns `Info`, `Warning`, `Error`,
   * `Diagnostic`, or `Header`.
   */
  severity?: string;
  /** Sabre message code, when populated. */
  code?: string;
  /** Message text. */
  text?: string;
}
