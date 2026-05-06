/**
 * Public input/output types for the Create Passenger Name Record v2.5.0
 * service — the hotel booking path.
 *
 * Hand-written intentionally — not derived from `src/generated/`. The
 * generated types are kept internal so consumer-facing types stay stable
 * across spec changes and use idiomatic TypeScript naming.
 *
 * ## Scope: hotel only
 *
 * Sabre's CreatePassengerNameRecord endpoint technically books air,
 * hotel, and rental-car content in a single request. This library
 * exposes only the hotel slice: the air path already lives in
 * `bookingManagementV1` at a different Sabre REST endpoint, and we have
 * no production driver for mixed-segment bookings yet. Future siblings
 * (`bookAir`, `bookCar`) can land on this same service interface
 * without breaking the hotel surface.
 *
 * ## CSL-segment compliance
 *
 * Per Sabre SAN 16384, all new hotel bookings must be created as CSL
 * segments as of March 26, 2024. The mapper hardcodes
 * `HotelBook.bookGDSviaCSL = true` — the spec-documented discriminator
 * that routes Sabre's runtime onto the CSL path. See
 * `docs/guides/hotel-booking-flow.md` for the flow context.
 */

/**
 * Input to {@link CreatePassengerNameRecordV25Service.bookHotel}.
 *
 * v1 of this surface is intentionally narrow: one room, one lead guest,
 * one credit card. Multi-room, multi-guest, corporate discount codes,
 * loyalty IDs, room extras, and alternate payment forms all round-trip
 * on the wire but are not yet exposed here.
 */
export interface BookHotelInput {
  /**
   * Opaque booking key from a prior
   * {@link HotelPriceCheckV5Service.check} call. Required. Pass it
   * through verbatim — do not decode, trim, or re-URL-encode it.
   */
  bookingKey: string;

  /**
   * Pseudo-city code (PCC) the PNR should be created under. Optional;
   * when omitted the booking lands on the PCC associated with the
   * caller's auth token.
   */
  targetCity?: string;

  /**
   * When `true` (the library default), Sabre halts booking processing
   * on any hotel supplier error instead of returning a partially-formed
   * PNR. Strongly recommended. Explicitly set `false` only if the
   * caller wants to inspect the diagnostics envelope on failure.
   */
  haltOnHotelBookError?: boolean;

  /** Lead (and only, in v1) guest for the reservation. */
  leadGuest: BookHotelGuest;

  /** Agency / point-of-sale metadata. Shared across wire sub-blocks. */
  agency: BookHotelAgency;

  /** Payment card for the booking guarantee / deposit. */
  paymentCard: BookHotelPaymentCard;
}

/** Lead guest details for the single hotel room. */
export interface BookHotelGuest {
  firstName: string;
  lastName: string;
  /** Contact email. Omitted from the wire body when absent. */
  email?: string;
  /** Contact phone, digits and hyphens OK (Sabre does not normalize). */
  phone: string;
  /** IATA passenger-type code. Defaults to `ADT` when omitted. */
  passengerType?: string;
}

/**
 * Agency metadata.
 *
 * Used to populate both `TravelItineraryAddInfo.AgencyInfo` (required
 * by the spec note for hotel-only bookings) and `HotelBook.POS.Source`.
 */
export interface BookHotelAgency {
  /** `POS.Source.AgencyName`. Often the booking engine brand. */
  name: string;
  /** `POS.Source.PseudoCityCode`. */
  pcc: string;
  /** `POS.Source.RequestorID.Id` — the IATA requestor identifier. */
  iata: string;
  /** Printed agency address. */
  address: BookHotelAgencyAddress;
  /** Sabre ticketing configuration. Defaults to `7TAW` when omitted. */
  ticketType?: string;
  /**
   * Printable agency contact phone, surfaced in
   * `TravelItineraryAddInfo.CustomerInfo.ContactNumbers`. Omitted from
   * the wire body when absent.
   */
  contactPhone?: string;
}

/** Agency street address. Populated into `AgencyInfo.Address`. */
export interface BookHotelAgencyAddress {
  /** Building number (e.g. `3150`). */
  streetNumber: string;
  /** Street name or additional address line. */
  addressLine: string;
  cityName: string;
  /** Two-letter state/county/province code. Optional. */
  stateCode?: string;
  /** ISO 3166-1 alpha-2 country code. */
  countryCode: string;
  postalCode?: string;
}

/**
 * Credit card for the booking.
 *
 * The library does not tokenize or redact. Raw PAN / CVV ride the
 * request body; PCI handling is the caller's responsibility.
 */
export interface BookHotelPaymentCard {
  /** Two-letter card code (`VI`, `MC`, `AX`, `DC`, `JC`). */
  cardCode: string;
  /** PAN, digits only. */
  cardNumber: string;
  /** Expiry month 1–12. */
  expiryMonth: number;
  /** Expiry year as a 4-digit string (`"2030"`). */
  expiryYear: string;
  /**
   * Card security code. Not in the spec's `required:` list but present
   * in every published canonical example body. Strongly recommended —
   * Sabre or the supplier may reject the booking without it.
   */
  csc?: string;
  /** Cardholder given name as printed on the card. */
  holderFirstName: string;
  /** Cardholder surname as printed on the card. */
  holderLastName: string;
  /** Billing address on file with the card issuer. */
  billingAddress: BookHotelBillingAddress;
}

/** Cardholder billing address. Populated into `PaymentCard.Address`. */
export interface BookHotelBillingAddress {
  /** One or more address lines. Order preserved on the wire. */
  addressLine: readonly string[];
  cityName: string;
  /** Two-letter state/province code. Optional. */
  stateCode?: string;
  /** ISO 3166-1 alpha-2 country code. */
  countryCode: string;
  postalCode?: string;
}

/**
 * Output of {@link CreatePassengerNameRecordV25Service.bookHotel}.
 *
 * The OpenAPI response schema for CPNR v2.5.0 formally defines only
 * `ItineraryRef.ID` (the PNR locator) and `ApplicationResults` — no
 * per-segment echo for hotel, so supplier confirmation numbers arrive
 * only within `ApplicationResults` messages or embedded in unparsed
 * portions of the body.
 *
 * `rawResponse` preserves the full parsed JSON so callers can reach
 * into whatever Sabre actually returned without waiting for the public
 * types to grow new fields.
 */
export interface BookHotelOutput {
  /**
   * Sabre PNR locator (e.g. `ABC123`), from
   * `CreatePassengerNameRecordRS.ItineraryRef.ID`. Absent on failure
   * envelopes.
   */
  pnrLocator?: string;

  /** Success / warning / error diagnostics, plus transaction status. */
  applicationResults?: BookHotelApplicationResults;

  /**
   * The full parsed response body. Pragmatic escape hatch for fields
   * Sabre returns but the spec doesn't model (hotel confirmation
   * numbers live here). Callers that reach into `rawResponse` take on
   * the risk of Sabre changing the shape.
   */
  rawResponse: unknown;
}

/** Sabre transaction diagnostics. Fields follow Sabre's shape loosely. */
export interface BookHotelApplicationResults {
  /**
   * Transaction status. `Complete` on a clean booking; anything else
   * generally means inspect `errors` / `warnings`.
   */
  status?: 'Complete' | 'Incomplete' | 'NotProcessed' | 'Unknown';
  success?: BookHotelApplicationMessage[];
  warnings?: BookHotelApplicationMessage[];
  errors?: BookHotelApplicationMessage[];
}

/** One entry within `ApplicationResults.Success/Warning/Error`. */
export interface BookHotelApplicationMessage {
  /** ISO-8601 timestamp Sabre recorded the message at. */
  timeStamp?: string;
  /**
   * Per-subsystem diagnostics. Multiple entries are possible when
   * Sabre and a downstream supplier both respond.
   */
  systemSpecificResults?: BookHotelSystemSpecificResult[];
}

/** One per-subsystem diagnostics entry. */
export interface BookHotelSystemSpecificResult {
  /** Coded + free-text messages from the subsystem. */
  messages?: Array<{ code?: string; value?: string }>;
  /** Abbreviated error / warning text. */
  shortText?: string;
  /** ISO-8601 timestamp. */
  timeStamp?: string;
}
