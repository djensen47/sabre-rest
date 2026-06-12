# Flight Exchange / Reissue Flow (Sabre)

This guide documents the post-booking flight-change (exchange / reissue) flow:
which REST endpoints exist, which are on the canonical path, how they chain, and
how the steps were verified in CERT.

Source: Sabre "Normalized API Post Booking Process" (PTC guidance, 2026) and the
legacy "End-to-End Exchanges Workflow (Shop, Book, Price, Ticket)" developer
guide. Sabre's PTC recommended the REST/Agentic path below over the legacy
SOAP `ExchangeShoppingRQ` + `AutomatedExchangesLLSRQ` composition.

> **Status (2026-06-12): fully ticketed end-to-end in CERT on PCC `H50H`.** The
> entire flow now completes — shop → price → commit → **fulfill the reissued
> ticket** — on the documented `NN` sell path. Two worked examples on the same
> day: AA DFW→LAX as a `$0` even exchange, and AA ORD→MIA as a **$50.01
> add-collect** — both committed `status: Complete` (PQR #02, `amountReturned`
> matching the reshop quote to the penny), swapped the segment, and issued a
> reissued ticket. The `NEED AIRLINE PNR LOCATOR` wall that previously blocked
> fulfillment did **not** occur.
>
> **This reverses the 2026-06-10 finding.** On 6-10, selling new segments as
> `NN` aborted the air-book step and only a passive `GK` sell committed (which
> then could not be ticketed — see the history note in step 4). Between 6-10 and
> 6-12 **nothing changed in our request** that explains this (the fulfill body
> was byte-identical; the 6-12 run even kept `NN` in `HaltOnStatus` and still
> did not halt). The cause is **server-side on `H50H`** — most likely automated
> reissue provisioning continuing to settle after its 2026-06-09 activation, or
> a change in CERT's simulated carrier link. The library now defaults new
> segments to `NN` (Sabre's documented value); `GK` is available as a per-segment
> override.
>
> One thing baked into the library regardless: the reshop `errors` array must be
> checked even on HTTP 200.

## Orchestrated path

| Step | Action | REST API | CLI command | Status |
| --- | --- | --- | --- | --- |
| 1 | Retrieve | Booking Management v1 `getBooking` | `get-booking` | Optional |
| 2 | Ticket eligibility | Booking Management v1 `checkFlightTickets` | `check-tickets` | Recommended |
| 3 | Shop / price the change | **Flight Reshop** `flightReshop` | `flight-reshop` | **Mandatory** ✓ † |
| 4 | Commit the reissue | Exchange Booking v1.1.0 `exchangeBooking` | `exchange-booking` | **Mandatory** ✓ (quote + commit) |
| 5 | Issue the new ticket | Booking Management v1 `fulfillFlightTickets` | `fulfill-tickets` | **Mandatory** ‡ (verified 2026-06-12) |
| 6 | Verify | Booking Management v1 `getBooking` | `get-booking` | Optional |

_† Flight Reshop is the REST replacement for the legacy `ExchangeShoppingRQ`. It
is the step that returns **priceable** reissue offers, so the caller no longer
guesses a replacement fare that later fails CAT-31 pricing in Exchange Booking.
It is a **premium, beta, ATPCO-only** API (NDC exchange in progress)._

_‡ Exchange Booking can also collect form-of-payment and end-transact in one
call (omit `confirm` to quote, include it to commit). When the reissue is
committed but not yet ticketed, `fulfillFlightTickets` issues the new document._

### Voluntary-change branches

Sabre's "Normalized Post Booking" diagram fans out from **Ticket Eligibility**
(`checkFlightTickets`) into three branches:

- **Void** (`voidFlightTickets`) — same-day reversal of an issued ticket.
- **Refund** (`refundFlightTickets`) — CAT-33 voluntary refund.
- **Exchange** (this guide) — CAT-31 voluntary change: shop → book → fulfill.

All three are wrapped in `bookingManagementV1` except Exchange shopping, which is
`flightReshopV1`, and the exchange commit, which is `exchangeBookingV1`.

### Key chaining

```
getBooking ──► ticket number(s) ──► checkFlightTickets ──► isChangeable?
                       │                                        │
                       └──────────────► flightReshop ◄──────────┘
                                            │
                                   offer.id + new journey
                                            │
                                            ▼
                                     exchangeBooking ──► PQR / reissue
                                            │
                                            ▼
                                  fulfillFlightTickets ──► new ticket
                                            │
                                            ▼
                                        getBooking (verify)
```

- **Ticket number** — produced by `getBooking` (or already known); consumed by
  `checkFlightTickets` and `flightReshop`.
- **`isChangeable` / `exchangePenalties` (CAT-31)** — `checkFlightTickets`
  output; gate the flow on it before shopping. Note there is **no** field
  reporting automated-reissue *provisioning* (the refund side has
  `isAutomatedRefundsEligible`; the exchange side has no equivalent), so a
  `true` here does not guarantee `flightReshop` will produce offers.
- **Offer** — `flightReshop` output (`offers[].id`, `journeyRefs`,
  `totalPriceDifference`). Carries the priceable fare difference + change fee
  the UI shows; feeds the new segments into `exchangeBooking`.

## Step detail

### 1 / 6. Get Booking — `get-booking`

Stateless PNR retrieval. Use it to surface current flights and ticket numbers
before a change, and to verify the new itinerary after.

```
sabre-rest get-booking --confirmation-id PNR123
```

### 2. Check Flight Tickets — `check-tickets`

Read-only eligibility check. Returns per-ticket `isVoidable` / `isRefundable` /
`isChangeable` plus CAT-31 `exchangePenalties` and CAT-33 `refundPenalties`,
up to 12 tickets at once. Call it on an **issued** ticket (the eligibility data
only exists once a coupon is open).

```
sabre-rest check-tickets --confirmation-id PNR123
sabre-rest check-tickets --tickets 0011234567890,0011234567891
```

### 3. Flight Reshop — `flight-reshop`

Shops for priceable reissue offers. Body-driven (nested `journeys[]` /
`tickets[]`). Read-only — does not mutate the PNR. Returns HTTP 200 even when no
offers can be produced, so always inspect `errors` as well as `offers`.

```
sabre-rest flight-reshop --body '{
  "journeys": [{
    "departureLocation": { "cityCode": "DFW" },
    "arrivalLocation":   { "cityCode": "LAX" },
    "departureDate": "2026-09-26"
  }],
  "tickets": [{ "number": "0012972101507" }]
}'
```

Optional body fields: `bookingId` (PNR), `targetPcc`, `cabinName`
(`Economy` … `First`), `distributionModel` (`ATPCO` / `NDC`), per-journey
`departureTimeWindow` / `arrivalTimeWindow`. See
[`flight-reshop.yml`](../specifications/flight-reshop.yml) for the full surface;
v1 of this library exposes the focused slice above (see the `types.ts` header
for what is deferred).

`scripts/flight-reshop-flow.sh` drives this step end-to-end and prints the
offers (or the downline error) — see that script for a ready-to-run example.

### 4. Exchange Booking — `exchange-booking`

Commits the reissue: cancels old segments, sells the new ones, prices the
exchange (creating a Price Quote Reissue), and optionally collects FOP and
end-transacts — all in one call. Omit `confirm` to **quote** (PQR stored, no
FOP charged); include it to **commit**. Body-driven. See
[`exchange-booking-flow.sh`](../../scripts/exchange-booking-flow.sh).

> **New segments sell as `NN` by default** (Sabre's documented value, used in
> the spec's canonical example). On 2026-06-12 this committed *and* fulfilled
> end-to-end in CERT. `GK` (passive/guaranteed) remains available as a
> per-segment `status` override.
>
> **History — the default flipped, and why.** Until 2026-06-10 the library
> defaulted to `GK`, because on that day a pending `NN` segment tripped the
> host's HaltOnStatus and aborted air-book ("Unable to perform air booking
> step") *even with `HaltOnStatus` cleared* — `GK` was then the only status
> that committed. But a `GK` sell is passive: it never receives an airline
> record locator, so the reissued ticket could not be issued (step 5). On
> 2026-06-12 `NN` committed and ticketed cleanly with no request change, so the
> default was reverted to `NN`. The flip is server-side (PCC provisioning /
> carrier-link behavior on `H50H`), not a library fix — see the status note at
> the top.

```
sabre-rest exchange-booking --body '{
  "pnrLocator": "PNR123",
  "originalTicketNumber": "0012972101507",
  "receivedFrom": "SP TEST",
  "cancelSegments": [1],
  "newSegments": [{ "origin": "DFW", "destination": "LAX",
    "departureDateTime": "2026-06-30T07:30:00",
    "arrivalDateTime": "2026-06-30T08:49:00",
    "marketingCarrier": "AA", "flightNumber": "1154", "bookingClass": "S" }],
  "priceTolerance": { "amountSpecified": 0,
    "acceptableIncrease": { "amount": 500, "haltOnNonAcceptablePrice": true } }
}'
```

A successful quote returns `applicationResults.status: "Complete"` and an
`exchangeConfirmations[]` entry with the PQR number and the priced delta, e.g.
`{ "pqrNumber": "02", "amountReturned": "-52.00" }` — matching the Flight
Reshop offer's `totalPriceDifference.grandTotal`.

### 5. Fulfill Flight Tickets — `fulfill-tickets`

Issues the new electronic ticket once the reissue is committed. Billable; the
PCC requires a designated printer (`ticket.countryCode "AT"` on `H50H`). See
[`booking-ticket-lifecycle.sh`](../../scripts/booking-ticket-lifecycle.sh) for a
working fulfill body.

On 2026-06-12 this issued the reissued document end-to-end on the `NN` sell
path (both a `$0` and a `$50.01` exchange). The fulfill request is an ordinary
ticketing call — the same shape used to issue the original ticket; nothing
PQR-specific is required. Note `priceQuoteRecordIds` is **not** the lever here:
it addresses `PQ` records, not the exchange `PQR`, and passing the PQR number
fails `PRICE_QUOTE_RECORD_NUMBER_INVALID` (a GK-era finding, not re-tested on
the NN path).

## What we verified in CERT

- **Entitlement: green.** `flightReshop` returns HTTP 200 on `H50H` — the
  request authenticates, authorizes, and reaches the downline shopping service.
  This is **not** the SEAS `ERR.2SG.SEC.NOT_AUTHORIZED` wall.
- **Fare rules: green.** `checkFlightTickets` on freshly issued AA tickets
  reports `isChangeable: true` with a CAT-31 provision (`source: "Category 31"`,
  `$0` change penalty on AA Main Cabin domestic). No CAT-16 fallback.
- **Automated reissue: active (2026-06-09).** After Sabre activated automated
  reissue on `H50H`, `flightReshop` returns priceable offers (45–50 per request
  on AA DFW→LAX). Before activation it returned "Automated reissue not active
  for this ticket" — identical across 6 AA routes and 2 fare classes, which is
  how we confirmed the gap was PCC-level rather than route/fare specific.
- **Shop → price agreement (2026-06-09).** Changing a fresh AA ticket from
  AA1504 to AA1154 (DFW→LAX): Flight Reshop offered `Refund -52.00 USD`, and
  Exchange Booking (quote) returned `status: Complete` with PQR #02
  `amountReturned: -52.00`, no change fee. The two agree.
- **Full lifecycle incl. fulfill: verified (2026-06-12).**
  `scripts/flight-exchange-e2e.sh` ran the whole flow on the `NN` sell path —
  issue an AA ticket → reshop → commit with `confirm` + card FOP → **fulfill the
  reissued ticket** → void + cancel. Two runs the same day: AA DFW→LAX (`$0`
  even) and AA ORD→MIA (**$50.01 add-collect**). Both returned commit
  `status: Complete` with PQR #02, `amountReturned` matching the reshop
  `grandTotal` to the penny, swapped the segment on the PNR, and issued a
  distinct reissued ticket. The `NEED AIRLINE PNR LOCATOR` wall did not appear.
- **Sell-status history (the default flipped on a server-side change).** On
  **2026-06-10**, `NN` aborted air-book server-side ("Unable to perform air
  booking step") *even with `haltOnStatus` overridden to `[]`*, `SS` was
  rejected (`EnhancedAirBookRQ: FORMAT`), and only `GK` committed — but a `GK`
  segment never gets an airline locator, so fulfill then failed
  `AirTicketLLSRQ: NEED AIRLINE PNR LOCATOR`. On **2026-06-12** `NN` committed
  *and* fulfilled with no change to our request (the fulfill body was
  byte-identical; `NN` was even left in `HaltOnStatus` and still did not halt).
  Nothing in the library explains the reversal — the variable is **server-side
  on `H50H`** (reissue provisioning settling after the 2026-06-09 activation, or
  a CERT carrier-link change). The library default was reverted `GK` → `NN`
  accordingly; `GK` remains a per-segment override.

## Environment and headers

- CERT base URL: `https://api.cert.platform.sabre.com`
- Production base URL: `https://api.platform.sabre.com`
- Auth: `Authorization: Bearer <token>` — OAuth v2 client credentials
  (`/v2/auth/token`), handled by the baked-in middleware.

## Related

- [`flight-reshop.yml`](../specifications/flight-reshop.yml) — Flight Reshop spec
- [`exchange-booking.yml`](../specifications/exchange-booking.yml) — Exchange Booking spec
- [`booking-management-operations.md`](../specifications/booking-management-operations.md) — getBooking / checkFlightTickets / fulfillFlightTickets / void / refund
- `scripts/flight-exchange-e2e.sh` — full lifecycle smoke test (mint ticket →
  reshop → commit exchange → attempt fulfill → cleanup)
- `scripts/flight-reshop-flow.sh`, `scripts/exchange-booking-flow.sh`,
  `scripts/booking-ticket-lifecycle.sh` — runnable smoke tests for individual
  steps
