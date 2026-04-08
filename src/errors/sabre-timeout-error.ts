import { SabreError } from './sabre-error.js';

/**
 * Thrown when a request did not complete before its deadline. Distinct from
 * {@link SabreNetworkError} because timeouts and network failures often have
 * different operational responses (different retry policies, different SLOs,
 * different alerting).
 *
 * The underlying `AbortError` (or equivalent) is preserved on `cause`.
 */
export class SabreTimeoutError extends SabreError {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'SabreTimeoutError';
  }
}
