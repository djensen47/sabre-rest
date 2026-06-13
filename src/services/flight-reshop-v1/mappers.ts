import { SabreParseError } from '../../errors/sabre-parse-error.js';
import type { components } from '../../generated/flight-reshop.js';
import { ensureTrailingSlash } from '../../http/ensure-trailing-slash.js';
import type { SabreRequest, SabreResponse } from '../../http/types.js';
import type {
  FlightReshopFareComponent,
  FlightReshopFareComponentSegmentDetail,
  FlightReshopFlight,
  FlightReshopInput,
  FlightReshopJourney,
  FlightReshopJourneyResult,
  FlightReshopLocation,
  FlightReshopMessage,
  FlightReshopOffer,
  FlightReshopOfferFare,
  FlightReshopOfferItem,
  FlightReshopOfferTraveler,
  FlightReshopOutput,
  FlightReshopRetainItem,
  FlightReshopTicket,
  FlightReshopTimeWindow,
  FlightReshopTotalPrice,
} from './types.js';

const PATH = 'v1/offers/flightReshop';

type ReshopRequest = components['schemas']['FlightReshopRequest'];
type ReshopResponse = components['schemas']['FlightReshopResponse'];

// ---------------------------------------------------------------------------
// Request
// ---------------------------------------------------------------------------

/**
 * Builds the outgoing {@link SabreRequest} for the `reshop` operation
 * (Sabre operationId `flightReshop`).
 *
 * The wire body is a `FlightReshopRequest` JSON object. Only `journeys`
 * is required by the spec; optional groups (`tickets`, `bookingId`,
 * `targetPcc`, `fare.cabin`, `source.distributionModel`) are emitted
 * only when the caller supplies them, mirroring the spec's optionality.
 * No fixed/`default:` values are injected — the OAS defines no required
 * defaults on the fields v1 sends (`overrideCheckedInTicketCoupons`
 * carries a spec default but v1 does not surface it, so it is left to
 * Sabre to apply).
 */
export function toReshopRequest(baseUrl: string, input: FlightReshopInput): SabreRequest {
  const url = new URL(PATH, ensureTrailingSlash(baseUrl));

  const body: ReshopRequest = {
    journeys: input.journeys.map(buildJourney),
  };

  if (input.tickets && input.tickets.length > 0) {
    body.tickets = input.tickets.map(buildTicket);
  }
  if (input.bookingId !== undefined) body.bookingId = input.bookingId;
  if (input.targetPcc !== undefined) body.targetPcc = input.targetPcc;
  if (input.cabinName !== undefined) {
    // `forceRetailerRule` and `useOriginalPricing` both carry `default: false`
    // in the spec but the generator marks them required on `RequestedFare`.
    // Send the documented defaults (the canonical multi-traveler example omits
    // them and Sabre accepts cabin-only, so the defaults are the safe values).
    body.fare = {
      cabin: { name: input.cabinName },
      forceRetailerRule: false,
      useOriginalPricing: false,
    };
  }
  if (input.distributionModel !== undefined) {
    body.source = { distributionModel: input.distributionModel };
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

function buildLocation(
  loc: FlightReshopLocation,
): ReshopRequest['journeys'][number]['departureLocation'] {
  // GenericLocation is a oneOf city/airport — emit whichever the caller set.
  const out: { cityCode?: string; airportCode?: string } = {};
  if (loc.cityCode !== undefined) out.cityCode = loc.cityCode;
  if (loc.airportCode !== undefined) out.airportCode = loc.airportCode;
  return out;
}

function buildTimeWindow(tw: FlightReshopTimeWindow): { startTime: string; endTime: string } {
  return { startTime: tw.startTime, endTime: tw.endTime };
}

function buildJourney(j: FlightReshopJourney): ReshopRequest['journeys'][number] {
  const out: ReshopRequest['journeys'][number] = {
    departureLocation: buildLocation(j.departureLocation),
    arrivalLocation: buildLocation(j.arrivalLocation),
    departureDate: j.departureDate,
  };
  if (j.departureTimeWindow !== undefined) {
    out.departureTimeWindow = buildTimeWindow(j.departureTimeWindow);
  }
  if (j.arrivalTimeWindow !== undefined) {
    out.arrivalTimeWindow = buildTimeWindow(j.arrivalTimeWindow);
  }
  if (j.retainFlights && j.retainFlights.length > 0) {
    out.retainFlights = j.retainFlights.map(buildRetainItem);
  }
  return out;
}

type WireRetainItem = NonNullable<
  NonNullable<ReshopRequest['journeys'][number]['retainFlights']>
>[number];

/**
 * Maps one {@link FlightReshopRetainItem} to the wire `RetainItem` `oneOf`.
 * Emits the `flightItemId` variant when an id is given, otherwise the
 * `flightDetails` variant. `flightItemId` takes precedence when both are set.
 */
function buildRetainItem(item: FlightReshopRetainItem): WireRetainItem {
  if (item.flightItemId !== undefined) {
    return { flightItemId: item.flightItemId };
  }
  if (item.flightDetails !== undefined) {
    const d = item.flightDetails;
    const details: NonNullable<
      Extract<WireRetainItem, { flightDetails?: unknown }>['flightDetails']
    > = {
      marketingFlightNumber: d.marketingFlightNumber,
      marketingAirlineCode: d.marketingAirlineCode,
      departureAirportCode: d.departureAirportCode,
      arrivalAirportCode: d.arrivalAirportCode,
      departureDate: d.departureDate,
      departureTime: d.departureTime,
      arrivalDate: d.arrivalDate,
      arrivalTime: d.arrivalTime,
      bookingClassCode: d.bookingClassCode,
    };
    if (d.operatingFlightNumber !== undefined)
      details.operatingFlightNumber = d.operatingFlightNumber;
    if (d.operatingAirlineCode !== undefined) details.operatingAirlineCode = d.operatingAirlineCode;
    if (d.flightStatusCode !== undefined) details.flightStatusCode = d.flightStatusCode;
    if (d.brandCode !== undefined) details.brandCode = d.brandCode;
    if (d.keepBookingClass !== undefined) details.keepBookingClass = d.keepBookingClass;
    if (d.creationDate !== undefined) details.creationDate = d.creationDate;
    if (d.creationTime !== undefined) details.creationTime = d.creationTime;
    return { flightDetails: details };
  }
  // The OAS `RetainItem` oneOf requires exactly one variant. A retain item
  // with neither identifier is a caller error — fail loudly rather than send
  // a meaningless segment.
  throw new TypeError('retainFlights item requires either flightItemId or flightDetails');
}

function buildTicket(t: FlightReshopTicket): NonNullable<ReshopRequest['tickets']>[number] {
  // `overrideCheckedInTicketCoupons` carries a spec `default: false` and the
  // generator marks it required. v1 does not surface it, so send the
  // documented default rather than omitting it.
  const out: NonNullable<ReshopRequest['tickets']>[number] = {
    number: t.number,
    overrideCheckedInTicketCoupons: false,
  };
  if (t.date !== undefined) out.date = t.date;
  if (t.travelerIndex !== undefined) out.travelerIndex = t.travelerIndex;
  return out;
}

// ---------------------------------------------------------------------------
// Response
// ---------------------------------------------------------------------------

/**
 * Parses the `flightReshop` response into the public output shape.
 *
 * The operation resolves with HTTP 200 even when no offers can be
 * produced (the downline reason lands in `errors`), so this mapper does
 * not treat an empty `offers` array as a failure — it surfaces whatever
 * Sabre returned. Only a body that is not a JSON object throws
 * {@link SabreParseError}.
 */
export function fromReshopResponse(res: SabreResponse): FlightReshopOutput {
  let parsed: ReshopResponse;
  try {
    parsed = JSON.parse(res.body) as ReshopResponse;
  } catch (err) {
    throw new SabreParseError('Failed to parse Flight Reshop response as JSON', res.body, {
      cause: err,
    });
  }
  if (parsed === null || typeof parsed !== 'object') {
    throw new SabreParseError('Flight Reshop response was not a JSON object', parsed);
  }

  const out: FlightReshopOutput = {};
  if (parsed.timestamp !== undefined) out.timestamp = parsed.timestamp;
  if (parsed.numberOfOffers !== undefined) out.numberOfOffers = parsed.numberOfOffers;
  if (parsed.offers !== undefined) out.offers = parsed.offers.map(mapOffer);
  if (parsed.flights !== undefined) out.flights = parsed.flights.map(mapFlight);
  if (parsed.journeys !== undefined) out.journeys = parsed.journeys.map(mapJourney);
  if (parsed.errors !== undefined) out.errors = parsed.errors.map(mapMessage);
  if (parsed.warnings !== undefined) out.warnings = parsed.warnings.map(mapMessage);
  return out;
}

type ExchangeCharge = components['schemas']['ExchangeCharge'];

/**
 * Maps the fields shared by Sabre's `TotalPrice` (offer-level
 * `totalPriceDifference`) and `ExchangeTicketCharge` (fare-level
 * `priceDifference`). Both extend `ExchangeCharge`; they differ in the
 * shape of `totalFee` (a decimal string on `TotalPrice`, an object on
 * `ExchangeTicketCharge`) and in extra fields v1 does not surface
 * (`taxes`, `isResidualAmountForfeited`). v1 exposes only the common
 * `ExchangeCharge` scalars plus `TotalPrice.totalFee`.
 */
function mapExchangeCharge(p: ExchangeCharge): FlightReshopTotalPrice {
  const out: FlightReshopTotalPrice = {};
  if (p.type !== undefined) out.type = p.type;
  if (p.baseFare !== undefined) out.baseFare = p.baseFare;
  if (p.totalTax !== undefined) out.totalTax = p.totalTax;
  if (p.subtotalBeforeFee !== undefined) out.subtotalBeforeFee = p.subtotalBeforeFee;
  if (p.grandTotal !== undefined) out.grandTotal = p.grandTotal;
  if (p.currencyCode !== undefined) out.currencyCode = p.currencyCode;
  if (p.totalTaxOnFee !== undefined) out.totalTaxOnFee = p.totalTaxOnFee;
  return out;
}

function mapTotalPrice(
  p: NonNullable<NonNullable<ReshopResponse['offers']>[number]['totalPriceDifference']>,
): FlightReshopTotalPrice {
  const out = mapExchangeCharge(p);
  // TotalPrice.totalFee is a decimal string (unlike the fare-level object form).
  if (p.totalFee !== undefined) out.totalFee = p.totalFee;
  return out;
}

function mapTraveler(
  t: NonNullable<
    NonNullable<ReshopResponse['offers']>[number]['items'][number]['fares'][number]['travelers']
  >[number],
): FlightReshopOfferTraveler {
  const out: FlightReshopOfferTraveler = {};
  if (t.passengerTypeCode !== undefined) out.passengerTypeCode = t.passengerTypeCode;
  if (t.ticketNumber !== undefined) out.ticketNumber = t.ticketNumber;
  if (t.givenName !== undefined) out.givenName = t.givenName;
  if (t.surname !== undefined) out.surname = t.surname;
  return out;
}

function mapSegmentDetail(
  d: components['schemas']['FareComponentSegmentDetail'],
): FlightReshopFareComponentSegmentDetail {
  const out: FlightReshopFareComponentSegmentDetail = {};
  if (d.flightRef !== undefined) out.flightRef = d.flightRef;
  if (d.bookingClassCode !== undefined) out.bookingClassCode = d.bookingClassCode;
  if (d.cabinName !== undefined) out.cabinName = d.cabinName;
  return out;
}

function mapFareComponent(c: components['schemas']['FareComponent']): FlightReshopFareComponent {
  const out: FlightReshopFareComponent = {};
  if (c.fareBasisCode !== undefined) out.fareBasisCode = c.fareBasisCode;
  if (c.segmentDetails !== undefined) out.segmentDetails = c.segmentDetails.map(mapSegmentDetail);
  return out;
}

function mapFare(
  f: NonNullable<ReshopResponse['offers']>[number]['items'][number]['fares'][number],
): FlightReshopOfferFare {
  const out: FlightReshopOfferFare = {};
  if (f.travelers !== undefined) out.travelers = f.travelers.map(mapTraveler);
  if (f.priceDifference !== undefined) out.priceDifference = mapExchangeCharge(f.priceDifference);
  if (f.fareComponents !== undefined) out.fareComponents = f.fareComponents.map(mapFareComponent);
  return out;
}

function mapItem(
  item: NonNullable<ReshopResponse['offers']>[number]['items'][number],
): FlightReshopOfferItem {
  const out: FlightReshopOfferItem = {};
  if (item.id !== undefined) out.id = item.id;
  if (item.fares !== undefined) out.fares = item.fares.map(mapFare);
  return out;
}

function mapOffer(o: NonNullable<ReshopResponse['offers']>[number]): FlightReshopOffer {
  const out: FlightReshopOffer = {};
  if (o.id !== undefined) out.id = o.id;
  if (o.source !== undefined) {
    out.source =
      o.source.distributionModel !== undefined
        ? { distributionModel: o.source.distributionModel }
        : {};
  }
  if (o.createdAt !== undefined) out.createdAt = o.createdAt;
  if (o.validUntil !== undefined) out.validUntil = o.validUntil;
  if (o.journeyRefs !== undefined) out.journeyRefs = [...o.journeyRefs];
  if (o.totalPriceDifference !== undefined) {
    out.totalPriceDifference = mapTotalPrice(o.totalPriceDifference);
  }
  if (o.hasTravelersInDifferentCabins !== undefined) {
    out.hasTravelersInDifferentCabins = o.hasTravelersInDifferentCabins;
  }
  if (o.hasTravelersPricedInDifferentCurrencies !== undefined) {
    out.hasTravelersPricedInDifferentCurrencies = o.hasTravelersPricedInDifferentCurrencies;
  }
  if (o.hasMixedBrands !== undefined) out.hasMixedBrands = o.hasMixedBrands;
  if (o.isPriceGuaranteed !== undefined) out.isPriceGuaranteed = o.isPriceGuaranteed;
  if (o.splitBooking !== undefined) out.splitBooking = o.splitBooking;
  if (o.items !== undefined) out.items = o.items.map(mapItem);
  if (o.additionalOffersRefs !== undefined) out.additionalOffersRefs = [...o.additionalOffersRefs];
  return out;
}

function mapFlight(f: NonNullable<ReshopResponse['flights']>[number]): FlightReshopFlight {
  const out: FlightReshopFlight = {};
  if (f.id !== undefined) out.id = f.id;
  if (f.marketingFlightNumber !== undefined) out.marketingFlightNumber = f.marketingFlightNumber;
  if (f.marketingAirlineCode !== undefined) out.marketingAirlineCode = f.marketingAirlineCode;
  if (f.operatingFlightNumber !== undefined) out.operatingFlightNumber = f.operatingFlightNumber;
  if (f.operatingAirlineCode !== undefined) out.operatingAirlineCode = f.operatingAirlineCode;
  if (f.departureAirportCode !== undefined) out.departureAirportCode = f.departureAirportCode;
  if (f.arrivalAirportCode !== undefined) out.arrivalAirportCode = f.arrivalAirportCode;
  if (f.departureDate !== undefined) out.departureDate = f.departureDate;
  if (f.departureTime !== undefined) out.departureTime = f.departureTime;
  if (f.arrivalDate !== undefined) out.arrivalDate = f.arrivalDate;
  if (f.arrivalTime !== undefined) out.arrivalTime = f.arrivalTime;
  if (f.aircraftTypeCode !== undefined) out.aircraftTypeCode = f.aircraftTypeCode;
  if (f.durationInMinutes !== undefined) out.durationInMinutes = f.durationInMinutes;
  if (f.hasChangeOfGauge !== undefined) out.hasChangeOfGauge = f.hasChangeOfGauge;
  if (f.isMarriedWithPreviousFlight !== undefined) {
    out.isMarriedWithPreviousFlight = f.isMarriedWithPreviousFlight;
  }
  if (f.isBookingRequired !== undefined) out.isBookingRequired = f.isBookingRequired;
  return out;
}

function mapJourney(j: NonNullable<ReshopResponse['journeys']>[number]): FlightReshopJourneyResult {
  const out: FlightReshopJourneyResult = {};
  if (j.id !== undefined) out.id = j.id;
  if (j.flightRefs !== undefined) out.flightRefs = [...j.flightRefs];
  if (j.departureAirportCode !== undefined) out.departureAirportCode = j.departureAirportCode;
  if (j.arrivalAirportCode !== undefined) out.arrivalAirportCode = j.arrivalAirportCode;
  if (j.durationInMinutes !== undefined) out.durationInMinutes = j.durationInMinutes;
  return out;
}

function mapMessage(m: NonNullable<ReshopResponse['errors']>[number]): FlightReshopMessage {
  const out: FlightReshopMessage = {};
  if (m.category !== undefined) out.category = m.category;
  if (m.type !== undefined) out.type = m.type;
  if (m.description !== undefined) out.description = m.description;
  if (m.fieldPath !== undefined) out.fieldPath = m.fieldPath;
  if (m.fieldName !== undefined) out.fieldName = m.fieldName;
  if (m.fieldValue !== undefined) out.fieldValue = m.fieldValue;
  return out;
}
