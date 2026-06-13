/**
 * Public input/output types for the Flight Reshop v1.0 service.
 *
 * Hand-written intentionally — not derived from `src/generated/`. The
 * generated types are kept internal so consumer-facing types stay
 * stable across spec changes and use idiomatic TypeScript naming.
 *
 * ## What this API does
 *
 * `POST /v1/offers/flightReshop` is the REST replacement for the legacy
 * `ExchangeShoppingRQ` SOAP service. Given an existing ticket (or
 * booking) plus the journeys the traveler wants to change to, it
 * returns a list of **priceable reissue offers** — each with the fare
 * difference, change fee, and the new flights — so the caller can show
 * "if you change to flight X, the new price is $Y" without guessing
 * fares that later fail Category-31 pricing.
 *
 * It is a **read-only shopping call**: it does not cancel, rebook,
 * reissue, or otherwise mutate the PNR. Pair it with Exchange Booking
 * (to commit the reissue) and Fulfill Flight Tickets (to issue).
 *
 * ## Caveats (per Sabre, 2026)
 *
 * The API is **beta**, a **premium** product, and currently limited to
 * **ATPCO** content (NDC exchange support is in progress). Reaching the
 * endpoint requires entitlement on the calling PCC, and the underlying
 * ticket must be provisioned for **automated reissue** — a ticket whose
 * fare is changeable by rule (CAT-31) can still return "Automated
 * reissue not active for this ticket" if that capability is not enabled
 * for the PCC/ticket. That activation is a Sabre-side concern, not a
 * payload the caller can set.
 *
 * ## Scope of v1 — what we exposed
 *
 * The OAS request surface is large (date flexibility, location variants
 * and radius search, retained flights, branded-fare filters, additional
 * offer/brand counts, retailing parity modes, EMDs, per-traveler age
 * and discount qualifiers). v1 exposes a focused slice covering the
 * common "shop for a flight change on an existing ticket" flow:
 *
 * - one or more {@link FlightReshopJourney} entries (origin/destination
 *   by city or airport code, departure date, optional time windows),
 * - one or more {@link FlightReshopTicket} entries (ticket number, plus
 *   optional issue date / traveler index),
 * - optional `bookingId` (PNR locator), `targetPcc`,
 * - optional cabin preference (`cabinName`),
 * - optional `distributionModel` (`ATPCO` / `NDC`).
 *
 * Everything omitted round-trips on the wire — the OAS defines it and
 * Sabre would accept it — but is not surfaced yet. Each can be added
 * later as a new optional field on an existing input type, which is
 * non-breaking. We kept v1 small because we have no production driver
 * for the advanced qualifiers and the focused slice is easy to reason
 * about.
 */

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

/**
 * Distribution model that determines the exchange processing path.
 *
 * On the response side Sabre may additionally return `Unknown` when the
 * model could not be determined; see {@link FlightReshopOfferSource}.
 */
export type FlightReshopDistributionModel = 'ATPCO' | 'NDC';

/**
 * Cabin name accepted by Sabre for the `fare.cabin.name` preference.
 * Mirrors the OAS `CabinNameEnum` — a fixed set, not free text.
 */
export type FlightReshopCabinName =
  | 'Premium First'
  | 'First'
  | 'Premium Business'
  | 'Business'
  | 'Premium Economy'
  | 'Economy';

/**
 * A location expressed by **either** a city code **or** an airport
 * code, never both — mirrors Sabre's `GenericLocation` `oneOf`.
 *
 * Both codes are three-letter uppercase IATA codes (e.g. `DFW`, `NYC`).
 * The caller picks whichever they have; supplying both is invalid per
 * the spec.
 */
export interface FlightReshopLocation {
  /** Three-letter IATA city code (e.g. `NYC`). Mutually exclusive with `airportCode`. */
  cityCode?: string;
  /** Three-letter IATA airport code (e.g. `DFW`). Mutually exclusive with `cityCode`. */
  airportCode?: string;
}

/**
 * A departure or arrival time window, `HH:MM` 24-hour local time.
 * Both bounds are required when a window is supplied.
 */
export interface FlightReshopTimeWindow {
  /** Window start, `HH:MM` (e.g. `09:15`). */
  startTime: string;
  /** Window end, `HH:MM` (e.g. `13:45`). */
  endTime: string;
}

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

/**
 * One journey to shop for. A journey is a single origin→destination
 * leg on a given date; a round trip is two journeys.
 */
export interface FlightReshopJourney {
  /** Departure location (city or airport code). */
  departureLocation: FlightReshopLocation;
  /** Arrival location (city or airport code). */
  arrivalLocation: FlightReshopLocation;
  /** Desired departure date, `YYYY-MM-DD` in the airport's time zone. */
  departureDate: string;
  /** Optional departure time-window constraint. */
  departureTimeWindow?: FlightReshopTimeWindow;
  /** Optional arrival time-window constraint. */
  arrivalTimeWindow?: FlightReshopTimeWindow;
  /**
   * Segments within this journey to **keep** unchanged while the rest are
   * reshopped (selective / partial exchange). Each retained segment is part
   * of the journey's *unmodifiable* conditions, so returned offers preserve
   * it and only vary the other segments. Identify a segment either by its
   * `flightItemId` (from the original booking) or by full
   * {@link FlightReshopRetainFlightDetails}. Maps to the OAS
   * `journeys[].retainFlights`.
   */
  retainFlights?: readonly FlightReshopRetainItem[];
}

/**
 * One segment to retain in a {@link FlightReshopJourney}. Mirrors the OAS
 * `RetainItem` `oneOf`: supply **either** `flightItemId` **or**
 * `flightDetails`, not both.
 */
export interface FlightReshopRetainItem {
  /**
   * The id of the flight to retain, as carried on the original booking
   * (OAS `RetainItem.flightItemId`). Prefer this when known.
   */
  flightItemId?: string;
  /**
   * Full flight details identifying the segment to retain, when no
   * `flightItemId` is available (OAS `RetainItem.flightDetails`).
   *
   * Prefer `flightItemId` when you have it — it's a single value and avoids
   * the extra fields the live API enforces on this path beyond the OAS
   * `required` list (see {@link FlightReshopRetainFlightDetails}). Both paths
   * are verified in CERT via `scripts/flight-exchange-retain-e2e.sh`.
   */
  flightDetails?: FlightReshopRetainFlightDetails;
}

/**
 * Full details identifying a flight to retain (OAS `RetainFlightItem`).
 *
 * **Spec-vs-reality:** the OAS marks `operatingAirlineCode`,
 * `flightStatusCode`, `creationDate`, and `creationTime` as *optional*, but
 * the live Flight Reshop API rejects a `flightDetails` retain that omits them
 * with `MANDATORY_DATA_MISSING` ("retained flight details require:
 * [operatingAirlineCode, flightStatusCode, creationDate and creationTime]").
 * They are typed optional here to mirror the OAS, but supply all four in
 * practice. All four are sourced from Booking Management `getBooking`: the
 * flight identity / `operatingAirlineCode` / `flightStatusCode` from the
 * matching `flights[]` entry, and `creationDate` / `creationTime` from the
 * booking-level `creationDetails` (there is no per-flight creation field;
 * the booking-level values are accepted — verified in CERT 2026-06-12). Both
 * this path and the simpler {@link FlightReshopRetainItem.flightItemId} path
 * are exercised by `scripts/flight-exchange-retain-e2e.sh` (`--retain-by`).
 */
export interface FlightReshopRetainFlightDetails {
  /** Marketing-carrier flight number (1–9999). */
  marketingFlightNumber: number;
  /** Two-letter IATA marketing-airline code (e.g. `AA`). */
  marketingAirlineCode: string;
  /** Three-letter IATA origin airport code. */
  departureAirportCode: string;
  /** Three-letter IATA destination airport code. */
  arrivalAirportCode: string;
  /** Scheduled departure date, `YYYY-MM-DD` in the airport's time zone. */
  departureDate: string;
  /** Scheduled departure time, `HH:MM`. */
  departureTime: string;
  /** Scheduled arrival date, `YYYY-MM-DD` in the airport's time zone. */
  arrivalDate: string;
  /** Scheduled arrival time, `HH:MM`. */
  arrivalTime: string;
  /** Booking inventory code (RBD) of the marketing airline. */
  bookingClassCode: string;
  /** Operating-carrier flight number, if different from marketing. */
  operatingFlightNumber?: number;
  /** Two-letter IATA operating-airline code, if different from marketing. */
  operatingAirlineCode?: string;
  /** Vendor booking status code (e.g. `HK`). */
  flightStatusCode?: string;
  /** Branded-fare code associated with the flight (e.g. `ECOFLEX`). */
  brandCode?: string;
  /**
   * If `true`, the API does not modify the segment's booking class. Per the
   * OAS, when set `true` it must be `true` for every retained flight in the
   * same journey.
   */
  keepBookingClass?: boolean;
  /**
   * Date the flight was booked and stored in the booking, `YYYY-MM-DD`. OAS
   * optional but enforced by the live API on this path — see the interface
   * doc comment.
   */
  creationDate?: string;
  /**
   * Time the flight was booked and stored in the booking, `HH:MM`. OAS
   * optional but enforced by the live API on this path — see the interface
   * doc comment.
   */
  creationTime?: string;
}

/**
 * A ticket whose details drive the exchange-offer search. At least one
 * ticket is required in practice; each traveler being reshopped needs
 * their own entry.
 */
export interface FlightReshopTicket {
  /** The electronic flight ticket number. */
  number: string;
  /** Issue date of the ticket, `YYYY-MM-DD`. Optional. */
  date?: string;
  /**
   * 1-based index into the request `travelers` array identifying whose
   * name is associated with this ticket. Only meaningful when travelers
   * are supplied.
   */
  travelerIndex?: number;
}

/**
 * Input for the `reshop` operation.
 *
 * `journeys` is the only strictly required field per the OAS, but a
 * useful request also supplies `tickets` so Sabre knows which document
 * to reprice against.
 */
export interface FlightReshopInput {
  /**
   * The journeys to shop for. One entry for a one-way change, two for a
   * round trip. 1–10 entries per the spec.
   */
  journeys: readonly FlightReshopJourney[];
  /**
   * Tickets to reprice. 1–9 entries per the spec. EMDs are not handled
   * by this v1 slice.
   */
  tickets?: readonly FlightReshopTicket[];
  /**
   * Booking reference ID (PNR locator) in the source system. Required
   * by some flows (e.g. retaining flights by `flightItemId`); optional
   * otherwise.
   */
  bookingId?: string;
  /**
   * Pseudo city code of the target destination for the reshop. 3–4
   * uppercase alphanumeric characters.
   */
  targetPcc?: string;
  /**
   * Preferred cabin for generated offers. Maps to the OAS
   * `fare.cabin.name` and is restricted to Sabre's documented set.
   */
  cabinName?: FlightReshopCabinName;
  /**
   * Distribution model hint. When omitted, Sabre determines the
   * processing path itself; the spec documents `ATPCO` as the example
   * value and NDC exchange is still in progress.
   */
  distributionModel?: FlightReshopDistributionModel;
}

// ---------------------------------------------------------------------------
// Output — money / charges
// ---------------------------------------------------------------------------

/**
 * Type of an exchange `grandTotal` charge.
 *
 * - `Add collect` — additional collection required to fulfill the offer
 * - `Even` — no additional cost
 * - `Refund` — money is returned when fulfilling the offer
 * - `Unknown` — the charge type could not be determined
 */
export type FlightReshopChargeType = 'Add collect' | 'Even' | 'Refund' | 'Unknown';

/**
 * Total monetary amounts of an exchange offer (fare difference, tax
 * difference, fees, grand total). All money fields are decimal strings;
 * negative values indicate a refund. Omitted by Sabre when an offer's
 * per-ticket costs span multiple currencies.
 *
 * Mirrors Sabre's `TotalPrice` (which extends `ExchangeCharge`).
 */
export interface FlightReshopTotalPrice {
  /** Charge type for `grandTotal`. */
  type?: FlightReshopChargeType;
  /** Total fare difference. */
  baseFare?: string;
  /** Total tax difference. */
  totalTax?: string;
  /** Fare + tax difference, change fees excluded. */
  subtotalBeforeFee?: string;
  /** Complete cost (positive) or refund (negative) value. */
  grandTotal?: string;
  /** Three-letter ISO 4217 currency code. */
  currencyCode?: string;
  /** Total tax charged on change fees. */
  totalTaxOnFee?: string;
  /** Total change/penalty fee associated with the exchange. */
  totalFee?: string;
}

// ---------------------------------------------------------------------------
// Output — offers and supporting records
// ---------------------------------------------------------------------------

/** Source of an offer, determined by the exchange processing path. */
export interface FlightReshopOfferSource {
  /** Distribution model the offer was sourced from. May be `Unknown`. */
  distributionModel?: FlightReshopDistributionModel | 'Unknown';
}

/**
 * A traveler a fare was generated for, with the associated document
 * number. Mirrors Sabre's `ReturnedTraveler`.
 */
export interface FlightReshopOfferTraveler {
  /** ATPCO passenger type code used to generate the offer (e.g. `ADT`). */
  passengerTypeCode?: string;
  /** Electronic flight ticket number associated with this traveler. */
  ticketNumber?: string;
  /** Traveler's first name. */
  givenName?: string;
  /** Traveler's surname. */
  surname?: string;
}

/**
 * Booking details of one flight within a fare component. The
 * `flightRef` points into {@link FlightReshopOutput.flights}; the
 * booking class is what a follow-up Exchange Booking sell must use to
 * obtain this fare.
 */
export interface FlightReshopFareComponentSegmentDetail {
  /** Reference to the flight (by id) this detail applies to. */
  flightRef?: string;
  /** Booking inventory code (RBD) of the marketing airline (e.g. `Y`). */
  bookingClassCode?: string;
  /** Cabin name. May be `Unknown` on the response side. */
  cabinName?: FlightReshopCabinName | 'Unknown';
}

/**
 * A fare component of a fare calculated for the offer. v1 surfaces the
 * fare basis plus the per-flight booking details needed to sell the
 * offer's flights in a follow-up exchange; richer attributes (brand,
 * account code, baggage refs) are not exposed yet.
 */
export interface FlightReshopFareComponent {
  /** Fare basis code associated with the component (e.g. `ABCDE10`). */
  fareBasisCode?: string;
  /** Per-flight booking details for the flights this component covers. */
  segmentDetails?: readonly FlightReshopFareComponentSegmentDetail[];
}

/**
 * A priced fare within an offer item, scoped to one or more travelers.
 * v1 surfaces the traveler list, the per-fare price difference, and the
 * fare components carrying the booking class per flight — the pieces
 * needed to chain an offer into Exchange Booking.
 */
export interface FlightReshopOfferFare {
  /** Travelers this fare applies to. */
  travelers?: readonly FlightReshopOfferTraveler[];
  /** Exchange/reissue cost for the travelers in this fare. */
  priceDifference?: FlightReshopTotalPrice;
  /** Fare components with the booking class per referenced flight. */
  fareComponents?: readonly FlightReshopFareComponent[];
}

/** A priceable item within an offer (one or more fares). */
export interface FlightReshopOfferItem {
  /** The ID of the offer item. */
  id?: string;
  /** Fare details for this item. */
  fares?: readonly FlightReshopOfferFare[];
}

/**
 * A single exchange offer matching the requested conditions.
 *
 * The headline numbers for a "show the change" UX are
 * {@link FlightReshopTotalPrice.grandTotal} (cost or refund) and
 * `type` (add-collect / even / refund). `journeyRefs` point into the
 * top-level {@link FlightReshopOutput.journeys}, which in turn
 * reference {@link FlightReshopOutput.flights}.
 */
export interface FlightReshopOffer {
  /** The ID of the offer (used in downstream booking-change calls). */
  id?: string;
  /** Source/distribution model of the offer. */
  source?: FlightReshopOfferSource;
  /** When the offer was created, UTC ISO-8601. */
  createdAt?: string;
  /** When the offer expires, UTC ISO-8601. */
  validUntil?: string;
  /** References to journeys (by id) this offer applies to. */
  journeyRefs?: readonly string[];
  /**
   * Total monetary amount of the exchange. Omitted by Sabre when the
   * per-ticket costs are in different currencies (see
   * `hasTravelersPricedInDifferentCurrencies`).
   */
  totalPriceDifference?: FlightReshopTotalPrice;
  /** If `true`, travelers are booked in different cabins on the same flight. */
  hasTravelersInDifferentCabins?: boolean;
  /** If `true`, costs are calculated in different currencies per traveler. */
  hasTravelersPricedInDifferentCurrencies?: boolean;
  /** If `true`, the offer contains mixed branded fares. */
  hasMixedBrands?: boolean;
  /**
   * If `true`, the offer was determined via automated Voluntary Changes
   * (Category 31) of the originally ticketed fare — i.e. the price is
   * guaranteed.
   */
  isPriceGuaranteed?: boolean;
  /** If `true`, the booking must be split for one or more travelers. */
  splitBooking?: boolean;
  /** Items needed to price the offer further. */
  items?: readonly FlightReshopOfferItem[];
  /** References to additional offer solutions (formerly "brands"). */
  additionalOffersRefs?: readonly string[];
}

/**
 * A flight used to construct exchange offers. Referenced from
 * {@link FlightReshopJourneyResult.flightRefs} by `id`.
 */
export interface FlightReshopFlight {
  /** The ID of the flight (referenced by journeys). */
  id?: string;
  /** Marketing flight number. */
  marketingFlightNumber?: number;
  /** Two-letter IATA marketing airline code. */
  marketingAirlineCode?: string;
  /** Operating flight number. */
  operatingFlightNumber?: number;
  /** Two-letter IATA operating airline code. */
  operatingAirlineCode?: string;
  /** Three-letter IATA origin airport code. */
  departureAirportCode?: string;
  /** Three-letter IATA destination airport code. */
  arrivalAirportCode?: string;
  /** Scheduled departure date, `YYYY-MM-DD`. */
  departureDate?: string;
  /** Scheduled departure time, `HH:MM`. */
  departureTime?: string;
  /** Scheduled arrival date, `YYYY-MM-DD`. */
  arrivalDate?: string;
  /** Scheduled arrival time, `HH:MM`. */
  arrivalTime?: string;
  /** IATA aircraft type designator code. */
  aircraftTypeCode?: string;
  /** Flight duration in minutes. */
  durationInMinutes?: number;
  /** If `true`, an aircraft equipment change occurs. */
  hasChangeOfGauge?: boolean;
  /** If `true`, this segment is married to the previous one. */
  isMarriedWithPreviousFlight?: boolean;
  /** If `true`, the flight requires rebooking. */
  isBookingRequired?: boolean;
}

/**
 * A journey used to construct exchange offers — an origin/destination
 * pair built from one or more {@link FlightReshopFlight} references.
 */
export interface FlightReshopJourneyResult {
  /** The ID of the journey (referenced by offers via `journeyRefs`). */
  id?: string;
  /** Flight references (by id) that make up this journey. */
  flightRefs?: readonly string[];
  /** Three-letter IATA departure airport code. */
  departureAirportCode?: string;
  /** Three-letter IATA arrival airport code. */
  arrivalAirportCode?: string;
  /** Journey duration in minutes. */
  durationInMinutes?: number;
}

/**
 * A diagnostic (error or warning) entry from Sabre's response. Both the
 * `errors` and `warnings` arrays share this shape.
 */
export interface FlightReshopMessage {
  /** Category of the message (e.g. `BAD_REQUEST`, `APPLICATION_ERROR`). */
  category?: string;
  /** Type of the message (e.g. `INVALID_VALUE`, `DOWNLINE_SERVICE_ERROR`). */
  type?: string;
  /** Human-readable description. */
  description?: string;
  /** Field path the message relates to, if any. */
  fieldPath?: string;
  /** Field name the message relates to, if any. */
  fieldName?: string;
  /** Field value the message relates to, if any. */
  fieldValue?: string;
}

/**
 * Output of the `reshop` operation.
 *
 * On a successful shop, `offers` holds the priceable reissue options
 * and `numberOfOffers` their count; `flights` and `journeys` are the
 * shared pools the offers reference. When Sabre cannot produce offers
 * (e.g. the ticket is not provisioned for automated reissue), `offers`
 * is absent and `errors` carries the downline reason — this operation
 * still resolves successfully (HTTP 200) in that case, so callers must
 * check `errors`.
 *
 * Every field is optional, mirroring the OAS; the mapper emits whatever
 * Sabre returns without dropping records.
 */
export interface FlightReshopOutput {
  /** Response generation time, UTC ISO-8601. */
  timestamp?: string;
  /** Total number of returned offers. */
  numberOfOffers?: number;
  /** The priceable exchange offers. */
  offers?: readonly FlightReshopOffer[];
  /** Flights referenced by the offers' journeys. */
  flights?: readonly FlightReshopFlight[];
  /** Journeys referenced by the offers. */
  journeys?: readonly FlightReshopJourneyResult[];
  /** Errors Sabre returned. Present on failed shops even with HTTP 200. */
  errors?: readonly FlightReshopMessage[];
  /** Warnings Sabre returned. */
  warnings?: readonly FlightReshopMessage[];
}
