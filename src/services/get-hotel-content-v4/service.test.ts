import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TokenProvider } from '../../auth/types.js';
import { createSabreClient } from '../../client.js';
import type { GetHotelContentInput } from './types.js';

const fakeProvider = (): TokenProvider => ({
  getToken: vi.fn(async () => 'TEST_TOKEN'),
  invalidate: vi.fn(async () => {}),
});

const contentInput: GetHotelContentInput = {
  hotelRef: { code: '100072188', codeContext: 'GLOBAL' },
  descriptiveInfo: { propertyInfo: true },
};

describe('GetHotelContentV4Service.getContent', () => {
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
            GetHotelContentRS: {
              ApplicationResults: { status: 'Complete' },
              HotelContentInfos: {
                HotelContentInfo: {
                  HotelInfo: {
                    HotelCode: '100072188',
                    CodeContext: 'GLOBAL',
                    HotelName: 'Hyatt Regency Tulsa',
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

    const result = await client.getHotelContentV4.getContent(contentInput);

    expect(result.status).toBe('Complete');
    expect(result.hotel?.info).toEqual({
      code: '100072188',
      codeContext: 'GLOBAL',
      hotelName: 'Hyatt Regency Tulsa',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe('https://api.cert.platform.sabre.com/v4.0.0/get/hotelcontent');
    const req = init as RequestInit;
    expect(req.method).toBe('POST');
    const headers = req.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer TEST_TOKEN');
    expect(headers.Accept).toBe('application/json');
    expect(headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(req.body as string)).toEqual({
      GetHotelContentRQ: {
        SearchCriteria: {
          HotelRefs: { HotelRef: { HotelCode: '100072188', CodeContext: 'GLOBAL' } },
          DescriptiveInfoRef: { PropertyInfo: true },
        },
      },
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

    await expect(client.getHotelContentV4.getContent(contentInput)).rejects.toMatchObject({
      name: 'SabreApiResponseError',
      statusCode: 400,
    });
  });
});
