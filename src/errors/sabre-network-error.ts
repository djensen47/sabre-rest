import { SabreError } from './sabre-error.js';

/**
 * Thrown when a network-level failure occurs and no HTTP response was
 * received from Sabre. Common causes include DNS failure, connection
 * refused, TLS errors, and connection resets mid-request.
 *
 * For request deadlines that elapsed before a response arrived, see
 * {@link SabreTimeoutError} instead.
 *
 * The underlying `fetch` failure is preserved on `cause`.
 */
export class SabreNetworkError extends SabreError {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'SabreNetworkError';
  }
}
