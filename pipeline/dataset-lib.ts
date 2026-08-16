/** Pure helpers for dataset construction: slugs, wiki URLs, search documents. */

const DISAMBIGUATION_RE =
  /\s*\((?:[^()]*(?:film|series|movie|web series|TV series|talk show|game show|reality show|season|franchise|soundtrack)[^()]*)\)\s*$/i;

export function slugify(title: string, pageid?: number): string {
  const base = (title ?? '')
    .replace(DISAMBIGUATION_RE, ' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // latin diacritics
    .replace(/['’]/g, '')
    .replace(/&/gi, ' and ')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .toLowerCase();
  if (base.length > 0) return base;
  return `p${pageid ?? 'x'}`;
}

export function displayTitle(title: string): string {
  return (title ?? '').replace(DISAMBIGUATION_RE, '').trim() || title;
}

/** Tracks issued slugs and disambiguates collisions with -2, -3, … */
export class SlugRegistry {
  private taken = new Set<string>();

  slug(title: string, pageid?: number): string {
    const base = slugify(title, pageid);
    let candidate = base;
    let n = 2;
    while (this.taken.has(candidate)) candidate = `${base}-${n++}`;
    this.taken.add(candidate);
    return candidate;
  }
}

export function wikiUrlFor(title: string): string {
  return `https://en.wikipedia.org/wiki/${encodeURIComponent((title ?? '').replace(/ /g, '_'))}`;
}

export interface SearchDoc {
  /** slug */
  s: string;
  /** kind: movie | series | person */
  k: 'movie' | 'series' | 'person';
  /** title / name */
  t: string;
  /** year (titles only) */
  y?: number;
  /** language (titles only) */
  l?: string;
  /** extra searchable terms */
  q: string[];
}

export function buildSearchDocuments(
  movies: any[],
  series: any[],
  persons: any[],
): SearchDoc[] {
  const docs: SearchDoc[] = [];

  for (const item of [...movies, ...series]) {
    const linkedNames = new Set<string>();
    for (const member of item.cast ?? []) if (member.slug) linkedNames.add(member.name);
    for (const name of [...(item.directedBy ?? []), ...(item.createdBy ?? [])]) linkedNames.add(name);
    docs.push({
      s: item.slug,
      k: item.kind,
      t: item.title,
      y: item.year,
      l: item.language,
      q: [...linkedNames],
    });
  }

  for (const person of persons) {
    const titles = new Set<string>();
    for (const credit of person.credits ?? []) titles.add(credit.title);
    docs.push({
      s: person.slug,
      k: 'person',
      t: person.name,
      q: [...titles],
    });
  }

  return docs;
}
