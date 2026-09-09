# CLAUDE.md — Chalchitra

## What this is
Static website + data pipeline cataloguing **every era of Indian cinema** (movies, series,
people) from Wikipedia, enriched with TMDB. Product name: **Chalchitra** (चलचित्र).
Single-tier policy: every title/person gets the full parse — no fidelity tiers.
Repo: https://github.com/nilukush/chalchitra (public). Deploy target: **Vercel Hobby**
(prebuilt CLI deploys from the workflow; `render.yaml` kept as the Render fallback).
Current scale (2026-09-09): ~29.6k titles, ~39.4k pages, ~9.4k persons.

## Commands
- `npm run pipeline:titles` — category walk (root + 12 Indian-language year categories)
- `npm run pipeline:fetch` / `pipeline:refresh` — full fetch / lastrevid incremental diff
- `npm run pipeline:tmdb-changes` — TMDB change-list delta + **freshness sweep**
  (everything released ≤45 days is force-invalidated every run — the /changes feed
  is capped at 10k/day and misses rating drift on low-vote titles)
- `npm run pipeline:dataset` — full rebuild (+TMDB/AI) → light summaries + title chunks
- `npm run pipeline:persons [n]` / `pipeline:expand [n]` — wave fetchers (frontiers;
  pre-fetch filters drop person/award/season links; Indian-source-weighted ranking)
- `npm run pipeline:trends` — Wikipedia pageviews → trending rails (NOT in dataset step)
- `npm test` (vitest, 267 tests — **TDD: extend tests first**) / `npm run build` / dev port **4730**
- `./scripts-prune-deployments.sh [keep] [projectId]` — Vercel deployment pruning

## Architecture (load-bearing shapes)
- **Title chunking (2026-09-05)**: `data/movies.json`/`series.json` are LIGHT summaries
  (`toTitleSummary` — no prose/refs/episodes/credits; +`episodeCount`), ~19MB total,
  eagerly loaded by indexes/search/cards. FULL records live in per-letter chunks
  `data/titles/<movies|series>/<A-Z|_>.json` (~300MB) loaded ONLY by title pages.
- **Chunk loading is disk-LRU, NOT import.meta.glob** (`fullTitle` in `src/lib/data.ts`):
  the module registry retains every chunk and OOMed the 7GB CI runner at ~39k pages.
  4-slot LRU + slug-ordered `getStaticPaths` → peak ~1.8GB, ~11 min builds. Keep any new
  data-loading pattern disk/LRU-based.
- **TMDB URL shapes live ONLY in `tmdb-lib.ts`** (`catalogueDetailsUrl`/
  `liteDetailsUrl`/`seasonDetailsUrl`/`videosFallbackUrl` + `VIDEO_LANGS`): the change-list
  invalidation and the fetchers share them. Hand-written URLs in either place once froze
  ratings site-wide for days. Never extend VIDEO_LANGS past 11 entries (13-entry lists
  trip a TMDB cache bug returning EMPTY video appends).
- Persons: first-letter chunks (`data/persons/`, `#`→`_`), eager glob (fine at 9.4k).
- Renames: `planRenames` (moves don't bump lastrevid) → refetch under new title →
  cumulative slug redirects (`data/redirects.json` ← pageid-keyed slug-map in cache,
  kind-flips emit `/series→/movies` paths) consumed by astro.config.
- Archive expansion dedupes by **pageid** (title strings collide across spellings:
  "108: Base Hospital Uri" vs "108 Base Hospital – Uri").

## Pipeline / ops steady state (since 2026-09-08)
- **The frontier is closed** (~34.7k works accepted). Discovery replenishes a daily
  trickle; the workflow consumes it via `pipeline:expand 300` — manual waves retired.
- **Dual cron slots** (05:15 + 17:15 UTC): GitHub cron delays/drops single slots —
  redundancy is required, not optional. Concurrency group queues safely.
- **Deployment storage is TEAM-wide 10GB** (all 9 projects). Two guards: user-set
  Vercel retention policy (prod 1w, pre-prod/cancelled 1d) + nightly keep-2 prune
  after every deploy. Archive deploys are the ONLY viable free host at this scale
  (Cloudflare 20k-file / Netlify 10k / GH-Pages 1GB caps all exclude ~39k pages).
- VERCEL_TOKEN is a never-expires dashboard token (`docs/vercel-chalchitra.md` in
  expat-salary, untracked+gitignored there). `scripts-sync-vercel-secret.sh` is a
  deliberate NO-OP — restoring it clobbers the permanent token with the CLI's
  expiring session token (~8-12h life) and breaks nightly deploys.
- **After any local run that fetched pages**: republish seed + purge CI caches
  (runbook block in AGENTS.md) or the next nightly silently reverts it.
- Local `vercel deploy` needs `--scope nilukushs-projects`.

## Invariants & gotchas
- `data/*.json`, `data/persons/`, `data/titles/`, `public/search-index.json` are
  generated + gitignored; rebuilt from `data/cache/` (CI bootstraps from the `seed`
  release asset). Never commit them.
- Wikipedia text is CC BY-SA 4.0 → attribution + source link on every page.
  Hobby plan is non-commercial (no ads/affiliate/donations). Posters hotlink
  upload.wikimedia.org. Rate limits are real: never bypass pacing (AGENTS.md #3).
- Wikipedia's image-resolution phase rate-limits hard on some nights (2-3h with
  30s backoffs) — the run is resumable; don't panic-restart concurrent clients.
- Astro: `getStaticPaths` hoisted above frontmatter consts; rest params take
  strings; tsx skips typecheck (`npm run build` catches what vitest misses).
- One paced client at a time — INCLUDING builds (concurrent chains race on dist/
  and crash Astro's finalize step). Instrument before theorizing (session-15 lesson).
- `FORCE_REFRESH=1` refetches EVERYTHING — prefer deleting a single cache file.
