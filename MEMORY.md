# MEMORY.md — session state log

## Session 1 — 2026-08-16 (initial build)

**Goal.** Beautiful graphical website for Indian movies & series, 2026 scope, from Wikipedia;
name/stack/design decided autonomously per user instruction.

**Decisions.**
- Name: **Chalachitra** (चलचित्र). Tagline: "The definitive guide to Indian cinema & series".
- Stack: Astro 5 static + Tailwind v4 + Vitest + MiniSearch; Node pipeline w/ disk cache.
- Data: `Category:2026 Indian films` (366 pages) + `Category:2026 Indian television series debuts`
  (38 + 22 Tamil subcat) → 365 films / 60 series after filters.
- Port 4730 everywhere (user's non-standard port policy).

**Completed.**
- ANALYSIS.md (approach eval → Astro), PLAN.md (9-step contract).
- Wikitext parser library, 75 vitest tests green (fixtures from real pages: Dhurandhar, Matka King).
- wiki-api client: pagination + subcat recursion, 10-title batches, 1.1s pacing,
  Retry-After-aware backoff (fixed after a real 429 episode), per-batch skip+resume.
- Stage 1+2: all 425 title pages cached, 0 missing.
- Stage 3: 2292 person candidates → datasets (in progress at time of writing).
- Full site: home/movies/series/people/search/about/404, JSON-LD (Movie/TVSeries/Person +
  BreadcrumbList), sitemap, robots.txt, llms.txt, OG/Twitter, canonicals, `?lang=` filters,
  MiniSearch client search (`public/search-index.json`).

**Divergences / lessons.**
- Wikipedia 429'd the initial 250ms pacing → pacing raised to 1100ms + Retry-After honored;
  fetch made per-batch resilient (retry once after 30s, then skip; re-run resumes from cache).
- `extracts` plaintext intro (API) preferred over locally stripped lead for summaries.

**Next steps.**
- `npm run build` verification + curl checks on :4730 (Step 9 of PLAN.md).
- Code-review subagent pass (Verifier role) — user's 3-agent consensus requirement.
- Future: more years (parameterise `YEAR`), Korean dataset (`origin` field already present).
