/**
 * Pure logic for the post-build content invariants (foolproofing package,
 * 2026-09-21): the daily workflow compares the doc-id set of the build it
 * just produced against the LIVE site (always the previous deployment) and
 * fails the run when pages vanished without an intentional-removals entry —
 * the Issue 5 regression (stale-seed swap silently 404ing ~62 pages) must
 * be a red CI run, not a manual diff a day later.
 */

export interface DocRef {
  id: string;
  /** Wikipedia pageid — present in search docs since 2026-09-21; older
   *  deployed indexes lack it (transitional) */
  pid?: number;
}

export interface DocDiff {
  /** live docs missing from the new build WITHOUT an intentional-removals
   *  entry AND without their pageid surviving under a new id — the failure
   *  signal, subject to a small churn tolerance in the check script */
  unexpected: string[];
  /** live docs missing from the build whose PAGEID still exists under a new
   *  id — Wikipedia renames/merges change slugs routinely (≈30/run); the
   *  site serves old URLs through slug redirects, so this is not loss */
  renamed: string[];
  /** live docs missing from the new build that ARE listed as intentional */
  intentional: string[];
  /** docs new in this build (growth) — informational, never a failure */
  added: string[];
}

export function diffDocIds(live: DocRef[], build: DocRef[], removals: string[]): DocDiff {
  const buildIds = new Set(build.map((d) => d.id));
  const buildPids = new Set(build.map((d) => d.pid).filter((p): p is number => typeof p === 'number'));
  const removalSet = new Set(removals);
  const unexpected: string[] = [];
  const renamed: string[] = [];
  const intentional: string[] = [];
  for (const doc of live) {
    if (buildIds.has(doc.id)) continue;
    if (removalSet.has(doc.id)) intentional.push(doc.id);
    else if (typeof doc.pid === 'number' && buildPids.has(doc.pid)) renamed.push(doc.id);
    else unexpected.push(doc.id);
  }
  const liveIds = new Set(live.map((d) => d.id));
  const added: string[] = build.filter((d) => !liveIds.has(d.id)).map((d) => d.id);
  return { unexpected, renamed, intentional, added };
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
