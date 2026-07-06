# Exchange reissue fails with AirTicketRQ error 114

**Error:** `AirTicketLLSRQ: UNABLE TO PROCESS - CORRECT/RETRY - 114, FLIGHT NUMBER DOES NOT MATCH ITINERARY IN AIRLINE SYSTEM` (surfaced as `DOWNLINE_SERVICE_ERROR` from `fulfillFlightTickets` after a `Complete` exchange commit).

Reproduced in CERT 2026-06-29. Two **distinct** causes were found behind the same error message.

## Cause 1 — exchange offer on a different airport than the ticket (FIXED)

A reissue is bound to the originally ticketed board/off points. Flight Reshop queried with a **city code** (`{cityCode: "LAX"}`) returns multi-airport-city siblings — e.g. **ONT** (Ontario) for **LAX**. The one-way exchange selected an `ONT→DFW` offer, committed it `Complete`, then failed to reissue: the committed segment's origin (ONT) doesn't match the ticketed itinerary (LAX) → 114.

**Note on "we already use airport code":** the library's `FlightReshopLocation` exposes both `cityCode` and `airportCode`, and the spec's `GenericLocation` documents the difference (city code = all airports in the MAC; airport code = that airport only). The reshop *request* may say airport code somewhere, but the failure is downstream in **offer selection**: nothing constrained the chosen offer's origin/destination to the ticketed airports, so an off-airport offer was selectable regardless. Verify both: (a) reshop is sent with `airportCode`, and (b) offer selection rejects any flight whose city-pair ≠ the ticketed one.

**Fix (verified):** in `scripts/flight-exchange-e2e.sh`, query reshop by `airportCode` **and** reject any candidate whose origin/destination ≠ the ticketed airports. One-way LAX→DFW then selected a true LAX flight (AA1445) and reissued cleanly (ticket `…429`, exit 0). Same belt-and-suspenders guard added to the one-journey scripts.

## Cause 2 — round-trip one-journey change (FIXED — Automatic Segment Arrange TJR entitlement)

With Cause 1 fixed, a **round-trip** one-journey change (`flight-exchange-onejourney-*`, `--commit-strategy full`) selected a correct LAX itinerary (AA3334 DFW→LAX) but **still** failed with 114. The `full` strategy cancels **all** segments and re-sells the whole itinerary — including cancel+rebooking the *retained* AA1669. The commit returned two warnings the one-way case never showed:

- `Automatic Segment Arrange TJR flag is not enabled. The flight segments may be out of order.`
- `Cancelling segments and rebooking identical ones may cause issues with Air Booking.`

The new segment confirmed (HK) and the confirm-before-ticket gate passed at 0s, so this was **not** a timing/confirmation race — it was segment churn / ordering on the retained leg, gated by the TJR flag named in the first warning.

**Fix (verified 2026-07-06):** the PCC now has the **Automatic Segment Arrange TJR** entitlement enabled. Re-ran `flight-exchange-onejourney-commit-e2e.sh --change return --commit-strategy full` (DFW⇄LAX round trip): commit reached `status: Complete` with **only** the "cancelling/rebooking identical segments" business warning — the TJR provider warning no longer appears — and `fulfillFlightTickets` issued the reissued ticket cleanly (`0017360597458`). Also re-verified the related `--commit-strategy minimal --change outbound` case (previously the one that risked `CHK DATE/TIME CONTINUITY` without this flag): commit `Complete` with **no warnings at all**, reissue ticket `0017360597456` issued.

## Cause 3 — carrier-settlement race on an unconfirmed (NN) segment (MITIGATED)

Distinct from Cause 1 and Cause 2 — those are data/ordering bugs; this is pure
timing. Even with a correctly-selected offer and a `full`-strategy commit that
reaches `status: Complete`, a newly-sold segment can still be `NN` ("need") at
that moment: the commit response and the carrier's confirmation to `HK`/`KK`
are asynchronous. If `fulfillFlightTickets` fires before the carrier link
settles the segment, ticketing sees a segment the airline system doesn't yet
recognize as matching and rejects it with the same 114. Any *fixed* delay
between commit and fulfill (e.g. a flat sleep) is a race, not a guarantee —
sometimes it settles in time, sometimes it doesn't.

**Mitigation (implemented):** `scripts/flight-exchange-onejourney-confirm-e2e.sh`
adds an explicit confirm-before-ticket gate — it polls `getBooking` after the
commit and waits until every newly-sold (`isBookingRequired`) segment reports
`flightStatusCode` `HK` or `KK` before attempting fulfill, refusing to ticket
(`--confirm-timeout`, `--confirm-interval`) if a segment never confirms in
time. This is a client-side workaround, not a server-side fix — there is no
documented way to make the commit itself wait for carrier confirmation.

## Evidence

- ONT failure: `.local/exchange-e2e-20260629T231531-…` (one-way, selected ONT→DFW)
- LAX success: `.local/exchange-e2e-20260629T232742-…` (one-way, airport-code fix, ticket issued)
- Round-trip failing (pre-TJR): `.local/exchange-onejourney-e2e-20260629T233233-…` (correct LAX itinerary, 114 persists, TJR warning present)
- Round-trip fixed (post-TJR), full strategy: `.local/exchange-onejourney-e2e-20260706T190300-647645` (Complete, no TJR warning, ticket `0017360597458`)
- Minimal-commit outbound change (post-TJR): `.local/exchange-onejourney-e2e-20260706T190130-646623` (Complete, no warnings, ticket `0017360597456`)

## App relevance

If the app's reshop/exchange flow can select an offer on a different airport than the ticketed one (MAC expansion not constrained at *selection* time), it will hit Cause 1 in production. Cause 2 is now resolved on PCCs with the Automatic Segment Arrange TJR entitlement enabled — round-trip single-journey changes using `--commit-strategy full` no longer hit 114, and the leaner `minimal` strategy (cancel only the changed segment) is now viable too, avoiding the unnecessary cancel+rebook of the retained leg. Cause 3 (the carrier-settlement race) is not tied to any entitlement and can recur on any commit — any caller that fulfills immediately after a `Complete` commit (or after a fixed sleep) is exposed; the app's fulfill step should poll for `HK`/`KK` on the new segment(s) rather than ticketing on a timer.
