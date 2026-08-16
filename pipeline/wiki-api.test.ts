import { describe, expect, it } from 'vitest';
import { backoffDelayMs, chunk, resolveTitle } from './wiki-api.js';

describe('chunk', () => {
  it('splits evenly', () => {
    expect(chunk([1, 2, 3, 4], 2)).toEqual([
      [1, 2],
      [3, 4],
    ]);
  });

  it('keeps a trailing partial chunk', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it('handles empty input', () => {
    expect(chunk([], 10)).toEqual([]);
  });
});

describe('backoffDelayMs', () => {
  it('grows exponentially from 500ms', () => {
    expect(backoffDelayMs(0)).toBe(500);
    expect(backoffDelayMs(1)).toBe(1000);
    expect(backoffDelayMs(2)).toBe(2000);
  });

  it('caps at 30 seconds', () => {
    expect(backoffDelayMs(10)).toBe(30000);
  });
});

describe('resolveTitle', () => {
  it('follows normalization and redirect chains', () => {
    const chains = [
      { from: 'matka king', to: 'Matka King' },
      { from: 'Matka King', to: 'Matka King (TV series)' },
    ];
    expect(resolveTitle('matka king', chains)).toBe('Matka King (TV series)');
    expect(resolveTitle('Untitled page', chains)).toBe('Untitled page');
  });
});
