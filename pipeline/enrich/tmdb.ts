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
import { Agent, fetch as undiciFetch } from 'undici';

/** One shared dispatcher with short keep-alive: sockets close after 4s idle,
 *  so phases that idle (image resolution etc.) never resume on a half-open
 *  connection — without allocating an Agent per request. */
const tmdbAgent = new Agent({ keepAliveTimeout: 4_000, keepAliveMaxTimeout: 8_000 });
import type { TitleRecord } from '../types.js';
import { applyLiteEnrichment, episodesFromTmdbSeason, mergeEpisodeSummaries, pickTmdbMatch, pickTmdbTrailer, scoreNameOverlap, type TmdbCredits, type TmdbSearchResult, type TmdbVideo } from './tmdb-lib.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const CACHE_DIR = path.join(ROOT, 'data', 'cache', 'tmdb');
const API = 'https://api.themoviedb.org/3';
const IMG = 'https://image.tmdb.org/t/p';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Fetch /tv/{id}/season/N through the caller's paced getter. */
type PacedGet = (pathAndQuery: string) => Promise<any | null>;

/** Synthesize TMDB episode rows for every season the record claims but the
 *  Wikipedia tables don't cover (empty list → full guide; partial list → only
 *  the missing seasons). Stops at the first season TMDB doesn't have. */
async function synthesizeMissingSeasons(record: TitleRecord, pacedGet: PacedGet): Promise<number> {
  if (record.kind !== 'series' || !record.tmdbId) return 0;
  const maxSeasons = Math.min(Math.max(Number(record.seasons) || 1, 1), 50);
  const covered = new Set(record.episodesList.map((e) => e.season ?? 1));
  const added: ReturnType<typeof episodesFromTmdbSeason> = [];
  for (let season = 1; season <= maxSeasons; season++) {
    if (covered.has(season)) continue;
    const payload = await pacedGet(`/tv/${record.tmdbId}/season/${season}?language=en-US`);
    const rows = payload ? episodesFromTmdbSeason(payload, season) : [];
    if (rows.length === 0) break;
    added.push(...rows);
  }
  if (added.length > 0) {
    record.episodesList.push(...added);
    record.enrichedFrom = [...new Set([...(record.enrichedFrom ?? []), 'tmdb'])];
  }
  return added.length;
}

/** Cache file path for a TMDB request URL. */
function tmdbCacheFile(pathAndQuery: string): string {
  return path.join(CACHE_DIR, `${createHash('sha1').update(pathAndQuery).digest('hex').slice(0, 20)}.json`);
}

/** Disk-cache read for a TMDB request URL; undefined = not cached (or corrupt). */
function readTmdbCache(pathAndQuery: string): any | undefined {
  const cacheFile = tmdbCacheFile(pathAndQuery);
  if (!existsSync(cacheFile)) return undefined;
  try {
    return JSON.parse(readFileSync(cacheFile, 'utf8'));
  } catch {
    return undefined; // corrupt → refetch
  }
}

export async function tmdbGet(pathAndQuery: string, apiKey: string): Promise<any | null> {
  const cached = readTmdbCache(pathAndQuery);
  if (cached !== undefined) return cached;
  const cacheFile = tmdbCacheFile(pathAndQuery);
  const url = `${API}${pathAndQuery}${pathAndQuery.includes('?') ? '&' : '?'}api_key=${apiKey}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await sleep(1000 * 2 ** attempt);
    try {
      // undici's own fetch + a short-lived Agent: the global keep-alive pool
      // can pin requests to a half-open socket that never errors (seen live —
      // TMDB healthy from fresh connections while pooled fetches hung forever)
      const res = await undiciFetch(url, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(15_000),
        dispatcher: tmdbAgent,
      });
      if (process.env.TMDB_DEBUG) console.error(`  [tmdb] ${res.status} ${pathAndQuery.slice(0, 80)}`);
      if (res.status === 404) return null;
      if (res.status === 429 || res.status >= 500) continue;
      if (!res.ok) throw new Error(`TMDB HTTP ${res.status}`);
      const json = await res.json();
      mkdirSync(CACHE_DIR, { recursive: true });
      writeFileSync(cacheFile, JSON.stringify(json));
      await sleep(120);
      return json;
    } catch (e) {
      if (process.env.TMDB_DEBUG) console.error(`  [tmdb] attempt ${attempt} FAILED ${pathAndQuery.slice(0, 80)}:`, (e as Error)?.name, (e as Error)?.message, (e as Error)?.cause ?? '');
      /* retry */
    }
  }
  return null;
}

export function tmdbEnabled(): boolean {
  return Boolean(process.env.TMDB_API_KEY);
}

/** Global start-gate: spaces request STARTS ≥ minInterval apart across all
 *  workers. TMDB staff-stated ceiling is 50 req/s; we run far under it. */
function startGate(minIntervalMs: number) {
  let lastStart = 0;
  let chain: Promise<void> = Promise.resolve();
  return (): Promise<void> => {
    const run = async () => {
      const wait = Math.max(0, lastStart + minIntervalMs - Date.now());
      if (wait > 0) await sleep(wait);
      lastStart = Date.now();
    };
    const next = chain.then(run);
    chain = next.catch(() => {});
    return next;
  };
}

/**
 * Archive-lite enrichment: search + one validated details payload per record
 * (append_to_response=credits,videos — credits validate the match, the same
 * payload feeds the field merge). Concurrent workers behind a global rate
 * gate; every response is disk-cached so re-runs are cheap and resumable.
 * The old "12–38h for the archive" estimate assumed a serial client
 * (~0.6s/round-trip); at a polite 8 req/s this pass runs ~30 min for ~5.9k
 * records (TMDB documents no per-endpoint limit; respect 429s — we do).
 */
export async function enrichTitlesLite(
  titles: TitleRecord[],
  opts: { rps?: number; concurrency?: number; candidates?: number; dirty?: Set<number> } = {},
): Promise<{ matched: number; enriched: number }> {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey || titles.length === 0) return { matched: 0, enriched: 0 };
  const { rps = 8, concurrency = 6, candidates: maxCandidates = 2 } = opts;
  const gate = startGate(Math.round(1000 / rps));

  async function pacedGet(pathAndQuery: string): Promise<any | null> {
    // Cache hits skip the rate gate entirely — re-runs must not pay network
    // pacing for responses already on disk (was: ~30 min of pure sleeping).
    const cached = readTmdbCache(pathAndQuery);
    if (cached !== undefined) return cached;
    await gate();
    return tmdbGet(pathAndQuery, apiKey);
  }

  let matched = 0;
  let enriched = 0;
  let episodesAdded = 0;
  let cursor = 0;
  const started = Date.now();

  async function worker() {
    for (;;) {
      const i = cursor++;
      if (i >= titles.length) return;
      const record = titles[i];
      if (record.tmdbId) {
        matched++;
        continue;
      }
      const kind = record.kind === 'movie' ? 'movie' : 'tv';
      const yearParam = kind === 'movie' ? `&year=${record.year}` : `&first_air_date_year=${record.year}`;
      const search = await pacedGet(
        `/search/${kind}?query=${encodeURIComponent(record.title)}&include_adult=false${yearParam}`,
      );

      // validate the top candidates against Wikipedia names so same-year
      // namesakes can't win; the winner's payload already carries the fields
      const wikiNames = [...record.directedBy, ...record.createdBy, ...record.cast.slice(0, 6).map((c) => c.name)];
      let hit: TmdbSearchResult | null = null;
      let hitDetails: any = null;
      let bestScore = -1;
      for (const candidate of ((search?.results ?? []) as TmdbSearchResult[]).slice(0, maxCandidates)) {
        const det = await pacedGet(`/${kind}/${candidate.id}?language=en-US&append_to_response=credits,videos`);
        const credits: TmdbCredits | undefined = det?.credits ?? (det ? { crew: det.crew, cast: det.cast } : undefined);
        const score = scoreNameOverlap(credits, wikiNames);
        if (score > bestScore) {
          bestScore = score;
          hit = candidate;
          hitDetails = det;
        }
        if (score >= 3) break; // a director match is decisive
      }
      if (!hit || bestScore <= 0) {
        hit = pickTmdbMatch((search?.results ?? []) as TmdbSearchResult[], record.title, record.year);
        hitDetails = null; // details for this one not fetched yet
      }
      if (!hit?.id) continue;
      matched++;
      record.tmdbId = hit.id;
      // same URL shape as the candidate probes → one cache key per title
      const details = hitDetails ?? (await pacedGet(`/${kind}/${hit.id}?language=en-US&append_to_response=credits,videos`));
      if (details && applyLiteEnrichment(record, details, opts.dirty?.has(hit.id) ?? false)) enriched++;
      // full-fidelity mandate: archive series get episode guides for the
      // seasons their Wikipedia article doesn't tabulate (paced + cached)
      if (record.kind === 'series') {
        const added = await synthesizeMissingSeasons(record, pacedGet);
        episodesAdded += added;
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, titles.length) }, worker));

  const secs = Math.round((Date.now() - started) / 1000);
  console.log(`→ TMDB archive-lite: ${matched}/${titles.length} matched, ${enriched} records enriched, ${episodesAdded} episodes synthesized in ${secs}s`);
  return { matched, enriched };
}

/**
 * Enrich title records in place. Returns stats. No-op without TMDB_API_KEY.
 */
export async function enrichTitles(titles: TitleRecord[], dirty: Set<number> = new Set()): Promise<{ matched: number; episodesFilled: number; episodesSynthesized: number; backdrops: number }> {
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

    if ((!record.backdrop || dirty.has(hit.id)) && details.backdrop_path) {
      record.backdrop = `${IMG}/w780${details.backdrop_path}`;
      backdrops++;
      if (!sources.includes('tmdb')) sources.push('tmdb');
    }
    // Wikipedia film infoboxes carry no genre field — TMDB supplies the "type"
    if (record.genres.length === 0 && Array.isArray(details.genres) && details.genres.length > 0) {
      record.genres = details.genres.map((g: any) => g.name).filter(Boolean).slice(0, 4);
      if (!sources.includes('tmdb')) sources.push('tmdb');
    }
    if ((!record.tagline || dirty.has(hit.id)) && typeof details.tagline === 'string' && details.tagline.trim()) {
      record.tagline = details.tagline.trim();
      if (!sources.includes('tmdb')) sources.push('tmdb');
    }
    const votes = details.vote_count ?? 0;
    if ((!record.rating || dirty.has(hit.id)) && typeof details.vote_average === 'number' && votes >= 1) {
      record.rating = { source: 'tmdb', value: details.vote_average, votes };
      if (!sources.includes('tmdb')) sources.push('tmdb');
    }
    // Trailer: show-level videos first; for series, season-level pools often
    // hold the only trailers — merge them before the tiered YouTube-only pick.
    let trailerKey: string | undefined;
    if (!record.trailer || dirty.has(hit.id)) {
      const videoPools: TmdbVideo[][] = [(details.videos?.results ?? []) as TmdbVideo[]];
      if (record.kind === 'series' && (details.videos?.results ?? []).length === 0) {
        const seasons = Math.min(Number((details as any).number_of_seasons) || 1, 2);
        for (let season = 1; season <= seasons; season++) {
          const sv = await tmdbGet(`/tv/${hit.id}/season/${season}/videos?language=en-US`, apiKey);
          if (sv?.results?.length) videoPools.push(sv.results as TmdbVideo[]);
        }
      }
      trailerKey = pickTmdbTrailer(videoPools);
      if (trailerKey) {
        record.trailer = `https://www.youtube.com/watch?v=${trailerKey}`;
        if (!sources.includes('tmdb')) sources.push('tmdb');
      }
    }

    // episode summaries/runtimes for series with wiki tables — one season
    // payload per season the wiki rows actually cover (numbers restart per
    // season, so each payload only merges into its own season's rows)
    if (record.kind === 'series' && record.episodesList.some((e) => !e.summary || !e.runtime)) {
      const wantedSeasons = [...new Set(record.episodesList.map((e) => e.season ?? 1))].sort((a, b) => a - b);
      let list = record.episodesList;
      let filled = 0;
      for (const n of wantedSeasons) {
        const payload = await tmdbGet(`/tv/${hit.id}/season/${n}?language=en-US`, apiKey);
        if (!payload?.episodes) continue;
        const before = list.filter((e) => e.summary).length;
        list = mergeEpisodeSummaries(list, payload, n);
        filled += list.filter((e) => e.summary).length - before;
      }
      if (filled > 0) {
        episodesFilled += filled;
        record.episodesList = list;
        if (!record.enrichedFrom?.includes('tmdb')) {
          record.enrichedFrom = [...(record.enrichedFrom ?? []), 'tmdb'];
        }
      }
    }

    // seasons the Wikipedia tables DON'T cover → synthesize from TMDB
    // (every season the record claims, with a safety ceiling against bad data)
    if (record.kind === 'series') {
      const added = await synthesizeMissingSeasons(
        record,
        (p) => tmdbGet(p, apiKey),
      );
      episodesSynthesized += added;
    }

    if (sources.length > 0) record.enrichedFrom = [...new Set([...(record.enrichedFrom ?? []), ...sources])];
  }

  console.log(`→ TMDB enrichment: ${matched}/${titles.length} matched, ${episodesFilled} episode summaries filled, ${episodesSynthesized} episodes synthesized for uncovered seasons, ${backdrops} backdrops`);
  return { matched, episodesFilled, episodesSynthesized, backdrops };
}

/** Person enrichment: TMDB profile (portrait fallback, known-for works, id).
 *  Exact-name matching only — precision over recall. */
export async function enrichPersons(
  persons: { slug: string; name: string; image?: string; knownFor?: unknown[]; tmdbId?: number; enrichedFrom?: string[] }[],
): Promise<{ matched: number; knownForWorks: number; portraits: number }> {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey || process.env.TMDB_PERSONS === '0') {
    if (process.env.TMDB_PERSONS === '0') console.log('→ TMDB persons: skipped (TMDB_PERSONS=0)');
    return { matched: 0, knownForWorks: 0, portraits: 0 };
  }

  let matched = 0;
  let knownForWorks = 0;
  let portraits = 0;

  console.log(`→ TMDB persons: matching ${persons.length} (paced, cached)…`);
  const STALL = Symbol('stall');
  let done = 0;
  let consecutiveStalls = 0;
  for (const person of persons) {
    // hard per-person timeout + circuit breaker: the persons phase once hung
    // forever on a detached fetch promise (loop idle, no handles — see
    // session 15 notes); a stall must never block the whole dataset build
    const result = await Promise.race([
      tmdbGet(`/search/person?query=${encodeURIComponent(person.name)}&include_adult=false`, apiKey),
      sleep(20_000).then(() => STALL),
    ]);
    if (result === STALL) {
      if (++consecutiveStalls >= 10) {
        console.log('  persons tmdb: 10 consecutive stalls — skipping TMDB for the remaining persons this run');
        break;
      }
      continue;
    }
    consecutiveStalls = 0;
    const search = result;
    if (++done % 200 === 0) console.log(`  persons tmdb ${done}/${persons.length}`);
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
