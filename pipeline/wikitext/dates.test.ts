import { describe, expect, it } from 'vitest';
import { parseStartDate } from './dates.js';

describe('parseStartDate', () => {
  it('parses {{Start date|2026|04|17}} to ISO date', () => {
    expect(parseStartDate('{{Start date|2026|04|17}}')).toBe('2026-04-17');
  });

  it('parses with df=y in any position', () => {
    expect(parseStartDate('{{Start date|df=y|2026|04|17}}')).toBe('2026-04-17');
    expect(parseStartDate('{{Start date|2026|4|17|df=y}}')).toBe('2026-04-17');
  });

  it('parses {{Film date|…}} used by film infoboxes', () => {
    expect(parseStartDate('{{Film date|2025|12|5|df=y}}')).toBe('2025-12-05');
  });

  it('handles month precision', () => {
    expect(parseStartDate('{{Start date|2026|04}}')).toBe('2026-04');
  });

  it('handles year precision', () => {
    expect(parseStartDate('{{Start date|2026}}')).toBe('2026');
  });

  it('pads single-digit months and days', () => {
    expect(parseStartDate('{{Film date|2026|3|7}}')).toBe('2026-03-07');
  });

  it('returns null for non-date or malformed input', () => {
    expect(parseStartDate('present')).toBeNull();
    expect(parseStartDate('{{Start date|2026|13|45}}')).toBeNull();
    expect(parseStartDate('')).toBeNull();
  });

  it('extracts a date embedded in a longer field value', () => {
    expect(parseStartDate('{{Start date|2026|04|17}} (India)')).toBe('2026-04-17');
  });
});
