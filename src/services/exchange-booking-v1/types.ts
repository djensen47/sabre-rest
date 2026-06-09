/**
 * Public input/output types for the Exchange Booking v1.1.0 service.
 *
 * Hand-written intentionally — not derived from `src/generated/`. The
 * generated types are kept internal so consumer-facing types stay
 * stable across spec changes and use idiomatic TypeScript naming.
 *
 * ## What this API does
 *
 * `POST /v1.1.0/exchange/booking` runs an entire ticket-exchange
 * transaction against an existing PNR in a single call. It can:
 *
 * - cancel selected segments,
 * - sell new segments (origin/destination, marketing carrier, flight
 *   number, dates, booking class),
 * - price the exchange and create one or more Price Quote Reissue (PQR)
 *   records,
 * - optionally collect form-of-payment and end-transact to commit.
 *
 * Exchange Booking does **not** search for alternative flights; the
 * caller already has the new segments in hand (typically via Bargain
 * Finder Max + Revalidate Itinerary).
 *
 * ## Quote-only vs commit
 *
 * Omit {@link ExchangeFlightInput.confirm} to *quote* the exchange —
 * Sabre creates a PQR with the change fee and fare difference but does
 * not collect payment. Pass `confirm` (form of payment) to commit and
 * issue. The end-transact in {@link ExchangeFlightInput.receivedFrom}
 * runs in both cases per the spec; the PQR persists either way.
 *
 * ## Scope of v1 — what we exposed
 *
 * The OAS surface is ~3,100 lines. v1 exposes a focused slice covering
 * the "let a passenger change a flight" flow:
 *
 * - single PQR per call (one `AutomatedExchanges` entry),
 * - cash / check / credit-card form of payment,
 * - common pricing knobs (`bargainFinder`, `autoRedirect`,
 *   `validatingCarrier`, `changeFeeOverride`, `priceTolerance`),
 * - email of the new ticket / itinerary / invoice on commit.
 *
 * ## What we did NOT expose (and why)
 *
 * Each item below round-trips on the wire — the OAS defines it and
 * Sabre would accept it — but the public input type does not surface
 * it. Every one of these can be added later as a new optional field on
 * an existing input type, which is non-breaking. We omitted them now
 * to keep v1's public surface small and easy to reason about, and
 * because we have no production driver for any of them yet.
 *
 * - **Multi-PQR exchanges.** The OAS `AutomatedExchanges` is an array
 *   so a single call can reissue several tickets (e.g. one PQR per
 *   passenger in a multi-pax PNR). v1 emits exactly one entry. Adding
 *   multi-PQR means promoting the per-PQR fields
 *   (`originalTicketNumber`, `nameNumber`, `priceTolerance`,
 *   `validatingCarrier`, `changeFeeOverride`, `confirm`) into a
 *   repeated sub-input, which is a public-shape change worth pausing
 *   on until a real caller asks.
 *
 * - **`SpecialService` block (APIS / Secure Flight / generic SSRs).**
 *   The exchange flow we're targeting modifies an itinerary that
 *   already has APIS docs and SFPD captured; a re-issue does not
 *   require re-collecting them. Surfacing the block now would
 *   duplicate fields already covered by Booking Management's create
 *   path. Add when an exchange use case actually needs new SSRs.
 *
 * - **`SegmentPricing` (per-segment selective pricing under
 *   `Itinerary`).** Used when only some segments of the original
 *   itinerary should be re-priced. Uncommon and non-obvious to
 *   model well; add when a caller has a concrete need.
 *
 * - **Alternate forms of payment** — pay-later (Brazilian
 *   installments), wallet (`Wallet_Info`), virtual FOP, GSA / agency
 *   credit. Cash / check / credit card cover the typical
 *   change-flight flow. The `formOfPayment` discriminator already
 *   has a place to grow new variants without breaking existing
 *   callers.
 *
 * - **Exotic confirmation qualifiers** — `PNR_Override`,
 *   `ROE_Override`, `EndorsementOverride`, `TourCode`, `Hemisphere`,
 *   `Journey`, `Commission`, `NewTicketFullCommission`,
 *   `RefundableAmountOnEMD`, `BaggageAllowance`, `MiniItin`,
 *   `Print`, `RemoteCoupon`, `SelfSaleInd`, `DoNotIssueEMDForChangeFee`.
 *   These are domain-specific enough (BSP region, ARC vs. non-ARC,
 *   commission models) that exposing them all up-front would make
 *   the input type harder to read for the common case. Add as
 *   individual optional fields when a caller needs one.
 *
 * - **Most pricing knobs** beyond what's listed above —
 *   `Brand`, `Account` (account codes), `Corporate` (corporate IDs),
 *   `RetailerRuleQualifier`, `SpecificFareBasis`,
 *   `ExcludeBookingCode`, `SpecifyMaxPenalty`, `PlusUp`,
 *   `RoundTheWorld`, `FareFocusExclude`, `AlternateCurrencyCode`,
 *   `ChangeFeeCollectionOptions`, `CountryInformation`, `FareOptions`
 *   (private/public), `Overrides` (`NoAdvancePurchase`,
 *   `NoFareRestrictions`, `NoMinMaxStay`, `NoPenalty`),
 *   `SpanishLargeFamilyDiscountLevel`, `SpanishDiscountOverride`,
 *   `Endorsements`, `Diagnostic`, `PassengerType`, `Taxes` overrides
 *   (`QuebecSalesTax`, `VAT_TaxCode`, `NoTax`, `TaxExempt`,
 *   `TaxOverride`). Each is reachable on the wire and can be
 *   surfaced when needed.
 *
 * - **`ExchangeOverrides.FeeOnPenalty` and
 *   `ExemptPaperSurcharge` / `TicketMedia`.** Penalty-tax overrides
 *   and paper-ticket flags. Rare in modern exchange flows.
 *
 * - **Per-segment qualifiers under `ExchangeSegment`** —
 *   `BaggageAllowance`, `ValidityDates`, per-segment `CommandPricing`
 *   / `Brand` / `SpecificFareBasis`. The sell-side `newSegments`
 *   carries enough for typical flows; per-segment fare overrides
 *   matter only for unusual reissue scenarios.
 *
 * - **`SegmentNumber` association** in `SpecialService` and the
 *   `bookSequence` / `id` cross-references that tie SSRs to specific
 *   segments. Coupled with the `SpecialService` decision above.
 *
 * - **`healthCheck`** (Sabre internal use only) and
 *   `multipleExchangesWaitInterval` (only meaningful with multi-PQR).
 *
 * - **Most response sub-fields beyond totals + change fee +
 *   baggage + validity.** The full reservation echo (`Reservation`),
 *   detailed `POS`, per-passenger `SpecialRequests` echo, baggage-fee
 *   free-text rendering, signature-line `Source` variations, and
 *   `Links` HAL are not modelled on the public output. Callers who
 *   need them can read `rawResponse` (the full parsed JSON) — that
 *   escape hatch keeps the public output tight without losing data.
 *
 * - **`Warning.SystemSpecificResults.HostCommand`,
 *   `Element`, `RecordID`, `DocURL`, `reference`** on application
 *   diagnostics. Useful for deep debugging; the public type carries
 *   `timeStamp`, `type`, `shortText`, and coded `messages`. Reach
 *   into `rawResponse.ExchangeBookingRS.ApplicationResults` for
 *   the rest.
 *
 * The rule for adding any of the above later: each is a new optional
 * field on an existing input type or a new optional field on an
 * existing output type. No breaking change required.
 */

/**
 * Input to {@link ExchangeBookingV1Service.exchange}.
 *
 * Build the segments to cancel and the new segments to sell, then add
 * tolerance / fee / pricing knobs as needed. The method handles both
 * the *quote* and *commit* halves of an exchange — see the module-level
 * doc for the difference.
 */
export interface ExchangeFlightInput {
  /**
   * Sabre PNR locator (record ID) the exchange runs against. Required
   * by the spec (`Itinerary.id`).
   */
  pnrLocator: string;

  /**
   * Original e-ticket number being exchanged. Required by the spec
   * (`ExchangeComparison.OriginalTicketNumber`).
   */
  originalTicketNumber: string;

  /**
   * Passenger name number this exchange applies to (e.g. `1.1`).
   * Defaults to `1.1` when omitted. Required by the spec under
   * `PricingQualifiers.NameSelect.NameNumber`.
   */
  nameNumber?: string;

  /**
   * `EndTransaction.Source.ReceivedFrom` value. Required by the spec
   * for the post-processing block. Free-form agent identifier.
   */
  receivedFrom: string;

  /**
   * Pseudo-city code the API should switch context to before running
   * the exchange. When omitted, the API stays on the caller's current
   * PCC.
   */
  targetCity?: string;

  /**
   * Reservation segment numbers to cancel before selling the new
   * segments. Omit (or pass an empty array) to leave the existing
   * itinerary in place.
   */
  cancelSegments?: number[];

  /**
   * New flight segments to sell. Omit (or pass an empty array) to skip
   * the AirBook step entirely (e.g. tax recompute / fare-rule reissue
   * with no itinerary change).
   */
  newSegments?: ExchangeNewSegment[];

  /**
   * Price-tolerance guardrails. When supplied, Sabre compares the
   * priced exchange against `amountSpecified` and halts on
   * out-of-tolerance results (per the increase / decrease bounds).
   * When omitted, no `PriceComparison` block goes on the wire — Sabre
   * prices freely.
   */
  priceTolerance?: ExchangePriceTolerance;

  /**
   * Validating carrier IATA code applied to the priced exchange (e.g.
   * `AS`). Maps to
   * `FlightQualifiers.VendorPrefs.Airline.Code`.
   */
  validatingCarrier?: string;

  /**
   * Override the airline-quoted change fee. String per the spec
   * (`ExchangeOverrides.ChangeFee`, e.g. `"100.00"`).
   */
  changeFeeOverride?: string;

  /**
   * When `true`, sets `PricingQualifiers.BargainFinder.Rebook = true`
   * — Sabre's "find the cheapest fare" pricing path applied to the
   * new segments.
   */
  bargainFinder?: boolean;

  /**
   * When `true`, sets `PricingQualifiers.AutoRedirect = true` — if a
   * CAT-31 reissue can't be priced, Sabre transparently retries as a
   * non-CAT-31 exchange.
   */
  autoRedirect?: boolean;

  /**
   * Override Sabre's default exchange-pricing host command. Maps to
   * `PricingQualifiers.CommandPricing`. Default behavior (when
   * omitted) is `WFRF` — reissue with the same fare basis as the
   * original ticket. Useful values:
   *   - `WPNCB` — auto-price the new itinerary, ignoring the original
   *     fare basis (most lenient)
   *   - `WPQ`   — fresh price quote
   *   - `WFR`   — generic reissue
   * Use when the default `WFRF` path returns
   * "WFRF ENTRY NOT AVAILABLE" because the original fare's rules
   * don't permit a same-fare-basis swap.
   */
  commandPricing?: string;

  /**
   * Status codes that should halt subsequent processing if the
   * carrier returns them after sell. When omitted, defaults to
   * `['HL','KK','LL','NO','UC','US']`. Note `NN` is intentionally NOT in
   * the default list: new segments are sold passively as `GK`, and
   * halting on `NN` would abort the air-book step on a still-pending
   * segment (the spec's canonical example does both and is contradictory
   * in practice). Pass an explicit array (including empty) to override.
   */
  haltOnStatus?: string[];

  /**
   * Acceptable departure-time discrepancy (in minutes) between the
   * caller-requested time and the time the carrier returns after
   * sell. Sabre halts if any segment exceeds the threshold. Spec
   * range: 1 to 1438 (exclusive).
   */
  haltOnTimeDiscrepancyMinutes?: number;

  /**
   * Redisplay-reservation retry knobs. When supplied, Sabre re-fetches
   * the booked itinerary up to `numAttempts` times (waiting
   * `waitInterval` ms between attempts) before pricing — useful for
   * letting carrier status codes settle.
   */
  redisplayReservation?: ExchangeRedisplay;

  /**
   * When `true` (the library default), the response includes the
   * generated PQR information. Spec field
   * `PostProcessing.returnPQRInfo`.
   */
  returnPQRInfo?: boolean;

  /**
   * When `true`, the response also includes the redisplayed
   * reservation. Spec field `PostProcessing.redisplayReservation`.
   */
  redisplay?: boolean;

  /**
   * Form-of-payment + ticketing knobs. Presence of this block flips
   * the call from quote-only to commit: Sabre charges the FOP and
   * issues the new ticket as part of the same transaction.
   */
  confirm?: ExchangeConfirm;

  /**
   * Email notification settings on end-transact. The PNR's email
   * field on `nameNumber` is what Sabre actually sends to.
   */
  email?: ExchangeEmail;
}

/**
 * One new flight segment to sell. Maps to a single
 * `AirBook.OriginDestinationInformation.FlightSegment` entry on the
 * wire.
 */
export interface ExchangeNewSegment {
  /** Three-letter IATA origin airport code. */
  origin: string;
  /** Three-letter IATA destination airport code. */
  destination: string;
  /**
   * Local departure date/time, `YYYY-MM-DDThh:mm:ss`. Sabre matches
   * exactly against schedule.
   */
  departureDateTime: string;
  /**
   * Local arrival date/time, `YYYY-MM-DDThh:mm:ss`.
   */
  arrivalDateTime: string;
  /** Two-letter IATA marketing-carrier code (e.g. `AS`). */
  marketingCarrier: string;
  /** Marketing flight number (e.g. `781`). */
  flightNumber: string;
  /** Booking class / RBD (e.g. `G`). */
  bookingClass: string;
  /**
   * Number of passengers to book on this segment. Spec field is a
   * string. Defaults to `"1"` when omitted.
   */
  numberInParty?: string;
  /**
   * Action code used to sell the new segment. Defaults to `"GK"`
   * (passive / guaranteed) when omitted — this holds the segment
   * immediately so the reissue prices in the same call. Avoid `"NN"`
   * (need): it leaves the segment pending and trips the default
   * `haltOnStatus`, aborting the air-book step.
   */
  status?: string;
}

/**
 * Price-tolerance configuration for a single exchange.
 */
export interface ExchangePriceTolerance {
  /**
   * Target price (or fare-difference target) the priced exchange must
   * land within. Required by the spec when `PriceComparison` is
   * present.
   */
  amountSpecified: number;
  /** Acceptable upward drift from `amountSpecified`. */
  acceptableIncrease?: ExchangePriceBound;
  /** Acceptable downward drift from `amountSpecified`. */
  acceptableDecrease?: ExchangePriceBound;
}

/**
 * One side of a price-tolerance window. Pass either `amount` or
 * `percent` (whole-number percent), per spec; `haltOnNonAcceptablePrice`
 * decides whether out-of-tolerance halts the transaction.
 */
export interface ExchangePriceBound {
  amount?: number;
  percent?: number;
  haltOnNonAcceptablePrice?: boolean;
}

/**
 * Redisplay-reservation retry settings. Both fields are required by
 * the spec when this block is present.
 */
export interface ExchangeRedisplay {
  /** 1–10 attempts. */
  numAttempts: number;
  /** Wait between attempts, in milliseconds. 100–10000. */
  waitInterval: number;
}

/**
 * Form-of-payment + ticketing details for the commit phase.
 */
export interface ExchangeConfirm {
  /** Cash, check, or credit card. */
  formOfPayment: ExchangeFormOfPayment;
  /** Sabre waiver code (e.g. `WV236`). */
  waiverCode?: string;
  /** Three-letter ticket-delivery office code. */
  ticketDeliveryOffice?: string;
}

/**
 * Discriminated form of payment.
 *
 * Per Sabre: cash uses `Type: 'CA'`, check uses `Type: 'CK'`, and
 * credit cards omit `Type` and populate `CC_Info.PaymentCard` instead.
 * The mapper handles that translation; consumers pick a `type`.
 */
export type ExchangeFormOfPayment =
  | { type: 'cash' }
  | { type: 'check' }
  | {
      type: 'card';
      /** Two-letter card vendor code (`VI`, `MC`, `AX`, `DC`, `JC`). */
      vendorCode: string;
      /** PAN, digits only. */
      number: string;
      /** Expiry in `YYYY-MM` format. */
      expireDate: string;
      /** Manual approval code, when applicable. */
      manualApprovalCode?: string;
      /**
       * When `true`, suppresses (masks) the card number in the
       * response.
       */
      suppress?: boolean;
    };

/**
 * Email notification settings sent on end-transact. Sabre sends to the
 * email associated with `nameNumber` in the PNR.
 *
 * Per the spec `eTicket`, `Invoice`, and `Itinerary` are mutually
 * exclusive — the mapper enforces that only one is on the wire. When
 * none are set, no email is requested.
 */
export interface ExchangeEmail {
  /** Passenger name number (e.g. `1.1`) the email goes to. */
  nameNumber: string;
  /** Email a text-based copy of the new ticket. */
  eticket?: boolean;
  /** Email a text-based copy of the invoice. */
  invoice?: boolean;
  /** Email a text-based copy of the itinerary. */
  itinerary?: boolean;
}

/**
 * Output of {@link ExchangeBookingV1Service.exchange}.
 *
 * Sabre returns a deeply-nested envelope with three top-level pieces
 * the caller usually wants: the application-level diagnostics
 * (`applicationResults`), one entry per PQR confirmed
 * (`exchangeConfirmations`), and the priced PQR(s) themselves
 * (`priceQuoteReissue`). The full parsed body is on `rawResponse` for
 * everything else (segment-level reservation echo, signature line,
 * response header free-text, etc.).
 */
export interface ExchangeFlightOutput {
  /** Top-level application diagnostics + transaction status. */
  applicationResults?: ExchangeApplicationResults;
  /**
   * One entry per confirmed PQR. Carries the auto-redirect indicator,
   * the realized price comparison, and any free-text additional notes
   * (e.g. "CHG FEE AMT MODIFIED").
   */
  exchangeConfirmations?: ExchangeConfirmationResult[];
  /**
   * One entry per Price Quote Reissue record returned. Each carries
   * the priced totals, change-fee detail, baggage information, and
   * fare validity dates.
   */
  priceQuoteReissue?: ExchangePriceQuoteReissue[];
  /**
   * Full parsed response body. Pragmatic escape hatch for fields the
   * library does not surface yet (full reservation echo, segment-level
   * fare breakdown, baggage fee free-text, etc.).
   */
  rawResponse: unknown;
}

/**
 * Application-level results envelope. Mirrors Sabre's
 * `ApplicationResults` block.
 */
export interface ExchangeApplicationResults {
  /** `Complete`, `Incomplete`, `NotProcessed`, or similar. */
  status?: string;
  success?: ExchangeApplicationMessage[];
  warnings?: ExchangeApplicationMessage[];
  errors?: ExchangeApplicationMessage[];
}

/** One entry within `ApplicationResults.Success/Warning/Error`. */
export interface ExchangeApplicationMessage {
  /** ISO-8601 timestamp Sabre recorded the message at. */
  timeStamp?: string;
  /** Source diagnostic type (e.g. `BusinessLogic`). */
  type?: string;
  /** Per-subsystem diagnostics. */
  systemSpecificResults?: ExchangeSystemSpecificResult[];
}

/** One per-subsystem diagnostics entry. */
export interface ExchangeSystemSpecificResult {
  timeStamp?: string;
  shortText?: string;
  /** Coded + free-text messages from the subsystem. */
  messages?: Array<{ code?: string; value?: string }>;
}

/**
 * Result of one confirmed PQR — the realized fee + price-comparison
 * outcome the caller wants to surface to a passenger.
 */
export interface ExchangeConfirmationResult {
  /** PQR number (e.g. `02`). */
  pqrNumber?: string;
  /**
   * `Y` when Sabre auto-redirected from CAT-31 to non-CAT-31 pricing
   * (only present when `autoRedirect` was requested or applied).
   */
  autoRedirect?: string;
  /**
   * Net amount to collect or refund. Sabre returns it as a string;
   * negative values represent a refund. Passed through as-is.
   */
  amountReturned?: string;
  /** EMD refundable amount, when applicable. */
  refundableAmountOnEMD?: string;
  /** Free-text notes Sabre attaches (e.g. waiver-applied messaging). */
  additionalText?: string;
}

/**
 * One Price Quote Reissue record. Carries the realized totals,
 * change-fee, baggage allowances, and fare validity dates.
 */
export interface ExchangePriceQuoteReissue {
  /** PQR number (e.g. `2`). */
  pqrNumber?: string;
  /** Free-text response header lines from Sabre (status, validity). */
  responseHeader?: string[];
  /** Baggage-fee free-text lines. */
  baggageFees?: string[];
  /** Signature lines (creation agent, PCC, timestamp, source). */
  signatureLines?: ExchangeSignatureLine[];
  /** Pricing input command associated with this PQR (e.g. `WFRF`). */
  inputMessage?: string;
  /** Reservation/ticketing restriction free-text. */
  resTicketingRestrictions?: string[];
  /** Fare calculation lines. */
  fareCalculation?: string[];
  /** Passenger-type quantities (typically `ADT × 01`). */
  passengerTypeQuantities?: ExchangePassengerTypeQuantity[];
  /**
   * Exchange-specific details — original ticket, PQR status, residual
   * applied, change-fee amounts.
   */
  exchangeDetails?: ExchangeDetails;
  /** Itinerary total — base / total / taxes. */
  itinTotalFare?: ExchangeItinTotalFare;
  /** Per-segment fare breakdown. */
  segments?: ExchangePtcFlightSegment[];
}

/** One signature line on a PQR. */
export interface ExchangeSignatureLine {
  creationAgent?: string;
  createDateTime?: string;
  homePseudoCityCode?: string;
  pseudoCityCode?: string;
  source?: string;
}

/** Passenger-type quantity (e.g. `ADT` × `01`). */
export interface ExchangePassengerTypeQuantity {
  code?: string;
  quantity?: string;
}

/**
 * Exchange-specific details on a PQR — original document, residual
 * applied, change fee.
 */
export interface ExchangeDetails {
  /** Original ticket / document number being exchanged. */
  docNumber?: string;
  currencyCode?: string;
  /** PQR status indicator (e.g. `E`). */
  pqrStatus?: string;
  /** Original ticket value applied to the exchange. */
  ticketValue?: string;
  /** Surname (and given name, slash-delimited) Sabre echoes. */
  passengerName?: string;
  /** Free-text notes Sabre attaches (residual-refundable, etc.). */
  text?: string[];
  /** One or more change-fee amounts. */
  changeFees?: ExchangeChangeFee[];
  /** Net residual after change fee + fare difference (e.g. `EVEN`). */
  transactionInformation?: ExchangeTransactionInformation[];
}

export interface ExchangeChangeFee {
  /** May be `"N/A"`, an amount, or empty. */
  amount?: string;
  /** Free-text qualifier. */
  text?: string;
}

export interface ExchangeTransactionInformation {
  amount?: string;
  currencyCode?: string;
  /** Free-text label (e.g. `EVEN`, `ADC`, `RFND`). */
  text?: string;
}

/** Itinerary totals — base, total, taxes. */
export interface ExchangeItinTotalFare {
  baseFare?: ExchangeMoney;
  totalFare?: ExchangeMoney;
  taxes?: ExchangeTaxes;
}

export interface ExchangeMoney {
  amount?: string;
  currencyCode?: string;
}

export interface ExchangeTaxes {
  /** Aggregate code (e.g. `XT`). */
  taxCode?: string;
  totalAmount?: string;
  tax?: ExchangeTaxLine[];
}

export interface ExchangeTaxLine {
  amount?: string;
  taxCode?: string;
}

/** One PTC fare-breakdown flight segment row. */
export interface ExchangePtcFlightSegment {
  connectionInd?: string;
  departureDateTime?: string;
  flightNumber?: string;
  bookingClass?: string;
  /** Reference place-holder index (`01`, `02`, ...). */
  rph?: string;
  baggageAllowance?: string;
  fareBasis?: string;
  marketingCarrier?: string;
  marketingFlightNumber?: string;
  origin?: string;
  notValidBefore?: string;
  notValidAfter?: string;
}
