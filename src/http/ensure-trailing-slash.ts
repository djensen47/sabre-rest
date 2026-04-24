/**
 * Returns `url` with a guaranteed trailing slash.
 *
 * Mappers call this before `new URL(path, base)` because that constructor
 * resolves `path` relative to `base` — when `base` lacks a trailing slash,
 * its final path segment is treated as a file and stripped.
 */
export function ensureTrailingSlash(url: string): string {
  return url.endsWith('/') ? url : `${url}/`;
}
