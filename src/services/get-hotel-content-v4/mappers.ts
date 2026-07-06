import { SabreParseError } from '../../errors/sabre-parse-error.js';
import type { components } from '../../generated/get-hotel-content.js';
import { ensureTrailingSlash } from '../../http/ensure-trailing-slash.js';
import type { SabreRequest, SabreResponse } from '../../http/types.js';
import type {
  ContentAdditionalInfoFlag,
  ContentAddress,
  ContentApplicationMessage,
  ContentApplicationResultEntry,
  ContentApplicationResults,
  ContentContact,
  ContentDescription,
  ContentDescriptiveInfo,
  ContentDescriptiveInfoRequest,
  ContentHostCommand,
  ContentHotel,
  ContentHotelAmenity,
  ContentHotelInfo,
  ContentImageVariant,
  ContentLocalizedText,
  ContentLocationInfo,
  ContentMediaAdditionalInfo,
  ContentMediaCategory,
  ContentMediaInfo,
  ContentMediaItem,
  ContentMediaRequest,
  ContentNeighborhood,
  ContentPanoramicVariant,
  ContentPolicyText,
  ContentPropertyInfo,
  ContentPropertyQuality,
  ContentPropertyType,
  ContentSecurityFeature,
  ContentSystemSpecificResult,
  ContentTierLabel,
  ContentVideoVariant,
  GetHotelContentInput,
  GetHotelContentOutput,
} from './types.js';

const PATH = 'v4.0.0/get/hotelcontent';

/**
 * Builds the outgoing {@link SabreRequest} for the `getHotelContent`
 * operation.
 *
 * Sabre's spec documents `default:` values on a handful of request fields
 * (`HotelRef.CodeContext`, the `DescriptiveInfoRef` booleans, and
 * `MediaRef.MaxItems`). Following the precedent set by the other hotel
 * services (`get-hotel-details-v5`, `get-hotel-rate-info-v5`,
 * `hotel-price-check-v5`, `get-hotel-avail-v5`), this mapper does **not**
 * auto-send those defaults on the consumer's behalf. Sabre applies them
 * server-side when fields are omitted, so the wire body reflects exactly
 * what the consumer asked for.
 */
export function toGetContentRequest(baseUrl: string, input: GetHotelContentInput): SabreRequest {
  const url = new URL(PATH, ensureTrailingSlash(baseUrl));

  const ref: Record<string, unknown> = { HotelCode: input.hotelRef.code };
  if (input.hotelRef.codeContext !== undefined) ref.CodeContext = input.hotelRef.codeContext;

  const searchCriteria: Record<string, unknown> = { HotelRefs: { HotelRef: ref } };
  if (input.descriptiveInfo !== undefined) {
    const di = buildDescriptiveInfoRef(input.descriptiveInfo);
    if (Object.keys(di).length > 0) searchCriteria.DescriptiveInfoRef = di;
  }
  if (input.media !== undefined) {
    const m = buildMediaRef(input.media);
    if (Object.keys(m).length > 0) searchCriteria.MediaRef = m;
  }

  const rq: Record<string, unknown> = { SearchCriteria: searchCriteria };
  if (input.pointOfSale !== undefined) {
    rq.POS = { Source: { PseudoCityCode: input.pointOfSale.pseudoCityCode } };
  }

  return {
    method: 'POST',
    url: url.toString(),
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ GetHotelContentRQ: rq }),
  };
}

function buildDescriptiveInfoRef(d: ContentDescriptiveInfoRequest): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (d.propertyInfo !== undefined) out.PropertyInfo = d.propertyInfo;
  if (d.locationInfo !== undefined) out.LocationInfo = d.locationInfo;
  if (d.amenities !== undefined) out.Amenities = d.amenities;
  if (d.securityFeatures !== undefined) out.SecurityFeatures = d.securityFeatures;
  if (d.descriptions !== undefined && d.descriptions.length > 0) {
    out.Descriptions = { Description: d.descriptions.map((type) => ({ Type: type })) };
  }
  return out;
}

function buildMediaRef(m: ContentMediaRequest): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (m.maxItems !== undefined) out.MaxItems = m.maxItems;

  const mediaTypes: Record<string, unknown> = {};
  if (m.images !== undefined && m.images.length > 0) {
    mediaTypes.Images = { Image: m.images.map((t) => ({ Type: t })) };
  }
  if (m.panoramicMedias !== undefined && m.panoramicMedias.length > 0) {
    mediaTypes.PanoramicMedias = { PanoramicMedia: m.panoramicMedias.map((t) => ({ Type: t })) };
  }
  if (m.videos !== undefined && m.videos.length > 0) {
    mediaTypes.Videos = { Video: m.videos.map((t) => ({ Type: t })) };
  }
  if (Object.keys(mediaTypes).length > 0) out.MediaTypes = mediaTypes;

  if (m.categories !== undefined && m.categories.length > 0) {
    out.Categories = { Category: m.categories.map((code) => ({ Code: code })) };
  }
  if (m.roomTypeCodes !== undefined && m.roomTypeCodes.length > 0) {
    out.RoomTypeCodes = { RoomTypeCode: m.roomTypeCodes.map((code) => ({ Code: code })) };
  }
  if (m.additionalInfo !== undefined && m.additionalInfo.length > 0) {
    out.AdditionalInfo = { Info: m.additionalInfo.map(buildAdditionalInfoFlag) };
  }
  if (m.languages !== undefined && m.languages.length > 0) {
    out.Languages = { Language: m.languages.map((code) => ({ Code: code })) };
  }
  return out;
}

function buildAdditionalInfoFlag(f: ContentAdditionalInfoFlag): Record<string, unknown> {
  return { Type: f.type, value: f.value };
}

// -----------------------------------------------------------------------------
// Response mappers
// -----------------------------------------------------------------------------

/**
 * Parses the `getHotelContent` response into the public output shape.
 *
 * Every descriptive block, media item, and diagnostic Sabre returned is
 * preserved. Throws {@link SabreParseError} only when the body
 * fundamentally is not a Sabre response.
 */
export function fromGetContentResponse(res: SabreResponse): GetHotelContentOutput {
  let parsed: components['schemas']['GetHotelContentResponse'];
  try {
    parsed = JSON.parse(res.body) as components['schemas']['GetHotelContentResponse'];
  } catch (err) {
    throw new SabreParseError('Failed to parse Get Hotel Content response as JSON', res.body, {
      cause: err,
    });
  }

  if (parsed === null || typeof parsed !== 'object') {
    throw new SabreParseError('Get Hotel Content response was not a JSON object', parsed);
  }

  const rs = parsed.GetHotelContentRS;
  if (rs === undefined || rs === null || typeof rs !== 'object') {
    throw new SabreParseError('Get Hotel Content response was missing `GetHotelContentRS`', parsed);
  }

  const out: GetHotelContentOutput = {};

  if (rs.ApplicationResults !== undefined) {
    const ar = mapApplicationResults(rs.ApplicationResults);
    if (ar !== undefined) {
      out.applicationResults = ar;
      if (ar.status !== undefined) out.status = ar.status;
    }
  }

  if (rs.HotelContentInfos?.HotelContentInfo !== undefined) {
    out.hotel = mapHotelContentInfo(rs.HotelContentInfos.HotelContentInfo);
  }

  return out;
}

type GeneratedHotelContentInfo = components['schemas']['HotelContentInfo'];

function mapHotelContentInfo(info: GeneratedHotelContentInfo): ContentHotel {
  const hotel: ContentHotel = { info: mapHotelInfo(info.HotelInfo) };
  if (info.HotelDescriptiveInfo !== undefined) {
    const di = mapDescriptiveInfo(info.HotelDescriptiveInfo);
    if (di !== undefined) hotel.descriptiveInfo = di;
  }
  if (info.HotelMediaInfo !== undefined) {
    const mi = mapMediaInfo(info.HotelMediaInfo);
    if (mi !== undefined) hotel.mediaInfo = mi;
  }
  return hotel;
}

function mapHotelInfo(info: components['schemas']['HotelInfo']): ContentHotelInfo {
  const out: ContentHotelInfo = {
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
  if (info.TierLabels?.TierLabel !== undefined) {
    out.tierLabels = info.TierLabels.TierLabel.map(mapTierLabel);
  }
  return out;
}

function mapTierLabel(
  t: NonNullable<components['schemas']['TierLabel']>[number],
): ContentTierLabel {
  const out: ContentTierLabel = {};
  if (t.Type !== undefined) out.type = t.Type;
  if (t.Value !== undefined) out.value = t.Value;
  if (t.ProgramId !== undefined) out.programId = t.ProgramId;
  return out;
}

function mapDescriptiveInfo(
  di: components['schemas']['HotelDescriptiveInfo'],
): ContentDescriptiveInfo | undefined {
  const out: ContentDescriptiveInfo = {};
  if (di.PropertyInfo !== undefined) out.propertyInfo = mapPropertyInfo(di.PropertyInfo);
  if (di.LocationInfo !== undefined) out.locationInfo = mapLocationInfo(di.LocationInfo);
  if (di.Amenities?.Amenity !== undefined) {
    out.amenities = di.Amenities.Amenity.map(mapHotelAmenity);
  }
  if (di.SecurityFeatures?.SecurityFeature !== undefined) {
    out.securityFeatures = di.SecurityFeatures.SecurityFeature.map(mapSecurityFeature);
  }
  if (di.Descriptions?.Description !== undefined) {
    out.descriptions = di.Descriptions.Description.map(mapDescription);
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function mapPropertyInfo(p: components['schemas']['PropertyInfo']): ContentPropertyInfo {
  const out: ContentPropertyInfo = {};
  if (p.Floors !== undefined) out.floors = p.Floors;
  if (p.Rooms !== undefined) out.rooms = p.Rooms;
  if (p.PropertyTypeInfo?.PropertyType !== undefined) {
    out.propertyTypes = p.PropertyTypeInfo.PropertyType.map(mapPropertyType);
  }
  if (p.Policies?.Policy !== undefined) {
    out.policies = p.Policies.Policy.map(mapPolicyText);
  }
  if (p.PropertyQualityInfo?.PropertyQuality !== undefined) {
    out.propertyQuality = p.PropertyQualityInfo.PropertyQuality.map(mapPropertyQuality);
  }
  return out;
}

function mapPropertyType(
  t: NonNullable<components['schemas']['PropertyType']>[number],
): ContentPropertyType {
  const out: ContentPropertyType = {};
  if (t.Code !== undefined) out.code = t.Code;
  if (t.Description !== undefined) out.description = t.Description;
  return out;
}

function mapPolicyText(p: NonNullable<components['schemas']['Policy']>[number]): ContentPolicyText {
  const out: ContentPolicyText = { type: p.Text.Type };
  if (p.Text.value !== undefined) out.value = p.Text.value;
  return out;
}

function mapPropertyQuality(
  q: NonNullable<components['schemas']['PropertyQuality']>[number],
): ContentPropertyQuality {
  const out: ContentPropertyQuality = {};
  if (q.Code !== undefined) out.code = q.Code;
  if (q.Description !== undefined) out.description = q.Description;
  return out;
}

function mapLocationInfo(l: components['schemas']['LocationInfo']): ContentLocationInfo {
  const out: ContentLocationInfo = {};
  if (l.Latitude !== undefined) out.latitude = l.Latitude;
  if (l.Longitude !== undefined) out.longitude = l.Longitude;
  if (l.Address !== undefined) out.address = mapAddress(l.Address);
  if (l.Neighborhoods?.Neighborhood !== undefined) {
    out.neighborhoods = l.Neighborhoods.Neighborhood.map(mapNeighborhood);
  }
  if (l.Contact !== undefined) out.contact = mapContact(l.Contact);
  return out;
}

function mapAddress(a: components['schemas']['Address']): ContentAddress {
  const out: ContentAddress = {
    addressLine1: a.AddressLine1,
    city: { cityCode: a.CityName.CityCode, value: a.CityName.value },
    postalCode: a.PostalCode,
    country: { code: a.CountryName.Code, value: a.CountryName.value },
  };
  if (a.AddressLine2 !== undefined) out.addressLine2 = a.AddressLine2;
  if (a.AddressLine3 !== undefined) out.addressLine3 = a.AddressLine3;
  if (a.StateProv !== undefined) {
    out.stateProv = { stateCode: a.StateProv.StateCode, value: a.StateProv.value };
  }
  return out;
}

function mapNeighborhood(
  n: NonNullable<components['schemas']['Neighborhood']>[number],
): ContentNeighborhood {
  const out: ContentNeighborhood = {};
  if (n.Id !== undefined) out.id = n.Id;
  if (n.value !== undefined) out.value = n.value;
  return out;
}

function mapContact(c: components['schemas']['Contact']): ContentContact {
  const out: ContentContact = {};
  if (c.Phone !== undefined) out.phone = c.Phone;
  if (c.Fax !== undefined) out.fax = c.Fax;
  return out;
}

function mapHotelAmenity(
  a: NonNullable<components['schemas']['Amenity']>[number],
): ContentHotelAmenity {
  const out: ContentHotelAmenity = {};
  if (a.Code !== undefined) out.code = a.Code;
  if (a.Description !== undefined) out.description = a.Description;
  if (a.ComplimentaryInd !== undefined) out.complimentary = a.ComplimentaryInd;
  if (a.value !== undefined) out.value = a.value;
  return out;
}

function mapSecurityFeature(
  s: NonNullable<components['schemas']['SecurityFeature']>[number],
): ContentSecurityFeature {
  const out: ContentSecurityFeature = {};
  if (s.Code !== undefined) out.code = s.Code;
  if (s.Description !== undefined) out.description = s.Description;
  if (s.value !== undefined) out.value = s.value;
  return out;
}

function mapDescription(
  d: NonNullable<components['schemas']['HotelDescriptiveInfo.Description']>[number],
): ContentDescription {
  const out: ContentDescription = {};
  if (d.Text?.Type !== undefined) out.type = d.Text.Type;
  if (d.Text?.value !== undefined) out.text = d.Text.value;
  return out;
}

function mapMediaInfo(mi: components['schemas']['HotelMediaInfo']): ContentMediaInfo | undefined {
  if (mi.MediaItems.MediaItem === undefined) return undefined;
  return { items: mi.MediaItems.MediaItem.map(mapMediaItem) };
}

type GeneratedMediaItem = NonNullable<components['schemas']['MediaItem']>[number];

function mapMediaItem(m: GeneratedMediaItem): ContentMediaItem {
  const out: ContentMediaItem = {
    id: m.Id,
    ordinal: m.Ordinal,
    lastModifiedDate: m.LastModifedDate,
    format: m.Format,
  };
  if (m.ImageItems?.Image !== undefined) {
    out.images = m.ImageItems.Image.map(mapImageVariant);
  }
  if (m.PanoramicMediasItems?.PanoramicMedia !== undefined) {
    out.panoramics = m.PanoramicMediasItems.PanoramicMedia.map(mapPanoramicVariant);
  }
  if (m.VideosItems?.Video !== undefined) {
    out.videos = m.VideosItems.Video.map(mapVideoVariant);
  }
  if (m.Category !== undefined) out.category = mapMediaCategory(m.Category);
  if (m.RoomTypeCode !== undefined) {
    out.roomTypeCodes = m.RoomTypeCode.flatMap((c) => (c.Code !== undefined ? [c.Code] : []));
  }
  if (m.AdditionalInfo?.Info !== undefined) {
    out.additionalInfo = m.AdditionalInfo.Info.map(mapMediaAdditionalInfo);
  }
  return out;
}

function mapImageVariant(
  i: NonNullable<components['schemas']['response.Image']>[number],
): ContentImageVariant {
  return { url: i.Url, size: i.Type, height: i.Height, width: i.Width };
}

function mapPanoramicVariant(
  p: NonNullable<components['schemas']['response.PanoramicMedia']>[number],
): ContentPanoramicVariant {
  return { url: p.Url, type: p.Type, height: p.Height, width: p.Width };
}

function mapVideoVariant(
  v: NonNullable<components['schemas']['response.Video']>[number],
): ContentVideoVariant {
  return { url: v.Url, type: v.Type, height: v.Height, width: v.Width };
}

function mapMediaCategory(c: components['schemas']['response.Category']): ContentMediaCategory {
  const out: ContentMediaCategory = {};
  if (c.CategoryCode !== undefined) out.code = c.CategoryCode;
  if (c.Description.Text !== undefined) out.description = c.Description.Text.map(mapLocalizedText);
  return out;
}

function mapLocalizedText(t: {
  Language?: string;
  value?: string;
}): ContentLocalizedText {
  const out: ContentLocalizedText = {};
  if (t.Language !== undefined) out.language = t.Language;
  if (t.value !== undefined) out.value = t.value;
  return out;
}

function mapMediaAdditionalInfo(
  i: NonNullable<components['schemas']['response.AdditionalInfo.Info']>[number],
): ContentMediaAdditionalInfo {
  return {
    type: i.Type,
    description: (i.Description.Text ?? []).map(mapLocalizedText),
  };
}

function mapApplicationResults(
  ar: components['schemas']['ApplicationResults'],
): ContentApplicationResults | undefined {
  const out: ContentApplicationResults = {};
  if (ar.status !== undefined) out.status = ar.status;
  if (ar.Success !== undefined) out.success = ar.Success.map(mapElement);
  if (ar.Error !== undefined) out.errors = ar.Error.map(mapElement);
  if (ar.Warning !== undefined) out.warnings = ar.Warning.map(mapElement);
  return Object.keys(out).length > 0 ? out : undefined;
}

function mapElement(
  e: NonNullable<components['schemas']['ElementStructure']>[number],
): ContentApplicationResultEntry {
  const out: ContentApplicationResultEntry = {};
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

function mapSystemSpecificResult(r: GeneratedSystemSpecificResult): ContentSystemSpecificResult {
  const out: ContentSystemSpecificResult = {};
  if (r.timeStamp !== undefined) out.timeStamp = r.timeStamp;
  if (r.reference !== undefined) out.reference = r.reference;
  if (r.HostCommand?.LNIATA !== undefined) {
    out.hostCommand = { lniata: r.HostCommand.LNIATA } satisfies ContentHostCommand;
  }
  if (r.Message !== undefined) {
    out.messages = r.Message.map((m) => {
      const msg: ContentApplicationMessage = {};
      if (m.code !== undefined) msg.code = m.code;
      if (m.value !== undefined) msg.value = m.value;
      return msg;
    });
  }
  return out;
}
