import { describe, expect, it } from 'vitest';
import { planTmdbRefresh } from './tmdb-changes-lib.js';

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
    expect(plan[0].urls).toContain('/movie/111?language=en-US&append_to_response=videos');
  });

  it('invalidates details + every claimed season URL for changed series', () => {
    const plan = planTmdbRefresh([], [222, 333], ourTitles);
    const tv222 = plan.find((p) => p.tmdbId === 222)!;
    expect(tv222.urls).toContain('/tv/222?language=en-US&append_to_response=credits,videos');
    expect(tv222.urls).toContain('/tv/222/season/1?language=en-US');
    expect(tv222.urls).toContain('/tv/222/season/3?language=en-US');
    expect(tv222.urls).toHaveLength(4);
    const tv333 = plan.find((p) => p.tmdbId === 333)!;
    expect(tv333.urls).toEqual(['/tv/333?language=en-US&append_to_response=credits,videos']);
  });

  it('ignores TMDB ids we do not track', () => {
    const plan = planTmdbRefresh([999], [888], ourTitles);
    expect(plan).toHaveLength(0);
  });
});
