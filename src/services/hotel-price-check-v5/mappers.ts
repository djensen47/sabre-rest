import { SabreParseError } from '../../errors/sabre-parse-error.js';
import type { components } from '../../generated/hotel-price-check.js';
import { ensureTrailingSlash } from '../../http/ensure-trailing-slash.js';
import type { SabreRequest, SabreResponse } from '../../http/types.js';
import type {
  CheckHotelPriceInput,
  CheckHotelPriceOutput,
  PriceCheckAdditionalDetail,
  PriceCheckAmountPercent,
  PriceCheckApplicationResultEntry,
  PriceCheckApplicationResults,
  PriceCheckBedType,
  PriceCheckCancelPenalty,
  PriceCheckCommission,
  PriceCheckDeadline,
  PriceCheckDepositPolicy,
  PriceCheckFee,
  PriceCheckFeeGroup,
  PriceCheckFees,
  PriceCheckGuarantee,
  PriceCheckGuaranteeAccepted,
  PriceCheckHotel,
  PriceCheckMealsIncluded,
  PriceCheckOccupancy,
  PriceCheckPaymentCard,
  PriceCheckRate,
  PriceCheckRateInfo,
  PriceCheckRateInfoEntry,
  PriceCheckRatePlan,
  PriceCheckRatePlanInclusion,
  PriceCheckRoom,
  PriceCheckRoomAmenity,
  PriceCheckRoomDescription,
  PriceCheckRoomExtra,
  PriceCheckRoomRateInfo,
  PriceCheckSystemSpecificResult,
  PriceCheckTax,
  PriceCheckTaxGroup,
  PriceCheckTaxes,
} from './types.js';

const PATH = 'v5/hotel/pricecheck';

/**
 * Builds the outgoing {@link SabreRequest} for the `hotelPriceCheck`
 * operation.
 *
 * The spec declares no `default:` values on any request field, so the
 * mapper sends only what the consumer supplied plus the required
 * `rateKey`. `childAges` is joined with commas at the boundary because
 * Sabre's wire format is `"10,11,12"` — exposing `number[]` at the
 * public surface prevents whitespace-sensitive string mistakes.
 */
export function toCheckRequest(baseUrl: string, input: CheckHotelPriceInput): SabreRequest {
  const url = new URL(PATH, ensureTrailingSlash(baseUrl));

  const rateInfoRef: Record<string, unknown> = { RateKey: input.rateKey };
  if (input.stay !== undefined) {
    rateInfoRef.StayDateTimeRange = {
      StartDate: input.stay.startDate,
      EndDate: input.stay.endDate,
    };
  }
  if (input.rooms !== undefined && input.rooms.length > 0) {
    rateInfoRef.Rooms = {
      Room: input.rooms.map((r) => {
        const entry: Record<string, unknown> = { Index: r.index, Adults: r.adults };
        if (r.children !== undefined) entry.Children = r.children;
        if (r.childAges !== undefined && r.childAges.length > 0) {
          entry.ChildAges = r.childAges.join(',');
        }
        return entry;
      }),
    };
  }

  const rq: Record<string, unknown> = { RateInfoRef: rateInfoRef };
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
    body: JSON.stringify({ HotelPriceCheckRQ: rq }),
  };
}

/**
 * Parses the `hotelPriceCheck` response into the public output shape.
 *
 * Every record Sabre returned is preserved; undercooked rooms, rate
 * plans, taxes, fees, etc. are not filtered out — that decision belongs
 * in the consumer's code. Throws {@link SabreParseError} only when the
 * body fundamentally is not a Sabre response.
 */
export function fromCheckResponse(res: SabreResponse): CheckHotelPriceOutput {
  let parsed: components['schemas']['HotelPriceCheckResponse'];
  try {
    parsed = JSON.parse(res.body) as components['schemas']['HotelPriceCheckResponse'];
  } catch (err) {
    throw new SabreParseError('Failed to parse Hotel Price Check response as JSON', res.body, {
      cause: err,
    });
  }

  if (parsed === null || typeof parsed !== 'object') {
    throw new SabreParseError('Hotel Price Check response was not a JSON object', parsed);
  }

  const rs = parsed.HotelPriceCheckRS;
  if (rs === undefined || rs === null || typeof rs !== 'object') {
    throw new SabreParseError('Hotel Price Check response was missing `HotelPriceCheckRS`', parsed);
  }

  const out: CheckHotelPriceOutput = {};
  const info = rs.PriceCheckInfo;
  if (info !== undefined && info !== null && typeof info === 'object') {
    if (info.BookingKey !== undefined) out.bookingKey = info.BookingKey;
    if (info.PriceChange !== undefined) out.priceChange = info.PriceChange;
    if (info.PriceDifference !== undefined) out.priceDifference = info.PriceDifference;
    if (info.CurrencyCode !== undefined) out.currencyCode = info.CurrencyCode;
    if (info.ConvertedPriceChange !== undefined)
      out.convertedPriceChange = info.ConvertedPriceChange;
    if (info.ConvertedPriceDifference !== undefined) {
      out.convertedPriceDifference = info.ConvertedPriceDifference;
    }
    if (info.ConvertedCurrencyCode !== undefined) {
      out.convertedCurrencyCode = info.ConvertedCurrencyCode;
    }
    if (info.HotelInfo !== undefined) out.hotel = mapHotel(info.HotelInfo);
    if (info.HotelRateInfo !== undefined) {
      const rate = mapRateInfo(info.HotelRateInfo);
      if (rate !== undefined) out.rateInfo = rate;
    }
  }

  if (rs.ApplicationResults !== undefined) {
    const ar = mapApplicationResults(rs.ApplicationResults);
    if (ar !== undefined) out.applicationResults = ar;
  }

  return out;
}

function mapHotel(info: NonNullable<components['schemas']['HotelInfo']>): PriceCheckHotel {
  const hotel: PriceCheckHotel = {
    code: info.HotelCode,
    codeContext: info.CodeContext as PriceCheckHotel['codeContext'],
  };
  if (info.SabreHotelCode !== undefined) hotel.sabreCode = info.SabreHotelCode;
  if (info.HotelName !== undefined) hotel.name = info.HotelName;
  if (info.ChainCode !== undefined) hotel.chainCode = info.ChainCode;
  if (info.ChainName !== undefined) hotel.chainName = info.ChainName;
  if (info.BrandCode !== undefined) hotel.brandCode = info.BrandCode;
  if (info.BrandName !== undefined) hotel.brandName = info.BrandName;
  if (info.SabreRating !== undefined) hotel.sabreRating = info.SabreRating;
  if (info.LocationInfo !== undefined) {
    const loc = mapLocation(info.LocationInfo);
    if (loc !== undefined) hotel.location = loc;
  }
  return hotel;
}

function mapLocation(
  loc: NonNullable<components['schemas']['LocationInfo']>,
): PriceCheckHotel['location'] | undefined {
  const out: NonNullable<PriceCheckHotel['location']> = {};
  if (loc.Latitude !== undefined) out.latitude = loc.Latitude;
  if (loc.Longitude !== undefined) out.longitude = loc.Longitude;
  if (loc.Address !== undefined) {
    const addr: NonNullable<PriceCheckHotel['location']>['address'] = {};
    const a = loc.Address;
    if (a.AddressLine1 !== undefined) addr.addressLine1 = a.AddressLine1;
    if (a.AddressLine2 !== undefined) addr.addressLine2 = a.AddressLine2;
    if (a.AddressLine3 !== undefined) addr.addressLine3 = a.AddressLine3;
    if (a.CityName !== undefined) {
      const city: NonNullable<NonNullable<PriceCheckHotel['location']>['address']>['city'] = {};
      if (a.CityName.CityCode !== undefined) city.code = a.CityName.CityCode;
      if (a.CityName.value !== undefined) city.name = a.CityName.value;
      if (Object.keys(city).length > 0) addr.city = city;
    }
    if (a.StateProv !== undefined) {
      const sp: NonNullable<NonNullable<PriceCheckHotel['location']>['address']>['stateProv'] = {};
      if (a.StateProv.StateCode !== undefined) sp.code = a.StateProv.StateCode;
      if (a.StateProv.value !== undefined) sp.name = a.StateProv.value;
      if (Object.keys(sp).length > 0) addr.stateProv = sp;
    }
    if (a.PostalCode !== undefined) addr.postalCode = a.PostalCode;
    if (a.CountryName !== undefined) {
      const country: NonNullable<NonNullable<PriceCheckHotel['location']>['address']>['country'] =
        {};
      if (a.CountryName.Code !== undefined) country.code = a.CountryName.Code;
      if (a.CountryName.value !== undefined) country.name = a.CountryName.value;
      if (Object.keys(country).length > 0) addr.country = country;
    }
    if (Object.keys(addr).length > 0) out.address = addr;
  }
  if (loc.Contact !== undefined) {
    const contact: NonNullable<NonNullable<PriceCheckHotel['location']>>['contact'] = {};
    if (loc.Contact.Phone !== undefined) contact.phone = loc.Contact.Phone;
    if (loc.Contact.Fax !== undefined) contact.fax = loc.Contact.Fax;
    if (Object.keys(contact).length > 0) out.contact = contact;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function mapRateInfo(
  hri: NonNullable<components['schemas']['HotelRateInfo']>,
): PriceCheckRateInfo | undefined {
  const out: PriceCheckRateInfo = {};
  if (hri.RateInfos !== undefined) {
    if (hri.RateInfos.RateInfo !== undefined) {
      out.rateInfos = hri.RateInfos.RateInfo.map(mapRateInfoEntry);
    }
    if (hri.RateInfos.ConvertedRateInfo !== undefined) {
      out.convertedRateInfos = hri.RateInfos.ConvertedRateInfo.map(mapRateInfoEntry);
    }
  }
  if (hri.Rooms?.Room !== undefined) {
    out.rooms = hri.Rooms.Room.map(mapRoom);
  }
  if (hri.RateUnavailability !== undefined) {
    out.unavailability = {
      sources: hri.RateUnavailability.RateSource.map((s) => {
        const src: PriceCheckRateInfo['unavailability'] extends infer U
          ? U extends { sources: readonly (infer E)[] }
            ? E
            : never
          : never = { source: s.Source, reason: s.Reason };
        if (s.DisplayMessage !== undefined) src.displayMessage = s.DisplayMessage;
        return src;
      }),
    };
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function mapRateInfoEntry(
  r: NonNullable<components['schemas']['RateInfos.RateInfo']>[number],
): PriceCheckRateInfoEntry {
  const out: PriceCheckRateInfoEntry = { rateSource: r.RateSource, rateKey: r.RateKey };
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
  if (r.AdditionalFeesInclusive !== undefined)
    out.additionalFeesInclusive = r.AdditionalFeesInclusive;
  if (r.TaxInclusive !== undefined) out.taxInclusive = r.TaxInclusive;
  if (r.LocalFeesInclusive !== undefined) out.localFeesInclusive = r.LocalFeesInclusive;
  if (r.IncidentalsInclusive !== undefined) out.incidentalsInclusive = r.IncidentalsInclusive;
  if (r.ApproxTotalPrice !== undefined) out.approxTotalPrice = r.ApproxTotalPrice;
  if (r.HighestNightlyRate !== undefined) out.highestNightlyRate = r.HighestNightlyRate;
  if (r.Commission !== undefined) out.commission = mapCommission(r.Commission);
  return out;
}

function mapCommission(c: NonNullable<components['schemas']['Commission']>): PriceCheckCommission {
  const out: PriceCheckCommission = {};
  if (c.Percent !== undefined) out.percent = c.Percent;
  if (c.Amount !== undefined) out.amount = c.Amount;
  if (c.CurrencyCode !== undefined) out.currencyCode = c.CurrencyCode;
  if (c.Type !== undefined) out.type = c.Type;
  if (c.CommissionDescription?.Text !== undefined)
    out.description = [...c.CommissionDescription.Text];
  return out;
}

type GeneratedRoom = NonNullable<components['schemas']['response.Room']>[number];

function mapRoom(r: GeneratedRoom): PriceCheckRoom {
  const out: PriceCheckRoom = {
    roomIndex: r.RoomIndex,
    ratePlans: (r.RatePlans.RatePlan ?? []).map(mapRatePlan),
  };
  if (r.RoomType !== undefined) out.roomType = r.RoomType;
  if (r.RoomTypeCode !== undefined) out.roomTypeCode = r.RoomTypeCode;
  if (r.AccessibleAmenities?.Amenity !== undefined) {
    out.accessibleAmenities = r.AccessibleAmenities.Amenity.map(mapRoomAmenity);
  }
  if (r.RoomCategory !== undefined) out.roomCategory = r.RoomCategory;
  if (r.RoomID !== undefined) out.roomId = r.RoomID;
  if (r.Floor !== undefined) out.floor = r.Floor;
  if (r.RoomViewCode !== undefined) out.roomViewCode = r.RoomViewCode;
  if (r.RoomViewDescription !== undefined) out.roomViewDescription = r.RoomViewDescription;
  if (r.NonSmoking !== undefined) out.nonSmoking = r.NonSmoking;
  if (r.Adults !== undefined) out.adults = r.Adults;
  if (r.Children !== undefined) out.children = r.Children;
  if (r.BedTypeOptions?.BedTypes !== undefined) {
    out.bedTypes = r.BedTypeOptions.BedTypes.flatMap((bt) => (bt.BedType ?? []).map(mapBedType));
  }
  if (r.RoomDescription !== undefined) {
    out.roomDescription = mapRoomDescription(r.RoomDescription);
  }
  if (r.AdditionalDetails?.AdditionalDetail !== undefined) {
    out.additionalDetails = r.AdditionalDetails.AdditionalDetail.map(mapAdditionalDetail);
  }
  if (r.Amenities?.Amenity !== undefined) {
    out.amenities = r.Amenities.Amenity.map(mapRoomAmenity);
  }
  if (r.Occupancy !== undefined) out.occupancy = mapOccupancy(r.Occupancy);
  return out;
}

function mapBedType(bt: NonNullable<components['schemas']['BedType']>[number]): PriceCheckBedType {
  const out: PriceCheckBedType = {};
  if (bt.Code !== undefined) out.code = bt.Code;
  if (bt.Description !== undefined) out.description = bt.Description;
  if (bt.Count !== undefined) out.count = bt.Count;
  return out;
}

function mapRoomDescription(
  rd: NonNullable<components['schemas']['RoomDescription']>,
): PriceCheckRoomDescription {
  const out: PriceCheckRoomDescription = {};
  if (rd.Name !== undefined) out.name = rd.Name;
  if (rd.Text !== undefined) out.text = [...rd.Text];
  return out;
}

function mapAdditionalDetail(
  d: NonNullable<components['schemas']['AdditionalDetail']>[number],
): PriceCheckAdditionalDetail {
  const out: PriceCheckAdditionalDetail = {};
  if (d.Code !== undefined) out.code = d.Code;
  if (d.Description !== undefined) out.description = d.Description;
  if (d.Amount !== undefined) out.amount = d.Amount;
  if (d.CurrencyCode !== undefined) out.currencyCode = d.CurrencyCode;
  if (d.Text !== undefined) out.text = [...d.Text];
  return out;
}

function mapRoomAmenity(
  a: NonNullable<components['schemas']['RoomAmenity']>[number],
): PriceCheckRoomAmenity {
  const out: PriceCheckRoomAmenity = {};
  if (a.Code !== undefined) out.code = a.Code;
  if (a.Description !== undefined) out.description = a.Description;
  if (a.ComplimentaryInd !== undefined) out.complimentary = a.ComplimentaryInd;
  if (a.value !== undefined) out.value = a.value;
  return out;
}

function mapOccupancy(o: NonNullable<components['schemas']['Occupancy']>): PriceCheckOccupancy {
  const out: PriceCheckOccupancy = {};
  if (o.Min !== undefined) out.min = o.Min;
  if (o.Max !== undefined) out.max = o.Max;
  return out;
}

type GeneratedRatePlan = NonNullable<components['schemas']['RatePlan']>[number];

function mapRatePlan(rp: GeneratedRatePlan): PriceCheckRatePlan {
  const out: PriceCheckRatePlan = {
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
  if (rp.Ordinal !== undefined) out.ordinal = rp.Ordinal;
  if (rp.Refundability !== undefined) out.refundability = rp.Refundability;
  if (rp.RatePlanDescription?.Text !== undefined)
    out.description = [...rp.RatePlanDescription.Text];
  if (rp.RatePlanInclusions?.RatePlanInclusion !== undefined) {
    out.inclusions = rp.RatePlanInclusions.RatePlanInclusion.map(mapRatePlanInclusion);
  }
  if (rp.MealsIncluded !== undefined) out.mealsIncluded = mapMeals(rp.MealsIncluded);
  if (rp.RateInfo !== undefined) out.rateInfo = mapRoomRateInfo(rp.RateInfo);
  if (rp.ConvertedRateInfo !== undefined)
    out.convertedRateInfo = mapRoomRateInfo(rp.ConvertedRateInfo);
  return out;
}

function mapRatePlanInclusion(
  i: NonNullable<components['schemas']['RatePlanInclusion']>[number],
): PriceCheckRatePlanInclusion {
  const out: PriceCheckRatePlanInclusion = {};
  if (i.Code !== undefined) out.code = i.Code;
  if (i.Description !== undefined) out.description = i.Description;
  if (i.Text !== undefined) out.text = [...i.Text];
  return out;
}

function mapMeals(m: NonNullable<components['schemas']['MealsIncluded']>): PriceCheckMealsIncluded {
  const out: PriceCheckMealsIncluded = {};
  if (m.BreakFast !== undefined) out.breakfast = m.BreakFast;
  if (m.Lunch !== undefined) out.lunch = m.Lunch;
  if (m.Dinner !== undefined) out.dinner = m.Dinner;
  if (m.MealPlanIndicator !== undefined) out.mealPlanIndicator = m.MealPlanIndicator;
  if (m.MealPlanCode !== undefined) out.mealPlanCode = m.MealPlanCode;
  if (m.MealPlanDescription !== undefined) out.mealPlanDescription = m.MealPlanDescription;
  if (m.GuestCount !== undefined) out.guestCount = m.GuestCount;
  return out;
}

function mapRoomRateInfo(
  rri: NonNullable<components['schemas']['Room.RateInfo']>,
): PriceCheckRoomRateInfo {
  const out: PriceCheckRoomRateInfo = {
    cancelPenalties: (rri.CancelPenalties.CancelPenalty ?? []).map(mapCancelPenalty),
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

function mapRate(r: NonNullable<components['schemas']['Rate']>[number]): PriceCheckRate {
  const out: PriceCheckRate = {};
  if (r.StartDate !== undefined) out.startDate = r.StartDate;
  if (r.EndDate !== undefined) out.endDate = r.EndDate;
  if (r.AmountBeforeTax !== undefined) out.amountBeforeTax = r.AmountBeforeTax;
  if (r.AmountAfterTax !== undefined) out.amountAfterTax = r.AmountAfterTax;
  if (r.CurrencyCode !== undefined) out.currencyCode = r.CurrencyCode;
  return out;
}

function mapTaxes(t: NonNullable<components['schemas']['Taxes']>): PriceCheckTaxes | undefined {
  const out: PriceCheckTaxes = {};
  if (t.Amount !== undefined) out.amount = t.Amount;
  if (t.CurrencyCode !== undefined) out.currencyCode = t.CurrencyCode;
  if (t.Tax !== undefined) out.taxes = t.Tax.map(mapTax);
  if (t.TaxGroups?.TaxGroup !== undefined) out.taxGroups = t.TaxGroups.TaxGroup.map(mapTaxGroup);
  return Object.keys(out).length > 0 ? out : undefined;
}

function mapTax(t: NonNullable<components['schemas']['Tax']>[number]): PriceCheckTax {
  const out: PriceCheckTax = { amount: t.Amount, currencyCode: t.CurrencyCode };
  if (t.StartDate !== undefined) out.startDate = t.StartDate;
  if (t.EndDate !== undefined) out.endDate = t.EndDate;
  return out;
}

function mapTaxGroup(
  g: NonNullable<components['schemas']['TaxGroup']>[number],
): PriceCheckTaxGroup {
  const out: PriceCheckTaxGroup = {
    code: g.Code,
    amount: g.Amount,
    currencyCode: g.CurrencyCode,
  };
  if (g.Description !== undefined) out.description = g.Description;
  if (g.TaxDescription?.Text !== undefined) out.descriptionText = [...g.TaxDescription.Text];
  return out;
}

function mapFees(f: NonNullable<components['schemas']['Fees']>): PriceCheckFees | undefined {
  const out: PriceCheckFees = {};
  if (f.Amount !== undefined) out.amount = f.Amount;
  if (f.CurrencyCode !== undefined) out.currencyCode = f.CurrencyCode;
  if (f.Fee !== undefined) out.fees = f.Fee.map(mapFee);
  if (f.FeeGroups?.FeeGroup !== undefined) out.feeGroups = f.FeeGroups.FeeGroup.map(mapFeeGroup);
  return Object.keys(out).length > 0 ? out : undefined;
}

function mapFee(f: NonNullable<components['schemas']['Fee']>[number]): PriceCheckFee {
  const out: PriceCheckFee = { amount: f.Amount, currencyCode: f.CurrencyCode };
  if (f.StartDate !== undefined) out.startDate = f.StartDate;
  if (f.EndDate !== undefined) out.endDate = f.EndDate;
  return out;
}

function mapFeeGroup(
  g: NonNullable<components['schemas']['FeeGroup']>[number],
): PriceCheckFeeGroup {
  const out: PriceCheckFeeGroup = {
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
): PriceCheckRoomExtra {
  const out: PriceCheckRoomExtra = {};
  if (e.Code !== undefined) out.code = e.Code;
  if (e.Description !== undefined) out.description = e.Description;
  if (e.Amount !== undefined) out.amount = e.Amount;
  if (e.CurrencyCode !== undefined) out.currencyCode = e.CurrencyCode;
  if (e.Text !== undefined) out.text = e.Text;
  return out;
}

function mapCancelPenalty(
  p: NonNullable<components['schemas']['CancelPenalty']>[number],
): PriceCheckCancelPenalty {
  const out: PriceCheckCancelPenalty = { refundable: p.Refundable };
  if (p.Deadline !== undefined) out.deadline = mapDeadline(p.Deadline);
  if (p.AmountPercent !== undefined) out.amountPercent = mapAmountPercent(p.AmountPercent);
  if (p.PenaltyDescription !== undefined) out.descriptionText = p.PenaltyDescription.Text;
  return out;
}

function mapDeadline(d: NonNullable<components['schemas']['Deadline']>): PriceCheckDeadline {
  const out: PriceCheckDeadline = {};
  if (d.AbsoluteDeadline !== undefined) out.absoluteDeadline = d.AbsoluteDeadline;
  if (d.OffsetTimeUnit !== undefined) out.offsetTimeUnit = d.OffsetTimeUnit;
  if (d.OffsetUnitMultiplier !== undefined) out.offsetUnitMultiplier = d.OffsetUnitMultiplier;
  if (d.OffsetDropTime !== undefined) {
    out.offsetDropTime = d.OffsetDropTime as PriceCheckDeadline['offsetDropTime'];
  }
  return out;
}

function mapAmountPercent(
  a: NonNullable<components['schemas']['AmountPercent']>,
): PriceCheckAmountPercent {
  const out: PriceCheckAmountPercent = {};
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

function mapGuarantee(g: NonNullable<components['schemas']['Guarantee']>): PriceCheckGuarantee {
  const out: PriceCheckGuarantee = {
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
): PriceCheckGuaranteeAccepted {
  const out: PriceCheckGuaranteeAccepted = {};
  if (ga.GuaranteeTypeCode !== undefined) out.typeCode = ga.GuaranteeTypeCode;
  if (ga.GuaranteeTypeDescription !== undefined) out.typeDescription = ga.GuaranteeTypeDescription;
  if (ga.PaymentCards !== undefined) {
    const cards: PriceCheckPaymentCard[] = (ga.PaymentCards.PaymentCard ?? []).map((c) => {
      const card: PriceCheckPaymentCard = { code: c.CardCode };
      if (c.value !== undefined) card.value = c.value;
      return card;
    });
    const list: NonNullable<PriceCheckGuaranteeAccepted['paymentCards']> = { cards };
    if (ga.PaymentCards.CVVRequired !== undefined) list.cvvRequired = ga.PaymentCards.CVVRequired;
    out.paymentCards = list;
  }
  return out;
}

function mapDepositPolicy(
  dp: NonNullable<components['schemas']['DepositPolicy']>[number],
): PriceCheckDepositPolicy {
  const out: PriceCheckDepositPolicy = {};
  if (dp.Deadline !== undefined) out.deadline = mapDeadline(dp.Deadline);
  if (dp.AmountPercent !== undefined) out.amountPercent = mapAmountPercent(dp.AmountPercent);
  return out;
}

function mapApplicationResults(
  ar: NonNullable<components['schemas']['ApplicationResults']>,
): PriceCheckApplicationResults | undefined {
  const out: PriceCheckApplicationResults = {};
  if (ar.status !== undefined) out.status = ar.status as PriceCheckApplicationResults['status'];
  if (ar.Success !== undefined) out.success = ar.Success.map(mapElement);
  if (ar.Error !== undefined) out.errors = ar.Error.map(mapElement);
  if (ar.Warning !== undefined) out.warnings = ar.Warning.map(mapElement);
  return Object.keys(out).length > 0 ? out : undefined;
}

function mapElement(
  e: NonNullable<components['schemas']['ElementStructure']>[number],
): PriceCheckApplicationResultEntry {
  const out: PriceCheckApplicationResultEntry = {};
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

function mapSystemSpecificResult(r: GeneratedSystemSpecificResult): PriceCheckSystemSpecificResult {
  const out: PriceCheckSystemSpecificResult = {};
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
