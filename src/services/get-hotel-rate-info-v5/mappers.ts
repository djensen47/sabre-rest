import { SabreParseError } from '../../errors/sabre-parse-error.js';
import type { components } from '../../generated/get-hotel-rate-info.js';
import { ensureTrailingSlash } from '../../http/ensure-trailing-slash.js';
import type { SabreRequest, SabreResponse } from '../../http/types.js';
import type {
  GetHotelRateInfoInput,
  GetHotelRateInfoOutput,
  RateInfoAdditionalDetail,
  RateInfoAlternateHotel,
  RateInfoAmountPercent,
  RateInfoApplicationResultEntry,
  RateInfoApplicationResults,
  RateInfoBedType,
  RateInfoCancelPenalty,
  RateInfoCommission,
  RateInfoDeadline,
  RateInfoDepositPolicy,
  RateInfoFee,
  RateInfoFeeGroup,
  RateInfoFees,
  RateInfoGuarantee,
  RateInfoGuaranteeAccepted,
  RateInfoHotel,
  RateInfoHotelInfo,
  RateInfoMealsIncluded,
  RateInfoOccupancy,
  RateInfoPaymentCard,
  RateInfoRate,
  RateInfoRateCriteria,
  RateInfoRateEntries,
  RateInfoRateEntry,
  RateInfoRateFilter,
  RateInfoRatePlan,
  RateInfoRatePlanCandidates,
  RateInfoRatePlanInclusion,
  RateInfoRequestedRoom,
  RateInfoRoomAmenity,
  RateInfoRoomDescription,
  RateInfoRoomDetail,
  RateInfoRoomExtra,
  RateInfoRoomRateInfo,
  RateInfoRoomSet,
  RateInfoRoomSetAttribute,
  RateInfoSearchByHotelRef,
  RateInfoSearchByRateKey,
  RateInfoSystemSpecificResult,
  RateInfoTax,
  RateInfoTaxGroup,
  RateInfoTaxes,
  RateInfoUnavailSource,
} from './types.js';

const PATH = 'v5/get/hotelrateinfo';

/**
 * Hardcoded schema version sent on every request at
 * `GetHotelRateInfoRQ.version`. Sabre's v5 canonical sample payload (see
 * `docs/specifications/get-hotel-rate-info/sample-request.json`) includes
 * this field; the CSL v3 Postman collection pins it to `"3.0.0"`. The
 * field is not marked `required` in the RQ JSON Schema, but omitting it
 * produced empty `Complete`-with-no-`HotelRateInfos` envelopes in CERT.
 * Same category of protocol-level constant as
 * bargain-finder-max-v5's `Version: '5'` —
 * a runtime requirement that's not in the spec's `required` list but is
 * present in every canonical example.
 */
const SCHEMA_VERSION = '5.0.0';

/**
 * Builds the outgoing {@link SabreRequest} for the `getHotelRateInfo`
 * operation.
 *
 * Sabre's spec documents `default:` values on a handful of request fields
 * (PrepaidQualifier, RefundableOnly, ConvertedRateInfoOnly, ExactMatchOnly,
 * SortBy, etc.). Following the precedent set by get-hotel-avail-v5 and
 * hotel-price-check-v5, this mapper does **not** auto-send those defaults
 * on the consumer's behalf. Sabre applies them server-side when fields are
 * omitted, so the wire body reflects exactly what the consumer asked for.
 *
 * Exception: `GetHotelRateInfoRQ.version` is hardcoded to
 * {@link SCHEMA_VERSION} because it is a protocol-level constant (not user
 * data) that Sabre's runtime requires despite the spec not marking it
 * required. See {@link SCHEMA_VERSION}.
 */
export function toGetRateInfoRequest(baseUrl: string, input: GetHotelRateInfoInput): SabreRequest {
  const url = new URL(PATH, ensureTrailingSlash(baseUrl));

  const rq: Record<string, unknown> =
    input.kind === 'hotel-ref' ? buildSearchByHotelRef(input) : buildSearchByRateKey(input);

  return {
    method: 'POST',
    url: url.toString(),
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ GetHotelRateInfoRQ: rq }),
  };
}

function buildSearchByHotelRef(input: RateInfoSearchByHotelRef): Record<string, unknown> {
  const out: Record<string, unknown> = { version: SCHEMA_VERSION };
  if (input.corporateNumber !== undefined) out.CorporateNumber = input.corporateNumber;
  if (input.pointOfSale !== undefined) {
    out.POS = { Source: { PseudoCityCode: input.pointOfSale.pseudoCityCode } };
  }
  const ref: Record<string, unknown> = { HotelCode: input.hotelRef.code };
  if (input.hotelRef.codeContext !== undefined) ref.CodeContext = input.hotelRef.codeContext;
  out.HotelRefs = { HotelRef: ref };
  out.RateInfoRef = buildRateInfoRef(input.rateCriteria);
  return out;
}

function buildSearchByRateKey(input: RateInfoSearchByRateKey): Record<string, unknown> {
  const out: Record<string, unknown> = { version: SCHEMA_VERSION };
  if (input.pointOfSale !== undefined) {
    out.POS = { Source: { PseudoCityCode: input.pointOfSale.pseudoCityCode } };
  }
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
  if (input.rateSource !== undefined && input.rateSource.length > 0) {
    ref.RateSource = input.rateSource.join(',');
  }
  out.RateKeyRef = ref;
  return out;
}

function buildRateInfoRef(c: RateInfoRateCriteria): Record<string, unknown> {
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
  if (c.languageCode !== undefined) out.LanguageCode = c.languageCode;
  if (c.showNegotiatedRatesFirst !== undefined) {
    out.ShowNegotiatedRatesFirst = c.showNegotiatedRatesFirst;
  }
  if (c.shopKey !== undefined) out.ShopKey = c.shopKey;
  if (c.rateRange !== undefined) {
    const rr: Record<string, unknown> = {};
    if (c.rateRange.min !== undefined) rr.Min = c.rateRange.min;
    if (c.rateRange.max !== undefined) rr.Max = c.rateRange.max;
    if (Object.keys(rr).length > 0) out.RateRange = rr;
  }
  if (c.ratePlanCandidates !== undefined) {
    out.RatePlanCandidates = buildRatePlanCandidates(c.ratePlanCandidates);
  }
  if (c.loyaltyIds !== undefined && c.loyaltyIds.length > 0) {
    out.LoyaltyIds = { LoyaltyId: [...c.loyaltyIds] };
  }
  if (c.rateFilters !== undefined && c.rateFilters.length > 0) {
    out.RateFilters = { RateFilter: c.rateFilters.map(buildRateFilter) };
  }
  if (c.sortOrder !== undefined) out.SortOrder = c.sortOrder;
  if (c.frequentFlyerNumber !== undefined) out.FrequentFlyerNumber = c.frequentFlyerNumber;
  if (c.corpDiscount !== undefined) out.CorpDiscount = c.corpDiscount;
  if (c.rateSource !== undefined && c.rateSource.length > 0) {
    out.RateSource = c.rateSource.join(',');
  }
  if (c.sortBy !== undefined) out.SortBy = c.sortBy;
  return out;
}

function buildRequestedRoom(room: RateInfoRequestedRoom): Record<string, unknown> {
  const out: Record<string, unknown> = { Index: room.index, Adults: room.adults };
  if (room.children !== undefined) out.Children = room.children;
  if (room.childAges !== undefined && room.childAges.length > 0) {
    out.ChildAges = room.childAges.join(',');
  }
  return out;
}

function buildRateFilter(f: RateInfoRateFilter): Record<string, unknown> {
  return { Type: f.type, Value: f.value, Action: f.action };
}

function buildRatePlanCandidates(c: RateInfoRatePlanCandidates): Record<string, unknown> {
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

// -----------------------------------------------------------------------------
// Response mappers
// -----------------------------------------------------------------------------

/**
 * Parses the `getHotelRateInfo` response into the public output shape.
 *
 * Every rate entry, room, rate plan, and diagnostic Sabre returned is
 * preserved. The response schema is a `oneOf` of `ResponseWithRooms` and
 * `ResponseWithRoomSets`; the public {@link RateInfoHotel} exposes both
 * sets of optional fields so the mapper can populate whichever branch
 * Sabre sent without discriminating. Throws {@link SabreParseError} only
 * when the body fundamentally is not a Sabre response.
 */
export function fromGetRateInfoResponse(res: SabreResponse): GetHotelRateInfoOutput {
  let parsed: components['schemas']['GetHotelRateInfoResponse'];
  try {
    parsed = JSON.parse(res.body) as components['schemas']['GetHotelRateInfoResponse'];
  } catch (err) {
    throw new SabreParseError('Failed to parse Get Hotel Rate Info response as JSON', res.body, {
      cause: err,
    });
  }

  if (parsed === null || typeof parsed !== 'object') {
    throw new SabreParseError('Get Hotel Rate Info response was not a JSON object', parsed);
  }

  const rs = parsed.GetHotelRateInfoRS;
  if (rs === undefined || rs === null || typeof rs !== 'object') {
    throw new SabreParseError(
      'Get Hotel Rate Info response was missing `GetHotelRateInfoRS`',
      parsed,
    );
  }

  const out: GetHotelRateInfoOutput = {};

  if (rs.ApplicationResults !== undefined) {
    const ar = mapApplicationResults(rs.ApplicationResults);
    if (ar !== undefined) {
      out.applicationResults = ar;
      if (ar.status !== undefined) out.status = ar.status;
    }
  }

  if (rs.HotelRateInfos?.HotelRateInfo !== undefined) {
    const hotel = mapHotelRateInfo(rs.HotelRateInfos.HotelRateInfo);
    if (hotel !== undefined) out.hotel = hotel;
  }

  return out;
}

type GeneratedHotelRateInfo = components['schemas']['HotelRateInfo'];

function mapHotelRateInfo(hri: GeneratedHotelRateInfo): RateInfoHotel | undefined {
  // `hri` is the union ResponseWithRooms | ResponseWithRoomSets. Both
  // branches share HotelInfo, AlternateHotelInfos, RateInfos, and
  // RateUnavailability. ResponseWithRooms adds Rooms + LanguageCode;
  // ResponseWithRoomSets adds RoomSets. Read the union as its widened
  // record so every possible field is reachable without a discriminator.
  const source = hri as {
    HotelInfo?: components['schemas']['HotelInfo'];
    AlternateHotelInfos?: components['schemas']['AlternateHotelInfos'];
    RateInfos?: components['schemas']['RateInfos'];
    RateUnavailability?: components['schemas']['RateUnavailability'];
    Rooms?: components['schemas']['response.Rooms'];
    RoomSets?: components['schemas']['RoomSets'];
    LanguageCode?: string;
  };

  if (source.HotelInfo === undefined) return undefined;

  const hotel: RateInfoHotel = { info: mapHotelInfo(source.HotelInfo) };

  if (source.AlternateHotelInfos?.AlternateHotelInfo !== undefined) {
    hotel.alternateHotels = source.AlternateHotelInfos.AlternateHotelInfo.map(mapAlternateHotel);
  }

  if (source.RateInfos !== undefined) {
    const rateInfos = mapRateInfos(source.RateInfos);
    if (rateInfos !== undefined) hotel.rateInfos = rateInfos;
  }

  if (source.RateUnavailability?.RateSource !== undefined) {
    hotel.rateUnavailability = source.RateUnavailability.RateSource.map(mapUnavailSource);
  }

  if (source.Rooms?.Room !== undefined) {
    hotel.rooms = source.Rooms.Room.map(mapRoomDetail);
  }

  if (source.LanguageCode !== undefined) hotel.languageCode = source.LanguageCode;

  if (source.RoomSets?.RoomSet !== undefined) {
    hotel.roomSets = source.RoomSets.RoomSet.map(mapRoomSet);
  }

  return hotel;
}

function mapHotelInfo(info: components['schemas']['HotelInfo']): RateInfoHotelInfo {
  const out: RateInfoHotelInfo = {
    code: info.HotelCode,
    codeContext: info.CodeContext,
  };
  if (info.SabreHotelCode !== undefined) out.sabreCode = info.SabreHotelCode;
  if (info.ChainCode !== undefined) out.chainCode = info.ChainCode;
  return out;
}

function mapAlternateHotel(
  a: NonNullable<components['schemas']['AlternateHotelInfo']>[number],
): RateInfoAlternateHotel {
  const out: RateInfoAlternateHotel = {};
  if (a.HotelCode !== undefined) out.code = a.HotelCode;
  if (a.CodeContext !== undefined) out.codeContext = a.CodeContext;
  if (a.SabreHotelCode !== undefined) out.sabreCode = a.SabreHotelCode;
  if (a.ChainCode !== undefined) out.chainCode = a.ChainCode;
  return out;
}

function mapRateInfos(
  ri: NonNullable<components['schemas']['RateInfos']>,
): RateInfoRateEntries | undefined {
  const out: RateInfoRateEntries = {};
  if (ri.ShopKey !== undefined) out.shopKey = ri.ShopKey;
  if (ri.RateInfo !== undefined) out.rateInfo = ri.RateInfo.map(mapRateEntry);
  if (ri.ConvertedRateInfo !== undefined) {
    out.convertedRateInfo = ri.ConvertedRateInfo.map(mapRateEntry);
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

type GeneratedRateEntry = NonNullable<components['schemas']['RateInfos.RateInfo']>[number];

function mapRateEntry(r: GeneratedRateEntry): RateInfoRateEntry {
  const out: RateInfoRateEntry = { rateKey: r.RateKey, rateSource: r.RateSource };
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
  if (r.Commission !== undefined) out.commission = mapCommission(r.Commission);
  return out;
}

function mapCommission(c: components['schemas']['Commission']): RateInfoCommission {
  const out: RateInfoCommission = {};
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
  s: NonNullable<components['schemas']['RateSource']>[number],
): RateInfoUnavailSource {
  const out: RateInfoUnavailSource = { source: s.Source, reason: s.Reason };
  if (s.DisplayMessage !== undefined) out.displayMessage = s.DisplayMessage;
  return out;
}

type GeneratedResponseRoom = NonNullable<components['schemas']['response.Room']>[number];

function mapRoomDetail(r: GeneratedResponseRoom): RateInfoRoomDetail {
  const out: RateInfoRoomDetail = {
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
  if (r.Occupancy !== undefined) out.occupancy = mapOccupancy(r.Occupancy);
  return out;
}

function mapRoomSet(rs: NonNullable<components['schemas']['RoomSet']>[number]): RateInfoRoomSet {
  const out: RateInfoRoomSet = {};
  if (rs.RoomSetAttributes?.RoomSetAttribute !== undefined) {
    out.attributes = rs.RoomSetAttributes.RoomSetAttribute.map(mapRoomSetAttribute);
  }
  if (rs.Room !== undefined) out.rooms = rs.Room.map(mapRoomDetail);
  return out;
}

function mapRoomSetAttribute(
  a: NonNullable<components['schemas']['RoomSetAttribute']>[number],
): RateInfoRoomSetAttribute {
  const out: RateInfoRoomSetAttribute = {};
  if (a.Type !== undefined) out.type = a.Type;
  if (a.Code !== undefined) out.code = a.Code;
  if (a.Value !== undefined) out.value = a.Value;
  return out;
}

function mapBedType(bt: NonNullable<components['schemas']['BedType']>[number]): RateInfoBedType {
  const out: RateInfoBedType = {};
  if (bt.Code !== undefined) out.code = bt.Code;
  if (bt.Description !== undefined) out.description = bt.Description;
  if (bt.Count !== undefined) out.count = bt.Count;
  return out;
}

function mapRoomDescription(rd: components['schemas']['RoomDescription']): RateInfoRoomDescription {
  const out: RateInfoRoomDescription = {};
  if (rd.Name !== undefined) out.name = rd.Name;
  if (rd.Text !== undefined) out.text = [...rd.Text];
  return out;
}

function mapAdditionalDetail(
  d: NonNullable<components['schemas']['AdditionalDetail']>[number],
): RateInfoAdditionalDetail {
  const out: RateInfoAdditionalDetail = {};
  if (d.Code !== undefined) out.code = d.Code;
  if (d.Description !== undefined) out.description = d.Description;
  if (d.Amount !== undefined) out.amount = d.Amount;
  if (d.CurrencyCode !== undefined) out.currencyCode = d.CurrencyCode;
  if (d.Text !== undefined) out.text = [...d.Text];
  return out;
}

function mapRoomAmenity(
  a: NonNullable<components['schemas']['RoomAmenity']>[number],
): RateInfoRoomAmenity {
  const out: RateInfoRoomAmenity = {};
  if (a.Code !== undefined) out.code = a.Code;
  if (a.Description !== undefined) out.description = a.Description;
  if (a.ComplimentaryInd !== undefined) out.complimentary = a.ComplimentaryInd;
  if (a.AccessibleAmenity !== undefined) out.accessibleAmenity = a.AccessibleAmenity;
  if (a.value !== undefined) out.value = a.value;
  return out;
}

function mapOccupancy(o: components['schemas']['Occupancy']): RateInfoOccupancy {
  const out: RateInfoOccupancy = {};
  if (o.Min !== undefined) out.min = o.Min;
  if (o.Max !== undefined) out.max = o.Max;
  return out;
}

type GeneratedRatePlan = NonNullable<components['schemas']['RatePlan']>[number];

function mapRatePlan(rp: GeneratedRatePlan): RateInfoRatePlan {
  const out: RateInfoRatePlan = {
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
  i: NonNullable<components['schemas']['RatePlanInclusion']>[number],
): RateInfoRatePlanInclusion {
  const out: RateInfoRatePlanInclusion = {};
  if (i.Code !== undefined) out.code = i.Code;
  if (i.Description !== undefined) out.description = i.Description;
  if (i.Text !== undefined) out.text = [...i.Text];
  return out;
}

function mapMeals(m: components['schemas']['MealsIncluded']): RateInfoMealsIncluded {
  const out: RateInfoMealsIncluded = {};
  if (m.BreakFast !== undefined) out.breakfast = m.BreakFast;
  if (m.Lunch !== undefined) out.lunch = m.Lunch;
  if (m.Dinner !== undefined) out.dinner = m.Dinner;
  if (m.MealPlanIndicator !== undefined) out.mealPlanIndicator = m.MealPlanIndicator;
  if (m.MealPlanCode !== undefined) out.mealPlanCode = m.MealPlanCode;
  if (m.MealPlanDescription !== undefined) out.mealPlanDescription = m.MealPlanDescription;
  if (m.GuestCount !== undefined) out.guestCount = m.GuestCount;
  return out;
}

function mapRoomRateInfo(rri: components['schemas']['Room.RateInfo']): RateInfoRoomRateInfo {
  const out: RateInfoRoomRateInfo = {
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

function mapRate(r: NonNullable<components['schemas']['Rate']>[number]): RateInfoRate {
  const out: RateInfoRate = {};
  if (r.StartDate !== undefined) out.startDate = r.StartDate;
  if (r.EndDate !== undefined) out.endDate = r.EndDate;
  if (r.AmountBeforeTax !== undefined) out.amountBeforeTax = r.AmountBeforeTax;
  if (r.AmountAfterTax !== undefined) out.amountAfterTax = r.AmountAfterTax;
  if (r.CurrencyCode !== undefined) out.currencyCode = r.CurrencyCode;
  return out;
}

function mapTaxes(t: components['schemas']['Taxes']): RateInfoTaxes | undefined {
  const out: RateInfoTaxes = {};
  if (t.Amount !== undefined) out.amount = t.Amount;
  if (t.CurrencyCode !== undefined) out.currencyCode = t.CurrencyCode;
  if (t.Tax !== undefined) out.taxes = t.Tax.map(mapTax);
  if (t.TaxGroups?.TaxGroup !== undefined) out.taxGroups = t.TaxGroups.TaxGroup.map(mapTaxGroup);
  return Object.keys(out).length > 0 ? out : undefined;
}

function mapTax(t: NonNullable<components['schemas']['Tax']>[number]): RateInfoTax {
  const out: RateInfoTax = { amount: t.Amount, currencyCode: t.CurrencyCode };
  if (t.StartDate !== undefined) out.startDate = t.StartDate;
  if (t.EndDate !== undefined) out.endDate = t.EndDate;
  return out;
}

function mapTaxGroup(g: NonNullable<components['schemas']['TaxGroup']>[number]): RateInfoTaxGroup {
  const out: RateInfoTaxGroup = {
    code: g.Code,
    amount: g.Amount,
    currencyCode: g.CurrencyCode,
  };
  if (g.Description !== undefined) out.description = g.Description;
  if (g.TaxDescription?.Text !== undefined) out.descriptionText = [...g.TaxDescription.Text];
  return out;
}

function mapFees(f: components['schemas']['Fees']): RateInfoFees | undefined {
  const out: RateInfoFees = {};
  if (f.Amount !== undefined) out.amount = f.Amount;
  if (f.CurrencyCode !== undefined) out.currencyCode = f.CurrencyCode;
  if (f.Fee !== undefined) out.fees = f.Fee.map(mapFee);
  if (f.FeeGroups?.FeeGroup !== undefined) out.feeGroups = f.FeeGroups.FeeGroup.map(mapFeeGroup);
  return Object.keys(out).length > 0 ? out : undefined;
}

function mapFee(f: NonNullable<components['schemas']['Fee']>[number]): RateInfoFee {
  const out: RateInfoFee = { amount: f.Amount, currencyCode: f.CurrencyCode };
  if (f.StartDate !== undefined) out.startDate = f.StartDate;
  if (f.EndDate !== undefined) out.endDate = f.EndDate;
  return out;
}

function mapFeeGroup(g: NonNullable<components['schemas']['FeeGroup']>[number]): RateInfoFeeGroup {
  const out: RateInfoFeeGroup = {
    code: g.Code,
    amount: g.Amount,
    currencyCode: g.CurrencyCode,
  };
  if (g.Description !== undefined) out.description = g.Description;
  if (g.FeeDescription?.Text !== undefined) out.descriptionText = [...g.FeeDescription.Text];
  return out;
}

function mapRoomExtra(
  e: NonNullable<components['schemas']['RoomExtra']>[number],
): RateInfoRoomExtra {
  const out: RateInfoRoomExtra = { text: [...e.Text] };
  if (e.Code !== undefined) out.code = e.Code;
  if (e.Description !== undefined) out.description = e.Description;
  if (e.Amount !== undefined) out.amount = e.Amount;
  if (e.CurrencyCode !== undefined) out.currencyCode = e.CurrencyCode;
  return out;
}

function mapCancelPenalty(
  p: NonNullable<components['schemas']['CancelPenalty']>[number],
): RateInfoCancelPenalty {
  const out: RateInfoCancelPenalty = { refundable: p.Refundable };
  if (p.Deadline !== undefined) out.deadline = mapDeadline(p.Deadline);
  if (p.AmountPercent !== undefined) out.amountPercent = mapAmountPercent(p.AmountPercent);
  if (p.PenaltyDescription !== undefined) {
    out.descriptionText = [...p.PenaltyDescription.Text];
  }
  return out;
}

function mapDeadline(d: components['schemas']['Deadline']): RateInfoDeadline {
  const out: RateInfoDeadline = {};
  if (d.AbsoluteDeadline !== undefined) out.absoluteDeadline = d.AbsoluteDeadline;
  if (d.OffsetTimeUnit !== undefined) out.offsetTimeUnit = d.OffsetTimeUnit;
  if (d.OffsetUnitMultiplier !== undefined) out.offsetUnitMultiplier = d.OffsetUnitMultiplier;
  if (d.OffsetDropTime !== undefined) out.offsetDropTime = d.OffsetDropTime;
  return out;
}

function mapAmountPercent(a: components['schemas']['AmountPercent']): RateInfoAmountPercent {
  const out: RateInfoAmountPercent = {};
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

function mapGuarantee(g: components['schemas']['Guarantee']): RateInfoGuarantee {
  const out: RateInfoGuarantee = {
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
  ga: NonNullable<components['schemas']['GuaranteesAccepted']['GuaranteeAccepted']>[number],
): RateInfoGuaranteeAccepted {
  const out: RateInfoGuaranteeAccepted = {};
  if (ga.GuaranteeTypeCode !== undefined) out.typeCode = ga.GuaranteeTypeCode;
  if (ga.GuaranteeTypeDescription !== undefined) out.typeDescription = ga.GuaranteeTypeDescription;
  if (ga.PaymentCards !== undefined) {
    const cards: RateInfoPaymentCard[] = (ga.PaymentCards.PaymentCard ?? []).map((c) => {
      const card: RateInfoPaymentCard = { code: c.CardCode };
      if (c.value !== undefined) card.value = c.value;
      return card;
    });
    const list: NonNullable<RateInfoGuaranteeAccepted['paymentCards']> = { cards };
    if (ga.PaymentCards.CVVRequired !== undefined) list.cvvRequired = ga.PaymentCards.CVVRequired;
    out.paymentCards = list;
  }
  return out;
}

function mapDepositPolicy(
  dp: NonNullable<components['schemas']['DepositPolicy']>[number],
): RateInfoDepositPolicy {
  const out: RateInfoDepositPolicy = {};
  if (dp.Deadline !== undefined) out.deadline = mapDeadline(dp.Deadline);
  if (dp.AmountPercent !== undefined) out.amountPercent = mapAmountPercent(dp.AmountPercent);
  return out;
}

function mapApplicationResults(
  ar: components['schemas']['ApplicationResults'],
): RateInfoApplicationResults | undefined {
  const out: RateInfoApplicationResults = {};
  if (ar.status !== undefined) out.status = ar.status as RateInfoApplicationResults['status'];
  if (ar.Success !== undefined) out.success = ar.Success.map(mapElement);
  if (ar.Error !== undefined) out.errors = ar.Error.map(mapElement);
  if (ar.Warning !== undefined) out.warnings = ar.Warning.map(mapElement);
  return Object.keys(out).length > 0 ? out : undefined;
}

function mapElement(
  e: NonNullable<components['schemas']['ElementStructure']>[number],
): RateInfoApplicationResultEntry {
  const out: RateInfoApplicationResultEntry = {};
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

function mapSystemSpecificResult(r: GeneratedSystemSpecificResult): RateInfoSystemSpecificResult {
  const out: RateInfoSystemSpecificResult = {};
  if (r.timeStamp !== undefined) out.timeStamp = r.timeStamp;
  if (r.reference !== undefined) out.reference = r.reference;
  if (r.HostCommand?.LNIATA !== undefined) {
    out.hostCommand = { lniata: r.HostCommand.LNIATA };
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
