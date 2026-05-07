# Hotel Search Anchors

Both `hotelSearchV2` (property discovery) and `getHotelAvailV5` (rates)
accept a **geographic anchor** to describe where to look. Three anchor
types are supported, mutually exclusive per request. Every variant
takes a `radius` + `uom` (`MI` or `KM`).

| Anchor | Input shape | Best for |
| --- | --- | --- |
| `geoCode` | `{ latitude, longitude }` | Coordinates already in hand |
| `refPoint` | `{ refPointType, value, valueContext }` | Airports, cities, landmarks, polygons |
| `addressRef` | `{ countryCode, city?, stateProv?, postalCode?, … }` | Postal address |

The full type definitions live in
[`src/services/hotel-search-v2/types.ts`](../../src/services/hotel-search-v2/types.ts)
and
[`src/services/get-hotel-avail-v5/types.ts`](../../src/services/get-hotel-avail-v5/types.ts).
The two services use near-identical shapes; the Avail variant adds an
optional `restrictToCountry` and documents a max radius of 200 mi / 320 km.

## `geoCode` — latitude / longitude

```ts
{ kind: 'geoCode', latitude: 38.78, longitude: -76.45, radius: 10, uom: 'MI' }
```

CLI: `--geo-code 38.78,-76.45 --radius 10 --uom MI`.

Use when you already have coordinates (a user's browser geolocation, a
stored record, a geocoded address). No name-resolution ambiguity —
this is the tightest anchor.

## `refPoint` — named reference point

```ts
{ kind: 'refPoint', refPointType: '6', value: 'BWI', valueContext: 'CODE', radius: 5, uom: 'MI' }
```

CLI: `--ref-point 6:BWI:CODE`.

`refPointType` is an OTA code:

| Code | Type | Example `value` / `valueContext` |
| --- | --- | --- |
| `5` | City | `NYC` / `CODE`, `New York` / `NAME` |
| `6` | Airport | `BWI` / `CODE`, `Baltimore Washington International` / `NAME` |
| `7` | Rail station | `QQS` / `CODE` (St. Pancras London) |
| `11` | Landmark | Sabre-defined landmark name / `NAME` |
| `16` | Metro station | Sabre-defined metro station name / `NAME` |
| `18` | Neighborhood | Sabre-defined neighborhood name / `NAME` |
| `37` | Polygon | Sabre-defined area name, e.g. `KRAKOW AREA` / `NAME` |

`valueContext` disambiguates whether `value` is a short code (IATA for
airports / cities, GDS code for rail stations) or a human-readable
name. Codes are less ambiguous; prefer them when available.

Airport and city codes overlap on purpose: `NYC` (city) covers
`JFK` + `LGA` + `EWR` together. When you want the metro area, use
`5` + city code; when you want the specific airport, use `6` + airport
code.

### Polygon searches (`refPointType: 37`)

Polygons let you restrict results to a named Sabre area rather than a
circle. Pair with a `GeoAttribute` post-filter:

```ts
{
  geoRef: { kind: 'refPoint', refPointType: '37', value: 'KRAKOW AREA',
            valueContext: 'NAME', radius: 5, uom: 'KM' },
  attributes: [{ name: 'LOCALAREA', value: 'KRAKOW AREA' }],
}
```

Sabre's polygon list is not published comprehensively. The canonical
way to discover one is Geo Autocomplete (see below) with a rough name.
Rare outside bespoke integrations.

## `addressRef` — address match

```ts
{ kind: 'addressRef', countryCode: 'US', city: 'Lexington Park',
  stateProv: 'MD', radius: 20, uom: 'MI' }
```

CLI: `--address` (script-level). Only `countryCode` is required; every
other component (`street`, `city`, `county`, `postalCode`, `stateProv`)
narrows the match. Fuzzier than `geoCode` — match quality depends on
how well Sabre's geocoder knows the area.

## Where do `refPoint` values come from?

In descending order of practicality:

### 1. You already know them

Airports and cities dominate real-world usage. IATA 3-letter codes for
airports (`BWI`, `JFK`, `LHR`) and city codes (`NYC`, `LON`) are
standardized and widely published. `BWI` in a human's head is usually
already in IATA form.

### 2. Sabre's geo-resolution APIs

Three Sabre endpoints exist for turning user strings into anchors.
**None are currently wrapped by this library** — listed here for when
they become worth adding:

- **Geo Autocomplete** — type-ahead. Send a partial string (`"bwi"`,
  `"lex"`), get back ranked matches with `refPointType` + `value` +
  `valueContext` already filled in.
- **Geo Search** — same idea but optimized for complete-string lookups
  rather than incremental typing.
- **Property Name Autocomplete** — scoped to hotel property names
  (`"hilton frank"`) rather than geography; resolves to Sabre property
  IDs, which bypass the anchor system entirely by going to
  `getHotelAvailV5` with `--hotels <id>` / `{ kind: 'hotels', hotels: [...] }`.

The right runtime pattern for a consumer-facing search box is:
Geo Autocomplete on each keystroke → user picks a suggestion → pass
its `refPointType` + `value` to shopping.

### 3. Sabre's `multi-airport-city-lookup` service

Wrapped by this library as `client.multiAirportCityLookupV1`. Maps
IATA multi-airport city codes (`NYC`, `LON`, `WAS`) to the underlying
airports. Not a search-by-name tool, but useful for expanding a city
code into the specific airports when you want to show them to a user.

### 4. Your consumer application

Most real-world integrations store a user's preferred airports /
cities as part of the user profile. The anchor comes from profile
state, not from a lookup.

## Picking an anchor for CERT smoke tests

CERT's test-property set is thin and uneven. Some airport codes return
nothing; others return the same three properties every call. Two rules:

1. **Check the `Active-CERT-Properties.xlsx` first.** Linked from
   Sabre's CSL API Support page and referenced in
   [`../specifications/create-pnr/README.md`](../specifications/create-pnr/README.md).
   It's the only reliable index of what Sabre CERT will actually
   return rates on. Pick a property, grab its nearest airport code,
   use that as `--ref-point 6:<CODE>:CODE`.
2. **When Avail returns zero hotels but search returns properties**,
   the test data exists (property metadata loaded) but no rates are
   published for those IDs (supplier-side gap). That's a CERT
   limitation, not a client bug. Try a different airport or fall back
   to `getHotelAvailV5 --hotels <sabreId>` with an ID from the XLSX.

The repo's `scripts/hotel-e2e.sh` defaults to `--ref-point 6:BWI:CODE`
(Marriott Baltimore-Washington has reliably returned rates in CERT as
of mid-2026). DFW is a known dud — returns "test property" entries
with no availability.

See also:

- [`hotel-booking-flow.md`](./hotel-booking-flow.md) — the orchestrated
  CSL flow these anchors feed into.
- [`../specifications/create-pnr/README.md`](../specifications/create-pnr/README.md)
  — CPNR reference bodies and CERT data gotchas.
