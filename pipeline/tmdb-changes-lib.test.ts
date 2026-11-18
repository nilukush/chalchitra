import { describe, expect, it } from 'vitest';
import { planFreshnessRefresh, planOrphanSweep, planTmdbRefresh } from './tmdb-changes-lib.js';

describe('planTmdbRefresh', () => {
  const ourTitles = [
    { tmdbId: 111, kind: 'movie' as const, seasons: undefined },
    { tmdbId: 222, kind: 'series' as const, seasons: '3' },
    { tmdbId: 333, kind: 'series' as const, seasons: undefined }, // changed but no seasons claim
    { kind: 'movie' as const, seasons: undefined }, // no tmdbId — never matches
  ];

  it('invalidates the details URL for changed movies we track', () => {
    const plan = planTmdbRefresh([111, 999], [], ourTitles);
    expect(plan).toHaveLength(1);
    expect(plan[0]).toMatchObject({ kind: 'movie', tmdbId: 111 });
    expect(plan[0].urls).toContain('/movie/111?language=en-US&append_to_response=videos&include_video_language=en,null,hi,ta,te,ml,kn,bn,mr,pa,ur');
    expect(plan[0].urls).toContain('/movie/111?language=en-US&append_to_response=credits,videos&include_video_language=en,null,hi,ta,te,ml,kn,bn,mr,pa,ur');
  });

  it('invalidates details + every claimed season URL for changed series', () => {
    const plan = planTmdbRefresh([], [222, 333], ourTitles);
    const tv222 = plan.find((p) => p.tmdbId === 222)!;
    expect(tv222.urls).toContain('/tv/222?language=en-US&append_to_response=credits,videos&include_video_language=en,null,hi,ta,te,ml,kn,bn,mr,pa,ur');
    expect(tv222.urls).toContain('/tv/222?language=en-US&append_to_response=videos&include_video_language=en,null,hi,ta,te,ml,kn,bn,mr,pa,ur');
    expect(tv222.urls).toContain('/tv/222/season/1?language=en-US');
    expect(tv222.urls).toContain('/tv/222/season/3?language=en-US');
    expect(tv222.urls.some((u) => u === '/tv/222/videos?language=en-US&include_video_language=en,null,ta')).toBe(true);
    const tv333 = plan.find((p) => p.tmdbId === 333)!;
    expect(tv333.urls).toContain('/tv/333?language=en-US&append_to_response=credits,videos&include_video_language=en,null,hi,ta,te,ml,kn,bn,mr,pa,ur');
  });

  it('ignores TMDB ids we do not track', () => {
    const plan = planTmdbRefresh([999], [888], ourTitles);
    expect(plan).toHaveLength(0);
  });
});

describe('planFreshnessRefresh (recent + upcoming force refresh)', () => {
  // date-RELATIVE fixtures: frozen 2026-09 dates rotted once the calendar
  // moved past their 45-day window — derive everything from todayIso
  const today = new Date().toISOString().slice(0, 10);
  const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
  const daysAhead = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
  const tracked = [
    { tmdbId: 1, kind: 'movie' as const, releaseDate: daysAgo(6) },    // 6 days old → in
    { tmdbId: 2, kind: 'movie' as const, releaseDate: daysAgo(120) },  // months old → out
    { tmdbId: 3, kind: 'series' as const, releaseDate: daysAhead(7) }, // upcoming → in (pre-release churn zone: trailers/retitles land before release — the Ramayana window)
    { tmdbId: 4, kind: 'movie' as const },                             // no date → out
  ];

  it('flags released titles within the 45-day window with every cache shape', () => {
    const plan = planFreshnessRefresh(tracked, today);
    expect(plan.map((p) => p.tmdbId)).toEqual([1, 3]);
    expect(plan[0].urls.some((u) => u.startsWith('/movie/1?language=en-US&append_to_response=videos&'))).toBe(true);
    expect(plan[0].urls.some((u) => u.startsWith('/movie/1/videos?language=en-US&include_video_language='))).toBe(true);
  });

  it('includes a 20-day-old release but not a 55-day-old one (45-day cutoff)', () => {
    const plan = planFreshnessRefresh(
      [
        { tmdbId: 10, kind: 'movie' as const, releaseDate: daysAgo(55) },
        { tmdbId: 11, kind: 'movie' as const, releaseDate: daysAgo(20) },
      ],
      today,
    );
    expect(plan.map((p) => p.tmdbId)).toEqual([11]);
  });

  it('includes an upcoming title (pre-release details churn daily) but caps absurd far-future dates', () => {
    const plan = planFreshnessRefresh(
      [
        { tmdbId: 20, kind: 'movie' as const, releaseDate: daysAhead(30) },
        { tmdbId: 21, kind: 'movie' as const, releaseDate: daysAhead(600) }, // > 18-month forward cap (data-error guard)
      ],
      today,
    );
    expect(plan.map((p) => p.tmdbId)).toEqual([20]);
  });
});

describe('planOrphanSweep (changed ids we no longer track)', () => {
  // A retitle can cost us the match: the search misses, the id drops out of
  // tmdb-tracked.json, and its stale details cache survives every future
  // invalidation because none of the planners can see it (Ramayana: Part 1
  // kept an Aug-29 pre-release payload with 0 votes for three months)
  it('invalidates every cache shape for changed ids even when untracked', () => {
    const plan = planOrphanSweep([656908], []);
    expect(plan).toHaveLength(1);
    expect(plan[0]).toMatchObject({ kind: 'movie', tmdbId: 656908 });
    expect(plan[0].urls.some((u) => u.startsWith('/movie/656908?language=en-US&append_to_response=videos&'))).toBe(true);
    expect(plan[0].urls.some((u) => u.startsWith('/movie/656908?language=en-US&append_to_response=credits,videos&'))).toBe(true);
    expect(plan[0].urls.some((u) => u.startsWith('/movie/656908/videos?language=en-US&include_video_language='))).toBe(true);
  });

  it('skips ids another plan already covers (no duplicate deletions)', () => {
    const plan = planOrphanSweep([111, 999], [], new Set([111]));
    expect(plan.map((p) => p.tmdbId)).toEqual([999]);
  });

  it('emits tv shapes without season URLs (an orphan claims no seasons)', () => {
    const plan = planOrphanSweep([], [777]);
    expect(plan).toHaveLength(1);
    expect(plan[0]).toMatchObject({ kind: 'tv', tmdbId: 777 });
    expect(plan[0].urls.some((u) => u.startsWith('/tv/777?'))).toBe(true);
    expect(plan[0].urls.some((u) => u.includes('/season/'))).toBe(false);
  });

  it('returns an empty plan when nothing changed', () => {
    expect(planOrphanSweep([], [])).toEqual([]);
  });
});
