import { SabreParseError } from '../../errors/sabre-parse-error.js';
import type { components } from '../../generated/bargain-finder-max.js';
import type { SabreRequest, SabreResponse } from '../../http/types.js';
import type {
  FlightSegment,
  ItineraryLeg,
  PricedItinerary,
  SabreMessage,
  SearchBargainFinderMaxInput,
  SearchBargainFinderMaxOutput,
  SegmentEndpoint,
  TotalFare,
} from './types.js';

const PATH = '/v5/offers/shop';

/**
 * Builds the outgoing {@link SabreRequest} for the `CreateBargainFinderMax`
 * operation.
 *
 * The request body is the OTA-style `BargainFinderMaxRequest` envelope.
 * The mapper constructs it as a plain object literal so consumers never
 * see the OTA naming, and so we don't have to satisfy openapi-typescript's
 * non-optional defaults on every field.
 */
export function toSearchRequest(baseUrl: string, input: SearchBargainFinderMaxInput): SabreRequest {
  const url = new URL(PATH, ensureTrailingSlash(baseUrl));

  const originDestinationInformation = input.originDestinations.map((od) => {
    const entry: Record<string, unknown> = {
      OriginLocation: { LocationCode: od.from },
      DestinationLocation: { LocationCode: od.to },
      DepartureDateTime: od.departureDateTime,
    };
    if (od.arrivalDateTime !== undefined) {
      entry.ArrivalDateTime = od.arrivalDateTime;
    }
    return entry;
  });

  const passengerTypeQuantity = input.passengers.map((p) => ({
    Code: p.type,
    Quantity: p.quantity,
  }));

  // Sabre's spec marks RequestorID.required = [ID, Type], with CompanyName
  // optional. ID and Type are documented as "Not used for processing. Use a
  // value of '1'", so the library hardcodes them and only attaches
  // CompanyName when the consumer provided a companyCode.
  const requestorID: Record<string, unknown> = { Type: '1', ID: '1' };
  if (input.pointOfSale.companyCode !== undefined) {
    requestorID.CompanyName = { Code: input.pointOfSale.companyCode };
  }
  const sourceEntry: Record<string, unknown> = { RequestorID: requestorID };
  if (input.pointOfSale.pseudoCityCode !== undefined) {
    sourceEntry.PseudoCityCode = input.pointOfSale.pseudoCityCode;
  }

  const ota: Record<string, unknown> = {
    // The OTA `Version` field is the major-version digit only — every
    // canonical example body in `bargain-finder-max.yml` for v5 sends
    // `"Version": "5"`. The schema property's `example: 'V4'` hint is
    // stale doc from the v4 era, not the actual format Sabre's runtime
    // accepts. Sending `"V5"` produces "Incorrect GIR response schema
    // version used" at runtime.
    Version: '5',
    // ResponseType and ResponseVersion are deliberately omitted: neither
    // is in the spec's required list, none of the canonical example
    // bodies include them, and Sabre's runtime rejects the values that
    // looked plausible (`"GIR-JSON"` / `"V5"`) with the same "Incorrect
    // GIR response schema version used" error. Let Sabre default both.
    POS: { Source: [sourceEntry] },
    OriginDestinationInformation: originDestinationInformation,
    TravelerInfoSummary: {
      AirTravelerAvail: [{ PassengerTypeQuantity: passengerTypeQuantity }],
    },
  };

  const travelPreferences = buildTravelPreferences(input.travelPreferences);
  if (travelPreferences !== undefined) {
    ota.TravelPreferences = travelPreferences;
  }

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
 * Parses the `CreateBargainFinderMax` response into the public output
 * shape.
 *
 * The wire response is a deeply referenced graph: itineraries reference
 * legs by id, legs reference schedules by id, fares reference passengers.
 * The mapper resolves the leg/schedule references inline and preserves
 * every record Sabre returned — every itinerary, every leg, every
 * segment, every endpoint, regardless of which fields are populated.
 * Whether to ignore an undercooked record is business logic that belongs
 * in the consumer's code, not the library's mapper.
 *
 * Throws {@link SabreParseError} only when the body fundamentally is not
 * a Sabre response (not JSON, not an object, missing the documented
 * top-level envelope).
 */
export function fromSearchResponse(res: SabreResponse): SearchBargainFinderMaxOutput {
  let parsed: components['schemas']['GroupedItineraryResponse'];
  try {
    parsed = JSON.parse(res.body) as components['schemas']['GroupedItineraryResponse'];
  } catch (err) {
    throw new SabreParseError('Failed to parse Bargain Finder Max response as JSON', res.body, {
      cause: err,
    });
  }

  if (parsed === null || typeof parsed !== 'object') {
    throw new SabreParseError('Bargain Finder Max response was not a JSON object', parsed);
  }

  const root = parsed.groupedItineraryResponse;
  if (root === null || typeof root !== 'object') {
    throw new SabreParseError(
      'Bargain Finder Max response was missing `groupedItineraryResponse`',
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

  const itineraries: PricedItinerary[] = [];
  for (const group of root.itineraryGroups ?? []) {
    for (const itin of group.itineraries ?? []) {
      itineraries.push(buildPricedItinerary(itin, legById, scheduleById));
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

function buildPricedItinerary(
  itin: components['schemas']['ItineraryType'],
  legById: Map<number, components['schemas']['LegType']>,
  scheduleById: Map<number, components['schemas']['ScheduleDescType']>,
): PricedItinerary {
  const legs: ItineraryLeg[] = (itin.legs ?? []).map((legRef) => {
    const ref = typeof legRef.ref === 'number' ? legRef.ref : undefined;
    const leg = ref !== undefined ? legById.get(ref) : undefined;
    return buildItineraryLeg(ref, leg, scheduleById);
  });

  const result: PricedItinerary = { legs };

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

function buildTravelPreferences(
  prefs: SearchBargainFinderMaxInput['travelPreferences'],
): Record<string, unknown> | undefined {
  if (!prefs) return undefined;
  const out: Record<string, unknown> = {};

  if (prefs.cabin !== undefined) {
    out.CabinPref = [{ Cabin: prefs.cabin, PreferLevel: 'Preferred' }];
  }

  if (prefs.preferredCarriers && prefs.preferredCarriers.length > 0) {
    out.VendorPref = prefs.preferredCarriers.map((code) => ({
      Code: code,
      PreferLevel: 'Preferred',
    }));
  }

  if (prefs.nonStopOnly === true) {
    out.MaxStopsQuantity = 0;
  } else if (typeof prefs.maxStopsPerLeg === 'number') {
    out.MaxStopsQuantity = prefs.maxStopsPerLeg;
  }

  return Object.keys(out).length > 0 ? out : undefined;
}

function ensureTrailingSlash(url: string): string {
  return url.endsWith('/') ? url : `${url}/`;
}
