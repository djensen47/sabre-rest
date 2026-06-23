import { describe, expect, it } from 'vitest';
import { SabreParseError } from '../../errors/sabre-parse-error.js';
import { okResponse } from '../../http/test-utils.js';
import { fromRevalidateResponse, toRevalidateRequest } from './mappers.js';
import type { RevalidateItineraryInput } from './types.js';

const minimalInput: RevalidateItineraryInput = {
  originDestinations: [
    {
      from: 'JFK',
      to: 'LHR',
      departureDateTime: '2025-12-25T10:00:00',
      flights: [
        {
          from: 'JFK',
          to: 'LHR',
          marketingCarrier: 'BA',
          flightNumber: 178,
          departureDateTime: '2025-12-25T21:00:00',
          arrivalDateTime: '2025-12-26T09:00:00',
        },
      ],
    },
  ],
  passengers: [{ type: 'ADT', quantity: 1 }],
  pointOfSale: { companyCode: 'TN' },
};

// ---------------------------------------------------------------------------
// toRevalidateRequest
// ---------------------------------------------------------------------------

describe('toRevalidateRequest', () => {
  it('builds a POST to the revalidate path with JSON headers', () => {
    const req = toRevalidateRequest('https://api.cert.platform.sabre.com', minimalInput);
    expect(req.method).toBe('POST');
    expect(req.url).toBe('https://api.cert.platform.sabre.com/v5/shop/flights/revalidate');
    expect(req.headers.Accept).toBe('application/json');
    expect(req.headers['Content-Type']).toBe('application/json');
  });

  it('handles a base URL with a trailing slash', () => {
    const req = toRevalidateRequest('https://api.cert.platform.sabre.com/', minimalInput);
    expect(req.url).toBe('https://api.cert.platform.sabre.com/v5/shop/flights/revalidate');
  });

  it('serializes the OTA envelope with spec defaults and flight details', () => {
    const req = toRevalidateRequest('https://api.cert.platform.sabre.com', minimalInput);
    const body = JSON.parse(req.body ?? '{}') as Record<string, unknown>;
    const ota = body.OTA_AirLowFareSearchRQ as Record<string, unknown>;

    expect(ota.Version).toBe('5');
    expect(ota.AvailableFlightsOnly).toBe(true);

    expect(ota.OriginDestinationInformation).toEqual([
      {
        OriginLocation: { LocationCode: 'JFK' },
        DestinationLocation: { LocationCode: 'LHR' },
        DepartureDateTime: '2025-12-25T10:00:00',
        Fixed: false,
        TPA_Extensions: {
          Flight: [
            {
              OriginLocation: { LocationCode: 'JFK' },
              DestinationLocation: { LocationCode: 'LHR' },
              Airline: { Marketing: 'BA' },
              Number: 178,
              DepartureDateTime: '2025-12-25T21:00:00',
              ArrivalDateTime: '2025-12-26T09:00:00',
              Type: 'A',
            },
          ],
        },
      },
    ]);

    expect(ota.TravelerInfoSummary).toEqual({
      AirTravelerAvail: [{ PassengerTypeQuantity: [{ Code: 'ADT', Quantity: 1 }] }],
    });

    expect(ota.POS).toEqual({
      Source: [
        {
          RequestorID: { Type: '1', ID: '1', CompanyName: { Code: 'TN' } },
          FixedPCC: false,
        },
      ],
    });

    expect(
      (
        (ota.TPA_Extensions as Record<string, unknown>).IntelliSellTransaction as Record<
          string,
          unknown
        >
      ).RequestType,
    ).toEqual({ Name: '50ITINS' });
  });

  it('includes optional flight fields when provided', () => {
    const input: RevalidateItineraryInput = {
      ...minimalInput,
      originDestinations: [
        {
          from: 'JFK',
          to: 'LHR',
          departureDateTime: '2025-12-25T10:00:00',
          flights: [
            {
              from: 'JFK',
              to: 'LHR',
              marketingCarrier: 'BA',
              operatingCarrier: 'AA',
              flightNumber: 178,
              departureDateTime: '2025-12-25T21:00:00',
              arrivalDateTime: '2025-12-26T09:00:00',
              classOfService: 'Y',
              type: 'A',
            },
          ],
        },
      ],
    };

    const req = toRevalidateRequest('https://api.cert.platform.sabre.com', input);
    const body = JSON.parse(req.body ?? '{}') as Record<string, unknown>;
    const ota = body.OTA_AirLowFareSearchRQ as Record<string, unknown>;
    const ods = ota.OriginDestinationInformation as Array<Record<string, unknown>>;
    const tpa = ods[0]?.TPA_Extensions as Record<string, unknown>;
    const flights = tpa.Flight as Array<Record<string, unknown>>;
    const flight = flights[0] as Record<string, unknown>;

    expect((flight.Airline as Record<string, unknown>).Operating).toBe('AA');
    expect(flight.ClassOfService).toBe('Y');
    expect(flight.Type).toBe('A');
  });

  it('includes PseudoCityCode when provided', () => {
    const input: RevalidateItineraryInput = {
      ...minimalInput,
      pointOfSale: { companyCode: 'TN', pseudoCityCode: 'A1B2' },
    };
    const req = toRevalidateRequest('https://api.cert.platform.sabre.com', input);
    const body = JSON.parse(req.body ?? '{}') as Record<string, unknown>;
    const ota = body.OTA_AirLowFareSearchRQ as Record<string, unknown>;
    const pos = ota.POS as Record<string, unknown>;
    const source = (pos.Source as Array<Record<string, unknown>>)[0] as Record<string, unknown>;
    expect(source.PseudoCityCode).toBe('A1B2');
  });

  it('omits CompanyName when companyCode is not provided', () => {
    const input: RevalidateItineraryInput = {
      ...minimalInput,
      pointOfSale: {},
    };
    const req = toRevalidateRequest('https://api.cert.platform.sabre.com', input);
    const body = JSON.parse(req.body ?? '{}') as Record<string, unknown>;
    const ota = body.OTA_AirLowFareSearchRQ as Record<string, unknown>;
    const pos = ota.POS as Record<string, unknown>;
    const source = (pos.Source as Array<Record<string, unknown>>)[0] as Record<string, unknown>;
    const requestorID = source.RequestorID as Record<string, unknown>;
    expect('CompanyName' in requestorID).toBe(false);
  });

  it('serializes a multi-leg itinerary with connecting flights', () => {
    const input: RevalidateItineraryInput = {
      originDestinations: [
        {
          from: 'JFK',
          to: 'LHR',
          departureDateTime: '2025-12-25T10:00:00',
          flights: [
            {
              from: 'JFK',
              to: 'LHR',
              marketingCarrier: 'BA',
              flightNumber: 178,
              departureDateTime: '2025-12-25T21:00:00',
              arrivalDateTime: '2025-12-26T09:00:00',
            },
          ],
        },
        {
          from: 'LHR',
          to: 'JFK',
          departureDateTime: '2026-01-05T12:00:00',
          flights: [
            {
              from: 'LHR',
              to: 'ORD',
              marketingCarrier: 'AA',
              flightNumber: 87,
              departureDateTime: '2026-01-05T09:00:00',
              arrivalDateTime: '2026-01-05T12:00:00',
            },
            {
              from: 'ORD',
              to: 'JFK',
              marketingCarrier: 'AA',
              flightNumber: 300,
              departureDateTime: '2026-01-05T14:00:00',
              arrivalDateTime: '2026-01-05T17:30:00',
            },
          ],
        },
      ],
      passengers: [{ type: 'ADT', quantity: 2 }],
      pointOfSale: { companyCode: 'TN' },
    };

    const req = toRevalidateRequest('https://api.cert.platform.sabre.com', input);
    const body = JSON.parse(req.body ?? '{}') as Record<string, unknown>;
    const ota = body.OTA_AirLowFareSearchRQ as Record<string, unknown>;
    const ods = ota.OriginDestinationInformation as Array<Record<string, unknown>>;

    expect(ods).toHaveLength(2);
    const returnTpa = ods[1]?.TPA_Extensions as Record<string, unknown>;
    const returnFlights = returnTpa.Flight as Array<Record<string, unknown>>;
    expect(returnFlights).toHaveLength(2);
    expect(returnFlights[0]?.Number).toBe(87);
    expect(returnFlights[1]?.Number).toBe(300);
  });
});

// ---------------------------------------------------------------------------
// fromRevalidateResponse
// ---------------------------------------------------------------------------

describe('fromRevalidateResponse', () => {
  const girResponse = {
    groupedItineraryResponse: {
      version: 'V5',
      messages: [{ severity: 'Info', code: '200', text: 'OK' }],
      scheduleDescs: [
        {
          id: 1,
          carrier: { marketing: 'BA', marketingFlightNumber: 178 },
          departure: { airport: 'JFK', time: '21:00:00' },
          arrival: { airport: 'LHR', time: '09:00:00', dateAdjustment: 1 },
          elapsedTime: 420,
        },
      ],
      legDescs: [{ id: 10, schedules: [{ ref: 1 }], elapsedTime: 420 }],
      fareComponentDescs: [
        {
          id: 1,
          fareBasisCode: 'YOW',
          cabinCode: 'Y',
          governingCarrier: 'BA',
          farePassengerType: 'ADT',
        },
      ],
      baggageAllowanceDescs: [
        { id: 1, pieceCount: 2, description1: 'UP TO 50 POUNDS/23 KILOGRAMS' },
      ],
      baggageChargeDescs: [
        { id: 1, firstPiece: 3, lastPiece: 3, equivalentAmount: 100, equivalentCurrency: 'USD' },
      ],
      taxDescs: [
        { id: 1, code: 'US', amount: 25, currency: 'USD', country: 'US' },
        { id: 2, code: 'XF', amount: 4.5, currency: 'USD', station: 'JFK' },
      ],
      itineraryGroups: [
        {
          groupDescription: { legDescriptions: [{ departureDate: '2025-12-25' }] },
          itineraries: [
            {
              id: 1,
              legs: [{ ref: 10 }],
              pricingInformation: [
                {
                  fare: {
                    validatingCarrierCode: 'BA',
                    totalFare: {
                      totalPrice: 999,
                      currency: 'USD',
                      baseFareAmount: 950,
                      baseFareCurrency: 'USD',
                      totalTaxAmount: 49,
                    },
                    passengerInfoList: [
                      {
                        passengerInfo: {
                          passengerType: 'ADT',
                          passengerNumber: 1,
                          total: 1,
                          passengerTotalFare: {
                            totalFare: 999,
                            currency: 'USD',
                            baseFareAmount: 950,
                            baseFareCurrency: 'USD',
                            totalTaxAmount: 49,
                          },
                          fareComponents: [
                            {
                              ref: 1,
                              beginAirport: 'JFK',
                              endAirport: 'LHR',
                              segments: [
                                {
                                  segment: { bookingCode: 'Y', cabinCode: 'Y', seatsAvailable: 0 },
                                },
                              ],
                            },
                          ],
                          baggageInformation: [
                            {
                              provisionType: 'A',
                              airlineCode: 'BA',
                              segments: [{ id: 0 }],
                              allowance: { ref: 1 },
                            },
                            {
                              provisionType: 'C',
                              airlineCode: 'BA',
                              segments: [{ id: 0 }],
                              charge: { ref: 1 },
                            },
                          ],
                          taxes: [{ ref: 1 }, { ref: 2 }],
                        },
                      },
                    ],
                  },
                  distributionModel: 'ATPCO',
                },
              ],
            },
          ],
        },
      ],
    },
  };

  it('maps a populated GIR response into the public output shape', () => {
    const result = fromRevalidateResponse(okResponse(girResponse));

    expect(result.itineraries).toHaveLength(1);
    expect(result.messages).toEqual([{ severity: 'Info', code: '200', text: 'OK' }]);

    const itin = result.itineraries[0];
    expect(itin?.id).toBe(1);
    expect(itin?.totalFare).toEqual({
      totalAmount: 999,
      currency: 'USD',
      baseFareAmount: 950,
      baseFareCurrency: 'USD',
      totalTaxAmount: 49,
    });
    expect(itin?.validatingCarrierCode).toBe('BA');
    expect(itin?.distributionModel).toBe('ATPCO');

    // Leg resolution
    expect(itin?.legs).toHaveLength(1);
    const leg = itin?.legs[0];
    expect(leg?.ref).toBe(10);
    expect(leg?.elapsedMinutes).toBe(420);
    expect(leg?.segments).toHaveLength(1);

    const seg = leg?.segments[0];
    expect(seg?.marketingCarrier).toBe('BA');
    expect(seg?.marketingFlightNumber).toBe(178);
    expect(seg?.departure).toEqual({ airport: 'JFK', time: '21:00:00' });
    expect(seg?.arrival).toEqual({ airport: 'LHR', time: '09:00:00', dateAdjustment: 1 });
    expect(seg?.elapsedMinutes).toBe(420);

    // Fare offer
    expect(itin?.fareOffers).toHaveLength(1);
    const offer = itin?.fareOffers[0];
    expect(offer?.validatingCarrierCode).toBe('BA');
    expect(offer?.distributionModel).toBe('ATPCO');
    expect(offer?.passengerFares).toHaveLength(1);

    const pf = offer?.passengerFares[0];
    expect(pf?.passengerType).toBe('ADT');
    expect(pf?.passengerNumber).toBe(1);
    expect(pf?.passengerCount).toBe(1);
    expect(pf?.total).toEqual({
      totalAmount: 999,
      currency: 'USD',
      baseFareAmount: 950,
      baseFareCurrency: 'USD',
      totalTaxAmount: 49,
    });

    // Fare components
    expect(pf?.fareComponents).toHaveLength(1);
    const fc = pf?.fareComponents[0];
    expect(fc?.fareBasisCode).toBe('YOW');
    expect(fc?.cabinCode).toBe('Y');
    expect(fc?.governingCarrier).toBe('BA');
    expect(fc?.beginAirport).toBe('JFK');
    expect(fc?.endAirport).toBe('LHR');
    expect(fc?.segments).toEqual([{ bookingCode: 'Y', cabinCode: 'Y', seatsAvailable: 0 }]);

    // Baggage
    expect(pf?.baggageAllowances).toHaveLength(1);
    expect(pf?.baggageAllowances[0]).toEqual({
      segmentIndices: [0],
      airlineCode: 'BA',
      provisionType: 'A',
      pieceCount: 2,
      descriptions: ['UP TO 50 POUNDS/23 KILOGRAMS'],
    });
    expect(pf?.baggageCharges).toHaveLength(1);
    expect(pf?.baggageCharges[0]).toEqual({
      segmentIndices: [0],
      airlineCode: 'BA',
      provisionType: 'C',
      firstPiece: 3,
      lastPiece: 3,
      amount: 100,
      currency: 'USD',
      descriptions: [],
    });

    // Taxes
    expect(pf?.taxes).toHaveLength(2);
    expect(pf?.taxes[0]).toEqual({ code: 'US', amount: 25, currency: 'USD', country: 'US' });
    expect(pf?.taxes[1]).toEqual({ code: 'XF', amount: 4.5, currency: 'USD', station: 'JFK' });
  });

  it('maps equipment, dot rating, on-time performance, and hidden stops on a segment', () => {
    const result = fromRevalidateResponse(
      okResponse({
        groupedItineraryResponse: {
          version: 'V5',
          messages: [],
          scheduleDescs: [
            {
              id: 1,
              carrier: { marketing: 'BA', marketingFlightNumber: 178, equipment: { code: '346' } },
              departure: { airport: 'JFK', time: '21:00:00' },
              arrival: { airport: 'LHR', time: '09:00:00' },
              dotRating: 'A',
              onTimePerformance: 7,
              hiddenStops: [
                { airport: 'BOS', arrivalTime: '22:00', departureTime: '22:45', airMiles: 200 },
              ],
            },
          ],
          legDescs: [{ id: 10, schedules: [{ ref: 1 }] }],
          itineraryGroups: [{ itineraries: [{ legs: [{ ref: 10 }], pricingInformation: [] }] }],
        },
      }),
    );

    const seg = result.itineraries[0]?.legs[0]?.segments[0];
    expect(seg?.equipment).toBe('346');
    expect(seg?.dotRating).toBe('A');
    expect(seg?.onTimePerformance).toBe(7);
    expect(seg?.hiddenStops).toEqual([
      { airport: 'BOS', arrivalTime: '22:00', departureTime: '22:45', airMiles: 200 },
    ]);
  });

  it('maps per-passenger penalties, reissue, amenities, and per-leg fares', () => {
    const result = fromRevalidateResponse(
      okResponse({
        groupedItineraryResponse: {
          version: 'V5',
          messages: [],
          taxDescs: [{ id: 1, code: 'US', amount: 25, currency: 'USD' }],
          taxSummaryDescs: [{ id: 5, code: 'ZP', amount: 4.3, currency: 'USD' }],
          legDescs: [{ id: 10, schedules: [] }],
          itineraryGroups: [
            {
              itineraries: [
                {
                  legs: [{ ref: 10 }],
                  pricingInformation: [
                    {
                      fare: {
                        passengerInfoList: [
                          {
                            passengerInfo: {
                              passengerType: 'ADT',
                              penaltiesInfo: {
                                penalties: [
                                  {
                                    type: 'Change',
                                    applicability: 'Before',
                                    changeable: true,
                                    amount: 200,
                                    currency: 'USD',
                                    minPenalty: { amount: 100, currency: 'USD' },
                                    cat16Info: true,
                                  },
                                  { type: 'Refund', refundable: false },
                                ],
                              },
                              reissue: {
                                changeFees: [{ amount: 150, currency: 'USD', highest: true }],
                                electronicTicketRequired: true,
                                formOfRefund: 'A',
                              },
                              reissueText: 'CHG1',
                              seatSelection: [{ type: 'F', segment: [{ id: 0 }, { id: 1 }] }],
                              priorityBoarding: [{ type: 'C', segment: [{ id: 0 }] }],
                              legs: [
                                {
                                  ref: 10,
                                  status: 'F',
                                  totalFare: { totalPrice: 500, currency: 'USD' },
                                  taxes: [{ ref: 1 }],
                                  taxSummaries: [{ ref: 5 }],
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

    const pf = result.itineraries[0]?.fareOffers[0]?.passengerFares[0];

    expect(pf?.penalties).toEqual([
      {
        type: 'Change',
        applicability: 'Before',
        changeable: true,
        amount: 200,
        currency: 'USD',
        minPenaltyAmount: 100,
        minPenaltyCurrency: 'USD',
        cat16Info: true,
      },
      { type: 'Refund', refundable: false },
    ]);

    expect(pf?.reissue).toEqual({
      changeFees: [{ amount: 150, currency: 'USD', highest: true }],
      electronicTicketRequired: true,
      formOfRefund: 'A',
    });
    expect(pf?.reissueText).toBe('CHG1');

    expect(pf?.seatSelection).toEqual([{ charge: 'Free', code: 'F', segmentIndices: [0, 1] }]);
    expect(pf?.priorityBoarding).toEqual([
      { charge: 'Chargeable', code: 'C', segmentIndices: [0] },
    ]);

    expect(pf?.legs).toEqual([
      {
        ref: 10,
        status: 'F',
        totalFare: { totalAmount: 500, currency: 'USD' },
        taxes: [{ code: 'US', amount: 25, currency: 'USD' }],
        taxSummaries: [{ code: 'ZP', amount: 4.3, currency: 'USD' }],
      },
    ]);
  });

  it('maps an unrecognized amenity code to a code-only entry', () => {
    const result = fromRevalidateResponse(
      okResponse({
        groupedItineraryResponse: {
          version: 'V5',
          messages: [],
          legDescs: [{ id: 10, schedules: [] }],
          itineraryGroups: [
            {
              itineraries: [
                {
                  legs: [{ ref: 10 }],
                  pricingInformation: [
                    {
                      fare: {
                        passengerInfoList: [
                          {
                            passengerInfo: {
                              passengerType: 'ADT',
                              seatSelection: [{ type: 'Z', segment: [{ id: 0 }] }],
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

    const pf = result.itineraries[0]?.fareOffers[0]?.passengerFares[0];
    expect(pf?.seatSelection).toEqual([{ code: 'Z', segmentIndices: [0] }]);
    expect(pf?.priorityBoarding).toBeUndefined();
  });

  it('maps fare-component filing detail and per-segment flags', () => {
    const result = fromRevalidateResponse(
      okResponse({
        groupedItineraryResponse: {
          version: 'V5',
          messages: [],
          fareComponentDescs: [
            {
              id: 1,
              fareBasisCode: 'YOW',
              brand: {
                code: 'XX',
                brandName: 'Main Cabin',
                programCode: 'DOMBE',
                programDescription: 'BT FARES',
              },
              negotiatedFare: true,
              privateFare: false,
              matchedAccountCode: 'ACME01',
              corporateIdMatched: true,
              notValidBefore: '2026-01-01',
              notValidAfter: '2026-12-31',
              eligibleForTicketing: true,
            },
          ],
          legDescs: [{ id: 10, schedules: [] }],
          itineraryGroups: [
            {
              itineraries: [
                {
                  legs: [{ ref: 10 }],
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
                                  segments: [
                                    {
                                      segment: {
                                        bookingCode: 'Y',
                                        availabilityBreak: true,
                                        dualInventoryCode: 'C',
                                      },
                                    },
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

    const fc = result.itineraries[0]?.fareOffers[0]?.passengerFares[0]?.fareComponents[0];
    expect(fc?.brand).toEqual({
      code: 'XX',
      name: 'Main Cabin',
      programCode: 'DOMBE',
      programDescription: 'BT FARES',
    });
    expect(fc?.negotiatedFare).toBe(true);
    expect(fc?.privateFare).toBe(false);
    expect(fc?.matchedAccountCode).toBe('ACME01');
    expect(fc?.corporateIdMatched).toBe(true);
    expect(fc?.notValidBefore).toBe('2026-01-01');
    expect(fc?.notValidAfter).toBe('2026-12-31');
    expect(fc?.eligibleForTicketing).toBe(true);
    expect(fc?.segments[0]).toEqual({
      bookingCode: 'Y',
      availabilityBreak: true,
      dualInventoryCode: 'C',
    });
  });

  it('omits new optional fields when Sabre returned none', () => {
    const result = fromRevalidateResponse(okResponse(girResponse));
    const pf = result.itineraries[0]?.fareOffers[0]?.passengerFares[0];
    expect(pf?.penalties).toBeUndefined();
    expect(pf?.reissue).toBeUndefined();
    expect(pf?.reissueText).toBeUndefined();
    expect(pf?.seatSelection).toBeUndefined();
    expect(pf?.priorityBoarding).toBeUndefined();
    expect(pf?.legs).toBeUndefined();
    const seg = result.itineraries[0]?.legs[0]?.segments[0];
    expect(seg?.equipment).toBeUndefined();
    expect(seg?.hiddenStops).toBeUndefined();
  });

  it('returns empty itineraries for a response with no itinerary groups', () => {
    const result = fromRevalidateResponse(
      okResponse({
        groupedItineraryResponse: {
          version: 'V5',
          messages: [{ severity: 'Info', text: 'No valid itinerary' }],
        },
      }),
    );
    expect(result.itineraries).toEqual([]);
    expect(result.messages).toHaveLength(1);
  });

  it('throws SabreParseError for non-JSON body', () => {
    expect(() => fromRevalidateResponse(okResponse('not json'))).toThrow(SabreParseError);
  });

  it('throws SabreParseError for non-object JSON body', () => {
    expect(() => fromRevalidateResponse(okResponse('"string"'))).toThrow(SabreParseError);
  });

  it('throws SabreParseError for null body', () => {
    expect(() => fromRevalidateResponse(okResponse('null'))).toThrow(SabreParseError);
  });

  it('throws SabreParseError when groupedItineraryResponse is missing', () => {
    expect(() => fromRevalidateResponse(okResponse({}))).toThrow(SabreParseError);
  });

  it('preserves segments with unresolved schedule references', () => {
    const result = fromRevalidateResponse(
      okResponse({
        groupedItineraryResponse: {
          version: 'V5',
          messages: [],
          legDescs: [{ id: 1, schedules: [{ ref: 999 }] }],
          itineraryGroups: [
            {
              itineraries: [
                {
                  legs: [{ ref: 1 }],
                  pricingInformation: [],
                },
              ],
            },
          ],
        },
      }),
    );

    const seg = result.itineraries[0]?.legs[0]?.segments[0];
    expect(seg?.ref).toBe(999);
    expect(seg?.marketingCarrier).toBeUndefined();
  });
});
