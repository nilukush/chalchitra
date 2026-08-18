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
