/**
 * Implementation of the `sabre-rest` CLI.
 *
 * The CLI is a thin wrapper around the library that lets the maintainer
 * (and curious users) call services against real Sabre servers from the
 * command line. It is shipped as a `bin` in the published package and is
 * considered **provisional** — the same 0.x semver policy that applies to
 * the library applies here, so flag names and output shapes can change
 * without notice until the project reaches 1.0.
 *
 * The runnable entry point lives in `src/cli.ts`; this file exports the
 * helpers it composes so they can be unit-tested in isolation.
 */

import { type ParseArgsConfig, parseArgs } from 'node:util';
import { createOAuthV2 } from './auth/oauth-v2.js';
import { type SabreClient, createSabreClient } from './client.js';
import { SabreApiResponseError } from './errors/sabre-api-response-error.js';
import { SabreAuthenticationError } from './errors/sabre-authentication-error.js';
import { SabreError } from './errors/sabre-error.js';
import type { Middleware, SabreRequest } from './http/types.js';
import type {
  Airline,
  AirlineAlliance,
  AvailAddressRef,
  AvailGeoCodeRef,
  AvailHotel,
  AvailReferencePointRef,
  BookHotelInput,
  BookingReturnOnly,
  BookingSource,
  CabinClass,
  CancelBookingInput,
  CancelErrorPolicy,
  CancelFlightTicketOperation,
  CheckHotelPriceInput,
  CheckHotelPriceOutput,
  CheckTicketsInput,
  CreateBookingInput,
  ExchangeFlightInput,
  FlightReshopInput,
  FulfillTicketsInput,
  GeoRef,
  GetAncillariesInput,
  GetBookingInput,
  GetHotelAvailInput,
  GetHotelAvailOutput,
  GetHotelDetailsInput,
  GetHotelDetailsOutput,
  GetHotelRateInfoInput,
  GetHotelRateInfoOutput,
  GetSeatsInput,
  Hotel,
  HotelDistanceUnit,
  HotelSortBy,
  HotelSortOrder,
  ItineraryLeg,
  LookupAirlineAlliancesInput,
  LookupAirlineAlliancesOutput,
  LookupAirlinesInput,
  LookupAirlinesOutput,
  ModifyBookingInput,
  PassengerCount,
  PricedItinerary,
  RefundTicketsInput,
  RevalidateItineraryInput,
  RevalidateItineraryOutput,
  SearchBargainFinderMaxInput,
  SearchBargainFinderMaxOutput,
  SearchHotelsInput,
  SearchHotelsOutput,
  VoidTicketsInput,
} from './index.js';

// ---------------------------------------------------------------------------
// Environment configuration
// ---------------------------------------------------------------------------

/** Credentials and connection settings sourced from the environment. */
export interface CliEnvConfig {
  clientId?: string;
  clientSecret?: string;
  baseUrl?: string;
  companyCode?: string;
  pcc?: string;
}

/**
 * Reads the supported environment variables into a {@link CliEnvConfig}.
 *
 * - `SABRE_CLIENT_ID`     — required for any call (OAuth client id)
 * - `SABRE_CLIENT_SECRET` — required for any call (OAuth client secret)
 * - `SABRE_BASE_URL`      — required (e.g., `https://api.cert.platform.sabre.com`)
 * - `SABRE_COMPANY_CODE`  — optional agency code for Bargain Finder Max
 * - `SABRE_PCC`           — optional pseudo city code for BFM
 *
 * Pure: takes the env object explicitly so tests don't have to mutate
 * `process.env`.
 */
export function readEnvConfig(env: NodeJS.ProcessEnv): CliEnvConfig {
  const out: CliEnvConfig = {};
  if (env.SABRE_CLIENT_ID) out.clientId = env.SABRE_CLIENT_ID;
  if (env.SABRE_CLIENT_SECRET) out.clientSecret = env.SABRE_CLIENT_SECRET;
  if (env.SABRE_BASE_URL) out.baseUrl = env.SABRE_BASE_URL;
  if (env.SABRE_COMPANY_CODE) out.companyCode = env.SABRE_COMPANY_CODE;
  if (env.SABRE_PCC) out.pcc = env.SABRE_PCC;
  return out;
}

/** Resolved (post-flag-override) settings used to construct the client. */
export interface ResolvedClientConfig {
  clientId: string;
  clientSecret: string;
  baseUrl: string;
}

/**
 * Validates the env config plus any CLI overrides and returns the
 * settings needed to build a {@link SabreClient}. Throws a
 * {@link CliUsageError} listing every missing field at once so users
 * don't have to play whack-a-mole.
 */
export function resolveClientConfig(
  env: CliEnvConfig,
  overrides: { baseUrl?: string },
): ResolvedClientConfig {
  const baseUrl = overrides.baseUrl ?? env.baseUrl;
  const missing: string[] = [];
  if (!env.clientId) missing.push('SABRE_CLIENT_ID');
  if (!env.clientSecret) missing.push('SABRE_CLIENT_SECRET');
  if (!baseUrl) missing.push('SABRE_BASE_URL (or --base-url)');
  if (missing.length > 0) {
    throw new CliUsageError(`Missing required configuration: ${missing.join(', ')}`);
  }
  // The non-null assertions are safe: missing.length === 0 implies all the
  // checked fields are populated.
  return {
    clientId: env.clientId as string,
    clientSecret: env.clientSecret as string,
    baseUrl: baseUrl as string,
  };
}

/** Constructs the {@link SabreClient} the CLI uses for live calls. */
export function buildClient(
  config: ResolvedClientConfig,
  middleware?: readonly Middleware[],
): SabreClient {
  return createSabreClient({
    baseUrl: config.baseUrl,
    auth: createOAuthV2({
      baseUrl: config.baseUrl,
      clientId: config.clientId,
      clientSecret: config.clientSecret,
    }),
    middleware,
  });
}

/**
 * Creates a middleware that dumps the outbound {@link SabreRequest} to
 * stderr before passing it down the chain. Used by the CLI's
 * `--debug-request` flag for diagnosing what the library actually sends
 * to Sabre.
 */
export function createDebugRequestMiddleware(io: CliIo): Middleware {
  return async (req: SabreRequest, next) => {
    io.stderr.write(`${req.method} ${req.url}\n`);
    for (const [name, value] of Object.entries(req.headers)) {
      io.stderr.write(`${name}: ${value}\n`);
    }
    if (req.body !== undefined) {
      try {
        io.stderr.write(`\n${JSON.stringify(JSON.parse(req.body), null, 2)}\n\n`);
      } catch {
        io.stderr.write(`\n${req.body}\n\n`);
      }
    }
    return next(req);
  };
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/**
 * A user-facing error raised by the CLI itself (bad flags, missing
 * environment, etc.). Distinguishes from library errors so the dispatcher
 * can render it differently (no stack trace, just the message).
 */
export class CliUsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CliUsageError';
  }
}

// ---------------------------------------------------------------------------
// Output formatting
// ---------------------------------------------------------------------------

/** Output format requested via `--format`. */
export type OutputFormat = 'json' | 'table';

/**
 * Validates a `--format` value. Throws {@link CliUsageError} for unknown
 * values so the dispatcher can render the error consistently.
 */
export function parseOutputFormat(value: string | undefined): OutputFormat {
  if (value === undefined) return 'json';
  if (value === 'json' || value === 'table') return value;
  throw new CliUsageError(`Unknown --format value '${value}'. Expected 'json' or 'table'.`);
}

/** Pretty-printed JSON, two-space indent. */
export function formatJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

/**
 * Renders a plain ASCII table with column headers. Cells are
 * stringified, missing values become empty strings, columns are
 * left-aligned and padded to the widest cell. Suitable for small
 * lookup-style result sets — not for deeply nested data.
 */
export function renderTable(
  headers: readonly string[],
  rows: readonly (readonly string[])[],
): string {
  const widths = headers.map((h, i) => {
    let max = h.length;
    for (const row of rows) {
      const cell = row[i] ?? '';
      if (cell.length > max) max = cell.length;
    }
    return max;
  });
  const renderRow = (cells: readonly string[]): string =>
    cells
      .map((cell, i) => (cell ?? '').padEnd(widths[i] ?? 0))
      .join('  ')
      .trimEnd();
  const separator = widths
    .map((w) => '-'.repeat(w))
    .join('  ')
    .trimEnd();
  const lines = [renderRow(headers), separator, ...rows.map(renderRow)];
  return lines.join('\n');
}

/** Converts an Airline Lookup output into table rows. */
export function airlinesToTableRows(out: LookupAirlinesOutput): {
  headers: readonly string[];
  rows: readonly string[][];
} {
  const rows = out.airlines.map((a: Airline) => [
    a.code ?? '',
    a.name ?? '',
    a.alternativeName ?? '',
  ]);
  return { headers: ['code', 'name', 'alternativeName'], rows };
}

/** Converts an Airline Alliance Lookup output into table rows. */
export function alliancesToTableRows(out: LookupAirlineAlliancesOutput): {
  headers: readonly string[];
  rows: readonly string[][];
} {
  const rows = out.alliances.map((a: AirlineAlliance) => [
    a.code ?? '',
    a.name ?? '',
    a.members.map((m) => m.code ?? '?').join(', '),
  ]);
  return { headers: ['code', 'name', 'members'], rows };
}

/**
 * Summarizes a single itinerary leg as `FROM→TO (n stops)` for the BFM
 * table renderer. Pulls origin from the first segment's departure and
 * destination from the last segment's arrival; missing values render as
 * `?`. Stop count is `segments.length - 1`, with `nonstop` for one
 * segment, `1 stop` for two, and `N stops` thereafter.
 */
export function summarizeLeg(leg: ItineraryLeg): string {
  const segs = leg.segments;
  if (segs.length === 0) {
    return leg.ref !== undefined ? `[unresolved leg ref ${leg.ref}]` : '[empty leg]';
  }
  const first = segs[0];
  const last = segs[segs.length - 1];
  const from = first?.departure?.airport ?? '?';
  const to = last?.arrival?.airport ?? '?';
  const stops = segs.length - 1;
  const stopText = stops === 0 ? 'nonstop' : stops === 1 ? '1 stop' : `${stops} stops`;
  return `${from}→${to} (${stopText})`;
}

/**
 * Formats a {@link PricedItinerary} total fare as a single string for
 * the BFM table renderer. Returns `?` when either side is missing rather
 * than fabricating values.
 */
export function formatTotalFare(itin: PricedItinerary): string {
  const tf = itin.totalFare;
  if (tf?.totalAmount === undefined || tf.currency === undefined) return '?';
  return `${tf.totalAmount.toFixed(2)} ${tf.currency}`;
}

/**
 * Converts a Bargain Finder Max v5 output into a one-row-per-itinerary
 * summary table. Columns: id, legs (concatenated), total fare,
 * validating carrier, distribution model. Drilling deeper than the
 * summary requires `--format json`; the table is intentionally a quick
 * eyeballing tool, not a complete view.
 */
export function bfmToTableRows(out: SearchBargainFinderMaxOutput): {
  headers: readonly string[];
  rows: readonly string[][];
} {
  const rows = out.itineraries.map((itin: PricedItinerary) => [
    itin.id !== undefined ? String(itin.id) : '?',
    itin.legs.map(summarizeLeg).join(' | '),
    formatTotalFare(itin),
    itin.validatingCarrierCode ?? '',
    itin.distributionModel ?? '',
  ]);
  return { headers: ['id', 'legs', 'total', 'carrier', 'model'], rows };
}

/**
 * Converts a Hotel Search v2 output into a one-row-per-hotel summary
 * table. Columns: code, name, chain, distance (with unit), address (city,
 * state, country). Table view is a quick eyeballing tool; drilling
 * deeper requires `--format json`.
 */
export function hotelsToTableRows(out: SearchHotelsOutput): {
  headers: readonly string[];
  rows: readonly string[][];
} {
  const rows = out.hotels.map((h: Hotel) => {
    const distance =
      h.distance !== undefined
        ? `${h.distance}${h.distanceUnit !== undefined ? ` ${h.distanceUnit}` : ''}`
        : '';
    const addr = h.location?.address;
    const cityPart = addr?.city?.name ?? addr?.city?.code ?? '';
    const statePart = addr?.stateProv?.code ?? '';
    const countryPart = addr?.country?.code ?? '';
    const address = [cityPart, statePart, countryPart].filter(Boolean).join(', ');
    return [h.code, h.name ?? '', h.chainCode ?? '', distance, address];
  });
  return { headers: ['code', 'name', 'chain', 'distance', 'address'], rows };
}

/**
 * Converts a Hotel Price Check v5 output into a compact summary table.
 * Columns: bookingKey, priceChange, priceDifference, currency, hotel,
 * rateSource. Table view is a quick eyeballing tool; drilling into
 * rooms / rates / penalties requires `--format json`.
 */
export function priceCheckToTableRows(out: CheckHotelPriceOutput): {
  headers: readonly string[];
  rows: readonly string[][];
} {
  const rateSource =
    out.rateInfo?.rateInfos?.[0]?.rateSource ??
    out.rateInfo?.rooms?.[0]?.ratePlans?.[0]?.rateSource ??
    out.rateInfo?.unavailability?.sources[0]?.source ??
    '';
  const priceChange = out.priceChange === undefined ? '' : out.priceChange ? 'yes' : 'no';
  const diff =
    out.priceDifference !== undefined && out.currencyCode !== undefined
      ? `${out.priceDifference} ${out.currencyCode}`
      : (out.priceDifference ?? '');
  const hotelCell =
    out.hotel === undefined
      ? ''
      : `${out.hotel.code}${out.hotel.name !== undefined ? ` — ${out.hotel.name}` : ''}`;
  return {
    headers: ['bookingKey', 'priceChange', 'priceDiff', 'hotel', 'rateSource'],
    rows: [[out.bookingKey ?? '', priceChange, diff, hotelCell, rateSource]],
  };
}

/**
 * Converts a Get Hotel Avail v5 output into a one-row-per-hotel summary
 * table. Columns: code, name, chain, rate, currency, rateSource, rateKey.
 * Rate / source / key come from the first `ConvertedRateInfo` entry when
 * present, falling back to the first `RateInfo` entry. Drilling into
 * rooms and rate plans requires `--format json`.
 */
export function availToTableRows(out: GetHotelAvailOutput): {
  headers: readonly string[];
  rows: readonly string[][];
} {
  const rows = out.hotels.map((h: AvailHotel) => {
    const firstEntry = h.rateInfo?.convertedRateInfo?.[0] ?? h.rateInfo?.rateInfo?.[0];
    const rate = firstEntry?.amountAfterTax ?? firstEntry?.averageNightlyRate ?? '';
    const currency = firstEntry?.currencyCode ?? '';
    const rateSource = firstEntry?.rateSource ?? '';
    const rateKey = firstEntry?.rateKey ?? '';
    return [h.code, h.name ?? '', h.chainCode ?? '', rate, currency, rateSource, rateKey];
  });
  return {
    headers: ['code', 'name', 'chain', 'rate', 'currency', 'rateSource', 'rateKey'],
    rows,
  };
}

/**
 * Converts a Get Hotel Rate Info v5 output into a one-row-per-rate-entry
 * summary table. Columns: source, before-tax, after-tax, currency, rateKey
 * (truncated). Prefers `ConvertedRateInfo` entries (rateKey required by
 * the spec) and falls back to native `RateInfo` (optional rateKey).
 * Drilling into per-room rate plans requires `--format json`.
 */
export function rateInfoToTableRows(out: GetHotelRateInfoOutput): {
  headers: readonly string[];
  rows: readonly string[][];
} {
  const converted = out.hotel?.rateInfos?.convertedRateInfo ?? [];
  const native = out.hotel?.rateInfos?.rateInfo ?? [];
  const entries = converted.length > 0 ? converted : native;
  const rows = entries.map((r) => {
    const keyShort = r.rateKey.length > 32 ? `${r.rateKey.slice(0, 32)}…` : r.rateKey;
    return [
      r.rateSource,
      r.amountBeforeTax ?? '',
      r.amountAfterTax ?? '',
      r.currencyCode ?? '',
      keyShort,
    ];
  });
  return {
    headers: ['rateSource', 'beforeTax', 'afterTax', 'currency', 'rateKey'],
    rows,
  };
}

/**
 * Converts a Get Hotel Details v5 output into a one-row-per-rate-plan
 * summary table. Columns: room, rateSource, beforeTax, afterTax, currency,
 * rateKey (truncated). Flattens the room → rate-plan tree to make the
 * rate grid visible at the CLI; drilling into taxes, fees, or cancel
 * penalties requires `--format json`.
 */
export function detailsToTableRows(out: GetHotelDetailsOutput): {
  headers: readonly string[];
  rows: readonly string[][];
} {
  const rooms = out.hotel?.rooms ?? [];
  const rows = rooms.flatMap((room) =>
    room.ratePlans.map((rp) => {
      const keyShort = rp.rateKey.length > 32 ? `${rp.rateKey.slice(0, 32)}…` : rp.rateKey;
      const rate = rp.convertedRateInfo ?? rp.rateInfo;
      return [
        room.roomDescription?.name ?? room.roomType ?? String(room.roomIndex),
        rp.rateSource,
        rate?.amountBeforeTax ?? '',
        rate?.amountAfterTax ?? '',
        rate?.currencyCode ?? '',
        keyShort,
      ];
    }),
  );
  return {
    headers: ['room', 'rateSource', 'beforeTax', 'afterTax', 'currency', 'rateKey'],
    rows,
  };
}

// ---------------------------------------------------------------------------
// Common parsers
// ---------------------------------------------------------------------------

/**
 * Splits a comma-separated CLI value into a trimmed, non-empty list.
 * Returns `undefined` for `undefined` input so callers can pass it
 * straight into a builder without `if` chains.
 */
export function splitCommaList(raw: string | undefined): string[] | undefined {
  if (raw === undefined) return undefined;
  const parts = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : undefined;
}

/**
 * Parses a `TYPE:COUNT` passenger spec (e.g., `ADT:1`, `CHD:2`).
 * Throws {@link CliUsageError} on a malformed entry.
 */
export function parsePassenger(spec: string): PassengerCount {
  const [type, qtyRaw, ...extra] = spec.split(':');
  if (!type || !qtyRaw || extra.length > 0) {
    throw new CliUsageError(
      `Invalid --pax value '${spec}'. Expected format: TYPE:COUNT (e.g. ADT:1).`,
    );
  }
  const quantity = Number(qtyRaw);
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new CliUsageError(
      `Invalid --pax quantity '${qtyRaw}' in '${spec}'. Expected a positive integer.`,
    );
  }
  return { type, quantity };
}

const KNOWN_CABINS: ReadonlySet<CabinClass> = new Set([
  'PremiumFirst',
  'First',
  'PremiumBusiness',
  'Business',
  'PremiumEconomy',
  'Economy',
]);

/**
 * Default value the CLI uses for `RequestorID.CompanyName.Code` when the
 * caller doesn't supply one via `--company-code` or `SABRE_COMPANY_CODE`.
 *
 * Sabre's `'TN'` (Travel Network) channel is the right default for a
 * testing tool because it's what every canonical example body in the
 * BFM v5 spec uses, and it's what the working reference implementation
 * at `the-ai-travel-company/monorepo/tools/sabre-cli` hardcodes. The
 * library deliberately does not hardcode this — `CompanyName.Code` has
 * no `default:` keyword in the spec, so the library passes it through
 * verbatim — but the CLI is allowed to be opinionated about ergonomic
 * defaults at its boundary.
 */
const DEFAULT_BFM_COMPANY_CODE = 'TN';

/**
 * Validates a cabin class name. Accepts only the long-form names from
 * {@link CabinClass}; the single-letter Sabre shortcuts (`Y`, `C`, etc.)
 * are deliberately not exposed because they're harder to read at the
 * call site.
 */
export function parseCabin(value: string | undefined): CabinClass | undefined {
  if (value === undefined) return undefined;
  if (!KNOWN_CABINS.has(value as CabinClass)) {
    throw new CliUsageError(
      `Unknown --cabin value '${value}'. Expected one of: ${[...KNOWN_CABINS].join(', ')}.`,
    );
  }
  return value as CabinClass;
}

/**
 * Normalizes a user-supplied date or date-time into the form
 * `YYYY-MM-DDTHH:MM:SS` that Sabre's BFM v5 schema requires. Used by
 * the CLI at the boundary; the library itself never normalizes.
 *
 * Three transformation paths in order:
 *
 * 1. Already in canonical form → pass through unchanged.
 * 2. ISO date-only (`YYYY-MM-DD`) → append `T00:00:00`. This case is
 *    handled with string manipulation rather than going through
 *    `Date`, because `new Date('2025-12-25')` is parsed as **UTC**
 *    midnight per the ISO 8601 spec, which would collapse to the
 *    wrong day when extracted as local-time components in any
 *    non-UTC timezone.
 * 3. Anything else → constructed via `new Date(value)` and emitted
 *    using the user's local wall-clock components. This handles
 *    space-separated forms (`2025-12-25 06:00:00`), missing seconds
 *    (`2025-12-25T06:00`), US-locale forms (`12/25/2025`,
 *    `Dec 25 2025`), and any other shape `Date.parse` accepts.
 *    Garbage input produces an `Invalid Date` and the helper throws.
 *
 * Throws {@link CliUsageError} when the input cannot be parsed at
 * all. There is no pre-flight format check — the principle is "try
 * to transform; crash on garbage", not "validate against an allow
 * list".
 */
export function normalizeBfmDateTime(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(value)) {
    return value;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return `${value}T00:00:00`;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new CliUsageError(
      `Could not parse '${value}' as a date. Try YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS.`,
    );
  }
  const pad = (n: number): string => String(n).padStart(2, '0');
  return (
    `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}` +
    `T${pad(parsed.getHours())}:${pad(parsed.getMinutes())}:${pad(parsed.getSeconds())}`
  );
}

// ---------------------------------------------------------------------------
// Per-operation flag → input mappers
// ---------------------------------------------------------------------------

/**
 * Builds the input for `airlineLookupV1.lookup` from the CLI flags.
 * Returns `undefined` (the "all airlines" call) when neither `--codes`
 * nor `--body` is supplied.
 */
export function buildAirlineLookupInput(values: {
  codes?: string;
  body?: string;
}): LookupAirlinesInput | undefined {
  if (values.body !== undefined) {
    return JSON.parse(values.body) as LookupAirlinesInput;
  }
  const codes = splitCommaList(values.codes);
  if (codes === undefined) return undefined;
  return { codes };
}

/**
 * Builds the input for `airlineAllianceLookupV1.lookup` from the CLI
 * flags. Returns `undefined` (the "all alliances" call) when neither
 * `--codes` nor `--body` is supplied.
 */
export function buildAirlineAllianceLookupInput(values: {
  codes?: string;
  body?: string;
}): LookupAirlineAlliancesInput | undefined {
  if (values.body !== undefined) {
    return JSON.parse(values.body) as LookupAirlineAlliancesInput;
  }
  const codes = splitCommaList(values.codes);
  if (codes === undefined) return undefined;
  return { codes };
}

/** Flag set for `bargain-finder-max` (parseArgs values + repeated --pax). */
export interface BfmFlagValues {
  from?: string;
  to?: string;
  'departure-date'?: string;
  'return-date'?: string;
  pax?: string[];
  cabin?: string;
  carriers?: string;
  'non-stop'?: boolean;
  'max-stops'?: string;
  'company-code'?: string;
  pcc?: string;
  body?: string;
}

/**
 * Builds the input for `bargainFinderMaxV5.search` from the CLI flags.
 *
 * - When `--body` is supplied, it is parsed as JSON and returned
 *   verbatim; flags are ignored. (Dates inside `--body` are also not
 *   normalized — that path assumes the caller knows what they're doing
 *   and is supplying canonical Sabre format.)
 * - Otherwise `--from`, `--to`, and `--departure-date` are required to
 *   assemble a single one-way leg (or a round trip if `--return-date`
 *   is supplied). Passenger groups default to one adult (`ADT:1`) when
 *   no `--pax` is given.
 * - `--departure-date` and `--return-date` are run through
 *   {@link normalizeBfmDateTime} so friendly forms (`2025-12-25`,
 *   `2025-12-25 06:00:00`, `12/25/2025`, etc.) are accepted and
 *   converted to the `YYYY-MM-DDTHH:MM:SS` form Sabre's schema
 *   requires.
 * - `--company-code` and `--pcc` are both optional, matching the BFM v5
 *   spec which marks `RequestorID.CompanyName` and `Source.PseudoCityCode`
 *   as not required. They override the corresponding env vars when
 *   present.
 *
 * Throws {@link CliUsageError} on missing required flags, malformed
 * values, or unparseable dates.
 */
export function buildBfmInput(
  values: BfmFlagValues,
  env: CliEnvConfig,
): SearchBargainFinderMaxInput {
  if (values.body !== undefined) {
    return JSON.parse(values.body) as SearchBargainFinderMaxInput;
  }

  // Per the BFM v5 spec, only origin/destination, departure date, and at
  // least one passenger are required. CompanyName/CompanyCode and PCC are
  // both optional in the OTA POS structure, so the CLI doesn't demand
  // them either — supply them only if your account requires them.
  const missing: string[] = [];
  if (!values.from) missing.push('--from');
  if (!values.to) missing.push('--to');
  if (!values['departure-date']) missing.push('--departure-date');
  if (missing.length > 0) {
    throw new CliUsageError(
      `bargain-finder-max requires: ${missing.join(', ')}. (Or supply --body with a full JSON input.)`,
    );
  }

  const originDestinations = [
    {
      from: values.from as string,
      to: values.to as string,
      // Sabre's BFM v5 schema requires the canonical
      // YYYY-MM-DDTHH:MM:SS form with no timezone. The CLI normalizes
      // friendlier user input (date-only, US-locale forms, etc.) at
      // the boundary; the library itself never normalizes.
      departureDateTime: normalizeBfmDateTime(values['departure-date'] as string),
    },
  ];
  if (values['return-date']) {
    originDestinations.push({
      from: values.to as string,
      to: values.from as string,
      departureDateTime: normalizeBfmDateTime(values['return-date']),
    });
  }

  const passengers: PassengerCount[] = (values.pax ?? ['ADT:1']).map(parsePassenger);

  // Sabre's BFM v5 spec marks `RequestorID.CompanyName.Code` as not
  // required, but real-world testing has shown the runtime rejects
  // requests without it (with the generic "Incorrect GIR response schema
  // version used" error). The library deliberately stays spec-faithful
  // and does not hardcode this — but the CLI is allowed to be opinionated
  // about ergonomic defaults, and `'TN'` (Sabre's "Travel Network" code,
  // which every canonical example body in the spec uses and which the
  // working reference at /Users/djensen/code/the-ai-travel-company/
  // monorepo/tools/sabre-cli/src/commands/bfm-shop.ts also hardcodes)
  // is the right default for a testing tool. Override per-call with
  // `--company-code` or per-environment with `SABRE_COMPANY_CODE`.
  const pointOfSale: SearchBargainFinderMaxInput['pointOfSale'] = {};
  const companyCode = values['company-code'] ?? env.companyCode ?? DEFAULT_BFM_COMPANY_CODE;
  pointOfSale.companyCode = companyCode;
  const pcc = values.pcc ?? env.pcc;
  if (pcc) pointOfSale.pseudoCityCode = pcc;

  const input: SearchBargainFinderMaxInput = {
    originDestinations,
    passengers,
    pointOfSale,
  };

  const travelPreferences: NonNullable<SearchBargainFinderMaxInput['travelPreferences']> = {};
  const cabin = parseCabin(values.cabin);
  if (cabin !== undefined) travelPreferences.cabin = cabin;
  const carriers = splitCommaList(values.carriers);
  if (carriers !== undefined) travelPreferences.preferredCarriers = carriers;
  if (values['non-stop'] === true) travelPreferences.nonStopOnly = true;
  if (values['max-stops'] !== undefined) {
    const maxStops = Number(values['max-stops']);
    if (!Number.isInteger(maxStops) || maxStops < 0) {
      throw new CliUsageError(
        `Invalid --max-stops value '${values['max-stops']}'. Expected a non-negative integer.`,
      );
    }
    travelPreferences.maxStopsPerLeg = maxStops;
  }
  if (Object.keys(travelPreferences).length > 0) {
    input.travelPreferences = travelPreferences;
  }

  return input;
}

/** Flag set for `hotel-search`. */
export interface HotelSearchFlagValues {
  'geo-code'?: string;
  'ref-point'?: string;
  address?: string;
  radius?: string;
  uom?: string;
  'max-results'?: string;
  'sort-by'?: string;
  'sort-order'?: string;
  'hotel-name'?: string;
  'chain-codes'?: string;
  'brand-codes'?: string;
  pcc?: string;
  body?: string;
}

const HOTEL_UOMS: ReadonlySet<HotelDistanceUnit> = new Set(['MI', 'KM']);
const HOTEL_SORT_BY: ReadonlySet<HotelSortBy> = new Set([
  'TotalRate',
  'DistanceFrom',
  'SabreRating',
]);
const HOTEL_SORT_ORDER: ReadonlySet<HotelSortOrder> = new Set(['ASC', 'DESC']);
const HOTEL_REF_POINT_TYPES: ReadonlySet<string> = new Set(['5', '6', '7', '11', '16', '18', '37']);

/**
 * Builds the input for `hotelSearchV2.search` from the CLI flags.
 *
 * - When `--body` is supplied, it is parsed as JSON and returned verbatim;
 *   all other flags are ignored.
 * - Otherwise exactly one of `--geo-code`, `--ref-point`, or `--address`
 *   is required to anchor the search, plus `--radius` (default `25` when
 *   omitted) and `--uom` (default `MI`).
 * - `--geo-code` accepts `lat,lon` (e.g., `32.758,-97.08`).
 * - `--ref-point` accepts `TYPE:VALUE:CONTEXT` (e.g., `6:DFW:CODE`),
 *   where `TYPE` is an OTA code and `CONTEXT` is `CODE` or `NAME`.
 * - `--address` accepts `COUNTRY[,CITY[,STATE]]`.
 *
 * Throws {@link CliUsageError} on malformed flags or missing required ones.
 */
export function buildHotelSearchInput(values: HotelSearchFlagValues): SearchHotelsInput {
  if (values.body !== undefined) {
    return JSON.parse(values.body) as SearchHotelsInput;
  }

  const anchors = [values['geo-code'], values['ref-point'], values.address].filter(
    (v): v is string => v !== undefined,
  );
  if (anchors.length === 0) {
    throw new CliUsageError(
      'hotel-search requires one of --geo-code, --ref-point, or --address. (Or supply --body with a full JSON input.)',
    );
  }
  if (anchors.length > 1) {
    throw new CliUsageError(
      'hotel-search: --geo-code, --ref-point, and --address are mutually exclusive. Pick one.',
    );
  }

  const uom = parseHotelUom(values.uom);
  const radius = parseHotelRadius(values.radius);
  const geoRef = parseHotelGeoRef(values, radius, uom);

  const input: SearchHotelsInput = { geoSearch: { geoRef } };

  if (values['max-results'] !== undefined) {
    const n = Number(values['max-results']);
    if (!Number.isInteger(n) || n < 1 || n > 300) {
      throw new CliUsageError(
        `Invalid --max-results value '${values['max-results']}'. Expected an integer in [1, 300].`,
      );
    }
    input.maxResults = n;
  }

  if (values['sort-by'] !== undefined) {
    if (!HOTEL_SORT_BY.has(values['sort-by'] as HotelSortBy)) {
      throw new CliUsageError(
        `Invalid --sort-by value '${values['sort-by']}'. Expected one of: ${Array.from(HOTEL_SORT_BY).join(', ')}.`,
      );
    }
    input.sortBy = values['sort-by'] as HotelSortBy;
  }

  if (values['sort-order'] !== undefined) {
    if (!HOTEL_SORT_ORDER.has(values['sort-order'] as HotelSortOrder)) {
      throw new CliUsageError(
        `Invalid --sort-order value '${values['sort-order']}'. Expected ASC or DESC.`,
      );
    }
    input.sortOrder = values['sort-order'] as HotelSortOrder;
  }

  const hotelName = values['hotel-name'];
  const chainCodes = splitCommaList(values['chain-codes']);
  const brandCodes = splitCommaList(values['brand-codes']);
  if (hotelName !== undefined || chainCodes !== undefined || brandCodes !== undefined) {
    input.hotelPref = {};
    if (hotelName !== undefined) input.hotelPref.hotelName = hotelName;
    if (chainCodes !== undefined) input.hotelPref.chainCodes = chainCodes;
    if (brandCodes !== undefined) input.hotelPref.brandCodes = brandCodes;
  }

  if (values.pcc !== undefined) {
    input.pos = { pseudoCityCode: values.pcc };
  }

  return input;
}

function parseHotelUom(raw: string | undefined): HotelDistanceUnit {
  if (raw === undefined) return 'MI';
  if (!HOTEL_UOMS.has(raw as HotelDistanceUnit)) {
    throw new CliUsageError(`Invalid --uom value '${raw}'. Expected MI or KM.`);
  }
  return raw as HotelDistanceUnit;
}

function parseHotelRadius(raw: string | undefined): number {
  if (raw === undefined) return 25;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) {
    throw new CliUsageError(`Invalid --radius value '${raw}'. Expected a positive number.`);
  }
  return n;
}

function parseHotelGeoRef(
  values: HotelSearchFlagValues,
  radius: number,
  uom: HotelDistanceUnit,
): GeoRef {
  if (values['geo-code'] !== undefined) {
    const [latRaw, lonRaw, ...extra] = values['geo-code'].split(',').map((s) => s.trim());
    if (!latRaw || !lonRaw || extra.length > 0) {
      throw new CliUsageError(
        `Invalid --geo-code value '${values['geo-code']}'. Expected 'lat,lon' (e.g. 32.758,-97.08).`,
      );
    }
    const lat = Number(latRaw);
    const lon = Number(lonRaw);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
      throw new CliUsageError(`Invalid --geo-code latitude '${latRaw}'. Expected [-90, 90].`);
    }
    if (!Number.isFinite(lon) || lon < -180 || lon > 180) {
      throw new CliUsageError(`Invalid --geo-code longitude '${lonRaw}'. Expected [-180, 180].`);
    }
    return { kind: 'geoCode', radius, uom, latitude: lat, longitude: lon };
  }

  if (values['ref-point'] !== undefined) {
    const parts = values['ref-point'].split(':').map((s) => s.trim());
    if (parts.length !== 3 || parts.some((p) => p === '')) {
      throw new CliUsageError(
        `Invalid --ref-point value '${values['ref-point']}'. Expected 'TYPE:VALUE:CONTEXT' (e.g. 6:DFW:CODE).`,
      );
    }
    const [type, value, context] = parts as [string, string, string];
    if (!HOTEL_REF_POINT_TYPES.has(type)) {
      throw new CliUsageError(
        `Invalid --ref-point type '${type}'. Expected one of: ${Array.from(HOTEL_REF_POINT_TYPES).join(', ')}.`,
      );
    }
    if (context !== 'CODE' && context !== 'NAME') {
      throw new CliUsageError(`Invalid --ref-point context '${context}'. Expected CODE or NAME.`);
    }
    return {
      kind: 'refPoint',
      radius,
      uom,
      refPointType: type as '5' | '6' | '7' | '11' | '16' | '18' | '37',
      value,
      valueContext: context,
    };
  }

  // --address: COUNTRY[,CITY[,STATE]]
  const address = values.address as string;
  const parts = address.split(',').map((s) => s.trim());
  const [countryCode, city, stateProv, ...extra] = parts;
  if (!countryCode || extra.length > 0) {
    throw new CliUsageError(
      `Invalid --address value '${address}'. Expected 'COUNTRY[,CITY[,STATE]]' (e.g. US,Irving,TX).`,
    );
  }
  const out: GeoRef = { kind: 'addressRef', radius, uom, countryCode };
  if (city) out.city = city;
  if (stateProv) out.stateProv = stateProv;
  return out;
}

/** Flag set for `get-hotel-avail`. */
export interface HotelAvailFlagValues {
  'geo-code'?: string;
  'ref-point'?: string;
  address?: string;
  hotels?: string;
  radius?: string;
  uom?: string;
  'restrict-country'?: string;
  'currency-code'?: string;
  'best-only'?: string;
  'start-date'?: string;
  'end-date'?: string;
  room?: string[];
  'rate-sources'?: string;
  'prepaid-qualifier'?: string;
  'refundable-only'?: boolean;
  'converted-only'?: boolean;
  'chain-codes'?: string;
  'brand-codes'?: string;
  'hotel-name'?: string;
  'lenient-name'?: string;
  'max-results'?: string;
  'page-size'?: string;
  'sort-by'?: string;
  'sort-order'?: string;
  pcc?: string;
  'corporate-number'?: string;
  body?: string;
}

const AVAIL_SORT_BY: ReadonlySet<NonNullable<GetHotelAvailInput['criteria']>['sortBy']> = new Set([
  'NegotiatedRateAvailability',
  'DistanceFrom',
  'SabreRating',
  'AverageNightlyRate',
  'AverageNightlyRateBeforeTax',
]);

const AVAIL_PREPAID: ReadonlySet<
  NonNullable<GetHotelAvailInput['rateInfoRef']['prepaidQualifier']>
> = new Set(['IncludePrepaid', 'PrepaidOnly', 'ExcludePrepaid']);

const AVAIL_BEST_ONLY: ReadonlySet<GetHotelAvailInput['rateInfoRef']['bestOnly']> = new Set([
  '1',
  '2',
  '3',
  '4',
]);

/**
 * Builds the input for `getHotelAvailV5.getAvail` from the CLI flags.
 *
 * - `--body` wins and is parsed as JSON verbatim.
 * - Otherwise exactly one search anchor is required: `--geo-code`,
 *   `--ref-point`, `--address`, or `--hotels`. The geo anchors reuse
 *   the same formats as the hotel-search CLI.
 * - `--currency-code`, `--start-date`, `--end-date` are required.
 *   `--best-only` defaults to `1` (lowest across sources).
 * - `--room` is repeatable and accepts `ADULTS[:CHILDREN[:AGES]]`.
 *   When no `--room` is given, defaults to one room with one adult.
 */
export function buildHotelAvailInput(values: HotelAvailFlagValues): GetHotelAvailInput {
  if (values.body !== undefined) {
    return JSON.parse(values.body) as GetHotelAvailInput;
  }

  const anchorCount = [
    values['geo-code'],
    values['ref-point'],
    values.address,
    values.hotels,
  ].filter((v): v is string => v !== undefined).length;
  if (anchorCount === 0) {
    throw new CliUsageError(
      'get-hotel-avail requires one of --geo-code, --ref-point, --address, or --hotels. (Or --body.)',
    );
  }
  if (anchorCount > 1) {
    throw new CliUsageError(
      'get-hotel-avail: --geo-code, --ref-point, --address, --hotels are mutually exclusive.',
    );
  }

  const missing: string[] = [];
  if (!values['currency-code']) missing.push('--currency-code');
  if (!values['start-date']) missing.push('--start-date');
  if (!values['end-date']) missing.push('--end-date');
  if (missing.length > 0) {
    throw new CliUsageError(`get-hotel-avail requires: ${missing.join(', ')}.`);
  }

  const bestOnly = (values['best-only'] ?? '1') as GetHotelAvailInput['rateInfoRef']['bestOnly'];
  if (!AVAIL_BEST_ONLY.has(bestOnly)) {
    throw new CliUsageError(
      `Invalid --best-only value '${values['best-only']}'. Expected 1, 2, 3, or 4.`,
    );
  }

  const uom = parseHotelUom(values.uom);
  const radius = parseHotelRadius(values.radius);
  const search = parseHotelAvailAnchor(values, radius, uom);

  const rooms: GetHotelAvailInput['rateInfoRef']['rooms'] =
    values.room !== undefined && values.room.length > 0
      ? values.room.map((spec, i) => parseHotelRoomSpec(spec, i + 1))
      : [{ index: 1, adults: 1 }];

  const rateInfoRef: GetHotelAvailInput['rateInfoRef'] = {
    currencyCode: values['currency-code'] as string,
    bestOnly,
    stayDateTimeRange: {
      startDate: values['start-date'] as string,
      endDate: values['end-date'] as string,
    },
    rooms,
  };
  if (values['prepaid-qualifier'] !== undefined) {
    if (!AVAIL_PREPAID.has(values['prepaid-qualifier'] as never)) {
      throw new CliUsageError(
        `Invalid --prepaid-qualifier value '${values['prepaid-qualifier']}'. Expected IncludePrepaid, PrepaidOnly, or ExcludePrepaid.`,
      );
    }
    rateInfoRef.prepaidQualifier = values['prepaid-qualifier'] as NonNullable<
      typeof rateInfoRef.prepaidQualifier
    >;
  }
  if (values['refundable-only'] !== undefined)
    rateInfoRef.refundableOnly = values['refundable-only'];
  if (values['converted-only'] !== undefined)
    rateInfoRef.convertedRateInfoOnly = values['converted-only'];
  const rateSources = splitCommaList(values['rate-sources']);
  if (rateSources !== undefined) rateInfoRef.rateSource = rateSources;

  const input: GetHotelAvailInput = { search, rateInfoRef };

  const criteria: NonNullable<GetHotelAvailInput['criteria']> = {};
  if (values['max-results'] !== undefined) {
    const n = Number(values['max-results']);
    if (!Number.isInteger(n) || n < 1 || n > 200) {
      throw new CliUsageError(
        `Invalid --max-results value '${values['max-results']}'. Expected an integer in [1, 200].`,
      );
    }
    criteria.pageSize = n;
  } else if (values['page-size'] !== undefined) {
    const n = Number(values['page-size']);
    if (!Number.isInteger(n) || n < 1 || n > 200) {
      throw new CliUsageError(
        `Invalid --page-size value '${values['page-size']}'. Expected an integer in [1, 200].`,
      );
    }
    criteria.pageSize = n;
  }
  if (values['sort-by'] !== undefined) {
    if (!AVAIL_SORT_BY.has(values['sort-by'] as never)) {
      throw new CliUsageError(
        `Invalid --sort-by value '${values['sort-by']}'. Expected one of: ${Array.from(AVAIL_SORT_BY).join(', ')}.`,
      );
    }
    criteria.sortBy = values['sort-by'] as NonNullable<typeof criteria.sortBy>;
  }
  if (values['sort-order'] !== undefined) {
    if (values['sort-order'] !== 'ASC' && values['sort-order'] !== 'DESC') {
      throw new CliUsageError(
        `Invalid --sort-order value '${values['sort-order']}'. Expected ASC or DESC.`,
      );
    }
    criteria.sortOrder = values['sort-order'];
  }
  if (Object.keys(criteria).length > 0) input.criteria = criteria;

  const hotelName = values['hotel-name'];
  const lenientName = values['lenient-name'];
  const chainCodes = splitCommaList(values['chain-codes']);
  const brandCodes = splitCommaList(values['brand-codes']);
  if (
    hotelName !== undefined ||
    lenientName !== undefined ||
    chainCodes !== undefined ||
    brandCodes !== undefined
  ) {
    input.hotelPref = {};
    if (hotelName !== undefined) input.hotelPref.hotelName = hotelName;
    if (lenientName !== undefined) input.hotelPref.lenientHotelName = lenientName;
    if (chainCodes !== undefined) input.hotelPref.chainCodes = chainCodes;
    if (brandCodes !== undefined) input.hotelPref.brandCodes = brandCodes;
  }

  if (values.pcc !== undefined) input.pointOfSale = { pseudoCityCode: values.pcc };
  if (values['corporate-number'] !== undefined) input.corporateNumber = values['corporate-number'];

  return input;
}

function parseHotelAvailAnchor(
  values: HotelAvailFlagValues,
  radius: number,
  uom: 'MI' | 'KM',
): GetHotelAvailInput['search'] {
  if (values.hotels !== undefined) {
    const hotels = splitCommaList(values.hotels);
    if (hotels === undefined) {
      throw new CliUsageError('Invalid --hotels value. Expected a comma-separated list of codes.');
    }
    return {
      kind: 'hotels',
      hotels: hotels.map((code) => ({ code })),
    };
  }
  if (values['geo-code'] !== undefined) {
    const [latRaw, lonRaw, ...extra] = values['geo-code'].split(',').map((s) => s.trim());
    if (!latRaw || !lonRaw || extra.length > 0) {
      throw new CliUsageError(
        `Invalid --geo-code value '${values['geo-code']}'. Expected 'lat,lon'.`,
      );
    }
    const lat = Number(latRaw);
    const lon = Number(lonRaw);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
      throw new CliUsageError(`Invalid --geo-code latitude '${latRaw}'.`);
    }
    if (!Number.isFinite(lon) || lon < -180 || lon > 180) {
      throw new CliUsageError(`Invalid --geo-code longitude '${lonRaw}'.`);
    }
    const geoRef: AvailGeoCodeRef = {
      kind: 'geoCode',
      radius,
      uom,
      latitude: lat,
      longitude: lon,
    };
    if (values['restrict-country'] !== undefined)
      geoRef.restrictToCountry = values['restrict-country'];
    return { kind: 'geo', geoRef };
  }
  if (values['ref-point'] !== undefined) {
    const parts = values['ref-point'].split(':').map((s) => s.trim());
    if (parts.length !== 3 || parts.some((p) => p === '')) {
      throw new CliUsageError(
        `Invalid --ref-point value '${values['ref-point']}'. Expected 'TYPE:VALUE:CONTEXT'.`,
      );
    }
    const [type, value, context] = parts as [string, string, string];
    if (!['5', '6', '7', '11', '16', '18', '37'].includes(type)) {
      throw new CliUsageError(`Invalid --ref-point type '${type}'.`);
    }
    if (context !== 'CODE' && context !== 'NAME') {
      throw new CliUsageError(`Invalid --ref-point context '${context}'. Expected CODE or NAME.`);
    }
    const rp: AvailReferencePointRef = {
      kind: 'refPoint',
      radius,
      uom,
      refPointType: type as '5' | '6' | '7' | '11' | '16' | '18' | '37',
      value,
      valueContext: context,
    };
    if (values['restrict-country'] !== undefined) rp.restrictToCountry = values['restrict-country'];
    return { kind: 'geo', geoRef: rp };
  }
  // --address
  const address = values.address as string;
  const parts = address.split(',').map((s) => s.trim());
  const [countryCode, city, stateProv, ...extra] = parts;
  if (!countryCode || extra.length > 0) {
    throw new CliUsageError(
      `Invalid --address value '${address}'. Expected 'COUNTRY[,CITY[,STATE]]'.`,
    );
  }
  const geoRef: AvailAddressRef = {
    kind: 'addressRef',
    radius,
    uom,
    countryCode,
  };
  if (city) geoRef.city = city;
  if (stateProv) geoRef.stateProv = stateProv;
  if (values['restrict-country'] !== undefined)
    geoRef.restrictToCountry = values['restrict-country'];
  return { kind: 'geo', geoRef };
}

/** Flag set for `get-hotel-rate-info`. */
export interface HotelRateInfoFlagValues {
  'hotel-code'?: string;
  'code-context'?: string;
  'rate-key'?: string;
  'start-date'?: string;
  'end-date'?: string;
  'currency-code'?: string;
  language?: string;
  room?: string[];
  'prepaid-qualifier'?: string;
  'refundable-only'?: boolean;
  'converted-only'?: boolean;
  'exact-match-only'?: boolean;
  'rate-sources'?: string;
  'sort-by'?: string;
  'sort-order'?: string;
  pcc?: string;
  'corporate-number'?: string;
  body?: string;
}

const RATE_INFO_SORT_BY = new Set([
  'AverageNightlyRateBeforeTax',
  'NightlyRate',
  'RateSource',
  'CommissionableRates',
  'Refundability',
  'CommissionPercentage',
  'AccessibleRates',
  'CancellationPenaltyDeadline',
  'NegotiatedRates',
  'PrepaidRates',
  'PostpaidRates',
] as const);

const RATE_INFO_PREPAID: ReadonlySet<'IncludePrepaid' | 'PrepaidOnly' | 'ExcludePrepaid'> = new Set(
  ['IncludePrepaid', 'PrepaidOnly', 'ExcludePrepaid'],
);

/**
 * Builds the input for `getHotelRateInfoV5.getRateInfo` from the CLI flags.
 *
 * Two mutually exclusive flows (matching Sabre's `oneOf`):
 *   - hotel-ref flow — `--hotel-code` + `--start-date` + `--end-date`
 *     launches a fresh rate shop with full criteria.
 *   - rate-key flow — `--rate-key` re-runs a prior search by its opaque
 *     key, with optional refinements (`--refundable-only`,
 *     `--converted-only`, `--exact-match-only`, `--rate-sources`, etc.).
 *
 * `--body` overrides both and is parsed as JSON verbatim.
 */
export function buildHotelRateInfoInput(values: HotelRateInfoFlagValues): GetHotelRateInfoInput {
  if (values.body !== undefined) {
    return JSON.parse(values.body) as GetHotelRateInfoInput;
  }

  const hasHotelCode = values['hotel-code'] !== undefined;
  const hasRateKey = values['rate-key'] !== undefined;
  if (hasHotelCode && hasRateKey) {
    throw new CliUsageError(
      'get-hotel-rate-info: --hotel-code and --rate-key are mutually exclusive.',
    );
  }
  if (!hasHotelCode && !hasRateKey) {
    throw new CliUsageError(
      'get-hotel-rate-info requires either --hotel-code (with --start-date/--end-date) or --rate-key. (Or --body.)',
    );
  }

  if (hasRateKey) {
    const out: Extract<GetHotelRateInfoInput, { kind: 'rate-key' }> = {
      kind: 'rate-key',
      rateKey: values['rate-key'] as string,
    };
    if (values.pcc !== undefined) out.pointOfSale = { pseudoCityCode: values.pcc };
    if (values['prepaid-qualifier'] !== undefined) {
      if (!RATE_INFO_PREPAID.has(values['prepaid-qualifier'] as never)) {
        throw new CliUsageError(
          `Invalid --prepaid-qualifier value '${values['prepaid-qualifier']}'. Expected IncludePrepaid, PrepaidOnly, or ExcludePrepaid.`,
        );
      }
      out.prepaidQualifier = values['prepaid-qualifier'] as NonNullable<
        typeof out.prepaidQualifier
      >;
    }
    if (values['refundable-only'] !== undefined) out.refundableOnly = values['refundable-only'];
    if (values['converted-only'] !== undefined) {
      out.convertedRateInfoOnly = values['converted-only'];
    }
    if (values['exact-match-only'] !== undefined) {
      out.exactMatchOnly = values['exact-match-only'];
    }
    const rateSources = splitCommaList(values['rate-sources']);
    if (rateSources !== undefined) out.rateSource = rateSources;
    return out;
  }

  // hotel-ref flow
  const missing: string[] = [];
  if (!values['start-date']) missing.push('--start-date');
  if (!values['end-date']) missing.push('--end-date');
  if (missing.length > 0) {
    throw new CliUsageError(
      `get-hotel-rate-info (--hotel-code flow) requires: ${missing.join(', ')}.`,
    );
  }

  const codeContext = values['code-context'];
  if (codeContext !== undefined && codeContext !== 'SABRE' && codeContext !== 'GLOBAL') {
    throw new CliUsageError(
      `Invalid --code-context value '${codeContext}'. Expected SABRE or GLOBAL.`,
    );
  }

  const rooms: Extract<GetHotelRateInfoInput, { kind: 'hotel-ref' }>['rateCriteria']['rooms'] =
    values.room !== undefined && values.room.length > 0
      ? values.room.map((spec, i) => parseHotelRoomSpec(spec, i + 1))
      : [{ index: 1, adults: 1 }];

  const rateCriteria: Extract<GetHotelRateInfoInput, { kind: 'hotel-ref' }>['rateCriteria'] = {
    stayDateTimeRange: {
      startDate: values['start-date'] as string,
      endDate: values['end-date'] as string,
    },
    rooms,
  };

  if (values['currency-code'] !== undefined) rateCriteria.currencyCode = values['currency-code'];
  if (values.language !== undefined) rateCriteria.languageCode = values.language;
  if (values['prepaid-qualifier'] !== undefined) {
    if (!RATE_INFO_PREPAID.has(values['prepaid-qualifier'] as never)) {
      throw new CliUsageError(
        `Invalid --prepaid-qualifier value '${values['prepaid-qualifier']}'. Expected IncludePrepaid, PrepaidOnly, or ExcludePrepaid.`,
      );
    }
    rateCriteria.prepaidQualifier = values['prepaid-qualifier'] as NonNullable<
      typeof rateCriteria.prepaidQualifier
    >;
  }
  if (values['refundable-only'] !== undefined) {
    rateCriteria.refundableOnly = values['refundable-only'];
  }
  if (values['converted-only'] !== undefined) {
    rateCriteria.convertedRateInfoOnly = values['converted-only'];
  }
  const rateSources = splitCommaList(values['rate-sources']);
  if (rateSources !== undefined) rateCriteria.rateSource = rateSources;
  if (values['sort-by'] !== undefined) {
    if (!RATE_INFO_SORT_BY.has(values['sort-by'] as never)) {
      throw new CliUsageError(
        `Invalid --sort-by value '${values['sort-by']}'. Expected one of: ${Array.from(
          RATE_INFO_SORT_BY,
        ).join(', ')}.`,
      );
    }
    rateCriteria.sortBy = values['sort-by'] as NonNullable<typeof rateCriteria.sortBy>;
  }
  if (values['sort-order'] !== undefined) {
    if (values['sort-order'] !== 'ASC' && values['sort-order'] !== 'DESC') {
      throw new CliUsageError(
        `Invalid --sort-order value '${values['sort-order']}'. Expected ASC or DESC.`,
      );
    }
    rateCriteria.sortOrder = values['sort-order'];
  }

  const input: Extract<GetHotelRateInfoInput, { kind: 'hotel-ref' }> = {
    kind: 'hotel-ref',
    hotelRef:
      codeContext === undefined
        ? { code: values['hotel-code'] as string }
        : { code: values['hotel-code'] as string, codeContext },
    rateCriteria,
  };
  if (values.pcc !== undefined) input.pointOfSale = { pseudoCityCode: values.pcc };
  if (values['corporate-number'] !== undefined) {
    input.corporateNumber = values['corporate-number'];
  }
  return input;
}

/** Flag set for `get-hotel-details`. */
export interface HotelDetailsFlagValues {
  'hotel-code'?: string;
  'code-context'?: string;
  'rate-key'?: string;
  'start-date'?: string;
  'end-date'?: string;
  'currency-code'?: string;
  room?: string[];
  'prepaid-qualifier'?: string;
  'refundable-only'?: boolean;
  'converted-only'?: boolean;
  'exact-match-only'?: boolean;
  'rate-sources'?: string;
  'sort-by'?: string;
  'sort-order'?: string;
  pcc?: string;
  'corporate-number'?: string;
  'shop-key'?: string;
  'with-property-info'?: boolean;
  'with-location'?: boolean;
  'with-amenities'?: boolean;
  'with-security'?: boolean;
  'with-sustainability'?: boolean;
  'with-descriptions'?: string;
  'with-media'?: boolean;
  'media-images'?: string;
  'media-max'?: string;
  body?: string;
}

const DETAILS_DESCRIPTION_TYPES = new Set([
  'ShortDescription',
  'Dining',
  'Facilities',
  'Recreation',
  'Services',
  'Attractions',
  'CancellationPolicy',
  'DepositPolicy',
  'Directions',
  'Policies',
  'SafetyInfo',
  'TransportationInfo',
  'GuaranteePolicy',
] as const);

const DETAILS_IMAGE_SIZES = new Set(['ORIGINAL', 'THUMBNAIL', 'SMALL', 'MEDIUM', 'LARGE'] as const);

/**
 * Builds the input for `getHotelDetailsV5.getDetails` from the CLI flags.
 *
 * Two mutually exclusive flows (matching Sabre's `oneOf`):
 *   - hotel-ref flow — `--hotel-code` + `--start-date` + `--end-date`
 *     launches a fresh rate shop with full criteria.
 *   - rate-key flow — `--rate-key` re-runs a prior search by its opaque
 *     key, with optional refinements.
 *
 * Both flows accept the `--with-*` flags to opt into descriptive and
 * media content in the response. `--body` overrides everything.
 */
export function buildHotelDetailsInput(values: HotelDetailsFlagValues): GetHotelDetailsInput {
  if (values.body !== undefined) {
    return JSON.parse(values.body) as GetHotelDetailsInput;
  }

  const hasHotelCode = values['hotel-code'] !== undefined;
  const hasRateKey = values['rate-key'] !== undefined;
  if (hasHotelCode && hasRateKey) {
    throw new CliUsageError(
      'get-hotel-details: --hotel-code and --rate-key are mutually exclusive.',
    );
  }
  if (!hasHotelCode && !hasRateKey) {
    throw new CliUsageError(
      'get-hotel-details requires either --hotel-code (with --start-date/--end-date) or --rate-key. (Or --body.)',
    );
  }

  const contentRef = buildDetailsContentRef(values);

  if (hasRateKey) {
    const out: Extract<GetHotelDetailsInput, { kind: 'rate-key' }> = {
      kind: 'rate-key',
      rateKey: values['rate-key'] as string,
    };
    if (values.pcc !== undefined) out.pointOfSale = { pseudoCityCode: values.pcc };
    if (values['corporate-number'] !== undefined) {
      out.corporateNumber = values['corporate-number'];
    }
    if (values['prepaid-qualifier'] !== undefined) {
      if (!RATE_INFO_PREPAID.has(values['prepaid-qualifier'] as never)) {
        throw new CliUsageError(
          `Invalid --prepaid-qualifier value '${values['prepaid-qualifier']}'. Expected IncludePrepaid, PrepaidOnly, or ExcludePrepaid.`,
        );
      }
      out.prepaidQualifier = values['prepaid-qualifier'] as NonNullable<
        typeof out.prepaidQualifier
      >;
    }
    if (values['refundable-only'] !== undefined) out.refundableOnly = values['refundable-only'];
    if (values['converted-only'] !== undefined) {
      out.convertedRateInfoOnly = values['converted-only'];
    }
    if (values['exact-match-only'] !== undefined) {
      out.exactMatchOnly = values['exact-match-only'];
    }
    if (values['shop-key'] !== undefined) out.shopKey = values['shop-key'];
    const rateSources = splitCommaList(values['rate-sources']);
    if (rateSources !== undefined) out.rateSource = rateSources;
    if (values['sort-order'] !== undefined) {
      if (values['sort-order'] !== 'ASC' && values['sort-order'] !== 'DESC') {
        throw new CliUsageError(
          `Invalid --sort-order value '${values['sort-order']}'. Expected ASC or DESC.`,
        );
      }
      out.sortOrder = values['sort-order'];
    }
    if (values['sort-by'] !== undefined) out.sortBy = values['sort-by'];
    if (contentRef !== undefined) out.contentRef = contentRef;
    return out;
  }

  // hotel-ref flow
  const missing: string[] = [];
  if (!values['start-date']) missing.push('--start-date');
  if (!values['end-date']) missing.push('--end-date');
  if (missing.length > 0) {
    throw new CliUsageError(
      `get-hotel-details (--hotel-code flow) requires: ${missing.join(', ')}.`,
    );
  }

  const codeContext = values['code-context'];
  if (codeContext !== undefined && codeContext !== 'SABRE' && codeContext !== 'GLOBAL') {
    throw new CliUsageError(
      `Invalid --code-context value '${codeContext}'. Expected SABRE or GLOBAL.`,
    );
  }

  const rooms: Extract<GetHotelDetailsInput, { kind: 'hotel-ref' }>['rateCriteria']['rooms'] =
    values.room !== undefined && values.room.length > 0
      ? values.room.map((spec, i) => parseHotelRoomSpec(spec, i + 1))
      : [{ index: 1, adults: 1 }];

  const rateCriteria: Extract<GetHotelDetailsInput, { kind: 'hotel-ref' }>['rateCriteria'] = {
    stayDateTimeRange: {
      startDate: values['start-date'] as string,
      endDate: values['end-date'] as string,
    },
    rooms,
  };

  if (values['currency-code'] !== undefined) rateCriteria.currencyCode = values['currency-code'];
  if (values['prepaid-qualifier'] !== undefined) {
    if (!RATE_INFO_PREPAID.has(values['prepaid-qualifier'] as never)) {
      throw new CliUsageError(
        `Invalid --prepaid-qualifier value '${values['prepaid-qualifier']}'. Expected IncludePrepaid, PrepaidOnly, or ExcludePrepaid.`,
      );
    }
    rateCriteria.prepaidQualifier = values['prepaid-qualifier'] as NonNullable<
      typeof rateCriteria.prepaidQualifier
    >;
  }
  if (values['refundable-only'] !== undefined)
    rateCriteria.refundableOnly = values['refundable-only'];
  if (values['converted-only'] !== undefined) {
    rateCriteria.convertedRateInfoOnly = values['converted-only'];
  }
  const rateSources = splitCommaList(values['rate-sources']);
  if (rateSources !== undefined) rateCriteria.rateSource = rateSources;
  if (values['sort-by'] !== undefined) rateCriteria.sortBy = values['sort-by'];
  if (values['sort-order'] !== undefined) {
    if (values['sort-order'] !== 'ASC' && values['sort-order'] !== 'DESC') {
      throw new CliUsageError(
        `Invalid --sort-order value '${values['sort-order']}'. Expected ASC or DESC.`,
      );
    }
    rateCriteria.sortOrder = values['sort-order'];
  }

  const input: Extract<GetHotelDetailsInput, { kind: 'hotel-ref' }> = {
    kind: 'hotel-ref',
    hotelRef:
      codeContext === undefined
        ? { code: values['hotel-code'] as string }
        : { code: values['hotel-code'] as string, codeContext },
    rateCriteria,
  };
  if (values.pcc !== undefined) input.pointOfSale = { pseudoCityCode: values.pcc };
  if (values['corporate-number'] !== undefined) input.corporateNumber = values['corporate-number'];
  if (values['shop-key'] !== undefined) input.shopKey = values['shop-key'];
  if (contentRef !== undefined) input.contentRef = contentRef;
  return input;
}

/**
 * Builds a `DetailsContentRef` from the `--with-*` flags. Returns
 * `undefined` when none are set so the mapper omits the block entirely
 * (Sabre defaults to a rate-only response).
 */
function buildDetailsContentRef(
  values: HotelDetailsFlagValues,
): NonNullable<GetHotelDetailsInput['contentRef']> | undefined {
  const ref: NonNullable<GetHotelDetailsInput['contentRef']> = {};

  const descriptions = splitCommaList(values['with-descriptions']);
  if (descriptions !== undefined) {
    for (const type of descriptions) {
      if (!DETAILS_DESCRIPTION_TYPES.has(type as never)) {
        throw new CliUsageError(
          `Invalid --with-descriptions value '${type}'. Expected one of: ${Array.from(
            DETAILS_DESCRIPTION_TYPES,
          ).join(', ')}.`,
        );
      }
    }
  }

  const di: NonNullable<NonNullable<GetHotelDetailsInput['contentRef']>['descriptiveInfo']> = {};
  if (values['with-property-info']) di.propertyInfo = true;
  if (values['with-location']) di.locationInfo = true;
  if (values['with-amenities']) di.amenities = true;
  if (values['with-security']) di.securityFeatures = true;
  if (values['with-sustainability']) di.sustainability = true;
  if (descriptions !== undefined) {
    di.descriptions = descriptions as NonNullable<typeof di.descriptions>;
  }
  if (Object.keys(di).length > 0) ref.descriptiveInfo = di;

  const images = splitCommaList(values['media-images']);
  if (images !== undefined) {
    for (const size of images) {
      if (!DETAILS_IMAGE_SIZES.has(size as never)) {
        throw new CliUsageError(
          `Invalid --media-images value '${size}'. Expected one of: ${Array.from(
            DETAILS_IMAGE_SIZES,
          ).join(', ')}.`,
        );
      }
    }
  }
  const needsMedia =
    values['with-media'] === true || images !== undefined || values['media-max'] !== undefined;
  if (needsMedia) {
    const media: NonNullable<NonNullable<GetHotelDetailsInput['contentRef']>['media']> = {};
    if (values['media-max'] !== undefined) media.maxItems = values['media-max'];
    if (values['with-media']) media.mediaTypes = ['IMAGE'];
    if (images !== undefined) {
      media.images = images as NonNullable<typeof media.images>;
    }
    ref.media = media;
  }

  return Object.keys(ref).length > 0 ? ref : undefined;
}

/** Flag set for `book-hotel`. */
export interface BookHotelFlagValues {
  'booking-key'?: string;
  'first-name'?: string;
  'last-name'?: string;
  email?: string;
  phone?: string;
  'card-number'?: string;
  'card-code'?: string;
  'card-expiry-month'?: string;
  'card-expiry-year'?: string;
  'card-cvc'?: string;
  'cardholder-first-name'?: string;
  'cardholder-last-name'?: string;
  'agency-name'?: string;
  'agency-iata'?: string;
  'agency-street-number'?: string;
  'agency-address-line'?: string;
  'agency-city'?: string;
  'agency-state'?: string;
  'agency-country'?: string;
  'agency-postal-code'?: string;
  'agency-contact-phone'?: string;
  'billing-address-line'?: string[];
  'billing-city'?: string;
  'billing-state'?: string;
  'billing-country'?: string;
  'billing-postal-code'?: string;
  pcc?: string;
  'target-city'?: string;
  'halt-on-error'?: string;
  body?: string;
}

/** Environment fallbacks for PCI-sensitive CLI flags. */
export interface BookHotelEnvFallbacks {
  cardNumber?: string;
  cardCode?: string;
  cardExpiryMonth?: string;
  cardExpiryYear?: string;
  cardCvc?: string;
}

/**
 * Reads the `SABRE_TEST_CARD_*` environment variables into a
 * {@link BookHotelEnvFallbacks}. Kept separate from {@link readEnvConfig}
 * because card data only matters for the booking smoke test and should
 * not flow into services that never need it.
 */
export function readBookHotelCardEnv(env: NodeJS.ProcessEnv): BookHotelEnvFallbacks {
  const out: BookHotelEnvFallbacks = {};
  if (env.SABRE_TEST_CARD_NUMBER) out.cardNumber = env.SABRE_TEST_CARD_NUMBER;
  if (env.SABRE_TEST_CARD_CODE) out.cardCode = env.SABRE_TEST_CARD_CODE;
  if (env.SABRE_TEST_CARD_EXPIRY_MONTH) out.cardExpiryMonth = env.SABRE_TEST_CARD_EXPIRY_MONTH;
  if (env.SABRE_TEST_CARD_EXPIRY_YEAR) out.cardExpiryYear = env.SABRE_TEST_CARD_EXPIRY_YEAR;
  if (env.SABRE_TEST_CARD_CVC) out.cardCvc = env.SABRE_TEST_CARD_CVC;
  return out;
}

/**
 * Builds the input for `createPassengerNameRecordV25.bookHotel` from
 * CLI flags, with `SABRE_TEST_CARD_*` env-var fallbacks for PCI-
 * sensitive card fields so the smoke test doesn't splatter a PAN and
 * CVV across shell history.
 *
 * When `--body` is supplied it is parsed as JSON and returned verbatim.
 *
 * Throws {@link CliUsageError} on malformed or missing flags.
 */
export function buildBookHotelInput(
  values: BookHotelFlagValues,
  cardEnv: BookHotelEnvFallbacks = {},
): BookHotelInput {
  if (values.body !== undefined) {
    return JSON.parse(values.body) as BookHotelInput;
  }

  const need = (name: keyof BookHotelFlagValues, label: string): string => {
    const raw = values[name];
    if (typeof raw !== 'string' || raw === '') {
      throw new CliUsageError(`book-hotel requires --${label}. (Or supply --body with full JSON.)`);
    }
    return raw;
  };

  const cardNumber = values['card-number'] ?? cardEnv.cardNumber;
  if (!cardNumber) {
    throw new CliUsageError(
      'book-hotel requires --card-number or SABRE_TEST_CARD_NUMBER in the environment.',
    );
  }
  const cardCode = values['card-code'] ?? cardEnv.cardCode;
  if (!cardCode) {
    throw new CliUsageError(
      'book-hotel requires --card-code or SABRE_TEST_CARD_CODE in the environment.',
    );
  }
  const expiryMonthRaw = values['card-expiry-month'] ?? cardEnv.cardExpiryMonth;
  if (!expiryMonthRaw) {
    throw new CliUsageError(
      'book-hotel requires --card-expiry-month or SABRE_TEST_CARD_EXPIRY_MONTH.',
    );
  }
  const expiryMonth = Number(expiryMonthRaw);
  if (!Number.isInteger(expiryMonth) || expiryMonth < 1 || expiryMonth > 12) {
    throw new CliUsageError(`Invalid expiry month '${expiryMonthRaw}'. Expected an integer 1-12.`);
  }
  const expiryYear = values['card-expiry-year'] ?? cardEnv.cardExpiryYear;
  if (!expiryYear) {
    throw new CliUsageError(
      'book-hotel requires --card-expiry-year or SABRE_TEST_CARD_EXPIRY_YEAR.',
    );
  }

  const billingAddressLines = values['billing-address-line'];
  if (billingAddressLines === undefined || billingAddressLines.length === 0) {
    throw new CliUsageError(
      'book-hotel requires at least one --billing-address-line (repeatable).',
    );
  }

  const firstName = need('first-name', 'first-name');
  const lastName = need('last-name', 'last-name');

  const input: BookHotelInput = {
    bookingKey: need('booking-key', 'booking-key'),
    leadGuest: {
      firstName,
      lastName,
      phone: need('phone', 'phone'),
    },
    agency: {
      name: need('agency-name', 'agency-name'),
      pcc: need('pcc', 'pcc'),
      iata: need('agency-iata', 'agency-iata'),
      address: {
        streetNumber: need('agency-street-number', 'agency-street-number'),
        addressLine: need('agency-address-line', 'agency-address-line'),
        cityName: need('agency-city', 'agency-city'),
        countryCode: need('agency-country', 'agency-country'),
      },
    },
    paymentCard: {
      cardCode,
      cardNumber,
      expiryMonth,
      expiryYear,
      holderFirstName: values['cardholder-first-name'] ?? firstName,
      holderLastName: values['cardholder-last-name'] ?? lastName,
      billingAddress: {
        addressLine: billingAddressLines,
        cityName: need('billing-city', 'billing-city'),
        countryCode: need('billing-country', 'billing-country'),
      },
    },
  };

  if (values.email !== undefined) input.leadGuest.email = values.email;
  if (values['agency-state'] !== undefined) {
    input.agency.address.stateCode = values['agency-state'];
  }
  if (values['agency-postal-code'] !== undefined) {
    input.agency.address.postalCode = values['agency-postal-code'];
  }
  if (values['agency-contact-phone'] !== undefined) {
    input.agency.contactPhone = values['agency-contact-phone'];
  }
  const csc = values['card-cvc'] ?? cardEnv.cardCvc;
  if (csc !== undefined) input.paymentCard.csc = csc;
  if (values['billing-state'] !== undefined) {
    input.paymentCard.billingAddress.stateCode = values['billing-state'];
  }
  if (values['billing-postal-code'] !== undefined) {
    input.paymentCard.billingAddress.postalCode = values['billing-postal-code'];
  }
  if (values['target-city'] !== undefined) input.targetCity = values['target-city'];
  if (values['halt-on-error'] !== undefined) {
    const v = values['halt-on-error'].toLowerCase();
    if (v !== 'true' && v !== 'false') {
      throw new CliUsageError(
        `Invalid --halt-on-error value '${values['halt-on-error']}'. Expected 'true' or 'false'.`,
      );
    }
    input.haltOnHotelBookError = v === 'true';
  }

  return input;
}

/** Flag set for `hotel-price-check`. */
export interface HotelPriceCheckFlagValues {
  'rate-key'?: string;
  pcc?: string;
  'corporate-number'?: string;
  'start-date'?: string;
  'end-date'?: string;
  room?: string[];
  body?: string;
}

/**
 * Builds the input for `hotelPriceCheckV5.check` from the CLI flags.
 *
 * - When `--body` is supplied, it is parsed as JSON and returned verbatim.
 * - Otherwise `--rate-key` is required — the opaque rate identifier from
 *   a prior shop response.
 * - `--start-date` and `--end-date` must be supplied together (or
 *   omitted together).
 * - `--room` is repeatable and accepts `ADULTS[:CHILDREN[:AGES]]`
 *   (e.g. `2`, `2:1:10`, `1:2:8,10`). `index` is assigned from the
 *   flag order starting at 1.
 *
 * Throws {@link CliUsageError} on malformed flags.
 */
export function buildHotelPriceCheckInput(values: HotelPriceCheckFlagValues): CheckHotelPriceInput {
  if (values.body !== undefined) {
    return JSON.parse(values.body) as CheckHotelPriceInput;
  }

  if (!values['rate-key']) {
    throw new CliUsageError(
      'hotel-price-check requires --rate-key. (Or supply --body with a full JSON input.)',
    );
  }

  const input: CheckHotelPriceInput = { rateKey: values['rate-key'] };

  if (values.pcc !== undefined) {
    input.pointOfSale = { pseudoCityCode: values.pcc };
  }
  if (values['corporate-number'] !== undefined) {
    input.corporateNumber = values['corporate-number'];
  }

  const startDate = values['start-date'];
  const endDate = values['end-date'];
  if (startDate !== undefined || endDate !== undefined) {
    if (startDate === undefined || endDate === undefined) {
      throw new CliUsageError(
        'hotel-price-check --start-date and --end-date must be supplied together.',
      );
    }
    input.stay = { startDate, endDate };
  }

  if (values.room !== undefined && values.room.length > 0) {
    input.rooms = values.room.map((spec, i) => parseHotelRoomSpec(spec, i + 1));
  }

  return input;
}

function parseHotelRoomSpec(
  spec: string,
  index: number,
): NonNullable<CheckHotelPriceInput['rooms']>[number] {
  const parts = spec.split(':');
  if (parts.length === 0 || parts.length > 3) {
    throw new CliUsageError(
      `Invalid --room value '${spec}'. Expected 'ADULTS[:CHILDREN[:AGES]]' (e.g. 2, 2:1:10).`,
    );
  }
  const adultsRaw = parts[0];
  if (!adultsRaw) {
    throw new CliUsageError(`Invalid --room value '${spec}'. ADULTS is required.`);
  }
  const adults = Number(adultsRaw);
  if (!Number.isInteger(adults) || adults < 1) {
    throw new CliUsageError(
      `Invalid --room adults '${adultsRaw}' in '${spec}'. Expected a positive integer.`,
    );
  }
  const out: NonNullable<CheckHotelPriceInput['rooms']>[number] = { index, adults };
  if (parts.length >= 2 && parts[1] !== undefined && parts[1] !== '') {
    const children = Number(parts[1]);
    if (!Number.isInteger(children) || children < 0) {
      throw new CliUsageError(
        `Invalid --room children '${parts[1]}' in '${spec}'. Expected a non-negative integer.`,
      );
    }
    out.children = children;
  }
  if (parts.length === 3 && parts[2] !== undefined && parts[2] !== '') {
    const ages = parts[2]
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((a) => {
        const n = Number(a);
        if (!Number.isInteger(n) || n < 0) {
          throw new CliUsageError(
            `Invalid --room age '${a}' in '${spec}'. Expected a non-negative integer.`,
          );
        }
        return n;
      });
    if (ages.length > 0) out.childAges = ages;
  }
  return out;
}

/** Flag set for `revalidate-itinerary`. */
export interface RevalidateFlagValues {
  from?: string;
  to?: string;
  'departure-date'?: string;
  'flight-from'?: string;
  'flight-to'?: string;
  carrier?: string;
  'flight-number'?: string;
  'flight-depart'?: string;
  'flight-arrive'?: string;
  class?: string;
  pax?: string[];
  'company-code'?: string;
  pcc?: string;
  body?: string;
}

/**
 * Builds the input for `revalidateItineraryV5.revalidate` from the CLI
 * flags.
 *
 * - When `--body` is supplied, it is parsed as JSON and returned
 *   verbatim.
 * - Otherwise the required flags assemble a single-leg, single-flight
 *   revalidation request. For multi-leg or connecting itineraries, use
 *   `--body`.
 */
export function buildRevalidateInput(
  values: RevalidateFlagValues,
  env: CliEnvConfig,
): RevalidateItineraryInput {
  if (values.body !== undefined) {
    return JSON.parse(values.body) as RevalidateItineraryInput;
  }

  const missing: string[] = [];
  if (!values.from) missing.push('--from');
  if (!values.to) missing.push('--to');
  if (!values['departure-date']) missing.push('--departure-date');
  if (!values.carrier) missing.push('--carrier');
  if (!values['flight-number']) missing.push('--flight-number');
  if (!values['flight-depart']) missing.push('--flight-depart');
  if (!values['flight-arrive']) missing.push('--flight-arrive');
  if (missing.length > 0) {
    throw new CliUsageError(
      `revalidate-itinerary requires: ${missing.join(', ')}. (Or supply --body with a full JSON input.)`,
    );
  }

  const flightNumber = Number(values['flight-number']);
  if (!Number.isInteger(flightNumber) || flightNumber < 1) {
    throw new CliUsageError(
      `Invalid --flight-number '${values['flight-number']}'. Expected a positive integer.`,
    );
  }

  const flight: RevalidateItineraryInput['originDestinations'][number]['flights'][number] = {
    from: values['flight-from'] ?? (values.from as string),
    to: values['flight-to'] ?? (values.to as string),
    marketingCarrier: values.carrier as string,
    flightNumber,
    departureDateTime: normalizeBfmDateTime(values['flight-depart'] as string),
    arrivalDateTime: normalizeBfmDateTime(values['flight-arrive'] as string),
  };
  if (values.class !== undefined) {
    flight.classOfService = values.class;
  }

  const passengers: PassengerCount[] = (values.pax ?? ['ADT:1']).map(parsePassenger);

  const pointOfSale: RevalidateItineraryInput['pointOfSale'] = {};
  const companyCode = values['company-code'] ?? env.companyCode ?? DEFAULT_BFM_COMPANY_CODE;
  pointOfSale.companyCode = companyCode;
  const pcc = values.pcc ?? env.pcc;
  if (pcc) pointOfSale.pseudoCityCode = pcc;

  return {
    originDestinations: [
      {
        from: values.from as string,
        to: values.to as string,
        departureDateTime: normalizeBfmDateTime(values['departure-date'] as string),
        flights: [flight],
      },
    ],
    passengers,
    pointOfSale,
  };
}

/**
 * Builds the input for `getAncillariesV2.getAncillaries` from the CLI
 * flags.
 */
export function buildGetAncillariesInput(values: {
  'order-id'?: string;
  'segment-refs'?: string;
  'passenger-refs'?: string;
  'group-code'?: string;
  body?: string;
}): GetAncillariesInput {
  if (values.body !== undefined) {
    return JSON.parse(values.body) as GetAncillariesInput;
  }
  if (!values['order-id']) {
    throw new CliUsageError(
      'get-ancillaries requires --order-id. (Or supply --body with a full JSON input.)',
    );
  }
  const input: GetAncillariesInput = { orderId: values['order-id'] };
  const segRefs = splitCommaList(values['segment-refs']);
  if (segRefs) input.segmentRefs = segRefs;
  const paxRefs = splitCommaList(values['passenger-refs']);
  if (paxRefs) input.passengerRefs = paxRefs;
  if (values['group-code'] !== undefined) input.groupCode = values['group-code'];
  return input;
}

const BOOKING_SOURCES: ReadonlySet<BookingSource> = new Set(['SABRE', 'SABRE_ORDER']);
const FLIGHT_TICKET_OPERATIONS: ReadonlySet<CancelFlightTicketOperation> = new Set([
  'VOID',
  'REFUND',
]);
const CANCEL_ERROR_POLICIES: ReadonlySet<CancelErrorPolicy> = new Set([
  'HALT_ON_ERROR',
  'ALLOW_PARTIAL_CANCEL',
]);

function parseBookingSource(raw: string | undefined): BookingSource | undefined {
  if (raw === undefined) return undefined;
  if (!BOOKING_SOURCES.has(raw as BookingSource)) {
    throw new CliUsageError(
      `Invalid --booking-source '${raw}'. Expected one of: ${[...BOOKING_SOURCES].join(', ')}.`,
    );
  }
  return raw as BookingSource;
}

function parseFlightTicketOperation(
  raw: string | undefined,
): CancelFlightTicketOperation | undefined {
  if (raw === undefined) return undefined;
  if (!FLIGHT_TICKET_OPERATIONS.has(raw as CancelFlightTicketOperation)) {
    throw new CliUsageError(
      `Invalid --flight-ticket-operation '${raw}'. Expected one of: ${[
        ...FLIGHT_TICKET_OPERATIONS,
      ].join(', ')}.`,
    );
  }
  return raw as CancelFlightTicketOperation;
}

function parseCancelErrorPolicy(raw: string | undefined): CancelErrorPolicy | undefined {
  if (raw === undefined) return undefined;
  if (!CANCEL_ERROR_POLICIES.has(raw as CancelErrorPolicy)) {
    throw new CliUsageError(
      `Invalid --error-handling-policy '${raw}'. Expected one of: ${[...CANCEL_ERROR_POLICIES].join(
        ', ',
      )}.`,
    );
  }
  return raw as CancelErrorPolicy;
}

/**
 * Builds the input for `bookingManagementV1.getBooking` from the CLI
 * flags. `--body` wins if present; otherwise `--confirmation-id` is
 * required and everything else is optional.
 */
export function buildGetBookingInput(values: {
  'confirmation-id'?: string;
  'booking-source'?: string;
  'target-pcc'?: string;
  'given-name'?: string;
  'middle-name'?: string;
  surname?: string;
  'return-only'?: string;
  'unmask-payment-card-numbers'?: boolean;
  body?: string;
}): GetBookingInput {
  if (values.body !== undefined) {
    return JSON.parse(values.body) as GetBookingInput;
  }
  if (!values['confirmation-id']) {
    throw new CliUsageError(
      'get-booking requires --confirmation-id. (Or supply --body with a full JSON input.)',
    );
  }
  const input: GetBookingInput = { confirmationId: values['confirmation-id'] };
  const bookingSource = parseBookingSource(values['booking-source']);
  if (bookingSource !== undefined) input.bookingSource = bookingSource;
  if (values['target-pcc'] !== undefined) input.targetPcc = values['target-pcc'];
  if (values['given-name'] !== undefined) input.givenName = values['given-name'];
  if (values['middle-name'] !== undefined) input.middleName = values['middle-name'];
  if (values.surname !== undefined) input.surname = values.surname;
  const returnOnly = splitCommaList(values['return-only']);
  if (returnOnly) input.returnOnly = returnOnly as readonly BookingReturnOnly[];
  if (values['unmask-payment-card-numbers'] === true) input.unmaskPaymentCardNumbers = true;
  return input;
}

/**
 * Builds the input for `bookingManagementV1.modifyBooking` from the CLI
 * flags. `modifyBooking` requires paired `before`/`after` snapshots and
 * a `bookingSignature`; that's too much for individual flags, so this
 * command is body-only.
 */
export function buildModifyBookingInput(values: { body?: string }): ModifyBookingInput {
  if (values.body === undefined) {
    throw new CliUsageError(
      'modify-booking requires --body with a full JSON input (confirmationId, bookingSignature, before, after).',
    );
  }
  return JSON.parse(values.body) as ModifyBookingInput;
}

/**
 * Builds the input for `bookingManagementV1.cancelBooking` from the CLI
 * flags. `--body` wins if present; otherwise `--confirmation-id` is
 * required and per-type references accept comma-separated `itemId`
 * lists.
 */
export function buildCancelBookingInput(values: {
  'confirmation-id'?: string;
  'booking-source'?: string;
  'target-pcc'?: string;
  'received-from'?: string;
  'cancel-all'?: boolean;
  'retrieve-booking'?: boolean;
  'flight-ticket-operation'?: string;
  'error-handling-policy'?: string;
  flights?: string;
  hotels?: string;
  cars?: string;
  trains?: string;
  cruises?: string;
  body?: string;
}): CancelBookingInput {
  if (values.body !== undefined) {
    return JSON.parse(values.body) as CancelBookingInput;
  }
  if (!values['confirmation-id']) {
    throw new CliUsageError(
      'cancel-booking requires --confirmation-id. (Or supply --body with a full JSON input.)',
    );
  }
  const input: CancelBookingInput = { confirmationId: values['confirmation-id'] };
  const bookingSource = parseBookingSource(values['booking-source']);
  if (bookingSource !== undefined) input.bookingSource = bookingSource;
  if (values['target-pcc'] !== undefined) input.targetPcc = values['target-pcc'];
  if (values['received-from'] !== undefined) input.receivedFrom = values['received-from'];
  if (values['cancel-all'] === true) input.cancelAll = true;
  if (values['retrieve-booking'] === true) input.retrieveBooking = true;
  const op = parseFlightTicketOperation(values['flight-ticket-operation']);
  if (op !== undefined) input.flightTicketOperation = op;
  const policy = parseCancelErrorPolicy(values['error-handling-policy']);
  if (policy !== undefined) input.errorHandlingPolicy = policy;
  const flights = splitCommaList(values.flights);
  if (flights) input.flights = flights.map((itemId) => ({ itemId }));
  const hotels = splitCommaList(values.hotels);
  if (hotels) input.hotels = hotels.map((itemId) => ({ itemId }));
  const cars = splitCommaList(values.cars);
  if (cars) input.cars = cars.map((itemId) => ({ itemId }));
  const trains = splitCommaList(values.trains);
  if (trains) input.trains = trains.map((itemId) => ({ itemId }));
  const cruises = splitCommaList(values.cruises);
  if (cruises) input.cruises = cruises.map((itemId) => ({ itemId }));
  return input;
}

/**
 * Builds the input for `bookingManagementV1.checkTickets` from the CLI
 * flags. `--body` wins; otherwise at least one of `--confirmation-id`
 * or `--tickets` must be supplied. Ticket numbers from `--tickets` are
 * wrapped as `{ number }` records (without refund qualifiers).
 */
export function buildCheckTicketsInput(values: {
  'confirmation-id'?: string;
  tickets?: string;
  'target-pcc'?: string;
  body?: string;
}): CheckTicketsInput {
  if (values.body !== undefined) {
    return JSON.parse(values.body) as CheckTicketsInput;
  }
  const tickets = splitCommaList(values.tickets);
  if (!values['confirmation-id'] && !tickets) {
    throw new CliUsageError(
      'check-tickets requires --confirmation-id or --tickets. (Or supply --body with a full JSON input.)',
    );
  }
  const input: CheckTicketsInput = {};
  if (values['confirmation-id']) input.confirmationId = values['confirmation-id'];
  if (tickets) input.tickets = tickets.map((number) => ({ number }));
  if (values['target-pcc'] !== undefined) input.targetPcc = values['target-pcc'];
  return input;
}

/**
 * Builds the input for `bookingManagementV1.fulfillTickets` from the
 * CLI flags. The request needs nested `fulfillments[]` and
 * `formsOfPayment[]` arrays, so this command is body-only.
 */
export function buildFulfillTicketsInput(values: { body?: string }): FulfillTicketsInput {
  if (values.body === undefined) {
    throw new CliUsageError(
      'fulfill-tickets requires --body with a full JSON input (confirmationId, fulfillments, formsOfPayment).',
    );
  }
  return JSON.parse(values.body) as FulfillTicketsInput;
}

/**
 * Builds the input for `bookingManagementV1.voidTickets` from the CLI
 * flags. `--body` wins; otherwise at least one of `--confirmation-id`
 * or `--tickets` must be supplied. Tickets are passed as raw string
 * numbers (`VoidTicketsInput.tickets` is `string[]`, unlike the
 * `RefundFlightTicket[]` shape on check/refund).
 */
export function buildVoidTicketsInput(values: {
  'confirmation-id'?: string;
  tickets?: string;
  'target-pcc'?: string;
  'received-from'?: string;
  'error-handling-policy'?: string;
  'void-non-electronic-tickets'?: boolean;
  body?: string;
}): VoidTicketsInput {
  if (values.body !== undefined) {
    return JSON.parse(values.body) as VoidTicketsInput;
  }
  const tickets = splitCommaList(values.tickets);
  if (!values['confirmation-id'] && !tickets) {
    throw new CliUsageError(
      'void-tickets requires --confirmation-id or --tickets. (Or supply --body with a full JSON input.)',
    );
  }
  const input: VoidTicketsInput = {};
  if (values['confirmation-id']) input.confirmationId = values['confirmation-id'];
  if (tickets) input.tickets = tickets;
  if (values['target-pcc'] !== undefined) input.targetPcc = values['target-pcc'];
  if (values['received-from'] !== undefined) input.receivedFrom = values['received-from'];
  const policy = parseCancelErrorPolicy(values['error-handling-policy']);
  if (policy !== undefined) input.errorHandlingPolicy = policy;
  if (values['void-non-electronic-tickets'] === true) input.voidNonElectronicTickets = true;
  return input;
}

/**
 * Builds the input for `bookingManagementV1.refundTickets` from the
 * CLI flags. `--body` wins; otherwise at least one of `--confirmation-id`
 * or `--tickets` must be supplied. Ticket numbers from `--tickets` are
 * wrapped as `{ number }` records — to attach refund qualifiers
 * (waiverCode, overrideTaxes, journeyTypeCode, etc.) supply `--body`.
 */
export function buildRefundTicketsInput(values: {
  'confirmation-id'?: string;
  tickets?: string;
  'target-pcc'?: string;
  'received-from'?: string;
  'error-handling-policy'?: string;
  body?: string;
}): RefundTicketsInput {
  if (values.body !== undefined) {
    return JSON.parse(values.body) as RefundTicketsInput;
  }
  const tickets = splitCommaList(values.tickets);
  if (!values['confirmation-id'] && !tickets) {
    throw new CliUsageError(
      'refund-tickets requires --confirmation-id or --tickets. (Or supply --body with a full JSON input.)',
    );
  }
  const input: RefundTicketsInput = {};
  if (values['confirmation-id']) input.confirmationId = values['confirmation-id'];
  if (tickets) input.tickets = tickets.map((number) => ({ number }));
  if (values['target-pcc'] !== undefined) input.targetPcc = values['target-pcc'];
  if (values['received-from'] !== undefined) input.receivedFrom = values['received-from'];
  const policy = parseCancelErrorPolicy(values['error-handling-policy']);
  if (policy !== undefined) input.errorHandlingPolicy = policy;
  return input;
}

// ---------------------------------------------------------------------------
// parseArgs option configurations
// ---------------------------------------------------------------------------

const COMMON_OPTIONS = {
  'base-url': { type: 'string' },
  format: { type: 'string' },
  'debug-request': { type: 'boolean' },
  help: { type: 'boolean', short: 'h' },
} as const satisfies ParseArgsConfig['options'];

const AIRLINE_LOOKUP_OPTIONS = {
  ...COMMON_OPTIONS,
  codes: { type: 'string' },
  body: { type: 'string' },
} as const satisfies ParseArgsConfig['options'];

const BFM_OPTIONS = {
  ...COMMON_OPTIONS,
  from: { type: 'string' },
  to: { type: 'string' },
  'departure-date': { type: 'string' },
  'return-date': { type: 'string' },
  pax: { type: 'string', multiple: true },
  cabin: { type: 'string' },
  carriers: { type: 'string' },
  'non-stop': { type: 'boolean' },
  'max-stops': { type: 'string' },
  'company-code': { type: 'string' },
  pcc: { type: 'string' },
  body: { type: 'string' },
} as const satisfies ParseArgsConfig['options'];

const HOTEL_SEARCH_OPTIONS = {
  ...COMMON_OPTIONS,
  'geo-code': { type: 'string' },
  'ref-point': { type: 'string' },
  address: { type: 'string' },
  radius: { type: 'string' },
  uom: { type: 'string' },
  'max-results': { type: 'string' },
  'sort-by': { type: 'string' },
  'sort-order': { type: 'string' },
  'hotel-name': { type: 'string' },
  'chain-codes': { type: 'string' },
  'brand-codes': { type: 'string' },
  pcc: { type: 'string' },
  body: { type: 'string' },
} as const satisfies ParseArgsConfig['options'];

const HOTEL_AVAIL_OPTIONS = {
  ...COMMON_OPTIONS,
  'geo-code': { type: 'string' },
  'ref-point': { type: 'string' },
  address: { type: 'string' },
  hotels: { type: 'string' },
  radius: { type: 'string' },
  uom: { type: 'string' },
  'restrict-country': { type: 'string' },
  'currency-code': { type: 'string' },
  'best-only': { type: 'string' },
  'start-date': { type: 'string' },
  'end-date': { type: 'string' },
  room: { type: 'string', multiple: true },
  'rate-sources': { type: 'string' },
  'prepaid-qualifier': { type: 'string' },
  'refundable-only': { type: 'boolean' },
  'converted-only': { type: 'boolean' },
  'chain-codes': { type: 'string' },
  'brand-codes': { type: 'string' },
  'hotel-name': { type: 'string' },
  'lenient-name': { type: 'string' },
  'max-results': { type: 'string' },
  'page-size': { type: 'string' },
  'sort-by': { type: 'string' },
  'sort-order': { type: 'string' },
  pcc: { type: 'string' },
  'corporate-number': { type: 'string' },
  body: { type: 'string' },
} as const satisfies ParseArgsConfig['options'];

const HOTEL_RATE_INFO_OPTIONS = {
  ...COMMON_OPTIONS,
  'hotel-code': { type: 'string' },
  'code-context': { type: 'string' },
  'rate-key': { type: 'string' },
  'start-date': { type: 'string' },
  'end-date': { type: 'string' },
  'currency-code': { type: 'string' },
  language: { type: 'string' },
  room: { type: 'string', multiple: true },
  'prepaid-qualifier': { type: 'string' },
  'refundable-only': { type: 'boolean' },
  'converted-only': { type: 'boolean' },
  'exact-match-only': { type: 'boolean' },
  'rate-sources': { type: 'string' },
  'sort-by': { type: 'string' },
  'sort-order': { type: 'string' },
  pcc: { type: 'string' },
  'corporate-number': { type: 'string' },
  body: { type: 'string' },
} as const satisfies ParseArgsConfig['options'];

const HOTEL_DETAILS_OPTIONS = {
  ...COMMON_OPTIONS,
  'hotel-code': { type: 'string' },
  'code-context': { type: 'string' },
  'rate-key': { type: 'string' },
  'start-date': { type: 'string' },
  'end-date': { type: 'string' },
  'currency-code': { type: 'string' },
  room: { type: 'string', multiple: true },
  'prepaid-qualifier': { type: 'string' },
  'refundable-only': { type: 'boolean' },
  'converted-only': { type: 'boolean' },
  'exact-match-only': { type: 'boolean' },
  'rate-sources': { type: 'string' },
  'sort-by': { type: 'string' },
  'sort-order': { type: 'string' },
  pcc: { type: 'string' },
  'corporate-number': { type: 'string' },
  'shop-key': { type: 'string' },
  'with-property-info': { type: 'boolean' },
  'with-location': { type: 'boolean' },
  'with-amenities': { type: 'boolean' },
  'with-security': { type: 'boolean' },
  'with-sustainability': { type: 'boolean' },
  'with-descriptions': { type: 'string' },
  'with-media': { type: 'boolean' },
  'media-images': { type: 'string' },
  'media-max': { type: 'string' },
  body: { type: 'string' },
} as const satisfies ParseArgsConfig['options'];

const HOTEL_PRICE_CHECK_OPTIONS = {
  ...COMMON_OPTIONS,
  'rate-key': { type: 'string' },
  pcc: { type: 'string' },
  'corporate-number': { type: 'string' },
  'start-date': { type: 'string' },
  'end-date': { type: 'string' },
  room: { type: 'string', multiple: true },
  body: { type: 'string' },
} as const satisfies ParseArgsConfig['options'];

const BOOK_HOTEL_OPTIONS = {
  ...COMMON_OPTIONS,
  'booking-key': { type: 'string' },
  'first-name': { type: 'string' },
  'last-name': { type: 'string' },
  email: { type: 'string' },
  phone: { type: 'string' },
  'card-number': { type: 'string' },
  'card-code': { type: 'string' },
  'card-expiry-month': { type: 'string' },
  'card-expiry-year': { type: 'string' },
  'card-cvc': { type: 'string' },
  'cardholder-first-name': { type: 'string' },
  'cardholder-last-name': { type: 'string' },
  'agency-name': { type: 'string' },
  'agency-iata': { type: 'string' },
  'agency-street-number': { type: 'string' },
  'agency-address-line': { type: 'string' },
  'agency-city': { type: 'string' },
  'agency-state': { type: 'string' },
  'agency-country': { type: 'string' },
  'agency-postal-code': { type: 'string' },
  'agency-contact-phone': { type: 'string' },
  'billing-address-line': { type: 'string', multiple: true },
  'billing-city': { type: 'string' },
  'billing-state': { type: 'string' },
  'billing-country': { type: 'string' },
  'billing-postal-code': { type: 'string' },
  pcc: { type: 'string' },
  'target-city': { type: 'string' },
  'halt-on-error': { type: 'string' },
  body: { type: 'string' },
} as const satisfies ParseArgsConfig['options'];

const REVALIDATE_OPTIONS = {
  ...COMMON_OPTIONS,
  from: { type: 'string' },
  to: { type: 'string' },
  'departure-date': { type: 'string' },
  'flight-from': { type: 'string' },
  'flight-to': { type: 'string' },
  carrier: { type: 'string' },
  'flight-number': { type: 'string' },
  'flight-depart': { type: 'string' },
  'flight-arrive': { type: 'string' },
  class: { type: 'string' },
  pax: { type: 'string', multiple: true },
  'company-code': { type: 'string' },
  pcc: { type: 'string' },
  body: { type: 'string' },
} as const satisfies ParseArgsConfig['options'];

const GET_ANCILLARIES_OPTIONS = {
  ...COMMON_OPTIONS,
  'order-id': { type: 'string' },
  'segment-refs': { type: 'string' },
  'passenger-refs': { type: 'string' },
  'group-code': { type: 'string' },
  body: { type: 'string' },
} as const satisfies ParseArgsConfig['options'];

const CREATE_BOOKING_OPTIONS = {
  ...COMMON_OPTIONS,
  body: { type: 'string' },
} as const satisfies ParseArgsConfig['options'];

const EXCHANGE_BOOKING_OPTIONS = {
  ...COMMON_OPTIONS,
  body: { type: 'string' },
} as const satisfies ParseArgsConfig['options'];

const FLIGHT_RESHOP_OPTIONS = {
  ...COMMON_OPTIONS,
  body: { type: 'string' },
} as const satisfies ParseArgsConfig['options'];

const GET_BOOKING_OPTIONS = {
  ...COMMON_OPTIONS,
  'confirmation-id': { type: 'string' },
  'booking-source': { type: 'string' },
  'target-pcc': { type: 'string' },
  'given-name': { type: 'string' },
  'middle-name': { type: 'string' },
  surname: { type: 'string' },
  'return-only': { type: 'string' },
  'unmask-payment-card-numbers': { type: 'boolean' },
  body: { type: 'string' },
} as const satisfies ParseArgsConfig['options'];

const MODIFY_BOOKING_OPTIONS = {
  ...COMMON_OPTIONS,
  body: { type: 'string' },
} as const satisfies ParseArgsConfig['options'];

const CANCEL_BOOKING_OPTIONS = {
  ...COMMON_OPTIONS,
  'confirmation-id': { type: 'string' },
  'booking-source': { type: 'string' },
  'target-pcc': { type: 'string' },
  'received-from': { type: 'string' },
  'cancel-all': { type: 'boolean' },
  'retrieve-booking': { type: 'boolean' },
  'flight-ticket-operation': { type: 'string' },
  'error-handling-policy': { type: 'string' },
  flights: { type: 'string' },
  hotels: { type: 'string' },
  cars: { type: 'string' },
  trains: { type: 'string' },
  cruises: { type: 'string' },
  body: { type: 'string' },
} as const satisfies ParseArgsConfig['options'];

const GET_SEATS_OPTIONS = {
  ...COMMON_OPTIONS,
  body: { type: 'string' },
} as const satisfies ParseArgsConfig['options'];

const CHECK_TICKETS_OPTIONS = {
  ...COMMON_OPTIONS,
  'confirmation-id': { type: 'string' },
  tickets: { type: 'string' },
  'target-pcc': { type: 'string' },
  body: { type: 'string' },
} as const satisfies ParseArgsConfig['options'];

const FULFILL_TICKETS_OPTIONS = {
  ...COMMON_OPTIONS,
  body: { type: 'string' },
} as const satisfies ParseArgsConfig['options'];

const VOID_TICKETS_OPTIONS = {
  ...COMMON_OPTIONS,
  'confirmation-id': { type: 'string' },
  tickets: { type: 'string' },
  'target-pcc': { type: 'string' },
  'received-from': { type: 'string' },
  'error-handling-policy': { type: 'string' },
  'void-non-electronic-tickets': { type: 'boolean' },
  body: { type: 'string' },
} as const satisfies ParseArgsConfig['options'];

const REFUND_TICKETS_OPTIONS = {
  ...COMMON_OPTIONS,
  'confirmation-id': { type: 'string' },
  tickets: { type: 'string' },
  'target-pcc': { type: 'string' },
  'received-from': { type: 'string' },
  'error-handling-policy': { type: 'string' },
  body: { type: 'string' },
} as const satisfies ParseArgsConfig['options'];

// ---------------------------------------------------------------------------
// Help text
// ---------------------------------------------------------------------------

const TOP_LEVEL_HELP = `Usage: sabre-rest <command> [flags]

Provisional CLI for testing the sabre-rest library against real Sabre
servers. Subject to breaking changes during 0.x.

Commands:
  airline-lookup            Sabre Airline Lookup v1
  airline-alliance-lookup   Sabre Airline Alliance Lookup v1
  bargain-finder-max        Sabre Bargain Finder Max v5
  book-hotel                Sabre Create Passenger Name Record v2.5.0 (hotel)
  cancel-booking            Sabre Booking Management v1 — Cancel Booking
  check-tickets             Sabre Booking Management v1 — Check Tickets
  create-booking            Sabre Booking Management v1 — Create Booking
  exchange-booking          Sabre Exchange Booking v1.1.0
  flight-reshop             Sabre Flight Reshop v1.0
  fulfill-tickets           Sabre Booking Management v1 — Fulfill Flight Tickets
  get-ancillaries           Sabre Get Ancillaries v2
  get-booking               Sabre Booking Management v1 — Get Booking
  get-hotel-avail           Sabre Get Hotel Avail v5
  get-hotel-details         Sabre Get Hotel Details v5
  get-hotel-rate-info       Sabre Get Hotel Rate Info v5
  get-seats                 Sabre Get Seats v2
  hotel-price-check         Sabre Hotel Price Check v5
  hotel-search              Sabre Hotel Search v2
  modify-booking            Sabre Booking Management v1 — Modify Booking
  refund-tickets            Sabre Booking Management v1 — Refund Tickets
  revalidate-itinerary      Sabre Revalidate Itinerary v5
  void-tickets              Sabre Booking Management v1 — Void Tickets

Common flags:
  --base-url <url>          Override SABRE_BASE_URL
  --format json|table       Output format (default: json)
  --debug-request           Print the outbound HTTP request to stderr
  -h, --help                Show this help (or per-command help)

Environment:
  SABRE_CLIENT_ID           OAuth v2 client id (required)
  SABRE_CLIENT_SECRET       OAuth v2 client secret (required)
  SABRE_BASE_URL            Sabre base URL, e.g. https://api.cert.platform.sabre.com
  SABRE_COMPANY_CODE        Optional agency company code (bargain-finder-max)
  SABRE_PCC                 Optional pseudo city code (bargain-finder-max)
  SABRE_TEST_CARD_NUMBER    PAN fallback for book-hotel (PCI-sensitive)
  SABRE_TEST_CARD_CODE      Card code fallback for book-hotel (e.g. VI)
  SABRE_TEST_CARD_EXPIRY_MONTH  Expiry month fallback for book-hotel (1-12)
  SABRE_TEST_CARD_EXPIRY_YEAR   Expiry year fallback for book-hotel (YYYY)
  SABRE_TEST_CARD_CVC       CVC fallback for book-hotel (PCI-sensitive)

A .env file in the current directory is loaded automatically.

Run 'sabre-rest <command> --help' for command-specific flags.
`;

const AIRLINE_LOOKUP_HELP = `Usage: sabre-rest airline-lookup [flags]

Sabre Airline Lookup v1. With no codes, returns every airline.

Flags:
  --codes <list>            Comma-separated IATA airline codes
  --body <json>             Override input with raw JSON (ignores other flags)
  --base-url <url>          Override SABRE_BASE_URL
  --format json|table       Output format (default: json)
  --debug-request           Print the outbound HTTP request to stderr
  -h, --help                Show this help

Examples:
  sabre-rest airline-lookup
  sabre-rest airline-lookup --codes AA,BA,DL
  sabre-rest airline-lookup --codes AA,BA --format table
`;

const AIRLINE_ALLIANCE_LOOKUP_HELP = `Usage: sabre-rest airline-alliance-lookup [flags]

Sabre Airline Alliance Lookup v1. With no codes, returns every alliance.

Flags:
  --codes <list>            Comma-separated alliance codes (e.g. *A,*O,*S)
  --body <json>             Override input with raw JSON (ignores other flags)
  --base-url <url>          Override SABRE_BASE_URL
  --format json|table       Output format (default: json)
  --debug-request           Print the outbound HTTP request to stderr
  -h, --help                Show this help

Examples:
  sabre-rest airline-alliance-lookup
  sabre-rest airline-alliance-lookup --codes "*A,*O" --format table
`;

const BFM_HELP = `Usage: sabre-rest bargain-finder-max [flags]

Sabre Bargain Finder Max v5 low-fare shop.

Flags:
  --from <iata>             Origin IATA code (required unless --body)
  --to <iata>               Destination IATA code (required unless --body)
  --departure-date <iso>    Departure local date or date-time (required unless --body)
  --return-date <iso>       Return date for a round-trip (optional)
  --pax <type:count>        Passenger group, repeatable (default: ADT:1)
  --cabin <CabinClass>      Preferred cabin (Economy, Business, etc.)
  --carriers <list>         Comma-separated preferred marketing carriers
  --non-stop                Only return non-stop itineraries
  --max-stops <n>           Maximum stops per leg
  --company-code <code>     Agency company code (RequestorID/CompanyName). Defaults to TN.
  --pcc <code>              Optional pseudo city code (Source/PseudoCityCode)
  --body <json>             Override input with raw JSON (ignores other flags)
  --base-url <url>          Override SABRE_BASE_URL
  --format json|table       Output format (default: json). Table is a one-row-per-itinerary summary.
  --debug-request           Print the outbound HTTP request to stderr
  -h, --help                Show this help

Examples:
  sabre-rest bargain-finder-max --from JFK --to LHR --departure-date 2025-12-25
  sabre-rest bargain-finder-max --from JFK --to LHR \\
    --departure-date 2025-12-25 --return-date 2026-01-05 \\
    --pax ADT:1 --pax CHD:1 --cabin Business --non-stop
`;

const HOTEL_SEARCH_HELP = `Usage: sabre-rest hotel-search [flags]

Sabre Hotel Search v2. Property discovery for a geographic anchor plus a
radius. Availability and rates are not part of this API.

Anchor (exactly one required, unless --body):
  --geo-code <lat,lon>      Latitude,longitude (e.g. 32.758,-97.08)
  --ref-point <T:V:C>       OTA reference point TYPE:VALUE:CONTEXT
                            (e.g. 6:DFW:CODE for airport-code DFW)
                            TYPE is one of 5,6,7,11,16,18,37. CONTEXT is CODE or NAME.
  --address <fields>        COUNTRY[,CITY[,STATE]] (e.g. US,Irving,TX)

Other flags:
  --radius <n>              Search radius (default: 25)
  --uom <MI|KM>             Unit of measure for radius (default: MI)
  --max-results <n>         Max properties to return (1-300)
  --sort-by <key>           TotalRate | DistanceFrom | SabreRating
  --sort-order <order>      ASC or DESC
  --hotel-name <name>       Partial name match (min 3 chars)
  --chain-codes <list>      Comma-separated chain codes (e.g. HY,MC)
  --brand-codes <list>      Comma-separated brand codes
  --pcc <code>              Optional branch PCC (POS/Source)
  --body <json>             Override input with raw JSON (ignores other flags)
  --base-url <url>          Override SABRE_BASE_URL
  --format json|table       Output format (default: json). Table is one-row-per-hotel.
  --debug-request           Print the outbound HTTP request to stderr
  -h, --help                Show this help

Examples:
  sabre-rest hotel-search --geo-code 32.758,-97.08 --radius 10 --uom MI
  sabre-rest hotel-search --ref-point 6:DFW:CODE --max-results 20 --format table
  sabre-rest hotel-search --address "US,Irving,TX" --chain-codes HY,MC
`;

const HOTEL_AVAIL_HELP = `Usage: sabre-rest get-hotel-avail [flags]

Sabre Get Hotel Avail v5. Lead-rates call that produces rateKeys for the
downstream hotel-price-check call.

Anchor (exactly one, unless --body):
  --geo-code <lat,lon>       Latitude,longitude (e.g. 32.758,-97.08)
  --ref-point <T:V:C>        OTA reference point TYPE:VALUE:CONTEXT
                             (e.g. 6:DFW:CODE for airport DFW). TYPE is one of
                             5,6,7,11,16,18,37. CONTEXT is CODE or NAME.
  --address <fields>         COUNTRY[,CITY[,STATE]] (e.g. US,Irving,TX)
  --hotels <codes>           Comma-separated hotel codes

Required unless --body:
  --currency-code <ISO>      ISO 4217 currency code (e.g. USD)
  --start-date <YYYY-MM-DD>  Stay check-in date
  --end-date <YYYY-MM-DD>    Stay check-out date

Rate criteria:
  --best-only <1-4>          1=lowest across, 2=lowest per source,
                             3=per source + negotiated, 4=public + negotiated
                             + rateRanges for GDS. Default: 1
  --room <spec>              Repeatable; ADULTS[:CHILDREN[:AGES]] (default: 1)
  --rate-sources <list>      Comma-separated source codes (e.g. 100,110,112,113)
  --prepaid-qualifier <v>    IncludePrepaid | PrepaidOnly | ExcludePrepaid
  --refundable-only          Only return refundable rates
  --converted-only           Only return ConvertedRateInfo entries

Geo options:
  --radius <n>               Radius (default: 25)
  --uom <MI|KM>              Unit of measure (default: MI)
  --restrict-country <code>  Restrict to a country (e.g. US)

Sort / paging:
  --max-results <n>          Alias for --page-size (1-200)
  --page-size <n>            Page size (1-200)
  --sort-by <key>            NegotiatedRateAvailability | DistanceFrom | SabreRating
                             | AverageNightlyRate | AverageNightlyRateBeforeTax
  --sort-order <order>       ASC or DESC

Filters / POS:
  --chain-codes <list>       Comma-separated chain codes (e.g. HY,MC)
  --brand-codes <list>       Comma-separated brand codes
  --hotel-name <name>        Exact hotel name (3-100 chars)
  --lenient-name <name>      Lenient name match
  --pcc <code>               Optional branch PCC
  --corporate-number <n>     Optional corporate number

Other:
  --body <json>              Override input with raw JSON (ignores other flags)
  --base-url <url>           Override SABRE_BASE_URL
  --format json|table        Output format (default: json). Table is one row
                             per hotel with the first rateKey surfaced.
  --debug-request            Print the outbound HTTP request to stderr
  -h, --help                 Show this help

Examples:
  sabre-rest get-hotel-avail --ref-point 6:DFW:CODE --currency-code USD \\
    --start-date 2026-06-20 --end-date 2026-06-22 --max-results 5 --format table
  sabre-rest get-hotel-avail --hotels 100072188,100074506 --currency-code USD \\
    --start-date 2026-06-20 --end-date 2026-06-22
`;

const HOTEL_RATE_INFO_HELP = `Usage: sabre-rest get-hotel-rate-info [flags]

Sabre Get Hotel Rate Info v5. Returns all available rates for a single
hotel property (the per-property drill-down of get-hotel-avail).

Two mutually exclusive flows (plus --body):
  1. Fresh shop by hotel code:
     --hotel-code <code>        Hotel property ID (global or Sabre)
     --code-context SABRE|GLOBAL
                                 (default: server applies SABRE)
     --start-date <YYYY-MM-DD>   Stay check-in (required)
     --end-date <YYYY-MM-DD>     Stay check-out (required)
  2. Rerun a prior search by opaque rate key:
     --rate-key <key>            Rate key from a prior avail / shop response

Rate criteria (hotel-code flow; some also valid on rate-key flow):
  --currency-code <ISO>        ISO 4217 currency (required with --rate-range)
  --language <code>            Language for rate text (e.g. EN)
  --room <spec>                Repeatable; ADULTS[:CHILDREN[:AGES]] (default: 1)
  --prepaid-qualifier <v>      IncludePrepaid | PrepaidOnly | ExcludePrepaid
  --refundable-only            Only return refundable rates
  --converted-only             Only return ConvertedRateInfo entries
  --exact-match-only           (rate-key flow) Only exact matches for original criteria
  --rate-sources <list>        Comma-separated source codes (e.g. 100,110,112,113)
  --sort-by <key>              AverageNightlyRateBeforeTax | NightlyRate | RateSource |
                               CommissionableRates | Refundability |
                               CommissionPercentage | AccessibleRates |
                               CancellationPenaltyDeadline | NegotiatedRates |
                               PrepaidRates | PostpaidRates
  --sort-order <order>         ASC or DESC

POS:
  --pcc <code>                 Optional branch PCC (POS/Source)
  --corporate-number <n>       Optional corporate number (hotel-code flow)

Other:
  --body <json>                Override input with raw JSON (ignores other flags)
  --base-url <url>             Override SABRE_BASE_URL
  --format json|table          Output format (default: json). Table is one row
                               per rate entry (source, before-tax, after-tax,
                               currency, rateKey).
  --debug-request              Print the outbound HTTP request to stderr
  -h, --help                   Show this help

Examples:
  sabre-rest get-hotel-rate-info --hotel-code 100072188 --code-context GLOBAL \\
    --start-date 2026-06-20 --end-date 2026-06-22 --currency-code USD --format table
  sabre-rest get-hotel-rate-info --rate-key 'NFZ6Y...==' --refundable-only
`;

const HOTEL_DETAILS_HELP = `Usage: sabre-rest get-hotel-details [flags]

Sabre Get Hotel Details v5. Returns a single property's full rate grid
(room types × rate plans with policies, guarantees) and optionally its
descriptive content and media. This is the canonical "Refine" step
between get-hotel-avail and hotel-price-check in the CSL hotel flow.

Two mutually exclusive flows (plus --body):
  1. Fresh shop by hotel code:
     --hotel-code <code>        Hotel property ID (global or Sabre)
     --code-context SABRE|GLOBAL
                                 (default: server applies SABRE)
     --start-date <YYYY-MM-DD>   Stay check-in (required)
     --end-date <YYYY-MM-DD>     Stay check-out (required)
  2. Rerun a prior search by opaque rate key:
     --rate-key <key>            Rate key from a prior avail response

Rate criteria (hotel-code flow; some also valid on rate-key flow):
  --currency-code <ISO>        ISO 4217 currency (required with --rate-range)
  --room <spec>                Repeatable; ADULTS[:CHILDREN[:AGES]] (default: 1)
  --prepaid-qualifier <v>      IncludePrepaid | PrepaidOnly | ExcludePrepaid
  --refundable-only            Only return refundable rates
  --converted-only             Only return ConvertedRateInfo entries
  --exact-match-only           (rate-key flow) Only exact matches
  --rate-sources <list>        Comma-separated source codes (e.g. 100,110,112,113)
  --sort-by <key>              Sabre-defined sort key
  --sort-order <order>         ASC or DESC
  --shop-key <key>             Pagination key to fetch the next set of rates

POS:
  --pcc <code>                 Optional branch PCC (POS/Source)
  --corporate-number <n>       Optional corporate number

Descriptive content (opt-in; Sabre omits these unless requested):
  --with-property-info         Include floors, rooms, policies, property type
  --with-location              Include coordinates, address, neighborhoods, contact
  --with-amenities             Include hotel amenities (HAC OTA codes)
  --with-security              Include security features (SEC OTA codes)
  --with-sustainability        Include sustainability block
  --with-descriptions <list>   Comma-separated: ShortDescription,Dining,Facilities,
                               Recreation,Services,Attractions,CancellationPolicy,
                               DepositPolicy,Directions,Policies,SafetyInfo,
                               TransportationInfo,GuaranteePolicy

Media (opt-in):
  --with-media                 Include media items (IMAGE type)
  --media-images <list>        Comma-separated sizes:
                               ORIGINAL,THUMBNAIL,SMALL,MEDIUM,LARGE
  --media-max <n>              Max media items to return

Other:
  --body <json>                Override input with raw JSON (ignores other flags)
  --base-url <url>             Override SABRE_BASE_URL
  --format json|table          Output format (default: json). Table is one row
                               per rate plan (room, source, before-tax,
                               after-tax, currency, rateKey).
  --debug-request              Print the outbound HTTP request to stderr
  -h, --help                   Show this help

Examples:
  sabre-rest get-hotel-details --hotel-code 100072188 --code-context GLOBAL \\
    --start-date 2026-06-20 --end-date 2026-06-22 --currency-code USD --format table
  sabre-rest get-hotel-details --rate-key 'NFZ6Y...==' \\
    --with-property-info --with-amenities --with-descriptions ShortDescription,Policies
`;

const BOOK_HOTEL_HELP = `Usage: sabre-rest book-hotel [flags]

Sabre Create Passenger Name Record v2.5.0. Books a single hotel room
against a priced bookingKey from hotel-price-check and returns the new
Sabre PNR locator.

PCI-sensitive card fields fall back to environment variables:
  --card-number        SABRE_TEST_CARD_NUMBER
  --card-code          SABRE_TEST_CARD_CODE
  --card-expiry-month  SABRE_TEST_CARD_EXPIRY_MONTH
  --card-expiry-year   SABRE_TEST_CARD_EXPIRY_YEAR
  --card-cvc           SABRE_TEST_CARD_CVC

Required (unless --body):
  --booking-key <key>               Opaque booking key from hotel-price-check
  --first-name <name>               Lead guest first name
  --last-name <name>                Lead guest last name
  --phone <phone>                   Lead guest contact phone
  --card-code <AX|VI|MC|...>        Two-letter card code
  --card-number <pan>               PAN, digits only
  --card-expiry-month <1-12>
  --card-expiry-year <YYYY>
  --agency-name <name>              POS.Source.AgencyName
  --agency-iata <id>                POS.Source.RequestorID.Id
  --pcc <code>                      POS.Source.PseudoCityCode
  --agency-street-number <s>
  --agency-address-line <s>
  --agency-city <s>
  --agency-country <ISO-2>
  --billing-address-line <s>        Cardholder billing address; repeatable
  --billing-city <s>
  --billing-country <ISO-2>

Optional:
  --email <addr>                    Guest email
  --card-cvc <code>
  --cardholder-first-name <name>    Defaults to --first-name
  --cardholder-last-name <name>     Defaults to --last-name
  --agency-state <s>
  --agency-postal-code <s>
  --agency-contact-phone <s>
  --billing-state <s>
  --billing-postal-code <s>
  --target-city <pcc>               Sabre targetCity PCC
  --halt-on-error true|false        Default: true — halt on hotel supplier errors
  --body <json>                     Override input with raw JSON (ignores other flags)
  --base-url <url>                  Override SABRE_BASE_URL
  --format json|table               Output format (default: json). Table is a single-row summary.
  --debug-request                   Print the outbound HTTP request to stderr
  -h, --help                        Show this help

Example (relies on SABRE_TEST_CARD_* env vars):
  sabre-rest book-hotel \\
    --booking-key "\$BOOKING_KEY" \\
    --first-name Test --last-name Booking --phone 817-555-1212 \\
    --email test@sabre.com \\
    --agency-name 'Really Trustworthy Agency' --agency-iata 12345678 --pcc TM61 \\
    --agency-street-number '3150 SABRE DRIVE' --agency-address-line 'SABRE TRAVEL' \\
    --agency-city SOUTHLAKE --agency-state TX --agency-country US --agency-postal-code 76092 \\
    --billing-address-line 'Wadowicka 6' --billing-city Krakow --billing-country PL \\
    --format json
`;

const HOTEL_PRICE_CHECK_HELP = `Usage: sabre-rest hotel-price-check [flags]

Sabre Hotel Price Check v5. Revalidates a shopped hotel rate and returns
the booking key needed by the downstream hotel-booking call.

Note: the rate-key comes from a prior Sabre hotel-price / shop response.
The library does NOT currently wrap such an API — hotel-search v2 returns
property content only, not rates. Supply --rate-key from another source.

Flags:
  --rate-key <key>          Opaque rate key from a prior shop response (required unless --body)
  --pcc <code>              Optional branch PCC (POS/Source)
  --corporate-number <n>    Optional corporate number
  --start-date <YYYY-MM-DD> Optional stay start date (must pair with --end-date)
  --end-date <YYYY-MM-DD>   Optional stay end date (must pair with --start-date)
  --room <spec>             Repeatable; ADULTS[:CHILDREN[:AGES]]
                            (e.g. 2, 2:1:10, 1:2:8,10). Index is 1-based in flag order.
  --body <json>             Override input with raw JSON (ignores other flags)
  --base-url <url>          Override SABRE_BASE_URL
  --format json|table       Output format (default: json). Table is a single-row summary.
  --debug-request           Print the outbound HTTP request to stderr
  -h, --help                Show this help

Examples:
  sabre-rest hotel-price-check --rate-key 'NFZ6Y...==' --format table
  sabre-rest hotel-price-check --rate-key 'KEY' --start-date 2026-06-20 --end-date 2026-06-22 \\
    --room 2:1:10
`;

const REVALIDATE_HELP = `Usage: sabre-rest revalidate-itinerary [flags]

Sabre Revalidate Itinerary v5. Rechecks availability and pricing for a
specific itinerary without booking.

Flags (single-leg / single-flight shorthand):
  --from <iata>             Origin IATA code (required unless --body)
  --to <iata>               Destination IATA code (required unless --body)
  --departure-date <iso>    Departure local date or date-time (required unless --body)
  --carrier <iata>          Marketing carrier code (required unless --body)
  --flight-number <n>       Flight number (required unless --body)
  --flight-depart <iso>     Flight departure date-time (required unless --body)
  --flight-arrive <iso>     Flight arrival date-time (required unless --body)
  --flight-from <iata>      Segment origin (defaults to --from)
  --flight-to <iata>        Segment destination (defaults to --to)
  --class <rbd>             Booking class, e.g. Y, J, M (optional, enables verification path)
  --pax <type:count>        Passenger group, repeatable (default: ADT:1)
  --company-code <code>     Agency company code. Defaults to TN.
  --pcc <code>              Optional pseudo city code
  --body <json>             Override input with raw JSON (ignores other flags).
                            Use this for multi-leg or connecting itineraries.
  --base-url <url>          Override SABRE_BASE_URL
  --format json|table       Output format (default: json). Table is a one-row-per-itinerary summary.
  --debug-request           Print the outbound HTTP request to stderr
  -h, --help                Show this help

Examples:
  sabre-rest revalidate-itinerary --from JFK --to LHR \\
    --departure-date 2025-12-25 --carrier BA --flight-number 178 \\
    --flight-depart 2025-12-25T21:00:00 --flight-arrive 2025-12-26T09:00:00 \\
    --class Y
`;

/**
 * Converts a Revalidate Itinerary v5 output into a one-row-per-itinerary
 * summary table. Reuses the same column layout as BFM since the GIR
 * response format is shared.
 */
export function revalidateToTableRows(out: RevalidateItineraryOutput): {
  headers: readonly string[];
  rows: readonly string[][];
} {
  const rows = out.itineraries.map((itin: PricedItinerary) => [
    itin.id !== undefined ? String(itin.id) : '?',
    itin.legs.map(summarizeLeg).join(' | '),
    formatTotalFare(itin),
    itin.validatingCarrierCode ?? '',
    itin.distributionModel ?? '',
  ]);
  return { headers: ['id', 'legs', 'total', 'carrier', 'model'], rows };
}

const CREATE_BOOKING_HELP = `Usage: sabre-rest create-booking [flags]

Sabre Booking Management v1 — Create Booking. Creates an air booking
(NDC, ATPCO, or LCC).

The request body is complex (flights, travelers, payment, etc.), so use
--body to supply the full JSON input.

Flags:
  --body <json>             Full JSON CreateBookingInput (required)
  --base-url <url>          Override SABRE_BASE_URL
  --format json|table       Output format (default: json)
  --debug-request           Print the outbound HTTP request to stderr
  -h, --help                Show this help

Examples:
  sabre-rest create-booking --body '{"flightDetails":{"flights":[{"flightNumber":100,"airlineCode":"AA","fromAirportCode":"DFW","toAirportCode":"LAX","departureDate":"2026-05-15","departureTime":"10:00","bookingClass":"Y"}]},"travelers":[{"givenName":"JOHN","surname":"DOE","passengerCode":"ADT"}],"contactInfo":{"phones":["1234567890"]}}'
`;

const EXCHANGE_BOOKING_HELP = `Usage: sabre-rest exchange-booking [flags]

Sabre Exchange Booking v1.1.0. Runs an entire ticket-exchange transaction
against an existing PNR in a single call: optionally cancel selected
segments, optionally sell new segments, price the exchange (creating a
Price Quote Reissue), optionally collect form-of-payment, and end-transact.

Pair with bargain-finder-max + revalidate-itinerary for the full
"change a flight" flow. Omit "confirm" in the body to quote-only (PQR
stored, no FOP charged); include "confirm" to commit (FOP charged,
ticket issued).

The request body has many optional sub-blocks (Cancel, AirBook,
priceTolerance, confirm, email), so use --body to supply the full JSON
ExchangeFlightInput.

Flags:
  --body <json>             Full JSON ExchangeFlightInput (required)
  --base-url <url>          Override SABRE_BASE_URL
  --format json|table       Output format (default: json)
  --debug-request           Print the outbound HTTP request to stderr
  -h, --help                Show this help

Examples:
  sabre-rest exchange-booking --body '{"pnrLocator":"IJNPIE","originalTicketNumber":"0277173836173","receivedFrom":"SP TEST","cancelSegments":[1,2],"newSegments":[{"origin":"LAS","destination":"DFW","departureDateTime":"2026-05-03T06:00:00","arrivalDateTime":"2026-05-03T17:30:00","marketingCarrier":"AS","flightNumber":"781","bookingClass":"G"}],"priceTolerance":{"amountSpecified":0,"acceptableIncrease":{"amount":10,"haltOnNonAcceptablePrice":true}}}'
`;

const FLIGHT_RESHOP_HELP = `Usage: sabre-rest flight-reshop [flags]

Sabre Flight Reshop v1.0. Shops for priceable reissue offers against an
existing ticket — the REST replacement for the legacy ExchangeShoppingRQ.
Returns exchange offers with fare difference, change fee, and new flights.

Read-only: it does not cancel, rebook, or reissue. The call resolves with
HTTP 200 even when no offers can be produced (the reason lands in the
response "errors" array), so inspect "errors" as well as "offers".

The request body has nested journeys[] and tickets[] arrays, so this
command is body-only. Supply a full JSON FlightReshopInput via --body.

Flags:
  --body <json>             Full JSON FlightReshopInput (required)
  --base-url <url>          Override SABRE_BASE_URL
  --format json|table       Output format (default: json)
  --debug-request           Print the outbound HTTP request to stderr
  -h, --help                Show this help

Examples:
  sabre-rest flight-reshop --body '{"journeys":[{"departureLocation":{"cityCode":"DFW"},"arrivalLocation":{"cityCode":"LAX"},"departureDate":"2026-09-26"}],"tickets":[{"number":"0012972101507"}]}'
`;

const GET_ANCILLARIES_HELP = `Usage: sabre-rest get-ancillaries [flags]

Sabre Get Ancillaries v2. Retrieves ancillary services (baggage, seats,
meals, etc.) for a given Sabre order in NDC format.

Flags:
  --order-id <id>           Sabre order ID (required unless --body)
  --segment-refs <list>     Comma-separated segment ref IDs (optional filter)
  --passenger-refs <list>   Comma-separated passenger ref IDs (optional filter)
  --group-code <code>       ATPCO group code filter, e.g. BG (optional)
  --body <json>             Override input with raw JSON (ignores other flags)
  --base-url <url>          Override SABRE_BASE_URL
  --format json|table       Output format (default: json)
  --debug-request           Print the outbound HTTP request to stderr
  -h, --help                Show this help

Examples:
  sabre-rest get-ancillaries --order-id SRVC-2B88-4C33-9787-9461114BC9BE
  sabre-rest get-ancillaries --order-id SRVC-2B88 --group-code BG
`;

const GET_BOOKING_HELP = `Usage: sabre-rest get-booking [flags]

Sabre Booking Management v1 — Get Booking. Retrieves comprehensive
booking details by confirmation ID.

Flags:
  --confirmation-id <id>        Confirmation ID / PNR locator (required unless --body)
  --booking-source <src>        SABRE | SABRE_ORDER (defaults to SABRE)
  --target-pcc <pcc>            Pseudo city code for the call context
  --given-name <name>           Traveler given name for verification
  --middle-name <name>          Traveler middle name for verification
  --surname <name>              Traveler surname for verification
  --return-only <list>          Comma-separated response section filter (e.g. FLIGHTS,TRAVELERS)
  --unmask-payment-card-numbers Unmask payment card numbers (requires CCVIEW EPR)
  --body <json>                 Override input with raw JSON (ignores other flags)
  --base-url <url>              Override SABRE_BASE_URL
  --format json|table           Output format (default: json)
  --debug-request               Print the outbound HTTP request to stderr
  -h, --help                    Show this help

Examples:
  sabre-rest get-booking --confirmation-id GLEBNY
  sabre-rest get-booking --confirmation-id GLEBNY --return-only FLIGHTS,TRAVELERS
`;

const MODIFY_BOOKING_HELP = `Usage: sabre-rest modify-booking [flags]

Sabre Booking Management v1 — Modify Booking. Applies non-itinerary
changes to an existing booking by diffing before/after snapshots.

The request body requires paired before/after snapshots plus a
bookingSignature obtained via get-booking, so this command is
body-only.

Flags:
  --body <json>             Full JSON ModifyBookingInput (required)
  --base-url <url>          Override SABRE_BASE_URL
  --format json|table       Output format (default: json)
  --debug-request           Print the outbound HTTP request to stderr
  -h, --help                Show this help

Examples:
  sabre-rest modify-booking --body '{"confirmationId":"GLEBNY","bookingSignature":"sig-abc","before":{"remarks":[]},"after":{"remarks":[{"type":"GENERAL","text":"flow-test note"}]},"retrieveBooking":true}'
`;

const CANCEL_BOOKING_HELP = `Usage: sabre-rest cancel-booking [flags]

Sabre Booking Management v1 — Cancel Booking. Cancels a booking or
specified booking items, optionally voiding or refunding related
flight tickets in the same call.

Flags:
  --confirmation-id <id>              Confirmation ID / PNR locator (required unless --body)
  --cancel-all                        Cancel all segments of all kinds
  --retrieve-booking                  Include post-cancel booking state in the response
  --flight-ticket-operation <op>      VOID | REFUND — bundle ticket operation with cancellation
  --error-handling-policy <policy>    HALT_ON_ERROR (default) | ALLOW_PARTIAL_CANCEL
  --flights <list>                    Comma-separated flight itemIds to cancel
  --hotels <list>                     Comma-separated hotel itemIds
  --cars <list>                       Comma-separated car itemIds
  --trains <list>                     Comma-separated train itemIds
  --cruises <list>                    Comma-separated cruise itemIds
  --booking-source <src>              SABRE | SABRE_ORDER
  --target-pcc <pcc>                  Pseudo city code for the call context
  --received-from <string>            Entity authorizing the changes
  --body <json>                       Override input with raw JSON (ignores other flags)
  --base-url <url>                    Override SABRE_BASE_URL
  --format json|table                 Output format (default: json)
  --debug-request                     Print the outbound HTTP request to stderr
  -h, --help                          Show this help

Examples:
  sabre-rest cancel-booking --confirmation-id GLEBNY --cancel-all
  sabre-rest cancel-booking --confirmation-id GLEBNY --flights 1,2 --flight-ticket-operation VOID
`;

const GET_SEATS_HELP = `Usage: sabre-rest get-seats [flags]

Sabre Get Seats v2. Retrieves seat availability and pricing information.

The input is a discriminated union with four request types (offerId,
orderId, payload, stateless). Use --body to supply the full JSON input.

Flags:
  --body <json>             Full JSON input (required). Set requestType to one
                            of: offerId, orderId, payload, stateless.
  --base-url <url>          Override SABRE_BASE_URL
  --format json|table       Output format (default: json)
  --debug-request           Print the outbound HTTP request to stderr
  -h, --help                Show this help

Examples:
  sabre-rest get-seats --body '{"requestType":"orderId","pointOfSale":{"countryCode":"US","cityCode":"TPA"},"orderId":"ORDER-123"}'
  sabre-rest get-seats --body '{"requestType":"stateless","pnrLocator":"ABC123"}'
`;

const CHECK_TICKETS_HELP = `Usage: sabre-rest check-tickets [flags]

Sabre Booking Management v1 — Check Tickets. Read-only check of per-
ticket eligibility for void, refund, and exchange. Does not mutate the
booking.

Provide --confirmation-id to scope by PNR, --tickets to scope by ticket
numbers, or both. Or supply a full --body to bypass flag-based input.

Flags:
  --confirmation-id <id>        Confirmation ID / PNR locator (required unless --tickets or --body)
  --tickets <list>              Comma-separated 13-char ticket numbers (optionally with /NN suffix)
  --target-pcc <pcc>            Pseudo city code for the call context
  --body <json>                 Override input with raw JSON (ignores other flags)
  --base-url <url>              Override SABRE_BASE_URL
  --format json|table           Output format (default: json)
  --debug-request               Print the outbound HTTP request to stderr
  -h, --help                    Show this help

Examples:
  sabre-rest check-tickets --confirmation-id GLEBNY
  sabre-rest check-tickets --tickets 0011234567890,0011234567891
`;

const FULFILL_TICKETS_HELP = `Usage: sabre-rest fulfill-tickets [flags]

Sabre Booking Management v1 — Fulfill Flight Tickets. Issues electronic
tickets (and EMDs) for an existing PNR or NDC order. This is a billable
operation — once fulfillment succeeds, void or refund is required to
reverse it.

The request body needs nested fulfillments[] and formsOfPayment[]
arrays, so this command is body-only.

Flags:
  --body <json>             Full JSON FulfillTicketsInput (required)
  --base-url <url>          Override SABRE_BASE_URL
  --format json|table       Output format (default: json)
  --debug-request           Print the outbound HTTP request to stderr
  -h, --help                Show this help

Examples:
  sabre-rest fulfill-tickets --body '{"confirmationId":"GLEBNY","fulfillments":[{}],"formsOfPayment":[{"type":"PAYMENTCARD","cardTypeCode":"VI","cardNumber":"4111111111111111","cardSecurityCode":"123","expiryDate":"2027-12"}]}'
`;

const VOID_TICKETS_HELP = `Usage: sabre-rest void-tickets [flags]

Sabre Booking Management v1 — Void Tickets. Voids electronic tickets or
EMDs (same-day, no fee). Provide --confirmation-id to void by PNR scope,
--tickets to void specific ticket numbers, or both.

Flags:
  --confirmation-id <id>              Confirmation ID / PNR locator (required unless --tickets or --body)
  --tickets <list>                    Comma-separated 13-char ticket numbers (optionally with /NN suffix)
  --target-pcc <pcc>                  Pseudo city code for the call context
  --received-from <string>            Entity authorizing the changes
  --error-handling-policy <policy>    HALT_ON_ERROR | ALLOW_PARTIAL_CANCEL
  --void-non-electronic-tickets       Include paper (non-electronic) tickets
  --body <json>                       Override input with raw JSON (ignores other flags)
  --base-url <url>                    Override SABRE_BASE_URL
  --format json|table                 Output format (default: json)
  --debug-request                     Print the outbound HTTP request to stderr
  -h, --help                          Show this help

Examples:
  sabre-rest void-tickets --confirmation-id GLEBNY
  sabre-rest void-tickets --tickets 0011234567890
`;

const REFUND_TICKETS_HELP = `Usage: sabre-rest refund-tickets [flags]

Sabre Booking Management v1 — Refund Tickets. Refunds electronic
tickets after the void window has closed (fees may apply). Provide
--confirmation-id, --tickets, or both.

Flag-based input wraps each ticket number as { number }. To pass refund
qualifiers (waiver code, override taxes, journey type, etc.), supply a
full --body instead.

Flags:
  --confirmation-id <id>              Confirmation ID / PNR locator (required unless --tickets or --body)
  --tickets <list>                    Comma-separated 13-char ticket numbers (optionally with /NN suffix)
  --target-pcc <pcc>                  Pseudo city code for the call context
  --received-from <string>            Entity authorizing the changes
  --error-handling-policy <policy>    HALT_ON_ERROR | ALLOW_PARTIAL_CANCEL
  --body <json>                       Override input with raw JSON (ignores other flags)
  --base-url <url>                    Override SABRE_BASE_URL
  --format json|table                 Output format (default: json)
  --debug-request                     Print the outbound HTTP request to stderr
  -h, --help                          Show this help

Examples:
  sabre-rest refund-tickets --confirmation-id GLEBNY --tickets 0011234567890
`;

// ---------------------------------------------------------------------------
// Command handlers
// ---------------------------------------------------------------------------

/**
 * Streams the user can write to. Defaults to `process.stdout` /
 * `process.stderr` in the real entry point, but tests can substitute
 * in-memory writers.
 */
export interface CliIo {
  stdout: { write(s: string): void };
  stderr: { write(s: string): void };
}

const realIo: CliIo = {
  stdout: { write: (s) => process.stdout.write(s) },
  stderr: { write: (s) => process.stderr.write(s) },
};

async function airlineLookupCommand(
  argv: readonly string[],
  env: CliEnvConfig,
  io: CliIo,
): Promise<void> {
  const { values } = parseArgs({
    args: argv as string[],
    options: AIRLINE_LOOKUP_OPTIONS,
    allowPositionals: false,
    strict: true,
  });
  if (values.help === true) {
    io.stdout.write(AIRLINE_LOOKUP_HELP);
    return;
  }
  const format = parseOutputFormat(values.format);
  const config = resolveClientConfig(env, { baseUrl: values['base-url'] });
  const mw = values['debug-request'] ? [createDebugRequestMiddleware(io)] : undefined;
  const client = buildClient(config, mw);
  const input = buildAirlineLookupInput(values);
  const result = await client.airlineLookupV1.lookup(input);
  emitResult(result, format, io, () => {
    const { headers, rows } = airlinesToTableRows(result);
    return renderTable(headers, rows);
  });
}

async function airlineAllianceLookupCommand(
  argv: readonly string[],
  env: CliEnvConfig,
  io: CliIo,
): Promise<void> {
  const { values } = parseArgs({
    args: argv as string[],
    options: AIRLINE_LOOKUP_OPTIONS,
    allowPositionals: false,
    strict: true,
  });
  if (values.help === true) {
    io.stdout.write(AIRLINE_ALLIANCE_LOOKUP_HELP);
    return;
  }
  const format = parseOutputFormat(values.format);
  const config = resolveClientConfig(env, { baseUrl: values['base-url'] });
  const mw = values['debug-request'] ? [createDebugRequestMiddleware(io)] : undefined;
  const client = buildClient(config, mw);
  const input = buildAirlineAllianceLookupInput(values);
  const result = await client.airlineAllianceLookupV1.lookup(input);
  emitResult(result, format, io, () => {
    const { headers, rows } = alliancesToTableRows(result);
    return renderTable(headers, rows);
  });
}

async function bargainFinderMaxCommand(
  argv: readonly string[],
  env: CliEnvConfig,
  io: CliIo,
): Promise<void> {
  const { values } = parseArgs({
    args: argv as string[],
    options: BFM_OPTIONS,
    allowPositionals: false,
    strict: true,
  });
  if (values.help === true) {
    io.stdout.write(BFM_HELP);
    return;
  }
  const format = parseOutputFormat(values.format);
  const config = resolveClientConfig(env, { baseUrl: values['base-url'] });
  const mw = values['debug-request'] ? [createDebugRequestMiddleware(io)] : undefined;
  const client = buildClient(config, mw);
  const input = buildBfmInput(values, env);
  const result = await client.bargainFinderMaxV5.search(input);
  emitResult(result, format, io, () => {
    const { headers, rows } = bfmToTableRows(result);
    return renderTable(headers, rows);
  });
}

async function getHotelAvailCommand(
  argv: readonly string[],
  env: CliEnvConfig,
  io: CliIo,
): Promise<void> {
  const { values } = parseArgs({
    args: argv as string[],
    options: HOTEL_AVAIL_OPTIONS,
    allowPositionals: false,
    strict: true,
  });
  if (values.help === true) {
    io.stdout.write(HOTEL_AVAIL_HELP);
    return;
  }
  const format = parseOutputFormat(values.format);
  const config = resolveClientConfig(env, { baseUrl: values['base-url'] });
  const mw = values['debug-request'] ? [createDebugRequestMiddleware(io)] : undefined;
  const client = buildClient(config, mw);
  const input = buildHotelAvailInput(values);
  const result = await client.getHotelAvailV5.getAvail(input);
  emitResult(result, format, io, () => {
    const { headers, rows } = availToTableRows(result);
    return renderTable(headers, rows);
  });
}

async function getHotelRateInfoCommand(
  argv: readonly string[],
  env: CliEnvConfig,
  io: CliIo,
): Promise<void> {
  const { values } = parseArgs({
    args: argv as string[],
    options: HOTEL_RATE_INFO_OPTIONS,
    allowPositionals: false,
    strict: true,
  });
  if (values.help === true) {
    io.stdout.write(HOTEL_RATE_INFO_HELP);
    return;
  }
  const format = parseOutputFormat(values.format);
  const config = resolveClientConfig(env, { baseUrl: values['base-url'] });
  const mw = values['debug-request'] ? [createDebugRequestMiddleware(io)] : undefined;
  const client = buildClient(config, mw);
  const input = buildHotelRateInfoInput(values);
  const result = await client.getHotelRateInfoV5.getRateInfo(input);
  emitResult(result, format, io, () => {
    const { headers, rows } = rateInfoToTableRows(result);
    return renderTable(headers, rows);
  });
}

async function getHotelDetailsCommand(
  argv: readonly string[],
  env: CliEnvConfig,
  io: CliIo,
): Promise<void> {
  const { values } = parseArgs({
    args: argv as string[],
    options: HOTEL_DETAILS_OPTIONS,
    allowPositionals: false,
    strict: true,
  });
  if (values.help === true) {
    io.stdout.write(HOTEL_DETAILS_HELP);
    return;
  }
  const format = parseOutputFormat(values.format);
  const config = resolveClientConfig(env, { baseUrl: values['base-url'] });
  const mw = values['debug-request'] ? [createDebugRequestMiddleware(io)] : undefined;
  const client = buildClient(config, mw);
  const input = buildHotelDetailsInput(values);
  const result = await client.getHotelDetailsV5.getDetails(input);
  emitResult(result, format, io, () => {
    const { headers, rows } = detailsToTableRows(result);
    return renderTable(headers, rows);
  });
}

async function hotelPriceCheckCommand(
  argv: readonly string[],
  env: CliEnvConfig,
  io: CliIo,
): Promise<void> {
  const { values } = parseArgs({
    args: argv as string[],
    options: HOTEL_PRICE_CHECK_OPTIONS,
    allowPositionals: false,
    strict: true,
  });
  if (values.help === true) {
    io.stdout.write(HOTEL_PRICE_CHECK_HELP);
    return;
  }
  const format = parseOutputFormat(values.format);
  const config = resolveClientConfig(env, { baseUrl: values['base-url'] });
  const mw = values['debug-request'] ? [createDebugRequestMiddleware(io)] : undefined;
  const client = buildClient(config, mw);
  const input = buildHotelPriceCheckInput(values);
  const result = await client.hotelPriceCheckV5.check(input);
  emitResult(result, format, io, () => {
    const { headers, rows } = priceCheckToTableRows(result);
    return renderTable(headers, rows);
  });
}

async function bookHotelCommand(
  argv: readonly string[],
  env: CliEnvConfig,
  io: CliIo,
): Promise<void> {
  const { values } = parseArgs({
    args: argv as string[],
    options: BOOK_HOTEL_OPTIONS,
    allowPositionals: false,
    strict: true,
  });
  if (values.help === true) {
    io.stdout.write(BOOK_HOTEL_HELP);
    return;
  }
  const format = parseOutputFormat(values.format);
  const config = resolveClientConfig(env, { baseUrl: values['base-url'] });
  const mw = values['debug-request'] ? [createDebugRequestMiddleware(io)] : undefined;
  const client = buildClient(config, mw);
  const cardEnv = readBookHotelCardEnv(process.env);
  const input = buildBookHotelInput(values, cardEnv);
  const result = await client.createPassengerNameRecordV25.bookHotel(input);
  emitResult(result, format, io, () => formatJson(result));
}

async function hotelSearchCommand(
  argv: readonly string[],
  env: CliEnvConfig,
  io: CliIo,
): Promise<void> {
  const { values } = parseArgs({
    args: argv as string[],
    options: HOTEL_SEARCH_OPTIONS,
    allowPositionals: false,
    strict: true,
  });
  if (values.help === true) {
    io.stdout.write(HOTEL_SEARCH_HELP);
    return;
  }
  const format = parseOutputFormat(values.format);
  const config = resolveClientConfig(env, { baseUrl: values['base-url'] });
  const mw = values['debug-request'] ? [createDebugRequestMiddleware(io)] : undefined;
  const client = buildClient(config, mw);
  const input = buildHotelSearchInput(values);
  const result = await client.hotelSearchV2.search(input);
  emitResult(result, format, io, () => {
    const { headers, rows } = hotelsToTableRows(result);
    return renderTable(headers, rows);
  });
}

/**
 * Writes a result to stdout in the requested format. The `tableFn`
 * callback only runs when `format === 'table'`, so commands that don't
 * support a sensible table representation can pass a stub or fall back
 * to JSON before calling here.
 */
function emitResult(result: unknown, format: OutputFormat, io: CliIo, tableFn: () => string): void {
  if (format === 'table') {
    io.stdout.write(`${tableFn()}\n`);
  } else {
    io.stdout.write(`${formatJson(result)}\n`);
  }
}

async function revalidateItineraryCommand(
  argv: readonly string[],
  env: CliEnvConfig,
  io: CliIo,
): Promise<void> {
  const { values } = parseArgs({
    args: argv as string[],
    options: REVALIDATE_OPTIONS,
    allowPositionals: false,
    strict: true,
  });
  if (values.help === true) {
    io.stdout.write(REVALIDATE_HELP);
    return;
  }
  const format = parseOutputFormat(values.format);
  const config = resolveClientConfig(env, { baseUrl: values['base-url'] });
  const mw = values['debug-request'] ? [createDebugRequestMiddleware(io)] : undefined;
  const client = buildClient(config, mw);
  const input = buildRevalidateInput(values, env);
  const result = await client.revalidateItineraryV5.revalidate(input);
  emitResult(result, format, io, () => {
    const { headers, rows } = revalidateToTableRows(result);
    return renderTable(headers, rows);
  });
}

async function createBookingCommand(
  argv: readonly string[],
  env: CliEnvConfig,
  io: CliIo,
): Promise<void> {
  const { values } = parseArgs({
    args: argv as string[],
    options: CREATE_BOOKING_OPTIONS,
    allowPositionals: false,
    strict: true,
  });
  if (values.help === true) {
    io.stdout.write(CREATE_BOOKING_HELP);
    return;
  }
  const format = parseOutputFormat(values.format);
  const config = resolveClientConfig(env, { baseUrl: values['base-url'] });
  const mw = values['debug-request'] ? [createDebugRequestMiddleware(io)] : undefined;
  const client = buildClient(config, mw);
  if (values.body === undefined) {
    throw new CliUsageError('create-booking requires --body with a full JSON input.');
  }
  const input = JSON.parse(values.body) as CreateBookingInput;
  const result = await client.bookingManagementV1.createBooking(input);
  emitResult(result, format, io, () => formatJson(result));
}

async function exchangeBookingCommand(
  argv: readonly string[],
  env: CliEnvConfig,
  io: CliIo,
): Promise<void> {
  const { values } = parseArgs({
    args: argv as string[],
    options: EXCHANGE_BOOKING_OPTIONS,
    allowPositionals: false,
    strict: true,
  });
  if (values.help === true) {
    io.stdout.write(EXCHANGE_BOOKING_HELP);
    return;
  }
  const format = parseOutputFormat(values.format);
  const config = resolveClientConfig(env, { baseUrl: values['base-url'] });
  const mw = values['debug-request'] ? [createDebugRequestMiddleware(io)] : undefined;
  const client = buildClient(config, mw);
  if (values.body === undefined) {
    throw new CliUsageError('exchange-booking requires --body with a full JSON input.');
  }
  const input = JSON.parse(values.body) as ExchangeFlightInput;
  const result = await client.exchangeBookingV1.exchange(input);
  emitResult(result, format, io, () => formatJson(result));
}

async function flightReshopCommand(
  argv: readonly string[],
  env: CliEnvConfig,
  io: CliIo,
): Promise<void> {
  const { values } = parseArgs({
    args: argv as string[],
    options: FLIGHT_RESHOP_OPTIONS,
    allowPositionals: false,
    strict: true,
  });
  if (values.help === true) {
    io.stdout.write(FLIGHT_RESHOP_HELP);
    return;
  }
  const format = parseOutputFormat(values.format);
  const config = resolveClientConfig(env, { baseUrl: values['base-url'] });
  const mw = values['debug-request'] ? [createDebugRequestMiddleware(io)] : undefined;
  const client = buildClient(config, mw);
  if (values.body === undefined) {
    throw new CliUsageError('flight-reshop requires --body with a full JSON input.');
  }
  const input = JSON.parse(values.body) as FlightReshopInput;
  const result = await client.flightReshopV1.reshop(input);
  emitResult(result, format, io, () => formatJson(result));
}

async function getBookingCommand(
  argv: readonly string[],
  env: CliEnvConfig,
  io: CliIo,
): Promise<void> {
  const { values } = parseArgs({
    args: argv as string[],
    options: GET_BOOKING_OPTIONS,
    allowPositionals: false,
    strict: true,
  });
  if (values.help === true) {
    io.stdout.write(GET_BOOKING_HELP);
    return;
  }
  const format = parseOutputFormat(values.format);
  const config = resolveClientConfig(env, { baseUrl: values['base-url'] });
  const mw = values['debug-request'] ? [createDebugRequestMiddleware(io)] : undefined;
  const client = buildClient(config, mw);
  const input = buildGetBookingInput(values);
  const result = await client.bookingManagementV1.getBooking(input);
  emitResult(result, format, io, () => formatJson(result));
}

async function modifyBookingCommand(
  argv: readonly string[],
  env: CliEnvConfig,
  io: CliIo,
): Promise<void> {
  const { values } = parseArgs({
    args: argv as string[],
    options: MODIFY_BOOKING_OPTIONS,
    allowPositionals: false,
    strict: true,
  });
  if (values.help === true) {
    io.stdout.write(MODIFY_BOOKING_HELP);
    return;
  }
  const format = parseOutputFormat(values.format);
  const config = resolveClientConfig(env, { baseUrl: values['base-url'] });
  const mw = values['debug-request'] ? [createDebugRequestMiddleware(io)] : undefined;
  const client = buildClient(config, mw);
  const input = buildModifyBookingInput(values);
  const result = await client.bookingManagementV1.modifyBooking(input);
  emitResult(result, format, io, () => formatJson(result));
}

async function cancelBookingCommand(
  argv: readonly string[],
  env: CliEnvConfig,
  io: CliIo,
): Promise<void> {
  const { values } = parseArgs({
    args: argv as string[],
    options: CANCEL_BOOKING_OPTIONS,
    allowPositionals: false,
    strict: true,
  });
  if (values.help === true) {
    io.stdout.write(CANCEL_BOOKING_HELP);
    return;
  }
  const format = parseOutputFormat(values.format);
  const config = resolveClientConfig(env, { baseUrl: values['base-url'] });
  const mw = values['debug-request'] ? [createDebugRequestMiddleware(io)] : undefined;
  const client = buildClient(config, mw);
  const input = buildCancelBookingInput(values);
  const result = await client.bookingManagementV1.cancelBooking(input);
  emitResult(result, format, io, () => formatJson(result));
}

async function getAncillariesCommand(
  argv: readonly string[],
  env: CliEnvConfig,
  io: CliIo,
): Promise<void> {
  const { values } = parseArgs({
    args: argv as string[],
    options: GET_ANCILLARIES_OPTIONS,
    allowPositionals: false,
    strict: true,
  });
  if (values.help === true) {
    io.stdout.write(GET_ANCILLARIES_HELP);
    return;
  }
  const format = parseOutputFormat(values.format);
  const config = resolveClientConfig(env, { baseUrl: values['base-url'] });
  const mw = values['debug-request'] ? [createDebugRequestMiddleware(io)] : undefined;
  const client = buildClient(config, mw);
  const input = buildGetAncillariesInput(values);
  const result = await client.getAncillariesV2.getAncillaries(input);
  emitResult(result, format, io, () => formatJson(result));
}

async function getSeatsCommand(
  argv: readonly string[],
  env: CliEnvConfig,
  io: CliIo,
): Promise<void> {
  const { values } = parseArgs({
    args: argv as string[],
    options: GET_SEATS_OPTIONS,
    allowPositionals: false,
    strict: true,
  });
  if (values.help === true) {
    io.stdout.write(GET_SEATS_HELP);
    return;
  }
  const format = parseOutputFormat(values.format);
  const config = resolveClientConfig(env, { baseUrl: values['base-url'] });
  const mw = values['debug-request'] ? [createDebugRequestMiddleware(io)] : undefined;
  const client = buildClient(config, mw);
  if (values.body === undefined) {
    throw new CliUsageError('get-seats requires --body with a full JSON input.');
  }
  const input = JSON.parse(values.body) as GetSeatsInput;
  const result = await client.getSeatsV2.getSeats(input);
  emitResult(result, format, io, () => formatJson(result));
}

async function checkTicketsCommand(
  argv: readonly string[],
  env: CliEnvConfig,
  io: CliIo,
): Promise<void> {
  const { values } = parseArgs({
    args: argv as string[],
    options: CHECK_TICKETS_OPTIONS,
    allowPositionals: false,
    strict: true,
  });
  if (values.help === true) {
    io.stdout.write(CHECK_TICKETS_HELP);
    return;
  }
  const format = parseOutputFormat(values.format);
  const config = resolveClientConfig(env, { baseUrl: values['base-url'] });
  const mw = values['debug-request'] ? [createDebugRequestMiddleware(io)] : undefined;
  const client = buildClient(config, mw);
  const input = buildCheckTicketsInput(values);
  const result = await client.bookingManagementV1.checkTickets(input);
  emitResult(result, format, io, () => formatJson(result));
}

async function fulfillTicketsCommand(
  argv: readonly string[],
  env: CliEnvConfig,
  io: CliIo,
): Promise<void> {
  const { values } = parseArgs({
    args: argv as string[],
    options: FULFILL_TICKETS_OPTIONS,
    allowPositionals: false,
    strict: true,
  });
  if (values.help === true) {
    io.stdout.write(FULFILL_TICKETS_HELP);
    return;
  }
  const format = parseOutputFormat(values.format);
  const config = resolveClientConfig(env, { baseUrl: values['base-url'] });
  const mw = values['debug-request'] ? [createDebugRequestMiddleware(io)] : undefined;
  const client = buildClient(config, mw);
  const input = buildFulfillTicketsInput(values);
  const result = await client.bookingManagementV1.fulfillTickets(input);
  emitResult(result, format, io, () => formatJson(result));
}

async function voidTicketsCommand(
  argv: readonly string[],
  env: CliEnvConfig,
  io: CliIo,
): Promise<void> {
  const { values } = parseArgs({
    args: argv as string[],
    options: VOID_TICKETS_OPTIONS,
    allowPositionals: false,
    strict: true,
  });
  if (values.help === true) {
    io.stdout.write(VOID_TICKETS_HELP);
    return;
  }
  const format = parseOutputFormat(values.format);
  const config = resolveClientConfig(env, { baseUrl: values['base-url'] });
  const mw = values['debug-request'] ? [createDebugRequestMiddleware(io)] : undefined;
  const client = buildClient(config, mw);
  const input = buildVoidTicketsInput(values);
  const result = await client.bookingManagementV1.voidTickets(input);
  emitResult(result, format, io, () => formatJson(result));
}

async function refundTicketsCommand(
  argv: readonly string[],
  env: CliEnvConfig,
  io: CliIo,
): Promise<void> {
  const { values } = parseArgs({
    args: argv as string[],
    options: REFUND_TICKETS_OPTIONS,
    allowPositionals: false,
    strict: true,
  });
  if (values.help === true) {
    io.stdout.write(REFUND_TICKETS_HELP);
    return;
  }
  const format = parseOutputFormat(values.format);
  const config = resolveClientConfig(env, { baseUrl: values['base-url'] });
  const mw = values['debug-request'] ? [createDebugRequestMiddleware(io)] : undefined;
  const client = buildClient(config, mw);
  const input = buildRefundTicketsInput(values);
  const result = await client.bookingManagementV1.refundTickets(input);
  emitResult(result, format, io, () => formatJson(result));
}

/** Mapping from subcommand name to its handler. Exported so tests can introspect it. */
export const COMMANDS: Record<
  string,
  (argv: readonly string[], env: CliEnvConfig, io: CliIo) => Promise<void>
> = {
  'airline-lookup': airlineLookupCommand,
  'airline-alliance-lookup': airlineAllianceLookupCommand,
  'bargain-finder-max': bargainFinderMaxCommand,
  'book-hotel': bookHotelCommand,
  'cancel-booking': cancelBookingCommand,
  'check-tickets': checkTicketsCommand,
  'create-booking': createBookingCommand,
  'exchange-booking': exchangeBookingCommand,
  'flight-reshop': flightReshopCommand,
  'fulfill-tickets': fulfillTicketsCommand,
  'get-ancillaries': getAncillariesCommand,
  'get-booking': getBookingCommand,
  'get-hotel-avail': getHotelAvailCommand,
  'get-hotel-details': getHotelDetailsCommand,
  'get-hotel-rate-info': getHotelRateInfoCommand,
  'get-seats': getSeatsCommand,
  'hotel-price-check': hotelPriceCheckCommand,
  'hotel-search': hotelSearchCommand,
  'modify-booking': modifyBookingCommand,
  'refund-tickets': refundTicketsCommand,
  'revalidate-itinerary': revalidateItineraryCommand,
  'void-tickets': voidTicketsCommand,
};

// ---------------------------------------------------------------------------
// Top-level entry
// ---------------------------------------------------------------------------

/**
 * Headers worth surfacing in CLI error output for a non-2xx response.
 * Sabre's REST APIs use lower-case header names through `fetch`-style
 * runners, but consumers and proxies can normalize differently, so we
 * compare case-insensitively. Order in this list determines display
 * order in the error output.
 */
const NOTABLE_RESPONSE_HEADERS: readonly string[] = [
  'retry-after',
  'x-ratelimit-limit',
  'x-ratelimit-remaining',
  'x-ratelimit-reset',
];

/**
 * Picks the rate-limit / retry-related headers out of a response header
 * map and returns them in canonical display order. Header lookup is
 * case-insensitive. Returns an empty array when none of the notable
 * headers are present.
 */
export function pickNotableResponseHeaders(
  headers: Record<string, string> | undefined,
): readonly { name: string; value: string }[] {
  if (!headers) return [];
  const lowered = new Map<string, { name: string; value: string }>();
  for (const [name, value] of Object.entries(headers)) {
    lowered.set(name.toLowerCase(), { name, value });
  }
  const out: { name: string; value: string }[] = [];
  for (const key of NOTABLE_RESPONSE_HEADERS) {
    const hit = lowered.get(key);
    if (hit !== undefined) out.push(hit);
  }
  return out;
}

/**
 * Renders an error to stderr in a user-friendly form. CLI usage errors
 * print just the message; library errors print the class name, message,
 * and (for {@link SabreApiResponseError}) the status code, any
 * rate-limit / retry headers from the response, and the response body.
 */
export function renderError(err: unknown, io: CliIo): void {
  if (err instanceof CliUsageError) {
    io.stderr.write(`error: ${err.message}\n`);
    return;
  }
  if (err instanceof SabreApiResponseError) {
    io.stderr.write(`error: ${err.name}: ${err.message}\n`);
    io.stderr.write(`status: ${err.statusCode}\n`);
    for (const { name, value } of pickNotableResponseHeaders(err.responseHeaders)) {
      io.stderr.write(`${name}: ${value}\n`);
    }
    if (err.responseBody !== undefined) {
      const body =
        typeof err.responseBody === 'string' ? err.responseBody : formatJson(err.responseBody);
      io.stderr.write(`body: ${body}\n`);
    }
    return;
  }
  if (err instanceof SabreAuthenticationError) {
    io.stderr.write(`error: ${err.name}: ${err.message}\n`);
    if (err.statusCode !== undefined) {
      io.stderr.write(`status: ${err.statusCode}\n`);
    }
    for (const { name, value } of pickNotableResponseHeaders(err.responseHeaders)) {
      io.stderr.write(`${name}: ${value}\n`);
    }
    if (err.responseBody !== undefined) {
      const body =
        typeof err.responseBody === 'string' ? err.responseBody : formatJson(err.responseBody);
      io.stderr.write(`body: ${body}\n`);
    }
    return;
  }
  if (err instanceof SabreError) {
    io.stderr.write(`error: ${err.name}: ${err.message}\n`);
    return;
  }
  if (err instanceof Error) {
    io.stderr.write(`error: ${err.message}\n`);
    return;
  }
  io.stderr.write(`error: ${String(err)}\n`);
}

/**
 * The runnable entry point. Parses the leading subcommand, dispatches
 * to its handler, and renders any error. Returns the desired process
 * exit code (0 for success, 1 for failure) so the bin file can call
 * `process.exit(await run(...))`.
 */
export async function run(
  argv: readonly string[],
  env: NodeJS.ProcessEnv,
  io: CliIo = realIo,
): Promise<number> {
  if (argv.length === 0 || argv[0] === '--help' || argv[0] === '-h') {
    io.stdout.write(TOP_LEVEL_HELP);
    return 0;
  }
  const subcommand = argv[0] as string;
  const handler = COMMANDS[subcommand];
  if (!handler) {
    renderError(
      new CliUsageError(
        `Unknown command '${subcommand}'. Available: ${Object.keys(COMMANDS).join(', ')}.`,
      ),
      io,
    );
    return 1;
  }
  try {
    await handler(argv.slice(1), readEnvConfig(env), io);
    return 0;
  } catch (err) {
    renderError(err, io);
    return 1;
  }
}
