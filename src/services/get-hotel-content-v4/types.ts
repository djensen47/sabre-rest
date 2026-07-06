/**
 * Public input/output types for the Get Hotel Content v4 service.
 *
 * Hand-written intentionally — not derived from `src/generated/`. The
 * generated types are kept internal so consumer-facing types stay stable
 * across spec changes and use idiomatic TypeScript naming.
 *
 * Get Hotel Content returns **descriptive and media content for a single
 * hotel property** — no rates, no pricing. It is a pure content lookup,
 * usable independently of the hotel shopping flow (property discovery,
 * avail, rate drill-down, price check) that the other hotel services cover.
 *
 * Unlike `get-hotel-details` / `get-hotel-rate-info`, this API has no
 * "rerun by opaque key" mode — the only way in is a hotel reference, so the
 * input is a single object shape rather than a discriminated union.
 *
 * ## Why these types are duplicated with other hotel services
 *
 * The hotel specs (avail, rate-info, details, price-check, this one) each
 * re-declare `HotelInfo` and the application-results envelope inline —
 * there are no cross-spec `$ref`s. Per `docs/architecture.md` "Public type
 * design rule #1" ("same `$ref` → share; same shape today → don't trust
 * it"), each service owns its copy. This file uses a `Content*` prefix
 * (siblings use `Avail*`, `RateInfo*`, `Details*`, `PriceCheck*`) so nothing
 * is accidentally shared.
 */

// -----------------------------------------------------------------------------
// Input
// -----------------------------------------------------------------------------

/**
 * Input to {@link GetHotelContentV4Service.getContent}.
 *
 * A hotel reference is required; descriptive info and media are opt-in via
 * {@link GetHotelContentInput.descriptiveInfo} and
 * {@link GetHotelContentInput.media} — Sabre returns neither block unless
 * explicitly requested.
 */
export interface GetHotelContentInput {
  /** Hotel reference (code + context). Required. */
  hotelRef: ContentHotelRef;
  /** Which descriptive-info blocks to include in the response. */
  descriptiveInfo?: ContentDescriptiveInfoRequest;
  /** Which media blocks to include in the response. */
  media?: ContentMediaRequest;
  /** Point-of-sale override for branch shopping. */
  pointOfSale?: ContentPointOfSale;
}

/** Point-of-sale override. */
export interface ContentPointOfSale {
  /** Four-character PCC of the authorized branch. */
  pseudoCityCode: string;
}

/** A hotel reference. */
export interface ContentHotelRef {
  /** Hotel code (global or Sabre, per {@link ContentHotelRef.codeContext}). Required. */
  code: string;
  /** `SABRE` (default server-side) or `GLOBAL`. */
  codeContext?: 'SABRE' | 'GLOBAL';
}

/**
 * Opt-in request for descriptive content blocks.
 *
 * Sabre does not return property info, location info, amenities, security
 * features, or free-text descriptions unless the corresponding flag is set.
 */
export interface ContentDescriptiveInfoRequest {
  propertyInfo?: boolean;
  locationInfo?: boolean;
  amenities?: boolean;
  securityFeatures?: boolean;
  /** Free-text description categories to include. */
  descriptions?: readonly ContentDescriptionType[];
}

/** Description categories requestable under `DescriptiveInfoRef.Descriptions`. */
export type ContentDescriptionType =
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

/** Opt-in request for media content blocks. */
export interface ContentMediaRequest {
  /** Maximum media items requested. `"ALL"` or `"1"`–`"99"`. */
  maxItems?: string;
  /** Image sizes to request. Serialized on the wire at `MediaTypes.Images.Image[]`. */
  images?: readonly ContentImageSize[];
  /** Panoramic-media types to request. Serialized at `MediaTypes.PanoramicMedias.PanoramicMedia[]`. */
  panoramicMedias?: readonly 'HD360'[];
  /** Video types to request. Serialized at `MediaTypes.Videos.Video[]`. */
  videos?: readonly ContentVideoType[];
  /** Category codes to filter by. */
  categories?: readonly number[];
  /** Room type codes to filter by. */
  roomTypeCodes?: readonly string[];
  /**
   * Which additional-info flags to request (e.g., include captions).
   * Serialized on the wire as `AdditionalInfo.Info[]`.
   */
  additionalInfo?: readonly ContentAdditionalInfoFlag[];
  /** Languages to filter by (ISO 639, two-character). */
  languages?: readonly string[];
}

/** Supported image size variants. */
export type ContentImageSize = 'ORIGINAL' | 'THUMBNAIL' | 'SMALL' | 'MEDIUM' | 'LARGE';

/** Supported video type variants. */
export type ContentVideoType = 'VIDEO360' | 'VIDEO720' | 'VIDEOTHUMBNAIL' | 'ALL';

/**
 * An additional-info flag on the request.
 *
 * Unlike the other `MediaRef` list fields, `AdditionalInfo.Info[]` items are
 * a type + boolean flag pair (e.g., `{ Type: "CAPTION", value: true }`),
 * not a plain type list.
 */
export interface ContentAdditionalInfoFlag {
  /** Which additional-info category this flag controls. */
  type: 'CAPTION' | 'ROOM_TYPE_CODE';
  /** If `true`, the information for this type is requested in the response. */
  value: boolean;
}

// -----------------------------------------------------------------------------
// Output
// -----------------------------------------------------------------------------

/**
 * Output of {@link GetHotelContentV4Service.getContent}.
 *
 * Carries the application-level result envelope and the single hotel's
 * descriptive + media content. Every record Sabre returned is preserved;
 * undercooked rows are not filtered out (that's consumer business logic).
 */
export interface GetHotelContentOutput {
  /** Processing status from Sabre's application-results envelope. */
  status?: ContentStatus;
  /** Application-results diagnostics, when returned. */
  applicationResults?: ContentApplicationResults;
  /** The hotel's content. */
  hotel?: ContentHotel;
}

/** Processing status. */
export type ContentStatus = 'Complete' | 'Incomplete' | 'NotProcessed' | 'Unknown';

/** A hotel's summary + descriptive + media content. */
export interface ContentHotel {
  /** Hotel identity codes + summary metadata. Required. */
  info: ContentHotelInfo;
  /** Descriptive content (property info, location, amenities, etc.). */
  descriptiveInfo?: ContentDescriptiveInfo;
  /** Media content (images, panoramics, videos). */
  mediaInfo?: ContentMediaInfo;
}

/** Hotel identity + summary block. */
export interface ContentHotelInfo {
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
  /** Agency / supplier labels assigned to the property. */
  tierLabels?: readonly ContentTierLabel[];
}

/** Agency or supplier label assigned to a property. */
export interface ContentTierLabel {
  type?: string;
  value?: string;
  /** Preferencing program to which this label belongs. */
  programId?: string;
}

// --- Descriptive-info block (opt-in via request.descriptiveInfo) -----------

/** Descriptive-info tree. */
export interface ContentDescriptiveInfo {
  propertyInfo?: ContentPropertyInfo;
  locationInfo?: ContentLocationInfo;
  amenities?: readonly ContentHotelAmenity[];
  securityFeatures?: readonly ContentSecurityFeature[];
  descriptions?: readonly ContentDescription[];
}

/** Property-level metadata (floors, rooms, policies, quality). */
export interface ContentPropertyInfo {
  floors?: string;
  rooms?: string;
  propertyTypes?: readonly ContentPropertyType[];
  policies?: readonly ContentPolicyText[];
  propertyQuality?: readonly ContentPropertyQuality[];
}

/** Property type entry (PCT OTA code). */
export interface ContentPropertyType {
  code?: number;
  description?: string;
}

/** Property-policy text entry (check-in / check-out). */
export interface ContentPolicyText {
  type?: 'CheckIn' | 'CheckOut';
  value?: string;
}

/** Property-quality entry (LOS OTA code). */
export interface ContentPropertyQuality {
  code?: number;
  description?: string;
}

/** Location block (coordinates, address, neighborhoods, contact). */
export interface ContentLocationInfo {
  latitude?: number;
  longitude?: number;
  address?: ContentAddress;
  neighborhoods?: readonly ContentNeighborhood[];
  contact?: ContentContact;
}

/** Postal address. */
export interface ContentAddress {
  /** Required. */
  addressLine1: string;
  addressLine2?: string;
  addressLine3?: string;
  /** City info. Required. */
  city: ContentCity;
  stateProv?: ContentStateProv;
  /** Required. */
  postalCode: string;
  /** Required. */
  country: ContentCountry;
}

/** City component. */
export interface ContentCity {
  cityCode?: string;
  value?: string;
}

/** State / province component. */
export interface ContentStateProv {
  stateCode?: string;
  value?: string;
}

/** Country component. */
export interface ContentCountry {
  code?: string;
  value?: string;
}

/** Neighborhood polygon entry. */
export interface ContentNeighborhood {
  id?: string;
  value?: string;
}

/** Property contact info. */
export interface ContentContact {
  phone?: string;
  fax?: string;
}

/** Hotel amenity entry (HAC OTA code). */
export interface ContentHotelAmenity {
  code?: number;
  description?: string;
  complimentary?: boolean;
  value?: string;
}

/** Security feature entry (SEC OTA code). */
export interface ContentSecurityFeature {
  code?: number;
  description?: string;
  value?: string;
}

/** Free-text description entry. */
export interface ContentDescription {
  /** Category (e.g., `ShortDescription`, `Dining`). */
  type?: ContentDescriptionType;
  /** Description text. */
  text?: string;
}

// --- Media block (opt-in via request.media) ---------------------------------

/** Media-info tree. */
export interface ContentMediaInfo {
  items?: readonly ContentMediaItem[];
}

/**
 * A single media item.
 *
 * `id`, `ordinal`, `lastModifiedDate`, and `format` are required by the
 * spec (`MediaItem.required: [Format, Id, LastModifedDate, Ordinal]`) — the
 * misspelling `LastModifedDate` is Sabre's own and is confined to the
 * mapper's generated-type access; the public field is spelled correctly.
 */
export interface ContentMediaItem {
  id: string;
  ordinal: number;
  /** `YYYY-MM-DD`. */
  lastModifiedDate: string;
  format: ContentImageFormat;
  images?: readonly ContentImageVariant[];
  panoramics?: readonly ContentPanoramicVariant[];
  videos?: readonly ContentVideoVariant[];
  category?: ContentMediaCategory;
  /** Room type codes this media item applies to. */
  roomTypeCodes?: readonly string[];
  additionalInfo?: readonly ContentMediaAdditionalInfo[];
}

/** Supported image file formats. */
export type ContentImageFormat = 'BMP' | 'GIF' | 'ICO' | 'JPG' | 'PNG' | 'TIFF' | 'WEBP';

/** Media-category block. */
export interface ContentMediaCategory {
  code?: number;
  /** Category description text, one entry per requested language. */
  description?: readonly ContentLocalizedText[];
}

/** A description string in a specific language. */
export interface ContentLocalizedText {
  /** Two-character ISO 639 language code. */
  language?: string;
  value?: string;
}

/**
 * Image variant (one size). `url`, `type`, `height`, and `width` are all
 * required by the spec's `response.Image` schema.
 */
export interface ContentImageVariant {
  url: string;
  size: ContentImageSize;
  height: number;
  width: number;
}

/**
 * Panoramic-image variant. `url`, `type`, `height`, and `width` are all
 * required by the spec's `response.PanoramicMedia` schema.
 */
export interface ContentPanoramicVariant {
  url: string;
  type: 'HD360';
  height: number;
  width: number;
}

/**
 * Video variant. `url`, `type`, `height`, and `width` are all required by
 * the spec's `response.Video` schema.
 */
export interface ContentVideoVariant {
  url: string;
  type: ContentVideoType;
  height: number;
  width: number;
}

/**
 * Additional-info entry attached to a media item.
 *
 * `type` and `description` are both required by the spec
 * (`response.AdditionalInfo.Info.required: [Description, Type]`).
 */
export interface ContentMediaAdditionalInfo {
  type: 'CAPTION' | 'ROOM_TYPE_CODE';
  /** Description text, one entry per requested language. */
  description: readonly ContentLocalizedText[];
}

// --- Application-results envelope --------------------------------------------

/** Application-level result envelope. */
export interface ContentApplicationResults {
  status?: ContentStatus;
  success?: readonly ContentApplicationResultEntry[];
  errors?: readonly ContentApplicationResultEntry[];
  warnings?: readonly ContentApplicationResultEntry[];
}

/** Single result entry. */
export interface ContentApplicationResultEntry {
  type?: string;
  timeStamp?: string;
  systemSpecificResults?: readonly ContentSystemSpecificResult[];
}

/** Per-record system-specific diagnostic result. */
export interface ContentSystemSpecificResult {
  timeStamp?: string;
  reference?: string;
  hostCommand?: ContentHostCommand;
  messages?: readonly ContentApplicationMessage[];
}

/** Host command attached to a diagnostic. */
export interface ContentHostCommand {
  lniata?: string;
}

/** Application-level code/message pair. */
export interface ContentApplicationMessage {
  code?: string;
  value?: string;
}
