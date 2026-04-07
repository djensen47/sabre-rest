/**
 * Known Sabre REST environment base URLs.
 *
 * Pass one of these as the `baseUrl` option to {@link createSabreClient} to
 * target a specific Sabre environment, or supply your own string to point at
 * a recording proxy, mock server, or non-standard environment.
 */
export const SabreBaseUrls = Object.freeze({
  /** Sabre certification (test) environment. */
  cert: 'https://api.cert.platform.sabre.com',
  /** Sabre production environment. */
  prod: 'https://api.platform.sabre.com',
});
