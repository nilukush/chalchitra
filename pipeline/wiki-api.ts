/**
 * Polite MediaWiki API client for en.wikipedia.org:
 * - custom User-Agent, serialized batches with pacing
 * - exponential backoff on 429/5xx
 * - disk cache of page payloads (data/cache/pages) and API responses (data/cache/api)
 */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const CACHE_API_DIR = path.join(ROOT, 'data', 'cache', 'api');
export const CACHE_PAGES_DIR = path.join(ROOT, 'data', 'cache', 'pages');

const API_URL = 'https://en.wikipedia.org/w/api.php';
const USER_AGENT =
  'ChalachitraBot/0.1 (building chalachitra.example from Wikipedia data; node fetch)';
const REQUEST_GAP_MS = 1100;
const MAX_ATTEMPTS = 6;

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export function backoffDelayMs(attempt: number): number {
  return Math.min(500 * 2 ** attempt, 30_000);
}

export interface TitleMapping {
  from: string;
  to: string;
}

/** Resolve a requested title through normalized→redirect chains to the final title. */
export function resolveTitle(title: string, chains: TitleMapping[]): string {
  let current = title;
  const seen = new Set<string>([current]);
  let moved = true;
  while (moved) {
    moved = false;
    for (const chain of chains) {
      if (chain.from === current && !seen.has(chain.to)) {
        current = chain.to;
        seen.add(current);
        moved = true;
        break;
      }
    }
  }
  return current;
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function apiGet(params: Record<string, string | number>): Promise<any> {
  const query = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) query.set(k, String(v));
  query.set('format', 'json');
  query.set('formatversion', '2');
  const cacheKey = createHash('sha1').update(query.toString()).digest('hex').slice(0, 24);
  const cacheFile = path.join(CACHE_API_DIR, `${cacheKey}.json`);

  if (existsSync(cacheFile)) {
    return JSON.parse(readFileSync(cacheFile, 'utf8'));
  }

  let lastError: unknown = null;
  let retryAfterMs: number | null = null;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (attempt > 0) {
      const wait = Math.max(backoffDelayMs(attempt), retryAfterMs ?? 0);
      await sleep(wait);
      retryAfterMs = null;
    }
    try {
      const res = await fetch(`${API_URL}?${query.toString()}`, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      });
      if (res.status === 429 || res.status >= 500) {
        lastError = new Error(`HTTP ${res.status}`);
        const retryAfter = Number(res.headers.get('retry-after'));
        if (Number.isFinite(retryAfter) && retryAfter > 0) retryAfterMs = retryAfter * 1000;
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      const json = await res.json();
      if (json.error) throw new Error(`API error: ${json.error.info ?? json.error.code}`);
      mkdirSync(CACHE_API_DIR, { recursive: true });
      writeFileSync(cacheFile, JSON.stringify(json));
      await sleep(REQUEST_GAP_MS);
      return json;
    } catch (err) {
      lastError = err;
    }
  }
  throw new Error(`apiGet failed for ${query.toString()}: ${String(lastError)}`);
}

export interface CategoryPage {
  title: string;
  pageid: number;
}

const SKIP_CATEGORY =
  /(articles|templates|stub|navigation|tracking|maintenance|pages needing|cleanup|categories|disambiguation)/i;

/** All article pages in a category, recursing into subcategories (bounded depth). */
export async function fetchCategoryPages(
  categoryTitle: string,
  depth = 2,
  seenCategories = new Set<string>(),
): Promise<CategoryPage[]> {
  if (depth < 0 || seenCategories.has(categoryTitle)) return [];
  seenCategories.add(categoryTitle);

  const pages: CategoryPage[] = [];
  const subcategories: string[] = [];
  let continueKey: string | undefined;

  do {
    const data = await apiGet({
      action: 'query',
      list: 'categorymembers',
      cmtitle: categoryTitle,
      cmlimit: 500,
      cmtype: 'page|subcat',
      ...(continueKey ? { cmcontinue: continueKey } : {}),
    });
    for (const member of data.query?.categorymembers ?? []) {
      if (member.title.startsWith('Category:')) {
        if (!SKIP_CATEGORY.test(member.title)) subcategories.push(member.title);
      } else if (member.ns === 0 || member.ns === undefined) {
        pages.push({ title: member.title, pageid: member.pageid });
      }
    }
    continueKey = data.continue?.cmcontinue;
  } while (continueKey);

  for (const sub of subcategories) {
    pages.push(...(await fetchCategoryPages(sub, depth - 1, seenCategories)));
  }

  const deduped = new Map<number, CategoryPage>();
  for (const page of pages) deduped.set(page.pageid, page);
  return [...deduped.values()];
}

export interface CachedPage {
  pageid: number;
  title: string;
  wikitext?: string;
  thumb?: string;
  extract?: string;
  missing?: boolean;
  fetchedAt: string;
}

function pageCacheFile(pageid: number): string {
  return path.join(CACHE_PAGES_DIR, `${pageid}.json`);
}

export function readCachedPage(pageid: number): CachedPage | null {
  const file = pageCacheFile(pageid);
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as CachedPage;
  } catch {
    return null;
  }
}

/**
 * Fetch full page payloads (wikitext + thumbnail + intro extract) for titles,
 * transparently using the disk cache. Batches of `batchSize` (default 10).
 */
export async function fetchPages(
  titles: string[],
  onProgress?: (done: number, total: number) => void,
  batchSize = 10,
): Promise<Map<string, CachedPage>> {
  const result = new Map<string, CachedPage>();
  const toFetch: string[] = [];

  // We cannot know pageids before fetching; resolve titles first (cheap, cached).
  const idMap = await resolvePageIds(titles);
  for (const title of titles) {
    const pageid = idMap.get(title);
    if (pageid == null) continue;
    const cached = readCachedPage(pageid);
    if (cached && (cached.missing || cached.wikitext)) {
      result.set(title, cached);
    } else {
      toFetch.push(title);
    }
  }

  let done = result.size;
  const total = titles.length;
  onProgress?.(done, total);

  for (const batch of chunk(toFetch, batchSize)) {
    let data: any = null;
    for (let round = 0; round < 2 && data === null; round++) {
      try {
        data = await apiGet({
          action: 'query',
          prop: 'revisions|pageimages|extracts',
          rvprop: 'content|ids',
          rvslots: 'main',
          pithumbsize: 480,
          pilimit: 50,
          exintro: 1,
          explaintext: 1,
          exsectionformat: 'plain',
          exlimit: batchSize,
          redirects: 1,
          titles: batch.join('|'),
        });
      } catch (err) {
        console.warn(`  ! batch failed (round ${round + 1}): ${String(err).slice(0, 140)}`);
        if (round === 0) await sleep(30_000);
      }
    }
    if (data === null) {
      console.warn(`  ✗ skipping ${batch.length} titles after retries: ${batch[0]}…`);
      continue;
    }

    const chains: TitleMapping[] = [
      ...(data.query?.normalized ?? []),
      ...(data.query?.redirects ?? []),
    ];
    const byTitle = new Map<string, any>();
    for (const page of data.query?.pages ?? []) byTitle.set(page.title, page);

    for (const requested of batch) {
      const finalTitle = resolveTitle(requested, chains);
      const page = byTitle.get(finalTitle);
      const cached: CachedPage = {
        pageid: page?.pageid ?? -1,
        title: page?.title ?? requested,
        wikitext: page?.revisions?.[0]?.slots?.main?.content,
        thumb: page?.thumbnail?.source,
        extract: page?.extract,
        missing: page?.missing === true,
        fetchedAt: new Date().toISOString(),
      };
      if (cached.pageid > 0) {
        mkdirSync(CACHE_PAGES_DIR, { recursive: true });
        writeFileSync(pageCacheFile(cached.pageid), JSON.stringify(cached));
      }
      result.set(requested, cached);
      done++;
      onProgress?.(done, total);
    }
  }

  return result;
}

/** title → pageid (follows redirects); missing titles map to -1. */
export async function resolvePageIds(titles: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  for (const batch of chunk(titles, 50)) {
    const data = await apiGet({
      action: 'query',
      titles: batch.join('|'),
      redirects: 1,
    });
    const chains: TitleMapping[] = [
      ...(data.query?.normalized ?? []),
      ...(data.query?.redirects ?? []),
    ];
    const byTitle = new Map<string, any>();
    for (const page of data.query?.pages ?? []) byTitle.set(page.title, page);
    for (const requested of batch) {
      const finalTitle = resolveTitle(requested, chains);
      const page = byTitle.get(finalTitle);
      map.set(requested, page?.missing ? -1 : (page?.pageid ?? -1));
    }
  }
  return map;
}
