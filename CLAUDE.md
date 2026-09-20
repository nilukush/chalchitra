# CLAUDE.md — Chalchitra

## What this is
Static website + data pipeline cataloguing **every era of Indian cinema** (movies, series,
people) from Wikipedia, enriched with TMDB. Product name: **Chalchitra** (चलचित्र).
Single-tier policy: every title/person gets the full parse — no fidelity tiers.
Repo: https://github.com/nilukush/chalchitra (public). Deploy target: **Vercel Hobby**
(prebuilt CLI deploys from the workflow; `render.yaml` kept as the Render fallback).
Current scale (2026-09-19): ~29.7k titles, ~39.5k pages, ~9.4k persons.

## Commands
- `npm run pipeline:titles` — category walk (film root + 12 Indian-language year
  categories; series Indian-debuts root + 2 GLOBAL debuts categories, direct-pages-only)
- `npm run pipeline:fetch` / `pipeline:refresh` — full fetch / lastrevid incremental diff
- `npm run pipeline:tmdb-changes` — TMDB change-list delta + **freshness sweep**
  (everything released ≤45 days is force-invalidated every run — the /changes feed
  is capped at 10k/day and misses rating drift on low-vote titles)
- `npm run pipeline:dataset` — full rebuild (+TMDB/AI) → light summaries + title chunks
- `npm run pipeline:persons [n]` / `pipeline:expand [n]` — wave fetchers (frontiers;
  pre-fetch filters drop person/award/season links; Indian-source-weighted ranking)
- `npm run pipeline:trends` — Wikipedia pageviews → trending rails (NOT in dataset step)
- `npm test` (vitest, 291 tests — **TDD: extend tests first**) / `npm run build` / dev port **4730**
- `./scripts-prune-deployments.sh [keep] [projectId]` — Vercel prune (READY-aware:
  ERRORED/CANCELED never take a keep slot). `./scripts-seed.sh fetch|publish` —
  split-parts seed release I/O (GitHub caps assets at 2GB; cache grows ~23MB/day)

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
- **Awards parser covers THREE source shapes** (`pipeline/wikitext/awards.ts`, docs/ISSUES.md
  #1): wikitables (incl. `{{awards table}}` template-opened ones — no `{|`, no header),
  bullet honours lists (`;`/`'''[[Ceremony]]'''` context lines, `**` category children,
  "In YYYY," prose bullets rejected; bullets INSIDE table cells expand one row per
  bullet via tables.ts's opt-in `multilineCells` — keep it awards-only), and
  awards-subpage mode (`{subpage: true}` — every section + lead in scope, prose pass
  OFF). Ceremony context also fills award-less tables under `===Ceremony===` headings.
  Edition links (`[[58th …|2024]]`) read as ceremony+year, never as award "2024".
  `{{Infobox awards list}}` aggregates are NOT row data but are parsed
  (`extractInfoboxAwardTotals`) as coverage-audit ground truth — coverage is
  measured parsed/itemized, never parsed/aggregate (ISSUES #2 lesson).
- Renames: `planRenames` (moves don't bump lastrevid) → refetch under new title →
  cumulative slug redirects (`data/redirects.json` ← pageid-keyed slug-map in cache,
  kind-flips emit `/series→/movies` paths) consumed by astro.config.
- Archive expansion dedupes by **pageid** (title strings collide across spellings:
  "108: Base Hospital Uri" vs "108 Base Hospital – Uri").
- **`archive` = discovery provenance, not age** (Issue 4, 2026-09-20): catalogue =
  seen by the category walk, archive = wave-discovered. Two guards keep current-year
  debuts off the misfiled path (homepage rails filter `!archive`): (a) the series walk
  merges two GLOBAL debuts categories (`<year> television series debuts`,
  `<year> web series debuts`) fetched at **depth 0 — recursion would walk 41 country
  subcats**; their entries carry `indiaCheck` in titles.json and build-dataset gates
  them through `classifyTitlePage`; (b) wave works whose infobox year equals
  `titles.json catalogueYear` are promoted to non-archive (`archiveTierForWaveYear` —
  catches zero-category titles like Panchanama). `hasNonIndianCountryCategory`
  (classify-title.ts) hard-rejects BD/PK/Sri-Lankan national categories and evicts
  such strays from the expansion pass at build time.

## Pipeline / ops steady state (since 2026-09-08)
- **The frontier is closed** (~34.7k works accepted). Discovery replenishes a daily
  trickle; the workflow consumes it via `pipeline:expand 300` — manual waves retired.
- **Dual cron slots** (05:15 + 17:15 UTC): GitHub cron delays/drops single slots —
  redundancy is required, not optional. Concurrency group queues safely.
- **Deployment storage is TEAM-wide 10GB** (all 9 projects). Two guards: user-set
  Vercel retention policy (prod 1w, pre-prod/cancelled 1d) + nightly keep-2 prune
  after every deploy. Archive deploys are the ONLY viable free host at this scale
  (Cloudflare 20k-file / Netlify 10k / GH-Pages 1GB caps all exclude ~39k pages).
- The permanent VERCEL_TOKEN lives ONLY in the GitHub Actions secret (the old
  expat-salary copy is GONE; no local CLI token exists) — Vercel state is audited
  via the dispatched `vercel-storage-audit.yml` (read-only census) and
  `vercel-prune.yml` (manual prune lever). `scripts-sync-vercel-secret.sh` is a
  deliberate NO-OP — restoring it clobbers the permanent token and breaks
  nightly deploys. Deploy step retries 3x (a CLI `Error: fetch failed` after a
  complete upload is a lost polling connection; the deploy often goes READY
  server-side anyway) and the prune runs `if: always()` to clean ERRORED ones.
- **After any local run that fetched pages**: republish seed + purge CI caches
  (runbook block in AGENTS.md) or the next nightly silently reverts it.
  **Guard**: only evict when the local page-cache is the SUPERSET — eviction with a
  stale local seed regressed production once (2026-09-20: ~62 titles 404'd; the
  nightly expand trickle re-fetches them within 1-2 runs). Compare local
  `data/cache/pages` count vs the production search-index doc count first.
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
