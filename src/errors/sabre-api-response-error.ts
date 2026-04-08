import { SabreError } from './sabre-error.js';

/**
 * Thrown when Sabre returns a non-2xx HTTP response to an API call.
 *
 * `statusCode` is the HTTP status from the response. `responseBody` is the
 * raw decoded body Sabre returned (parsed JSON when possible, otherwise the
 * raw string). The body is preserved verbatim because Sabre's error envelope
 * shape is inconsistent across APIs — see `docs/decisions.md` for the
 * rationale.
 *
 * Use `responseBody` for debugging and for any structured error extraction
 * the caller wants to do; do not assume a particular shape.
 */
export class SabreApiResponseError extends SabreError {
  readonly statusCode: number;
  readonly responseBody?: unknown;

  constructor(
    message: string,
    statusCode: number,
    responseBody?: unknown,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = 'SabreApiResponseError';
    this.statusCode = statusCode;
    this.responseBody = responseBody;
  }
}
