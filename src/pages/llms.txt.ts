import type { APIRoute } from 'astro';
import { SITE, stats } from '../lib/data';

export const GET: APIRoute = ({ site }) => {
  const base = (site?.href ?? SITE.url).replace(/\/$/, '');
  const yearRange = stats.years.length > 1 ? `${stats.years[stats.years.length - 1]}–${stats.years[0]}` : String(stats.years[0] ?? '');
  const body = `# ${SITE.name}

> ${SITE.tagline}. A structured catalogue of Indian movies and television series,
> ${yearRange} (${stats.movies} films, ${stats.series} series,
> ${stats.persons} cast & crew profiles). Data derived from Wikipedia (CC BY-SA 4.0).

Catalogue sections:
- /movies — every Indian feature film in the catalogue, paginated, filterable by language
- /series — every Indian television & streaming series, paginated, filterable by language
- /people — cast & crew profiles with filmographies, awards and discographies
- /search — full-text search over titles and people

Detail pages carry structured metadata as schema.org JSON-LD (Movie, TVSeries, Person)
plus canonical URLs. Content excerpts are attributed to their Wikipedia source articles
linked from every page.

Site: ${base}
`;
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
