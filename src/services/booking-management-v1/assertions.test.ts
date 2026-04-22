import { describe, expect, it } from 'vitest';
import { SabreBookingErrorResponseError } from '../../errors/sabre-booking-error-response-error.js';
import {
  type BookingErrorPredicate,
  assertBookingSucceeded,
  defaultBookingHardFailurePredicate,
} from './assertions.js';
import type { BookingError } from './types.js';

const hardError: BookingError = {
  category: 'APPLICATION_ERROR',
  type: 'TIMEOUT',
  description: 'No response from service provider (UpdateReservationRQ).',
};

const warningError: BookingError = {
  category: 'WARNING',
  type: 'INFORMATIONAL',
  description: 'Rule id 12345',
};

describe('defaultBookingHardFailurePredicate', () => {
  it('treats non-WARNING categories as hard failures', () => {
    expect(defaultBookingHardFailurePredicate(hardError)).toBe(true);
    expect(defaultBookingHardFailurePredicate({ category: 'BAD_REQUEST', type: 'X' })).toBe(true);
  });

  it('treats WARNING as benign', () => {
    expect(defaultBookingHardFailurePredicate(warningError)).toBe(false);
  });
});

describe('assertBookingSucceeded', () => {
  it('returns undefined for a result with no errors field', () => {
    expect(assertBookingSucceeded({})).toBeUndefined();
  });

  it('returns undefined for an empty errors array', () => {
    expect(assertBookingSucceeded({ errors: [] })).toBeUndefined();
  });

  it('returns undefined when all errors are benign warnings', () => {
    expect(assertBookingSucceeded({ errors: [warningError, warningError] })).toBeUndefined();
  });

  it('throws SabreBookingErrorResponseError on a hard failure', () => {
    expect(() => assertBookingSucceeded({ errors: [hardError] })).toThrowError(
      SabreBookingErrorResponseError,
    );
  });

  it('throws when the response mixes warnings and a hard failure', () => {
    expect(() => assertBookingSucceeded({ errors: [warningError, hardError] })).toThrowError(
      SabreBookingErrorResponseError,
    );
  });

  it('carries only the hard-failure entries on the thrown error', () => {
    try {
      assertBookingSucceeded({ errors: [warningError, hardError, warningError] });
      throw new Error('expected to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(SabreBookingErrorResponseError);
      const thrown = err as SabreBookingErrorResponseError;
      expect(thrown.errors).toEqual([hardError]);
    }
  });

  it('includes category/type pairs in the error message', () => {
    try {
      assertBookingSucceeded({ errors: [hardError] });
      throw new Error('expected to throw');
    } catch (err) {
      expect((err as Error).message).toContain('APPLICATION_ERROR/TIMEOUT');
    }
  });

  it('uses a custom predicate when provided', () => {
    const onlyTimeoutIsHard: BookingErrorPredicate = (e) => e.type === 'TIMEOUT';
    expect(() =>
      assertBookingSucceeded(
        { errors: [{ category: 'BAD_REQUEST', type: 'VALIDATION_ERROR' }] },
        { isHardFailure: onlyTimeoutIsHard },
      ),
    ).not.toThrow();
    expect(() =>
      assertBookingSucceeded({ errors: [hardError] }, { isHardFailure: onlyTimeoutIsHard }),
    ).toThrowError(SabreBookingErrorResponseError);
  });

  it('works across every Booking Management v1 output shape', () => {
    // Just verifies the input type is permissive enough. If any of
    // these stopped compiling, the AssertBookingSucceededInput shape
    // would need to be relaxed.
    const createOutput: { errors?: readonly BookingError[] } = { errors: [warningError] };
    const getOutput: { errors?: readonly BookingError[] } = {};
    const modifyOutput: { errors?: readonly BookingError[] } = { errors: [hardError] };
    const cancelOutput: { errors?: readonly BookingError[] } = {};
    expect(assertBookingSucceeded(createOutput)).toBeUndefined();
    expect(assertBookingSucceeded(getOutput)).toBeUndefined();
    expect(() => assertBookingSucceeded(modifyOutput)).toThrow();
    expect(assertBookingSucceeded(cancelOutput)).toBeUndefined();
  });
});
