import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TokenProvider } from '../../auth/types.js';
import { createSabreClient } from '../../client.js';
import type { CheckHotelPriceInput } from './types.js';

const fakeProvider = (): TokenProvider => ({
  getToken: vi.fn(async () => 'TEST_TOKEN'),
  invalidate: vi.fn(async () => {}),
});

const input: CheckHotelPriceInput = { rateKey: 'OPAQUE==' };

describe('HotelPriceCheckV5Service.check', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('POSTs the correct URL with bearer auth and returns the mapped result', async () => {
    const fetchMock = vi.fn().mockImplementation(
      () =>
        new Response(
          JSON.stringify({
            HotelPriceCheckRS: {
              PriceCheckInfo: {
                BookingKey: 'BK-42',
                PriceChange: false,
                PriceDifference: '0',
                CurrencyCode: 'USD',
                HotelInfo: { HotelCode: '100', CodeContext: 'GLOBAL' },
                HotelRateInfo: {},
              },
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const client = createSabreClient({
      baseUrl: 'https://api.cert.platform.sabre.com',
      auth: fakeProvider(),
    });

    const result = await client.hotelPriceCheckV5.check(input);

    expect(result.bookingKey).toBe('BK-42');
    expect(result.priceChange).toBe(false);
    expect(result.hotel).toEqual({ code: '100', codeContext: 'GLOBAL' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe('https://api.cert.platform.sabre.com/v5/hotel/pricecheck');
    const req = init as RequestInit;
    expect(req.method).toBe('POST');
    const headers = req.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer TEST_TOKEN');
    expect(headers.Accept).toBe('application/json');
    expect(headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(req.body as string)).toEqual({
      HotelPriceCheckRQ: { RateInfoRef: { RateKey: 'OPAQUE==' } },
    });
  });

  it('surfaces a non-2xx response as SabreApiResponseError via the baked-in error mapper', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(
        () =>
          new Response(JSON.stringify({ message: 'Rate key not found' }), {
            status: 400,
            statusText: 'Bad Request',
          }),
      ),
    );

    const client = createSabreClient({
      baseUrl: 'https://api.cert.platform.sabre.com',
      auth: fakeProvider(),
    });

    await expect(client.hotelPriceCheckV5.check(input)).rejects.toMatchObject({
      name: 'SabreApiResponseError',
      statusCode: 400,
    });
  });
});
