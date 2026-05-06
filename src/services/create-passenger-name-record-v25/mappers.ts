import { SabreParseError } from '../../errors/sabre-parse-error.js';
import type { components } from '../../generated/create-passenger-name-record.js';
import { ensureTrailingSlash } from '../../http/ensure-trailing-slash.js';
import type { SabreRequest, SabreResponse } from '../../http/types.js';
import type {
  BookHotelApplicationMessage,
  BookHotelApplicationResults,
  BookHotelInput,
  BookHotelOutput,
  BookHotelSystemSpecificResult,
} from './types.js';

const PATH = 'v2.5.0/passenger/records';

/**
 * Wire-format version string. Every canonical example body in the
 * v2.5.0 OAS spec declares `version: "2.5.0"`; we hardcode it to match
 * the precedent set by bargain-finder-max-v5, hotel-price-check-v5,
 * and get-hotel-*-v5.
 */
const WIRE_VERSION = '2.5.0';

/**
 * Default passenger-type code when the caller omits
 * `leadGuest.passengerType`. `ADT` (adult) is the only value that
 * matters for a hotel-only PNR.
 */
const DEFAULT_PASSENGER_TYPE = 'ADT';

/**
 * Default ticketing configuration when the caller omits
 * `agency.ticketType`. `7TAW` is what Sabre's published sample bodies
 * use and matches the CERT default.
 */
const DEFAULT_TICKET_TYPE = '7TAW';

/**
 * Builds the outgoing {@link SabreRequest} for the `bookHotel`
 * operation (Sabre operationId `createPassengerNameRecord`).
 *
 * The wire body is a `CreatePassengerNameRecordRQ` envelope carrying a
 * single `HotelBook` block, hardcoded `version: "2.5.0"`, and a
 * `bookGDSviaCSL: true` flag — the spec-documented CSL-segment
 * discriminator required by SAN 16384 (see `docs/guides/hotel-booking-flow.md`).
 *
 * Fields the spec declares with `default:` are always sent with their
 * documented defaults so Sabre's request dispatcher can route
 * deterministically (see add-api skill, step 6 category 2).
 */
export function toBookHotelRequest(baseUrl: string, input: BookHotelInput): SabreRequest {
  const url = new URL(PATH, ensureTrailingSlash(baseUrl));
  url.searchParams.set('mode', 'create');

  const leadGuest = input.leadGuest;
  const agency = input.agency;
  const card = input.paymentCard;

  const personName: Record<string, unknown> = {
    NameNumber: '1.1',
    PassengerType: leadGuest.passengerType ?? DEFAULT_PASSENGER_TYPE,
    GivenName: leadGuest.firstName,
    Surname: leadGuest.lastName,
  };

  const address: Record<string, unknown> = {
    AddressLine: agency.address.addressLine,
    CityName: agency.address.cityName,
    CountryCode: agency.address.countryCode,
    StreetNmbr: agency.address.streetNumber,
  };
  if (agency.address.stateCode !== undefined) {
    address.StateCountyProv = { StateCode: agency.address.stateCode };
  }
  if (agency.address.postalCode !== undefined) {
    address.PostalCode = agency.address.postalCode;
  }

  const customerInfo: Record<string, unknown> = { PersonName: [personName] };
  const contactPhone = agency.contactPhone ?? leadGuest.phone;
  customerInfo.ContactNumbers = {
    ContactNumber: [{ NameNumber: '1.1', Phone: contactPhone, PhoneUseType: 'H' }],
  };

  const guest: Record<string, unknown> = {
    FirstName: leadGuest.firstName,
    LastName: leadGuest.lastName,
    Index: 1,
    LeadGuest: true,
    Type: 10,
    Contact: { Phone: leadGuest.phone },
  };
  if (leadGuest.email !== undefined) guest.Email = leadGuest.email;

  const billingAddress: Record<string, unknown> = {
    AddressLine: [...card.billingAddress.addressLine],
    CityName: card.billingAddress.cityName,
    CountryCodes: { Code: [{ content: card.billingAddress.countryCode }] },
  };
  if (card.billingAddress.stateCode !== undefined) {
    billingAddress.StateProvince = { code: card.billingAddress.stateCode };
    billingAddress.StateProvinceCodes = {
      Code: [{ content: card.billingAddress.stateCode }],
    };
  }
  if (card.billingAddress.postalCode !== undefined) {
    billingAddress.PostCode = card.billingAddress.postalCode;
  }

  const paymentCard: Record<string, unknown> = {
    PaymentType: 'CC',
    CardCode: card.cardCode,
    CardNumber: card.cardNumber,
    ExpiryMonth: card.expiryMonth,
    ExpiryYear: card.expiryYear,
    FullCardHolderName: {
      FirstName: card.holderFirstName,
      LastName: card.holderLastName,
    },
    Address: billingAddress,
  };
  if (card.csc !== undefined) paymentCard.CSC = card.csc;

  const hotelBook: Record<string, unknown> = {
    BookingInfo: {
      BookingKey: input.bookingKey,
      RequestorID: agency.iata,
    },
    Rooms: {
      Room: [
        {
          Guests: { Guest: [guest] },
          RoomIndex: 1,
        },
      ],
    },
    PaymentInformation: {
      FormOfPayment: { PaymentCard: paymentCard },
      Type: 'DEPOSIT',
    },
    POS: {
      Source: {
        RequestorID: {
          Type: 5,
          Id: agency.iata,
          IdContext: 'IATA',
        },
        AgencyAddress: {
          AddressLine1: agency.address.addressLine,
          CityName: {},
          CountryName: { Code: agency.address.countryCode },
        },
        AgencyName: agency.name,
        ISOCountryCode: agency.address.countryCode,
        PseudoCityCode: agency.pcc,
      },
    },
    // bookGDSviaCSL is the SAN 16384 CSL-segment discriminator, a
    // sibling of HotelBook.POS (NOT nested inside POS.Source —
    // Sabre's schema validator rejects it there as an unknown
    // property). Hardcoded true: spec default at
    // docs/specifications/create-passenger-name-record.yml#L4548.
    bookGDSviaCSL: true,
  };

  const rq: Record<string, unknown> = {
    version: WIRE_VERSION,
    haltOnAirPriceError: false,
    haltOnHotelBookError: input.haltOnHotelBookError ?? true,
    TravelItineraryAddInfo: {
      AgencyInfo: {
        Address: address,
        Ticketing: { TicketType: agency.ticketType ?? DEFAULT_TICKET_TYPE },
      },
      CustomerInfo: customerInfo,
    },
    HotelBook: hotelBook,
    PostProcessing: {
      EndTransaction: { Source: { ReceivedFrom: agency.name } },
    },
  };
  if (input.targetCity !== undefined) rq.targetCity = input.targetCity;

  return {
    method: 'POST',
    url: url.toString(),
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ CreatePassengerNameRecordRQ: rq }),
  };
}

/**
 * Parses the `bookHotel` response into {@link BookHotelOutput}.
 *
 * The spec's response schema models only `ItineraryRef.ID` (PNR
 * locator) and `ApplicationResults` — no per-segment echo for hotel.
 * The full parsed body is attached as `rawResponse` so callers that
 * need supplier-specific confirmation numbers can reach into Sabre's
 * actual payload.
 *
 * Throws {@link SabreParseError} only when the body is not valid JSON
 * or is JSON but not an object.
 */
export function fromBookHotelResponse(res: SabreResponse): BookHotelOutput {
  let parsed: components['schemas']['CreatePassengerNameRecordResponse'];
  try {
    parsed = JSON.parse(res.body) as components['schemas']['CreatePassengerNameRecordResponse'];
  } catch (err) {
    throw new SabreParseError(
      'Failed to parse Create Passenger Name Record response as JSON',
      res.body,
      { cause: err },
    );
  }

  if (parsed === null || typeof parsed !== 'object') {
    throw new SabreParseError(
      'Create Passenger Name Record response was not a JSON object',
      parsed,
    );
  }

  const out: BookHotelOutput = { rawResponse: parsed };
  const rs = parsed.CreatePassengerNameRecordRS;
  if (rs !== undefined && rs !== null && typeof rs === 'object') {
    if (rs.ItineraryRef?.ID !== undefined) out.pnrLocator = rs.ItineraryRef.ID;
    if (rs.ApplicationResults !== undefined) {
      const ar = mapApplicationResults(rs.ApplicationResults);
      if (ar !== undefined) out.applicationResults = ar;
    }
  }

  return out;
}

function mapApplicationResults(
  ar: NonNullable<components['schemas']['ApplicationResults']>,
): BookHotelApplicationResults | undefined {
  const out: BookHotelApplicationResults = {};
  if (ar.status !== undefined) out.status = ar.status;
  if (ar.Success !== undefined) out.success = ar.Success.map(mapApplicationMessage);
  if (ar.Warning !== undefined) out.warnings = ar.Warning.map(mapApplicationMessage);
  if (ar.Error !== undefined) out.errors = ar.Error.map(mapApplicationMessage);
  return Object.keys(out).length > 0 ? out : undefined;
}

function mapApplicationMessage(
  p: NonNullable<components['schemas']['ProblemInformation']>,
): BookHotelApplicationMessage {
  const out: BookHotelApplicationMessage = {};
  if (p.timeStamp !== undefined) out.timeStamp = p.timeStamp;
  if (p.SystemSpecificResults !== undefined) {
    out.systemSpecificResults = p.SystemSpecificResults.map(mapSystemSpecificResult);
  }
  return out;
}

type GeneratedSystemSpecificResult = NonNullable<
  NonNullable<components['schemas']['ProblemInformation']>['SystemSpecificResults']
>[number];

function mapSystemSpecificResult(r: GeneratedSystemSpecificResult): BookHotelSystemSpecificResult {
  const out: BookHotelSystemSpecificResult = {};
  if (r.timeStamp !== undefined) out.timeStamp = r.timeStamp;
  if (r.ShortText !== undefined) out.shortText = r.ShortText;
  if (r.Message !== undefined) {
    out.messages = r.Message.map((m) => {
      const msg: { code?: string; value?: string } = {};
      if (m.code !== undefined) msg.code = m.code;
      if (m.content !== undefined) msg.value = m.content;
      return msg;
    });
  }
  return out;
}
