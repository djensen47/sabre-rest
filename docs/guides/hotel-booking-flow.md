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
| 5 | Retrieve | Get Reservation (SOAP only) | Optional |

_\* At least one of Get Hotel Avail **or** Get Hotel Details must be called
before Hotel Price Check — the `RateKey` produced by those two endpoints is
the input to Price Check._

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
  resolution utilities.

## Booking endpoint

### Create Passenger Name Record (REST)

- Path: `POST {base}/v2.2.0/passenger/records?mode=create`
- The `CreatePassengerNameRecordRQ` body wraps a `HotelBook` block:
  - `BookingInfo.BookingKey` — from Price Check
  - `BookingInfo.RequestorID`
  - `Rooms.Room[].Guests[]` — guest name, contact, `LeadGuest`
  - `PaymentInformation.FormOfPayment.PaymentCard` — card + billing address
  - `POS.Source` — `RequestorID` (IATA), `AgencyAddress`, `AgencyName`,
    `ISOCountryCode`, `PseudoCityCode`
- Sample body shapes for GDS, EAN, BCOM, and HBD suppliers live in the CSL
  Postman collection linked from [CSL API Support](https://developer.sabre.com/product-collection/content-services-for-lodging-csl/v1/help-documentation/csl-api-support.html).

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

## CERT test properties

An XLSX of active CERT properties is available from the CSL API Support page
("these properties" link under Global ID to Sabre ID Property Mapping List).
Prefer those property IDs when smoke-testing — Production IDs are not
guaranteed to have availability in CERT.

## Common error codes

| Code | Meaning |
| --- | --- |
| `USG_INVALID_SECURITY_TOKEN` | Token expired — re-issue via Create Session / Create Access Token. |
| `USG_SECURITY_ICE_ERROR` | API access not enabled on the credential. Contact `webservices.support@sabre.com`. |
| `ERR.NGHP-AGGREGATOR.VAULT_API_ERROR` | Aggregator credentials missing — configure in Hotel Manager. |
| `WARN.0724` (Vendor response error) | Vendor-specific — surfaces with a `WarningDetails` message; does not block success envelope. |
