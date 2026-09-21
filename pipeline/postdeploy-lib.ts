/**
 * Pure logic for the post-build content invariants (foolproofing package,
 * 2026-09-21): the daily workflow compares the doc-id set of the build it
 * just produced against the LIVE site (always the previous deployment) and
 * fails the run when pages vanished without an intentional-removals entry —
 * the Issue 5 regression (stale-seed swap silently 404ing ~62 pages) must
 * be a red CI run, not a manual diff a day later.
 */

export interface DocDiff {
  /** live docs missing from the new build WITHOUT an intentional-removals entry — run fails */
  unexpected: string[];
  /** live docs missing from the new build that ARE listed as intentional */
  intentional: string[];
  /** docs new in this build (growth) — informational, never a failure */
  added: string[];
}

export function diffDocIds(live: string[], build: string[], removals: string[]): DocDiff {
  const buildSet = new Set(build);
  const removalSet = new Set(removals);
  const vanished: string[] = [];
  for (const id of live) if (!buildSet.has(id)) vanished.push(id);
  const added: string[] = [];
  const liveSet = new Set(live);
  for (const id of build) if (!liveSet.has(id)) added.push(id);
  return {
    unexpected: vanished.filter((id) => !removalSet.has(id)),
    intentional: vanished.filter((id) => removalSet.has(id)),
    added,
  };
}

/** doc id → site URL for canary fetches ('movie:slug' → /movies/slug). */
export function docIdToUrl(id: string): string {
  const [kind, ...rest] = id.split(':');
  const slug = rest.join(':');
  if (!slug) return '/';
  if (kind === 'movie') return `/movies/${slug}`;
  if (kind === 'series') return `/series/${slug}`;
  if (kind === 'person') return `/people/${slug}`;
  return '/';
}

/** Deterministic even sample for canary fetches (stable across runs). */
export function sampleCanaryIds(ids: string[], n: number): string[] {
  if (ids.length === 0 || n <= 0) return [];
  const sorted = [...ids].sort();
  if (n >= sorted.length) return sorted;
  const step = sorted.length / n;
  return Array.from({ length: n }, (_, i) => sorted[Math.floor(i * step)]);
}
