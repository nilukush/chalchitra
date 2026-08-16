/**
 * Pure merge logic for TMDB enrichment. Wikipedia always wins for text;
 * TMDB fills gaps (episode summaries, backdrops, ratings, trailers).
 */
import type { EpisodeRow } from '../wikitext/episodes.js';

export interface TmdbSearchResult {
  id: number;
  name?: string;
  title?: string;
  release_date?: string;
  first_air_date?: string;
}

export interface TmdbEpisode {
  episode_number: number;
  overview?: string;
}

export function pickTmdbMatch(
  results: TmdbSearchResult[],
  wantedTitle: string,
  year: number,
): TmdbSearchResult | null {
  if (results.length === 0) return null;
  const wanted = wantedTitle.toLowerCase();
  const exact = results.filter((r) => (r.name ?? r.title ?? '').toLowerCase() === wanted);
  const inYear = (list: TmdbSearchResult[]) =>
    list.find((r) => ((r.release_date ?? r.first_air_date ?? '').slice(0, 4)) === String(year));
  return inYear(exact) ?? exact[0] ?? inYear(results) ?? results[0];
}

/** Fill empty episode summaries from a TMDB season payload; wiki text wins. */
export function mergeEpisodeSummaries(
  wikiEpisodes: EpisodeRow[],
  tmdbSeason: { episodes?: TmdbEpisode[] },
): EpisodeRow[] {
  const byNumber = new Map<number, string>();
  for (const ep of tmdbSeason.episodes ?? []) {
    if (ep.overview && ep.overview.trim()) byNumber.set(ep.episode_number, ep.overview.trim());
  }
  let changed = false;
  const merged = wikiEpisodes.map((ep) => {
    const n = Number(ep.number);
    if (ep.summary || !Number.isFinite(n)) return ep;
    const fill = byNumber.get(n);
    if (!fill) return ep;
    changed = true;
    return { ...ep, summary: fill };
  });
  return changed ? merged : wikiEpisodes;
}
