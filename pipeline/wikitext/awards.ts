/**
 * Awards & accolades from a person's Wikipedia article: rows of the tables in
 * Accolades/Awards sections (year, work, award, category, result) plus award
 * names wikilinked in the surrounding prose. Rows are kept as cleaned strings —
 * award-table wikitext is too irregular for a stricter schema.
 */
import { stripWikitext } from './clean.js';
import { extractSections } from './sections.js';
import { extractWikiLinks } from './links.js';

const AWARD_SECTIONS = /^(accolades?|awards?|awards and nominations|honours|honors|recognitions?)$/i;

const AWARD_NAME_HINT =
  /(award|awardshistory|honou?r|prize|medal|padam|national film|filmfare|siima|iifa|screen|stardust|zee cine|nandi|karnataka state|kerala state|tamil nadu state|national)/i;

export function extractAwards(pageWikitext: string, limit = 40): string[] {
  const rows: string[] = [];

  for (const section of extractSections(pageWikitext)) {
    if (!AWARD_SECTIONS.test(section.title.trim())) continue;

    // table rows
    for (const table of section.body.match(/\{\|[\s\S]*?\|\}/g) ?? []) {
      for (const row of table.split(/^\|-.*$/m)) {
        const cells = row
          .split('\n')
          .filter((line) => /^\s*[!|]/.test(line))
          .map((line) => line.replace(/^\s*[!|]+\s*/, ''))
          .join(' · ')
          .replace(/\s*!!\s*/g, ' · ');
        const cleaned = stripWikitext(cells).replace(/\s+/g, ' ').trim();
        // a real award row mentions a year or an award-ish word; skip headers/junk
        if (cleaned.length >= 8 && /\d{4}|won|nominated|award/i.test(cleaned) && !/^year\b/i.test(cleaned)) {
          rows.push(cleaned.replace(/·\s*·/g, '·').replace(/(\s·\s)+/g, ' · '));
        }
      }
    }

    // award names mentioned in the prose around the tables
    for (const para of section.body.split('\n')) {
      if (/^\s*[!|{]/.test(para) || para.trim().startsWith('*')) continue;
      for (const link of extractWikiLinks(para)) {
        if (AWARD_NAME_HINT.test(link.target) && !rows.includes(link.label)) {
          rows.push(link.label);
        }
      }
    }
  }

  return rows.slice(0, limit);
}
