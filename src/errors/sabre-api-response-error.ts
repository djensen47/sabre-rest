import { SabreError } from './sabre-error.js';

/**
 * Thrown when Sabre returns a non-2xx HTTP response to an API call.
 *
 * - `statusCode` is the HTTP status from the response.
 * - `responseBody` is the raw decoded body Sabre returned (parsed JSON
 *   when possible, otherwise the raw string). The body is preserved
 *   verbatim because Sabre's error envelope shape is inconsistent across
 *   APIs — see `docs/decisions.md` for the rationale. Use it for
 *   debugging and any structured extraction the caller wants to do; do
 *   not assume a particular shape.
 * - `responseHeaders` is the flat header map from the failing response,
 *   exactly as the chain runner saw it. Useful for rate-limit handling
 *   (`Retry-After`, `X-RateLimit-Limit`, `X-RateLimit-Remaining`,
 *   `X-RateLimit-Reset`), correlation ids, and any other header-borne
 *   metadata Sabre returns alongside the body. Header names are
 *   preserved in whatever case the chain runner emitted (typically
 *   lower-case for `fetch`-derived responses); consumers that need
 *   case-insensitive access should normalize at their boundary.
 */
export class SabreApiResponseError extends SabreError {
  readonly statusCode: number;
  readonly responseBody?: unknown;
  readonly responseHeaders?: Record<string, string>;

  constructor(
    message: string,
    statusCode: number,
    responseBody?: unknown,
    responseHeaders?: Record<string, string>,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = 'SabreApiResponseError';
    this.statusCode = statusCode;
    this.responseBody = responseBody;
    this.responseHeaders = responseHeaders;
  }
}
