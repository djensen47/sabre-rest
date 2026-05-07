/**
 * Public input/output types for the Hotel Search v2 service.
 *
 * Hand-written intentionally — not derived from `src/generated/`. The
 * generated types are kept internal so consumer-facing types stay stable
 * across spec changes and use idiomatic TypeScript naming.
 *
 * Hotel Search v2 performs property discovery: given a geographic anchor
 * (lat/lon, reference point, or address) and a radius, it returns matching
 * hotel properties and their metadata. Availability and rates are not part
 * of this API — a downstream hotel-availability / hotel-price API is
 * responsible for those, and this library does not currently wrap one.
 *
 * This is the first hotel-domain service in the library, so none of the
 * types here are shared with other services.
 */

/**
 * Input to {@link HotelSearchV2Service.search}.
 *
 * A search requires exactly one geographic anchor (`geoSearch.geoRef`)
 * plus a radius. Everything else narrows or sorts the result set.
 */
export interface SearchHotelsInput {
  /** Geographic search anchor. Required. */
  geoSearch: GeoSearch;

  /**
   * Maximum number of properties returned. Sabre supports 1-300; omitting
   * it lets Sabre pick the default page size.
   */
  maxResults?: number;

  /**
   * Primary sort key. Sabre defaults to `TotalRate` when omitted; we
   * deliberately don't send the documented default so the wire body
   * reflects exactly what the consumer asked for.
   */
  sortBy?: HotelSortBy;

  /**
   * Sort direction. Sabre picks a direction-per-field default when
   * omitted (`TotalRate`/`DistanceFrom` → `ASC`, `SabreRating` → `DESC`).
   */
  sortOrder?: HotelSortOrder;

  /**
   * When `true`, tier labels are returned on preferenced properties. The
   * OAS declares `default: true`, but the public type leaves it optional —
   * omitting it lets Sabre apply its own default and keeps the wire body
   * minimal.
   */
  tierLabels?: boolean;

  /**
   * Point-of-sale override. When present, shopping happens in the given
   * authorized branch PCC while the underlying session stays on the
   * home branch. Omit for the session's default PCC.
   */
  pos?: HotelPointOfSale;

  /** Optional content filters. Omit for an unfiltered search. */
  hotelPref?: HotelPreferences;

  /** Optional image-retrieval preferences. */
  imageRef?: HotelImagePreferences;
}

/** Primary sort key for the Hotel Search response. */
export type HotelSortBy = 'TotalRate' | 'DistanceFrom' | 'SabreRating';

/** Sort direction. */
export type HotelSortOrder = 'ASC' | 'DESC';

/** Geographic search wrapper. */
export interface GeoSearch {
  /** Geographic anchor — exactly one of three variants. */
  geoRef: GeoRef;

  /**
   * Post-filter attributes applied to the hotel list, such as
   * `LOCALAREA=KRAKOW AREA`. Only applied for polygon searches
   * (`kind: 'refPoint'` with `refPointType: '37'`).
   */
  attributes?: readonly GeoAttribute[];
}

/**
 * Geographic anchor for the search. Exactly one variant per request:
 * `geoCode` for a raw latitude/longitude, `refPoint` for a named reference
 * (airport, landmark, polygon), or `addressRef` for an address match.
 *
 * See `docs/guides/hotel-search-anchors.md` for how to pick an anchor
 * type, the full OTA `refPointType` table, and CERT-specific caveats.
 */
export type GeoRef = GeoCodeRef | ReferencePointRef | AddressRef;

/** Common fields for every `GeoRef` variant. */
export interface GeoRefCommon {
  /**
   * Search radius from the anchor. Scaled by {@link GeoRefCommon.uom};
   * e.g., 25 MI or 40 KM.
   */
  radius: number;

  /** Unit of measure for {@link GeoRefCommon.radius}. */
  uom: HotelDistanceUnit;
}

/** `MI` for miles, `KM` for kilometers. */
export type HotelDistanceUnit = 'MI' | 'KM';

/** Search by latitude / longitude. */
export interface GeoCodeRef extends GeoRefCommon {
  kind: 'geoCode';
  /** Latitude in decimal degrees, [-90, 90]. */
  latitude: number;
  /** Longitude in decimal degrees, [-180, 180]. */
  longitude: number;
}

/**
 * Search by named reference point: an airport, landmark, polygon, etc.
 * The `refPointType` is an OTA code (e.g., `6` = airport code, `37` =
 * polygon).
 */
export interface ReferencePointRef extends GeoRefCommon {
  kind: 'refPoint';
  /**
   * OTA reference-point type. Valid values: `5` (city), `6` (airport),
   * `7` (rail station), `11` (landmark), `16` (metro station),
   * `18` (neighborhood), `37` (polygon). See
   * `docs/guides/hotel-search-anchors.md` for the full table with
   * `value` / `valueContext` examples.
   */
  refPointType: '5' | '6' | '7' | '11' | '16' | '18' | '37';
  /** The reference value (e.g., `DFW` for an airport code). */
  value: string;
  /** How to interpret {@link ReferencePointRef.value}: `NAME` or `CODE`. */
  valueContext: 'NAME' | 'CODE';
  /** Optional state/province disambiguator. */
  stateProv?: string;
  /** Optional country disambiguator. */
  countryCode?: string;
}

/**
 * Search by address. `countryCode` is the only required field; other
 * components narrow the match.
 */
export interface AddressRef extends GeoRefCommon {
  kind: 'addressRef';
  /** ISO country code. */
  countryCode: string;
  street?: string;
  city?: string;
  county?: string;
  postalCode?: string;
  stateProv?: string;
}

/** Post-filter attribute for a polygon search. */
export interface GeoAttribute {
  /** Filter name. Currently only `LOCALAREA` is documented. */
  name: string;
  /** Filter value, e.g., `KRAKOW AREA` when `name` is `LOCALAREA`. */
  value: string;
}

/** Point-of-sale override for branch shopping. */
export interface HotelPointOfSale {
  /** Four-character PCC of the authorized branch. */
  pseudoCityCode: string;
}

/** Content filters applied to the search. */
export interface HotelPreferences {
  /** Partial name match; minimum 3 characters. */
  hotelName?: string;
  /** Brand codes; properties must belong to at least one. */
  brandCodes?: readonly string[];
  /** Chain codes; properties must belong to at least one. */
  chainCodes?: readonly string[];
  /** Amenity-code filter. */
  amenityCodes?: HotelCodeFilter;
  /** Security-feature-code filter. */
  securityFeatureCodes?: HotelCodeFilter;
  /** Property-type-code filter. */
  propertyTypeCodes?: HotelCodeFilter;
  /** Property-quality-code filter. */
  propertyQualityCodes?: HotelCodeFilter;
  /** Sabre-rating range filter. */
  sabreRating?: HotelSabreRatingFilter;
}

/**
 * A code-list filter. When `inclusive` is `true`, the property must have
 * *all* of the listed codes; when `false`, at least one is enough. Omit
 * `inclusive` to let Sabre apply its documented default of `false`.
 */
export interface HotelCodeFilter {
  /** OTA-coded values (numbers) to filter on. */
  codes: readonly number[];
  /** Whether matches must include every listed code. */
  inclusive?: boolean;
}

/**
 * Sabre-rating range. Strings per the OAS pattern (e.g., `"1.5"`, `"5"`,
 * `"4.0"`). Either bound may be omitted.
 */
export interface HotelSabreRatingFilter {
  /** Minimum rating (inclusive). */
  min?: string;
  /** Maximum rating (inclusive). */
  max?: string;
}

/** Image-retrieval preferences applied to the response. */
export interface HotelImagePreferences {
  /** Image size category. */
  type?: 'ORIGINAL' | 'THUMBNAIL' | 'SMALL' | 'MEDIUM' | 'LARGE';
  /** OTA image category code (PCI). */
  categoryCode?: number;
  /** Two-letter ISO 639-1 language code for image descriptions. */
  languageCode?: string;
}

/**
 * Output of {@link HotelSearchV2Service.search}.
 *
 * Contains the matched hotels (in Sabre's response order) plus the
 * diagnostic envelope Sabre returned. Every record Sabre returned is
 * preserved; undercooked records are not filtered out. The search-anchor
 * coordinates are echoed back only when the request used a `GeoRef`.
 */
export interface SearchHotelsOutput {
  /**
   * Total matches for the search, which can exceed the number of records
   * returned when `maxResults` caps the page size.
   */
  maxSearchResults?: number;
  /** Echoed anchor latitude; populated only for `GeoRef` requests. */
  searchLatitude?: number;
  /** Echoed anchor longitude; populated only for `GeoRef` requests. */
  searchLongitude?: number;
  /** Matching hotels, in Sabre's response order. */
  hotels: readonly Hotel[];
  /**
   * Sabre's application-level result envelope. Present whenever Sabre
   * returns diagnostics (success-with-warnings, partial results, etc.).
   */
  applicationResults?: HotelApplicationResults;
}

/**
 * A single hotel record.
 *
 * Combines Sabre's `HotelInfo` (identity, classification, distance) and
 * `HotelImageInfo` (media) into one idiomatic shape. Only `code` and
 * `codeContext` are required — everything else mirrors the OAS optionality
 * and may be absent on any given record.
 */
export interface Hotel {
  /**
   * Global property ID, regardless of the code the request supplied.
   * If a Sabre property ID was requested, it's echoed on
   * {@link Hotel.sabreCode}.
   */
  code: string;
  /** Identifies the codespace for {@link Hotel.code}: `SABRE` or `GLOBAL`. */
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
  /** Distance from the search anchor. */
  distance?: number;
  /** Compass direction from the search anchor (e.g., `S`, `NE`). */
  direction?: string;
  /** Unit of measure for {@link Hotel.distance}. */
  distanceUnit?: HotelDistanceUnit;
  /** URL to the property's logo image. */
  logo?: string;
  /** Sabre property rating (e.g., `"3.5"`). */
  sabreRating?: string;
  /** Display position for preferenced properties. */
  ordinal?: number;
  /** Tier labels assigned by agency / supplier preferencing programs. */
  tierLabels?: readonly HotelTierLabel[];
  /** Location details (address, coordinates, neighborhoods). */
  location?: HotelLocation;
  /** Amenities the property offers. */
  amenities?: readonly HotelAmenity[];
  /** Security features. */
  securityFeatures?: readonly HotelSecurityFeature[];
  /** Property class types (OTA `PCT`). */
  propertyTypes?: readonly HotelPropertyType[];
  /** Property quality codes (OTA `LOS`). */
  propertyQualities?: readonly HotelPropertyQuality[];
  /** Property images. */
  images?: readonly HotelImage[];
}

/** A tier label entry. */
export interface HotelTierLabel {
  /** Label type (e.g., `Agency`). */
  type?: string;
  /** Label value (e.g., `Platinum`). */
  value?: string;
  /** Preferencing program ID. */
  programId?: string;
}

/** Location information for a hotel. */
export interface HotelLocation {
  /** Latitude, as a string per the OAS. */
  latitude?: string;
  /** Longitude, as a string per the OAS. */
  longitude?: string;
  /** Postal address. */
  address?: HotelAddress;
  /** Neighborhood / polygon memberships. */
  neighborhoods?: readonly HotelNeighborhood[];
  /** Contact details. */
  contact?: HotelContact;
}

/** Postal address. */
export interface HotelAddress {
  addressLine1?: string;
  addressLine2?: string;
  addressLine3?: string;
  /** City code (3-letter IATA) and name. */
  city?: HotelCityName;
  /** State / province code and name. */
  stateProv?: HotelStateProv;
  postalCode?: string;
  /** Country code and name. */
  country?: HotelCountryName;
}

/** City name + code pair. */
export interface HotelCityName {
  /** 3-letter city code. */
  code?: string;
  /** Display city name. */
  name?: string;
}

/** State/province name + code pair. */
export interface HotelStateProv {
  /** State/province code. */
  code?: string;
  /** Display state/province name. */
  name?: string;
}

/** Country name + code pair. */
export interface HotelCountryName {
  /** Country code. */
  code?: string;
  /** Display country name. */
  name?: string;
}

/** Neighborhood / polygon membership. */
export interface HotelNeighborhood {
  /** Polygon ID. */
  id?: string;
  /** Polygon name. */
  name?: string;
}

/** Contact details. */
export interface HotelContact {
  phone?: string;
  fax?: string;
}

/** Amenity entry. */
export interface HotelAmenity {
  /** OTA amenity code (HAC). */
  code?: number;
  /** OTA description. */
  description?: string;
  /** Whether the amenity is complimentary. */
  complimentary?: boolean;
  /** Additional free-text value. */
  value?: string;
}

/** Security feature entry. */
export interface HotelSecurityFeature {
  /** OTA security-feature code (SEC). */
  code?: number;
  /** OTA description. */
  description?: string;
  /** Additional free-text value. */
  value?: string;
}

/** Property type entry (OTA `PCT`). */
export interface HotelPropertyType {
  code?: number;
  description?: string;
}

/** Property quality entry (OTA `LOS`). */
export interface HotelPropertyQuality {
  code?: number;
  description?: string;
}

/** A hotel image with its metadata. */
export interface HotelImage {
  /** Unique media ID. */
  id?: string;
  /** Priority; lower numbers come first. */
  ordinal?: number;
  /** Last modification date in `YYYY-MM-DD`. */
  lastModifiedDate?: string;
  /** Image file format. */
  format?: 'BMP' | 'GIF' | 'ICO' | 'JPG' | 'PNG' | 'TIFF' | 'WEBP';
  /** Image file details. */
  image?: HotelImageFile;
  /** Category the image belongs to. */
  category?: HotelImageCategory;
  /** Additional info (captions, etc.). */
  additionalInfo?: readonly HotelImageAdditionalInfo[];
}

/** The actual image URL and dimensions. */
export interface HotelImageFile {
  /** Image URL. */
  url?: string;
  /** Pixel height. */
  height?: number;
  /** Pixel width. */
  width?: number;
  /** Size/flavor identifier. */
  type?: 'ORIGINAL' | 'MEDIUM' | 'LARGE' | 'THUMBNAIL' | 'SMALL';
}

/** Image category (OTA `PCI`). */
export interface HotelImageCategory {
  /** OTA PCI code. */
  code?: number;
  /** Descriptions by language. */
  descriptions?: readonly HotelLocalizedText[];
}

/** Additional info entry attached to an image (e.g., caption). */
export interface HotelImageAdditionalInfo {
  /** Info type, e.g., `CAPTION`. */
  type: string;
  /** Localized text descriptions. */
  descriptions?: readonly HotelLocalizedText[];
}

/** A text value with an ISO 639-1 language code. */
export interface HotelLocalizedText {
  /** ISO 639-1 two-letter language code. */
  language?: string;
  /** Text value. */
  value?: string;
}

/** Application-level result envelope. */
export interface HotelApplicationResults {
  /** Top-level status: `Complete`, `Incomplete`, `NotProcessed`, `Unknown`. */
  status?: 'Complete' | 'Incomplete' | 'NotProcessed' | 'Unknown';
  /** Success diagnostics. */
  success?: readonly HotelApplicationResultEntry[];
  /** Error diagnostics. */
  errors?: readonly HotelApplicationResultEntry[];
  /** Warning diagnostics. */
  warnings?: readonly HotelApplicationResultEntry[];
}

/** A single application-result entry. */
export interface HotelApplicationResultEntry {
  /** Source of the event (e.g., `Transport`). */
  type?: string;
  /** Event timestamp. */
  timeStamp?: string;
  /** Per-record system-specific diagnostic results. */
  systemSpecificResults?: readonly HotelSystemSpecificResult[];
}

/** Per-record system-specific diagnostic result. */
export interface HotelSystemSpecificResult {
  /** Timestamp. */
  timeStamp?: string;
  /** Field reference, when the diagnostic is field-specific. */
  reference?: string;
  /** Host command details. */
  hostCommand?: HotelHostCommand;
  /** List of application-specific code/message pairs. */
  messages?: readonly HotelApplicationMessage[];
}

/** Host command attached to a diagnostic result. */
export interface HotelHostCommand {
  /** LNIATA address. */
  lniata?: string;
}

/** Application-level code/message pair. */
export interface HotelApplicationMessage {
  /** Numeric error/warning code. */
  code?: string;
  /** Human-readable message. */
  value?: string;
}
