import { SabreError } from './sabre-error.js';

/**
 * Thrown when authentication with Sabre fails.
 *
 * Wraps every failure originating from the auth flow:
 * - Invalid credentials at the token endpoint
 * - Network or timeout failures while fetching a token
 * - A persistent 401 on a regular API call after a refresh-and-retry
 *
 * When the underlying failure was a different category (network, timeout,
 * etc.) the original error is preserved on `cause` for debugging.
 *
 * `statusCode` is set when the failure was a Sabre HTTP response (e.g., 401
 * from the token endpoint) and undefined otherwise (e.g., network failure
 * before any HTTP response was received).
 */
export class SabreAuthenticationError extends SabreError {
  readonly statusCode?: number;

  constructor(message: string, statusCode?: number, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'SabreAuthenticationError';
    this.statusCode = statusCode;
  }
}
