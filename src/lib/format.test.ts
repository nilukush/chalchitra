import { describe, expect, it } from 'vitest';
import { formatRuntime, splitLongParagraphs } from './format.js';

describe('splitLongParagraphs', () => {
  it('keeps short paragraphs intact', () => {
    expect(splitLongParagraphs('One sentence. Two sentences.')).toEqual(['One sentence. Two sentences.']);
  });

  it('splits walls of text into 3-sentence chunks', () => {
    const text = 'A one. B two. C three. D four. E five. F six. G seven.';
    expect(splitLongParagraphs(text)).toEqual([
      'A one. B two. C three.',
      'D four. E five. F six.',
      'G seven.',
    ]);
  });

  it('does not split after abbreviations followed by lowercase', () => {
    const text = 'He met A.R. Rahman and left. Then he went home. Then he slept. Then he woke.';
    const chunks = splitLongParagraphs(text);
    expect(chunks[0]).toContain('A.R. Rahman');
  });

  it('handles empty input', () => {
    expect(splitLongParagraphs('')).toEqual([]);
  });
});

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
