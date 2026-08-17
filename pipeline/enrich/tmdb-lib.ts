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
  name?: string;
  overview?: string;
  air_date?: string;
  runtime?: number;
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

export interface TmdbCredits {
  crew?: { name?: string; job?: string }[];
  cast?: { name?: string }[];
}

const normalizeName = (n: string) => n.toLowerCase().replace(/[^a-z]/g, '');

/** How strongly a TMDB candidate's credits match our Wikipedia names.
 *  Directors count 3 (strong signal), cast 1 each. 0 = no evidence. */
export function scoreNameOverlap(credits: TmdbCredits | undefined, wikiNames: string[]): number {
  if (!credits || wikiNames.length === 0) return 0;
  const wiki = new Set(wikiNames.map(normalizeName).filter((n) => n.length > 0));
  if (wiki.size === 0) return 0;
  let score = 0;
  for (const member of credits.crew ?? []) {
    if (member.name && member.job !== undefined && /director/i.test(member.job ?? '') && wiki.has(normalizeName(member.name))) score += 3;
  }
  for (const member of credits.cast ?? []) {
    if (member.name && wiki.has(normalizeName(member.name))) score += 1;
  }
  return score;
}

/** Build an episode list purely from a TMDB season payload (for series whose
 *  Wikipedia article has no episode table). */
export function episodesFromTmdbSeason(
  season: { episodes?: TmdbEpisode[] },
  seasonNumber = 1,
): EpisodeRow[] {
  return (season.episodes ?? [])
    .filter((ep) => ep.episode_number > 0)
    .map((ep) => ({
      number: String(ep.episode_number),
      title: (ep.name ?? '').trim() || `Episode ${ep.episode_number}`,
      airDate: ep.air_date || undefined,
      runtime: ep.runtime ? `${ep.runtime} min` : undefined,
      summary: ep.overview?.trim() || undefined,
      season: seasonNumber,
    }));
}

/** Fill empty episode summaries AND runtimes from a TMDB season; wiki wins. */
export function mergeEpisodeSummaries(
  wikiEpisodes: EpisodeRow[],
  tmdbSeason: { episodes?: TmdbEpisode[] },
): EpisodeRow[] {
  const byNumber = new Map<number, TmdbEpisode>();
  for (const ep of tmdbSeason.episodes ?? []) {
    if (ep.episode_number > 0) byNumber.set(ep.episode_number, ep);
  }
  let changed = false;
  const merged = wikiEpisodes.map((ep) => {
    const n = Number(ep.number);
    if (!Number.isFinite(n)) return ep;
    const tmdb = byNumber.get(n);
    let next = ep;
    if (!ep.summary && tmdb?.overview?.trim()) {
      next = { ...next, summary: tmdb.overview.trim() };
      changed = true;
    }
    if (!ep.runtime && tmdb?.runtime) {
      next = { ...next, runtime: `${tmdb.runtime} min` };
      changed = true;
    }
    return next;
  });
  return changed ? merged : wikiEpisodes;
}
