import { SabreParseError } from '../../errors/sabre-parse-error.js';
import type { components } from '../../generated/geo-autocomplete.js';
import { ensureTrailingSlash } from '../../http/ensure-trailing-slash.js';
import type { SabreRequest, SabreResponse } from '../../http/types.js';
import type {
  GeoAutocompleteGroup,
  GeoAutocompleteInput,
  GeoAutocompleteOutput,
  GeoAutocompletePlace,
} from './types.js';

const PATH = 'v2/geo/autocomplete';

/**
 * Builds the outgoing {@link SabreRequest} for the `geoAutocomplete`
 * operation.
 *
 * This is a GET request with query parameters — no request body.
 */
export function toAutocompleteRequest(baseUrl: string, input: GeoAutocompleteInput): SabreRequest {
  const url = new URL(PATH, ensureTrailingSlash(baseUrl));
  url.searchParams.set('query', input.query);
  if (input.category !== undefined) url.searchParams.set('category', input.category);
  if (input.limit !== undefined) url.searchParams.set('limit', String(input.limit));
  if (input.clientId !== undefined) url.searchParams.set('clientId', input.clientId);

  return {
    method: 'GET',
    url: url.toString(),
    headers: {
      Accept: 'application/json',
    },
  };
}

const CATEGORY_KEYS = [
  'category:AIR',
  'category:RAIL',
  'category:CITY',
  'category:POI',
  'categpry:LOCATION',
  'category:LOCATION',
] as const;

/**
 * Parses the `geoAutocomplete` response into the public output shape.
 *
 * Every category group and place Sabre returned is preserved. The spec
 * has a known typo (`categpry:LOCATION` instead of `category:LOCATION`)
 * — the mapper handles both spellings.
 */
export function fromAutocompleteResponse(res: SabreResponse): GeoAutocompleteOutput {
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

  const out: GeoAutocompleteOutput = {
    groups: mapGroups(parsed.grouped),
  };

  if (parsed.responseHeader?.status !== undefined) out.status = parsed.responseHeader.status;
  if (parsed.responseHeader?.QTime !== undefined) out.queryTime = parsed.responseHeader.QTime;

  return out;
}

function mapGroups(
  grouped: components['schemas']['GeoAutocompleteResponse']['grouped'] | undefined,
): GeoAutocompleteGroup[] {
  if (grouped === undefined) return [];

  const groups: GeoAutocompleteGroup[] = [];
  const seen = new Set<string>();

  for (const key of CATEGORY_KEYS) {
    const categoryResponse = (
      grouped as Record<string, components['schemas']['CategoryResponse'] | undefined>
    )[key];
    if (categoryResponse === undefined) continue;

    const category = extractCategory(key);
    if (seen.has(category)) continue;
    seen.add(category);

    groups.push(mapGroup(category, categoryResponse));
  }

  return groups;
}

function extractCategory(key: string): string {
  const colonIdx = key.indexOf(':');
  return colonIdx >= 0 ? key.slice(colonIdx + 1) : key;
}

function mapGroup(
  category: string,
  cr: components['schemas']['CategoryResponse'],
): GeoAutocompleteGroup {
  const group: GeoAutocompleteGroup = {
    category,
    places: mapPlaces(cr.doclist?.docs),
  };
  if (cr.matches !== undefined) group.matches = cr.matches;
  if (cr.doclist?.numFound !== undefined) group.numFound = cr.doclist.numFound;
  if (cr.doclist?.start !== undefined) group.start = cr.doclist.start;
  return group;
}

type GeneratedDoc = NonNullable<
  NonNullable<components['schemas']['CategoryResponse']['doclist']>['docs']
>[number];

function mapPlaces(docs: GeneratedDoc[] | undefined): GeoAutocompletePlace[] {
  if (docs === undefined) return [];
  return docs.map(mapPlace);
}

function mapPlace(doc: GeneratedDoc): GeoAutocompletePlace {
  const place: GeoAutocompletePlace = {};
  if (doc.name !== undefined) place.name = doc.name;
  if (doc.city !== undefined) place.city = doc.city;
  if (doc.country !== undefined) place.country = doc.country;
  if (doc.countryName !== undefined) place.countryName = doc.countryName;
  if (doc.stateName !== undefined) place.stateName = doc.stateName;
  if (doc.state !== undefined) place.state = doc.state;
  if (doc.category !== undefined) place.category = doc.category;
  if (doc.id !== undefined) place.id = doc.id;
  if (doc.dataset !== undefined) place.dataset = doc.dataset;
  if (doc.datasource !== undefined) place.datasource = doc.datasource;
  if (doc.confidenceFactor !== undefined) place.confidenceFactor = doc.confidenceFactor;
  if (doc.latitude !== undefined) place.latitude = doc.latitude;
  if (doc.longitude !== undefined) place.longitude = doc.longitude;
  if (doc.iataCityCode !== undefined) place.iataCityCode = doc.iataCityCode;
  if (doc.ranking !== undefined) place.ranking = doc.ranking;
  return place;
}
