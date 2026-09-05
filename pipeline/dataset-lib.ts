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



/** Fields that live only in the per-title CHUNK files (loaded lazily by the
 *  title page): prose, references, episode guides, credits. Everything else
 *  ships in the light movies.json/series.json summaries that indexes, search
 *  and cards consume eagerly. */
const HEAVY_TITLE_FIELDS = [
  'plot', 'summary', 'plotHtml', 'nativeName', 'tagline', 'articleSections',
  'references', 'reception', 'sections', 'episodesList', 'soundtrack',
  'awards', 'facts', 'cast', 'crew', 'external', 'trailer',
] as const;

export type TitleSummary = Omit<TitleRecord, (typeof HEAVY_TITLE_FIELDS)[number]> & {
  /** episodesList length, carried for index badges without the heavy list */
  episodeCount?: number;
};

/** Project a full title record to its light summary (index/search/card shape). */
export function toTitleSummary(record: TitleRecord): TitleSummary {
  const out: Record<string, unknown> = { episodeCount: record.episodesList?.length };
  for (const [key, value] of Object.entries(record)) {
    if ((HEAVY_TITLE_FIELDS as readonly string[]).includes(key)) continue;
    if (value === undefined) continue;
    out[key] = value;
  }
  return out as TitleSummary;
}

/** Chunk bucket for a title slug: first letter uppercased, non-letters → '#'. */
export function bucketKeyForSlug(slug: string): PersonsBucket {
  const first = (slug ?? '')[0]?.toUpperCase() ?? '#';
  return /^[A-Z]$/.test(first) ? (first as PersonsBucket) : '#';
}

/** Diff current record slugs against the previous build's slug map (keyed by
 *  Wikipedia pageid): a renamed article changes its slug, so emit old→new
 *  redirects and persist the new mapping for the next diff. */
export interface SlugMapEntry {
  slug: string;
  kind: 'movie' | 'series';
}

export function computeSlugRedirects(
  records: { pageid: number; slug: string; kind: 'movie' | 'series' }[],
  previous: Record<string, SlugMapEntry>,
): { redirects: { from: string; to: string }[]; next: Record<string, SlugMapEntry> } {
  const redirects: { from: string; to: string }[] = [];
  const next: Record<string, SlugMapEntry> = {};
  for (const record of records) {
    if (!record.pageid || !record.slug) continue;
    const before = previous[String(record.pageid)];
    // a kind flip (Mandela: television-infobox film was /series/x) moves the
    // path even when the slug string is identical — the FROM path needs the
    // PREVIOUS kind, not the current one
    if (before && (before.slug !== record.slug || before.kind !== record.kind)) {
      const from = `/${before.kind === 'movie' ? 'movies' : 'series'}/${before.slug}`;
      const to = `/${record.kind === 'movie' ? 'movies' : 'series'}/${record.slug}`;
      if (from !== to) redirects.push({ from, to });
    }
    next[String(record.pageid)] = { slug: record.slug, kind: record.kind };
  }
  return { redirects, next };
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
  /** poster URL (titles only) — search result thumbnails */
  p?: string;
  /** rating value (titles only) — star chip on result rows */
  r?: number;
  /** release date ISO (titles only) — drives the Upcoming tag */
  rd?: string;
  /** portrait URL (persons only) — search result thumbnails */
  i?: string;
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
      id: `${item.kind}:${item.slug}`, // MiniSearch requires an id; kind-qualified (slug collides across movie/series)
      s: item.slug,
      k: item.kind,
      t: item.title,
      y: item.year,
      l: item.language,
      p: item.poster,
      r: item.rating?.value,
      rd: item.releaseDate,
      q: [...linkedNames],
    });
  }

  for (const person of persons) {
    const titles = new Set<string>();
    for (const credit of person.credits ?? []) titles.add(credit.title);
    docs.push({
      id: `person:${person.slug}`,
      s: person.slug,
      k: 'person',
      t: person.name,
      i: person.image,
      q: [...titles],
    });
  }

  return docs;
}

import type { KnownForWork, PersonRecord, TitleRecord } from './types.js';

/**
 * Transparent "known for" ranking — the weights are published on the site
 * (person page "how we pick these" note) so this stays explainable:
 *   votes 2·log10(max(votes,10))  — popular works first (IMDb page-view proxy)
 *   quality 1.5·(rating−5)        — only with ≥10 votes; poor films demote
 *   recency 3 − 0.05·(now−year)   — decays to 0 for pre-mid-century classics
 *   awarded +2                    — this person WON an award for the work
 *   presence +1 catalogue / +0.25 archive-only
 *   poster +0.5                   — rail aesthetics
 * Ties break by year desc then title asc; top 6 returned.
 */
export function computeKnownFor(
  person: PersonRecord,
  titleByWiki: Map<string, TitleRecord>,
  currentYear: number,
): KnownForWork[] {
  const wonWorks = new Set(
    (person.awards ?? []).filter((a) => a.result === 'won' && a.workWikiTitle).map((a) => a.workWikiTitle!),
  );

  const candidates: KnownForWork[] = [];
  const seen = new Set<string>();

  const consider = (wikiTitle: string | undefined, rowYear?: string) => {
    if (!wikiTitle || seen.has(wikiTitle)) return;
    const record = titleByWiki.get(wikiTitle);
    if (!record) return;
    seen.add(wikiTitle);

    const year = Number(record.year ?? rowYear ?? 0) || 0;
    const votes = record.rating?.votes ?? 0;
    let score = 0;
    if (votes > 0) score += 2 * Math.log10(Math.max(votes, 10));
    if (votes >= 10 && typeof record.rating?.value === 'number') score += 1.5 * (record.rating.value - 5);
    if (year > 0) score += Math.max(0, 3 - 0.05 * (currentYear - year));
    if (wonWorks.has(wikiTitle)) score += 2;
    score += record.archive ? 0.25 : 1;
    if (record.poster) score += 0.5;

    candidates.push({
      title: record.title,
      year: record.year ?? rowYear,
      kind: record.kind,
      poster: record.poster,
      slug: record.slug,
      score: Math.round(score * 100) / 100,
    });
  };

  for (const section of person.filmography ?? []) {
    for (const row of section.rows) consider(row.wikiTitle, row.year);
  }
  for (const award of person.awards ?? []) consider(award.workWikiTitle, award.year);

  candidates.sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || Number(b.year ?? 0) - Number(a.year ?? 0) || a.title.localeCompare(b.title));
  return candidates.slice(0, 6);
}

// ── persons chunking (session 16) ─────────────────────────────────────────
// data/persons.json would cross 100MB (runtime + GitHub per-file limit) as
// person waves grow; persons are written as data/persons/<LETTER>.json
// instead, bucketed exactly like the people index A–Z (# for everything else).

export type PersonsBucket = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J' | 'K' | 'L' | 'M' | 'N' | 'O' | 'P' | 'Q' | 'R' | 'S' | 'T' | 'U' | 'V' | 'W' | 'X' | 'Y' | 'Z' | '#';

export function bucketKeyForName(name: string): PersonsBucket {
  const first = (name ?? '')[0]?.toUpperCase() ?? '#';
  return /^[A-Z]$/.test(first) ? (first as PersonsBucket) : '#';
}

export function chunkPersons<T extends { name: string }>(persons: T[]): Map<string, T[]> {
  const chunks = new Map<string, T[]>();
  for (const person of persons) {
    const key = bucketKeyForName(person.name);
    const bucket = chunks.get(key);
    if (bucket) bucket.push(person);
    else chunks.set(key, [person]);
  }
  return chunks;
}
