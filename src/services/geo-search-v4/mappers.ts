import { SabreParseError } from '../../errors/sabre-parse-error.js';
import type { components } from '../../generated/geo-search.js';
import { ensureTrailingSlash } from '../../http/ensure-trailing-slash.js';
import type { SabreRequest, SabreResponse } from '../../http/types.js';
import type {
  GeoSearchInput,
  GeoSearchOutput,
  GeoSearchResult,
  GeoSearchResultAttribute,
} from './types.js';

const PATH = 'v4/geo/search';

/**
 * Builds the outgoing {@link SabreRequest} for the `geoSearch` operation.
 *
 * The request body is the `GeoSearchRQ` envelope containing `GeoRef`
 * (search parameters + anchor) and `GeoAttributes` (post-filters).
 */
export function toSearchRequest(baseUrl: string, input: GeoSearchInput): SabreRequest {
  const url = new URL(PATH, ensureTrailingSlash(baseUrl));

  const geoRef: Record<string, unknown> = {
    Category: input.category,
    Radius: input.radius,
    UOM: input.uom,
  };

  if (input.direction !== undefined) geoRef.Direction = input.direction;
  if (input.maxResults !== undefined) geoRef.MaxResults = input.maxResults;
  if (input.maxSearchResults !== undefined) geoRef.MaxSearchResults = input.maxSearchResults;
  if (input.offset !== undefined) geoRef.Offset = input.offset;
  if (input.returnNonAggregatorPropertiesOnly !== undefined) {
    geoRef.ReturnNonAggregatorPropertiesOnly = input.returnNonAggregatorPropertiesOnly;
  }

  if (input.geoRef.kind === 'geoCode') {
    geoRef.GeoCode = {
      Latitude: input.geoRef.latitude,
      Longitude: input.geoRef.longitude,
    };
  } else if (input.geoRef.kind === 'refPoint') {
    const rp: Record<string, unknown> = {
      Value: input.geoRef.value,
      ValueContext: input.geoRef.valueContext,
      RefPointType: input.geoRef.refPointType,
    };
    if (input.geoRef.stateProv !== undefined) rp.StateProv = input.geoRef.stateProv;
    if (input.geoRef.countryCode !== undefined) rp.CountryCode = input.geoRef.countryCode;
    if (input.geoRef.postalCode !== undefined) rp.PostalCode = input.geoRef.postalCode;
    if (input.geoRef.cityName !== undefined) rp.CityName = input.geoRef.cityName;
    if (input.geoRef.codeContext !== undefined) rp.CodeContext = input.geoRef.codeContext;
    geoRef.RefPoint = rp;
  } else {
    const ar: Record<string, unknown> = { CountryCode: input.geoRef.countryCode };
    if (input.geoRef.street !== undefined) ar.Street = input.geoRef.street;
    if (input.geoRef.city !== undefined) ar.City = input.geoRef.city;
    if (input.geoRef.county !== undefined) ar.County = input.geoRef.county;
    if (input.geoRef.postalCode !== undefined) ar.PostalCode = input.geoRef.postalCode;
    if (input.geoRef.stateProv !== undefined) ar.StateProv = input.geoRef.stateProv;
    geoRef.AddressRef = ar;
  }

  const geoAttributes: Record<string, unknown> = {};
  if (input.attributes !== undefined && input.attributes.length > 0) {
    geoAttributes.Attributes = input.attributes.map((a) => ({
      Name: a.name,
      Value: a.value,
    }));
  }

  return {
    method: 'POST',
    url: url.toString(),
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      GeoSearchRQ: {
        GeoRef: geoRef,
        GeoAttributes: geoAttributes,
      },
    }),
  };
}

/**
 * Parses the `geoSearch` response into the public output shape.
 *
 * Every location Sabre returned is preserved; undercooked records are not
 * filtered out. Throws {@link SabreParseError} only when the body
 * fundamentally is not a Sabre response.
 */
export function fromSearchResponse(res: SabreResponse): GeoSearchOutput {
  let parsed: components['schemas']['GeoSearchResponse'];
  try {
    parsed = JSON.parse(res.body) as components['schemas']['GeoSearchResponse'];
  } catch (err) {
    throw new SabreParseError('Failed to parse Geo Search response as JSON', res.body, {
      cause: err,
    });
  }

  if (parsed === null || typeof parsed !== 'object') {
    throw new SabreParseError('Geo Search response was not a JSON object', parsed);
  }

  const rs = parsed.GeoSearchRS;
  if (rs === undefined || rs === null || typeof rs !== 'object') {
    throw new SabreParseError('Geo Search response was missing `GeoSearchRS`', parsed);
  }

  const searchResults = rs.GeoSearchResults;
  const out: GeoSearchOutput = {
    results: mapResults(searchResults?.GeoSearchResult),
  };

  if (searchResults?.Radius !== undefined) out.radius = searchResults.Radius;
  if (searchResults?.UOM !== undefined) out.uom = searchResults.UOM;
  if (searchResults?.Category !== undefined) out.category = searchResults.Category;
  if (searchResults?.Latitude !== undefined) out.latitude = searchResults.Latitude;
  if (searchResults?.Longitude !== undefined) out.longitude = searchResults.Longitude;
  if (searchResults?.MaxSearchResults !== undefined)
    out.maxSearchResults = searchResults.MaxSearchResults;
  if (searchResults?.OffSet !== undefined) out.offset = searchResults.OffSet;

  return out;
}

type GeneratedResultItem = NonNullable<
  NonNullable<components['schemas']['GeoSearchResponse']['GeoSearchRS']>['GeoSearchResults']
>['GeoSearchResult'];

function mapResults(items: GeneratedResultItem | undefined): GeoSearchResult[] {
  if (items === undefined) return [];
  return items.map(mapResult);
}

function mapResult(item: NonNullable<GeneratedResultItem>[number]): GeoSearchResult {
  const result: GeoSearchResult = {};
  if (item.Distance !== undefined) result.distance = item.Distance;
  if (item.Direction !== undefined) result.direction = item.Direction;
  if (item.Latitude !== undefined) result.latitude = item.Latitude;
  if (item.Longitude !== undefined) result.longitude = item.Longitude;
  if (item.Name !== undefined) result.name = item.Name;
  if (item.Id !== undefined) result.id = item.Id;
  if (item.Street !== undefined) result.street = item.Street;
  if (item.Zip !== undefined) result.zip = item.Zip;
  if (item.City !== undefined) result.city = item.City;
  if (item.State !== undefined) result.state = item.State;
  if (item.Country !== undefined) result.country = item.Country;
  if (item.ConfidenceFactor !== undefined) result.confidenceFactor = item.ConfidenceFactor;
  if (item.Attributes?.Attribute !== undefined) {
    result.attributes = item.Attributes.Attribute.map(mapAttribute);
  }
  return result;
}

function mapAttribute(
  attr: NonNullable<
    NonNullable<NonNullable<GeneratedResultItem>[number]['Attributes']>['Attribute']
  >[number],
): GeoSearchResultAttribute {
  const out: GeoSearchResultAttribute = {};
  if (attr.Name !== undefined) out.name = attr.Name;
  if (attr.Id !== undefined) out.id = attr.Id;
  if (attr.Value !== undefined) out.value = attr.Value;
  return out;
}
