import moviesJson from '../../data/movies.json';
import seriesJson from '../../data/series.json';
import statsJson from '../../data/site-stats.json';
import trendsJson from '../../data/trends.json';
import type { PersonRecord, SiteStats, TitleRecord } from '../../pipeline/types';
import type { TitleSummary } from '../../pipeline/dataset-lib';
import type { TrendsPayload } from '../../pipeline/trends-lib';

// persons live as first-letter chunks (data/persons/A.json … _.json) — the
// monolith would cross the 100MB runtime + git per-file limit as waves grow
const personChunks = import.meta.glob<{ default: PersonRecord[] }>('../../data/persons/*.json', { eager: true });

export const movies = moviesJson as TitleSummary[];
export const series = seriesJson as TitleSummary[];
export const persons: PersonRecord[] = Object.values(personChunks)
  .flatMap((mod) => mod.default)
  .sort((a, b) => a.name.localeCompare(b.name));
export const stats = statsJson as SiteStats;
export const trends = trendsJson as TrendsPayload;

/** Top trending titles joined to their full records (ready for PosterCard).
 *  Released only — unreleased buzz surfaces via anticipatedTrending(). */
export function trendingTitles(count: number): TitleSummary[] {
  return trends.topTitles
    .map((entry) => getTitleBySlug(entry.slug, entry.kind))
    .filter((t): t is TitleRecord => Boolean(t) && isReleased(t as TitleRecord))
    .slice(0, count);
}

/** Unreleased titles that are generating significant Wikipedia readership. */
export function anticipatedTrending(count: number): TitleRecord[] {
  return trends.topTitles
    .map((entry) => getTitleBySlug(entry.slug, entry.kind))
    .filter((t): t is TitleRecord => Boolean(t) && !isReleased(t as TitleRecord))
    .slice(0, count);
}

/** Top trending people joined to their full records (ready for PersonCard). */
export function trendingPersons(count: number): PersonRecord[] {
  return trends.topPersons
    .map((entry) => getPersonBySlug(entry.slug))
    .filter((p): p is PersonRecord => Boolean(p))
    .slice(0, count);
}

export interface LiveCandidate {
  /** article title as the pageviews API sees it (underscores) */
  a: string;
  /** internal href */
  u: string;
  /** display title */
  t: string;
  p?: string;
  l?: string;
  k: 'movie' | 'series';
  y: number;
  /** '1' = released at build time; a date = not yet released */
  r?: string;
  /** TMDB rating value — ★ chip bottom-right on the live-rendered card */
  rt?: number;
  /** release date ISO — drives the live-rendered Upcoming chip */
  rd?: string;
}

/**
 * Compact candidate list for the client-side live-trending refresh: the
 * highest-traffic catalogue articles by last build's signal. The browser
 * intersects them with fresh Wikipedia top-viewed data and re-renders the grid
 * (released titles only — unreleased buzz belongs to "Coming soon").
 */
export function liveTrendingCandidates(count: number): LiveCandidate[] {
  const scored = titles.map((t) => ({
    a: t.wikiTitle.replace(/ /g, '_'),
    u: `/${t.kind === 'movie' ? 'movies' : 'series'}/${t.slug}`,
    t: t.title,
    p: t.poster,
    l: t.language,
    k: t.kind,
    y: t.year,
    r: isReleased(t) ? '1' : t.releaseDate,
    rt: t.rating?.value,
    rd: t.releaseDate,
    s: trends.scores[t.slug] ?? 0,
  }));
  return scored
    .sort((x, y) => y.s - x.s)
    .slice(0, count)
    .map(({ s: _s, ...rest }) => rest);
}

export const titles: TitleSummary[] = [...movies, ...series];

// ── chunked full records ──────────────────────────────────────────────
// heavy payloads (references, reception, chapters, episodes, credits) live
// in per-letter chunks; ONLY the title page loads them, lazily
const movieChunks = import.meta.glob<{ default: TitleRecord[] }>('../../data/titles/movies/*.json');
const seriesChunks = import.meta.glob<{ default: TitleRecord[] }>('../../data/titles/series/*.json');

/** Full record for one title (loads its letter chunk — cached per build). */
export async function fullTitle(kind: 'movie' | 'series', slug: string): Promise<TitleRecord | undefined> {
  const first = slug[0]?.toUpperCase() ?? '#';
  const bucket = /^[A-Z]$/.test(first) ? first : '_';
  const loader = (kind === 'movie' ? movieChunks : seriesChunks)[`../../data/titles/${kind === 'movie' ? 'movies' : 'series'}/${bucket}.json`];
  if (!loader) return undefined;
  const mod = await loader();
  return mod.default.find((t) => t.slug === slug);
}

/** Current editorial-catalogue records (archive titles live on person pages & search). */
export const catalogueMovies: TitleSummary[] = movies.filter((m) => !m.archive);
export const catalogueSeries: TitleSummary[] = series.filter((s) => !s.archive);

/** ISO date (YYYY-MM-DD) for "today" — ISO strings compare lexicographically,
 *  so `date > TODAY` means a strictly future release. */
export const TODAY = new Date().toISOString().slice(0, 10);

export function isReleased(item: TitleRecord): boolean {
  return Boolean(item.releaseDate && item.releaseDate <= TODAY);
}

export function getMovie(slug: string): TitleRecord | undefined {
  return movies.find((m) => m.slug === slug);
}

export function getSeries(slug: string): TitleRecord | undefined {
  return series.find((s) => s.slug === slug);
}

export function getPerson(slug: string): PersonRecord | undefined {
  return persons.find((p) => p.slug === slug);
}

export function getPersonBySlug(slug: string): PersonRecord | undefined {
  return persons.find((p) => p.slug === slug);
}

/** Real title record by slug AND kind (slugs are unique per kind, not across kinds). */
export function getTitleBySlug(slug: string, kind?: 'movie' | 'series'): TitleRecord | undefined {
  const pool = kind === 'movie' ? movies : kind === 'series' ? series : titles;
  return pool.find((t) => t.slug === slug);
}

/** Already-released titles, newest first — "Fresh in theatres" & friends.
 *  MUST sort explicitly: movies.json file order is parse-order, not recency. */
export function recentTitles(kind: 'movie' | 'series', count: number): TitleRecord[] {
  return titles.filter((t) => !t.archive)
    .filter((t) => t.kind === kind && isReleased(t))
    .sort((a, b) => (b.releaseDate ?? '').localeCompare(a.releaseDate ?? ''))
    .slice(0, count);
}

/** Future-dated titles, soonest first — "Coming soon". */
export function comingSoonTitles(kind: 'movie' | 'series', count: number): TitleRecord[] {
  return titles.filter((t) => !t.archive)
    .filter((t) => t.kind === kind && t.releaseDate && t.releaseDate > TODAY)
    .sort((a, b) => (a.releaseDate ?? '').localeCompare(b.releaseDate ?? ''))
    .slice(0, count);
}

/** Titles without a date yet — undated announcements. */
export function undatedTitles(kind: 'movie' | 'series', count: number): TitleRecord[] {
  return titles.filter((t) => !t.archive).filter((t) => t.kind === kind && !t.releaseDate).slice(0, count);
}

export function spotlightPersons(count: number): PersonRecord[] {
  return [...persons]
    .sort((a, b) => b.credits.length - a.credits.length || a.name.localeCompare(b.name))
    .slice(0, count);
}

export function languages(): { language: string; movies: number; series: number }[] {
  return stats.languages;
}

export const SITE = {
  name: 'Chalchitra',
  devanagari: 'चलचित्र',
  tagline: 'Every Indian movie & series has a home',
  description:
    'Chalchitra is a graphical discovery destination for Indian movies and television series — posters, plots, cast, crew, credits and facts from classic to current, curated from open knowledge.',
  url: (import.meta.env.SITE as string | undefined)?.replace(/\/$/, '') ?? 'https://chalachitra.example',
} as const;

const LANGUAGE_HUES: Record<string, string> = {
  Hindi: 'text-saffron-300 bg-saffron-500/10 ring-saffron-500/30',
  Tamil: 'text-lotus-400 bg-lotus-500/10 ring-lotus-500/30',
  Telugu: 'text-peacock-400 bg-peacock-500/10 ring-peacock-500/30',
  Kannada: 'text-saffron-300 bg-saffron-500/10 ring-saffron-500/30',
  Malayalam: 'text-peacock-400 bg-peacock-500/10 ring-peacock-500/30',
  Marathi: 'text-lotus-400 bg-lotus-500/10 ring-lotus-500/30',
  Bengali: 'text-saffron-300 bg-saffron-500/10 ring-saffron-500/30',
  Punjabi: 'text-peacock-400 bg-peacock-500/10 ring-peacock-500/30',
};

export function languageBadgeClass(language: string | undefined): string {
  if (language && LANGUAGE_HUES[language]) return LANGUAGE_HUES[language];
  return 'text-ivory-300 bg-ink-700 ring-ink-600';
}

const GENRE_HUES: Record<string, string> = {
  Action: 'text-saffron-300 bg-saffron-500/15 ring-saffron-500/40',
  Adventure: 'text-peacock-400 bg-peacock-500/15 ring-peacock-500/40',
  Animation: 'text-peacock-400 bg-peacock-500/15 ring-peacock-500/40',
  Biography: 'text-ivory-200 bg-ink-700 ring-ink-500',
  Comedy: 'text-saffron-300 bg-saffron-500/15 ring-saffron-500/40',
  Crime: 'text-lotus-400 bg-lotus-500/15 ring-lotus-500/40',
  Documentary: 'text-ivory-200 bg-ink-700 ring-ink-500',
  Drama: 'text-lotus-400 bg-lotus-500/15 ring-lotus-500/40',
  Family: 'text-peacock-400 bg-peacock-500/15 ring-peacock-500/40',
  Fantasy: 'text-lotus-400 bg-lotus-500/15 ring-lotus-500/40',
  'History': 'text-ivory-200 bg-ink-700 ring-ink-500',
  Horror: 'text-lotus-400 bg-lotus-500/15 ring-lotus-500/40',
  Musical: 'text-saffron-300 bg-saffron-500/15 ring-saffron-500/40',
  Music: 'text-saffron-300 bg-saffron-500/15 ring-saffron-500/40',
  Mystery: 'text-peacock-400 bg-peacock-500/15 ring-peacock-500/40',
  Romance: 'text-lotus-400 bg-lotus-500/15 ring-lotus-500/40',
  'Sci-Fi': 'text-peacock-400 bg-peacock-500/15 ring-peacock-500/40',
  'Science Fiction': 'text-peacock-400 bg-peacock-500/15 ring-peacock-500/40',
  Sport: 'text-saffron-300 bg-saffron-500/15 ring-saffron-500/40',
  Thriller: 'text-peacock-400 bg-peacock-500/15 ring-peacock-500/40',
  War: 'text-ivory-200 bg-ink-700 ring-ink-500',
  Western: 'text-saffron-300 bg-saffron-500/15 ring-saffron-500/40',
};

export function genreChipClass(genre: string): string {
  return GENRE_HUES[genre] ?? 'text-ivory-200 bg-ink-700 ring-ink-500';
}

export function imdbTitleUrl(imdbId: string): string {
  return `https://www.imdb.com/title/tt${imdbId}/`;
}

export function imdbNameUrl(imdbId: string): string {
  return `https://www.imdb.com/name/nm${imdbId}/`;
}

export function personInitials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.replace(/[^a-zA-Zà-ÿ]/g, '')[0] ?? '')
    .join('')
    .toUpperCase();
}

// ---------------------------------------------------------------------------
// Index pagination (Step 6): indexes are server-rendered pages of INDEX_PAGE_SIZE
// cards; page 1 lives at the route root, deeper pages at <root>/page/N, and
// language facets at <root>/lang/<lang>. Sort is stable: year desc, then title.
// ---------------------------------------------------------------------------

export const INDEX_PAGE_SIZE = 200;

export interface IndexPage<T> {
  items: T[];
  pageNo: number;
  pages: number;
  total: number;
}

export function sortForIndex<T extends { year: number; title: string; releaseDate?: string }>(items: T[]): T[] {
  // newest release date first; undated (TBA/upcoming) titles after all dated
  // ones, then year desc, then A–Z — the user-facing contract for the indexes
  return [...items].sort((a, b) => {
    const ad = a.releaseDate ?? '';
    const bd = b.releaseDate ?? '';
    if (ad && bd && ad !== bd) return bd.localeCompare(ad);
    if (bd && !ad) return 1;
    if (ad && !bd) return -1;
    return b.year - a.year || a.title.localeCompare(b.title);
  });
}

export function indexPage<T>(sorted: T[], pageNo: number, pageSize = INDEX_PAGE_SIZE): IndexPage<T> {
  return {
    items: sorted.slice((pageNo - 1) * pageSize, pageNo * pageSize),
    pageNo,
    pages: Math.max(1, Math.ceil(sorted.length / pageSize)),
    total: sorted.length,
  };
}

/** Language facet counts across ALL records of one kind (single tier). */
export function indexLanguages(kind: 'movie' | 'series'): { language: string; count: number }[] {
  const source = kind === 'movie' ? movies : series;
  const counts = new Map<string, number>();
  for (const item of source) {
    const lang = item.language || 'Other';
    counts.set(lang, (counts.get(lang) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([language, count]) => ({ language, count }))
    .filter((l) => l.count >= 12)
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);
}

/** Alphabetically sorted persons for the A–Z index (dataset pre-sorts; this keeps the contract explicit). */
export const personsSorted: PersonRecord[] = [...persons].sort((a, b) => a.name.localeCompare(b.name));
