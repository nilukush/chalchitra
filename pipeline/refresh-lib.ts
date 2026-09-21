/**
 * Pure planning logic for the incremental refresh (Step 8): compare the last
 * revid snapshot against the live poll and decide which cached pages are
 * stale. Fetching/invalidation live in refresh.ts.
 */

export interface RefreshPlan {
  /** cached pageids whose article was edited since the snapshot */
  changed: string[];
  /** pageids present live but absent from the snapshot (first-time pages) */
  added: string[];
}

export function planRefresh(
  previous: Record<string, number>,
  current: Record<string, number>,
): RefreshPlan {
  const changed: string[] = [];
  const added: string[] = [];
  for (const [pageid, revid] of Object.entries(current)) {
    const before = previous[pageid];
    if (before === undefined) added.push(pageid);
    else if (before !== revid) changed.push(pageid);
  }
  return { changed, added };
}

/** Pageids whose LIVE title differs from the cached title — Wikipedia page
 *  moves don't bump lastrevid, so renames are invisible to planRefresh. */
export function planRenames(
  cachedTitles: Record<string, string>,
  liveTitles: Record<string, string>,
): string[] {
  const renamed: string[] = [];
  for (const [pageid, live] of Object.entries(liveTitles)) {
    const cached = cachedTitles[pageid];
    if (cached !== undefined && cached !== live) renamed.push(pageid);
  }
  return renamed;
}

export interface ValidationPlan {
  /** cached pageids whose stored revid differs from the live poll — refetch */
  stale: number[];
  /** pageids with no stored revid (legacy cache files) — check the revision
   *  Wikipedia had at the page's fetch timestamp before trusting them */
  legacy: number[];
}

/**
 * Per-page staleness from the cache's own revid stamps (Issue 6). The
 * snapshot alone cannot validate pages it has never seen: refresh used to
 * treat snapshot-absent pages as fresh and then snapshot them at their LIVE
 * revid, freezing arbitrarily old cache content until the article's next
 * edit (a stale seed swap froze ~30k pages, incl. The Revolutionaries'
 * release date). With revid stamped at fetch time, this check is exact;
 * revid-less legacy files route to a historical-revision check instead.
 */
export function planValidation(
  entries: Array<{ pageid: number; revid?: number }>,
  live: Record<string, number>,
): ValidationPlan {
  const stale: number[] = [];
  const legacy: number[] = [];
  for (const entry of entries) {
    const liveRevid = live[String(entry.pageid)];
    if (liveRevid === undefined) continue; // deleted/merged — never refreshed
    if (entry.revid === undefined) legacy.push(entry.pageid);
    else if (entry.revid !== liveRevid) stale.push(entry.pageid);
  }
  return { stale, legacy };
}

export interface LegacyClassification {
  /** validated unchanged since fetch — stamp these revids into the cache files */
  fresh: Array<{ pageid: number; revid: number }>;
  /** edited after their fetch — refetch (which stamps the new revid) */
  stale: number[];
}

/**
 * Legacy-file validation via TOP-REVISION timestamps (Issue 6 follow-up).
 * The MediaWiki API rejects rvstart/rvlimit/rvdir on multi-page queries, so
 * batched "revid at fetch time" lookups are impossible; the top revision of
 * many pages IS batchable, and 'top revision predates the fetch' proves the
 * cached content is still current (it can only be the revision we fetched).
 * fetchedAt millisecond precision is truncated to seconds before comparing.
 */
export function classifyLegacyByTimestamp(
  entries: Array<{ pageid: number; fetchedAt: string }>,
  tops: Map<number, { revid: number; timestamp: string }>,
): LegacyClassification {
  const fresh: Array<{ pageid: number; revid: number }> = [];
  const stale: number[] = [];
  for (const entry of entries) {
    const top = tops.get(entry.pageid);
    if (!top) {
      stale.push(entry.pageid); // unresolved → assume edited (conservative)
      continue;
    }
    const fetchedSec = entry.fetchedAt.slice(0, 19) + 'Z';
    if (top.timestamp <= fetchedSec) fresh.push({ pageid: entry.pageid, revid: top.revid });
    else stale.push(entry.pageid);
  }
  return { fresh, stale };
}
