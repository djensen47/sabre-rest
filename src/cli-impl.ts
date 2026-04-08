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
import { SabreError } from './errors/sabre-error.js';
import type {
  Airline,
  AirlineAlliance,
  CabinClass,
  ItineraryLeg,
  LookupAirlineAlliancesInput,
  LookupAirlineAlliancesOutput,
  LookupAirlinesInput,
  LookupAirlinesOutput,
  PassengerCount,
  PricedItinerary,
  SearchBargainFinderMaxInput,
  SearchBargainFinderMaxOutput,
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
export function buildClient(config: ResolvedClientConfig): SabreClient {
  return createSabreClient({
    baseUrl: config.baseUrl,
    auth: createOAuthV2({
      baseUrl: config.baseUrl,
      clientId: config.clientId,
      clientSecret: config.clientSecret,
    }),
  });
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

// ---------------------------------------------------------------------------
// parseArgs option configurations
// ---------------------------------------------------------------------------

const COMMON_OPTIONS = {
  'base-url': { type: 'string' },
  format: { type: 'string' },
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

Common flags:
  --base-url <url>          Override SABRE_BASE_URL
  --format json|table       Output format (default: json)
  -h, --help                Show this help (or per-command help)

Environment:
  SABRE_CLIENT_ID           OAuth v2 client id (required)
  SABRE_CLIENT_SECRET       OAuth v2 client secret (required)
  SABRE_BASE_URL            Sabre base URL, e.g. https://api.cert.platform.sabre.com
  SABRE_COMPANY_CODE        Optional agency company code (bargain-finder-max)
  SABRE_PCC                 Optional pseudo city code (bargain-finder-max)

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
  -h, --help                Show this help

Examples:
  sabre-rest bargain-finder-max --from JFK --to LHR --departure-date 2025-12-25
  sabre-rest bargain-finder-max --from JFK --to LHR \\
    --departure-date 2025-12-25 --return-date 2026-01-05 \\
    --pax ADT:1 --pax CHD:1 --cabin Business --non-stop
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
  const client = buildClient(config);
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
  const client = buildClient(config);
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
  const client = buildClient(config);
  const input = buildBfmInput(values, env);
  const result = await client.bargainFinderMaxV5.search(input);
  emitResult(result, format, io, () => {
    const { headers, rows } = bfmToTableRows(result);
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

/** Mapping from subcommand name to its handler. Exported so tests can introspect it. */
export const COMMANDS: Record<
  string,
  (argv: readonly string[], env: CliEnvConfig, io: CliIo) => Promise<void>
> = {
  'airline-lookup': airlineLookupCommand,
  'airline-alliance-lookup': airlineAllianceLookupCommand,
  'bargain-finder-max': bargainFinderMaxCommand,
};

// ---------------------------------------------------------------------------
// Top-level entry
// ---------------------------------------------------------------------------

/**
 * Renders an error to stderr in a user-friendly form. CLI usage errors
 * print just the message; library errors print the class name, message,
 * and (for {@link SabreApiResponseError}) the status code and response
 * body.
 */
export function renderError(err: unknown, io: CliIo): void {
  if (err instanceof CliUsageError) {
    io.stderr.write(`error: ${err.message}\n`);
    return;
  }
  if (err instanceof SabreApiResponseError) {
    io.stderr.write(`error: ${err.name}: ${err.message}\n`);
    io.stderr.write(`status: ${err.statusCode}\n`);
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
