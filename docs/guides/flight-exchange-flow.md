# Flight Exchange / Reissue Flow (Sabre)

This guide documents the post-booking flight-change (exchange / reissue) flow:
which REST endpoints exist, which are on the canonical path, how they chain, and
how the steps were verified in CERT.

Source: Sabre "Normalized API Post Booking Process" (PTC guidance, 2026) and the
legacy "End-to-End Exchanges Workflow (Shop, Book, Price, Ticket)" developer
guide. Sabre's PTC recommended the REST/Agentic path below over the legacy
SOAP `ExchangeShoppingRQ` + `AutomatedExchangesLLSRQ` composition.

> **Status (2026-06-09): verified end-to-end in CERT on PCC `H50H`.** Sabre
> activated automated reissue on the PCC; the shop → price flow now works:
> `flightReshop` returns priceable offers (45–50 per request on AA DFW→LAX), and
> Exchange Booking quotes a matching Price Quote Reissue. Worked example: a
> fresh AA ticket changed from AA1504 to AA1154 (DFW→LAX) reshopped at a
> **−$52.00 refund**, and Exchange Booking returned `status: Complete` with
> PQR #02, `amountReturned: -52.00`, no change fee — the reshop quote and the
> PQR agree to the penny.
>
> Two things verified along the way are baked into the library: (a) the reshop
> `errors` array must be checked even on HTTP 200, and (b) Exchange Booking
> sells new segments with a **passive/guaranteed status (`GK`)** by default —
> not `NN`, which would leave the segment pending and trip the host's
> HaltOnStatus, aborting the air-book step. See step 4.

## Orchestrated path

| Step | Action | REST API | CLI command | Status |
| --- | --- | --- | --- | --- |
| 1 | Retrieve | Booking Management v1 `getBooking` | `get-booking` | Optional |
| 2 | Ticket eligibility | Booking Management v1 `checkFlightTickets` | `check-tickets` | Recommended |
| 3 | Shop / price the change | **Flight Reshop** `flightReshop` | `flight-reshop` | **Mandatory** ✓ † |
| 4 | Commit the reissue | Exchange Booking v1.1.0 `exchangeBooking` | `exchange-booking` | **Mandatory** ✓ (quote + commit) |
| 5 | Issue the new ticket | Booking Management v1 `fulfillFlightTickets` | `fulfill-tickets` | **Mandatory** ‡ (blocked in CERT) |
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

> **New segments sell as `GK` by default.** The library sells each new segment
> with a passive/guaranteed status (`GK`), which holds it immediately so the
> reissue prices in the same call. Do not override `status` to `NN`: a pending
> `NN` segment trips the host's HaltOnStatus and aborts with "Unable to perform
> air booking step" (`EnhancedAirBookRQ: Flight … returned status code NN`).
> Verified 2026-06-09.

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

Issues the new electronic ticket once the reissue is validated. Billable; the
PCC requires a designated printer (`ticket.countryCode "AT"` on `H50H`). See
[`booking-ticket-lifecycle.sh`](../../scripts/booking-ticket-lifecycle.sh) for a
working fulfill body.

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
- **Air-book status (handled by default).** New segments sell as `GK`; a
  pending `NN` would collide with the HaltOnStatus list and abort the air-book
  step. The library defaults to `GK` so callers don't hit this. See step 4.
- **Commit: verified (2026-06-10).** `scripts/flight-exchange-e2e.sh` runs the
  whole lifecycle: issue an AA ticket, reshop it, commit the exchange with
  `confirm` + card FOP. The commit returns `status: Complete`, stores the PQR,
  swaps the segments (old flight cancelled, new flight on the PNR as `GK`),
  and `amountReturned` matches the reshop offer's `grandTotal`. Three sell
  statuses were probed: `NN` aborts the air-book server-side ("Unable to
  perform air booking step") even with `haltOnStatus` overridden to `[]` —
  the pending-NN halt is not configurable from the request; `SS` is rejected
  (`EnhancedAirBookRQ: FORMAT`); `GK` is the only status that commits.
- **Fulfill after commit: blocked by CERT, not by the library.** Issuing the
  reissued document fails `AirTicketLLSRQ: NEED AIRLINE PNR LOCATOR` because
  the `GK` segment never receives an airline record locator — CERT's simulated
  carrier link doesn't confirm passive sells. Targeting the PQR via
  `priceQuoteRecordIds` (with the `PQR_Number` "02" or the Get Booking
  `recordId` "2") fails earlier with `PRICE_QUOTE_RECORD_NUMBER_INVALID`; that
  qualifier addresses `PQ` records only. In production, the carrier link
  confirms segments and assigns locators, which is exactly the piece CERT
  omits — so the exchange **commit** is the deepest CERT-verifiable point.

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
