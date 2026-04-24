import { SabreParseError } from '../../errors/sabre-parse-error.js';
import type { components } from '../../generated/get-ancillaries.js';
import { ensureTrailingSlash } from '../../http/ensure-trailing-slash.js';
import type { SabreRequest, SabreResponse } from '../../http/types.js';
import type {
  AncillaryCabinUpgrade,
  AncillaryDescription,
  AncillaryError,
  AncillaryFlightLeg,
  AncillaryInputRequirements,
  AncillaryOfferItem,
  AncillaryPassenger,
  AncillaryPatternVariable,
  AncillaryPrice,
  AncillaryPriceDefinition,
  AncillarySegment,
  AncillaryServiceDefinition,
  AncillaryServiceFee,
  AncillaryTax,
  AncillaryTaxSummary,
  AncillaryWarning,
  GetAncillariesInput,
  GetAncillariesOutput,
} from './types.js';

const PATH = '/v2/offers/getAncillaries';

/**
 * Builds the outgoing {@link SabreRequest} for the `getAncillaries`
 * operation.
 *
 * The request body is a `ServiceListOrderRequest` with `requestType:
 * 'orderId'` and the order details under `request`.
 */
export function toGetAncillariesRequest(baseUrl: string, input: GetAncillariesInput): SabreRequest {
  const url = new URL(PATH, ensureTrailingSlash(baseUrl));

  const request: Record<string, unknown> = {
    orderId: input.orderId,
  };
  if (input.segmentRefs && input.segmentRefs.length > 0) {
    request.requestedSegmentRefs = input.segmentRefs;
  }
  if (input.passengerRefs && input.passengerRefs.length > 0) {
    request.requestedPaxRefs = input.passengerRefs;
  }
  if (input.groupCode !== undefined) {
    request.groupCode = input.groupCode;
  }

  return {
    method: 'POST',
    url: url.toString(),
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      requestType: 'orderId',
      request,
    }),
  };
}

/**
 * Parses the `getAncillaries` response into the public output shape.
 *
 * Throws {@link SabreParseError} when the body is not valid JSON or
 * not an object.
 */
export function fromGetAncillariesResponse(res: SabreResponse): GetAncillariesOutput {
  let parsed: components['schemas']['ServiceList'];
  try {
    parsed = JSON.parse(res.body) as components['schemas']['ServiceList'];
  } catch (err) {
    throw new SabreParseError('Failed to parse Get Ancillaries response as JSON', res.body, {
      cause: err,
    });
  }

  if (parsed === null || typeof parsed !== 'object') {
    throw new SabreParseError('Get Ancillaries response was not a JSON object', parsed);
  }

  const ancillaries = parsed.ancillaries;

  const segments: AncillarySegment[] = (ancillaries?.segments ?? []).map(buildSegment);
  const passengers: AncillaryPassenger[] = (ancillaries?.passengers ?? []).map(buildPassenger);

  const offerId = ancillaries?.offer?.offerId;

  const offerItems: AncillaryOfferItem[] = (ancillaries?.offer?.otherServices ?? []).map(
    buildOfferItem,
  );

  const serviceDefinitions: AncillaryServiceDefinition[] = (
    ancillaries?.serviceDefinitions ?? []
  ).map(buildServiceDefinition);

  const priceDefinitions: AncillaryPriceDefinition[] = (ancillaries?.priceDefinitions ?? []).map(
    buildPriceDefinition,
  );

  const errors: AncillaryError[] = (parsed.errors ?? []).map(buildError);
  const warnings: AncillaryWarning[] = (parsed.warnings ?? []).map(buildWarning);

  const out: GetAncillariesOutput = {
    segments,
    passengers,
    offerItems,
    serviceDefinitions,
    priceDefinitions,
    errors,
    warnings,
  };
  if (offerId !== undefined) out.offerId = offerId;
  return out;
}

// ---------------------------------------------------------------------------
// Internal builder helpers
// ---------------------------------------------------------------------------

function buildSegment(seg: components['schemas']['Segment']): AncillarySegment {
  const out: AncillarySegment = {
    flightLegs: (seg.flightLegs ?? []).map(buildFlightLeg),
  };
  if (seg.id !== undefined) out.id = seg.id;
  if (seg.bookingAirlineCode !== undefined) out.bookingAirlineCode = seg.bookingAirlineCode;
  if (typeof seg.bookingFlightNumber === 'number')
    out.bookingFlightNumber = seg.bookingFlightNumber;
  if (seg.departureAirportCode !== undefined) out.departureAirportCode = seg.departureAirportCode;
  if (seg.arrivalAirportCode !== undefined) out.arrivalAirportCode = seg.arrivalAirportCode;
  if (seg.departureDate !== undefined) out.departureDate = seg.departureDate;
  if (seg.departureTime !== undefined) out.departureTime = seg.departureTime;
  if (seg.arrivalDate !== undefined) out.arrivalDate = seg.arrivalDate;
  if (seg.arrivalTime !== undefined) out.arrivalTime = seg.arrivalTime;
  if (seg.operatingAirlineCode !== undefined) out.operatingAirlineCode = seg.operatingAirlineCode;
  if (typeof seg.operatingFlightNumber === 'number')
    out.operatingFlightNumber = seg.operatingFlightNumber;
  if (seg.bookingClassCode !== undefined) out.bookingClassCode = seg.bookingClassCode;
  if (seg.operatingBookingClassCode !== undefined)
    out.operatingBookingClassCode = seg.operatingBookingClassCode;
  if (seg.cabinCode !== undefined) out.cabinCode = seg.cabinCode;
  if (seg.reservationStatus !== undefined) out.reservationStatus = seg.reservationStatus;
  if (seg.isChangeOfGauge !== undefined) out.isChangeOfGauge = seg.isChangeOfGauge;
  return out;
}

function buildFlightLeg(leg: components['schemas']['FlightLeg']): AncillaryFlightLeg {
  const out: AncillaryFlightLeg = {};
  if (leg.legId !== undefined) out.legId = leg.legId;
  if (leg.departureAirportCode !== undefined) out.departureAirportCode = leg.departureAirportCode;
  if (leg.arrivalAirportCode !== undefined) out.arrivalAirportCode = leg.arrivalAirportCode;
  if (leg.equipmentCode !== undefined) out.equipmentCode = leg.equipmentCode;
  return out;
}

function buildPassenger(pax: components['schemas']['Passenger']): AncillaryPassenger {
  const out: AncillaryPassenger = {};
  if (pax.passengerId !== undefined) out.passengerId = pax.passengerId;
  if (pax.passengerTypeCode !== undefined) out.passengerTypeCode = pax.passengerTypeCode;
  if (pax.title !== undefined) out.title = pax.title;
  if (pax.givenName !== undefined) out.givenName = pax.givenName;
  if (pax.middleName !== undefined) out.middleName = pax.middleName;
  if (pax.surname !== undefined) out.surname = pax.surname;
  if (pax.suffixName !== undefined) out.suffixName = pax.suffixName;
  return out;
}

function buildOfferItem(item: components['schemas']['OfferItem']): AncillaryOfferItem {
  const out: AncillaryOfferItem = {
    segmentRefs: item.segmentRefs ?? [],
    passengerRefs: item.passengerRefs ?? [],
  };
  if (item.offerItemId !== undefined) out.offerItemId = item.offerItemId;
  if (item.serviceDefinitionRef !== undefined) out.serviceDefinitionRef = item.serviceDefinitionRef;
  if (item.priceDefinitionRef !== undefined) out.priceDefinitionRef = item.priceDefinitionRef;
  return out;
}

function buildServiceDefinition(
  def: components['schemas']['ServiceDefinition'],
): AncillaryServiceDefinition {
  const out: AncillaryServiceDefinition = {
    descriptions: (def.descriptionFreeText ?? []).map(buildDescription),
  };
  if (def.id !== undefined) out.id = def.id;
  if (def.serviceCode !== undefined) out.serviceCode = def.serviceCode;
  if (def.airlineCode !== undefined) out.airlineCode = def.airlineCode;
  if (def.commercialName !== undefined) out.commercialName = def.commercialName;
  if (def.groupCode !== undefined) out.groupCode = def.groupCode;
  if (def.subGroup !== undefined) out.subGroup = def.subGroup;
  if (def.reasonForIssuance !== undefined) out.reasonForIssuance = def.reasonForIssuance;
  if (typeof def.upToWeightLimitInKilograms === 'number')
    out.upToWeightLimitInKilograms = def.upToWeightLimitInKilograms;
  if (typeof def.upToWeightLimitInPounds === 'number')
    out.upToWeightLimitInPounds = def.upToWeightLimitInPounds;
  if (typeof def.maximumQuantity === 'number') out.maximumQuantity = def.maximumQuantity;
  if (def.bookingMethod !== undefined) out.bookingMethod = def.bookingMethod;
  if (def.settlementMethodCode !== undefined) out.settlementMethodCode = def.settlementMethodCode;
  if (def.ownerCode !== undefined) out.ownerCode = def.ownerCode;
  if (def.ancillaryBagDescriptionCode !== undefined)
    out.ancillaryBagDescriptionCode = def.ancillaryBagDescriptionCode;
  if (def.additionalInputRequirements !== undefined)
    out.additionalInputRequirements = buildInputRequirements(def.additionalInputRequirements);
  if (def.cabinUpgrade != null) out.cabinUpgrade = buildCabinUpgrade(def.cabinUpgrade);
  return out;
}

function buildDescription(
  desc: components['schemas']['DescriptionFreeText'],
): AncillaryDescription {
  const out: AncillaryDescription = {};
  if (desc.id !== undefined) out.id = desc.id;
  if (desc.text !== undefined) out.text = desc.text;
  return out;
}

function buildInputRequirements(
  req: components['schemas']['AdditionalInputRequirements'],
): AncillaryInputRequirements {
  return {
    pattern: req.pattern,
    variables: (req.variables ?? []).map(buildPatternVariable),
  };
}

function buildPatternVariable(
  v: components['schemas']['AdditionalInputPatternVariable'],
): AncillaryPatternVariable {
  const out: AncillaryPatternVariable = {};
  if (v.key !== undefined) out.key = v.key;
  if (v.value !== undefined) out.value = v.value;
  if (v.description !== undefined) out.description = v.description;
  return out;
}

function buildCabinUpgrade(
  cu: NonNullable<components['schemas']['ServiceCabinUpgrade']>,
): AncillaryCabinUpgrade {
  const out: AncillaryCabinUpgrade = {};
  if (cu.methodCode !== undefined) out.methodCode = cu.methodCode;
  if (cu.reservationBookingDesignator !== undefined)
    out.reservationBookingDesignator = cu.reservationBookingDesignator;
  return out;
}

function buildPriceDefinition(
  pd: components['schemas']['PriceDefinition'],
): AncillaryPriceDefinition {
  const out: AncillaryPriceDefinition = {};
  if (pd.id !== undefined) out.id = pd.id;
  if (pd.serviceFee !== undefined) out.serviceFee = buildServiceFee(pd.serviceFee);
  if (pd.baseFee !== undefined) out.baseFee = buildServiceFee(pd.baseFee);
  return out;
}

function buildServiceFee(fee: components['schemas']['ServiceFee']): AncillaryServiceFee {
  const out: AncillaryServiceFee = {};
  if (fee.unitPrice !== undefined) out.unitPrice = buildPrice(fee.unitPrice);
  if (fee.totalPrice !== undefined) out.totalPrice = buildPrice(fee.totalPrice);
  return out;
}

function buildPrice(pe: components['schemas']['PriceElement']): AncillaryPrice {
  const out: AncillaryPrice = {};
  if (pe.saleAmount !== undefined) out.saleAmount = buildAmount(pe.saleAmount);
  if (pe.amount !== undefined) out.amount = buildAmount(pe.amount);
  if (pe.ancillaryRecordAmount !== undefined)
    out.ancillaryRecordAmount = buildAmount(pe.ancillaryRecordAmount);
  if (pe.taxSummary !== undefined) out.taxSummary = buildTaxSummary(pe.taxSummary);
  return out;
}

function buildAmount(a: components['schemas']['Amount']): {
  amount?: string;
  currencyCode?: string;
} {
  const out: { amount?: string; currencyCode?: string } = {};
  if (a.amount !== undefined) out.amount = a.amount;
  if (a.currencyCode !== undefined) out.currencyCode = a.currencyCode;
  return out;
}

function buildTaxSummary(ts: components['schemas']['TaxSummary']): AncillaryTaxSummary {
  const out: AncillaryTaxSummary = {
    taxes: (ts.taxes ?? []).map(buildTax),
  };
  if (ts.taxesTotal !== undefined) out.taxesTotal = buildAmount(ts.taxesTotal);
  if (ts.isTaxExempt !== undefined) out.isTaxExempt = ts.isTaxExempt;
  return out;
}

function buildTax(t: components['schemas']['TaxType']): AncillaryTax {
  const out: AncillaryTax = {};
  if (t.taxAmount !== undefined) out.taxAmount = buildAmount(t.taxAmount);
  if (t.taxCode !== undefined) out.taxCode = t.taxCode;
  if (t.taxDescription !== undefined) out.taxDescription = t.taxDescription;
  return out;
}

function buildError(e: components['schemas']['Error']): AncillaryError {
  const out: AncillaryError = {
    tagText: e.tagText ?? [],
  };
  if (e.code !== undefined) out.code = e.code;
  if (e.descriptionText !== undefined) out.descriptionText = e.descriptionText;
  if (e.languageCode !== undefined) out.languageCode = e.languageCode;
  if (e.ownerName !== undefined) out.ownerName = e.ownerName;
  if (e.statusText !== undefined) out.statusText = e.statusText;
  if (e.typeCode !== undefined) out.typeCode = e.typeCode;
  if (e.url !== undefined) out.url = e.url;
  return out;
}

function buildWarning(w: components['schemas']['Warning']): AncillaryWarning {
  const out: AncillaryWarning = {};
  if (w.code !== undefined) out.code = w.code;
  if (w.descriptionText !== undefined) out.descriptionText = w.descriptionText;
  if (w.ownerName !== undefined) out.ownerName = w.ownerName;
  return out;
}
