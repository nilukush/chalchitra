import type { APIRoute } from 'astro';
import { SITE, stats } from '../lib/data';

export const GET: APIRoute = () => {
  const body = `# ${SITE.name}

> ${SITE.tagline}. A structured catalogue of Indian movies and television series,
> launched with the class of 2026 (${stats.movies} films, ${stats.series} series debuts,
> ${stats.persons} cast & crew profiles). Data derived from Wikipedia (CC BY-SA 4.0).

Catalogue sections:
- /movies — all 2026 Indian feature films, filterable by language
- /series — all 2026 Indian television & streaming series debuts
- /people — cast & crew profiles with 2026 credits
- /search — full-text search over titles and people

Detail pages carry structured metadata as schema.org JSON-LD (Movie, TVSeries, Person)
plus canonical URLs. Content excerpts are attributed to their Wikipedia source articles
linked from every page.

Site: ${SITE.url}
`;
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
