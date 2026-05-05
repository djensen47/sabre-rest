/**
 * Public input/output types for the Get Hotel Rate Info v5 service.
 *
 * Hand-written intentionally — not derived from `src/generated/`. The
 * generated types are kept internal so consumer-facing types stay stable
 * across spec changes and use idiomatic TypeScript naming.
 *
 * Get Hotel Rate Info returns **all available rates for a single hotel
 * property**, in contrast to {@link GetHotelAvailV5Service.getAvail}, which
 * returns lead rates across many properties. It is the optional third step
 * in the hotel shopping flow:
 *
 *   hotel-search (property discovery)
 *     → get-hotel-avail (lead rates, produces rateKey)
 *     → get-hotel-rate-info (per-property rate drill-down)       ← this service
 *     → hotel-price-check (revalidate a rateKey, produces bookingKey)
 *     → hotel booking (not yet wrapped)
 *
 * The API exposes two mutually exclusive request shapes (a `oneOf` at the
 * top of the OAS body): look up rates from scratch by hotel code + criteria,
 * or re-run a prior search using the opaque `RateKey` it returned. The
 * public input type models that as a discriminated union on `kind`.
 *
 * ## Why these types are duplicated with other hotel services
 *
 * The three hotel detail specs (get-hotel-avail, hotel-price-check, and
 * this one) each re-declare `HotelInfo`, the rate-plan tree, taxes, fees,
 * penalties, and guarantees inline — there are no cross-spec `$ref`s. Per
 * `docs/architecture.md` "Public type design rule #1" ("same `$ref` →
 * share; same shape today → don't trust it"), each service owns its copy.
 * This file uses a `RateInfo*` prefix (the others use `Avail*` and
 * `PriceCheck*`) so nothing is accidentally shared.
 */

// -----------------------------------------------------------------------------
// Input
// -----------------------------------------------------------------------------

/**
 * Input to {@link GetHotelRateInfoV5Service.getRateInfo}.
 *
 * Discriminated union mirroring the OAS `oneOf` between
 * `SearchByHotelRefsAndRateInfoRef` and `SearchByRateKey`:
 *
 *   - `kind: 'hotel-ref'` — fresh search. Supply the hotel reference plus
 *     full rate criteria (stay dates, rooms, filters, sort).
 *   - `kind: 'rate-key'` — re-run a prior search by its opaque `RateKey`,
 *     optionally narrowing with the handful of refinement fields Sabre
 *     accepts on this path.
 */
export type GetHotelRateInfoInput = RateInfoSearchByHotelRef | RateInfoSearchByRateKey;

/** Fresh-search variant: hotel reference + rate criteria. */
export interface RateInfoSearchByHotelRef {
  kind: 'hotel-ref';
  /** Hotel reference (code + context). Required. */
  hotelRef: RateInfoHotelRef;
  /** Rate search criteria (stay dates, rooms, filters, sort). Required. */
  rateCriteria: RateInfoRateCriteria;
  /** Point-of-sale override for branch shopping. */
  pointOfSale?: RateInfoPointOfSale;
  /** Corporate number for corporate-level pricing / preferencing. */
  corporateNumber?: string;
}

/** Rate-key variant: re-run a prior search. */
export interface RateInfoSearchByRateKey {
  kind: 'rate-key';
  /** Opaque rate key from a prior shop / avail response. Required. */
  rateKey: string;
  /** Point-of-sale override for branch shopping. */
  pointOfSale?: RateInfoPointOfSale;
  /** `IncludePrepaid` (default) / `PrepaidOnly` / `ExcludePrepaid`. */
  prepaidQualifier?: RateInfoPrepaidQualifier;
  /** When `true`, only refundable rates returned. */
  refundableOnly?: boolean;
  /** When `true`, only `ConvertedRateInfo` is returned (no native `RateInfo`). */
  convertedRateInfoOnly?: boolean;
  /** When `true`, only rates that exact-match the original criteria are returned. */
  exactMatchOnly?: boolean;
  /** Two-letter traveler country, for country-specific rates. */
  travellerCountry?: string;
  /** Pagination key to fetch the next set of rates from the same source. */
  shopKey?: string;
  /** Min / max nightly rate filter (pre-tax). */
  rateRange?: RateInfoRateRange;
  /**
   * Room attributes to group rates by (e.g., `"RoomView"`, `"RoomType"`).
   * Serialized on the wire as `RoomSetTypes.RoomSet[].Type`.
   */
  roomSetTypes?: readonly string[];
  /**
   * Comma-separated rate sources on the wire (e.g., `"100,110,112,113"`).
   * Exposed as a list here; the mapper joins at the boundary.
   */
  rateSource?: readonly string[];
}

/** Point-of-sale override. */
export interface RateInfoPointOfSale {
  /** Four-character PCC of the authorized branch. */
  pseudoCityCode: string;
}

/** A single hotel reference. */
export interface RateInfoHotelRef {
  /** Hotel code (global or Sabre, per {@link RateInfoHotelRef.codeContext}). Required. */
  code: string;
  /** `SABRE` (default server-side) or `GLOBAL`. */
  codeContext?: 'SABRE' | 'GLOBAL';
}

/** Rate search criteria (the `RateInfoRef` section of the request). */
export interface RateInfoRateCriteria {
  /** Check-in / check-out window. Required. */
  stayDateTimeRange: RateInfoStayDateTimeRange;
  /** Per-room occupancy. Required, minItems 1. */
  rooms: readonly RateInfoRequestedRoom[];

  /** ISO 4217 currency code. Required when `rateRange` is supplied. */
  currencyCode?: string;
  /** `IncludePrepaid` (default) / `PrepaidOnly` / `ExcludePrepaid`. */
  prepaidQualifier?: RateInfoPrepaidQualifier;
  /** When `true`, only refundable rates returned. */
  refundableOnly?: boolean;
  /** When `true`, only `ConvertedRateInfo` is returned. */
  convertedRateInfoOnly?: boolean;
  /** Two-letter traveler country, for country-specific rates. */
  travellerCountry?: string;
  /** Language code for rate text (e.g., `EN`). */
  languageCode?: string;
  /**
   * When `true`, negotiated / contractual (N/X) rates are listed first in
   * Sabre's supplier-returned order; remaining rates follow sorted by
   * `amountBeforeTax` ascending.
   */
  showNegotiatedRatesFirst?: boolean;
  /** Pagination key to fetch the next set of rates from the same source. */
  shopKey?: string;
  /** Min / max nightly rate filter (pre-tax). */
  rateRange?: RateInfoRateRange;
  /** Preferred negotiated / contractual rate candidates. */
  ratePlanCandidates?: RateInfoRatePlanCandidates;
  /** Traveler loyalty IDs. */
  loyaltyIds?: readonly string[];
  /** Commission / rate-code / rate-type include/exclude filters. */
  rateFilters?: readonly RateInfoRateFilter[];
  /** Sort order applied to {@link RateInfoRateCriteria.sortBy}. */
  sortOrder?: 'ASC' | 'DESC';
  /** Frequent-traveler number. */
  frequentFlyerNumber?: string;
  /** Corporate discount code. */
  corpDiscount?: string;
  /**
   * Comma-separated rate sources on the wire (e.g., `"100,112,110,113"`).
   * Exposed as a list here; the mapper joins at the boundary.
   */
  rateSource?: readonly string[];
  /** Sort key. */
  sortBy?: RateInfoSortBy;
}

/** Prepaid qualifier. */
export type RateInfoPrepaidQualifier = 'IncludePrepaid' | 'PrepaidOnly' | 'ExcludePrepaid';

/** Sort key. */
export type RateInfoSortBy =
  | 'AverageNightlyRateBeforeTax'
  | 'NightlyRate'
  | 'RateSource'
  | 'CommissionableRates'
  | 'Refundability'
  | 'CommissionPercentage'
  | 'AccessibleRates'
  | 'CancellationPenaltyDeadline'
  | 'NegotiatedRates'
  | 'PrepaidRates'
  | 'PostpaidRates';

/** Check-in / check-out window. */
export interface RateInfoStayDateTimeRange {
  /** Check-in date, `YYYY-MM-DD`. */
  startDate: string;
  /** Check-out date, `YYYY-MM-DD`. */
  endDate: string;
}

/** Per-room occupancy. */
export interface RateInfoRequestedRoom {
  /** 1-based index. All rooms must share adult + child counts. */
  index: number;
  /** Number of adults. Required, minimum 1. */
  adults: number;
  /** Number of children. */
  children?: number;
  /**
   * Child ages. Required (non-empty) when `children > 0`. Sabre's wire
   * format is a comma-separated string; the mapper joins at the boundary.
   */
  childAges?: readonly number[];
}

/** Nightly-rate range filter. */
export interface RateInfoRateRange {
  min?: number;
  max?: number;
}

/** Rate-plan candidate list. */
export interface RateInfoRatePlanCandidates {
  exactMatchOnly?: boolean;
  candidates: readonly RateInfoRatePlanCandidate[];
}

/** Single rate-plan candidate. */
export interface RateInfoRatePlanCandidate {
  /** Rate plan type (OTA RPT). */
  ratePlanType?: string;
  /** Rate plan code (e.g., `ABC`). */
  ratePlanCode?: string;
}

/** Include/exclude rate filter. */
export interface RateInfoRateFilter {
  /** `RateCode`, `RateType`, or `Commission`. */
  type: string;
  value: string;
  /** `Include` or `Exclude`. */
  action: 'Include' | 'Exclude';
}

// -----------------------------------------------------------------------------
// Output
// -----------------------------------------------------------------------------

/**
 * Output of {@link GetHotelRateInfoV5Service.getRateInfo}.
 *
 * Carries the application-level result envelope and the single hotel's
 * rate tree. Every record Sabre returned is preserved; undercooked rows
 * are not filtered out (that's consumer business logic).
 */
export interface GetHotelRateInfoOutput {
  /** Processing status from Sabre's application-results envelope. */
  status?: RateInfoStatus;
  /** Application-results diagnostics, when returned. */
  applicationResults?: RateInfoApplicationResults;
  /** The single hotel's rate details. */
  hotel?: RateInfoHotel;
}

/** Processing status. */
export type RateInfoStatus = 'Complete' | 'Incomplete' | 'NotProcessed' | 'Unknown';

/**
 * A hotel's full rate graph.
 *
 * Sabre's OAS expresses the response as a `oneOf` of
 * `ResponseWithRooms` / `ResponseWithRoomSets`. They share `info`,
 * `alternateHotels`, `rateInfos`, and `rateUnavailability`; they differ on
 * whether Sabre returned per-room detail (`rooms` + `languageCode`) or
 * grouped room-set detail (`roomSets`). The public type exposes both sets
 * as optional siblings so the mapper never has to choose a branch.
 */
export interface RateInfoHotel {
  /** Hotel identity codes. Required. */
  info: RateInfoHotelInfo;
  /** Alternate properties returned when Sabre could not price the request one. */
  alternateHotels?: readonly RateInfoAlternateHotel[];
  /** Rate-level summary entries. */
  rateInfos?: RateInfoRateEntries;
  /** Populated when Sabre refused to return rates for one or more sources. */
  rateUnavailability?: readonly RateInfoUnavailSource[];
  /** Per-room detail (response-with-rooms variant). */
  rooms?: readonly RateInfoRoomDetail[];
  /** Room-set detail (response-with-room-sets variant). */
  roomSets?: readonly RateInfoRoomSet[];
  /** ISO 639 two-character language code (response-with-rooms variant). */
  languageCode?: string;
}

/** Hotel identity codes. */
export interface RateInfoHotelInfo {
  /** Global property ID. Required by the spec. */
  code: string;
  /** Always `GLOBAL` in the response per the spec. Required. */
  codeContext: 'GLOBAL';
  /** Sabre property ID, populated when mapped. */
  sabreCode?: string;
  /** Chain code (e.g., `HY`). */
  chainCode?: string;
}

/** Alternate property suggestion. */
export interface RateInfoAlternateHotel {
  code?: string;
  codeContext?: 'GLOBAL';
  sabreCode?: string;
  chainCode?: string;
}

/** Rate-level summary block. */
export interface RateInfoRateEntries {
  /** Pagination key Sabre returns when more rates exist for the source. */
  shopKey?: string;
  /** Native-currency rate entries. */
  rateInfo?: readonly RateInfoRateEntry[];
  /** Converted-currency rate entries. */
  convertedRateInfo?: readonly RateInfoRateEntry[];
}

/** A single rate-level summary entry. */
export interface RateInfoRateEntry {
  /** Opaque rate key. Required by the spec. */
  rateKey: string;
  /** Source identifier (e.g., `"100"`). Required. */
  rateSource: string;
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
  commission?: RateInfoCommission;
}

/** Commission details. */
export interface RateInfoCommission {
  percent?: number;
  amount?: string;
  currencyCode?: string;
  /** `FlatRate`, `Amount`, `Percentage`, `Variable`, `None`. */
  type?: string;
  description?: readonly string[];
}

/** A single unavailability source / reason. */
export interface RateInfoUnavailSource {
  /** Source identifier (e.g., `"100"`). Required. */
  source: string;
  /** Free-text reason. Required. */
  reason: string;
  /** Traveler-facing message. */
  displayMessage?: string;
}

/** Per-room detail (from `ResponseWithRooms`). */
export interface RateInfoRoomDetail {
  /** 1-based room index. Required. */
  roomIndex: number;
  roomType?: string;
  roomTypeCode?: number;
  roomCategory?: string;
  roomId?: string;
  floor?: number;
  roomViewCode?: number;
  roomViewDescription?: string;
  nonSmoking?: boolean;
  bedTypes?: readonly RateInfoBedType[];
  roomDescription?: RateInfoRoomDescription;
  additionalDetails?: readonly RateInfoAdditionalDetail[];
  amenities?: readonly RateInfoRoomAmenity[];
  occupancy?: RateInfoOccupancy;
  /** Rate plans for this room. Required. */
  ratePlans: readonly RateInfoRatePlan[];
}

/** Room-set grouping (from `ResponseWithRoomSets`). */
export interface RateInfoRoomSet {
  /** Room attributes shared by rooms in the set. */
  attributes?: readonly RateInfoRoomSetAttribute[];
  /** Rooms in this set. */
  rooms?: readonly RateInfoRoomDetail[];
}

/** A single room-set attribute entry. */
export interface RateInfoRoomSetAttribute {
  /** Attribute type (e.g., `RoomType`). */
  type?: string;
  /** OTA code for the attribute. Not returned when `type` is `RateSource`. */
  code?: number;
  /** Attribute description (e.g., `Suite`). */
  value?: string;
}

/** Bed-type entry (BED OTA code). */
export interface RateInfoBedType {
  code?: number;
  description?: string;
  count?: number;
}

/** Room description. */
export interface RateInfoRoomDescription {
  name?: string;
  text?: readonly string[];
}

/** Additional-detail entry (ADT OTA code). */
export interface RateInfoAdditionalDetail {
  code?: number;
  description?: string;
  amount?: string;
  currencyCode?: string;
  text?: readonly string[];
}

/** Room amenity (HAC OTA code). */
export interface RateInfoRoomAmenity {
  code?: number;
  description?: string;
  complimentary?: boolean;
  accessibleAmenity?: boolean;
  value?: string;
}

/** Room occupancy bounds. */
export interface RateInfoOccupancy {
  min?: number;
  max?: number;
}

/** A rate plan offered for a room. */
export interface RateInfoRatePlan {
  /** Required by the spec. */
  prepaidIndicator: boolean;
  /** Source identifier (e.g., `"100"`). Required. */
  rateSource: string;
  /** Opaque rate key. Required. */
  rateKey: string;
  ratePlanName?: string;
  ratePlanCode?: string;
  ratePlanType?: string;
  availableQuantity?: number;
  limitedAvailability?: string;
  clientId?: string;
  productCode?: string;
  loyaltyId?: string;
  loyaltyPoints?: boolean;
  loyaltyProgramName?: string;
  description?: readonly string[];
  inclusions?: readonly RateInfoRatePlanInclusion[];
  mealsIncluded?: RateInfoMealsIncluded;
  rateInfo?: RateInfoRoomRateInfo;
  convertedRateInfo?: RateInfoRoomRateInfo;
}

/** Rate-plan inclusion entry. */
export interface RateInfoRatePlanInclusion {
  code?: number;
  description?: string;
  text?: readonly string[];
}

/** Meals-included block. */
export interface RateInfoMealsIncluded {
  breakfast?: boolean;
  lunch?: boolean;
  dinner?: boolean;
  mealPlanIndicator?: boolean;
  mealPlanCode?: number;
  mealPlanDescription?: string;
  guestCount?: number;
}

/** Detailed rate block attached to a rate plan. */
export interface RateInfoRoomRateInfo {
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
  rates?: readonly RateInfoRate[];
  taxes?: RateInfoTaxes;
  fees?: RateInfoFees;
  roomExtras?: readonly RateInfoRoomExtra[];
  /** Cancel penalties. Required by the spec. */
  cancelPenalties: readonly RateInfoCancelPenalty[];
  guarantee?: RateInfoGuarantee;
  additionalDetails?: readonly RateInfoAdditionalDetail[];
}

/** Per-night rate range. */
export interface RateInfoRate {
  startDate?: string;
  endDate?: string;
  amountBeforeTax?: string;
  amountAfterTax?: string;
  currencyCode?: string;
}

/** Aggregated tax block. */
export interface RateInfoTaxes {
  amount?: string;
  currencyCode?: string;
  taxes?: readonly RateInfoTax[];
  taxGroups?: readonly RateInfoTaxGroup[];
}

/** A single tax range entry. */
export interface RateInfoTax {
  startDate?: string;
  endDate?: string;
  /** Required. */
  amount: string;
  /** Required. */
  currencyCode: string;
}

/** Tax group entry (FTT OTA code). */
export interface RateInfoTaxGroup {
  /** FTT OTA code. Required. */
  code: number;
  description?: string;
  /** Required. */
  amount: string;
  /** Required. */
  currencyCode: string;
  descriptionText?: readonly string[];
}

/** Aggregated fee block. */
export interface RateInfoFees {
  amount?: string;
  currencyCode?: string;
  fees?: readonly RateInfoFee[];
  feeGroups?: readonly RateInfoFeeGroup[];
}

/** Fee range entry. */
export interface RateInfoFee {
  startDate?: string;
  endDate?: string;
  /** Required. */
  amount: string;
  /** Required. */
  currencyCode: string;
}

/** Fee group entry (FTT OTA code). */
export interface RateInfoFeeGroup {
  /** FTT OTA code. Required. */
  code: number;
  description?: string;
  /** Required. */
  amount: string;
  /** Required. */
  currencyCode: string;
  descriptionText?: readonly string[];
}

/** Room extra entry (RMA OTA code). */
export interface RateInfoRoomExtra {
  code?: number;
  description?: string;
  amount?: number;
  currencyCode?: string;
  /** Required by the spec. */
  text: readonly string[];
}

/** Cancel penalty entry. */
export interface RateInfoCancelPenalty {
  /** Required. */
  refundable: boolean;
  deadline?: RateInfoDeadline;
  amountPercent?: RateInfoAmountPercent;
  descriptionText?: readonly string[];
}

/** Deadline details (shared by penalties and deposit policies). */
export interface RateInfoDeadline {
  absoluteDeadline?: string;
  offsetTimeUnit?: string;
  offsetUnitMultiplier?: number;
  offsetDropTime?:
    | 'BeforeArrival'
    | 'AfterBooking'
    | 'AfterConfirmation'
    | 'AfterArrival'
    | 'AfterDeparture';
}

/** Amount-percent block. */
export interface RateInfoAmountPercent {
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
export interface RateInfoGuarantee {
  guaranteeType?: string;
  /** Required by the spec. */
  accepted: readonly RateInfoGuaranteeAccepted[];
  depositPolicies?: readonly RateInfoDepositPolicy[];
  descriptionText?: readonly string[];
}

/** Accepted-guarantee entry. */
export interface RateInfoGuaranteeAccepted {
  /** PMT OTA code. */
  typeCode?: number;
  typeDescription?: string;
  paymentCards?: RateInfoPaymentCardList;
}

/** Payment-card list. */
export interface RateInfoPaymentCardList {
  cvvRequired?: boolean;
  cards: readonly RateInfoPaymentCard[];
}

/** Single payment card. */
export interface RateInfoPaymentCard {
  /** Required. */
  code: string;
  value?: string;
}

/** Deposit policy entry. */
export interface RateInfoDepositPolicy {
  deadline?: RateInfoDeadline;
  amountPercent?: RateInfoAmountPercent;
}

/** Application-level result envelope. */
export interface RateInfoApplicationResults {
  status?: RateInfoStatus;
  success?: readonly RateInfoApplicationResultEntry[];
  errors?: readonly RateInfoApplicationResultEntry[];
  warnings?: readonly RateInfoApplicationResultEntry[];
}

/** Single result entry. */
export interface RateInfoApplicationResultEntry {
  type?: string;
  timeStamp?: string;
  systemSpecificResults?: readonly RateInfoSystemSpecificResult[];
}

/** Per-record system-specific diagnostic result. */
export interface RateInfoSystemSpecificResult {
  timeStamp?: string;
  reference?: string;
  hostCommand?: RateInfoHostCommand;
  messages?: readonly RateInfoApplicationMessage[];
}

/** Host command attached to a diagnostic. */
export interface RateInfoHostCommand {
  lniata?: string;
}

/** Application-level code/message pair. */
export interface RateInfoApplicationMessage {
  code?: string;
  value?: string;
}
