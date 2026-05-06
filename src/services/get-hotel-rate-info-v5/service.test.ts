import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TokenProvider } from '../../auth/types.js';
import { createSabreClient } from '../../client.js';
import type { GetHotelRateInfoInput } from './types.js';

const fakeProvider = (): TokenProvider => ({
  getToken: vi.fn(async () => 'TEST_TOKEN'),
  invalidate: vi.fn(async () => {}),
});

const hotelRefInput: GetHotelRateInfoInput = {
  kind: 'hotel-ref',
  hotelRef: { code: '100072188', codeContext: 'GLOBAL' },
  rateCriteria: {
    stayDateTimeRange: { startDate: '2026-06-20', endDate: '2026-06-22' },
    rooms: [{ index: 1, adults: 1 }],
    currencyCode: 'USD',
  },
};

const rateKeyInput: GetHotelRateInfoInput = {
  kind: 'rate-key',
  rateKey: 'OPAQUE==',
};

describe('GetHotelRateInfoV5Service.getRateInfo', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('POSTs the correct URL with bearer auth and maps the response', async () => {
    const fetchMock = vi.fn().mockImplementation(
      () =>
        new Response(
          JSON.stringify({
            GetHotelRateInfoRS: {
              ApplicationResults: { status: 'Complete' },
              HotelRateInfos: {
                HotelRateInfo: {
                  HotelInfo: {
                    HotelCode: '100072188',
                    CodeContext: 'GLOBAL',
                    ChainCode: 'HY',
                  },
                  RateInfos: {
                    ConvertedRateInfo: [
                      { RateSource: '110', RateKey: 'THEKEY==', CurrencyCode: 'USD' },
                    ],
                  },
                },
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

    const result = await client.getHotelRateInfoV5.getRateInfo(hotelRefInput);

    expect(result.status).toBe('Complete');
    expect(result.hotel?.info).toEqual({
      code: '100072188',
      codeContext: 'GLOBAL',
      chainCode: 'HY',
    });
    expect(result.hotel?.rateInfos?.convertedRateInfo?.[0]?.rateKey).toBe('THEKEY==');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe('https://api.cert.platform.sabre.com/v5/get/hotelrateinfo');
    const req = init as RequestInit;
    expect(req.method).toBe('POST');
    const headers = req.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer TEST_TOKEN');
    expect(headers.Accept).toBe('application/json');
    expect(headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(req.body as string)).toEqual({
      GetHotelRateInfoRQ: {
        version: '5.0.0',
        HotelRefs: { HotelRef: { HotelCode: '100072188', CodeContext: 'GLOBAL' } },
        RateInfoRef: {
          StayDateTimeRange: { StartDate: '2026-06-20', EndDate: '2026-06-22' },
          Rooms: { Room: [{ Index: 1, Adults: 1 }] },
          CurrencyCode: 'USD',
        },
      },
    });
  });

  it('sends a rate-key request body when the consumer uses the rate-key flow', async () => {
    const fetchMock = vi.fn().mockImplementation(
      () =>
        new Response(JSON.stringify({ GetHotelRateInfoRS: {} }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const client = createSabreClient({
      baseUrl: 'https://api.cert.platform.sabre.com',
      auth: fakeProvider(),
    });

    await client.getHotelRateInfoV5.getRateInfo(rateKeyInput);

    const [, init] = fetchMock.mock.calls[0] ?? [];
    const req = init as RequestInit;
    expect(JSON.parse(req.body as string)).toEqual({
      GetHotelRateInfoRQ: { version: '5.0.0', RateKeyRef: { RateKey: 'OPAQUE==' } },
    });
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

    await expect(client.getHotelRateInfoV5.getRateInfo(hotelRefInput)).rejects.toMatchObject({
      name: 'SabreApiResponseError',
      statusCode: 400,
    });
  });
});
