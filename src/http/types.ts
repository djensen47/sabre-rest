/**
 * HTTP types used by the middleware chain.
 *
 * These are intentionally minimal and decoupled from `fetch`'s native types
 * (`Request`, `Response`, `Headers`, `URL`). The chain operates on plain
 * data so middlewares can inspect and modify requests and responses without
 * touching transport-specific objects.
 */

/** HTTP methods the client uses. Add more here if a Sabre API needs them. */
export type SabreHttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/**
 * A request flowing through the middleware chain.
 *
 * `url` is the absolute URL to request (the client builds it from `baseUrl`
 * + the operation path before the chain runs).
 *
 * `headers` is a plain string-to-string map. Middlewares may add, remove, or
 * overwrite headers freely.
 *
 * `body` is the encoded request body (string for JSON or form-encoded
 * payloads; undefined for GET/DELETE). Encoding happens at the service
 * boundary so middlewares always see a finished body.
 *
 * `signal` is the optional abort signal forwarded from the caller. The
 * chain runner passes it down to `fetch`.
 */
export interface SabreRequest {
  method: SabreHttpMethod;
  url: string;
  headers: Record<string, string>;
  body?: string;
  signal?: AbortSignal;
}

/**
 * A response flowing back through the middleware chain.
 *
 * `body` is the decoded response body. The chain runner reads the body once
 * and exposes it here so middlewares (and services) don't have to worry
 * about consuming a stream more than once.
 *
 * `headers` is a plain map; the chain runner flattens `fetch`'s `Headers`
 * down before middlewares see it.
 */
export interface SabreResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
}

/**
 * A middleware in the request/response pipeline.
 *
 * The middleware may inspect or modify `req`, call `next` to pass it down
 * the chain, then inspect or modify the returned response. It may also skip
 * `next` entirely (e.g., to short-circuit with a cached response) or wrap
 * the call in a try/catch (e.g., to map errors).
 *
 * The chain is invoked outermost-first. Each middleware's view of the
 * "next" call is the rest of the chain plus the terminator (which performs
 * the actual `fetch`).
 */
export type Middleware = (
  req: SabreRequest,
  next: (req: SabreRequest) => Promise<SabreResponse>,
) => Promise<SabreResponse>;
