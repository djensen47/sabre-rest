import type { StoredToken, TokenStore } from './types.js';

/**
 * Returns a single-process in-memory {@link TokenStore}.
 *
 * The cached token lives in a closed-over variable; nothing is shared
 * between instances. `withLock` is a per-instance promise chain that
 * serializes refreshes within the process.
 *
 * For multi-process or multi-host deployments where many clients should
 * share a token, supply a custom `TokenStore` (e.g., Redis-backed) instead.
 */
export function createMemoryTokenStore(): TokenStore {
  let cached: StoredToken | null = null;
  let chain: Promise<unknown> = Promise.resolve();

  return {
    async get() {
      return cached;
    },

    async set(token) {
      cached = token;
    },

    async clear() {
      cached = null;
    },

    async withLock(fn) {
      // Serialize calls by chaining off the previous one. Both branches of
      // `then` use `fn` so a rejection in a previous lock holder doesn't
      // skip the next one's execution.
      const next = chain.then(fn, fn);
      // Swallow the rejection on `chain` itself so future awaits don't see
      // a stale unhandled rejection. The actual error propagates through
      // `next` to the caller of `withLock`.
      chain = next.catch(() => {});
      return next;
    },
  };
}
