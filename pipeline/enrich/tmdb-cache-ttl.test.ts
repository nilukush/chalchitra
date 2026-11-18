import { afterEach, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readTmdbCache } from './tmdb.js';

// The Ramayana incident lived HERE, not in the pure helpers: readTmdbCache
// served cached empty search responses forever, so a TMDB retitle window
// (2026-08-30) permanently froze a title out of enrichment. This pins the
// wiring: a poisoned entry past the TTL must never be served.
const CACHE_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../data/cache/tmdb');

// nonsense query strings — can never collide with a production URL
const STALE_Q = '/search/movie?query=__ttl_regression_stale__&include_adult=false&year=2026';
const FRESH_Q = '/search/movie?query=__ttl_regression_fresh__&include_adult=false&year=2026';
const DETAILS_Q = '/movie/999999999?language=en-US&append_to_response=credits,videos';

const fileFor = (q: string) =>
  path.join(CACHE_DIR, `${createHash('sha1').update(q).digest('hex').slice(0, 20)}.json`);

const written: string[] = [];
function seed(query: string, payload: unknown, ageDays: number): string {
  mkdirSync(CACHE_DIR, { recursive: true });
  const file = fileFor(query);
  writeFileSync(file, JSON.stringify(payload));
  const stamp = new Date(Date.now() - ageDays * 86_400_000);
  utimesSync(file, stamp, stamp);
  written.push(file);
  return file;
}
afterEach(() => {
  for (const f of written) if (existsSync(f)) rmSync(f, { force: true });
  written.length = 0;
});

describe('readTmdbCache TTL wiring (the gate that would have caught the incident)', () => {
  it('ignores an empty search cached past the TTL — a poisoned miss is never served', () => {
    seed(STALE_Q, { total_results: 0, results: [] }, 30);
    expect(readTmdbCache(STALE_Q)).toBeUndefined();
  });

  it('serves a fresh empty search (bounded weekly retry budget)', () => {
    seed(FRESH_Q, { total_results: 0, results: [] }, 1);
    expect(readTmdbCache(FRESH_Q)).toEqual({ total_results: 0, results: [] });
  });

  it('never TTLs a details payload — details age via the change list only', () => {
    seed(DETAILS_Q, { id: 999999999, title: 'X' }, 365);
    expect(readTmdbCache(DETAILS_Q)).toMatchObject({ id: 999999999 });
  });
});
