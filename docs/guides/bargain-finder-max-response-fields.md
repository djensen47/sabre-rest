# Bargain Finder Max — Response Field Reference

Every field in the **public output** of `bargainFinderMaxV5.search`
(`SearchBargainFinderMaxOutput`), with a plain-English description of what
it means. This documents the consumer-facing shape the library produces —
not the raw Sabre `GroupedItineraryResponse` wire format. The hand-written
type definitions live in
[`src/services/bargain-finder-max-v5/types.ts`](../../src/services/bargain-finder-max-v5/types.ts).

Every response-side field is **optional**, including fields Sabre's spec
marks as required. The library never drops a record based on which fields
are populated — every itinerary, leg, segment, and endpoint Sabre returned
is preserved. Treat any field as possibly `undefined`, and any array as
possibly empty. Whether an undercooked record is "good enough" to display
or sell is the consumer's decision.

## `SearchBargainFinderMaxOutput`

| Field | Meaning |
| --- | --- |
| `itineraries` | Priced itineraries Sabre returned, in wire order. Empty when nothing matched. |
| `messages` | Server messages (informational, warning, error). Present even on success — context, not necessarily failure. |

## `PricedItinerary`

| Field | Meaning |
| --- | --- |
| `id` | Sabre's sequence id for the itinerary within the response. |
| `legs` | Itinerary legs in trip order, one per requested origin/destination. |
| `totalFare` | Total fare across all passengers. Mirrors `fareOffers[0]` for the common single-offer case. |
| `validatingCarrierCode` | Validating carrier IATA code on the priced fare. Mirrors `fareOffers[0]`. |
| `distributionModel` | Content model: `ATPCO` (published fares), `NDC`, or `API` (carrier-hosted). Mirrors `fareOffers[0]`. |
| `fareOffers` | All fare offers for this itinerary, in wire order. Usually one; alternate pricing flavors can produce several. |

## `FareOffer`

One entry per `pricingInformation` entry on the wire. The library surfaces
all offers and does not dedupe.

| Field | Meaning |
| --- | --- |
| `passengerFares` | Per-passenger fare detail, one per priced passenger. "Passenger not available" stubs are skipped. |
| `totalFare` | Aggregate total fare across all passengers for this offer. |
| `validatingCarrierCode` | Validating carrier for this offer. |
| `distributionModel` | Content model for this offer (`ATPCO` / `NDC` / `API`). |
| `ancillaryFees` | Optional-service (ancillary) fees attached to the offer, grouped by category. Absent when none. |

## `AncillaryFee`

A group of optional-service fees of one ATPCO category.

| Field | Meaning |
| --- | --- |
| `code` | ATPCO fee group code: `BG` baggage, `IE` in-flight entertainment, `ML` meals, `SA` seats, `UN` unaccompanied passenger. |
| `name` | Human-readable group name (e.g. `IN-FLIGHT ENTERTAINMENT`). |
| `message` | Informational message attached to the group (e.g. "air extras not applicable or are unknown"). |
| `details` | Individual priced fee lines within the group, in wire order. Empty when the group carried no detail entries. |

## `AncillaryFeeDetail`

A single priced ancillary fee line.

| Field | Meaning |
| --- | --- |
| `amount` | Fee amount payable in cash. |
| `ancillaryTypeCode` | `F` flight-related, or `P` prepaid. |
| `carrier` | Owning carrier IATA code. |
| `code` | Carrier-specific service code. |
| `subcode` | ATPCO Optional Services industry subcode. |
| `subgroup` | Ancillary subgroup two-letter code (e.g. `BG`). |
| `origin` | Origin airport IATA code for the service. |
| `destination` | Destination airport IATA code for the service. |
| `startSegment` | 1-based first travel segment the fee covers. |
| `endSegment` | 1-based last travel segment the fee covers. |
| `descriptions` | Free-text description lines as Sabre returned them, in order (human line plus ATPCO filing lines). Empty when none. |

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

## `PassengerLegFare`

Per-leg fare for a passenger.

| Field | Meaning |
| --- | --- |
| `ref` | Sabre `LegDesc` reference id; matches the priced leg's `ItineraryLeg.ref`. |
| `status` | Reason a fare could not be returned for the leg: `A` class not available, `O` class not offered, `F` no fare found/applicable. |
| `totalFare` | Total fare for this leg. |

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

A contiguous chunk of journey (typically one origin/destination) with its
own fare basis.

| Field | Meaning |
| --- | --- |
| `fareBasisCode` | Fare basis code (e.g. `TKEE4M`). |
| `cabinCode` | Cabin as filed on the fare (e.g. `Y`, `C`, `F`); component-level default. |
| `governingCarrier` | Governing carrier IATA code. |
| `farePassengerType` | Passenger type the fare was filed for; may differ from the enclosing passenger type when Sabre substituted pricing. |
| `beginAirport` | IATA code of the first airport in the component. |
| `endAirport` | IATA code of the last airport in the component. |
| `segments` | Per-segment detail in wire order. ARUNK (surface) entries are skipped. |

## `FareComponentSegment`

| Field | Meaning |
| --- | --- |
| `bookingCode` | Booking class (RBD) for this segment on this fare (the per-fare RBD). |
| `cabinCode` | Cabin code for this segment (e.g. `Y`, `B`). |
| `mealCode` | Meal code. |
| `seatsAvailable` | Seats Sabre reports available to sell in this segment's booking class. `0` means the class is closed. Shop-time count, not a booking guarantee. |

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
