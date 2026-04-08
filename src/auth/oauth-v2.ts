import { SabreAuthenticationError } from '../errors/sabre-authentication-error.js';
import { SabreNetworkError } from '../errors/sabre-network-error.js';
import { SabreTimeoutError } from '../errors/sabre-timeout-error.js';
import { createMemoryTokenStore } from './memory-store.js';
import type { StoredToken, TokenProvider, TokenStore } from './types.js';

/**
 * Options for {@link createOAuthV2}.
 *
 * `baseUrl` is the same Sabre base URL the client uses for API calls — the
 * v2 token endpoint lives on the same host. Pass `SabreBaseUrls.cert` or
 * `SabreBaseUrls.prod` here.
 *
 * `clientId` and `clientSecret` are the credentials for the application
 * registered with Sabre.
 *
 * `store` is the cache for the obtained token. Defaults to an in-memory
 * store. Supply a Redis-backed (or similar) store for distributed
 * deployments.
 *
 * `expirySkewMs` is how early to treat a token as expired so it never gets
 * handed out moments before dying. Defaults to 60_000 ms (60 seconds).
 */
export interface OAuthV2Options {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  store?: TokenStore;
  expirySkewMs?: number;
}

const DEFAULT_EXPIRY_SKEW_MS = 60_000;
const TOKEN_PATH = '/v2/auth/token';

/** Subset of the Sabre v2 token endpoint response we care about. */
interface SabreV2TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

/**
 * Returns a {@link TokenProvider} that obtains and refreshes a Sabre OAuth
 * v2 bearer token via the `/v2/auth/token` endpoint.
 *
 * The token is requested with `grant_type=client_credentials` and an
 * Authorization header that uses Sabre's **non-standard double base64
 * encoding** for the credentials. Specifically, the value is
 * `Basic base64( base64(clientId) + ':' + base64(clientSecret) )`, not
 * the standard HTTP Basic single base64 of `clientId:clientSecret`. This
 * is what Sabre's documentation and official Node sample do; standard
 * HTTP Basic returns 401 from the v2 token endpoint. Consumers of this
 * factory pass raw `clientId` and `clientSecret`; the encoding is
 * computed internally.
 *
 * See: https://developer.sabre.com/guides/travel-agency/developer-guides/rest-apis-token-credentials
 *
 * Refreshes are gated through the store's lock so concurrent callers
 * don't all hit the token endpoint at once.
 */
export function createOAuthV2(opts: OAuthV2Options): TokenProvider {
  const store = opts.store ?? createMemoryTokenStore();
  const expirySkewMs = opts.expirySkewMs ?? DEFAULT_EXPIRY_SKEW_MS;
  const credentials = encodeBasicCredentials(opts.clientId, opts.clientSecret);
  const tokenUrl = joinUrl(opts.baseUrl, TOKEN_PATH);

  const isExpired = (token: StoredToken): boolean => {
    return Date.now() >= token.expiresAt - expirySkewMs;
  };

  const fetchFreshToken = async (): Promise<StoredToken> => {
    let response: Response;
    try {
      response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: 'grant_type=client_credentials',
      });
    } catch (err) {
      // Distinguish a deadline-related abort from a generic network failure
      // even though both surface as SabreAuthenticationError to the caller.
      const cause =
        err instanceof Error && (err.name === 'AbortError' || err.name === 'TimeoutError')
          ? new SabreTimeoutError('Timed out fetching Sabre v2 token', { cause: err })
          : new SabreNetworkError('Network failure fetching Sabre v2 token', { cause: err });
      throw new SabreAuthenticationError(
        `Failed to obtain Sabre v2 token: ${describeError(err)}`,
        undefined,
        { cause },
      );
    }

    const bodyText = await response.text().catch(() => '');

    if (!response.ok) {
      // Surface the response body in the error message. Sabre's token
      // endpoint usually returns a JSON envelope like
      // `{"error":"invalid_client","error_description":"..."}` on a
      // failure, and that's exactly the information consumers need to
      // debug bad credentials, expired secrets, wrong base URL, etc. The
      // body is preserved verbatim and the message is left small enough
      // to display in a CLI without overwhelming the user; if Sabre
      // returns an unexpectedly large body we still surface it here
      // because losing it would be worse than a long error message.
      const trimmedBody = bodyText.trim();
      const suffix = trimmedBody.length > 0 ? `: ${trimmedBody}` : '';
      throw new SabreAuthenticationError(
        `Sabre v2 token endpoint returned ${response.status} ${response.statusText}${suffix}`,
        response.status,
      );
    }

    let parsed: SabreV2TokenResponse;
    try {
      parsed = JSON.parse(bodyText) as SabreV2TokenResponse;
    } catch (err) {
      throw new SabreAuthenticationError(
        'Sabre v2 token endpoint returned a body that could not be parsed as JSON',
        response.status,
        { cause: err },
      );
    }

    if (!parsed.access_token || typeof parsed.expires_in !== 'number') {
      throw new SabreAuthenticationError(
        'Sabre v2 token endpoint returned an unexpected response shape',
        response.status,
      );
    }

    return {
      accessToken: parsed.access_token,
      expiresAt: Date.now() + parsed.expires_in * 1000,
    };
  };

  return {
    async getToken() {
      const cached = await store.get();
      if (cached && !isExpired(cached)) {
        return cached.accessToken;
      }

      return store.withLock(async () => {
        // Double-check inside the lock: another caller may have refreshed
        // while we were waiting on the lock. Use their result if it's still
        // valid.
        const recheck = await store.get();
        if (recheck && !isExpired(recheck)) {
          return recheck.accessToken;
        }

        const fresh = await fetchFreshToken();
        await store.set(fresh);
        return fresh.accessToken;
      });
    },

    async invalidate() {
      await store.clear();
    },
  };
}

/**
 * Builds the Authorization header value Sabre's REST OAuth v2 token
 * endpoint expects.
 *
 * Sabre uses a non-standard double base64 encoding: each credential is
 * base64-encoded individually, joined with a colon, then base64-encoded
 * again. Standard HTTP Basic (single base64 of `id:secret`) returns 401
 * from the v2 token endpoint.
 */
function encodeBasicCredentials(clientId: string, clientSecret: string): string {
  const encodedId = Buffer.from(clientId).toString('base64');
  const encodedSecret = Buffer.from(clientSecret).toString('base64');
  return Buffer.from(`${encodedId}:${encodedSecret}`).toString('base64');
}

function joinUrl(baseUrl: string, path: string): string {
  const trimmed = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  const prefixed = path.startsWith('/') ? path : `/${path}`;
  return `${trimmed}${prefixed}`;
}

function describeError(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}
