import { SabreParseError } from '../../errors/sabre-parse-error.js';
import type { components } from '../../generated/revalidate-itinerary.js';
import { ensureTrailingSlash } from '../../http/ensure-trailing-slash.js';
import type { SabreRequest, SabreResponse } from '../../http/types.js';
import type {
  BaggageAllowance,
  BaggageCharge,
  FareComponent,
  FareComponentSegment,
  FareOffer,
  FlightSegment,
  ItineraryLeg,
  PassengerFare,
  PassengerTotal,
  PricedItinerary,
  RevalidateItineraryInput,
  RevalidateItineraryOutput,
  SabreMessage,
  SegmentEndpoint,
  Tax,
  TotalFare,
} from './types.js';

const PATH = '/v5/shop/flights/revalidate';

/**
 * Builds the outgoing {@link SabreRequest} for the
 * `CreateRevalidateItinerary` operation.
 *
 * The request body is the OTA-style `RevalidateItineraryRequest`
 * envelope. Each origin/destination carries `TPA_Extensions.Flight`
 * entries specifying the exact flights to revalidate.
 */
export function toRevalidateRequest(
  baseUrl: string,
  input: RevalidateItineraryInput,
): SabreRequest {
  const url = new URL(PATH, ensureTrailingSlash(baseUrl));

  const originDestinationInformation = input.originDestinations.map((od) => {
    const flights = od.flights.map((f) => {
      const flight: Record<string, unknown> = {
        OriginLocation: { LocationCode: f.from },
        DestinationLocation: { LocationCode: f.to },
        Airline: { Marketing: f.marketingCarrier },
        Number: f.flightNumber,
        DepartureDateTime: f.departureDateTime,
        ArrivalDateTime: f.arrivalDateTime,
        // `Type` has `default: A` in the spec — sending the documented
        // default when the consumer didn't specify is following the spec.
        Type: f.type ?? 'A',
      };
      if (f.operatingCarrier !== undefined) {
        (flight.Airline as Record<string, unknown>).Operating = f.operatingCarrier;
      }
      if (f.classOfService !== undefined) {
        flight.ClassOfService = f.classOfService;
      }
      return flight;
    });

    return {
      OriginLocation: { LocationCode: od.from },
      DestinationLocation: { LocationCode: od.to },
      DepartureDateTime: od.departureDateTime,
      // `Fixed` has `default: false` in the spec — sending the documented
      // default is following the spec, not inventing a value.
      Fixed: false,
      TPA_Extensions: { Flight: flights },
    };
  });

  const passengerTypeQuantity = input.passengers.map((p) => ({
    Code: p.type,
    Quantity: p.quantity,
  }));

  const requestorID: Record<string, unknown> = { Type: '1', ID: '1' };
  if (input.pointOfSale.companyCode !== undefined) {
    requestorID.CompanyName = { Code: input.pointOfSale.companyCode };
  }
  // `FixedPCC` has `default: false` in the spec.
  const sourceEntry: Record<string, unknown> = { RequestorID: requestorID, FixedPCC: false };
  if (input.pointOfSale.pseudoCityCode !== undefined) {
    sourceEntry.PseudoCityCode = input.pointOfSale.pseudoCityCode;
  }

  const ota: Record<string, unknown> = {
    // The OTA `Version` field is the major-version digit only.
    Version: '5',
    // `AvailableFlightsOnly` has `default: true` in the spec.
    AvailableFlightsOnly: true,
    POS: { Source: [sourceEntry] },
    OriginDestinationInformation: originDestinationInformation,
    TravelerInfoSummary: {
      AirTravelerAvail: [{ PassengerTypeQuantity: passengerTypeQuantity }],
    },
    // TPA_Extensions.IntelliSellTransaction.RequestType.Name is the
    // protocol-level discriminator Sabre uses to pick the GIR response
    // schema version. Without it, Sabre rejects with "Incorrect GIR
    // response schema version used". Hardcoded to "50ITINS" — same
    // rationale as BFM.
    TPA_Extensions: {
      IntelliSellTransaction: { RequestType: { Name: '50ITINS' } },
    },
  };

  return {
    method: 'POST',
    url: url.toString(),
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ OTA_AirLowFareSearchRQ: ota }),
  };
}

/**
 * Parses the `CreateRevalidateItinerary` response into the public
 * output shape.
 *
 * The wire response uses Sabre's GIR (Grouped Itinerary Response)
 * format — the same deeply referenced graph as BFM. The mapper
 * resolves leg/schedule/fare-component references inline and preserves
 * every record Sabre returned.
 *
 * Throws {@link SabreParseError} only when the body fundamentally is
 * not a Sabre response (not JSON, not an object, missing the
 * documented top-level envelope).
 */
export function fromRevalidateResponse(res: SabreResponse): RevalidateItineraryOutput {
  let parsed: components['schemas']['GroupedItineraryResponse'];
  try {
    parsed = JSON.parse(res.body) as components['schemas']['GroupedItineraryResponse'];
  } catch (err) {
    throw new SabreParseError('Failed to parse Revalidate Itinerary response as JSON', res.body, {
      cause: err,
    });
  }

  if (parsed === null || typeof parsed !== 'object') {
    throw new SabreParseError('Revalidate Itinerary response was not a JSON object', parsed);
  }

  // Revalidate uses Sabre's OTA-style envelope: the real payload lives
  // under `groupedItineraryResponse`. Validate it explicitly here so a
  // missing or non-object envelope surfaces as `SabreParseError` rather
  // than a downstream `TypeError` when iterating over `scheduleDescs`,
  // `legDescs`, etc. Flat-schema services (lookups, get-ancillaries,
  // get-seats, booking-management) don't need this check because they
  // have no nested envelope.
  const root = parsed.groupedItineraryResponse;
  if (root === null || typeof root !== 'object') {
    throw new SabreParseError(
      'Revalidate Itinerary response was missing `groupedItineraryResponse`',
      parsed,
    );
  }

  const scheduleById = new Map<number, components['schemas']['ScheduleDescType']>();
  for (const sched of root.scheduleDescs ?? []) {
    if (typeof sched.id === 'number') {
      scheduleById.set(sched.id, sched);
    }
  }

  const legById = new Map<number, components['schemas']['LegType']>();
  for (const leg of root.legDescs ?? []) {
    if (typeof leg.id === 'number') {
      legById.set(leg.id, leg);
    }
  }

  const fareComponentById = new Map<number, components['schemas']['FareComponentType']>();
  for (const fc of root.fareComponentDescs ?? []) {
    if (typeof fc.id === 'number') {
      fareComponentById.set(fc.id, fc);
    }
  }

  const baggageAllowanceById = new Map<number, components['schemas']['BaggageAllowanceType']>();
  for (const ba of root.baggageAllowanceDescs ?? []) {
    if (typeof ba.id === 'number') {
      baggageAllowanceById.set(ba.id, ba);
    }
  }

  const baggageChargeById = new Map<number, components['schemas']['BaggageChargeType']>();
  for (const bc of root.baggageChargeDescs ?? []) {
    if (typeof bc.id === 'number') {
      baggageChargeById.set(bc.id, bc);
    }
  }

  const taxById = new Map<number, components['schemas']['TaxType']>();
  for (const t of root.taxDescs ?? []) {
    if (typeof t.id === 'number') {
      taxById.set(t.id, t);
    }
  }

  const itineraries: PricedItinerary[] = [];
  for (const group of root.itineraryGroups ?? []) {
    for (const itin of group.itineraries ?? []) {
      itineraries.push(
        buildPricedItinerary(
          itin,
          legById,
          scheduleById,
          fareComponentById,
          baggageAllowanceById,
          baggageChargeById,
          taxById,
        ),
      );
    }
  }

  const messages: SabreMessage[] = (root.messages ?? []).map((msg) => {
    const out: SabreMessage = {};
    if (msg.severity !== undefined) out.severity = msg.severity;
    if (msg.code !== undefined) out.code = msg.code;
    if (msg.text !== undefined) out.text = msg.text;
    return out;
  });

  return { itineraries, messages };
}

// ---------------------------------------------------------------------------
// Internal builder helpers
// ---------------------------------------------------------------------------

function buildPricedItinerary(
  itin: components['schemas']['ItineraryType'],
  legById: Map<number, components['schemas']['LegType']>,
  scheduleById: Map<number, components['schemas']['ScheduleDescType']>,
  fareComponentById: Map<number, components['schemas']['FareComponentType']>,
  baggageAllowanceById: Map<number, components['schemas']['BaggageAllowanceType']>,
  baggageChargeById: Map<number, components['schemas']['BaggageChargeType']>,
  taxById: Map<number, components['schemas']['TaxType']>,
): PricedItinerary {
  const legs: ItineraryLeg[] = (itin.legs ?? []).map((legRef) => {
    const ref = typeof legRef.ref === 'number' ? legRef.ref : undefined;
    const leg = ref !== undefined ? legById.get(ref) : undefined;
    return buildItineraryLeg(ref, leg, scheduleById);
  });

  const fareOffers: FareOffer[] = (itin.pricingInformation ?? []).map((pi) =>
    buildFareOffer(pi, fareComponentById, baggageAllowanceById, baggageChargeById, taxById),
  );

  const result: PricedItinerary = { legs, fareOffers };

  if (typeof itin.id === 'number') {
    result.id = itin.id;
  }

  const pricing = (itin.pricingInformation ?? [])[0];
  const totalFare = extractTotalFare(pricing?.fare);
  if (totalFare !== undefined) {
    result.totalFare = totalFare;
  }
  if (pricing?.fare?.validatingCarrierCode !== undefined) {
    result.validatingCarrierCode = pricing.fare.validatingCarrierCode;
  }
  if (pricing?.distributionModel !== undefined) {
    result.distributionModel = pricing.distributionModel;
  }

  return result;
}

function buildFareOffer(
  pricing: components['schemas']['PricingInformationType'],
  fareComponentById: Map<number, components['schemas']['FareComponentType']>,
  baggageAllowanceById: Map<number, components['schemas']['BaggageAllowanceType']>,
  baggageChargeById: Map<number, components['schemas']['BaggageChargeType']>,
  taxById: Map<number, components['schemas']['TaxType']>,
): FareOffer {
  const passengerFares: PassengerFare[] = [];
  for (const entry of pricing.fare?.passengerInfoList ?? []) {
    if (!entry.passengerInfo) continue;
    passengerFares.push(
      buildPassengerFare(
        entry.passengerInfo,
        fareComponentById,
        baggageAllowanceById,
        baggageChargeById,
        taxById,
      ),
    );
  }

  const offer: FareOffer = { passengerFares };
  const totalFare = extractTotalFare(pricing.fare);
  if (totalFare !== undefined) {
    offer.totalFare = totalFare;
  }
  if (pricing.fare?.validatingCarrierCode !== undefined) {
    offer.validatingCarrierCode = pricing.fare.validatingCarrierCode;
  }
  if (pricing.distributionModel !== undefined) {
    offer.distributionModel = pricing.distributionModel;
  }
  return offer;
}

function buildPassengerFare(
  info: components['schemas']['PassengerInformationType'],
  fareComponentById: Map<number, components['schemas']['FareComponentType']>,
  baggageAllowanceById: Map<number, components['schemas']['BaggageAllowanceType']>,
  baggageChargeById: Map<number, components['schemas']['BaggageChargeType']>,
  taxById: Map<number, components['schemas']['TaxType']>,
): PassengerFare {
  const fareComponents: FareComponent[] = (info.fareComponents ?? []).map((idEntry) => {
    const desc = typeof idEntry.ref === 'number' ? fareComponentById.get(idEntry.ref) : undefined;
    return buildFareComponent(idEntry, desc);
  });

  const baggageAllowances: BaggageAllowance[] = [];
  for (const bag of info.baggageInformation ?? []) {
    const allowanceRef = bag.allowance?.ref;
    if (typeof allowanceRef !== 'number') continue;
    baggageAllowances.push(buildBaggageAllowance(bag, baggageAllowanceById.get(allowanceRef)));
  }

  const baggageCharges: BaggageCharge[] = [];
  for (const bag of info.baggageInformation ?? []) {
    const chargeRef = bag.charge?.ref;
    if (typeof chargeRef !== 'number') continue;
    baggageCharges.push(buildBaggageCharge(bag, baggageChargeById.get(chargeRef)));
  }

  const taxes: Tax[] = (info.taxes ?? []).map((taxRef) => {
    const desc = typeof taxRef.ref === 'number' ? taxById.get(taxRef.ref) : undefined;
    return buildTax(desc);
  });

  const out: PassengerFare = { fareComponents, baggageAllowances, baggageCharges, taxes };

  if (info.passengerType !== undefined) out.passengerType = info.passengerType;
  if (typeof info.passengerNumber === 'number') out.passengerNumber = info.passengerNumber;
  if (typeof info.total === 'number') out.passengerCount = info.total;
  if (info.lastTicketDate !== undefined) out.lastTicketDate = info.lastTicketDate;
  if (info.lastTicketTime !== undefined) out.lastTicketTime = info.lastTicketTime;
  if (info.nonRefundable === true) out.nonRefundable = info.nonRefundable;

  const total = extractPassengerTotal(info.passengerTotalFare);
  if (total !== undefined) out.total = total;

  return out;
}

function buildFareComponent(
  idEntry: components['schemas']['FareComponentIDType'],
  desc: components['schemas']['FareComponentType'] | undefined,
): FareComponent {
  const segments: FareComponentSegment[] = [];
  for (const segEntry of idEntry.segments ?? []) {
    if (!segEntry.segment) continue;
    segments.push(buildFareComponentSegment(segEntry.segment));
  }

  const out: FareComponent = { segments };

  if (idEntry.beginAirport !== undefined) out.beginAirport = idEntry.beginAirport;
  if (idEntry.endAirport !== undefined) out.endAirport = idEntry.endAirport;

  if (desc) {
    if (desc.fareBasisCode !== undefined) out.fareBasisCode = desc.fareBasisCode;
    if (desc.cabinCode !== undefined) out.cabinCode = desc.cabinCode;
    if (desc.governingCarrier !== undefined) out.governingCarrier = desc.governingCarrier;
    if (desc.farePassengerType !== undefined) out.farePassengerType = desc.farePassengerType;
  }

  return out;
}

function buildFareComponentSegment(
  seg: components['schemas']['SegmentType'],
): FareComponentSegment {
  const out: FareComponentSegment = {};
  if (seg.bookingCode !== undefined) out.bookingCode = seg.bookingCode;
  if (seg.cabinCode !== undefined) out.cabinCode = seg.cabinCode;
  if (seg.mealCode !== undefined) out.mealCode = seg.mealCode;
  return out;
}

function buildBaggageAllowance(
  info: components['schemas']['BaggageInformationType'],
  allowance: components['schemas']['BaggageAllowanceType'] | undefined,
): BaggageAllowance {
  const segmentIndices: number[] = [];
  for (const seg of info.segments ?? []) {
    if (typeof seg.id === 'number') segmentIndices.push(seg.id);
  }

  const descriptions: string[] = [];
  if (typeof allowance?.description1 === 'string') descriptions.push(allowance.description1);
  if (typeof allowance?.description2 === 'string') descriptions.push(allowance.description2);

  const out: BaggageAllowance = { segmentIndices, descriptions };

  if (info.airlineCode !== undefined) out.airlineCode = info.airlineCode;
  if (info.provisionType !== undefined) out.provisionType = info.provisionType;

  if (allowance) {
    if (typeof allowance.pieceCount === 'number') out.pieceCount = allowance.pieceCount;
    if (typeof allowance.weight === 'number') out.weight = allowance.weight;
    if (typeof allowance.unit === 'string') out.weightUnit = allowance.unit;
  }

  return out;
}

function buildBaggageCharge(
  info: components['schemas']['BaggageInformationType'],
  charge: components['schemas']['BaggageChargeType'] | undefined,
): BaggageCharge {
  const segmentIndices: number[] = [];
  for (const seg of info.segments ?? []) {
    if (typeof seg.id === 'number') segmentIndices.push(seg.id);
  }

  const descriptions: string[] = [];
  if (typeof charge?.description1 === 'string') descriptions.push(charge.description1);
  if (typeof charge?.description2 === 'string') descriptions.push(charge.description2);

  const out: BaggageCharge = { segmentIndices, descriptions };

  if (info.airlineCode !== undefined) out.airlineCode = info.airlineCode;
  if (info.provisionType !== undefined) out.provisionType = info.provisionType;

  if (charge) {
    if (typeof charge.firstPiece === 'number') out.firstPiece = charge.firstPiece;
    if (typeof charge.lastPiece === 'number') out.lastPiece = charge.lastPiece;
    if (typeof charge.equivalentAmount === 'number') out.amount = charge.equivalentAmount;
    if (typeof charge.equivalentCurrency === 'string') out.currency = charge.equivalentCurrency;
    if (charge.noChargeNotAvailable !== undefined)
      out.noChargeNotAvailable = charge.noChargeNotAvailable;
  }

  return out;
}

function buildTax(desc: components['schemas']['TaxType'] | undefined): Tax {
  const out: Tax = {};
  if (!desc) return out;
  if (desc.code !== undefined) out.code = desc.code;
  if (typeof desc.amount === 'number') out.amount = desc.amount;
  if (desc.currency !== undefined) out.currency = desc.currency;
  if (desc.country !== undefined) out.country = desc.country;
  if (desc.description !== undefined) out.description = desc.description;
  if (desc.station !== undefined) out.station = desc.station;
  if (typeof desc.publishedAmount === 'number') out.publishedAmount = desc.publishedAmount;
  if (desc.publishedCurrency !== undefined) out.publishedCurrency = desc.publishedCurrency;
  return out;
}

function extractPassengerTotal(
  total: components['schemas']['PassengerTotalFareType'] | undefined,
): PassengerTotal | undefined {
  if (!total) return undefined;
  const out: PassengerTotal = {};
  if (typeof total.totalFare === 'number') out.totalAmount = total.totalFare;
  if (typeof total.currency === 'string') out.currency = total.currency;
  if (typeof total.baseFareAmount === 'number') out.baseFareAmount = total.baseFareAmount;
  if (typeof total.baseFareCurrency === 'string') out.baseFareCurrency = total.baseFareCurrency;
  if (typeof total.totalTaxAmount === 'number') out.totalTaxAmount = total.totalTaxAmount;
  return Object.keys(out).length > 0 ? out : undefined;
}

function buildItineraryLeg(
  ref: number | undefined,
  leg: components['schemas']['LegType'] | undefined,
  scheduleById: Map<number, components['schemas']['ScheduleDescType']>,
): ItineraryLeg {
  const segments: FlightSegment[] = (leg?.schedules ?? []).map((sched) => {
    const segRef = typeof sched.ref === 'number' ? sched.ref : undefined;
    const desc = segRef !== undefined ? scheduleById.get(segRef) : undefined;
    return buildFlightSegment(segRef, desc);
  });

  const out: ItineraryLeg = { segments };
  if (ref !== undefined) out.ref = ref;
  if (typeof leg?.elapsedTime === 'number') {
    out.elapsedMinutes = leg.elapsedTime;
  }
  return out;
}

function buildFlightSegment(
  ref: number | undefined,
  desc: components['schemas']['ScheduleDescType'] | undefined,
): FlightSegment {
  const segment: FlightSegment = {};
  if (ref !== undefined) segment.ref = ref;
  if (!desc) return segment;
  const carrier = desc.carrier;

  if (carrier?.marketing !== undefined) {
    segment.marketingCarrier = carrier.marketing;
  }
  if (typeof carrier?.marketingFlightNumber === 'number') {
    segment.marketingFlightNumber = carrier.marketingFlightNumber;
  }
  if (carrier?.operating !== undefined && carrier.operating !== carrier.marketing) {
    segment.operatingCarrier = carrier.operating;
  }
  if (typeof carrier?.operatingFlightNumber === 'number') {
    segment.operatingFlightNumber = carrier.operatingFlightNumber;
  }

  const departure = buildDepartureEndpoint(desc.departure);
  if (departure !== undefined) segment.departure = departure;
  const arrival = buildArrivalEndpoint(desc.arrival);
  if (arrival !== undefined) segment.arrival = arrival;

  if (typeof desc.elapsedTime === 'number') {
    segment.elapsedMinutes = desc.elapsedTime;
  }
  if (typeof desc.stopCount === 'number') {
    segment.stopCount = desc.stopCount;
  }
  if (desc.bookingDetails?.classOfService !== undefined) {
    segment.scheduleBookingClass = desc.bookingDetails.classOfService;
  }

  return segment;
}

function buildDepartureEndpoint(
  point: components['schemas']['Departure'] | undefined,
): SegmentEndpoint | undefined {
  if (!point) return undefined;
  const out: SegmentEndpoint = {};
  if (point.airport !== undefined) out.airport = point.airport;
  if (point.time !== undefined) out.time = point.time;
  if (point.terminal !== undefined) out.terminal = point.terminal;
  return out;
}

function buildArrivalEndpoint(
  point: components['schemas']['Arrival'] | undefined,
): SegmentEndpoint | undefined {
  if (!point) return undefined;
  const out: SegmentEndpoint = {};
  if (point.airport !== undefined) out.airport = point.airport;
  if (point.time !== undefined) out.time = point.time;
  if (point.terminal !== undefined) out.terminal = point.terminal;
  if (typeof point.dateAdjustment === 'number') {
    out.dateAdjustment = point.dateAdjustment;
  }
  return out;
}

function extractTotalFare(
  fare: components['schemas']['FareType'] | undefined,
): TotalFare | undefined {
  const tf = fare?.totalFare;
  if (!tf) return undefined;
  const out: TotalFare = {};
  if (typeof tf.totalPrice === 'number') out.totalAmount = tf.totalPrice;
  if (typeof tf.currency === 'string') out.currency = tf.currency;
  if (typeof tf.baseFareAmount === 'number') out.baseFareAmount = tf.baseFareAmount;
  if (typeof tf.baseFareCurrency === 'string') out.baseFareCurrency = tf.baseFareCurrency;
  if (typeof tf.totalTaxAmount === 'number') out.totalTaxAmount = tf.totalTaxAmount;
  return out;
}
