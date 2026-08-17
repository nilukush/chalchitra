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
import { episodesFromTmdbSeason, mergeEpisodeSummaries, pickTmdbMatch, type TmdbSearchResult } from './tmdb-lib.js';

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
    const hit = pickTmdbMatch((search?.results ?? []) as TmdbSearchResult[], record.title, record.year);
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
    if (!record.rating && typeof details.vote_average === 'number' && votes >= 10) {
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
    if (record.kind === 'series' && record.episodesList.length === 0) {
      const payload = await tmdbGet(`/tv/${hit.id}/season/1?language=en-US`, apiKey);
      const rows = payload ? episodesFromTmdbSeason(payload) : [];
      if (rows.length > 0) {
        record.episodesList = rows;
        episodesSynthesized += rows.length;
        record.enrichedFrom = [...new Set([...(record.enrichedFrom ?? []), 'tmdb'])];
      }
    }

    if (sources.length > 0) record.enrichedFrom = sources;
  }

  console.log(`→ TMDB enrichment: ${matched}/${titles.length} matched, ${episodesFilled} episode summaries filled, ${episodesSynthesized} episodes synthesized for table-less series, ${backdrops} backdrops`);
  return { matched, episodesFilled, episodesSynthesized, backdrops };
}
