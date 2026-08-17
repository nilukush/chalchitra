/**
 * TMDB enrichment connector — activates only when TMDB_API_KEY is set.
 * Adds: episode summaries (season endpoint), backdrops, community ratings,
 * official trailers. Wikipedia remains canonical for text; TMDB fills gaps.
 * Responses cached in data/cache/tmdb/.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import type { TitleRecord } from '../types.js';
import { episodesFromTmdbSeason, mergeEpisodeSummaries, pickTmdbMatch, scoreNameOverlap, type TmdbCredits, type TmdbSearchResult } from './tmdb-lib.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const CACHE_DIR = path.join(ROOT, 'data', 'cache', 'tmdb');
const API = 'https://api.themoviedb.org/3';
const IMG = 'https://image.tmdb.org/t/p';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function tmdbGet(pathAndQuery: string, apiKey: string): Promise<any | null> {
  const cacheFile = path.join(CACHE_DIR, `${createHash('sha1').update(pathAndQuery).digest('hex').slice(0, 20)}.json`);
  if (existsSync(cacheFile)) {
    try {
      return JSON.parse(readFileSync(cacheFile, 'utf8'));
    } catch {
      /* refetch */
    }
  }
  const url = `${API}${pathAndQuery}${pathAndQuery.includes('?') ? '&' : '?'}api_key=${apiKey}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await sleep(1000 * 2 ** attempt);
    try {
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (res.status === 404) return null;
      if (res.status === 429 || res.status >= 500) continue;
      if (!res.ok) throw new Error(`TMDB HTTP ${res.status}`);
      const json = await res.json();
      mkdirSync(CACHE_DIR, { recursive: true });
      writeFileSync(cacheFile, JSON.stringify(json));
      await sleep(120);
      return json;
    } catch {
      /* retry */
    }
  }
  return null;
}

export function tmdbEnabled(): boolean {
  return Boolean(process.env.TMDB_API_KEY);
}

/**
 * Enrich title records in place. Returns stats. No-op without TMDB_API_KEY.
 */
export async function enrichTitles(titles: TitleRecord[]): Promise<{ matched: number; episodesFilled: number; episodesSynthesized: number; backdrops: number }> {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) {
    console.log('→ TMDB enrichment: TMDB_API_KEY not set — skipping (set it to enable episode summaries, backdrops, ratings, trailers)');
    return { matched: 0, episodesFilled: 0, episodesSynthesized: 0, backdrops: 0 };
  }

  let matched = 0;
  let episodesFilled = 0;
  let episodesSynthesized = 0;
  let backdrops = 0;

  for (const record of titles) {
    const kind = record.kind === 'movie' ? 'movie' : 'tv';
    // year filter is what prevents "Toxic" (Kannada 2026) matching some other "Toxic"
    const yearParam = kind === 'movie' ? `&year=${record.year}` : `&first_air_date_year=${record.year}`;
    const search = await tmdbGet(
      `/search/${kind}?query=${encodeURIComponent(record.title)}&include_adult=false${yearParam}`,
      apiKey,
    );

    // validate candidates against our Wikipedia names (directors + cast) so a
    // same-year namesake ("A Toxic Love Story" vs "Toxic: A Fairy Tale…") can't win
    const wikiNames = [...record.directedBy, ...record.createdBy, ...record.cast.slice(0, 6).map((c) => c.name)];
    let hit: TmdbSearchResult | null = null;
    let bestScore = -1;
    for (const candidate of ((search?.results ?? []) as TmdbSearchResult[]).slice(0, 3)) {
      const det = await tmdbGet(`/${kind}/${candidate.id}?append_to_response=credits`, apiKey);
      const credits: TmdbCredits | undefined = det?.credits ?? (det ? { crew: det.crew, cast: det.cast } : undefined);
      const score = scoreNameOverlap(credits, wikiNames);
      if (score > bestScore) {
        bestScore = score;
        hit = candidate;
      }
      if (score >= 3) break; // a director match is decisive
    }
    if (!hit || bestScore <= 0) {
      // no cast/crew evidence — fall back to the plain title+year pick
      hit = pickTmdbMatch((search?.results ?? []) as TmdbSearchResult[], record.title, record.year);
    }
    if (!hit?.id) continue;
    matched++;
    record.tmdbId = hit.id;

    const sources: string[] = record.enrichedFrom ?? [];

    const details = await tmdbGet(`/${kind}/${hit.id}?language=en-US&append_to_response=videos`, apiKey);
    if (!details) continue;

    if (!record.backdrop && details.backdrop_path) {
      record.backdrop = `${IMG}/w780${details.backdrop_path}`;
      backdrops++;
      if (!sources.includes('tmdb')) sources.push('tmdb');
    }
    // Wikipedia film infoboxes carry no genre field — TMDB supplies the "type"
    if (record.genres.length === 0 && Array.isArray(details.genres) && details.genres.length > 0) {
      record.genres = details.genres.map((g: any) => g.name).filter(Boolean).slice(0, 4);
      if (!sources.includes('tmdb')) sources.push('tmdb');
    }
    if (!record.tagline && typeof details.tagline === 'string' && details.tagline.trim()) {
      record.tagline = details.tagline.trim();
      if (!sources.includes('tmdb')) sources.push('tmdb');
    }
    const votes = details.vote_count ?? 0;
    if (!record.rating && typeof details.vote_average === 'number' && votes >= 3) {
      record.rating = { source: 'tmdb', value: details.vote_average, votes };
      if (!sources.includes('tmdb')) sources.push('tmdb');
    }
    const trailerKey = (details.videos?.results ?? []).find(
      (v: any) => v.site === 'YouTube' && v.type === 'Trailer' && v.official,
    ) ?? (details.videos?.results ?? [])[0];
    if (!record.trailer && trailerKey?.key) {
      record.trailer = `https://www.youtube.com/watch?v=${trailerKey.key}`;
      if (!sources.includes('tmdb')) sources.push('tmdb');
    }

    // episode summaries/runtimes for series with a wiki table
    if (record.kind === 'series' && record.episodesList.some((e) => !e.summary || !e.runtime)) {
      const payload = await tmdbGet(`/tv/${hit.id}/season/1?language=en-US`, apiKey);
      if (payload?.episodes) {
        const before = record.episodesList.filter((e) => e.summary).length;
        record.episodesList = mergeEpisodeSummaries(record.episodesList, payload);
        const after = record.episodesList.filter((e) => e.summary).length;
        if (after > before) episodesFilled += after - before;
        if (!record.enrichedFrom?.includes('tmdb') && after > before) {
          record.enrichedFrom = [...(record.enrichedFrom ?? []), 'tmdb'];
        }
      }
    }

    // series with NO wiki episode table → synthesize the guide from TMDB
    // (every season the record claims, with a safety ceiling against bad data)
    if (record.kind === 'series' && record.episodesList.length === 0) {
      const maxSeasons = Math.min(Math.max(Number(record.seasons) || 1, 1), 50);
      const all: ReturnType<typeof episodesFromTmdbSeason> = [];
      for (let season = 1; season <= maxSeasons; season++) {
        const payload = await tmdbGet(`/tv/${hit.id}/season/${season}?language=en-US`, apiKey);
        const rows = payload ? episodesFromTmdbSeason(payload, season) : [];
        if (rows.length === 0) break;
        all.push(...rows);
      }
      if (all.length > 0) {
        record.episodesList = all;
        episodesSynthesized += all.length;
        record.enrichedFrom = [...new Set([...(record.enrichedFrom ?? []), 'tmdb'])];
      }
    }

    if (sources.length > 0) record.enrichedFrom = sources;
  }

  console.log(`→ TMDB enrichment: ${matched}/${titles.length} matched, ${episodesFilled} episode summaries filled, ${episodesSynthesized} episodes synthesized for table-less series, ${backdrops} backdrops`);
  return { matched, episodesFilled, episodesSynthesized, backdrops };
}

/** Person enrichment: TMDB profile (portrait fallback, known-for works, id).
 *  Exact-name matching only — precision over recall. */
export async function enrichPersons(
  persons: { slug: string; name: string; image?: string; knownFor?: unknown[]; tmdbId?: number; enrichedFrom?: string[] }[],
): Promise<{ matched: number; knownForWorks: number; portraits: number }> {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) return { matched: 0, knownForWorks: 0, portraits: 0 };

  let matched = 0;
  let knownForWorks = 0;
  let portraits = 0;

  for (const person of persons) {
    const search = await tmdbGet(`/search/person?query=${encodeURIComponent(person.name)}&include_adult=false`, apiKey);
    const hit = (search?.results ?? []).find(
      (r: any) => (r.name ?? '').toLowerCase().trim() === person.name.toLowerCase().trim(),
    );
    if (!hit?.id) continue;
    matched++;
    person.tmdbId = hit.id;
    const sources = new Set(person.enrichedFrom ?? []);

    const works = (hit.known_for ?? []) as any[];
    person.knownFor = works
      .filter((w) => w.media_type === 'movie' || w.media_type === 'tv')
      .slice(0, 8)
      .map((w) => ({
        title: (w.title ?? w.name ?? '').trim(),
        year: (w.release_date ?? w.first_air_date ?? '').slice(0, 4) || undefined,
        kind: (w.media_type === 'tv' ? 'series' : 'movie') as 'movie' | 'series',
        poster: w.poster_path ? `${IMG}/w185${w.poster_path}` : undefined,
        url: `https://www.themoviedb.org/${w.media_type}/${w.id}`,
      }))
      .filter((w) => w.title.length > 0);
    if (person.knownFor.length > 0) {
      knownForWorks += person.knownFor.length;
      sources.add('tmdb');
    }

    if (!person.image && hit.profile_path) {
      person.image = `${IMG}/w300${hit.profile_path}`;
      portraits++;
      sources.add('tmdb');
    }

    if (sources.size > 0) person.enrichedFrom = [...sources];
  }

  console.log(`→ TMDB persons: ${matched}/${persons.length} matched, ${knownForWorks} known-for works, ${portraits} portraits added`);
  return { matched, knownForWorks, portraits };
}
