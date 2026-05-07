/**
 * Public input/output types for the Get Hotel Avail v5 service.
 *
 * Hand-written intentionally — not derived from `src/generated/`. The
 * generated types are kept internal so consumer-facing types stay stable
 * across spec changes and use idiomatic TypeScript naming.
 *
 * Get Hotel Avail returns lead rates across multiple hotel properties in
 * a single call. It is the **middle step** in the hotel flow:
 *
 *   hotel-search (property discovery, no rates)
 *     → get-hotel-avail (lead rates, produces rateKey)     ← this service
 *     → hotel-price-check (revalidate a rateKey, produces bookingKey)
 *     → hotel booking (not yet wrapped)
 *
 * The key handoff value is {@link AvailRateEntry.rateKey}, which consumers
 * feed into {@link HotelPriceCheckV5Service.check}. Because the spec marks
 * it optional on the native-currency branch and required on the converted-
 * currency branch, the public type exposes it as optional on both — the
 * mapper never drops records without a key, so consumers must check for
 * its presence before handing it downstream.
 *
 * ## Why these types are duplicated with other hotel services
 *
 * The three hotel specs (hotel-search, hotel-price-check, get-hotel-avail)
 * each re-declare `HotelInfo`, `LocationInfo`, `Address`, and the big
 * rate-plan tree inline — there are no cross-spec `$ref`s. Per
 * `docs/architecture.md` "Public type design rule #1" ("same `$ref` →
 * share; same shape today → don't trust it"), each service owns its copy.
 * This file uses an `Avail*` prefix (the others use `Hotel*` and
 * `PriceCheck*`) so nothing is accidentally shared.
 */

/**
 * Input to {@link GetHotelAvailV5Service.getAvail}.
 *
 * The search anchor is a tagged union: supply `search.kind: 'geo'` with a
 * geographic anchor, or `search.kind: 'hotels'` with an explicit list of
 * hotel references. The `rateInfoRef` section carries the availability
 * search criteria (currency, rate-sourcing preference, stay window, and
 * room occupancy) and is required.
 */
export interface GetHotelAvailInput {
  /** Search anchor — geographic or hotel-reference. Required. */
  search: AvailSearchByGeo | AvailSearchByHotels;

  /** Availability search criteria (currency, stay, rooms, filters). Required. */
  rateInfoRef: AvailRateInfoRef;

  /** Point-of-sale override for branch shopping. */
  pointOfSale?: AvailPointOfSale;

  /** Corporate number for corporate-level pricing / preferencing. */
  corporateNumber?: string;

  /** Sort, paging, and response-shape preferences. */
  criteria?: AvailSearchCriteria;

  /** Optional content filters (name, chain, brand, code groups, rating). */
  hotelPref?: AvailHotelPreferences;

  /** Optional image-retrieval preferences. */
  imageRef?: AvailImagePreferences;
}

/** Point-of-sale override. */
export interface AvailPointOfSale {
  /** Four-character PCC of the authorized branch. */
  pseudoCityCode: string;
}

/** Sort, paging, and response-shape preferences. */
export interface AvailSearchCriteria {
  /** Page number. */
  offSet?: number;
  /** Sort key. */
  sortBy?: AvailSortBy;
  /** `ASC` / `DESC`. Ignored when `sortBy === 'NegotiatedRateAvailability'`. */
  sortOrder?: 'ASC' | 'DESC';
  /** Max properties per page (1-200). */
  pageSize?: number;
  /** Encrypted shop key to page a prior search. */
  shopKey?: string;
  /** Include tier-label values for preferenced properties. */
  tierLabels?: boolean;
  /**
   * When `true`, Sabre omits properties without rate details from the
   * response. Defaults to `true` server-side.
   */
  rateDetailsInd?: boolean;
}

/** Sort key. */
export type AvailSortBy =
  | 'NegotiatedRateAvailability'
  | 'DistanceFrom'
  | 'SabreRating'
  | 'AverageNightlyRate'
  | 'AverageNightlyRateBeforeTax';

/** Geographic search anchor. */
export interface AvailSearchByGeo {
  kind: 'geo';
  /** Radius + UOM + specific point (geoCode / refPoint / addressRef). */
  geoRef: AvailGeoRef;
  /**
   * Post-filter attributes (e.g., `LOCALAREA`). Applies only to polygon
   * searches (`refPoint` with `refPointType: '37'`).
   */
  attributes?: readonly AvailGeoAttribute[];
}

/** Hotel-reference search anchor. */
export interface AvailSearchByHotels {
  kind: 'hotels';
  /** Specific hotels to reprice. At least one required by the spec. */
  hotels: readonly AvailHotelRef[];
}

/** A single hotel reference for a hotel-ref search. */
export interface AvailHotelRef {
  /** Hotel code (global or Sabre, per {@link AvailHotelRef.codeContext}). Required. */
  code: string;
  /** `SABRE` or `GLOBAL`. Defaults server-side to `SABRE`. */
  codeContext?: 'SABRE' | 'GLOBAL';
}

/** Post-filter attribute for a polygon search. */
export interface AvailGeoAttribute {
  /** Filter name. Currently only `LOCALAREA` is documented. */
  name: string;
  /** Filter value (e.g., `KRAKOW AREA` when `name` is `LOCALAREA`). */
  value: string;
}

/**
 * Geographic anchor. Exactly one variant: `geoCode`, `refPoint`, or
 * `addressRef`. All share `radius` + `uom`.
 *
 * See `docs/guides/hotel-search-anchors.md` for how to pick an anchor
 * type, the full OTA `refPointType` table, and CERT-specific caveats.
 */
export type AvailGeoRef = AvailGeoCodeRef | AvailReferencePointRef | AvailAddressRef;

/** Common fields for every geo-ref variant. */
export interface AvailGeoRefCommon {
  /** Search radius. Max 200 mi / 320 km. */
  radius: number;
  /** Unit of measure. */
  uom: AvailDistanceUnit;
  /** Restrict to a country code (e.g., `US`). */
  restrictToCountry?: string;
}

/** `MI` or `KM`. */
export type AvailDistanceUnit = 'MI' | 'KM';

/** Lat/lon anchor. */
export interface AvailGeoCodeRef extends AvailGeoRefCommon {
  kind: 'geoCode';
  latitude: number;
  longitude: number;
}

/**
 * Reference-point anchor: airport / landmark / polygon / etc.
 * `refPointType` is an OTA code: `5` (city), `6` (airport),
 * `7` (rail station), `11` (landmark), `16` (metro station),
 * `18` (neighborhood), `37` (polygon). See
 * `docs/guides/hotel-search-anchors.md` for the full table.
 */
export interface AvailReferencePointRef extends AvailGeoRefCommon {
  kind: 'refPoint';
  refPointType: '5' | '6' | '7' | '11' | '16' | '18' | '37';
  value: string;
  valueContext: 'NAME' | 'CODE';
  stateProv?: string;
  countryCode?: string;
}

/**
 * Address anchor. `countryCode` is the only required field; others
 * narrow the match.
 */
export interface AvailAddressRef extends AvailGeoRefCommon {
  kind: 'addressRef';
  countryCode: string;
  street?: string;
  city?: string;
  county?: string;
  postalCode?: string;
  stateProv?: string;
}

/** Availability search criteria (required section of the request). */
export interface AvailRateInfoRef {
  /** ISO 4217 currency code (e.g., `USD`). Required. */
  currencyCode: string;
  /**
   * `1` = lowest across sources, `2` = lowest per source, `3` = lowest per
   * source + lowest negotiated, `4` = lowest public + lowest negotiated +
   * `rateRanges` for GDS. Required.
   */
  bestOnly: '1' | '2' | '3' | '4';
  /** Check-in / check-out window. Required. */
  stayDateTimeRange: AvailStayDateTimeRange;
  /** Per-room occupancy. Required. */
  rooms: readonly AvailRequestedRoom[];

  /** `IncludePrepaid` (default) / `ExcludePrepaid` / `PrepaidOnly`. */
  prepaidQualifier?: 'IncludePrepaid' | 'PrepaidOnly' | 'ExcludePrepaid';
  /** When `true`, only refundable rates returned. */
  refundableOnly?: boolean;
  /** When `true`, only `ConvertedRateInfo` is returned (no native `RateInfo`). */
  convertedRateInfoOnly?: boolean;
  /** Two-letter traveler country, for country-specific rates. */
  travellerCountry?: string;
  /** Min / max nightly rate filter (pre-tax). */
  rateRange?: AvailRateRange;
  /** Commission / rate-code / rate-type include/exclude filters. */
  rateFilters?: readonly AvailRateFilter[];
  /** Preferred negotiated / contractual rate candidates. */
  ratePlanCandidates?: AvailRatePlanCandidates;
  /** Traveler loyalty IDs. */
  loyaltyIds?: readonly string[];
  /** Frequent-traveler number. */
  frequentFlyerNumber?: string;
  /** Corporate discount code. */
  corpDiscount?: string;
  /**
   * Comma-separated rate sources on the wire (e.g., `"100,110,112,113"`).
   * Exposed as a string list here; the mapper joins at the boundary.
   */
  rateSource?: readonly string[];
}

/** Check-in / check-out window. */
export interface AvailStayDateTimeRange {
  /** Check-in date, `YYYY-MM-DD`. */
  startDate: string;
  /** Check-out date, `YYYY-MM-DD`. */
  endDate: string;
}

/** Per-room occupancy. */
export interface AvailRequestedRoom {
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
export interface AvailRateRange {
  min?: number;
  max?: number;
}

/** Include/exclude rate filter. */
export interface AvailRateFilter {
  /** `RateCode`, `RateType`, or `Commission`. */
  type: string;
  value: string;
  /** `Include` or `Exclude`. */
  action: 'Include' | 'Exclude';
}

/** Rate-plan candidate list. */
export interface AvailRatePlanCandidates {
  exactMatchOnly?: boolean;
  otherAvailableRatePlans?: boolean;
  candidates: readonly AvailRatePlanCandidate[];
}

/** Single rate-plan candidate. */
export interface AvailRatePlanCandidate {
  /** Rate plan type (OTA RPT). */
  ratePlanType?: string;
  /** Rate plan code (e.g., `ABC`). */
  ratePlanCode?: string;
}

/** Content filters applied to results. */
export interface AvailHotelPreferences {
  /** Exact-match hotel name (3-100 chars, strict pattern). */
  hotelName?: string;
  /** Lenient hotel name (partial match). Mutually exclusive with `hotelName`. */
  lenientHotelName?: string;
  brandCodes?: readonly string[];
  chainCodes?: readonly string[];
  amenityCodes?: AvailCodeFilter;
  securityFeatureCodes?: AvailCodeFilter;
  propertyTypeCodes?: AvailCodeFilter;
  propertyQualityCodes?: AvailCodeFilter;
  sabreRating?: AvailSabreRatingFilter;
}

/** Code-list filter with `inclusive` toggle. */
export interface AvailCodeFilter {
  codes: readonly number[];
  /** When `true`, property must have all codes; `false` = at least one. */
  inclusive?: boolean;
}

/** Sabre-rating range, as strings per the OAS pattern. */
export interface AvailSabreRatingFilter {
  min?: string;
  max?: string;
}

/** Image-retrieval preferences. */
export interface AvailImagePreferences {
  type?: 'ORIGINAL' | 'THUMBNAIL' | 'SMALL' | 'MEDIUM' | 'LARGE';
  categoryCode?: number;
  languageCode?: string;
}

// -----------------------------------------------------------------------------
// Output
// -----------------------------------------------------------------------------

/**
 * Output of {@link GetHotelAvailV5Service.getAvail}.
 *
 * Carries paging metadata plus the matching hotels with their rate
 * information. Every hotel Sabre returned is preserved; undercooked
 * records are not filtered out (that's consumer business logic).
 */
export interface GetHotelAvailOutput {
  /** Echoed page number. */
  offSet?: number;
  /** Total matches across all pages. */
  maxSearchResults?: number;
  /** Shop key for paging the same search. */
  shopKey?: string;
  /** Echoed search latitude (geo anchors only). */
  searchLatitude?: number;
  /** Echoed search longitude (geo anchors only). */
  searchLongitude?: number;
  /** Matching hotels with rate info, in Sabre's response order. */
  hotels: readonly AvailHotel[];
  /** Diagnostic envelope when returned. */
  applicationResults?: AvailApplicationResults;
}

/**
 * A single hotel with its identity and rate information.
 *
 * Combines Sabre's `HotelInfo` (identity, location, amenities) and
 * `HotelRateInfo` (rates, rooms, rate plans). Only `code` and
 * `codeContext` are required — every other field mirrors OAS optionality.
 */
export interface AvailHotel {
  /** Global hotel code. Sabre always returns this as the global code. */
  code: string;
  /** Always `GLOBAL` in the response per the spec. */
  codeContext: 'GLOBAL';
  /** Sabre property ID, populated when available. */
  sabreCode?: string;
  name?: string;
  chainCode?: string;
  chainName?: string;
  brandCode?: string;
  brandName?: string;
  /** Distance from the search anchor. */
  distance?: number;
  /** Compass direction from the anchor (`N`, `S`, `E`, `W`). */
  direction?: string;
  /** Unit of measure for `distance`. */
  distanceUnit?: AvailDistanceUnit;
  /** Lead-image logo URL. */
  logo?: string;
  /** Sabre property rating as a string (e.g., `"3.5"`). */
  sabreRating?: string;
  /**
   * When `true`, the requested negotiated rate code / client ID is valid
   * for this property.
   */
  canReturnRequestedNegotiatedRate?: boolean;
  /** Preferenced-property display order. */
  ordinal?: number;
  tierLabels?: readonly AvailTierLabel[];
  location?: AvailLocation;
  amenities?: readonly AvailAmenity[];
  securityFeatures?: readonly AvailSecurityFeature[];
  propertyTypes?: readonly AvailPropertyType[];
  propertyQualities?: readonly AvailPropertyQuality[];
  /** Rate graph for this hotel. */
  rateInfo?: AvailHotelRateInfo;
}

/** Agency / corporate / supplier tier label. */
export interface AvailTierLabel {
  type?: string;
  value?: string;
  programId?: string;
}

/** Hotel location. */
export interface AvailLocation {
  latitude?: string;
  longitude?: string;
  address?: AvailAddress;
  neighborhoods?: readonly AvailNeighborhood[];
  contact?: AvailContact;
}

/** Postal address. */
export interface AvailAddress {
  addressLine1?: string;
  addressLine2?: string;
  addressLine3?: string;
  city?: AvailCityName;
  stateProv?: AvailStateProv;
  postalCode?: string;
  country?: AvailCountryName;
}

/** City code + name pair. */
export interface AvailCityName {
  code?: string;
  name?: string;
}

/** State/province code + name pair. */
export interface AvailStateProv {
  code?: string;
  name?: string;
}

/** Country code + name pair. */
export interface AvailCountryName {
  code?: string;
  name?: string;
}

/** Neighborhood / polygon membership. */
export interface AvailNeighborhood {
  id?: string;
  name?: string;
}

/** Contact details. */
export interface AvailContact {
  phone?: string;
  fax?: string;
}

/** Amenity entry (OTA HAC code). */
export interface AvailAmenity {
  code?: number;
  description?: string;
  complimentary?: boolean;
  value?: string;
}

/** Security feature entry (OTA SEC code). */
export interface AvailSecurityFeature {
  code?: number;
  description?: string;
  value?: string;
}

/** Property-type entry (OTA PCT code). */
export interface AvailPropertyType {
  code?: number;
  description?: string;
}

/** Property-quality entry (OTA LOS code). */
export interface AvailPropertyQuality {
  code?: number;
  description?: string;
}

/**
 * Rate graph for a hotel: native and converted rate entries, per-room
 * rate plans, optionally available rate plans, and an unavailability
 * fallback.
 */
export interface AvailHotelRateInfo {
  /** Min/max rate ranges (populated only when `bestOnly === '4'`). */
  rateRanges?: readonly AvailRateRangeEntry[];
  /** Native-currency rate entries. `rateKey` is optional here per the spec. */
  rateInfo?: readonly AvailRateEntry[];
  /** Converted-currency rate entries. */
  convertedRateInfo?: readonly AvailRateEntry[];
  /** Per-room detail. */
  rooms?: readonly AvailRoom[];
  /** Other available rate plans (populated when requested). */
  availableRatePlans?: readonly AvailAvailableRatePlan[];
  /** Present when Sabre refused to return rates for this property. */
  unavailability?: AvailRateUnavailability;
}

/** Min/max rate range entry. */
export interface AvailRateRangeEntry {
  minRate?: string;
  maxRate?: string;
  currencyCode?: string;
  convertedMinRate?: string;
  convertedMaxRate?: string;
  convertedCurrencyCode?: string;
  rateSource?: string;
}

/**
 * A single rate entry — the primary carrier of the opaque `rateKey` the
 * downstream {@link HotelPriceCheckV5Service.check} call requires.
 *
 * Sabre emits two branches:
 *   - `RateInfo` (native currency): `rateKey` is **optional** in the OAS.
 *   - `ConvertedRateInfo`: `rateKey` is **required** in the OAS.
 *
 * The public type exposes `rateKey` as optional on both branches so the
 * mapper can preserve undercooked records (per the "don't drop data"
 * rule). Consumers must check `rateKey` before handing it to price-check.
 */
export interface AvailRateEntry {
  startDate?: string;
  endDate?: string;
  amountBeforeTax?: string;
  amountAfterTax?: string;
  minSellingRate?: string;
  averageNightlyRate?: string;
  averageNightlyRateBeforeTax?: string;
  highestNightlyRate?: string;
  approxTotalPrice?: string;
  currencyCode?: string;
  additionalFeesInclusive?: boolean;
  taxInclusive?: boolean;
  localFeesInclusive?: boolean;
  incidentalsInclusive?: boolean;
  /** Rate source (e.g., `"100"`, `"110"`). */
  rateSource?: string;
  /** Opaque rate key. Feed into hotel-price-check. */
  rateKey?: string;
  commission?: AvailCommission;
}

/** Commission details. */
export interface AvailCommission {
  percent?: number;
  amount?: string;
  currencyCode?: string;
  /** `FlatRate`, `Amount`, `Percentage`, `Variable`, `None`. */
  type?: string;
  description?: readonly string[];
}

/** Rate unavailability envelope. */
export interface AvailRateUnavailability {
  sources: readonly AvailRateSource[];
}

/** Single unavailability source / reason. */
export interface AvailRateSource {
  /** Source identifier (e.g., `"110"`). */
  source: string;
  /** Free-text reason. */
  reason: string;
  /** Traveler-facing message. */
  displayMessage?: string;
}

/** Available rate plan entry. */
export interface AvailAvailableRatePlan {
  ratePlanCode?: string;
  ratePlanType?: string;
  ratePlanTypeDescription?: string;
  clientId?: string;
  rateSource?: string;
}

/** Per-room detail. */
export interface AvailRoom {
  /** 1-based index. Required. */
  roomIndex: number;
  roomType?: string;
  roomTypeCode?: number;
  roomCategory?: string;
  roomId?: string;
  floor?: number;
  roomViewCode?: number;
  roomViewDescription?: string;
  nonSmoking?: boolean;
  sharedRoomInd?: boolean;
  adults?: number;
  children?: number;
  bedTypes?: readonly AvailBedType[];
  roomDescription?: AvailRoomDescription;
  additionalDetails?: readonly AvailAdditionalDetail[];
  amenities?: readonly AvailRoomAmenity[];
  accessibleAmenities?: readonly AvailRoomAmenity[];
  occupancy?: AvailOccupancy;
  /** Rate plans for this room. Required by the spec. */
  ratePlans: readonly AvailRatePlan[];
}

/** Bed-type entry (BED OTA code). */
export interface AvailBedType {
  code?: number;
  description?: string;
  count?: number;
}

/** Room description. */
export interface AvailRoomDescription {
  name?: string;
  text?: readonly string[];
}

/** Additional-detail entry (ADT OTA code). */
export interface AvailAdditionalDetail {
  code?: number;
  description?: string;
  amount?: string;
  currencyCode?: string;
  text?: readonly string[];
}

/** Room amenity (HAC OTA code). */
export interface AvailRoomAmenity {
  code?: number;
  description?: string;
  complimentary?: boolean;
  value?: string;
}

/** Room occupancy bounds. */
export interface AvailOccupancy {
  min?: number;
  max?: number;
}

/**
 * A rate plan offered for a room. The spec marks `PrepaidIndicator`,
 * `RateSource`, and `RateKey` required; everything else optional.
 */
export interface AvailRatePlan {
  ratePlanName?: string;
  ratePlanCode?: string;
  ratePlanType?: string;
  ratePlanTypeDescription?: string;
  /** Required by the spec. */
  prepaidIndicator: boolean;
  availableQuantity?: number;
  limitedAvailability?: string;
  /** Required. */
  rateSource: string;
  /** Required. Opaque rate key. */
  rateKey: string;
  clientId?: string;
  productCode?: string;
  loyaltyId?: string;
  ordinal?: string;
  description?: readonly string[];
  inclusions?: readonly AvailRatePlanInclusion[];
  mealsIncluded?: AvailMealsIncluded;
  rateInfo?: AvailRoomRateInfo;
  convertedRateInfo?: AvailRoomRateInfo;
}

/** Rate-plan inclusion entry. */
export interface AvailRatePlanInclusion {
  code?: number;
  description?: string;
  text?: readonly string[];
}

/** Meals-included block. */
export interface AvailMealsIncluded {
  breakfast?: boolean;
  lunch?: boolean;
  dinner?: boolean;
  mealPlanIndicator?: boolean;
  mealPlanCode?: number;
  mealPlanDescription?: string;
  guestCount?: number;
}

/** Detailed rate block attached to a rate plan. */
export interface AvailRoomRateInfo {
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
  rates?: readonly AvailRate[];
  taxes?: AvailTaxes;
  fees?: AvailFees;
  roomExtras?: readonly AvailRoomExtra[];
  /** Cancel penalties. Required by the spec. */
  cancelPenalties: readonly AvailCancelPenalty[];
  guarantee?: AvailGuarantee;
  additionalDetails?: readonly AvailAdditionalDetail[];
}

/** Per-night rate range. */
export interface AvailRate {
  startDate?: string;
  endDate?: string;
  amountBeforeTax?: string;
  amountAfterTax?: string;
  currencyCode?: string;
}

/** Aggregated tax block. */
export interface AvailTaxes {
  amount?: string;
  currencyCode?: string;
  taxes?: readonly AvailTax[];
  taxGroups?: readonly AvailTaxGroup[];
}

/** Tax range entry. */
export interface AvailTax {
  startDate?: string;
  endDate?: string;
  /** Required. */
  amount: string;
  /** Required. */
  currencyCode: string;
}

/** Tax group entry (FTT OTA code). */
export interface AvailTaxGroup {
  /** Required. */
  code: number;
  description?: string;
  /** Required. */
  amount: string;
  /** Required. */
  currencyCode: string;
  descriptionText?: readonly string[];
}

/** Aggregated fee block. */
export interface AvailFees {
  amount?: string;
  currencyCode?: string;
  fees?: readonly AvailFee[];
  feeGroups?: readonly AvailFeeGroup[];
}

/** Fee range entry. */
export interface AvailFee {
  startDate?: string;
  endDate?: string;
  /** Required. */
  amount: string;
  /** Required. */
  currencyCode: string;
}

/** Fee group entry (FTT OTA code). */
export interface AvailFeeGroup {
  /** Required. */
  code: number;
  description?: string;
  /** Required. */
  amount: string;
  /** Required. */
  currencyCode: string;
  descriptionText?: readonly string[];
}

/** Room extra entry (RMA OTA code). */
export interface AvailRoomExtra {
  code?: number;
  description?: string;
  amount?: string;
  currencyCode?: string;
  text?: readonly string[];
}

/** Cancel penalty entry. */
export interface AvailCancelPenalty {
  /** Required. */
  refundable: boolean;
  deadline?: AvailDeadline;
  amountPercent?: AvailAmountPercent;
  descriptionText?: readonly string[];
}

/** Deadline block (shared by penalties and deposit policies). */
export interface AvailDeadline {
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
export interface AvailAmountPercent {
  taxInclusive?: boolean;
  feesInclusive?: boolean;
  numberOfNights?: number;
  percent?: number;
  amount?: string;
  currencyCode?: string;
}

/** Guarantee block. */
export interface AvailGuarantee {
  guaranteeType?: string;
  /** Required. */
  accepted: readonly AvailGuaranteeAccepted[];
  depositPolicies?: readonly AvailDepositPolicy[];
  descriptionText?: readonly string[];
}

/** Accepted-guarantee entry. */
export interface AvailGuaranteeAccepted {
  /** PMT OTA code. */
  typeCode?: number;
  typeDescription?: string;
  paymentCards?: AvailPaymentCardList;
}

/** Payment-card list. */
export interface AvailPaymentCardList {
  cvvRequired?: boolean;
  cards: readonly AvailPaymentCard[];
}

/** Single payment card. */
export interface AvailPaymentCard {
  /** Required. */
  code: string;
  value?: string;
}

/** Deposit policy entry. */
export interface AvailDepositPolicy {
  deadline?: AvailDeadline;
  amountPercent?: AvailAmountPercent;
}

/** Application-level result envelope. */
export interface AvailApplicationResults {
  status?: 'Complete' | 'Incomplete' | 'NotProcessed' | 'Unknown';
  success?: readonly AvailApplicationResultEntry[];
  errors?: readonly AvailApplicationResultEntry[];
  warnings?: readonly AvailApplicationResultEntry[];
}

/** Single result entry. */
export interface AvailApplicationResultEntry {
  type?: string;
  timeStamp?: string;
  systemSpecificResults?: readonly AvailSystemSpecificResult[];
}

/** Per-record system-specific diagnostic result. */
export interface AvailSystemSpecificResult {
  timeStamp?: string;
  reference?: string;
  hostCommand?: AvailHostCommand;
  messages?: readonly AvailApplicationMessage[];
}

/** Host command attached to a diagnostic. */
export interface AvailHostCommand {
  lniata?: string;
}

/** Application-level code/message pair. */
export interface AvailApplicationMessage {
  code?: string;
  value?: string;
}
