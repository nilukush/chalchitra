import { stripWikitext } from './clean.js';
import { findTemplates } from './infobox.js';

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

/** Streaming / social / ratings link templates → labelled URLs. */
const LINK_TEMPLATES: {
  name: RegExp;
  label: string;
  build: (p: Record<string, string>) => string | null;
}[] = [
  {
    name: /^netflix (title|show)$/i,
    label: 'Netflix',
    build: (p) => (p['1'] || p['id'] ? `https://www.netflix.com/title/${p['1'] ?? p['id']}` : null),
  },
  {
    name: /^instagram$/i,
    label: 'Instagram',
    build: (p) => {
      const h = p['1'] ?? p['user'] ?? p['username'];
      return h ? `https://www.instagram.com/${h.replace(/^@/, '')}` : null;
    },
  },
  {
    name: /^(twitter|x)$/i,
    label: 'X (Twitter)',
    build: (p) => {
      const h = p['1'] ?? p['user'] ?? p['username'];
      return h ? `https://twitter.com/${h.replace(/^@/, '')}` : null;
    },
  },
  {
    name: /^facebook$/i,
    label: 'Facebook',
    build: (p) => {
      const h = p['1'] ?? p['user'] ?? p['username'];
      return h ? `https://www.facebook.com/${h}` : null;
    },
  },
  {
    name: /^youtube$/i,
    label: 'YouTube',
    build: (p) => {
      const h = p['1'] ?? p['channel'];
      return h && /^https?:/.test(h) ? h : h ? `https://www.youtube.com/${h.replace(/^@/, '')}` : null;
    },
  },
  {
    name: /^youtube channel$/i,
    label: 'YouTube',
    build: (p) => (p['1'] ? `https://www.youtube.com/channel/${p['1']}` : null),
  },
  {
    name: /^rotten tomatoes$/i,
    label: 'Rotten Tomatoes',
    build: (p) => (p['1'] || p['id'] ? `https://www.rottentomatoes.com/m/${p['1'] ?? p['id']}` : null),
  },
  {
    name: /^spotify artist$/i,
    label: 'Spotify',
    build: (p) => (p['1'] ? `https://open.spotify.com/artist/${p['1']}` : null),
  },
  {
    name: /^(bollywood hungama person|bh person)$/i,
    label: 'Bollywood Hungama',
    build: (p) => (p['1'] ? `https://www.bollywoodhungama.com/person/${p['1']}/` : null),
  },
  {
    name: /^bollywood hungama (movie|film)$/i,
    label: 'Bollywood Hungama',
    build: (p) => (p['1'] ? `https://www.bollywoodhungama.com/movie/${p['1']}/` : null),
  },
  {
    name: /^rotten tomatoes person$/i,
    label: 'Rotten Tomatoes',
    build: (p) => (p['1'] || p['id'] ? `https://www.rottentomatoes.com/celebrity/${p['1'] ?? p['id']}` : null),
  },
  {
    name: /^wikiquote$/i,
    label: 'Wikiquote',
    build: (p) => (p['1'] ? `https://en.wikiquote.org/wiki/${encodeURIComponent(p['1'].replace(/ /g, '_'))}` : null),
  },
];

function firstPositional(params: Record<string, string>): string | undefined {
  return params['1'] ?? params['id'] ?? params['url'];
}

/** Extract IMDb id, official website, social/streaming templates, and labelled link bullets. */
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

  const seenUrls = new Set<string>(result.official ? [result.official] : []);
  const push = (label: string, url: string) => {
    if (!url || seenUrls.has(url)) return;
    seenUrls.add(url);
    result.links.push({ label, url });
  };

  for (const entry of LINK_TEMPLATES) {
    for (const tpl of findTemplates(text ?? '', entry.name)) {
      const url = entry.build(tpl.params);
      if (url) push(entry.label, url);
    }
  }

  // {{URL|https://site.com|label}} — official-ish plain links
  for (const tpl of findTemplates(text ?? '', /^url$/i)) {
    const url = firstPositional(tpl.params);
    if (url && /^https?:\/\//i.test(url)) {
      const label = tpl.params['2']?.replace(/\[\[[^\]|]*\|?([^\]]*)\]\]/g, '$1') || url.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
      push(label, url);
    }
  }

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
    push(label || url.replace(/^https?:\/\//, ''), url);
  }

  return result;
}
