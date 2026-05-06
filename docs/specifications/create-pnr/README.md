# Create Passenger Name Record — hotel booking reference

Working request bodies for `POST {base}/v2.2.0/passenger/records?mode=create`
(Sabre `CreatePassengerNameRecord` v2.2.0 / v2.5.0). This is the REST
booking step in the CSL orchestrated hotel flow:

    hotel-search → get-hotel-avail → get-hotel-details → hotel-price-check
      → create-passenger-name-record   ← booking lands here
      → get-booking → cancel-booking

The service is **not yet wrapped** in this library. These samples exist as
a handoff for the eventual `createPnrV25` (or `bookHotelV25`) service and
its CLI command.

## Samples

Each file is a live request body pulled from Sabre's published CSL
Postman collection. `{{booking-key}}` is the placeholder Sabre's Postman
uses; at runtime this is the `bookingKey` returned by
{@link HotelPriceCheckV5Service.check}.

| File | Supplier | Notes |
|---|---|---|
| `sample-request-hotel-gds.json` | GDS (source `100`) | Minimum useful body. Single room, single lead guest, credit-card guarantee. |
| `sample-request-hotel-gds-extra-fields.json` | GDS | Same as above plus `CorpDiscount`, `PromotionalCode`, `FrequentFlyerNumber`, `LoyaltyId`, `RoomExtras`, and `SpecialInstructions`. Good reference for the full GDS feature surface. |
| `sample-request-hotel-ean.json` | EAN / Expedia (source `113`) | Two guests per room (adult + child with `Age`). |
| `sample-request-hotel-bcom.json` | Booking.com (source `112`) | Supplier-specific body shape quirks. |
| `sample-request-hotel-hbd.json` | HBD / HotelBeds (source `130`) | Supplier-specific body shape quirks. |

Our CERT PCC is currently entitled only to GDS (source `100`); the
aggregator samples are retained for when entitlements expand.

## Shape at a glance

```text
CreatePassengerNameRecordRQ
├── version "2.2.0"
├── targetCity <PCC>
├── haltOnAirPriceError false
├── TravelItineraryAddInfo
│   ├── AgencyInfo.Address       ← agency street / city / state / country
│   ├── AgencyInfo.Ticketing     ← TicketType (e.g. "7TAW")
│   └── CustomerInfo
│       ├── ContactNumbers       ← lead-guest phone
│       └── PersonName[]         ← one per passenger, matched by NameNumber
└── HotelBook
    ├── BookingInfo
    │   ├── BookingKey           ← from Hotel Price Check
    │   └── RequestorID          ← Sabre IATA / requestor ID
    ├── Rooms.Room[]
    │   └── Guests.Guest[]       ← names, contact, LeadGuest flag, Type code
    ├── PaymentInformation
    │   └── FormOfPayment.PaymentCard  ← card + billing address, Type "DEPOSIT"
    ├── POS.Source
    │   ├── RequestorID          ← IATA requestor block
    │   ├── AgencyAddress        ← AddressLine1, CityName, CountryName.Code
    │   ├── AgencyName
    │   ├── ISOCountryCode
    │   └── PseudoCityCode
    └── PostProcessing
        ├── RedisplayReservation
        └── EndTransaction.Source.ReceivedFrom
```

## Source

These bodies were extracted from
**`CSL-JSON-2SG-v3.0.postman_collection.json`** inside the
"REST v5" Postman download available from
[Sabre's CSL API Support page](https://developer.sabre.com/product-collection/content-services-for-lodging-csl/v1/help-documentation/csl-api-support.html).

The collection itself is 3,600+ lines across ~25 request bodies and is
freely re-downloadable; we don't commit it. If any of the samples here
drift from current Sabre behavior, re-pull the collection, re-extract,
and refresh these files.

## Useful collateral

- **CERT properties:** `Active-CERT-Properties.xlsx` from the same CSL
  Support page — the only reliable way to find Sabre-ID-indexed hotels
  that our PCC can see.
- **Endpoint entitlement errors:** `USG_SECURITY_ICE_ERROR` is "not
  entitled"; `ERR.NGHP-AGGREGATOR.VAULT_API_ERROR` is "aggregator
  credentials missing." See the CSL API Support page for the full list.
