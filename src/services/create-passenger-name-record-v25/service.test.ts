import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TokenProvider } from '../../auth/types.js';
import { createSabreClient } from '../../client.js';
import type { BookHotelInput } from './types.js';

const fakeProvider = (): TokenProvider => ({
  getToken: vi.fn(async () => 'TEST_TOKEN'),
  invalidate: vi.fn(async () => {}),
});

const input: BookHotelInput = {
  bookingKey: 'OPAQUE-BK==',
  leadGuest: {
    firstName: 'Test',
    lastName: 'Booking',
    phone: '817-555-1212',
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
      countryCode: 'PL',
    },
  },
};

describe('CreatePassengerNameRecordV25Service.bookHotel', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('POSTs to /v2.5.0/passenger/records?mode=create with bearer auth and returns the locator', async () => {
    const fetchMock = vi.fn().mockImplementation(
      () =>
        new Response(
          JSON.stringify({
            CreatePassengerNameRecordRS: {
              ItineraryRef: { ID: 'PNR123' },
              ApplicationResults: { status: 'Complete' },
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const client = createSabreClient({
      baseUrl: 'https://api-crt.cert.havail.sabre.com',
      auth: fakeProvider(),
    });

    const result = await client.createPassengerNameRecordV25.bookHotel(input);

    expect(result.pnrLocator).toBe('PNR123');
    expect(result.applicationResults?.status).toBe('Complete');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe('https://api-crt.cert.havail.sabre.com/v2.5.0/passenger/records?mode=create');
    const req = init as RequestInit;
    expect(req.method).toBe('POST');
    const headers = req.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer TEST_TOKEN');
    expect(headers.Accept).toBe('application/json');
    expect(headers['Content-Type']).toBe('application/json');

    const body = JSON.parse(req.body as string);
    expect(body.CreatePassengerNameRecordRQ.version).toBe('2.5.0');
    expect(body.CreatePassengerNameRecordRQ.HotelBook.bookGDSviaCSL).toBe(true);
  });

  it('surfaces a non-2xx response as SabreApiResponseError via the baked-in error mapper', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(
        () =>
          new Response(JSON.stringify({ message: 'Booking key not found' }), {
            status: 400,
            statusText: 'Bad Request',
          }),
      ),
    );

    const client = createSabreClient({
      baseUrl: 'https://api-crt.cert.havail.sabre.com',
      auth: fakeProvider(),
    });

    await expect(client.createPassengerNameRecordV25.bookHotel(input)).rejects.toMatchObject({
      name: 'SabreApiResponseError',
      statusCode: 400,
    });
  });
});
