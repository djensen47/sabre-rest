import type { SabreRequest, SabreResponse } from '../http/types.js';

/**
 * Dependencies every service receives from the constructing client.
 *
 * Services live below the HTTP/middleware layer and the auth layer; they
 * don't talk to those directly. Instead, the client builds its middleware
 * chain once and hands each service a `request` function that runs through
 * it, plus the `baseUrl` for URL construction.
 *
 * Add new shared dependencies here as services start needing them (e.g.,
 * a logger, clock, or correlation-id provider). Adding to this interface is
 * a non-breaking change for services that ignore the new field.
 */
export interface ServiceDeps {
  baseUrl: string;
  request: (req: SabreRequest) => Promise<SabreResponse>;
}
