import { describe, expect, it } from 'vitest';
import { SabreBaseUrls } from './constants.js';

describe('SabreBaseUrls', () => {
  it('exposes cert and prod URLs', () => {
    expect(SabreBaseUrls.cert).toBe('https://api.cert.platform.sabre.com');
    expect(SabreBaseUrls.prod).toBe('https://api.platform.sabre.com');
  });

  it('is frozen', () => {
    expect(Object.isFrozen(SabreBaseUrls)).toBe(true);
  });
});
