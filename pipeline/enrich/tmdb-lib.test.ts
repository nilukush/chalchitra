import { describe, expect, it } from 'vitest';
import { applyLiteEnrichment, episodesFromTmdbSeason, mergeEpisodeSummaries, needsFreshSearch, pickTmdbMatch, scoreNameOverlap, staleEmptySearch } from './tmdb-lib.js';

describe('scoreNameOverlap', () => {
  const credits = {
    crew: [{ name: 'Geetu Mohandas', job: 'Director' }],
    cast: [{ name: 'Yash' }, { name: 'Kiara Advani' }, { name: 'Someone Else' }],
  };

  it('weights director matches above cast matches', () => {
    expect(scoreNameOverlap(credits, ['Geetu Mohandas'])).toBe(3);
    expect(scoreNameOverlap(credits, ['Yash'])).toBe(1);
    expect(scoreNameOverlap(credits, ['Yash', 'Kiara Advani', 'Geetu Mohandas'])).toBe(5);
  });

  it('normalizes punctuation and case', () => {
    expect(scoreNameOverlap({ cast: [{ name: 'Nagraj Manjule' }] }, ['Nagraj Popatrao Manjule'])).toBe(0);
    expect(scoreNameOverlap({ cast: [{ name: 'Kiara Advani' }] }, ['KIARA advani.'])).toBe(1);
  });

  it('returns 0 without credits or names', () => {
    expect(scoreNameOverlap(undefined, ['Yash'])).toBe(0);
    expect(scoreNameOverlap(credits, [])).toBe(0);
    expect(scoreNameOverlap({ cast: [{ name: 'X' }] }, ['Yash'])).toBe(0);
  });
});

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
      { episode_number: 2, overview: 'tmdb two', runtime: 44 },
      // episode 3 missing on TMDB
      { episode_number: 4, overview: 'tmdb four (extra)' },
    ],
  };

  it('fills only empty summaries — Wikipedia always wins', () => {
    const merged = mergeEpisodeSummaries(wiki, tmdbSeason);
    expect(merged[0].summary).toBe('wiki summary kept');
    expect(merged[1].summary).toBe('tmdb two');
  });

  it('fills episode runtimes when missing', () => {
    const merged = mergeEpisodeSummaries(wiki, tmdbSeason);
    expect(merged[1].runtime).toBe('44 min');
    expect(merged[0].runtime).toBeUndefined();
  });

  it('leaves episodes absent from TMDB untouched', () => {
    const merged = mergeEpisodeSummaries(wiki, tmdbSeason);
    expect(merged[2].summary).toBeUndefined();
    expect(merged).toHaveLength(3);
  });

  it('season-aware: a season-2 payload only touches season-2 rows (ep 1 of S2 ≠ ep 1 of S1)', () => {
    const wiki = [
      { number: '1', title: 'S1 Pilot', summary: undefined },
      { number: '1', title: 'S2 Opener', season: 2, summary: undefined },
    ];
    const season2 = { episodes: [{ episode_number: 1, overview: 'season two opener' }] };
    const merged = mergeEpisodeSummaries(wiki, season2, 2);
    expect(merged[0].summary).toBeUndefined(); // season 1 untouched
    expect(merged[1].summary).toBe('season two opener');
  });

  it('returns the original array when TMDB has no episodes', () => {
    expect(mergeEpisodeSummaries(wiki, { episodes: [] })).toBe(wiki);
  });
});

describe('episodesFromTmdbSeason', () => {
  it('synthesizes a full episode list from TMDB', () => {
    const rows = episodesFromTmdbSeason({
      episodes: [
        { episode_number: 1, name: 'Pilot', overview: 'It begins.', air_date: '2026-01-05', runtime: 41 },
        { episode_number: 2 }, // no name/overview
      ],
    });
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ number: '1', title: 'Pilot', airDate: '2026-01-05', runtime: '41 min', summary: 'It begins.', season: 1 });
    expect(rows[1].title).toBe('Episode 2');
  });

  it('returns [] for an empty season', () => {
    expect(episodesFromTmdbSeason({})).toEqual([]);
  });
});

import { languageBonus, languageIsoFor, pickTmdbTrailer } from './tmdb-lib.js';

describe('pickTmdbTrailer', () => {
  const yt = (key: string, type: string, official = true): { key: string; site: string; type: string; official: boolean } => ({
    key, site: 'YouTube', type, official,
  });

  it('prefers official trailers over everything', () => {
    expect(pickTmdbTrailer([[yt('a', 'Teaser'), yt('b', 'Trailer')]])).toBe('b');
  });

  it('falls back to any trailer/teaser, then any YouTube video', () => {
    expect(pickTmdbTrailer([[yt('t', 'Teaser', false), yt('c', 'Clip')]])).toBe('t');
    expect(pickTmdbTrailer([[yt('c', 'Clip', false), { key: 'v', site: 'Vimeo' }]])).toBe('c');
  });

  it('never picks a non-YouTube site', () => {
    expect(pickTmdbTrailer([[{ key: 'vm', site: 'Vimeo', type: 'Trailer', official: true }]])).toBeUndefined();
  });

  it('merges season-level pools with show-level pools', () => {
    expect(pickTmdbTrailer([[], [yt('se1', 'Trailer', false)]])).toBe('se1');
  });

  it('a full Trailer outranks an official Teaser (Haiwaan pattern: unofficial trailer is the longer video)', () => {
    expect(pickTmdbTrailer([[yt('s', 'Teaser', true), yt('t', 'Trailer', false)]])).toBe('t');
    expect(pickTmdbTrailer([[yt('s1', 'Teaser')], [yt('t1', 'Trailer', false)]])).toBe('t1');
  });

  it('returns undefined for empty pools', () => {
    expect(pickTmdbTrailer([[], []])).toBeUndefined();
  });
});

describe('applyLiteEnrichment (archive pass)', () => {
  const details = {
    backdrop_path: '/b.jpg',
    genres: [{ id: 27, name: 'Thriller' }, { id: 53, name: 'Thriller' }, { id: 80, name: 'Crime' }],
    tagline: 'Love kills.',
    vote_average: 6.4,
    vote_count: 41,
    videos: { results: [{ key: 'tr1', type: 'Trailer', site: 'YouTube', official: true, name: 'Official trailer' }] },
  } as any;

  it('fills empty gaps: backdrop, deduped genres, tagline, rating (≥1 vote), trailer', () => {
    const record = {
      kind: 'movie',
      genres: [],
      backdrop: undefined,
      tagline: undefined,
      rating: undefined,
      trailer: undefined,
      enrichedFrom: [],
    } as any;
    const changed = applyLiteEnrichment(record, details);
    expect(changed).toBe(true);
    expect(record.genres).toEqual(['Thriller', 'Crime']);
    expect(record.backdrop).toContain('/b.jpg');
    expect(record.tagline).toBe('Love kills.');
    expect(record.rating).toEqual({ source: 'tmdb', value: 6.4, votes: 41 });
    expect(record.trailer).toBe('https://www.youtube.com/watch?v=tr1');
    expect(record.enrichedFrom).toContain('tmdb');
  });

  it('never overwrites provided fields when NOT dirty', () => {
    const record = {
      kind: 'movie',
      genres: ['Drama'],
      backdrop: '/wiki.jpg',
      tagline: 'Wiki hook',
      rating: { source: 'tmdb', value: 9.9, votes: 5 },
      trailer: 'https://www.youtube.com/watch?v=wiki',
      enrichedFrom: [],
    } as any;
    const changed = applyLiteEnrichment(record, details);
    expect(changed).toBe(false);
    expect(record.genres).toEqual(['Drama']);
    expect(record.tagline).toBe('Wiki hook');
    expect(record.trailer).toBe('https://www.youtube.com/watch?v=wiki');
    expect(record.enrichedFrom).toEqual([]);
  });

  it('shows ratings from a single vote (vote count is displayed on the page)', () => {
    const record = { kind: 'movie', genres: [], enrichedFrom: [] } as any;
    applyLiteEnrichment(record, { ...details, vote_count: 1, vote_average: 6 } as any);
    expect(record.rating).toEqual({ source: 'tmdb', value: 6, votes: 1 });
  });

  it('DIRTY titles: fresh TMDB payloads overwrite TMDB-native fields (rating drift, new trailer)', () => {
    const record = {
      kind: 'movie',
      genres: ['Drama'], // wiki-supplied — NEVER overwritten
      backdrop: '/old.jpg',
      tagline: 'Old hook',
      rating: { source: 'tmdb', value: 5.0, votes: 2 },
      trailer: 'https://www.youtube.com/watch?v=old',
      enrichedFrom: ['tmdb'],
    } as any;
    applyLiteEnrichment(record, details, true);
    expect(record.rating).toEqual({ source: 'tmdb', value: 6.4, votes: 41 });
    expect(record.trailer).toBe('https://www.youtube.com/watch?v=tr1');
    expect(record.backdrop).toContain('/b.jpg');
    expect(record.genres).toEqual(['Drama']); // wiki field untouched
  });
});

describe('languageIsoFor / languageBonus (TMDB concordance)', () => {
  it('maps Wikipedia language names to TMDB ISO codes, multi-language takes the first', () => {
    expect(languageIsoFor('Tamil')).toBe('ta');
    expect(languageIsoFor('Malayalam')).toBe('ml');
    expect(languageIsoFor('Tamil, Telugu')).toBe('ta');
    expect(languageIsoFor('Korean')).toBeUndefined();
  });

  it('rewards original-language concordance and punishes mismatch', () => {
    expect(languageBonus('ta', 'Tamil')).toBeGreaterThan(0);
    expect(languageBonus('th', 'Tamil')).toBeLessThan(0);
    expect(languageBonus(undefined, 'Tamil')).toBe(0);
  });
});

describe('staleEmptySearch (search-cache TTL)', () => {
  // A cached "no results" is a claim about a moment, not a durable fact —
  // TMDB retitles freeze it into a permanent match loss (Ramayana: Part 1,
  // empty search cached 2026-08-30 while TMDB cycled Part One → Ramayana →
  // Rise of a Legend; live search returned the movie the whole final month)
  it('flags an empty search response older than the TTL', () => {
    expect(staleEmptySearch('/search/movie?query=x', { total_results: 0, results: [] }, 8 * 86_400_000)).toBe(true);
  });

  it('keeps a fresh empty search cached (bounded retry budget)', () => {
    expect(staleEmptySearch('/search/movie?query=x', { total_results: 0, results: [] }, 6 * 86_400_000)).toBe(false);
  });

  it('never expires non-empty search responses (a hit is a stable fact)', () => {
    expect(staleEmptySearch('/search/movie?query=x', { total_results: 1, results: [{ id: 1 }] }, 365 * 86_400_000)).toBe(false);
  });

  it('never expires non-search endpoints (details/seasons age via the change list)', () => {
    expect(staleEmptySearch('/movie/1?language=en-US', { total_results: 0 }, 365 * 86_400_000)).toBe(false);
    expect(staleEmptySearch('/tv/2/season/1?language=en-US', {}, 365 * 86_400_000)).toBe(false);
  });

  it('treats a malformed payload (no counts) as non-expiring', () => {
    expect(staleEmptySearch('/search/person?query=x', undefined, 999 * 86_400_000)).toBe(false);
    expect(staleEmptySearch('/search/movie?query=x', null, 999 * 86_400_000)).toBe(false);
  });

  it('accepts a custom TTL (caller tightens or loosens the window)', () => {
    expect(staleEmptySearch('/search/movie?query=x', { total_results: 0, results: [] }, 2 * 86_400_000, 86_400_000)).toBe(true);
    expect(staleEmptySearch('/search/movie?query=x', { total_results: 0, results: [] }, 2 * 86_400_000, 7 * 86_400_000)).toBe(false);
  });
});

describe('needsFreshSearch (current-year churn zone)', () => {
  const now = new Date('2026-11-18T00:00:00Z');
  it('forces a fresh search for unmatched current-year titles', () => {
    expect(needsFreshSearch({ year: 2026 }, now)).toBe(true);
  });

  it('forces a fresh search for future-year titles too (early next-year pages)', () => {
    expect(needsFreshSearch({ year: 2027 }, now)).toBe(true);
  });

  it('does not force for past years (the archive is a stable not-on-TMDB fact)', () => {
    expect(needsFreshSearch({ year: 2025 }, now)).toBe(false);
  });

  it('does not force once the record carries a tmdbId (change list owns it)', () => {
    expect(needsFreshSearch({ tmdbId: 656908, year: 2026 }, now)).toBe(false);
  });

  it('does not force when the year is missing', () => {
    expect(needsFreshSearch({}, now)).toBe(false);
  });
});
