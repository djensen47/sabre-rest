import type { BookingError } from '../services/booking-management-v1/types.js';
import { SabreError } from './sabre-error.js';

/**
 * Thrown by the opt-in `assertBookingSucceeded` helper when a
 * Booking Management v1 response carries one or more hard-failure
 * errors in its `errors[]` array.
 *
 * Sabre often returns `errors[]` on HTTP 200 responses for both hard
 * failures (e.g., `APPLICATION_ERROR / TIMEOUT`, `BAD_REQUEST`) and
 * benign entries (warnings, rule ids, informational). The library
 * itself does not classify or throw on these — consumers opt into
 * that behavior via the helper. This error carries only the subset
 * of entries the classification predicate judged hard.
 */
export class SabreBookingErrorResponseError extends SabreError {
  readonly errors: readonly BookingError[];

  constructor(errors: readonly BookingError[], options?: { cause?: unknown }) {
    const summary = errors.map((e) => `${e.category}/${e.type}`).join(', ');
    super(`Sabre booking response contained errors: ${summary}`, options);
    this.name = 'SabreBookingErrorResponseError';
    this.errors = errors;
  }
}
