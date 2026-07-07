# Hotel Booking Flow (Sabre CSL)

This guide documents the Sabre Content Services for Lodging (CSL) shopping-to-booking
flow: which REST endpoints exist, which are on the canonical path, which are
optional side roads, and how keys chain from one call to the next.

Source: Sabre Developer Hub, [Content Services for Lodging (CSL) — Setup and Guides](https://developer.sabre.com/product-collection/content-services-for-lodging-csl/v1/setup-and-guides.html).

## Orchestrated path

| Step | Action | REST API | Status |
| --- | --- | --- | --- |
| 1 | Search | Get Hotel Avail | Optional\* |
| 2 | Refine | Get Hotel Details | Optional\* |
| 3 | Review | Hotel Price Check | **Mandatory** |
| 4 | Reserve | Create Passenger Name Record | **Mandatory** |
| 5 | Retrieve | Booking Management v1 `getBooking`† | Optional |
| 6 | Cancel | Booking Management v1 `cancelBooking`‡ | Optional |

_\* At least one of Get Hotel Avail **or** Get Hotel Details must be called
before Hotel Price Check — the `RateKey` produced by those two endpoints is
the input to Price Check._

_† Sabre's CSL Setup & Guides page lists this step as "Get Reservation (SOAP
only)", but Booking Management v1 (`POST /v1/trip/orders/getBooking`) is
spec-documented for hotel PNRs (see [`booking-management.yml`](../specifications/booking-management.yml)
at lines 1134, 2545, 2703 — the response schema includes
`hotels[]` reservations). Verified end-to-end in CERT on 2026-07-07 against
a CSL-segment hotel PNR: the endpoint returns the `hotels[]` reservation
with room, rate, and payment detail. This previously returned
`UNAUTHORIZED_ACCESS` on this EPR; that entitlement gap is now resolved.
`scripts/hotel-e2e.sh` exercises this call as step 7._

_‡ Verified end-to-end in CERT on 2026-05-07: Booking Management v1
`cancelBooking` with `--cancel-all` accepts a PNR created by the CSL
`createPassengerNameRecord` v2.5.0 hotel flow and returns a clean success
envelope. This contradicts the SOAP-only retrieve/cancel implication on
Sabre's CSL Setup & Guides page. `scripts/hotel-e2e.sh` uses this call to
self-clean after booking._

### Key chaining

```
Get Hotel Avail  ──►  RateKey  ──►  Hotel Price Check  ──►  BookingKey  ──►  Create PNR
Get Hotel Details ──►  RateKey  ──┘
```

- `RateKey` — opaque handle for a specific rate at a specific property. Produced
  by Avail or Details, consumed by Price Check.
- `BookingKey` — opaque handle for a priced, still-available rate ready to book.
  Produced by Price Check, consumed by Create PNR (or Enhanced Hotel Book on SOAP).

## Granular endpoints (off the orchestrated path)

These are supporting APIs, not steps you insert into the flow above:

- **Get Hotel Rate Info** — returns all rates for a single property. Similar
  surface area to Get Hotel Details, but it is **not** the canonical "Refine"
  step. Use Get Hotel Details for the orchestrated flow. Get Hotel Rate Info
  does emit `RateKey`s that Price Check will accept.
- **Get Hotel Lead Rate** — lowest product across requested supply sources for
  one or more properties. Coarser than Avail.
- **Get Hotel List / Get Hotel Content / Get Hotel Descriptive Info / Get Hotel
  Media / Get Hotel Image** — property discovery and static content.
- **Geo Search / Geo Autocomplete / Property Name Autocomplete** — location
  resolution utilities. See [`hotel-search-anchors.md`](./hotel-search-anchors.md)
  for how these feed the `refPoint` anchor used by Search and Avail.

## Booking endpoint

### Create Passenger Name Record (REST)

- Path: `POST {base}/v2.5.0/passenger/records?mode=create`
- Published versions: `2.3.0`, `2.4.0`, `2.5.0` (Sabre defaults to
  `2.5.0`). Reference spec:
  `https://developer.sabre.com/rest-api/create-passenger-name-record/2.5.0/_attachments/spec.yml`
- Scope per Sabre's overview: "used to create a full reservation for
  air, hotel, and rental car content; all within a single request."
  This library exposes only the hotel path — air bookings go through
  `bookingManagementV1` at `/v1/trip/orders/createBooking`.
- The `CreatePassengerNameRecordRQ` body wraps a `HotelBook` block:
  - `BookingInfo.BookingKey` — from Price Check
  - `BookingInfo.RequestorID`
  - `Rooms.Room[].Guests[]` — guest name, contact, `LeadGuest`
  - `PaymentInformation.FormOfPayment.PaymentCard` — card + billing address
  - `POS.Source` — `RequestorID` (IATA), `AgencyAddress`, `AgencyName`,
    `ISOCountryCode`, `PseudoCityCode`
- Working request bodies for GDS, EAN, BCOM, and HBD suppliers are
  committed under [`docs/specifications/create-pnr/`](../specifications/create-pnr/README.md),
  extracted from Sabre's published CSL Postman collection. The samples
  declare `"version": "2.2.0"`; confirm the on-wire value when reading
  the v2.5.0 spec.

#### "Legacy segments are being sunset" — what the banner means

The overview on Sabre's [Create Passenger Name Record REST page](https://developer.sabre.com/rest-api/create-passenger-name-record/2.5.0/index.html)
carries this banner:

> Sabre's legacy hotel shopping and booking services are being sunset.
> Please upgrade to the new Content Services for Lodging platform (CSL).
> As per SAN 16384, all new hotel bookings can only be created as CSL
> segments starting from March 26, 2024.

This is about the **segment type** recorded inside the Sabre PNR, not
about the CPNR endpoint. Sabre can record a hotel booking as either a
"legacy segment" or a "CSL segment"; SAN 16384 forbids creating new
legacy segments. CPNR REST itself is current — v2.5.0 is Sabre's default
documented version, and the CSL Setup & Guides page lists "Create PNR
(SOAP | REST)" as one of three valid "Reserve" options in the
orchestrated CSL flow (alongside SOAP-only Enhanced Hotel Book and
Update Itinerary).

In practice the request body our mapper builds must route Sabre into
producing a CSL segment, not a legacy one. The Postman samples we
committed are Sabre-authored against the current stack, so they should
already be on the CSL-segment path — confirm the exact discriminator
when reading the v2.5.0 spec.

### Enhanced Hotel Book (SOAP only)

Single-call orchestrated book that accepts a `BookingKey` directly. REST
consumers should use Create PNR instead.

## Environment and headers

- CERT base URL: `https://api-crt.cert.havail.sabre.com`
- Production base URL: `https://api.platform.sabre.com`
- Auth: `Authorization: Bearer <token>` — ATK (stateless, from Create Access
  Token) or ATH (stateful, from Create Session). Both formats are accepted.
- `Application-ID` header is recommended but not mandatory. Request one from
  your Sabre account manager before going to production.

## CERT test data

An XLSX of active CERT properties is available from the CSL API Support page
("these properties" link under Global ID to Sabre ID Property Mapping List).
Prefer those property IDs when smoke-testing — Production IDs are not
guaranteed to have availability in CERT.

### Sabre ID vs Global ID — avoid `WARN.0424` / `ERR.0392`

The same property shows up in the CSL content services under two numeric
identities. They are **not interchangeable** across endpoints:

- **Sabre Property ID** — 4–7 digit number (e.g. `35393`). Required by
  `get-hotel-avail --hotels` and by `get-hotel-details`/`get-hotel-rate-info`
  when `--code-context SABRE` (the server default).
- **Global Property ID** — 9-digit number (e.g. `100067438`). Required
  when `--code-context GLOBAL`. Also the identity Avail and Details echo
  back in `hotel.info.code`.

Passing a Global ID to `get-hotel-avail --hotels` produces
`WARN.0424 No hotels found which match this input`; passing a Global ID
to `get-hotel-details --code-context SABRE` produces
`ERR.0392 Invalid hotel code`. Both errors mean "wrong ID type," not
"property doesn't exist."

Additional behavior worth knowing:

- `get-hotel-avail --hotels` occasionally returns `WARN.0424` for a
  single ID but returns rates if the same ID is submitted in a batch of
  2–3. The batch trick is documented here so smoke tests don't chase
  a ghost. When in doubt, batch 2–3 Sabre IDs and pick whichever code
  Sabre returns in `hotel.info.code`.
- Source-100 "supplier timeout" (`WARN.0724` with
  `WarningDetails: 100-Supplier timeout`) on Avail is upstream vendor
  flakiness, retry-safe.

## Common error codes

| Code | Meaning |
| --- | --- |
| `USG_INVALID_SECURITY_TOKEN` | Token expired — re-issue via Create Session / Create Access Token. |
| `USG_SECURITY_ICE_ERROR` | API access not enabled on the credential. Contact `webservices.support@sabre.com`. |
| `ERR.NGHP-AGGREGATOR.VAULT_API_ERROR` | Aggregator credentials missing — configure in Hotel Manager. |
| `WARN.0724` (Vendor response error) | Vendor-specific — surfaces with a `WarningDetails` message; does not block success envelope. |
