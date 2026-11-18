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
import { planFreshnessRefresh, planOrphanSweep, planTmdbRefresh, type TrackedTitle } from './tmdb-changes-lib.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = path.join(ROOT, 'data');
const TMDB_CACHE = path.join(DATA, 'cache', 'tmdb');
const LAST_RUN_PATH = path.join(DATA, 'cache', 'tmdb-changes-last.json');
const MAX_LOOKBACK_DAYS = 14;

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

async function fetchChangedIds(kind: 'movie' | 'tv', start: string, end: string, apiKey: string): Promise<number[]> {
  const ids: number[] = [];
  let json: any = null;
  for (let page = 1; page <= 100; page++) {
    json = await tmdbGet(`/${kind}/changes?start_date=${start}&end_date=${end}&page=${page}`, apiKey);
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
      // movies entries are objects with releaseDate in the new shape, plain
      // numbers in old caches — accept both
      tracked = [
        ...((t.movies ?? []) as (number | { tmdbId: number; releaseDate?: string })[]).map((m) =>
          typeof m === 'number' ? { tmdbId: m, kind: 'movie' as const } : { tmdbId: m.tmdbId, kind: 'movie' as const, releaseDate: m.releaseDate },
        ),
        ...((t.series ?? []) as { tmdbId: number; seasons?: string; releaseDate?: string }[]).map((s) => ({ tmdbId: s.tmdbId, kind: 'series' as const, seasons: s.seasons, releaseDate: s.releaseDate })),
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

  const feedPlan = planTmdbRefresh(changedMovies, changedTv, tracked);
  const feedIds = new Set(feedPlan.map((p) => p.tmdbId));
  // recent releases are force-refreshed EVERY run: their ratings move fastest
  // and the change feed is lossy at our scale (10k/day cap)
  const plan = [
    ...feedPlan,
    ...planFreshnessRefresh(tracked, end).filter((f) => !feedIds.has(f.tmdbId)),
  ];
  // orphan sweep: changed ids that LEFT our tracked list still own cache files
  // (a retitle can cost us the match → the id drops out of tmdb-tracked.json →
  // every future invalidation goes blind to its stale details). Deleting an
  // untracked id's files is free — refetch only happens if a search hits it
  // again, and then it deserves fresh data. Not added to tmdb-dirty: records
  // carrying these ids are rebuilt empty, so fill-only merges already apply.
  const orphans = planOrphanSweep(changedMovies, changedTv, new Set(plan.map((p) => p.tmdbId)));
  // dirty ids: the next dataset run may OVERWRITE TMDB-owned fields for these
  // (rating/trailer/backdrop/tagline) instead of fill-only-empty
  writeFileSync(path.join(DATA, 'cache', 'tmdb-dirty.json'), JSON.stringify({ ids: plan.map((p) => p.tmdbId) }));
  let removed = 0;
  let orphanRemoved = 0;
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
  for (const entry of orphans) {
    for (const url of entry.urls) {
      const key = createHash('sha1').update(url).digest('hex').slice(0, 20);
      const file = path.join(TMDB_CACHE, `${key}.json`);
      if (existsSync(file)) {
        rmSync(file, { force: true });
        orphanRemoved++;
      }
    }
  }
  console.log(`  ${plan.length} tracked titles changed → ${removed} cache entries invalidated; ${orphans.length} untracked changed ids swept → ${orphanRemoved} orphaned entries deleted`);

  writeFileSync(LAST_RUN_PATH, JSON.stringify({ date: end }));
  console.log('✓ Next pipeline:dataset re-fetches these fresh. Runbook: tmdb-changes → dataset → build.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
