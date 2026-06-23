# Flight Reshop — Response Fields Reference

Plain-English reference for every field in the **public output** of the Flight
Reshop v1 service (`FlightReshopOutput`, returned by `flightReshop`). This
documents the consumer-facing surface produced by `fromReshopResponse` — not the
raw Sabre wire. All fields are optional unless noted; the mapper emits a field
only when Sabre returns it. Money values are decimal strings; negative values
indicate a refund.

Reference types live in `src/services/flight-reshop-v1/types.ts` and are
re-exported from the package root.

## Top level — `FlightReshopOutput`

| Field | Type | Meaning |
| --- | --- | --- |
| `timestamp` | string | Response generation time, UTC ISO-8601. |
| `numberOfOffers` | number | Total number of returned offers. |
| `offers` | `FlightReshopOffer[]` | The priceable exchange offers. |
| `offerAttributes` | `FlightReshopOfferAttributes` | Baggage, refundability and change rules shared across offers, linked to fares/segments by UUID ref. |
| `associatedElectronicMiscellaneousDocuments` | `FlightReshopAssociatedEmds[]` | EMD-As associated with the exchanged tickets, grouped by ticket number. |
| `flights` | `FlightReshopFlight[]` | Flights referenced by the offers' journeys. |
| `journeys` | `FlightReshopJourneyResult[]` | Journeys referenced by the offers. |
| `errors` | `FlightReshopMessage[]` | Errors Sabre returned. Present on failed shops even with HTTP 200 — always check this. |
| `warnings` | `FlightReshopMessage[]` | Warnings Sabre returned. |

## Offer — `FlightReshopOffer`

| Field | Type | Meaning |
| --- | --- | --- |
| `id` | string | Offer ID; used in downstream booking-change calls. |
| `source` | `FlightReshopOfferSource` | Source/distribution model of the offer. |
| `createdAt` | string | When the offer was created, UTC ISO-8601. |
| `validUntil` | string | When the offer expires, UTC ISO-8601. |
| `journeyRefs` | string[] | References (by id) to the journeys this offer applies to. |
| `totalPriceDifference` | `FlightReshopTotalPrice` | Headline cost/refund of the exchange. Omitted when per-ticket costs are in different currencies. |
| `hasTravelersInDifferentCabins` | boolean | If `true`, travelers are booked in different cabins on the same flight. |
| `hasTravelersPricedInDifferentCurrencies` | boolean | If `true`, costs are calculated in different currencies per traveler. |
| `hasMixedBrands` | boolean | If `true`, the offer contains mixed branded fares. |
| `isPriceGuaranteed` | boolean | If `true`, the price is guaranteed (determined via automated Category-31 Voluntary Changes). |
| `splitBooking` | boolean | If `true`, the booking must be split for one or more travelers. |
| `items` | `FlightReshopOfferItem[]` | Priceable items within the offer. |
| `additionalOffersRefs` | string[] | References to additional offer solutions (formerly "brands"). |

### `FlightReshopOfferSource`

| Field | Type | Meaning |
| --- | --- | --- |
| `distributionModel` | `'ATPCO' \| 'NDC' \| 'Unknown'` | Distribution model the offer was sourced from. |

### `FlightReshopOfferItem`

| Field | Type | Meaning |
| --- | --- | --- |
| `id` | string | The ID of the offer item. |
| `fares` | `FlightReshopOfferFare[]` | Fare details for this item. |

### `FlightReshopOfferFare`

| Field | Type | Meaning |
| --- | --- | --- |
| `travelers` | `FlightReshopOfferTraveler[]` | Travelers this fare applies to. |
| `priceDifference` | `FlightReshopTotalPrice` | Per-fare exchange/reissue cost (carries tax/fee granularity — see below). |
| `privateFare` | `'Has Program Code' \| 'Ineligible For Ticketing' \| 'Any'` | Type of private fare this fare was generated under, if any. |
| `fareComponents` | `FlightReshopFareComponent[]` | Fare components with booking class per referenced flight. |
| `refundabilityRef` | string (UUID) | Reference to the refundability rule in `offerAttributes.refundabilityItems[].id`. |
| `changeRef` | string (UUID) | Reference to the change rule in `offerAttributes.changeItems[].id`. |

### `FlightReshopOfferTraveler`

| Field | Type | Meaning |
| --- | --- | --- |
| `passengerTypeCode` | string | ATPCO passenger type code used to generate the offer (e.g. `ADT`). |
| `ticketNumber` | string | Electronic flight ticket number associated with this traveler. |
| `givenName` | string | Traveler's first name. |
| `surname` | string | Traveler's surname. |

### `FlightReshopFareComponent`

| Field | Type | Meaning |
| --- | --- | --- |
| `fareBasisCode` | string | Fare basis code (e.g. `ABCDE10`). |
| `accountCode` | string | Account code associated with the component (e.g. `ACC33`). |
| `brand` | `FlightReshopFareBrand` | Branded-fare detail associated with the component. |
| `segmentDetails` | `FlightReshopFareComponentSegmentDetail[]` | Per-flight booking details for the flights this component covers. |

### `FlightReshopFareBrand`

| Field | Type | Meaning |
| --- | --- | --- |
| `code` | string | Brand code (e.g. `ECOFLEX`). |
| `name` | string | Human-readable brand name (e.g. `ECO FLEX`). |
| `programId` | string | Identifier of the brand program (e.g. `CFFLH`). |

### `FlightReshopFareComponentSegmentDetail`

| Field | Type | Meaning |
| --- | --- | --- |
| `flightRef` | string (UUID) | Reference (by id) to the flight in `flights[]` this detail applies to. |
| `bookingClassCode` | string | Booking inventory code (RBD) of the marketing airline (e.g. `Y`). |
| `cabinName` | cabin enum or `'Unknown'` | Cabin name for this segment. |
| `isAvailabilityBreak` | boolean | If `true`, an availability break occurs after this flight (it should not be married to the next). |
| `mealCode` | string | Meal-service code for this segment (e.g. `VGML`). |
| `checkedBaggageRef` | string (UUID) | Reference to the checked-baggage attribute in `offerAttributes.checkedBaggageItems[].id`. |

## Money — `FlightReshopTotalPrice`

Used by both `offer.totalPriceDifference` and `fare.priceDifference`. The fee
shape differs by context (see field notes).

| Field | Type | Meaning |
| --- | --- | --- |
| `type` | `'Add collect' \| 'Even' \| 'Refund' \| 'Unknown'` | Charge type for `grandTotal`. |
| `baseFare` | string | Total fare difference. |
| `totalTax` | string | Total tax difference. |
| `subtotalBeforeFee` | string | Fare + tax difference, change fees excluded. |
| `grandTotal` | string | Complete cost (positive) or refund (negative) value. |
| `currencyCode` | string | Three-letter ISO 4217 currency code. |
| `totalTaxOnFee` | string | Total tax charged on change fees. |
| `totalFee` | string | Total change/penalty fee. Set **only** on the offer-level `totalPriceDifference` (single decimal string). |
| `fees` | `FlightReshopFee[]` | Per-currency fee breakdown. Set **only** on the fare-level `priceDifference`. |
| `taxes` | `FlightReshopTax[]` | Per-tax-code differences. Set **only** on the fare-level `priceDifference`. |
| `isResidualAmountForfeited` | boolean | If `true`, the residual amount is forfeited by exchange rules. Fare-level only; omitted when not applicable. |

### `FlightReshopFee`

| Field | Type | Meaning |
| --- | --- | --- |
| `amount` | string (required) | Monetary amount of the fee. |
| `currencyCode` | string (required) | Three-letter ISO 4217 currency code. |

### `FlightReshopTax`

| Field | Type | Meaning |
| --- | --- | --- |
| `taxCode` | string (required) | The tax code (e.g. `XY`). |
| `amount` | string | Monetary amount of the tax difference. |
| `currencyCode` | string | Three-letter ISO 4217 currency code. |
| `isPaid` | boolean | If `true`, the tax difference amount has already been paid. |

## Flights — `FlightReshopFlight`

| Field | Type | Meaning |
| --- | --- | --- |
| `id` | string (UUID) | The ID of the flight (referenced by journeys). |
| `marketingFlightNumber` | number | Marketing flight number. |
| `marketingAirlineCode` | string | Two-letter IATA marketing airline code. |
| `operatingFlightNumber` | number | Operating flight number. |
| `operatingAirlineCode` | string | Two-letter IATA operating airline code. |
| `departureAirportCode` | string | Three-letter IATA origin airport code. |
| `arrivalAirportCode` | string | Three-letter IATA destination airport code. |
| `departureDate` | string | Scheduled departure date, `YYYY-MM-DD`. |
| `departureTime` | string | Scheduled departure time, `HH:MM`. |
| `arrivalDate` | string | Scheduled arrival date, `YYYY-MM-DD`. |
| `arrivalTime` | string | Scheduled arrival time, `HH:MM`. |
| `aircraftTypeCode` | string | IATA aircraft type designator code. |
| `durationInMinutes` | number | Flight duration in minutes. |
| `hiddenStops` | `FlightReshopHiddenStop[]` | En-route hidden stops on this flight, if any. |
| `hasChangeOfGauge` | boolean | If `true`, an aircraft equipment change occurs. |
| `isMarriedWithPreviousFlight` | boolean | If `true`, this segment is married to the previous one. |
| `isBookingRequired` | boolean | If `true`, the flight requires rebooking. |

### `FlightReshopHiddenStop`

| Field | Type | Meaning |
| --- | --- | --- |
| `airportCode` | string (required) | Three-letter IATA airport code of the hidden stop. |
| `departureDate` | string | Scheduled departure date from the stop, `YYYY-MM-DD`. |
| `departureTime` | string | Scheduled departure time from the stop, `HH:MM`. |
| `arrivalDate` | string | Scheduled arrival date at the stop, `YYYY-MM-DD`. |
| `arrivalTime` | string | Scheduled arrival time at the stop, `HH:MM`. |
| `aircraftTypeCode` | string | IATA aircraft type designator code for the onward leg. |
| `durationInMinutes` | number | Layover duration at the stop, in minutes. |

## Journeys — `FlightReshopJourneyResult`

| Field | Type | Meaning |
| --- | --- | --- |
| `id` | string (UUID) | The ID of the journey (referenced by offers via `journeyRefs`). |
| `flightRefs` | string[] | Flight references (by id) that make up this journey. |
| `departureAirportCode` | string | Three-letter IATA departure airport code. |
| `arrivalAirportCode` | string | Three-letter IATA arrival airport code. |
| `durationInMinutes` | number | Journey duration in minutes. |

## Offer attributes — `FlightReshopOfferAttributes`

Shared retailing attributes, linked from fares and segments by UUID ref.

| Field | Type | Meaning |
| --- | --- | --- |
| `checkedBaggageItems` | `FlightReshopCheckedBaggage[]` | Checked-baggage attributes, referenced by `checkedBaggageRef`. |
| `refundabilityItems` | `FlightReshopRefundChangeCharges[]` | Refundability rules, referenced by `refundabilityRef`. |
| `changeItems` | `FlightReshopRefundChangeCharges[]` | Change rules, referenced by `changeRef`. |

### `FlightReshopCheckedBaggage`

| Field | Type | Meaning |
| --- | --- | --- |
| `id` | string (UUID, required) | ID of the attribute, referenced by `checkedBaggageRef`. |
| `allowances` | `FlightReshopBaggageAllowance[]` | Free-allowance entries per portion of travel. |
| `charges` | `FlightReshopBaggageCharge[]` | Excess-baggage charge entries per portion of travel. |

### `FlightReshopBaggageAllowance`

| Field | Type | Meaning |
| --- | --- | --- |
| `numberOfPieces` | number | Maximum number of pieces allowed free of charge. |
| `maximumWeightInPounds` | number | Maximum weight per piece in pounds; absent when no weight limit applies. |
| `maximumWeightInKilograms` | number | Maximum weight per piece in kilograms; absent when no weight limit applies. |
| `bagDefinition` | `FlightReshopBaggageItemDefinition` | Definition of the included baggage item. |
| `airlineCode` | string | Two-letter IATA code of the airline whose baggage provisions apply. |

### `FlightReshopBaggageCharge`

| Field | Type | Meaning |
| --- | --- | --- |
| `firstPiece` | number | First piece (inclusive) in the range the charge covers, counted past the free allowance. |
| `lastPiece` | number | Last piece (inclusive) in the range the charge covers. |
| `amount` | string | Monetary amount of the charge. |
| `currencyCode` | string | Three-letter ISO 4217 currency code for `amount`. |
| `bagDefinition` | `FlightReshopBaggageItemDefinition` | Definition of the charged baggage item. |
| `airlineCode` | string | Two-letter IATA code of the airline whose baggage provisions apply. |

### `FlightReshopBaggageItemDefinition`

| Field | Type | Meaning |
| --- | --- | --- |
| `description` | string[] | Free-text descriptions of the baggage item. |

### `FlightReshopRefundChangeCharges`

Used for both `refundabilityItems` and `changeItems`.

| Field | Type | Meaning |
| --- | --- | --- |
| `id` | string (UUID, required) | ID of the attribute, referenced by `refundabilityRef` / `changeRef`. |
| `beforeDeparture` | `FlightReshopFlexibilityRule` | Charges applicable before departure. |
| `afterDeparture` | `FlightReshopFlexibilityRule` | Charges applicable after departure. |

### `FlightReshopFlexibilityRule`

| Field | Type | Meaning |
| --- | --- | --- |
| `isPermitted` | boolean (required) | If `true`, change/refund is permitted (possibly free, i.e. charge 0). |
| `maxCharge` | string | Maximum cost of the change or refund. |
| `minCharge` | string | Minimum cost of the change or refund. |
| `currencyCode` | string | Three-letter ISO 4217 currency code. |

## Associated EMDs — `FlightReshopAssociatedEmds`

| Field | Type | Meaning |
| --- | --- | --- |
| `ticketNumber` | string | Electronic flight ticket number the EMD-As are associated with. |
| `electronicMiscellaneousDocuments` | `FlightReshopElectronicMiscellaneousDocument[]` | The associated EMD-As. |

### `FlightReshopElectronicMiscellaneousDocument`

| Field | Type | Meaning |
| --- | --- | --- |
| `number` | string | The EMD-A number. |
| `reasonForIssuanceCode` | string | Reason-for-issuance code (RFIC) defined by IATA (e.g. `C`). |
| `reasonForIssuanceName` | `FlightReshopReasonForIssuance` | Name of the reason-for-issuance code (e.g. `Baggage`). |
| `refundEligibility` | `'Refundable' \| 'Non-refundable' \| 'Re-use' \| 'Unknown'` | Refund eligibility. `Re-use` = non-refundable but reapplicable to a future purchase. |
| `unusedAmount` | string | Unused monetary amount of the document. |
| `total` | string | Complete monetary amount of the document. |
| `currencyCode` | string | Three-letter ISO 4217 currency code. |

`FlightReshopReasonForIssuance` is one of: `Air Transportation`, `Surface
Transportation Non Air Services`, `Baggage`, `Financial Impact`, `Airport
Services`, `Merchandise`, `Inflight Services`, `Individual Airline Use`,
`Unknown`.

## Diagnostics — `FlightReshopMessage`

Shared shape for both `errors` and `warnings`.

| Field | Type | Meaning |
| --- | --- | --- |
| `category` | string | Category of the message (e.g. `BAD_REQUEST`, `APPLICATION_ERROR`). |
| `type` | string | Type of the message (e.g. `INVALID_VALUE`, `DOWNLINE_SERVICE_ERROR`). |
| `description` | string | Human-readable description. |
| `fieldPath` | string | Field path the message relates to, if any. |
| `fieldName` | string | Field name the message relates to, if any. |
| `fieldValue` | string | Field value the message relates to, if any. |

## Ref linking

Several fields are UUID references that resolve into the shared top-level pools:

- `offer.journeyRefs[]` → `journeys[].id`
- `journey.flightRefs[]` → `flights[].id`
- `segmentDetail.flightRef` → `flights[].id`
- `segmentDetail.checkedBaggageRef` → `offerAttributes.checkedBaggageItems[].id`
- `fare.refundabilityRef` → `offerAttributes.refundabilityItems[].id`
- `fare.changeRef` → `offerAttributes.changeItems[].id`
