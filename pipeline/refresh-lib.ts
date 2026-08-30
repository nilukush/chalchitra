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
