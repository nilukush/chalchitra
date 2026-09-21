/**
 * Post-build content invariants (foolproofing package, 2026-09-21).
 * Runs in CI after `npm run build`, BEFORE the cache save + seed publish +
 * deploy: the live site is then still the PREVIOUS deployment, so comparing
 * the fresh build's search-index doc ids against live detects any silent
 * page loss (Issue 5 class) while the run can still be failed. Canary
 * fetches confirm the live set actually serves.
 *
 * Usage: npx tsx pipeline/postdeploy-check.ts [--live-only] [--canaries N] [--from-data]
 *   SITE_URL (default https://chalchitra-pied.vercel.app)
 *   --live-only  skip the local build comparison (manual triage mode)
 *   --from-data  read the local doc set from data/*.json (movies, series,
 *               persons chunks) instead of dist/ — this is the superset
 *               GUARD scripts-seed.sh swap runs before evicting CI caches
 */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { diffDocIds, docIdToUrl, sampleCanaryIds } from './postdeploy-lib.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = (process.env.SITE_URL ?? 'https://chalchitra-pied.vercel.app').replace(/\/$/, '');
const liveOnly = process.argv.includes('--live-only');
const fromData = process.argv.includes('--from-data');
const canaryCount = Number(process.argv.join(' ').match(/--canaries (\d+)/)?.[1] ?? 10);

async function fetchJson(url: string, tries = 3): Promise<any> {
  for (let i = 1; i <= tries; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      if (i === tries) throw err;
      await new Promise((r) => setTimeout(r, 30_000));
    }
  }
  throw new Error('unreachable');
}

function readRemovals(): string[] {
  try {
    return readFileSync(path.join(ROOT, 'pipeline', 'intentional-removals.txt'), 'utf8')
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#'));
  } catch {
    return [];
  }
}

async function main() {
  console.log(`→ Content invariants vs live site (${SITE})`);
  const liveIndex = await fetchJson(`${SITE}/search-index.json`);
  const liveIds: string[] = liveIndex.docs.map((d: any) => d.id);
  console.log(`  live docs: ${liveIds.length} (generatedAt ${liveIndex.generatedAt})`);

  if (!liveOnly) {
    let buildIds: string[];
    if (fromData) {
      const movies = JSON.parse(readFileSync(path.join(ROOT, 'data', 'movies.json'), 'utf8')) as any[];
      const series = JSON.parse(readFileSync(path.join(ROOT, 'data', 'series.json'), 'utf8')) as any[];
      const persons = readdirSync(path.join(ROOT, 'data', 'persons'))
        .flatMap((f) => JSON.parse(readFileSync(path.join(ROOT, 'data', 'persons', f), 'utf8')) as any[]);
      buildIds = [
        ...movies.map((m) => `movie:${m.slug}`),
        ...series.map((s2) => `series:${s2.slug}`),
        ...persons.map((p2) => `person:${p2.slug}`),
      ];
    } else {
      const buildIndex = JSON.parse(readFileSync(path.join(ROOT, 'dist', 'search-index.json'), 'utf8'));
      buildIds = buildIndex.docs.map((d: any) => d.id);
    }
    const removals = readRemovals();
    const plan = diffDocIds(liveIds, buildIds, removals);
    const vanishedTotal = plan.intentional.length + plan.unexpected.length;
    console.log(`  build docs: ${buildIds.length} | +${plan.added.length} new | -${vanishedTotal} removed`);
    if (plan.intentional.length > 0) console.log(`  intentional removals: ${plan.intentional.length} (${plan.intentional.slice(0, 5).join(', ')}${plan.intentional.length > 5 ? '…' : ''})`);
    if (plan.added.length > 0) console.log(`  new docs: ${plan.added.length}`);

    if (plan.unexpected.length > 0) {
      console.error(`✗ ${plan.unexpected.length} pages on the LIVE site are MISSING from this build — silent page loss (Issue 5 class):`);
      for (const id of plan.unexpected.slice(0, 30)) console.error(`    ${id}`);
      if (plan.unexpected.length > 30) console.error(`    …and ${plan.unexpected.length - 30} more`);
      console.error('  If the removal is INTENTIONAL, add its doc id to pipeline/intentional-removals.txt with an ISSUES.md reference.');
      if (fromData) console.error('  (superset guard: this is why scripts-seed.sh swap would refuse)');
      process.exit(1);
    }
    console.log('✓ no unexpected page loss');
  }

  // canaries: sampled live pages must actually serve (index ↔ content parity)
  const canaries = sampleCanaryIds(liveIds, canaryCount);
  let bad = 0;
  for (const id of canaries) {
    const url = `${SITE}${docIdToUrl(id)}`;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(30_000), redirect: 'follow' });
      if (!res.ok) {
        console.error(`  ✗ canary ${id} → HTTP ${res.status}`);
        bad++;
      }
    } catch (err) {
      console.error(`  ✗ canary ${id} → ${String(err).slice(0, 80)}`);
      bad++;
    }
  }
  console.log(`✓ canaries: ${canaries.length - bad}/${canaries.length} served`);
  if (bad > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
