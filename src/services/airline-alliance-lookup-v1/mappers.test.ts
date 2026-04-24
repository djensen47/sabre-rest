import { describe, expect, it } from 'vitest';
import { SabreParseError } from '../../errors/sabre-parse-error.js';
import { okResponse } from '../../http/test-utils.js';
import type { SabreResponse } from '../../http/types.js';
import { fromLookupResponse, toLookupRequest } from './mappers.js';

describe('toLookupRequest', () => {
  it('builds a GET to the alliances path with no query params when no codes are given', () => {
    const req = toLookupRequest('https://api.cert.platform.sabre.com');
    expect(req.method).toBe('GET');
    expect(req.url).toBe(
      'https://api.cert.platform.sabre.com/v1/lists/utilities/airlines/alliances',
    );
    expect(req.headers.Accept).toBe('application/json');
  });

  it('omits the alliancecode param when codes is an empty array', () => {
    const req = toLookupRequest('https://api.cert.platform.sabre.com', { codes: [] });
    expect(req.url).toBe(
      'https://api.cert.platform.sabre.com/v1/lists/utilities/airlines/alliances',
    );
  });

  it('joins multiple alliance codes with commas in the alliancecode query param', () => {
    const req = toLookupRequest('https://api.cert.platform.sabre.com', {
      codes: ['*A', '*O'],
    });
    // Node's URL implementation leaves `*` raw (it's a sub-delimiter, not a
    // reserved character) and percent-encodes the comma as %2C. The shape
    // matches Sabre's documented example.
    expect(req.url).toBe(
      'https://api.cert.platform.sabre.com/v1/lists/utilities/airlines/alliances?alliancecode=*A%2C*O',
    );
  });

  it('handles a base URL with a trailing slash', () => {
    const req = toLookupRequest('https://api.cert.platform.sabre.com/', { codes: ['*S'] });
    expect(req.url).toBe(
      'https://api.cert.platform.sabre.com/v1/lists/utilities/airlines/alliances?alliancecode=*S',
    );
  });
});

describe('fromLookupResponse', () => {
  it('maps a populated response into the public output shape', () => {
    const out = fromLookupResponse(
      okResponse({
        AllianceInfo: [
          {
            AllianceCode: '*O',
            AllianceName: 'oneworld',
            AirlineInfo: [{ AirlineCode: 'AA' }, { AirlineCode: 'BA' }, { AirlineCode: 'JL' }],
          },
          {
            AllianceCode: '*A',
            AllianceName: 'Star Alliance',
            AirlineInfo: [{ AirlineCode: 'UA' }, { AirlineCode: 'LH' }],
          },
        ],
      }),
    );

    expect(out.alliances).toEqual([
      {
        code: '*O',
        name: 'oneworld',
        members: [{ code: 'AA' }, { code: 'BA' }, { code: 'JL' }],
      },
      {
        code: '*A',
        name: 'Star Alliance',
        members: [{ code: 'UA' }, { code: 'LH' }],
      },
    ]);
  });

  it('returns an empty list when AllianceInfo is missing', () => {
    const out = fromLookupResponse(okResponse({}));
    expect(out.alliances).toEqual([]);
  });

  it('returns an empty members array when AirlineInfo is missing', () => {
    const out = fromLookupResponse(
      okResponse({
        AllianceInfo: [{ AllianceCode: '*S', AllianceName: 'SkyTeam' }],
      }),
    );
    expect(out.alliances).toEqual([{ code: '*S', name: 'SkyTeam', members: [] }]);
  });

  it('preserves alliances even when code or name are missing', () => {
    const out = fromLookupResponse(
      okResponse({
        AllianceInfo: [
          { AllianceCode: '*O', AllianceName: 'oneworld', AirlineInfo: [] },
          { AllianceCode: '*X' }, // missing name
          { AllianceName: 'Mystery' }, // missing code
          {}, // missing both
        ],
      }),
    );
    expect(out.alliances).toEqual([
      { code: '*O', name: 'oneworld', members: [] },
      { code: '*X', members: [] },
      { name: 'Mystery', members: [] },
      { members: [] },
    ]);
  });

  it('preserves member entries even when AirlineCode is missing', () => {
    const out = fromLookupResponse(
      okResponse({
        AllianceInfo: [
          {
            AllianceCode: '*O',
            AllianceName: 'oneworld',
            AirlineInfo: [{ AirlineCode: 'AA' }, {}, { AirlineCode: 'BA' }],
          },
        ],
      }),
    );
    expect(out.alliances[0]?.members).toEqual([{ code: 'AA' }, {}, { code: 'BA' }]);
  });

  it('throws SabreParseError when the body is not valid JSON', () => {
    const res: SabreResponse = {
      status: 200,
      statusText: 'OK',
      headers: {},
      body: '<html>not json</html>',
    };
    expect(() => fromLookupResponse(res)).toThrow(SabreParseError);
  });

  it('throws SabreParseError when the body is JSON but not an object', () => {
    expect(() => fromLookupResponse(okResponse(null))).toThrow(SabreParseError);
  });
});
