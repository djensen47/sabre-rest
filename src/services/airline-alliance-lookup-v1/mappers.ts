import { SabreParseError } from '../../errors/sabre-parse-error.js';
import type { components } from '../../generated/airline-alliance-lookup.js';
import { ensureTrailingSlash } from '../../http/ensure-trailing-slash.js';
import type { SabreRequest, SabreResponse } from '../../http/types.js';
import type {
  AirlineAlliance,
  AirlineAllianceMember,
  LookupAirlineAlliancesInput,
  LookupAirlineAlliancesOutput,
} from './types.js';

const PATH = '/v1/lists/utilities/airlines/alliances';

/**
 * Builds the outgoing {@link SabreRequest} for the airlinesAlliancesLookup
 * operation.
 *
 * Sabre accepts the alliance codes as a comma-separated `alliancecode`
 * query parameter (the spec uses `style: form, explode: false`). When the
 * input has no codes, the parameter is omitted and Sabre returns every
 * alliance.
 */
export function toLookupRequest(
  baseUrl: string,
  input?: LookupAirlineAlliancesInput,
): SabreRequest {
  const url = new URL(PATH, ensureTrailingSlash(baseUrl));
  if (input?.codes && input.codes.length > 0) {
    url.searchParams.set('alliancecode', input.codes.join(','));
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
 * Parses the airlinesAlliancesLookup response into the public output
 * shape.
 *
 * Throws {@link SabreParseError} if the body is not valid JSON or is not
 * a JSON object. Every alliance and every member Sabre returned is
 * included in the output — the mapper does not drop records based on
 * which fields are populated, because Sabre's spec marks every field
 * optional. Consumers see the data as Sabre returned it.
 */
export function fromLookupResponse(res: SabreResponse): LookupAirlineAlliancesOutput {
  let parsed: components['schemas']['AirlinesAlliancesLookupResponse'];
  try {
    parsed = JSON.parse(res.body) as components['schemas']['AirlinesAlliancesLookupResponse'];
  } catch (err) {
    throw new SabreParseError(
      'Failed to parse Airline Alliance Lookup response as JSON',
      res.body,
      {
        cause: err,
      },
    );
  }

  if (parsed === null || typeof parsed !== 'object') {
    throw new SabreParseError('Airline Alliance Lookup response was not a JSON object', parsed);
  }

  const rawAlliances = parsed.AllianceInfo ?? [];
  const alliances: AirlineAlliance[] = rawAlliances.map((item) => {
    const members: AirlineAllianceMember[] = (item.AirlineInfo ?? []).map((member) => {
      const out: AirlineAllianceMember = {};
      if (member.AirlineCode !== undefined) out.code = member.AirlineCode;
      return out;
    });
    const alliance: AirlineAlliance = { members };
    if (item.AllianceCode !== undefined) alliance.code = item.AllianceCode;
    if (item.AllianceName !== undefined) alliance.name = item.AllianceName;
    return alliance;
  });

  return { alliances };
}
