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

    // The OTA Version field uses the major-version digit only — matches
    // every canonical example body in the spec for v5. Sending 'V5' here
    // produces "Incorrect GIR response schema version used" at runtime.
    expect(ota.Version).toBe('5');
    // `AvailableFlightsOnly` has `default: true` in the spec — sending
    // the documented default is following the spec, not inventing data.
    expect(ota.AvailableFlightsOnly).toBe(true);
    // ResponseType and ResponseVersion are deliberately not sent: neither
    // is in the spec's required list, none of the canonical example bodies
    // include them, and Sabre's runtime rejected the values that looked
    // plausible. Regression guard so we don't accidentally re-add them.
    expect('ResponseType' in ota).toBe(false);
    expect('ResponseVersion' in ota).toBe(false);

    // `Fixed: false` on each OriginDestinationInformation entry comes from
    // the spec's `default: false` keyword — it's the documented default,
    // not an invented value. Sabre's runtime rejects requests that omit
    // the spec defaults entirely.
    expect(ota.OriginDestinationInformation).toEqual([
      {
        OriginLocation: { LocationCode: 'JFK' },
        DestinationLocation: { LocationCode: 'LHR' },
        DepartureDateTime: '2025-12-25T10:00:00',
        Fixed: false,
      },
      {
        OriginLocation: { LocationCode: 'LHR' },
        DestinationLocation: { LocationCode: 'JFK' },
        DepartureDateTime: '2026-01-05T12:00:00',
        Fixed: false,
      },
    ]);

    expect(ota.TravelerInfoSummary).toEqual({
      AirTravelerAvail: [{ PassengerTypeQuantity: [{ Code: 'ADT', Quantity: 1 }] }],
    });

    // `FixedPCC: false` on each Source entry comes from the spec's
    // `default: false` keyword — same rule as `Fixed` above.
    expect(ota.POS).toEqual({
      Source: [
        {
          RequestorID: {
            Type: '1',
            ID: '1',
            CompanyName: { Code: 'TN' },
          },
          FixedPCC: false,
        },
      ],
    });

    // TPA_Extensions.IntelliSellTransaction.RequestType.Name is the
    // protocol-level discriminator Sabre's runtime uses to pick which GIR
    // response schema version to return. Without it, Sabre rejects the
    // request with "Incorrect GIR response schema version used". The
    // library hardcodes "50ITINS" because the public input/output shape
    // is designed around that request flavor.
    expect(ota.TPA_Extensions).toEqual({
      IntelliSellTransaction: { RequestType: { Name: '50ITINS' } },
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
        Fixed: false,
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
          FixedPCC: false,
          PseudoCityCode: 'ABCD',
        },
      ],
    });
  });

  it('omits CompanyName from RequestorID when companyCode is not supplied', () => {
    // Sabre's spec marks RequestorID.required = [ID, Type], with CompanyName
    // optional. The mapper hardcodes ID and Type per Sabre's "use a value of
    // '1'" doc and only attaches CompanyName when the consumer asked for it.
    const req = toSearchRequest('https://api.cert.platform.sabre.com', {
      ...minimalInput,
      pointOfSale: {},
    });
    const ota = (JSON.parse(req.body ?? '{}') as Record<string, unknown>)
      .OTA_AirLowFareSearchRQ as Record<string, unknown>;
    expect(ota.POS).toEqual({
      Source: [
        {
          RequestorID: { Type: '1', ID: '1' },
          FixedPCC: false,
        },
      ],
    });
  });

  it('attaches PseudoCityCode without CompanyName when only pseudoCityCode is supplied', () => {
    const req = toSearchRequest('https://api.cert.platform.sabre.com', {
      ...minimalInput,
      pointOfSale: { pseudoCityCode: 'ABCD' },
    });
    const ota = (JSON.parse(req.body ?? '{}') as Record<string, unknown>)
      .OTA_AirLowFareSearchRQ as Record<string, unknown>;
    expect(ota.POS).toEqual({
      Source: [
        {
          RequestorID: { Type: '1', ID: '1' },
          FixedPCC: false,
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
    // The second itinerary's empty `passengerInfoList` still produces a
    // fare offer (with an empty passengerFares array) because a pricing
    // entry was present. The first itinerary has no pricing entries at all
    // and thus an empty `fareOffers` array.
    expect(out.itineraries[0]).toEqual({ id: 1, legs: [], fareOffers: [] });
    expect(out.itineraries[1]).toEqual({
      id: 2,
      legs: [],
      fareOffers: [{ passengerFares: [] }],
    });
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

describe('fareOffers', () => {
  it('surfaces a single offer with fare components, segment booking codes, and a baggage allowance', () => {
    const out = fromSearchResponse(
      okResponse({
        groupedItineraryResponse: {
          version: 'V5',
          messages: [],
          fareComponentDescs: [
            {
              id: 10,
              fareBasisCode: 'TKEE4M',
              cabinCode: 'Y',
              governingCarrier: 'BA',
              farePassengerType: 'ADT',
            },
            {
              id: 11,
              fareBasisCode: 'TLEE4M',
              cabinCode: 'Y',
              governingCarrier: 'BA',
              farePassengerType: 'ADT',
            },
          ],
          baggageAllowanceDescs: [
            {
              id: 20,
              description1: 'UP TO 50 POUNDS/23 KILOGRAMS',
              description2: 'UP TO 62 LINEAR INCHES/158 LINEAR CENTIMETERS',
              pieceCount: 1,
              weight: 23,
              unit: 'kg',
            },
          ],
          itineraryGroups: [
            {
              itineraries: [
                {
                  id: 1,
                  pricingInformation: [
                    {
                      distributionModel: 'ATPCO',
                      fare: {
                        validatingCarrierCode: 'BA',
                        totalFare: { totalPrice: 800, currency: 'USD' },
                        passengerInfoList: [
                          {
                            passengerInfo: {
                              passengerType: 'ADT',
                              passengerNumber: 1,
                              total: 1,
                              nonRefundable: true,
                              lastTicketDate: '2026-04-30',
                              lastTicketTime: '23:59',
                              passengerTotalFare: {
                                totalFare: 800,
                                currency: 'USD',
                                baseFareAmount: 700,
                                totalTaxAmount: 100,
                              },
                              fareComponents: [
                                {
                                  ref: 10,
                                  beginAirport: 'JFK',
                                  endAirport: 'LHR',
                                  segments: [
                                    {
                                      segment: { bookingCode: 'T', cabinCode: 'Y', mealCode: 'B' },
                                    },
                                  ],
                                },
                                {
                                  ref: 11,
                                  beginAirport: 'LHR',
                                  endAirport: 'JFK',
                                  segments: [{ segment: { bookingCode: 'T', cabinCode: 'Y' } }],
                                },
                              ],
                              baggageInformation: [
                                {
                                  airlineCode: 'BA',
                                  provisionType: 'A',
                                  allowance: { ref: 20 },
                                  segments: [{ id: 0 }, { id: 1 }],
                                },
                              ],
                            },
                          },
                        ],
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
    expect(itin?.fareOffers).toHaveLength(1);
    const offer = itin?.fareOffers[0];
    expect(offer?.totalFare).toEqual({ totalAmount: 800, currency: 'USD' });
    expect(offer?.validatingCarrierCode).toBe('BA');
    expect(offer?.distributionModel).toBe('ATPCO');
    expect(offer?.passengerFares).toHaveLength(1);

    const pf = offer?.passengerFares[0];
    expect(pf).toEqual({
      passengerType: 'ADT',
      passengerNumber: 1,
      passengerCount: 1,
      nonRefundable: true,
      lastTicketDate: '2026-04-30',
      lastTicketTime: '23:59',
      total: {
        totalAmount: 800,
        currency: 'USD',
        baseFareAmount: 700,
        totalTaxAmount: 100,
      },
      fareComponents: [
        {
          fareBasisCode: 'TKEE4M',
          cabinCode: 'Y',
          governingCarrier: 'BA',
          farePassengerType: 'ADT',
          beginAirport: 'JFK',
          endAirport: 'LHR',
          segments: [{ bookingCode: 'T', cabinCode: 'Y', mealCode: 'B' }],
        },
        {
          fareBasisCode: 'TLEE4M',
          cabinCode: 'Y',
          governingCarrier: 'BA',
          farePassengerType: 'ADT',
          beginAirport: 'LHR',
          endAirport: 'JFK',
          segments: [{ bookingCode: 'T', cabinCode: 'Y' }],
        },
      ],
      baggageAllowances: [
        {
          segmentIndices: [0, 1],
          airlineCode: 'BA',
          provisionType: 'A',
          pieceCount: 1,
          weight: 23,
          weightUnit: 'kg',
          descriptions: [
            'UP TO 50 POUNDS/23 KILOGRAMS',
            'UP TO 62 LINEAR INCHES/158 LINEAR CENTIMETERS',
          ],
        },
      ],
      baggageCharges: [],
    });
  });

  it('surfaces every pricingInformation entry as a separate fareOffer; top-level fields mirror [0]', () => {
    const out = fromSearchResponse(
      okResponse({
        groupedItineraryResponse: {
          version: 'V5',
          messages: [],
          itineraryGroups: [
            {
              itineraries: [
                {
                  id: 1,
                  pricingInformation: [
                    {
                      distributionModel: 'ATPCO',
                      fare: {
                        validatingCarrierCode: 'BA',
                        totalFare: { totalPrice: 800, currency: 'USD' },
                        passengerInfoList: [],
                      },
                    },
                    {
                      distributionModel: 'NDC',
                      fare: {
                        validatingCarrierCode: 'AA',
                        totalFare: { totalPrice: 950, currency: 'USD' },
                        passengerInfoList: [],
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
    expect(itin?.fareOffers).toHaveLength(2);
    expect(itin?.fareOffers[0]?.distributionModel).toBe('ATPCO');
    expect(itin?.fareOffers[0]?.totalFare).toEqual({ totalAmount: 800, currency: 'USD' });
    expect(itin?.fareOffers[1]?.distributionModel).toBe('NDC');
    expect(itin?.fareOffers[1]?.totalFare).toEqual({ totalAmount: 950, currency: 'USD' });
    // Top-level fields still mirror the first pricing entry, unchanged.
    expect(itin?.totalFare).toEqual({ totalAmount: 800, currency: 'USD' });
    expect(itin?.validatingCarrierCode).toBe('BA');
    expect(itin?.distributionModel).toBe('ATPCO');
  });

  it('surfaces multiple passengers within a single offer with their own fare components', () => {
    const out = fromSearchResponse(
      okResponse({
        groupedItineraryResponse: {
          version: 'V5',
          messages: [],
          fareComponentDescs: [
            { id: 30, fareBasisCode: 'ADTFARE', cabinCode: 'Y' },
            { id: 31, fareBasisCode: 'CHDFARE', cabinCode: 'Y' },
          ],
          itineraryGroups: [
            {
              itineraries: [
                {
                  id: 1,
                  pricingInformation: [
                    {
                      fare: {
                        passengerInfoList: [
                          {
                            passengerInfo: {
                              passengerType: 'ADT',
                              fareComponents: [
                                { ref: 30, beginAirport: 'JFK', endAirport: 'LHR', segments: [] },
                              ],
                            },
                          },
                          {
                            passengerInfo: {
                              passengerType: 'CHD',
                              fareComponents: [
                                { ref: 31, beginAirport: 'JFK', endAirport: 'LHR', segments: [] },
                              ],
                            },
                          },
                        ],
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

    const fares = out.itineraries[0]?.fareOffers[0]?.passengerFares;
    expect(fares).toHaveLength(2);
    expect(fares?.[0]?.passengerType).toBe('ADT');
    expect(fares?.[0]?.fareComponents[0]?.fareBasisCode).toBe('ADTFARE');
    expect(fares?.[1]?.passengerType).toBe('CHD');
    expect(fares?.[1]?.fareComponents[0]?.fareBasisCode).toBe('CHDFARE');
  });

  it('preserves a fare component with an unresolved ref using only the inline begin/end airports', () => {
    const out = fromSearchResponse(
      okResponse({
        groupedItineraryResponse: {
          version: 'V5',
          messages: [],
          fareComponentDescs: [],
          itineraryGroups: [
            {
              itineraries: [
                {
                  id: 1,
                  pricingInformation: [
                    {
                      fare: {
                        passengerInfoList: [
                          {
                            passengerInfo: {
                              passengerType: 'ADT',
                              fareComponents: [
                                {
                                  ref: 999,
                                  beginAirport: 'JFK',
                                  endAirport: 'LHR',
                                  segments: [{ segment: { bookingCode: 'Y' } }],
                                },
                              ],
                            },
                          },
                        ],
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

    const fc = out.itineraries[0]?.fareOffers[0]?.passengerFares[0]?.fareComponents[0];
    expect(fc).toEqual({
      beginAirport: 'JFK',
      endAirport: 'LHR',
      segments: [{ bookingCode: 'Y' }],
    });
  });

  it('preserves a baggage allowance with an unresolved ref using only the inline info', () => {
    const out = fromSearchResponse(
      okResponse({
        groupedItineraryResponse: {
          version: 'V5',
          messages: [],
          baggageAllowanceDescs: [],
          itineraryGroups: [
            {
              itineraries: [
                {
                  id: 1,
                  pricingInformation: [
                    {
                      fare: {
                        passengerInfoList: [
                          {
                            passengerInfo: {
                              passengerType: 'ADT',
                              fareComponents: [],
                              baggageInformation: [
                                {
                                  airlineCode: 'BA',
                                  provisionType: 'A',
                                  allowance: { ref: 999 },
                                  segments: [{ id: 0 }],
                                },
                              ],
                            },
                          },
                        ],
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

    const bag = out.itineraries[0]?.fareOffers[0]?.passengerFares[0]?.baggageAllowances[0];
    expect(bag).toEqual({
      segmentIndices: [0],
      airlineCode: 'BA',
      provisionType: 'A',
      descriptions: [],
    });
  });

  it('skips passenger entries that are passengerNotAvailable stubs', () => {
    const out = fromSearchResponse(
      okResponse({
        groupedItineraryResponse: {
          version: 'V5',
          messages: [],
          itineraryGroups: [
            {
              itineraries: [
                {
                  id: 1,
                  pricingInformation: [
                    {
                      fare: {
                        passengerInfoList: [
                          {
                            passengerInfo: {
                              passengerType: 'ADT',
                              fareComponents: [],
                            },
                          },
                          {
                            passengerNotAvailableInfo: { passengerType: 'CHD' },
                          },
                        ],
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

    const fares = out.itineraries[0]?.fareOffers[0]?.passengerFares;
    expect(fares).toHaveLength(1);
    expect(fares?.[0]?.passengerType).toBe('ADT');
  });

  it('produces an empty fareOffers array for an itinerary with no pricingInformation', () => {
    const out = fromSearchResponse(
      okResponse({
        groupedItineraryResponse: {
          version: 'V5',
          messages: [],
          itineraryGroups: [
            {
              itineraries: [{ id: 1 }],
            },
          ],
        },
      }),
    );

    expect(out.itineraries[0]?.fareOffers).toEqual([]);
    expect(out.itineraries[0]?.totalFare).toBeUndefined();
    expect(out.itineraries[0]?.validatingCarrierCode).toBeUndefined();
    expect(out.itineraries[0]?.distributionModel).toBeUndefined();
  });

  it('skips ARUNK (surface) entries inside fare component segments without crashing', () => {
    const out = fromSearchResponse(
      okResponse({
        groupedItineraryResponse: {
          version: 'V5',
          messages: [],
          itineraryGroups: [
            {
              itineraries: [
                {
                  id: 1,
                  pricingInformation: [
                    {
                      fare: {
                        passengerInfoList: [
                          {
                            passengerInfo: {
                              passengerType: 'ADT',
                              fareComponents: [
                                {
                                  ref: 1,
                                  beginAirport: 'JFK',
                                  endAirport: 'LAX',
                                  segments: [
                                    { segment: { bookingCode: 'Y' } },
                                    { surface: {} },
                                    { segment: { bookingCode: 'B' } },
                                  ],
                                },
                              ],
                            },
                          },
                        ],
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

    const segs = out.itineraries[0]?.fareOffers[0]?.passengerFares[0]?.fareComponents[0]?.segments;
    expect(segs).toEqual([{ bookingCode: 'Y' }, { bookingCode: 'B' }]);
  });

  it('surfaces baggage charges with piece range, amount, currency, and descriptions', () => {
    const out = fromSearchResponse(
      okResponse({
        groupedItineraryResponse: {
          version: 'V5',
          messages: [],
          baggageChargeDescs: [
            {
              id: 50,
              firstPiece: 1,
              lastPiece: 1,
              equivalentAmount: 35,
              equivalentCurrency: 'USD',
              description1: 'UP TO 50 POUNDS/23 KILOGRAMS',
              description2: 'UP TO 62 LINEAR INCHES/158 LINEAR CENTIMETERS',
            },
          ],
          itineraryGroups: [
            {
              itineraries: [
                {
                  id: 1,
                  pricingInformation: [
                    {
                      fare: {
                        passengerInfoList: [
                          {
                            passengerInfo: {
                              passengerType: 'ADT',
                              fareComponents: [],
                              baggageInformation: [
                                {
                                  airlineCode: 'AA',
                                  provisionType: 'C',
                                  charge: { ref: 50 },
                                  segments: [{ id: 0 }, { id: 1 }],
                                },
                              ],
                            },
                          },
                        ],
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

    const charges = out.itineraries[0]?.fareOffers[0]?.passengerFares[0]?.baggageCharges;
    expect(charges).toEqual([
      {
        segmentIndices: [0, 1],
        airlineCode: 'AA',
        provisionType: 'C',
        firstPiece: 1,
        lastPiece: 1,
        amount: 35,
        currency: 'USD',
        descriptions: [
          'UP TO 50 POUNDS/23 KILOGRAMS',
          'UP TO 62 LINEAR INCHES/158 LINEAR CENTIMETERS',
        ],
      },
    ]);
  });

  it('preserves a baggage charge with an unresolved ref using only inline info', () => {
    const out = fromSearchResponse(
      okResponse({
        groupedItineraryResponse: {
          version: 'V5',
          messages: [],
          baggageChargeDescs: [],
          itineraryGroups: [
            {
              itineraries: [
                {
                  id: 1,
                  pricingInformation: [
                    {
                      fare: {
                        passengerInfoList: [
                          {
                            passengerInfo: {
                              passengerType: 'ADT',
                              fareComponents: [],
                              baggageInformation: [
                                {
                                  airlineCode: 'DL',
                                  provisionType: 'C',
                                  charge: { ref: 999 },
                                  segments: [{ id: 0 }],
                                },
                              ],
                            },
                          },
                        ],
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

    const charge = out.itineraries[0]?.fareOffers[0]?.passengerFares[0]?.baggageCharges[0];
    expect(charge).toEqual({
      segmentIndices: [0],
      airlineCode: 'DL',
      provisionType: 'C',
      descriptions: [],
    });
  });

  it('passes through noChargeNotAvailable when the charge is free', () => {
    const out = fromSearchResponse(
      okResponse({
        groupedItineraryResponse: {
          version: 'V5',
          messages: [],
          baggageChargeDescs: [{ id: 60, noChargeNotAvailable: 'F' }],
          itineraryGroups: [
            {
              itineraries: [
                {
                  id: 1,
                  pricingInformation: [
                    {
                      fare: {
                        passengerInfoList: [
                          {
                            passengerInfo: {
                              passengerType: 'ADT',
                              fareComponents: [],
                              baggageInformation: [
                                {
                                  airlineCode: 'BA',
                                  provisionType: 'C',
                                  charge: { ref: 60 },
                                  segments: [{ id: 0 }],
                                },
                              ],
                            },
                          },
                        ],
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

    const charge = out.itineraries[0]?.fareOffers[0]?.passengerFares[0]?.baggageCharges[0];
    expect(charge?.noChargeNotAvailable).toBe('F');
    expect(charge?.amount).toBeUndefined();
  });

  it('emits an entry in both baggageAllowances and baggageCharges when a baggageInformation has both refs', () => {
    const out = fromSearchResponse(
      okResponse({
        groupedItineraryResponse: {
          version: 'V5',
          messages: [],
          baggageAllowanceDescs: [{ id: 70, pieceCount: 2 }],
          baggageChargeDescs: [
            {
              id: 80,
              firstPiece: 1,
              lastPiece: 2,
              equivalentAmount: 50,
              equivalentCurrency: 'USD',
            },
          ],
          itineraryGroups: [
            {
              itineraries: [
                {
                  id: 1,
                  pricingInformation: [
                    {
                      fare: {
                        passengerInfoList: [
                          {
                            passengerInfo: {
                              passengerType: 'ADT',
                              fareComponents: [],
                              baggageInformation: [
                                {
                                  airlineCode: 'UA',
                                  provisionType: 'A',
                                  allowance: { ref: 70 },
                                  charge: { ref: 80 },
                                  segments: [{ id: 0 }],
                                },
                              ],
                            },
                          },
                        ],
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

    const pf = out.itineraries[0]?.fareOffers[0]?.passengerFares[0];
    expect(pf?.baggageAllowances).toHaveLength(1);
    expect(pf?.baggageAllowances[0]?.pieceCount).toBe(2);
    expect(pf?.baggageCharges).toHaveLength(1);
    expect(pf?.baggageCharges[0]?.amount).toBe(50);
    expect(pf?.baggageCharges[0]?.currency).toBe('USD');
  });

  it('returns empty baggageCharges when no charge refs are present', () => {
    const out = fromSearchResponse(
      okResponse({
        groupedItineraryResponse: {
          version: 'V5',
          messages: [],
          itineraryGroups: [
            {
              itineraries: [
                {
                  id: 1,
                  pricingInformation: [
                    {
                      fare: {
                        passengerInfoList: [
                          {
                            passengerInfo: {
                              passengerType: 'ADT',
                              fareComponents: [],
                              baggageInformation: [
                                {
                                  airlineCode: 'BA',
                                  provisionType: 'A',
                                  allowance: { ref: 1 },
                                  segments: [{ id: 0 }],
                                },
                              ],
                            },
                          },
                        ],
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

    expect(out.itineraries[0]?.fareOffers[0]?.passengerFares[0]?.baggageCharges).toEqual([]);
  });
});
