/**
 * Person filmography/discography: the linked *works* named in those Wikipedia
 * sections. Best-effort and noisy-tolerant — the display layer only hyperlinks
 * works that exist in our own catalogue (exact wikiTitle match), so noise
 * degrades to invisible text.
 */
import { extractSections } from './sections.js';
import { extractWikiLinks } from './links.js';

export interface FilmographyWork {
  title: string;
  wikiTitle: string;
}

const WORK_SECTIONS = /(filmograph|television|discography|videography|notable works|music videos|web series)/i;

const NOT_A_WORK =
  /^(list of|index of|awards?|accolades?|nominations?|19\d\d|20\d\d|category|wikipedia|template|the following|filmography|discography|bibliography|references|external links)/i;

export function extractFilmography(pageWikitext: string, limit = 80): FilmographyWork[] {
  const works: FilmographyWork[] = [];
  const seen = new Set<string>();

  for (const section of extractSections(pageWikitext)) {
    if (!WORK_SECTIONS.test(section.title)) continue;
    for (const link of extractWikiLinks(section.body)) {
      if (seen.has(link.target) || NOT_A_WORK.test(link.target)) continue;
      seen.add(link.target);
      works.push({ title: link.label || link.target, wikiTitle: link.target });
      if (works.length >= limit) return works;
    }
  }
  return works;
}
