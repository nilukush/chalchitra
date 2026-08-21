/**
 * Episode extraction. Wikipedia styles:
 * 1. {{Episode table}} wrapping {{Episode list}} templates (best structure)
 * 2. plain {| wikitable |} episode tables with a header row (rowspan-expanded
 *    through the shared table grid)
 *
 * Multi-season articles keep one section per season ("=== Season 2 ===",
 * "=== Series 2 (2021) ===", "=== Season 2: Subtitle ===") — rows from EVERY
 * season section are collected and tagged with that season number, so the
 * season-tab UI can group them.
 */
import { parseStartDate } from './dates.js';
import { stripWikitext } from './clean.js';
import { extractSections } from './sections.js';
import { findTemplates } from './infobox.js';
import { parseWikitableView } from './tables.js';

export interface EpisodeRow {
  number: string;
  title: string;
  director?: string;
  writer?: string;
  airDate?: string;
  runtime?: string;
  summary?: string;
  /** episode still (TMDB image URL) */
  still?: string;
  /** season the row belongs to (from the section heading or TMDB synthesis) */
  season?: number;
}

function clean(text: string | undefined): string | undefined {
  const stripped = stripWikitext(text ?? '')
    .replace(/\s+/g, ' ')
    .replace(/^["“”']+|["“”']+$/g, '')
    .trim();
  return stripped.length > 0 ? stripped : undefined;
}

/** "Season 2 (2024)" / "Series 2: The return" / "Season 2" → 2 */
const SEASON_HEADING = /(?:season|series)\s*(\d+)/i;

function seasonFromHeading(title: string): number | null {
  const m = SEASON_HEADING.exec(title);
  return m ? Number(m[1]) : null;
}

function templateRows(text: string): EpisodeRow[] {
  return findTemplates(text, /^episode list$/i)
    .map((tpl) => ({
      number: clean(tpl.params['episodenumber']) ?? '',
      title: clean(tpl.params['title']) ?? '',
      director: clean(tpl.params['directedby']),
      writer: clean(tpl.params['writtenby']),
      airDate: parseStartDate(tpl.params['originalairdate']) ?? clean(tpl.params['originalairdate']),
      summary: clean(tpl.params['shortsummary']),
    }))
    .filter((e) => e.title || e.number);
}

export function extractEpisodes(pageWikitext: string): EpisodeRow[] {
  const rows: EpisodeRow[] = [];
  const seen = new Set<string>();
  const pushRows = (list: EpisodeRow[], season: number | null) => {
    for (const row of list) {
      if (season !== null && row.season === undefined) row.season = season;
      const key = `${row.season ?? 1}|${row.number}|${row.title}`;
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push(row);
    }
  };

  for (const section of extractSections(pageWikitext)) {
    const season = seasonFromHeading(section.title);
    if (!/episode/i.test(section.title) && season === null) continue;
    pushRows(templateRows(section.body), season);
    pushRows(parseWikiTables(section.body), season);
  }

  // legacy fallback: templates anywhere on the page (articles that keep the
  // table outside a titled section)
  if (rows.length === 0) pushRows(templateRows(pageWikitext), null);
  return rows;
}

/** `{{Main|List of Aahat episodes}}` → the subpage title, or null. */
export function findEpisodesSubpage(pageWikitext: string): string | null {
  const templates = findTemplates(pageWikitext ?? '', /^(main|main\s*list|main\s*article)$/i);
  for (const t of templates) {
    const target = (t.params['1'] ?? '').replace(/<[^>]+>/g, '').trim();
    if (/^list of .*(episodes|episode list)/i.test(target)) return target;
  }
  return null;
}

const COLUMN_MATCHERS: [RegExp, keyof EpisodeRow][] = [
  [/^(no\.?|num\.?|numb?#?|#|e?ps?\.?|episode)$/, 'number'],
  [/title|name/, 'title'],
  [/dir/, 'director'],
  [/writ/, 'writer'],
  [/date/, 'airDate'],
  [/summary|plot|desc/, 'summary'],
];

function headerToKey(header: string): keyof EpisodeRow | null {
  for (const [pattern, key] of COLUMN_MATCHERS) {
    if (pattern.test(header)) return key;
  }
  return null;
}

function parseWikiTables(text: string): EpisodeRow[] {
  const rows: EpisodeRow[] = [];
  const tableRe = /\{\|([\s\S]*?)\|\}/g;
  let table: RegExpExecArray | null;
  while ((table = tableRe.exec(text)) !== null) {
    const view = parseWikitableView(table[0]);
    // parseWikitableView only promotes keyword headers (year/title/award/…);
    // episode tables use "No. | Ep. | Episode title" shapes it can miss, so
    // derive the header from the ! row ourselves in that case
    let headerCells: string[] | null = view.header;
    let dataRows = view.rows;
    if (headerCells === null) {
      const headerLine = table[1].split('\n').find((l) => l.trim().startsWith('!'));
      if (!headerLine) continue;
      headerCells = headerLine
        .replace(/^\s*!+/, '')
        .split(/!!/)
        .map((c) => stripWikitext(c).toLowerCase().trim());
      dataRows = dataRows.slice(1); // the ! row itself landed in the rows
    }
    const keys = headerCells.map((h) => headerToKey(h));
    if (!keys.includes('title') && !keys.includes('number')) continue;

    for (const cells of dataRows) {
      const row: Partial<EpisodeRow> = {};
      keys.forEach((key, i) => {
        const cell = cells[i];
        if (key === null || cell === undefined || cell.trim() === '') return;
        if (key === 'airDate') {
          row.airDate = parseStartDate(cell) ?? clean(cell);
        } else {
          const value = clean(cell);
          if (value) (row as Record<string, string>)[key] = value;
        }
      });
      if (row.number === undefined || !/^\d+$/.test(row.number)) continue; // junk rows
      rows.push(row as EpisodeRow);
    }
  }
  return rows;
}
