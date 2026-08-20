# Session 15 — Data-completeness audit & implementation plan (v2, 2026-08-20)

3-agent consensus round (Debugger root-causes with file:line / Analyzer codebase facts +
online research / Verifier dataset measurements). Baseline at audit: 192/192 tests,
7,970 pages. **v2 incorporates the user's product decisions of 2026-08-20** (below) and
records Steps 1–2 as DONE with measured results.

## PRODUCT DECISIONS (user, binding — 2026-08-20)

1. **ONE tier, no second-class records.** The site is for ALL Indian cinema — past,
   present, future. The catalogue/archive distinction as a *data-fidelity* split is
   abolished: every title gets the full parse (plot, soundtrack, awards, cast links,
   references — everything its Wikipedia source has). The `archive` flag survives only
   as internal provenance (which wave discovered a page), never as a license to skimp.
   Site copy that scopes to "2026" gets de-scoped (Step 6).
2. **Recursion is unbounded graph traversal.** title → cast wikilinks → person pages →
   their filmography/discography/awards → all those titles → their cast → repeat, until
   the frontier closes. The Session-13 "no new person discovery" scoping is overruled.
   (Upper-bound sizing: 109,366 unique wikilink targets in today's cache alone.)
3. **Real-time freshness is approved with budget** ("will try and pay what I can").
   Target architecture in Step 8: always-on Wikimedia EventStreams consumer + partial
   rebuilds; realistic running cost ≈ $0–5/mo. Static-only constraints no longer block
   an always-on component.
4. **On-page multi-season data is the primary seasons gap** (user-corrected): 65 cached
   series pages carry ≥2 complete "Season N" sections on the article itself (314 season
   headings total) that the first-match-only episode parser drops. Subpage ("List of …
   episodes") following is additional, not the headline.
5. **Plot policy**: every plot variant heading must parse (census: plot 4,883 ·
   synopsis 167 · premise 142 · "plot summary" 12 · story 6 · "plot synopsis" 3); brief
   premise always visible, full plot behind the existing spoiler toggle — on every page
   whose Wikipedia article has a plot.

---

## Part 1 — Findings (root causes, all file:line-verified)

**F1 — Award rows lost the work title when the WORK column carried the rowspan.**
`tables.ts` stripped span attributes; `awards.ts` then mis-aligned ragged rows and its
carry-forward only fired for rowspan-on-AWARD (the inverse shape). 1,865/6,154 rows
missing work (30.3%); Screen Awards alone 54. **FIXED in Step 1** → 627/6,138 (10.2%);
Emraan 10→0 missing; Shanghai/OUATIM now on the Screen rows. Remaining 10.2% = tables
genuinely without a work column.

**F2 — Person discovery not recursive.** Person universe fixed once from catalogue
titles (`build-dataset.ts:259-292`); archive branch resolved cast against known persons
only (`:463-476`, "no new person discovery"). Aadhi Pinisetty: hyperlinked on
Mayasabha's Wikipedia cast, no person page, no link. 70.5% of archive-series cast
entries unresolved. → Step 7 (unbounded, decision #2).

**F3 — Multi-season episodes dropped.** (a) `episodes.ts:47-48` reads only the FIRST
episode-ish section — on-page "=== Season 2 ===+" wikitable sections never parsed
(65 pages affected); (b) `{{Episode list}}` rows captured across seasons but season
never tagged → UI defaults all rows to season 1 (`EpisodesTable.astro:10-12`); (c)
"List of … episodes" subpages never fetched (0 cached; Aahat-class); (d) TMDB path
hardcodes `/tv/{id}/season/1` (`enrich/tmdb.ts`) and synthesis is blocked whenever any
wiki table exists. Only 1 series has rows spanning >1 season. → Step 4.

**F4 — Soundtracks: 0 archive + thin parser.** Archive branch deleted the field
(`build-dataset.ts:460`, now abolished by decision #1); parser knows only
`{{Track listing}}` + numbered lists (`soundtrack.ts`). The Family Man's `== Music ==`
unparsed. → Step 5.

**F5 — No awards parser for title pages.** `TitleRecord` has no awards field;
`extractAwards` runs persons-only. 0 titles carry awards. IMDb-standard feature
(Analyzer research). → Step 3.

**F6 — Plot heading variants unparsed.** `getSection` exact-match missed
`== Plot summary ==` (Crime Beat). Series plot coverage 60.1%. **FIXED in Step 2** →
+20 titles (the census-predicted variants); Crime Beat renders premise + gated plot.

**F7 — No pagination; single-page indexes break first.** All three indexes render every
card (movies index = 7.06 MB HTML); `paginate()` used nowhere. At 1 lakh: ~130 MB
pages, ~16 MB search index. Free static hosting also has hard page-count limits
(Cloudflare ≈ 20k files/deploy) — beyond that, on-demand rendering is required
(Step 6/8). **User approved: pagination/chunking BEFORE recursion.**

**F8 — No freshness mechanism.** Cache presence-based, no TTL; `FORCE_REFRESH`
refetches everything; no scheduler; trends 4 days stale. → Step 8 (real-time approved).

**F9 (found in execution) — TMDB re-runs paid network pacing on cache hits.** The
global 8 req/s start-gate ran BEFORE the disk-cache check, so an all-cache-hit re-run
slept ~30 min (matched the "hang": zero sockets, pure timer sleeps). **FIXED**: cache
read now short-circuits the gate — archive-lite re-run 30 min → **2s**, identical
match numbers (5,019/5,319, 4,906 enriched).

**F10 (found in execution) — Filmography vs discography trade.** The rowspan grid now
aligns musicians' film columns correctly, so filmographies list FILMS (Tanishk Bagchi
240→133 rows; gained Dhadak 2, Baaghi 4, Tehran…; lost rows were song titles and
noise like "Atif Aslam" promoted as works). Songs are real data → a dedicated
DISCOGRAPHY parser (song rows: song|film|year|singers) is Step 5b, per decision #1.
Net filmography rows 122,629→121,885 (−0.6%); Emraan benchmark holds (57 rows, 94%
linked); 139 persons changed, all musician-discography class.

---

## Part 2 — Implementation plan (v2)

Standing rules: TDD with verbatim cached-wikitext fixtures; `npm test && npm run build`
green per step; size thresholds measured (movies/persons.json ≤100 MB, search <5 MB,
build RSS <2.5 GB); Wikipedia pacing untouchable; Edit tool for `.astro`; restart
preview after rebuilds; max 3 failed attempts → stop and document.

**Step 1 — Rowspan-aware table grid + awards carry — ✅ DONE (2026-08-20)**
197 tests. Awards missing-work 30.3%→10.2%; Emraan 10→0; Shanghai fix verified live on
:4730. Filmography regression-checked (F10 trade documented; discography parser queued).

**Step 2 — Plot heading variants + skip-list — ✅ DONE (2026-08-20)**
202 tests. `findPlotSection` (plot/premise/synopsis/plot summary/plot synopsis/story,
MOS-ordered); variants added to SKIP_ARTICLE_SECTIONS; Crime Beat plot live (+3 renders:
premise, gated full plot, meta). Coverage: movies 4,866/5,363, series 234/381 —
remainder genuinely plot-less on Wikipedia. Spoiler gate applies everywhere a plot
renders (existing TitleDetail behavior).

**Step 3 — Title-page awards (movies + series).**
TDD: title-mode fixtures (Ceremony|Category|Recipients|Result tables; prose-only → 0
rows; section leaves articleSections). `TitleRecord.awards`; IMDb-style block on
TitleDetail (summary line + ceremony groups, reusing AwardsTable). ALL titles
(decision #1) — awards are compact; measure movies.json delta (<2 MB expected).

**Step 4 — Multi-season episodes (on-page first, then subpages).**
TDD: (a) parse EVERY `=== Season N ===` section's tables, tag rows `season: N`
(heading regex from the census: `season n (n)`, `season n: n`, `series n (n)`…);
(b) `{{Episode table}}`/`{{Episode list}}` season param → row season; (c) TMDB merge
keyed (season, number); per-season fetch; synthesis when wiki rows cover fewer seasons
than the infobox claims; (d) episode-subpage follower ({{Main|List of X episodes}}) via
the paced fetchPages pattern. EpisodesTable tabs already shipped (Session 11) — data
starts flowing. Acceptance: series with >1 season of rows 1 → ≥30; Aahat + 2 samples
multi-season.

**Step 5 — Soundtracks everywhere + parser widening. (5b: discography parser.)**
TDD: plain track wikitables (Track|Singer|Lyricist|Music columns), `== Music ==`
heading; existing fixtures unchanged. Delete the archive soundtrack strip (decision #1);
measure size (tracks are compact; if movies.json would pass 45 MB, chunk JSONs now —
they're needed for Step 7 anyway). 5b: `FilmographySection`-style discography structure
for song rows (song|film|year|singers), rendered as its own section on person pages —
recovers the F10 song data as first-class data.

**Step 6 — Pagination + data-shape scaling (approved prerequisite).**
`paginate()` 200/page on /movies, /series, /people (+ language facet subroutes, bounded
~10); A–Z preserved on people; slug-only props; search-index slimming; de-scope the
"2026" copy everywhere (home scope strip, index h1s, about, llms.txt); JSON chunking
(by decade/letter) when any payload nears thresholds. Acceptance: no card lost across
pages; build time regression <25%; copy no longer year-scoped.

**Step 7 — Unbounded recursive person+title expansion (decision #2).**
Wave fetcher (reusing expand-titles machinery) over the person frontier ranked by
reference count; person records FULL-shape per decision #1 (filmography, awards, bio;
references chunked separately if size demands); archive cast linking resolves against
the grown universe (replaces canonical-only lookup). Wave 1: persons referenced by ≥3
titles + Mayasabha's cast via EXPAND_FOCUS-style hoist. Acceptance: Mayasabha cast
≥80% linked (Aadhi Pinisetty has a page); archive cast link rate 29.5% → reported
wave-1 number; Emraan benchmark unchanged; budgets hold.

**Step 8 — Real-time freshness (approved with budget).**
(a) `pipeline:refresh`: batch `prop=info` lastrevid poll (50/req) → refetch changed
pages only (delete per-page cache entries; never FORCE_REFRESH) → dataset+build;
(b) TMDB `/movie|tv/changes` delta (≥biweekly; 14-day lookback cap) for
trailers/seasons/ratings; (c) `pipeline:titles` + `pipeline:trends` in the same job;
(d) always-on Wikimedia EventStreams consumer (filter: our universe + new-title
category entries) on a ~$0–5/mo always-on host (Oracle Cloud free ARM / Fly.io /
smallest VPS — decide at implementation), batching dirty slugs every 5–15 min into
partial rebuilds (getStaticPaths filtered by env var; upload changed files only);
(e) GitHub Actions cron as the free-tier floor (daily) if the consumer host is
deferred; (f) at >20k pages (free-host file limits), migrate rendering on-demand
(Cloudflare Workers adapter) — the decision-#3 budget covers this endgame.
TDD: revid-diff planning, changes-list pagination ∩ catalogue, partial-build slug
filtering. Acceptance: touching one page's revid refetches exactly that page; consumer
survives reconnects; end-to-end latency Wikipedia-edit → live page ≤ 30 min.

### Deferred (documented)
- AI hooks/moods beyond catalogue (cost) — revisit under decision #3 budget if wanted.
- Publisher-chip normalization; rating-gate unification (≥3 vs ≥10 votes).
- Remaining ~24k frontier works (interleavable between steps).
