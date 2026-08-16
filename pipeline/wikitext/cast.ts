import { stripWikitext } from './clean.js';
import { extractSections } from './sections.js';

export interface CastEntry {
  /** Display name, e.g. "Danish Pandor" */
  name: string;
  /** Wikilink target when the actor is linked, e.g. "Danish Pandor (actor)" */
  wikiTitle: string | null;
  /** Role text after "as", e.g. "Darab Ahmed Wadkar (special appearance)" */
  role: string;
}

const CAST_TITLES =
  /^((main|principal|lead|starring)\s+)?cast(\s+(and|&)\s+(characters|crew|members))?$/i;

/** Parse the Cast section bullets into structured entries. */
export function extractCast(pageWikitext: string): CastEntry[] {
  const section = extractSections(pageWikitext).find((s) => CAST_TITLES.test(s.title.trim()));
  if (!section) return [];

  const entries: CastEntry[] = [];
  for (const rawLine of section.body.split('\n')) {
    const line = rawLine.trim();
    // top-level bullets only ("*" not "**"); indented ":" lines never match
    const bullet = /^\*(?!\*)\s*(.+)$/.exec(line);
    if (!bullet) continue;
    const item = removeRefs(bullet[1]);
    if (!item) continue;

    const link = /\[\[([^\[\]|]+)(?:\|([^\[\]]*))?\]\]/.exec(item);
    if (link) {
      const target = link[1].trim();
      const label = (link[2] ?? '').trim() || target;
      const rest = item.slice(link.index! + link[0].length);
      entries.push({
        name: cleanText(label),
        wikiTitle: target,
        role: roleFromRest(rest),
      });
    } else {
      const asSplit = splitOnAs(item);
      entries.push({
        name: cleanText(asSplit.before),
        wikiTitle: null,
        role: roleFromRest(asSplit.rest),
      });
    }
  }

  return entries.filter((e) => e.name.length > 0 && !/^{{/.test(e.name));
}

function splitOnAs(text: string): { before: string; rest: string } {
  const match = /\s+as\s+/i.exec(text);
  if (!match) return { before: text, rest: '' };
  return { before: text.slice(0, match.index), rest: text.slice(match.index) };
}

function roleFromRest(rest: string): string {
  if (!rest) return '';
  const cleaned = cleanText(rest.replace(/^\s*as\s+/i, ''));
  // drop role-less leftovers like trailing colons/dashes
  return cleaned.replace(/^[-–:,\s]+/, '').trim();
}

function removeRefs(text: string): string {
  return text
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, '')
    .replace(/<ref[^>]*\/>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .trim();
}

function cleanText(text: string): string {
  return stripWikitext(text).replace(/\s*\n\s*/g, ' ').replace(/\s{2,}/g, ' ').trim();
}
