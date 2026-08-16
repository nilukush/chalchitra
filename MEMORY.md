# MEMORY.md — session state log

## Session 4 — 2026-08-16 (external-links audit) — COMPLETE

User audit (episodes/soundtracks/external links/Vadhandhi S2 image). Findings & fixes:

**Q1 Episodes** — 11/60 series have episode data (rest have NO table on Wikipedia);
all 11 render the "Episode guide" (EpisodesTable, saffron-numbered rows, >20 collapse toggle).

**Q2 Soundtracks** — 150 titles (141 movies + 9 series, 725 tracks), all rendering TrackList.

**Q3 External links** — census found missed templates: Instagram (224), Facebook (121),
Twitter/X (110), Rotten Tomatoes (63+22), YouTube (52), Netflix (9), {{URL}} (151),
Bollywood Hungama person/movie (264!), Wikiquote (32), Spotify (1). Implemented
LINK_TEMPLATES registry in `wikitext/links.ts` (+ `findTemplates` now supports positional
params as '1','2'…, incl. explicit `|2=` numeric params). Coverage after fix:
**74% of titles, 84% of persons have ≥1 external link** (remainder have none on Wikipedia).
Non-links correctly skipped: succession boxes (s-*), stubs, award navbars, webarchive.
Display limit raised: 14 chips/titles, 12/persons, deduped by URL.

**Q4 Vadhandhi season 2** — its Wikipedia infobox has `| image =` EMPTY (no poster uploaded
to Wikipedia yet). Extraction correct; nothing to capture. Added `FORCE_REFRESH=1` env flag
(readCachedPage bypass) so future Wikipedia updates (e.g. new posters) can be re-fetched
without nuking the whole cache: `FORCE_REFRESH=1 npm run pipeline:fetch && npm run pipeline:dataset`.

Tests: 101 green. 2,651 pages, 50,180 internal links, 0 missing. Committed.

## Session 3 — 2026-08-16 (completeness mandate) — COMPLETE

User's binding product decisions: this site is the DESTINATION, not a teaser.
1. **Full plot text** (no truncation, no "go to Wikipedia" nudge) → plot/reception/summary now
   stored & rendered untruncated (drop-cap prose styling `.prose-article`); attribution block
   kept on every page (full text + CC BY-SA 4.0 + source link = compliant share-alike posture).
2. **Episodes + soundtracks captured**: new parsers `wikitext/episodes.ts` ({{Episode list}}
   templates + wikitable header-mapping fallback; 131 episode rows across 12 titles — many
   Indian TV articles simply have no episode table) and `wikitext/soundtrack.ts`
   ({{Track listing}} titleN/singerN/lyricistN/lengthN + all_lyrics fallback + numbered-list
   fallback; 150 titles, 725 tracks).
3. **Full references**: `wikitext/references.ts` — every unique <ref> → {label,url,source,date};
   handles cite-web/news templates, named refs defined out of order, bare-link refs;
   **8,026 refs on title pages (100% coverage) + 68,561 on person pages**, all rendered as
   linked "Sources & references" lists (collapse-toggle > 25; two-column when dense).

New shared infra: `findTemplates(text, namePattern)` in infobox.ts — recursive-safe template
scanner (scans INSIDE outer templates; the initial lastIndex-skip version missed nested
{{Episode list}}). clean.ts: `{{ill|X}}`/`{{lang|code|X}}` now render their display param.

Tests: 98 green (was 80). Biggest page 1.5MB (a star with ~500 refs) — accepted; gzip/CDN fine.

## Session 2 — 2026-08-16 (audit + trending) — COMPLETE

User asked for a data audit (4 questions) + trending showcase. Findings & actions:

**Q1 Images.** Was 328/425 titles. Audit found 20 more resolvable: the imageinfo API
normalizes titles to SPACES while our keys kept UNDERSCORES → mismatch (fixed in
`resolveImageThumbUrls` + lookup); commented-out `<!-- X.jpg -->` params now ignored (wrong-art
risk). Now **346/425 (81%)**; remaining 79 verified as genuinely having NO image uploaded to
Wikipedia (empty/commented poster params, mostly unreleased/obscure titles). Persons: 1,403/2,210
portraits (63%) — remainder have no free image (Wikipedia excludes non-free from pageimages;
their infobox images are fair-use and were resolved where present).

**Q2 Title-page fields.** Census of all infobox keys vs captured: added `reception` text
(227 titles now carry it), `last_aired`, `native_name`, `executive_producer`→producers,
`narrator`/`presenter`→crew+persons (+9 people), `camera`→cinematography,
`production_companies`→studios, `channel`→network, `related`→internal related-titles chips.
NOT captured by design: full plot (>1600-char excerpts, licensing), episode tables, soundtrack
listings, full reference list (count only).

**Q3 Persons.** 100% of hyperlinked cast/crew captured (2,857 cast links + 686 crew links →
2,219 unique persons; 82 link targets had no article). 2,598 cast names are plain-text on film
pages (no hyperlink → out of scope by user's definition; shown as name+role only).
Bios 100%, infobox facts 94%. NOT captured: pre-2026 filmography text (85% have such sections),
awards-table details, personal-life text — headings listed + infobox awards string only.

**Q4 Trending.** Implemented & live on the home page ("What India is watching" + "Trending
people", ranked posters). Signal = Wikimedia **top-viewed-articles-per-day** bulk endpoint
(7 days, 7 requests, cached per day in `data/cache/pageviews/top-*.json`), scored with recency
weighting (`pipeline/trends-lib.ts`, tested). 49 catalogue articles currently have scores;
#1 DC (409K), #1 Wamiqa Gabbi. LESSON: the **per-article** pageviews endpoint 429s instantly —
never use it; the bulk endpoint lags ~2-3 days (walks back until data exists).
Refresh cadence: re-run `npm run pipeline:trends` (then rebuild) daily.

**State.** 80 tests green; 2,651 pages; 50,160 internal links 0 missing; trends section verified
rendering with correct joins (kind-aware links).

## Session 1 — 2026-08-16 (initial build) — COMPLETE

**Goal.** Beautiful graphical website for Indian movies & series, 2026 scope, from Wikipedia;
name/stack/design decided autonomously per user instruction.

**Decisions.**
- Name: **Chalachitra** (चलचित्र). Tagline: "The definitive guide to Indian cinema & series".
- Stack: Astro 5 static + Tailwind v4 + Vitest + MiniSearch; Node pipeline w/ disk cache.
- Port 4730 everywhere (user's non-standard port policy).

**Delivered (all verified).**
- `ANALYSIS.md` (approach eval → Astro) + `PLAN.md` (9-step contract) + `AGENTS.md`/`CLAUDE.md`.
- Wikitext parser library — 75 vitest tests green (fixtures from real pages).
- Pipeline: category walk (paginated, subcat-recursive) → batched fetch → dataset build.
  Politeness: ~1.1s pacing, Retry-After-aware backoff, per-batch skip+resume, sha1 API cache,
  per-pageid page cache (`data/cache/`).
- Dataset (2026-08-16): **365 movies, 60 series, 2,210 persons**; languages Hindi 111, Tamil 103,
  Telugu 64, Kannada 42, Malayalam 40, Bengali 18, Marathi 17, Gujarati 9 (+others).
  328/425 titles with posters; 1,403 persons with portraits; 290 titles with IMDb ids;
  cast parsed for 361/365 movies; 2,170 persons with computed credits.
- Site: home / movies(+`?lang=` filter) / series / people (A–Z) / detail pages / search
  (MiniSearch, 2,635 docs) / about / 404; JSON-LD (Movie/TVSeries/Person+BreadcrumbList),
  canonicals, OG/Twitter, sitemap, robots.txt, llms.txt; 2,642 pages build in ~5s.
- Verification: 49,976 internal links checked → 0 missing; all key routes 200 on :4730;
  code-reviewer subagent pass applied (see Fixes).

**Fixes applied after verifier review.**
1. `SITE.url` now from `import.meta.env.SITE`; robots.txt/llms.txt use route `site` context
   (canonical/JSON-LD/sitemap no longer disagree when SITE_URL is set).
2. Cross-kind slug collisions (movie `x` vs series `x`): credit lookup is kind-aware
   (`getTitleBySlug(slug, kind)`).
3. Corrupt API-cache JSON no longer kills the pipeline (guarded read + delete + refetch).
4. JSON-LD `<` escaped (`\u003c`) to prevent script-terminator breakouts.

**Data gotchas learned (important for future runs).**
- `prop=pageimages` **excludes non-free posters** (fair-use film art) → poster resolution goes
  through infobox `image` param + `imageinfo` API (see `resolveImageThumbUrls`).
- The API appends `?utm_source=…` to unscaled thumbnail URLs (both pageimages & imageinfo) →
  stripped at consumption (`cleanThumb`, and in `resolveImageThumbUrls`).
- Wikipedia rate limits hard: initial 250ms pacing drew 429s within ~40 requests; 1100ms pacing
  sustained 2,700+ requests cleanly.

**Re-run runbook.** `npm run pipeline:all` (idempotent, cache-resumable) → `npm run build`.
**Next steps for future sessions.**
- Parameterise `YEAR` (pipeline/build-dataset.ts) to add 2025, 2024… datasets.
- Korean origin: add categories + language badge map; `origin` field already exists.
- Deploy: set `SITE_URL`, host dist/ on any static host.
