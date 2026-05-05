import { SabreParseError } from '../../errors/sabre-parse-error.js';
import type { components } from '../../generated/hotel-search.js';
import { ensureTrailingSlash } from '../../http/ensure-trailing-slash.js';
import type { SabreRequest, SabreResponse } from '../../http/types.js';
import type {
  GeoRef,
  Hotel,
  HotelAddress,
  HotelAmenity,
  HotelApplicationResultEntry,
  HotelApplicationResults,
  HotelCityName,
  HotelCodeFilter,
  HotelContact,
  HotelCountryName,
  HotelImage,
  HotelImageAdditionalInfo,
  HotelImageCategory,
  HotelImageFile,
  HotelLocalizedText,
  HotelLocation,
  HotelNeighborhood,
  HotelPreferences,
  HotelPropertyQuality,
  HotelPropertyType,
  HotelSecurityFeature,
  HotelStateProv,
  HotelSystemSpecificResult,
  HotelTierLabel,
  SearchHotelsInput,
  SearchHotelsOutput,
} from './types.js';

const PATH = 'v2.0.0/hotel/search';

/**
 * Builds the outgoing {@link SabreRequest} for the `hotelSearch` operation.
 *
 * The request body is the `HotelSearchRQ` envelope. The mapper constructs
 * it as a plain object literal so consumers never see Sabre's PascalCase
 * naming, and so we only send fields the consumer actually provided —
 * Sabre's documented defaults (e.g., `SortBy: TotalRate`, `TierLabels:
 * true`) are not invented on the consumer's behalf.
 */
export function toSearchRequest(baseUrl: string, input: SearchHotelsInput): SabreRequest {
  const url = new URL(PATH, ensureTrailingSlash(baseUrl));

  const searchCriteria: Record<string, unknown> = {
    GeoSearch: buildGeoSearch(input.geoSearch.geoRef, input.geoSearch.attributes),
  };
  if (input.maxResults !== undefined) searchCriteria.MaxResults = input.maxResults;
  if (input.sortBy !== undefined) searchCriteria.SortBy = input.sortBy;
  if (input.sortOrder !== undefined) searchCriteria.SortOrder = input.sortOrder;
  if (input.tierLabels !== undefined) searchCriteria.TierLabels = input.tierLabels;
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
  if (input.pos !== undefined) {
    rq.POS = { Source: { PseudoCityCode: input.pos.pseudoCityCode } };
  }

  return {
    method: 'POST',
    url: url.toString(),
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ HotelSearchRQ: rq }),
  };
}

function buildGeoSearch(
  geoRef: GeoRef,
  attributes: SearchHotelsInput['geoSearch']['attributes'],
): Record<string, unknown> {
  const ref: Record<string, unknown> = {
    Radius: geoRef.radius,
    UOM: geoRef.uom,
  };
  if (geoRef.kind === 'geoCode') {
    ref.GeoCode = { Latitude: geoRef.latitude, Longitude: geoRef.longitude };
  } else if (geoRef.kind === 'refPoint') {
    const rp: Record<string, unknown> = {
      RefPointType: geoRef.refPointType,
      Value: geoRef.value,
      ValueContext: geoRef.valueContext,
    };
    if (geoRef.stateProv !== undefined) rp.StateProv = geoRef.stateProv;
    if (geoRef.countryCode !== undefined) rp.CountryCode = geoRef.countryCode;
    ref.RefPoint = rp;
  } else {
    const ar: Record<string, unknown> = { CountryCode: geoRef.countryCode };
    if (geoRef.street !== undefined) ar.Street = geoRef.street;
    if (geoRef.city !== undefined) ar.City = geoRef.city;
    if (geoRef.county !== undefined) ar.County = geoRef.county;
    if (geoRef.postalCode !== undefined) ar.PostalCode = geoRef.postalCode;
    if (geoRef.stateProv !== undefined) ar.StateProv = geoRef.stateProv;
    ref.AddressRef = ar;
  }

  const geoSearch: Record<string, unknown> = { GeoRef: ref };
  if (attributes !== undefined && attributes.length > 0) {
    geoSearch.GeoAttributes = {
      Attributes: attributes.map((a) => ({ Name: a.name, Value: a.value })),
    };
  }
  return geoSearch;
}

function buildHotelPref(pref: HotelPreferences): Record<string, unknown> | undefined {
  const out: Record<string, unknown> = {};
  if (pref.hotelName !== undefined) out.HotelName = pref.hotelName;
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

function buildCodeFilter(filter: HotelCodeFilter, codeKey: string): Record<string, unknown> {
  const out: Record<string, unknown> = { [codeKey]: [...filter.codes] };
  if (filter.inclusive !== undefined) out.Inclusive = filter.inclusive;
  return out;
}

/**
 * Parses the `hotelSearch` response into the public output shape.
 *
 * Every hotel record Sabre returned is preserved; undercooked records (no
 * name, no address, etc.) are not filtered out — that decision belongs in
 * the consumer's code. Throws {@link SabreParseError} only when the body
 * fundamentally is not a Sabre response.
 */
export function fromSearchResponse(res: SabreResponse): SearchHotelsOutput {
  let parsed: components['schemas']['HotelSearchResponse'];
  try {
    parsed = JSON.parse(res.body) as components['schemas']['HotelSearchResponse'];
  } catch (err) {
    throw new SabreParseError('Failed to parse Hotel Search response as JSON', res.body, {
      cause: err,
    });
  }

  if (parsed === null || typeof parsed !== 'object') {
    throw new SabreParseError('Hotel Search response was not a JSON object', parsed);
  }

  const rs = parsed.HotelSearchRS;
  if (rs === undefined || rs === null || typeof rs !== 'object') {
    throw new SabreParseError('Hotel Search response was missing `HotelSearchRS`', parsed);
  }

  const infos = rs.HotelSearchInfos;
  const out: SearchHotelsOutput = {
    hotels: mapHotels(infos?.HotelSearchInfo),
  };

  if (infos?.MaxSearchResults !== undefined) out.maxSearchResults = infos.MaxSearchResults;
  if (infos?.SearchLatitude !== undefined) out.searchLatitude = infos.SearchLatitude;
  if (infos?.SearchLongitude !== undefined) out.searchLongitude = infos.SearchLongitude;

  if (rs.ApplicationResults !== undefined) {
    const mapped = mapApplicationResults(rs.ApplicationResults);
    if (mapped !== undefined) out.applicationResults = mapped;
  }

  return out;
}

type GeneratedHotelSearchInfoItem = NonNullable<components['schemas']['HotelSearchInfo']>[number];

function mapHotels(items: GeneratedHotelSearchInfoItem[] | undefined): Hotel[] {
  if (items === undefined) return [];
  return items.map(mapHotel);
}

function mapHotel(item: GeneratedHotelSearchInfoItem): Hotel {
  const info = item.HotelInfo;
  const hotel: Hotel = {
    code: info.HotelCode,
    codeContext: info.CodeContext as Hotel['codeContext'],
  };
  if (info.SabreHotelCode !== undefined) hotel.sabreCode = info.SabreHotelCode;
  if (info.HotelName !== undefined) hotel.name = info.HotelName;
  if (info.ChainCode !== undefined) hotel.chainCode = info.ChainCode;
  if (info.ChainName !== undefined) hotel.chainName = info.ChainName;
  if (info.BrandCode !== undefined) hotel.brandCode = info.BrandCode;
  if (info.BrandName !== undefined) hotel.brandName = info.BrandName;
  if (info.Distance !== undefined) hotel.distance = info.Distance;
  if (info.Direction !== undefined) hotel.direction = info.Direction;
  if (info.UOM !== undefined) hotel.distanceUnit = info.UOM as Hotel['distanceUnit'];
  if (info.Logo !== undefined) hotel.logo = info.Logo;
  if (info.SabreRating !== undefined) hotel.sabreRating = info.SabreRating;
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
  if (item.HotelImageInfo?.ImageItem !== undefined) {
    // The OAS declares `HotelImageInfo.ImageItem` as a single object
    // rather than an array. Sabre's runtime may in fact send an array;
    // we mirror the spec here and treat it as a single record so the
    // generated types stay honest. Upgrade to array handling once the
    // spec is corrected or runtime fixtures prove otherwise.
    hotel.images = [mapImage(item.HotelImageInfo.ImageItem)];
  }
  return hotel;
}

function mapTierLabel(t: NonNullable<components['schemas']['TierLabel']>[number]): HotelTierLabel {
  const out: HotelTierLabel = {};
  if (t.Type !== undefined) out.type = t.Type;
  if (t.Value !== undefined) out.value = t.Value;
  if (t.ProgramId !== undefined) out.programId = t.ProgramId;
  return out;
}

function mapLocation(
  loc: NonNullable<components['schemas']['LocationInfo']>,
): HotelLocation | undefined {
  const out: HotelLocation = {};
  if (loc.Latitude !== undefined) out.latitude = loc.Latitude;
  if (loc.Longitude !== undefined) out.longitude = loc.Longitude;
  if (loc.Address !== undefined) {
    const addr = mapAddress(loc.Address);
    if (addr !== undefined) out.address = addr;
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

function mapAddress(a: NonNullable<components['schemas']['Address']>): HotelAddress | undefined {
  const out: HotelAddress = {};
  if (a.AddressLine1 !== undefined) out.addressLine1 = a.AddressLine1;
  if (a.AddressLine2 !== undefined) out.addressLine2 = a.AddressLine2;
  if (a.AddressLine3 !== undefined) out.addressLine3 = a.AddressLine3;
  if (a.CityName !== undefined) {
    const city = mapCityName(a.CityName);
    if (city !== undefined) out.city = city;
  }
  if (a.StateProv !== undefined) {
    const sp = mapStateProv(a.StateProv);
    if (sp !== undefined) out.stateProv = sp;
  }
  if (a.PostalCode !== undefined) out.postalCode = a.PostalCode;
  if (a.CountryName !== undefined) {
    const country = mapCountryName(a.CountryName);
    if (country !== undefined) out.country = country;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function mapCityName(c: NonNullable<components['schemas']['CityName']>): HotelCityName | undefined {
  const out: HotelCityName = {};
  if (c.CityCode !== undefined) out.code = c.CityCode;
  if (c.value !== undefined) out.name = c.value;
  return Object.keys(out).length > 0 ? out : undefined;
}

function mapStateProv(
  s: NonNullable<components['schemas']['StateProv']>,
): HotelStateProv | undefined {
  const out: HotelStateProv = {};
  if (s.StateCode !== undefined) out.code = s.StateCode;
  if (s.value !== undefined) out.name = s.value;
  return Object.keys(out).length > 0 ? out : undefined;
}

function mapCountryName(
  c: NonNullable<components['schemas']['CountryName']>,
): HotelCountryName | undefined {
  const out: HotelCountryName = {};
  if (c.Code !== undefined) out.code = c.Code;
  if (c.value !== undefined) out.name = c.value;
  return Object.keys(out).length > 0 ? out : undefined;
}

function mapNeighborhood(
  n: NonNullable<components['schemas']['Neighborhood']>[number],
): HotelNeighborhood {
  const out: HotelNeighborhood = {};
  if (n.Id !== undefined) out.id = n.Id;
  if (n.value !== undefined) out.name = n.value;
  return out;
}

function mapContact(c: NonNullable<components['schemas']['Contact']>): HotelContact | undefined {
  const out: HotelContact = {};
  if (c.Phone !== undefined) out.phone = c.Phone;
  if (c.Fax !== undefined) out.fax = c.Fax;
  return Object.keys(out).length > 0 ? out : undefined;
}

function mapAmenity(a: NonNullable<components['schemas']['Amenity']>[number]): HotelAmenity {
  const out: HotelAmenity = {};
  if (a.Code !== undefined) out.code = a.Code;
  if (a.Description !== undefined) out.description = a.Description;
  if (a.ComplimentaryInd !== undefined) out.complimentary = a.ComplimentaryInd;
  if (a.value !== undefined) out.value = a.value;
  return out;
}

function mapSecurityFeature(
  s: NonNullable<components['schemas']['SecurityFeature']>[number],
): HotelSecurityFeature {
  const out: HotelSecurityFeature = {};
  if (s.Code !== undefined) out.code = s.Code;
  if (s.Description !== undefined) out.description = s.Description;
  if (s.value !== undefined) out.value = s.value;
  return out;
}

function mapPropertyType(
  p: NonNullable<components['schemas']['PropertyType']>[number],
): HotelPropertyType {
  const out: HotelPropertyType = {};
  if (p.Code !== undefined) out.code = p.Code;
  if (p.Description !== undefined) out.description = p.Description;
  return out;
}

function mapPropertyQuality(
  p: NonNullable<components['schemas']['PropertyQuality']>[number],
): HotelPropertyQuality {
  const out: HotelPropertyQuality = {};
  if (p.Code !== undefined) out.code = p.Code;
  if (p.Description !== undefined) out.description = p.Description;
  return out;
}

function mapImage(i: NonNullable<components['schemas']['ImageItem']>): HotelImage {
  const out: HotelImage = {};
  if (i.Id !== undefined) out.id = i.Id;
  if (i.Ordinal !== undefined) out.ordinal = i.Ordinal;
  if (i.LastModifedDate !== undefined) out.lastModifiedDate = i.LastModifedDate;
  if (i.Format !== undefined) out.format = i.Format as HotelImage['format'];
  if (i.Image !== undefined) {
    const file = mapImageFile(i.Image);
    if (file !== undefined) out.image = file;
  }
  if (i.Category !== undefined) {
    const cat = mapImageCategory(i.Category);
    if (cat !== undefined) out.category = cat;
  }
  if (i.AdditionalInfo?.Info !== undefined) {
    out.additionalInfo = i.AdditionalInfo.Info.map(mapImageAdditionalInfo);
  }
  return out;
}

function mapImageFile(
  img: NonNullable<components['schemas']['Image']>,
): HotelImageFile | undefined {
  const out: HotelImageFile = {};
  if (img.Url !== undefined) out.url = img.Url;
  if (img.Height !== undefined) out.height = img.Height;
  if (img.Width !== undefined) out.width = img.Width;
  if (img.Type !== undefined) out.type = img.Type as HotelImageFile['type'];
  return Object.keys(out).length > 0 ? out : undefined;
}

function mapImageCategory(
  c: NonNullable<components['schemas']['Category']>,
): HotelImageCategory | undefined {
  const out: HotelImageCategory = {};
  if (c.CategoryCode !== undefined) out.code = c.CategoryCode;
  if (c.Description?.Text !== undefined) {
    out.descriptions = c.Description.Text.map(mapLocalizedText);
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function mapImageAdditionalInfo(
  info: NonNullable<components['schemas']['Info']>[number],
): HotelImageAdditionalInfo {
  const out: HotelImageAdditionalInfo = { type: info.Type };
  if (info.Description?.Text !== undefined) {
    out.descriptions = info.Description.Text.map(mapLocalizedText);
  }
  return out;
}

function mapLocalizedText(
  t: NonNullable<NonNullable<components['schemas']['Description']>['Text']>[number],
): HotelLocalizedText {
  const out: HotelLocalizedText = {};
  if (t.Language !== undefined) out.language = t.Language;
  if (t.value !== undefined) out.value = t.value;
  return out;
}

function mapApplicationResults(
  ar: NonNullable<components['schemas']['ApplicationResults']>,
): HotelApplicationResults | undefined {
  const out: HotelApplicationResults = {};
  if (ar.status !== undefined) out.status = ar.status as HotelApplicationResults['status'];
  if (ar.Success !== undefined) out.success = ar.Success.map(mapElement);
  if (ar.Error !== undefined) out.errors = ar.Error.map(mapElement);
  if (ar.Warning !== undefined) out.warnings = ar.Warning.map(mapElement);
  return Object.keys(out).length > 0 ? out : undefined;
}

function mapElement(
  e: NonNullable<components['schemas']['ElementStructure']>[number],
): HotelApplicationResultEntry {
  const out: HotelApplicationResultEntry = {};
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

function mapSystemSpecificResult(r: GeneratedSystemSpecificResult): HotelSystemSpecificResult {
  const out: HotelSystemSpecificResult = {};
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
