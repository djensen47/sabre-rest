/**
 * Public input/output types for the Hotel Price Check v5 service.
 *
 * Hand-written intentionally — not derived from `src/generated/`. The
 * generated types are kept internal so consumer-facing types stay stable
 * across spec changes and use idiomatic TypeScript naming.
 *
 * Hotel Price Check is the revalidation step between hotel shopping and
 * booking. It takes an opaque `rateKey` from a prior hotel-search / price
 * response and confirms the rate is still valid, returning a `bookingKey`
 * (needed by the downstream booking call), a price-change indicator with
 * the current price difference, and refreshed hotel + rate + room + tax +
 * fee + cancel-penalty + guarantee content.
 *
 * ## Why these types are duplicated with Hotel Search v2
 *
 * The hotel-price-check spec re-declares `HotelInfo`, `LocationInfo`,
 * `Address`, `CityName`, `StateProv`, `CountryName`, `Contact`, and
 * `ApplicationResults` inline — there are no cross-spec `$ref`s. Per
 * `docs/architecture.md` "Public type design rule #1" ("same `$ref` →
 * share; same shape today → don't trust it"), the two services must each
 * own their copy. Type names here use a `PriceCheck*` prefix (and the
 * hotel-search-v2 types use `Hotel*`) so nothing is accidentally shared.
 */

/**
 * Input to {@link HotelPriceCheckV5Service.check}.
 *
 * The only required field is `rateKey` — the opaque rate identifier from
 * a prior hotel-price / shop response. Everything else is optional and
 * only echoed to Sabre to narrow the repricing context.
 */
export interface CheckHotelPriceInput {
  /**
   * Opaque rate key from a prior hotel-price / shop response. Required.
   */
  rateKey: string;

  /**
   * Point-of-sale override for branch shopping. When present, the call
   * shops in the given authorized PCC while the underlying session stays
   * on the home branch.
   */
  pointOfSale?: PriceCheckPointOfSale;

  /**
   * Corporate number for corporate-level pricing, preferencing, or
   * credentials.
   */
  corporateNumber?: string;

  /** Stay window to reprice. Dates in `YYYY-MM-DD` format. */
  stay?: PriceCheckStayWindow;

  /**
   * Per-room occupancy. Sabre requires all rooms to share the same adult
   * and child counts; the `index` values must be unique and consecutive.
   */
  rooms?: readonly PriceCheckRequestedRoom[];
}

/** Point-of-sale override. */
export interface PriceCheckPointOfSale {
  /** Four-character PCC of the authorized branch. */
  pseudoCityCode: string;
}

/** Stay window to reprice. */
export interface PriceCheckStayWindow {
  /** Check-in date, `YYYY-MM-DD`. */
  startDate: string;
  /** Check-out date, `YYYY-MM-DD`. */
  endDate: string;
}

/** Per-room occupancy specification. */
export interface PriceCheckRequestedRoom {
  /** 1-based room index. All rooms must have identical adult/child counts. */
  index: number;
  /** Number of adults. Required, minimum 1. */
  adults: number;
  /** Number of children. */
  children?: number;
  /**
   * Ages of children. Must be supplied (non-empty) when `children > 0`.
   * Sabre accepts a comma-separated string on the wire; the library
   * joins this array at the boundary so consumers send numbers, not
   * whitespace-sensitive strings.
   */
  childAges?: readonly number[];
}

/**
 * Output of {@link HotelPriceCheckV5Service.check}.
 *
 * All fields except `applicationResults` are optional at the type level:
 * `PriceCheckInfo` itself is optional on Sabre's response envelope, so a
 * failed / error envelope may return only diagnostics. Callers should
 * check for `bookingKey` before proceeding to book.
 */
export interface CheckHotelPriceOutput {
  /** Booking key to hand to the downstream hotel-booking call. */
  bookingKey?: string;
  /** `true` if the price changed since the original shop. */
  priceChange?: boolean;
  /** Price delta as a string (Sabre sends numeric strings). */
  priceDifference?: string;
  /** ISO 4217 currency code for the native price fields. */
  currencyCode?: string;
  /** Same as {@link CheckHotelPriceOutput.priceChange} but for converted currency. */
  convertedPriceChange?: boolean;
  /** Same as {@link CheckHotelPriceOutput.priceDifference} but for converted currency. */
  convertedPriceDifference?: string;
  /** ISO 4217 currency code for the converted price fields. */
  convertedCurrencyCode?: string;
  /** Hotel identity and location. */
  hotel?: PriceCheckHotel;
  /** Refreshed rate, room, tax, fee, and penalty details. */
  rateInfo?: PriceCheckRateInfo;
  /** Sabre's application-level result envelope, when returned. */
  applicationResults?: PriceCheckApplicationResults;
}

/** Hotel identity and location. */
export interface PriceCheckHotel {
  /** Global property ID. Required by the spec. */
  code: string;
  /** Identifies the codespace for {@link PriceCheckHotel.code}. Required. */
  codeContext: 'SABRE' | 'GLOBAL';
  /** Sabre property ID, populated when mapped. */
  sabreCode?: string;
  /** Display name. */
  name?: string;
  /** Chain code (e.g., `HY`). */
  chainCode?: string;
  /** Chain display name. */
  chainName?: string;
  /** Brand code. */
  brandCode?: string;
  /** Brand display name. */
  brandName?: string;
  /** Sabre property rating (e.g., `"4"`). */
  sabreRating?: string;
  /** Location details. */
  location?: PriceCheckLocation;
}

/** Location information for a hotel. */
export interface PriceCheckLocation {
  /** Latitude as a string. */
  latitude?: string;
  /** Longitude as a string. */
  longitude?: string;
  /** Postal address. */
  address?: PriceCheckAddress;
  /** Contact details. */
  contact?: PriceCheckContact;
}

/** Postal address. */
export interface PriceCheckAddress {
  addressLine1?: string;
  addressLine2?: string;
  addressLine3?: string;
  /** City code and name. */
  city?: PriceCheckCityName;
  /** State / province code and name. */
  stateProv?: PriceCheckStateProv;
  postalCode?: string;
  /** Country code and name. */
  country?: PriceCheckCountryName;
}

/** City code + name pair. */
export interface PriceCheckCityName {
  code?: string;
  name?: string;
}

/** State/province code + name pair. */
export interface PriceCheckStateProv {
  code?: string;
  name?: string;
}

/** Country code + name pair. */
export interface PriceCheckCountryName {
  code?: string;
  name?: string;
}

/** Hotel contact details. */
export interface PriceCheckContact {
  phone?: string;
  fax?: string;
}

/**
 * Refreshed rate / room / penalty tree.
 *
 * Either `rooms` is populated (the rate is still available) or
 * `unavailability` is populated (Sabre refused to return the rate, with
 * a source and reason).
 */
export interface PriceCheckRateInfo {
  /** Rate-level summary as returned by the source. */
  rateInfos?: readonly PriceCheckRateInfoEntry[];
  /** Converted-currency sibling of {@link PriceCheckRateInfo.rateInfos}. */
  convertedRateInfos?: readonly PriceCheckRateInfoEntry[];
  /** Per-room detail. */
  rooms?: readonly PriceCheckRoom[];
  /** Present when Sabre refused to return the rate. */
  unavailability?: PriceCheckRateUnavailability;
}

/** Rate-level summary entry. */
export interface PriceCheckRateInfoEntry {
  startDate?: string;
  endDate?: string;
  amountBeforeTax?: string;
  amountAfterTax?: string;
  minSellingRate?: string;
  averageNightlyRate?: string;
  averageNightlyRateBeforeTax?: string;
  currencyCode?: string;
  additionalFeesInclusive?: boolean;
  taxInclusive?: boolean;
  localFeesInclusive?: boolean;
  incidentalsInclusive?: boolean;
  /** Source identifier (per the OAS example: numeric strings like `"100"`). Required by the spec. */
  rateSource: string;
  /** The opaque rate key. Required by the spec. */
  rateKey: string;
  approxTotalPrice?: string;
  highestNightlyRate?: string;
  commission?: PriceCheckCommission;
}

/** Rate unavailability details. */
export interface PriceCheckRateUnavailability {
  /** Source(s) of the unavailability reason. */
  sources: readonly PriceCheckRateSource[];
}

/** A single unavailability source / reason. */
export interface PriceCheckRateSource {
  /** Source identifier (e.g., `"110"`). */
  source: string;
  /** Free-text reason. */
  reason: string;
  /** Traveler-facing message. */
  displayMessage?: string;
}

/** Commission details for a rate. */
export interface PriceCheckCommission {
  percent?: number;
  amount?: string;
  currencyCode?: string;
  /** E.g., `Flat Rate`, `Amount`, `Percentage`, `Variable`. */
  type?: string;
  description?: readonly string[];
}

/** Per-room detail. */
export interface PriceCheckRoom {
  /** Indexed value of the room. Required. */
  roomIndex: number;
  roomType?: string;
  roomTypeCode?: number;
  accessibleAmenities?: readonly PriceCheckRoomAmenity[];
  roomCategory?: string;
  /** Property-specific room ID. */
  roomId?: string;
  floor?: number;
  roomViewCode?: number;
  roomViewDescription?: string;
  nonSmoking?: boolean;
  adults?: number;
  children?: number;
  bedTypes?: readonly PriceCheckBedType[];
  roomDescription?: PriceCheckRoomDescription;
  additionalDetails?: readonly PriceCheckAdditionalDetail[];
  amenities?: readonly PriceCheckRoomAmenity[];
  occupancy?: PriceCheckOccupancy;
  /** Rate plans available for this room. Required by the spec. */
  ratePlans: readonly PriceCheckRatePlan[];
}

/** Bed-type entry. */
export interface PriceCheckBedType {
  /** BED OTA code. */
  code?: number;
  description?: string;
  /** Number of beds of this type in the room. */
  count?: number;
}

/** Room description block. */
export interface PriceCheckRoomDescription {
  name?: string;
  text?: readonly string[];
}

/** An additional-detail entry attached to a room. */
export interface PriceCheckAdditionalDetail {
  /** ADT OTA code. */
  code?: number;
  description?: string;
  amount?: string;
  currencyCode?: string;
  text?: readonly string[];
}

/** Room-amenity entry. */
export interface PriceCheckRoomAmenity {
  /** HAC OTA code. */
  code?: number;
  description?: string;
  complimentary?: boolean;
  value?: string;
}

/** Room occupancy bounds. */
export interface PriceCheckOccupancy {
  min?: number;
  max?: number;
}

/** A rate plan offered for a room. */
export interface PriceCheckRatePlan {
  ratePlanName?: string;
  ratePlanCode?: string;
  ratePlanType?: string;
  ratePlanTypeDescription?: string;
  /**
   * Whether the rate can be prepaid. Required by the spec; Sabre reports
   * this per-rate-source (sources `100` are post-paid, `112` pre-paid).
   */
  prepaidIndicator: boolean;
  availableQuantity?: number;
  limitedAvailability?: string;
  /** Source identifier (e.g., `"100"`). Required. */
  rateSource: string;
  /** Opaque rate key. Required. */
  rateKey: string;
  clientId?: string;
  productCode?: string;
  loyaltyId?: string;
  ordinal?: string;
  refundability?: string;
  description?: readonly string[];
  inclusions?: readonly PriceCheckRatePlanInclusion[];
  mealsIncluded?: PriceCheckMealsIncluded;
  rateInfo?: PriceCheckRoomRateInfo;
  convertedRateInfo?: PriceCheckRoomRateInfo;
}

/** Rate-plan inclusion entry. */
export interface PriceCheckRatePlanInclusion {
  code?: number;
  description?: string;
  text?: readonly string[];
}

/** Meals-included block on a rate plan. */
export interface PriceCheckMealsIncluded {
  breakfast?: boolean;
  lunch?: boolean;
  dinner?: boolean;
  mealPlanIndicator?: boolean;
  /** MPT OTA code. */
  mealPlanCode?: number;
  mealPlanDescription?: string;
  guestCount?: number;
}

/** Rate detail on a rate plan. */
export interface PriceCheckRoomRateInfo {
  startDate?: string;
  endDate?: string;
  amountBeforeTax?: string;
  amountAfterTax?: string;
  minSellingRate?: string;
  averageNightlyRate?: string;
  averageNightlyRateBeforeTax?: string;
  currencyCode?: string;
  additionalFeesInclusive?: boolean;
  taxInclusive?: boolean;
  localFeesInclusive?: boolean;
  incidentalsInclusive?: boolean;
  rates?: readonly PriceCheckRate[];
  taxes?: PriceCheckTaxes;
  fees?: PriceCheckFees;
  roomExtras?: readonly PriceCheckRoomExtra[];
  /** Cancel penalties. Required by the spec. */
  cancelPenalties: readonly PriceCheckCancelPenalty[];
  guarantee?: PriceCheckGuarantee;
  additionalDetails?: readonly PriceCheckAdditionalDetail[];
}

/** Per-night rate range. */
export interface PriceCheckRate {
  startDate?: string;
  endDate?: string;
  amountBeforeTax?: string;
  amountAfterTax?: string;
  currencyCode?: string;
}

/** Aggregated tax block. */
export interface PriceCheckTaxes {
  amount?: string;
  currencyCode?: string;
  taxes?: readonly PriceCheckTax[];
  taxGroups?: readonly PriceCheckTaxGroup[];
}

/** A tax range entry. */
export interface PriceCheckTax {
  startDate?: string;
  endDate?: string;
  /** Tax amount. Required by the spec. */
  amount: string;
  /** Currency code. Required by the spec. */
  currencyCode: string;
}

/** Tax group entry (FTT OTA code). */
export interface PriceCheckTaxGroup {
  /** FTT OTA code. Required. */
  code: number;
  description?: string;
  /** Amount. Required. */
  amount: string;
  /** Currency code. Required. */
  currencyCode: string;
  descriptionText?: readonly string[];
}

/** Aggregated fee block. */
export interface PriceCheckFees {
  amount?: string;
  currencyCode?: string;
  fees?: readonly PriceCheckFee[];
  feeGroups?: readonly PriceCheckFeeGroup[];
}

/** A fee range entry. */
export interface PriceCheckFee {
  startDate?: string;
  endDate?: string;
  /** Fee amount. Required by the spec. */
  amount: string;
  /** Currency code. Required by the spec. */
  currencyCode: string;
}

/** Fee group entry (FTT OTA code). */
export interface PriceCheckFeeGroup {
  /** FTT OTA code. Required. */
  code: number;
  description?: string;
  /** Amount. Required. */
  amount: string;
  /** Currency code. Required. */
  currencyCode: string;
  descriptionText?: readonly string[];
}

/** Room-extra entry (RMA OTA code). */
export interface PriceCheckRoomExtra {
  code?: number;
  description?: string;
  amount?: string;
  currencyCode?: string;
  text?: string;
}

/** Cancel penalty entry. */
export interface PriceCheckCancelPenalty {
  /** Whether the penalty is refundable. Required by the spec. */
  refundable: boolean;
  deadline?: PriceCheckDeadline;
  amountPercent?: PriceCheckAmountPercent;
  descriptionText?: string;
}

/** Deadline details for a penalty / guarantee. */
export interface PriceCheckDeadline {
  absoluteDeadline?: string;
  offsetTimeUnit?: string;
  offsetUnitMultiplier?: number;
  /** When the deadline kicks in relative to the traveler's journey. */
  offsetDropTime?:
    | 'BeforeArrival'
    | 'AfterBooking'
    | 'AfterConfirmation'
    | 'AfterArrival'
    | 'AfterDeparture';
}

/** Amount-percent block (used by penalties and guarantees). */
export interface PriceCheckAmountPercent {
  taxInclusive?: boolean;
  feesInclusive?: boolean;
  numberOfNights?: number;
  basisType?: string;
  percent?: number;
  amount?: string;
  currencyCode?: string;
  applyAs?: string;
}

/** Guarantee block. */
export interface PriceCheckGuarantee {
  /** E.g., `GUAR`. */
  guaranteeType?: string;
  /** Accepted guarantee methods. Required by the spec. */
  accepted: readonly PriceCheckGuaranteeAccepted[];
  depositPolicies?: readonly PriceCheckDepositPolicy[];
  descriptionText?: readonly string[];
}

/** A single accepted-guarantee entry. */
export interface PriceCheckGuaranteeAccepted {
  /** PMT OTA code. */
  typeCode?: number;
  typeDescription?: string;
  /** Accepted payment cards. */
  paymentCards?: PriceCheckPaymentCardList;
}

/** Payment-card list. */
export interface PriceCheckPaymentCardList {
  cvvRequired?: boolean;
  cards: readonly PriceCheckPaymentCard[];
}

/** A single payment card. */
export interface PriceCheckPaymentCard {
  /** Card code (e.g., `AX`). Required. */
  code: string;
  /** Display value (e.g., `American Express`). */
  value?: string;
}

/** Deposit policy entry. */
export interface PriceCheckDepositPolicy {
  deadline?: PriceCheckDeadline;
  amountPercent?: PriceCheckAmountPercent;
}

/** Application-level result envelope. */
export interface PriceCheckApplicationResults {
  /** `Complete`, `Incomplete`, `NotProcessed`, or `Unknown`. */
  status?: 'Complete' | 'Incomplete' | 'NotProcessed' | 'Unknown';
  success?: readonly PriceCheckApplicationResultEntry[];
  errors?: readonly PriceCheckApplicationResultEntry[];
  warnings?: readonly PriceCheckApplicationResultEntry[];
}

/** A single application-result entry. */
export interface PriceCheckApplicationResultEntry {
  type?: string;
  timeStamp?: string;
  systemSpecificResults?: readonly PriceCheckSystemSpecificResult[];
}

/** Per-record system-specific diagnostic result. */
export interface PriceCheckSystemSpecificResult {
  timeStamp?: string;
  reference?: string;
  hostCommand?: PriceCheckHostCommand;
  messages?: readonly PriceCheckApplicationMessage[];
}

/** Host command attached to a diagnostic result. */
export interface PriceCheckHostCommand {
  lniata?: string;
}

/** Application-level code/message pair. */
export interface PriceCheckApplicationMessage {
  code?: string;
  value?: string;
}
