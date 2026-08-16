/**
 * Trending = recent Wikipedia pageviews (real human-interest signal).
 * A 7-day window, with the most recent days weighted higher so fresh
 * surges outrank steady traffic.
 */

export interface TrendEntry {
  slug: string;
  kind: 'movie' | 'series';
  title: string;
  poster?: string;
  /** weighted view score for the window */
  score: number;
  /** raw pageviews summed over the window */
  views: number;
}

export interface PersonTrendEntry {
  slug: string;
  name: string;
  image?: string;
  score: number;
  views: number;
}

export interface TrendsPayload {
  generatedAt: string;
  windowDays: number;
  topTitles: TrendEntry[];
  topPersons: PersonTrendEntry[];
  /** slug → weighted score (for badges / lookups) */
  scores: Record<string, number>;
}

const RECENT_DAYS = 2; // weighted 1.0; the rest of the window gets 0.5

/** Weighted sum of daily views over the trailing window. */
export function trendScore(days: Record<string, number> | undefined): number {
  if (!days) return 0;
  const dates = Object.keys(days).sort();
  const cutoffIndex = Math.max(0, dates.length - RECENT_DAYS);
  let score = 0;
  dates.forEach((date, i) => {
    const weight = i >= cutoffIndex ? 1 : 0.5;
    score += (days[date] ?? 0) * weight;
  });
  return Math.round(score);
}

export function rankByScore<T extends { score: number }>(items: T[], limit: number): T[] {
  return items
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function buildTrendsPayload(
  movies: { slug: string; wikiTitle: string; title: string; poster?: string }[],
  series: { slug: string; wikiTitle: string; title: string; poster?: string }[],
  persons: { slug: string; wikiTitle: string; name: string; image?: string }[],
  views: Map<string, Record<string, number>>,
  limit: number,
): TrendsPayload {
  const viewSum = (daily?: Record<string, number>) =>
    daily ? Object.values(daily).reduce((a, b) => a + b, 0) : 0;

  const titleEntries: TrendEntry[] = [
    ...movies.map((m) => ({ slug: m.slug, kind: 'movie' as const, title: m.title, poster: m.poster, wikiTitle: m.wikiTitle })),
    ...series.map((s) => ({ slug: s.slug, kind: 'series' as const, title: s.title, poster: s.poster, wikiTitle: s.wikiTitle })),
  ].map(({ wikiTitle, ...entry }) => {
    const daily = views.get(wikiTitle);
    return { ...entry, score: trendScore(daily), views: viewSum(daily) };
  });

  const personEntries: PersonTrendEntry[] = persons.map((p) => {
    const daily = views.get(p.wikiTitle);
    return {
      slug: p.slug,
      name: p.name,
      image: p.image,
      score: trendScore(daily),
      views: viewSum(daily),
    };
  });

  const topTitles = rankByScore(titleEntries, limit);
  const topPersons = rankByScore(personEntries, limit);
  const scores: Record<string, number> = {};
  for (const entry of [...titleEntries, ...personEntries]) scores[entry.slug] = entry.score;

  return {
    generatedAt: new Date().toISOString(),
    windowDays: 7,
    topTitles,
    topPersons,
    scores,
  };
}
