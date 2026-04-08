/**
 * Authentication types: TokenProvider, TokenStore, StoredToken.
 *
 * `TokenProvider` is what the auth middleware calls to get a valid token.
 * Implementations (`createOAuthV2`, future `createOAuthV3`) handle the
 * specifics of the Sabre token endpoint they target.
 *
 * `TokenStore` is where cached tokens live. The default in-memory store
 * works for single-process deployments. For multi-process or distributed
 * deployments where many client instances should share a token, supply a
 * Redis-backed (or similar) store implementing this interface.
 */

/** A bearer token plus its absolute expiry time in epoch milliseconds. */
export interface StoredToken {
  accessToken: string;
  expiresAt: number;
}

/**
 * Storage for the cached bearer token.
 *
 * Implementations must serialize concurrent refresh attempts via `withLock`
 * — when many requests race on an expired token, only one of them should
 * actually call the token endpoint, and the others should read the result
 * the winner wrote. The double-checked locking pattern is implemented in
 * the provider; the store just provides the lock primitive.
 *
 * For an in-memory store, `withLock` is a per-instance promise chain. For
 * a distributed store, it's a `SETNX`-style or otherwise coordinated lock
 * keyed by the same prefix the cache entry uses.
 */
export interface TokenStore {
  get(): Promise<StoredToken | null>;
  set(token: StoredToken): Promise<void>;
  clear(): Promise<void>;

  /**
   * Run `fn` while holding the store's refresh lock. Other callers of
   * `withLock` against the same store wait until `fn` resolves or rejects.
   *
   * Implementations must be re-entrant-safe enough that callers can read
   * and write the store from inside `fn` without deadlocking themselves.
   */
  withLock<T>(fn: () => Promise<T>): Promise<T>;
}

/**
 * What the auth middleware needs from any auth implementation.
 *
 * `getToken` returns a token that is valid right now (proactively
 * refreshing if the cached one is expired or close to expiring). The
 * middleware adds it to the `Authorization` header on outgoing requests.
 *
 * `invalidate` is called by the auth middleware when an API call returned
 * 401 despite using a non-expired token, indicating the token was revoked
 * or rotated server-side. The next `getToken` call must fetch a fresh
 * token rather than returning the cached one.
 */
export interface TokenProvider {
  getToken(): Promise<string>;
  invalidate(): Promise<void>;
}
