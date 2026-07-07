# Sabre API Entitlement Errors

A companion to the [Sabre API Primer](./sabre-api-primer.md). It catalogues, per
API, the errors Sabre returns when a request **authenticates fine but is not
*entitled*** — the credential, PCC, TJR option, feature flag, supply-source
agreement, or carrier authorization needed to do the thing is not turned on.
These are the failures that look like bugs but are really *provisioning*: the
code is correct and the request is well-formed; Sabre is saying "you are not set
up for this."

> **Why this doc exists.** Entitlement failures are the ones you cannot fix in
> code. Knowing the exact code/message Sabre uses for each lets our wrapper
> *classify* them — surface "ask your account manager to enable X," not "no
> results" or "bad request." It is sourced from the **Sabre Developer Hub**
> error pages, the OpenAPI specs in [`docs/specifications/`](../specifications/),
> and our own CERT verification (cross-linked where relevant). Like the primer,
> it describes Sabre's contract, not our wrapper.

## How to read this guide

> ⚠️ **Verified in CERT** — we hit this (or proved its absence) against a live
> Sabre environment. The note says which.

> ⚖️ **Classification call** — Sabre returns this in a way that is easy to
> mis-handle (a 200 that is really a failure, a "not found" that is really an
> id/entitlement problem, a generic 403 that means "buy the product"). A
> reviewer should confirm our wrapper maps it to the right meaning.

Codes and messages are quoted **verbatim** from Sabre where possible.

---

## Entitlement Summary

An **entitlement** is something that must be turned on for your account before a
well-formed, authenticated request will work: a product sold to your PCC, a TJR
option, a feature flag, a supply-source agreement, or a carrier-level
authorization. When one is missing, Sabre rejects the request even though the
code is correct — and sometimes rejects it *silently* (an empty result or a
`sellable: false`, not an error). This table is the at-a-glance list of every
entitlement the docs surfaced; the sections below give the codes and detail.

| Entitlement | What it is | APIs |
| --- | --- | --- |
| Product authorization (`ERR.2SG.SEC.NOT_AUTHORIZED` / 403) | The API itself is sold to this PCC/credential | All REST APIs |
| CSL API access (`USG_SECURITY_ICE_ERROR`) | The hotel (CSL) platform is sold to this account | All hotel/CSL APIs |
| Concurrency limit (`ERR.2SG.GATEWAY.REQUEST_THROTTLED` / 429) | Allocated cap on concurrent requests | All REST APIs |
| TJR: *Store Passenger Type In PNR* | TJR option letting the PNR store passenger type codes | Booking Mgmt — Create Booking |
| TJR: *Car Traveler Email Address* | TJR option allowing a traveler email on car segments | Booking Mgmt — Create Booking (car) |
| Target-PCC / context-change auth | Right to act in a PCC other than your own | Booking Mgmt — Create, Modify, Get Booking |
| Automated Refunds active (`AUTOMATED_REFUNDS_INACTIVE`) | Automated-refund feature provisioned for the PCC | Booking Mgmt — Refund |
| Automated reissue provisioned ("reissue not active", 200 + `errors[]`) | Automated exchange/reissue switched on for the PCC | Flight Reshop → Exchange Booking |
| Ticket printer designation (`PRINTER_NOT_ASSIGNED`) | A ticket printer assigned for the PCC | Booking Mgmt — Fulfill, Void, Refund, Cancel |
| Electronic-document service ("travel agency subscribers only") | Access to the Get Electronic Document downline service | Booking Mgmt — Get Booking, Cancel |
| Downline service auth (fare offers / fare rules / leg detection) | Entitlement to the services Get Booking aggregates | Booking Mgmt — Get Booking |
| Travel-agency subscriber / TJR booking access (`RESOURCE_RESTRICTED`) | Credential + TJR allowed to read the booking | Booking Mgmt — Get Booking (incl. CSL hotel PNRs) |
| Aggregator agreement + credentials (`ERR.NGHP-AGGREGATOR.VAULT_API_ERROR`) | Contract + vaulted credentials for aggregator hotel content | Hotel APIs (aggregator supply sources) |
| Carrier-level seat sell auth (silent: `sellable: false`) | Authority to sell seats for a given carrier | Get Seats |
| IntelliSell tier subscription (silent: "No Availability") | Subscription to the requested shopping tier/option count | Bargain Finder Max |
| Extended-payment / agency FOP settings | Agency settings permitting the form of payment used | Booking Mgmt — Create Booking |

---

## Background Details

### 1. Source reference

| Surface | What it documents | Link |
| --- | --- | --- |
| **Platform gateway error list** (Booking Mgmt) | The shared `ERR.2SG.*` family every modern REST API returns | [Booking Management → Errors](https://developer.sabre.com/rest-api/booking-management-api/v1/errors.html) |
| **Booking Mgmt per-method error lists** | Business-level entitlement errors (TJR, PCC context, automated refunds, printers) | [Get Booking](https://developer.sabre.com/rest-api/booking-management-api/v1/help-documentation/get-booking-error-list.html) · [Create](https://developer.sabre.com/rest-api/booking-management-api/v1/help-documentation/create-booking-error-list.html) · [Cancel](https://developer.sabre.com/rest-api/booking-management-api/v1/help-documentation/cancel-booking-error-list.html) · [Modify](https://developer.sabre.com/rest-api/booking-management-api/v1/help-documentation/modify-booking-error-list-0.html) · [Fulfill](https://developer.sabre.com/rest-api/booking-management-api/v1/help-documentation/fulfill-flight-tickets-error-list.html) · [Void](https://developer.sabre.com/rest-api/booking-management-api/v1/help-documentation/void-flight-tickets-error-list.html) · [Check](https://developer.sabre.com/rest-api/booking-management-api/v1/help-documentation/check-flight-tickets-error-list.html) · [Refund](https://developer.sabre.com/rest-api/booking-management-api/v1/help-documentation/refund-flight-tickets-error-list.html) |
| **CSL API Support → Common Error Messages** | The hotel (CSL) security & supply-source entitlement codes | [CSL API Support](https://developer.sabre.com/product-collection/content-services-for-lodging-csl/v1/help-documentation/csl-api-support.html) |
| **Per-API Errors pages** (BFM, Revalidate, Flight Reshop, …) | Only the shared gateway family — no API-specific entitlement codes | e.g. [Flight Reshop → Errors](https://developer.sabre.com/rest-api/flight-reshop-api/1.0/errors.html), [Revalidate → Errors](https://developer.sabre.com/rest-api/revalidate-itinerary/6.2.0/errors.html) |

> **Note on coverage.** Sabre splits some products into **Agency** and **Airline**
> variants (`get-seats-agency`, `get-ancillaries-agency`). Our wrapper targets
> the agency-facing ones, so those are what this doc cites.

---

### 2. The platform gateway family — applies to *every* REST API

Before any business logic runs, the Sabre API gateway authenticates and
authorizes the token. These `ERR.2SG.*` codes are **identical across Bargain
Finder Max, Revalidate, Flight Reshop, Exchange Booking, Get Seats, Get
Ancillaries, and Booking Management** — verified by reading each product's own
Errors page. If you are looking for "why is this whole API forbidden," it is
here, not in the API-specific list.

| HTTP | Code / message | Meaning | Entitlement? |
| --- | --- | --- | --- |
| 401 | `ERR.2SG.SEC.MISSING_CREDENTIALS` / "Credentials are missing or the syntax is not correct" | No/garbled token | No — fix the request |
| 401 | `ERR.2SG.SEC.INVALID_CREDENTIALS` / "Wrong clientID or clientSecret" / `invalid_client` | Bad token or exhausted TAM pool | No — fix credentials |
| 401 | "Not authorized to make this request. Check access level…" | Token lacks the access level | **Maybe** — verify token scope |
| **403** | **`ERR.2SG.SEC.NOT_AUTHORIZED`** / "Request is for a resource that is forbidden" | **The credential is valid but not entitled to this API.** Resolution Sabre gives: *"Verify that your token credentials allow authorization to call this API. Contact your Sabre account manager to verify access."* | **Yes — the entitlement wall** |
| 403 | `ERR.2SG.CLIENT.SERVICE_UNKNOWN` | Unknown service/version in the URL | No — looks like entitlement, is actually a wrong URL/version |
| 405 | "Method is not valid or authorized for this endpoint" | Wrong HTTP verb | No |
| 429 | `ERR.2SG.GATEWAY.REQUEST_THROTTLED` / "Active token count is exceeded" | Concurrency cap hit. *"Contact your Sabre account manager to … increase your allocated concurrent request limit."* | **Quota** — a provisioned limit, not a code bug |

> ⚖️ **Classification call** — `403 ERR.2SG.SEC.NOT_AUTHORIZED` is the single
> most important entitlement signal in the platform. It is **not** a code error
> and **not** retryable — it means "this PCC/PCC-credential pair has not been
> sold this product." Our wrapper should distinguish it from `400`/validation
> and from `ERR.2SG.CLIENT.SERVICE_UNKNOWN` (a typo in the path), which superficially
> reads the same.

> ⚠️ **Verified in CERT** — this is the wall the exchange work calls the "SEAS
> `ERR.2SG.SEC.NOT_AUTHORIZED` wall" in
> [`flight-exchange-flow.md`](./flight-exchange-flow.md). Flight Reshop on our
> CERT PCC returns **HTTP 200**, i.e. it cleared this gate — proof the
> entitlement problem there was downstream (automated-reissue provisioning),
> not gateway authorization.

---

### 3. Flights

#### 3.1 Bargain Finder Max · Revalidate Itinerary

No API-specific entitlement errors. Both return only the §2 gateway family
(confirmed on each product's Errors page). A PCC not entitled to shop gets
`403 ERR.2SG.SEC.NOT_AUTHORIZED`; a tier you are not subscribed to silently
yields a *"No Availability"* response rather than an error (see the
`IntelliSellTransaction.RequestType.Name` note in
[`revalidate-itinerary.yml`](../specifications/revalidate-itinerary.yml)).

> ⚖️ **Classification call** — for BFM, "entitlement denied" and "no fares" can
> both surface as an empty/`No Availability` result. Don't report a subscription
> gap as "no results."

#### 3.2 Booking Management — Create Booking

The richest source of business-level entitlement errors. Codes below are from
the [Create Booking error list](https://developer.sabre.com/rest-api/booking-management-api/v1/help-documentation/create-booking-error-list.html);
`type` is Sabre's category column.

| Code | Type | Message (verbatim) |
| --- | --- | --- |
| `UNABLE_TO_ADD_TRAVELER_PASSENGER_TYPE_NOT_ENABLED` | APPLICATION_ERROR | "Activate the *Store Passenger Type In PNR* option in your Travel Journal Record (TJR)." |
| `UNABLE_TO_CHANGE_CONTEXT_UNAUTHORIZED` | APPLICATION_ERROR | "User is unauthorized to change context for the desired PCC." |
| `UNABLE_TO_CHANGE_CONTEXT_NOT_ALLOWED` | APPLICATION_ERROR | "User is unauthorized to change context for the desired PCC." |
| `NDC_PCC_MISMATCH` | APPLICATION_ERROR | "The Pseudo City Code (PCC) information from the NDC offer does not match … used for NDC order creation." |
| `HEADER_DATA_MISSING_TARGET_PCC` | BAD_REQUEST | "Target PCC was defined but header data is missing. Please complete X-Sabre-Group (ATK) or X-Sabre-Current-City (ATH)." |
| `UNABLE_TO_ADD_FORM_OF_PAYMENT_EXTENDED_PAYMENT` | BAD_REQUEST | "Extended payment is not allowed. Check your agency settings." |
| `UNABLE_TO_BOOK_CAR_EMAIL_NOT_SUPPORTED` | APPLICATION_ERROR | "…activate the *Car Traveler Email Address* option in your Travel Journal Record (TJR)." |
| `UNAUTHORIZED_ACCESS` | UNAUTHORIZED | (when an invalid/expired ATK token is used) |

> ⚠️ **Verified in CERT** — `UNABLE_TO_ADD_TRAVELER_PASSENGER_TYPE_NOT_ENABLED`
> is exactly the wall documented in
> [`docs/sabre-support-tjr-request.md`](../sabre-support-tjr-request.md): our
> CERT PCC lacked the *Store Passenger Type In PNR* TJR option, so `createBooking`
> rejected the `passengerCode`. The only passenger type that bypassed it was
> `INF` (which doesn't require TJR storage). **This is a TJR setting, not a code
> fix.**

> ⚖️ **Classification call** — `UNABLE_TO_CHANGE_CONTEXT_*` fires whenever we
> set a *target PCC* the credential isn't authorized to act in. If our wrapper
> ever exposes branch/target-PCC booking, these need to map to "not entitled for
> that PCC," not a generic application error.

#### 3.3 Booking Management — Get Booking

Get Booking aggregates several downline domains, and **each can return its own
authorization failure** under the umbrella code `UNAUTHORIZED_ACCESS`. The
booking still partially renders; the missing piece is flagged.

| Code / type | What was denied (verbatim message) |
| --- | --- |
| `UNAUTHORIZED_ACCESS` / UNAUTHORIZED | "The **fareOffers** could not be retrieved. The service GetAncillaryOffersRQ returned an authorization failure. Please verify the used credentials with your account manager." |
| `UNAUTHORIZED_ACCESS` / UNAUTHORIZED | "The **fareRules** could not be retrieved. The service StructureFareRulesRQ returned an authorization failure…" |
| `UNAUTHORIZED_ACCESS` / UNAUTHORIZED | "The **journeys** could not be retrieved. The service Leg Detection returned an authorization failure…" |
| `UNAUTHORIZED_ACCESS` / UNAUTHORIZED | "**Electronic document** details could not be retrieved. The service Get Electronic Document API (TKT_ElectronicDocumentServicesRQ) is available to **Sabre travel agency subscribers only**. Please verify the used credentials with your account manager." |
| `UNAUTHORIZED_ACCESS` / **RESOURCE_RESTRICTED** | "Access to selected booking is restricted. Verify the used credentials and **Travel Journal Record settings** with your account manager." |
| `FORBIDDEN_ACCESS` / FORBIDDEN | "Booking details could not be retrieved. The downline service returned a forbidden access…" |
| `UNABLE_TO_CHANGE_CONTEXT_UNAUTHORIZED` / `_NOT_ALLOWED` | "User is unauthorized to change context for the desired PCC." |
| `JOURNEY_DATA_UNAVAILABLE` | "Journey details cannot be determined due to missing Pseudo City Code (PCC) information." |

> ⚖️ **Classification call** — a partial Get Booking (e.g. ticket details
> missing because the agency isn't entitled to the electronic-document service)
> is *not* a "booking not found." Surface the per-section `UNAUTHORIZED_ACCESS`
> so callers know the data exists but the credential can't read it.

#### 3.4 Booking Management — Cancel / Modify

**Cancel** ([error list](https://developer.sabre.com/rest-api/booking-management-api/v1/help-documentation/cancel-booking-error-list.html)):

| Code / type | Message |
| --- | --- |
| `UNAUTHORIZED_ACCESS` / UNAUTHORIZED | "Electronic document details could not be retrieved. The service Get Electronic Document API (TKT_ElectronicDocumentServicesRQ) is available to **Sabre travel agency subscribers only**. Please verify the used credentials with your account manager." |
| `SECURITY_TOKEN_CONTEXT_ERROR` / BAD_REQUEST | "Security context not initialized. Nothing was cancelled." / "Invalid authentication token. Nothing was cancelled." |

**Modify** ([error list](https://developer.sabre.com/rest-api/booking-management-api/v1/help-documentation/modify-booking-error-list-0.html)):

| Code / type | Message |
| --- | --- |
| `UNABLE_TO_CHANGE_CONTEXT_UNAUTHORIZED` / `_NOT_ALLOWED` | "User is unauthorized to change context for the desired PCC." |
| `UNAUTHORIZED_ACCESS` / UNAUTHORIZED | (invalid/expired ATK token) |
| `PRICE_QUOTE_REISSUE_NOT_SUPPORTED` / BAD_REQUEST | "The selected operation is not supported. PQR modification is not allowed." |
| `MODIFICATION_NOT_SUPPORTED` / APPLICATION_ERROR | "…Modification of traveler-related information is not allowed." |

#### 3.5 Booking Management — Fulfill Flight Tickets

Fulfillment's entitlement-adjacent failures are about the **ticket printer** —
some PCCs *require* a designated printer, and issuance fails without one.

| Code / type | Message |
| --- | --- |
| `PRINTER_NOT_ASSIGNED` / APPLICATION_ERROR | "No new tickets have been issued due to a lack of ticket printer assignation. **Designate a required printer** and repeat fulfillment operation." |
| `DUPLICATE_PRINTER_DESIGNATION` / BAD_REQUEST | "…duplicate printer objects. Please request only one printer profile." |
| `INVALID_COMBINATION_PRINTER_PROFILE_AND_MANUAL_DESIGNATION` / BAD_REQUEST | invalid mix of profile + manual designation |
| `MULTIPLE_PRINTER_TYPES` / `NO_PRINTER_TYPE` / BAD_REQUEST | malformed printer address object |
| `SECURE_FLIGHT_PASSENGER_DATA_MISSING` / APPLICATION_ERROR | "…The booking is missing mandatory Secure Flight Passenger Data." |

> ⚖️ **Classification call** — this matches the primer's fulfill decision point
> (the `printerAddress`/country designation that *"some PCCs require"*).
> `PRINTER_NOT_ASSIGNED` is a per-PCC configuration requirement, not a bad
> request — treat it as "your PCC needs a printer designated."

> ⚠️ **Verified in CERT** — `AirTicketLLSRQ: NEED AIRLINE PNR LOCATOR` can
> surface when fulfilling a reissued ticket, but it is **not** an entitlement
> error — don't classify it as one. It means the new segment has no airline
> record locator, which happens when the exchange sold the segment *passively*
> (`GK`). On the documented `NN` sell path the segment is carrier-confirmed and
> fulfill succeeds — verified end-to-end in CERT on 2026-06-12 (see
> [`flight-exchange-flow.md`](./flight-exchange-flow.md)). Note this proved
> **date-dependent on our CERT PCC**: the identical `NN` request aborted air-book two
> days earlier, so the resolution is server-side, not a credential/TJR lever.

#### 3.6 Booking Management — Refund / Void / Check

**Refund** carries the canonical *feature-provisioning* error, the air-refund
twin of the exchange story
([error list](https://developer.sabre.com/rest-api/booking-management-api/v1/help-documentation/refund-flight-tickets-error-list.html)):

| Code / type | Message |
| --- | --- |
| **`AUTOMATED_REFUNDS_INACTIVE`** / **UNAUTHORIZED** | **"Unable to refund. The Automated Refunds feature is inactive for your PCC. For activation, please place an order in Sabre Central."** |
| `UNABLE_TO_REFUND_TICKET` / CANCELLATION_ERROR | "Ticket is not eligible for automated refund. The ticket was exchanged from %s…" / "…issued with a miscellaneous form of payment…" / "…the document is an EMD and currently not supported." |
| `INVALID_FLAGS_COMBINATION`, `DESIGNATE_PRINTER_FAILED`, `UNDESIGNATE_PRINTER_FAILED` | printer designation problems (as §3.5) |

> ⚖️ **Classification call** — `AUTOMATED_REFUNDS_INACTIVE` is the explicit
> provisioning flag the primer points at: `checkFlightTickets` exposes
> `isAutomatedRefundsEligible` precisely so you can detect this *before*
> attempting the refund. There is **no analogous flag for exchanges** — which is
> why automated-reissue provisioning has to be discovered the hard way (an empty
> Flight Reshop). See §3.7 and the primer §3.2/§3.3.

**Void** — only the printer-designation family (`INVALID_FLAGS_COMBINATION`,
`DESIGNATE_PRINTER_FAILED`, `UNDESIGNATE_PRINTER_FAILED`, `DESIGNATE_PRINTER_PROBLEM`).
No feature-entitlement gate of its own.

**Check Flight Tickets** — **no entitlement errors.** Its failures are
eligibility (coupon under airport control, no open coupon), not authorization.
This matters: a `false` on `isChangeable`/`isRefundable` is a *fare-rule*
verdict, not an entitlement verdict.

#### 3.7 Flight Reshop · Exchange Booking

Neither has API-specific entitlement codes on the Dev Hub — Exchange Booking has
no Errors page at all; Flight Reshop's lists only the §2 gateway family. Their
entitlement story is behavioural, and is our own CERT finding:

> ⚠️ **Verified in CERT** — **Flight Reshop returns HTTP 200 even when not
> entitled.** Before automated reissue was provisioned on our CERT PCC, every
> reshop came back `200` with the reason in the body's `errors[]`: *"Automated
> reissue not active for this ticket."* `checkFlightTickets` had already said
> `isChangeable: true` with valid CAT-31 rules — the gap was pure PCC
> provisioning, invisible to every eligibility flag. After Sabre activated it
> (2026-06-09), the same call returns 45 priceable offers. See
> [`flight-exchange-flow.md`](./flight-exchange-flow.md).

> ⚖️ **Classification call** — because Reshop signals "not entitled" as a
> **200 + `errors[]`**, a naive `status===200 ⇒ success` check misreads it as
> "no offers found." Always inspect `errors[]`. Also: `distributionModel`
> selects `ATPCO` vs `NDC` shopping — requesting a model you aren't entitled to
> is its own (separate) denial.

---

### 4. Hotels (Content Services for Lodging)

CSL REST APIs do **not** publish per-endpoint error code pages; they all share
the [CSL API Support → Common Error Messages](https://developer.sabre.com/product-collection/content-services-for-lodging-csl/v1/help-documentation/csl-api-support.html)
list. The entitlement-relevant ones:

| Code | Meaning / action (verbatim) |
| --- | --- |
| `USG_INVALID_SECURITY_TOKEN` | "Security token is invalid / expired. Create a new security token using SessionCreateRQ." |
| **`USG_SECURITY_ICE_ERROR`** | **"API access issue. Please contact webservices.support@sabre.com to request access to this API."** |
| **`ERR.NGHP-AGGREGATOR.VAULT_API_ERROR`** | **"Request is for aggregator content but no aggregator credentials exist. Use Hotel Manager to add aggregator credentials."** |

> ⚖️ **Classification call — supply source.** `ERR.NGHP-AGGREGATOR.VAULT_API_ERROR`
> is the primer's "supply source" decision point made concrete: GDS chain
> content works by default, but aggregator content (Expedia/EAN, Booking.com,
> HotelBeds, …) needs a prior aggregator agreement *and* credentials loaded in
> Hotel Manager. Asking for an aggregator source you haven't contracted is an
> entitlement failure, not an availability one.

> ⚖️ **Classification call — `USG_SECURITY_ICE_ERROR`** is the CSL equivalent of
> `403 ERR.2SG.SEC.NOT_AUTHORIZED`: the API itself isn't sold to this account.
> The fix is a support request, not a code change.

#### 4.1 The id-type trap (looks like access, isn't)

> ⚠️ **Verified in CERT** ([`hotel-booking-flow.md`](./hotel-booking-flow.md)) —
> passing the **wrong hotel-id type** does **not** report "wrong type"; it
> reports a *not-found / no-match*:
> - Global ID where a Sabre ID is expected on Avail → `WARN.0424` ("No hotels
>   found which match this input").
> - Wrong id type on Details → `ERR.0392` ("invalid hotel code").
>
> These aren't entitlement errors, but they masquerade as access/lookup failures
> and waste the same debugging time — listed here so the wrapper doesn't
> misattribute them to a permissions gap. (The bare `ERR.0381` in the specs'
> error schema is just the generic example value, "Invalid check-in date.")

#### 4.2 Retrieve / cancel on a CSL booking

> ⚠️ **Verified in CERT** — Get Booking against a CSL-created hotel PNR
> previously returned `UNAUTHORIZED_ACCESS` tied to **TJR settings** (the
> `RESOURCE_RESTRICTED` variant in §3.3), the hotel sibling of the
> [TJR request](../sabre-support-tjr-request.md). That entitlement gap is
> now resolved: as of 2026-07-07, Get Booking returns the `hotels[]`
> reservation with room, rate, and payment detail on this EPR. The unified
> REST `cancelBooking` was separately verified to accept a CSL hotel PNR and
> return a clean success.

---

### 5. Supporting & content APIs

#### 5.1 Get Seats (Agency) · Get Ancillaries (Agency)

No API-specific entitlement *codes* — both rely on the §2 gateway family for
hard authorization, then express finer-grained entitlement as **data, not
errors**:

> ⚖️ **Classification call — carrier-level seat authorization.** Sabre's Get
> Seats overview states: *"The Point of Sale application or PCC might not be
> authorized to sell seats for one or more carriers. In that case, seat
> selection will not be available."* This is surfaced as a non-sellable seat map
> (`sellable: false`), **not** an error. So "can't sell this seat" can mean
> *not entitled for that carrier* just as easily as *price not yet guaranteed* —
> don't conflate them.

For Get Ancillaries, an offer id taken from a BFM (shop) response comes back
`"sellable": false` with no `offerItemId`s; you must re-price first. Again a
data signal, not an error code. The hard "API not sold to you" case is the
gateway `403 ERR.2SG.SEC.NOT_AUTHORIZED`.

#### 5.2 Create Passenger Name Record (hotel booking path)

CPNR REST has no dedicated error page; it inherits the §2 gateway family and,
for hotels, the §4 CSL codes (it wraps a `HotelBook` block). Its one prominent
banner is a *deprecation*, not an entitlement: legacy hotel shopping/booking is
sunset, and per **SAN 16384** all new hotel bookings must be CSL segments
(primer §4.1). Booking the now-forbidden legacy segment type is a content-path
problem, not a permissions one.

#### 5.3 Lookups (Airline / Alliance / Multi-Airport City)

Reference-data `GET`s. Cacheable, no reservation, no business entitlement —
only the §2 gateway family applies (a `403` means the lookup product itself
isn't on the credential, which is rare).

---

### 6. Quick map — "which entitlement do I need?"

| Symptom | Code | Lever to pull |
| --- | --- | --- |
| Whole API forbidden | `403 ERR.2SG.SEC.NOT_AUTHORIZED` (air) · `USG_SECURITY_ICE_ERROR` (hotel) | Account manager / support — buy the product for this PCC |
| `createBooking` rejects passenger type | `UNABLE_TO_ADD_TRAVELER_PASSENGER_TYPE_NOT_ENABLED` | Enable *Store Passenger Type In PNR* TJR option |
| Can't act in a target PCC | `UNABLE_TO_CHANGE_CONTEXT_UNAUTHORIZED` / `_NOT_ALLOWED` | Authorize the credential for that PCC |
| Refund won't process | `AUTOMATED_REFUNDS_INACTIVE` | Order Automated Refunds in Sabre Central |
| Exchange shop returns nothing (HTTP 200) | `errors[]`: "Automated reissue not active…" | Provision automated reissue on the PCC |
| Ticket won't issue | `PRINTER_NOT_ASSIGNED` | Designate a ticket printer for the PCC |
| Get Booking missing ticket/fare data | `UNAUTHORIZED_ACCESS` (per-section) / `RESOURCE_RESTRICTED` | Entitle the downline service / check TJR |
| Hotel aggregator content empty/denied | `ERR.NGHP-AGGREGATOR.VAULT_API_ERROR` | Aggregator agreement + credentials in Hotel Manager |
| Concurrency throttled | `429 ERR.2SG.GATEWAY.REQUEST_THROTTLED` | Account manager — raise the concurrent-request limit |

---

### 7. Related material in this repo

- [`sabre-api-primer.md`](./sabre-api-primer.md) — the conceptual tour; this doc
  is the entitlement-error appendix to its decision points.
- [`flight-exchange-flow.md`](./flight-exchange-flow.md) — source of the
  CAT-31 / automated-reissue / `NEED AIRLINE PNR LOCATOR` CERT findings.
- [`hotel-booking-flow.md`](./hotel-booking-flow.md) — source of the CSL
  Sabre-ID/Global-ID (`WARN.0424` / `ERR.0392`) and CSL `UNAUTHORIZED_ACCESS`
  findings.
- [`../sabre-support-tjr-request.md`](../sabre-support-tjr-request.md) — the
  filed support request behind the *Store Passenger Type In PNR* TJR error.
- [`../specifications/`](../specifications/) — the OpenAPI specs (generic
  `Error`/`Warning` schemas; the concrete entitlement codes are on the Dev Hub).
