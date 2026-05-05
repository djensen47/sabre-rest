import { SabreParseError } from '../../errors/sabre-parse-error.js';
import type { components } from '../../generated/get-hotel-avail.js';
import { ensureTrailingSlash } from '../../http/ensure-trailing-slash.js';
import type { SabreRequest, SabreResponse } from '../../http/types.js';
import type {
  AvailAdditionalDetail,
  AvailAmenity,
  AvailAmountPercent,
  AvailApplicationResultEntry,
  AvailApplicationResults,
  AvailAvailableRatePlan,
  AvailBedType,
  AvailCancelPenalty,
  AvailCodeFilter,
  AvailCommission,
  AvailContact,
  AvailDeadline,
  AvailDepositPolicy,
  AvailFee,
  AvailFeeGroup,
  AvailFees,
  AvailGuarantee,
  AvailGuaranteeAccepted,
  AvailHotel,
  AvailHotelPreferences,
  AvailHotelRateInfo,
  AvailLocation,
  AvailMealsIncluded,
  AvailNeighborhood,
  AvailOccupancy,
  AvailPaymentCard,
  AvailPropertyQuality,
  AvailPropertyType,
  AvailRate,
  AvailRateEntry,
  AvailRateFilter,
  AvailRatePlan,
  AvailRatePlanCandidates,
  AvailRatePlanInclusion,
  AvailRateRangeEntry,
  AvailRateUnavailability,
  AvailRequestedRoom,
  AvailRoom,
  AvailRoomAmenity,
  AvailRoomDescription,
  AvailRoomExtra,
  AvailRoomRateInfo,
  AvailSearchByGeo,
  AvailSearchByHotels,
  AvailSecurityFeature,
  AvailSystemSpecificResult,
  AvailTax,
  AvailTaxGroup,
  AvailTaxes,
  AvailTierLabel,
  GetHotelAvailInput,
  GetHotelAvailOutput,
} from './types.js';

const PATH = 'v5/get/hotelavail';

/**
 * Builds the outgoing {@link SabreRequest} for the `getHotelAvail`
 * operation.
 *
 * Sabre's spec documents `default:` values on ~10 request fields (OffSet,
 * SortBy, PageSize, TierLabels, RateDetailsInd, PrepaidQualifier,
 * RefundableOnly, ConvertedRateInfoOnly, etc.). Following the precedent
 * set by hotel-search-v2 and hotel-price-check-v5, this mapper does
 * **not** auto-send those defaults on the consumer's behalf. Sabre
 * applies them server-side when fields are omitted, so the wire body
 * reflects exactly what the consumer asked for. If that ever starts
 * failing with "schema version"–type errors, the mapper will need to
 * start sending documented defaults explicitly; no known failures today.
 */
export function toGetAvailRequest(baseUrl: string, input: GetHotelAvailInput): SabreRequest {
  const url = new URL(PATH, ensureTrailingSlash(baseUrl));

  const searchCriteria: Record<string, unknown> = {};
  applyCriteriaPrefs(searchCriteria, input.criteria);

  if (input.search.kind === 'geo') {
    searchCriteria.GeoSearch = buildGeoSearch(input.search);
  } else {
    searchCriteria.HotelRefs = buildHotelRefs(input.search);
  }

  searchCriteria.RateInfoRef = buildRateInfoRef(input.rateInfoRef);

  if (input.hotelPref !== undefined) {
    const pref = buildHotelPref(input.hotelPref);
    if (pref !== undefined) searchCriteria.HotelPref = pref;
  }
  if (input.imageRef !== undefined) {
    const img: Record<string, unknown> = {};
    if (input.imageRef.type !== undefined) img.Type = input.imageRef.type;
    if (input.imageRef.categoryCode !== undefined) img.CategoryCode = input.imageRef.categoryCode;
    if (input.imageRef.languageCode !== undefined) img.LanguageCode = input.imageRef.languageCode;
    if (Object.keys(img).length > 0) searchCriteria.ImageRef = img;
  }

  const rq: Record<string, unknown> = { SearchCriteria: searchCriteria };
  if (input.pointOfSale !== undefined) {
    rq.POS = { Source: { PseudoCityCode: input.pointOfSale.pseudoCityCode } };
  }
  if (input.corporateNumber !== undefined) {
    rq.CorporateNumber = input.corporateNumber;
  }

  return {
    method: 'POST',
    url: url.toString(),
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ GetHotelAvailRQ: rq }),
  };
}

function applyCriteriaPrefs(
  sc: Record<string, unknown>,
  prefs: GetHotelAvailInput['criteria'],
): void {
  if (prefs === undefined) return;
  if (prefs.offSet !== undefined) sc.OffSet = prefs.offSet;
  if (prefs.sortBy !== undefined) sc.SortBy = prefs.sortBy;
  if (prefs.sortOrder !== undefined) sc.SortOrder = prefs.sortOrder;
  if (prefs.pageSize !== undefined) sc.PageSize = prefs.pageSize;
  if (prefs.shopKey !== undefined) sc.ShopKey = prefs.shopKey;
  if (prefs.tierLabels !== undefined) sc.TierLabels = prefs.tierLabels;
  if (prefs.rateDetailsInd !== undefined) sc.RateDetailsInd = prefs.rateDetailsInd;
}

function buildGeoSearch(search: AvailSearchByGeo): Record<string, unknown> {
  const ref: Record<string, unknown> = { Radius: search.geoRef.radius, UOM: search.geoRef.uom };
  if (search.geoRef.restrictToCountry !== undefined) {
    ref.RestrictSearchToCountry = search.geoRef.restrictToCountry;
  }
  if (search.geoRef.kind === 'geoCode') {
    ref.GeoCode = { Latitude: search.geoRef.latitude, Longitude: search.geoRef.longitude };
  } else if (search.geoRef.kind === 'refPoint') {
    const rp: Record<string, unknown> = {
      RefPointType: search.geoRef.refPointType,
      Value: search.geoRef.value,
      ValueContext: search.geoRef.valueContext,
    };
    if (search.geoRef.stateProv !== undefined) rp.StateProv = search.geoRef.stateProv;
    if (search.geoRef.countryCode !== undefined) rp.CountryCode = search.geoRef.countryCode;
    ref.RefPoint = rp;
  } else {
    const ar: Record<string, unknown> = { CountryCode: search.geoRef.countryCode };
    if (search.geoRef.street !== undefined) ar.Street = search.geoRef.street;
    if (search.geoRef.city !== undefined) ar.City = search.geoRef.city;
    if (search.geoRef.county !== undefined) ar.County = search.geoRef.county;
    if (search.geoRef.postalCode !== undefined) ar.PostalCode = search.geoRef.postalCode;
    if (search.geoRef.stateProv !== undefined) ar.StateProv = search.geoRef.stateProv;
    ref.AddressRef = ar;
  }

  const out: Record<string, unknown> = { GeoRef: ref };
  if (search.attributes !== undefined && search.attributes.length > 0) {
    out.GeoAttributes = {
      Attributes: search.attributes.map((a) => ({ Name: a.name, Value: a.value })),
    };
  }
  return out;
}

function buildHotelRefs(search: AvailSearchByHotels): Record<string, unknown> {
  return {
    HotelRef: search.hotels.map((h) => {
      const ref: Record<string, unknown> = { HotelCode: h.code };
      if (h.codeContext !== undefined) ref.CodeContext = h.codeContext;
      return ref;
    }),
  };
}

function buildRateInfoRef(r: GetHotelAvailInput['rateInfoRef']): Record<string, unknown> {
  const out: Record<string, unknown> = {
    CurrencyCode: r.currencyCode,
    BestOnly: r.bestOnly,
    StayDateTimeRange: {
      StartDate: r.stayDateTimeRange.startDate,
      EndDate: r.stayDateTimeRange.endDate,
    },
    Rooms: { Room: r.rooms.map(buildRequestedRoom) },
  };
  if (r.prepaidQualifier !== undefined) out.PrepaidQualifier = r.prepaidQualifier;
  if (r.refundableOnly !== undefined) out.RefundableOnly = r.refundableOnly;
  if (r.convertedRateInfoOnly !== undefined) out.ConvertedRateInfoOnly = r.convertedRateInfoOnly;
  if (r.travellerCountry !== undefined) out.TravellerCountry = r.travellerCountry;
  if (r.rateRange !== undefined) {
    const rr: Record<string, unknown> = {};
    if (r.rateRange.min !== undefined) rr.Min = r.rateRange.min;
    if (r.rateRange.max !== undefined) rr.Max = r.rateRange.max;
    if (Object.keys(rr).length > 0) out.RateRange = rr;
  }
  if (r.rateFilters !== undefined && r.rateFilters.length > 0) {
    out.RateFilters = { RateFilter: r.rateFilters.map(buildRateFilter) };
  }
  if (r.ratePlanCandidates !== undefined) {
    out.RatePlanCandidates = buildRatePlanCandidates(r.ratePlanCandidates);
  }
  if (r.loyaltyIds !== undefined && r.loyaltyIds.length > 0) {
    out.LoyaltyIds = { LoyaltyId: [...r.loyaltyIds] };
  }
  if (r.frequentFlyerNumber !== undefined) out.FrequentFlyerNumber = r.frequentFlyerNumber;
  if (r.corpDiscount !== undefined) out.CorpDiscount = r.corpDiscount;
  if (r.rateSource !== undefined && r.rateSource.length > 0) {
    out.RateSource = r.rateSource.join(',');
  }
  return out;
}

function buildRequestedRoom(room: AvailRequestedRoom): Record<string, unknown> {
  const out: Record<string, unknown> = { Index: room.index, Adults: room.adults };
  if (room.children !== undefined) out.Children = room.children;
  if (room.childAges !== undefined && room.childAges.length > 0) {
    out.ChildAges = room.childAges.join(',');
  }
  return out;
}

function buildRateFilter(f: AvailRateFilter): Record<string, unknown> {
  return { Type: f.type, Value: f.value, Action: f.action };
}

function buildRatePlanCandidates(c: AvailRatePlanCandidates): Record<string, unknown> {
  const out: Record<string, unknown> = {
    RatePlanCandidate: c.candidates.map((cand) => {
      const entry: Record<string, unknown> = {};
      if (cand.ratePlanType !== undefined) entry.RatePlanType = cand.ratePlanType;
      if (cand.ratePlanCode !== undefined) entry.RatePlanCode = cand.ratePlanCode;
      return entry;
    }),
  };
  if (c.exactMatchOnly !== undefined) out.ExactMatchOnly = c.exactMatchOnly;
  if (c.otherAvailableRatePlans !== undefined) {
    out.OtherAvailableRatePlans = c.otherAvailableRatePlans;
  }
  return out;
}

function buildHotelPref(pref: AvailHotelPreferences): Record<string, unknown> | undefined {
  const out: Record<string, unknown> = {};
  if (pref.hotelName !== undefined) out.HotelName = pref.hotelName;
  if (pref.lenientHotelName !== undefined) out.LenientHotelName = pref.lenientHotelName;
  if (pref.brandCodes !== undefined && pref.brandCodes.length > 0) {
    out.BrandCodes = { BrandCode: [...pref.brandCodes] };
  }
  if (pref.chainCodes !== undefined && pref.chainCodes.length > 0) {
    out.ChainCodes = { ChainCode: [...pref.chainCodes] };
  }
  if (pref.amenityCodes !== undefined) {
    out.AmenityCodes = buildCodeFilter(pref.amenityCodes, 'AmenityCode');
  }
  if (pref.securityFeatureCodes !== undefined) {
    out.SecurityFeatureCodes = buildCodeFilter(pref.securityFeatureCodes, 'SecurityFeatureCode');
  }
  if (pref.propertyTypeCodes !== undefined) {
    out.PropertyTypeCodes = buildCodeFilter(pref.propertyTypeCodes, 'PropertyTypeCode');
  }
  if (pref.propertyQualityCodes !== undefined) {
    out.PropertyQualityCodes = buildCodeFilter(pref.propertyQualityCodes, 'PropertyQualityCode');
  }
  if (pref.sabreRating !== undefined) {
    const rating: Record<string, unknown> = {};
    if (pref.sabreRating.min !== undefined) rating.Min = pref.sabreRating.min;
    if (pref.sabreRating.max !== undefined) rating.Max = pref.sabreRating.max;
    if (Object.keys(rating).length > 0) out.SabreRating = rating;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function buildCodeFilter(filter: AvailCodeFilter, codeKey: string): Record<string, unknown> {
  const out: Record<string, unknown> = { [codeKey]: [...filter.codes] };
  if (filter.inclusive !== undefined) out.Inclusive = filter.inclusive;
  return out;
}

// -----------------------------------------------------------------------------
// Response mappers
// -----------------------------------------------------------------------------

/**
 * Parses the `getHotelAvail` response into the public output shape.
 *
 * Every hotel, every rate entry, every room, and every rate plan Sabre
 * returned is preserved. Consumers check {@link AvailRateEntry.rateKey}
 * for presence before feeding it to
 * {@link HotelPriceCheckV5Service.check}. Throws
 * {@link SabreParseError} only when the body fundamentally is not a Sabre
 * response.
 */
export function fromGetAvailResponse(res: SabreResponse): GetHotelAvailOutput {
  let parsed: components['schemas']['GetHotelAvailResponse'];
  try {
    parsed = JSON.parse(res.body) as components['schemas']['GetHotelAvailResponse'];
  } catch (err) {
    throw new SabreParseError('Failed to parse Get Hotel Avail response as JSON', res.body, {
      cause: err,
    });
  }

  if (parsed === null || typeof parsed !== 'object') {
    throw new SabreParseError('Get Hotel Avail response was not a JSON object', parsed);
  }

  const rs = parsed.GetHotelAvailRS;
  if (rs === undefined || rs === null || typeof rs !== 'object') {
    throw new SabreParseError('Get Hotel Avail response was missing `GetHotelAvailRS`', parsed);
  }

  const infos = rs.HotelAvailInfos;
  const out: GetHotelAvailOutput = {
    hotels: mapHotels(infos?.HotelAvailInfo),
  };
  if (infos?.OffSet !== undefined) out.offSet = infos.OffSet;
  if (infos?.MaxSearchResults !== undefined) out.maxSearchResults = infos.MaxSearchResults;
  if (infos?.ShopKey !== undefined) out.shopKey = infos.ShopKey;
  if (infos?.SearchLatitude !== undefined) out.searchLatitude = infos.SearchLatitude;
  if (infos?.SearchLongitude !== undefined) out.searchLongitude = infos.SearchLongitude;

  if (rs.ApplicationResults !== undefined) {
    const ar = mapApplicationResults(rs.ApplicationResults);
    if (ar !== undefined) out.applicationResults = ar;
  }

  return out;
}

type GeneratedHotelAvailInfo = NonNullable<
  NonNullable<components['schemas']['HotelAvailInfos']>['HotelAvailInfo']
>[number];

function mapHotels(items: GeneratedHotelAvailInfo[] | undefined): AvailHotel[] {
  if (items === undefined) return [];
  return items.map(mapHotel);
}

function mapHotel(item: GeneratedHotelAvailInfo): AvailHotel {
  const info = item.HotelInfo;
  const hotel: AvailHotel = {
    code: info.HotelCode,
    codeContext: info.CodeContext,
  };
  if (info.SabreHotelCode !== undefined) hotel.sabreCode = info.SabreHotelCode;
  if (info.HotelName !== undefined) hotel.name = info.HotelName;
  if (info.ChainCode !== undefined) hotel.chainCode = info.ChainCode;
  if (info.ChainName !== undefined) hotel.chainName = info.ChainName;
  if (info.BrandCode !== undefined) hotel.brandCode = info.BrandCode;
  if (info.BrandName !== undefined) hotel.brandName = info.BrandName;
  if (info.Distance !== undefined) hotel.distance = info.Distance;
  if (info.Direction !== undefined) hotel.direction = info.Direction;
  if (info.UOM !== undefined) hotel.distanceUnit = info.UOM;
  if (info.Logo !== undefined) hotel.logo = info.Logo;
  if (info.SabreRating !== undefined) hotel.sabreRating = info.SabreRating;
  if (info.CanReturnRequestedNegotiatedRate !== undefined) {
    hotel.canReturnRequestedNegotiatedRate = info.CanReturnRequestedNegotiatedRate;
  }
  if (info.Ordinal !== undefined) hotel.ordinal = info.Ordinal;
  if (info.TierLabels?.TierLabel !== undefined) {
    hotel.tierLabels = info.TierLabels.TierLabel.map(mapTierLabel);
  }
  if (info.LocationInfo !== undefined) {
    const loc = mapLocation(info.LocationInfo);
    if (loc !== undefined) hotel.location = loc;
  }
  if (info.Amenities?.Amenity !== undefined) {
    hotel.amenities = info.Amenities.Amenity.map(mapAmenity);
  }
  if (info.SecurityFeatures?.SecurityFeature !== undefined) {
    hotel.securityFeatures = info.SecurityFeatures.SecurityFeature.map(mapSecurityFeature);
  }
  if (info.PropertyTypeInfo?.PropertyType !== undefined) {
    hotel.propertyTypes = info.PropertyTypeInfo.PropertyType.map(mapPropertyType);
  }
  if (info.PropertyQualityInfo?.PropertyQuality !== undefined) {
    hotel.propertyQualities = info.PropertyQualityInfo.PropertyQuality.map(mapPropertyQuality);
  }
  if (item.HotelRateInfo !== undefined) {
    const rateInfo = mapRateInfo(item.HotelRateInfo);
    if (rateInfo !== undefined) hotel.rateInfo = rateInfo;
  }
  return hotel;
}

function mapTierLabel(t: NonNullable<components['schemas']['TierLabel']>[number]): AvailTierLabel {
  const out: AvailTierLabel = {};
  if (t.Type !== undefined) out.type = t.Type;
  if (t.Value !== undefined) out.value = t.Value;
  if (t.ProgramId !== undefined) out.programId = t.ProgramId;
  return out;
}

function mapLocation(
  loc: NonNullable<components['schemas']['LocationInfo']>,
): AvailLocation | undefined {
  const out: AvailLocation = {};
  if (loc.Latitude !== undefined) out.latitude = loc.Latitude;
  if (loc.Longitude !== undefined) out.longitude = loc.Longitude;
  if (loc.Address !== undefined) {
    const a = loc.Address;
    const addr: NonNullable<AvailLocation['address']> = {};
    if (a.AddressLine1 !== undefined) addr.addressLine1 = a.AddressLine1;
    if (a.AddressLine2 !== undefined) addr.addressLine2 = a.AddressLine2;
    if (a.AddressLine3 !== undefined) addr.addressLine3 = a.AddressLine3;
    if (a.CityName !== undefined) {
      const city: NonNullable<NonNullable<AvailLocation['address']>['city']> = {};
      if (a.CityName.CityCode !== undefined) city.code = a.CityName.CityCode;
      if (a.CityName.value !== undefined) city.name = a.CityName.value;
      if (Object.keys(city).length > 0) addr.city = city;
    }
    if (a.StateProv !== undefined) {
      const sp: NonNullable<NonNullable<AvailLocation['address']>['stateProv']> = {};
      if (a.StateProv.StateCode !== undefined) sp.code = a.StateProv.StateCode;
      if (a.StateProv.value !== undefined) sp.name = a.StateProv.value;
      if (Object.keys(sp).length > 0) addr.stateProv = sp;
    }
    if (a.PostalCode !== undefined) addr.postalCode = a.PostalCode;
    if (a.CountryName !== undefined) {
      const country: NonNullable<NonNullable<AvailLocation['address']>['country']> = {};
      if (a.CountryName.Code !== undefined) country.code = a.CountryName.Code;
      if (a.CountryName.value !== undefined) country.name = a.CountryName.value;
      if (Object.keys(country).length > 0) addr.country = country;
    }
    if (Object.keys(addr).length > 0) out.address = addr;
  }
  if (loc.Neighborhoods?.Neighborhood !== undefined) {
    out.neighborhoods = loc.Neighborhoods.Neighborhood.map(mapNeighborhood);
  }
  if (loc.Contact !== undefined) {
    const contact = mapContact(loc.Contact);
    if (contact !== undefined) out.contact = contact;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function mapNeighborhood(
  n: NonNullable<components['schemas']['Neighborhood']>[number],
): AvailNeighborhood {
  const out: AvailNeighborhood = {};
  if (n.Id !== undefined) out.id = n.Id;
  if (n.value !== undefined) out.name = n.value;
  return out;
}

function mapContact(c: NonNullable<components['schemas']['Contact']>): AvailContact | undefined {
  const out: AvailContact = {};
  if (c.Phone !== undefined) out.phone = c.Phone;
  if (c.Fax !== undefined) out.fax = c.Fax;
  return Object.keys(out).length > 0 ? out : undefined;
}

function mapAmenity(a: NonNullable<components['schemas']['Amenity']>[number]): AvailAmenity {
  const out: AvailAmenity = {};
  if (a.Code !== undefined) out.code = a.Code;
  if (a.Description !== undefined) out.description = a.Description;
  if (a.ComplimentaryInd !== undefined) out.complimentary = a.ComplimentaryInd;
  if (a.value !== undefined) out.value = a.value;
  return out;
}

function mapSecurityFeature(
  s: NonNullable<components['schemas']['SecurityFeature']>[number],
): AvailSecurityFeature {
  const out: AvailSecurityFeature = {};
  if (s.Code !== undefined) out.code = s.Code;
  if (s.Description !== undefined) out.description = s.Description;
  if (s.value !== undefined) out.value = s.value;
  return out;
}

function mapPropertyType(
  p: NonNullable<components['schemas']['PropertyType']>[number],
): AvailPropertyType {
  const out: AvailPropertyType = {};
  if (p.Code !== undefined) out.code = p.Code;
  if (p.Description !== undefined) out.description = p.Description;
  return out;
}

function mapPropertyQuality(
  p: NonNullable<components['schemas']['PropertyQuality']>[number],
): AvailPropertyQuality {
  const out: AvailPropertyQuality = {};
  if (p.Code !== undefined) out.code = p.Code;
  if (p.Description !== undefined) out.description = p.Description;
  return out;
}

function mapRateInfo(
  hri: NonNullable<components['schemas']['HotelRateInfo']>,
): AvailHotelRateInfo | undefined {
  const out: AvailHotelRateInfo = {};
  if (hri.RateRanges?.RateRange !== undefined) {
    out.rateRanges = hri.RateRanges.RateRange.map(mapRateRange);
  }
  if (hri.RateInfos !== undefined) {
    if (hri.RateInfos.RateInfo !== undefined) {
      out.rateInfo = hri.RateInfos.RateInfo.map(mapRateEntry);
    }
    if (hri.RateInfos.ConvertedRateInfo !== undefined) {
      out.convertedRateInfo = hri.RateInfos.ConvertedRateInfo.map(mapRateEntry);
    }
  }
  if (hri.Rooms?.Room !== undefined) {
    out.rooms = hri.Rooms.Room.map(mapRoom);
  }
  if (hri.AvailableRatePlans?.AvailableRatePlan !== undefined) {
    out.availableRatePlans = hri.AvailableRatePlans.AvailableRatePlan.map(mapAvailableRatePlan);
  }
  if (hri.RateUnavailability !== undefined) {
    out.unavailability = mapUnavailability(hri.RateUnavailability);
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function mapRateRange(
  r: NonNullable<components['schemas']['RateRangeType']>[number],
): AvailRateRangeEntry {
  const out: AvailRateRangeEntry = {};
  if (r.MinRate !== undefined) out.minRate = r.MinRate;
  if (r.MaxRate !== undefined) out.maxRate = r.MaxRate;
  if (r.CurrencyCode !== undefined) out.currencyCode = r.CurrencyCode;
  if (r.ConvertedMinRate !== undefined) out.convertedMinRate = r.ConvertedMinRate;
  if (r.ConvertedMaxRate !== undefined) out.convertedMaxRate = r.ConvertedMaxRate;
  if (r.ConvertedCurrencyCode !== undefined) out.convertedCurrencyCode = r.ConvertedCurrencyCode;
  if (r.RateSource !== undefined) out.rateSource = r.RateSource;
  return out;
}

type GeneratedRateInfoEntry = NonNullable<
  NonNullable<components['schemas']['RateInfos']>['RateInfo']
>[number];

function mapRateEntry(r: GeneratedRateInfoEntry): AvailRateEntry {
  const out: AvailRateEntry = {};
  if (r.StartDate !== undefined) out.startDate = r.StartDate;
  if (r.EndDate !== undefined) out.endDate = r.EndDate;
  if (r.AmountBeforeTax !== undefined) out.amountBeforeTax = r.AmountBeforeTax;
  if (r.AmountAfterTax !== undefined) out.amountAfterTax = r.AmountAfterTax;
  if (r.MinSellingRate !== undefined) out.minSellingRate = r.MinSellingRate;
  if (r.AverageNightlyRate !== undefined) out.averageNightlyRate = r.AverageNightlyRate;
  if (r.AverageNightlyRateBeforeTax !== undefined) {
    out.averageNightlyRateBeforeTax = r.AverageNightlyRateBeforeTax;
  }
  if (r.HighestNightlyRate !== undefined) out.highestNightlyRate = r.HighestNightlyRate;
  if (r.ApproxTotalPrice !== undefined) out.approxTotalPrice = r.ApproxTotalPrice;
  if (r.CurrencyCode !== undefined) out.currencyCode = r.CurrencyCode;
  if (r.AdditionalFeesInclusive !== undefined)
    out.additionalFeesInclusive = r.AdditionalFeesInclusive;
  if (r.TaxInclusive !== undefined) out.taxInclusive = r.TaxInclusive;
  if (r.LocalFeesInclusive !== undefined) out.localFeesInclusive = r.LocalFeesInclusive;
  if (r.IncidentalsInclusive !== undefined) out.incidentalsInclusive = r.IncidentalsInclusive;
  if (r.RateSource !== undefined) out.rateSource = r.RateSource;
  if (r.RateKey !== undefined) out.rateKey = r.RateKey;
  if (r.Commission !== undefined) out.commission = mapCommission(r.Commission);
  return out;
}

function mapCommission(c: NonNullable<components['schemas']['Commission']>): AvailCommission {
  const out: AvailCommission = {};
  if (c.Percent !== undefined) out.percent = c.Percent;
  if (c.Amount !== undefined) out.amount = c.Amount;
  if (c.CurrencyCode !== undefined) out.currencyCode = c.CurrencyCode;
  if (c.Type !== undefined) out.type = c.Type;
  if (c.CommissionDescription?.Text !== undefined)
    out.description = [...c.CommissionDescription.Text];
  return out;
}

function mapAvailableRatePlan(
  p: NonNullable<components['schemas']['AvailableRatePlan']>[number],
): AvailAvailableRatePlan {
  const out: AvailAvailableRatePlan = {};
  if (p.RatePlanCode !== undefined) out.ratePlanCode = p.RatePlanCode;
  if (p.RatePlanType !== undefined) out.ratePlanType = p.RatePlanType;
  if (p.RatePlanTypeDescription !== undefined) {
    out.ratePlanTypeDescription = p.RatePlanTypeDescription;
  }
  if (p.ClientId !== undefined) out.clientId = p.ClientId;
  if (p.RateSource !== undefined) out.rateSource = p.RateSource;
  return out;
}

function mapUnavailability(
  u: NonNullable<components['schemas']['RateUnavailability']>,
): AvailRateUnavailability {
  return {
    sources: u.RateSource.map((s) => {
      const src: AvailRateUnavailability['sources'][number] = {
        source: s.Source,
        reason: s.Reason,
      };
      if (s.DisplayMessage !== undefined) src.displayMessage = s.DisplayMessage;
      return src;
    }),
  };
}

type GeneratedRoom = NonNullable<components['schemas']['response.Room']>[number];

function mapRoom(r: GeneratedRoom): AvailRoom {
  const out: AvailRoom = {
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
  if (r.SharedRoomInd !== undefined) out.sharedRoomInd = r.SharedRoomInd;
  if (r.Adults !== undefined) out.adults = r.Adults;
  if (r.Children !== undefined) out.children = r.Children;
  if (r.BedTypeOptions?.BedTypes !== undefined) {
    out.bedTypes = r.BedTypeOptions.BedTypes.flatMap((bt) => (bt.BedType ?? []).map(mapBedType));
  }
  if (r.RoomDescription !== undefined) out.roomDescription = mapRoomDescription(r.RoomDescription);
  if (r.AdditionalDetails?.AdditionalDetail !== undefined) {
    out.additionalDetails = r.AdditionalDetails.AdditionalDetail.map(mapAdditionalDetail);
  }
  if (r.Amenities?.Amenity !== undefined) {
    out.amenities = r.Amenities.Amenity.map(mapAmenityAsRoom);
  }
  if (r.AccessibleAmenities?.Amenity !== undefined) {
    out.accessibleAmenities = r.AccessibleAmenities.Amenity.map(mapAmenityAsRoom);
  }
  if (r.Occupancy !== undefined) out.occupancy = mapOccupancy(r.Occupancy);
  return out;
}

function mapBedType(bt: NonNullable<components['schemas']['BedType']>[number]): AvailBedType {
  const out: AvailBedType = {};
  if (bt.Code !== undefined) out.code = bt.Code;
  if (bt.Description !== undefined) out.description = bt.Description;
  if (bt.Count !== undefined) out.count = bt.Count;
  return out;
}

function mapRoomDescription(
  rd: NonNullable<components['schemas']['RoomDescription']>,
): AvailRoomDescription {
  const out: AvailRoomDescription = {};
  if (rd.Name !== undefined) out.name = rd.Name;
  if (rd.Text !== undefined) out.text = [...rd.Text];
  return out;
}

function mapAdditionalDetail(
  d: NonNullable<components['schemas']['AdditionalDetail']>[number],
): AvailAdditionalDetail {
  const out: AvailAdditionalDetail = {};
  if (d.Code !== undefined) out.code = d.Code;
  if (d.Description !== undefined) out.description = d.Description;
  if (d.Amount !== undefined) out.amount = d.Amount;
  if (d.CurrencyCode !== undefined) out.currencyCode = d.CurrencyCode;
  if (d.Text !== undefined) out.text = [...d.Text];
  return out;
}

function mapAmenityAsRoom(
  a: NonNullable<components['schemas']['Amenity']>[number],
): AvailRoomAmenity {
  const out: AvailRoomAmenity = {};
  if (a.Code !== undefined) out.code = a.Code;
  if (a.Description !== undefined) out.description = a.Description;
  if (a.ComplimentaryInd !== undefined) out.complimentary = a.ComplimentaryInd;
  if (a.value !== undefined) out.value = a.value;
  return out;
}

function mapOccupancy(o: NonNullable<components['schemas']['Occupancy']>): AvailOccupancy {
  const out: AvailOccupancy = {};
  if (o.Min !== undefined) out.min = o.Min;
  if (o.Max !== undefined) out.max = o.Max;
  return out;
}

type GeneratedRatePlan = NonNullable<components['schemas']['RatePlan']>[number];

function mapRatePlan(rp: GeneratedRatePlan): AvailRatePlan {
  const out: AvailRatePlan = {
    prepaidIndicator: rp.PrepaidIndicator,
    rateSource: rp.RateSource,
    rateKey: rp.RateKey,
  };
  if (rp.RatePlanName !== undefined) out.ratePlanName = rp.RatePlanName;
  if (rp.RatePlanCode !== undefined) out.ratePlanCode = rp.RatePlanCode;
  if (rp.RatePlanType !== undefined) out.ratePlanType = rp.RatePlanType;
  if (rp.RatePlanTypeDescription !== undefined) {
    out.ratePlanTypeDescription = rp.RatePlanTypeDescription;
  }
  if (rp.AvailableQuantity !== undefined) out.availableQuantity = rp.AvailableQuantity;
  if (rp.LimitedAvailability !== undefined) out.limitedAvailability = rp.LimitedAvailability;
  if (rp.ClientId !== undefined) out.clientId = rp.ClientId;
  if (rp.ProductCode !== undefined) out.productCode = rp.ProductCode;
  if (rp.LoyaltyId !== undefined) out.loyaltyId = rp.LoyaltyId;
  if (rp.Ordinal !== undefined) out.ordinal = String(rp.Ordinal);
  if (rp.RatePlanDescription?.Text !== undefined)
    out.description = [...rp.RatePlanDescription.Text];
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
  i: NonNullable<components['schemas']['RatePlanInclusion']>[number],
): AvailRatePlanInclusion {
  const out: AvailRatePlanInclusion = {};
  if (i.Code !== undefined) out.code = i.Code;
  if (i.Description !== undefined) out.description = i.Description;
  if (i.Text !== undefined) out.text = [...i.Text];
  return out;
}

function mapMeals(m: NonNullable<components['schemas']['MealsIncluded']>): AvailMealsIncluded {
  const out: AvailMealsIncluded = {};
  if (m.BreakFast !== undefined) out.breakfast = m.BreakFast;
  if (m.Lunch !== undefined) out.lunch = m.Lunch;
  if (m.Dinner !== undefined) out.dinner = m.Dinner;
  if (m.MealPlanIndicator !== undefined) out.mealPlanIndicator = m.MealPlanIndicator;
  if (m.MealPlanCode !== undefined) out.mealPlanCode = m.MealPlanCode;
  if (m.MealPlanDescription !== undefined) out.mealPlanDescription = m.MealPlanDescription;
  if (m.GuestCount !== undefined) out.guestCount = m.GuestCount;
  return out;
}

// `Room.RateInfo` is not a named schema in get-hotel-avail's OAS; the
// rate detail is inlined on `RatePlan.RateInfo` / `RatePlan.ConvertedRateInfo`.
// Extract the expected shape via indexed access so the mapper stays
// type-safe without a named reference.
type GeneratedRoomRateInfo = NonNullable<GeneratedRatePlan['RateInfo']>;

function mapRoomRateInfo(rri: GeneratedRoomRateInfo): AvailRoomRateInfo {
  const out: AvailRoomRateInfo = {
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
  if (rri.AdditionalFeesInclusive !== undefined)
    out.additionalFeesInclusive = rri.AdditionalFeesInclusive;
  if (rri.TaxInclusive !== undefined) out.taxInclusive = rri.TaxInclusive;
  if (rri.LocalFeesInclusive !== undefined) out.localFeesInclusive = rri.LocalFeesInclusive;
  if (rri.IncidentalsInclusive !== undefined) out.incidentalsInclusive = rri.IncidentalsInclusive;
  if (rri.Rates?.Rate !== undefined) out.rates = rri.Rates.Rate.map(mapNightlyRate);
  if (rri.Taxes !== undefined) {
    const t = mapTaxes(rri.Taxes);
    if (t !== undefined) out.taxes = t;
  }
  if (rri.Fees !== undefined) {
    const f = mapFees(rri.Fees);
    if (f !== undefined) out.fees = f;
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

function mapNightlyRate(r: NonNullable<components['schemas']['NightlyRate']>[number]): AvailRate {
  const out: AvailRate = {};
  if (r.StartDate !== undefined) out.startDate = r.StartDate;
  if (r.EndDate !== undefined) out.endDate = r.EndDate;
  if (r.AmountBeforeTax !== undefined) out.amountBeforeTax = r.AmountBeforeTax;
  if (r.AmountAfterTax !== undefined) out.amountAfterTax = r.AmountAfterTax;
  if (r.CurrencyCode !== undefined) out.currencyCode = r.CurrencyCode;
  return out;
}

function mapTaxes(t: NonNullable<components['schemas']['Taxes']>): AvailTaxes | undefined {
  const out: AvailTaxes = {};
  if (t.Amount !== undefined) out.amount = t.Amount;
  if (t.CurrencyCode !== undefined) out.currencyCode = t.CurrencyCode;
  if (t.Tax !== undefined) out.taxes = t.Tax.map(mapTax);
  if (t.TaxGroups?.TaxGroup !== undefined) out.taxGroups = t.TaxGroups.TaxGroup.map(mapTaxGroup);
  return Object.keys(out).length > 0 ? out : undefined;
}

function mapTax(t: NonNullable<components['schemas']['Tax']>[number]): AvailTax {
  const out: AvailTax = { amount: t.Amount, currencyCode: t.CurrencyCode };
  if (t.StartDate !== undefined) out.startDate = t.StartDate;
  if (t.EndDate !== undefined) out.endDate = t.EndDate;
  return out;
}

function mapTaxGroup(g: NonNullable<components['schemas']['TaxGroup']>[number]): AvailTaxGroup {
  const out: AvailTaxGroup = { code: g.Code, amount: g.Amount, currencyCode: g.CurrencyCode };
  if (g.Description !== undefined) out.description = g.Description;
  if (g.TaxDescription?.Text !== undefined) out.descriptionText = [...g.TaxDescription.Text];
  return out;
}

function mapFees(f: NonNullable<components['schemas']['Fees']>): AvailFees | undefined {
  const out: AvailFees = {};
  if (f.Amount !== undefined) out.amount = f.Amount;
  if (f.CurrencyCode !== undefined) out.currencyCode = f.CurrencyCode;
  if (f.Fee !== undefined) out.fees = f.Fee.map(mapFee);
  if (f.FeeGroups?.FeeGroup !== undefined) out.feeGroups = f.FeeGroups.FeeGroup.map(mapFeeGroup);
  return Object.keys(out).length > 0 ? out : undefined;
}

function mapFee(f: NonNullable<components['schemas']['Fee']>[number]): AvailFee {
  const out: AvailFee = { amount: f.Amount, currencyCode: f.CurrencyCode };
  if (f.StartDate !== undefined) out.startDate = f.StartDate;
  if (f.EndDate !== undefined) out.endDate = f.EndDate;
  return out;
}

function mapFeeGroup(g: NonNullable<components['schemas']['FeeGroup']>[number]): AvailFeeGroup {
  const out: AvailFeeGroup = { code: g.Code, amount: g.Amount, currencyCode: g.CurrencyCode };
  if (g.Description !== undefined) out.description = g.Description;
  if (g.FeeDescription?.Text !== undefined) out.descriptionText = [...g.FeeDescription.Text];
  return out;
}

function mapRoomExtra(e: NonNullable<components['schemas']['RoomExtra']>[number]): AvailRoomExtra {
  const out: AvailRoomExtra = {};
  if (e.Code !== undefined) out.code = e.Code;
  if (e.Description !== undefined) out.description = e.Description;
  if (e.Amount !== undefined) out.amount = e.Amount;
  if (e.CurrencyCode !== undefined) out.currencyCode = e.CurrencyCode;
  if (e.Text !== undefined) out.text = [...e.Text];
  return out;
}

function mapCancelPenalty(
  p: NonNullable<components['schemas']['CancelPenalty']>[number],
): AvailCancelPenalty {
  const out: AvailCancelPenalty = { refundable: p.Refundable };
  if (p.Deadline !== undefined) out.deadline = mapDeadline(p.Deadline);
  if (p.AmountPercent !== undefined) out.amountPercent = mapAmountPercent(p.AmountPercent);
  if (p.PenaltyDescription !== undefined) {
    out.descriptionText = [...p.PenaltyDescription.Text];
  }
  return out;
}

function mapDeadline(d: NonNullable<components['schemas']['Deadline']>): AvailDeadline {
  const out: AvailDeadline = {};
  if (d.AbsoluteDeadline !== undefined) out.absoluteDeadline = d.AbsoluteDeadline;
  if (d.OffsetTimeUnit !== undefined) out.offsetTimeUnit = d.OffsetTimeUnit;
  if (d.OffsetUnitMultiplier !== undefined) out.offsetUnitMultiplier = d.OffsetUnitMultiplier;
  if (d.OffsetDropTime !== undefined) {
    out.offsetDropTime = d.OffsetDropTime as AvailDeadline['offsetDropTime'];
  }
  return out;
}

function mapAmountPercent(
  a: NonNullable<components['schemas']['AmountPercent']>,
): AvailAmountPercent {
  const out: AvailAmountPercent = {};
  if (a.TaxInclusive !== undefined) out.taxInclusive = a.TaxInclusive;
  if (a.FeesInclusive !== undefined) out.feesInclusive = a.FeesInclusive;
  if (a.NmbrOfNights !== undefined) out.numberOfNights = a.NmbrOfNights;
  if (a.Percent !== undefined) out.percent = a.Percent;
  if (a.Amount !== undefined) out.amount = a.Amount;
  if (a.CurrencyCode !== undefined) out.currencyCode = a.CurrencyCode;
  return out;
}

function mapGuarantee(g: NonNullable<components['schemas']['Guarantee']>): AvailGuarantee {
  const out: AvailGuarantee = {
    accepted: g.GuaranteesAccepted.GuaranteeAccepted.map(mapGuaranteeAccepted),
  };
  if (g.GuaranteeType !== undefined) out.guaranteeType = g.GuaranteeType;
  if (g.DepositPolicies?.DepositPolicy !== undefined) {
    out.depositPolicies = g.DepositPolicies.DepositPolicy.map(mapDepositPolicy);
  }
  if (g.GuaranteeDescription?.Text !== undefined)
    out.descriptionText = [...g.GuaranteeDescription.Text];
  return out;
}

function mapGuaranteeAccepted(
  ga: NonNullable<
    NonNullable<components['schemas']['GuaranteesAccepted']>['GuaranteeAccepted']
  >[number],
): AvailGuaranteeAccepted {
  const out: AvailGuaranteeAccepted = {};
  if (ga.GuaranteeTypeCode !== undefined) out.typeCode = ga.GuaranteeTypeCode;
  if (ga.GuaranteeTypeDescription !== undefined) out.typeDescription = ga.GuaranteeTypeDescription;
  if (ga.PaymentCards !== undefined) {
    const cards: AvailPaymentCard[] = (ga.PaymentCards.PaymentCard ?? []).map((c) => {
      const card: AvailPaymentCard = { code: c.CardCode };
      if (c.value !== undefined) card.value = c.value;
      return card;
    });
    const list: NonNullable<AvailGuaranteeAccepted['paymentCards']> = { cards };
    if (ga.PaymentCards.CVVRequired !== undefined) list.cvvRequired = ga.PaymentCards.CVVRequired;
    out.paymentCards = list;
  }
  return out;
}

function mapDepositPolicy(
  dp: NonNullable<components['schemas']['DepositPolicy']>[number],
): AvailDepositPolicy {
  const out: AvailDepositPolicy = {};
  if (dp.Deadline !== undefined) out.deadline = mapDeadline(dp.Deadline);
  if (dp.AmountPercent !== undefined) out.amountPercent = mapAmountPercent(dp.AmountPercent);
  return out;
}

function mapApplicationResults(
  ar: NonNullable<components['schemas']['ApplicationResults']>,
): AvailApplicationResults | undefined {
  const out: AvailApplicationResults = {};
  if (ar.status !== undefined) out.status = ar.status as AvailApplicationResults['status'];
  if (ar.Success !== undefined) out.success = ar.Success.map(mapElement);
  if (ar.Error !== undefined) out.errors = ar.Error.map(mapElement);
  if (ar.Warning !== undefined) out.warnings = ar.Warning.map(mapElement);
  return Object.keys(out).length > 0 ? out : undefined;
}

function mapElement(
  e: NonNullable<components['schemas']['ElementStructure']>[number],
): AvailApplicationResultEntry {
  const out: AvailApplicationResultEntry = {};
  if (e.type !== undefined) out.type = e.type;
  if (e.timeStamp !== undefined) out.timeStamp = e.timeStamp;
  if (e.SystemSpecificResults !== undefined) {
    out.systemSpecificResults = e.SystemSpecificResults.map(mapSystemSpecificResult);
  }
  return out;
}

type GeneratedSystemSpecificResult = NonNullable<
  NonNullable<components['schemas']['ElementStructure']>[number]['SystemSpecificResults']
>[number];

function mapSystemSpecificResult(r: GeneratedSystemSpecificResult): AvailSystemSpecificResult {
  const out: AvailSystemSpecificResult = {};
  if (r.timeStamp !== undefined) out.timeStamp = r.timeStamp;
  if (r.reference !== undefined) out.reference = r.reference;
  if (r.HostCommand !== undefined) {
    if (r.HostCommand.LNIATA !== undefined) {
      out.hostCommand = { lniata: r.HostCommand.LNIATA };
    }
  }
  if (r.Message !== undefined) {
    out.messages = r.Message.map((m) => {
      const msg: { code?: string; value?: string } = {};
      if (m.code !== undefined) msg.code = m.code;
      if (m.value !== undefined) msg.value = m.value;
      return msg;
    });
  }
  return out;
}
