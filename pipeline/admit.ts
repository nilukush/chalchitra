/**
 * Admit a reported-missing Wikipedia title into the catalogue (Pyre class:
 * a film outside the current-year category walk that no covered person
 * references yet). Pageid-anchored, classify-gated, one paced fetch per
 * title through the shared wiki client (AGENTS #3).
 *
 * Writes data/cache/extra-titles.json — the admit watchlist build-dataset
 * merges on every rebuild. The file lives in data/cache so it rides the
 * seed release and CI's actions cache: nightly rebuilds keep admitted
 * titles. The day Wikipedia categorizes a film into the year walk, the
 * merge hands ownership to the walk (dedupe by title, zero duplicates).
 *
 * Usage: npm run pipeline:admit "Pyre (film)" ["Another (film)"]
 * Then:  npm run pipeline:dataset    (local rebuild + see the page)
 *        ./scripts-seed.sh swap      (propagate corpus + watchlist to CI)
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnv } from './env.js';

loadEnv();
import { fetchPages } from './wiki-api.js';
import { classifyTitlePage } from './classify-title.js';
import { isMainspaceTitle, type AdmittedTitle } from './dataset-lib.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = path.join(ROOT, 'data');
const WATCHLIST_PATH = path.join(DATA, 'cache', 'extra-titles.json');
const MOVIES_SUMMARY = path.join(DATA, 'movies.json');
const SERIES_SUMMARY = path.join(DATA, 'series.json');

interface Watchlist {
  version: number;
  titles: AdmittedTitle[];
}

function loadWatchlist(): Watchlist {
  if (!existsSync(WATCHLIST_PATH)) return { version: 1, titles: [] };
  const raw = readFileSync(WATCHLIST_PATH, 'utf8');
  const parsed = JSON.parse(raw); // a corrupt watchlist ABORTS: never clobber admits
  const titles = (Array.isArray(parsed.titles) ? parsed.titles : []).filter(
    (t: any): t is AdmittedTitle => !!t && typeof t.title === 'string' && typeof t.pageid === 'number' && t.pageid > 0 && (t.kind === 'movie' || t.kind === 'series'),
  );
  return { version: 1, titles };
}

async function main() {
  const requested = process.argv.slice(2).map((a) => a.trim()).filter(Boolean);
  if (requested.length === 0) {
    console.error('usage: npm run pipeline:admit "<Wikipedia title>" [more titles]');
    process.exit(1);
  }

  // corpus check: a title that already ships needs no admission
  const corpusTitles = new Set<string>();
  if (existsSync(MOVIES_SUMMARY)) {
    for (const t of JSON.parse(readFileSync(MOVIES_SUMMARY, 'utf8'))) corpusTitles.add(t.wikiTitle);
  }
  if (existsSync(SERIES_SUMMARY)) {
    for (const t of JSON.parse(readFileSync(SERIES_SUMMARY, 'utf8'))) corpusTitles.add(t.wikiTitle);
  }

  const watchlist = loadWatchlist();
  const knownPageIds = new Set(watchlist.titles.map((t) => t.pageid));

  console.log(`→ Resolving ${requested.length} title(s) (paced, cache-resumable)…`);
  const pages = await fetchPages(requested);

  let admitted = 0;
  for (const name of requested) {
    const page = pages.get(name);
    if (!page || page.missing || !page.wikitext || !(page.pageid > 0)) {
      console.log(`  ✗ "${name}" — no Wikipedia article found`);
      continue;
    }
    if (!isMainspaceTitle(page.title)) {
      console.log(`  ✗ "${name}" resolves to "${page.title}" — not a mainspace article (Issue 8 guard)`);
      continue;
    }
    if (corpusTitles.has(page.title) || corpusTitles.has(name)) {
      console.log(`  · "${page.title}" — already in the corpus`);
      continue;
    }
    if (knownPageIds.has(page.pageid)) {
      console.log(`  · "${page.title}" — already on the watchlist`);
      continue;
    }
    const verdict = classifyTitlePage(page.wikitext);
    if ('reject' in verdict) {
      console.log(`  ✗ "${page.title}" rejected by classifier: ${verdict.reject}`);
      continue;
    }
    watchlist.titles.push({ title: page.title, pageid: page.pageid, kind: verdict.kind, admittedAt: new Date().toISOString() });
    knownPageIds.add(page.pageid);
    admitted++;
    console.log(`  ✓ "${page.title}" (pageid ${page.pageid}, ${verdict.kind}) admitted`);
  }

  if (admitted === 0) {
    console.log('✓ Nothing new to admit.');
    return;
  }
  mkdirSync(path.dirname(WATCHLIST_PATH), { recursive: true });
  writeFileSync(WATCHLIST_PATH, JSON.stringify({ version: 1, titles: watchlist.titles }, null, 2));
  console.log(`✓ Watchlist now holds ${watchlist.titles.length} title(s): ${WATCHLIST_PATH}`);
  console.log('  Rebuild locally: npm run pipeline:dataset');
  console.log('  Propagate to CI: ./scripts-seed.sh swap (after the rebuild)');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
