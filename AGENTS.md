# AGENTS.md — working agreement for coding agents

## Context documents
- `CLAUDE.md` — current architecture + gotchas (read after this)
- `MEMORY.md` — session-to-session state log (read first, append after work)
- `SESSION-15-ANALYSIS-PLAN.md` — the completed data-completeness plan (steps 1–8)

## Non-negotiables
1. **Tests first** for pure logic (`pipeline/**`): add/extend the `*.test.ts` fixtures, watch them
   fail, then implement. Run `npm test` before declaring any step done.
2. **No regressions**: `npm test && npm run build` must both pass before finishing a task.
3. **Wikipedia politeness**: never remove request pacing/backoff from `pipeline/wiki-api.ts`;
   prefer re-running the pipeline (cache-resumable) over parallel fetching. One paced client
   at a time — don't run two wave/refresh scripts concurrently.
4. **Attribution**: any page rendering Wikipedia-derived text must keep the source link and
   CC BY-SA notice.
5. Max 3 failed attempts on any step → stop and document in `MEMORY.md`.
6. `data/*.json` are GENERATED (gitignored): rebuild with `pipeline:dataset`, never commit.

## Conventions
- TypeScript strict; ESM (`"type": module`); imports in pipeline use `.js` extensions.
- Astro pages stay thin: data shaping belongs in `src/lib/data.ts` or components.
- Design tokens live in `src/styles/global.css` (`@theme` block) — use semantic classes
  (`ink-*`, `ivory-*`, `saffron-*`), no raw hex in components.
- Ports: dev/preview on **4730**.
- Persons dataset = first-letter chunks (`data/persons/<L>.json`, `#`→`_.json`); load via
  `pipeline/persons-store.ts` (pipeline) or the glob in `src/lib/data.ts` (site).

## Pipeline runbook
```bash
npm run pipeline:titles        # ~10s; discovers current-year catalogue titles
npm run pipeline:fetch         # minutes; resumable via data/cache/pages
npm run pipeline:dataset       # full rebuild from cache (+TMDB/AI enrichment;
                               # persons written as chunks). Warm cache ≈ 5 min.
npm run pipeline:persons <n>   # person wave: fetch cast/crew pages discovered on
                               # cached titles (ranked by reference count, paced,
                               # resumable). EXPAND_PERSONS_FOCUS=<slug> hoists a title.
npm run pipeline:expand <n>    # title wave: filmography works → title pages
npm run pipeline:refresh       # lastrevid diff → refetch ONLY edited pages
npm run pipeline:tmdb-changes  # TMDB change-list delta → invalidate stale entries
npm run build                  # verify page count in output
```

## Deployment (Render + GitHub)
- Repo: github.com/nilukush/chalchitra (public — free Actions minutes).
- Workflows: refresh-daily (05:15 UTC: refresh → dataset → build → publish seed →
  Render deploy hook) and refresh-hourly (data only, no deploy — Render free tier
  caps at 500 build minutes/month).
- Render static site builds from the repo + downloads the `seed` release cache.
- Secrets needed: TMDB_API_KEY, AI_API_KEY (Actions), RENDER_DEPLOY_HOOK (Actions,
  from the Render dashboard once the site is created).
