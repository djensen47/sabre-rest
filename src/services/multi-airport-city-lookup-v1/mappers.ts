import { SabreParseError } from '../../errors/sabre-parse-error.js';
import type { components } from '../../generated/multi-airport-city-lookup.js';
import { ensureTrailingSlash } from '../../http/ensure-trailing-slash.js';
import type { SabreRequest, SabreResponse } from '../../http/types.js';
import type { CityLink, LookupCitiesInput, LookupCitiesOutput, MultiAirportCity } from './types.js';

const PATH = '/v1/lists/supported/cities';

/**
 * Builds the outgoing {@link SabreRequest} for the multiAirportCityLookup
 * operation.
 *
 * When `input.country` is supplied, it is appended as the `country` query
 * parameter. When omitted, Sabre returns every multi-airport city.
 */
export function toLookupCitiesRequest(baseUrl: string, input?: LookupCitiesInput): SabreRequest {
  const url = new URL(PATH, ensureTrailingSlash(baseUrl));
  if (input?.country) {
    url.searchParams.set('country', input.country);
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
 * Parses the multiAirportCityLookup response into the public output shape.
 *
 * Throws {@link SabreParseError} if the body is not valid JSON or is not a
 * JSON object. Every city Sabre returned is included in the output — the
 * mapper does not drop records based on which fields are populated, because
 * Sabre's spec marks every city field optional. Consumers see the data as
 * Sabre returned it.
 */
export function fromLookupCitiesResponse(res: SabreResponse): LookupCitiesOutput {
  let parsed: components['schemas']['MultiAirportCityLookupResponse'];
  try {
    parsed = JSON.parse(res.body) as components['schemas']['MultiAirportCityLookupResponse'];
  } catch (err) {
    throw new SabreParseError(
      'Failed to parse Multi-Airport City Lookup response as JSON',
      res.body,
      { cause: err },
    );
  }

  if (parsed === null || typeof parsed !== 'object') {
    throw new SabreParseError('Multi-Airport City Lookup response was not a JSON object', parsed);
  }

  const rawCities = parsed.Cities ?? [];
  const cities: MultiAirportCity[] = rawCities.map((item) => {
    const city: MultiAirportCity = {};
    if (item.code !== undefined) city.code = item.code;
    if (item.name !== undefined) city.name = item.name;
    if (item.countryCode !== undefined) city.countryCode = item.countryCode;
    if (item.countryName !== undefined) city.countryName = item.countryName;
    if (item.regionName !== undefined) city.regionName = item.regionName;
    if (item.Links !== undefined) {
      city.links = item.Links.map((link): CityLink => {
        const cityLink: CityLink = {};
        if (link.rel !== undefined) cityLink.rel = link.rel;
        if (link.href !== undefined) cityLink.href = link.href;
        return cityLink;
      });
    }
    return city;
  });

  return { cities };
}
