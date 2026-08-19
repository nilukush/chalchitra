/**
 * Person filmography/discography, structured the way Wikipedia presents it:
 * one section per medium (Film / Television / Music videos / …), each with
 * table rows carrying year, title, role and notes. Prose-only sections
 * degrade to link rows. Tables on a dedicated subpage ({{Main|X filmography}})
 * are the caller's job to fetch — `findFilmographySubpage` finds the pointer.
 */
import { stripWikitext } from './clean.js';
import { extractWikiLinks } from './links.js';
import { findTemplates } from './infobox.js';
import { parseWikitableView } from './tables.js';

export type FilmographyMedium = 'film' | 'television' | 'other';

export interface FilmographyRow {
  /** raw year cell: "2018", "2018–19", "TBA" */
  year?: string;
  title: string;
  wikiTitle?: string;
  role?: string;
  notes?: string;
  medium: FilmographyMedium;
}

export interface FilmographySection {
  heading: string;
  medium: FilmographyMedium;
  rows: FilmographyRow[];
}

const WORK_SECTIONS =
  /(filmograph|\bfilm\b|\bfilms\b|\bmovies\b|television|discography|videography|notable works|music videos|web series)/i;

const WORK_SUBSECTION =
  /^as\s+(an?\s+)?(actor|actress|director|producer|writer|host|singer|artist|dancer|composer|playback)/i;

const NOT_A_WORK =
  /^(\+\s*)?(list of|index of|awards?|accolades?|nominations?|19\d\d|20\d\d|category|wikipedia|template|the following|filmography|discography|bibliography|references|external links)/i;

const NOT_A_WORK_EXACT =
  /^(the times of india|hindustan times|the indian express|india today|deccan herald|deccan chronicle|the hindu|ndtv|cnn-news18|zee news|bollywood hungama|rediff|dna india|firstpost|the free press journal|mid-day|youtube|netflix|amazon prime video|disney\+ hotstar|jiocinema|sonyliv|mx player|zee5|aha \(streaming service\)|sun nxt|imdb|rotten tomatoes|cinema of india|indian cinema|bollywood|tollywood|kollywood|mollywood|sandalwood|playback singing|playback singer|feature film|short film|soundtrack album|filmfare awards?|filmfare ott awards?|national film awards?|siima awards?|iifa awards?|screen awards?|stardust awards?|zee cine awards?|nandi awards?)$/i;

const INDIAN_LANGUAGE =
  /^(hindi|punjabi|tamil|telugu|kannada|malayalam|bengali|marathi|gujarati|english|urdu|assamese|odia|tulu|meitei)( (language|cinema))?$/i;

const HEADING = /^(={2,6})\s*(.+?)\s*=+\s*$/;

/** Header cell → row field (header text already normalised lowercase). */
const HEADER_FIELD: Record<string, 'year' | 'title' | 'role' | 'notes'> = {
  year: 'year',
  title: 'title',
  film: 'title',
  movie: 'title',
  name: 'title',
  show: 'title',
  serial: 'title',
  serie: 'title',
  series: 'title',
  work: 'title',
  role: 'role',
  played: 'role',
  'played as': 'role',
  character: 'role',
  portrayed: 'role',
  note: 'notes',
  language: 'notes',
  director: 'notes',
  platform: 'notes',
  channel: 'notes',
  network: 'notes',
  music: 'notes',
};

function mediumFor(heading: string): FilmographyMedium {
  if (/television|\btv\b|serial|web series|streaming/i.test(heading)) return 'television';
  if (/filmograph|\bfilm\b|\bfilms\b|\bmovies\b|as\s+(an?\s+)?(actor|actress|director|producer|writer)/i.test(heading)) return 'film';
  return 'other';
}

function isWorkLink(target: string): boolean {
  return !NOT_A_WORK.test(target) && !NOT_A_WORK_EXACT.test(target) && !INDIAN_LANGUAGE.test(target);
}

/** Year-ish cells we carry forward across rowspan years. */
const YEARISH = /^(\d{4}|\d{4}\s*[–—-]\s*\d{0,4}|TBA|forthcoming|upcoming)$/i;

/** Header words that must never become a work title. */
const JUNK_TITLE =
  /^(language|languages|review|reviews|year|title|role|roles|note|notes|ref\.?|refs?|result|award|category|work|film|show|serial|network|channel|director|producer|rank|no\.|#|references?)$/i;

/** Release-status words that leak into the title slot when a real title cell
 *  was template-wrapped ({{Pending film|…}}) or a rowspan notes cell shifted. */
const STATUS_TITLE =
  /^(filming|filmed|released|release|tba|announced|pre-?production|post-?production|production|delayed|upcoming|completed|scheduled|unreleased)$/i;

export function extractFilmography(pageWikitext: string, limit = 240): FilmographySection[] {
  const sections: FilmographySection[] = [];
  let active = false;
  let activeLevel = 0;
  let current: FilmographySection | null = null;

  const openSection = (heading: string) => {
    if (current && current.rows.length > 0) sections.push(current);
    current = { heading, medium: mediumFor(heading), rows: [] };
  };
  const flushSection = () => {
    if (current && current.rows.length > 0) sections.push(current);
    current = null;
  };

  let buffer: string[] = [];
  let bufferHeading = '';
  const collectBuffer = () => {
    if (!active || buffer.length === 0 || !current) {
      buffer = [];
      return;
    }
    const text = buffer.join('\n');
    // tables become structured rows; prose remainder becomes link rows
    const tables = text.match(/\{\|[\s\S]*?\|\}/g) ?? [];
    for (const table of tables) collectTable(table, current);
    const prose = text.replace(/\{\|[\s\S]*?\|\}/g, '\n');
    for (const link of extractWikiLinks(prose)) {
      if (!isWorkLink(link.target)) continue;
      if (current.rows.some((r) => (r.wikiTitle ?? r.title) === (link.target ?? link.label))) continue;
      current.rows.push({ title: link.label || link.target, wikiTitle: link.target, medium: current.medium });
    }
    buffer = [];
  };

  const collectTable = (table: string, section: FilmographySection) => {
    const view = parseWikitableView(table);
    const fields = view.header?.map((h) => HEADER_FIELD[h] ?? null) ?? null;
    let lastYear: string | undefined;

    for (const cells of view.rows) {
      const texts = cells.map((c) => c.trim()).filter((t) => t !== '');
      if (texts.length === 0) continue;

      // Column alignment only when this row has the full complement; rowspan
      // and colspan gaps otherwise shift cells under the wrong headers.
      const aligned = fields !== null && texts.length === fields.length;
      let year: string | undefined;
      let title = '';
      let wikiTitle: string | undefined;
      let role: string | undefined;
      const noteBits: string[] = [];

      texts.forEach((text, i) => {
        const field = aligned ? (fields![i] ?? null) : null;
        if (YEARISH.test(text) && year === undefined && (field === null || field === 'year')) {
          year = text;
          return;
        }
        const display = stripWikitext(text).replace(/\s+/g, ' ').trim();
        if (title === '') {
          const isTitleField = field === 'title';
          const looksLikeTitle = /\[\[/.test(text) || field === null || isTitleField;
          if (looksLikeTitle || texts.length === 1) {
            const link = extractWikiLinks(text)[0];
            wikiTitle = link?.target;
            title = display || link?.label || '';
            return;
          }
        }
        if (role === undefined && (field === 'role' || (field === null && title !== ''))) {
          role = display;
          return;
        }
        if (display && !/^(ref\.?|refs?|\^|\[\d+\])$/i.test(display)) noteBits.push(display);
      });

      // rowspan year carry-forward: "2018" spanning rows below
      if (year === undefined && title !== '' && lastYear) year = lastYear;
      if (year) lastYear = year;

      const finalTitle = (title || '').trim();
      const target = wikiTitle ?? finalTitle;
      const cleanRole = (role || '').replace(/\s*\(\s*\)/g, '').trim();
      if (
        finalTitle &&
        isWorkLink(target) &&
        !JUNK_TITLE.test(finalTitle) &&
        !STATUS_TITLE.test(finalTitle) &&
        !/^\d{4}$/.test(finalTitle)
      ) {
        if (section.rows.some((r) => (r.wikiTitle ?? r.title) === target)) continue;
        section.rows.push({
          year,
          title: finalTitle,
          wikiTitle,
          role: cleanRole && cleanRole !== 'TBA' ? cleanRole : undefined,
          notes: noteBits.length > 0 ? noteBits.join('; ') : undefined,
          medium: section.medium,
        });
      } else {
        // header/junk row: links inside it may still name real works
        for (const link of extractWikiLinks(texts.join(' '))) {
          if (!isWorkLink(link.target)) continue;
          if (section.rows.some((r) => (r.wikiTitle ?? r.title) === link.target)) continue;
          section.rows.push({ year, title: link.label || link.target, wikiTitle: link.target, medium: section.medium });
        }
      }
    }
  };

  for (const line of (pageWikitext ?? '').split('\n')) {
    const heading = HEADING.exec(line);
    if (heading) {
      collectBuffer();
      const level = heading[1].length;
      const title = heading[2].replace(/\[edit\]/gi, '').trim();
      if (WORK_SECTIONS.test(title) || WORK_SUBSECTION.test(title)) {
        if (!active || level <= activeLevel) openSection(title);
        else if (current) {
          // deeper subsection inside an open work block → its own medium bucket
          collectBuffer();
          openSection(title);
        }
        active = true;
        activeLevel = level;
        bufferHeading = title;
      } else if (active && level > activeLevel) {
        // nested non-work subsection (e.g. ===Reception=== inside ==Filmography==)
        // keep collecting; content still belongs to the filmography block
      } else if (level <= activeLevel) {
        flushSection();
        active = false;
      }
    } else if (active) {
      buffer.push(line);
    }
  }
  collectBuffer();
  flushSection();

  // cap total rows across sections
  let total = 0;
  for (const s of sections) {
    if (total + s.rows.length > limit) s.rows = s.rows.slice(0, Math.max(0, limit - total));
    total += s.rows.length;
  }
  return sections.filter((s) => s.rows.length > 0);
}

/** `{{Main|X filmography}}` / `{{Main list|…}}` → the subpage title, or null. */
export function findFilmographySubpage(pageWikitext: string): string | null {
  const templates = findTemplates(pageWikitext ?? '', /^(main|main\s*list|main\s*article)$/i);
  for (const t of templates) {
    const target = (t.params['1'] ?? '').replace(/<[^>]+>/g, '').trim();
    if (/filmograph|discography|videography/i.test(target)) return target;
  }
  return null;
}

/** `{{Main|List of awards and nominations received by X}}` → subpage title, or null. */
export function findAwardsSubpage(pageWikitext: string): string | null {
  const templates = findTemplates(pageWikitext ?? '', /^(main|main\s*list|main\s*article)$/i);
  for (const t of templates) {
    const target = (t.params['1'] ?? '').replace(/<[^>]+>/g, '').trim();
    if (/^list of awards/i.test(target)) return target;
  }
  return null;
}
