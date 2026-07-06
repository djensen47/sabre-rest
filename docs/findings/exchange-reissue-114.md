# Exchange reissue fails with AirTicketRQ error 114

**Error:** `AirTicketLLSRQ: UNABLE TO PROCESS - CORRECT/RETRY - 114, FLIGHT NUMBER DOES NOT MATCH ITINERARY IN AIRLINE SYSTEM` (surfaced as `DOWNLINE_SERVICE_ERROR` from `fulfillFlightTickets` after a `Complete` exchange commit).

Reproduced in CERT 2026-06-29. Two **distinct** causes were found behind the same error message.

## Cause 1 — exchange offer on a different airport than the ticket (FIXED)

A reissue is bound to the originally ticketed board/off points. Flight Reshop queried with a **city code** (`{cityCode: "LAX"}`) returns multi-airport-city siblings — e.g. **ONT** (Ontario) for **LAX**. The one-way exchange selected an `ONT→DFW` offer, committed it `Complete`, then failed to reissue: the committed segment's origin (ONT) doesn't match the ticketed itinerary (LAX) → 114.

**Note on "we already use airport code":** the library's `FlightReshopLocation` exposes both `cityCode` and `airportCode`, and the spec's `GenericLocation` documents the difference (city code = all airports in the MAC; airport code = that airport only). The reshop *request* may say airport code somewhere, but the failure is downstream in **offer selection**: nothing constrained the chosen offer's origin/destination to the ticketed airports, so an off-airport offer was selectable regardless. Verify both: (a) reshop is sent with `airportCode`, and (b) offer selection rejects any flight whose city-pair ≠ the ticketed one.

**Fix (verified):** in `scripts/flight-exchange-e2e.sh`, query reshop by `airportCode` **and** reject any candidate whose origin/destination ≠ the ticketed airports. One-way LAX→DFW then selected a true LAX flight (AA1445) and reissued cleanly (ticket `…429`, exit 0). Same belt-and-suspenders guard added to the one-journey scripts.

## Cause 2 — round-trip one-journey change still fails (OPEN)

With Cause 1 fixed, a **round-trip** one-journey change (`flight-exchange-onejourney-*`, `--commit-strategy full`) selects a correct LAX itinerary (AA3334 DFW→LAX) but **still** fails with 114. The `full` strategy cancels **all** segments and re-sells the whole itinerary — including cancel+rebooking the *retained* AA1669. The commit returns two warnings the one-way case never shows:

- `Automatic Segment Arrange TJR flag is not enabled. The flight segments may be out of order.`
- `Cancelling segments and rebooking identical ones may cause issues with Air Booking.`

The new segment confirms (HK) and the confirm-before-ticket gate passes at 0s, so this is **not** a timing/confirmation race. It points at segment churn / ordering on the retained leg. Candidate remedies (untested here): enable the **Automatic Segment Arrange TJR** flag on the PCC, and/or use `--commit-strategy minimal` so the retained segment is not cancel+rebooked. Not yet proven — next step is one run with the TJR flag enabled or a `minimal` comparison.

## Evidence

- ONT failure: `.local/exchange-e2e-20260629T231531-…` (one-way, selected ONT→DFW)
- LAX success: `.local/exchange-e2e-20260629T232742-…` (one-way, airport-code fix, ticket issued)
- Round-trip still-failing: `.local/exchange-onejourney-e2e-20260629T233233-…` (correct LAX itinerary, 114 persists)

## App relevance

If the app's reshop/exchange flow can select an offer on a different airport than the ticketed one (MAC expansion not constrained at *selection* time), it will hit Cause 1 in production. Cause 2 affects round-trip single-journey changes regardless of airport and likely depends on PCC TJR configuration.
