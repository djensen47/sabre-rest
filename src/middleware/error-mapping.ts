import { SabreApiResponseError } from '../errors/sabre-api-response-error.js';
import { SabreAuthenticationError } from '../errors/sabre-authentication-error.js';
import type { Middleware } from '../http/types.js';

/**
 * Returns a {@link Middleware} that converts non-2xx HTTP responses into
 * Sabre error subclasses.
 *
 * - 401 and 403 become {@link SabreAuthenticationError} (the auth flow
 *   itself failed or the credentials are not entitled to the operation).
 * - All other non-2xx responses become {@link SabreApiResponseError},
 *   carrying the raw decoded body for debugging.
 *
 * Network and timeout failures originate inside the chain runner and are
 * not the responsibility of this middleware.
 */
export function createErrorMappingMiddleware(): Middleware {
  return async (req, next) => {
    const res = await next(req);
    if (res.status >= 200 && res.status < 300) {
      return res;
    }

    const parsedBody = tryParseJson(res.body);

    if (res.status === 401 || res.status === 403) {
      throw new SabreAuthenticationError(
        `Sabre rejected the request: ${res.status} ${res.statusText}`,
        res.status,
      );
    }

    throw new SabreApiResponseError(
      `Sabre returned ${res.status} ${res.statusText} for ${req.method} ${req.url}`,
      res.status,
      parsedBody ?? res.body,
    );
  };
}

function tryParseJson(body: string): unknown | undefined {
  if (!body) return undefined;
  try {
    return JSON.parse(body);
  } catch {
    return undefined;
  }
}
