import { describe, expect, it } from 'vitest';
import { computeAgeFromFacts } from './dates.js';

describe('computeAgeFromFacts', () => {
  it('computes current age from a Born fact', () => {
    const now = new Date('2026-08-17T00:00:00Z');
    expect(computeAgeFromFacts([{ label: 'Born', value: '5 March 1990' }], now)).toBe(36);
    expect(computeAgeFromFacts([{ label: 'Born', value: '31 December 1990' }], now)).toBe(35);
  });

  it('computes age at death when a Died fact exists', () => {
    const facts = [
      { label: 'Born', value: '2 March 1941' },
      { label: 'Died', value: '9 May 1969' },
    ];
    expect(computeAgeFromFacts(facts)).toBe(28);
  });

  it('returns null without a Born fact or with unparseable dates', () => {
    expect(computeAgeFromFacts([{ label: 'Occupation', value: 'Actor' }])).toBeNull();
    expect(computeAgeFromFacts([{ label: 'Born', value: 'date unknown' }])).toBeNull();
    expect(computeAgeFromFacts([])).toBeNull();
  });
});
