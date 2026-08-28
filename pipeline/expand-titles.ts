/**
 * Stage 4 — archive expansion: fetch the title pages linked from persons'
 * filmographies/awards so every work becomes a full page on the site.
 *
 * Politeness: goes through fetchPages (1100ms pacing, disk cache, resumable)
 * per AGENTS.md non-negotiable #3 — NEVER bypass. Waves are small by default;
 * re-running continues the frontier. `build-dataset` picks up whatever is
 * cached; works not fetched yet keep their Wikipedia link-out.
 *
 * Usage: npm run pipeline:expand [waveSize]   (default 500)
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnv } from './env.js';

loadEnv();
import { fetchPages } from './wiki-api.js';
import { classifyTitlePage } from './classify-title.js';
import { loadPersons } from './persons-store.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = path.join(ROOT, 'data');
const FRONTIER_PATH = path.join(DATA, 'cache', 'expansion-frontier.json');

interface FrontierTarget {
  pageid: number;
  finalTitle?: string;
  status: 'pending' | 'accepted' | 'rejected' | 'missing';
  kind?: 'movie' | 'series';
  reason?: string;
  year?: string;
  refs: number;
}

interface Frontier {
  version: number;
  targets: Record<string, FrontierTarget>;
}

function loadFrontier(): Frontier {
  if (!existsSync(FRONTIER_PATH)) return { version: 1, targets: {} };
  try {
    return JSON.parse(readFileSync(FRONTIER_PATH, 'utf8'));
  } catch {
    return { version: 1, targets: {} };
  }
}

async function main() {
  const waveSize = Number(process.argv[2] ?? process.env.EXPAND_WAVE ?? 500);

  const persons = loadPersons(DATA);
  const movies = JSON.parse(readFileSync(path.join(DATA, 'movies.json'), 'utf8'));
  const series = JSON.parse(readFileSync(path.join(DATA, 'series.json'), 'utf8'));
  const catalogue = new Set<string>([...movies, ...series].map((t: any) => t.wikiTitle));

  // collect unique targets with reference counts + best-known year
  const targets = new Map<string, { refs: number; year?: string }>();
  const bump = (wikiTitle: string | undefined, year?: string) => {
    if (!wikiTitle || catalogue.has(wikiTitle)) return;
    const cur = targets.get(wikiTitle) ?? { refs: 0, year };
    cur.refs++;
    if (!cur.year && year) cur.year = year;
    targets.set(wikiTitle, cur);
  };
  for (const person of persons) {
    for (const section of person.filmography ?? []) {
      for (const row of section.rows) bump(row.wikiTitle, row.year);
    }
    for (const award of person.awards ?? []) bump(award.workWikiTitle, award.year);
  }

  const frontier = loadFrontier();
  // register new targets as pending (sorted for stable batch composition → API-cache reuse)
  const names = [...targets.keys()].sort();
  for (const name of names) {
    if (!frontier.targets[name]) {
      frontier.targets[name] = { pageid: 0, status: 'pending', refs: targets.get(name)!.refs, year: targets.get(name)!.year };
    } else {
      frontier.targets[name].refs = targets.get(name)!.refs;
    }
  }

  const pending = names.filter((n) => frontier.targets[n].status === 'pending');
  const stats = { accepted: 0, rejected: 0, missing: 0, pending: pending.length };
  for (const t of Object.values(frontier.targets)) {
    if (t.status === 'accepted') stats.accepted++;
    else if (t.status === 'rejected') stats.rejected++;
    else if (t.status === 'missing') stats.missing++;
  }
  console.log(`→ Frontier: ${stats.accepted} accepted, ${stats.rejected} rejected, ${stats.missing} missing, ${stats.pending} pending (of ${names.length} targets)`);

  if (pending.length === 0 || waveSize <= 0) {
    console.log('  nothing to fetch this run.');
    return;
  }

  // most-referenced first — popular works become pages earliest. EXPAND_FOCUS
  // (person slug) hoists that person's pending works to the head of the wave.
  const focus = process.env.EXPAND_FOCUS ? String(process.env.EXPAND_FOCUS) : null;
  const focusTitles = new Set<string>();
  if (focus) {
    const person = persons.find((p: any) => p.slug === focus);
    if (person) {
      for (const section of person.filmography ?? []) {
        for (const row of section.rows) if (row.wikiTitle) focusTitles.add(row.wikiTitle);
      }
      for (const award of person.awards ?? []) if (award.workWikiTitle) focusTitles.add(award.workWikiTitle);
    }
  }
  const wave = pending
    .sort((a, b) => {
      const fa = focusTitles.has(a) ? 0 : 1;
      const fb = focusTitles.has(b) ? 0 : 1;
      if (fa !== fb) return fa - fb;
      return frontier.targets[b].refs - frontier.targets[a].refs || a.localeCompare(b);
    })
    .slice(0, waveSize);

  console.log(`→ Fetching wave of ${wave.length} pages (paced, cache-resumable)…`);
  const pages = await fetchPages(wave, (d, t) => {
    if (d % 100 === 0 || d === t) console.log(`  wave ${d}/${t}`);
  });

  for (const name of wave) {
    const page = pages.get(name);
    const entry = frontier.targets[name];
    if (!page || page.missing || !page.wikitext || page.pageid <= 0) {
      entry.status = 'missing';
      entry.pageid = -1;
      continue;
    }
    entry.pageid = page.pageid;
    entry.finalTitle = page.title;
    const verdict = classifyTitlePage(page.wikitext);
    if ('reject' in verdict) {
      entry.status = 'rejected';
      entry.reason = verdict.reject;
    } else {
      entry.status = 'accepted';
      entry.kind = verdict.kind;
    }
  }

  mkdirSync(path.dirname(FRONTIER_PATH), { recursive: true });
  writeFileSync(FRONTIER_PATH, JSON.stringify(frontier));
  const after = Object.values(frontier.targets);
  console.log(
    `✓ Wave complete: ${after.filter((t) => t.status === 'accepted').length} accepted, ` +
      `${after.filter((t) => t.status === 'rejected').length} rejected, ` +
      `${after.filter((t) => t.status === 'missing').length} missing, ` +
      `${after.filter((t) => t.status === 'pending').length} still pending — run again to continue.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
