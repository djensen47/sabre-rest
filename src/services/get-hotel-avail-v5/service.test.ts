import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TokenProvider } from '../../auth/types.js';
import { createSabreClient } from '../../client.js';
import type { GetHotelAvailInput } from './types.js';

const fakeProvider = (): TokenProvider => ({
  getToken: vi.fn(async () => 'TEST_TOKEN'),
  invalidate: vi.fn(async () => {}),
});

const input: GetHotelAvailInput = {
  search: {
    kind: 'geo',
    geoRef: { kind: 'geoCode', radius: 25, uom: 'MI', latitude: 32.758, longitude: -97.08 },
  },
  rateInfoRef: {
    currencyCode: 'USD',
    bestOnly: '1',
    stayDateTimeRange: { startDate: '2026-06-20', endDate: '2026-06-22' },
    rooms: [{ index: 1, adults: 1 }],
  },
};

describe('GetHotelAvailV5Service.getAvail', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('POSTs the correct URL with bearer auth and surfaces the rateKey', async () => {
    const fetchMock = vi.fn().mockImplementation(
      () =>
        new Response(
          JSON.stringify({
            GetHotelAvailRS: {
              HotelAvailInfos: {
                MaxSearchResults: 1,
                HotelAvailInfo: [
                  {
                    HotelInfo: {
                      HotelCode: '100072188',
                      CodeContext: 'GLOBAL',
                      HotelName: 'Test Hotel',
                    },
                    HotelRateInfo: {
                      RateInfos: {
                        ConvertedRateInfo: [
                          { RateSource: '110', RateKey: 'THEKEY==', CurrencyCode: 'USD' },
                        ],
                      },
                    },
                  },
                ],
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

    const result = await client.getHotelAvailV5.getAvail(input);

    expect(result.maxSearchResults).toBe(1);
    expect(result.hotels[0]?.rateInfo?.convertedRateInfo?.[0]?.rateKey).toBe('THEKEY==');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe('https://api.cert.platform.sabre.com/v5/get/hotelavail');
    const req = init as RequestInit;
    expect(req.method).toBe('POST');
    const headers = req.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer TEST_TOKEN');
    expect(headers.Accept).toBe('application/json');
    expect(headers['Content-Type']).toBe('application/json');
  });

  it('surfaces a non-2xx response as SabreApiResponseError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(
        () =>
          new Response(JSON.stringify({ message: 'Bad request' }), {
            status: 400,
            statusText: 'Bad Request',
          }),
      ),
    );

    const client = createSabreClient({
      baseUrl: 'https://api.cert.platform.sabre.com',
      auth: fakeProvider(),
    });

    await expect(client.getHotelAvailV5.getAvail(input)).rejects.toMatchObject({
      name: 'SabreApiResponseError',
      statusCode: 400,
    });
  });
});
