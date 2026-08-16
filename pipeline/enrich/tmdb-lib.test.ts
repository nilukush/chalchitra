import { describe, expect, it } from 'vitest';
import { mergeEpisodeSummaries, pickTmdbMatch } from './tmdb-lib.js';

describe('pickTmdbMatch', () => {
  it('prefers an exact-name match with the right year', () => {
    const results = [
      { id: 1, name: 'Matka', release_date: '2026-01-01' },
      { id: 2, name: 'Matka King', release_date: '2026-04-17' },
      { id: 3, name: 'Matka King', release_date: '2020-01-01' },
    ];
    expect(pickTmdbMatch(results, 'Matka King', 2026)?.id).toBe(2);
  });

  it('falls back to the closest name when no year matches', () => {
    const results = [
      { id: 5, name: 'Matka King II', release_date: '2027-01-01' },
      { id: 6, name: 'Matka King', release_date: '2027-06-01' },
    ];
    expect(pickTmdbMatch(results, 'Matka King', 2026)?.id).toBe(6);
  });

  it('returns null on empty results', () => {
    expect(pickTmdbMatch([], 'X', 2026)).toBeNull();
  });
});

describe('mergeEpisodeSummaries', () => {
  const wiki = [
    { number: '1', title: 'Taqdeer', summary: 'wiki summary kept' },
    { number: '2', title: 'Umeed', summary: undefined },
    { number: '3', title: 'Izzat', summary: undefined },
  ];
  const tmdbSeason = {
    episodes: [
      { episode_number: 1, overview: 'tmdb one' },
      { episode_number: 2, overview: 'tmdb two' },
      // episode 3 missing on TMDB
      { episode_number: 4, overview: 'tmdb four (extra)' },
    ],
  };

  it('fills only empty summaries — Wikipedia always wins', () => {
    const merged = mergeEpisodeSummaries(wiki, tmdbSeason);
    expect(merged[0].summary).toBe('wiki summary kept');
    expect(merged[1].summary).toBe('tmdb two');
  });

  it('leaves episodes absent from TMDB untouched', () => {
    const merged = mergeEpisodeSummaries(wiki, tmdbSeason);
    expect(merged[2].summary).toBeUndefined();
    expect(merged).toHaveLength(3);
  });

  it('returns the original array when TMDB has no episodes', () => {
    expect(mergeEpisodeSummaries(wiki, { episodes: [] })).toBe(wiki);
  });
});
