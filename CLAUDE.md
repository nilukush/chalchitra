# CLAUDE.md — Chalchitra

## What this is
Static website + data pipeline cataloguing **every era of Indian cinema** (movies, series,
people) from Wikipedia, enriched with TMDB. Product name: **Chalchitra** (चलचित्र).
Single-tier policy: every title/person gets the full parse — no fidelity tiers.
Repo: https://github.com/nilukush/chalchitra (public). Deploy target: **Vercel Hobby**
(prebuilt CLI deploys from the daily workflow; `render.yaml` kept as the Render fallback).

## Commands
- `npm run pipeline:all` — titles → fetch → dataset → trends (idempotent, disk-cached, polite ~1 req/s)
- `npm run pipeline:persons [n]` — person expansion wave (cast/crew recursion; `EXPAND_PERSONS_FOCUS=<slug>` hoists a title's cast)
- `npm run pipeline:expand [n]` — title expansion wave (filmographies → title pages)
- `npm run pipeline:refresh` — incremental lastrevid diff (refetch ONLY edited pages)
- `npm run pipeline:tmdb-changes` — TMDB change-list delta (invalidate stale TMDB cache entries)
- `npm run dev` / `npm run build` / `npm run preview` — port **4730** (non-standard by design)
- `npm test` — vitest, 240 tests — **TDD: extend tests first**
- Env: `TMDB_API_KEY`, `AI_API_KEY` (gitignored `.env`); `TMDB_DEBUG=1` prints TMDB statuses; `TMDB_PERSONS=0` skips person enrichment

## Architecture
- `pipeline/wikitext/` — pure, fixture-tested parsers: infobox + `findTemplates`, sections
  (incl. `findPlotSection` variants), rowspan/colspan **grid** table parser (`tables.ts` —
  used by filmography/awards/episodes/soundtrack/discography), cast, links, dates, episodes
  (season-tagged, subpage follower), soundtrack (+ album subpages), references, bio.
  Never throw — degrade.
- `pipeline/wiki-api.ts` — cached API client (sha1 response cache; per-pageid cache;
  1100ms pacing, 429 backoff). `fetchLastRevids` is deliberately UNCACHED (live delta signal).
- `pipeline/expand-persons.ts` / `expand-titles.ts` — wave fetchers with frontiers
  (`data/cache/person-frontier.json`, `expansion-frontier.json`), ranked by reference count;
  interwiki-prefixed targets are filtered out (not en.wikipedia pages).
- `pipeline/build-dataset.ts` — parse titles → persons (+ wave persons) → subpages
  (filmography/awards/episodes/soundtracks) → archive titles → enrichment (TMDB, AI)
  → writes `data/*.json` and **persons as first-letter chunks** (`data/persons/<L>.json`,
  '#' → `_.json`) — keeps every file far under the 100MB runtime/git limit.
- `pipeline/persons-store.ts` — chunk loader for pipeline readers; `src/lib/data.ts`
  loads chunks via `import.meta.glob` eager + re-sorts.
- `pipeline/enrich/tmdb.ts` — paced TMDB client (own undici Agent, 15s aborts, disk
  cache; `TMDB_DEBUG=1` on failures), archive-lite pass, season-aware episode merge,
  `synthesizeMissingSeasons`.
- `src/` — Astro static site; indexes paginated (200/page + language facet routes).

## Data & deployment invariants
- `data/*.json`, `data/persons/`, `public/search-index.json` are **generated and gitignored** —
  rebuilt from `data/cache/` by `pipeline:dataset`. CI bootstraps the cache from the
  `seed` release asset; the daily workflow re-publishes it.
- GitHub: public repo (free Actions minutes for the daily/hourly workflows).
- Vercel deploys are PREBUILT from the daily workflow (`vercel deploy ./dist --prod
  --archive=tgz`; zero Vercel build minutes). Hobby plan is **non-commercial only**
  — never add ads/affiliate/donation links, or deployments 503-pause (Render
  blueprint is the documented fallback).
- Wikipedia text is CC BY-SA 4.0 → every page carries attribution + source link.
- Posters hotlink `upload.wikimedia.org`; slugs kebab-case with `-2`/`-3` collisions.

## Gotchas
- Rate limits are real: never bypass pacing (AGENTS.md #3); bulk top-per-day endpoint
  for trending (per-article 429s immediately).
- Astro: `getStaticPaths` is hoisted above frontmatter consts (helpers go INSIDE it);
  rest params (`[...page]`) take strings, not arrays.
- tsx runs without typecheck — `npm run build` (esbuild) catches what vitest misses;
  known latent tsc errors exist in build-dataset crew wiring (pre-date sessions 15+).
- Silent `catch` blocks around refactored scopes hide one-variable bugs — the session-15
  `cacheFile` ReferenceError masqueraded as a network hang for hours. Instrument first.
- `FORCE_REFRESH=1` refetches EVERYTHING — prefer deleting a single `data/cache/pages/<pageid>.json`.
