import { stripWikitext } from './clean.js';

const NAMESPACES =
  /^(file|image|media|category|categories|wikipedia|wp|template|portal|help|special|draft|module|user|wikt|wiktionary|commons|w|s|b|q|v|d|m):/i;

export interface WikiLink {
  target: string;
  label: string;
}

export interface ExternalLinks {
  imdbId?: string;
  official?: string;
  links: { label: string; url: string }[];
}

/** All wikilinks in order, deduplicated by target, namespace links excluded. */
export function extractWikiLinks(text: string): WikiLink[] {
  const seen = new Set<string>();
  const result: WikiLink[] = [];
  const re = /\[\[([^\[\]|]+)(?:\|([^\[\]]*))?\]\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text ?? '')) !== null) {
    const target = m[1].trim();
    if (!target || NAMESPACES.test(target)) continue;
    if (target.startsWith('#') || target.startsWith('/')) continue;
    const label = (m[2] ?? '').trim() || target;
    if (seen.has(target)) continue;
    seen.add(target);
    result.push({ target, label });
  }
  return result;
}

/** Extract IMDb id, official website, and labelled external-link bullets. */
export function extractExternalLinks(text: string): ExternalLinks {
  const result: ExternalLinks = { links: [] };

  const imdb = /\{\{\s*IMDb\s*(?:title|name)\s*\|[^}]*?(?:id\s*=\s*)?(?:tt|nm)?(\d{5,10})/i.exec(
    text ?? '',
  );
  if (imdb) result.imdbId = imdb[1];

  const official =
    /\{\{\s*Official(?:\s+website|\s+URL)?\s*\|\s*(?:url\s*=\s*|1\s*=\s*)?([^\s|}]+)/i.exec(
      text ?? '',
    );
  if (official && /^https?:\/\//i.test(official[1])) result.official = official[1];

  const bulletRe = /^[ \t]*\*[ \t]*(.+)$/gm;
  let bullet: RegExpExecArray | null;
  while ((bullet = bulletRe.exec(text ?? '')) !== null) {
    const line = bullet[1];
    const linkInLine = /\[((?:https?:)?\/\/[^\s\]]+)(?:[ \t]+([^\]]*))?\]/.exec(line);
    if (!linkInLine) continue;
    const url = linkInLine[1];
    const label = stripWikitext(
      line.replace(linkInLine[0], linkInLine[2] ?? '').replace(/\{\{[^{}]*\}\}/g, ''),
    )
      .replace(/[|*]/g, '')
      .trim();
    result.links.push({
      label: label || url.replace(/^https?:\/\//, ''),
      url,
    });
  }

  return result;
}
