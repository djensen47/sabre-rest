import { SabreParseError } from '../../errors/sabre-parse-error.js';
import type { components } from '../../generated/stateless-exchanges-air-search.js';
import { ensureTrailingSlash } from '../../http/ensure-trailing-slash.js';
import type { SabreRequest, SabreResponse } from '../../http/types.js';
import type {
  AirItineraryPricing,
  AirTaxReissue,
  AmountCurrency,
  Conversion,
  EquivalentAmountCurrency,
  ExchangeFlightSegment,
  ExchangeOriginDestination,
  ExchangePricedItinerary,
  ExchangeTotalFare,
  Fare,
  FareComponentTaxes,
  FareType,
  Fee,
  Itinerary,
  Leg,
  LegTaxes,
  ObFee,
  PassengerBookingDetails,
  PassengerPriceDetail,
  PassengerPriceDifference,
  PriceCalculationDetails,
  ReaccommodationRule,
  ReservationSegment,
  ReservationSegmentDetails,
  ResponseMessage,
  SearchExchangeFlightsInput,
  SearchExchangeFlightsOutput,
  Tax,
  TaxSummary,
  Taxes,
  TotalFee,
  TotalPriceDifference,
} from './types.js';

const PATH = '/v1/dc/exchanges/getFlights';

/**
 * Builds the outgoing {@link SabreRequest} for the `AirExchangeSearch`
 * operation.
 *
 * The request body is constructed as a plain object literal so consumers
 * never see Sabre's wire naming and we don't have to satisfy
 * openapi-typescript's non-optional defaults on every field. The single
 * load-bearing default — `overrideCkinStatus: false` — is sent
 * explicitly when the consumer omitted it (per the spec's `default: false`
 * on that property).
 */
export function toSearchRequest(baseUrl: string, input: SearchExchangeFlightsInput): SabreRequest {
  const url = new URL(PATH, ensureTrailingSlash(baseUrl));

  const body: Record<string, unknown> = {
    pnrLocator: input.pnrLocator,
    shoppingSource: input.shoppingSource,
    itineraryParts: input.itineraryParts.map(buildItineraryPart),
    clientContext: buildClientContext(input.clientContext),
    // `overrideCkinStatus` has `default: false` in the spec — sending the
    // documented default is following the spec, not inventing a value.
    overrideCkinStatus: input.overrideCkinStatus ?? false,
  };

  if (input.exchangeDocuments !== undefined) {
    body.exchangeDocuments = input.exchangeDocuments.map((d) => {
      const out: Record<string, unknown> = {
        number: d.number,
        passengerNameNumber: d.passengerNameNumber,
      };
      if (d.passengerTypeCode !== undefined) {
        out.passengerTypeCode = d.passengerTypeCode;
      }
      return out;
    });
  }

  if (input.travelPreferences !== undefined) {
    body.travelPreferences = buildExchangeTravelPreferences(input.travelPreferences);
  }

  if (input.calculateReaccommodationRules !== undefined) {
    body.calculateReaccommodationRules = input.calculateReaccommodationRules;
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

function buildItineraryPart(
  part: SearchExchangeFlightsInput['itineraryParts'][number],
): Record<string, unknown> {
  const out: Record<string, unknown> = {
    referenceNumber: part.referenceNumber,
    departureDate: part.departureDate,
    departureAirportCode: part.departureAirportCode,
    arrivalAirportCode: part.arrivalAirportCode,
  };
  if (part.shopForExchange !== undefined) out.shopForExchange = part.shopForExchange;
  if (part.returnFullDiversityFares !== undefined) {
    out.returnFullDiversityFares = part.returnFullDiversityFares;
  }
  if (part.isPreselected !== undefined) out.isPreselected = part.isPreselected;
  if (part.numberOfDateFlexibilityDays !== undefined) {
    out.numberOfDateFlexibilityDays = part.numberOfDateFlexibilityDays;
  }
  if (part.maximumOneWayOptions !== undefined) {
    out.maximumOneWayOptions = part.maximumOneWayOptions;
  }
  if (part.numberOfOneWayOptions !== undefined) {
    out.numberOfOneWayOptions = part.numberOfOneWayOptions;
  }
  if (part.connections !== undefined) {
    out.connections = part.connections.map((c) => {
      const conn: Record<string, unknown> = { locationCode: c.locationCode };
      if (c.isPreferred !== undefined) conn.isPreferred = c.isPreferred;
      return conn;
    });
  }
  if (part.connectionTime !== undefined) {
    const ct: Record<string, unknown> = {};
    if (part.connectionTime.minimumTimeInMinutes !== undefined) {
      ct.minimumTimeInMinutes = part.connectionTime.minimumTimeInMinutes;
    }
    if (part.connectionTime.maximumTimeInMinutes !== undefined) {
      ct.maximumTimeInMinutes = part.connectionTime.maximumTimeInMinutes;
    }
    out.connectionTime = ct;
  }
  if (part.includeVendors !== undefined) out.includeVendors = part.includeVendors;
  if (part.shouldPreserveConnections !== undefined) {
    out.shouldPreserveConnections = part.shouldPreserveConnections;
  }
  if (part.segments !== undefined) {
    out.segments = part.segments.map((s) => ({
      bookingClassCode: s.bookingClassCode,
      brandCode: s.brandCode,
      operatingAirlineCode: s.operatingAirlineCode,
      bookingAirlineCode: s.bookingAirlineCode,
      bookingFlightNumber: s.bookingFlightNumber,
      departureDateTime: s.departureDateTime,
      arrivalDateTime: s.arrivalDateTime,
      departureAirportCode: s.departureAirportCode,
      arrivalAirportCode: s.arrivalAirportCode,
    }));
  }
  return out;
}

function buildClientContext(
  ctx: SearchExchangeFlightsInput['clientContext'],
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (ctx.pseudoCityCode !== undefined) out.pseudoCityCode = ctx.pseudoCityCode;
  if (ctx.countryCode !== undefined) out.countryCode = ctx.countryCode;
  if (ctx.stateProvinceCode !== undefined) out.stateProvinceCode = ctx.stateProvinceCode;
  if (ctx.stationNumber !== undefined) out.stationNumber = ctx.stationNumber;
  if (ctx.accountingCode !== undefined) out.accountingCode = ctx.accountingCode;
  if (ctx.accountingCity !== undefined) out.accountingCity = ctx.accountingCity;
  if (ctx.dutyCode !== undefined) out.dutyCode = ctx.dutyCode;
  return out;
}

function buildExchangeTravelPreferences(
  prefs: NonNullable<SearchExchangeFlightsInput['travelPreferences']>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (prefs.includeBrandCodes !== undefined) out.includeBrandCodes = prefs.includeBrandCodes;
  if (prefs.preferredCabinCode !== undefined) out.preferredCabinCode = prefs.preferredCabinCode;
  if (prefs.maximumConnections !== undefined) out.maximumConnections = prefs.maximumConnections;
  if (prefs.currencyOverrideCode !== undefined) {
    out.currencyOverrideCode = prefs.currencyOverrideCode;
  }
  if (prefs.flightType !== undefined) out.flightType = prefs.flightType;
  if (prefs.maximumStopsQuantity !== undefined) {
    out.maximumStopsQuantity = prefs.maximumStopsQuantity;
  }
  if (prefs.excludeVendors !== undefined) out.excludeVendors = prefs.excludeVendors;
  if (prefs.accountCode !== undefined) out.accountCode = prefs.accountCode;
  if (prefs.corporateId !== undefined) out.corporateId = prefs.corporateId;
  if (prefs.shouldReturnNegotiatedFaresOnly !== undefined) {
    out.shouldReturnNegotiatedFaresOnly = prefs.shouldReturnNegotiatedFaresOnly;
  }
  if (prefs.returnOnlineServiceOnly !== undefined) {
    out.returnOnlineServiceOnly = prefs.returnOnlineServiceOnly;
  }
  if (prefs.includeInterlineFlights !== undefined) {
    out.includeInterlineFlights = prefs.includeInterlineFlights;
  }
  if (prefs.returnNoPenaltyFares !== undefined) {
    out.returnNoPenaltyFares = prefs.returnNoPenaltyFares;
  }
  if (prefs.splitFaresByLeg !== undefined) out.splitFaresByLeg = prefs.splitFaresByLeg;
  return out;
}

/**
 * Parses the `AirExchangeSearch` response into the public output shape.
 *
 * Throws {@link SabreParseError} only when the body fundamentally is not
 * a Sabre response (not JSON, not an object). Application-layer errors
 * Sabre returned in the 200 envelope (`errors[]`) are surfaced on the
 * output type — the consumer decides how to handle them.
 *
 * The mapper does not drop records: every priced itinerary, every fare,
 * every fee passes through with the optionality the spec declares.
 */
export function fromSearchResponse(res: SabreResponse): SearchExchangeFlightsOutput {
  let parsed: components['schemas']['ExchangeAirSearchResponse'];
  try {
    parsed = JSON.parse(res.body) as components['schemas']['ExchangeAirSearchResponse'];
  } catch (err) {
    throw new SabreParseError(
      'Failed to parse Stateless Exchanges Air Search response as JSON',
      res.body,
      { cause: err },
    );
  }
  if (parsed === null || typeof parsed !== 'object') {
    throw new SabreParseError(
      'Stateless Exchanges Air Search response was not a JSON object',
      parsed,
    );
  }

  return {
    pricedItineraries: (parsed.pricedItineraries ?? []).map(mapExchangePricedItinerary),
    warnings: (parsed.warnings ?? []).map(mapResponseMessage),
    errors: (parsed.errors ?? []).map(mapResponseMessage),
  };
}

type WireExchangePricedItinerary = NonNullable<
  components['schemas']['ExchangeAirSearchResponse']['pricedItineraries']
>[number];

function mapExchangePricedItinerary(item: WireExchangePricedItinerary): ExchangePricedItinerary {
  const out: ExchangePricedItinerary = {};
  if (item.itinerary !== undefined) out.itinerary = mapItinerary(item.itinerary);
  if (item.airItineraryPricing !== undefined) {
    out.airItineraryPricing = mapAirItineraryPricing(item.airItineraryPricing);
  }
  return out;
}

function mapItinerary(item: components['schemas']['Itinerary']): Itinerary {
  return {
    itineraryParts: (item.itineraryParts ?? []).map(mapExchangeOriginDestination),
  };
}

function mapExchangeOriginDestination(
  item: components['schemas']['OriginDestination'],
): ExchangeOriginDestination {
  const out: ExchangeOriginDestination = {
    segments: (item.segments ?? []).map(mapReservationSegment),
  };
  if (item.elapsedTime !== undefined) out.elapsedTime = item.elapsedTime;
  if (item.departureAirportCode !== undefined) out.departureAirportCode = item.departureAirportCode;
  if (item.arrivalAirportCode !== undefined) out.arrivalAirportCode = item.arrivalAirportCode;
  return out;
}

function mapReservationSegment(
  item: components['schemas']['ReservationSegment'],
): ReservationSegment {
  const out: ReservationSegment = {};
  if (item.elapsedTime !== undefined) out.elapsedTime = item.elapsedTime;
  if (item.supportsElectronicTicket !== undefined) {
    out.supportsElectronicTicket = item.supportsElectronicTicket;
  }
  if (item.arrivalDateTime !== undefined) out.arrivalDateTime = item.arrivalDateTime;
  if (item.arrivalAirportCode !== undefined) out.arrivalAirportCode = item.arrivalAirportCode;
  if (item.bookingFlightNumber !== undefined) out.bookingFlightNumber = item.bookingFlightNumber;
  if (item.bookingAirlineCode !== undefined) out.bookingAirlineCode = item.bookingAirlineCode;
  if (item.operatingAirlineCode !== undefined) {
    out.operatingAirlineCode = item.operatingAirlineCode;
  }
  if (item.operatingFlightNumber !== undefined) {
    out.operatingFlightNumber = item.operatingFlightNumber;
  }
  if (item.marriageGroup !== undefined) out.marriageGroup = item.marriageGroup;
  if (item.sequence !== undefined) out.sequence = item.sequence;
  if (item.departureDateTime !== undefined) out.departureDateTime = item.departureDateTime;
  if (item.departureAirportCode !== undefined) out.departureAirportCode = item.departureAirportCode;
  if (item.stopQuantity !== undefined) out.stopQuantity = item.stopQuantity;
  return out;
}

function mapAirItineraryPricing(
  item: components['schemas']['AirItineraryPricing'],
): AirItineraryPricing {
  return { fares: (item.fares ?? []).map(mapFare) };
}

function mapFare(item: components['schemas']['Fare']): Fare {
  const out: Fare = {
    reservationSegmentsDetails: (item.reservationSegmentsDetails ?? []).map(
      mapReservationSegmentsDetails,
    ),
    passengersPriceDetails: (item.passengersPriceDetails ?? []).map(mapPassengerPriceDetail),
    passengerFares: (item.passengerFares ?? []).map(mapFareType),
  };
  if (item.brandCode !== undefined) out.brandCode = item.brandCode;
  if (item.brandName !== undefined) out.brandName = item.brandName;
  if (item.brandProgramId !== undefined) out.brandProgramId = item.brandProgramId;
  if (item.brandProgramCode !== undefined) out.brandProgramCode = item.brandProgramCode;
  if (item.brandProgramDescription !== undefined) {
    out.brandProgramDescription = item.brandProgramDescription;
  }
  if (item.brandProgramSystemCode !== undefined) {
    out.brandProgramSystemCode = item.brandProgramSystemCode;
  }
  if (item.isSoldOut !== undefined) out.isSoldOut = item.isSoldOut;
  if (item.isValid !== undefined) out.isValid = item.isValid;
  if (item.invalidReason !== undefined) out.invalidReason = item.invalidReason;
  if (item.isPassengersPricedInDifferentCurrencies !== undefined) {
    out.isPassengersPricedInDifferentCurrencies = item.isPassengersPricedInDifferentCurrencies;
  }
  if (item.totalPriceDifference !== undefined) {
    out.totalPriceDifference = mapTotalPriceDifference(item.totalPriceDifference);
  }
  if (item.totalFare !== undefined) out.totalFare = mapExchangeTotalFare(item.totalFare);
  return out;
}

function mapReservationSegmentsDetails(
  item: components['schemas']['ReservationSegmentDetails'],
): ReservationSegmentDetails {
  const out: ReservationSegmentDetails = {
    passengersBookingDetails: (item.passengersBookingDetails ?? []).map(mapPassengerBookingDetails),
  };
  if (item.segmentNumber !== undefined) out.segmentNumber = item.segmentNumber;
  return out;
}

function mapPassengerBookingDetails(
  item: components['schemas']['PassengerBookingDetails'],
): PassengerBookingDetails {
  const out: PassengerBookingDetails = {};
  if (item.passengerFareRef !== undefined) out.passengerFareRef = item.passengerFareRef;
  if (item.brandCode !== undefined) out.brandCode = item.brandCode;
  if (item.brandName !== undefined) out.brandName = item.brandName;
  if (item.brandProgramId !== undefined) out.brandProgramId = item.brandProgramId;
  if (item.brandProgramCode !== undefined) out.brandProgramCode = item.brandProgramCode;
  if (item.brandProgramDescription !== undefined) {
    out.brandProgramDescription = item.brandProgramDescription;
  }
  if (item.brandProgramSystemCode !== undefined) {
    out.brandProgramSystemCode = item.brandProgramSystemCode;
  }
  if (item.cabinCode !== undefined) out.cabinCode = item.cabinCode;
  if (item.bookingClassCode !== undefined) out.bookingClassCode = item.bookingClassCode;
  if (item.documentNumber !== undefined) out.documentNumber = item.documentNumber;
  if (item.fareBasisCode !== undefined) out.fareBasisCode = item.fareBasisCode;
  if (item.mealCode !== undefined) out.mealCode = item.mealCode;
  if (item.departureAirportCode !== undefined) out.departureAirportCode = item.departureAirportCode;
  if (item.arrivalAirportCode !== undefined) out.arrivalAirportCode = item.arrivalAirportCode;
  if (item.directionality !== undefined) out.directionality = item.directionality;
  return out;
}

function mapPassengerPriceDetail(
  item: components['schemas']['PassengerPriceDetails'],
): PassengerPriceDetail {
  const out: PassengerPriceDetail = {};
  if (item.documentNumber !== undefined) out.documentNumber = item.documentNumber;
  if (item.givenName !== undefined) out.givenName = item.givenName;
  if (item.surname !== undefined) out.surname = item.surname;
  if (item.typeCode !== undefined) out.typeCode = item.typeCode;
  if (item.passengerPriceDifference !== undefined) {
    out.passengerPriceDifference = mapPassengerPriceDifference(item.passengerPriceDifference);
  }
  if (item.reaccommodationRule !== undefined) {
    out.reaccommodationRule = mapReaccommodationRule(item.reaccommodationRule);
  }
  return out;
}

function mapPassengerPriceDifference(
  item: components['schemas']['PassengerPriceDifference'],
): PassengerPriceDifference {
  const out: PassengerPriceDifference = {};
  if (item.differenceType !== undefined) out.differenceType = item.differenceType;
  if (item.lastDayToTicket !== undefined) out.lastDayToTicket = item.lastDayToTicket;
  if (item.total !== undefined) out.total = mapAmountCurrency(item.total);
  if (item.totalBreakdown !== undefined) {
    out.totalBreakdown = mapPriceCalculationDetails(item.totalBreakdown);
  }
  return out;
}

function mapTotalPriceDifference(
  item: components['schemas']['TotalPriceDifference'],
): TotalPriceDifference {
  const out: TotalPriceDifference = {};
  if (item.differenceType !== undefined) out.differenceType = item.differenceType;
  if (item.lastDayToTicket !== undefined) out.lastDayToTicket = item.lastDayToTicket;
  if (item.total !== undefined) out.total = mapAmountCurrency(item.total);
  if (item.totalBreakdown !== undefined) {
    out.totalBreakdown = mapPriceCalculationDetails(item.totalBreakdown);
  }
  return out;
}

function mapPriceCalculationDetails(
  item: components['schemas']['PriceCalculationDetails'],
): PriceCalculationDetails {
  const out: PriceCalculationDetails = {
    totalFees: (item.totalFees ?? []).map(mapTotalFee),
  };
  if (item.fare !== undefined) out.fare = mapAmountCurrency(item.fare);
  if (item.tax !== undefined) out.tax = mapAmountCurrency(item.tax);
  if (item.totalFeeTax !== undefined) out.totalFeeTax = mapAmountCurrency(item.totalFeeTax);
  if (item.nonRefundableAmount !== undefined) {
    out.nonRefundableAmount = mapAmountCurrency(item.nonRefundableAmount);
  }
  return out;
}

function mapTotalFee(item: components['schemas']['TotalFee']): TotalFee {
  const out: TotalFee = {};
  if (item.amount !== undefined) out.amount = item.amount;
  if (item.currencyCode !== undefined) out.currencyCode = item.currencyCode;
  if (item.decimalPlaces !== undefined) out.decimalPlaces = item.decimalPlaces;
  if (item.feeType !== undefined) out.feeType = item.feeType;
  return out;
}

function mapAmountCurrency(item: components['schemas']['AmountCurrency']): AmountCurrency {
  const out: AmountCurrency = {};
  if (item.amount !== undefined) out.amount = item.amount;
  if (item.currencyCode !== undefined) out.currencyCode = item.currencyCode;
  if (item.decimalPlaces !== undefined) out.decimalPlaces = item.decimalPlaces;
  return out;
}

function mapReaccommodationRule(
  item: components['schemas']['ReaccommodationRule'],
): ReaccommodationRule {
  const out: ReaccommodationRule = {};
  if (item.isChangeFeeWaived !== undefined) out.isChangeFeeWaived = item.isChangeFeeWaived;
  if (item.changeFeeRuleId !== undefined) out.changeFeeRuleId = item.changeFeeRuleId;
  if (item.isPriceDifferenceWaived !== undefined) {
    out.isPriceDifferenceWaived = item.isPriceDifferenceWaived;
  }
  if (item.priceDifferenceRuleId !== undefined) {
    out.priceDifferenceRuleId = item.priceDifferenceRuleId;
  }
  return out;
}

function mapFareType(item: components['schemas']['FareType']): FareType {
  const out: FareType = {
    fees: (item.fees ?? []).map(mapFee),
    obFees: (item.obFees ?? []).map(mapObFee),
    currencyConversions: (item.currencyConversions ?? []).map(mapConversion),
    legFares: (item.legFares ?? []).map(mapLeg),
  };
  if (item.passengerFareId !== undefined) out.passengerFareId = item.passengerFareId;
  if (item.passengerTypeCode !== undefined) out.passengerTypeCode = item.passengerTypeCode;
  if (item.passengerQuantity !== undefined) out.passengerQuantity = item.passengerQuantity;
  if (item.baseFare !== undefined) out.baseFare = mapAmountCurrency(item.baseFare);
  if (item.nonRefundableBaseFare !== undefined) {
    out.nonRefundableBaseFare = mapAmountCurrency(item.nonRefundableBaseFare);
  }
  if (item.fareConstruction !== undefined) {
    out.fareConstruction = mapAmountCurrency(item.fareConstruction);
  }
  if (item.equivalentFare !== undefined) {
    out.equivalentFare = mapEquivalentAmountCurrency(item.equivalentFare);
  }
  if (item.taxes !== undefined) out.taxes = mapTaxes(item.taxes);
  if (item.rateOfExchange !== undefined) out.rateOfExchange = item.rateOfExchange;
  if (item.totalFare !== undefined) out.totalFare = mapAmountCurrency(item.totalFare);
  if (item.reaccommodationRule !== undefined) {
    out.reaccommodationRule = mapReaccommodationRule(item.reaccommodationRule);
  }
  return out;
}

function mapExchangeTotalFare(item: components['schemas']['TotalFare']): ExchangeTotalFare {
  const out: ExchangeTotalFare = {
    fees: (item.fees ?? []).map(mapFee),
    obFees: (item.obFees ?? []).map(mapObFee),
    currencyConversions: (item.currencyConversions ?? []).map(mapConversion),
    legFares: (item.legFares ?? []).map(mapLeg),
  };
  if (item.passengerFareId !== undefined) out.passengerFareId = item.passengerFareId;
  if (item.passengerType !== undefined) out.passengerType = item.passengerType;
  if (item.passengerQuantity !== undefined) out.passengerQuantity = item.passengerQuantity;
  if (item.baseFare !== undefined) out.baseFare = mapAmountCurrency(item.baseFare);
  if (item.nonRefundableBaseFare !== undefined) {
    out.nonRefundableBaseFare = mapAmountCurrency(item.nonRefundableBaseFare);
  }
  if (item.fareConstruction !== undefined) {
    out.fareConstruction = mapAmountCurrency(item.fareConstruction);
  }
  if (item.equivFare !== undefined) {
    out.equivFare = mapEquivalentAmountCurrency(item.equivFare);
  }
  if (item.taxes !== undefined) out.taxes = mapTaxes(item.taxes);
  if (item.rateOfExchange !== undefined) out.rateOfExchange = item.rateOfExchange;
  if (item.totalFare !== undefined) out.totalFare = mapAmountCurrency(item.totalFare);
  return out;
}

function mapEquivalentAmountCurrency(
  item: components['schemas']['EquivalentAmountCurrency'],
): EquivalentAmountCurrency {
  const out: EquivalentAmountCurrency = {};
  if (item.amount !== undefined) out.amount = item.amount;
  if (item.currencyCode !== undefined) out.currencyCode = item.currencyCode;
  if (item.decimalPlaces !== undefined) out.decimalPlaces = item.decimalPlaces;
  if (item.effectivePriceDeviation !== undefined) {
    out.effectivePriceDeviation = item.effectivePriceDeviation;
  }
  if (item.effectiveDeviationType !== undefined) {
    out.effectiveDeviationType = item.effectiveDeviationType;
  }
  return out;
}

function mapTaxes(item: components['schemas']['Taxes']): Taxes {
  const out: Taxes = {
    fareComponentsTaxes: (item.fareComponentsTaxes ?? []).map(mapFareComponentTaxes),
    legsTaxes: (item.legsTaxes ?? []).map(mapLegTaxes),
    taxes: (item.taxes ?? []).map(mapTax),
    taxSummaries: (item.taxSummaries ?? []).map(mapTaxSummary),
  };
  if (item.totalTax !== undefined) out.totalTax = mapAmountCurrency(item.totalTax);
  return out;
}

function mapFareComponentTaxes(
  item: components['schemas']['FareComponentTaxes'],
): FareComponentTaxes {
  return {
    flightSegments: (item.flightSegments ?? []).map(mapExchangeFlightSegment),
    taxes: (item.taxes ?? []).map(mapTax),
    taxSummaries: (item.taxSummaries ?? []).map(mapTaxSummary),
  };
}

function mapExchangeFlightSegment(
  item: components['schemas']['FlightSegment'],
): ExchangeFlightSegment {
  const out: ExchangeFlightSegment = {};
  if (item.departureAirportCode !== undefined) out.departureAirportCode = item.departureAirportCode;
  if (item.arrivalAirportCode !== undefined) out.arrivalAirportCode = item.arrivalAirportCode;
  return out;
}

function mapLegTaxes(item: components['schemas']['LegTaxes']): LegTaxes {
  const out: LegTaxes = {
    taxes: (item.taxes ?? []).map(mapTax),
    taxSummaries: (item.taxSummaries ?? []).map(mapTaxSummary),
  };
  if (item.legNumber !== undefined) out.legNumber = item.legNumber;
  return out;
}

function mapTax(item: components['schemas']['Tax']): Tax {
  const out: Tax = {};
  if (item.code !== undefined) out.code = item.code;
  if (item.amount !== undefined) out.amount = mapAmountCurrency(item.amount);
  if (item.airlineCode !== undefined) out.airlineCode = item.airlineCode;
  if (item.minimumAmount !== undefined) out.minimumAmount = item.minimumAmount;
  if (item.maximumAmount !== undefined) out.maximumAmount = item.maximumAmount;
  if (item.currencyCode !== undefined) out.currencyCode = item.currencyCode;
  if (item.rateUsed !== undefined) out.rateUsed = item.rateUsed;
  if (item.stationCode !== undefined) out.stationCode = item.stationCode;
  if (item.countryCode !== undefined) out.countryCode = item.countryCode;
  if (item.hasTaxOnChangeFee !== undefined) out.hasTaxOnChangeFee = item.hasTaxOnChangeFee;
  if (item.isRefundable !== undefined) out.isRefundable = item.isRefundable;
  if (item.airTaxReissue !== undefined) out.airTaxReissue = mapAirTaxReissue(item.airTaxReissue);
  return out;
}

function mapAirTaxReissue(item: components['schemas']['AirTaxReissue']): AirTaxReissue {
  const out: AirTaxReissue = {};
  if (item.code !== undefined) out.code = item.code;
  if (item.hasRestriction !== undefined) out.hasRestriction = item.hasRestriction;
  if (item.isRefundable !== undefined) out.isRefundable = item.isRefundable;
  if (item.shouldApplyToReissue !== undefined) {
    out.shouldApplyToReissue = item.shouldApplyToReissue;
  }
  if (item.maximumAmount !== undefined) out.maximumAmount = item.maximumAmount;
  if (item.currencyCode !== undefined) out.currencyCode = item.currencyCode;
  if (item.publishedAmount !== undefined) out.publishedAmount = item.publishedAmount;
  if (item.publishedCurrencyCode !== undefined) {
    out.publishedCurrencyCode = item.publishedCurrencyCode;
  }
  return out;
}

function mapTaxSummary(item: components['schemas']['TaxSummary']): TaxSummary {
  const out: TaxSummary = {};
  if (item.code !== undefined) out.code = item.code;
  if (item.amount !== undefined) out.amount = mapAmountCurrency(item.amount);
  if (item.stationCode !== undefined) out.stationCode = item.stationCode;
  if (item.countryCode !== undefined) out.countryCode = item.countryCode;
  if (item.publishedAmount !== undefined) out.publishedAmount = item.publishedAmount;
  if (item.publishedCurrencyCode !== undefined) {
    out.publishedCurrencyCode = item.publishedCurrencyCode;
  }
  return out;
}

function mapFee(item: components['schemas']['Fee']): Fee {
  const out: Fee = {};
  if (item.amount !== undefined) out.amount = item.amount;
  if (item.currencyCode !== undefined) out.currencyCode = item.currencyCode;
  if (item.decimalPlaces !== undefined) out.decimalPlaces = item.decimalPlaces;
  if (item.feeCode !== undefined) out.feeCode = item.feeCode;
  return out;
}

function mapObFee(item: components['schemas']['ObFee']): ObFee {
  const out: ObFee = {};
  if (item.amount !== undefined) out.amount = item.amount;
  if (item.currencyCode !== undefined) out.currencyCode = item.currencyCode;
  if (item.decimalPlaces !== undefined) out.decimalPlaces = item.decimalPlaces;
  if (item.obFeeType !== undefined) out.obFeeType = item.obFeeType;
  if (item.description !== undefined) out.description = item.description;
  return out;
}

function mapConversion(item: components['schemas']['Conversion']): Conversion {
  const out: Conversion = {};
  if (item.from !== undefined) out.from = item.from;
  if (item.to !== undefined) out.to = item.to;
  if (item.rateOfExchange !== undefined) out.rateOfExchange = item.rateOfExchange;
  return out;
}

function mapLeg(item: components['schemas']['Leg']): Leg {
  const out: Leg = { taxes: (item.taxes ?? []).map(mapTax) };
  if (item.baseFare !== undefined) out.baseFare = mapAmountCurrency(item.baseFare);
  if (item.equivFare !== undefined) {
    out.equivFare = mapEquivalentAmountCurrency(item.equivFare);
  }
  if (item.totalFare !== undefined) out.totalFare = mapAmountCurrency(item.totalFare);
  if (item.number !== undefined) out.number = item.number;
  return out;
}

function mapResponseMessage(item: components['schemas']['Error']): ResponseMessage {
  const out: ResponseMessage = {};
  if (item.category !== undefined) out.category = item.category;
  if (item.type !== undefined) out.type = item.type;
  if (item.description !== undefined) out.description = item.description;
  if (item.fieldPath !== undefined) out.fieldPath = item.fieldPath;
  if (item.fieldName !== undefined) out.fieldName = item.fieldName;
  if (item.fieldValue !== undefined) out.fieldValue = item.fieldValue;
  return out;
}
