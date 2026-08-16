# Chalachitra — Implementation Plan (Part 2)

Binding execution contract. Steps are atomic; every pure-logic step is test-first (Red → Green → Refactor). Max 3 attempts per step before stopping for human guidance.

---

**Step 1: Project scaffold**
├─ Objective: runnable Astro + Tailwind + Vitest + tsx pipeline shell.
├─ Test first: `npm test` runs with zero tests discovered (harness sanity).
├─ Implementation: package.json, astro.config.mjs (sitemap, port 4730 via scripts), tsconfig, vitest.config.ts.
├─ Acceptance: `npm install` clean; `npm run build` produces empty-site dist.
└─ Stop/Go: Go.

**Step 2: Wikitext parser library — `pipeline/wikitext/` (TDD)**
├─ Objective: pure functions that turn MediaWiki wikitext into structured records.
├─ Test first (unit, fixtures from real pages fetched during analysis):
│  ├─ `parseInfobox` — extracts `{{Infobox film|…}}`/`{{Infobox television|…}}` incl. nested templates (`{{plainlist|…}}`, `{{ubl|…}}`), `<br>` splits, named refs stripped.
│  ├─ `stripWikitext` — removes refs/comments/templates, unwraps `[[Target|Label]]`, `'''bold'''`, `''italics''`, HTML entities.
│  ├─ `splitListField` — `starring`/`director` infobox values → string[] (handles `<br />`, `{{plainlist}}`, `{{ubl}}`, commas).
│  ├─ `extractSections` — heading map (`==Plot==`, `==Premise==`, `==Cast==`, `==External links==`, …).
│  ├─ `extractCast` — `* [[Actor]] as Role` bullets → `{name, role, wikiTitle}[]`; tolerates refs, nested links in role, unlinked names.
│  ├─ `extractExternalLinks` — IMDb id (`{{IMDb title|…}}`/`{{IMDb name|…}}`), official site, `{{Official website}}`.
│  ├─ `parseStartDate` — `{{Start date|2026|04|17}}`, `{{Film date|…}}` → `YYYY-MM-DD` (month-only / year-only tolerated).
│  └─ `collectPersonLinks` — all wikilink targets from cast + crew fields (namespace-free, dedup, excludes non-person patterns like lists/categories).
├─ Acceptance: `npm test` green; parsers degrade gracefully (empty results, never throw) on malformed input (property test with adversarial fixtures).
└─ Stop/Go: Go.

**Step 3: Wikipedia API client + cache — `pipeline/wiki-api.ts`**
├─ Objective: polite, cached, batched access (polite UA, 50-title metadata batches, 10-title wikitext batches, serialization + delay, 429/503 backoff, `cmcontinue` pagination, subcategory recursion depth ≤ 2).
├─ Test first: unit-test the batch-chunking + backoff-schedule pure helpers with a stubbed fetch; live smoke test executed in Step 4 run.
├─ Acceptance: helpers' tests green; live category walk returns 366 films + 60 series.
└─ Stop/Go: Go.

**Step 4: Pipeline execution — data/**
├─ `extract-titles.ts` → `data/titles.json` (films + series with wiki titles, pageids).
├─ `fetch-pages.ts` → `data/cache/pages/{pageid}.json` (wikitext + thumb + summary extract).
├─ `build-dataset.ts` → `data/movies.json`, `data/series.json`, `data/persons.json` (persons get bio extract, infobox facts, sections list, image, computed credits from films/series), `data/search-index.json`, `data/site-stats.json`.
├─ Acceptance: every title page yields a record (even if sparse); persons = deduped union of person links that resolved to existing articles; JSON sizes reasonable; spot-check 3 known pages (Matka King, Dhurandhar, one regional film).
└─ Stop/Go: Go.

**Step 5: Design system + layout**
├─ Objective: Tailwind v4 token set (midnight-ink surfaces, saffron accent, ivory type; Fraunces display + Inter UI + Noto Sans Devanagari fallback), Base layout, Header (sticky, search box → /search), Footer (licensing + attribution), PosterCard/PersonCard/Badges/Breadcrumbs.
├─ Verification: build output contains token CSS; pages render components (checked in Steps 6–8 builds).
└─ Stop/Go: Go.

**Step 6: Pages (static generation)**
├─ `/` home (stats, language strips, recent releases, spotlight people); `/movies` + `/series` (+ language filter, client island); `/movies/[slug]`, `/series/[slug]` (hero poster, infobox facts, plot/premise excerpt, cast grid → person pages, reception, references count, external links, source attribution); `/people` (A–Z + search-driven); `/people/[slug]` (bio, facts, credits back-links, external links); `/about`; 404.
├─ Test first: unit tests for data-access layer (`src/lib/data.ts`): slug generation, dedupe, lookups, "cast with roles" joins.
├─ Acceptance: `astro build` succeeds; page count = movies + series + persons + static routes; spot-check HTML contains JSON-LD + canonical.
└─ Stop/Go: Go.

**Step 7: Search**
├─ `/search` page: loads `search-index.json`, MiniSearch over (titles + person names + roles), grouped results, keyboard-accessible.
├─ Test first: unit test index-building (`pipeline/build-dataset.ts` exports pure builder): given fixture movies/persons → expected documents/fields.
├─ Acceptance: build passes; manual query via served site returns expected hits (curl of page + JS bundle sanity).
└─ Stop/Go: Go.

**Step 8: SEO / GEO**
├─ JSON-LD `Movie`/`TVSeries`/`Person` (+ `BreadcrumbList`), OG/Twitter cards, canonical, sitemap via @astrojs/sitemap, `robots.txt`, `llms.txt`, semantic landmarks, human-readable URLs.
├─ Acceptance: dist contains sitemap-index.xml, robots.txt, llms.txt; every detail page has exactly one JSON-LD script of right type (assert via grep over dist).
└─ Stop/Go: Go.

**Step 9: Verification & docs**
├─ `astro build` + `astro preview` on 4730, curl assertions on key routes, HTML validity spot checks, code-review subagent pass (Verifier role), then README + CLAUDE.md/AGENTS.md/MEMORY.md compaction.
└─ Stop/Go: final report.

**Regression protection.** Steps are additive; `npm test` + `npm run build` run after every step; failures block the next step. Rollback = git checkpoint per step (repo initialised at Step 1).

**Divergence protocol.** Any schema/architecture change mid-flight is documented here + in MEMORY.md before proceeding.
