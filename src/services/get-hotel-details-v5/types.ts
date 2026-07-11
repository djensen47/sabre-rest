/**
 * Public input/output types for the Get Hotel Details v5 service.
 *
 * Hand-written intentionally — not derived from `src/generated/`. The
 * generated types are kept internal so consumer-facing types stay stable
 * across spec changes and use idiomatic TypeScript naming.
 *
 * Get Hotel Details is the CSL "Refine" step: given a hotel and stay
 * criteria (or an opaque `RateKey` from a prior Avail response), return the
 * full rate grid for one property along with descriptive and media content.
 * It is the canonical step between Avail and Price Check in the
 * orchestrated hotel booking flow:
 *
 *   hotel-search (property discovery)
 *     → get-hotel-avail (lead rates, produces rateKey)
 *     → get-hotel-details (per-property rate grid + content)    ← this service
 *     → hotel-price-check (revalidate a rateKey, produces bookingKey)
 *     → hotel booking (not yet wrapped)
 *
 * The API exposes two mutually exclusive request shapes (a `oneOf` at the
 * top of the OAS body): look up by hotel code + criteria, or re-run a prior
 * search using the opaque `RateKey` it returned. The public input type
 * models that as a discriminated union on `kind`.
 *
 * ## Why these types are duplicated with other hotel services
 *
 * The hotel specs (avail, rate-info, price-check, this one) each re-declare
 * `HotelInfo`, the rate-plan tree, taxes, fees, penalties, and guarantees
 * inline — there are no cross-spec `$ref`s. Per `docs/architecture.md`
 * "Public type design rule #1" ("same `$ref` → share; same shape today →
 * don't trust it"), each service owns its copy. This file uses a `Details*`
 * prefix (siblings use `Avail*`, `RateInfo*`, `PriceCheck*`) so nothing is
 * accidentally shared.
 */

// -----------------------------------------------------------------------------
// Input
// -----------------------------------------------------------------------------

/**
 * Input to {@link GetHotelDetailsV5Service.getDetails}.
 *
 * Discriminated union mirroring the OAS `oneOf` between
 * `SearchByHotelRefsAndRateInfoRef` and `SearchByRateKey`:
 *
 *   - `kind: 'hotel-ref'` — fresh lookup. Supply the hotel reference plus
 *     full rate criteria (stay dates, rooms, filters, sort) and optionally
 *     request descriptive / media content.
 *   - `kind: 'rate-key'` — re-run a prior search by its opaque `RateKey`,
 *     optionally narrowing with the refinement fields Sabre accepts on
 *     this path.
 */
export type GetHotelDetailsInput = DetailsSearchByHotelRef | DetailsSearchByRateKey;

/** Fresh-lookup variant: hotel reference + rate criteria. */
export interface DetailsSearchByHotelRef {
  kind: 'hotel-ref';
  /** Hotel reference (code + context). Required. */
  hotelRef: DetailsHotelRef;
  /** Rate search criteria (stay dates, rooms, filters, sort). Required. */
  rateCriteria: DetailsRateCriteria;
  /** Opt-in request for descriptive content / media blocks in the response. */
  contentRef?: DetailsContentRef;
  /** Point-of-sale override for branch shopping. */
  pointOfSale?: DetailsPointOfSale;
  /** Corporate number for corporate-level pricing / preferencing. */
  corporateNumber?: string;
  /** Pagination key to fetch the next set of rates from the same source. */
  shopKey?: string;
}

/** Rate-key variant: re-run a prior search. */
export interface DetailsSearchByRateKey {
  kind: 'rate-key';
  /** Opaque rate key from a prior shop / avail response. Required. */
  rateKey: string;
  /** Opt-in request for descriptive content / media blocks in the response. */
  contentRef?: DetailsContentRef;
  /** Point-of-sale override for branch shopping. */
  pointOfSale?: DetailsPointOfSale;
  /** Corporate number for corporate-level pricing / preferencing. */
  corporateNumber?: string;
  /** `IncludePrepaid` (default) / `PrepaidOnly` / `ExcludePrepaid`. */
  prepaidQualifier?: DetailsPrepaidQualifier;
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
  rateRange?: DetailsRateRange;
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
  /** Commission / rate-code / rate-type include/exclude filters. */
  rateFilters?: readonly DetailsRateFilter[];
  /** Sort order. */
  sortOrder?: 'ASC' | 'DESC';
  /** Sort key. */
  sortBy?: string;
}

/** Point-of-sale override. */
export interface DetailsPointOfSale {
  /** Four-character PCC of the authorized branch. */
  pseudoCityCode: string;
}

/** A single hotel reference. */
export interface DetailsHotelRef {
  /** Hotel code (global or Sabre, per {@link DetailsHotelRef.codeContext}). Required. */
  code: string;
  /** `SABRE` (default server-side) or `GLOBAL`. */
  codeContext?: 'SABRE' | 'GLOBAL';
}

/** Rate search criteria (the `RateInfoRef` section of the request). */
export interface DetailsRateCriteria {
  /** Check-in / check-out window. Required. */
  stayDateTimeRange: DetailsStayDateTimeRange;
  /** Per-room occupancy. Required, minItems 1. */
  rooms: readonly DetailsRequestedRoom[];

  /** ISO 4217 currency code. Required when `rateRange` is supplied. */
  currencyCode?: string;
  /** `IncludePrepaid` (default) / `PrepaidOnly` / `ExcludePrepaid`. */
  prepaidQualifier?: DetailsPrepaidQualifier;
  /** When `true`, only refundable rates returned. */
  refundableOnly?: boolean;
  /** When `true`, only `ConvertedRateInfo` is returned. */
  convertedRateInfoOnly?: boolean;
  /** Two-letter traveler country, for country-specific rates. */
  travellerCountry?: string;
  /** Min / max nightly rate filter (pre-tax). */
  rateRange?: DetailsRateRange;
  /** Commission / rate-code / rate-type include/exclude filters. */
  rateFilters?: readonly DetailsRateFilter[];
  /** Preferred negotiated / contractual rate candidates. */
  ratePlanCandidates?: DetailsRatePlanCandidates;
  /** Traveler loyalty IDs. */
  loyaltyIds?: readonly string[];
  /** Frequent-traveler number. */
  frequentFlyerNumber?: string;
  /** Corporate discount code. */
  corpDiscount?: string;
  /**
   * Comma-separated rate sources on the wire (e.g., `"100,112,110,113"`).
   * Exposed as a list here; the mapper joins at the boundary.
   */
  rateSource?: readonly string[];
  /** Sort order applied to {@link DetailsRateCriteria.sortBy}. */
  sortOrder?: 'ASC' | 'DESC';
  /** Sort key. */
  sortBy?: string;
}

/** Prepaid qualifier. */
export type DetailsPrepaidQualifier = 'IncludePrepaid' | 'PrepaidOnly' | 'ExcludePrepaid';

/** Check-in / check-out window. */
export interface DetailsStayDateTimeRange {
  /** Check-in date, `YYYY-MM-DD`. */
  startDate: string;
  /** Check-out date, `YYYY-MM-DD`. */
  endDate: string;
}

/** Per-room occupancy. */
export interface DetailsRequestedRoom {
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
export interface DetailsRateRange {
  min?: number;
  max?: number;
}

/** Rate-plan candidate list. */
export interface DetailsRatePlanCandidates {
  exactMatchOnly?: boolean;
  candidates: readonly DetailsRatePlanCandidate[];
}

/** Single rate-plan candidate. */
export interface DetailsRatePlanCandidate {
  /** Rate plan type (OTA RPT). */
  ratePlanType?: string;
  /** Rate plan code (e.g., `ABC`). */
  ratePlanCode?: string;
}

/** Include/exclude rate filter. */
export interface DetailsRateFilter {
  /**
   * Filter type. For `get-hotel-details`, Sabre accepts `RateCode`,
   * `RateType`, `Commission`, `BedType`, `RoomView`, `RoomType`, `Meals`.
   */
  type: string;
  value: string;
  /** `Include` or `Exclude`. */
  action: 'Include' | 'Exclude';
}

/**
 * Opt-in content-request block.
 *
 * Populated on the request to pull descriptive / media content into the
 * response. Get Hotel Details does not return property info, amenities,
 * etc. unless these flags are set.
 */
export interface DetailsContentRef {
  descriptiveInfo?: DetailsDescriptiveInfoRequest;
  media?: DetailsMediaRequest;
}

/** Which descriptive-info blocks to include in the response. */
export interface DetailsDescriptiveInfoRequest {
  propertyInfo?: boolean;
  locationInfo?: boolean;
  amenities?: boolean;
  securityFeatures?: boolean;
  sustainability?: boolean;
  /** Free-text description categories to include. */
  descriptions?: readonly DetailsDescriptionType[];
}

/** Description categories requestable under `HotelContentRef.DescriptiveInfoRef.Descriptions`. */
export type DetailsDescriptionType =
  | 'ShortDescription'
  | 'Dining'
  | 'Facilities'
  | 'Recreation'
  | 'Services'
  | 'Attractions'
  | 'CancellationPolicy'
  | 'DepositPolicy'
  | 'Directions'
  | 'Policies'
  | 'SafetyInfo'
  | 'TransportationInfo'
  | 'GuaranteePolicy';

/** Which media blocks to include in the response. */
export interface DetailsMediaRequest {
  maxItems?: string;
  /** Image sizes to request. */
  images?: readonly DetailsImageSize[];
  /** Panoramic-media types to request. */
  panoramicMedias?: readonly 'HD360'[];
  /** Video types to request. */
  videos?: readonly DetailsVideoType[];
  /** Category codes to filter by. */
  categories?: readonly number[];
  /** Languages to filter by (ISO 639). */
  languages?: readonly string[];
}

/** Supported media type buckets. */
export type DetailsMediaType = 'IMAGE' | 'VIDEO' | 'PANORAMIC';

/** Supported image size variants. */
export type DetailsImageSize = 'ORIGINAL' | 'THUMBNAIL' | 'SMALL' | 'MEDIUM' | 'LARGE';

/** Supported video type variants. */
export type DetailsVideoType = 'VIDEO360' | 'VIDEO720' | 'VIDEOTHUMBNAIL' | 'ALL';

// -----------------------------------------------------------------------------
// Output
// -----------------------------------------------------------------------------

/**
 * Output of {@link GetHotelDetailsV5Service.getDetails}.
 *
 * Carries the application-level result envelope and the single hotel's
 * full rate-plus-content tree. Every record Sabre returned is preserved;
 * undercooked rows are not filtered out (that's consumer business logic).
 */
export interface GetHotelDetailsOutput {
  /** Processing status from Sabre's application-results envelope. */
  status?: DetailsStatus;
  /** Application-results diagnostics, when returned. */
  applicationResults?: DetailsApplicationResults;
  /** The hotel's rate + content tree. */
  hotel?: DetailsHotel;
  /** Translated-content block, when returned (non-English response). */
  translated?: DetailsTranslated;
}

/** Processing status. */
export type DetailsStatus = 'Complete' | 'Incomplete' | 'NotProcessed' | 'Unknown';

/**
 * A hotel's full rate + content graph.
 *
 * Sabre's OAS unwraps this as `HotelDetailsInfo` (no array envelope), with
 * a nested `HotelRateInfo` that is itself a `oneOf` of `ResponseWithRooms`
 * / `ResponseWithRoomSets`. They share `rateInfos` and `rateUnavailability`;
 * they differ on whether Sabre returned per-room detail (`rooms`) or
 * grouped room-set detail (`roomSets`). The public type exposes both sets
 * as optional siblings so the mapper never has to choose a branch.
 */
export interface DetailsHotel {
  /** Hotel identity codes + summary metadata. Required. */
  info: DetailsHotelInfo;
  /** Alternate properties returned when Sabre could not price the request one. */
  alternateHotels?: readonly DetailsAlternateHotel[];
  /** Descriptive content (property info, location, amenities, etc.). */
  descriptiveInfo?: DetailsDescriptiveInfo;
  /** Media content (images, panoramics, videos). */
  mediaInfo?: DetailsMediaInfo;
  /** Rate-level summary entries. */
  rateInfos?: DetailsRateEntries;
  /** Populated when Sabre refused to return rates for one or more sources. */
  rateUnavailability?: readonly DetailsUnavailSource[];
  /** Per-room detail (response-with-rooms variant). */
  rooms?: readonly DetailsRoomDetail[];
  /** Room-set detail (response-with-room-sets variant). */
  roomSets?: readonly DetailsRoomSet[];
}

/** Hotel identity + summary block. */
export interface DetailsHotelInfo {
  /** Global property ID. Required by the spec. */
  code: string;
  /** `SABRE` or `GLOBAL`. Required. */
  codeContext: 'SABRE' | 'GLOBAL';
  /** Sabre property ID, populated when mapped. */
  sabreCode?: string;
  hotelName?: string;
  chainCode?: string;
  chainName?: string;
  brandCode?: string;
  brandName?: string;
  status?: 'Active' | 'Inactive';
  sabreRating?: string;
  /** URL of the hotel logo image. */
  logo?: string;
}

/** Alternate property suggestion. */
export interface DetailsAlternateHotel {
  info?: DetailsAlternateHotelInfo;
  /** Image attached to the alternate. */
  image?: DetailsImageItem;
  /** Alternate-hotel rate summary. Shape is supplier-dependent; preserved as-is. */
  rateInfo?: unknown;
}

/** Alternate-property identity block. */
export interface DetailsAlternateHotelInfo {
  code?: string;
  codeContext?: 'SABRE' | 'GLOBAL';
  sabreCode?: string;
  chainCode?: string;
}

/** Rate-level summary block. */
export interface DetailsRateEntries {
  /** Pagination key Sabre returns when more rates exist for the source. */
  shopKey?: string;
  /** Native-currency rate entries. */
  rateInfo?: readonly DetailsRateEntry[];
  /** Converted-currency rate entries. */
  convertedRateInfo?: readonly DetailsRateEntry[];
}

/** A single rate-level summary entry. */
export interface DetailsRateEntry {
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
  /** All-inclusive display rate (taxes + fees), for prepaid rates when it differs from `amountAfterTax`. */
  approxTotalPrice?: string;
  /** Overall highest nightly rate (excluding taxes/fees) across the stay. */
  highestNightlyRate?: string;
  commission?: DetailsCommission;
}

/** Commission details. */
export interface DetailsCommission {
  percent?: number;
  amount?: string;
  currencyCode?: string;
  /** `FlatRate`, `Amount`, `Percentage`, `Variable`, `None`. */
  type?: string;
  description?: readonly string[];
}

/** A single unavailability source / reason. */
export interface DetailsUnavailSource {
  /** Source identifier (e.g., `"100"`). Required. */
  source: string;
  /** Free-text reason. Required. */
  reason: string;
  /** Traveler-facing message. */
  displayMessage?: string;
}

/** Per-room detail (from `ResponseWithRooms`). */
export interface DetailsRoomDetail {
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
  /** Number of bedrooms within this room (e.g., a multi-bedroom suite). */
  numberOfBedRooms?: number;
  bedTypes?: readonly DetailsBedType[];
  roomDescription?: DetailsRoomDescription;
  additionalDetails?: readonly DetailsAdditionalDetail[];
  amenities?: readonly DetailsRoomAmenity[];
  /** Accessibility-specific amenities for this room, separate from {@link DetailsRoomDetail.amenities}. */
  accessibleAmenities?: readonly DetailsHotelAmenity[];
  occupancy?: DetailsOccupancy;
  /** Photos specific to this room, separate from the hotel-level {@link DetailsHotel.mediaInfo}. */
  roomMediaInfo?: DetailsMediaInfo;
  /** Rate plans for this room. Required. */
  ratePlans: readonly DetailsRatePlan[];
}

/** Room-set grouping (from `ResponseWithRoomSets`). */
export interface DetailsRoomSet {
  /** Room attributes shared by rooms in the set. */
  attributes?: readonly DetailsRoomSetAttribute[];
  /** Rooms in this set. */
  rooms?: readonly DetailsRoomDetail[];
}

/** A single room-set attribute entry. */
export interface DetailsRoomSetAttribute {
  /** Attribute type (e.g., `RoomType`). */
  type?: string;
  /** OTA code for the attribute. Not returned when `type` is `RateSource`. */
  code?: number;
  /** Attribute description (e.g., `Suite`). */
  value?: string;
}

/** Bed-type entry (BED OTA code). */
export interface DetailsBedType {
  code?: number;
  description?: string;
  count?: number;
}

/** Room description. */
export interface DetailsRoomDescription {
  name?: string;
  text?: readonly string[];
}

/** Additional-detail entry (ADT OTA code). */
export interface DetailsAdditionalDetail {
  code?: number;
  description?: string;
  amount?: string;
  currencyCode?: string;
  text?: readonly string[];
}

/** Room amenity (HAC OTA code). */
export interface DetailsRoomAmenity {
  code?: number;
  description?: string;
  complimentary?: boolean;
  accessibleAmenity?: boolean;
  value?: string;
}

/** Room occupancy bounds. */
export interface DetailsOccupancy {
  min?: number;
  max?: number;
}

/** A rate plan offered for a room. */
export interface DetailsRatePlan {
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
  inclusions?: readonly DetailsRatePlanInclusion[];
  mealsIncluded?: DetailsMealsIncluded;
  rateInfo?: DetailsRoomRateInfo;
  convertedRateInfo?: DetailsRoomRateInfo;
}

/** Rate-plan inclusion entry. */
export interface DetailsRatePlanInclusion {
  code?: number;
  description?: string;
  text?: readonly string[];
}

/** Meals-included block. */
export interface DetailsMealsIncluded {
  breakfast?: boolean;
  lunch?: boolean;
  dinner?: boolean;
  mealPlanIndicator?: boolean;
  mealPlanCode?: number;
  mealPlanDescription?: string;
  guestCount?: number;
}

/** Detailed rate block attached to a rate plan. */
export interface DetailsRoomRateInfo {
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
  rates?: readonly DetailsRate[];
  taxes?: DetailsTaxes;
  fees?: DetailsFees;
  roomExtras?: readonly DetailsRoomExtra[];
  /** Cancel penalties. Required by the spec. */
  cancelPenalties: readonly DetailsCancelPenalty[];
  guarantee?: DetailsGuarantee;
  additionalDetails?: readonly DetailsAdditionalDetail[];
}

/** Per-night rate range. */
export interface DetailsRate {
  startDate?: string;
  endDate?: string;
  amountBeforeTax?: string;
  amountAfterTax?: string;
  currencyCode?: string;
}

/** Aggregated tax block. */
export interface DetailsTaxes {
  amount?: string;
  currencyCode?: string;
  taxes?: readonly DetailsTax[];
  taxGroups?: readonly DetailsTaxGroup[];
}

/** A single tax range entry. */
export interface DetailsTax {
  startDate?: string;
  endDate?: string;
  /** Required. */
  amount: string;
  /** Required. */
  currencyCode: string;
}

/** Tax group entry (FTT OTA code). */
export interface DetailsTaxGroup {
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
export interface DetailsFees {
  amount?: string;
  currencyCode?: string;
  fees?: readonly DetailsFee[];
  feeGroups?: readonly DetailsFeeGroup[];
}

/** Fee range entry. */
export interface DetailsFee {
  startDate?: string;
  endDate?: string;
  /** Required. */
  amount: string;
  /** Required. */
  currencyCode: string;
}

/** Fee group entry (FTT OTA code). */
export interface DetailsFeeGroup {
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
export interface DetailsRoomExtra {
  code?: number;
  description?: string;
  amount?: string;
  currencyCode?: string;
  /** Lists descriptions of the room extra and what it applies to. */
  text?: readonly string[];
}

/** Cancel penalty entry. */
export interface DetailsCancelPenalty {
  /** Required. */
  refundable: boolean;
  deadline?: DetailsDeadline;
  amountPercent?: DetailsAmountPercent;
  descriptionText?: readonly string[];
}

/** Deadline details (shared by penalties and deposit policies). */
export interface DetailsDeadline {
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
export interface DetailsAmountPercent {
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
export interface DetailsGuarantee {
  guaranteeType?: string;
  /** Required by the spec. */
  accepted: readonly DetailsGuaranteeAccepted[];
  depositPolicies?: readonly DetailsDepositPolicy[];
  descriptionText?: readonly string[];
}

/** Accepted-guarantee entry. */
export interface DetailsGuaranteeAccepted {
  /** PMT OTA code. */
  typeCode?: number;
  typeDescription?: string;
  paymentCards?: DetailsPaymentCardList;
}

/** Payment-card list. */
export interface DetailsPaymentCardList {
  cvvRequired?: boolean;
  cards: readonly DetailsPaymentCard[];
}

/** Single payment card. */
export interface DetailsPaymentCard {
  /** Required. */
  code: string;
  value?: string;
}

/** Deposit policy entry. */
export interface DetailsDepositPolicy {
  deadline?: DetailsDeadline;
  amountPercent?: DetailsAmountPercent;
}

// --- Descriptive-info block (opt-in via request.contentRef.descriptiveInfo) ---

/** Descriptive-info tree. */
export interface DetailsDescriptiveInfo {
  propertyInfo?: DetailsPropertyInfo;
  locationInfo?: DetailsLocationInfo;
  amenities?: readonly DetailsHotelAmenity[];
  securityFeatures?: readonly DetailsSecurityFeature[];
  sustainability?: DetailsSustainability;
  descriptions?: readonly DetailsDescription[];
}

/** Property-level metadata (floors, rooms, policies, quality). */
export interface DetailsPropertyInfo {
  floors?: string;
  rooms?: string;
  propertyTypes?: readonly DetailsPropertyType[];
  policies?: readonly DetailsPolicyText[];
  propertyQuality?: readonly DetailsPropertyQuality[];
}

/** Property type entry (PCT OTA code). */
export interface DetailsPropertyType {
  code?: number;
  description?: string;
}

/** Property-policy text entry (check-in / check-out). */
export interface DetailsPolicyText {
  type?: 'CheckIn' | 'CheckOut';
  value?: string;
}

/** Property-quality entry (LOS OTA code). */
export interface DetailsPropertyQuality {
  code?: number;
  description?: string;
}

/** Location block (coordinates, address, neighborhoods, contact). */
export interface DetailsLocationInfo {
  latitude?: number;
  longitude?: number;
  address?: DetailsAddress;
  neighborhoods?: readonly DetailsNeighborhood[];
  contact?: DetailsContact;
}

/** Postal address. */
export interface DetailsAddress {
  /** Required. */
  addressLine1: string;
  addressLine2?: string;
  addressLine3?: string;
  /** City info. */
  city?: DetailsCity;
  stateProv?: DetailsStateProv;
  /** Required. */
  postalCode: string;
  country?: DetailsCountry;
}

/** City component. */
export interface DetailsCity {
  cityCode?: string;
  value?: string;
}

/** State / province component. */
export interface DetailsStateProv {
  stateCode?: string;
  value?: string;
}

/** Country component. */
export interface DetailsCountry {
  code?: string;
  value?: string;
}

/** Neighborhood polygon entry. */
export interface DetailsNeighborhood {
  id?: string;
  value?: string;
}

/** Property contact info. */
export interface DetailsContact {
  phone?: string;
  fax?: string;
}

/** Hotel amenity entry (HAC OTA code). */
export interface DetailsHotelAmenity {
  code?: number;
  description?: string;
  complimentary?: boolean;
  value?: string;
}

/** Security feature entry (SEC OTA code). */
export interface DetailsSecurityFeature {
  code?: number;
  description?: string;
  value?: string;
}

/**
 * Sustainability block — preserved as the raw generated shape.
 *
 * Sabre's spec nests sustainability content through 20+ sub-types that rarely
 * show up in practice; modeling each one as a public type is premature.
 * Consumers that need the data can cast through; when real usage emerges
 * we'll formalize the important fields.
 */
export interface DetailsSustainability {
  /** Sustainable practices block (raw Sabre shape). */
  sustainablePractices?: unknown;
  /** Certifications block (raw Sabre shape). */
  certifications?: unknown;
  /** Structured emissions/carbon-footprint/recycling/water/energy block (raw Sabre shape). */
  environmentalImpact?: unknown;
}

/** Free-text description entry. */
export interface DetailsDescription {
  /** Category (e.g., `ShortDescription`, `Dining`). */
  type?: DetailsDescriptionType;
  /** Description paragraphs. */
  text?: readonly string[];
}

// --- Media block (opt-in via request.contentRef.media) -----------------------

/** Media-info tree. */
export interface DetailsMediaInfo {
  items?: readonly DetailsMediaItem[];
}

/** A single media item. */
export interface DetailsMediaItem {
  id?: string;
  type?: DetailsMediaType;
  ordinal?: number;
  caption?: string;
  roomTypeCode?: string;
  lastModifiedDate?: string;
  format?: DetailsImageFormat;
  category?: DetailsMediaCategory;
  images?: readonly DetailsImageVariant[];
  panoramics?: readonly DetailsPanoramicVariant[];
  videos?: readonly DetailsVideoVariant[];
}

/** Supported image file formats. */
export type DetailsImageFormat = 'BMP' | 'GIF' | 'ICO' | 'JPG' | 'PNG' | 'TIFF' | 'WEBP';

/** Media-category block. */
export interface DetailsMediaCategory {
  code?: number;
  description?: string;
}

/** Image variant (one size). */
export interface DetailsImageVariant {
  url?: string;
  size?: DetailsImageSize;
  height?: number;
  width?: number;
}

/** Panoramic-image variant. */
export interface DetailsPanoramicVariant {
  url?: string;
  type?: 'HD360';
  height?: number;
  width?: number;
}

/** Video variant. */
export interface DetailsVideoVariant {
  url?: string;
  type?: DetailsVideoType;
  height?: number;
  width?: number;
}

/** Alternate-property image (shape shared with {@link DetailsMediaItem} without categorization). */
export interface DetailsImageItem {
  id?: string;
  format?: DetailsImageFormat;
  images?: readonly DetailsImageVariant[];
  /** Date the media item was last updated. Raw Sabre shape (spec leaves the type unspecified). */
  lastModifiedDate?: unknown;
  /** OTA category codes for the media item. */
  categoryCodes?: readonly number[];
  /** Display priority (lower is higher priority). */
  ordinal?: number;
}

// --- Translated-content block ------------------------------------------------

/**
 * Translated-content block returned when Sabre localized the response.
 *
 * Carries a translated `hotel` sub-tree plus a `languageCode`. The full
 * nested structure is preserved but not deeply re-modeled — consumers who
 * need drill-down parity with the primary block should submit the request
 * in the target language rather than rely on this block.
 */
export interface DetailsTranslated {
  languageCode?: string;
  info?: DetailsHotelInfo;
  descriptiveInfo?: DetailsDescriptiveInfo;
  mediaInfo?: DetailsMediaInfo;
  alternateHotels?: readonly DetailsAlternateHotel[];
  /** Translated rate-info block (raw Sabre shape). */
  rateInfo?: unknown;
}

// --- Application-results envelope --------------------------------------------

/** Application-level result envelope. */
export interface DetailsApplicationResults {
  status?: DetailsStatus;
  success?: readonly DetailsApplicationResultEntry[];
  errors?: readonly DetailsApplicationResultEntry[];
  warnings?: readonly DetailsApplicationResultEntry[];
}

/** Single result entry. */
export interface DetailsApplicationResultEntry {
  type?: string;
  timeStamp?: string;
  systemSpecificResults?: readonly DetailsSystemSpecificResult[];
}

/** Per-record system-specific diagnostic result. */
export interface DetailsSystemSpecificResult {
  timeStamp?: string;
  reference?: string;
  hostCommand?: DetailsHostCommand;
  messages?: readonly DetailsApplicationMessage[];
}

/** Host command attached to a diagnostic. */
export interface DetailsHostCommand {
  lniata?: string;
}

/** Application-level code/message pair. */
export interface DetailsApplicationMessage {
  code?: string;
  value?: string;
}
