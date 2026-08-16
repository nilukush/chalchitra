/**
 * Stage 4 — trending signals from the Wikimedia Pageviews API.
 *
 * Uses the BULK "top-viewed articles per day" endpoint (1 request per day)
 * rather than per-article queries, which the API rate-limits aggressively.
 * Consequence: scores exist only for articles that appear in a day's top
 * 1000 — exactly the population a "trending" showcase cares about.
 *
 * Emits data/trends.json consumed by the site build.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildTrendsPayload } from './trends-lib.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = path.join(ROOT, 'data');
const CACHE_DIR = path.join(ROOT, 'data', 'cache', 'pageviews');
const USER_AGENT = 'ChalachitraBot/0.1 (trending signal for chalachitra.example)';
const WINDOW_DAYS = 7;

const ymd = (utcMs: number) => {
  const d = new Date(utcMs);
  return d.toISOString().slice(0, 10);
};

/** Fetch one day's top-1000 from cache or API; null when the day has no data yet. */
async function fetchTopOfDay(day: string): Promise<{ article: string; views: number }[] | null> {
  const cacheFile = path.join(CACHE_DIR, `top-${day}.json`);
  if (existsSync(cacheFile)) {
    const cached = JSON.parse(readFileSync(cacheFile, 'utf8'));
    return cached.data;
  }
  const [y, m, d] = day.split('-');
  const url = `https://wikimedia.org/api/rest_v1/metrics/pageviews/top/en.wikipedia/all-access/${y}/${m}/${d}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 2000 * 2 ** attempt));
    try {
      const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' } });
      if (res.status === 404) {
        mkdirSync(CACHE_DIR, { recursive: true });
        writeFileSync(cacheFile, JSON.stringify({ data: null }));
        return null; // day not published yet (or no data)
      }
      if (res.status === 429 || res.status >= 500) continue;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: { items?: { articles?: { article: string; views: number }[] }[] } = await res.json();
      const data = json.items?.[0]?.articles ?? [];
      mkdirSync(CACHE_DIR, { recursive: true });
      writeFileSync(cacheFile, JSON.stringify({ data }));
      return data;
    } catch {
      // retry
    }
  }
  return null;
}

async function main() {
  const movies = JSON.parse(readFileSync(path.join(DATA, 'movies.json'), 'utf8'));
  const series = JSON.parse(readFileSync(path.join(DATA, 'series.json'), 'utf8'));
  const persons = JSON.parse(readFileSync(path.join(DATA, 'persons.json'), 'utf8'));

  // Our catalogue keyed by the pageviews API's underscore form
  const oursByUnderscore = new Map<string, string>(); // 'Matka_King' → 'Matka King'
  for (const t of [...movies, ...series]) oursByUnderscore.set(t.wikiTitle.replace(/ /g, '_'), t.wikiTitle);
  for (const p of persons) oursByUnderscore.set(p.wikiTitle.replace(/ /g, '_'), p.wikiTitle);

  // Walk backwards from yesterday collecting the most recent days with data
  const nowUtc = Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate());
  const days: string[] = [];
  for (let back = 1; back <= 14 && days.length < WINDOW_DAYS; back++) {
    const day = ymd(nowUtc - back * 24 * 3600 * 1000);
    const top = await fetchTopOfDay(day);
    if (top) days.push(day);
    await new Promise((r) => setTimeout(r, 1200));
  }
  if (days.length === 0) throw new Error('No pageview days available at all');
  console.log(`→ Trending window: ${days[days.length - 1]} .. ${days[0]} (${days.length} days)`);

  // views keyed by our wikiTitle (spaces), value = {day: views}
  const views = new Map<string, Record<string, number>>();
  for (const day of days) {
    const top = await fetchTopOfDay(day);
    if (!top) continue;
    for (const row of top) {
      const wikiTitle = oursByUnderscore.get(row.article);
      if (!wikiTitle) continue;
      const daily = views.get(wikiTitle) ?? {};
      daily[day] = row.views;
      views.set(wikiTitle, daily);
    }
  }
  console.log(`  ${views.size} catalogue articles have trending data`);

  const payload = buildTrendsPayload(movies, series, persons, views, 30);
  writeFileSync(path.join(DATA, 'trends.json'), JSON.stringify(payload));
  console.log(`✓ trends.json written — #1 title: ${payload.topTitles[0]?.title} (score ${payload.topTitles[0]?.score})`);
  console.log(`  #1 person: ${payload.topPersons[0]?.name} (score ${payload.topPersons[0]?.score})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
