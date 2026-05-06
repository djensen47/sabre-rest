import { describe, expect, it } from 'vitest';
import { SabreParseError } from '../../errors/sabre-parse-error.js';
import { okResponse } from '../../http/test-utils.js';
import type { SabreResponse } from '../../http/types.js';
import { fromBookHotelResponse, toBookHotelRequest } from './mappers.js';
import type { BookHotelInput } from './types.js';

const BASE = 'https://api-crt.cert.havail.sabre.com';

const minimalInput: BookHotelInput = {
  bookingKey: 'OPAQUE-BK==',
  leadGuest: {
    firstName: 'Test',
    lastName: 'Booking',
    phone: '817-555-1212',
    email: 'test@sabre.com',
  },
  agency: {
    name: 'Really Trustworthy Agency',
    pcc: 'TM61',
    iata: '12345678',
    address: {
      streetNumber: '3150 SABRE DRIVE',
      addressLine: 'SABRE TRAVEL',
      cityName: 'SOUTHLAKE',
      stateCode: 'TX',
      countryCode: 'US',
      postalCode: '76092',
    },
  },
  paymentCard: {
    cardCode: 'VI',
    cardNumber: '4444333322221111',
    expiryMonth: 12,
    expiryYear: '2030',
    csc: '123',
    holderFirstName: 'Test',
    holderLastName: 'Booking',
    billingAddress: {
      addressLine: ['Wadowicka 6'],
      cityName: 'Krakow',
      stateCode: 'KR',
      countryCode: 'PL',
      postalCode: '30-415',
    },
  },
};

describe('toBookHotelRequest', () => {
  it('builds a POST to /v2.5.0/passenger/records?mode=create with JSON headers', () => {
    const req = toBookHotelRequest(BASE, minimalInput);

    expect(req.method).toBe('POST');
    expect(req.url).toBe(
      'https://api-crt.cert.havail.sabre.com/v2.5.0/passenger/records?mode=create',
    );
    expect(req.headers).toEqual({
      Accept: 'application/json',
      'Content-Type': 'application/json',
    });
  });

  it('handles a base URL with a trailing slash without duplicating it', () => {
    const req = toBookHotelRequest(`${BASE}/`, minimalInput);
    expect(req.url).toBe(
      'https://api-crt.cert.havail.sabre.com/v2.5.0/passenger/records?mode=create',
    );
  });

  it('hardcodes version "2.5.0" in the envelope', () => {
    const req = toBookHotelRequest(BASE, minimalInput);
    const body = JSON.parse(req.body ?? '');
    expect(body.CreatePassengerNameRecordRQ.version).toBe('2.5.0');
  });

  it('hardcodes bookGDSviaCSL: true as a sibling of HotelBook.POS (CSL-segment discriminator)', () => {
    const req = toBookHotelRequest(BASE, minimalInput);
    const body = JSON.parse(req.body ?? '');
    const hotelBook = body.CreatePassengerNameRecordRQ.HotelBook;
    expect(hotelBook.bookGDSviaCSL).toBe(true);
    // Regression guard: Sabre rejects this property when it's nested
    // under POS.Source ("object instance has properties which are not
    // allowed by the schema"). It lives as a sibling of POS.
    expect(hotelBook.POS.Source.bookGDSviaCSL).toBeUndefined();
  });

  it('includes the top-level PostProcessing block — spec requires it', () => {
    const req = toBookHotelRequest(BASE, minimalInput);
    const body = JSON.parse(req.body ?? '');
    expect(body.CreatePassengerNameRecordRQ.PostProcessing).toEqual({
      EndTransaction: { Source: { ReceivedFrom: 'Really Trustworthy Agency' } },
    });
  });

  it('defaults haltOnHotelBookError to true and haltOnAirPriceError to false', () => {
    const req = toBookHotelRequest(BASE, minimalInput);
    const rq = JSON.parse(req.body ?? '').CreatePassengerNameRecordRQ;
    expect(rq.haltOnHotelBookError).toBe(true);
    expect(rq.haltOnAirPriceError).toBe(false);
  });

  it('allows the caller to disable haltOnHotelBookError', () => {
    const req = toBookHotelRequest(BASE, { ...minimalInput, haltOnHotelBookError: false });
    const rq = JSON.parse(req.body ?? '').CreatePassengerNameRecordRQ;
    expect(rq.haltOnHotelBookError).toBe(false);
  });

  it('passes targetCity through when supplied and omits it otherwise', () => {
    const without = JSON.parse(toBookHotelRequest(BASE, minimalInput).body ?? '');
    expect(without.CreatePassengerNameRecordRQ.targetCity).toBeUndefined();

    const withCity = JSON.parse(
      toBookHotelRequest(BASE, { ...minimalInput, targetCity: 'ABCD' }).body ?? '',
    );
    expect(withCity.CreatePassengerNameRecordRQ.targetCity).toBe('ABCD');
  });

  it('puts the BookingKey, RequestorID (IATA), and one-guest Room on HotelBook', () => {
    const rq = JSON.parse(
      toBookHotelRequest(BASE, minimalInput).body ?? '',
    ).CreatePassengerNameRecordRQ;
    expect(rq.HotelBook.BookingInfo).toEqual({
      BookingKey: 'OPAQUE-BK==',
      RequestorID: '12345678',
    });
    expect(rq.HotelBook.Rooms.Room).toHaveLength(1);
    expect(rq.HotelBook.Rooms.Room[0]).toMatchObject({
      RoomIndex: 1,
      Guests: {
        Guest: [
          {
            FirstName: 'Test',
            LastName: 'Booking',
            Index: 1,
            LeadGuest: true,
            Type: 10,
            Email: 'test@sabre.com',
            Contact: { Phone: '817-555-1212' },
          },
        ],
      },
    });
  });

  it('builds a PaymentCard block with CardNumber, expiry, holder name, CSC, and billing address', () => {
    const rq = JSON.parse(
      toBookHotelRequest(BASE, minimalInput).body ?? '',
    ).CreatePassengerNameRecordRQ;
    const card = rq.HotelBook.PaymentInformation.FormOfPayment.PaymentCard;
    expect(card.PaymentType).toBe('CC');
    expect(card.CardCode).toBe('VI');
    expect(card.CardNumber).toBe('4444333322221111');
    expect(card.ExpiryMonth).toBe(12);
    expect(card.ExpiryYear).toBe('2030');
    expect(card.CSC).toBe('123');
    expect(card.FullCardHolderName).toEqual({ FirstName: 'Test', LastName: 'Booking' });
    expect(card.Address.AddressLine).toEqual(['Wadowicka 6']);
    expect(card.Address.CountryCodes).toEqual({ Code: [{ content: 'PL' }] });
    expect(card.Address.StateProvince).toEqual({ code: 'KR' });
    expect(card.Address.PostCode).toBe('30-415');
    expect(rq.HotelBook.PaymentInformation.Type).toBe('DEPOSIT');
  });

  it('omits CSC when the card has none', () => {
    const noCsc: BookHotelInput = {
      ...minimalInput,
      paymentCard: { ...minimalInput.paymentCard, csc: undefined },
    };
    const rq = JSON.parse(toBookHotelRequest(BASE, noCsc).body ?? '').CreatePassengerNameRecordRQ;
    expect(rq.HotelBook.PaymentInformation.FormOfPayment.PaymentCard.CSC).toBeUndefined();
  });

  it('populates TravelItineraryAddInfo with agency address and customer name', () => {
    const rq = JSON.parse(
      toBookHotelRequest(BASE, minimalInput).body ?? '',
    ).CreatePassengerNameRecordRQ;
    expect(rq.TravelItineraryAddInfo.AgencyInfo.Address).toEqual({
      AddressLine: 'SABRE TRAVEL',
      CityName: 'SOUTHLAKE',
      CountryCode: 'US',
      StreetNmbr: '3150 SABRE DRIVE',
      StateCountyProv: { StateCode: 'TX' },
      PostalCode: '76092',
    });
    expect(rq.TravelItineraryAddInfo.AgencyInfo.Ticketing).toEqual({ TicketType: '7TAW' });
    expect(rq.TravelItineraryAddInfo.CustomerInfo.PersonName).toEqual([
      {
        NameNumber: '1.1',
        PassengerType: 'ADT',
        GivenName: 'Test',
        Surname: 'Booking',
      },
    ]);
    expect(rq.TravelItineraryAddInfo.CustomerInfo.ContactNumbers.ContactNumber[0].Phone).toBe(
      '817-555-1212',
    );
  });

  it('uses agency.contactPhone for CustomerInfo when supplied', () => {
    const overridden: BookHotelInput = {
      ...minimalInput,
      agency: { ...minimalInput.agency, contactPhone: '555-000-9999' },
    };
    const rq = JSON.parse(
      toBookHotelRequest(BASE, overridden).body ?? '',
    ).CreatePassengerNameRecordRQ;
    expect(rq.TravelItineraryAddInfo.CustomerInfo.ContactNumbers.ContactNumber[0].Phone).toBe(
      '555-000-9999',
    );
  });

  it('builds HotelBook.POS.Source with IATA RequestorID and agency metadata', () => {
    const rq = JSON.parse(
      toBookHotelRequest(BASE, minimalInput).body ?? '',
    ).CreatePassengerNameRecordRQ;
    expect(rq.HotelBook.POS.Source).toMatchObject({
      RequestorID: { Type: 5, Id: '12345678', IdContext: 'IATA' },
      AgencyName: 'Really Trustworthy Agency',
      ISOCountryCode: 'US',
      PseudoCityCode: 'TM61',
    });
  });
});

describe('fromBookHotelResponse', () => {
  it('extracts the PNR locator from ItineraryRef.ID', () => {
    const out = fromBookHotelResponse(
      okResponse({
        CreatePassengerNameRecordRS: {
          ItineraryRef: { ID: 'ABC123' },
          ApplicationResults: { status: 'Complete' },
        },
      }),
    );

    expect(out.pnrLocator).toBe('ABC123');
    expect(out.applicationResults).toEqual({ status: 'Complete' });
    expect(out.rawResponse).toBeDefined();
  });

  it('returns a diagnostics-only output when the locator is absent', () => {
    const out = fromBookHotelResponse(
      okResponse({
        CreatePassengerNameRecordRS: {
          ApplicationResults: {
            status: 'Incomplete',
            Warning: [
              {
                timeStamp: '2026-05-06T00:00:00Z',
                SystemSpecificResults: [
                  {
                    Message: [{ code: 'WARN.SP.PROVIDER_WARNING', content: 'flaky supplier' }],
                    ShortText: 'Supplier warning',
                  },
                ],
              },
            ],
          },
        },
      }),
    );

    expect(out.pnrLocator).toBeUndefined();
    expect(out.applicationResults?.status).toBe('Incomplete');
    expect(out.applicationResults?.warnings).toHaveLength(1);
    expect(out.applicationResults?.warnings?.[0]?.systemSpecificResults?.[0]).toEqual({
      shortText: 'Supplier warning',
      messages: [{ code: 'WARN.SP.PROVIDER_WARNING', value: 'flaky supplier' }],
    });
  });

  it('always attaches rawResponse with the parsed body', () => {
    const body = {
      CreatePassengerNameRecordRS: { ItineraryRef: { ID: 'XYZ999' } },
    };
    const out = fromBookHotelResponse(okResponse(body));
    expect(out.rawResponse).toEqual(body);
  });

  it('throws SabreParseError when the body is not valid JSON', () => {
    const res: SabreResponse = {
      status: 200,
      statusText: 'OK',
      headers: {},
      body: '<html>not json</html>',
    };
    try {
      fromBookHotelResponse(res);
      expect.fail('expected SabreParseError');
    } catch (err) {
      expect(err).toBeInstanceOf(SabreParseError);
      expect((err as SabreParseError).responseBody).toBe('<html>not json</html>');
    }
  });

  it('throws SabreParseError when the body is JSON but not an object', () => {
    expect(() => fromBookHotelResponse(okResponse(null))).toThrow(SabreParseError);
  });
});
