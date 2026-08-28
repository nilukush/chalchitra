/**
 * Stage 7 — TMDB change-list delta (Step 8b): TMDB reports which movie/tv ids
 * changed recently (/movie/changes, /tv/changes — 14-day lookback max, so this
 * must run at least biweekly). We intersect with our tracked tmdbIds and
 * invalidate ONLY those cache entries; the next pipeline:dataset re-fetches
 * them fresh and the gap-only merges pick up new trailers/ratings/seasons.
 *
 * Usage: npm run pipeline:tmdb-changes   (key-gated; no key → no-op)
 */
import { readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnv } from './env.js';

loadEnv();
import { tmdbGet } from './enrich/tmdb.js';
import { planTmdbRefresh, type TrackedTitle } from './tmdb-changes-lib.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = path.join(ROOT, 'data');
const TMDB_CACHE = path.join(DATA, 'cache', 'tmdb');
const LAST_RUN_PATH = path.join(DATA, 'cache', 'tmdb-changes-last.json');
const MAX_LOOKBACK_DAYS = 14;

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

async function fetchChangedIds(kind: 'movie' | 'tv', start: string, end: string, apiKey: string): Promise<number[]> {
  const ids: number[] = [];
  for (let page = 1; page <= 20; page++) {
    const json = await tmdbGet(`/${kind}/changes?start_date=${start}&end_date=${end}&page=${page}`, apiKey);
    const results = json?.results ?? [];
    for (const r of results) if (r?.id) ids.push(r.id);
    if (page >= (json?.total_pages ?? 1)) break;
  }
  return ids;
}

async function main() {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) {
    console.log('→ TMDB changes: no key, skipping.');
    return;
  }
  const today = new Date();
  const end = isoDate(today);
  let start = isoDate(new Date(today.getTime() - MAX_LOOKBACK_DAYS * 86_400_000));
  if (existsSync(LAST_RUN_PATH)) {
    try {
      const last = String(JSON.parse(readFileSync(LAST_RUN_PATH, 'utf8')).date);
      const candidate = isoDate(new Date(Math.max(new Date(last).getTime(), new Date(start).getTime())));
      start = candidate;
    } catch {
      /* keep default window */
    }
  }
  console.log(`→ TMDB changes: window ${start} → ${end}`);

  const [changedMovies, changedTv] = await Promise.all([
    fetchChangedIds('movie', start, end, apiKey),
    fetchChangedIds('tv', start, end, apiKey),
  ]);
  console.log(`  TMDB reports ${changedMovies.length} changed movies, ${changedTv.length} changed series`);

  // tracked ids: prefer the cache-carried list (CI has no data/*.json yet);
  // fall back to the local dataset files
  let tracked: TrackedTitle[] | null = null;
  const trackedPath = path.join(DATA, 'cache', 'tmdb-tracked.json');
  if (existsSync(trackedPath)) {
    try {
      const t = JSON.parse(readFileSync(trackedPath, 'utf8'));
      tracked = [
        ...((t.movies ?? []) as number[]).map((id) => ({ tmdbId: id, kind: 'movie' as const })),
        ...((t.series ?? []) as { tmdbId: number; seasons?: string }[]).map((s) => ({ tmdbId: s.tmdbId, kind: 'series' as const, seasons: s.seasons })),
      ];
    } catch {
      /* fall through */
    }
  }
  if (tracked === null) {
    try {
      const movies = JSON.parse(readFileSync(path.join(DATA, 'movies.json'), 'utf8'));
      const series = JSON.parse(readFileSync(path.join(DATA, 'series.json'), 'utf8'));
      tracked = [...movies, ...series].map((t: any) => ({ tmdbId: t.tmdbId, kind: t.kind, seasons: t.seasons }));
    } catch {
      console.log('  no tracked-id list yet (data/cache/tmdb-tracked.json and data/*.json both missing) — skipping invalidation this run.');
      writeFileSync(LAST_RUN_PATH, JSON.stringify({ date: end }));
      return;
    }
  }

  const plan = planTmdbRefresh(changedMovies, changedTv, tracked);
  let removed = 0;
  for (const entry of plan) {
    for (const url of entry.urls) {
      const key = createHash('sha1').update(url).digest('hex').slice(0, 20);
      const file = path.join(TMDB_CACHE, `${key}.json`);
      if (existsSync(file)) {
        rmSync(file, { force: true });
        removed++;
      }
    }
  }
  console.log(`  ${plan.length} tracked titles changed → ${removed} cache entries invalidated`);

  writeFileSync(LAST_RUN_PATH, JSON.stringify({ date: end }));
  console.log('✓ Next pipeline:dataset re-fetches these fresh. Runbook: tmdb-changes → dataset → build.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
