import { describe, expect, it } from 'vitest';
import { buildTrendsPayload, rankByScore, trendScore } from './trends-lib.js';

describe('trendScore', () => {
  it('sums views across the window with recency weighting', () => {
    const days = { '2026-08-10': 100, '2026-08-11': 100, '2026-08-12': 100, '2026-08-13': 100 };
    // last 2 days weighted 1.0, older 0.5 → 100 + 100 + 50 + 50 = 300
    expect(trendScore(days)).toBe(300);
  });

  it('returns 0 for empty data', () => {
    expect(trendScore({})).toBe(0);
    expect(trendScore(undefined as any)).toBe(0);
  });
});

describe('rankByScore', () => {
  it('sorts by score descending and drops zeros', () => {
    const ranked = rankByScore(
      [
        { slug: 'a', score: 10 },
        { slug: 'b', score: 30 },
        { slug: 'c', score: 0 },
        { slug: 'd', score: 20 },
      ],
      2,
    );
    expect(ranked.map((r) => r.slug)).toEqual(['b', 'd']);
  });
});

describe('buildTrendsPayload', () => {
  const movies = [{ slug: 'movie-1', kind: 'movie', wikiTitle: 'Movie 1' }] as any[];
  const series = [{ slug: 'series-1', kind: 'series', wikiTitle: 'Series 1' }] as any[];
  const persons = [{ slug: 'person-1', wikiTitle: 'Person One' }] as any[];
  const views = new Map<string, Record<string, number>>([
    ['Movie 1', { d1: 50, d2: 50 }],
    ['Series 1', { d1: 100, d2: 100 }],
    ['Person One', { d1: 10, d2: 10 }],
  ]);

  it('produces ranked title and person lists with joined slugs', () => {
    const payload = buildTrendsPayload(movies, series, persons, views, 10);
    expect(payload.topTitles[0].slug).toBe('series-1');
    expect(payload.topPersons[0].slug).toBe('person-1');
    expect(payload.scores['movie-1']).toBeGreaterThan(0);
  });

  it('keeps kind on title entries for correct linking', () => {
    const payload = buildTrendsPayload(movies, series, persons, views, 10);
    expect(payload.topTitles.find((t) => t.slug === 'series-1')?.kind).toBe('series');
  });
});
