# Chalachitra — High-Level Analysis (Part 1)

Date: 2026-08-16 · Status: Approved (autonomous mode, per user instruction to decide stack/architecture/design/name)

## 1. Business Problem Definition

**Problem.** Global film databases (IMDb, TMDB, AllMovie) present cinema through a strongly American/Western lens. Indian movies and series — one of the world's largest content ecosystems, spanning Hindi, Tamil, Telugu, Malayalam, Kannada, Bengali, Marathi, Punjabi and more — are second-class citizens there: poor coverage of regional titles, Western-centric ranking/editing, no cultural framing. (The user also intends to add South Korean content later, for the same reason.)

**Objective.** Build a beautiful, user-friendly, graphical discovery website for Indian cinema, starting with **2026 releases** (films + television series debuts), expandable to earlier years and other origins (South Korea) later.

**Success criteria.**
1. Every 2026 Indian film (366 pages, Wikipedia, Aug 2026) and every 2026 Indian TV-series debut (~60 pages incl. the Tamil-language subcategory) has a rich detail page: poster, plot/premise, cast & crew, release/reception metadata, external links, references.
2. Every cast/crew member with a Wikipedia article gets a person page (bio summary, infobox facts, credits computed back-links, external links, image).
3. Search by title or person name works across the whole corpus.
4. SEO/GEO: semantic HTML, JSON-LD (`Movie`, `TVSeries`, `Person`), sitemap, robots, canonical URLs, `llms.txt` for generative engines, per-page OG/Twitter meta.
5. Design system that is poster-forward, cinematic, and distinctively Indian without kitsch.

**Why it matters.** Discovery of regional Indian cinema is fragmented across industry-specific sites and tabloids; a clean, structured, respectful-of-source database fills a real gap and is extensible to other under-served film cultures (Korea next).

## 2. Data Source Investigation (performed live, 2026-08-16)

- `Category:2026_Indian_films` → **366 pages, no subcategories, single API page** (no `cmcontinue` needed at 500/batch, but pagination is implemented anyway — the category grows).
- `Category:2026_Indian_television_series_debuts` → **38 pages + 1 subcategory** (`2026 Tamil-language television series debuts`, 22 pages). Recursion into subcategories is required.
- Page structure (verified on `Dhurandhar`, `Matka King`): `{{Infobox film}}` / `{{Infobox television}}` with director/starring/language/release/network/gross fields; `==Plot==`/`==Premise==` sections; `==Cast==` bullets of the form `* [[Actor]] as Role`; `<ref>` citations; `{{IMDb title}}` / official-site templates in External links.
- Posters come from `pageimages` API property (thumbnail URLs on `upload.wikimedia.org`) — hotlinked at build-time-chosen widths with attribution; fair-use posters are not re-hosted.

## 3. Technical Approach Evaluation

| | Approach A — Astro 5 static site + local JSON dataset + Node scraper pipeline | Approach B — Next.js (SSG) + pipeline | Approach C — Runtime CMS/API (TMDB-style, server-rendered on demand) |
|---|---|---|---|
| Fit for content site with ~2–3K permanent pages | Purpose-built; zero-JS default; fastest builds & payload | Good but heavier runtime, more client JS, slower builds at this page count | Overkill; adds hosting cost, cold starts, SEO complexity |
| SEO | Static HTML, trivially crawlable | Equal (SSG mode) | Needs careful SSR/caching for SEO |
| Data freshness | Re-run pipeline + rebuild (fine — Wikipedia data changes slowly) | Same | Live |
| Maintenance | Markdown/JSON + small codebase | Larger dependency graph | Largest (API, DB, auth) |
| Search | Client-side index (MiniSearch) — instant, no server | Same or server search | Server search |

**Decision: Approach A.** Astro 5 static generation; TypeScript everywhere; Tailwind CSS v4 design system; MiniSearch client-side search over a prebuilt JSON index; Vitest TDD for the wikitext-parsing core (pure functions). Pipeline: staged Node scripts (`titles → fetch → dataset`) with a disk cache of raw wikitext so re-runs are incremental and Wikipedia is hit politely (batched queries, 50 titles/request for metadata, 10 for wikitext, serialized with delays, custom User-Agent).

**Name & brand.** **Chalachitra** (चलचित्र, "motion picture"). Data model is origin-agnostic (`origin: 'in' | 'kr' | …`), so Korean content is an additive dataset, not a migration.

## 4. Context & Constraints

- **Licensing.** Wikipedia text is CC BY-SA 4.0 → every page carries attribution + source-article link; plot/premise is excerpted (not full republication) with "Read on Wikipedia" links. Posters remain on `upload.wikimedia.org` (hotlinked with attribution), avoiding re-hosting fair-use media.
- **Boundaries.** 2026 scope only, per requirement. Year/origin filters are first-class in the schema for future expansion.
- **Risks.** (a) Wikipedia markup variance → mitigated by fixture-driven TDD parsers + graceful degradation (page renders with whatever fields parsed). (b) Category growth mid-year → pipeline is idempotent & re-runnable. (c) Person-page cardinality (~1–2.5K) → batched fetch + cache keeps the fetch phase ≈ minutes. (d) Rate limiting → serialized batches with delay + retry/backoff on `maxlag`/429.
- **Port policy.** Non-standard dev/preview port **4730**.

## 5. Deliverable of this phase

This document + `PLAN.md`. Implementation follows the plan's atomic steps with tests-first discipline for all pure logic (parsers, index building, slug/URL logic); UI pages are verified via `astro build`, HTML assertions, and a final code review pass.
