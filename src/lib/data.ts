import moviesJson from '../../data/movies.json';
import seriesJson from '../../data/series.json';
import personsJson from '../../data/persons.json';
import statsJson from '../../data/site-stats.json';
import type { PersonRecord, SiteStats, TitleRecord } from '../../pipeline/types';

export const movies = moviesJson as TitleRecord[];
export const series = seriesJson as TitleRecord[];
export const persons = personsJson as PersonRecord[];
export const stats = statsJson as SiteStats;

export const titles: TitleRecord[] = [...movies, ...series];

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

/** Most recently released titles that actually have a date. */
export function recentTitles(kind: 'movie' | 'series', count: number): TitleRecord[] {
  return titles
    .filter((t) => t.kind === kind && t.releaseDate)
    .slice(0, count);
}

/** Titles without a date yet — upcoming works, sorted alphabetically. */
export function upcomingTitles(kind: 'movie' | 'series', count: number): TitleRecord[] {
  return titles.filter((t) => t.kind === kind && !t.releaseDate).slice(0, count);
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
  name: 'Chalachitra',
  devanagari: 'चलचित्र',
  tagline: 'The definitive guide to Indian cinema & series',
  description:
    'Chalachitra is a graphical discovery destination for Indian movies and television series — posters, plots, cast, crew, credits and facts, curated from open knowledge. Launching with the class of 2026.',
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
