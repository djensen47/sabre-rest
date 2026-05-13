import { SabreError } from './sabre-error.js';

/**
 * Thrown when authentication with Sabre fails.
 *
 * Wraps every failure originating from the auth flow:
 * - Invalid credentials at the token endpoint
 * - Network or timeout failures while fetching a token
 * - A persistent 401 or 403 on a regular API call
 *
 * When the underlying failure was a different category (network, timeout,
 * etc.) the original error is preserved on `cause` for debugging.
 *
 * `statusCode` is set when the failure was a Sabre HTTP response (e.g., 401
 * from the token endpoint) and undefined otherwise (e.g., network failure
 * before any HTTP response was received).
 *
 * `responseBody` and `responseHeaders` are populated when the failure came
 * from a Sabre HTTP response, so callers can extract Sabre's specific
 * rejection reason (e.g. `INVALID_CREDENTIALS`, `EPR_NOT_AUTHORIZED`,
 * "account not entitled for this API"). The body is the parsed JSON
 * envelope when possible, otherwise the raw string — Sabre's error shape
 * varies by API and gateway tier, so consumers should not assume a
 * particular shape. Both fields are undefined when the failure occurred
 * before any HTTP response was received (network/timeout/etc.).
 */
export class SabreAuthenticationError extends SabreError {
  readonly statusCode?: number;
  readonly responseBody?: unknown;
  readonly responseHeaders?: Record<string, string>;

  constructor(
    message: string,
    statusCode?: number,
    responseBody?: unknown,
    responseHeaders?: Record<string, string>,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = 'SabreAuthenticationError';
    this.statusCode = statusCode;
    this.responseBody = responseBody;
    this.responseHeaders = responseHeaders;
  }
}
