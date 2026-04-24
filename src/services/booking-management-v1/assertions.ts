/**
 * Assertion helpers for Booking Management v1 responses.
 *
 * ## Why this module exists
 *
 * Sabre's Booking Management v1 API can return HTTP 200 with hard
 * failures listed in the response body's `errors[]` array. This is a
 * quirk specific to this upstream API: a 2xx status does not by
 * itself imply the operation succeeded. The library therefore does
 * not classify or throw on `errors[]` by default — that decision
 * belongs to the consumer — and instead exposes the opt-in
 * {@link assertBookingSucceeded} helper for callers that want
 * "200-with-errors should throw" semantics. The companion error
 * type {@link SabreBookingErrorResponseError} carries the rejected
 * entries.
 *
 * ## Why other services don't have an `assertions.ts`
 *
 * The 7 other Sabre APIs wrapped by this package signal failure via
 * non-2xx HTTP statuses (which the HTTP layer surfaces as thrown
 * errors) and do not return hard-failure payloads on 200. They have
 * no analogous quirk to assert against, so they have no
 * `assertions.ts` module. The asymmetry is intentional, not drift.
 *
 * **Criterion for adding an analogous module to a future service:**
 * only when the upstream API has a similar success-status-with-
 * failure-payload pattern. A service whose failures are always
 * carried by the HTTP status does not need this layer.
 */

import { SabreBookingErrorResponseError } from '../../errors/sabre-booking-error-response-error.js';
import type { BookingError } from './types.js';

/**
 * Predicate that decides whether a single {@link BookingError} is a
 * hard failure that should cause {@link assertBookingSucceeded} to
 * throw. Return `true` to treat the entry as a hard failure, `false`
 * to treat it as benign (informational, warning, ignorable).
 */
export type BookingErrorPredicate = (error: BookingError) => boolean;

/**
 * Default hard-failure predicate for {@link assertBookingSucceeded}.
 *
 * Treats any error whose `category` is not `'WARNING'` as a hard
 * failure. The default is intentionally permissive on the failure
 * side — Sabre's `errors[]` carries both hard failures (`TIMEOUT`,
 * `APPLICATION_ERROR`, `BAD_REQUEST`) and benign entries (rule ids,
 * schema warnings) on 200-OK responses, and `category` is the only
 * consistent signal across operations. Consumers with different
 * tolerances should pass their own predicate to
 * {@link assertBookingSucceeded}.
 */
export const defaultBookingHardFailurePredicate: BookingErrorPredicate = (error) =>
  error.category !== 'WARNING';

/** Options accepted by {@link assertBookingSucceeded}. */
export interface AssertBookingSucceededOptions {
  /**
   * Custom predicate that decides whether an entry in `errors[]` is a
   * hard failure. Defaults to {@link defaultBookingHardFailurePredicate}.
   */
  isHardFailure?: BookingErrorPredicate;
}

/**
 * Shape that {@link assertBookingSucceeded} operates on. All four
 * Booking Management v1 output types (`CreateBookingOutput`,
 * `GetBookingOutput`, `ModifyBookingOutput`, `CancelBookingOutput`)
 * carry a compatible `errors?: readonly BookingError[]` field.
 */
export interface AssertBookingSucceededInput {
  errors?: readonly BookingError[];
}

/**
 * Opt-in helper that throws {@link SabreBookingErrorResponseError}
 * when a Booking Management v1 response contains at least one
 * hard-failure entry in its `errors[]` array.
 *
 * Sabre returns `errors[]` on HTTP 200 responses for both hard
 * failures and benign warnings, so the library does not classify or
 * throw on these by default. Consumers that want "if the response
 * looks like a failure, throw" semantics call this helper at their
 * own gateway/repository layer:
 *
 * ```ts
 * const result = await client.bookingManagementV1.createBooking(input);
 * assertBookingSucceeded(result);
 * return result;
 * ```
 *
 * The default predicate treats every non-`WARNING` category as a
 * hard failure. Pass `isHardFailure` to override — e.g., to tolerate
 * the partial-cancel errors that `ALLOW_PARTIAL_CANCEL` legitimately
 * emits alongside a successful response:
 *
 * ```ts
 * assertBookingSucceeded(result, {
 *   isHardFailure: (err) =>
 *     err.category !== 'WARNING' && err.type !== 'PARTIAL_CANCEL_EXPECTED',
 * });
 * ```
 *
 * @throws {@link SabreBookingErrorResponseError} when one or more
 *   entries in `result.errors` satisfy the hard-failure predicate.
 *   The thrown error carries only the entries that were judged hard.
 */
export function assertBookingSucceeded(
  result: AssertBookingSucceededInput,
  options: AssertBookingSucceededOptions = {},
): void {
  const errors = result.errors;
  if (!errors || errors.length === 0) return;
  const predicate = options.isHardFailure ?? defaultBookingHardFailurePredicate;
  const hardErrors = errors.filter(predicate);
  if (hardErrors.length > 0) {
    throw new SabreBookingErrorResponseError(hardErrors);
  }
}
