import { describe, expect, it } from 'vitest';
import { ensureTrailingSlash } from './ensure-trailing-slash.js';

describe('ensureTrailingSlash', () => {
  it('returns the url unchanged when it already ends in a slash', () => {
    expect(ensureTrailingSlash('https://api.cert.platform.sabre.com/')).toBe(
      'https://api.cert.platform.sabre.com/',
    );
  });

  it('appends a slash when the url does not end in one', () => {
    expect(ensureTrailingSlash('https://api.cert.platform.sabre.com')).toBe(
      'https://api.cert.platform.sabre.com/',
    );
  });

  it('appends a slash to an empty string', () => {
    expect(ensureTrailingSlash('')).toBe('/');
  });

  it('leaves a bare slash unchanged', () => {
    expect(ensureTrailingSlash('/')).toBe('/');
  });
});
