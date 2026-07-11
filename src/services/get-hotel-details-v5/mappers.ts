import { SabreParseError } from '../../errors/sabre-parse-error.js';
import type { components } from '../../generated/get-hotel-details.js';
import { ensureTrailingSlash } from '../../http/ensure-trailing-slash.js';
import type { SabreRequest, SabreResponse } from '../../http/types.js';
import type {
  DetailsAdditionalDetail,
  DetailsAddress,
  DetailsAlternateHotel,
  DetailsAmountPercent,
  DetailsApplicationMessage,
  DetailsApplicationResultEntry,
  DetailsApplicationResults,
  DetailsBedType,
  DetailsCancelPenalty,
  DetailsCity,
  DetailsCommission,
  DetailsContact,
  DetailsContentRef,
  DetailsCountry,
  DetailsDeadline,
  DetailsDepositPolicy,
  DetailsDescription,
  DetailsDescriptionType,
  DetailsDescriptiveInfo,
  DetailsFee,
  DetailsFeeGroup,
  DetailsFees,
  DetailsGuarantee,
  DetailsGuaranteeAccepted,
  DetailsHotel,
  DetailsHotelAmenity,
  DetailsHotelInfo,
  DetailsImageItem,
  DetailsImageVariant,
  DetailsLocationInfo,
  DetailsMealsIncluded,
  DetailsMediaCategory,
  DetailsMediaInfo,
  DetailsMediaItem,
  DetailsNeighborhood,
  DetailsOccupancy,
  DetailsPanoramicVariant,
  DetailsPaymentCard,
  DetailsPolicyText,
  DetailsPropertyInfo,
  DetailsPropertyQuality,
  DetailsPropertyType,
  DetailsRate,
  DetailsRateCriteria,
  DetailsRateEntries,
  DetailsRateEntry,
  DetailsRateFilter,
  DetailsRatePlan,
  DetailsRatePlanCandidates,
  DetailsRatePlanInclusion,
  DetailsRequestedRoom,
  DetailsRoomAmenity,
  DetailsRoomDescription,
  DetailsRoomDetail,
  DetailsRoomExtra,
  DetailsRoomRateInfo,
  DetailsRoomSet,
  DetailsRoomSetAttribute,
  DetailsSearchByHotelRef,
  DetailsSearchByRateKey,
  DetailsSecurityFeature,
  DetailsStateProv,
  DetailsSustainability,
  DetailsSystemSpecificResult,
  DetailsTax,
  DetailsTaxGroup,
  DetailsTaxes,
  DetailsTranslated,
  DetailsUnavailSource,
  DetailsVideoVariant,
  GetHotelDetailsInput,
  GetHotelDetailsOutput,
} from './types.js';

const PATH = 'v5/get/hoteldetails';

/**
 * Hardcoded schema version sent on every request at
 * `GetHotelDetailsRQ.version`. The OAS does not declare `version` as a
 * request property, but Sabre's v5 canonical sample for the sibling
 * `get-hotel-rate-info` API pins the equivalent field to the minor-version
 * string (see `docs/specifications/get-hotel-rate-info/sample-request.json`
 * and `src/services/get-hotel-rate-info-v5/mappers.ts`). Following that
 * precedent, Get Hotel Details ships `"5.1.0"` to match its own
 * `info.version: v5.1`. Same category as
 * `bargain-finder-max-v5`'s `Version: '5'` — a runtime-required protocol
 * constant the spec leaves undocumented.
 */
const SCHEMA_VERSION = '5.1.0';

/**
 * Builds the outgoing {@link SabreRequest} for the `getHotelDetails`
 * operation.
 *
 * Sabre's spec documents `default:` values on a handful of request fields
 * (PrepaidQualifier, RefundableOnly, ConvertedRateInfoOnly, ExactMatchOnly,
 * SortBy, etc.). Following the precedent set by the other hotel services,
 * this mapper does **not** auto-send those defaults on the consumer's
 * behalf. Sabre applies them server-side when fields are omitted, so the
 * wire body reflects exactly what the consumer asked for.
 *
 * Exception: `GetHotelDetailsRQ.version` is hardcoded to
 * {@link SCHEMA_VERSION} because it is a protocol-level constant (not user
 * data) that Sabre's runtime requires despite the spec not marking it
 * required. See {@link SCHEMA_VERSION}.
 */
export function toGetDetailsRequest(baseUrl: string, input: GetHotelDetailsInput): SabreRequest {
  const url = new URL(PATH, ensureTrailingSlash(baseUrl));

  const searchCriteria: Record<string, unknown> =
    input.kind === 'hotel-ref' ? buildSearchByHotelRef(input) : buildSearchByRateKey(input);

  const rq: Record<string, unknown> = {
    version: SCHEMA_VERSION,
    SearchCriteria: searchCriteria,
  };
  if (input.pointOfSale !== undefined) {
    rq.POS = { Source: { PseudoCityCode: input.pointOfSale.pseudoCityCode } };
  }
  if (input.corporateNumber !== undefined) rq.CorporateNumber = input.corporateNumber;

  return {
    method: 'POST',
    url: url.toString(),
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ GetHotelDetailsRQ: rq }),
  };
}

function buildSearchByHotelRef(input: DetailsSearchByHotelRef): Record<string, unknown> {
  const ref: Record<string, unknown> = { HotelCode: input.hotelRef.code };
  if (input.hotelRef.codeContext !== undefined) ref.CodeContext = input.hotelRef.codeContext;

  const out: Record<string, unknown> = {
    HotelRefs: { HotelRef: ref },
    RateInfoRef: buildRateInfoRef(input.rateCriteria),
  };
  if (input.contentRef !== undefined) {
    const hcr = buildHotelContentRef(input.contentRef);
    if (Object.keys(hcr).length > 0) out.HotelContentRef = hcr;
  }
  if (input.shopKey !== undefined) out.ShopKey = input.shopKey;
  return out;
}

function buildSearchByRateKey(input: DetailsSearchByRateKey): Record<string, unknown> {
  const ref: Record<string, unknown> = { RateKey: input.rateKey };
  if (input.prepaidQualifier !== undefined) ref.PrepaidQualifier = input.prepaidQualifier;
  if (input.refundableOnly !== undefined) ref.RefundableOnly = input.refundableOnly;
  if (input.convertedRateInfoOnly !== undefined) {
    ref.ConvertedRateInfoOnly = input.convertedRateInfoOnly;
  }
  if (input.exactMatchOnly !== undefined) ref.ExactMatchOnly = input.exactMatchOnly;
  if (input.travellerCountry !== undefined) ref.TravellerCountry = input.travellerCountry;
  if (input.shopKey !== undefined) ref.ShopKey = input.shopKey;
  if (input.rateRange !== undefined) {
    const rr: Record<string, unknown> = {};
    if (input.rateRange.min !== undefined) rr.Min = input.rateRange.min;
    if (input.rateRange.max !== undefined) rr.Max = input.rateRange.max;
    if (Object.keys(rr).length > 0) ref.RateRange = rr;
  }
  if (input.roomSetTypes !== undefined && input.roomSetTypes.length > 0) {
    ref.RoomSetTypes = { RoomSet: input.roomSetTypes.map((t) => ({ Type: t })) };
  }
  if (input.rateFilters !== undefined && input.rateFilters.length > 0) {
    ref.RateFilter = input.rateFilters.map(buildRateFilter);
  }
  if (input.rateSource !== undefined && input.rateSource.length > 0) {
    ref.RateSource = input.rateSource.join(',');
  }
  if (input.sortOrder !== undefined) ref.SortOrder = input.sortOrder;
  if (input.sortBy !== undefined) ref.SortBy = input.sortBy;

  const out: Record<string, unknown> = { RateKeyRef: ref };
  if (input.contentRef !== undefined) {
    const hcr = buildHotelContentRef(input.contentRef);
    if (Object.keys(hcr).length > 0) out.HotelContentRef = hcr;
  }
  if (input.shopKey !== undefined) out.ShopKey = input.shopKey;
  return out;
}

function buildRateInfoRef(c: DetailsRateCriteria): Record<string, unknown> {
  const out: Record<string, unknown> = {
    StayDateTimeRange: {
      StartDate: c.stayDateTimeRange.startDate,
      EndDate: c.stayDateTimeRange.endDate,
    },
    Rooms: { Room: c.rooms.map(buildRequestedRoom) },
  };
  if (c.currencyCode !== undefined) out.CurrencyCode = c.currencyCode;
  if (c.prepaidQualifier !== undefined) out.PrepaidQualifier = c.prepaidQualifier;
  if (c.refundableOnly !== undefined) out.RefundableOnly = c.refundableOnly;
  if (c.convertedRateInfoOnly !== undefined) out.ConvertedRateInfoOnly = c.convertedRateInfoOnly;
  if (c.travellerCountry !== undefined) out.TravellerCountry = c.travellerCountry;
  if (c.rateRange !== undefined) {
    const rr: Record<string, unknown> = {};
    if (c.rateRange.min !== undefined) rr.Min = c.rateRange.min;
    if (c.rateRange.max !== undefined) rr.Max = c.rateRange.max;
    if (Object.keys(rr).length > 0) out.RateRange = rr;
  }
  if (c.rateFilters !== undefined && c.rateFilters.length > 0) {
    out.RateFilters = { RateFilter: c.rateFilters.map(buildRateFilter) };
  }
  if (c.ratePlanCandidates !== undefined) {
    out.RatePlanCandidates = buildRatePlanCandidates(c.ratePlanCandidates);
  }
  if (c.loyaltyIds !== undefined && c.loyaltyIds.length > 0) {
    out.LoyaltyIds = { LoyaltyId: [...c.loyaltyIds] };
  }
  if (c.frequentFlyerNumber !== undefined) out.FrequentFlyerNumber = c.frequentFlyerNumber;
  if (c.corpDiscount !== undefined) out.CorpDiscount = c.corpDiscount;
  if (c.rateSource !== undefined && c.rateSource.length > 0) {
    out.RateSource = c.rateSource.join(',');
  }
  if (c.sortOrder !== undefined) out.SortOrder = c.sortOrder;
  if (c.sortBy !== undefined) out.SortBy = c.sortBy;
  return out;
}

function buildRequestedRoom(room: DetailsRequestedRoom): Record<string, unknown> {
  const out: Record<string, unknown> = { Index: room.index, Adults: room.adults };
  if (room.children !== undefined) out.Children = room.children;
  if (room.childAges !== undefined && room.childAges.length > 0) {
    out.ChildAges = room.childAges.join(',');
  }
  return out;
}

function buildRateFilter(f: DetailsRateFilter): Record<string, unknown> {
  return { Type: f.type, Value: f.value, Action: f.action };
}

function buildRatePlanCandidates(c: DetailsRatePlanCandidates): Record<string, unknown> {
  const out: Record<string, unknown> = {
    RatePlanCandidate: c.candidates.map((cand) => {
      const entry: Record<string, unknown> = {};
      if (cand.ratePlanType !== undefined) entry.RatePlanType = cand.ratePlanType;
      if (cand.ratePlanCode !== undefined) entry.RatePlanCode = cand.ratePlanCode;
      return entry;
    }),
  };
  if (c.exactMatchOnly !== undefined) out.ExactMatchOnly = c.exactMatchOnly;
  return out;
}

function buildHotelContentRef(c: DetailsContentRef): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (c.descriptiveInfo !== undefined) {
    const di: Record<string, unknown> = {};
    if (c.descriptiveInfo.propertyInfo !== undefined)
      di.PropertyInfo = c.descriptiveInfo.propertyInfo;
    if (c.descriptiveInfo.locationInfo !== undefined)
      di.LocationInfo = c.descriptiveInfo.locationInfo;
    if (c.descriptiveInfo.amenities !== undefined) di.Amenities = c.descriptiveInfo.amenities;
    if (c.descriptiveInfo.securityFeatures !== undefined) {
      di.SecurityFeatures = c.descriptiveInfo.securityFeatures;
    }
    if (c.descriptiveInfo.sustainability !== undefined) {
      di.Sustainability = c.descriptiveInfo.sustainability;
    }
    if (c.descriptiveInfo.descriptions !== undefined && c.descriptiveInfo.descriptions.length > 0) {
      di.Descriptions = {
        Description: c.descriptiveInfo.descriptions.map((type) => ({ Type: type })),
      };
    }
    if (Object.keys(di).length > 0) out.DescriptiveInfoRef = di;
  }
  if (c.media !== undefined) {
    const m: Record<string, unknown> = {};
    if (c.media.maxItems !== undefined) m.MaxItems = c.media.maxItems;

    // `Images` / `PanoramicMedias` / `Videos` nest UNDER `MediaTypes` — the
    // media bucket is implied by which of these is populated, so there is no
    // separate `MediaType` selector. This mirrors the sibling
    // get-hotel-content-v4 `buildMediaRef`, which Sabre accepts.
    const mediaTypes: Record<string, unknown> = {};
    if (c.media.images !== undefined && c.media.images.length > 0) {
      mediaTypes.Images = { Image: c.media.images.map((t) => ({ Type: t })) };
    }
    if (c.media.panoramicMedias !== undefined && c.media.panoramicMedias.length > 0) {
      mediaTypes.PanoramicMedias = {
        PanoramicMedia: c.media.panoramicMedias.map((t) => ({ Type: t })),
      };
    }
    if (c.media.videos !== undefined && c.media.videos.length > 0) {
      mediaTypes.Videos = { Video: c.media.videos.map((t) => ({ Type: t })) };
    }
    if (Object.keys(mediaTypes).length > 0) m.MediaTypes = mediaTypes;

    if (c.media.categories !== undefined && c.media.categories.length > 0) {
      m.Categories = { Category: c.media.categories.map((code) => ({ Code: code })) };
    }
    if (c.media.languages !== undefined && c.media.languages.length > 0) {
      m.Languages = {
        Language: c.media.languages.map((code) => ({ Code: code })),
      };
    }
    if (Object.keys(m).length > 0) out.MediaRef = m;
  }
  return out;
}

// -----------------------------------------------------------------------------
// Response mappers
// -----------------------------------------------------------------------------

/**
 * Parses the `getHotelDetails` response into the public output shape.
 *
 * Every rate entry, room, rate plan, descriptive block, media item, and
 * diagnostic Sabre returned is preserved. The nested `HotelRateInfo` field
 * is a `oneOf` of `ResponseWithRooms` and `ResponseWithRoomSets`; the
 * public {@link DetailsHotel} exposes both sets of optional fields so the
 * mapper can populate whichever branch Sabre sent without discriminating.
 * Throws {@link SabreParseError} only when the body fundamentally is not a
 * Sabre response.
 */
export function fromGetDetailsResponse(res: SabreResponse): GetHotelDetailsOutput {
  let parsed: components['schemas']['GetHotelDetailsResponse'];
  try {
    parsed = JSON.parse(res.body) as components['schemas']['GetHotelDetailsResponse'];
  } catch (err) {
    throw new SabreParseError('Failed to parse Get Hotel Details response as JSON', res.body, {
      cause: err,
    });
  }

  if (parsed === null || typeof parsed !== 'object') {
    throw new SabreParseError('Get Hotel Details response was not a JSON object', parsed);
  }

  const rs = parsed.GetHotelDetailsRS;
  if (rs === undefined || rs === null || typeof rs !== 'object') {
    throw new SabreParseError('Get Hotel Details response was missing `GetHotelDetailsRS`', parsed);
  }

  const out: GetHotelDetailsOutput = {};

  if (rs.ApplicationResults !== undefined) {
    const ar = mapApplicationResults(rs.ApplicationResults);
    if (ar !== undefined) {
      out.applicationResults = ar;
      if (ar.status !== undefined) out.status = ar.status;
    }
  }

  if (rs.HotelDetailsInfo !== undefined) {
    const hotel = mapHotelDetailsInfo(rs.HotelDetailsInfo);
    if (hotel !== undefined) out.hotel = hotel;
  }

  if (rs.TranslatedDetailsInfo !== undefined) {
    const tr = mapTranslatedDetailsInfo(rs.TranslatedDetailsInfo);
    if (tr !== undefined) out.translated = tr;
  }

  return out;
}

function mapHotelDetailsInfo(
  info: components['schemas']['HotelDetailsInfo'],
): DetailsHotel | undefined {
  if (info.HotelInfo === undefined) return undefined;

  const hotel: DetailsHotel = { info: mapHotelInfo(info.HotelInfo) };

  if (info.AlternateHotelInfos?.AlternateHotelInfo !== undefined) {
    hotel.alternateHotels = info.AlternateHotelInfos.AlternateHotelInfo.map(mapAlternateHotel);
  }
  if (info.HotelDescriptiveInfo !== undefined) {
    const di = mapDescriptiveInfo(info.HotelDescriptiveInfo);
    if (di !== undefined) hotel.descriptiveInfo = di;
  }
  if (info.HotelRateInfo !== undefined) {
    applyHotelRateInfo(hotel, info.HotelRateInfo);
  }
  if (info.HotelMediaInfo !== undefined) {
    const media = mapMediaInfo(info.HotelMediaInfo);
    if (media !== undefined) hotel.mediaInfo = media;
  }

  return hotel;
}

function mapTranslatedDetailsInfo(
  tr: components['schemas']['TranslatedDetailsInfo'],
): DetailsTranslated | undefined {
  const out: DetailsTranslated = {};
  if (tr.LanguageCode !== undefined) out.languageCode = tr.LanguageCode;
  if (tr.HotelInfo !== undefined) out.info = mapHotelInfo(tr.HotelInfo);
  if (tr.HotelDescriptiveInfo !== undefined) {
    const di = mapDescriptiveInfo(tr.HotelDescriptiveInfo);
    if (di !== undefined) out.descriptiveInfo = di;
  }
  if (tr.HotelMediaInfo !== undefined) {
    const media = mapMediaInfo(tr.HotelMediaInfo);
    if (media !== undefined) out.mediaInfo = media;
  }
  if (tr.AlternateHotelInfos?.AlternateHotelInfo !== undefined) {
    out.alternateHotels = tr.AlternateHotelInfos.AlternateHotelInfo.map(mapAlternateHotel);
  }
  if (tr.HotelRateInfo !== undefined) out.rateInfo = tr.HotelRateInfo;
  return Object.keys(out).length > 0 ? out : undefined;
}

function mapHotelInfo(info: components['schemas']['HotelInfo']): DetailsHotelInfo {
  const out: DetailsHotelInfo = {
    code: info.HotelCode,
    codeContext: info.CodeContext,
  };
  if (info.SabreHotelCode !== undefined) out.sabreCode = info.SabreHotelCode;
  if (info.HotelName !== undefined) out.hotelName = info.HotelName;
  if (info.ChainCode !== undefined) out.chainCode = info.ChainCode;
  if (info.ChainName !== undefined) out.chainName = info.ChainName;
  if (info.BrandCode !== undefined) out.brandCode = info.BrandCode;
  if (info.BrandName !== undefined) out.brandName = info.BrandName;
  if (info.Status !== undefined) out.status = info.Status;
  if (info.SabreRating !== undefined) out.sabreRating = info.SabreRating;
  if (info.Logo !== undefined) out.logo = info.Logo;
  return out;
}

type GeneratedAlternateHotelInfoType = NonNullable<
  components['schemas']['AlternateHotelInfos']['AlternateHotelInfo']
>[number];

function mapAlternateHotel(a: GeneratedAlternateHotelInfoType): DetailsAlternateHotel {
  const out: DetailsAlternateHotel = {};
  if (a.HotelInfo !== undefined) {
    const info = a.HotelInfo;
    const mapped: NonNullable<DetailsAlternateHotel['info']> = {};
    if (info.HotelCode !== undefined) mapped.code = info.HotelCode;
    if (info.CodeContext !== undefined) mapped.codeContext = info.CodeContext;
    if (info.SabreHotelCode !== undefined) mapped.sabreCode = info.SabreHotelCode;
    if (info.ChainCode !== undefined) mapped.chainCode = info.ChainCode;
    if (Object.keys(mapped).length > 0) out.info = mapped;
  }
  if (a.HotelImageInfo?.ImageItem !== undefined) {
    const image = mapImageItem(a.HotelImageInfo.ImageItem);
    if (image !== undefined) out.image = image;
  }
  if (a.HotelRateInfo !== undefined) out.rateInfo = a.HotelRateInfo;
  return out;
}

function mapImageItem(item: components['schemas']['ImageItemType']): DetailsImageItem | undefined {
  // `ImageItemType.Image` references the request-side `Image` schema —
  // which, in Sabre's spec, only carries a `Type` enum (size variant), no
  // URL / height / width. The image-size variants are just labels without
  // actual image URLs, so `images` is intentionally left unpopulated here;
  // anything richer would require a different endpoint (e.g., Get Hotel
  // Media / Get Hotel Image).
  const out: DetailsImageItem = {};
  if (item.Id !== undefined) out.id = item.Id;
  if (item.Format !== undefined) out.format = item.Format;
  if (item.LastModifiedDate !== undefined) out.lastModifiedDate = item.LastModifiedDate;
  if (item.Category !== undefined) {
    out.categoryCodes = item.Category.map((c) => c.Code);
  }
  if (item.Ordinal !== undefined) out.ordinal = item.Ordinal;
  return Object.keys(out).length > 0 ? out : undefined;
}

function applyHotelRateInfo(
  hotel: DetailsHotel,
  hri: components['schemas']['HotelRateInfoType'],
): void {
  // `HotelRateInfoType` is the already-flattened schema Sabre uses for
  // `HotelDetailsInfo.HotelRateInfo` — Rooms / RateInfos / RateUnavailability
  // / RoomSets are all optional here, so no union discrimination is needed.
  if (hri.RateInfos !== undefined) {
    const rateInfos = mapRateInfos(hri.RateInfos);
    if (rateInfos !== undefined) hotel.rateInfos = rateInfos;
  }
  if (hri.RateUnavailability?.RateSource !== undefined) {
    hotel.rateUnavailability = hri.RateUnavailability.RateSource.map(mapUnavailSource);
  }
  if (hri.Rooms?.Room !== undefined) {
    hotel.rooms = hri.Rooms.Room.map(mapRoomDetail);
  }
  if (hri.RoomSets?.RoomSet !== undefined) {
    hotel.roomSets = hri.RoomSets.RoomSet.map(mapRoomSet);
  }
}

function mapRateInfos(
  ri: NonNullable<components['schemas']['RateInfos']>,
): DetailsRateEntries | undefined {
  const out: DetailsRateEntries = {};
  if (ri.ShopKey !== undefined) out.shopKey = ri.ShopKey;
  if (ri.RateInfo !== undefined) out.rateInfo = ri.RateInfo.map(mapRateEntry);
  if (ri.ConvertedRateInfo !== undefined) {
    out.convertedRateInfo = ri.ConvertedRateInfo.map(mapRateEntry);
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

type GeneratedRateEntry = NonNullable<components['schemas']['RateInfos']['RateInfo']>[number];

function mapRateEntry(r: GeneratedRateEntry): DetailsRateEntry {
  const out: DetailsRateEntry = { rateKey: r.RateKey, rateSource: r.RateSource };
  if (r.StartDate !== undefined) out.startDate = r.StartDate;
  if (r.EndDate !== undefined) out.endDate = r.EndDate;
  if (r.AmountBeforeTax !== undefined) out.amountBeforeTax = r.AmountBeforeTax;
  if (r.AmountAfterTax !== undefined) out.amountAfterTax = r.AmountAfterTax;
  if (r.MinSellingRate !== undefined) out.minSellingRate = r.MinSellingRate;
  if (r.AverageNightlyRate !== undefined) out.averageNightlyRate = r.AverageNightlyRate;
  if (r.AverageNightlyRateBeforeTax !== undefined) {
    out.averageNightlyRateBeforeTax = r.AverageNightlyRateBeforeTax;
  }
  if (r.CurrencyCode !== undefined) out.currencyCode = r.CurrencyCode;
  if (r.AdditionalFeesInclusive !== undefined) {
    out.additionalFeesInclusive = r.AdditionalFeesInclusive;
  }
  if (r.TaxInclusive !== undefined) out.taxInclusive = r.TaxInclusive;
  if (r.LocalFeesInclusive !== undefined) out.localFeesInclusive = r.LocalFeesInclusive;
  if (r.IncidentalsInclusive !== undefined) out.incidentalsInclusive = r.IncidentalsInclusive;
  if (r.ApproxTotalPrice !== undefined) out.approxTotalPrice = r.ApproxTotalPrice;
  if (r.HighestNightlyRate !== undefined) out.highestNightlyRate = r.HighestNightlyRate;
  if (r.Commission !== undefined) out.commission = mapCommission(r.Commission);
  return out;
}

function mapCommission(c: components['schemas']['Commission']): DetailsCommission {
  const out: DetailsCommission = {};
  if (c.Percent !== undefined) out.percent = c.Percent;
  if (c.Amount !== undefined) out.amount = c.Amount;
  if (c.CurrencyCode !== undefined) out.currencyCode = c.CurrencyCode;
  if (c.Type !== undefined) out.type = c.Type;
  if (c.CommissionDescription?.Text !== undefined) {
    out.description = [...c.CommissionDescription.Text];
  }
  return out;
}

function mapUnavailSource(
  s: NonNullable<components['schemas']['RateUnavailabilityType']['RateSource']>[number],
): DetailsUnavailSource {
  const out: DetailsUnavailSource = { source: s.Source, reason: s.Reason };
  if (s.DisplayMessage !== undefined) out.displayMessage = s.DisplayMessage;
  return out;
}

type GeneratedResponseRoom = NonNullable<components['schemas']['response.Rooms']['Room']>[number];

function mapRoomDetail(r: GeneratedResponseRoom): DetailsRoomDetail {
  const out: DetailsRoomDetail = {
    roomIndex: r.RoomIndex,
    ratePlans: (r.RatePlans.RatePlan ?? []).map(mapRatePlan),
  };
  if (r.RoomType !== undefined) out.roomType = r.RoomType;
  if (r.RoomTypeCode !== undefined) out.roomTypeCode = r.RoomTypeCode;
  if (r.RoomCategory !== undefined) out.roomCategory = r.RoomCategory;
  if (r.RoomID !== undefined) out.roomId = r.RoomID;
  if (r.Floor !== undefined) out.floor = r.Floor;
  if (r.RoomViewCode !== undefined) out.roomViewCode = r.RoomViewCode;
  if (r.RoomViewDescription !== undefined) out.roomViewDescription = r.RoomViewDescription;
  if (r.NonSmoking !== undefined) out.nonSmoking = r.NonSmoking;
  if (r.NumberOfBedRooms !== undefined) out.numberOfBedRooms = r.NumberOfBedRooms;
  if (r.BedTypeOptions?.BedTypes !== undefined) {
    out.bedTypes = r.BedTypeOptions.BedTypes.flatMap((bt) => (bt.BedType ?? []).map(mapBedType));
  }
  if (r.RoomDescription !== undefined) out.roomDescription = mapRoomDescription(r.RoomDescription);
  if (r.AdditionalDetails?.AdditionalDetail !== undefined) {
    out.additionalDetails = r.AdditionalDetails.AdditionalDetail.map(mapAdditionalDetail);
  }
  if (r.Amenities?.Amenity !== undefined) {
    out.amenities = r.Amenities.Amenity.map(mapRoomAmenity);
  }
  if (r.AccessibleAmenities?.Amenity !== undefined) {
    out.accessibleAmenities = r.AccessibleAmenities.Amenity.map(mapHotelAmenity);
  }
  if (r.Occupancy !== undefined) out.occupancy = mapOccupancy(r.Occupancy);
  if (r.RoomMediaInfo !== undefined) {
    const roomMedia = mapMediaInfo(r.RoomMediaInfo);
    if (roomMedia !== undefined) out.roomMediaInfo = roomMedia;
  }
  return out;
}

function mapRoomSet(
  rs: NonNullable<components['schemas']['RoomSets']['RoomSet']>[number],
): DetailsRoomSet {
  const out: DetailsRoomSet = {};
  if (rs.RoomSetAttributes?.RoomSetAttribute !== undefined) {
    out.attributes = rs.RoomSetAttributes.RoomSetAttribute.map(mapRoomSetAttribute);
  }
  if (rs.Room !== undefined) out.rooms = rs.Room.map(mapRoomDetail);
  return out;
}

function mapRoomSetAttribute(
  a: NonNullable<components['schemas']['RoomSetAttributes']['RoomSetAttribute']>[number],
): DetailsRoomSetAttribute {
  const out: DetailsRoomSetAttribute = {};
  if (a.Type !== undefined) out.type = a.Type;
  if (a.Code !== undefined) out.code = a.Code;
  if (a.Value !== undefined) out.value = a.Value;
  return out;
}

function mapBedType(
  bt: NonNullable<components['schemas']['BedTypes'][number]['BedType']>[number],
): DetailsBedType {
  const out: DetailsBedType = {};
  if (bt.Code !== undefined) out.code = bt.Code;
  if (bt.Description !== undefined) out.description = bt.Description;
  if (bt.Count !== undefined) out.count = bt.Count;
  return out;
}

function mapRoomDescription(rd: components['schemas']['RoomDescription']): DetailsRoomDescription {
  const out: DetailsRoomDescription = {};
  if (rd.Name !== undefined) out.name = rd.Name;
  if (rd.Text !== undefined) out.text = [...rd.Text];
  return out;
}

function mapAdditionalDetail(
  d: NonNullable<components['schemas']['AdditionalDetails']['AdditionalDetail']>[number],
): DetailsAdditionalDetail {
  const out: DetailsAdditionalDetail = {};
  if (d.Code !== undefined) out.code = d.Code;
  if (d.Description !== undefined) out.description = d.Description;
  if (d.Amount !== undefined) out.amount = d.Amount;
  if (d.CurrencyCode !== undefined) out.currencyCode = d.CurrencyCode;
  if (d.Text !== undefined) out.text = [...d.Text];
  return out;
}

function mapRoomAmenity(
  a: NonNullable<components['schemas']['RoomAmenities']['Amenity']>[number],
): DetailsRoomAmenity {
  const out: DetailsRoomAmenity = {};
  if (a.Code !== undefined) out.code = a.Code;
  if (a.Description !== undefined) out.description = a.Description;
  if (a.ComplimentaryInd !== undefined) out.complimentary = a.ComplimentaryInd;
  if (a.AccessibleAmenity !== undefined) out.accessibleAmenity = a.AccessibleAmenity;
  if (a.value !== undefined) out.value = a.value;
  return out;
}

function mapOccupancy(o: components['schemas']['Occupancy']): DetailsOccupancy {
  const out: DetailsOccupancy = {};
  if (o.Min !== undefined) out.min = o.Min;
  if (o.Max !== undefined) out.max = o.Max;
  return out;
}

type GeneratedRatePlan = NonNullable<components['schemas']['RatePlans']['RatePlan']>[number];

function mapRatePlan(rp: GeneratedRatePlan): DetailsRatePlan {
  const out: DetailsRatePlan = {
    prepaidIndicator: rp.PrepaidIndicator,
    rateSource: rp.RateSource,
    rateKey: rp.RateKey,
  };
  if (rp.RatePlanName !== undefined) out.ratePlanName = rp.RatePlanName;
  if (rp.RatePlanCode !== undefined) out.ratePlanCode = rp.RatePlanCode;
  if (rp.RatePlanType !== undefined) out.ratePlanType = rp.RatePlanType;
  if (rp.AvailableQuantity !== undefined) out.availableQuantity = rp.AvailableQuantity;
  if (rp.LimitedAvailability !== undefined) out.limitedAvailability = rp.LimitedAvailability;
  if (rp.ClientId !== undefined) out.clientId = rp.ClientId;
  if (rp.ProductCode !== undefined) out.productCode = rp.ProductCode;
  if (rp.LoyaltyId !== undefined) out.loyaltyId = rp.LoyaltyId;
  if (rp.LoyaltyPoints !== undefined) out.loyaltyPoints = rp.LoyaltyPoints;
  if (rp.LoyaltyProgramName !== undefined) out.loyaltyProgramName = rp.LoyaltyProgramName;
  if (rp.RatePlanDescription?.Text !== undefined) {
    out.description = [...rp.RatePlanDescription.Text];
  }
  if (rp.RatePlanInclusions?.RatePlanInclusion !== undefined) {
    out.inclusions = rp.RatePlanInclusions.RatePlanInclusion.map(mapRatePlanInclusion);
  }
  if (rp.MealsIncluded !== undefined) out.mealsIncluded = mapMeals(rp.MealsIncluded);
  if (rp.RateInfo !== undefined) out.rateInfo = mapRoomRateInfo(rp.RateInfo);
  if (rp.ConvertedRateInfo !== undefined) {
    out.convertedRateInfo = mapRoomRateInfo(rp.ConvertedRateInfo);
  }
  return out;
}

function mapRatePlanInclusion(
  i: NonNullable<components['schemas']['RatePlanInclusions']['RatePlanInclusion']>[number],
): DetailsRatePlanInclusion {
  const out: DetailsRatePlanInclusion = {};
  if (i.Code !== undefined) out.code = i.Code;
  if (i.Description !== undefined) out.description = i.Description;
  if (i.Text !== undefined) out.text = [...i.Text];
  return out;
}

function mapMeals(m: components['schemas']['MealsIncluded']): DetailsMealsIncluded {
  const out: DetailsMealsIncluded = {};
  if (m.BreakFast !== undefined) out.breakfast = m.BreakFast;
  if (m.Lunch !== undefined) out.lunch = m.Lunch;
  if (m.Dinner !== undefined) out.dinner = m.Dinner;
  if (m.MealPlanIndicator !== undefined) out.mealPlanIndicator = m.MealPlanIndicator;
  if (m.MealPlanCode !== undefined) out.mealPlanCode = m.MealPlanCode;
  if (m.MealPlanDescription !== undefined) out.mealPlanDescription = m.MealPlanDescription;
  if (m.GuestCount !== undefined) out.guestCount = m.GuestCount;
  return out;
}

function mapRoomRateInfo(rri: components['schemas']['Room.RateInfo']): DetailsRoomRateInfo {
  const out: DetailsRoomRateInfo = {
    cancelPenalties: (rri.CancelPenalties?.CancelPenalty ?? []).map(mapCancelPenalty),
  };
  if (rri.StartDate !== undefined) out.startDate = rri.StartDate;
  if (rri.EndDate !== undefined) out.endDate = rri.EndDate;
  if (rri.AmountBeforeTax !== undefined) out.amountBeforeTax = rri.AmountBeforeTax;
  if (rri.AmountAfterTax !== undefined) out.amountAfterTax = rri.AmountAfterTax;
  if (rri.MinSellingRate !== undefined) out.minSellingRate = rri.MinSellingRate;
  if (rri.AverageNightlyRate !== undefined) out.averageNightlyRate = rri.AverageNightlyRate;
  if (rri.AverageNightlyRateBeforeTax !== undefined) {
    out.averageNightlyRateBeforeTax = rri.AverageNightlyRateBeforeTax;
  }
  if (rri.CurrencyCode !== undefined) out.currencyCode = rri.CurrencyCode;
  if (rri.AdditionalFeesInclusive !== undefined) {
    out.additionalFeesInclusive = rri.AdditionalFeesInclusive;
  }
  if (rri.TaxInclusive !== undefined) out.taxInclusive = rri.TaxInclusive;
  if (rri.LocalFeesInclusive !== undefined) out.localFeesInclusive = rri.LocalFeesInclusive;
  if (rri.IncidentalsInclusive !== undefined) out.incidentalsInclusive = rri.IncidentalsInclusive;
  if (rri.Rates?.Rate !== undefined) out.rates = rri.Rates.Rate.map(mapRate);
  if (rri.Taxes !== undefined) {
    const taxes = mapTaxes(rri.Taxes);
    if (taxes !== undefined) out.taxes = taxes;
  }
  if (rri.Fees !== undefined) {
    const fees = mapFees(rri.Fees);
    if (fees !== undefined) out.fees = fees;
  }
  if (rri.RoomExtras?.RoomExtra !== undefined) {
    out.roomExtras = rri.RoomExtras.RoomExtra.map(mapRoomExtra);
  }
  if (rri.Guarantee !== undefined) out.guarantee = mapGuarantee(rri.Guarantee);
  if (rri.AdditionalDetails?.AdditionalDetail !== undefined) {
    out.additionalDetails = rri.AdditionalDetails.AdditionalDetail.map(mapAdditionalDetail);
  }
  return out;
}

function mapRate(r: NonNullable<components['schemas']['Rates']['Rate']>[number]): DetailsRate {
  const out: DetailsRate = {};
  if (r.StartDate !== undefined) out.startDate = r.StartDate;
  if (r.EndDate !== undefined) out.endDate = r.EndDate;
  if (r.AmountBeforeTax !== undefined) out.amountBeforeTax = r.AmountBeforeTax;
  if (r.AmountAfterTax !== undefined) out.amountAfterTax = r.AmountAfterTax;
  if (r.CurrencyCode !== undefined) out.currencyCode = r.CurrencyCode;
  return out;
}

function mapTaxes(t: components['schemas']['Taxes']): DetailsTaxes | undefined {
  const out: DetailsTaxes = {};
  if (t.Amount !== undefined) out.amount = t.Amount;
  if (t.CurrencyCode !== undefined) out.currencyCode = t.CurrencyCode;
  if (t.Tax !== undefined) out.taxes = t.Tax.map(mapTax);
  if (t.TaxGroups?.TaxGroup !== undefined) out.taxGroups = t.TaxGroups.TaxGroup.map(mapTaxGroup);
  return Object.keys(out).length > 0 ? out : undefined;
}

function mapTax(t: NonNullable<components['schemas']['Taxes']['Tax']>[number]): DetailsTax {
  const out: DetailsTax = { amount: t.Amount, currencyCode: t.CurrencyCode };
  if (t.StartDate !== undefined) out.startDate = t.StartDate;
  if (t.EndDate !== undefined) out.endDate = t.EndDate;
  return out;
}

function mapTaxGroup(
  g: NonNullable<components['schemas']['TaxGroups']['TaxGroup']>[number],
): DetailsTaxGroup {
  const out: DetailsTaxGroup = {
    code: g.Code,
    amount: g.Amount,
    currencyCode: g.CurrencyCode,
  };
  if (g.Description !== undefined) out.description = g.Description;
  if (g.TaxDescription?.Text !== undefined) out.descriptionText = [...g.TaxDescription.Text];
  return out;
}

function mapFees(f: components['schemas']['Fees']): DetailsFees | undefined {
  const out: DetailsFees = {};
  if (f.Amount !== undefined) out.amount = f.Amount;
  if (f.CurrencyCode !== undefined) out.currencyCode = f.CurrencyCode;
  if (f.Fee !== undefined) out.fees = f.Fee.map(mapFee);
  if (f.FeeGroups?.FeeGroup !== undefined) out.feeGroups = f.FeeGroups.FeeGroup.map(mapFeeGroup);
  return Object.keys(out).length > 0 ? out : undefined;
}

function mapFee(f: NonNullable<components['schemas']['Fees']['Fee']>[number]): DetailsFee {
  const out: DetailsFee = { amount: f.Amount, currencyCode: f.CurrencyCode };
  if (f.StartDate !== undefined) out.startDate = f.StartDate;
  if (f.EndDate !== undefined) out.endDate = f.EndDate;
  return out;
}

function mapFeeGroup(
  g: NonNullable<components['schemas']['FeeGroups']['FeeGroup']>[number],
): DetailsFeeGroup {
  const out: DetailsFeeGroup = {
    code: g.Code,
    amount: g.Amount,
    currencyCode: g.CurrencyCode,
  };
  if (g.Description !== undefined) out.description = g.Description;
  if (g.FeeDescription?.Text !== undefined) out.descriptionText = [...g.FeeDescription.Text];
  return out;
}

function mapRoomExtra(
  e: NonNullable<components['schemas']['RoomExtras']['RoomExtra']>[number],
): DetailsRoomExtra {
  const out: DetailsRoomExtra = {};
  if (e.Text !== undefined) out.text = [...e.Text];
  if (e.Code !== undefined) out.code = e.Code;
  if (e.Description !== undefined) out.description = e.Description;
  if (e.Amount !== undefined) out.amount = e.Amount;
  if (e.CurrencyCode !== undefined) out.currencyCode = e.CurrencyCode;
  return out;
}

function mapCancelPenalty(
  p: NonNullable<components['schemas']['CancelPenalties']['CancelPenalty']>[number],
): DetailsCancelPenalty {
  const out: DetailsCancelPenalty = { refundable: p.Refundable };
  if (p.Deadline !== undefined) out.deadline = mapDeadline(p.Deadline);
  if (p.AmountPercent !== undefined) out.amountPercent = mapAmountPercent(p.AmountPercent);
  if (p.PenaltyDescription !== undefined) {
    out.descriptionText = [...p.PenaltyDescription.Text];
  }
  return out;
}

function mapDeadline(d: components['schemas']['Deadline']): DetailsDeadline {
  const out: DetailsDeadline = {};
  if (d.AbsoluteDeadline !== undefined) out.absoluteDeadline = d.AbsoluteDeadline;
  if (d.OffsetTimeUnit !== undefined) out.offsetTimeUnit = d.OffsetTimeUnit;
  if (d.OffsetUnitMultiplier !== undefined) out.offsetUnitMultiplier = d.OffsetUnitMultiplier;
  if (d.OffsetDropTime !== undefined) out.offsetDropTime = d.OffsetDropTime;
  return out;
}

function mapAmountPercent(a: components['schemas']['AmountPercent']): DetailsAmountPercent {
  const out: DetailsAmountPercent = {};
  if (a.TaxInclusive !== undefined) out.taxInclusive = a.TaxInclusive;
  if (a.FeesInclusive !== undefined) out.feesInclusive = a.FeesInclusive;
  if (a.NmbrOfNights !== undefined) out.numberOfNights = a.NmbrOfNights;
  if (a.BasisType !== undefined) out.basisType = a.BasisType;
  if (a.Percent !== undefined) out.percent = a.Percent;
  if (a.Amount !== undefined) out.amount = a.Amount;
  if (a.CurrencyCode !== undefined) out.currencyCode = a.CurrencyCode;
  if (a.ApplyAs !== undefined) out.applyAs = a.ApplyAs;
  return out;
}

function mapGuarantee(g: components['schemas']['Guarantee']): DetailsGuarantee {
  const out: DetailsGuarantee = {
    accepted: g.GuaranteesAccepted.GuaranteeAccepted.map(mapGuaranteeAccepted),
  };
  if (g.GuaranteeType !== undefined) out.guaranteeType = g.GuaranteeType;
  if (g.DepositPolicies?.DepositPolicy !== undefined) {
    out.depositPolicies = g.DepositPolicies.DepositPolicy.map(mapDepositPolicy);
  }
  if (g.GuaranteeDescription?.Text !== undefined) {
    out.descriptionText = [...g.GuaranteeDescription.Text];
  }
  return out;
}

function mapGuaranteeAccepted(
  ga: components['schemas']['GuaranteesAccepted']['GuaranteeAccepted'][number],
): DetailsGuaranteeAccepted {
  const out: DetailsGuaranteeAccepted = {};
  if (ga.GuaranteeTypeCode !== undefined) out.typeCode = ga.GuaranteeTypeCode;
  if (ga.GuaranteeTypeDescription !== undefined) out.typeDescription = ga.GuaranteeTypeDescription;
  if (ga.PaymentCards !== undefined) {
    const cards: DetailsPaymentCard[] = (ga.PaymentCards.PaymentCard ?? []).map((c) => {
      const card: DetailsPaymentCard = { code: c.CardCode };
      if (c.value !== undefined) card.value = c.value;
      return card;
    });
    const list: NonNullable<DetailsGuaranteeAccepted['paymentCards']> = { cards };
    if (ga.PaymentCards.CVVRequired !== undefined) list.cvvRequired = ga.PaymentCards.CVVRequired;
    out.paymentCards = list;
  }
  return out;
}

function mapDepositPolicy(
  dp: NonNullable<components['schemas']['DepositPolicies']['DepositPolicy']>[number],
): DetailsDepositPolicy {
  const out: DetailsDepositPolicy = {};
  if (dp.Deadline !== undefined) out.deadline = mapDeadline(dp.Deadline);
  if (dp.AmountPercent !== undefined) out.amountPercent = mapAmountPercent(dp.AmountPercent);
  return out;
}

// --- Descriptive-info mapping -----------------------------------------------

function mapDescriptiveInfo(
  di: components['schemas']['HotelDescriptiveInfo'],
): DetailsDescriptiveInfo | undefined {
  const out: DetailsDescriptiveInfo = {};
  if (di.PropertyInfo !== undefined) {
    const pi = mapPropertyInfo(di.PropertyInfo);
    if (pi !== undefined) out.propertyInfo = pi;
  }
  if (di.LocationInfo !== undefined) {
    const li = mapLocationInfo(di.LocationInfo);
    if (li !== undefined) out.locationInfo = li;
  }
  if (di.Amenities?.Amenity !== undefined) {
    out.amenities = di.Amenities.Amenity.map(mapHotelAmenity);
  }
  if (di.SecurityFeatures?.SecurityFeature !== undefined) {
    out.securityFeatures = di.SecurityFeatures.SecurityFeature.map(mapSecurityFeature);
  }
  if (di.Sustainability !== undefined) {
    const sust: DetailsSustainability = {};
    if (di.Sustainability.SustainablePractices !== undefined) {
      sust.sustainablePractices = di.Sustainability.SustainablePractices;
    }
    if (di.Sustainability.Certifications !== undefined) {
      sust.certifications = di.Sustainability.Certifications;
    }
    if (di.Sustainability.EnvironmentalImpact !== undefined) {
      sust.environmentalImpact = di.Sustainability.EnvironmentalImpact;
    }
    if (Object.keys(sust).length > 0) out.sustainability = sust;
  }
  if (di.Descriptions?.Description !== undefined) {
    out.descriptions = di.Descriptions.Description.map(mapDescription);
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function mapPropertyInfo(
  pi: components['schemas']['PropertyInfo'],
): DetailsPropertyInfo | undefined {
  const out: DetailsPropertyInfo = {};
  if (pi.Floors !== undefined) out.floors = pi.Floors;
  if (pi.Rooms !== undefined) out.rooms = pi.Rooms;
  if (pi.PropertyTypeInfo?.PropertyType !== undefined) {
    out.propertyTypes = pi.PropertyTypeInfo.PropertyType.map(mapPropertyType);
  }
  if (pi.Policies?.Policy !== undefined) {
    out.policies = pi.Policies.Policy.map(mapPolicy);
  }
  if (pi.PropertyQualityInfo?.PropertyQuality !== undefined) {
    out.propertyQuality = pi.PropertyQualityInfo.PropertyQuality.map(mapPropertyQuality);
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function mapPropertyType(
  pt: NonNullable<components['schemas']['PropertyTypeInfo']['PropertyType']>[number],
): DetailsPropertyType {
  const out: DetailsPropertyType = {};
  if (pt.Code !== undefined) out.code = pt.Code;
  if (pt.Description !== undefined) out.description = pt.Description;
  return out;
}

function mapPolicy(
  p: NonNullable<components['schemas']['Policies']['Policy']>[number],
): DetailsPolicyText {
  const out: DetailsPolicyText = {};
  if (p.Text.Type !== undefined) out.type = p.Text.Type;
  if (p.Text.value !== undefined) out.value = p.Text.value;
  return out;
}

function mapPropertyQuality(
  pq: NonNullable<components['schemas']['PropertyQualityInfo']['PropertyQuality']>[number],
): DetailsPropertyQuality {
  const out: DetailsPropertyQuality = {};
  if (pq.Code !== undefined) out.code = pq.Code;
  if (pq.Description !== undefined) out.description = pq.Description;
  return out;
}

function mapLocationInfo(
  li: components['schemas']['LocationInfo'],
): DetailsLocationInfo | undefined {
  const out: DetailsLocationInfo = {};
  if (li.Latitude !== undefined) out.latitude = li.Latitude;
  if (li.Longitude !== undefined) out.longitude = li.Longitude;
  if (li.Address !== undefined) out.address = mapAddress(li.Address);
  if (li.Neighborhoods?.Neighborhood !== undefined) {
    out.neighborhoods = li.Neighborhoods.Neighborhood.map(mapNeighborhood);
  }
  if (li.Contact !== undefined) out.contact = mapContact(li.Contact);
  return Object.keys(out).length > 0 ? out : undefined;
}

function mapAddress(a: components['schemas']['Address']): DetailsAddress {
  const out: DetailsAddress = {
    addressLine1: a.AddressLine1,
    postalCode: a.PostalCode,
  };
  if (a.AddressLine2 !== undefined) out.addressLine2 = a.AddressLine2;
  if (a.AddressLine3 !== undefined) out.addressLine3 = a.AddressLine3;
  if (a.CityName !== undefined) out.city = mapCity(a.CityName);
  if (a.StateProv !== undefined) out.stateProv = mapStateProv(a.StateProv);
  if (a.CountryName !== undefined) out.country = mapCountry(a.CountryName);
  return out;
}

function mapCity(c: components['schemas']['CityName']): DetailsCity {
  const out: DetailsCity = {};
  if (c.CityCode !== undefined) out.cityCode = c.CityCode;
  if (c.value !== undefined) out.value = c.value;
  return out;
}

function mapStateProv(s: components['schemas']['StateProv']): DetailsStateProv {
  const out: DetailsStateProv = {};
  if (s.StateCode !== undefined) out.stateCode = s.StateCode;
  if (s.value !== undefined) out.value = s.value;
  return out;
}

function mapCountry(c: components['schemas']['CountryName']): DetailsCountry {
  const out: DetailsCountry = {};
  if (c.Code !== undefined) out.code = c.Code;
  if (c.value !== undefined) out.value = c.value;
  return out;
}

function mapNeighborhood(
  n: NonNullable<components['schemas']['Neighborhoods']['Neighborhood']>[number],
): DetailsNeighborhood {
  const out: DetailsNeighborhood = {};
  if (n.Id !== undefined) out.id = n.Id;
  if (n.value !== undefined) out.value = n.value;
  return out;
}

function mapContact(c: components['schemas']['Contact']): DetailsContact {
  const out: DetailsContact = {};
  if (c.Phone !== undefined) out.phone = c.Phone;
  if (c.Fax !== undefined) out.fax = c.Fax;
  return out;
}

function mapHotelAmenity(
  a: NonNullable<components['schemas']['Amenities']['Amenity']>[number],
): DetailsHotelAmenity {
  const out: DetailsHotelAmenity = {};
  if (a.Code !== undefined) out.code = a.Code;
  if (a.Description !== undefined) out.description = a.Description;
  if (a.ComplimentaryInd !== undefined) out.complimentary = a.ComplimentaryInd;
  if (a.value !== undefined) out.value = a.value;
  return out;
}

function mapSecurityFeature(
  s: NonNullable<components['schemas']['SecurityFeatures']['SecurityFeature']>[number],
): DetailsSecurityFeature {
  const out: DetailsSecurityFeature = {};
  if (s.Code !== undefined) out.code = s.Code;
  if (s.Description !== undefined) out.description = s.Description;
  if (s.value !== undefined) out.value = s.value;
  return out;
}

type GeneratedDescriptionEntry = NonNullable<
  components['schemas']['HotelDescriptiveInfo.Descriptions']['Description']
>[number];

function mapDescription(d: GeneratedDescriptionEntry): DetailsDescription {
  // HotelDescriptiveInfo.Description.Text is a single object carrying
  // Type + value (not an array). The public type surfaces Type as the
  // category and the single description string packaged as a one-item
  // array for forward-compatibility with multi-paragraph responses.
  const out: DetailsDescription = {};
  if (d.Text?.Type !== undefined) out.type = d.Text.Type;
  if (d.Text?.value !== undefined) out.text = [d.Text.value];
  return out;
}

// --- Media mapping ---------------------------------------------------------

function mapMediaInfo(mi: components['schemas']['HotelMediaInfo']): DetailsMediaInfo | undefined {
  const items = mi.MediaItems?.MediaItem;
  if (items === undefined || items.length === 0) return undefined;
  return { items: items.map(mapMediaItem) };
}

type GeneratedMediaItem = NonNullable<components['schemas']['MediaItems']['MediaItem']>[number];

function mapMediaItem(item: GeneratedMediaItem): DetailsMediaItem {
  const out: DetailsMediaItem = {};
  if (item.Id !== undefined) out.id = item.Id;
  if (item.Ordinal !== undefined) out.ordinal = item.Ordinal;
  if (item.LastModifedDate !== undefined) out.lastModifiedDate = item.LastModifedDate;
  if (item.Format !== undefined) out.format = item.Format;
  if (item.Category !== undefined) {
    const cat = mapMediaCategory(item.Category);
    if (cat !== undefined) out.category = cat;
  }
  if (item.RoomTypeCode !== undefined && item.RoomTypeCode.length > 0) {
    const first = item.RoomTypeCode[0];
    if (first?.Code !== undefined) out.roomTypeCode = first.Code;
  }
  if (item.AdditionalInfo?.Info !== undefined && item.AdditionalInfo.Info.length > 0) {
    // `Info` is an array of { Type: CAPTION | ROOM_TYPE_CODE, Description }.
    // Surface the first CAPTION's first language-code text as the item
    // caption; ROOM_TYPE_CODE entries overlap with the `RoomTypeCode` field
    // below so they don't need separate handling here.
    const caption = item.AdditionalInfo.Info.find((i) => i.Type === 'CAPTION');
    const firstText = caption?.Description.Text?.[0]?.value;
    if (firstText !== undefined) out.caption = firstText;
  }
  if (item.ImageItems?.Image !== undefined) {
    out.type = out.type ?? 'IMAGE';
    out.images = item.ImageItems.Image.map(mapResponseImage);
  }
  if (item.PanoramicMediasItems?.PanoramicMedia !== undefined) {
    out.type = out.type ?? 'PANORAMIC';
    out.panoramics = item.PanoramicMediasItems.PanoramicMedia.map(mapResponsePanoramic);
  }
  if (item.VideosItems?.Video !== undefined) {
    out.type = out.type ?? 'VIDEO';
    out.videos = item.VideosItems.Video.map(mapResponseVideo);
  }
  return out;
}

function mapMediaCategory(
  cat: components['schemas']['response.Category'],
): DetailsMediaCategory | undefined {
  const out: DetailsMediaCategory = {};
  if (cat.CategoryCode !== undefined) out.code = cat.CategoryCode;
  // Description.Text is a list of {Language, value} pairs; surface the first
  // value so consumers get a readable category without recursing into the
  // language-code list. Full language-code detail is preserved in the raw
  // response for consumers who need it.
  const text = cat.Description?.Text?.[0]?.value;
  if (text !== undefined) out.description = text;
  return Object.keys(out).length > 0 ? out : undefined;
}

function mapResponseImage(
  img: NonNullable<components['schemas']['response.Image']>[number],
): DetailsImageVariant {
  const out: DetailsImageVariant = {};
  if (img.Url !== undefined) out.url = img.Url;
  if (img.Type !== undefined) out.size = img.Type;
  if (img.Height !== undefined) out.height = img.Height;
  if (img.Width !== undefined) out.width = img.Width;
  return out;
}

function mapResponsePanoramic(
  p: NonNullable<components['schemas']['response.PanoramicMedia']>[number],
): DetailsPanoramicVariant {
  const out: DetailsPanoramicVariant = {};
  if (p.Url !== undefined) out.url = p.Url;
  if (p.Type !== undefined) out.type = p.Type;
  if (p.Height !== undefined) out.height = p.Height;
  if (p.Width !== undefined) out.width = p.Width;
  return out;
}

function mapResponseVideo(
  v: NonNullable<components['schemas']['response.Video']>[number],
): DetailsVideoVariant {
  const out: DetailsVideoVariant = {};
  if (v.Url !== undefined) out.url = v.Url;
  if (v.Type !== undefined) out.type = v.Type;
  if (v.Height !== undefined) out.height = v.Height;
  if (v.Width !== undefined) out.width = v.Width;
  return out;
}

// --- Application-results mapping -------------------------------------------

function mapApplicationResults(
  ar: components['schemas']['ApplicationResults'],
): DetailsApplicationResults | undefined {
  const out: DetailsApplicationResults = {};
  if (ar.status !== undefined) out.status = ar.status;
  if (ar.Success !== undefined) out.success = ar.Success.map(mapElement);
  if (ar.Error !== undefined) out.errors = ar.Error.map(mapElement);
  if (ar.Warning !== undefined) out.warnings = ar.Warning.map(mapElement);
  return Object.keys(out).length > 0 ? out : undefined;
}

type GeneratedElement = components['schemas']['ElementStructure'][number];

function mapElement(e: GeneratedElement): DetailsApplicationResultEntry {
  const out: DetailsApplicationResultEntry = {};
  if (e.type !== undefined) out.type = e.type;
  if (e.timeStamp !== undefined) out.timeStamp = e.timeStamp;
  if (e.SystemSpecificResults !== undefined) {
    out.systemSpecificResults = e.SystemSpecificResults.map(mapSystemSpecificResult);
  }
  return out;
}

type GeneratedSystemSpecificResult = NonNullable<GeneratedElement['SystemSpecificResults']>[number];

function mapSystemSpecificResult(r: GeneratedSystemSpecificResult): DetailsSystemSpecificResult {
  const out: DetailsSystemSpecificResult = {};
  if (r.timeStamp !== undefined) out.timeStamp = r.timeStamp;
  if (r.reference !== undefined) out.reference = r.reference;
  if (r.HostCommand?.LNIATA !== undefined) {
    out.hostCommand = { lniata: r.HostCommand.LNIATA };
  }
  if (r.Message !== undefined) {
    out.messages = r.Message.map((m): DetailsApplicationMessage => {
      const msg: DetailsApplicationMessage = {};
      if (m.code !== undefined) msg.code = m.code;
      if (m.value !== undefined) msg.value = m.value;
      return msg;
    });
  }
  return out;
}
