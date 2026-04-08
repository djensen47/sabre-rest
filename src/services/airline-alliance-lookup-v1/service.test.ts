import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TokenProvider } from '../../auth/types.js';
import { createSabreClient } from '../../client.js';

const fakeProvider = (): TokenProvider => ({
  getToken: vi.fn(async () => 'TEST_TOKEN'),
  invalidate: vi.fn(async () => {}),
});

describe('AirlineAllianceLookupV1Service.lookup', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('calls the correct Sabre URL with bearer auth and returns the mapped result', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          AllianceInfo: [
            {
              AllianceCode: '*O',
              AllianceName: 'oneworld',
              AirlineInfo: [{ AirlineCode: 'AA' }, { AirlineCode: 'BA' }],
            },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const client = createSabreClient({
      baseUrl: 'https://api.cert.platform.sabre.com',
      auth: fakeProvider(),
    });

    const result = await client.airlineAllianceLookupV1.lookup({ codes: ['*O'] });

    expect(result.alliances).toEqual([
      { code: '*O', name: 'oneworld', members: [{ code: 'AA' }, { code: 'BA' }] },
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe(
      'https://api.cert.platform.sabre.com/v1/lists/utilities/airlines/alliances?alliancecode=*O',
    );
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer TEST_TOKEN');
    expect(headers.Accept).toBe('application/json');
  });

  it('omits the alliancecode param when called with no input', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ AllianceInfo: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const client = createSabreClient({
      baseUrl: 'https://api.cert.platform.sabre.com',
      auth: fakeProvider(),
    });

    const result = await client.airlineAllianceLookupV1.lookup();

    expect(result.alliances).toEqual([]);
    const [url] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe('https://api.cert.platform.sabre.com/v1/lists/utilities/airlines/alliances');
  });

  it('surfaces a non-2xx response as SabreApiResponseError via the baked-in error mapper', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ message: "Parameter 'alliancecode' must be a valid value." }),
            { status: 400, statusText: 'Bad Request' },
          ),
        ),
    );

    const client = createSabreClient({
      baseUrl: 'https://api.cert.platform.sabre.com',
      auth: fakeProvider(),
    });

    await expect(client.airlineAllianceLookupV1.lookup({ codes: ['??'] })).rejects.toMatchObject({
      name: 'SabreApiResponseError',
      statusCode: 400,
    });
  });
});
