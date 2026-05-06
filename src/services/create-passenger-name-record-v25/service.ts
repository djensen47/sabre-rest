import type { SabreRequest, SabreResponse } from '../../http/types.js';
import type { ServiceDeps } from '../types.js';
import * as mappers from './mappers.js';
import type { BookHotelInput, BookHotelOutput } from './types.js';

/**
 * Sabre Create Passenger Name Record v2.5.0.
 *
 * Orchestrated booking endpoint that turns a priced
 * {@link HotelPriceCheckV5Service.check} `bookingKey` into a Sabre PNR
 * in a single call. The underlying Sabre REST endpoint also books air
 * and rental-car segments; this library exposes only the hotel path.
 * Air bookings continue to go through
 * {@link BookingManagementV1Service.createBooking}.
 *
 * The mapper hardcodes `HotelBook.bookGDSviaCSL = true` to comply with
 * Sabre SAN 16384 (all new hotel bookings must land as CSL segments
 * as of March 26, 2024). See `docs/guides/hotel-booking-flow.md` for
 * the full flow context.
 *
 * Source: Sabre API "Create Passenger Name Record" v2.5.0
 *   - Operation: `createPassengerNameRecord` (`POST /v2.5.0/passenger/records?mode=create`)
 *   - Docs: https://developer.sabre.com/rest-api/create-passenger-name-record/2.5.0/index.html
 *
 * Construct via {@link createSabreClient}; do not implement this
 * interface yourself.
 */
export interface CreatePassengerNameRecordV25Service {
  /**
   * Book a single hotel room against a priced `bookingKey`.
   *
   * Surfaces a minimal, one-room / one-guest / one-card input shape
   * — multi-room itineraries, loyalty IDs, room extras, and
   * alternate payment forms are not yet exposed even though they
   * round-trip on the wire.
   *
   * @param input Priced `bookingKey`, lead guest, agency metadata,
   *   and payment card.
   * @returns The new PNR locator (absent on failure envelopes),
   *   Sabre's `ApplicationResults` diagnostics, and the full parsed
   *   response body for fields the public type doesn't model.
   *
   * @see createPassengerNameRecord (Sabre operationId)
   */
  bookHotel(input: BookHotelInput): Promise<BookHotelOutput>;
}

/**
 * Internal implementation of {@link CreatePassengerNameRecordV25Service}.
 * Not exported from the package; consumers obtain instances exclusively
 * via {@link createSabreClient}.
 */
export class DefaultCreatePassengerNameRecordV25Service
  implements CreatePassengerNameRecordV25Service
{
  readonly #baseUrl: string;
  readonly #request: (req: SabreRequest) => Promise<SabreResponse>;

  constructor(deps: ServiceDeps) {
    this.#baseUrl = deps.baseUrl;
    this.#request = deps.request;
  }

  async bookHotel(input: BookHotelInput): Promise<BookHotelOutput> {
    const req = mappers.toBookHotelRequest(this.#baseUrl, input);
    const res = await this.#request(req);
    return mappers.fromBookHotelResponse(res);
  }
}
