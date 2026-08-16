# AGENTS.md — working agreement for coding agents

## Context documents
- `ANALYSIS.md` — problem definition, approach evaluation (Astro chosen), constraints
- `PLAN.md` — the binding step-by-step implementation contract (steps 1–9)
- `MEMORY.md` — session-to-session state log (read first, append after work)

## Non-negotiables
1. **Tests first** for pure logic (`pipeline/**`): add/extend the `*.test.ts` fixtures, watch them
   fail, then implement. Run `npm test` before declaring any step done.
2. **No regressions**: `npm test && npm run build` must both pass before finishing a task.
3. **Wikipedia politeness**: never remove request pacing/backoff from `pipeline/wiki-api.ts`;
   prefer re-running the pipeline (cache-resumable) over parallel fetching.
4. **Attribution**: any page rendering Wikipedia-derived text must keep the source link and
   CC BY-SA notice.
5. Max 3 failed attempts on any step → stop and document in `MEMORY.md`.

## Conventions
- TypeScript strict; ESM (`"type": module`); imports in pipeline use `.js` extensions.
- Astro pages stay thin: data shaping belongs in `src/lib/data.ts` or components.
- Design tokens live in `src/styles/global.css` (`@theme` block) — use semantic classes
  (`ink-*`, `ivory-*`, `saffron-*`), no raw hex in components.
- Ports: dev/preview on **4730**.

## Pipeline runbook
```bash
npm run pipeline:titles   # ~10s
npm run pipeline:fetch    # minutes; resumable via data/cache/pages
npm run pipeline:dataset  # parses + fetches persons; resumable
npm run build             # verify page count in output
```
