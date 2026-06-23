# Revalidate Itinerary (Flight Check) — Response Field Reference

Every field in the **public output** of `revalidateItineraryV5.revalidate`
(`RevalidateItineraryOutput`), with a plain-English description of what it
means. This documents the consumer-facing shape the library produces — not
the raw Sabre `GroupedItineraryResponse` wire format. The hand-written type
definitions live in
[`src/services/revalidate-itinerary-v5/types.ts`](../../src/services/revalidate-itinerary-v5/types.ts).

Revalidate Itinerary ("Flight Check") rechecks availability and pricing for
an exact itinerary without booking it. It shares Sabre's GIR (Grouped
Itinerary Response) wire format with Bargain Finder Max, so most output types
are structurally the same; see
[`bargain-finder-max-response-fields.md`](./bargain-finder-max-response-fields.md)
for the BFM counterpart. NDC content is not supported by Revalidate
Itinerary.

Every response-side field is **optional**, including fields Sabre's spec
marks as required. The library never drops a record based on which fields are
populated — every itinerary, leg, segment, and endpoint Sabre returned is
preserved. Treat any field as possibly `undefined`, and any array as possibly
empty. Whether an under-populated record is "good enough" to sell is the
consumer's decision.

## `RevalidateItineraryOutput`

| Field | Meaning |
| --- | --- |
| `itineraries` | Priced itineraries Sabre returned, in wire order. Empty when the itinerary is no longer valid. |
| `messages` | Server messages (informational, warning, error). Frequently present even on a successful revalidation — context, not necessarily failure. |

## `PricedItinerary`

| Field | Meaning |
| --- | --- |
| `id` | Sabre's sequence id for the itinerary within the response. |
| `legs` | Itinerary legs in trip order, one per requested origin/destination. |
| `totalFare` | Total fare across all passengers. Mirrors `fareOffers[0]` for the common single-offer case. |
| `validatingCarrierCode` | Validating carrier IATA code on the priced fare. Mirrors `fareOffers[0]`. |
| `distributionModel` | Content model: `ATPCO` (published fares), `NDC`, or `API` (carrier-hosted). NDC is not returned by Revalidate. Mirrors `fareOffers[0]`. |
| `fareOffers` | All fare offers for this itinerary, in wire order. Usually one for a revalidation. |

## `FareOffer`

One entry per `pricingInformation` entry on the wire.

| Field | Meaning |
| --- | --- |
| `passengerFares` | Per-passenger fare detail, one per priced passenger. |
| `totalFare` | Aggregate total fare across all passengers for this offer. |
| `validatingCarrierCode` | Validating carrier for this offer. |
| `distributionModel` | Content model for this offer (`ATPCO` / `API`). |

## `PassengerFare`

Per-passenger fare detail within a `FareOffer`.

| Field | Meaning |
| --- | --- |
| `passengerType` | Sabre passenger type code (`ADT`, `CHD`, `INF`, …). |
| `passengerNumber` | Sabre's passenger number within the offer. |
| `passengerCount` | Number of passengers of this type covered by this fare entry. |
| `total` | Flat per-passenger total fare (distinct shape from `FareOffer.totalFare`). |
| `lastTicketDate` | Last date to ticket (`YYYY-MM-DD`). |
| `lastTicketTime` | Last time to ticket (`HH:MM`). |
| `nonRefundable` | `true` when Sabre marked the fare non-refundable. |
| `fareComponents` | Fare components in pricing order, each covering a contiguous chunk of the journey. |
| `baggageAllowances` | Baggage allowances attached to this passenger, in wire order. |
| `baggageCharges` | Baggage charges attached to this passenger, in wire order. |
| `taxes` | Individual tax line items for this passenger, in wire order. |
| `penalties` | Change/refund penalties filed for this passenger's fare, in wire order. Absent when none — but see `cat16Info`. |
| `reissue` | Reissue (change) pricing detail: change fees, eTicket requirements, form of refund. Absent when Sabre returned none. |
| `reissueText` | Free-text reissue note Sabre returned alongside `reissue`. |
| `seatSelection` | Seat-selection amenity entries: whether seat selection is free, chargeable, or not offered per segment set. Absent when none. |
| `priorityBoarding` | Priority-boarding amenity entries, same shape as `seatSelection`. Absent when none. |
| `legs` | Per-leg fare breakdown in trip order, attributing the total fare leg by leg. Absent when none. |

## `ChangeRefundPenalty`

A change or refund penalty filed for a passenger's fare.

| Field | Meaning |
| --- | --- |
| `type` | Penalty kind as Sabre labelled it (e.g. `Change`, `Refund`). |
| `applicability` | `Before` or `After` departure. |
| `changeable` | `true` when the fare is changeable. |
| `refundable` | `true` when the fare is refundable. |
| `conditionsApply` | `true` when changeability/refundability holds in general but restrictions apply — consult the fare rules. |
| `amount` | Maximum penalty amount (assumes all flights changed, ticket-level for ATPCO). |
| `currency` | ISO 4217 currency for `amount`. |
| `minPenaltyAmount` | Minimum penalty amount, when Sabre filed one. |
| `minPenaltyCurrency` | ISO 4217 currency for `minPenaltyAmount`. |
| `cat16Info` | `true` when the penalty came from Sabre Category 16. For ATPCO fares, penalties live in categories 31/33 and a missing penalty defaults to "no penalty" — do not treat an empty `penalties` list as authoritative without checking the fare rules. |
| `description` | Airline-supplied penalty description. |

## `PassengerReissue`

Reissue (change) pricing detail for a passenger's fare.

| Field | Meaning |
| --- | --- |
| `changeFees` | Change fees that apply on reissue, in wire order. Empty when Sabre filed none. |
| `electronicTicketRequired` | `true` when reissue requires an electronic ticket. |
| `electronicTicketNotAllowed` | `true` when reissue does not allow an electronic ticket. |
| `formOfRefund` | Form-of-refund code (e.g. `A`). |
| `residual` | Residual-value indicator code. |

## `ChangeFee`

A single change fee within a `PassengerReissue`.

| Field | Meaning |
| --- | --- |
| `amount` | Change fee amount. |
| `currency` | ISO 4217 currency for `amount`. |
| `highest` | `true` when this is the highest change fee across the itinerary. |
| `notApplicable` | `true` when the change fee is not applicable. |
| `waived` | `true` when the change fee has been waived. |

## `Amenity`

A seat-selection or priority-boarding amenity entry (referenced by
`PassengerFare.seatSelection` and `PassengerFare.priorityBoarding`).

| Field | Meaning |
| --- | --- |
| `charge` | Whether the amenity is `Free`, `Chargeable`, or `NotOffered` (mapped from Sabre's `F`/`C`/`N`). Absent for an unrecognized code. |
| `code` | Raw single-letter amenity code as Sabre returned it (`F`, `C`, `N`). |
| `segmentIndices` | 0-based itinerary-wide segment indices this amenity entry covers, in wire order. |

## `PassengerLegFare`

Per-leg fare for a passenger.

| Field | Meaning |
| --- | --- |
| `ref` | Sabre `LegDesc` reference id; matches the priced leg's `ItineraryLeg.ref`. |
| `status` | Reason a fare could not be returned for the leg: `A` class not available, `O` class not offered, `F` no fare found/applicable. |
| `totalFare` | Total fare for this leg. |
| `taxes` | Tax line items attached to this leg, in wire order. Empty when none. |
| `taxSummaries` | Tax summaries attached to this leg, in wire order. Empty when none. |

## `TaxSummary`

A summarized tax line used in per-leg pricing (`PassengerLegFare.taxSummaries`).
Sourced from Sabre's tax-summary descriptor list rather than the per-passenger
tax list, but carries the same fields as `Tax`.

| Field | Meaning |
| --- | --- |
| `code` | Tax code (e.g. `US`, `XF`). |
| `amount` | Tax amount. |
| `currency` | ISO 4217 currency code. |
| `country` | Two-letter country code where the tax originates. |
| `description` | Descriptive text for the tax. |
| `station` | Station/airport code where the tax applies. |
| `publishedAmount` | Published tax amount before currency conversion. |
| `publishedCurrency` | Published tax currency, when different from `currency`. |

## `PassengerTotal`

Flat per-passenger total fare (referenced by `PassengerFare.total`).

| Field | Meaning |
| --- | --- |
| `totalAmount` | Total fare for this passenger. |
| `currency` | ISO 4217 currency code. |
| `baseFareAmount` | Base fare before taxes. |
| `baseFareCurrency` | Currency for `baseFareAmount`, when different from `currency`. |
| `totalTaxAmount` | Total taxes. |

## `FareComponent`

A contiguous chunk of journey (typically one origin/destination) with its own
fare basis.

| Field | Meaning |
| --- | --- |
| `fareBasisCode` | Fare basis code (e.g. `TKEE4M`). |
| `cabinCode` | Cabin as filed on the fare (e.g. `Y`, `C`, `F`); component-level default. |
| `governingCarrier` | Governing carrier IATA code. |
| `farePassengerType` | Passenger type the fare was filed for; may differ from the enclosing passenger type. |
| `beginAirport` | IATA code of the first airport in the component. |
| `endAirport` | IATA code of the last airport in the component. |
| `brand` | Marketing brand attached to the fare (e.g. "Main Cabin"). Absent for unbranded fares. |
| `negotiatedFare` | `true` when this is a negotiated (privately filed) fare. |
| `privateFare` | `true` when this is a private fare. |
| `matchedAccountCode` | Account code that matched the fare, when selected by a corporate/negotiated account code on the request. |
| `corporateIdMatched` | `true` when the corporate ID on the request matched this fare. |
| `notValidBefore` | Date before which the fare is not valid (`YYYY-MM-DD`). |
| `notValidAfter` | Date after which the fare is not valid (`YYYY-MM-DD`). |
| `eligibleForTicketing` | `true` when the fare is eligible for ticketing given the agent's credentials. |
| `segments` | Per-segment detail in wire order. ARUNK (surface) entries are skipped. |

## `FareBrand`

Marketing brand attached to a `FareComponent`.

| Field | Meaning |
| --- | --- |
| `code` | Short brand code, usually two characters (e.g. `XX`). |
| `name` | Marketing brand name (e.g. `Main Cabin`). |
| `programCode` | Brand program code from the branding service (e.g. `DOMBE`). |
| `programDescription` | Plain-English description of the brand program. |

## `FareComponentSegment`

| Field | Meaning |
| --- | --- |
| `bookingCode` | Booking class (RBD) for this segment on this fare (the per-fare RBD). |
| `cabinCode` | Cabin code for this segment (e.g. `Y`, `B`). |
| `mealCode` | Meal code. |
| `seatsAvailable` | Seats Sabre reports available to sell in this segment's booking class. `0` means the class is closed. Revalidation-time count, not a booking guarantee. |
| `availabilityBreak` | `true` when the priced availability changes at this segment. |
| `dualInventoryCode` | An additional booking class that must also be available for the segment. |

## `BaggageAllowance`

| Field | Meaning |
| --- | --- |
| `segmentIndices` | 0-based itinerary-wide segment indices this allowance covers (flat, not per-leg). |
| `airlineCode` | Airline that owns the baggage (IATA code). |
| `provisionType` | Provision type code. `A` = check-in allowance (the included-in-fare allowance). |
| `pieceCount` | Total pieces allowed. |
| `weight` | Total allowed weight. |
| `weightUnit` | Weight unit (`lbs` or `kg`). |
| `descriptions` | Free-text description lines as Sabre returned them, in order. |

## `BaggageCharge`

| Field | Meaning |
| --- | --- |
| `segmentIndices` | 0-based itinerary-wide segment indices this charge covers. |
| `airlineCode` | Airline that owns the baggage (IATA code). |
| `provisionType` | Provision type code (e.g. `C` = day-of-checkin charges). |
| `firstPiece` | First piece number the charge applies to. |
| `lastPiece` | Last piece number the charge applies to. |
| `amount` | Charge amount. |
| `currency` | ISO 4217 currency code for the charge. |
| `noChargeNotAvailable` | Status code when free/unavailable: `X` not available, `F`/`E` free, `G`/`H` free (no booking required). When present, `amount` is typically absent. |
| `descriptions` | Free-text description lines from the wire, in order. |

## `Tax`

| Field | Meaning |
| --- | --- |
| `code` | Tax code (e.g. `US`, `XF`, `YC`). |
| `amount` | Tax amount. |
| `currency` | ISO 4217 currency code. |
| `country` | Two-letter country code where the tax originates. |
| `description` | Descriptive text for the tax. |
| `station` | Station/airport code where the tax applies. |
| `publishedAmount` | Published tax amount before currency conversion. |
| `publishedCurrency` | Published tax currency, when different from `currency`. |

## `ItineraryLeg`

| Field | Meaning |
| --- | --- |
| `ref` | Sabre `LegDesc` reference id from the itinerary. Preserved even when the leg description itself was missing. |
| `elapsedMinutes` | Total elapsed travel time for the leg in minutes. |
| `segments` | Flight segments in operating order. |

## `FlightSegment`

| Field | Meaning |
| --- | --- |
| `ref` | Sabre `ScheduleDesc` reference id. Preserved even when the schedule description was missing. |
| `marketingCarrier` | Marketing carrier IATA code. |
| `marketingFlightNumber` | Marketing flight number. |
| `operatingCarrier` | Operating carrier IATA code, when present and different from the marketing carrier (code-share). |
| `operatingFlightNumber` | Operating flight number. |
| `departure` | Departure endpoint (airport, time, terminal). |
| `arrival` | Arrival endpoint (airport, time, terminal, date adjustment). |
| `elapsedMinutes` | Elapsed segment time in minutes. |
| `stopCount` | Number of intermediate stops on this segment. |
| `scheduleBookingClass` | Schedule-level default booking class (RBD); the priced fare's RBD may differ. |
| `equipment` | Aircraft equipment code (e.g. `346`, `73H`), from the schedule's carrier. |
| `dotRating` | US DOT on-time rating (single-letter grade, e.g. `A`). |
| `onTimePerformance` | DOT on-time performance indicator (DEI 502); a numeric code, not a percentage. |
| `hiddenStops` | Hidden (technical) stops on this segment, in operating order. Absent when none. |

## `HiddenStop`

An intermediate technical touchdown on a single flight number that is not a
bookable connection point (e.g. a fuel/crew stop).

| Field | Meaning |
| --- | --- |
| `airport` | Intermediate airport IATA code. |
| `arrivalTime` | Arrival time at the intermediate point, as Sabre returned it. |
| `departureTime` | Departure time from the intermediate point. |
| `arrivalDateAdjustment` | Day shift of the intermediate arrival date relative to the segment's departure date. |
| `departureDateAdjustment` | Day shift of the intermediate departure date relative to the segment's departure date. |
| `airMiles` | Air miles flown for this flight leg. |
| `equipment` | Equipment type at the intermediate point. |

## `SegmentEndpoint`

| Field | Meaning |
| --- | --- |
| `airport` | Three-letter IATA airport code. |
| `time` | Local time of departure or arrival, as Sabre returned it (format varies by source). |
| `dateAdjustment` | Day shift of the calendar date relative to the leg start (overnight / multi-day). |
| `terminal` | Terminal name. |

## `TotalFare`

| Field | Meaning |
| --- | --- |
| `totalAmount` | Total price across all passengers and legs. |
| `currency` | ISO 4217 currency code for `totalAmount` and `totalTaxAmount`. |
| `baseFareAmount` | Base fare before taxes. |
| `baseFareCurrency` | Currency for `baseFareAmount`, when different from `currency`. |
| `totalTaxAmount` | Total taxes in `currency`. |

## `SabreMessage`

| Field | Meaning |
| --- | --- |
| `severity` | Severity: `Info`, `Warning`, `Error`, `Diagnostic`, or `Header`. |
| `code` | Sabre message code. |
| `text` | Message text. |
