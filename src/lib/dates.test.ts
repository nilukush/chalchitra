import { describe, expect, it } from 'vitest';
import { computeAgeFromFacts, extractTimelineDates } from './dates.js';

describe('extractTimelineDates', () => {
  it('collects full and month-year dates in order of appearance', () => {
    const dates = extractTimelineDates(
      'In April 2023 it was reported. Filming began 5 March 2024 and ended in April 2024.',
    );
    expect(dates).toEqual(['April 2023', '5 March 2024', 'April 2024']);
  });

  it('deduplicates and caps at the limit', () => {
    const dates = extractTimelineDates('May 2021 May 2021 June 2021 July 2021 August 2021 September 2021 October 2021', 4);
    expect(dates).toEqual(['May 2021', 'June 2021', 'July 2021', 'August 2021']);
  });

  it('returns [] when no dates exist', () => {
    expect(extractTimelineDates('No dates here.')).toEqual([]);
  });
});

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
