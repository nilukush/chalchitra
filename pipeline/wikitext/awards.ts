/**
 * Awards & accolades from a person's Wikipedia article, structured the way
 * Wikipedia tabulates them: year, award, category, work and result
 * (won/nominated). Result templates ({{Won}}, {{nom}}) are read before
 * stripWikitext can delete them. Award names wikilinked in surrounding prose
 * become label-only rows.
 */
import { stripWikitext } from './clean.js';
import { extractSections } from './sections.js';
import { extractWikiLinks } from './links.js';
import { parseWikitableView } from './tables.js';

export type AwardResult = 'won' | 'nominated' | '';

export interface AwardRow {
  year?: string;
  award: string;
  awardWikiTitle?: string;
  category?: string;
  work?: string;
  workWikiTitle?: string;
  result: AwardResult;
}

const AWARD_SECTIONS = /^(accolades?|awards?|awards and nominations|honours|honors|recognitions?)$/i;

const AWARD_NAME_HINT =
  /(award|awardshistory|honou?r|prize|medal|padam|national film|filmfare|siima|iifa|screen|stardust|zee cine|nandi|karnataka state|kerala state|tamil nadu state|national)/i;

const HEADER_FIELD: Record<string, 'year' | 'award' | 'category' | 'work' | 'result'> = {
  year: 'year',
  award: 'award',
  awardshow: 'award',
  awardshistory: 'award',
  ceremony: 'award',
  festival: 'award',
  category: 'category',
  categorie: 'category',
  work: 'work',
  film: 'work',
  title: 'work',
  show: 'work',
  serie: 'work',
  series: 'work',
  result: 'result',
  outcome: 'result',
};

const YEARISH = /^(\d{4}|\d{4}\s*[–—-]\s*\d{0,4})$/;

/** Result cells: {{Won}}/{{nom}} templates and plain-text forms, read raw. */
function readResult(rawCell: string): AwardResult | null {
  if (/\{\{\s*(won|w)\s*[|}]/i.test(rawCell) || /^\s*'{0,2}\s*won\b/i.test(stripWikitext(rawCell))) return 'won';
  if (/\{\{\s*(nom|nominated|n)\s*[|}]/i.test(rawCell) || /^\s*'{0,2}\s*nominat/i.test(stripWikitext(rawCell))) return 'nominated';
  return null;
}

export function extractAwards(pageWikitext: string, limit = 120): AwardRow[] {
  const rows: AwardRow[] = [];
  const seen = new Set<string>();
  const push = (row: AwardRow) => {
    const key = `${row.year ?? ''}|${row.award}|${row.category ?? ''}|${row.work ?? ''}`;
    if (rows.length >= limit || seen.has(key)) return;
    seen.add(key);
    rows.push(row);
  };

  for (const section of extractSections(pageWikitext)) {
    if (!AWARD_SECTIONS.test(section.title.trim())) continue;

    for (const table of section.body.match(/\{\|[\s\S]*?\|\}/g) ?? []) {
      const view = parseWikitableView(table);
      const fields = view.header?.map((h) => HEADER_FIELD[h] ?? null) ?? null;
      let lastYear: string | undefined;
      let lastResult: AwardResult = '';

      for (const cells of view.rows) {
        const texts = cells.map((c) => c.trim()).filter((t) => t !== '');
        if (texts.length === 0) continue;
        const aligned = fields !== null && texts.length === fields.length;

        let year: string | undefined;
        let award = '';
        let awardWikiTitle: string | undefined;
        let category: string | undefined;
        let work: string | undefined;
        let workWikiTitle: string | undefined;
        let result: AwardResult | null = null;

        texts.forEach((text, i) => {
          const field = aligned ? (fields![i] ?? null) : null;
          if (YEARISH.test(text) && year === undefined) {
            year = text;
            return;
          }
          const parsed = readResult(text);
          if (parsed && (field === 'result' || field === null || result === null)) {
            result = parsed;
            return;
          }
          const display = stripWikitext(text).replace(/\s+/g, ' ').trim();
          if (!display) return;
          if (field === 'award' || (field === null && award === '' && AWARD_NAME_HINT.test(text))) {
            const link = extractWikiLinks(text)[0];
            award = display;
            awardWikiTitle = link?.target;
          } else if (field === 'category') {
            category = display;
          } else if (field === 'work' || field === null) {
            if (/\[\[/.test(text) && work === undefined) {
              const link = extractWikiLinks(text)[0];
              work = display.replace(/^''+|''+$/g, '');
              workWikiTitle = link?.target;
            } else if (category === undefined) {
              category = display;
            } else if (work === undefined) {
              work = display;
            } else if (award === '') {
              award = display;
            }
          }
        });

        if (year === undefined && (award || work) && lastYear) year = lastYear;
        if (result === null && lastResult) result = lastResult;
        if (year) lastYear = year;
        if (result) lastResult = result;

        if (award || work || category) {
          push({
            year,
            award: award || '—',
            awardWikiTitle,
            category,
            work,
            workWikiTitle,
            result: result ?? '',
          });
        }
      }
    }

    // award names mentioned in the prose around the tables
    for (const para of section.body.split('\n')) {
      if (/^\s*[!|{]/.test(para) || para.trim().startsWith('*')) continue;
      for (const link of extractWikiLinks(para)) {
        if (AWARD_NAME_HINT.test(link.target)) {
          push({ award: link.label || link.target, awardWikiTitle: link.target, result: '' });
        }
      }
    }
  }

  return rows;
}
