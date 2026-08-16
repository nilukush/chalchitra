import type { APIRoute } from 'astro';
import { SITE } from '../lib/data';

export const GET: APIRoute = ({ site }) => {
  const base = (site?.href ?? SITE.url).replace(/\/$/, '');
  const body = `User-agent: *\nAllow: /\n\nSitemap: ${base}/sitemap-index.xml\n`;
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
