/**
 * Stage 2 — fetch (or load from cache) the full page payloads for every title
 * listed in data/titles.json. Cached in data/cache/pages/{pageid}.json.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchPages } from './wiki-api.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function main() {
  const titles = JSON.parse(readFileSync(path.join(ROOT, 'data', 'titles.json'), 'utf8'));
  const all = [
    ...titles.movies.map((m: any) => m.title),
    ...titles.series.map((s: any) => s.title),
  ];
  console.log(`→ Fetching ${all.length} title pages (cache-aware)…`);

  const pages = await fetchPages(all, (done, total) => {
    if (done % 50 === 0 || done === total) console.log(`  ${done}/${total}`);
  });

  const missing = [...pages.values()].filter((p) => p.missing || !p.wikitext);
  console.log(
    `✓ Done: ${pages.size - missing.length} fetched, ${missing.length} missing/empty`,
  );
  if (missing.length > 0) {
    console.log(
      '  Missing examples:',
      missing.slice(0, 5).map((p) => p.title).join(', '),
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
