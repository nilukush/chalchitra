import { describe, expect, it } from 'vitest';
import { formatRuntime } from './format.js';

describe('formatRuntime', () => {
  it('converts minutes beyond an hour to hours + minutes', () => {
    expect(formatRuntime('214 minutes')).toBe('3h 34m');
    expect(formatRuntime('120 minutes')).toBe('2h');
    expect(formatRuntime('45 minutes')).toBe('45 min');
  });

  it('handles ranges', () => {
    expect(formatRuntime('43–62 minutes')).toBe('43–62 min');
    expect(formatRuntime('130–170 minutes')).toBe('2h 10m – 2h 50m');
  });

  it('passes through non-numeric values', () => {
    expect(formatRuntime('varies')).toBe('varies');
    expect(formatRuntime(undefined)).toBeUndefined();
  });
});
