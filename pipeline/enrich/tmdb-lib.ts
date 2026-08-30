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
  still_path?: string;
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
  imageUrl = 'https://image.tmdb.org/t/p',
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
      still: ep.still_path ? `${imageUrl}/w300${ep.still_path}` : undefined,
    }));
}
/** Fill empty episode summaries AND runtimes from a TMDB season; wiki wins.
 *  `seasonNumber` scopes the payload to the wiki rows of that season — TMDB
 *  episode numbers restart at 1 per season, so a season-2 "episode 1" must
 *  never collide with season 1's. */
export function mergeEpisodeSummaries(
  wikiEpisodes: EpisodeRow[],
  tmdbSeason: { episodes?: TmdbEpisode[] },
  seasonNumber = 1,
): EpisodeRow[] {
  const byNumber = new Map<number, TmdbEpisode>();
  for (const ep of tmdbSeason.episodes ?? []) {
    if (ep.episode_number > 0) byNumber.set(ep.episode_number, ep);
  }
  let changed = false;
  const merged = wikiEpisodes.map((ep) => {
    if ((ep.season ?? 1) !== seasonNumber) return ep;
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

export interface TmdbVideo {
  key: string;
  site?: string;
  type?: string;
  official?: boolean;
}

/**
 * Pick the best on-site-playable trailer from TMDB video pools (show level
 * plus season level for TV). Tiered so YouTube-only sources always win:
 * official Trailer → official Teaser → any Trailer/Teaser → any YouTube.
 * Never returns a non-YouTube entry — our player embeds youtube-nocookie.
 */
export function pickTmdbTrailer(pools: TmdbVideo[][]): string | undefined {
  const videos = pools.flat().filter((v) => v?.site === 'YouTube' && v.key);
  // TYPE outranks the official flag: a full Trailer with official=false (very
  // common for Indian titles — Haiwaan) is the better, longer video than an
  // official Teaser.
  const tiers: Array<(v: TmdbVideo) => boolean> = [
    (v) => v.type === 'Trailer' && v.official === true,
    (v) => v.type === 'Trailer',
    (v) => v.type === 'Teaser' && v.official === true,
    (v) => v.type === 'Teaser',
    () => true,
  ];
  for (const tier of tiers) {
    const hit = videos.find(tier);
    if (hit) return hit.key;
  }
  return undefined;
}


/** Wikipedia language name → TMDB original_language ISO code. Used to keep a
 *  short/generic Indian title ("Om") from matching a same-year foreign film
 *  (a Thai "OM" beat the Tamil original before this existed). */
const LANGUAGE_TO_ISO: Record<string, string> = {
  hindi: 'hi', urdu: 'ur', punjabi: 'pa', bengali: 'bn', marathi: 'mr',
  gujarati: 'gu', odia: 'or', assamese: 'as', tamil: 'ta', telugu: 'te',
  kannada: 'kn', malayalam: 'ml', tulu: 'tcy', konkani: 'kok', sanskrit: 'sa',
  maithili: 'mai', santali: 'sat', nepali: 'ne', sindhi: 'sd', dogri: 'doi',
  bhojpuri: 'bho', rajasthani: 'raj', chhattisgarhi: 'hne',
};

export function languageIsoFor(language: string | undefined): string | undefined {
  if (!language) return undefined;
  const first = language.split(/[,\/]/)[0]?.trim().toLowerCase();
  return first ? LANGUAGE_TO_ISO[first] : undefined;
}

/** Scoring bonus for a TMDB candidate's original_language vs the Wikipedia
 *  record's language: concordant +3, discordant −3, unknown 0. */
export function languageBonus(originalLanguage: string | undefined, recordLanguage: string | undefined): number {
  const iso = languageIsoFor(recordLanguage);
  if (!originalLanguage || !iso) return 0;
  return originalLanguage === iso ? 3 : -3;
}

export interface TmdbDetailsLite {
  backdrop_path?: string | null;
  genres?: { name?: string }[];
  tagline?: string;
  vote_average?: number;
  vote_count?: number;
  videos?: { results?: TmdbVideo[] };
}

/** Enrichable TitleRecord subset (structural — avoids importing the whole record type). */
export interface LiteRecord {
  genres: string[];
  backdrop?: string;
  tagline?: string;
  rating?: { source: string; value: number; votes: number };
  trailer?: string;
  enrichedFrom?: string[];
}

/**
 * Archive-lite field merge: fills ONLY empty gaps from one TMDB details
 * payload (search-validated). Same gap-only discipline as the catalogue
 * pass, minus episode work — record size and call budget stay small.
 * Returns whether anything changed (drives `enrichedFrom` attribution).
 */
export function applyLiteEnrichment(record: LiteRecord, details: TmdbDetailsLite, dirty = false): boolean {
  const sources = new Set(record.enrichedFrom ?? []);
  let changed = false;
  // fresh TMDB payloads may OVERWRITE these TMDB-native fields when the
  // change-list delta marked the title dirty; Wikipedia never supplies them
  const canSet = (isEmpty: boolean) => isEmpty || dirty;

  if (canSet(!record.backdrop) && details.backdrop_path) {
    record.backdrop = `https://image.tmdb.org/t/p/w780${details.backdrop_path}`;
    changed = true;
  }
  if (record.genres.length === 0 && Array.isArray(details.genres)) {
    const names = [...new Set(details.genres.map((g) => (g.name ?? '').trim()).filter(Boolean))].slice(0, 4);
    if (names.length > 0) {
      record.genres = names;
      changed = true;
    }
  }
  if (canSet(!record.tagline) && typeof details.tagline === 'string' && details.tagline.trim()) {
    record.tagline = details.tagline.trim();
    changed = true;
  }
  const votes = details.vote_count ?? 0;
  if (canSet(!record.rating) && typeof details.vote_average === 'number' && votes >= 1) {
    record.rating = { source: 'tmdb', value: details.vote_average, votes };
    changed = true;
  }
  if (canSet(!record.trailer)) {
    const key = pickTmdbTrailer([(details.videos?.results ?? []) as TmdbVideo[]]);
    if (key) {
      record.trailer = `https://www.youtube.com/watch?v=${key}`;
      changed = true;
    }
  }

  if (changed) {
    sources.add('tmdb');
    record.enrichedFrom = [...sources];
  }
  return changed;
}
