import type { SabreResponse } from './types.js';

/** Test helper: build a 200 OK {@link SabreResponse} with the given body. */
export function okResponse(body: unknown): SabreResponse {
  return {
    status: 200,
    statusText: 'OK',
    headers: {},
    body: typeof body === 'string' ? body : JSON.stringify(body),
  };
}
