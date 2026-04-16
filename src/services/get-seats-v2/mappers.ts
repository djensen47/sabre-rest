import { SabreParseError } from '../../errors/sabre-parse-error.js';
import type { components } from '../../generated/get-seats.js';
import type { SabreRequest, SabreResponse } from '../../http/types.js';
import type {
  GetSeatsInput,
  GetSeatsOfferInput,
  GetSeatsOrderInput,
  GetSeatsOutput,
  GetSeatsPayloadInput,
  GetSeatsStatelessInput,
  Seat,
  SeatALaCarteOffer,
  SeatALaCarteOfferItem,
  SeatALaCarteOfferService,
  SeatAirportAndAddress,
  SeatAmount,
  SeatBilateralProcessTimeLimit,
  SeatBookingInstructions,
  SeatCabinCompartment,
  SeatCabinLayout,
  SeatCabinLayoutColumn,
  SeatCabinLayoutRowPosition,
  SeatCabinType,
  SeatCarrierAircraftType,
  SeatCharacteristic,
  SeatDataLists,
  SeatDatedOperatingLeg,
  SeatDescription,
  SeatDiscount,
  SeatDiscountContext,
  SeatEligibility,
  SeatError,
  SeatFacility,
  SeatFee,
  SeatFlightAssociations,
  SeatFulfillment,
  SeatFulfillmentLocation,
  SeatFulfillmentPartner,
  SeatKeyWord,
  SeatLoyaltyAccountRS,
  SeatMap,
  SeatMarketingCarrier,
  SeatMeasure,
  SeatOfferValidDates,
  SeatOperatingCarrier,
  SeatOriginDestRS,
  SeatPaxJourneyRS,
  SeatPaxRS,
  SeatPaxSegmentRS,
  SeatPayloadAttributes,
  SeatPrice,
  SeatProfile,
  SeatPtcOfferParameters,
  SeatRow,
  SeatRowCharacteristic,
  SeatServiceCombination,
  SeatServiceCoupon,
  SeatServiceDefinition,
  SeatServiceDefinitionAssociation,
  SeatServiceDefinitionDetail,
  SeatServiceFulfillment,
  SeatServiceId,
  SeatServiceItemQuantityRules,
  SeatShoppingResponse,
  SeatStructuredAddress,
  SeatSurcharge,
  SeatTax,
  SeatTaxSummary,
  SeatTransportRS,
  SeatUpgradeMethod,
  SeatWarning,
} from './types.js';

const PATH = '/v1/offers/getseats';

/**
 * Builds the outgoing {@link SabreRequest} for the `getSeats` operation.
 *
 * The request body shape varies by `input.requestType`. The function
 * switches on the discriminant to build the correct wire format.
 */
export function toGetSeatsRequest(baseUrl: string, input: GetSeatsInput): SabreRequest {
  const url = new URL(PATH, ensureTrailingSlash(baseUrl));

  let body: Record<string, unknown>;

  switch (input.requestType) {
    case 'offerId':
      body = buildOfferIdBody(input);
      break;
    case 'orderId':
      body = buildOrderIdBody(input);
      break;
    case 'payload':
      body = buildPayloadBody(input);
      break;
    case 'stateless':
      body = buildStatelessBody(input);
      break;
  }

  return {
    method: 'POST',
    url: url.toString(),
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  };
}

/**
 * Parses the `getSeats` response into the public output shape.
 *
 * Throws {@link SabreParseError} when the body is not valid JSON or
 * not an object.
 */
export function fromGetSeatsResponse(res: SabreResponse): GetSeatsOutput {
  let parsed: components['schemas']['SeatAvailabilityRS'];
  try {
    parsed = JSON.parse(res.body) as components['schemas']['SeatAvailabilityRS'];
  } catch (err) {
    throw new SabreParseError('Failed to parse Get Seats response as JSON', res.body, {
      cause: err,
    });
  }

  if (parsed === null || typeof parsed !== 'object') {
    throw new SabreParseError('Get Seats response was not a JSON object', parsed);
  }

  const response = parsed.response;

  const seatMaps: SeatMap[] = (response?.seatMaps ?? []).map(buildSeatMap);
  const aLaCarteOffer =
    response?.aLaCarteOffer !== undefined ? buildALaCarteOffer(response.aLaCarteOffer) : undefined;
  const dataLists =
    response?.dataLists !== undefined ? buildDataLists(response.dataLists) : undefined;
  const shoppingResponse =
    response?.shoppingResponse !== undefined
      ? buildShoppingResponse(response.shoppingResponse)
      : undefined;
  const payloadAttributes =
    parsed.payloadAttributes !== undefined
      ? buildPayloadAttributes(parsed.payloadAttributes)
      : undefined;
  const errors: SeatError[] = (parsed.errors ?? []).map(buildError);
  const warnings: SeatWarning[] = (parsed.warnings ?? []).map(buildWarning);

  const out: GetSeatsOutput = {
    seatMaps,
    errors,
    warnings,
  };
  if (aLaCarteOffer !== undefined) out.aLaCarteOffer = aLaCarteOffer;
  if (dataLists !== undefined) out.dataLists = dataLists;
  if (shoppingResponse !== undefined) out.shoppingResponse = shoppingResponse;
  if (payloadAttributes !== undefined) out.payloadAttributes = payloadAttributes;
  return out;
}

// ---------------------------------------------------------------------------
// Request body builders
// ---------------------------------------------------------------------------

function buildOfferIdBody(input: GetSeatsOfferInput): Record<string, unknown> {
  const request: Record<string, unknown> = {
    offer: { offerId: input.offerId },
  };
  if (input.passengers && input.passengers.length > 0) {
    request.paxes = input.passengers.map((p) => {
      const pax: Record<string, unknown> = { paxID: p.paxId };
      if (p.givenName !== undefined) pax.givenName = p.givenName;
      if (p.surname !== undefined) pax.surname = p.surname;
      if (p.loyaltyProgramAccounts && p.loyaltyProgramAccounts.length > 0) {
        pax.loyaltyProgramAccount = p.loyaltyProgramAccounts.map(buildLoyaltyAccountBody);
      }
      return pax;
    });
  }

  const body: Record<string, unknown> = {
    requestType: 'offerId',
    pointOfSale: buildPointOfSaleBody(input.pointOfSale),
    request,
  };
  if (input.payloadAttributes !== undefined) {
    body.payloadAttributes = buildPayloadAttributesBody(input.payloadAttributes);
  }
  return body;
}

function buildOrderIdBody(input: GetSeatsOrderInput): Record<string, unknown> {
  const body: Record<string, unknown> = {
    requestType: 'orderId',
    pointOfSale: buildPointOfSaleBody(input.pointOfSale),
    request: {
      order: { orderId: input.orderId },
    },
  };
  if (input.payloadAttributes !== undefined) {
    body.payloadAttributes = buildPayloadAttributesBody(input.payloadAttributes);
  }
  return body;
}

function buildPayloadBody(input: GetSeatsPayloadInput): Record<string, unknown> {
  const request: Record<string, unknown> = {
    paxSegmentRefIds: input.segmentRefIds,
    originDest: {
      paxJourney: {
        paxSegments: input.originDest.paxJourney.paxSegments.map((seg) => {
          const s: Record<string, unknown> = {
            paxSegmentId: seg.paxSegmentId,
            departure: {
              locationCode: seg.departure.locationCode,
              aircraftScheduledDate: { date: seg.departure.date },
            },
            arrival: {
              locationCode: seg.arrival.locationCode,
              aircraftScheduledDate: { date: seg.arrival.date },
            },
            marketingCarrierInfo: buildCarrierInfoBody(seg.marketingCarrierInfo),
          };
          if (seg.operatingCarrierInfo !== undefined) {
            s.operatingCarrierInfo = buildCarrierInfoBody(seg.operatingCarrierInfo);
          }
          if (seg.cabinType !== undefined) {
            s.cabinType = buildCabinTypeBody(seg.cabinType);
          }
          return s;
        }),
      },
    },
    paxes: input.passengers.map((p) => {
      const pax: Record<string, unknown> = {
        paxID: p.paxId,
        ptc: p.ptc,
      };
      if (p.birthday !== undefined) pax.birthday = p.birthday;
      if (p.givenName !== undefined) pax.givenName = p.givenName;
      if (p.surname !== undefined) pax.surname = p.surname;
      if (p.accompaniedByInfant !== undefined) pax.accompaniedByInfant = p.accompaniedByInfant;
      if (p.fareComponentsAndSegmentIds && p.fareComponentsAndSegmentIds.length > 0) {
        pax.fareComponentsAndSegmentId = p.fareComponentsAndSegmentIds.map((link) => ({
          segmentRefId: link.segmentRefId,
          fareComponentRefId: link.fareComponentRefId,
        }));
      }
      if (p.loyaltyProgramAccounts && p.loyaltyProgramAccounts.length > 0) {
        pax.loyaltyProgramAccount = p.loyaltyProgramAccounts.map(buildLoyaltyAccountBody);
      }
      if (p.customAttributes && p.customAttributes.length > 0) {
        pax.customAttributes = p.customAttributes.map((a) => ({
          key: a.key,
          value: a.value,
        }));
      }
      return pax;
    }),
  };

  if (input.fareComponents && input.fareComponents.length > 0) {
    request.fareComponents = input.fareComponents.map(buildFareComponentBody);
  }
  if (input.currency !== undefined) request.currency = input.currency;
  if (input.dataBin !== undefined) request.dataBin = input.dataBin;
  if (input.customAttributes && input.customAttributes.length > 0) {
    request.customAttributes = input.customAttributes.map((a) => ({
      key: a.key,
      value: a.value,
    }));
  }

  const body: Record<string, unknown> = {
    requestType: 'payload',
    request,
    requestMode: input.requestMode ?? 'BOOKING',
  };
  if (input.payloadAttributes !== undefined) {
    body.payloadAttributes = buildPayloadAttributesBody(input.payloadAttributes);
  }
  return body;
}

function buildStatelessBody(input: GetSeatsStatelessInput): Record<string, unknown> {
  const request: Record<string, unknown> = {
    pnrLocator: input.pnrLocator,
  };
  if (input.dataBin !== undefined) request.dataBin = input.dataBin;
  if (input.customAttributes && input.customAttributes.length > 0) {
    request.customAttributes = input.customAttributes.map((a) => ({
      key: a.key,
      value: a.value,
    }));
  }

  const body: Record<string, unknown> = {
    requestType: 'stateless',
    request,
    requestMode: input.requestMode ?? 'BOOKING',
  };
  if (input.payloadAttributes !== undefined) {
    body.payloadAttributes = buildPayloadAttributesBody(input.payloadAttributes);
  }
  return body;
}

function buildPointOfSaleBody(pos: GetSeatsOfferInput['pointOfSale']): Record<string, unknown> {
  const out: Record<string, unknown> = {
    location: {
      countryCode: pos.countryCode,
      cityCode: pos.cityCode,
    },
  };
  if (pos.agentDutyCode !== undefined) out.agentDutyCode = pos.agentDutyCode;
  return out;
}

function buildPayloadAttributesBody(
  attrs: NonNullable<GetSeatsInput['payloadAttributes']>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (attrs.echoTokenText !== undefined) out.echoTokenText = attrs.echoTokenText;
  if (attrs.timeStamp !== undefined) out.timeStamp = attrs.timeStamp;
  if (attrs.transactionId !== undefined) out.transactionID = attrs.transactionId;
  if (attrs.correlationId !== undefined) out.correlationID = attrs.correlationId;
  return out;
}

function buildLoyaltyAccountBody(acct: {
  airline: string;
  accountNumber: string;
  tierPriority?: string;
  partnerProgram?: string;
}): Record<string, unknown> {
  const out: Record<string, unknown> = {
    airline: acct.airline,
    accountNumber: acct.accountNumber,
  };
  if (acct.tierPriority !== undefined) out.tierPriority = acct.tierPriority;
  if (acct.partnerProgram !== undefined) out.partnerProgram = acct.partnerProgram;
  return out;
}

function buildCarrierInfoBody(info: {
  carrierCode: string;
  carrierFlightNumber: string;
  bookingCode?: string;
}): Record<string, unknown> {
  const out: Record<string, unknown> = {
    carrierCode: info.carrierCode,
    carrierFlightNumber: info.carrierFlightNumber,
  };
  if (info.bookingCode !== undefined) out.bookingCode = info.bookingCode;
  return out;
}

function buildCabinTypeBody(ct: { cabinTypeCode?: string; cabinTypeName?: string }): Record<
  string,
  unknown
> {
  const out: Record<string, unknown> = {};
  if (ct.cabinTypeCode !== undefined) out.cabinTypeCode = ct.cabinTypeCode;
  if (ct.cabinTypeName !== undefined) out.cabinTypeName = ct.cabinTypeName;
  return out;
}

function buildFareComponentBody(fc: {
  fareComponentId: string;
  fareBasisCode: string;
  governingCarrier?: string;
  vendorCode?: string;
  priceAmount?: number;
  brandCode?: string;
  fareDetail?: {
    fareType?: string;
    fareTariff?: string;
    fareRule?: string;
    fareIndicator?: number;
    fareTypeBitmap?: string;
    privateTariffIndicator?: boolean;
  };
}): Record<string, unknown> {
  const out: Record<string, unknown> = {
    fareComponentId: fc.fareComponentId,
    fareBasis: { fareBasisCode: fc.fareBasisCode },
  };
  if (fc.governingCarrier !== undefined) out.governingCarrier = fc.governingCarrier;
  if (fc.vendorCode !== undefined) out.vendorCode = fc.vendorCode;
  if (fc.priceAmount !== undefined) out.price = { amount: fc.priceAmount };
  if (fc.brandCode !== undefined) out.brand = { code: fc.brandCode };
  if (fc.fareDetail !== undefined) {
    const detail: Record<string, unknown> = {};
    if (fc.fareDetail.fareType !== undefined) detail.fareType = fc.fareDetail.fareType;
    if (fc.fareDetail.fareTariff !== undefined) detail.fareTariff = fc.fareDetail.fareTariff;
    if (fc.fareDetail.fareRule !== undefined) detail.fareRule = fc.fareDetail.fareRule;
    if (fc.fareDetail.fareIndicator !== undefined)
      detail.fareIndicator = fc.fareDetail.fareIndicator;
    if (fc.fareDetail.fareTypeBitmap !== undefined)
      detail.fareTypeBitmap = fc.fareDetail.fareTypeBitmap;
    if (fc.fareDetail.privateTariffIndicator !== undefined)
      detail.privateTariffIndicator = fc.fareDetail.privateTariffIndicator;
    out.fareDetail = detail;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Response builder helpers
// ---------------------------------------------------------------------------

function buildSeatMap(raw: components['schemas']['SeatMap']): SeatMap {
  const out: SeatMap = {
    paxSegmentRefId: raw.paxSegmentRefID,
    cabinCompartments: (raw.cabinCompartments ?? []).map(buildCabinCompartment),
  };
  if (raw.datedOperatingLegRefID !== undefined)
    out.datedOperatingLegRefId = raw.datedOperatingLegRefID;
  if (raw.sellable !== undefined) out.sellable = raw.sellable;
  if (raw.changeOfGaugeNotSupported !== undefined)
    out.changeOfGaugeNotSupported = raw.changeOfGaugeNotSupported;
  return out;
}

function buildCabinCompartment(
  raw: components['schemas']['CabinCompartment'],
): SeatCabinCompartment {
  const out: SeatCabinCompartment = {
    seatRows: (raw.seatRows ?? []).map(buildSeatRow),
  };
  if (raw.deckCode !== undefined) out.deckCode = raw.deckCode;
  if (raw.firstRow !== undefined) out.firstRow = raw.firstRow;
  if (raw.lastRow !== undefined) out.lastRow = raw.lastRow;
  if (raw.columnIDs !== undefined) out.columnIds = raw.columnIDs;
  if (raw.cabinType !== undefined) out.cabinType = buildCabinType(raw.cabinType);
  if (raw.cabinLayout !== undefined) out.cabinLayout = buildCabinLayout(raw.cabinLayout);
  return out;
}

function buildCabinType(raw: components['schemas']['CabinType']): SeatCabinType {
  const out: SeatCabinType = {};
  if (raw.cabinTypeCode !== undefined) out.cabinTypeCode = raw.cabinTypeCode;
  if (raw.cabinTypeName !== undefined) out.cabinTypeName = raw.cabinTypeName;
  return out;
}

function buildCabinLayout(raw: components['schemas']['CabinLayoutType']): SeatCabinLayout {
  const out: SeatCabinLayout = {
    columns: raw.columns.map(buildCabinLayoutColumn),
    rows: buildCabinLayoutRowPosition(raw.rows),
  };
  if (raw.wingRowPosition !== undefined)
    out.wingRowPositions = raw.wingRowPosition.map(buildCabinLayoutRowPosition);
  if (raw.exitRowPosition !== undefined)
    out.exitRowPositions = raw.exitRowPosition.map(buildCabinLayoutRowPosition);
  if (raw.seatCount !== undefined) out.seatCount = raw.seatCount;
  if (raw.authorizedSeatCount !== undefined) out.authorizedSeatCount = raw.authorizedSeatCount;
  if (raw.missingRowNumbers !== undefined) out.missingRowNumbers = raw.missingRowNumbers;
  if (raw.missingSeatList !== undefined) out.missingSeatList = raw.missingSeatList;
  if (raw.facilities !== undefined) out.facilities = raw.facilities.map(buildFacility);
  return out;
}

function buildCabinLayoutColumn(
  raw: components['schemas']['CabinLayoutColumn'],
): SeatCabinLayoutColumn {
  const out: SeatCabinLayoutColumn = { id: raw.id };
  if (raw.position !== undefined) out.position = raw.position;
  return out;
}

function buildCabinLayoutRowPosition(
  raw: components['schemas']['CabinLayoutRowPosition'],
): SeatCabinLayoutRowPosition {
  return { firstRow: raw.firstRow, lastRow: raw.lastRow };
}

function buildFacility(raw: components['schemas']['Facility']): SeatFacility {
  return {
    location: {
      beginRow: raw.location.beginRow,
      endRow: raw.location.endRow,
      columnPositions: raw.location.columnPositions,
      orientation: raw.location.orientation,
    },
    facilityType: raw.facilityType,
  };
}

function buildSeatRow(raw: components['schemas']['SeatRow']): SeatRow {
  const out: SeatRow = {
    row: raw.row,
    seats: raw.seats.map(buildSeat),
  };
  if (raw.characteristics !== undefined)
    out.characteristics = raw.characteristics.map(buildRowCharacteristic);
  return out;
}

function buildRowCharacteristic(
  raw: components['schemas']['RowCharacteristic'],
): SeatRowCharacteristic {
  const out: SeatRowCharacteristic = { code: raw.code };
  if (raw.description !== undefined) out.description = raw.description;
  return out;
}

function buildSeat(raw: components['schemas']['SeatType']): Seat {
  const out: Seat = { column: raw.column };
  if (raw.occupationStatusCode !== undefined) out.occupationStatusCode = raw.occupationStatusCode;
  if (raw.characteristics !== undefined)
    out.characteristics = raw.characteristics.map(buildSeatCharacteristic);
  if (raw.seatProfileRefIDs !== undefined) out.seatProfileRefIds = raw.seatProfileRefIDs;
  if (raw.offerItemRefIDs !== undefined) out.offerItemRefIds = raw.offerItemRefIDs;
  return out;
}

function buildSeatCharacteristic(
  raw: components['schemas']['SeatCharacteristic'],
): SeatCharacteristic {
  const out: SeatCharacteristic = { code: raw.code };
  if (raw.description !== undefined) out.description = raw.description;
  return out;
}

// ---------------------------------------------------------------------------
// A-la-carte offer
// ---------------------------------------------------------------------------

function buildALaCarteOffer(raw: components['schemas']['ALaCarteOffer']): SeatALaCarteOffer {
  const out: SeatALaCarteOffer = {
    offerId: raw.offerId,
    ownerCode: raw.ownerCode,
    aLaCarteOfferItems: raw.aLaCarteOfferItems.map(buildALaCarteOfferItem),
  };
  if (raw.ownerTypeCode !== undefined) out.ownerTypeCode = raw.ownerTypeCode;
  if (raw.validatingCarrierCode !== undefined)
    out.validatingCarrierCode = raw.validatingCarrierCode;
  if (raw.requestedDateIndicator !== undefined)
    out.requestedDateIndicator = raw.requestedDateIndicator;
  if (raw.webAddressURL !== undefined) out.webAddressUrl = raw.webAddressURL;
  if (raw.redemptionIndicator !== undefined) out.redemptionIndicator = raw.redemptionIndicator;
  if (raw.matchAppText !== undefined) out.matchAppText = raw.matchAppText;
  if (raw.matchType !== undefined) out.matchType = raw.matchType;
  if (raw.matchPercent !== undefined) out.matchPercent = raw.matchPercent;
  if (raw.offerExpirationDateTime !== undefined)
    out.offerExpirationDateTime = raw.offerExpirationDateTime;
  if (raw.paymentTimeLimitDateTime !== undefined)
    out.paymentTimeLimitDateTime = raw.paymentTimeLimitDateTime;
  if (raw.paymentTimeLimitText !== undefined) out.paymentTimeLimitText = raw.paymentTimeLimitText;
  if (raw.priceGuaranteeTimeLimitDateTime !== undefined)
    out.priceGuaranteeTimeLimitDateTime = raw.priceGuaranteeTimeLimitDateTime;
  if (raw.baggageDisclosureRefID !== undefined)
    out.baggageDisclosureRefIds = raw.baggageDisclosureRefID;
  if (raw.disclosureRefID !== undefined) out.disclosureRefId = raw.disclosureRefID;
  if (raw.penaltyRefID !== undefined) out.penaltyRefIds = raw.penaltyRefID;
  if (raw.ptcOfferParameters !== undefined)
    out.ptcOfferParameters = raw.ptcOfferParameters.map(buildPtcOfferParameters);
  if (raw.totalPrice !== undefined) out.totalPrice = buildPrice(raw.totalPrice);
  return out;
}

function buildPtcOfferParameters(
  raw: components['schemas']['PtcOfferParameters'],
): SeatPtcOfferParameters {
  const out: SeatPtcOfferParameters = {};
  if (raw.ptcPricedCode !== undefined) out.ptcPricedCode = raw.ptcPricedCode;
  if (raw.ptcRequestedCode !== undefined) out.ptcRequestedCode = raw.ptcRequestedCode;
  if (raw.requestedPaxNumber !== undefined) out.requestedPaxNumber = raw.requestedPaxNumber;
  if (raw.pricedPaxNumber !== undefined) out.pricedPaxNumber = raw.pricedPaxNumber;
  return out;
}

function buildALaCarteOfferItem(
  raw: components['schemas']['ALaCarteOfferItem'],
): SeatALaCarteOfferItem {
  const out: SeatALaCarteOfferItem = {
    offerItemId: raw.offerItemID,
    unitPrice: buildPrice(raw.unitPrice),
    eligibility: buildEligibility(raw.eligibility),
  };
  if (raw.source !== undefined) out.source = raw.source;
  if (raw.service !== undefined) out.service = buildALaCarteOfferService(raw.service);
  return out;
}

function buildALaCarteOfferService(
  raw: components['schemas']['ALaCarteOfferService'],
): SeatALaCarteOfferService {
  const out: SeatALaCarteOfferService = {
    serviceId: raw.serviceId,
    serviceDefinitionRefId: raw.serviceDefinitionRefID,
  };
  if (raw.serviceRefID !== undefined) out.serviceRefId = raw.serviceRefID;
  return out;
}

function buildEligibility(raw: components['schemas']['Eligibility']): SeatEligibility {
  const out: SeatEligibility = {};
  if (raw.paxRefIDs !== undefined) out.paxRefIds = raw.paxRefIDs;
  if (raw.priceClassRefID !== undefined) out.priceClassRefIds = raw.priceClassRefID;
  if (raw.flightAssociations !== undefined)
    out.flightAssociations = buildFlightAssociations(raw.flightAssociations);
  return out;
}

function buildFlightAssociations(
  raw: NonNullable<components['schemas']['Eligibility']['flightAssociations']>,
): SeatFlightAssociations {
  const out: SeatFlightAssociations = {};
  if (raw.paxSegmentRefID !== undefined) out.paxSegmentRefIds = raw.paxSegmentRefID;
  if (raw.paxJourneyRefID !== undefined) out.paxJourneyRefIds = raw.paxJourneyRefID;
  return out;
}

// ---------------------------------------------------------------------------
// Price hierarchy
// ---------------------------------------------------------------------------

function buildPrice(raw: components['schemas']['Price']): SeatPrice {
  const out: SeatPrice = {};
  if (raw.totalAmount !== undefined) out.totalAmount = buildAmount(raw.totalAmount);
  if (raw.baseAmount !== undefined) out.baseAmount = buildAmount(raw.baseAmount);
  if (raw.equivAmount !== undefined) out.equivAmount = buildAmount(raw.equivAmount);
  if (raw.loyaltyUnitAmount !== undefined)
    out.loyaltyUnitAmount = buildAmount(raw.loyaltyUnitAmount);
  if (raw.loyaltyUnitName !== undefined) out.loyaltyUnitName = raw.loyaltyUnitName;
  if (raw.discount !== undefined) out.discount = buildDiscount(raw.discount);
  if (raw.fee !== undefined) out.fees = raw.fee.map(buildFee);
  if (raw.taxSummary !== undefined) out.taxSummary = buildTaxSummary(raw.taxSummary);
  if (raw.surcharge !== undefined) out.surcharges = raw.surcharge.map(buildSurcharge);
  return out;
}

function buildAmount(raw: components['schemas']['Amount']): SeatAmount {
  const out: SeatAmount = { amount: raw.amount };
  if (raw.currencyCode !== undefined) out.currencyCode = raw.currencyCode;
  return out;
}

function buildDiscount(raw: components['schemas']['Discount']): SeatDiscount {
  const out: SeatDiscount = {};
  if (raw.ruleId !== undefined) out.ruleId = raw.ruleId;
  if (raw.discountAmount !== undefined) out.discountAmount = buildAmount(raw.discountAmount);
  if (raw.discountPercent !== undefined) out.discountPercent = raw.discountPercent;
  if (raw.preDiscountedAmount !== undefined)
    out.preDiscountedAmount = buildAmount(raw.preDiscountedAmount);
  if (raw.appText !== undefined) out.appText = raw.appText;
  if (raw.descriptionText !== undefined) out.descriptionText = raw.descriptionText;
  if (raw.discountContext !== undefined)
    out.discountContexts = raw.discountContext.map(buildDiscountContext);
  return out;
}

function buildDiscountContext(raw: components['schemas']['DiscountContext']): SeatDiscountContext {
  const out: SeatDiscountContext = {};
  if (raw.keyWordText !== undefined) out.keyWordText = raw.keyWordText;
  if (raw.valueText !== undefined) out.valueText = raw.valueText;
  return out;
}

function buildFee(raw: components['schemas']['Fee']): SeatFee {
  const out: SeatFee = {};
  if (raw.amount !== undefined) out.amount = buildAmount(raw.amount);
  if (raw.localAmount !== undefined) out.localAmount = buildAmount(raw.localAmount);
  if (raw.designator !== undefined) out.designator = raw.designator;
  if (raw.description !== undefined) out.description = raw.description;
  if (raw.nature !== undefined) out.nature = raw.nature;
  return out;
}

function buildTaxSummary(raw: components['schemas']['TaxSummary']): SeatTaxSummary {
  const out: SeatTaxSummary = {
    taxes: (raw.taxes ?? []).map(buildTax),
  };
  if (raw.totalTaxAmount !== undefined) out.totalTaxAmount = buildAmount(raw.totalTaxAmount);
  return out;
}

function buildTax(raw: components['schemas']['TaxType']): SeatTax {
  const out: SeatTax = {};
  if (raw.amount !== undefined) out.amount = buildAmount(raw.amount);
  if (raw.taxCode !== undefined) out.taxCode = raw.taxCode;
  if (raw.descText !== undefined) out.descText = raw.descText;
  return out;
}

function buildSurcharge(raw: components['schemas']['Surcharge']): SeatSurcharge {
  const out: SeatSurcharge = {};
  if (raw.total !== undefined) out.total = buildAmount(raw.total);
  if (raw.breakdown !== undefined) out.breakdown = raw.breakdown.map(buildFee);
  return out;
}

// ---------------------------------------------------------------------------
// Data lists
// ---------------------------------------------------------------------------

function buildDataLists(raw: components['schemas']['DataLists']): SeatDataLists {
  const out: SeatDataLists = {};
  if (raw.originDests !== undefined) out.originDests = raw.originDests.map(buildOriginDestRS);
  if (raw.paxSegments !== undefined) out.paxSegments = raw.paxSegments.map(buildPaxSegmentRS);
  if (raw.paxJourneys !== undefined) out.paxJourneys = raw.paxJourneys.map(buildPaxJourneyRS);
  if (raw.paxs !== undefined) out.paxes = raw.paxs.map(buildPaxRS);
  if (raw.serviceDefinitions !== undefined)
    out.serviceDefinitions = raw.serviceDefinitions.map(buildServiceDefinition);
  if (raw.seatProfiles !== undefined) out.seatProfiles = raw.seatProfiles.map(buildSeatProfile);
  return out;
}

function buildOriginDestRS(raw: components['schemas']['OriginDestRS']): SeatOriginDestRS {
  const out: SeatOriginDestRS = {};
  if (raw.originDestID !== undefined) out.originDestId = raw.originDestID;
  if (raw.originCode !== undefined) out.originCode = raw.originCode;
  if (raw.destCode !== undefined) out.destCode = raw.destCode;
  if (raw.paxJourneyRefIDs !== undefined) out.paxJourneyRefIds = raw.paxJourneyRefIDs;
  return out;
}

function buildPaxSegmentRS(raw: components['schemas']['PaxSegmentRS']): SeatPaxSegmentRS {
  const out: SeatPaxSegmentRS = {
    paxSegmentId: raw.paxSegmentID,
    departure: buildTransportRS(raw.departure),
    arrival: buildTransportRS(raw.arrival),
    marketingCarrierInfo: buildMarketingCarrier(raw.marketingCarrierInfo),
  };
  if (raw.arrivalUknown !== undefined) out.arrivalUnknown = raw.arrivalUknown;
  if (raw.ticketless !== undefined) out.ticketless = raw.ticketless;
  if (raw.secureFlight !== undefined) out.secureFlight = raw.secureFlight;
  if (raw.duration !== undefined) out.duration = raw.duration;
  if (raw.segmentTypeCode !== undefined) out.segmentTypeCode = raw.segmentTypeCode;
  if (raw.cabinType !== undefined) out.cabinType = buildCabinType(raw.cabinType);
  if (raw.operatingCarrierInfo !== undefined)
    out.operatingCarrierInfo = buildOperatingCarrier(raw.operatingCarrierInfo);
  if (raw.datedOperatingLegs !== undefined)
    out.datedOperatingLegs = raw.datedOperatingLegs.map(buildDatedOperatingLeg);
  return out;
}

function buildTransportRS(raw: components['schemas']['TransportRS']): SeatTransportRS {
  const out: SeatTransportRS = {};
  if (raw.iataLocationCode !== undefined) out.iataLocationCode = raw.iataLocationCode;
  if (raw.stationName !== undefined) out.stationName = raw.stationName;
  if (raw.terminalName !== undefined) out.terminalName = raw.terminalName;
  if (raw.boardingGateID !== undefined) out.boardingGateId = raw.boardingGateID;
  if (raw.aircraftScheduledDateTime !== undefined)
    out.aircraftScheduledDateTime = raw.aircraftScheduledDateTime;
  return out;
}

function buildMarketingCarrier(
  raw: components['schemas']['DatedMarketingSegment'],
): SeatMarketingCarrier {
  const out: SeatMarketingCarrier = {
    carrierDesignatorCode: raw.carrierDesignatorCode,
    marketingCarrierFlightNumberText: raw.marketingCarrierFlightNumberText,
  };
  if (raw.carrierName !== undefined) out.carrierName = raw.carrierName;
  if (raw.operationalSuffixText !== undefined)
    out.operationalSuffixText = raw.operationalSuffixText;
  if (raw.rbdCode !== undefined) out.rbdCode = raw.rbdCode;
  return out;
}

function buildOperatingCarrier(
  raw: components['schemas']['DatedOperatingSegmentRS'],
): SeatOperatingCarrier {
  const out: SeatOperatingCarrier = {};
  if (raw.carrierDesignationCode !== undefined)
    out.carrierDesignationCode = raw.carrierDesignationCode;
  if (raw.carrierName !== undefined) out.carrierName = raw.carrierName;
  if (raw.operatingCarrierFlightNumberText !== undefined)
    out.operatingCarrierFlightNumberText = raw.operatingCarrierFlightNumberText;
  if (raw.operationalSuffixText !== undefined)
    out.operationalSuffixText = raw.operationalSuffixText;
  if (raw.rbdCode !== undefined) out.rbdCode = raw.rbdCode;
  return out;
}

function buildDatedOperatingLeg(
  raw: components['schemas']['DatedOperatingLegType'],
): SeatDatedOperatingLeg {
  const out: SeatDatedOperatingLeg = {
    datedOperatingLegId: raw.datedOperatingLegID,
    departure: buildTransportRS(raw.departure),
    arrival: buildTransportRS(raw.arrival),
  };
  if (raw.carrierAircraftType !== undefined)
    out.carrierAircraftType = buildCarrierAircraftType(raw.carrierAircraftType);
  return out;
}

function buildCarrierAircraftType(
  raw: components['schemas']['CarrierAircraftTypeType'],
): SeatCarrierAircraftType {
  const out: SeatCarrierAircraftType = {};
  if (raw.carrierAircraftTypeCode !== undefined)
    out.carrierAircraftTypeCode = raw.carrierAircraftTypeCode;
  if (raw.carrierAircraftTypeName !== undefined)
    out.carrierAircraftTypeName = raw.carrierAircraftTypeName;
  return out;
}

function buildPaxJourneyRS(raw: components['schemas']['PaxJourneyRS']): SeatPaxJourneyRS {
  const out: SeatPaxJourneyRS = {
    paxSegmentRefIds: raw.paxSegmentRefIDs,
  };
  if (raw.paxJourneyID !== undefined) out.paxJourneyId = raw.paxJourneyID;
  if (raw.distanceMeasure !== undefined) out.distanceMeasure = buildMeasure(raw.distanceMeasure);
  if (raw.duration !== undefined) out.duration = raw.duration;
  return out;
}

function buildMeasure(raw: components['schemas']['Measure']): SeatMeasure {
  const out: SeatMeasure = { measure: raw.measure };
  if (raw.unitCode !== undefined) out.unitCode = raw.unitCode;
  return out;
}

function buildPaxRS(raw: components['schemas']['PaxRS']): SeatPaxRS {
  const out: SeatPaxRS = { paxId: raw.paxID };
  if (raw.ptc !== undefined) out.ptc = raw.ptc;
  if (raw.loyaltyProgramAccount !== undefined) {
    out.loyaltyProgramAccounts = raw.loyaltyProgramAccount.map(buildLoyaltyAccountRS);
  }
  return out;
}

function buildLoyaltyAccountRS(
  raw: components['schemas']['LoyaltyProgramAccountRS'],
): SeatLoyaltyAccountRS {
  const out: SeatLoyaltyAccountRS = {};
  if (raw.airline !== undefined) out.airline = raw.airline;
  if (raw.accountNumber !== undefined) out.accountNumber = raw.accountNumber;
  if (raw.tierPriority !== undefined) out.tierPriority = raw.tierPriority;
  if (raw.partnerProgram !== undefined) out.partnerProgram = raw.partnerProgram;
  if (raw.providerName !== undefined) out.providerName = raw.providerName;
  if (raw.programName !== undefined) out.programName = raw.programName;
  if (raw.programCode !== undefined) out.programCode = raw.programCode;
  return out;
}

// ---------------------------------------------------------------------------
// Service definitions
// ---------------------------------------------------------------------------

function buildServiceDefinition(
  raw: components['schemas']['ServiceDefinition'],
): SeatServiceDefinition {
  const out: SeatServiceDefinition = {
    serviceDefinitionId: raw.serviceDefinitionID,
    name: raw.name,
    descriptions: raw.descriptions.map(buildDescription),
  };
  if (raw.ownerCode !== undefined) out.ownerCode = raw.ownerCode;
  if (raw.depositTimeLimitDateTime !== undefined)
    out.depositTimeLimitDateTime = raw.depositTimeLimitDateTime;
  if (raw.namingTimeLimitDateTime !== undefined)
    out.namingTimeLimitDateTime = raw.namingTimeLimitDateTime;
  if (raw.paymentTimeLimitDateTime !== undefined)
    out.paymentTimeLimitDateTime = raw.paymentTimeLimitDateTime;
  if (raw.ticketingTimeLimitDateTime !== undefined)
    out.ticketingTimeLimitDateTime = raw.ticketingTimeLimitDateTime;
  if (raw.bilateralProcessTimeLimits !== undefined) {
    out.bilateralProcessTimeLimits = raw.bilateralProcessTimeLimits.map(
      buildBilateralProcessTimeLimit,
    );
  }
  if (raw.validatingCarrierCode !== undefined)
    out.validatingCarrierCode = raw.validatingCarrierCode;
  if (raw.serviceDefinitionAssociation !== undefined) {
    out.serviceDefinitionAssociation = buildServiceDefinitionAssociation(
      raw.serviceDefinitionAssociation,
    );
  }
  if (raw.bookingInstructions !== undefined)
    out.bookingInstructions = buildBookingInstructions(raw.bookingInstructions);
  if (raw.detail !== undefined) out.detail = buildServiceDefinitionDetail(raw.detail);
  return out;
}

function buildDescription(raw: components['schemas']['Description']): SeatDescription {
  const out: SeatDescription = { descriptionId: raw.descriptionID };
  if (raw.descriptionText !== undefined) out.descriptionText = raw.descriptionText;
  if (raw.markupStyleText !== undefined) out.markupStyleText = raw.markupStyleText;
  if (raw.url !== undefined) out.url = raw.url;
  return out;
}

function buildBilateralProcessTimeLimit(
  raw: components['schemas']['BilateralProcessTimeLimit'],
): SeatBilateralProcessTimeLimit {
  const out: SeatBilateralProcessTimeLimit = { name: raw.name };
  if (raw.timeLimitDateTime !== undefined) out.timeLimitDateTime = raw.timeLimitDateTime;
  if (raw.descriptionText !== undefined) out.descriptionText = raw.descriptionText;
  return out;
}

function buildServiceDefinitionAssociation(
  raw: components['schemas']['ServiceDefinitionAssociation'],
): SeatServiceDefinitionAssociation {
  const out: SeatServiceDefinitionAssociation = {};
  if (raw.seatProfileRefID !== undefined) out.seatProfileRefIds = raw.seatProfileRefID;
  if (raw.serviceBundle !== undefined) out.serviceBundle = buildServiceBundle(raw.serviceBundle);
  return out;
}

function buildServiceBundle(raw: components['schemas']['ServiceBundle']): {
  maxQuantity?: number;
  serviceDefinitionRefIds: readonly string[];
} {
  const out: { maxQuantity?: number; serviceDefinitionRefIds: readonly string[] } = {
    serviceDefinitionRefIds: raw.serviceDefinitionRefID,
  };
  if (raw.maxQuantity !== undefined) (out as Record<string, unknown>).maxQuantity = raw.maxQuantity;
  return out;
}

function buildBookingInstructions(
  raw: components['schemas']['BookingInstructions'],
): SeatBookingInstructions {
  const out: SeatBookingInstructions = {};
  if (raw.ssrCodes !== undefined) out.ssrCodes = raw.ssrCodes;
  if (raw.osiText !== undefined) out.osiText = raw.osiText;
  if (raw.method !== undefined) out.method = raw.method;
  if (raw.upgradeMethod !== undefined) out.upgradeMethod = buildUpgradeMethod(raw.upgradeMethod);
  if (raw.text !== undefined) out.text = raw.text;
  if (raw.equipment !== undefined) out.equipment = raw.equipment;
  return out;
}

function buildUpgradeMethod(raw: components['schemas']['UpgradeMethod']): SeatUpgradeMethod {
  const out: SeatUpgradeMethod = { value: raw.value };
  if (raw.newClass !== undefined) out.newClass = raw.newClass;
  return out;
}

function buildServiceDefinitionDetail(
  raw: components['schemas']['ServiceDefinitionDetail'],
): SeatServiceDefinitionDetail {
  const out: SeatServiceDefinitionDetail = {};
  if (raw.serviceCombinations !== undefined)
    out.serviceCombinations = raw.serviceCombinations.map(buildServiceCombination);
  if (raw.serviceCoupon !== undefined) out.serviceCoupon = buildServiceCoupon(raw.serviceCoupon);
  if (raw.serviceFulfillment !== undefined)
    out.serviceFulfillment = buildServiceFulfillment(raw.serviceFulfillment);
  if (raw.serviceItemQuantityRules !== undefined)
    out.serviceItemQuantityRules = buildServiceItemQuantityRules(raw.serviceItemQuantityRules);
  return out;
}

function buildServiceItemQuantityRules(
  raw: components['schemas']['ServiceItemQuantityRules'],
): SeatServiceItemQuantityRules {
  const out: SeatServiceItemQuantityRules = {};
  if (raw.minimum !== undefined) out.minimum = raw.minimum;
  if (raw.maximum !== undefined) out.maximum = raw.maximum;
  return out;
}

function buildServiceCombination(
  raw: components['schemas']['ServiceCombination'],
): SeatServiceCombination {
  const out: SeatServiceCombination = { rule: raw.rule };
  if (raw.serviceID !== undefined) out.serviceIds = raw.serviceID.map(buildServiceId);
  if (raw.serviceReference !== undefined) out.serviceReferences = raw.serviceReference;
  return out;
}

function buildServiceId(raw: components['schemas']['ServiceID']): SeatServiceId {
  const out: SeatServiceId = { value: raw.value, owner: raw.owner };
  if (raw.objectKey !== undefined) out.objectKey = raw.objectKey;
  return out;
}

function buildServiceCoupon(raw: components['schemas']['ServiceCoupon']): SeatServiceCoupon {
  const out: SeatServiceCoupon = {};
  if (raw.instantPurchase !== undefined) out.instantPurchase = raw.instantPurchase;
  if (raw.feeBasis !== undefined) out.feeBasis = raw.feeBasis;
  if (raw.couponType !== undefined) out.couponType = raw.couponType;
  return out;
}

function buildServiceFulfillment(
  raw: components['schemas']['ServiceFulfillment'],
): SeatServiceFulfillment {
  const out: SeatServiceFulfillment = {};
  if (raw.offerValidDates !== undefined)
    out.offerValidDates = buildOfferValidDates(raw.offerValidDates);
  if (raw.provider !== undefined) out.provider = buildFulfillmentPartner(raw.provider);
  if (raw.location !== undefined) {
    const loc: SeatFulfillmentLocation = {};
    if (raw.location.airportFulfillmentLocation?.airportCode !== undefined) {
      loc.airportCode = raw.location.airportFulfillmentLocation.airportCode;
    }
    if (raw.location.otherFulfillmentLocation !== undefined) {
      loc.otherAddress = buildStructuredAddressFromAddressType(
        raw.location.otherFulfillmentLocation,
      );
    }
    out.location = loc;
  }
  return out;
}

function buildOfferValidDates(raw: components['schemas']['OfferValidDates']): SeatOfferValidDates {
  const out: SeatOfferValidDates = {};
  if (raw.start !== undefined) out.start = raw.start;
  if (raw.end !== undefined) out.end = raw.end;
  return out;
}

function buildFulfillmentPartner(
  raw: components['schemas']['FulfillmentPartnerType'],
): SeatFulfillmentPartner {
  const out: SeatFulfillmentPartner = { partnerId: raw.partnerID };
  if (raw.name !== undefined) out.name = raw.name;
  if (raw.type !== undefined) out.type = raw.type;
  if (raw.fulfillments !== undefined) out.fulfillments = raw.fulfillments.map(buildFulfillment);
  return out;
}

function buildFulfillment(raw: components['schemas']['Fulfillment']): SeatFulfillment {
  const out: SeatFulfillment = {};
  if (raw.offerValidDates !== undefined)
    out.offerValidDates = buildOfferValidDates(raw.offerValidDates);
  if (raw.location !== undefined) out.location = buildAirportAndAddress(raw.location);
  return out;
}

function buildAirportAndAddress(
  raw: components['schemas']['AirportAndAddress'],
): SeatAirportAndAddress {
  const out: SeatAirportAndAddress = {};
  if (raw.airportCode !== undefined) out.airportCode = raw.airportCode;
  if (raw.address !== undefined) out.address = buildStructuredAddress(raw.address);
  return out;
}

function buildStructuredAddress(
  raw: components['schemas']['StructuredAddress'],
): SeatStructuredAddress {
  const out: SeatStructuredAddress = {};
  if (raw.application !== undefined) out.application = raw.application;
  if (raw.common?.street !== undefined) out.street = raw.common.street;
  if (raw.common?.poBox !== undefined) out.poBox = raw.common.poBox;
  if (raw.common?.buildingRoom !== undefined) out.buildingRoom = raw.common.buildingRoom;
  if (raw.common?.city !== undefined) out.city = raw.common.city;
  if (raw.common?.stateProv !== undefined) out.stateProv = raw.common.stateProv;
  if (raw.common?.postalCode !== undefined) out.postalCode = raw.common.postalCode;
  if (raw.countryCode !== undefined) out.countryCode = raw.countryCode;
  if (raw.county !== undefined) out.county = raw.county;
  return out;
}

function buildStructuredAddressFromAddressType(
  raw: components['schemas']['AddressType'],
): SeatStructuredAddress {
  if (raw.structuredAddress) return buildStructuredAddress(raw.structuredAddress);
  if (raw.paymentAddress) {
    const out: SeatStructuredAddress = {};
    if (raw.paymentAddress.common?.street !== undefined)
      out.street = raw.paymentAddress.common.street;
    if (raw.paymentAddress.common?.poBox !== undefined) out.poBox = raw.paymentAddress.common.poBox;
    if (raw.paymentAddress.common?.buildingRoom !== undefined)
      out.buildingRoom = raw.paymentAddress.common.buildingRoom;
    if (raw.paymentAddress.common?.city !== undefined) out.city = raw.paymentAddress.common.city;
    if (raw.paymentAddress.common?.stateProv !== undefined)
      out.stateProv = raw.paymentAddress.common.stateProv;
    if (raw.paymentAddress.common?.postalCode !== undefined)
      out.postalCode = raw.paymentAddress.common.postalCode;
    if (raw.paymentAddress.country !== undefined) out.countryCode = raw.paymentAddress.country;
    return out;
  }
  return {};
}

// ---------------------------------------------------------------------------
// Seat profiles
// ---------------------------------------------------------------------------

function buildSeatProfile(raw: components['schemas']['SeatProfile']): SeatProfile {
  const out: SeatProfile = { seatProfileId: raw.seatProfileId };
  if (raw.characteristicCodes !== undefined) out.characteristicCodes = raw.characteristicCodes;
  if (raw.seatWidthMeasure !== undefined) out.seatWidthMeasure = buildMeasure(raw.seatWidthMeasure);
  if (raw.seatPitchMeasure !== undefined) out.seatPitchMeasure = buildMeasure(raw.seatPitchMeasure);
  if (raw.descriptionText !== undefined) out.descriptionText = raw.descriptionText;
  if (raw.marketingInformation !== undefined)
    out.marketingInformation = raw.marketingInformation.map(buildDescription);
  if (raw.seatKeywords !== undefined) out.seatKeywords = raw.seatKeywords.map(buildKeyWord);
  return out;
}

function buildKeyWord(raw: components['schemas']['KeyWord']): SeatKeyWord {
  return { keyWordText: raw.keyWordText, valueText: raw.valueText };
}

// ---------------------------------------------------------------------------
// Shopping response
// ---------------------------------------------------------------------------

function buildShoppingResponse(
  raw: components['schemas']['ShoppingResponse'],
): SeatShoppingResponse {
  const out: SeatShoppingResponse = { shoppingResponseId: raw.shoppingResponseID };
  if (raw.ownerCode !== undefined) out.ownerCode = raw.ownerCode;
  return out;
}

// ---------------------------------------------------------------------------
// Payload attributes
// ---------------------------------------------------------------------------

function buildPayloadAttributes(
  raw: components['schemas']['PayloadAttributes'],
): SeatPayloadAttributes {
  const out: SeatPayloadAttributes = {};
  if (raw.echoTokenText !== undefined) out.echoTokenText = raw.echoTokenText;
  if (raw.timeStamp !== undefined) out.timeStamp = raw.timeStamp;
  if (raw.transactionID !== undefined) out.transactionId = raw.transactionID;
  if (raw.correlationID !== undefined) out.correlationId = raw.correlationID;
  return out;
}

// ---------------------------------------------------------------------------
// Errors and warnings
// ---------------------------------------------------------------------------

function buildError(e: components['schemas']['Error']): SeatError {
  const out: SeatError = {
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

function buildWarning(w: components['schemas']['Warning']): SeatWarning {
  const out: SeatWarning = {};
  if (w.code !== undefined) out.code = w.code;
  if (w.descriptionText !== undefined) out.descriptionText = w.descriptionText;
  if (w.ownerName !== undefined) out.ownerName = w.ownerName;
  return out;
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function ensureTrailingSlash(url: string): string {
  return url.endsWith('/') ? url : `${url}/`;
}
