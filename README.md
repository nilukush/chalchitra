# Chalchitra · चलचित्र

**A graphical discovery destination for Indian cinema & series.** Not an afterthought of a
global database — the whole point of one. Launching with the **class of 2026**: every Indian
feature film and television-series debut catalogued from Wikipedia, with posters, plots, cast,
crew, credits, external links and references.

## Stack

| Layer | Choice |
|---|---|
| Site | [Astro 5](https://astro.build) — fully static, zero-JS by default |
| Styling | Tailwind CSS v4 (custom "midnight premiere" design tokens) |
| Fonts | Fraunces (display), Inter (UI), Noto Sans Devanagari (fallback) — self-hosted |
| Search | MiniSearch (client-side index over prebuilt JSON) |
| Data pipeline | Node + TypeScript (`tsx`), MediaWiki API, disk-cached & resumable |
| Tests | Vitest — 75 unit tests over the wikitext parsers & dataset builders (TDD) |

## Pipeline

```bash
npm run pipeline:titles    # walk Wikipedia categories (paginated, subcategory-recursive)
npm run pipeline:fetch     # fetch 425 title pages (batched, cached in data/cache/pages)
npm run pipeline:dataset   # parse → movies/series/persons/search-index/stats JSON
npm run pipeline:trends    # trending signal → data/trends.json (see below)
npm run pipeline:all       # all four, in order
```

- **Politeness**: custom User-Agent, ~1 req/s pacing, `Retry-After`-aware exponential backoff,
  per-batch resilience. All API responses cached under `data/cache/api`; page payloads under
  `data/cache/pages` — re-runs are incremental.
- **Sources**:
  - `Category:2026 Indian films` → `data/movies.json`
  - `Category:2026 Indian television series debuts` (incl. subcategories) → `data/series.json`
  - Cast/crew wikilinks → `data/persons.json` (redirect-resolved, deduped, credits computed)
- **Trending**: `pipeline:trends` uses the Wikimedia **top-viewed-articles-per-day** bulk
  endpoint (7 requests for a 7-day window) and scores catalogue articles that appear in the
  daily top 1000 — a real human-interest signal. Re-run daily to refresh "Trending this week"
  on the home page. (The per-article pageviews endpoint is rate-limited hard; don't use it.)
- **Refreshing Wikipedia content**: page payloads are cached forever by default. To re-fetch
  everything (new posters, updated plots): `FORCE_REFRESH=1 npm run pipeline:fetch && npm run pipeline:dataset && npm run build`.

## Site

```bash
npm run dev        # http://localhost:4730  (non-standard port by design)
npm run build      # static output in dist/
npm run preview    # preview the build on :4730
npm test           # vitest
```

Routes: `/` · `/movies` (+`?lang=`) · `/movies/[slug]` · `/series` · `/series/[slug]` ·
`/people` · `/people/[slug]` · `/search` (+`?q=`) · `/about` · `robots.txt` · `llms.txt` ·
`sitemap-index.xml`.

Deploy by setting `SITE_URL` to the real domain (used for canonicals, OG tags, JSON-LD, sitemap).

## Licensing

Article text, metadata and images are derived from [Wikipedia](https://en.wikipedia.org) under
[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). Every page attributes and links
to its source article; plot text is excerpted, not republished in full. Posters stay on
Wikimedia servers.

## Extending

- **More years**: add category roots in `pipeline/extract-titles.ts` (the schema already has `year`);
  the archive builds backward toward the 1950s.
- **More countries** (a Korean edition is next): each country ships as its own site with the same
  architecture and design — fork this repo, swap the category roots and language badge map
  (the data model is origin-agnostic via the `origin` field).
