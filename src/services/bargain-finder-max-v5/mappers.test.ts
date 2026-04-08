import { describe, expect, it } from 'vitest';
import { SabreParseError } from '../../errors/sabre-parse-error.js';
import type { SabreResponse } from '../../http/types.js';
import { fromSearchResponse, toSearchRequest } from './mappers.js';
import type { SearchBargainFinderMaxInput } from './types.js';

const okResponse = (body: unknown): SabreResponse => ({
  status: 200,
  statusText: 'OK',
  headers: {},
  body: typeof body === 'string' ? body : JSON.stringify(body),
});

const minimalInput: SearchBargainFinderMaxInput = {
  originDestinations: [
    { from: 'JFK', to: 'LHR', departureDateTime: '2025-12-25T10:00:00' },
    { from: 'LHR', to: 'JFK', departureDateTime: '2026-01-05T12:00:00' },
  ],
  passengers: [{ type: 'ADT', quantity: 1 }],
  pointOfSale: { companyCode: 'TN' },
};

describe('toSearchRequest', () => {
  it('builds a POST to the BFM v5 shop path with JSON headers', () => {
    const req = toSearchRequest('https://api.cert.platform.sabre.com', minimalInput);
    expect(req.method).toBe('POST');
    expect(req.url).toBe('https://api.cert.platform.sabre.com/v5/offers/shop');
    expect(req.headers.Accept).toBe('application/json');
    expect(req.headers['Content-Type']).toBe('application/json');
  });

  it('handles a base URL with a trailing slash', () => {
    const req = toSearchRequest('https://api.cert.platform.sabre.com/', minimalInput);
    expect(req.url).toBe('https://api.cert.platform.sabre.com/v5/offers/shop');
  });

  it('serializes the OTA envelope with origin/destination, passengers, and POS', () => {
    const req = toSearchRequest('https://api.cert.platform.sabre.com', minimalInput);
    expect(req.body).toBeDefined();
    const body = JSON.parse(req.body ?? '{}') as Record<string, unknown>;
    const ota = body.OTA_AirLowFareSearchRQ as Record<string, unknown>;

    expect(ota.Version).toBe('V5');
    expect(ota.ResponseType).toBe('GIR-JSON');
    expect(ota.ResponseVersion).toBe('V5');

    expect(ota.OriginDestinationInformation).toEqual([
      {
        OriginLocation: { LocationCode: 'JFK' },
        DestinationLocation: { LocationCode: 'LHR' },
        DepartureDateTime: '2025-12-25T10:00:00',
      },
      {
        OriginLocation: { LocationCode: 'LHR' },
        DestinationLocation: { LocationCode: 'JFK' },
        DepartureDateTime: '2026-01-05T12:00:00',
      },
    ]);

    expect(ota.TravelerInfoSummary).toEqual({
      AirTravelerAvail: [{ PassengerTypeQuantity: [{ Code: 'ADT', Quantity: 1 }] }],
    });

    expect(ota.POS).toEqual({
      Source: [
        {
          RequestorID: {
            Type: '1',
            ID: '1',
            CompanyName: { Code: 'TN' },
          },
        },
      ],
    });

    // No travel preferences supplied → key should not be present.
    expect('TravelPreferences' in ota).toBe(false);
  });

  it('includes ArrivalDateTime only when supplied', () => {
    const req = toSearchRequest('https://api.cert.platform.sabre.com', {
      ...minimalInput,
      originDestinations: [
        {
          from: 'JFK',
          to: 'LHR',
          departureDateTime: '2025-12-25T10:00:00',
          arrivalDateTime: '2025-12-26T06:00:00',
        },
      ],
    });
    const ota = (JSON.parse(req.body ?? '{}') as Record<string, unknown>)
      .OTA_AirLowFareSearchRQ as Record<string, unknown>;
    expect(ota.OriginDestinationInformation).toEqual([
      {
        OriginLocation: { LocationCode: 'JFK' },
        DestinationLocation: { LocationCode: 'LHR' },
        DepartureDateTime: '2025-12-25T10:00:00',
        ArrivalDateTime: '2025-12-26T06:00:00',
      },
    ]);
  });

  it('includes the pseudoCityCode on POS source when supplied', () => {
    const req = toSearchRequest('https://api.cert.platform.sabre.com', {
      ...minimalInput,
      pointOfSale: { companyCode: 'TN', pseudoCityCode: 'ABCD' },
    });
    const ota = (JSON.parse(req.body ?? '{}') as Record<string, unknown>)
      .OTA_AirLowFareSearchRQ as Record<string, unknown>;
    expect(ota.POS).toEqual({
      Source: [
        {
          RequestorID: {
            Type: '1',
            ID: '1',
            CompanyName: { Code: 'TN' },
          },
          PseudoCityCode: 'ABCD',
        },
      ],
    });
  });

  it('translates travel preferences into the OTA TravelPreferences sub-tree', () => {
    const req = toSearchRequest('https://api.cert.platform.sabre.com', {
      ...minimalInput,
      travelPreferences: {
        cabin: 'Business',
        preferredCarriers: ['BA', 'AA'],
        maxStopsPerLeg: 1,
      },
    });
    const ota = (JSON.parse(req.body ?? '{}') as Record<string, unknown>)
      .OTA_AirLowFareSearchRQ as Record<string, unknown>;
    expect(ota.TravelPreferences).toEqual({
      CabinPref: [{ Cabin: 'Business', PreferLevel: 'Preferred' }],
      VendorPref: [
        { Code: 'BA', PreferLevel: 'Preferred' },
        { Code: 'AA', PreferLevel: 'Preferred' },
      ],
      MaxStopsQuantity: 1,
    });
  });

  it('lets nonStopOnly take precedence over maxStopsPerLeg by setting MaxStopsQuantity to 0', () => {
    const req = toSearchRequest('https://api.cert.platform.sabre.com', {
      ...minimalInput,
      travelPreferences: { nonStopOnly: true, maxStopsPerLeg: 3 },
    });
    const ota = (JSON.parse(req.body ?? '{}') as Record<string, unknown>)
      .OTA_AirLowFareSearchRQ as Record<string, unknown>;
    expect(ota.TravelPreferences).toEqual({ MaxStopsQuantity: 0 });
  });

  it('omits TravelPreferences entirely when the prefs object has no useful fields', () => {
    const req = toSearchRequest('https://api.cert.platform.sabre.com', {
      ...minimalInput,
      travelPreferences: { preferredCarriers: [] },
    });
    const ota = (JSON.parse(req.body ?? '{}') as Record<string, unknown>)
      .OTA_AirLowFareSearchRQ as Record<string, unknown>;
    expect('TravelPreferences' in ota).toBe(false);
  });
});

describe('fromSearchResponse', () => {
  it('maps a populated response into priced itineraries with resolved leg/schedule references', () => {
    const out = fromSearchResponse(
      okResponse({
        groupedItineraryResponse: {
          version: 'V5',
          messages: [{ severity: 'Info', code: 'RULEID', text: 'fares displayed' }],
          scheduleDescs: [
            {
              id: 100,
              carrier: { marketing: 'BA', marketingFlightNumber: 178 },
              departure: { airport: 'JFK', time: '21:00:00', terminal: '7' },
              arrival: { airport: 'LHR', time: '09:00:00', dateAdjustment: 1 },
              elapsedTime: 420,
              stopCount: 0,
              bookingDetails: { classOfService: 'Y' },
            },
            {
              id: 101,
              carrier: {
                marketing: 'AA',
                marketingFlightNumber: 100,
                operating: 'BA',
                operatingFlightNumber: 178,
              },
              departure: { airport: 'LHR', time: '12:00:00' },
              arrival: { airport: 'JFK', time: '15:00:00' },
            },
          ],
          legDescs: [
            { id: 200, elapsedTime: 420, schedules: [{ ref: 100 }] },
            { id: 201, schedules: [{ ref: 101 }] },
          ],
          itineraryGroups: [
            {
              groupDescription: { legDescriptions: [{ departureDate: '2025-12-25' }] },
              itineraries: [
                {
                  id: 1,
                  pricingSource: 'ADVJR1',
                  legs: [{ ref: 200 }, { ref: 201 }],
                  pricingInformation: [
                    {
                      distributionModel: 'ATPCO',
                      fare: {
                        validatingCarrierCode: 'BA',
                        passengerInfoList: [],
                        totalFare: {
                          totalPrice: 1806.62,
                          currency: 'USD',
                          baseFareAmount: 1250,
                          baseFareCurrency: 'EUR',
                          totalTaxAmount: 556.62,
                        },
                      },
                    },
                  ],
                },
              ],
            },
          ],
        },
      }),
    );

    expect(out.itineraries).toHaveLength(1);
    const itin = out.itineraries[0];
    if (!itin) throw new Error('expected one itinerary');
    expect(itin.id).toBe(1);
    expect(itin.validatingCarrierCode).toBe('BA');
    expect(itin.distributionModel).toBe('ATPCO');
    expect(itin.totalFare).toEqual({
      totalAmount: 1806.62,
      currency: 'USD',
      baseFareAmount: 1250,
      baseFareCurrency: 'EUR',
      totalTaxAmount: 556.62,
    });

    expect(itin.legs).toHaveLength(2);
    const outbound = itin.legs[0];
    if (!outbound) throw new Error('expected outbound leg');
    expect(outbound.ref).toBe(200);
    expect(outbound.elapsedMinutes).toBe(420);
    expect(outbound.segments).toEqual([
      {
        ref: 100,
        marketingCarrier: 'BA',
        marketingFlightNumber: 178,
        departure: { airport: 'JFK', time: '21:00:00', terminal: '7' },
        arrival: { airport: 'LHR', time: '09:00:00', dateAdjustment: 1 },
        elapsedMinutes: 420,
        stopCount: 0,
        scheduleBookingClass: 'Y',
      },
    ]);

    const inbound = itin.legs[1];
    if (!inbound) throw new Error('expected inbound leg');
    expect(inbound.ref).toBe(201);
    const inboundSegment = inbound.segments[0];
    if (!inboundSegment) throw new Error('expected inbound segment');
    expect(inboundSegment.ref).toBe(101);
    expect(inboundSegment.marketingCarrier).toBe('AA');
    expect(inboundSegment.operatingCarrier).toBe('BA');
    expect(inboundSegment.operatingFlightNumber).toBe(178);
    // No dateAdjustment in the source → no dateAdjustment on the output.
    expect(inboundSegment.arrival?.dateAdjustment).toBeUndefined();
    expect(inboundSegment.arrival?.terminal).toBeUndefined();

    expect(out.messages).toEqual([{ severity: 'Info', code: 'RULEID', text: 'fares displayed' }]);
  });

  it('returns an empty list when the response has no itinerary groups', () => {
    const out = fromSearchResponse(
      okResponse({ groupedItineraryResponse: { version: 'V5', messages: [] } }),
    );
    expect(out.itineraries).toEqual([]);
    expect(out.messages).toEqual([]);
  });

  it('preserves itineraries even when their total fare is missing or empty', () => {
    const out = fromSearchResponse(
      okResponse({
        groupedItineraryResponse: {
          version: 'V5',
          messages: [],
          itineraryGroups: [
            {
              groupDescription: { legDescriptions: [{ departureDate: '2025-12-25' }] },
              itineraries: [
                // No pricingInformation entries at all.
                { id: 1, pricingSource: 'ADVJR1', pricingInformation: [] },
                // Pricing entry but no totalFare.
                {
                  id: 2,
                  pricingSource: 'ADVJR1',
                  pricingInformation: [{ fare: { passengerInfoList: [] } }],
                },
              ],
            },
          ],
        },
      }),
    );

    expect(out.itineraries).toHaveLength(2);
    expect(out.itineraries[0]).toEqual({ id: 1, legs: [] });
    expect(out.itineraries[1]).toEqual({ id: 2, legs: [] });
  });

  it('preserves segments whose schedule is missing fields, including a missing carrier', () => {
    const out = fromSearchResponse(
      okResponse({
        groupedItineraryResponse: {
          version: 'V5',
          messages: [],
          scheduleDescs: [
            {
              id: 100,
              // missing carrier entirely
              departure: { airport: 'JFK', time: '21:00:00' },
              arrival: { airport: 'LHR', time: '09:00:00' },
            },
            {
              id: 101,
              carrier: { marketing: 'BA', marketingFlightNumber: 178 },
              departure: { airport: 'JFK', time: '21:00:00' },
              arrival: { airport: 'LHR', time: '09:00:00' },
            },
          ],
          legDescs: [{ id: 200, schedules: [{ ref: 100 }, { ref: 101 }] }],
          itineraryGroups: [
            {
              groupDescription: { legDescriptions: [{ departureDate: '2025-12-25' }] },
              itineraries: [
                {
                  id: 1,
                  pricingSource: 'ADVJR1',
                  legs: [{ ref: 200 }],
                  pricingInformation: [
                    {
                      fare: {
                        passengerInfoList: [],
                        totalFare: { totalPrice: 100, currency: 'USD' },
                      },
                    },
                  ],
                },
              ],
            },
          ],
        },
      }),
    );

    expect(out.itineraries).toHaveLength(1);
    const segs = out.itineraries[0]?.legs[0]?.segments ?? [];
    // Both segments are present. The first has only its ref + departure +
    // arrival populated (no carrier fields); the second has the carrier.
    expect(segs).toEqual([
      {
        ref: 100,
        departure: { airport: 'JFK', time: '21:00:00' },
        arrival: { airport: 'LHR', time: '09:00:00' },
      },
      {
        ref: 101,
        marketingCarrier: 'BA',
        marketingFlightNumber: 178,
        departure: { airport: 'JFK', time: '21:00:00' },
        arrival: { airport: 'LHR', time: '09:00:00' },
      },
    ]);
  });

  it('preserves leg refs that do not resolve to a known leg description', () => {
    const out = fromSearchResponse(
      okResponse({
        groupedItineraryResponse: {
          version: 'V5',
          messages: [],
          // No legDescs entry — every leg ref will be an orphan.
          itineraryGroups: [
            {
              groupDescription: { legDescriptions: [{ departureDate: '2025-12-25' }] },
              itineraries: [
                {
                  id: 1,
                  pricingSource: 'ADVJR1',
                  legs: [{ ref: 200 }, { ref: 201 }],
                  pricingInformation: [
                    {
                      fare: {
                        passengerInfoList: [],
                        totalFare: { totalPrice: 100, currency: 'USD' },
                      },
                    },
                  ],
                },
              ],
            },
          ],
        },
      }),
    );

    const itin = out.itineraries[0];
    if (!itin) throw new Error('expected one itinerary');
    expect(itin.legs).toEqual([
      { ref: 200, segments: [] },
      { ref: 201, segments: [] },
    ]);
  });

  it('preserves schedule refs that do not resolve to a known schedule description', () => {
    const out = fromSearchResponse(
      okResponse({
        groupedItineraryResponse: {
          version: 'V5',
          messages: [],
          scheduleDescs: [], // empty — every schedule ref will be an orphan
          legDescs: [{ id: 200, schedules: [{ ref: 999 }] }],
          itineraryGroups: [
            {
              groupDescription: { legDescriptions: [{ departureDate: '2025-12-25' }] },
              itineraries: [
                {
                  id: 1,
                  pricingSource: 'ADVJR1',
                  legs: [{ ref: 200 }],
                  pricingInformation: [
                    {
                      fare: {
                        passengerInfoList: [],
                        totalFare: { totalPrice: 100, currency: 'USD' },
                      },
                    },
                  ],
                },
              ],
            },
          ],
        },
      }),
    );

    const segs = out.itineraries[0]?.legs[0]?.segments ?? [];
    expect(segs).toEqual([{ ref: 999 }]);
  });

  it('throws SabreParseError when the body is not valid JSON', () => {
    const res: SabreResponse = {
      status: 200,
      statusText: 'OK',
      headers: {},
      body: '<html>not json</html>',
    };
    expect(() => fromSearchResponse(res)).toThrow(SabreParseError);
  });

  it('throws SabreParseError when the body is JSON but not an object', () => {
    expect(() => fromSearchResponse(okResponse(null))).toThrow(SabreParseError);
  });

  it('throws SabreParseError when groupedItineraryResponse is missing', () => {
    expect(() => fromSearchResponse(okResponse({}))).toThrow(SabreParseError);
  });
});
