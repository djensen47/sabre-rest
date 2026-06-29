import { SabreParseError } from '../../errors/sabre-parse-error.js';
import type { components } from '../../generated/geo-autocomplete.js';
import { ensureTrailingSlash } from '../../http/ensure-trailing-slash.js';
import type { SabreRequest, SabreResponse } from '../../http/types.js';
import type {
  AutocompleteCategoryGroup,
  AutocompleteInput,
  AutocompleteOutput,
  AutocompletePlace,
} from './types.js';

const PATH = '/v2/geo/autocomplete';

const CATEGORY_KEYS = [
  'category:AIR',
  'category:RAIL',
  'category:CITY',
  'category:POI',
  'categpry:LOCATION',
] as const;

/**
 * Builds the outgoing {@link SabreRequest} for the geoAutocomplete operation.
 *
 * The `query` parameter is always set. Optional parameters (`category`,
 * `limit`, `clientId`) are included only when provided.
 */
export function toAutocompleteRequest(baseUrl: string, input: AutocompleteInput): SabreRequest {
  const url = new URL(PATH, ensureTrailingSlash(baseUrl));
  url.searchParams.set('query', input.query);
  if (input.category !== undefined) {
    url.searchParams.set('category', input.category);
  }
  if (input.limit !== undefined) {
    url.searchParams.set('limit', String(input.limit));
  }
  if (input.clientId !== undefined) {
    url.searchParams.set('clientId', input.clientId);
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
 * Parses the geoAutocomplete response into the public output shape.
 *
 * Throws {@link SabreParseError} if the body is not valid JSON or is not a
 * JSON object. The response uses category-keyed properties in a `grouped`
 * object (including the Sabre typo `categpry:LOCATION`). Each key is
 * normalized into an {@link AutocompleteCategoryGroup}.
 */
export function fromAutocompleteResponse(res: SabreResponse): AutocompleteOutput {
  let parsed: components['schemas']['GeoAutocompleteResponse'];
  try {
    parsed = JSON.parse(res.body) as components['schemas']['GeoAutocompleteResponse'];
  } catch (err) {
    throw new SabreParseError('Failed to parse Geo Autocomplete response as JSON', res.body, {
      cause: err,
    });
  }

  if (parsed === null || typeof parsed !== 'object') {
    throw new SabreParseError('Geo Autocomplete response was not a JSON object', parsed);
  }

  const grouped = parsed.grouped ?? {};
  const groups: AutocompleteCategoryGroup[] = [];

  for (const key of CATEGORY_KEYS) {
    const catResponse = grouped[key];
    if (catResponse === undefined) continue;

    const categoryName = extractCategory(key);
    const docs = catResponse.doclist?.docs ?? [];

    const places: AutocompletePlace[] = docs.map((doc) => {
      const place: AutocompletePlace = {};
      if (doc.id !== undefined) place.id = doc.id;
      if (doc.name !== undefined) place.name = doc.name;
      if (doc.city !== undefined) place.city = doc.city;
      if (doc.state !== undefined) place.state = doc.state;
      if (doc.stateName !== undefined) place.stateName = doc.stateName;
      if (doc.country !== undefined) place.country = doc.country;
      if (doc.countryName !== undefined) place.countryName = doc.countryName;
      if (doc.category !== undefined) place.category = doc.category;
      if (doc.latitude !== undefined) place.latitude = doc.latitude;
      if (doc.longitude !== undefined) place.longitude = doc.longitude;
      if (doc.iataCityCode !== undefined) place.iataCityCode = doc.iataCityCode;
      if (doc.ranking !== undefined) place.ranking = doc.ranking;
      if (doc.dataset !== undefined) place.dataset = doc.dataset;
      if (doc.datasource !== undefined) place.datasource = doc.datasource;
      if (doc.confidenceFactor !== undefined) place.confidenceFactor = doc.confidenceFactor;
      return place;
    });

    const group: AutocompleteCategoryGroup = { places };
    if (categoryName !== undefined) group.category = categoryName;
    if (catResponse.matches !== undefined) group.totalMatches = catResponse.matches;
    groups.push(group);
  }

  return { groups };
}

function extractCategory(key: string): string | undefined {
  const colonIndex = key.indexOf(':');
  if (colonIndex === -1) return undefined;
  return key.slice(colonIndex + 1);
}
