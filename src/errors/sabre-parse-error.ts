import { SabreError } from './sabre-error.js';

/**
 * Thrown when a 2xx HTTP response was received but the body could not be
 * parsed as expected (e.g., malformed JSON, or a missing field that the
 * service method requires for its public-type mapping).
 *
 * `responseBody` carries the raw decoded body when available, for debugging.
 *
 * Distinct from {@link SabreApiResponseError}: that one is "Sabre said the
 * request failed," while this one is "Sabre said it succeeded but we
 * couldn't read the response."
 */
export class SabreParseError extends SabreError {
  readonly responseBody?: unknown;

  constructor(message: string, responseBody?: unknown, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'SabreParseError';
    this.responseBody = responseBody;
  }
}
