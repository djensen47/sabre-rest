import type { TokenProvider } from '../auth/types.js';
import type { Middleware } from '../http/types.js';

/**
 * Returns a {@link Middleware} that adds the `Authorization: Bearer <token>`
 * header to outgoing requests and retries once on a 401 with a fresh token.
 *
 * The retry exists for the rare case where a token that the local cache
 * believes is still valid was rotated or revoked server-side. The proactive
 * expiry check inside the {@link TokenProvider} handles the common case;
 * the 401 retry handles the edge.
 */
export function createAuthMiddleware(provider: TokenProvider): Middleware {
  return async (req, next) => {
    req.headers.Authorization = `Bearer ${await provider.getToken()}`;

    const firstResponse = await next(req);
    if (firstResponse.status !== 401) {
      return firstResponse;
    }

    // Token was accepted by our local cache but rejected by Sabre. Refresh
    // and try once more. If the second attempt also returns 401, surface
    // it as a normal API response so the error-mapping middleware can turn
    // it into a SabreAuthenticationError with the appropriate status.
    await provider.invalidate();
    req.headers.Authorization = `Bearer ${await provider.getToken()}`;
    return next(req);
  };
}
