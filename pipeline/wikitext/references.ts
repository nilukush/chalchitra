/**
 * Full reference extraction: every unique <ref> on a page → { label, url, source, date }.
 * Handles {{cite web|news|…}} templates, named refs (defined in any order) and bare
 * external-link refs. Order = first appearance in the article.
 */
import { findTemplates } from './infobox.js';
import { stripWikitext } from './clean.js';

export interface ReferenceEntry {
  label: string;
  url?: string;
  source?: string;
  date?: string;
}

const CITE_PATTERN = /^(?:cite\s+[\w-]+|citation)$/i;

const SOURCE_KEYS = ['work', 'website', 'newspaper', 'publisher', 'journal', 'magazine', 'site'];
const DATE_KEYS = ['date', 'year', 'publication-date', 'air-date'];

function clean(text: string | undefined): string | undefined {
  const stripped = stripWikitext(text ?? '').replace(/\s+/g, ' ').trim();
  return stripped.length > 0 ? stripped : undefined;
}

/** Parse a {{cite …}} template body into a reference entry. */
function fromCiteTemplate(params: Record<string, string>): ReferenceEntry | null {
  const url = params['url']?.trim() || undefined;
  const title =
    clean(params['title']) ??
    clean(params['chapter']) ??
    clean(url ? url.replace(/^https?:\/\//, '').split('/')[0] : undefined);
  if (!title) return null;
  const source = SOURCE_KEYS.map((k) => clean(params[k])).find(Boolean);
  const date = DATE_KEYS.map((k) => clean(params[k])).find(Boolean);
  return { label: title, url, source, date };
}

/** Fallback: plain wikitext ref body (maybe with a bare external link). */
function fromRawBody(body: string): ReferenceEntry | null {
  const bare = /\[((?:https?:)?\/\/[^\s\]]+)(?:[ \t]+([^\]]*))?\]/.exec(body);
  if (bare) {
    const label = clean(bare[2] || bare[1]) ?? bare[1];
    return { label, url: bare[1] };
  }
  const urlMatch = /(https?:\/\/[^\s<\]}]+)/.exec(body);
  const text = clean(body);
  if (!text && !urlMatch) return null;
  return { label: (text ?? urlMatch?.[1] ?? '').slice(0, 200), url: urlMatch?.[1] };
}

function parseRefBody(body: string): ReferenceEntry | null {
  const cite = findTemplates(body, CITE_PATTERN)[0];
  if (cite) return fromCiteTemplate(cite.params);
  return fromRawBody(body);
}

export function extractReferences(wikitext: string): ReferenceEntry[] {
  if (!wikitext) return [];

  // Pass 1 — collect named definitions anywhere (incl. inside {{Reflist|refs=…}})
  const definitions = new Map<string, string>();
  const defRe = /<ref\s+name\s*=\s*("([^"]+)"|'([^']+)'|([^\s>/]+))\s*>([\s\S]*?)<\/ref>/gi;
  let def: RegExpExecArray | null;
  while ((def = defRe.exec(wikitext)) !== null) {
    const name = (def[2] ?? def[3] ?? def[4] ?? '').toLowerCase();
    if (name && !definitions.has(name)) definitions.set(name, def[5]);
  }

  // Pass 2 — walk refs in document order
  const refs: ReferenceEntry[] = [];
  const seen = new Set<string>();
  const re = /<ref\s*([^>]*?)\s*\/>|<ref\s*([^>]*?)>([\s\S]*?)<\/ref>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(wikitext)) !== null) {
    const attrs = m[1] ?? m[2] ?? '';
    let body = m[3] ?? '';
    const nameMatch = /name\s*=\s*("([^"]+)"|'([^']+)'|([^\s>/]+))/i.exec(attrs);
    const name = nameMatch ? (nameMatch[2] ?? nameMatch[3] ?? nameMatch[4] ?? '').toLowerCase() : '';
    if (!body.trim() && name) body = definitions.get(name) ?? '';
    if (!body.trim()) continue;

    const entry = parseRefBody(body);
    if (!entry) continue;
    const key = entry.url ?? `${entry.label}|${entry.source ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    refs.push(entry);
  }
  return refs;
}
