import { describe, expect, it } from 'vitest';
import { SabreParseError } from '../../errors/sabre-parse-error.js';
import type { SabreResponse } from '../../http/types.js';
import { fromGetSeatsResponse, toGetSeatsRequest } from './mappers.js';
import type {
  GetSeatsOfferInput,
  GetSeatsOrderInput,
  GetSeatsPayloadInput,
  GetSeatsStatelessInput,
} from './types.js';

const BASE_URL = 'https://api.cert.platform.sabre.com';

const okResponse = (body: unknown): SabreResponse => ({
  status: 200,
  statusText: 'OK',
  headers: {},
  body: typeof body === 'string' ? body : JSON.stringify(body),
});

// ---------------------------------------------------------------------------
// toGetSeatsRequest
// ---------------------------------------------------------------------------

describe('toGetSeatsRequest', () => {
  const offerInput: GetSeatsOfferInput = {
    requestType: 'offerId',
    pointOfSale: { countryCode: 'US', cityCode: 'TPA' },
    offerId: 'OFFER-123',
  };

  it('builds a POST to the getseats path with JSON headers', () => {
    const req = toGetSeatsRequest(BASE_URL, offerInput);
    expect(req.method).toBe('POST');
    expect(req.url).toBe('https://api.cert.platform.sabre.com/v1/offers/getseats');
    expect(req.headers.Accept).toBe('application/json');
    expect(req.headers['Content-Type']).toBe('application/json');
  });

  it('handles a base URL with a trailing slash', () => {
    const req = toGetSeatsRequest(`${BASE_URL}/`, offerInput);
    expect(req.url).toBe('https://api.cert.platform.sabre.com/v1/offers/getseats');
  });

  // -- offerId variant --

  it('builds the correct body for requestType offerId', () => {
    const req = toGetSeatsRequest(BASE_URL, offerInput);
    const body = JSON.parse(req.body ?? '{}') as Record<string, unknown>;
    expect(body.requestType).toBe('offerId');
    const request = body.request as Record<string, unknown>;
    expect((request.offer as Record<string, unknown>).offerId).toBe('OFFER-123');
    const pos = body.pointOfSale as Record<string, unknown>;
    const loc = pos.location as Record<string, unknown>;
    expect(loc.countryCode).toBe('US');
    expect(loc.cityCode).toBe('TPA');
  });

  it('includes passengers with loyalty accounts in offerId body', () => {
    const input: GetSeatsOfferInput = {
      requestType: 'offerId',
      pointOfSale: { countryCode: 'US', cityCode: 'TPA', agentDutyCode: 'read' },
      offerId: 'OFFER-123',
      passengers: [
        {
          paxId: 'PAX-1',
          givenName: 'John',
          surname: 'Doe',
          loyaltyProgramAccounts: [{ airline: 'AA', accountNumber: '123456' }],
        },
      ],
    };
    const req = toGetSeatsRequest(BASE_URL, input);
    const body = JSON.parse(req.body ?? '{}') as Record<string, unknown>;
    const request = body.request as Record<string, unknown>;
    const paxes = request.paxes as Record<string, unknown>[];
    expect(paxes).toHaveLength(1);
    expect(paxes[0]?.paxID).toBe('PAX-1');
    expect(paxes[0]?.givenName).toBe('John');
    const pos = body.pointOfSale as Record<string, unknown>;
    expect(pos.agentDutyCode).toBe('read');
  });

  // -- orderId variant --

  it('builds the correct body for requestType orderId', () => {
    const input: GetSeatsOrderInput = {
      requestType: 'orderId',
      pointOfSale: { countryCode: 'GB', cityCode: 'LHR' },
      orderId: 'ORDER-456',
    };
    const req = toGetSeatsRequest(BASE_URL, input);
    const body = JSON.parse(req.body ?? '{}') as Record<string, unknown>;
    expect(body.requestType).toBe('orderId');
    const request = body.request as Record<string, unknown>;
    expect((request.order as Record<string, unknown>).orderId).toBe('ORDER-456');
  });

  // -- payload variant --

  it('builds the correct body for requestType payload', () => {
    const input: GetSeatsPayloadInput = {
      requestType: 'payload',
      segmentRefIds: ['SEG-1'],
      originDest: {
        paxJourney: {
          paxSegments: [
            {
              paxSegmentId: 'SEG-1',
              departure: { locationCode: 'DFW', date: '2026-06-01' },
              arrival: { locationCode: 'LAX', date: '2026-06-01' },
              marketingCarrierInfo: { carrierCode: 'AA', carrierFlightNumber: '1234' },
            },
          ],
        },
      },
      passengers: [{ paxId: 'PAX-1', ptc: 'ADT' }],
    };
    const req = toGetSeatsRequest(BASE_URL, input);
    const body = JSON.parse(req.body ?? '{}') as Record<string, unknown>;
    expect(body.requestType).toBe('payload');
    expect(body.requestMode).toBe('BOOKING');
    const request = body.request as Record<string, unknown>;
    expect(request.paxSegmentRefIds).toEqual(['SEG-1']);
    const paxes = request.paxes as Record<string, unknown>[];
    expect(paxes[0]?.ptc).toBe('ADT');
  });

  it('sends requestMode CHECKIN when specified for payload', () => {
    const input: GetSeatsPayloadInput = {
      requestType: 'payload',
      segmentRefIds: ['SEG-1'],
      originDest: {
        paxJourney: {
          paxSegments: [
            {
              paxSegmentId: 'SEG-1',
              departure: { locationCode: 'DFW', date: '2026-06-01' },
              arrival: { locationCode: 'LAX', date: '2026-06-01' },
              marketingCarrierInfo: { carrierCode: 'AA', carrierFlightNumber: '1234' },
            },
          ],
        },
      },
      passengers: [{ paxId: 'PAX-1', ptc: 'ADT' }],
      requestMode: 'CHECKIN',
    };
    const body = JSON.parse(toGetSeatsRequest(BASE_URL, input).body ?? '{}') as Record<
      string,
      unknown
    >;
    expect(body.requestMode).toBe('CHECKIN');
  });

  it('includes fareComponents and currency in payload body', () => {
    const input: GetSeatsPayloadInput = {
      requestType: 'payload',
      segmentRefIds: ['SEG-1'],
      originDest: {
        paxJourney: {
          paxSegments: [
            {
              paxSegmentId: 'SEG-1',
              departure: { locationCode: 'DFW', date: '2026-06-01' },
              arrival: { locationCode: 'LAX', date: '2026-06-01' },
              marketingCarrierInfo: { carrierCode: 'AA', carrierFlightNumber: '1234' },
            },
          ],
        },
      },
      passengers: [{ paxId: 'PAX-1', ptc: 'ADT' }],
      fareComponents: [
        {
          fareComponentId: 'FC-1',
          fareBasisCode: 'YOW',
          governingCarrier: 'AA',
          priceAmount: 100,
          brandCode: 'MAIN',
        },
      ],
      currency: 'USD',
    };
    const body = JSON.parse(toGetSeatsRequest(BASE_URL, input).body ?? '{}') as Record<
      string,
      unknown
    >;
    const request = body.request as Record<string, unknown>;
    const fcs = request.fareComponents as Record<string, unknown>[];
    expect(fcs).toHaveLength(1);
    expect(fcs[0]?.fareComponentId).toBe('FC-1');
    expect((fcs[0]?.fareBasis as Record<string, unknown>).fareBasisCode).toBe('YOW');
    expect((fcs[0]?.price as Record<string, unknown>).amount).toBe(100);
    expect((fcs[0]?.brand as Record<string, unknown>).code).toBe('MAIN');
    expect(request.currency).toBe('USD');
  });

  // -- stateless variant --

  it('builds the correct body for requestType stateless', () => {
    const input: GetSeatsStatelessInput = {
      requestType: 'stateless',
      pnrLocator: 'ABC123',
    };
    const req = toGetSeatsRequest(BASE_URL, input);
    const body = JSON.parse(req.body ?? '{}') as Record<string, unknown>;
    expect(body.requestType).toBe('stateless');
    expect(body.requestMode).toBe('BOOKING');
    const request = body.request as Record<string, unknown>;
    expect(request.pnrLocator).toBe('ABC123');
  });

  it('includes payloadAttributes when provided', () => {
    const input: GetSeatsOfferInput = {
      requestType: 'offerId',
      pointOfSale: { countryCode: 'US', cityCode: 'TPA' },
      offerId: 'OFFER-123',
      payloadAttributes: { transactionId: 'TXN-1', correlationId: 'CORR-1' },
    };
    const body = JSON.parse(toGetSeatsRequest(BASE_URL, input).body ?? '{}') as Record<
      string,
      unknown
    >;
    const attrs = body.payloadAttributes as Record<string, unknown>;
    expect(attrs.transactionID).toBe('TXN-1');
    expect(attrs.correlationID).toBe('CORR-1');
  });
});

// ---------------------------------------------------------------------------
// fromGetSeatsResponse
// ---------------------------------------------------------------------------

describe('fromGetSeatsResponse', () => {
  const fullResponse = {
    response: {
      seatMaps: [
        {
          paxSegmentRefID: 'SEG-1',
          sellable: true,
          cabinCompartments: [
            {
              deckCode: 'M',
              firstRow: 1,
              lastRow: 30,
              columnIDs: ['A', 'B', 'C', 'D', 'E', 'F'],
              cabinType: { cabinTypeCode: 'Y', cabinTypeName: 'Economy' },
              cabinLayout: {
                columns: [
                  { id: 'A', position: 'W' },
                  { id: 'B', position: 'C' },
                  { id: 'C', position: 'A' },
                ],
                rows: { firstRow: 1, lastRow: 30 },
                exitRowPosition: [{ firstRow: 14, lastRow: 14 }],
                seatCount: 180,
                facilities: [
                  {
                    location: {
                      beginRow: '1',
                      endRow: '1',
                      columnPositions: ['D'],
                      orientation: 'Front',
                    },
                    facilityType: 'Lavatory',
                  },
                ],
              },
              seatRows: [
                {
                  row: 1,
                  characteristics: [{ code: '11', description: 'Bulkhead' }],
                  seats: [
                    {
                      column: 'A',
                      occupationStatusCode: 'F',
                      characteristics: [{ code: 'W', description: 'Window' }],
                      seatProfileRefIDs: ['SP-1'],
                      offerItemRefIDs: ['OI-1'],
                    },
                    { column: 'B' },
                  ],
                },
              ],
            },
          ],
        },
      ],
      aLaCarteOffer: {
        offerId: 'OFFER-SEATS',
        ownerCode: 'AA',
        totalPrice: {
          totalAmount: { amount: 50, currencyCode: 'USD' },
          baseAmount: { amount: 45, currencyCode: 'USD' },
          taxSummary: {
            totalTaxAmount: { amount: 5, currencyCode: 'USD' },
            taxes: [{ taxCode: 'US', amount: { amount: 5, currencyCode: 'USD' } }],
          },
        },
        aLaCarteOfferItems: [
          {
            offerItemID: 'OI-1',
            source: 'ATPCO',
            unitPrice: { totalAmount: { amount: 50, currencyCode: 'USD' } },
            service: {
              serviceId: 'SVC-1',
              serviceDefinitionRefID: 'SDEF-1',
            },
            eligibility: {
              paxRefIDs: ['PAX-1'],
              flightAssociations: { paxSegmentRefID: ['SEG-1'] },
            },
          },
        ],
      },
      dataLists: {
        paxSegments: [
          {
            paxSegmentID: 'SEG-1',
            departure: {
              iataLocationCode: 'DFW',
              aircraftScheduledDateTime: '2026-06-01T10:00:00',
            },
            arrival: { iataLocationCode: 'LAX' },
            marketingCarrierInfo: {
              carrierDesignatorCode: 'AA',
              marketingCarrierFlightNumberText: '1234',
            },
          },
        ],
        paxs: [{ paxID: 'PAX-1', ptc: 'ADT' }],
        seatProfiles: [
          {
            seatProfileId: 'SP-1',
            characteristicCodes: ['W', 'E'],
            seatWidthMeasure: { measure: 18, unitCode: 'IN' },
            seatPitchMeasure: { measure: 32, unitCode: 'IN' },
            seatKeywords: [{ keyWordText: 'SKYC', valueText: 'SkyCouch' }],
          },
        ],
        serviceDefinitions: [
          {
            serviceDefinitionID: 'SDEF-1',
            name: 'Window Seat',
            descriptions: [{ descriptionID: 'D1', descriptionText: 'A window seat' }],
            serviceDefinitionAssociation: { seatProfileRefID: ['SP-1'] },
          },
        ],
      },
      shoppingResponse: { shoppingResponseID: 'SHOP-1', ownerCode: 'AA' },
    },
    payloadAttributes: { transactionID: 'TXN-1', correlationID: 'CORR-1' },
    warnings: [{ code: '0001', descriptionText: 'Some warning' }],
  };

  it('maps a populated response into the public output shape', () => {
    const result = fromGetSeatsResponse(okResponse(fullResponse));

    // Seat maps
    expect(result.seatMaps).toHaveLength(1);
    const map = result.seatMaps[0];
    expect(map?.paxSegmentRefId).toBe('SEG-1');
    expect(map?.sellable).toBe(true);
    expect(map?.cabinCompartments).toHaveLength(1);

    const cabin = map?.cabinCompartments[0];
    expect(cabin?.deckCode).toBe('M');
    expect(cabin?.columnIds).toEqual(['A', 'B', 'C', 'D', 'E', 'F']);
    expect(cabin?.cabinType?.cabinTypeCode).toBe('Y');

    // Cabin layout
    expect(cabin?.cabinLayout?.columns).toHaveLength(3);
    expect(cabin?.cabinLayout?.rows).toEqual({ firstRow: 1, lastRow: 30 });
    expect(cabin?.cabinLayout?.exitRowPositions).toEqual([{ firstRow: 14, lastRow: 14 }]);
    expect(cabin?.cabinLayout?.seatCount).toBe(180);
    expect(cabin?.cabinLayout?.facilities).toHaveLength(1);
    expect(cabin?.cabinLayout?.facilities?.[0]?.facilityType).toBe('Lavatory');

    // Seat rows
    expect(cabin?.seatRows).toHaveLength(1);
    const row = cabin?.seatRows[0];
    expect(row?.row).toBe(1);
    expect(row?.characteristics?.[0]?.code).toBe('11');
    expect(row?.seats).toHaveLength(2);

    const seat = row?.seats[0];
    expect(seat?.column).toBe('A');
    expect(seat?.occupationStatusCode).toBe('F');
    expect(seat?.characteristics?.[0]?.code).toBe('W');
    expect(seat?.seatProfileRefIds).toEqual(['SP-1']);
    expect(seat?.offerItemRefIds).toEqual(['OI-1']);

    // ALaCarteOffer
    expect(result.aLaCarteOffer?.offerId).toBe('OFFER-SEATS');
    expect(result.aLaCarteOffer?.totalPrice?.totalAmount?.amount).toBe(50);
    expect(result.aLaCarteOffer?.aLaCarteOfferItems).toHaveLength(1);
    const oi = result.aLaCarteOffer?.aLaCarteOfferItems[0];
    expect(oi?.offerItemId).toBe('OI-1');
    expect(oi?.source).toBe('ATPCO');
    expect(oi?.service?.serviceDefinitionRefId).toBe('SDEF-1');
    expect(oi?.eligibility.paxRefIds).toEqual(['PAX-1']);
    expect(oi?.eligibility.flightAssociations?.paxSegmentRefIds).toEqual(['SEG-1']);

    // DataLists
    expect(result.dataLists?.paxSegments).toHaveLength(1);
    expect(result.dataLists?.paxSegments?.[0]?.paxSegmentId).toBe('SEG-1');
    expect(result.dataLists?.paxSegments?.[0]?.departure.iataLocationCode).toBe('DFW');
    expect(result.dataLists?.paxes).toHaveLength(1);
    expect(result.dataLists?.paxes?.[0]?.paxId).toBe('PAX-1');
    expect(result.dataLists?.seatProfiles).toHaveLength(1);
    expect(result.dataLists?.seatProfiles?.[0]?.seatWidthMeasure?.measure).toBe(18);
    expect(result.dataLists?.seatProfiles?.[0]?.seatKeywords?.[0]?.keyWordText).toBe('SKYC');
    expect(result.dataLists?.serviceDefinitions).toHaveLength(1);
    expect(result.dataLists?.serviceDefinitions?.[0]?.name).toBe('Window Seat');
    expect(
      result.dataLists?.serviceDefinitions?.[0]?.serviceDefinitionAssociation?.seatProfileRefIds,
    ).toEqual(['SP-1']);

    // Shopping response
    expect(result.shoppingResponse?.shoppingResponseId).toBe('SHOP-1');
    expect(result.shoppingResponse?.ownerCode).toBe('AA');

    // Payload attributes
    expect(result.payloadAttributes?.transactionId).toBe('TXN-1');
    expect(result.payloadAttributes?.correlationId).toBe('CORR-1');

    // Warnings
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]?.code).toBe('0001');

    // No errors
    expect(result.errors).toEqual([]);
  });

  it('returns empty seatMaps when response is absent', () => {
    const result = fromGetSeatsResponse(okResponse({}));
    expect(result.seatMaps).toEqual([]);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.aLaCarteOffer).toBeUndefined();
    expect(result.dataLists).toBeUndefined();
    expect(result.shoppingResponse).toBeUndefined();
  });

  it('maps errors from the response', () => {
    const result = fromGetSeatsResponse(
      okResponse({
        errors: [
          {
            code: 'ERR-1',
            descriptionText: 'Invalid offer',
            statusText: 'NotProcessed',
            tagText: ['request.offer.offerId'],
            typeCode: 'TYPE',
          },
        ],
      }),
    );
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.code).toBe('ERR-1');
    expect(result.errors[0]?.descriptionText).toBe('Invalid offer');
    expect(result.errors[0]?.tagText).toEqual(['request.offer.offerId']);
  });

  it('maps warnings from the response', () => {
    const result = fromGetSeatsResponse(
      okResponse({
        warnings: [{ code: 'W1', descriptionText: 'A warning', ownerName: 'OrderView' }],
      }),
    );
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]?.ownerName).toBe('OrderView');
  });

  it('throws SabreParseError for non-JSON body', () => {
    expect(() => fromGetSeatsResponse(okResponse('not json'))).toThrow(SabreParseError);
  });

  it('throws SabreParseError for non-object JSON body', () => {
    expect(() => fromGetSeatsResponse(okResponse('"string"'))).toThrow(SabreParseError);
  });

  it('throws SabreParseError for null body', () => {
    expect(() => fromGetSeatsResponse(okResponse('null'))).toThrow(SabreParseError);
  });

  it('maps a seat with no optional fields', () => {
    const result = fromGetSeatsResponse(
      okResponse({
        response: {
          seatMaps: [
            {
              paxSegmentRefID: 'SEG-1',
              cabinCompartments: [
                {
                  seatRows: [{ row: 5, seats: [{ column: 'C' }] }],
                },
              ],
            },
          ],
        },
      }),
    );
    const seat = result.seatMaps[0]?.cabinCompartments[0]?.seatRows[0]?.seats[0];
    expect(seat?.column).toBe('C');
    expect(seat?.occupationStatusCode).toBeUndefined();
    expect(seat?.characteristics).toBeUndefined();
    expect(seat?.seatProfileRefIds).toBeUndefined();
    expect(seat?.offerItemRefIds).toBeUndefined();
  });

  it('maps ALaCarteOffer with discount and fees', () => {
    const result = fromGetSeatsResponse(
      okResponse({
        response: {
          seatMaps: [],
          aLaCarteOffer: {
            offerId: 'O1',
            ownerCode: 'UA',
            aLaCarteOfferItems: [
              {
                offerItemID: 'OI-1',
                unitPrice: {
                  totalAmount: { amount: 100, currencyCode: 'USD' },
                  discount: {
                    discountPercent: 10,
                    discountAmount: { amount: 10, currencyCode: 'USD' },
                    discountContext: [{ keyWordText: 'PROMO', valueText: 'SUMMER' }],
                  },
                  fee: [{ amount: { amount: 5, currencyCode: 'USD' }, designator: 'SVC' }],
                  surcharge: [{ total: { amount: 3, currencyCode: 'USD' } }],
                },
                eligibility: {},
              },
            ],
          },
        },
      }),
    );
    const price = result.aLaCarteOffer?.aLaCarteOfferItems[0]?.unitPrice;
    expect(price?.discount?.discountPercent).toBe(10);
    expect(price?.discount?.discountContexts?.[0]?.keyWordText).toBe('PROMO');
    expect(price?.fees?.[0]?.designator).toBe('SVC');
    expect(price?.surcharges?.[0]?.total?.amount).toBe(3);
  });
});
