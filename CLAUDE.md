# CLAUDE.md — Chalchitra

## What this is
Static website + data pipeline cataloguing **2026 Indian movies and television series debuts**
from Wikipedia. Product name: **Chalchitra** (चलचित्र). Data model is origin-agnostic —
Korean cinema is the planned next dataset.

## Commands
- `npm run pipeline:all` — titles → fetch → dataset → trends (idempotent, disk-cached, polite ~1 req/s)
- `npm run dev` / `npm run build` / `npm run preview` — port **4730** (non-standard by design)
- `npm test` — vitest, 192 tests (wikitext parsers, tables, TMDB merge logic, dataset builders, trends scoring) — **TDD: extend tests first**
- Deploy env var: `SITE_URL` (canonical/OG/sitemap/JSON-LD base URL)

## Architecture
- `pipeline/wikitext/` — pure, fixture-tested parsers: infobox + generic `findTemplates`
  (recursive-safe), sections, cast bullets, external links (IMDb/official), dates, person-link
  heuristics, episodes ({{Episode list}} + wikitables), soundtrack ({{Track listing}} + lists),
  references (cite templates, named refs, bare links). Never throw — degrade.
- `pipeline/wiki-api.ts` — cached API client (sha1-keyed response cache; `data/cache/pages/{pageid}.json`),
  redirect-aware title resolution, batched fetch (10/batch), 429 backoff honoring Retry-After.
- `pipeline/build-dataset.ts` — parse titles → collect person links → fetch persons → compute
  back-link credits → emit `data/*.json` + `public/search-index.json`. Plot/reception/summary
  and references are stored FULL (no truncation) — product policy: the site is the destination.
- `pipeline/fetch-trends.ts` + `trends-lib.ts` — trending via bulk top-per-day pageviews endpoint.
- `src/` — Astro static site. `src/lib/data.ts` is the single data-access layer.
  `TitleDetail.astro` is shared by movie & series pages. Person credits reuse real title records.

## Data flow invariants
- Wikipedia text is CC BY-SA 4.0 → every page carries attribution + source link; plot is excerpted.
- Posters are hotlinked `upload.wikimedia.org` thumbs (never re-hosted).
- Slugs: kebab-case, disambiguation parentheses stripped, collisions get `-2`, `-3`…
- Person set = union of cast/crew wikilinks that resolve to existing articles (redirect-followed).

## Gotchas
- Rate limits are real: pipeline paces itself; if a batch 429s it retries with backoff, then skips
  (re-run to resume from cache). The **per-article** pageviews REST endpoint 429s almost
  immediately — trending uses the **bulk top-per-day** endpoint instead (`pipeline/fetch-trends.ts`).
- `prop=pageimages` excludes non-free posters → posters resolved via infobox `image` +
  `imageinfo` (`resolveImageThumbUrls`); API normalizes file titles to spaces (watch underscores),
  appends `utm_source` params (stripped), and commented-out `<!-- X.jpg -->` params must be ignored.
- `parseInfobox` splits at top-level pipes only — nested templates (`{{ubl|…}}`) and piped links
  are preserved; covered by `pipeline/wikitext/*.test.ts`.
- Year is currently hard-coded to 2026 in `pipeline/build-dataset.ts` (`YEAR`).
