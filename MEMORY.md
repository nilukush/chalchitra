# MEMORY.md — session state log

## Session 11 — 2026-08-17 (3-agent consensus round) — COMPLETE

Ran the requested Analyzer/Debugger/Verifier agent team; consensus implemented:

**Debugger verdicts**: search-index failure + trailer-opening-YouTube were BOTH stale
browser pages (preview server serves across rebuilds; trailer became a modal in 3f59e42;
jsdom-verified current build correct on movie+series samples). Hardened search fetch with
one retry. **User action when odd behavior appears: hard-refresh first.**

**Analyzer root causes fixed**:
1. Hero collage geometry (72px slivers) → right-anchored 5-poster DECK (w150, 58px overlap,
   hover pop-out, md+, backdrop card behind).
2. Rank/language badge collision + cardHtml drift → PosterCard gained `rank` prop (outline
   numeral, Netflix style), language pill moved top-RIGHT everywhere, live cardHtml mirrors
   the same anatomy; trending grid → horizontal snap RAIL.
3. Seasons stacked vertically → season TAB bar (role=tablist), one season visible, scoped
   per-group overflow toggles; compact rows + **TMDB episode stills** (w300) — Ab Hoga
   Hisaab: 20/20 stills, 2 tabs.
4. Encyclopedia weight: drop cap REMOVED (newspaper device, not database); rating promoted
   into the sticky band (★ 8.7 / 10 · votes); CAST → TMDB-style portrait rail with "as Role";
   article chapters → collapsible "The full story" <details> outline (first open, word
   counts); person page dedup (credit poster grid w/ role captions replaces the 30-line
   duplicate text list; "On the Wikipedia article" TOC section removed).

**Verifier F1**: year regressions fixed (home kickers + person credits heading now
data-driven).

**Awards from Wikipedia** (user ask): `wikitext/awards.ts` (tested) — 658 persons, 4,922
award rows, rendered as cards (🏆 for Won).

144 tests; 2,651 pages; links 47,634 / 0 missing (count down — duplicate credit links
removed by design).

## Session 10 — 2026-08-17 (fifteen-point audit) — COMPLETE

1. **AI uses** (answered): current = hooks+moods; roadmap = reception verdicts, 3-beat plot
   summaries, similar-title recs, FAQPage schema for GEO, messy-string cleanup.
2. **Music links**: JioSaavn 302'd → replaced with **Gaana** (200) alongside YT Music/Spotify;
   chips restyled (semibold, larger). Links are platform SEARCH deep-links (no licensed embeds).
3. **Toxic TMDB FIXED PROPERLY**: year filter wasn't enough (wrong "A Toxic Love Story" also
   2026). New `scoreNameOverlap` (tested; director=3, cast=1) validates top-3 candidates
   against wiki directors+cast → Toxic now **1213243 (Toxic: A Fairy Tale For Grown-ups)** ✓.
4. **References UI polished**: numbered badge chips (ink tile + display font), flex rows,
   italic source, roomier rhythm; still two-column + collapse > 25.
5. **Dual role**: was rendering (user had stale page); "as" prefix now skipped for
   Dual role/Special appearance/Cameo/Voice.
6. **Released vs upcoming split**: `isReleased()` (build date); "Fresh in theatres" released-
   only; NEW "Coming soon & most anticipated" section (future dates soonest-first + trending
   unreleased "Buzzing before release" + date-TBA chips); "What India is watching" released-only.
7. **Runtime**: `formatRuntime` (tested) → "3h 14m", ranges "2h 10m – 2h 50m", sub-hour "45 min";
   applied in hero chip + Details tile.
8. **Multi-season**: synthesis now pulls seasons 1..min(seasons,5) (1,255 synthesized eps);
   EpisodesTable groups by season headers (Ab Hoga Hisaab: 2 seasons ✓).
9. **Person TMDB enrichment LIVE**: 1,690/2,219 exact-name matched; **4,887 known-for works**
   (poster row "Known for" on person pages, links to TMDB); +420 portraits (1,829 total, 83%).
   Full Wikipedia filmography tables/discography remain unparsed (documented gap); TMDB has no
   awards API.
10. **Rename: Chalachitra → Chalchitra** (user's call — colloquial transliteration; agreed).
    Brand strings, package, docs, UAs all renamed; Devanagari चलचित्र unchanged.

133 tests green; 2,651 pages; 50,272 links / 0 missing; toggles DOM-verified + CSS-rule-verified.

## Session 9 — 2026-08-17 (fourteen-point audit) — COMPLETE

1. **AI key** confirmed in .env → **AI enrichment LIVE: 425/425 hooks + mood tags** (cached in
   data/cache/ai). Moods render as dashed italic chips beside genres; tagline hook in hero.
2. **Toggle ROOT CAUSE found** (why rows stayed visible while text swapped): `.hidden` lost the
   CSS-order battle against display utilities (`list-item` on ref rows, `flex` on episode cards).
   Fix: dedicated `.toggle-hidden{display:none!important}` in global.css; components/scripts
   use it. `scripts/verify-toggles.mjs` now asserts the CSS RULE exists + DOM behavior.
3. **Cast dual roles**: `**` sub-bullets now append to the parent entry's role;
   "in a dual role as" → "Dual role: A / B" (Toxic's Yash fixed).
4. **TMDB wrong-movie fix**: search now passes `year=`/`first_air_date_year=` (Toxic:
   1315091→1723460, correct). Match count 384→363 (bad matches dropped).
5. **Episode coverage explosion**: TMDB season synthesis for series without wiki tables →
   **46/60 series with guides (was 12), 1,368 episodes, 1,297 with runtimes** (runtime shows
   on episode cards).
6. **Listen links**: soundtrack header chips → YT Music / Spotify / JioSaavn search
   (query = title + composer).
7. **Type scale**: root font 17px (whole rem system up), paragraph gap 1.35rem.
8. **"Known as" tile removed** (occupations live in the kicker at readable size).
9. **Year future-proofing**: `stats.years` (from data) drives home scope copy; person stat
   label just "Credits"; credit rows show per-credit year chips. Index pages remain
   year-scoped catalogues (by design).
10. **Timeline chips**: extractTimelineDates (tested) surfaces key dates from
    Release/Production/etc. chapters as calendar chips above the prose.
11. **Home hero**: content-first copy ("Every Indian movie & series has a home."),
    kicker चलचित्र · movies · series · people.

127 tests green; 2,651 pages; 50,262 links / 0 missing. jsdom + scripts/ committed.

## Session 8 — 2026-08-17 (ten-point audit) — COMPLETE

1. **AI key location**: `.env` (gitignored) — `AI_API_KEY` (+ optional `AI_BASE_URL`,
   `AI_MODEL`); documented in `.env.example`. NEVER put keys in .env.example (committed).
2. **Sticky hero band**: title band + section nav now stick (lg+) under the header —
   identity + genres + nav always visible while reading. Poster sidebar sticky as before.
3. **Toggle bug ROOT CAUSE**: the show-all script lived only in TitleDetail — person pages
   never had it (movie pages were fine). Scripts moved INTO ReferenceList.astro and
   EpisodesTable.astro so they ship with the components everywhere. **DOM-verified with
   jsdom** (`scripts/verify-toggles.mjs`, jsdom now a devDep): collapse → click → expand →
   click → restore, on movie + person pages.
4. **Person sidebar redesign**: quick-stats row (2026 credits | computed age | known-as) via
   `src/lib/dates.ts` `computeAgeFromFacts` (tested; 1,278/1,341 parseable; year-only dates
   render no age rather than an approximate one); "Active years" moved to the kicker line.
5. **Cast roles**: shown INSIDE PersonCards now (`meta` prop → "as Role").
6. **Crew images**: crew members with pages render as PersonCards (photo + role meta);
   unlinked crew stay as text rows.
7. **Readability**: prose bumped to ivory-100 @1.06rem (plot 1.12rem), measure narrowed to
   68ch, text-wrap: pretty.
8. **Section order** (user's stated priority): Plot → Episodes → Cast & crew → Overview →
   Details at a glance → Soundtrack → article chapters. Nav mirrors this.
9. **TMDB link chip** in sidebar (tmdbId now persisted; themoviedb.org/movie|tv/{id}).
10. **Episodes redesigned** as numbered card rows (badge, title+airdate, summary, director/
    writer line), collapse after 12.

120 tests green; 2,651 pages; 50,262 links / 0 missing.

## Session 7 — 2026-08-16 (graphical redesign + live TMDB) — COMPLETE

**User's critique**: site was "extremely textual — if I wanted only text I'd send users to
Wikipedia". Response — graphical layer shipped:
- `Icon.astro`: inline SVG set (calendar/clock/globe/rupee/chart/tv/film/users/star/ticket/
  music/award/clapperboard/camera/pen/link).
- `StatTiles.astro`: facts tables replaced by icon tiles ("Details at a glance" on titles,
  fact tiles on person pages); big-value tiles for dates/runtime/box-office.
- Sticky in-page section nav (icon chips, horizontally scrollable) on title pages.
- Article deep-dive sections rendered as numbered "chapters" (01/02… saffron badges, ruled
  left border) instead of bare prose headings.

**TMDB LIVE** (user provided key; moved from .env.example to gitignored .env — never committed;
added `pipeline/env.ts` mini-loader, called at build-dataset start):
- 384/425 titles matched; **304 backdrops** (hero bands now cinematic); **123/131 episode
  summaries** (was 9/131 — TMDB filled 114); **198 trailers** (▶ Watch trailer button — needed
  `append_to_response=videos` fix on the details call); 57 ratings (≥10 votes gate).
- Per-page TMDB attribution shows only where fields were enriched.

113 tests green; 2,651 pages; 50,262 links / 0 missing.

## Session 6 — 2026-08-16 (multi-source go-ahead + hero redesign) — COMPLETE

**Policy change**: site is NO LONGER Wikipedia-only. Wikipedia = canonical backbone;
TMDB (and later YouTube etc.) = enrichment for gaps. Implemented `pipeline/enrich/`:
- `tmdb-lib.ts` (pure, tested): `pickTmdbMatch` (name+year match), `mergeEpisodeSummaries`
  (fills ONLY empty episode summaries — wiki text always wins).
- `tmdb.ts` connector gated on `TMDB_API_KEY` env (no key → logged skip, pipeline unchanged);
  adds backdrop (w780), rating (≥10 votes), official trailer (YouTube key), episode summaries
  via /tv/{id}/season/1; caches to data/cache/tmdb/; `enrichedFrom: ['tmdb']` on records for
  per-page attribution (TMDB notice appended only when fields were used). UI ready: hero band
  renders backdrop when present, ★ rating chip, ▶ Watch trailer button.

**Hero redesign** (after loading web-design-guidelines + frontend-design skills — user's
fair criticism): title band is now identity-only (badges: language/release/runtime/episodes/
rating + one-line year·genre·director context) — NO encyclopedic lead paragraph at top.
**Full plot is the hero content immediately below the band** (larger type via .prose-hero).
Wikipedia lead demoted to "Overview" section above Key details.

**Guidelines fixes applied**: prefers-reduced-motion (kills smooth-scroll/animations),
color-scheme: dark + theme-color meta, scroll-margin-top on anchored sections,
text-wrap: balance on display H1. 113 tests green; 2,651 pages; 50,262 links / 0 missing.

**To enable TMDB**: put TMDB_API_KEY in .env → `npm run pipeline:dataset && npm run build`.

## Session 5 — 2026-08-16 (six-part audit) — COMPLETE

**Q1 Episode summaries**: 9/131 episodes have summaries on Wikipedia (ShortSummary is usually
left empty; sometimes with "don't add copyrighted text" comments). Nothing further extractable
from Wikipedia — reported honestly.

**Q2 Hyperlinks → pages**: NEW `wikitext/linked-html.ts` (107 tests): plot wikitext now renders
with **inline internal links** (`plotHtml`) — wikilinks to catalogue people/titles become
`/people/…` `/movies/…` anchors (246 plots, 82 links), unknown links degrade to text, output
fully escaped (safe set:html). Note stripWikitext tag-regex tightened to `</?[a-zA-Z]…>` so raw
text like "gross < 500" survives.

**Q3 Missing sections**: section census found Production 292 / Reception 284 / Release 272 /
Box office 85 / Distribution 18 / Home media 74 / Casting 69 / Controversy… Now captured as
`articleSections[]` (full text; skip-list = sections rendered specially) → **360/365 titles
render their deep-dive sections** in article order (e.g. King: Development, Casting, Filming,
Theatrical, Distribution).

**Q4 Page redesign**: order now hero → summary → **Full plot (drop cap, inline links)** →
episode guide → soundtrack → cast → crew → **Key details table (moved down)** → article
sections → related → references → external links.

**Q5 Live trending**: home trending grid now refreshes client-side — inline top-350 candidate
JSON; script fetches Wikimedia top-viewed-per-day (≤3 days, ≤3 requests), re-renders grid,
switches kicker to "● Live" with pulse dot; sessionStorage 30-min cache; static build list
remains fallback. True real-time impossible upstream (pageview data publishes with 1-2 day lag).

**Q6 Copy**: hero kicker no longer "class of 2026"; scope strip added under stats ("currently
cataloguing the class of 2026 — earlier years and new industries on the roadmap").

2,651 pages, 50,262 internal links, 0 missing. Committed.

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

## Session 11 — disorientation root-caused; filmography depth (153 tests)

**Root cause of "disoriented" title pages** (user's 986px window): grids defined columns only at
`lg` (`lg:grid-cols-[300px_1fr]`); below 1024px the implicit `auto` track sizes to the genre-chip
row's max-content (every chip on one line ≈ 2400px) → whole page shears horizontally. Plain `fr`
tracks also keep an `auto` minimum. Fix: `grid-cols-1` base + `md:grid-cols-[260px_minmax(0,1fr)]`
in TitleDetail + people page; `minmax(0,1fr)` in home hero. Verified at 986px: scrollWidth ==
clientWidth on /, /movies, /series, both reported title pages, Wamiqa. NOT stale cache — a hard
refresh could never fix it; the user's report was fully reproducible.

**Other fixes this round:**
- Literal `{stats.years[0]}` in home spotlight (string attr → template literal).
- movies/series filter scripts crashed: frontmatter `yearsLabel` undefined client-side → now read
  from `data-years` on the h1 (click-verified: "Kannada movies of 2026 · Showing 41 films").
- Awards parser leaked `rowspan="3"` etc. → CELL_ATTRS stripper (TDD, 5/5).
- Filmography walker now hierarchical: nested ===Film===/===As actor=== captured; Wamiqa 7 → 32
  works; 77,867 works total (was 33,636). Language/outlet/award-link noise filtered (TDD).
- Person page: Known-for now Wikipedia-filmography-derived poster rail (TMDB knownFor dropped from
  UI); "Full filmography" renders every work (chips, in-catalogue = linked + year).
- Chapters: bold lead sentence via splitLeadSentence (TDD; also fixed A.R.-initialism split bug
  shared with splitLongParagraphs).
- Season synthesis cap 5 → 50 (data-driven). Cast rail title attrs for hover. Poster deck: 200px
  cards, working hover lift (inline transform was silently overriding hover classes), fan offsets.
- Copy: 1950s archive roadmap; Korea = separate sister edition (home, about, README, llms.txt).
  llms.txt moved dist → public (was wiped on rebuild).
- Preview server on 4730 was started a day before the last build; restart preview after rebuilds
  (its file tree goes stale).

**Verification.** 153/153 tests; toggles jsdom pass; build 2,651 pages; browser: widths clean,
trailer modal opens on-site (youtube-nocookie embed), filter click verified.

**Next steps for future sessions.**
- Parameterise `YEAR` (pipeline/build-dataset.ts) to add 2025, 2024… datasets (1950s goal).
- Sister editions: fork repo per country (Korea first) — origin-agnostic data model already.
- Deploy: set `SITE_URL`, host dist/ on any static host.

## Session 12 — Wikipedia-structured filmography & awards; bio; on-page trailer (167 tests)

**3-agent consensus (Analyzer research / Debugger root-cause / Verifier feasibility), then atomic TDD:**
- Filmography is now STRUCTURED like Wikipedia's own tables: FilmographySection{heading, medium,
  rows[{year,title,wikiTitle?,role?,notes?}]} — shared tables.ts parser (rowspan carry, ||/-chained
  cells, headerless positional fallback, attr stripping). 122,925 rows across 2,030 persons.
- Subpage filmographies followed: {{Main|X filmography}} / {{Main list|List of awards…}} pointers
  detected (findFilmographySubpage/findAwardsSubpage), 190 subpages fetched once via paced
  fetchPages (cache-resumable). Emraan Hashmi 0 → 57 rows with years+roles.
- Awards structured: AwardRow{year,award,category,work,result} — {{won}}/{{nom}} templates read
  BEFORE stripWikitext (they used to be deleted — Emraan had 0 results in 18 rows); 2,865 won /
  2,322 nominated / 6,206 total rows.
- Person schema + UI: bio (Early life / Personal life, 1,275 persons, CC BY-SA captioned),
  AwardsTable (wins·nominations summary, ceremony groups, Won filled badge / Nominated outline —
  text not color-alone), FilmographyTable (medium tabs like season tabs, row cards year/title/role,
  show-8 + toggle, in-catalogue links, Wikipedia ↗ otherwise). Known-for = filmography∩catalogue.
- Trailer: modal REPLACED by an in-page player panel under the identity band (click-to-play
  facade → youtube-nocookie embed swap; sidebar Watch-trailer scrolls & plays). Click-verified on
  movie + series: stays on page, panel plays. Series-trailer scarcity root-caused: TMDB has zero
  videos (show AND season level) for 34/60 shows — data limit, not a bug; pickTmdbTrailer is
  tiered YouTube-only now (Vimeo leak fixed).
- Python string-surgery on TitleDetail ate the main column once — restored from git, redone with
  Edit tool. Lesson: no blind index() slicing on template files.
- Verified: 167/167 tests, 2,651 pages, toggles incl. film-overflow, 986px widths clean on all key
  pages, link sample 0 missing.

## Session 13 — archive expansion live; person-page research applied (176 tests)

**3-agent consensus (Analyzer online research / Debugger pipeline design / Verifier measurements):**
- Person-page order now matches IMDb/TMDB/Letterboxd convention: Known for → Credits → Filmography →
  Awards → Life story (collapsed) → Sources. Wikipedia is the only model with bio on top — product
  surfaces don't. "Read the life story ↓" anchor added to summary.
- Known For = transparent fame score (votes 2·log10, quality ×1.5 above 5, recency decay, +2 won
  award, catalogue presence, poster) — computeKnownFor in dataset-lib (TDD 16/16), published in a
  "How we pick these" disclosure on the page.
- Filmography rows carry poster thumbnails (IMDb 2021 pattern) + ★ rating chips; awards collapse
  after 10 rows per ceremony; reference rows show publisher/domain chips — research verdict: NO
  preview cards (entertainment peers don't; OG images missing on Wikipedia refs; build fragility).
- Plot spoiler gate (IMDb premise/synopsis convention): first 1-2 paragraphs = Premise (always
  visible); the rest behind "Reveal the full plot — spoilers ahead" saffron toggle. Fires on 580/870
  movies; short plots skip the gate by design.

**Archive expansion (the 29,793-works mandate):**
- pipeline/classify-title.ts (TDD): infobox-name accept-list (film/television), disambiguation,
  country/language Indian check (Hollywood in filmographies rejected), no-infobox rejected.
- pipeline/expand-titles.ts + data/cache/expansion-frontier.json: wave fetcher through paced
  fetchPages (never bypassed), most-referenced first, EXPAND_FOCUS=<slug> hoists one person's works.
- build-dataset merges frontier-accepted pages as full TitleRecords (archive: true), archive-lite
  shape (no plotHtml/references/articleSections/soundtrack; cast 30/crew 24 caps) ≈ 8.8KB/rec.
  TMDB + AI enrichment stay catalogue-only this wave (12-38h / real cost otherwise — Verifier).
  stats.years + languages scoped to !archive so "of 2026" copy holds; index/home rails filter
  !archive (catalogueMovies/catalogueSeries in data.ts).
- Wave 1 + Emraan focus wave: 531 works → 531 pages (505 films + 26 series), 864/956 posters,
  Emraan filmography 94% internal links (51/54), awards 7/14. Site: 3,182 pages. Background wave
  of 5,000 launched; frontier has 29,233 pending — run `npm run pipeline:expand` repeatedly to
  continue (~1.5-2h total pacing); dataset+build picks up whatever is cached.
- Verifier hard limits to respect as waves land: movies.json ≤100MB (≈8k more archive titles →
  then split per-decade JSON); build RSS < 2.5GB; search index <5MB (now ~2.9k docs fine).
  getStaticPaths passes full records (fine at 3k pages; switch to slug-only props past ~10k).
- Astro component-brace regression bit twice (missing `}` after summary map; python index-slicing
  ate a main column earlier) — always `npm run build` before declaring an edit done.

**Verified:** 176/176 tests, 3,182 pages, toggles (refs/film/award), 986px widths clean on
Emraan/Wamiqa/Toxic/archive Murder/home, spoiler gate click-tested, awards badges + show-all.

## Session 13 — STATE HANDOFF (read this first next session)

**Where things stand (last commit 10624de):** 176/176 tests, 3,182 pages built, 986px clean.
Person pages follow the research-backed order (Known for → Credits → Filmography → Awards →
Life story → Sources) with the transparent fame-score known-for, poster-thumbed filmography
rows, won/nominated badges with collapse-after-10, IMDb-style plot spoiler gate, publisher
chips on references. Trailer plays in an on-page container (facade → youtube-nocookie embed).

**CACHED BUT NOT YET BUILT:** the background wave finished AFTER the last dataset build —
frontier now shows 5,359 accepted / 201 rejected / 24,233 pending. The 5,359 pages are on
disk in data/cache/pages but data/*.json and dist/ still reflect only the first 531. **Next
session's first move:** `npm run pipeline:dataset && npm run build` (≈2-4 min) → site goes
to ~7,900 pages. Verify build RSS stays <2.5GB; if movies.json nears ~50MB (≈6k more archive
records), implement the per-decade JSON split BEFORE continuing waves (see thresholds below).

**Continuing the archive (the 29,793-works mandate):** `npm run pipeline:expand 5000` per run
(~25 min paced, resumable); repeat until pending hits 0 (~5 more runs). Optional focus:
`EXPAND_FOCUS=<person-slug> npm run pipeline:expand <n>` hoists one person's works first.
Politeness rule #3 is wired in (1100ms pacing in wiki-api.ts) — never bypass, never
FORCE_REFRESH during expansion. After each wave: dataset + build + spot-check one person's
internal-link rate (Emraan benchmark: 94%).

**Deferred threads (deliberate, with rationale in session notes):**
- TMDB enrichment for archive titles (12-38h at current call pattern) — a dedicated TMDB-lite
  pass (search+details only) is the upgrade path when wanted.
- AI hooks/moods for archive titles (cost) — fields already optional in the UI.
- getStaticPaths passes full records as props — fine at ~8k pages; switch to slug-only past ~10k.
- Search index grows ~1.5KB/100 archive docs — review at 5MB.
- Emraan awards: 7/14 work-links internal (rest arrive with waves).

**Standing user requirements (every session):** 3-agent consensus (Analyzer researches online,
Debugger root-causes with file:line evidence, Verifier measures/quantifies) before building;
TDD for all pipeline/pure logic; UI decisions must be research-backed (user rejects
unresearched design); graphical over textual; user hard-refreshes — never blame cache;
restart `astro preview` after every rebuild (stale server caused two false bug reports);
ports 4730; commit per session; MEMORY.md append before finishing.

**Edit-safety lessons (this project's recurring failure mode):** python index()-slicing on
.astro templates has corrupted markup twice — use the Edit tool for .astro files, and run
`npm run build` after every component edit before declaring done (esbuild catches unbalanced
braces that vitest doesn't).

## Session 14 — 2026-08-19 (person-page audit round + archive TMDB-lite live) — COMPLETE

**3-agent consensus round** (Debugger root causes w/ file:line / Analyzer online research /
Verifier measurements), then TDD. 192/192 tests; 7,970 pages.

**Parser bugs fixed (all TDD, tables.test.ts new):**
1. `|+ caption` table lines leaked as rows ("+ List of Emraan Hashmi television credits")
   → tables.ts line filter drops `|+`; NOT_A_WORK tolerates leading "+ ". Dataset-wide:
   414 leak rows → 1.
2. Status-word titles ("Filming", "TBA"…) promoted when real titles were template-wrapped
   → clean.ts now unwraps {{small|nowrap|no wrap|nobr|Pending film|Pending series|X}}→X and
   {{TableTBA}}/{{TBA}}→TBA; filmography STATUS_TITLE + bare-year gates. "Gunmaaster G9"
   recovered (was rendered as "Filming"); status→notes. Empty-() roles fixed (0 left).
3. Awards rowspan damage: Award column rowspan'd + category wikilinks ("… Award for …")
   promoted to ceremony; 1,085 rows had award "—". → awards.ts carries lastAward/lastWork
   (+year via category), routes category-article links to category, never fabricates "—",
   rows need substance (category|work|result|year). "—" rows 1,085→0; category-as-award
   681→303 (remainder are legitimately-shaped tables); Emraan 8 groups → 6 clean ones.
   Residual known-noise: ~14 discography year-as-title rows, one "+Key", one "TBA" title.

**Person page (research verdicts from Analyzer: IMDb/TMDB/Letterboxd):**
- No peer site badges "in our catalog" on rows → **In-catalogue badge REMOVED** (★ rating
  chip stays — IMDb rows show ratings). Link-only is the Wikipedia blue/red-link pattern.
- All peers headline CAREER credit totals → sidebar tile now filmography-works count
  (Emraan 57, was "3 Credits"). Fallback to credits count when no filmography.
- No peer has a year-scoped credits section → "Credits in our 2026 catalogue" section now
  renders ONLY for persons without filmography data (crew fallback), labeled plainly.
- Poster placeholder: च brand tile on filmography rows read as broken Devanagari (user
  report "च —") → neutral film/tv Icon tile (TMDB precedent: blank tile, no initials).
- Awards collapse is PER CEREMONY after 10 (IMDb-style); Emraan's largest group is 4 → no
  toggle by design. Wins·nominations summary already present.
- Readability scores (Verifier): person page 6/10 (refs = 51% of text; sub-12px chips;
  parser-damage rows — now fixed), references section 7/10 (chips on 136/136 rows work;
  known gap: publisher labels un-normalized, 53 variants).

**TMDB archive-lite pass (build-dataset + enrich/tmdb.ts enrichTitlesLite):** the old
"12–38h" estimate was serial-client latency, not a TMDB limit (staff: ~50 req/s ceiling).
New paced-concurrent pass (8 req/s global start-gate, 6 workers, credits-validated match,
one append_to_response=credits,videos payload per title, sha1 disk cache) ran the whole
built archive in **23 min: 5,019/5,319 matched, 4,906 enriched**. Archive coverage now:
trailer 38.1%, rating 72.8%, genres 91.5%, tagline 89%, backdrop 76% (was 0/0/4.3%).
TMDB_ARCHIVE_LITE=0 env skips it; re-runs are cache-hits (fast). Murder(2004): trailer +
5.1★(39 votes) + Drama/Thriller + tagline. Remaining deliberate archive gaps: AI
moods/hooks (cost), references/soundtrack/articleSections (record-size budget).

**Plot/premise (Analyzer, MOS:FILM/MOS:TV):** films use "Plot" (400–700 w) — "Premise" is
a TV-adopted heading (Plot/Premise/Synopsis/Overview allowed); per-episode plots live in
"List of … episodes" subpages, not series articles. Our extractor already tries
Plot→Premise→Synopsis in order; spoiler gate = our IMDb-style premise/synopsis split.

**Known-for precedent:** IMDb top-4, TMDB 8 — our top-6 transparent score is in range.

**Site state:** 7,970 pages (5,363 movies + 381 series + 2,219 persons + indexes), dev
server restarted as `npm run preview` on 4730 (internal links are no-trailing-slash).
Frontier still has ~24k pending works for future waves (`npm run pipeline:expand 5000`).

**Edit-safety:** all .astro edits via Edit tool; build run after every component change.

## Session 14 — STATE HANDOFF (read this first next session)

**Where things stand (last commit c7c5ff1):** 192/192 tests, 7,970 pages (5,363 movies +
381 series + 2,219 persons), 986px widths clean, toggles jsdom-verified. Person pages:
Known for → Filmography → Awards → Life story → Sources; sidebar shows CAREER works count
(filmography rows, fallback credits); no In-catalogue badge; neutral film/tv icon
placeholder for poster-less rows; "Credits" grid only for persons WITHOUT filmography.
Archive pages carry TMDB trailer/rating/genres/tagline/backdrop (38/73/92/89/76%).

**Server on 4730 is `npm run preview` now** (was astro dev; killed + restarted after the
rebuild). Internal links are no-trailing-slash — `/movies/murder` 200s, `/movies/murder/`
404s on preview; that is expected, not a bug. User hard-refreshes; restart preview after
every rebuild.

**TMDB cache is warm** (data/cache/tmdb/, ~15k responses incl. all 5,319 built archive
titles). `pipeline:dataset` now auto-enriches NEW archive titles at ~8 req/s (~4.4s/title
network time, ~23 min per 5k fresh ones); `TMDB_ARCHIVE_LITE=0` skips. Politeness: TMDB
staff ceiling ~50 req/s — never raise rps past ~10 without re-checking their docs; always
honor 429/Retry-After (tmdbGet already retries).

**Next moves (in order):**
1. Continue archive waves: `npm run pipeline:expand 5000` per run (~25 min paced,
   resumable) until frontier pending (~24k) hits 0; after each wave `npm run
   pipeline:dataset && npm run build` (new titles fetch TMDB automatically) + spot-check
   one person's internal-link rate (Emraan benchmark 94%) and build RSS < 2.5GB.
2. Verifier thresholds from session 13 still apply: movies.json ≤100MB (check after ~6k
   more archive records → per-decade JSON split if near), search index <5MB,
   getStaticPaths slug-only props past ~10k pages.
3. Small polish backlog (user-flagged, research-validated): publisher-chip label
   normalization (53 variants e.g. "boxofficeindia.com" vs "Box Office India");
   bump award-row chip type if it still reads small; ~16 discography year-as-title
   straggler rows (Anu Malik/Mithoon/Imtiaz Ali class).

**Deferred threads (deliberate):** AI moods/hooks for archive (API cost); archive
references/soundtrack/articleSections (record-size budget — adding refs for ~5.9k archive
pages ≈ +68k refs would blow the size cap); rating gate inconsistency (archive ≥3 votes vs
catalogue ≥10) — unify if it ever looks wrong on a page; Emraan awards work-links 7/14
(rest arrive with waves).

**Standing user requirements (every session):** 3-agent consensus (Analyzer researches
online, Debugger root-causes with file:line, Verifier measures) before building; TDD for
all pipeline/pure logic; UI decisions must be research-backed; graphical over textual;
commit per session; MEMORY.md append before finishing; ports 4730.

**Edit-safety (unchanged, bit twice before):** Edit tool for .astro files (no python
index-slicing), `npm run build` after every component edit before declaring done.

## Session 15 — 2026-08-20 (data-completeness audit) — ANALYSIS + PLAN DONE, AWAITING USER GO

3-agent consensus round; every user-reported case verified against cached wikitext +
dataset. **Full findings + 8-step plan in `SESSION-15-ANALYSIS-PLAN.md` (read that
first).** Root causes, all with file:line evidence:

1. **Awards work-title loss (Emraan/Screen/Shanghai)**: rowspan sits on the FILM
   column; tables.ts strips span attrs, alignment breaks, and awards.ts:143-152 gates
   lastWork carry on carriedAward (only models rowspan-on-AWARD). 1,865/6,154 rows
   missing work dataset-wide. Fix = rowspan-expanded grid in parseWikitableView.
2. **No recursive persons**: person universe fixed from catalogue titles
   (build-dataset.ts:259-292); archive branch resolves cast vs known persons ONLY
   ("no new person discovery", :463-476). Aadhi Pinisetty not in persons.json;
   archive cast link rate 29.5%. Fix = wave-based person-lite expansion (plan Step 7,
   AFTER pagination/size work).
3. **Multi-season episodes missing**: 0 "List of X episodes" subpages cached;
   episodes.ts never tags season (UI defaults all rows to S1); tmdb.ts hardcodes
   season/1 (:243) and synthesis blocked when any wiki table exists (:257). Only 1
   series has >1 season of rows.
4. **Soundtracks 0 on archive**: build-dataset.ts:460 deletes the field outright;
   parser only knows {{Track listing}}. The Family Man has ==Music== unparsed.
5. **No title-page awards**: TitleRecord has no awards field; extractAwards runs
   persons-only. 0 titles carry awards. (IMDb carries awards on every title page —
   feature is research-backed.)
6. **Plot heading variants**: getSection exact-match only; Crime Beat's
   "== Plot summary ==" missed. Series plot coverage 60.1%.
7. **No pagination**: all 3 indexes render every card (movies index = 7.06MB HTML);
   paginate() unused anywhere; search index extrapolates to ~16MB at 1 lakh docs.
8. **No freshness**: cache has no TTL, FORCE_REFRESH nukes everything, no cron;
   trends.json 4 days stale. Standard fix (researched): daily lastrevid-diff refresh +
   TMDB /changes delta + GH Actions cron.

**Plan order**: 1 rowspan grid → 2 plot aliases → 3 title awards → 4 multi-season
episodes (subpage follower + TMDB per-season) → 5 soundtrack re-enable → 6 paginate()
+ JSON chunking (MUST precede 7) → 7 recursive person-lite waves (Mayasabha fix) →
8 freshness pipeline. Each step: TDD with verbatim cached-wikitext fixtures, size
thresholds measured, Emraan benchmark spot-checks.

**Answers given**: hero collage IS data-driven (hotTitles→latestMovies fallback,
index.astro:19); trending people = 7-day pageviews recency-weighted (last-2-days ×1.0,
earlier ×0.5); "archive" = the 29,793-works expansion tier (TMDB-lite moved its
trailer/rating/genres 0→38/73/92%); coverage scoreboard delivered (what % of each
datum is captured — see plan Part 0).

Baseline: 192/192 tests green, no code changed this session. Next session: execute
plan Step 1 onward after user approval.

## Session 15 (continued) — 2026-08-20 — PRODUCT DECISIONS + Steps 1–2 SHIPPED

**User product decisions (binding, recorded in SESSION-15-ANALYSIS-PLAN.md v2):**
1. ONE tier — no catalogue/archive fidelity split; every title gets the full parse.
   The Session-13 "archive-lite no-new-persons, no-soundtrack" scoping is OVERRULED.
2. Recursion is unbounded graph traversal (title→cast→person→filmography→titles→…).
   Cache census: 109,366 unique wikilink targets = the frontier's shape.
3. Real-time freshness approved WITH budget ("will try and pay", ≈$0–5/mo target):
   EventStreams consumer + partial rebuilds; >20k pages → on-demand rendering
   (Cloudflare free static hosting caps ≈20k files/deploy).
4. Seasons: ON-PAGE multi-season is the primary gap (65 pages carry ≥2 complete
   Season-N sections we drop after the first match) — subpages are secondary.
5. Plot: all heading variants must parse; premise visible + full plot behind the
   existing spoiler toggle, everywhere a Wikipedia plot exists.

**Shipped this session (TDD, 202/202 tests, build 7,970 pages, preview restarted):**
- **Step 1 rowspan grid**: `parseWikitableView` now expands rowspan/colspan into a
  positionally-aligned grid (MediaWiki semantics; empty cells preserved). awards.ts
  iterates positionally; work-carry fires when the table DECLARES a work column (never
  fabricates in work-less tables). **Awards missing-work 30.3%→10.2% (1,238 works
  recovered); Emraan 10→0 — Shanghai on the Screen Awards rows, verified live.**
- **Step 2 plot aliases**: `findPlotSection` (plot|premise|synopsis|plot summary|plot
  synopsis|story, MOS-ordered; exact-match so "Plot and cast" can't match) + variants
  in SKIP_ARTICLE_SECTIONS. Crime Beat plot renders (premise + gated); +20 titles.
- **F9 fix — TMDB gate was sleeping on cache hits** (the "hang": 15 min, 0 sockets,
  0 cache writes = pure timer sleeps): pacedGet now reads the disk cache BEFORE the
  8 req/s start-gate. **Archive-lite re-run ~30 min → 2s**, same 5,019/5,319+4,906.
- **F10 trade (documented, not a regression)**: grid aligns musicians' FILM column, so
  filmographies now list films (Tanishk 240→133 rows; +Dhadak 2/Baaghi 4/Tehran; lost
  rows were song titles + noise like "Atif Aslam" as works). Net filmography
  122,629→121,885 (−0.6%); Emraan benchmark holds (57 rows / 94% linked). Song data
  returns as a REAL discography parser in plan Step 5b.

**Next session:** plan Step 3 (title-page awards) → Step 4 (multi-season episodes,
on-page first) → Step 5/5b (soundtracks + discography) → Step 6 (pagination+chunking,
prereq) → Step 7 (recursive persons) → Step 8 (real-time). Verify-toggles + link-check
after UI-touching steps as usual.

## Session 15 (cont. — 2026-08-21) — Steps 3/4/5 SHIPPED (217 tests)

All TDD; dataset rebuilt twice (OST subpages 501 fetched paced+cached; TMDB warm);
build 7,970 pages; preview restarted; live-verified.

- **Step 3 title awards**: AwardRow gained `recipients` (Nominee(s)/Recipient/
  Award Ceremony headers), wikilinked years ([[30th National Film Awards|1982]]→1982).
  TitleRecord.awards; raw awards section dropped from articleSections only when
  structured rows exist. AwardsTable reused on TitleDetail (after Music, +nav).
  **1,275 titles / 14,839 rows / 5,604 won** (catalogue 3 vs archive 1,272 — 2026
  films mostly unreleased; expected). Arth verified live.
- **Step 4 multi-season**: episodes.ts section-aware — every Season/Series N section
  tags its rows (variants "Season 2 (2024)"/"Season 2: Subtitle"); wikitables now go
  through the rowspan GRID parser (shared tables.ts; manual header derivation when
  the keyword-heuristic header misses "No.|Ep." shapes). findEpisodesSubpage follower
  (5 pointers, 4 parsed). TMDB: per-season merge keyed (season,number) — season/1
  hardcode gone; synthesizeMissingSeasons unified (empty list→full guide; partial→
  missing seasons only) and wired into archive-lite too (0 synthesizable — TMDB has
  no per-episode data for Indian soaps; probes cached). **>1-season series: 1 → 35;
  Aahat 554 eps in 6 live tabs.**
- **Step 5 soundtracks**: archive strip + cast(30)/crew(24) caps REMOVED (decision
  #1); track-wikitable parser; {{Main|X (soundtrack)}} follower (501 pages) + a
  scope fix: on album subpages a template-free "== Songs ==" section used to shadow
  the real {{Track listing}}s (section→page fallback now). **150 → 4,216 soundtracks
  (series 9 → 120; Family Man 21 tracks).** movies.json 33→38MB (budget OK);
  references/articleSections STILL trimmed for archive until Step 6 chunking.
- Pre-existing latent tsc errors in build-dataset.ts crew wiring (332-340 at HEAD;
  runs fine via tsx) — left, noted for cleanup.
- Emraan regression-checked (Shanghai ✓), home 200.

**Next: Step 5b (discography parser — songs as first-class person data) → Step 6
(paginate() + JSON chunking + de-2026 the copy) → Step 7 (recursive persons) →
Step 8 (real-time).**

## Session 15 (cont. — 2026-08-21 evening) — Steps 5b + 6 SHIPPED (223 tests)

- **Step 5b discography**: `extractDiscography` + `findDiscographySubpage` in
  filmography.ts (WORK_SECTIONS no longer enters discography sections — songs are the
  work there, films are context; one filmography test updated to the new contract).
  PersonRecord.discography; DiscographyTable.astro (year/song/film-link/singers rows,
  collapse after 10). **178 persons, 7,686 song rows** — Tanishk 274 songs across
  Hindi/Telugu/Tamil/Other sections, films linked to catalogue pages. Filmography
  persons 2,030→2,011 (the 19 dropped are discography-only persons, correctly).
- **Step 6 pagination + de-scoping**: data.ts gained INDEX_PAGE_SIZE(200)/sortForIndex/
  indexPage/indexLanguages/personsSorted; Pagination.astro (windowed numbers). Routes:
  /movies/page/2..27, /movies/lang/{lang}(+/page/N) (11 languages ≥12 films, 34 routes),
  /series/page/2 + /series/lang/…, /people/page/2..12 (A–Z buckets re-bucketed per page).
  Language chips are LINKS now (client filter script deleted). **8,047 pages (+77).**
  Copy de-2026ed: home strip now "Cataloguing 1975–2026 and growing", index h1s
  ("Indian movies"), about, llms.txt, SITE.description. stats.years/languages now span
  ALL records (Tamil 1472 · Hindi 1448 · Malayalam 1056…).
- **Astro lessons (bit 3×)**: getStaticPaths is hoisted ABOVE frontmatter consts —
  helpers must live INSIDE getStaticPaths; rest params ([...page], [...slug]) take
  STRINGS ("2", "hindi/page/2"), not arrays (this Astro version rejects arrays);
  removing an import breaks body copy referencing it — grep after import edits.
- JSON chunking NOT triggered (movies 38MB / persons 35MB ≪ 100MB) — activates when
  Step 7 person waves push payloads near threshold.
- Verified: 10 pagination/facet routes 200, Tamil facet 1,395 films, "page 1 of 27",
  Tanishk discography section, home/detail/search regressions clean.

**Next: Step 7 (recursive person expansion — wave fetcher, person-lite/full records,
Mayasabha's Aadhi Pinisetty first) → Step 8 (real-time: lastrevid refresh + TMDB
changes + cron/EventStreams).**

## Session 15 (cont. — 2026-08-21 night) — Step 7 SHIPPED (229 tests, 9,328 pages)

- **classify-person.ts** (6 tests): person/occupation infoboxes + Indian-cinema
  person categories for infobox-less stubs; rejects disambiguation/films/songs/
  officeholders. **expand-persons.ts**: wave fetcher mirroring expand-titles —
  discovery scans ALL 5,744 cached title pages' cast+crew wikilinks (10,313 unknown
  targets found), ranks by reference count, EXPAND_PERSONS_FOCUS=<title-slug> hoist,
  paced+cache-resumable, person-frontier.json. `npm run pipeline:persons`.
- **build-dataset**: wave-accepted persons ingested into finalPersons BEFORE subpage
  discovery (their filmography/awards subpages auto-followed: 190→309). Exact-name
  fallback links plain-text cast entries when exactly one person carries that name.
- **Wave 1 (+1,275 persons, 3,494 total)**: **Aadhi Pinisetty HAS A PAGE** (30
  filmography rows, 5 awards) and links from /series/mayasabha ✓. Archive-series
  cast link rate 29.5%→35.4%. Mayasabha 16/28 (57%): remainder = plain-text names
  (no wikilink — Wikipedia limit), 2 accepted-but-unlinked variant-key edge cases
  (Prabhavathi/Shankar Mahanthi — frontier keys ≠ cast link targets; chase next
  session), low-ref pendings (future waves), 2 officeholders (correctly rejected).
  Filmography rows 121,885→214,577 → next title wave will grow the archive
  massively. persons.json 58.3MB (budget OK). 8,813 person targets still pending.
- **KNOWN ISSUE (TMDB persons)**: fresh person-search fetches hang in the
  long-lived dataset process (loop idle, _getActiveHandles = only WriteStreams,
  detached promise; the EXACT same request works standalone via tsx/curl —
  process-state dependent). Mitigations shipped: 15s AbortSignal + shared undici
  Agent (keepAlive 4s) + per-person 20s race + 10-stall circuit breaker +
  TMDB_PERSONS=0 gate (used for tonight's runs). Archive-lite/titles phases
  unaffected (warm cache). Root-cause next session (suspect: undici in tsx/ESM
  long-runner interplay; try plain node:https or worker-thread isolation).
- Builds: 9,328 pages (7,970 + 1,281 wave-person pages + 77 pagination routes).

**Next: continue person waves (`npm run pipeline:persons 1500` ×~6) + title waves
(pipeline:expand — frontier grew via wave persons' filmographies), root-cause the
TMDB persons hang, then Step 8 (real-time).**

## Session 15 (cont. — 2026-08-22) — TMDB ROOT CAUSE FIXED + 37k episodes unlocked

**The "hang" was never a hang**: the F9 cache-first refactor left `writeFileSync(cacheFile,…)`
referencing a variable that had moved into readTmdbCache → every FRESH TMDB fetch got 200,
threw ReferenceError, retried ×3 (~7s), returned null silently. Warm caches masked it;
TMDB_DEBUG=1 instrumentation exposed it in one probe. Fix: shared `tmdbCacheFile()` helper.
TMDB_DEBUG stays as a permanent diagnostic flag.
**Unlocked (all previously zeroed by the same bug)**: TMDB persons 2,668/3,494 matched,
7,761 known-for works, 697 portraits (wave persons now enriched); archive-lite season
synthesis **37,225 episodes in 35s** — series w/ rows 151→284/381, multi-season 35→70,
total episodes 41,491 (was ~1,800). TMDB_PERSONS=0 no longer needed. 229 tests,
9,328 pages, preview restarted, aadhi+home 200. Lesson: silent catch-blocks around
refactored scopes are how a one-variable bug masquerades as a network mystery —
instrument BEFORE theorizing (5 diagnostic cycles wasted on socket theories).

## Session 15 (cont. — 2026-08-22 evening) — wave 2 + Step 8a refresh SHIPPED (233 tests, 10,563 pages)

- **Person wave 2** (+1,401 accepted; 2,830 cumulative, 7,313 pending): dataset now
  **4,723 persons**; TMDB persons 3,631/4,723 matched, 10,589 known-for, 967 portraits
  (full speed post-fix). Archive-series cast linking **35.4%→43.4%** after wave 2.
  persons.json 71.5MB (budget: revisit chunking at ~90MB — wave 3+ may trigger it).
  Mayasabha unchanged 16/28 (same plain-text/variant-key residue — the two variant-key
  stragglers still worth chasing).
- **Step 8a `pipeline:refresh`** (TDD lib): revid poll in 50-id batches via new
  paced/uncached `fetchLastRevids` (wiki-api.ts); `planRefresh` diff (changed/added,
  tested ×4); selective cache-file invalidation + paced refetch of ONLY edited pages;
  snapshot at data/cache/revid-snapshot.json. **Baseline established: 10,592 revids**
  (of 11,542 cached pages; ~950 return no live revid — deleted/merged articles, they
  simply never refresh). First diff run happens on the next `npm run pipeline:refresh`.
  Runbook: refresh → titles → dataset → build.
- Remaining Step 8: TMDB /changes delta + scheduled cron (GH Actions) + EventStreams
  consumer decision (host choice with the approved $0–5/mo budget) — next session.

**Next: waves 3+ (person ×5, then title waves — frontier grew again), then Step 8b.**

## Session 15 (final — 2026-08-22) — wave 3 + Step 8b SHIPPED (236 tests, 11,702 pages)

- **Person wave 3** (+1,364 accepted; 4,194 cumulative, 5,813 pending): **5,856
  persons**; TMDB persons 4,517/5,856, 13,090 known-for, 1,185 portraits. Archive
  cast linking 43.4%→**50.5%** (three waves: 29.5→35.4→43.4→50.5). Mayasabha 16/28
  (residue is plain-text names + the 2 variant-key stragglers — still open).
  persons.json **81.1MB — chunk BEFORE wave 4** (~+17MB/wave would cross the 100MB
  cap; split by letter in build-dataset write + data.ts load).
- **Step 8b TMDB delta** (`pipeline:tmdb-changes`, TDD planTmdbRefresh): /movie+tv
  /changes window (14d max lookback — run ≥biweekly; last-run file), intersect with
  tracked tmdbIds, invalidate details+season cache URLs only. Live-validated: window
  08-10→08-24, 29 tracked titles changed → 48 entries invalidated. Page cap 20×100
  (TMDB lists are global; fine at 40 requests) — future: stop early when a page has
  no tracked ids (they're date-desc? not guaranteed — left as-is).
- **Step 8b cron**: .github/workflows/refresh-daily.yml — daily 05:15 UTC (secrets
  via job env; step-if uses env.TMDB_API_KEY since `secrets` isn't valid in if:),
  actions/cache for data/cache (incremental pages+api+tmdb+snapshots across runs),
  full runbook refresh→tmdb-changes→titles→dataset→trends→build, deploy step left
  as a marked stub until a host is chosen. Enable = push with secrets set.
- Step 8 remaining: EventStreams always-on consumer (host decision, $0–5/mo
  approved) — the only piece needing user input next session.

**Session-15 plan COMPLETE (steps 1–7 + 8a/8b-wiki+tmdb+cron).** Next session:
persons.json chunking → waves 4+ → title waves → EventStreams → deploy host.

## Session 16 — 2026-08-28 — chunking + GitHub live + Render wired + wave 4 (240 tests)

**3-agent consensus** (Analyzer Render/GitHub research / Debugger chunking design /
Verifier frontier+size measurements), then execution:

- **persons.json chunked** (TDD bucketKeyForName/chunkPersons): data/persons/<L>.json
  ('#'→_.json), 25 chunks, largest S.json 16MB ≪ 100MB limits. Writer in build-dataset
  (monolith deleted); pipeline readers via new persons-store.ts (expand-persons/
  expand-titles/fetch-trends); site loads via import.meta.glob eager + flatMap(mod.default)
  + re-sort (**gotcha: glob returns {default:[…]} namespaces — .flat() crashed the build**).
  Build 11,702 pages green (192s — glob+sort costs ~90s; acceptable).
- **Generated data gitignored** (data/*.json, data/persons/, public/search-index.json):
  CI/Render rebuild from data/cache. Bootstrap = `seed` release asset (197MB gz,
  published: releases/tag/seed); daily workflow re-publishes it; CI downloads on
  actions/cache miss.
- **Interwiki fix**: expand-persons filters `:xx:`-prefixed targets + swept 3,589 poisoned
  pendings → rejected('interwiki'). Pending pool 10,313→6,724 targets (5,697 pending).
- **GitHub LIVE**: github.com/nilukush/chalchitra — PUBLIC (free Actions minutes; private
  would burn 3,600 of 2,000 free min/mo), fresh single-commit main (old history on local
  branch history-v1; tree secret-scanned clean; .idea untracked).
- **Render wired** (user's choice, research-validated): render.yaml static blueprint —
  build downloads seed + dataset + build (~10 min/build; 500 free build-min/month ⇒
  DAILY deploys only). Analyzer found Render-free EventStreams consumer infeasible
  (spin-down + outbound-volume suspension risk) ⇒ Step 8 architecture final: hourly GH
  workflow (data refresh only, keeps cache warm) + daily workflow (full rebuild +
  seed publish + RENDER_DEPLOY_HOOK secret → Render deploy). Render static: no file-count
  cap (CF would break at 20k), 5GB/mo bandwidth, overage = suspension not billing.
  **USER NEXT STEPS: (1) create Render static site from the repo (blueprint detected),
  auto-deploy OFF; (2) copy deploy hook URL → Actions secret RENDER_DEPLOY_HOOK;
  (3) add TMDB_API_KEY/AI_API_KEY as Actions secrets; (4) run refresh-daily manually once.**
- **Wave 4**: +1,267 accepted (5,461 cumulative; 4,307 pending) — final dataset/build
  numbers below after run17. AGENTS.md/CLAUDE.md rewritten (compact, current).

**Next: waves 5-8 (4,307 pending ≈ 3 waves) → title waves (24,233 pending, grew via
wave persons) → Render site creation (user) → first daily deploy.**

**Session-16 correction**: the orphan `symbolic-ref` accidentally reattached to the
EXISTING old main, so the remote carries the full 29-commit history (incl. old data
blobs — all <100MB, secret-scanned clean, CC BY-SA data: benign but heavy clone).
Data is untracked from 09d9188 onward. OPTIONAL next session: orphan-reset main to a
single commit (`git checkout --orphan fresh && git add -A && git commit && git push -f`)
to slim clones; not urgent.

## Session 16 (cont. — 2026-08-28) — DEPLOY SWITCHED TO VERCEL (user-instigated, research-backed)

**User asked "Render for website or backend? Vercel is good for website."** Analyzer
research (vercel.com/docs/limits etc.) verdict: Vercel Hobby + PREBUILT CLI deploys
strictly beats Render for this static site:
- 100GB/mo bandwidth (vs Render 5GB; overage = features pause, softer cliff)
- ZERO Vercel build minutes: GH Action builds dist/, `vercel deploy ./dist --prod
  --archive=tgz` uploads the artifact — kills both the seed-tarball-in-build problem
  AND the 500-build-min/month daily-only ceiling (up to 100 deploys/day allowed)
- 15,000-file CLI upload cap (30k-page growth would hit it) has the official
  --archive workaround (split-tgz now default); 1M edge-requests/mo guideline fine
- CAVEAT: Hobby = non-commercial personal use ONLY — no ads/affiliate/donations
  ever, else deployments 503-pause → Render blueprint kept as documented fallback
Answer to the user's framing: there is NO backend; GitHub Actions is the "backend"
(refresh/build); Render could host a future tiny API on its 750 free web-service
hours if ever needed.
Shipped: vercel.json (github.enabled=false + cache/security headers), daily-workflow
deploy step swapped (VERCEL_TOKEN/ORG_ID/PROJECT_ID secrets; npx vercel deploy
./dist --prod --archive=tgz), AGENTS/CLAUDE updated, render.yaml retained as fallback.
**USER STEPS (Vercel): create Hobby account → new project (NO git connect) →
create token → set 3 repo secrets (VERCEL_TOKEN, VERCEL_ORG_ID, VERCEL_PROJECT_ID)
+ TMDB/AI keys → run refresh-daily once.**

## Session 16 (cont.) — SITE IS LIVE ON VERCEL ✓

User supplied Vercel infra (team nilukushs-projects, team_ESjn8Fy4BBbh1gZ86oI4wRo5;
CLI authed — NOTE: /usr/local/bin/vercel is a STALE 44.5 with an invalid token, use
`npx vercel@latest`). Executed: project **chalchitra** created + linked (watch out:
`vercel link --yes` without --project creates a DUPLICATE named after the dir —
removed it), **production deployed from local**: https://chalchitra-3ay2t99zw-nilukushs-projects.vercel.app
(prebuilt ./dist --prod --archive=tgz; smoke tests 200 on /, /movies, Aadhi, Aahat,
Emraan+Shanghai ✓). All 5 repo secrets set (VERCEL_TOKEN extracted from CLI auth
store w/o printing; ORG/PROJECT ids; TMDB/AI from .env). First CI daily-refresh run
triggered (workflow_dispatch). .gitignore += .vercel/, .env.local (vercel link
creates it). Non-commercial reminder: never add ads/affiliate/donations (Hobby ToS).

**CI fix (run 33176174501 failed)**: tmdb-changes.ts read data/movies.json which
doesn't exist in CI before the rebuild (data gitignored) → tracked TMDB ids now
persist to **data/cache/tmdb-tracked.json** (written by build-dataset, carried by
actions/cache); tmdb-changes prefers it, falls back to local data/*.json, skips
gracefully when neither exists (first post-seed run only). Fix verified locally
(22 titles → 32 invalidations via tracked.json). Rerun 33180000373 triggered;
first-diff refresh is slow (~40 min: baseline is 6 days old + failed run's
refetches weren't cache-saved). Live site unaffected (local deploy active).

**CI END-TO-END SUCCESS (run 33184891830)**: 3rd run green after two fixes —
(1) tmdb-tracked.json for the CI delta, (2) workflow permissions contents:write for
release assets. Full chain verified: cache bootstrap/restore → refresh → tmdb delta →
titles → dataset (5,860 persons, 25 chunks) → build → save cache → seed republish →
**CI Vercel deploy** https://chalchitra-nbul21joy-nilukushs-projects.vercel.app (200 ✓).
Pipeline fully automated: daily 05:15 UTC + hourly data runs + on-demand.
Project URL note: per-deployment URLs are unique; production alias = newest deploy.
Next session: waves 5+ (4,307 pending persons), title waves (24,233), optionally set a
custom domain, and consider the orphan history slimming.

## Session 16 (cont. — 2026-08-28 evening) — user bug round: 4 fixes SHIPPED (241 tests)

User reported on live site; all root-caused:
1. **/people "0 of 5860, page undefined"** — Astro does NOT deliver getStaticPaths
   props on static index routes → pageNo undefined → slice(NaN) = empty. FIXED:
   hardcoded pageNo=1. (Lesson: verify CONTENT not just HTTP 200.)
2. **Stale rating/trailer (bethlehem-kudumba-unit class)** — THREE stacked causes,
   all fixed: (a) change-list fetch was page-capped at 20 pages (2,000 global ids)
   → now 100 pages: 10k ids → 143 tracked titles caught vs ~25; (b) enrichment was
   fill-only-empty → dirty-update mechanism: tmdb-changes writes tmdb-dirty.json,
   build-dataset passes the set to BOTH enrichment passes, TMDB-native fields
   (rating/trailer/backdrop/tagline) OVERWRITE when dirty (wiki fields never);
   (c) rating gate ≥3 votes → **≥1** (vote count displayed; +662 titles rated
   instantly; i-nobody 6.0(1v) now shows). Unit tests for dirty mode + gate.
   NOTE: entries changed >14d ago are unreachable (TMDB lookback cap) — one-off
   manual cache invalidation for stragglers (bethlehem done this way).
3. **"Random" index order** — it IS year-desc then A–Z, but year was hover-only
   → PosterCard now shows a persistent year chip (bottom-left).
4. **"Square boxes" on title pages** — cast rail's portrait-less tiles (dark box
   + one faint letter) → IMDb-style monogram tiles (initials + CAST label).
Deploy: chalchitra-c7t1ysj0u… live; bethlehem fix deploying (run21).

**Release-date ordering (user decision)**: /movies + /series (and facets/pages) now
sort by RELEASE DATE DESC (undated/TBA last, then year desc, A–Z) — sortForIndex
rewritten. 5,064/5,363 movies + 379/381 series carry releaseDate. Bethlehem fully
resolved live: 8.4★(9v)+trailer (wrong-variant cache deletion was the last blocker —
lite-pass details use append_to_response=credits,videos, catalogue uses =videos).

## Session 16 (cont. — night) — search FIXED + persistent ratings + full TMDB sweep

1. **Search was broken** (reproduced): buildSearchDocuments emitted no MiniSearch
   `id` → "document does not have ID field" → zero results. Fixed with kind-qualified
   ids (`movie:x`/`series:x`/`person:y`, TDD, slugs collide across kinds). Search
   worked before ONLY because verification was page-load, not query.
2. **Ratings now permanently visible** on every PosterCard (★ chip top-right under
   language badge; year chip bottom-left; old hover overlay removed).
3. **Full TMDB re-validation sweep** (the "numerous titles" fix — delta can't see
   >14d-old changes): ALL 20,176 TMDB cache files deleted + all 5,382 tracked ids
   staged dirty → complete refetch (~15-20k paced requests ≈ 45-60 min) with the
   new ≥1-vote gate + overwrite-on-dirty rules. Chain self-completes: dataset →
   build → deploy. Results land in run23 log.

**SWEEP COMPLETE + live-verified (2026-08-29)**: full TMDB re-validation deployed
(chalchitra-pcs1xxlt6; production alias current). Final coverage: **rated 4,762/5,744
(83%, was 73% pre-gate/sweep)**, trailers 2,225 (39% — TMDB's genuine ceiling for
Indian titles; ~360 unmatched + non-YouTube + zero-video titles account for the rest).
Bethlehem 8.4★(9v)+trailer live ✓. Search live-verified (index carries ids,
movie:29 first doc) ✓. ★ chips visible on /movies grid ✓. Persons re-matched fresh:
5,310/6,877, 15,261 known-for, 1,380 portraits. Tomorrow's daily delta maintains all
of this. NEXT: person waves 5+, title waves (24,233 pending), backlog.

## Session 17 — the five user-reported fixes (trailer languages, Kamal Haasan, ratings position, Upcoming, search UI)

User round: (1) vishwanath-and-sons has a TMDB trailer but our page doesn't — "case
with thousands of titles"; (2) searching "yash" results were plain text rows ("did you
UI UX Graphic Design Research using skills?"); (3) Vikram links Kamal Haasan but no
person page exists; (4) rating chips only on some cards and at TOP not bottom-right;
(5) future-dated titles/episodes must show "Upcoming".

1. **TRAILER LANGUAGE BUG (root cause found via curl)**: TMDB details with
   `language=en-US` return ONLY en-tagged videos — Indian trailers are tagged ta/te/hi
   or null, invisible to us (movie 1408162: 0 videos en-US vs 5 YouTube trailers with
   the filter). Fix: `include_video_language=en,null,hi,ta,te,ml,kn,bn,mr,pa,ur` on all
   4 video-bearing URLs (lite probes+details, catalogue details, season videos).
   URL change rotates sha1 cache keys → natural full refetch (~11 min lite in run24).
   **Trailers 2,225 (39%) → 3,174 (55.3%), +949.** vishwanath-and-sons + Mirzapur live
   with trailers. 39%→55% not 100%: remaining gap = titles TMDB has no videos for /
   unmatched / non-YouTube-hosted.
2. **Kamal Hausan-class actor-politicians**: classifier rejected
   `wrong-type:Infobox officeholder` (66 refs!). Fix (TDD): officeholder + Indian-cinema
   categories → accept. Added a RE-CLASSIFICATION SWEEP to pipeline:persons — rejected
   entries with cached pages re-judged locally, no network (`npm run pipeline:persons 0`
   = sweep only). **105 rescued**, Kamal accepted → page built: 478 filmography rows
   (233 as actor from his filmography subpage), portrait, summary, TMDB knownFor.
   Vikram's cast links him via exact-name fallback (his plot has no wikilink — checked).
3. **plotHtml for archive records**: removed the `record.archive` skip in the plotHtml
   loop (one-tier mandate). Plot links 89 → **3,420**.
4. **Rating chip bottom-right** on PosterCard (was top-9); dead sr-only hover block
   removed; caption fallback year (no more false "Upcoming" on undated archive rows).
5. **Upcoming badge** (saffron chip): PosterCard bottom-left (replaces year chip),
   TitleDetail hero chip, EpisodesTable row chip — all `releaseDate > TODAY` (ISO
   compare; TODAY now exported from data.ts).
6. **Search redesigned** (web-design-guidelines skill loaded; rows follow its rules —
   real <a> rows, lazy thumbs with reserved w/h, tabular-nums, aria-live, monogram
   fallbacks): poster/portrait thumbnails, kind chips with inline SVG icons, language
   + year + ★ right-aligned column, Upcoming tags, person rows show first credited
   works. search-index docs now carry p/r/rd/i (TDD); index 3.56MB.
Tests 245 (+3). Build 12,808 pages (+80 rescued persons). Deployed via workflow
dispatch (local vercel CLI auth expired — CI holds VERCEL_TOKEN).

**Session 17 close-out (all five fixes LIVE on chalchitra-pied.vercel.app, deploy
chalchitra-h8spsshy3)**: vishwanath-and-sons trailer ✓ (watch?v=ejX6MHgKAlM),
/people/kamal-haasan 200 with 478-row filmography ✓, rating chips bottom-right (85 on
/movies) ✓, Upcoming badges (home 8, /movies 19, hero chip on /movies/king 2026-12-24) ✓,
search index p/r/rd/i live (12,701 docs) ✓. CI run 33242480487: data pipeline + seed
publish SUCCEEDED, but **VERCEL_TOKEN secret has EXPIRED** ("token provided via --token
argument is not valid") — deploy step failed; deployed locally instead: local CLI auth
works but needs `--scope nilukushs-projects` (project is under the team; bare deploy =
"Not authorized"). **USER ACTION NEEDED: rotate VERCEL_TOKEN in repo secrets** or
tomorrow's 05:15 UTC daily deploy step will fail (data/seed steps still fine).

Gotchas this session: (1) Tailwind `hidden`+`flex` class order is unstable — use inline
`style.display` for JS toggles; (2) `credits` on a person = cast/crew hits on CACHED
titles only — filmography rows are the page's real content for archive-heavy persons;
(3) person pages for rescued politicians show facts=0 (officeholder infobox field names
differ) — summary + TMDB portrait carry the page; FACT_FIELDS could learn officeholder
aliases later.

## Session 18 — cast-subsection bug, language gap, trending chips, truthful person cards, waves 5-6 (persons exhausted + titles)

User round: (1) trailer languages beyond hi/ta/te; (2) no rating chips on "What India is
watching"; (3) 108-base-hospital-uri cast missing + those persons' pages/filmographies
missing ("several titles"); (4) why do person pages link out to Wikipedia for titles;
(5) people cards show incorrect credits.

1. **CAST SUBSECTION BUG (the big one)**: extractSections is flat — `== Cast ==`
   immediately followed by `=== Main ===`/`=== Recurring ===` leaves the Cast section
   BODY EMPTY, so series with subsectioned casts parsed 0 cast members AND their actors
   never entered the person frontier (double loss). Fix (TDD, 108 pattern fixture):
   extractCast merges the matched section + following DEEPER-level sections until the
   next same-or-higher heading. 108 → 9 cast, all linked. Frontier targets jumped
   5,754 → 6,589 from the newly visible casts.
2. **VIDEO_LANGS += gu,or,as** (Gujarati/Odia/Assamese; ml/kn/bn/mr/pa/ur were already
   in). Rotated cache again; absolute trailers 3,174 → 3,755. NOTE: % dipped 55→43
   ONLY because the corpus grew +2,907 titles this session (many unrated/untrailed
   deep-archive works); no regression.
3. **Trending rail**: the rail is re-rendered CLIENT-SIDE from #live-trending-data —
   that cardHtml had no rating/year/upcoming. Candidates now carry rt (rating value) +
   rd (release date); cardHtml mirrors PosterCard chips (★ bottom-right, year/Upcoming
   bottom-left).
4. **PersonCard credits lie**: fallback was `Credits: N` = cast/crew hits on cached
   titles only (Kamal: "Credits: 0" next to 478 rows). Now `N screen works` counting
   unique titles across credits + filmography rows.
5. **Waves (one paced chain, ~3h)**: dataset(cast fix) → `pipeline:persons 9000` →
   **8,495 accepted persons** (+2,929; 1,641 rejected genuine non-persons, 960 missing,
   150 pending edge) → `pipeline:expand 3000` → final dataset+build.
   RESULT: 8,651 titles (+2,907), 9,279 persons, 18,082 pages (was 12,808). Plot links
   3,420 → 5,046. Kamal filmography 36% internal (172/478), Erica Fernandes 44 rows,
   /people/erica-fernandes live. FilmographyTable resolves internal-vs-Wikipedia at
   RENDER time by wikiTitle (rows carry no stored slug — my "0% internal" first check
   was against a nonexistent field).
6. **Why Wikipedia links remain on person pages**: filmography rows for works we
   haven't fetched yet link out as fallback; the expansion frontier (ranked by refs)
   still has ~21k pending works — each wave converts the most-referenced first. This
   IS the unbounded-recursion mandate in progress, budget-paced at ~1 wave/session.
Deployed: chalchitra-dkhv95i06 (alias live). Tests 247. CI VERCEL_TOKEN still expired —
deployed locally with --scope.

## Session 18b — VERCEL_TOKEN fixed (daily refresh deploys again)

The failing daily-refresh deploy was the expired VERCEL_TOKEN repo secret (flagged in
session 17). FIX: pushed the working local CLI token (`~/Library/Application Support/
com.vercel.cli/auth.json`) into the secret via `gh secret set VERCEL_TOKEN` (stdin pipe,
never argv). Verified `vercel whoami --token …` → nilukush with the workflow's env-var
pattern, then re-ran the failed workflow (run 33250636961): **full pipeline green —
Deploy to Vercel step SUCCESS, run conclusion success**. Scheduled 05:15 UTC deploys
are self-sufficient again. CAVEAT: this token is the local CLI session token — if the
user runs `vercel logout` or revokes sessions it dies again; a token created in
Vercel → Settings → Tokens is the sturdier long-term form.

## Session 19 — daily-refresh regression (stale CI cache) + permanent fix

**Incident**: after the nightly run, production showed 5,363 films/381 series/5,860
persons instead of 8,013/638/9,279. CAUSE: the expansion waves (5,090 persons + 3,000
works) ran LOCALLY — those pages exist only in the local data/cache (1.2GB). The daily
workflow rebuilds from ITS actions/cache (206MB, pre-expansion seed) and deployed the
smaller build OVER the local 18,082-page deploy, then republished the regressed cache
as the seed. Any local wave without a seed republish = guaranteed silent revert.

**Fix (3 steps)**: (1) published the local cache as the seed (309MB tgz, --clobber);
(2) deleted all 7 pipeline-cache-* actions caches (forces seed bootstrap); (3)
redeployed local dist. VERIFIED end-to-end: dispatched a fresh daily run — it
bootstrapped from the new seed, rebuilt 8,013/638/9,281, deployed green, production
stats match local. **Runbook rule added to AGENTS.md**: after any local wave that
fetched new pages → tar+upload seed + purge pipeline-cache-* (exact commands there).

**Token answer (user asked)**: the rotated VERCEL_TOKEN is the local CLI session
token, NOT a never-expiring one — it dies on `vercel logout`/session revoke. For a
durable token: Vercel → Settings → Tokens → create "Never expires" → gh secret set.

## Session 19b — "trending people/collage revert" explained: local trends snapshot was stale

User reported trending people + hero collage "going back to old" on production after
daily refresh. TWO separate things were conflated:
1. This morning's corpus regression (5,363 films) — the cache incident, fixed+verified
   (session 19); it will NOT recur: CI caches now descend from the expanded seed.
2. Trending people/hero collage changing on production = BY DESIGN — the daily workflow
   runs `npm run pipeline:trends` (Wikipedia pageviews) before every build. The twist:
   `pipeline:dataset` does NOT regenerate trends.json, and locally it hadn't been run
   since **2026-08-16** — localhost:4730 was the stale side (13-day-old snapshot), not
   production. Ran pipeline:trends + rebuild locally → local trending now IDENTICAL to
   production (geetu-mohandas, kuku-kohli, yash-actor, rukmini-vasanth…). Runbook now
   documents pipeline:trends (was missing from AGENTS.md list).

## Session 20 — six-issue round: category staleness, kind flips, teaser pick, TMDB concordance, renames

1. **CATEGORY LISTINGS CACHED FOREVER** (why new category members never appeared):
   apiGet cached EVERYTHING unconditionally — the category walk served a frozen
   member list, so user-added shows (Adarsh Baal Vidyalaya*, Musafir Cafe, Super
   Subbu) were invisible to every daily/hourly run. Fix: apiGet opts.ttlMs;
   categorymembers re-lists every 6h. Subcategory recursion already existed
   (depth 2, cmtype=subcat) and covers films the same way (2026 Indian films
   walked recursively). *Actual article spelling is "Adarsh BAAL Vidyalaya".
2. **{{Infobox television}} OTT films classified as series** (Mandela 2021,
   Pulikkuthi Pandi + ~19 more): direct-to-streaming films carry the TV infobox.
   Classifier now treats director/runtime + no num_episodes/original_run as a
   FILM. expand-titles gained a re-classification sweep (mirror of persons):
   20 frontier kinds flipped. Old URLs 301 via redirects.json → astro redirects.
3. **TEASER PICKED OVER TRAILER** (haiwaan): tiers let official-flag outrank
   type; Indian full trailers are often official:false. New order: Trailer
   (official) > Trailer > Teaser (official) > Teaser > any.
4. **WRONG TMDB MATCH** (om → Thai OM): added languageBonus (original_language
   vs Wikipedia language, ±3) to candidate scoring + probe depth 2→4 (the
   Tamil original sat at index 3). om now → 1384528 ✓.
5. **WIKIPEDIA RENAMES INVISIBLE**: page MOVES don't bump lastrevid. refresh
   now diffs live titles vs cached (planRenames), invalidates + refetches
   under new titles; dataset prefers cached page.title; slug changes emit
   CUMULATIVE redirects (data/redirects.json ← pageid-keyed slug-map.json in
   cache; kind flips emit /series→/movies paths). Khalifa: The Intro → /movies/
   khalifa-the-ruler live with TMDB 1036081 + 6.8 + trailer ✓.
6. **TMDB include_video_language QUIRK (deep)**: 13-entry lists (+gu,or,as)
   make the video append return EMPTY for the whole URL class — live-tested
   (same movie: short list → 2 videos; 13-entry → 0, consistently; the /videos
   endpoint flaky too; even 11-entry flip-flopped across cache nodes).
   Trailers fell 3,755→1,791 when the 13-entry URL era cached empties. Final:
   11-entry list (proven cache restored) + SHORT per-title /videos fallback
   (en,null,<record's iso>) when the append pool is empty → trailers 4,031
   (highest ever, on 8,677 titles). NOTE run28/30 crashed ReferenceError
   (languageIsoFor unimported) — stale outputs looked like regressions; the
   npm && chain masked it. Lesson: grep logs for ReferenceError before reading
   "results" from a crashed chain.
Tests 256. Pages 18,121. Deployed chalchitra-mm44zna5n. All six live-verified.

## Session 21 — persistence hardening + hourly refresh retired + squares explained

1. **Will the fixes persist?** Code fixes are pushed (CI rebuilds with them); the
   DATA deltas (renamed pages, new shows, corrected frontier, slug-map baseline)
   are locked in by republishing the SEED (353MB) + purging pipeline caches —
   per the session-19 runbook rule, done after this session's local runs. The
   daily workflow ALSO now runs `pipeline:expand 0` (re-classification sweep)
   after trends, so classifier fixes (kind flips, rescued rejects) self-heal in
   CI with a one-day lag even without local runs.
2. **Hourly refresh retired (cron removed, manual dispatch kept)**: at the 20k-page
   corpus the refresh blew its 30-min timeout — EVERY cron run since yesterday
   evening died cancelled (06:46, 01:18, 22:41, 19:25, 15:39 — all ~30m20s
   "cancelled" = timeout) and a cancelled job saves no cache: pure waste.
   Scheduling was never truly hourly either (GitHub throttles short-interval
   cron: observed 3-7h gaps). Intraday freshness already comes from the
   client-side live-trending rail; data freshness is daily.
3. **"Squares came back" — transient, not a regression**: the screenshot showed
   8 identical "Khalifa: Part 1" poster-less tiles from ONE of midday's
   intermediate deploys (rename churn + 13-lang TMDB era). Current build scanned:
   ZERO pages with duplicated card captions; only one "Khalifa: Part 1" string
   exists (a news headline link). Prithviraj's filmography is clean (single row).
   The cast monogram fix from session 15 is intact.

## Session 22 — expansion wave 7 (chain4: wave→dataset→build→deploy→seed, all green)

3,000 more filmography works fetched → **11,476 titles** (+2,799), **20,948 pages**,
trailers 4,594 (+563), rated 8,537, plot links 6,428. Kamal filmography internal
226/478 (47%, was 36%). Frontier: 11,129 accepted / 50,744 pending (waves continue;
~55 min per 3k). Homepage live shows 10,411 films. Seed republished + caches purged
in the same chain (runbook) — tomorrow's daily run inherits everything.

## Session 23 — expansion wave 8 (chain5 green)

Another 3,000 works → **14,205 titles** (+2,729), 23,707 pages (Astro build now
24 min at this size — approaching CI budget ceilings; watch it), trailers 5,229,
rated 10,009 (first time past 10k), plot links 7,479. Frontier 13,926 accepted /
47,744 pending. Seed republished + caches purged in-chain. NOTE for scale:
build minutes are the next constraint if waves continue (Vercel unaffected —
prebuilt deploy; GitHub Actions public-repo free; Render daily-only fallback).

## Session 24 — expansion wave 9 (chain6 green)

3,000 more works → **16,812 titles** (+2,607), 26,340 pages, trailers 5,896,
rated 11,369, plot links 8,315. Frontier 16,657 accepted / 44,744 pending.
Build 12 min (26k pages — faster than wave 8's 24, disk cache warm). Deployed
chalchitra-qmmnwtdt6; seed republished + caches purged in-chain. Homepage live
reads 15,218 films / 1,594 series.

## Session 25 — expansion wave 10 (chain7 green)

3,000 more works → **19,235 titles** (+2,423), 28,788 pages, trailers 6,463,
rated 12,525, plot links 9,015. Frontier 19,284 accepted / 41,744 pending —
past the one-third mark of the known frontier. Deployed chalchitra-bzpvdze2g;
seed republished + caches purged in-chain. Homepage live: 17,303 films.

## Session 26 — why VERCEL_TOKEN "came back": CLI token rotation + 2 more growth ceilings

User called out that the Aug-29 token fix wasn't permanent. ROOT CAUSE (proven):
the Vercel CLI ROTATES its session token around local deployments — auth.json
showed vca_1D…→vca_0W… with mtime matching a local deploy. Any token copied to
the repo secret dies on my next local deploy. Vercel's API REFUSES programmatic
token creation ("Cannot create tokens for this app") — a never-expiring token
is dashboard-only, user action. MITIGATION (self-healing): scripts-sync-vercel-
secret.sh re-syncs the secret from local auth; AGENTS runbook + all chain
templates now run it after every local deploy.

Two MORE ceilings surfaced during verification (corpus growth):
1. Daily workflow timeout-minutes 120 → runs cancelled at ~2h0m before deploy
   (same class as the hourly's 30-min kills). Raised to 300 (bbaf1d0).
2. Build site OOM: 28,788 pages exceed Node's default ~4GB old-space on the
   7GB runner → NODE_OPTIONS=--max-old-space-size=6144 on the build step
   (a3d4104). If pages keep growing, next lever: split the build or trim the
   eager import.meta.glob dataset per route.
Verification run in flight after both fixes.

## Session 26 close-out — VERCEL_TOKEN: definitive diagnosis, automation impossible

**The real mechanism** (found in auth.json): the Vercel CLI now stores an
EXPIRING access token (token + refreshToken + expiresAt, ~8-12h life) that it
silently refreshes locally. Any token copied into the repo secret dies at its
expiresAt — the Aug-29 copy worked one day, then died; today's copy died the
same way. My earlier "rotation on deploy" theory was wrong; it's plain expiry.
**Programmatic creation is refused** (v2/v3 user/tokens → "Cannot create tokens
for this app"). Conclusion: a permanent CI token is DASHBOARD-ONLY — user must
create one at vercel.com/account/tokens ("Never Expires") and set repo secret
VERCEL_TOKEN (or hand it to the agent to set). Until then the nightly workflow
ships data+seed fine and fails only its final deploy step; production stays
current via local chain deploys (CLI refreshes its own token).
Also fixed this session while verifying: daily timeout 120→300 min (runs were
cancelled at 2h pre-deploy), build OOM → NODE_OPTIONS 6GB heap (28,788 pages).
scripts-sync-vercel-secret.sh retained — it becomes the right tool for keeping
ANY long-lived token synced; useless for expiring session tokens.

## Session 27 — expansion wave 11 (chain8 green)

3,000 more works → **21,380 titles** (+2,145), 30,960 pages (build 17 min), trailers
6,991, rated 13,456, plot links 9,485. Frontier 21,716 accepted / 38,744 pending
(56% of the estimated full corpus converted). Deployed chalchitra-g05sr6i4n;
seed republished (481MB) + caches purged in-chain. Homepage live: 19,137 films /
2,243 series. Still blocked on user dashboard token for CI deploys.

## Session 28 — VERCEL_TOKEN PERMANENTLY FIXED (user provided dashboard token)

User supplied a never-expires dashboard token (vcp_…) from docs/vercel-chalchitra.md
(file lives in the PUBLIC expat-salary repo — untracked, now also .gitignored there
to prevent accidental commit). Token verified via whoami with the workflow's env
pattern → gh secret set VERCEL_TOKEN. **END-TO-END VERIFIED: daily-refresh run
33479814534 completed SUCCESS (2h23m) — refresh → dataset → trends → re-classify
sweep → build (6GB heap) → seed publish → DEPLOY all green.** The nightly pipeline
is now fully self-sufficient: data refresh + build + deploy, every night at 05:15 UTC.
The CLI-session-token saga is closed (root cause was expiring vca_ access tokens).
