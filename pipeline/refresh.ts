/**
 * Stage 6 — incremental refresh (Step 8 core): keep the site near-current with
 * Wikipedia without refetching the world.
 *
 * 1. Poll `prop=info` lastrevids for every cached page (batches of 50, paced).
 * 2. Diff against data/cache/revid-snapshot.json (planRefresh, tested).
 * 3. Invalidate ONLY changed pages (delete their page cache file) and refetch
 *    them through the normal paced path. NEVER FORCE_REFRESH (AGENTS.md #3).
 * 4. Save the new snapshot.
 *
 * First run establishes the baseline without refetching. Runbook after this:
 * `npm run pipeline:titles && npm run pipeline:dataset && npm run build`.
 *
 * Usage: npm run pipeline:refresh
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, rmSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnv } from './env.js';

loadEnv();
import { fetchPages, fetchLastRevids } from './wiki-api.js';
import { planRefresh, planRenames } from './refresh-lib.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PAGES_DIR = path.join(ROOT, 'data', 'cache', 'pages');
const SNAPSHOT_PATH = path.join(ROOT, 'data', 'cache', 'revid-snapshot.json');

interface CachedIndexEntry {
  pageid: number;
  title: string;
  file: string;
}

function indexCache(): CachedIndexEntry[] {
  const entries: CachedIndexEntry[] = [];
  for (const file of readdirSync(PAGES_DIR)) {
    if (!file.endsWith('.json')) continue;
    try {
      const page = JSON.parse(readFileSync(path.join(PAGES_DIR, file), 'utf8'));
      if (page?.pageid > 0 && page?.title) entries.push({ pageid: page.pageid, title: page.title, file });
    } catch {
      /* corrupt cache entry — skip */
    }
  }
  return entries;
}

async function main() {
  const index = indexCache();
  console.log(`→ Refresh: ${index.length} cached pages`);

  console.log('→ Polling live lastrevids (batches of 50, paced)…');
  const live = await fetchLastRevids(index.map((e) => e.pageid));
  console.log(`  ${live.size} revids resolved`);

  const current: Record<string, number> = {};
  const liveTitles: Record<string, string> = {};
  for (const [pageid, info] of live) {
    current[String(pageid)] = info.revid;
    if (info.title) liveTitles[String(pageid)] = info.title;
  }
  // Wikipedia page MOVES don't bump lastrevid — diff live titles against the
  // cached titles to catch renames (Khalifa: The Intro → Khalifa: The Ruler).
  const cachedTitles: Record<string, string> = {};
  for (const entry of index) cachedTitles[String(entry.pageid)] = entry.title;
  const renamedIds = new Set(planRenames(cachedTitles, liveTitles));
  if (renamedIds.size > 0) {
    console.log(`→ ${renamedIds.size} pages renamed on Wikipedia — invalidating for refetch under new titles`);
    for (const id of renamedIds) {
      const entry = index.find((e) => String(e.pageid) === id);
      if (entry) rmSync(path.join(PAGES_DIR, entry.file), { force: true });
    }
  }
  const renamedTitles = [...renamedIds]
    .map((id) => liveTitles[id])
    .filter((t): t is string => Boolean(t));

  let previous: Record<string, number> | null = null;
  if (existsSync(SNAPSHOT_PATH)) {
    try {
      previous = JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf8'));
    } catch {
      previous = null;
    }
  }

  if (previous === null) {
    mkdirSync(path.dirname(SNAPSHOT_PATH), { recursive: true });
    writeFileSync(SNAPSHOT_PATH, JSON.stringify(current));
    console.log('✓ Baseline snapshot established — next run diffs against it.');
    return;
  }

  const plan = planRefresh(previous, current);
  const byPageid = new Map(index.map((e) => [e.pageid, e]));
  const changedTitles = plan.changed
    .map((id) => byPageid.get(Number(id))?.title)
    .filter((t): t is string => Boolean(t));
  // renamed pages were invalidated above; fetch them under their NEW titles
  const refetchTitles = [...new Set([...changedTitles, ...renamedTitles])];
  const addedTitles = plan.added
    .map((id) => byPageid.get(Number(id))?.title)
    .filter((t): t is string => Boolean(t));

  console.log(`→ Plan: ${plan.changed.length} changed, ${plan.added.length} newly cached since snapshot`);

  if (refetchTitles.length > 0) {
    // invalidate only the changed pages, then refetch through the paced path
    for (const id of plan.changed) {
      const entry = byPageid.get(Number(id));
      if (entry) rmSync(path.join(PAGES_DIR, entry.file), { force: true });
    }
    console.log(`→ Refetching ${refetchTitles.length} edited/renamed pages (paced)…`);
    const pages = await fetchPages(refetchTitles);
    const recovered = [...pages.values()].filter((p) => p && !p.missing && p.wikitext).length;
    console.log(`  ${recovered} pages refreshed`);
  } else {
    console.log('  no edited pages — cache is current.');
  }
  if (addedTitles.length > 0) console.log(`  (${addedTitles.length} pages cached since the last snapshot — no refetch needed)`);

  writeFileSync(SNAPSHOT_PATH, JSON.stringify(current));
  console.log('✓ Snapshot updated. Next: npm run pipeline:titles && npm run pipeline:dataset && npm run build');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
