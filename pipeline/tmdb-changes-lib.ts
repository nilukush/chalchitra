/**
 * Pure planning for the TMDB change-list delta (Step 8b): which of OUR cache
 * entries must be invalidated when TMDB reports a movie/tv id as changed.
 * Deletion/orchestration live in tmdb-changes.ts. URL shapes come from the
 * SHARED builders in enrich/tmdb-lib — never hand-write them here.
 */
import { FALLBACK_LANG_ISO, catalogueDetailsUrl, liteDetailsUrl, seasonDetailsUrl, videosFallbackUrl } from './enrich/tmdb-lib.js';

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
  /** ISO release date (new tracked.json shape; absent in old caches) */
  releaseDate?: string;
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
      // a title may be enriched by the catalogue pass OR the archive lite pass
      // (or the /videos fallback) — invalidate every shape it could occupy
      const urls = [
        catalogueDetailsUrl('movie', title.tmdbId),
        liteDetailsUrl('movie', title.tmdbId),
        ...FALLBACK_LANG_ISO.map((iso) => videosFallbackUrl('movie', title.tmdbId, iso)),
      ];
      plan.push({ kind: 'movie', tmdbId: title.tmdbId, urls });
    } else if (title.kind === 'series' && tv.has(title.tmdbId)) {
      const urls = [
        liteDetailsUrl('tv', title.tmdbId),
        catalogueDetailsUrl('tv', title.tmdbId),
        ...FALLBACK_LANG_ISO.map((iso) => videosFallbackUrl('tv', title.tmdbId, iso)),
      ];
      const claimed = Math.min(Math.max(Number(title.seasons) || 0, 0), MAX_SEASONS);
      for (let season = 1; season <= claimed; season++) {
        urls.push(seasonDetailsUrl(title.tmdbId, season));
      }
      plan.push({ kind: 'tv', tmdbId: title.tmdbId, urls });
    }
  }
  return plan;
}

/** Titles released within `windowDays` of today — their ratings move fastest
 *  (votes accumulate right after release) and the /changes feed is LOSSY for
 *  them (10k/day result cap vs our ~21k tracked ids), so we force-refresh
 *  their TMDB details on every run instead of waiting for a change flag. */
export function planFreshnessRefresh(
  tracked: TrackedTitle[],
  todayIso: string,
  windowDays = 45,
): TmdbInvalidation[] {
  const cutoff = new Date(Date.now() - windowDays * 86_400_000).toISOString().slice(0, 10);
  const plan: TmdbInvalidation[] = [];
  for (const title of tracked) {
    if (!title.tmdbId || !title.releaseDate) continue;
    if (title.releaseDate < cutoff || title.releaseDate > todayIso) continue; // only released, recent
    plan.push({
      kind: title.kind === 'movie' ? 'movie' : 'tv',
      tmdbId: title.tmdbId,
      urls: [
        catalogueDetailsUrl(title.kind === 'movie' ? 'movie' : 'tv', title.tmdbId),
        liteDetailsUrl(title.kind === 'movie' ? 'movie' : 'tv', title.tmdbId),
        ...FALLBACK_LANG_ISO.map((iso) => videosFallbackUrl(title.kind === 'movie' ? 'movie' : 'tv', title.tmdbId, iso)),
      ],
    });
  }
  return plan;
}
