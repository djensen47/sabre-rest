# Sabre Support Request: Enable "Store Passenger Type In PNR" TJR Setting

## Summary

We are unable to create bookings via the Booking Management API (`POST /v1/trip/orders/createBooking`) because our cert account does not have the "Store Passenger Type In PNR" option enabled in the Travel Journal Record (TJR).

The `passengerCode` field on `travelers` is required by the API's runtime validation (omitting it returns `MANDATORY_DATA_MISSING`), but when we include it, the response returns `UNABLE_TO_ADD_TRAVELER_PASSENGER_TYPE_NOT_ENABLED`.

## Ask

Please enable the **"Store Passenger Type In PNR"** TJR option for our cert PCC so that the Booking Management API's `createBooking` endpoint can accept the `passengerCode` field on travelers.

This is listed as a prerequisite on Sabre's own documentation:

> "As a prerequisite, the 'Store Passenger Type In PNR' option in your Travel Journal Record (TJR) must be enabled."
>
> — https://developer.sabre.com/rest-api/booking-management-api/v1/index.html

## Environment

- **Endpoint:** `https://api.cert.platform.sabre.com`
- **API:** Booking Management API v1.32
- **Operation:** `createBooking` (`POST /v1/trip/orders/createBooking`)
- **Auth:** OAuth v2 (client credentials / bearer token)

## Reproduction — Full Workflow

### Step 1: Bargain Finder Max — Shop flights

```
POST https://api.cert.platform.sabre.com/v5/offers/shop
Accept: application/json
Content-Type: application/json
Authorization: Bearer <token>
```

**Request body:**
```json
{
  "OTA_AirLowFareSearchRQ": {
    "Version": "5",
    "AvailableFlightsOnly": true,
    "POS": {
      "Source": [
        {
          "RequestorID": { "Type": "1", "ID": "1", "CompanyName": { "Code": "TN" } },
          "FixedPCC": false,
          "PseudoCityCode": "<PCC>"
        }
      ]
    },
    "OriginDestinationInformation": [
      {
        "OriginLocation": { "LocationCode": "DFW" },
        "DestinationLocation": { "LocationCode": "MIA" },
        "DepartureDateTime": "2026-09-15T00:00:00",
        "Fixed": false
      }
    ],
    "TravelerInfoSummary": {
      "AirTravelerAvail": [
        { "PassengerTypeQuantity": [{ "Code": "ADT", "Quantity": 1 }] }
      ]
    },
    "TPA_Extensions": {
      "IntelliSellTransaction": { "RequestType": { "Name": "50ITINS" } }
    },
    "TravelPreferences": { "MaxStopsQuantity": 0 }
  }
}
```

**Response (abbreviated):** Returns itineraries. First result is AA 3189, DFW→MIA, booking class `S`, `farePassengerType: "ADT"`, `distributionModel: "ATPCO"`.

### Step 2: Revalidate Itinerary — Confirm pricing

```
POST https://api.cert.platform.sabre.com/v5/shop/flights/revalidate
Accept: application/json
Content-Type: application/json
Authorization: Bearer <token>
```

**Request body:**
```json
{
  "OTA_AirLowFareSearchRQ": {
    "Version": "5",
    "AvailableFlightsOnly": true,
    "POS": {
      "Source": [
        {
          "RequestorID": { "Type": "1", "ID": "1", "CompanyName": { "Code": "TN" } },
          "FixedPCC": false,
          "PseudoCityCode": "<PCC>"
        }
      ]
    },
    "OriginDestinationInformation": [
      {
        "OriginLocation": { "LocationCode": "DFW" },
        "DestinationLocation": { "LocationCode": "MIA" },
        "DepartureDateTime": "2026-09-15T00:00:00",
        "Fixed": false,
        "TPA_Extensions": {
          "Flight": [
            {
              "OriginLocation": { "LocationCode": "DFW" },
              "DestinationLocation": { "LocationCode": "MIA" },
              "Airline": { "Marketing": "AA" },
              "Number": 3189,
              "DepartureDateTime": "2026-09-15T05:00:00",
              "ArrivalDateTime": "2026-09-15T08:59:00",
              "Type": "A",
              "ClassOfService": "S"
            }
          ]
        }
      }
    ],
    "TravelerInfoSummary": {
      "AirTravelerAvail": [
        { "PassengerTypeQuantity": [{ "Code": "ADT", "Quantity": 1 }] }
      ]
    },
    "TPA_Extensions": {
      "IntelliSellTransaction": { "RequestType": { "Name": "50ITINS" } }
    }
  }
}
```

**Response (abbreviated):** Confirms AA 3189 at $319.40 USD total (base $282.79 + $36.61 tax), `farePassengerType: "ADT"`, booking code `S`, cabin `Y`.

### Step 3: Create Booking — FAILS

```
POST https://api.cert.platform.sabre.com/v1/trip/orders/createBooking
Accept: application/json
Content-Type: application/json
Authorization: Bearer <token>
```

**Request body:**
```json
{
  "receivedFrom": "Create Booking",
  "asynchronousUpdateWaitTime": 0,
  "agency": {
    "ticketingPolicy": "TODAY"
  },
  "flightDetails": {
    "flights": [
      {
        "flightNumber": 3189,
        "airlineCode": "AA",
        "fromAirportCode": "DFW",
        "toAirportCode": "MIA",
        "departureDate": "2026-09-15",
        "departureTime": "05:00",
        "bookingClass": "S",
        "flightStatusCode": "NN"
      }
    ],
    "flightPricing": [{}]
  },
  "travelers": [
    {
      "givenName": "JOHN",
      "surname": "DOE",
      "birthDate": "1990-01-15",
      "passengerCode": "ADT"
    }
  ],
  "contactInfo": {
    "emails": ["test@example.com"],
    "phones": ["8175551234"]
  }
}
```

**Response:**
```json
{
  "timestamp": "2026-04-17T19:02:24",
  "errors": [
    {
      "category": "APPLICATION_ERROR",
      "type": "UNABLE_TO_ADD_TRAVELER_PASSENGER_TYPE_NOT_ENABLED",
      "description": "Activate the \"Store Passenger Type In PNR\" option in your Travel Journal Record (TJR).",
      "fieldPath": "CreateBookingRequest.travelers",
      "fieldName": "passengerCode"
    }
  ]
}
```

## The Catch-22

- **Omitting `passengerCode`** returns: `{"category":"BAD_REQUEST","type":"MANDATORY_DATA_MISSING","description":"Validation failed: passengerCode is required."}`
- **Including `passengerCode`** (with any value — `ADT`, `CNN`, `JCB`, `MIL`, `SRC`, `ITX` all tried) returns the `UNABLE_TO_ADD_TRAVELER_PASSENGER_TYPE_NOT_ENABLED` error above.
- The only passenger code that bypassed the TJR error was `INF`, which failed with a different validation: `UNABLE_TO_ADD_TRAVELER_INFANT_IN_WRONG_ORDER` — confirming the request reaches the booking engine for types that don't require TJR storage.

The `passengerCode` value (`ADT`) comes directly from Bargain Finder Max's `farePassengerType` field in the upstream response.
