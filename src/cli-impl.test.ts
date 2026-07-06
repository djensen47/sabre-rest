import { describe, expect, it } from 'vitest';
import {
  COMMANDS,
  CliUsageError,
  airlinesToTableRows,
  alliancesToTableRows,
  availToTableRows,
  bfmToTableRows,
  buildAirlineAllianceLookupInput,
  buildAirlineLookupInput,
  buildBfmInput,
  buildBookHotelInput,
  buildCancelBookingInput,
  buildCheckTicketsInput,
  buildFulfillTicketsInput,
  buildGetAncillariesInput,
  buildGetBookingInput,
  buildHotelAvailInput,
  buildHotelContentInput,
  buildHotelPriceCheckInput,
  buildHotelSearchInput,
  buildModifyBookingInput,
  buildRefundTicketsInput,
  buildRevalidateInput,
  buildVoidTicketsInput,
  contentToTableRows,
  formatJson,
  formatTotalFare,
  hotelsToTableRows,
  normalizeBfmDateTime,
  parseCabin,
  parseOutputFormat,
  parsePassenger,
  pickNotableResponseHeaders,
  priceCheckToTableRows,
  readBookHotelCardEnv,
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

describe('buildGetAncillariesInput', () => {
  it('builds input from --order-id flag', () => {
    const out = buildGetAncillariesInput({ 'order-id': 'ORDER-123' });
    expect(out.orderId).toBe('ORDER-123');
    expect(out.segmentRefs).toBeUndefined();
    expect(out.passengerRefs).toBeUndefined();
    expect(out.groupCode).toBeUndefined();
  });

  it('includes optional filters when provided', () => {
    const out = buildGetAncillariesInput({
      'order-id': 'ORDER-123',
      'segment-refs': 'SEG-1,SEG-2',
      'passenger-refs': 'PAX-1',
      'group-code': 'BG',
    });
    expect(out.segmentRefs).toEqual(['SEG-1', 'SEG-2']);
    expect(out.passengerRefs).toEqual(['PAX-1']);
    expect(out.groupCode).toBe('BG');
  });

  it('throws for missing --order-id', () => {
    expect(() => buildGetAncillariesInput({})).toThrow(CliUsageError);
  });

  it('parses --body as JSON and returns it verbatim', () => {
    const body = JSON.stringify({ orderId: 'FROM-BODY', groupCode: 'ML' });
    const out = buildGetAncillariesInput({ body });
    expect(out.orderId).toBe('FROM-BODY');
    expect(out.groupCode).toBe('ML');
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

describe('readBookHotelCardEnv', () => {
  it('extracts all five card vars when present', () => {
    expect(
      readBookHotelCardEnv({
        SABRE_TEST_CARD_NUMBER: '4444333322221111',
        SABRE_TEST_CARD_CODE: 'VI',
        SABRE_TEST_CARD_EXPIRY_MONTH: '12',
        SABRE_TEST_CARD_EXPIRY_YEAR: '2030',
        SABRE_TEST_CARD_CVC: '123',
        UNRELATED: 'ignored',
      }),
    ).toEqual({
      cardNumber: '4444333322221111',
      cardCode: 'VI',
      cardExpiryMonth: '12',
      cardExpiryYear: '2030',
      cardCvc: '123',
    });
  });

  it('returns an empty object when no card vars are set', () => {
    expect(readBookHotelCardEnv({})).toEqual({});
  });

  it('ignores empty-string values (dotenv sometimes leaves them empty)', () => {
    expect(
      readBookHotelCardEnv({ SABRE_TEST_CARD_NUMBER: '', SABRE_TEST_CARD_CODE: 'VI' }),
    ).toEqual({ cardCode: 'VI' });
  });
});

describe('buildBookHotelInput', () => {
  const BASE_FLAGS = {
    'booking-key': 'OPAQUE-BK==',
    'first-name': 'Test',
    'last-name': 'Booking',
    phone: '817-555-1212',
    'card-number': '4444333322221111',
    'card-code': 'VI',
    'card-expiry-month': '12',
    'card-expiry-year': '2030',
    'agency-name': 'Really Trustworthy Agency',
    'agency-iata': '12345678',
    pcc: 'TM61',
    'agency-street-number': '3150 SABRE DRIVE',
    'agency-address-line': 'SABRE TRAVEL',
    'agency-city': 'SOUTHLAKE',
    'agency-country': 'US',
    'billing-address-line': ['Wadowicka 6'],
    'billing-city': 'Krakow',
    'billing-country': 'PL',
  };

  it('builds a minimal valid input from flags', () => {
    const input = buildBookHotelInput(BASE_FLAGS);
    expect(input.bookingKey).toBe('OPAQUE-BK==');
    expect(input.leadGuest).toEqual({
      firstName: 'Test',
      lastName: 'Booking',
      phone: '817-555-1212',
    });
    expect(input.agency.pcc).toBe('TM61');
    expect(input.paymentCard.cardNumber).toBe('4444333322221111');
    expect(input.paymentCard.expiryMonth).toBe(12);
    expect(input.paymentCard.billingAddress.addressLine).toEqual(['Wadowicka 6']);
  });

  it('uses env fallbacks for PCI card fields when flags are absent', () => {
    const {
      'card-number': _n,
      'card-code': _c,
      'card-expiry-month': _m,
      'card-expiry-year': _y,
      ...noCard
    } = BASE_FLAGS;
    const input = buildBookHotelInput(noCard, {
      cardNumber: '4111111111111111',
      cardCode: 'VI',
      cardExpiryMonth: '6',
      cardExpiryYear: '2028',
      cardCvc: '999',
    });
    expect(input.paymentCard.cardNumber).toBe('4111111111111111');
    expect(input.paymentCard.expiryMonth).toBe(6);
    expect(input.paymentCard.expiryYear).toBe('2028');
    expect(input.paymentCard.csc).toBe('999');
  });

  it('prefers a flag over the env fallback', () => {
    const input = buildBookHotelInput(BASE_FLAGS, { cardNumber: 'IGNORED' });
    expect(input.paymentCard.cardNumber).toBe('4444333322221111');
  });

  it('defaults cardholder name to the guest name when not supplied', () => {
    const input = buildBookHotelInput(BASE_FLAGS);
    expect(input.paymentCard.holderFirstName).toBe('Test');
    expect(input.paymentCard.holderLastName).toBe('Booking');
  });

  it('uses explicit cardholder name when supplied', () => {
    const input = buildBookHotelInput({
      ...BASE_FLAGS,
      'cardholder-first-name': 'Card',
      'cardholder-last-name': 'Holder',
    });
    expect(input.paymentCard.holderFirstName).toBe('Card');
    expect(input.paymentCard.holderLastName).toBe('Holder');
  });

  it('passes optional fields through when supplied', () => {
    const input = buildBookHotelInput({
      ...BASE_FLAGS,
      email: 'test@sabre.com',
      'agency-state': 'TX',
      'agency-postal-code': '76092',
      'agency-contact-phone': '555-000-9999',
      'billing-state': 'KR',
      'billing-postal-code': '30-415',
      'card-cvc': '123',
      'target-city': 'ABCD',
    });
    expect(input.leadGuest.email).toBe('test@sabre.com');
    expect(input.agency.address.stateCode).toBe('TX');
    expect(input.agency.address.postalCode).toBe('76092');
    expect(input.agency.contactPhone).toBe('555-000-9999');
    expect(input.paymentCard.csc).toBe('123');
    expect(input.paymentCard.billingAddress.stateCode).toBe('KR');
    expect(input.paymentCard.billingAddress.postalCode).toBe('30-415');
    expect(input.targetCity).toBe('ABCD');
  });

  it('parses --halt-on-error case-insensitively', () => {
    expect(
      buildBookHotelInput({ ...BASE_FLAGS, 'halt-on-error': 'TRUE' }).haltOnHotelBookError,
    ).toBe(true);
    expect(
      buildBookHotelInput({ ...BASE_FLAGS, 'halt-on-error': 'false' }).haltOnHotelBookError,
    ).toBe(false);
  });

  it('rejects an invalid --halt-on-error value', () => {
    expect(() => buildBookHotelInput({ ...BASE_FLAGS, 'halt-on-error': 'yes' })).toThrowError(
      CliUsageError,
    );
  });

  it('returns the parsed body verbatim when --body is supplied', () => {
    const body = JSON.stringify({ bookingKey: 'BODY', leadGuest: {} });
    expect(buildBookHotelInput({ body })).toEqual({ bookingKey: 'BODY', leadGuest: {} });
  });

  it('throws when --booking-key is missing', () => {
    const { 'booking-key': _k, ...rest } = BASE_FLAGS;
    expect(() => buildBookHotelInput(rest)).toThrowError(/booking-key/);
  });

  it('throws when card PAN is missing from both flags and env', () => {
    const { 'card-number': _n, ...rest } = BASE_FLAGS;
    expect(() => buildBookHotelInput(rest)).toThrowError(/SABRE_TEST_CARD_NUMBER/);
  });

  it('throws when card expiry month is missing', () => {
    const { 'card-expiry-month': _m, ...rest } = BASE_FLAGS;
    expect(() => buildBookHotelInput(rest)).toThrowError(/SABRE_TEST_CARD_EXPIRY_MONTH/);
  });

  it('throws when expiry month is out of range', () => {
    expect(() => buildBookHotelInput({ ...BASE_FLAGS, 'card-expiry-month': '13' })).toThrowError(
      /Invalid expiry month/,
    );
    expect(() => buildBookHotelInput({ ...BASE_FLAGS, 'card-expiry-month': '0' })).toThrowError(
      /Invalid expiry month/,
    );
    expect(() => buildBookHotelInput({ ...BASE_FLAGS, 'card-expiry-month': 'june' })).toThrowError(
      /Invalid expiry month/,
    );
  });

  it('throws when --billing-address-line is empty or missing', () => {
    const { 'billing-address-line': _a, ...rest } = BASE_FLAGS;
    expect(() => buildBookHotelInput(rest)).toThrowError(/billing-address-line/);
    expect(() => buildBookHotelInput({ ...BASE_FLAGS, 'billing-address-line': [] })).toThrowError(
      /billing-address-line/,
    );
  });

  it('throws when --pcc is missing', () => {
    const { pcc: _p, ...rest } = BASE_FLAGS;
    expect(() => buildBookHotelInput(rest)).toThrowError(/pcc/);
  });
});

describe('COMMANDS dispatch table', () => {
  it('exposes a handler for every supported subcommand', () => {
    expect(Object.keys(COMMANDS).sort()).toEqual([
      'airline-alliance-lookup',
      'airline-lookup',
      'bargain-finder-max',
      'book-hotel',
      'cancel-booking',
      'check-tickets',
      'create-booking',
      'exchange-booking',
      'flight-reshop',
      'fulfill-tickets',
      'geo-search',
      'get-ancillaries',
      'get-booking',
      'get-hotel-avail',
      'get-hotel-content',
      'get-hotel-details',
      'get-hotel-rate-info',
      'get-seats',
      'hotel-price-check',
      'hotel-search',
      'modify-booking',
      'refund-tickets',
      'revalidate-itinerary',
      'void-tickets',
    ]);
  });
});

describe('buildGetBookingInput', () => {
  it('builds input from --confirmation-id', () => {
    const out = buildGetBookingInput({ 'confirmation-id': 'GLEBNY' });
    expect(out).toEqual({ confirmationId: 'GLEBNY' });
  });

  it('forwards optional verification and filter flags', () => {
    const out = buildGetBookingInput({
      'confirmation-id': 'GLEBNY',
      'booking-source': 'SABRE_ORDER',
      'target-pcc': 'G7HE',
      'given-name': 'JOHN',
      'middle-name': 'Q',
      surname: 'DOE',
      'return-only': 'FLIGHTS,TRAVELERS',
      'unmask-payment-card-numbers': true,
    });
    expect(out.bookingSource).toBe('SABRE_ORDER');
    expect(out.targetPcc).toBe('G7HE');
    expect(out.givenName).toBe('JOHN');
    expect(out.middleName).toBe('Q');
    expect(out.surname).toBe('DOE');
    expect(out.returnOnly).toEqual(['FLIGHTS', 'TRAVELERS']);
    expect(out.unmaskPaymentCardNumbers).toBe(true);
  });

  it('throws for missing --confirmation-id', () => {
    expect(() => buildGetBookingInput({})).toThrow(CliUsageError);
  });

  it('throws for invalid --booking-source', () => {
    expect(() =>
      buildGetBookingInput({ 'confirmation-id': 'GLEBNY', 'booking-source': 'NOPE' }),
    ).toThrow(CliUsageError);
  });

  it('parses --body as JSON and returns it verbatim', () => {
    const body = JSON.stringify({ confirmationId: 'FROM-BODY', targetPcc: 'G7HE' });
    const out = buildGetBookingInput({ body });
    expect(out.confirmationId).toBe('FROM-BODY');
    expect(out.targetPcc).toBe('G7HE');
  });
});

describe('buildModifyBookingInput', () => {
  it('throws without --body', () => {
    expect(() => buildModifyBookingInput({})).toThrow(CliUsageError);
  });

  it('parses --body verbatim', () => {
    const body = JSON.stringify({
      confirmationId: 'GLEBNY',
      bookingSignature: 'sig',
      before: { remarks: [] },
      after: { remarks: [{ type: 'GENERAL', text: 'note' }] },
    });
    const out = buildModifyBookingInput({ body });
    expect(out.confirmationId).toBe('GLEBNY');
    expect(out.bookingSignature).toBe('sig');
    expect(out.after.remarks?.[0]?.text).toBe('note');
  });
});

describe('buildCancelBookingInput', () => {
  it('builds minimal input from --confirmation-id', () => {
    const out = buildCancelBookingInput({ 'confirmation-id': 'GLEBNY' });
    expect(out).toEqual({ confirmationId: 'GLEBNY' });
  });

  it('maps comma-separated item lists into per-type references', () => {
    const out = buildCancelBookingInput({
      'confirmation-id': 'GLEBNY',
      flights: '1,2',
      hotels: '3',
      cars: '4',
      trains: '5',
      cruises: '6',
    });
    expect(out.flights).toEqual([{ itemId: '1' }, { itemId: '2' }]);
    expect(out.hotels).toEqual([{ itemId: '3' }]);
    expect(out.cars).toEqual([{ itemId: '4' }]);
    expect(out.trains).toEqual([{ itemId: '5' }]);
    expect(out.cruises).toEqual([{ itemId: '6' }]);
  });

  it('forwards boolean and enum flags', () => {
    const out = buildCancelBookingInput({
      'confirmation-id': 'GLEBNY',
      'cancel-all': true,
      'retrieve-booking': true,
      'flight-ticket-operation': 'REFUND',
      'error-handling-policy': 'ALLOW_PARTIAL_CANCEL',
      'booking-source': 'SABRE',
      'target-pcc': 'G7HE',
      'received-from': 'smoke-test',
    });
    expect(out.cancelAll).toBe(true);
    expect(out.retrieveBooking).toBe(true);
    expect(out.flightTicketOperation).toBe('REFUND');
    expect(out.errorHandlingPolicy).toBe('ALLOW_PARTIAL_CANCEL');
    expect(out.bookingSource).toBe('SABRE');
    expect(out.targetPcc).toBe('G7HE');
    expect(out.receivedFrom).toBe('smoke-test');
  });

  it('throws for missing --confirmation-id', () => {
    expect(() => buildCancelBookingInput({})).toThrow(CliUsageError);
  });

  it('throws for invalid --flight-ticket-operation', () => {
    expect(() =>
      buildCancelBookingInput({
        'confirmation-id': 'GLEBNY',
        'flight-ticket-operation': 'NOPE',
      }),
    ).toThrow(CliUsageError);
  });

  it('throws for invalid --error-handling-policy', () => {
    expect(() =>
      buildCancelBookingInput({
        'confirmation-id': 'GLEBNY',
        'error-handling-policy': 'NOPE',
      }),
    ).toThrow(CliUsageError);
  });

  it('parses --body verbatim', () => {
    const body = JSON.stringify({ confirmationId: 'FROM-BODY', cancelAll: true });
    const out = buildCancelBookingInput({ body });
    expect(out.confirmationId).toBe('FROM-BODY');
    expect(out.cancelAll).toBe(true);
  });
});

describe('buildCheckTicketsInput', () => {
  it('builds minimal input from --confirmation-id', () => {
    const out = buildCheckTicketsInput({ 'confirmation-id': 'GLEBNY' });
    expect(out).toEqual({ confirmationId: 'GLEBNY' });
  });

  it('wraps comma-separated --tickets as { number } records', () => {
    const out = buildCheckTicketsInput({ tickets: '0011234567890,0011234567891' });
    expect(out.tickets).toEqual([{ number: '0011234567890' }, { number: '0011234567891' }]);
  });

  it('forwards --target-pcc', () => {
    const out = buildCheckTicketsInput({ 'confirmation-id': 'GLEBNY', 'target-pcc': 'G7HE' });
    expect(out.targetPcc).toBe('G7HE');
  });

  it('throws when neither --confirmation-id nor --tickets is supplied', () => {
    expect(() => buildCheckTicketsInput({})).toThrow(CliUsageError);
  });

  it('parses --body verbatim', () => {
    const body = JSON.stringify({ confirmationId: 'FROM-BODY', targetPcc: 'G7HE' });
    const out = buildCheckTicketsInput({ body });
    expect(out.confirmationId).toBe('FROM-BODY');
    expect(out.targetPcc).toBe('G7HE');
  });
});

describe('buildFulfillTicketsInput', () => {
  it('throws without --body', () => {
    expect(() => buildFulfillTicketsInput({})).toThrow(CliUsageError);
  });

  it('parses --body verbatim', () => {
    const body = JSON.stringify({
      confirmationId: 'GLEBNY',
      fulfillments: [{}],
      formsOfPayment: [
        {
          type: 'PAYMENTCARD',
          cardTypeCode: 'VI',
          cardNumber: '4111111111111111',
          cardSecurityCode: '123',
          expiryDate: '2027-12',
        },
      ],
    });
    const out = buildFulfillTicketsInput({ body });
    expect(out.confirmationId).toBe('GLEBNY');
    expect(out.fulfillments).toHaveLength(1);
    expect(out.formsOfPayment?.[0]?.type).toBe('PAYMENTCARD');
  });
});

describe('buildVoidTicketsInput', () => {
  it('builds minimal input from --confirmation-id', () => {
    const out = buildVoidTicketsInput({ 'confirmation-id': 'GLEBNY' });
    expect(out).toEqual({ confirmationId: 'GLEBNY' });
  });

  it('keeps --tickets as raw string numbers (not wrapped)', () => {
    const out = buildVoidTicketsInput({ tickets: '0011234567890,0011234567891' });
    expect(out.tickets).toEqual(['0011234567890', '0011234567891']);
  });

  it('forwards optional flags', () => {
    const out = buildVoidTicketsInput({
      'confirmation-id': 'GLEBNY',
      'target-pcc': 'G7HE',
      'received-from': 'smoke-test',
      'error-handling-policy': 'ALLOW_PARTIAL_CANCEL',
      'void-non-electronic-tickets': true,
    });
    expect(out.targetPcc).toBe('G7HE');
    expect(out.receivedFrom).toBe('smoke-test');
    expect(out.errorHandlingPolicy).toBe('ALLOW_PARTIAL_CANCEL');
    expect(out.voidNonElectronicTickets).toBe(true);
  });

  it('throws when neither --confirmation-id nor --tickets is supplied', () => {
    expect(() => buildVoidTicketsInput({})).toThrow(CliUsageError);
  });

  it('throws for invalid --error-handling-policy', () => {
    expect(() =>
      buildVoidTicketsInput({ 'confirmation-id': 'GLEBNY', 'error-handling-policy': 'NOPE' }),
    ).toThrow(CliUsageError);
  });

  it('parses --body verbatim', () => {
    const body = JSON.stringify({ confirmationId: 'FROM-BODY', tickets: ['001999'] });
    const out = buildVoidTicketsInput({ body });
    expect(out.confirmationId).toBe('FROM-BODY');
    expect(out.tickets).toEqual(['001999']);
  });
});

describe('buildRefundTicketsInput', () => {
  it('builds minimal input from --confirmation-id', () => {
    const out = buildRefundTicketsInput({ 'confirmation-id': 'GLEBNY' });
    expect(out).toEqual({ confirmationId: 'GLEBNY' });
  });

  it('wraps comma-separated --tickets as { number } records', () => {
    const out = buildRefundTicketsInput({ tickets: '0011234567890,0011234567891' });
    expect(out.tickets).toEqual([{ number: '0011234567890' }, { number: '0011234567891' }]);
  });

  it('forwards optional flags', () => {
    const out = buildRefundTicketsInput({
      'confirmation-id': 'GLEBNY',
      'target-pcc': 'G7HE',
      'received-from': 'smoke-test',
      'error-handling-policy': 'ALLOW_PARTIAL_CANCEL',
    });
    expect(out.targetPcc).toBe('G7HE');
    expect(out.receivedFrom).toBe('smoke-test');
    expect(out.errorHandlingPolicy).toBe('ALLOW_PARTIAL_CANCEL');
  });

  it('throws when neither --confirmation-id nor --tickets is supplied', () => {
    expect(() => buildRefundTicketsInput({})).toThrow(CliUsageError);
  });

  it('throws for invalid --error-handling-policy', () => {
    expect(() =>
      buildRefundTicketsInput({ 'confirmation-id': 'GLEBNY', 'error-handling-policy': 'NOPE' }),
    ).toThrow(CliUsageError);
  });

  it('parses --body verbatim (preserves refundQualifiers)', () => {
    const body = JSON.stringify({
      confirmationId: 'FROM-BODY',
      tickets: [{ number: '001999', refundQualifiers: { waiverCode: 'WAIVER1' } }],
    });
    const out = buildRefundTicketsInput({ body });
    expect(out.confirmationId).toBe('FROM-BODY');
    expect(out.tickets?.[0]?.refundQualifiers?.waiverCode).toBe('WAIVER1');
  });
});

describe('buildHotelSearchInput', () => {
  it('builds a GeoCode anchor with default radius and UOM', () => {
    const out = buildHotelSearchInput({ 'geo-code': '32.758,-97.08' });
    expect(out).toEqual({
      geoSearch: {
        geoRef: {
          kind: 'geoCode',
          radius: 25,
          uom: 'MI',
          latitude: 32.758,
          longitude: -97.08,
        },
      },
    });
  });

  it('builds a RefPoint anchor from TYPE:VALUE:CONTEXT', () => {
    const out = buildHotelSearchInput({
      'ref-point': '6:DFW:CODE',
      radius: '10',
      uom: 'KM',
    });
    expect(out.geoSearch.geoRef).toEqual({
      kind: 'refPoint',
      radius: 10,
      uom: 'KM',
      refPointType: '6',
      value: 'DFW',
      valueContext: 'CODE',
    });
  });

  it('builds an AddressRef anchor with optional city and state', () => {
    const out = buildHotelSearchInput({ address: 'US,Irving,TX', radius: '5' });
    expect(out.geoSearch.geoRef).toEqual({
      kind: 'addressRef',
      radius: 5,
      uom: 'MI',
      countryCode: 'US',
      city: 'Irving',
      stateProv: 'TX',
    });
  });

  it('requires exactly one anchor flag', () => {
    expect(() => buildHotelSearchInput({})).toThrowError(CliUsageError);
    expect(() =>
      buildHotelSearchInput({ 'geo-code': '1,2', 'ref-point': '6:DFW:CODE' }),
    ).toThrowError(CliUsageError);
  });

  it('rejects malformed --geo-code values', () => {
    expect(() => buildHotelSearchInput({ 'geo-code': '32.758' })).toThrowError(CliUsageError);
    expect(() => buildHotelSearchInput({ 'geo-code': '95,0' })).toThrowError(CliUsageError);
    expect(() => buildHotelSearchInput({ 'geo-code': '0,200' })).toThrowError(CliUsageError);
  });

  it('rejects malformed --ref-point values', () => {
    expect(() => buildHotelSearchInput({ 'ref-point': '99:DFW:CODE' })).toThrowError(CliUsageError);
    expect(() => buildHotelSearchInput({ 'ref-point': '6:DFW:GIBBERISH' })).toThrowError(
      CliUsageError,
    );
    expect(() => buildHotelSearchInput({ 'ref-point': '6:DFW' })).toThrowError(CliUsageError);
  });

  it('rejects invalid --uom / --radius / --max-results / --sort-by / --sort-order', () => {
    const anchor = { 'geo-code': '32.758,-97.08' };
    expect(() => buildHotelSearchInput({ ...anchor, uom: 'XX' })).toThrowError(CliUsageError);
    expect(() => buildHotelSearchInput({ ...anchor, radius: '-1' })).toThrowError(CliUsageError);
    expect(() => buildHotelSearchInput({ ...anchor, 'max-results': '0' })).toThrowError(
      CliUsageError,
    );
    expect(() => buildHotelSearchInput({ ...anchor, 'max-results': '301' })).toThrowError(
      CliUsageError,
    );
    expect(() => buildHotelSearchInput({ ...anchor, 'sort-by': 'Name' })).toThrowError(
      CliUsageError,
    );
    expect(() => buildHotelSearchInput({ ...anchor, 'sort-order': 'desc' })).toThrowError(
      CliUsageError,
    );
  });

  it('attaches optional filters, sort preferences, and POS when supplied', () => {
    const out = buildHotelSearchInput({
      'geo-code': '32.758,-97.08',
      'max-results': '50',
      'sort-by': 'SabreRating',
      'sort-order': 'DESC',
      'hotel-name': 'Regency',
      'chain-codes': 'HY,MC',
      'brand-codes': '10008',
      pcc: 'TM61',
    });
    expect(out.maxResults).toBe(50);
    expect(out.sortBy).toBe('SabreRating');
    expect(out.sortOrder).toBe('DESC');
    expect(out.hotelPref).toEqual({
      hotelName: 'Regency',
      chainCodes: ['HY', 'MC'],
      brandCodes: ['10008'],
    });
    expect(out.pos).toEqual({ pseudoCityCode: 'TM61' });
  });

  it('parses --body verbatim, ignoring all other flags', () => {
    const body = JSON.stringify({
      geoSearch: {
        geoRef: {
          kind: 'geoCode',
          radius: 1,
          uom: 'KM',
          latitude: 0,
          longitude: 0,
        },
      },
      maxResults: 5,
    });
    const out = buildHotelSearchInput({ body, 'geo-code': '99,99' });
    expect(out.maxResults).toBe(5);
    expect(out.geoSearch.geoRef.radius).toBe(1);
  });
});

describe('hotelsToTableRows', () => {
  it('renders one row per hotel with code, name, chain, distance, address', () => {
    const out = hotelsToTableRows({
      hotels: [
        {
          code: '100072188',
          codeContext: 'GLOBAL',
          name: 'Hyatt Regency Tulsa',
          chainCode: 'HY',
          distance: 23.45,
          distanceUnit: 'MI',
          location: {
            address: {
              city: { code: 'TUL', name: 'Tulsa' },
              stateProv: { code: 'OK' },
              country: { code: 'US' },
            },
          },
        },
      ],
    });
    expect(out.headers).toEqual(['code', 'name', 'chain', 'distance', 'address']);
    expect(out.rows).toEqual([
      ['100072188', 'Hyatt Regency Tulsa', 'HY', '23.45 MI', 'Tulsa, OK, US'],
    ]);
  });

  it('preserves hotels with missing optional fields as empty cells', () => {
    const out = hotelsToTableRows({
      hotels: [{ code: 'X', codeContext: 'GLOBAL' }],
    });
    expect(out.rows).toEqual([['X', '', '', '', '']]);
  });

  it('returns an empty rows list for an empty hotels array', () => {
    const out = hotelsToTableRows({ hotels: [] });
    expect(out.rows).toEqual([]);
  });
});

describe('buildHotelPriceCheckInput', () => {
  it('builds a minimum input from --rate-key', () => {
    expect(buildHotelPriceCheckInput({ 'rate-key': 'KEY==' })).toEqual({ rateKey: 'KEY==' });
  });

  it('throws CliUsageError when --rate-key is missing', () => {
    expect(() => buildHotelPriceCheckInput({})).toThrowError(CliUsageError);
  });

  it('attaches pcc and corporateNumber when supplied', () => {
    const out = buildHotelPriceCheckInput({
      'rate-key': 'KEY',
      pcc: 'TM61',
      'corporate-number': 'DK1',
    });
    expect(out.pointOfSale).toEqual({ pseudoCityCode: 'TM61' });
    expect(out.corporateNumber).toBe('DK1');
  });

  it('pairs --start-date and --end-date into stay', () => {
    const out = buildHotelPriceCheckInput({
      'rate-key': 'KEY',
      'start-date': '2026-06-20',
      'end-date': '2026-06-22',
    });
    expect(out.stay).toEqual({ startDate: '2026-06-20', endDate: '2026-06-22' });
  });

  it('rejects --start-date without --end-date (or vice versa)', () => {
    expect(() =>
      buildHotelPriceCheckInput({ 'rate-key': 'KEY', 'start-date': '2026-06-20' }),
    ).toThrowError(CliUsageError);
    expect(() =>
      buildHotelPriceCheckInput({ 'rate-key': 'KEY', 'end-date': '2026-06-22' }),
    ).toThrowError(CliUsageError);
  });

  it('parses repeated --room specs with 1-based index from flag order', () => {
    const out = buildHotelPriceCheckInput({
      'rate-key': 'KEY',
      room: ['2', '1:2:8,10'],
    });
    expect(out.rooms).toEqual([
      { index: 1, adults: 2 },
      { index: 2, adults: 1, children: 2, childAges: [8, 10] },
    ]);
  });

  it('rejects malformed --room values', () => {
    expect(() => buildHotelPriceCheckInput({ 'rate-key': 'KEY', room: [''] })).toThrowError(
      CliUsageError,
    );
    expect(() => buildHotelPriceCheckInput({ 'rate-key': 'KEY', room: ['0'] })).toThrowError(
      CliUsageError,
    );
    expect(() => buildHotelPriceCheckInput({ 'rate-key': 'KEY', room: ['2:-1'] })).toThrowError(
      CliUsageError,
    );
    expect(() => buildHotelPriceCheckInput({ 'rate-key': 'KEY', room: ['2:1:blah'] })).toThrowError(
      CliUsageError,
    );
    expect(() => buildHotelPriceCheckInput({ 'rate-key': 'KEY', room: ['1:2:3:4'] })).toThrowError(
      CliUsageError,
    );
  });

  it('parses --body verbatim, ignoring all other flags', () => {
    const body = JSON.stringify({ rateKey: 'FROM-BODY', corporateNumber: 'X' });
    const out = buildHotelPriceCheckInput({ body, 'rate-key': 'FROM-FLAG' });
    expect(out.rateKey).toBe('FROM-BODY');
    expect(out.corporateNumber).toBe('X');
  });
});

describe('priceCheckToTableRows', () => {
  it('renders a single-row summary with bookingKey, priceChange, diff, hotel, rateSource', () => {
    const out = priceCheckToTableRows({
      bookingKey: 'BK-42',
      priceChange: true,
      priceDifference: '12.02',
      currencyCode: 'AUD',
      hotel: { code: '100', codeContext: 'GLOBAL', name: 'Test Hotel' },
      rateInfo: {
        rateInfos: [{ rateSource: '100', rateKey: 'K' }],
      },
    });
    expect(out.headers).toEqual(['bookingKey', 'priceChange', 'priceDiff', 'hotel', 'rateSource']);
    expect(out.rows).toEqual([['BK-42', 'yes', '12.02 AUD', '100 — Test Hotel', '100']]);
  });

  it('renders empty cells when top-level fields are missing', () => {
    const out = priceCheckToTableRows({});
    expect(out.rows).toEqual([['', '', '', '', '']]);
  });

  it('falls back to unavailability source when no rateInfo entries exist', () => {
    const out = priceCheckToTableRows({
      bookingKey: 'BK-U',
      hotel: { code: 'X', codeContext: 'GLOBAL' },
      rateInfo: {
        unavailability: {
          sources: [{ source: '110', reason: 'filtered' }],
        },
      },
    });
    expect(out.rows[0]?.[4]).toBe('110');
  });
});

describe('buildHotelAvailInput', () => {
  const common = {
    'currency-code': 'USD',
    'start-date': '2026-06-20',
    'end-date': '2026-06-22',
  };

  it('builds a minimum geo-code body with a default single room', () => {
    const out = buildHotelAvailInput({ ...common, 'geo-code': '32.758,-97.08' });
    expect(out).toEqual({
      search: {
        kind: 'geo',
        geoRef: {
          kind: 'geoCode',
          radius: 25,
          uom: 'MI',
          latitude: 32.758,
          longitude: -97.08,
        },
      },
      rateInfoRef: {
        currencyCode: 'USD',
        bestOnly: '1',
        stayDateTimeRange: { startDate: '2026-06-20', endDate: '2026-06-22' },
        rooms: [{ index: 1, adults: 1 }],
      },
    });
  });

  it('builds a RefPoint anchor with restrict-country and custom radius/uom', () => {
    const out = buildHotelAvailInput({
      ...common,
      'ref-point': '6:DFW:CODE',
      radius: '5',
      uom: 'KM',
      'restrict-country': 'US',
    });
    expect(out.search).toEqual({
      kind: 'geo',
      geoRef: {
        kind: 'refPoint',
        radius: 5,
        uom: 'KM',
        refPointType: '6',
        value: 'DFW',
        valueContext: 'CODE',
        restrictToCountry: 'US',
      },
    });
  });

  it('builds a HotelRefs anchor from a comma list', () => {
    const out = buildHotelAvailInput({
      ...common,
      hotels: '100072188,8315',
    });
    expect(out.search).toEqual({
      kind: 'hotels',
      hotels: [{ code: '100072188' }, { code: '8315' }],
    });
  });

  it('requires exactly one anchor flag', () => {
    expect(() => buildHotelAvailInput({ ...common })).toThrowError(CliUsageError);
    expect(() => buildHotelAvailInput({ ...common, 'geo-code': '1,2', hotels: 'X' })).toThrowError(
      CliUsageError,
    );
  });

  it('requires currency + dates', () => {
    expect(() => buildHotelAvailInput({ 'geo-code': '1,2' })).toThrowError(CliUsageError);
  });

  it('parses repeated --room and rate criteria', () => {
    const out = buildHotelAvailInput({
      ...common,
      'geo-code': '1,2',
      room: ['2', '1:1:10'],
      'best-only': '4',
      'rate-sources': '100,110',
      'prepaid-qualifier': 'PrepaidOnly',
      'refundable-only': true,
      'converted-only': true,
    });
    expect(out.rateInfoRef.rooms).toEqual([
      { index: 1, adults: 2 },
      { index: 2, adults: 1, children: 1, childAges: [10] },
    ]);
    expect(out.rateInfoRef.bestOnly).toBe('4');
    expect(out.rateInfoRef.rateSource).toEqual(['100', '110']);
    expect(out.rateInfoRef.prepaidQualifier).toBe('PrepaidOnly');
    expect(out.rateInfoRef.refundableOnly).toBe(true);
    expect(out.rateInfoRef.convertedRateInfoOnly).toBe(true);
  });

  it('rejects invalid enum-like values', () => {
    expect(() =>
      buildHotelAvailInput({ ...common, 'geo-code': '1,2', 'best-only': '9' }),
    ).toThrowError(CliUsageError);
    expect(() =>
      buildHotelAvailInput({ ...common, 'geo-code': '1,2', 'prepaid-qualifier': 'XYZ' }),
    ).toThrowError(CliUsageError);
    expect(() =>
      buildHotelAvailInput({ ...common, 'geo-code': '1,2', 'sort-by': 'Name' }),
    ).toThrowError(CliUsageError);
    expect(() =>
      buildHotelAvailInput({ ...common, 'geo-code': '1,2', 'sort-order': 'asc' }),
    ).toThrowError(CliUsageError);
  });

  it('attaches criteria / hotelPref / POS / corporateNumber', () => {
    const out = buildHotelAvailInput({
      ...common,
      'geo-code': '1,2',
      'max-results': '50',
      'sort-by': 'AverageNightlyRate',
      'sort-order': 'ASC',
      'hotel-name': 'Hilton',
      'chain-codes': 'HY,MC',
      pcc: 'TM61',
      'corporate-number': 'DK1',
    });
    expect(out.criteria).toEqual({
      pageSize: 50,
      sortBy: 'AverageNightlyRate',
      sortOrder: 'ASC',
    });
    expect(out.hotelPref).toEqual({ hotelName: 'Hilton', chainCodes: ['HY', 'MC'] });
    expect(out.pointOfSale).toEqual({ pseudoCityCode: 'TM61' });
    expect(out.corporateNumber).toBe('DK1');
  });

  it('parses --body verbatim, ignoring other flags', () => {
    const body = JSON.stringify({
      search: {
        kind: 'hotels',
        hotels: [{ code: 'FROM-BODY' }],
      },
      rateInfoRef: {
        currencyCode: 'EUR',
        bestOnly: '2',
        stayDateTimeRange: { startDate: '2026-01-01', endDate: '2026-01-02' },
        rooms: [{ index: 1, adults: 1 }],
      },
    });
    const out = buildHotelAvailInput({ body, 'geo-code': '99,99', 'currency-code': 'USD' });
    expect(out.rateInfoRef.currencyCode).toBe('EUR');
    expect(out.search.kind).toBe('hotels');
  });
});

describe('availToTableRows', () => {
  it('surfaces the first ConvertedRateInfo entry into a compact row', () => {
    const out = availToTableRows({
      hotels: [
        {
          code: '100074506',
          codeContext: 'GLOBAL',
          name: 'Baymont',
          chainCode: 'BU',
          rateInfo: {
            convertedRateInfo: [
              {
                amountAfterTax: '136.66',
                currencyCode: 'USD',
                rateSource: '110',
                rateKey: 'KEY==',
              },
            ],
          },
        },
      ],
    });
    expect(out.headers).toEqual([
      'code',
      'name',
      'chain',
      'rate',
      'currency',
      'rateSource',
      'rateKey',
    ]);
    expect(out.rows).toEqual([['100074506', 'Baymont', 'BU', '136.66', 'USD', '110', 'KEY==']]);
  });

  it('falls back to RateInfo when ConvertedRateInfo is absent', () => {
    const out = availToTableRows({
      hotels: [
        {
          code: 'X',
          codeContext: 'GLOBAL',
          rateInfo: {
            rateInfo: [{ amountAfterTax: '50.00', currencyCode: 'USD', rateSource: '100' }],
          },
        },
      ],
    });
    expect(out.rows[0]?.[3]).toBe('50.00');
    expect(out.rows[0]?.[5]).toBe('100');
    expect(out.rows[0]?.[6]).toBe('');
  });

  it('renders empty cells for hotels with no rate info', () => {
    const out = availToTableRows({ hotels: [{ code: 'X', codeContext: 'GLOBAL' }] });
    expect(out.rows).toEqual([['X', '', '', '', '', '', '']]);
  });
});

describe('buildHotelContentInput', () => {
  it('builds a minimum body from --hotel-code', () => {
    const out = buildHotelContentInput({ 'hotel-code': '100072188', 'code-context': 'GLOBAL' });
    expect(out).toEqual({
      hotelRef: { code: '100072188', codeContext: 'GLOBAL' },
    });
  });

  it('omits code-context when not supplied', () => {
    const out = buildHotelContentInput({ 'hotel-code': '8315' });
    expect(out.hotelRef).toEqual({ code: '8315' });
  });

  it('requires --hotel-code (or --body)', () => {
    expect(() => buildHotelContentInput({})).toThrowError(CliUsageError);
  });

  it('rejects an invalid --code-context', () => {
    expect(() =>
      buildHotelContentInput({ 'hotel-code': '8315', 'code-context': 'BOGUS' }),
    ).toThrowError(CliUsageError);
  });

  it('attaches --pcc as pointOfSale', () => {
    const out = buildHotelContentInput({ 'hotel-code': '8315', pcc: 'TM61' });
    expect(out.pointOfSale).toEqual({ pseudoCityCode: 'TM61' });
  });

  it('builds descriptiveInfo from --with-* flags', () => {
    const out = buildHotelContentInput({
      'hotel-code': '8315',
      'with-property-info': true,
      'with-amenities': true,
      'with-descriptions': 'Dining,Facilities',
    });
    expect(out.descriptiveInfo).toEqual({
      propertyInfo: true,
      amenities: true,
      descriptions: ['Dining', 'Facilities'],
    });
  });

  it('rejects an invalid --with-descriptions value', () => {
    expect(() =>
      buildHotelContentInput({ 'hotel-code': '8315', 'with-descriptions': 'Bogus' }),
    ).toThrowError(CliUsageError);
  });

  it('omits descriptiveInfo entirely when no --with-* flag is set', () => {
    const out = buildHotelContentInput({ 'hotel-code': '8315' });
    expect(out.descriptiveInfo).toBeUndefined();
  });

  it('builds a full media request from --media-* flags', () => {
    const out = buildHotelContentInput({
      'hotel-code': '8315',
      'media-max': '10',
      'media-images': 'MEDIUM,LARGE',
      'media-panoramic': true,
      'media-videos': 'VIDEO360',
      'media-categories': '1,2',
      'media-room-type-codes': 'A1K',
      'media-languages': 'EN,FR',
      'media-additional-info': 'CAPTION',
    });
    expect(out.media).toEqual({
      maxItems: '10',
      images: ['MEDIUM', 'LARGE'],
      panoramicMedias: ['HD360'],
      videos: ['VIDEO360'],
      categories: [1, 2],
      roomTypeCodes: ['A1K'],
      languages: ['EN', 'FR'],
      additionalInfo: [{ type: 'CAPTION', value: true }],
    });
  });

  it('rejects invalid --media-images, --media-videos, --media-additional-info, --media-categories', () => {
    expect(() =>
      buildHotelContentInput({ 'hotel-code': '8315', 'media-images': 'HUGE' }),
    ).toThrowError(CliUsageError);
    expect(() =>
      buildHotelContentInput({ 'hotel-code': '8315', 'media-videos': 'BOGUS' }),
    ).toThrowError(CliUsageError);
    expect(() =>
      buildHotelContentInput({ 'hotel-code': '8315', 'media-additional-info': 'BOGUS' }),
    ).toThrowError(CliUsageError);
    expect(() =>
      buildHotelContentInput({ 'hotel-code': '8315', 'media-categories': 'abc' }),
    ).toThrowError(CliUsageError);
  });

  it('omits media entirely when no --with-media / --media-* flag is set', () => {
    const out = buildHotelContentInput({ 'hotel-code': '8315' });
    expect(out.media).toBeUndefined();
  });

  it('sets media as a bare opt-in via --with-media alone', () => {
    const out = buildHotelContentInput({ 'hotel-code': '8315', 'with-media': true });
    expect(out.media).toEqual({});
  });

  it('parses --body verbatim, ignoring other flags', () => {
    const body = JSON.stringify({ hotelRef: { code: 'FROM-BODY' } });
    const out = buildHotelContentInput({ body, 'hotel-code': 'IGNORED' });
    expect(out.hotelRef).toEqual({ code: 'FROM-BODY' });
  });
});

describe('contentToTableRows', () => {
  it('summarizes a populated hotel into one row', () => {
    const out = contentToTableRows({
      hotel: {
        info: { code: '100072188', codeContext: 'GLOBAL', hotelName: 'Hyatt', chainCode: 'HY' },
        descriptiveInfo: {
          amenities: [{ code: 15 }],
          descriptions: [{ type: 'Dining' }],
        },
        mediaInfo: {
          items: [{ id: '1', ordinal: 1, lastModifiedDate: '2024-06-28', format: 'JPG' }],
        },
      },
    });
    expect(out.headers).toEqual(['code', 'name', 'chain', 'amenities', 'descriptions', 'media']);
    expect(out.rows).toEqual([['100072188', 'Hyatt', 'HY', '1', '1', '1']]);
  });

  it('renders an empty row set when no hotel is returned', () => {
    const out = contentToTableRows({});
    expect(out.rows).toEqual([]);
  });
});
