import type { SabreRequest, SabreResponse } from '../../http/types.js';
import type { ServiceDeps } from '../types.js';
import * as mappers from './mappers.js';
import type {
  CreateBookingInput,
  CreateBookingOutput,
  GetBookingInput,
  GetBookingOutput,
  ModifyBookingInput,
  ModifyBookingOutput,
} from './types.js';

/**
 * Sabre Booking Management v1.
 *
 * Manages Sabre reservations (bookings) through a set of dedicated
 * services including create, get, modify, and cancel operations for
 * bookings and flight tickets.
 *
 * Source: Sabre API "Booking Management API" v1.32
 *   - Operations:
 *     - `createBooking` (`POST /v1/trip/orders/createBooking`)
 *     - `getBooking` (`POST /v1/trip/orders/getBooking`)
 *     - `modifyBooking` (`POST /v1/trip/orders/modifyBooking`)
 *   - Docs: https://developer.sabre.com/docs/rest_apis/trip/orders/booking_management
 *
 * Construct via {@link createSabreClient}; do not implement this interface
 * yourself.
 */
export interface BookingManagementV1Service {
  /**
   * Create an air booking (NDC, ATPCO, or LCC).
   *
   * For NDC bookings, provide `flightOffer` with the offer ID and
   * selected items from a shopping response. For ATPCO/LCC bookings,
   * provide `flightDetails` with individual flights.
   *
   * @param input Booking details including flights, travelers, and payment.
   * @returns The confirmation ID, full booking state, and any errors.
   */
  createBooking(input: CreateBookingInput): Promise<CreateBookingOutput>;

  /**
   * Retrieve comprehensive booking details by confirmation ID.
   *
   * Use `returnOnly` to restrict the response to specific sections
   * (flights, travelers, payments, etc.) for faster responses and
   * smaller payloads. Use `extraFeatures` to opt into backward-
   * compatible response additions.
   *
   * @param input Retrieval criteria, including the required `confirmationId`.
   * @returns The booking state, response metadata, and any errors.
   */
  getBooking(input: GetBookingInput): Promise<GetBookingOutput>;

  /**
   * Modify non-itinerary data in an existing booking.
   *
   * The API diffs the `before` and `after` snapshots and applies the
   * appropriate add, update, or delete operations. Supply a
   * `bookingSignature` obtained via `getBooking` so Sabre can verify
   * that the booking has not changed since it was read. Set
   * `retrieveBooking: true` to include the current booking state in
   * the response.
   *
   * @param input Modification criteria, including the required
   *   `confirmationId`, `bookingSignature`, `before`, and `after`.
   * @returns Response metadata, any errors, and (when requested) the
   *   current booking state.
   */
  modifyBooking(input: ModifyBookingInput): Promise<ModifyBookingOutput>;
}

/**
 * Internal implementation of {@link BookingManagementV1Service}. Not
 * exported from the package; consumers obtain instances exclusively via
 * {@link createSabreClient}.
 */
export class DefaultBookingManagementV1Service implements BookingManagementV1Service {
  readonly #baseUrl: string;
  readonly #request: (req: SabreRequest) => Promise<SabreResponse>;

  constructor(deps: ServiceDeps) {
    this.#baseUrl = deps.baseUrl;
    this.#request = deps.request;
  }

  async createBooking(input: CreateBookingInput): Promise<CreateBookingOutput> {
    const req = mappers.toCreateBookingRequest(this.#baseUrl, input);
    const res = await this.#request(req);
    return mappers.fromCreateBookingResponse(res);
  }

  async getBooking(input: GetBookingInput): Promise<GetBookingOutput> {
    const req = mappers.toGetBookingRequest(this.#baseUrl, input);
    const res = await this.#request(req);
    return mappers.fromGetBookingResponse(res);
  }

  async modifyBooking(input: ModifyBookingInput): Promise<ModifyBookingOutput> {
    const req = mappers.toModifyBookingRequest(this.#baseUrl, input);
    const res = await this.#request(req);
    return mappers.fromModifyBookingResponse(res);
  }
}
