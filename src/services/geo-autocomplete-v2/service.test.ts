import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TokenProvider } from '../../auth/types.js';
import { createSabreClient } from '../../client.js';
import type { GeoAutocompleteInput } from './types.js';

const fakeProvider = (): TokenProvider => ({
  getToken: vi.fn(async () => 'TEST_TOKEN'),
  invalidate: vi.fn(async () => {}),
});

const autocompleteInput: GeoAutocompleteInput = {
  query: 'Dall',
};

describe('GeoAutocompleteV2Service.autocomplete', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('GETs the correct URL with bearer auth and returns the mapped result', async () => {
    const fetchMock = vi.fn().mockImplementation(
      () =>
        new Response(
          JSON.stringify({
            responseHeader: { status: 0, QTime: 3 },
            grouped: {
              'category:AIR': {
                matches: 10,
                doclist: {
                  numFound: 2,
                  start: 0,
                  docs: [
                    {
                      name: 'Dallas/Fort Worth Intl.',
                      city: 'Dallas',
                      country: 'US',
                      id: 'DFW',
                      category: 'AIR',
                    },
                  ],
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

    const result = await client.geoAutocompleteV2.autocomplete(autocompleteInput);

    expect(result.status).toBe(0);
    expect(result.queryTime).toBe(3);
    expect(result.groups).toHaveLength(1);
    const group = result.groups.at(0);
    expect(group?.category).toBe('AIR');
    expect(group?.places[0]).toMatchObject({
      name: 'Dallas/Fort Worth Intl.',
      city: 'Dallas',
      id: 'DFW',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe('https://api.cert.platform.sabre.com/v2/geo/autocomplete?query=Dall');
    const req = init as RequestInit;
    expect(req.method).toBe('GET');
    const headers = req.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer TEST_TOKEN');
    expect(headers.Accept).toBe('application/json');
  });

  it('surfaces a non-2xx response as SabreApiResponseError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(
        () =>
          new Response(JSON.stringify({ message: 'query param required' }), {
            status: 400,
            statusText: 'Bad Request',
          }),
      ),
    );

    const client = createSabreClient({
      baseUrl: 'https://api.cert.platform.sabre.com',
      auth: fakeProvider(),
    });

    await expect(client.geoAutocompleteV2.autocomplete(autocompleteInput)).rejects.toMatchObject({
      name: 'SabreApiResponseError',
      statusCode: 400,
    });
  });
});
