/**
 * Base class for all errors thrown by the `sabre-rest` client.
 *
 * Catching `SabreError` catches every error category the client can throw.
 * For more specific handling, catch one of the subclasses
 * ({@link SabreApiResponseError}, {@link SabreAuthenticationError},
 * {@link SabreNetworkError}, {@link SabreTimeoutError},
 * {@link SabreParseError}).
 *
 * The standard `Error` `cause` option is supported on every subclass and is
 * used internally to preserve the underlying failure (a `TypeError` from
 * `fetch`, an `AbortError` from a timeout, etc.) without leaking transport
 * types into the public API.
 */
export class SabreError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'SabreError';
  }
}
