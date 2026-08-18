/**
 * Life-story prose for person pages: the Early life and Personal life
 * sections of the Wikipedia article, cleaned to plain text. Career and media
 * sections are deliberately excluded — credits and filmography already cover
 * the professional narrative.
 */
import { stripWikitext } from './clean.js';
import { extractSections } from './sections.js';

export interface BioSection {
  heading: 'Early life' | 'Personal life';
  text: string;
}

const EARLY = /^(early life|early years|background|early life and education)$/i;
const PERSONAL = /^personal life( and .*)?$/i;

export function extractBioSections(pageWikitext: string, maxChars = 1800): BioSection[] {
  const out: BioSection[] = [];
  for (const section of extractSections(pageWikitext)) {
    const title = section.title.trim();
    const isEarly = EARLY.test(title);
    const isPersonal = PERSONAL.test(title);
    if (!isEarly && !isPersonal) continue;
    if (out.some((b) => b.heading === (isEarly ? 'Early life' : 'Personal life'))) continue;
    const text = stripWikitext(section.body)
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, maxChars);
    if (text.length < 40) continue;
    out.push({ heading: isEarly ? 'Early life' : 'Personal life', text });
  }
  return out;
}
