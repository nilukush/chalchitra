import { describe, expect, it } from 'vitest';
import { planFreshnessRefresh, planTmdbRefresh } from './tmdb-changes-lib.js';

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

describe('planFreshnessRefresh (recent-release force refresh)', () => {
  const today = '2026-09-03';
  const tracked = [
    { tmdbId: 1, kind: 'movie' as const, releaseDate: '2026-08-28' },  // 6 days old → in
    { tmdbId: 2, kind: 'movie' as const, releaseDate: '2026-01-15' },  // months old → out
    { tmdbId: 3, kind: 'series' as const, releaseDate: '2026-10-01' }, // future → out
    { tmdbId: 4, kind: 'movie' as const },                             // no date → out
  ];

  it('flags released titles within the 45-day window with every cache shape', () => {
    const plan = planFreshnessRefresh(tracked, today);
    expect(plan.map((p) => p.tmdbId)).toEqual([1]);
    expect(plan[0].urls.some((u) => u.startsWith('/movie/1?language=en-US&append_to_response=videos&'))).toBe(true);
    expect(plan[0].urls.some((u) => u.startsWith('/movie/1/videos?language=en-US&include_video_language='))).toBe(true);
  });

  it('includes a 20-day-old release but not a 55-day-old one (45-day cutoff)', () => {
    const plan = planFreshnessRefresh(
      [
        { tmdbId: 10, kind: 'movie' as const, releaseDate: '2026-07-10' },
        { tmdbId: 11, kind: 'movie' as const, releaseDate: '2026-08-14' },
      ],
      today,
    );
    expect(plan.map((p) => p.tmdbId)).toEqual([11]);
  });
});
