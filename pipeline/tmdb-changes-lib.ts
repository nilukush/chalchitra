/**
 * Pure planning for the TMDB change-list delta (Step 8b): which of OUR cache
 * entries must be invalidated when TMDB reports a movie/tv id as changed.
 * Deletion/orchestration live in tmdb-changes.ts.
 */

export interface TmdbInvalidation {
  kind: 'movie' | 'tv';
  tmdbId: number;
  /** URL path+query strings whose sha1-keyed cache entries to delete */
  urls: string[];
}

export interface TrackedTitle {
  tmdbId?: number;
  kind: 'movie' | 'series';
  seasons?: string;
}

const MAX_SEASONS = 50; // same safety ceiling as episode synthesis

export function planTmdbRefresh(
  changedMovieIds: number[],
  changedTvIds: number[],
  ourTitles: TrackedTitle[],
): TmdbInvalidation[] {
  const movies = new Set(changedMovieIds);
  const tv = new Set(changedTvIds);
  const plan: TmdbInvalidation[] = [];

  for (const title of ourTitles) {
    if (!title.tmdbId) continue;
    if (title.kind === 'movie' && movies.has(title.tmdbId)) {
      plan.push({
        kind: 'movie',
        tmdbId: title.tmdbId,
        urls: [`/movie/${title.tmdbId}?language=en-US&append_to_response=videos`],
      });
    } else if (title.kind === 'series' && tv.has(title.tmdbId)) {
      const urls = [`/tv/${title.tmdbId}?language=en-US&append_to_response=credits,videos`];
      const claimed = Math.min(Math.max(Number(title.seasons) || 0, 0), MAX_SEASONS);
      for (let season = 1; season <= claimed; season++) {
        urls.push(`/tv/${title.tmdbId}/season/${season}?language=en-US`);
      }
      plan.push({ kind: 'tv', tmdbId: title.tmdbId, urls });
    }
  }
  return plan;
}
