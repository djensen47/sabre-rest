# Get Ancillaries Response Fields

`getAncillariesV2` retrieves ancillary services (baggage, seats, meals,
pets, etc.) for an existing Sabre order in NDC format. The response
describes each service, what it costs, and which segments and passengers
it applies to.

This guide documents every field on the **public output** — the shape
consumers actually receive — not the raw Sabre wire format. The
authoritative type definitions live in
[`src/services/get-ancillaries-v2/types.ts`](../../src/services/get-ancillaries-v2/types.ts).

Every field below is optional unless noted. A field is only present when
the corresponding value is present on the Sabre response; arrays are
always present but may be empty.

## Cross-references

The response is normalized: the top-level arrays hold the data once, and
offer items stitch them together by ID.

| You have | Look it up in | Via |
| --- | --- | --- |
| `offerItems[].serviceDefinitionRef` | `serviceDefinitions[].id` | what the service is |
| `offerItems[].priceDefinitionRef` | `priceDefinitions[].id` | what it costs |
| `offerItems[].segmentRefs[]` | `segments[].id` | which flights |
| `offerItems[].passengerRefs[]` | `passengers[].passengerId` | which travelers |

To add a service to a reservation you also need the top-level `offerId`
(the Sabre offer store ID).

## Top level — `GetAncillariesOutput`

| Field | Meaning |
| --- | --- |
| `segments` | Flight segments the ancillaries can apply to. |
| `passengers` | Passengers the ancillaries can apply to. |
| `offerId` | Sabre offer store ID; required to add ancillary offer items to a reservation. |
| `offerItems` | Offer items linking service definitions to segments and passengers. |
| `serviceDefinitions` | Descriptions of each ancillary service type. |
| `priceDefinitions` | Price/fee breakdowns referenced by offer items. |
| `errors` | Errors from the Sabre response, when present. |
| `warnings` | Warnings from the Sabre response, when present. |

## Segments — `AncillarySegment`

| Field | Meaning |
| --- | --- |
| `id` | Segment identifier within this response; targeted by `offerItems[].segmentRefs`. |
| `bookingAirlineCode` | Marketing/booking airline IATA code. |
| `bookingFlightNumber` | Marketing/booking flight number. |
| `departureAirportCode` | Three-letter IATA departure airport code. |
| `arrivalAirportCode` | Three-letter IATA arrival airport code. |
| `departureDate` | Departure date, `YYYY-MM-DD`. |
| `departureTime` | Departure time, `HH:mm:ss`. |
| `arrivalDate` | Arrival date, `YYYY-MM-DD`. |
| `arrivalTime` | Arrival time, `HH:mm:ss`. |
| `operatingAirlineCode` | Operating airline IATA code, when different from the booking carrier. |
| `operatingFlightNumber` | Operating flight number, when different from booking. |
| `bookingClassCode` | Booking class code (RBD). |
| `operatingBookingClassCode` | Operating carrier's booking class code. |
| `cabinCode` | Cabin code (e.g. `Y`, `J`, `F`). |
| `reservationStatus` | Reservation status as on the PNR (e.g. `HK`). |
| `isChangeOfGauge` | Whether the aircraft changes mid-segment. |
| `flightLegs` | Individual legs within the segment (relevant for change-of-gauge). |

### Flight legs — `AncillaryFlightLeg`

| Field | Meaning |
| --- | --- |
| `legId` | Leg identifier. |
| `departureAirportCode` | Three-letter IATA departure airport code for the leg. |
| `arrivalAirportCode` | Three-letter IATA arrival airport code for the leg. |
| `equipmentCode` | Three-letter IATA aircraft type designator. |

## Passengers — `AncillaryPassenger`

| Field | Meaning |
| --- | --- |
| `passengerId` | Passenger identifier within this response; targeted by `offerItems[].passengerRefs`. |
| `passengerTypeCode` | Passenger type code (e.g. `ADT`, `CHD`, `INF`). |
| `title` | Title before the surname (e.g. `Mr`, `Mrs`). |
| `givenName` | First name. |
| `middleName` | Middle name or initial. |
| `surname` | Family name / last name. |
| `suffixName` | Name suffix (e.g. `Jr`, `III`). |

## Offer items — `AncillaryOfferItem`

An offer item is the purchasable unit: one service definition, priced,
scoped to a set of segments and passengers.

| Field | Meaning |
| --- | --- |
| `offerItemId` | Unique offer item ID (used when adding the item to a reservation). |
| `serviceDefinitionRef` | ID of the `serviceDefinitions` entry describing the service. |
| `priceDefinitionRef` | ID of the `priceDefinitions` entry holding the fee breakdown. |
| `segmentRefs` | Segment IDs the item applies to. |
| `passengerRefs` | Passenger IDs the item applies to. |

## Service definitions — `AncillaryServiceDefinition`

Describes a single ancillary type (a checked bag, a meal, a pet, etc.).

| Field | Meaning |
| --- | --- |
| `id` | Service definition ID; targeted by `offerItems[].serviceDefinitionRef`. |
| `serviceCode` | ATPCO service type / SSR code (single character, industry- or carrier-defined). |
| `airlineCode` | Owning airline IATA code. |
| `commercialName` | Commercial name of the service (e.g. `SECOND BAG UPTO50LB 23KG`). |
| `groupCode` | ATPCO group code (e.g. `BG` for baggage). |
| `subGroup` | ATPCO subgroup code. |
| `reasonForIssuance` | Reason an EMD is issued (e.g. `Baggage`, `Airport Services`, `Merchandise`, `In-Flight Services`). |
| `upToWeightLimitInKilograms` | Maximum baggage weight limit, in kilograms. |
| `upToWeightLimitInPounds` | Maximum baggage weight limit, in pounds. |
| `maximumQuantity` | Maximum quantity the airline allows. |
| `bookingMethod` | How the service is booked (e.g. `Special Service Request`, `Auxiliary Segment`, `Contact Airline`, `No Booking Required`, `Per Service Record`, `Any Allowed`). |
| `settlementMethodCode` | Interline settlement method code; may be explicitly `null`. |
| `ownerCode` | NDC airline code responsible for this offer. |
| `descriptions` | Free-text description lines for the service. |
| `ancillaryBagDescriptionCode` | Baggage description code (e.g. `GOLF`). |
| `additionalInputRequirements` | Extra input the booking requires (SSR pattern). |
| `cabinUpgrade` | Cabin upgrade instructions, when applicable. |

### Descriptions — `AncillaryDescription`

| Field | Meaning |
| --- | --- |
| `id` | Description item identifier. |
| `text` | Description text. |

### Additional input requirements — `AncillaryInputRequirements`

| Field | Meaning |
| --- | --- |
| `pattern` | Text-based SSR entry pattern (e.g. `%FREETEXT%`). |
| `variables` | Variables used in the pattern. |

#### Pattern variables — `AncillaryPatternVariable`

| Field | Meaning |
| --- | --- |
| `key` | Variable identifier as used in the pattern. |
| `value` | Expression pattern of the variable. |
| `description` | Human-readable explanation of the variable. |

### Cabin upgrade — `AncillaryCabinUpgrade`

| Field | Meaning |
| --- | --- |
| `methodCode` | Service upgrade method code (PADIS 9750); may be explicitly `null`. |
| `reservationBookingDesignator` | New cabin/booking designator the upgrade moves to. |

## Pricing — `AncillaryPriceDefinition`

A price definition holds the fees for one offer item, before and after
any markup or discount.

| Field | Meaning |
| --- | --- |
| `id` | Price definition ID; targeted by `offerItems[].priceDefinitionRef`. |
| `serviceFee` | Final price after any markup/discount. |
| `baseFee` | Base price before modification. |

### Service fee — `AncillaryServiceFee`

| Field | Meaning |
| --- | --- |
| `unitPrice` | Price for a single unit (relevant when quantity > 1). |
| `totalPrice` | Total price including taxes. |

### Price — `AncillaryPrice`

| Field | Meaning |
| --- | --- |
| `saleAmount` | Sale amount with taxes, in the customer's currency. |
| `amount` | Amount without taxes, in the customer's currency. |
| `ancillaryRecordAmount` | Amount without taxes, in the airline's record currency. |
| `taxSummary` | Tax total plus individual tax line items. |

### Amount — `AncillaryAmount`

| Field | Meaning |
| --- | --- |
| `amount` | Monetary value as a string (e.g. `"128.00"`). |
| `currencyCode` | Three-letter ISO 4217 currency code. |

## Tax breakdowns — `AncillaryTaxSummary`

| Field | Meaning |
| --- | --- |
| `taxesTotal` | Total tax amount. |
| `taxes` | Individual tax line items. |
| `isTaxExempt` | Whether all taxes are exempt. |

### Individual tax — `AncillaryTax`

| Field | Meaning |
| --- | --- |
| `taxAmount` | Tax amount. |
| `taxCode` | Tax code (e.g. `AY`). |
| `taxDescription` | Tax description. |

## Errors — `AncillaryError`

| Field | Meaning |
| --- | --- |
| `code` | IATA error code (Code Table 9321). |
| `descriptionText` | Free-text error description. |
| `languageCode` | ISO 639-2 language code. |
| `ownerName` | Organization that owns the error codelist. |
| `statusText` | Processing status (`NotProcessed`, `Incomplete`, `Complete`, `Unknown`). |
| `tagText` | Invalid elements found in the request. |
| `typeCode` | Error type code. |
| `url` | Link to the online error description. |

## Warnings — `AncillaryWarning`

| Field | Meaning |
| --- | --- |
| `code` | Warning code. |
| `descriptionText` | Free-text warning description. |
| `ownerName` | Organization that owns the warning codelist. |
