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
 * itinerary results. Less-common features (NDC brand programs, Universal
 * Product Attributes, exchange/reissue, handling markups, statistics, fare
 * rules, change/refund penalties, tax breakdowns, baggage charges,
 * alternate-date flavors) are intentionally omitted and may be added later
 * non-breakingly.
 *
 * Baggage *allowances* are surfaced per-passenger on each fare offer;
 * baggage *charges* (the "pay $X for your 2nd bag" side of the data) remain
 * deferred.
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
   * Local departure date and time in the form `YYYY-MM-DDTHH:MM:SS`,
   * with no timezone. This is the canonical format Sabre's BFM v5
   * schema accepts (`example: '2024-12-25T06:00:00'`); a date-only
   * value like `'2025-12-25'` is rejected at the schema level. The
   * library passes this string through verbatim — no normalization,
   * no validation. Callers that want to accept friendlier shapes
   * should normalize at their boundary; the `sabre-rest` CLI bundled
   * with this package does that for command-line input.
   */
  departureDateTime: string;
  /**
   * Optional local arrival date and time, same `YYYY-MM-DDTHH:MM:SS`
   * format as {@link departureDateTime}. Mutually exclusive with
   * `departureDateTime` on Sabre's side — supply only when you need
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
  /**
   * All fare offers Sabre returned for this itinerary, in wire order. Each
   * entry corresponds to one `pricingInformation` entry in the response.
   * Most responses carry a single offer; alternate pricing flavors can
   * produce multiple. The top-level {@link totalFare},
   * {@link validatingCarrierCode}, and {@link distributionModel} fields on
   * this itinerary mirror `fareOffers[0]` for the common single-offer case
   * and are preserved as a convenience for consumers that don't need the
   * per-passenger breakdown.
   */
  fareOffers: readonly FareOffer[];
}

/**
 * A single fare offer on a priced itinerary.
 *
 * Each entry in {@link PricedItinerary.fareOffers} corresponds to one
 * `pricingInformation` entry in the wire response. A single itinerary can
 * carry multiple offers when Sabre returns alternate pricing flavors — the
 * library surfaces all of them in wire order and does not dedupe.
 */
export interface FareOffer {
  /**
   * Per-passenger fare detail. One entry per priced passenger. Sabre's
   * "passenger not available" stubs (no fare for a requested passenger type)
   * are skipped rather than emitted as empty entries.
   */
  passengerFares: readonly PassengerFare[];
  /**
   * Aggregate total fare across all passengers for this offer, when
   * populated. For the first offer this value mirrors the top-level
   * {@link PricedItinerary.totalFare}.
   */
  totalFare?: TotalFare;
  /** Validating carrier for this offer, when populated. */
  validatingCarrierCode?: string;
  /** Content model for this offer, when populated. */
  distributionModel?: 'ATPCO' | 'NDC' | 'API';
}

/**
 * Per-passenger fare detail within a {@link FareOffer}.
 *
 * Captures the fare basis code, booking classes per segment, and baggage
 * allowances that Sabre filed for this passenger on this offer.
 */
export interface PassengerFare {
  /**
   * Sabre passenger type code, e.g. `ADT`, `CHD`, `INF`. Absent only when
   * Sabre omitted the field entirely (shouldn't happen in practice — the
   * generated spec marks it required — but the library never fabricates).
   */
  passengerType?: string;
  /** Sabre's passenger number within the offer, when populated. */
  passengerNumber?: number;
  /**
   * Number of passengers of this type covered by this fare entry, when
   * Sabre populated it.
   */
  passengerCount?: number;
  /**
   * Flat per-passenger total fare, when populated. This is distinct from
   * {@link FareOffer.totalFare} (which sums across all passengers) — the
   * wire shapes the two differently and the library preserves both.
   */
  total?: PassengerTotal;
  /** Last date to ticket (`YYYY-MM-DD`), when populated. */
  lastTicketDate?: string;
  /** Last time to ticket (`HH:MM`), when populated. */
  lastTicketTime?: string;
  /** True when Sabre marked the fare as non-refundable. */
  nonRefundable?: boolean;
  /**
   * Fare components in pricing order. Each component covers a contiguous
   * chunk of the journey (often one origin/destination), with its own fare
   * basis code and per-segment booking classes. Empty when Sabre returned
   * no components.
   */
  fareComponents: readonly FareComponent[];
  /**
   * Baggage allowances attached to this passenger, in wire order. Empty
   * when Sabre returned none.
   */
  baggageAllowances: readonly BaggageAllowance[];
}

/**
 * Flat per-passenger total fare.
 *
 * Distinct shape from {@link TotalFare} because the wire uses a flat
 * `totalFare: number` here rather than the nested `totalPrice?: number` used
 * at the offer level.
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
 *
 * Sabre files fares per contiguous chunk of journey (typically one
 * origin/destination). Each component carries a fare basis code plus
 * per-segment booking classes.
 *
 * The library does **not** correlate a fare component's segments back to
 * {@link ItineraryLeg.segments} because the wire provides no reliable way
 * to do so: segments are matched only by position and ARUNK (surface)
 * entries can offset the index. Consumers that need to zip fare detail
 * onto flight segments should use the component's {@link beginAirport} and
 * {@link endAirport} plus the per-segment order.
 */
export interface FareComponent {
  /** Fare basis code (e.g. `TKEE4M`), when populated. */
  fareBasisCode?: string;
  /**
   * Cabin code as filed on the fare (e.g. `Y`, `C`, `F`), when populated.
   * This is the component-level default; individual segments may carry
   * their own {@link FareComponentSegment.cabinCode} override.
   */
  cabinCode?: string;
  /** Governing carrier IATA code, when populated. */
  governingCarrier?: string;
  /**
   * Passenger type this fare was filed for (e.g. `ADT`), when populated.
   * May differ from the enclosing {@link PassengerFare.passengerType} when
   * Sabre applied a pricing substitution.
   */
  farePassengerType?: string;
  /** IATA code of the first airport covered by the component, when populated. */
  beginAirport?: string;
  /** IATA code of the last airport covered by the component, when populated. */
  endAirport?: string;
  /**
   * Per-segment detail in wire order. Empty when Sabre returned no
   * segments, or when every segment was an ARUNK (surface) entry — the
   * library skips surface entries because they have no booking data.
   */
  segments: readonly FareComponentSegment[];
}

/** Per-segment fare detail within a {@link FareComponent}. */
export interface FareComponentSegment {
  /**
   * Booking class (RBD) Sabre assigned to this segment for this fare,
   * when populated. This is the per-fare RBD — the {@link
   * FlightSegment.scheduleBookingClass} value from the schedule side is
   * the schedule's default RBD and may differ.
   */
  bookingCode?: string;
  /** Cabin code (e.g. `Y`, `B`) for this segment, when populated. */
  cabinCode?: string;
  /** Meal code, when populated. */
  mealCode?: string;
}

/**
 * Baggage allowance attached to a priced passenger.
 *
 * Baggage *charges* (the "pay $X for the 2nd bag" side of the data) are
 * intentionally omitted from this v1 surface and may be added later
 * non-breakingly.
 */
export interface BaggageAllowance {
  /**
   * 0-based itinerary-wide segment indices this allowance covers, in wire
   * order. Sabre indexes across the entire itinerary (flat), not per leg —
   * the library passes the index values through verbatim without any
   * leg-relative translation.
   */
  segmentIndices: readonly number[];
  /** Airline that owns the baggage (IATA code), when populated. */
  airlineCode?: string;
  /**
   * Provision type code passed through from the wire. The common value is
   * `A` (check-in allowance); other provision types (`C` = day-of-checkin
   * charges, etc.) appear when Sabre returns the full set — consumers that
   * only want the included-in-fare allowance should filter on `A`.
   */
  provisionType?: string;
  /** Total pieces allowed, when populated. */
  pieceCount?: number;
  /** Total allowed weight, when populated. */
  weight?: number;
  /** Weight unit — Sabre returns `lbs` or `kg`. */
  weightUnit?: string;
  /**
   * Free-text description lines exactly as Sabre returned them (may
   * include dimensions, carrier-specific rules). Empty when Sabre sent
   * none. Lines are preserved in wire order.
   */
  descriptions: readonly string[];
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
