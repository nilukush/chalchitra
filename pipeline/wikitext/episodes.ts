/**
 * Episode extraction. Two Wikipedia styles:
 * 1. {{Episode table}} wrapping {{Episode list}} templates (best structure)
 * 2. plain {| wikitable |} episode tables with a header row
 */
import { parseStartDate } from './dates.js';
import { stripWikitext } from './clean.js';
import { extractSections } from './sections.js';
import { findTemplates } from './infobox.js';

export interface EpisodeRow {
  number: string;
  title: string;
  director?: string;
  writer?: string;
  airDate?: string;
  runtime?: string;
  summary?: string;
  /** TMDB season number when the row was synthesized (wiki tables have none) */
  season?: number;
}

function clean(text: string | undefined): string | undefined {
  const stripped = stripWikitext(text ?? '')
    .replace(/\s+/g, ' ')
    .replace(/^["“”']+|["“”']+$/g, '')
    .trim();
  return stripped.length > 0 ? stripped : undefined;
}

export function extractEpisodes(pageWikitext: string): EpisodeRow[] {
  // 1) Template style — {{Episode list}} anywhere on the page
  const fromTemplates = findTemplates(pageWikitext, /^episode list$/i).map((tpl) => ({
    number: clean(tpl.params['episodenumber']) ?? '',
    title: clean(tpl.params['title']) ?? '',
    director: clean(tpl.params['directedby']),
    writer: clean(tpl.params['writtenby']),
    airDate: parseStartDate(tpl.params['originalairdate']) ?? clean(tpl.params['originalairdate']),
    summary: clean(tpl.params['shortsummary']),
  }));
  const valid = fromTemplates.filter((e) => e.title || e.number);
  if (valid.length > 0) return valid;

  // 2) Wikitable style — inside an Episodes-ish section
  const section =
    extractSections(pageWikitext).find((s) => /episode/i.test(s.title))?.body ?? pageWikitext;
  return parseWikiTables(section);
}

const COLUMN_MATCHERS: [RegExp, keyof EpisodeRow][] = [
  [/^(no\.?|num\.?|numb?#?|#|e?ps?\.?|episode)$/i, 'number'],
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
    const lines = table[1].split('\n');
    const headerCells: string[] = [];
    const dataRows: string[][] = [];
    let current: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('!')) {
        headerCells.push(
          ...trimmed
            .replace(/^!+/, '')
            .split(/!!/)
            .map((c) => stripWikitext(c).toLowerCase().trim()),
        );
      } else if (/^\|-/.test(trimmed)) {
        if (current.length > 0) dataRows.push(current);
        current = [];
      } else if (trimmed.startsWith('|')) {
        current.push(
          ...trimmed
            .replace(/^\|/, '')
            .split(/\|\|/)
            .map((c) => c.trim()),
        );
      }
    }
    if (current.length > 0) dataRows.push(current);

    const keys = headerCells.map((h) => headerToKey(h));
    if (!keys.includes('title') && !keys.includes('number')) continue;

    for (const cells of dataRows) {
      const row: Partial<EpisodeRow> = {};
      keys.forEach((key, i) => {
        const cell = cells[i];
        if (key === null || cell === undefined) return;
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
