import type { SabreRequest, SabreResponse } from '../../http/types.js';
import type { ServiceDeps } from '../types.js';
import * as mappers from './mappers.js';
import type {
  CancelBookingInput,
  CancelBookingOutput,
  CheckTicketsInput,
  CheckTicketsOutput,
  CreateBookingInput,
  CreateBookingOutput,
  FulfillTicketsInput,
  FulfillTicketsOutput,
  GetBookingInput,
  GetBookingOutput,
  ModifyBookingInput,
  ModifyBookingOutput,
  VoidTicketsInput,
  VoidTicketsOutput,
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
 *     - `cancelBooking` (`POST /v1/trip/orders/cancelBooking`)
 *     - `fulfillTickets` (`POST /v1/trip/orders/fulfillFlightTickets`)
 *     - `voidTickets` (`POST /v1/trip/orders/voidFlightTickets`)
 *     - `checkTickets` (`POST /v1/trip/orders/checkFlightTickets`)
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

  /**
   * Cancel a booking or specific booking items, optionally voiding or
   * refunding related flight tickets in the same call.
   *
   * Scope the cancellation via `cancelAll`, per-type references
   * (`flights`, `hotels`, etc.), or `segments`. Use
   * `flightTicketOperation` with `VOID` or `REFUND` to bundle ticket
   * operations; set `retrieveBooking: true` to include the post-cancel
   * booking state in the response.
   *
   * @param input Cancellation criteria, including the required
   *   `confirmationId`.
   * @returns Response metadata, ticket-level eligibility data, errors,
   *   and (when requested) the current booking state.
   */
  cancelBooking(input: CancelBookingInput): Promise<CancelBookingOutput>;

  /**
   * Fulfill flight tickets and Electronic Miscellaneous Documents
   * (EMDs) for an existing booking.
   *
   * `confirmationId` and `fulfillments` are required. Each entry in
   * `fulfillments` targets either a ticket or an EMD (via
   * `ancillaryIds`), with optional per-document `ticketingQualifiers`
   * and payment distribution. Spec-defined defaults for
   * `retainAccounting`, `receivedFrom`, `generateSingleInvoice`,
   * `commitTicketToBookingWaitTime`, `acceptNegotiatedFare`, and
   * `acceptPriceChanges` are always sent on the wire.
   *
   * @param input Fulfillment criteria, including the required
   *   `confirmationId` and `fulfillments` array.
   * @returns Issued ticket/EMD details, the echoed request, and any
   *   errors Sabre returned.
   */
  fulfillTickets(input: FulfillTicketsInput): Promise<FulfillTicketsOutput>;

  /**
   * Void flight tickets and Electronic Miscellaneous Documents (EMDs)
   * by ticket number.
   *
   * Supply either a `confirmationId` (void every ticket on the
   * booking) or a `tickets` list (void specific tickets), or both to
   * scope. Up to 12 ticket numbers per call. The spec-defined default
   * for `voidNonElectronicTickets` (`false`) is always sent on the
   * wire; `errorHandlingPolicy` defaults to `HALT_ON_ERROR` to match
   * `cancelBooking`.
   *
   * @param input Voiding criteria. At minimum, supply either
   *   `confirmationId` or `tickets` so Sabre can resolve the scope.
   * @returns Successfully voided ticket numbers, the echoed request,
   *   and any errors Sabre returned.
   */
  voidTickets(input: VoidTicketsInput): Promise<VoidTicketsOutput>;

  /**
   * Check flight tickets for void, refund, and exchange conditions.
   *
   * Read-only: this operation does not mutate the booking. Supply
   * either a `confirmationId` (check every ticket on the booking) or
   * a `tickets` list (up to 12 entries, each with a ticket number and
   * optional ATPCO refund qualifiers), or both. The response includes
   * per-ticket eligibility flags (`isVoidable`, `isRefundable`,
   * `isChangeable`), refund totals and penalties, and — for NDC
   * orders — `cancelOffers`. EMDs are not supported by this
   * operation. Sabre returns `tickets` in the same order as the
   * request.
   *
   * @param input Check criteria. At minimum supply either
   *   `confirmationId` or `tickets` so Sabre can resolve the scope.
   * @returns Per-ticket eligibility data, NDC cancel offers, flight
   *   refund options, the echoed request, and any errors Sabre
   *   returned.
   */
  checkTickets(input: CheckTicketsInput): Promise<CheckTicketsOutput>;
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

  async cancelBooking(input: CancelBookingInput): Promise<CancelBookingOutput> {
    const req = mappers.toCancelBookingRequest(this.#baseUrl, input);
    const res = await this.#request(req);
    return mappers.fromCancelBookingResponse(res);
  }

  async fulfillTickets(input: FulfillTicketsInput): Promise<FulfillTicketsOutput> {
    const req = mappers.toFulfillTicketsRequest(this.#baseUrl, input);
    const res = await this.#request(req);
    return mappers.fromFulfillTicketsResponse(res);
  }

  async voidTickets(input: VoidTicketsInput): Promise<VoidTicketsOutput> {
    const req = mappers.toVoidTicketsRequest(this.#baseUrl, input);
    const res = await this.#request(req);
    return mappers.fromVoidTicketsResponse(res);
  }

  async checkTickets(input: CheckTicketsInput): Promise<CheckTicketsOutput> {
    const req = mappers.toCheckTicketsRequest(this.#baseUrl, input);
    const res = await this.#request(req);
    return mappers.fromCheckTicketsResponse(res);
  }
}
