import { SabreParseError } from '../../errors/sabre-parse-error.js';
import type { components } from '../../generated/airline-lookup.js';
import type { SabreRequest, SabreResponse } from '../../http/types.js';
import type { Airline, LookupAirlinesInput, LookupAirlinesOutput } from './types.js';

const PATH = '/v1/lists/utilities/airlines';

/**
 * Builds the outgoing {@link SabreRequest} for the airlinesLookup operation.
 *
 * Sabre accepts the IATA codes as a comma-separated `airlinecode` query
 * parameter. When the input has no codes, the parameter is omitted and
 * Sabre returns every airline.
 */
export function toLookupRequest(baseUrl: string, input?: LookupAirlinesInput): SabreRequest {
  const url = new URL(PATH, ensureTrailingSlash(baseUrl));
  if (input?.codes && input.codes.length > 0) {
    url.searchParams.set('airlinecode', input.codes.join(','));
  }
  return {
    method: 'GET',
    url: url.toString(),
    headers: {
      Accept: 'application/json',
    },
  };
}

/**
 * Parses the airlinesLookup response into the public output shape.
 *
 * Throws {@link SabreParseError} if the body is not valid JSON or is not
 * shaped as Sabre's documented response. Airlines that are missing the
 * required `code` or `name` fields are silently dropped — Sabre's response
 * shape is permissive enough that we choose to return what we can rather
 * than fail the whole call.
 */
export function fromLookupResponse(res: SabreResponse): LookupAirlinesOutput {
  let parsed: components['schemas']['AirlinesLookupResponse'];
  try {
    parsed = JSON.parse(res.body) as components['schemas']['AirlinesLookupResponse'];
  } catch (err) {
    throw new SabreParseError('Failed to parse Airline Lookup response as JSON', res.body, {
      cause: err,
    });
  }

  if (parsed === null || typeof parsed !== 'object') {
    throw new SabreParseError('Airline Lookup response was not a JSON object', parsed);
  }

  const rawAirlines = parsed.AirlineInfo ?? [];
  const airlines: Airline[] = [];
  for (const item of rawAirlines) {
    if (!item.AirlineCode || !item.AirlineName) {
      continue;
    }
    const airline: Airline = {
      code: item.AirlineCode,
      name: item.AirlineName,
    };
    if (item.AlternativeBusinessName) {
      airline.alternativeName = item.AlternativeBusinessName;
    }
    airlines.push(airline);
  }

  return { airlines };
}

function ensureTrailingSlash(url: string): string {
  return url.endsWith('/') ? url : `${url}/`;
}
