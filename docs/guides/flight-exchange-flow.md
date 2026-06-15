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
`departureTimeWindow` / `arrivalTimeWindow`, and per-journey `retainFlights`
(below). See [`flight-reshop.yml`](../specifications/flight-reshop.yml) for the
full surface; v1 of this library exposes the focused slice above (see the
`types.ts` header for what is deferred).

`scripts/flight-reshop-flow.sh` drives this step end-to-end and prints the
offers (or the downline error) — see that script for a ready-to-run example.

#### Selective change — `retainFlights`

To change only part of a trip, pin the parts to keep with `retainFlights`.
Important: **`retainFlights` retains a whole journey (a leg / direction), not a
single segment of a connection.** The canonical case is a round trip — retain
the outbound journey, reshop the return.

**This adds a mandatory `getBooking` call before the reshop.** Unlike a plain
reshop (which needs only a ticket number), a retained reshop must describe the
flight(s) to keep, and that description comes from the booking. So selective
change is a two-call sequence:

```
getBooking ──► retain inputs (itemId / flight details + creation*) ──► flightReshop (retainFlights)
```

**Step A — `getBooking`** (Booking Management) to harvest the retain inputs:

```
sabre-rest get-booking --confirmation-id ONOXSB
```

From the response you need, for the flight you intend to keep, **either** its
`flights[].itemId` **or** the full identity. Both retain forms also require
`bookingId` on the reshop request.

| Reshop `retainFlights` field | Source in `getBooking` |
| --- | --- |
| `flightItemId` | `flights[].itemId` |
| `flightDetails.marketingAirlineCode` / `marketingFlightNumber` | `flights[].airlineCode` / `flightNumber` |
| `flightDetails.operatingAirlineCode` | `flights[].operatingAirlineCode` |
| `flightDetails.departureAirportCode` / `arrivalAirportCode` | `flights[].fromAirportCode` / `toAirportCode` |
| `flightDetails.departureDate` / `departureTime` | `flights[].departureDate` / `departureTime` (`HH:MM`) |
| `flightDetails.arrivalDate` / `arrivalTime` | `flights[].arrivalDate` / `arrivalTime` (`HH:MM`) |
| `flightDetails.bookingClassCode` | `flights[].bookingClass` |
| `flightDetails.flightStatusCode` | `flights[].flightStatusCode` |
| `flightDetails.creationDate` / `creationTime` | **booking-level** `creationDetails.creationDate` / `creationTime` |

> ⚠️ Two non-obvious points, both verified in CERT (2026-06-12):
> 1. The `flightDetails` path requires `operatingAirlineCode`,
>    `flightStatusCode`, `creationDate`, and `creationTime` even though the OAS
>    marks them *optional* — omitting any yields `MANDATORY_DATA_MISSING`.
> 2. There is **no per-flight creation field** in `getBooking`; the
>    **booking-level** `creationDetails.creationDate` / `creationTime` are
>    accepted for the per-flight `flightDetails.creation*`.

**Step B — `flightReshop`** with the retained journey (here, by `flightItemId`):

```
sabre-rest flight-reshop --body '{
  "journeys": [
    { "departureLocation": { "cityCode": "DFW" },
      "arrivalLocation":   { "cityCode": "LAX" },
      "departureDate": "2026-07-15",
      "retainFlights": [ { "flightItemId": "14" } ] },
    { "departureLocation": { "cityCode": "LAX" },
      "arrivalLocation":   { "cityCode": "DFW" },
      "departureDate": "2026-07-23" }
  ],
  "tickets": [{ "number": "0017360597321" }],
  "bookingId": "ONOXSB"
}'
```

`flightItemId` is preferred — a single value, no creation-field handling.

Verified in CERT 2026-06-12 (`scripts/flight-exchange-retain-e2e.sh`,
`--retain-by`): a DFW⇄LAX round trip retaining the outbound returned offers
that **all preserved the pinned flight** — 50/50 by `flightItemId`, 45/45 by
`flightDetails`.

#### Step C — commit the change

`retainFlights` shapes the **shop** only. It does **not** carry into the
commit — Exchange Booking (step 4) is driven entirely by its own
`cancelSegments` / `newSegments`. Two rules govern a correct commit:

1. **Rebuild the whole itinerary, in chronological order.** Set
   `cancelSegments` to **all** current reservation segments and `newSegments`
   to the **entire** offer itinerary — every flight, retained *and* changed —
   sorted by departure date/time. This matches Sabre's canonical
   `ExchangeBookingRQ` example (it cancels `[1,2,3,4]` and re-sells the full
   trip). Re-sell the retained flights too; `isBookingRequired: false` means
   "unchanged", not "omit from the commit".
2. **Send `bargainFinder` (Rebook).** Without it the host rejects the offer's
   booking class with `AutomatedExchangesLLSRQ: LOWER FARE APPLIES - REBOOK
   <class>` and no PQR is created — the class a reshop offer carries is **not**
   always the repriceable class. `bargainFinder` lets the host rebook into the
   correct fare itself.

> ⚠️ **Why "rebuild the whole itinerary" and not "swap only the changed leg".**
> The lean approach — cancel only the changed segment and sell only the new
> flight — *appends* the new segment rather than inserting it at the cancelled
> slot. When the **outbound** is the changed leg, this leaves the reservation
> out of chronological order (return dated before outbound), and ticketing then
> fails with `AirTicketLLSRQ: FLT CHK DATE/TIME CONTINUITY OF FLTS` — the commit
> succeeds but no ticket can be issued. Cancelling all + re-selling in date
> order avoids this. (The lean approach only works if the PCC has the
> **Automatic Segment Arrange** TJR flag enabled, which auto-sorts segments
> after the sell; without that entitlement, use the full rebuild.)

```
sabre-rest exchange-booking --body '{
  "pnrLocator": "ONOXSB",
  "originalTicketNumber": "0017360597321",
  "receivedFrom": "AGENT",
  "cancelSegments": [1, 2],         // ALL current segments
  "newSegments": [                   // the WHOLE itinerary, in departure order
    { "origin": "DFW", "destination": "ONT",
      "departureDateTime": "2026-07-16T12:20:00", "arrivalDateTime": "2026-07-16T13:22:00",
      "marketingCarrier": "AA", "flightNumber": "2239", "bookingClass": "Q", "status": "NN" },
    { "origin": "LAX", "destination": "DFW",   // retained flight, re-sold
      "departureDateTime": "2026-07-22T18:45:00", "arrivalDateTime": "2026-07-22T23:53:00",
      "marketingCarrier": "AA", "flightNumber": "1669", "bookingClass": "N", "status": "NN" }
  ],
  "bargainFinder": true,
  "priceTolerance": { "amountSpecified": 0,
    "acceptableIncrease": { "amount": 1000, "haltOnNonAcceptablePrice": true } },
  "confirm": { "formOfPayment": { "type": "card", "vendorCode": "VI",
    "number": "...", "expireDate": "2027-12" } }
}'
```

The reservation segment numbers for `cancelSegments` and the full flight detail
for re-selling each segment both come from `getBooking` — segment numbers are
the 1-based position among `flights[]`; re-sell every flight in the offer,
ordered by `departureDateTime`.

Verified in CERT 2026-06-15 (`scripts/flight-exchange-onejourney-commit-e2e.sh`,
`--commit-strategy`): a DFW⇄LAX round trip changing **only the outbound** —
the full rebuild commits and **tickets cleanly**, while the lean
("cancel only the changed segment") path commits but fails ticketing with
`CHK DATE/TIME CONTINUITY`.

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
- `scripts/flight-exchange-retain-e2e.sh` — selective-change smoke test (book a
  round trip → reshop retaining the outbound journey via `flightItemId` →
  assert every offer keeps the pinned flight → cleanup)
- `scripts/flight-exchange-onejourney-commit-e2e.sh` — selective-change **commit**
  smoke test: book a round trip, change one journey (`--change
  outbound|return|both`) and commit it (`--commit-strategy full|minimal`),
  assert the kept journey survives, then fulfill + cleanup. Demonstrates that
  the full rebuild tickets cleanly while the lean path hits
  `CHK DATE/TIME CONTINUITY`
- `scripts/flight-reshop-flow.sh`, `scripts/exchange-booking-flow.sh`,
  `scripts/booking-ticket-lifecycle.sh` — runnable smoke tests for individual
  steps
