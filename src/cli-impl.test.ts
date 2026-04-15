import { describe, expect, it } from 'vitest';
import {
  COMMANDS,
  CliUsageError,
  airlinesToTableRows,
  alliancesToTableRows,
  bfmToTableRows,
  buildAirlineAllianceLookupInput,
  buildAirlineLookupInput,
  buildBfmInput,
  buildRevalidateInput,
  formatJson,
  formatTotalFare,
  normalizeBfmDateTime,
  parseCabin,
  parseOutputFormat,
  parsePassenger,
  pickNotableResponseHeaders,
  readEnvConfig,
  renderError,
  renderTable,
  resolveClientConfig,
  revalidateToTableRows,
  splitCommaList,
  summarizeLeg,
} from './cli-impl.js';
import { SabreApiResponseError } from './errors/sabre-api-response-error.js';

describe('readEnvConfig', () => {
  it('extracts only the supported keys and ignores everything else', () => {
    const out = readEnvConfig({
      SABRE_CLIENT_ID: 'id',
      SABRE_CLIENT_SECRET: 'secret',
      SABRE_BASE_URL: 'https://api.cert.platform.sabre.com',
      SABRE_COMPANY_CODE: 'TN',
      SABRE_PCC: 'ABCD',
      UNRELATED: 'ignored',
    });
    expect(out).toEqual({
      clientId: 'id',
      clientSecret: 'secret',
      baseUrl: 'https://api.cert.platform.sabre.com',
      companyCode: 'TN',
      pcc: 'ABCD',
    });
  });

  it('returns an empty config when no Sabre vars are set', () => {
    expect(readEnvConfig({})).toEqual({});
  });
});

describe('resolveClientConfig', () => {
  it('returns the resolved settings when everything is present', () => {
    const out = resolveClientConfig(
      {
        clientId: 'id',
        clientSecret: 'secret',
        baseUrl: 'https://env-base',
      },
      {},
    );
    expect(out).toEqual({
      clientId: 'id',
      clientSecret: 'secret',
      baseUrl: 'https://env-base',
    });
  });

  it('lets --base-url override SABRE_BASE_URL', () => {
    const out = resolveClientConfig(
      { clientId: 'id', clientSecret: 'secret', baseUrl: 'https://env-base' },
      { baseUrl: 'https://override' },
    );
    expect(out.baseUrl).toBe('https://override');
  });

  it('throws CliUsageError listing every missing field at once', () => {
    expect(() => resolveClientConfig({}, {})).toThrowError(CliUsageError);
    try {
      resolveClientConfig({}, {});
    } catch (err) {
      const message = (err as Error).message;
      expect(message).toContain('SABRE_CLIENT_ID');
      expect(message).toContain('SABRE_CLIENT_SECRET');
      expect(message).toContain('SABRE_BASE_URL');
    }
  });
});

describe('parseOutputFormat', () => {
  it('defaults to json when undefined', () => {
    expect(parseOutputFormat(undefined)).toBe('json');
  });

  it('accepts json and table', () => {
    expect(parseOutputFormat('json')).toBe('json');
    expect(parseOutputFormat('table')).toBe('table');
  });

  it('throws CliUsageError for unknown values', () => {
    expect(() => parseOutputFormat('xml')).toThrowError(CliUsageError);
  });
});

describe('formatJson', () => {
  it('pretty-prints with two-space indent', () => {
    expect(formatJson({ a: 1, b: [2, 3] })).toBe('{\n  "a": 1,\n  "b": [\n    2,\n    3\n  ]\n}');
  });
});

describe('renderTable', () => {
  it('renders headers, separator, and rows aligned to the widest cell per column', () => {
    const out = renderTable(
      ['code', 'name'],
      [
        ['AA', 'American'],
        ['BA', 'British Airways'],
      ],
    );
    expect(out).toBe(
      [
        'code  name           ',
        '----  ---------------',
        'AA    American       ',
        'BA    British Airways',
      ]
        .map((l) => l.trimEnd())
        .join('\n'),
    );
  });

  it('handles empty rows', () => {
    const out = renderTable(['col'], []);
    expect(out).toBe('col\n---');
  });
});

describe('airlinesToTableRows', () => {
  it('emits one row per airline with empty strings for missing fields', () => {
    const out = airlinesToTableRows({
      airlines: [
        { code: 'AI', name: 'Air India Limited', alternativeName: 'Air India' },
        { code: 'X1' },
        {},
      ],
    });
    expect(out.headers).toEqual(['code', 'name', 'alternativeName']);
    expect(out.rows).toEqual([
      ['AI', 'Air India Limited', 'Air India'],
      ['X1', '', ''],
      ['', '', ''],
    ]);
  });
});

describe('alliancesToTableRows', () => {
  it('joins members into a comma-separated cell with ? for missing codes', () => {
    const out = alliancesToTableRows({
      alliances: [
        {
          code: '*O',
          name: 'oneworld',
          members: [{ code: 'AA' }, { code: 'BA' }, {}],
        },
      ],
    });
    expect(out.rows).toEqual([['*O', 'oneworld', 'AA, BA, ?']]);
  });
});

describe('summarizeLeg', () => {
  it('renders a non-stop leg as FROM→TO (nonstop)', () => {
    expect(
      summarizeLeg({
        segments: [
          {
            departure: { airport: 'JFK', time: '21:00:00' },
            arrival: { airport: 'LHR', time: '09:00:00' },
          },
        ],
      }),
    ).toBe('JFK→LHR (nonstop)');
  });

  it('renders a one-stop leg as FROM→TO (1 stop) using first/last segment airports', () => {
    expect(
      summarizeLeg({
        segments: [
          {
            departure: { airport: 'JFK', time: '21:00:00' },
            arrival: { airport: 'CDG', time: '10:00:00' },
          },
          {
            departure: { airport: 'CDG', time: '11:30:00' },
            arrival: { airport: 'LHR', time: '12:30:00' },
          },
        ],
      }),
    ).toBe('JFK→LHR (1 stop)');
  });

  it('renders multiple connections as FROM→TO (N stops)', () => {
    expect(
      summarizeLeg({
        segments: [
          { departure: { airport: 'A', time: '01:00' }, arrival: { airport: 'B', time: '02:00' } },
          { departure: { airport: 'B', time: '03:00' }, arrival: { airport: 'C', time: '04:00' } },
          { departure: { airport: 'C', time: '05:00' }, arrival: { airport: 'D', time: '06:00' } },
        ],
      }),
    ).toBe('A→D (2 stops)');
  });

  it('renders ? for missing endpoints rather than dropping the leg', () => {
    expect(
      summarizeLeg({
        segments: [
          {
            // departure missing entirely
            arrival: { airport: 'LHR', time: '09:00:00' },
          },
        ],
      }),
    ).toBe('?→LHR (nonstop)');
  });

  it('renders an empty leg with the unresolved ref when present', () => {
    expect(summarizeLeg({ ref: 999, segments: [] })).toBe('[unresolved leg ref 999]');
    expect(summarizeLeg({ segments: [] })).toBe('[empty leg]');
  });
});

describe('formatTotalFare', () => {
  it('renders amount and currency to two decimal places', () => {
    expect(
      formatTotalFare({
        legs: [],
        fareOffers: [],
        totalFare: { totalAmount: 1806.62, currency: 'USD' },
      }),
    ).toBe('1806.62 USD');
  });

  it('renders ? when total fare is missing or has missing fields', () => {
    expect(formatTotalFare({ legs: [], fareOffers: [] })).toBe('?');
    expect(formatTotalFare({ legs: [], fareOffers: [], totalFare: { totalAmount: 100 } })).toBe(
      '?',
    );
    expect(formatTotalFare({ legs: [], fareOffers: [], totalFare: { currency: 'USD' } })).toBe('?');
  });
});

describe('bfmToTableRows', () => {
  it('renders one row per priced itinerary with id, legs, total, carrier, model', () => {
    const out = bfmToTableRows({
      itineraries: [
        {
          id: 1,
          legs: [
            {
              segments: [
                {
                  marketingCarrier: 'BA',
                  marketingFlightNumber: 178,
                  departure: { airport: 'JFK', time: '21:00:00' },
                  arrival: { airport: 'LHR', time: '09:00:00' },
                },
              ],
            },
            {
              segments: [
                {
                  marketingCarrier: 'BA',
                  marketingFlightNumber: 179,
                  departure: { airport: 'LHR', time: '12:00:00' },
                  arrival: { airport: 'CDG', time: '13:00:00' },
                },
                {
                  marketingCarrier: 'BA',
                  marketingFlightNumber: 180,
                  departure: { airport: 'CDG', time: '14:00:00' },
                  arrival: { airport: 'JFK', time: '17:00:00' },
                },
              ],
            },
          ],
          totalFare: { totalAmount: 1806.62, currency: 'USD' },
          validatingCarrierCode: 'BA',
          distributionModel: 'ATPCO',
          fareOffers: [],
        },
      ],
      messages: [],
    });
    expect(out.headers).toEqual(['id', 'legs', 'total', 'carrier', 'model']);
    expect(out.rows).toEqual([
      ['1', 'JFK→LHR (nonstop) | LHR→JFK (1 stop)', '1806.62 USD', 'BA', 'ATPCO'],
    ]);
  });

  it('preserves itineraries with missing fields by rendering ? / empty cells', () => {
    const out = bfmToTableRows({
      itineraries: [
        { legs: [], fareOffers: [] },
        { id: 2, legs: [], fareOffers: [], totalFare: { totalAmount: 100 } },
      ],
      messages: [],
    });
    expect(out.rows).toEqual([
      ['?', '', '?', '', ''],
      ['2', '', '?', '', ''],
    ]);
  });

  it('returns an empty rows array for an empty itineraries list', () => {
    const out = bfmToTableRows({ itineraries: [], messages: [] });
    expect(out.rows).toEqual([]);
  });
});

describe('splitCommaList', () => {
  it('returns undefined for undefined input', () => {
    expect(splitCommaList(undefined)).toBeUndefined();
  });

  it('returns undefined for an empty / whitespace-only list', () => {
    expect(splitCommaList('')).toBeUndefined();
    expect(splitCommaList(' , , ')).toBeUndefined();
  });

  it('trims and filters empty entries', () => {
    expect(splitCommaList(' AA , BA ,, DL ')).toEqual(['AA', 'BA', 'DL']);
  });
});

describe('parsePassenger', () => {
  it('parses TYPE:COUNT', () => {
    expect(parsePassenger('ADT:1')).toEqual({ type: 'ADT', quantity: 1 });
    expect(parsePassenger('CHD:2')).toEqual({ type: 'CHD', quantity: 2 });
  });

  it('throws on missing colon', () => {
    expect(() => parsePassenger('ADT')).toThrowError(CliUsageError);
  });

  it('throws on non-positive quantity', () => {
    expect(() => parsePassenger('ADT:0')).toThrowError(CliUsageError);
    expect(() => parsePassenger('ADT:-1')).toThrowError(CliUsageError);
    expect(() => parsePassenger('ADT:abc')).toThrowError(CliUsageError);
  });

  it('throws on extra colons', () => {
    expect(() => parsePassenger('ADT:1:2')).toThrowError(CliUsageError);
  });
});

describe('parseCabin', () => {
  it('returns undefined for undefined', () => {
    expect(parseCabin(undefined)).toBeUndefined();
  });

  it('accepts the long-form cabin names', () => {
    expect(parseCabin('Economy')).toBe('Economy');
    expect(parseCabin('Business')).toBe('Business');
    expect(parseCabin('PremiumFirst')).toBe('PremiumFirst');
  });

  it('rejects single-letter shortcuts', () => {
    expect(() => parseCabin('Y')).toThrowError(CliUsageError);
    expect(() => parseCabin('C')).toThrowError(CliUsageError);
  });

  it('rejects unknown values', () => {
    expect(() => parseCabin('SuperFirst')).toThrowError(CliUsageError);
  });
});

describe('normalizeBfmDateTime', () => {
  it('passes through the canonical YYYY-MM-DDTHH:MM:SS form unchanged', () => {
    expect(normalizeBfmDateTime('2025-12-25T06:00:00')).toBe('2025-12-25T06:00:00');
  });

  it('appends T00:00:00 to an ISO date-only value via string ops', () => {
    // String manipulation rather than going through Date — `new Date('2025-12-25')`
    // is parsed as UTC midnight per the ISO 8601 spec, which would collapse to
    // the wrong day in non-UTC timezones if we extracted local components.
    expect(normalizeBfmDateTime('2025-12-25')).toBe('2025-12-25T00:00:00');
  });

  it('normalizes a space-separated date-time to the canonical form', () => {
    expect(normalizeBfmDateTime('2025-12-25 06:00:00')).toBe('2025-12-25T06:00:00');
  });

  it('appends seconds to a HH:MM-only time component', () => {
    expect(normalizeBfmDateTime('2025-12-25T06:00')).toBe('2025-12-25T06:00:00');
  });

  it('throws CliUsageError on garbage input', () => {
    expect(() => normalizeBfmDateTime('blah 5A, R89WH')).toThrowError(CliUsageError);
    expect(() => normalizeBfmDateTime('not-a-date')).toThrowError(CliUsageError);
    expect(() => normalizeBfmDateTime('')).toThrowError(CliUsageError);
  });

  it('mentions both accepted forms in the error message for garbage', () => {
    try {
      normalizeBfmDateTime('not-a-date');
      expect.fail('expected CliUsageError');
    } catch (err) {
      const message = (err as Error).message;
      expect(message).toContain('YYYY-MM-DD');
      expect(message).toContain('YYYY-MM-DDTHH:MM:SS');
    }
  });
});

describe('buildAirlineLookupInput', () => {
  it('returns undefined when no flags are supplied', () => {
    expect(buildAirlineLookupInput({})).toBeUndefined();
  });

  it('parses --codes into a list', () => {
    expect(buildAirlineLookupInput({ codes: 'AA,BA' })).toEqual({ codes: ['AA', 'BA'] });
  });

  it('returns undefined when --codes is empty', () => {
    expect(buildAirlineLookupInput({ codes: '' })).toBeUndefined();
  });

  it('parses --body as raw JSON, ignoring --codes', () => {
    const out = buildAirlineLookupInput({
      codes: 'AA',
      body: '{"codes":["DL","UA"]}',
    });
    expect(out).toEqual({ codes: ['DL', 'UA'] });
  });
});

describe('buildAirlineAllianceLookupInput', () => {
  it('parses --codes', () => {
    expect(buildAirlineAllianceLookupInput({ codes: '*A,*O' })).toEqual({
      codes: ['*A', '*O'],
    });
  });

  it('honours --body over --codes', () => {
    const out = buildAirlineAllianceLookupInput({
      codes: '*A',
      body: '{"codes":["*S"]}',
    });
    expect(out).toEqual({ codes: ['*S'] });
  });
});

describe('buildBfmInput', () => {
  it('builds a minimal one-way input from --from / --to / --departure-date', () => {
    // Per the BFM v5 spec, only origin/destination, departure date, and a
    // passenger group are required. PseudoCityCode is optional in the OTA
    // POS structure and the CLI doesn't demand it. CompanyName.Code is
    // also spec-optional, but real-world testing showed Sabre's runtime
    // rejects requests without it, so the CLI defaults --company-code to
    // 'TN' (Sabre's Travel Network channel — what every canonical example
    // body in the spec uses, and what the working monorepo reference
    // hardcodes). Override per-call with --company-code or per-environment
    // with SABRE_COMPANY_CODE.
    const out = buildBfmInput({ from: 'JFK', to: 'LHR', 'departure-date': '2025-12-25' }, {});
    expect(out).toEqual({
      originDestinations: [{ from: 'JFK', to: 'LHR', departureDateTime: '2025-12-25T00:00:00' }],
      passengers: [{ type: 'ADT', quantity: 1 }],
      pointOfSale: { companyCode: 'TN' },
    });
  });

  it("defaults companyCode to 'TN' when neither --company-code nor SABRE_COMPANY_CODE is set", () => {
    // The library does NOT hardcode this default — `CompanyName.Code` has
    // no `default:` keyword in the spec, so the library passes it through
    // verbatim. The 'TN' default lives in the CLI specifically, where
    // ergonomic defaults are the right call. This test guards the CLI
    // behavior; the library mapper's behavior is covered by the BFM
    // mapper tests.
    const out = buildBfmInput({ from: 'JFK', to: 'LHR', 'departure-date': '2026-09-25' }, {});
    expect(out.pointOfSale.companyCode).toBe('TN');
  });

  it('adds a return leg when --return-date is supplied; both dates are normalized', () => {
    const out = buildBfmInput(
      {
        from: 'JFK',
        to: 'LHR',
        'departure-date': '2025-12-25',
        'return-date': '2026-01-05',
      },
      {},
    );
    expect(out.originDestinations).toEqual([
      { from: 'JFK', to: 'LHR', departureDateTime: '2025-12-25T00:00:00' },
      { from: 'LHR', to: 'JFK', departureDateTime: '2026-01-05T00:00:00' },
    ]);
  });

  it('passes through a canonical date-time value unchanged', () => {
    const out = buildBfmInput(
      { from: 'JFK', to: 'LHR', 'departure-date': '2025-12-25T06:00:00' },
      {},
    );
    expect(out.originDestinations[0]?.departureDateTime).toBe('2025-12-25T06:00:00');
  });

  it('throws CliUsageError when --departure-date is unparseable', () => {
    expect(() =>
      buildBfmInput({ from: 'JFK', to: 'LHR', 'departure-date': 'blah 5A, R89WH' }, {}),
    ).toThrowError(CliUsageError);
  });

  it('parses repeated --pax flags', () => {
    const out = buildBfmInput(
      {
        from: 'JFK',
        to: 'LHR',
        'departure-date': '2025-12-25',
        pax: ['ADT:2', 'CHD:1', 'INF:1'],
      },
      {},
    );
    expect(out.passengers).toEqual([
      { type: 'ADT', quantity: 2 },
      { type: 'CHD', quantity: 1 },
      { type: 'INF', quantity: 1 },
    ]);
  });

  it('translates travel preferences flags into the input', () => {
    const out = buildBfmInput(
      {
        from: 'JFK',
        to: 'LHR',
        'departure-date': '2025-12-25',
        cabin: 'Business',
        carriers: 'BA,AA',
        'non-stop': true,
      },
      {},
    );
    expect(out.travelPreferences).toEqual({
      cabin: 'Business',
      preferredCarriers: ['BA', 'AA'],
      nonStopOnly: true,
    });
  });

  it('parses --max-stops as a non-negative integer', () => {
    const out = buildBfmInput(
      {
        from: 'JFK',
        to: 'LHR',
        'departure-date': '2025-12-25',
        'max-stops': '2',
      },
      {},
    );
    expect(out.travelPreferences).toEqual({ maxStopsPerLeg: 2 });
  });

  it('rejects negative or non-integer --max-stops', () => {
    const args = { from: 'JFK', to: 'LHR', 'departure-date': '2025-12-25' };
    expect(() => buildBfmInput({ ...args, 'max-stops': '-1' }, {})).toThrowError(CliUsageError);
    expect(() => buildBfmInput({ ...args, 'max-stops': '1.5' }, {})).toThrowError(CliUsageError);
  });

  it('attaches companyCode from SABRE_COMPANY_CODE env when present', () => {
    const out = buildBfmInput(
      { from: 'JFK', to: 'LHR', 'departure-date': '2025-12-25' },
      { companyCode: 'TN' },
    );
    expect(out.pointOfSale).toEqual({ companyCode: 'TN' });
  });

  it('lets --company-code override SABRE_COMPANY_CODE', () => {
    const out = buildBfmInput(
      {
        from: 'JFK',
        to: 'LHR',
        'departure-date': '2025-12-25',
        'company-code': 'XX',
      },
      { companyCode: 'TN' },
    );
    expect(out.pointOfSale).toEqual({ companyCode: 'XX' });
  });

  it('attaches the pseudo city code on the pointOfSale when supplied', () => {
    const out = buildBfmInput(
      {
        from: 'JFK',
        to: 'LHR',
        'departure-date': '2025-12-25',
        pcc: 'ABCD',
      },
      {},
    );
    // companyCode defaults to 'TN' when no value is supplied (CLI default).
    expect(out.pointOfSale).toEqual({ companyCode: 'TN', pseudoCityCode: 'ABCD' });
  });

  it('attaches both companyCode and pcc when both are present', () => {
    const out = buildBfmInput(
      {
        from: 'JFK',
        to: 'LHR',
        'departure-date': '2025-12-25',
        'company-code': 'XX',
        pcc: 'ABCD',
      },
      {},
    );
    expect(out.pointOfSale).toEqual({ companyCode: 'XX', pseudoCityCode: 'ABCD' });
  });

  it('throws CliUsageError listing the truly required flags only', () => {
    expect(() => buildBfmInput({}, {})).toThrowError(CliUsageError);
    try {
      buildBfmInput({}, {});
    } catch (err) {
      const message = (err as Error).message;
      expect(message).toContain('--from');
      expect(message).toContain('--to');
      expect(message).toContain('--departure-date');
      // company-code is NOT required and must not appear in the missing list.
      expect(message).not.toContain('--company-code');
    }
  });

  it('honours --body and ignores other flags', () => {
    const body = JSON.stringify({
      originDestinations: [{ from: 'A', to: 'B', departureDateTime: '2025-12-25' }],
      passengers: [{ type: 'ADT', quantity: 1 }],
      pointOfSale: { companyCode: 'YY' },
    });
    const out = buildBfmInput({ from: 'JFK', to: 'LHR', 'departure-date': '2025-12-25', body }, {});
    expect(out.pointOfSale.companyCode).toBe('YY');
    expect(out.originDestinations[0]?.from).toBe('A');
  });
});

describe('buildRevalidateInput', () => {
  const minFlags = {
    from: 'JFK',
    to: 'LHR',
    'departure-date': '2025-12-25',
    carrier: 'BA',
    'flight-number': '178',
    'flight-depart': '2025-12-25T21:00:00',
    'flight-arrive': '2025-12-26T09:00:00',
  };

  it('builds a single-leg single-flight revalidation from flags', () => {
    const out = buildRevalidateInput(minFlags, {});
    expect(out.originDestinations).toHaveLength(1);
    const od = out.originDestinations[0];
    expect(od?.from).toBe('JFK');
    expect(od?.to).toBe('LHR');
    expect(od?.departureDateTime).toBe('2025-12-25T00:00:00');
    expect(od?.flights).toHaveLength(1);
    const f = od?.flights[0];
    expect(f?.marketingCarrier).toBe('BA');
    expect(f?.flightNumber).toBe(178);
    expect(f?.from).toBe('JFK');
    expect(f?.to).toBe('LHR');
  });

  it('uses --flight-from and --flight-to when provided', () => {
    const out = buildRevalidateInput({ ...minFlags, 'flight-from': 'EWR', 'flight-to': 'LGW' }, {});
    const f = out.originDestinations[0]?.flights[0];
    expect(f?.from).toBe('EWR');
    expect(f?.to).toBe('LGW');
  });

  it('includes classOfService when --class is provided', () => {
    const out = buildRevalidateInput({ ...minFlags, class: 'Y' }, {});
    expect(out.originDestinations[0]?.flights[0]?.classOfService).toBe('Y');
  });

  it('defaults passengers to ADT:1', () => {
    const out = buildRevalidateInput(minFlags, {});
    expect(out.passengers).toEqual([{ type: 'ADT', quantity: 1 }]);
  });

  it('defaults company code to TN', () => {
    const out = buildRevalidateInput(minFlags, {});
    expect(out.pointOfSale.companyCode).toBe('TN');
  });

  it('uses env company code over default', () => {
    const out = buildRevalidateInput(minFlags, { companyCode: 'XX' });
    expect(out.pointOfSale.companyCode).toBe('XX');
  });

  it('uses flag company code over env', () => {
    const out = buildRevalidateInput({ ...minFlags, 'company-code': 'ZZ' }, { companyCode: 'XX' });
    expect(out.pointOfSale.companyCode).toBe('ZZ');
  });

  it('throws for missing required flags', () => {
    expect(() => buildRevalidateInput({}, {})).toThrow(CliUsageError);
  });

  it('throws for non-integer flight number', () => {
    expect(() => buildRevalidateInput({ ...minFlags, 'flight-number': 'abc' }, {})).toThrow(
      CliUsageError,
    );
  });

  it('parses --body as JSON and returns it verbatim', () => {
    const body = JSON.stringify({
      originDestinations: [
        {
          from: 'A',
          to: 'B',
          departureDateTime: '2025-01-01T00:00:00',
          flights: [
            {
              from: 'A',
              to: 'B',
              marketingCarrier: 'XX',
              flightNumber: 1,
              departureDateTime: '2025-01-01T10:00:00',
              arrivalDateTime: '2025-01-01T14:00:00',
            },
          ],
        },
      ],
      passengers: [{ type: 'ADT', quantity: 1 }],
      pointOfSale: { companyCode: 'YY' },
    });
    const out = buildRevalidateInput({ body }, {});
    expect(out.pointOfSale.companyCode).toBe('YY');
    expect(out.originDestinations[0]?.from).toBe('A');
  });
});

describe('revalidateToTableRows', () => {
  it('renders itineraries in the same format as BFM', () => {
    const { headers, rows } = revalidateToTableRows({
      itineraries: [
        {
          id: 1,
          legs: [
            {
              segments: [
                {
                  departure: { airport: 'JFK' },
                  arrival: { airport: 'LHR' },
                },
              ],
            },
          ],
          totalFare: { totalAmount: 999, currency: 'USD' },
          validatingCarrierCode: 'BA',
          distributionModel: 'ATPCO',
          fareOffers: [],
        },
      ],
      messages: [],
    });
    expect(headers).toEqual(['id', 'legs', 'total', 'carrier', 'model']);
    expect(rows).toEqual([['1', 'JFK→LHR (nonstop)', '999.00 USD', 'BA', 'ATPCO']]);
  });
});

describe('pickNotableResponseHeaders', () => {
  it('returns an empty array when headers is undefined', () => {
    expect(pickNotableResponseHeaders(undefined)).toEqual([]);
  });

  it('returns an empty array when no notable headers are present', () => {
    expect(pickNotableResponseHeaders({ 'content-type': 'application/json' })).toEqual([]);
  });

  it('picks Retry-After regardless of header name casing', () => {
    expect(pickNotableResponseHeaders({ 'Retry-After': '60' })).toEqual([
      { name: 'Retry-After', value: '60' },
    ]);
    expect(pickNotableResponseHeaders({ 'retry-after': '60' })).toEqual([
      { name: 'retry-after', value: '60' },
    ]);
    expect(pickNotableResponseHeaders({ 'RETRY-AFTER': '60' })).toEqual([
      { name: 'RETRY-AFTER', value: '60' },
    ]);
  });

  it('returns notable headers in canonical display order, not source order', () => {
    const out = pickNotableResponseHeaders({
      'x-ratelimit-reset': '1775690000',
      'x-ratelimit-limit': '60',
      'retry-after': '120',
      'x-ratelimit-remaining': '0',
    });
    expect(out.map((h) => h.name.toLowerCase())).toEqual([
      'retry-after',
      'x-ratelimit-limit',
      'x-ratelimit-remaining',
      'x-ratelimit-reset',
    ]);
  });

  it('ignores non-notable headers like content-type and correlation ids', () => {
    const out = pickNotableResponseHeaders({
      'content-type': 'application/json',
      'x-correlation-id': 'abc-123',
      'retry-after': '30',
    });
    expect(out).toEqual([{ name: 'retry-after', value: '30' }]);
  });
});

describe('renderError for SabreApiResponseError', () => {
  // The CLI's renderError surfaces rate-limit / retry headers from
  // SabreApiResponseError when present, alongside the existing status
  // and body output. These tests use a tiny in-memory CliIo to capture
  // stderr/stdout writes.
  function makeIo(): {
    io: { stdout: { write(s: string): void }; stderr: { write(s: string): void } };
    out: string[];
    err: string[];
  } {
    const out: string[] = [];
    const err: string[] = [];
    return {
      io: {
        stdout: { write: (s: string) => out.push(s) },
        stderr: { write: (s: string) => err.push(s) },
      },
      out,
      err,
    };
  }

  it('writes status, retry-after, and body when all are present', () => {
    const { io, err } = makeIo();
    const apiErr = new SabreApiResponseError(
      'Sabre returned 429 Too Many Requests for POST https://example/v5/offers/shop',
      429,
      { error: 'rate_limited' },
      { 'retry-after': '120', 'x-ratelimit-remaining': '0' },
    );
    renderError(apiErr, io);
    const text = err.join('');
    expect(text).toContain('error: SabreApiResponseError:');
    expect(text).toContain('status: 429');
    expect(text).toContain('retry-after: 120');
    expect(text).toContain('x-ratelimit-remaining: 0');
    expect(text).toContain('rate_limited');
  });

  it('does not print any header line when none of the notable headers are present', () => {
    const { io, err } = makeIo();
    const apiErr = new SabreApiResponseError(
      'Sabre returned 400 Bad Request for POST https://example/v5/offers/shop',
      400,
      { error: 'invalid' },
      { 'content-type': 'application/json' },
    );
    renderError(apiErr, io);
    const text = err.join('');
    expect(text).toContain('status: 400');
    expect(text).not.toMatch(/retry-after/i);
    expect(text).not.toMatch(/x-ratelimit/i);
  });

  it('still works when responseHeaders is undefined', () => {
    const { io, err } = makeIo();
    const apiErr = new SabreApiResponseError(
      'Sabre returned 500 Server Error for POST https://example/v5/offers/shop',
      500,
      'oops',
      undefined,
    );
    renderError(apiErr, io);
    const text = err.join('');
    expect(text).toContain('status: 500');
    expect(text).toContain('body: oops');
  });
});

describe('COMMANDS dispatch table', () => {
  it('exposes a handler for every supported subcommand', () => {
    expect(Object.keys(COMMANDS).sort()).toEqual([
      'airline-alliance-lookup',
      'airline-lookup',
      'bargain-finder-max',
      'revalidate-itinerary',
    ]);
  });
});
