import { SabreNetworkError } from '../errors/sabre-network-error.js';
import { SabreTimeoutError } from '../errors/sabre-timeout-error.js';
import type { Middleware, SabreRequest, SabreResponse } from './types.js';

/**
 * Builds a function that runs a request through the given middleware chain
 * and returns the final response.
 *
 * The chain is composed outermost-first: the first middleware in the array
 * wraps the second, which wraps the third, ... which wraps the terminator
 * (the actual `fetch` call). Calling the returned function invokes the
 * outermost middleware with a `next` that walks the rest of the chain.
 *
 * The terminator is built into this runner; it is **not** itself a
 * middleware. It calls `fetch`, normalizes the response into a
 * {@link SabreResponse}, and translates network and timeout failures into
 * {@link SabreNetworkError} / {@link SabreTimeoutError}. Higher layers (the
 * error-mapping middleware) translate non-2xx HTTP responses into
 * appropriate Sabre errors.
 */
export function buildChain(
  middlewares: readonly Middleware[],
): (req: SabreRequest) => Promise<SabreResponse> {
  const dispatch = (index: number, req: SabreRequest): Promise<SabreResponse> => {
    if (index >= middlewares.length) {
      return terminator(req);
    }
    const mw = middlewares[index];
    if (!mw) {
      // unreachable given the bounds check above; satisfies noUncheckedIndexedAccess
      return terminator(req);
    }
    return mw(req, (nextReq) => dispatch(index + 1, nextReq));
  };

  return (req) => dispatch(0, req);
}

/**
 * The terminator: actually performs the network call.
 *
 * Reads the response body once and exposes it as a string. Translates
 * fetch-level failures into Sabre error subclasses without leaking the
 * underlying types.
 */
async function terminator(req: SabreRequest): Promise<SabreResponse> {
  let nativeResponse: Response;
  try {
    nativeResponse = await fetch(req.url, {
      method: req.method,
      headers: req.headers,
      body: req.body,
      signal: req.signal,
    });
  } catch (err) {
    if (isAbortError(err)) {
      throw new SabreTimeoutError(`Request to ${req.url} was aborted`, { cause: err });
    }
    throw new SabreNetworkError(`Network failure calling ${req.url}: ${describeError(err)}`, {
      cause: err,
    });
  }

  let body: string;
  try {
    body = await nativeResponse.text();
  } catch (err) {
    throw new SabreNetworkError(
      `Failed to read response body from ${req.url}: ${describeError(err)}`,
      { cause: err },
    );
  }

  const headers: Record<string, string> = {};
  nativeResponse.headers.forEach((value, key) => {
    headers[key] = value;
  });

  return {
    status: nativeResponse.status,
    statusText: nativeResponse.statusText,
    headers,
    body,
  };
}

function isAbortError(err: unknown): boolean {
  return err instanceof Error && (err.name === 'AbortError' || err.name === 'TimeoutError');
}

function describeError(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}
