/**
 * Stage 1 — walk the Wikipedia categories (with pagination + subcategory
 * recursion) and persist the title lists to data/titles.json.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchCategoryPages } from './wiki-api.js';
import { mergeSeriesRoots } from './dataset-lib.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'data', 'titles.json');

const CATALOGUE_YEAR = 2026;
const FILM_CATEGORY = `Category:${CATALOGUE_YEAR} Indian films`;
// Wikipedia hangs the by-language year categories (2026 Malayalam-language
// films etc.) under "2026 films by language", NOT under "2026 Indian films" —
// walking only the parent missed ~72 current-year films (Bethlehem Kudumba
// Unit class: they arrived as archive-only and vanished from "Fresh in
// theatres"). Walk every Indian-language root as well.
const FILM_LANGUAGE_CATEGORIES = [
  'Hindi', 'Tamil', 'Telugu', 'Malayalam', 'Kannada', 'Bengali', 'Marathi',
  'Punjabi', 'Gujarati', 'Odia', 'Assamese', 'Urdu',
].map((l) => `Category:${CATALOGUE_YEAR} ${l}-language films`);
const SERIES_CATEGORY = `Category:${CATALOGUE_YEAR} Indian television series debuts`;
// Global debuts categories mix every country (Issue 4: Chumbak sits ONLY in
// the global TV-debuts queue; ~7 Indian streaming debuts only in web-series
// debuts). Fetched DIRECT-PAGES-ONLY (depth 0): recursing would walk their
// 41 country subcategories. Members carry indiaCheck → build-dataset gates
// them through classifyTitlePage.
const GLOBAL_TV_DEBUTS = `Category:${CATALOGUE_YEAR} television series debuts`;
const GLOBAL_WEB_DEBUTS = `Category:${CATALOGUE_YEAR} web series debuts`;

// Pages that are lists or meta-pages rather than individual works
const EXCLUDE = /^(List of|Table of|Timeline of|Index of|Outline of|Glossary of|2026 in)/i;

async function main() {
  console.log('→ Walking film category + language roots…');
  const filmPages = await Promise.all([FILM_CATEGORY, ...FILM_LANGUAGE_CATEGORIES].map((c) => fetchCategoryPages(c)));
  const films = [...new Map(filmPages.flat().map((p) => [p.pageid, p])).values()];
  console.log(`  ${films.length} film pages`);

  console.log('→ Walking television series debuts categories…');
  const indianDebuts = await fetchCategoryPages(SERIES_CATEGORY);
  console.log(`  ${indianDebuts.length} pages (Indian debuts root)`);
  const globalTvDebuts = await fetchCategoryPages(GLOBAL_TV_DEBUTS, 0);
  const globalWebDebuts = await fetchCategoryPages(GLOBAL_WEB_DEBUTS, 0);
  console.log(`  +${globalTvDebuts.length} global TV debuts, +${globalWebDebuts.length} web series debuts (India-checked at build)`);
  const series = mergeSeriesRoots(indianDebuts, [globalTvDebuts, globalWebDebuts]);

  const payload = {
    generatedAt: new Date().toISOString(),
    catalogueYear: CATALOGUE_YEAR,
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
