import { describe, expect, it } from 'vitest';
import { SabreParseError } from '../../errors/sabre-parse-error.js';
import { okResponse } from '../../http/test-utils.js';
import type { SabreResponse } from '../../http/types.js';
import { fromExchangeResponse, toExchangeRequest } from './mappers.js';
import type { ExchangeFlightInput, ExchangeNewSegment } from './types.js';

const BASE = 'https://api.cert.platform.sabre.com';

const minimalInput: ExchangeFlightInput = {
  pnrLocator: 'IJNPIE',
  originalTicketNumber: '0277173836173',
  receivedFrom: 'SP TEST',
};

const newSegment: ExchangeNewSegment = {
  origin: 'LAS',
  destination: 'PDX',
  departureDateTime: '2026-05-03T06:00:00',
  arrivalDateTime: '2026-05-03T08:19:00',
  marketingCarrier: 'AS',
  flightNumber: '781',
  bookingClass: 'G',
};

describe('toExchangeRequest', () => {
  it('builds a POST to /v1.1.0/exchange/booking with JSON headers', () => {
    const req = toExchangeRequest(BASE, minimalInput);
    expect(req.method).toBe('POST');
    expect(req.url).toBe('https://api.cert.platform.sabre.com/v1.1.0/exchange/booking');
    expect(req.headers).toEqual({
      Accept: 'application/json',
      'Content-Type': 'application/json',
    });
  });

  it('handles a base URL with a trailing slash without duplicating it', () => {
    const req = toExchangeRequest(`${BASE}/`, minimalInput);
    expect(req.url).toBe('https://api.cert.platform.sabre.com/v1.1.0/exchange/booking');
  });

  it('hardcodes version "1.1.0" in the envelope', () => {
    const req = toExchangeRequest(BASE, minimalInput);
    const body = JSON.parse(req.body ?? '');
    expect(body.ExchangeBookingRQ.version).toBe('1.1.0');
  });

  it('emits Itinerary.id, AutomatedExchanges, and PostProcessing for a minimal input', () => {
    const req = toExchangeRequest(BASE, minimalInput);
    const rq = JSON.parse(req.body ?? '').ExchangeBookingRQ;
    expect(rq.Itinerary).toEqual({ id: 'IJNPIE' });
    expect(rq.PostProcessing.EndTransaction.Source.ReceivedFrom).toBe('SP TEST');
    expect(Array.isArray(rq.AutomatedExchanges)).toBe(true);
    expect(rq.AutomatedExchanges).toHaveLength(1);
    expect(rq.AutomatedExchanges[0].ExchangeComparison.OriginalTicketNumber).toBe('0277173836173');
  });

  it('defaults NameSelect.NameNumber to "1.1" when omitted', () => {
    const req = toExchangeRequest(BASE, minimalInput);
    const rq = JSON.parse(req.body ?? '').ExchangeBookingRQ;
    expect(
      rq.AutomatedExchanges[0].ExchangeComparison.PriceRequestInformation.OptionalQualifiers
        .PricingQualifiers.NameSelect.NameNumber,
    ).toBe('1.1');
  });

  it('respects an explicit nameNumber', () => {
    const req = toExchangeRequest(BASE, { ...minimalInput, nameNumber: '2.1' });
    const rq = JSON.parse(req.body ?? '').ExchangeBookingRQ;
    expect(
      rq.AutomatedExchanges[0].ExchangeComparison.PriceRequestInformation.OptionalQualifiers
        .PricingQualifiers.NameSelect.NameNumber,
    ).toBe('2.1');
  });

  it('omits Cancel, AirBook, PriceComparison, and ExchangeConfirmation when not requested', () => {
    const req = toExchangeRequest(BASE, minimalInput);
    const rq = JSON.parse(req.body ?? '').ExchangeBookingRQ;
    expect(rq.Cancel).toBeUndefined();
    expect(rq.AirBook).toBeUndefined();
    expect(rq.AutomatedExchanges[0].PriceComparison).toBeUndefined();
    expect(rq.AutomatedExchanges[0].ExchangeConfirmation).toBeUndefined();
  });

  it('emits Cancel.Segment[].Number for each segment to cancel', () => {
    const req = toExchangeRequest(BASE, { ...minimalInput, cancelSegments: [1, 2, 3] });
    const rq = JSON.parse(req.body ?? '').ExchangeBookingRQ;
    expect(rq.Cancel).toEqual({
      Segment: [{ Number: 1 }, { Number: 2 }, { Number: 3 }],
    });
  });

  it('omits Cancel when cancelSegments is an empty array', () => {
    const req = toExchangeRequest(BASE, { ...minimalInput, cancelSegments: [] });
    const rq = JSON.parse(req.body ?? '').ExchangeBookingRQ;
    expect(rq.Cancel).toBeUndefined();
  });

  it('builds AirBook with default HaltOnStatus and per-segment defaults', () => {
    const req = toExchangeRequest(BASE, { ...minimalInput, newSegments: [newSegment] });
    const rq = JSON.parse(req.body ?? '').ExchangeBookingRQ;
    // Sell NN, but NN is intentionally NOT in the halt list: a freshly-sold NN
    // segment would otherwise trip the halt and abort the air-book step. Sell
    // status stays NN (ticketable); the halt list just omits NN.
    expect(rq.AirBook.HaltOnStatus).toEqual([
      { Code: 'HL' },
      { Code: 'KK' },
      { Code: 'LL' },
      { Code: 'NO' },
      { Code: 'UC' },
      { Code: 'US' },
    ]);
    const fs = rq.AirBook.OriginDestinationInformation.FlightSegment[0];
    expect(fs).toEqual({
      ArrivalDateTime: '2026-05-03T08:19:00',
      DepartureDateTime: '2026-05-03T06:00:00',
      FlightNumber: '781',
      NumberInParty: '1',
      ResBookDesigCode: 'G',
      Status: 'NN',
      DestinationLocation: { LocationCode: 'PDX' },
      MarketingAirline: { Code: 'AS', FlightNumber: '781' },
      OriginLocation: { LocationCode: 'LAS' },
    });
  });

  it('overrides HaltOnStatus when supplied', () => {
    const req = toExchangeRequest(BASE, {
      ...minimalInput,
      newSegments: [newSegment],
      haltOnStatus: ['UC', 'US'],
    });
    const rq = JSON.parse(req.body ?? '').ExchangeBookingRQ;
    expect(rq.AirBook.HaltOnStatus).toEqual([{ Code: 'UC' }, { Code: 'US' }]);
  });

  it('uses a caller-supplied per-segment status over the default', () => {
    const req = toExchangeRequest(BASE, {
      ...minimalInput,
      newSegments: [{ ...newSegment, status: 'GK' }],
    });
    const rq = JSON.parse(req.body ?? '').ExchangeBookingRQ;
    expect(rq.AirBook.OriginDestinationInformation.FlightSegment[0].Status).toBe('GK');
  });

  it('emits HaltOnTimeDiscrepancy and RedisplayReservation when supplied', () => {
    const req = toExchangeRequest(BASE, {
      ...minimalInput,
      newSegments: [newSegment],
      haltOnTimeDiscrepancyMinutes: 59,
      redisplayReservation: { numAttempts: 2, waitInterval: 5000 },
    });
    const rq = JSON.parse(req.body ?? '').ExchangeBookingRQ;
    expect(rq.AirBook.HaltOnTimeDiscrepancy).toEqual({ acceptableThreshold: 59 });
    expect(rq.AirBook.RedisplayReservation).toEqual({ NumAttempts: 2, WaitInterval: 5000 });
  });

  it('builds PriceComparison from priceTolerance', () => {
    const req = toExchangeRequest(BASE, {
      ...minimalInput,
      priceTolerance: {
        amountSpecified: 0,
        acceptableIncrease: { amount: 10, haltOnNonAcceptablePrice: true },
        acceptableDecrease: { amount: 10, haltOnNonAcceptablePrice: false },
      },
    });
    const rq = JSON.parse(req.body ?? '').ExchangeBookingRQ;
    expect(rq.AutomatedExchanges[0].PriceComparison).toEqual({
      amountSpecified: 0,
      AcceptablePriceIncrease: { haltOnNonAcceptablePrice: true, Amount: 10 },
      AcceptablePriceDecrease: { haltOnNonAcceptablePrice: false, Amount: 10 },
    });
  });

  it('emits validatingCarrier under FlightQualifiers and pricing flags', () => {
    const req = toExchangeRequest(BASE, {
      ...minimalInput,
      validatingCarrier: 'AS',
      bargainFinder: true,
      autoRedirect: true,
    });
    const rq = JSON.parse(req.body ?? '').ExchangeBookingRQ;
    const opt =
      rq.AutomatedExchanges[0].ExchangeComparison.PriceRequestInformation.OptionalQualifiers;
    expect(opt.FlightQualifiers).toEqual({ VendorPrefs: { Airline: { Code: 'AS' } } });
    expect(opt.PricingQualifiers.BargainFinder).toEqual({ Rebook: true });
    expect(opt.PricingQualifiers.AutoRedirect).toBe(true);
  });

  it('emits ExchangeOverrides.ChangeFee when changeFeeOverride is supplied', () => {
    const req = toExchangeRequest(BASE, { ...minimalInput, changeFeeOverride: '100.00' });
    const rq = JSON.parse(req.body ?? '').ExchangeBookingRQ;
    expect(rq.AutomatedExchanges[0].ExchangeComparison.ExchangeOverrides).toEqual({
      ChangeFee: '100.00',
    });
  });

  it('builds ExchangeConfirmation with a card FOP (Type omitted, CC_Info populated)', () => {
    const req = toExchangeRequest(BASE, {
      ...minimalInput,
      confirm: {
        formOfPayment: {
          type: 'card',
          vendorCode: 'VI',
          number: '4444333322221111',
          expireDate: '2030-12',
          suppress: true,
        },
        waiverCode: 'WV236',
      },
    });
    const rq = JSON.parse(req.body ?? '').ExchangeBookingRQ;
    const ec = rq.AutomatedExchanges[0].ExchangeConfirmation;
    const fop = ec.OptionalQualifiers.FOP_Qualifiers.BasicFOP[0];
    expect(fop.Type).toBeUndefined();
    expect(fop.CC_Info).toEqual({
      Suppress: true,
      PaymentCard: { Code: 'VI', ExpireDate: '2030-12', Number: '4444333322221111' },
    });
    expect(ec.WaiverCode).toBe('WV236');
  });

  it('builds ExchangeConfirmation with a cash FOP', () => {
    const req = toExchangeRequest(BASE, {
      ...minimalInput,
      confirm: { formOfPayment: { type: 'cash' } },
    });
    const rq = JSON.parse(req.body ?? '').ExchangeBookingRQ;
    const fop =
      rq.AutomatedExchanges[0].ExchangeConfirmation.OptionalQualifiers.FOP_Qualifiers.BasicFOP[0];
    expect(fop).toEqual({ Type: 'CA' });
  });

  it('builds ExchangeConfirmation with a check FOP', () => {
    const req = toExchangeRequest(BASE, {
      ...minimalInput,
      confirm: { formOfPayment: { type: 'check' } },
    });
    const rq = JSON.parse(req.body ?? '').ExchangeBookingRQ;
    const fop =
      rq.AutomatedExchanges[0].ExchangeConfirmation.OptionalQualifiers.FOP_Qualifiers.BasicFOP[0];
    expect(fop).toEqual({ Type: 'CK' });
  });

  it('passes returnPQRInfo, redisplay, and targetCity through', () => {
    const req = toExchangeRequest(BASE, {
      ...minimalInput,
      targetCity: 'G7HE',
      returnPQRInfo: true,
      redisplay: true,
    });
    const rq = JSON.parse(req.body ?? '').ExchangeBookingRQ;
    expect(rq.targetCity).toBe('G7HE');
    expect(rq.PostProcessing.returnPQRInfo).toBe(true);
    expect(rq.PostProcessing.redisplayReservation).toBe(true);
  });

  it('builds an Email block with Itinerary indicator when only email.itinerary is set', () => {
    const req = toExchangeRequest(BASE, {
      ...minimalInput,
      email: { nameNumber: '1.1', itinerary: true },
    });
    const rq = JSON.parse(req.body ?? '').ExchangeBookingRQ;
    expect(rq.PostProcessing.EndTransaction.Email).toEqual({
      Ind: true,
      PersonName: { NameNumber: '1.1' },
      Itinerary: { Ind: true },
    });
  });

  it('prefers eTicket over Invoice / Itinerary when multiple email flags are set', () => {
    const req = toExchangeRequest(BASE, {
      ...minimalInput,
      email: { nameNumber: '1.1', eticket: true, invoice: true, itinerary: true },
    });
    const rq = JSON.parse(req.body ?? '').ExchangeBookingRQ;
    const email = rq.PostProcessing.EndTransaction.Email;
    expect(email.eTicket).toEqual({ Ind: true });
    expect(email.Invoice).toBeUndefined();
    expect(email.Itinerary).toBeUndefined();
  });
});

describe('fromExchangeResponse', () => {
  it('extracts applicationResults, exchangeConfirmations, and priceQuoteReissue', () => {
    const out = fromExchangeResponse(
      okResponse({
        ExchangeBookingRS: {
          ApplicationResults: {
            status: 'Complete',
            Success: [{ timeStamp: '2026-02-07T05:24:07.797-06:00' }],
          },
          ExchangeConfirmation: [
            {
              PQR_Number: '02',
              AutoRedirect: 'Y',
              PriceComparison: { amountReturned: '0.00' },
              AdditionalText: 'CHG FEE AMT MODIFIED',
            },
          ],
          PriceQuoteReissue: [
            {
              PQR_Number: '2',
              ResponseHeader: { Text: ['VALIDATING CARRIER SPECIFIED - AS'] },
              MiscInformation: {
                BaggageFees: [{ Text: 'BAG ALLOWANCE     -LASDFW-NIL/AS' }],
                SignatureLine: [
                  {
                    CreationAgent: 'ASP',
                    CreateDateTime: '2026-02-07T05:24',
                    HomePseudoCityCode: 'G7HE',
                    PseudoCityCode: 'G7HE',
                    Source: 'SYS',
                  },
                ],
              },
              PricedItinerary: {
                InputMessage: 'WFRF',
                AirItineraryPricingInfo: {
                  ResTicketingRestrictions: ['02-08'],
                  FareCalculation: { Text: ['LAS AS X/PDX'] },
                  PassengerTypeQuantity: [{ Code: 'ADT', Quantity: '01' }],
                  ExchangeDetails: {
                    DocNumber: '0277173836173',
                    CurrencyCode: 'USD',
                    PQR_Status: 'E',
                    TicketValue: '1222.01',
                    PersonName: { Surname: 'SMITH/JAMES' },
                    Text: ['RESIDUAL AMT REFUNDABLE'],
                    ChangeFeeInformation: [{ Amount: 'N/A' }],
                    TransactionInformation: [{ Amount: '0.00', CurrencyCode: 'USD', Text: 'EVEN' }],
                  },
                  ItinTotalFare: {
                    BaseFare: { Amount: '401.86', CurrencyCode: 'USD' },
                    TotalFare: { Amount: '482.20', CurrencyCode: 'USD' },
                    Taxes: {
                      TaxCode: 'XT',
                      TotalAmount: '80.34',
                      Tax: [{ Amount: '30.14', TaxCode: 'US' }],
                    },
                  },
                  PTC_FareBreakdown: {
                    FlightSegment: [
                      {
                        ConnectionInd: 'O',
                        DepartureDateTime: '05-03T06:00',
                        FlightNumber: '781',
                        ResBookDesigCode: 'G',
                        RPH: '01',
                        BaggageAllowance: { Number: 'NIL' },
                        FareBasis: { Code: 'GH2OAVMN' },
                        MarketingAirline: { Code: 'AS', FlightNumber: '781' },
                        OriginLocation: { LocationCode: 'LAS' },
                        ValidityDates: {
                          NotValidAfter: '2026-05-03',
                          NotValidBefore: '2026-05-03',
                        },
                      },
                    ],
                  },
                },
              },
            },
          ],
        },
      }),
    );

    expect(out.applicationResults?.status).toBe('Complete');
    expect(out.exchangeConfirmations).toEqual([
      {
        pqrNumber: '02',
        autoRedirect: 'Y',
        amountReturned: '0.00',
        additionalText: 'CHG FEE AMT MODIFIED',
      },
    ]);
    const pqr = out.priceQuoteReissue?.[0];
    expect(pqr?.pqrNumber).toBe('2');
    expect(pqr?.responseHeader).toEqual(['VALIDATING CARRIER SPECIFIED - AS']);
    expect(pqr?.baggageFees).toEqual(['BAG ALLOWANCE     -LASDFW-NIL/AS']);
    expect(pqr?.signatureLines?.[0]?.creationAgent).toBe('ASP');
    expect(pqr?.inputMessage).toBe('WFRF');
    expect(pqr?.exchangeDetails?.docNumber).toBe('0277173836173');
    expect(pqr?.exchangeDetails?.changeFees?.[0]?.amount).toBe('N/A');
    expect(pqr?.exchangeDetails?.transactionInformation?.[0]?.text).toBe('EVEN');
    expect(pqr?.itinTotalFare?.baseFare?.amount).toBe('401.86');
    expect(pqr?.itinTotalFare?.taxes?.tax?.[0]).toEqual({ amount: '30.14', taxCode: 'US' });
    expect(pqr?.segments?.[0]?.flightNumber).toBe('781');
    expect(pqr?.segments?.[0]?.fareBasis).toBe('GH2OAVMN');
  });

  it('returns rawResponse only when only ApplicationResults is present', () => {
    const out = fromExchangeResponse(
      okResponse({
        ExchangeBookingRS: {
          ApplicationResults: { status: 'NotProcessed', Error: [{ type: 'BusinessLogic' }] },
        },
      }),
    );
    expect(out.applicationResults?.status).toBe('NotProcessed');
    expect(out.applicationResults?.errors?.[0]?.type).toBe('BusinessLogic');
    expect(out.exchangeConfirmations).toBeUndefined();
    expect(out.priceQuoteReissue).toBeUndefined();
  });

  it('throws SabreParseError when the body is not valid JSON', () => {
    const res: SabreResponse = {
      status: 200,
      statusText: 'OK',
      headers: {},
      body: '<html>not json</html>',
    };
    expect(() => fromExchangeResponse(res)).toThrow(SabreParseError);
  });

  it('throws SabreParseError when the body is JSON but not an object', () => {
    expect(() => fromExchangeResponse(okResponse('"a string"'))).toThrow(SabreParseError);
  });
});
