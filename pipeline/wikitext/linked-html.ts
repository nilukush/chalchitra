/**
 * Renders wikitext to HTML where wikilinks to known catalogue entries
 * (persons / movies / series) become internal <a> links and everything else
 * degrades to escaped plain text. Output is safe for set:html: text segments
 * are HTML-escaped, and the only tags ever emitted are internal anchors.
 */
import { stripWikitext } from './clean.js';

export interface LinkTarget {
  type: 'person' | 'movie' | 'series';
  slug: string;
}

export type LinkLookup = Map<string, LinkTarget>;

const NAMESPACES =
  /^(file|image|media|category|wikipedia|wp|template|portal|help|special|draft|module|user|wikt|wiktionary|commons):/i;

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function renderLinkedHtml(wikitext: string | undefined, lookup: LinkLookup): string {
  if (!wikitext) return '';

  const links: { href: string | null; label: string }[] = [];
  let tokenCount = 0;
  const tokenized = wikitext.replace(
    /\[\[([^\[\]|]+)(?:\|([^\[\]]*))?\]\]/g,
    (_m, target: string, label?: string) => {
      const cleanTarget = target.trim();
      const shown = (label ?? '').trim() || cleanTarget;
      if (NAMESPACES.test(cleanTarget) || cleanTarget.startsWith('#')) {
        links.push({ href: null, label: '' }); // dropped entirely
        return `⟦${tokenCount++}⟧`;
      }
      const hit = lookup.get(cleanTarget);
      if (hit) {
        links.push({ href: `/${hit.type === 'person' ? 'people' : hit.type === 'series' ? 'series' : 'movies'}/${hit.slug}`, label: shown });
      } else {
        links.push({ href: null, label: shown });
      }
      return `⟦${tokenCount++}⟧`;
    },
  );

  const stripped = stripWikitext(tokenized);
  const escaped = escapeHtml(stripped);

  return escaped
    .replace(/⟦(\d+)⟧/g, (_m, index: string) => {
      const link = links[Number(index)];
      if (!link || (!link.href && !link.label)) return '';
      if (!link.href) return escapeHtml(link.label);
      return `<a href="${link.href}">${escapeHtml(link.label)}</a>`;
    })
    .split('\n')
    .map((line) => line.replace(/\s{2,}/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}
