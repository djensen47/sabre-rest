# Sabre-Specific Decisions

This document captures decisions that are specific to **`sabre-rest`** — the
ones that wouldn't necessarily apply if you took the same patterns to a
different REST client.

For the reusable architecture, see [`architecture.md`](./architecture.md).
This document only covers things that are particular to Sabre's APIs, naming,
or operational quirks.

---

## Service grouping: by Sabre API, not by domain

### Decision

Services on the client are grouped by **Sabre API**, not by business domain.

```ts
client.airBookingV3.create({ /* ... */ });
client.bargainFinderMaxV4.search({ /* ... */ });
client.airShoppingV2.shop({ /* ... */ });
```

Not:

```ts
client.flights.book({ /* ... */ });
client.flights.search({ /* ... */ });
```

### Why

Domain grouping is what consumers usually want, but Sabre's API surface
makes it a bad fit:

- Sabre publishes one OpenAPI spec per API, and the API boundaries are
  versioned independently. A "flights" domain would span Air Shopping, Air
  Booking, Bargain Finder Max, Air Availability, and several lookup APIs —
  each on its own release cadence.
- Versioning within a domain becomes meaningless. `client.flights.search`
  hides which underlying API and version you're calling. When Sabre ships a
  new version of one of those APIs, the domain abstraction has nowhere to
  put it.
- Mapping consumer concepts onto Sabre's APIs is a non-trivial exercise that
  would have to be redone every time Sabre changes anything.

Per-API grouping mirrors the OAS specs 1:1, makes versioning explicit, and
lets consumers map directly from Sabre's docs to method calls.

### Alternatives rejected

- **Domain grouping** (`client.flights`, `client.hotels`). The intuitive
  consumer-facing shape, but breaks down for the reasons above.
- **Hybrid** (`client.flights.airBooking.create`). Two layers of nesting,
  worst of both worlds.

---

## Service naming: camelCase with version suffix

### Decision

Service property names are **camelCase identifiers with the API version as a
suffix**:

```
airBookingV3
bargainFinderMaxV4
airShoppingV2
airlineAlliancesV1
```

When Sabre releases a new version, both versions can coexist on the client
(`airBookingV3` and `airBookingV4`), and consumers explicitly choose which
one they're calling. Service names are hand-curated for clarity rather than
mechanically derived from the OAS `info.title` (which is often awkward) or
the URL path (which is often worse).

The folder for each service uses the kebab-case form of the same name:

```
src/services/air-booking-v3/
```

### Why

- **Explicit versioning.** Sabre's APIs version frequently and breaking
  changes between versions are real. Having the version in the property
  name removes any ambiguity about what's being called.
- **Coexistence.** Multiple versions can be live on one client, which is
  useful during migrations.
- **Hand-curated names beat mechanical derivation.** "Airline Alliance
  Lookup" makes a fine doc string but a poor identifier; `/v1/lists/supported/cities`
  doesn't yield anything usable. We pick reasonable names per service and
  document the source operation in JSDoc.

### Alternatives rejected

- **Drop the version from the property name** and let the client expose
  only one version at a time. Forces consumers into upgrade lockstep with
  the library.
- **Snake_case or kebab-case at the property level** (`air_booking_v3`).
  Not idiomatic JavaScript identifiers.

---

## Two OAuth versions: v2 and v3

### Decision

Sabre exposes two OAuth implementations for obtaining a bearer token,
referred to as **v2** and **v3**. The library ships a `TokenProvider`
factory for each:

```ts
import { createOAuthV2, createOAuthV3 } from 'sabre-rest';
```

A consumer picks one when constructing the client based on which Sabre auth
endpoint they're entitled to call. The two cannot be used simultaneously on
a single client.

The first implementation in this library is `createOAuthV2`, since that's
what the maintainer needs initially. `createOAuthV3` is a planned addition.

### Why

- Sabre supports multiple bearer-token flows. Different accounts and
  environments are entitled to different ones.
- Both flows produce a bearer token that goes in the same `Authorization:
  Bearer ...` header, so they fit the same `TokenProvider` interface
  cleanly.
- Versioning the providers (rather than discriminating with a `version`
  field) keeps the option types per-flow simple and gives each flow its
  own factory signature.

### Alternatives rejected

- **A single `createOAuth({ version: 'v2' | 'v3', ... })` factory.** The
  options for v2 and v3 differ enough that the discriminated union gets
  ugly fast, and TypeScript autocomplete suffers.
- **One implementation for both, switching internally.** The endpoints,
  request shapes, and edge cases differ enough that conflating them inside
  one provider would be a mess.

---

## `baseUrl` is required; `SabreBaseUrls` constants are exported

### Decision

`createSabreClient` requires a `baseUrl` argument. There is no default and
no environment-based guessing. To make the common values discoverable
without hardcoding, the library exports `SabreBaseUrls`:

```ts
import { createSabreClient, SabreBaseUrls } from 'sabre-rest';

const client = createSabreClient({
  baseUrl: SabreBaseUrls.cert,
  /* ... */
});
```

`SabreBaseUrls` is a plain frozen object mapping known environment names to
the canonical Sabre URLs.

### Why

- **No silent environment switching.** Forgetting which environment you're
  pointed at is a class of bug we want to make impossible. Every
  construction site has the URL written next to it (or a constant that's
  one click from the URL).
- **Constants centralize knowledge.** When Sabre changes a URL or adds a
  region, only one place in the library updates. Consumers who use the
  constants pick up the change automatically.
- **Optional, not enforced.** Consumers who want to point at a recording
  proxy, a local mock, or a non-standard environment just pass a string.
  We don't constrain `baseUrl`'s type to the known values.

### Alternatives rejected

- **`environment: 'cert' | 'prod'` enum** instead of `baseUrl`. Hides the
  URL from the construction site, which we explicitly don't want.
- **Default to one of the URLs** if `baseUrl` is omitted. Silently picking
  cert or prod is a footgun.

---

## Sabre's error envelope inconsistency

### Decision

`SabreApiResponseError` carries `statusCode: number` and `responseBody:
unknown`. It does **not** carry a normalized `errors[]` field.

### Why

Sabre's error envelopes vary across APIs:

- Some APIs return `{ errors: [{ errorCode, message, ... }] }`.
- OTA-style endpoints (Bargain Finder Max and similar) return
  `{ OTA_AirLowFareSearchRS: { Errors: { Error: [{ Type, ShortText, Code }] } } }`.
- Lookup APIs sometimes return plain text or differently-shaped envelopes.

Normalizing on the way out would require per-API extraction logic, and
without seeing real responses across all the APIs we'll cover, any
normalization scheme is premature. Preserving `responseBody` verbatim lets
consumers reach into whatever envelope Sabre actually returned, while
keeping the error class minimal.

If a normalization pattern emerges naturally as we implement multiple
services, we can add a normalized `errors[]` field non-breakingly.

### Alternatives rejected

- **Normalized `errors: SabreApiError[]` field on the error class** with a
  hand-written `SabreApiError` type. Considered, but rejected for
  prematurity.
- **Re-export the generated `Error` schema type** so consumers see the
  shape. Violates the "generated types stay internal" rule.
- **Per-API error subclasses** (`SabreOtaError`, `SabreLookupError`).
  Premature multiplication.

---

## OpenAPI specs live in `docs/specifications/`

### Decision

Sabre's OAS spec files are committed under `docs/specifications/`, one file
per API, named with the kebab-case service name:

```
docs/specifications/air-booking-v3.yaml
docs/specifications/bargain-finder-max-v4.yaml
```

The generation script reads from `docs/specifications/` and writes to
`src/generated/<same-name>.ts`. It accepts both YAML and JSON inputs.

The directory is named `specifications` rather than `specs` to avoid
overloading "spec" with the testing convention used in some ecosystems
(e.g., RSpec's `spec/` directory).

### Why

- **Specs are documentation.** They describe Sabre's contracts and are useful
  on their own — putting them in `docs/` matches that.
- **Committed, not fetched.** Generation must be deterministic and
  reviewable. Spec diffs in PRs are how we notice when Sabre changes
  something.
- **Same basename in input and output.** Trivial mental mapping between a
  spec file and its generated module.

### Alternatives rejected

- **`specifications/` at the repo root.** Reasonable, but `docs/` already
  exists for prose documentation and decision records, and specs fit there
  comfortably.
- **`src/generated/specifications/`.** Mixes data files with source code
  under `src/`.
- **Don't commit specs; fetch on demand.** Loses determinism and makes
  spec changes invisible in code review.

---

## Generation script accepts spec names as arguments

### Decision

`npm run generate` regenerates **all** specs by default. Passing one or
more spec basenames regenerates only those:

```bash
npm run generate                          # all
npm run generate -- air-booking-v3        # one
npm run generate -- air-booking-v3 air-shopping-v2
```

Unknown names error out with the list of available specs.

### Why

- **Day-to-day work touches one API at a time.** Regenerating everything on
  every change is unnecessary and produces noisy diffs.
- **Bulk regeneration is still available** for cases where it's actually
  needed (e.g., a generator upgrade).

---

## API space coverage roadmap

### Decision

The library is `0.x` until it covers a meaningful slice of Sabre's API
space. Each new service or significant feature is a **minor** version bump
(`0.1.0` → `0.2.0` → ...). Breaking changes during `0.x` may also ship as
minor bumps, since `0.x` semantics permit it.

The first API targeted is determined by the maintainer's immediate need
(currently flight-related operations using OAuth v2). Additional APIs will
be added as the maintainer or contributors require them, in no
predetermined order.

Once the API surface is stable enough that breaking changes become rare,
the library will release `1.0.0` and switch to strict semver from then on.

### Why

- **Realistic for a solo project.** Trying to cover all of Sabre's APIs
  before shipping anything is a recipe for never shipping.
- **0.x leaves room to refactor.** The architecture documents in this
  folder represent current thinking; some decisions will need revisiting
  once we see real Sabre responses and real usage patterns.
- **Demand-driven prioritization.** APIs get added when they're needed,
  not on a schedule.

---

## Known spec drift

A changelog of public-type drift from the upstream OAS that has been
**corrected**. New corrections are added to the top; active drift is
tracked in issues, not here.

Entries are stamped with the **calendar date** the fix PR was opened
and the **PR number**. The PR is the root context: its description
carries the spec analysis, the diff, and the review discussion, which
is what an investigator needs. Release version is intentionally *not*
stamped — release-please assigns those, and anyone triaging can cross-
reference the PR merge commit to the release.

The process: when a drift bug is discovered, the fix PR appends an
entry describing the spec location that was misrepresented and the
shape the public type now carries. The design rules that govern what
counts as drift are in
[`architecture.md` → Public type design rules](./architecture.md).
New entries are stamped with `PR #TBD` while the fix is on a branch;
the PR number is filled in once the PR is opened, before merge.

### 2026-04-23 · [PR #60](https://github.com/djensen47/sabre-rest/pull/60) — Booking Management v1.32

Three drift corrections landed together:

- **`MonetaryValue`** (replaces `BookingMonetaryValue` and
  `FulfillMonetaryValue`). Spec `Value` (booking-management.yml line
  3609) has both `amount` and `currencyCode` in `required:`. The
  earlier public types had both fields optional, which
  misrepresented the spec without a documented cert-observed reason.
  The two legacy duplicates are now one `MonetaryValue` with both
  fields required.
- **`BookingHotelRefundPenalty.penalty`**. Spec
  `HotelDateRangeRefundPenalty.penalty` (line 7800) is
  `$ref: HotelPenaltyValue`, which extends `Value` with optional
  `percentage` and `numberOfNights`. The public type previously
  pointed at the plain monetary value and dropped both extensions.
  The field now carries a new `HotelPenaltyValue extends
  MonetaryValue` shape.
- **`BookingFareDifferenceBreakdown`**. Spec
  `FareDifferenceBreakdown` (line 7498) carries `adjustedAmount?`
  and `currencyCode?`. The earlier public type had fabricated
  `fareDifference` / `taxDifference` fields that did not exist in
  the spec; the mapper was using a `Record<string, unknown>` cast
  to sidestep the compiler. The public type now matches the spec
  and the cast is gone.
