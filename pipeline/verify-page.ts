/**
 * Identity-anchored page verification (foolproofing package, 2026-09-21).
 *
 * Answers "is this OUR bug or upstream data?" with pageid-level evidence:
 * resolves a slug through the local dataset to its Wikipedia pageid, then
 * prints OUR record, OUR cached copy and the LIVE article side by side.
 * Bare-title API probes once produced a confidently wrong "live-data
 * reality" verdict (Issue 6: the bare title was a reggae band; the series
 * article was "The Revolutionaries (TV series)" and had the date all along).
 *
 * Usage: npm run verify:page -- <slug | pageid>   (e.g. the-revolutionaries)
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseStartDate } from './wikitext/dates.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = process.argv[2];
if (!arg) {
  console.error('usage: npm run verify:page -- <slug | pageid>');
  process.exit(2);
}

interface Found {
  kind: 'movie' | 'series';
  slug: string;
  title: string;
  wikiTitle: string;
  pageid: number;
  releaseDate?: string;
  archive?: boolean;
}

function findRecord(): Found | undefined {
  const scan = (kind: 'movie' | 'series') =>
    JSON.parse(readFileSync(path.join(ROOT, 'data', `${kind === 'movie' ? 'movies' : 'series'}.json`), 'utf8')) as any[];
  for (const kind of ['movie', 'series'] as const) {
    for (const t of scan(kind)) {
      if (t.slug === arg || t.pageid === Number(arg)) {
        return {
          kind, slug: t.slug, title: t.title, wikiTitle: t.wikiTitle, pageid: t.pageid,
          releaseDate: t.releaseDate, archive: t.archive,
        };
      }
    }
  }
  return undefined;
}

const record = findRecord();
if (!record) {
  console.error(`no local record for "${arg}" (movies.json/series.json)`);
  process.exit(2);
}
console.log('── our record');
console.log(JSON.stringify({ ...record }, null, 1));

const cacheFile = path.join(ROOT, 'data', 'cache', 'pages', `${record.pageid}.json`);
if (existsSync(cacheFile)) {
  const page = JSON.parse(readFileSync(cacheFile, 'utf8'));
  const dateParam = page.wikitext?.match(/\|\s*(released|first_aired)\s*=\s*([^\n]{0,80})/);
  console.log('── our cached copy');
  console.log(JSON.stringify({
    title: page.title,
    fetchedAt: page.fetchedAt,
    revid: page.revid ?? 'LEGACY (pre-2026-09-21)',
    releasedParam: dateParam ? dateParam[2].trim().slice(0, 70) : '(none)',
  }, null, 1));
} else {
  console.log('── our cached copy: MISSING (page not in local cache)');
}

console.log('── live article (pageid-anchored)');
const res = await fetch(
  `https://en.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&pageids=${record.pageid}` +
  `&prop=revisions&rvprop=content|ids|timestamp&rvslots=main&origin=*`,
  { headers: { 'User-Agent': 'chalchitra-pipeline/1.0 (local verification)' } },
);
const data = await res.json();
const page = Object.values(data.query.pages)[0] as any;
if (page.missing) {
  console.log('LIVE ARTICLE DELETED/MISSING on Wikipedia');
} else {
  const wikitext = page.revisions?.[0]?.slots?.main?.content ?? '';
  const dateParam = wikitext.match(/\|\s*(released|first_aired)\s*=\s*([^\n]{0,80})/);
  const liveDate = parseStartDate(dateParam?.[2]);
  console.log(JSON.stringify({
    title: page.title,
    revid: page.revisions[0].revid,
    releasedParam: dateParam ? dateParam[2].trim().slice(0, 70) : '(none)',
    parsedDate: liveDate,
  }, null, 1));
  const cache = existsSync(cacheFile) ? JSON.parse(readFileSync(cacheFile, 'utf8')) : null;
  if (cache?.revid && cache.revid !== page.revisions[0].revid) {
    console.log(`✗ STALE: cached revid ${cache.revid} ≠ live ${page.revisions[0].revid} — run pipeline:refresh (or wait for the nightly)`);
  } else if (cache?.revid) {
    console.log('✓ fresh: cached revid matches live');
  }
  if (liveDate && record.releaseDate && liveDate !== record.releaseDate) {
    console.log(`✗ DRIFT: our releaseDate ${record.releaseDate} ≠ live ${liveDate} — rebuild needed`);
  }
}
