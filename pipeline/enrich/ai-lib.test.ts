import { describe, expect, it } from 'vitest';
import { parseAiSummary } from './ai-lib.js';

describe('parseAiSummary', () => {
  it('parses a clean JSON response', () => {
    const parsed = parseAiSummary('{"oneLiner":"A gambler rises in 1960s Mumbai.","moods":["Crime","Gritty","Ambition"]}');
    expect(parsed).toEqual({
      oneLiner: 'A gambler rises in 1960s Mumbai.',
      moods: ['Crime', 'Gritty', 'Ambition'],
    });
  });

  it('extracts JSON embedded in prose or code fences', () => {
    const parsed = parseAiSummary('```json\n{"oneLiner":"Hook.","moods":["Drama"]}\n```');
    expect(parsed?.oneLiner).toBe('Hook.');
  });

  it('caps moods at four and drops empties', () => {
    const parsed = parseAiSummary('{"oneLiner":"X","moods":["A","","B","C","D","E"]}');
    expect(parsed?.moods).toEqual(['A', 'B', 'C', 'D']);
  });

  it('returns null when the one-liner is missing or garbage input', () => {
    expect(parseAiSummary('{"moods":["A"]}')).toBeNull();
    expect(parseAiSummary('total garbage')).toBeNull();
    expect(parseAiSummary('')).toBeNull();
  });
});
