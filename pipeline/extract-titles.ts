/**
 * Stage 1 — walk the Wikipedia categories (with pagination + subcategory
 * recursion) and persist the title lists to data/titles.json.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchCategoryPages } from './wiki-api.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'data', 'titles.json');

const FILM_CATEGORY = 'Category:2026 Indian films';
const SERIES_CATEGORY = 'Category:2026 Indian television series debuts';

// Pages that are lists or meta-pages rather than individual works
const EXCLUDE = /^(List of|Table of|Timeline of|Index of|Outline of|Glossary of|2026 in)/i;

async function main() {
  console.log('→ Walking film category…');
  const films = await fetchCategoryPages(FILM_CATEGORY);
  console.log(`  ${films.length} film pages`);

  console.log('→ Walking television series debuts category…');
  const series = await fetchCategoryPages(SERIES_CATEGORY);
  console.log(`  ${series.length} series pages`);

  const payload = {
    generatedAt: new Date().toISOString(),
    movies: films.filter((p) => !EXCLUDE.test(p.title)),
    series: series.filter((p) => !EXCLUDE.test(p.title)),
  };

  mkdirSync(path.dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(payload, null, 2));
  console.log(
    `✓ Wrote ${OUT} (${payload.movies.length} movies, ${payload.series.length} series)`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
