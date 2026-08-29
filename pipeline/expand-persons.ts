/**
 * Stage 5 — recursive person expansion: fetch the person pages linked from the
 * casts/crews of every cached TITLE page (catalogue + archive alike) so every
 * hyperlinked actor, director or technician becomes a real person page — the
 * Aadhi Pinisetty fix (session 15, decision #2: unbounded graph traversal).
 *
 * Politeness: goes through fetchPages (1100ms pacing, disk cache, resumable)
 * per AGENTS.md non-negotiable #3 — NEVER bypass. Waves are small by default;
 * re-running continues the frontier. `build-dataset` ingests whatever is
 * cached; persons not fetched yet keep their Wikipedia link-out.
 *
 * Usage: npm run pipeline:persons [waveSize]           (default 500)
 *        EXPAND_PERSONS_FOCUS=<title-slug> npm run pipeline:persons 200
 *        (hoists that title's cast/crew to the head of the wave)
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnv } from './env.js';

loadEnv();
import { fetchPages, readCachedPage } from './wiki-api.js';
import { classifyPersonPage } from './classify-person.js';
import { loadPersons } from './persons-store.js';
import { extractCast, collectPersonLinks, parseInfobox } from './wikitext/index.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = path.join(ROOT, 'data');
const FRONTIER_PATH = path.join(DATA, 'cache', 'person-frontier.json');
const CREW_FIELDS = [
  'director', 'creator', 'producer', 'executive_producer', 'writer', 'screenwriter', 'story',
  'music', 'composer', 'theme_music_composer', 'cinematography', 'editor', 'narrator',
  'choreographer', 'lyricist', 'production_designer', 'costume_designer', 'presenter',
];

interface FrontierTarget {
  pageid: number;
  finalTitle?: string;
  status: 'pending' | 'accepted' | 'rejected' | 'missing';
  reason?: string;
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

/** Person wikilink targets referenced by the cached title pages, with counts. */
function discoverPersonTargets(): Map<string, number> {
  const movies = JSON.parse(readFileSync(path.join(DATA, 'movies.json'), 'utf8'));
  const series = JSON.parse(readFileSync(path.join(DATA, 'series.json'), 'utf8'));
  const persons = loadPersons(DATA);
  const knownTitles = new Set<string>([...movies, ...series].map((t: any) => t.wikiTitle));
  const knownPersons = new Set<string>(persons.map((p: any) => p.wikiTitle));

  const targets = new Map<string, number>();
  const bump = (wikiTitle: string | undefined) => {
    // interwiki-prefixed links (":ml:…", ":te::…") point at other-language
    // wikis — not fetchable on en.wikipedia; they pollute the pending pool
    if (!wikiTitle || /^:[a-z]{2,3}:/i.test(wikiTitle) || knownTitles.has(wikiTitle) || knownPersons.has(wikiTitle)) return;
    targets.set(wikiTitle, (targets.get(wikiTitle) ?? 0) + 1);
  };

  let scanned = 0;
  for (const record of [...movies, ...series]) {
    const page = readCachedPage(record.pageid);
    if (!page?.wikitext) continue;
    scanned++;
    for (const member of extractCast(page.wikitext)) bump(member.wikiTitle);
    const links = collectPersonLinks(parseInfobox(page.wikitext) ?? [], [], [...CREW_FIELDS, 'starring']);
    for (const link of links) bump(link.target);
  }
  console.log(`→ Discovery: scanned ${scanned} cached title pages → ${targets.size} unknown person targets`);
  return targets;
}

async function main() {
  const waveSize = Number(process.argv[2] ?? process.env.EXPAND_PERSONS_WAVE ?? 500);

  const targets = discoverPersonTargets();
  const frontier = loadFrontier();
  // sweep: retire interwiki-prefixed pendings from before the filter existed
  for (const [name, entry] of Object.entries(frontier.targets)) {
    if (entry.status === 'pending' && /^:[a-z]{2,3}:/i.test(name)) {
      entry.status = 'rejected';
      entry.reason = 'interwiki';
    }
  }
  // sweep: classifier fixes can rescue previously-rejected people (e.g.
  // actor-politicians whose articles lead with {{Infobox officeholder}}) —
  // re-run classification on rejected entries whose pages are already
  // cached; purely local, no network involved.
  let rescued = 0;
  for (const entry of Object.values(frontier.targets)) {
    if (entry.status !== 'rejected' || entry.pageid <= 0) continue;
    const page = readCachedPage(entry.pageid);
    if (!page?.wikitext) continue;
    if ('ok' in classifyPersonPage(page.wikitext)) {
      entry.status = 'accepted';
      delete entry.reason;
      rescued++;
    }
  }
  if (rescued > 0) {
    console.log(`  re-classification sweep: ${rescued} rejected → accepted (cached pages only)`);
    writeFileSync(FRONTIER_PATH, JSON.stringify(frontier));
  }
  const names = [...targets.keys()].sort();
  for (const name of names) {
    if (!frontier.targets[name]) {
      frontier.targets[name] = { pageid: 0, status: 'pending', refs: targets.get(name)! };
    } else {
      frontier.targets[name].refs = targets.get(name)!;
    }
  }

  const pending = names.filter((n) => frontier.targets[n].status === 'pending');
  const counts = { accepted: 0, rejected: 0, missing: 0 };
  for (const t of Object.values(frontier.targets)) {
    if (t.status === 'accepted') counts.accepted++;
    else if (t.status === 'rejected') counts.rejected++;
    else if (t.status === 'missing') counts.missing++;
  }
  console.log(`→ Person frontier: ${counts.accepted} accepted, ${counts.rejected} rejected, ${counts.missing} missing, ${pending.length} pending (of ${names.length} targets)`);

  if (pending.length === 0 || waveSize <= 0) {
    console.log('  nothing to fetch this run.');
    return;
  }

  // most-referenced first. EXPAND_PERSONS_FOCUS (title slug) hoists that
  // title's cast/crew to the head of the wave (Mayasabha acceptance test).
  const focus = process.env.EXPAND_PERSONS_FOCUS ? String(process.env.EXPAND_PERSONS_FOCUS) : null;
  const focusTargets = new Set<string>();
  if (focus) {
    const movies = JSON.parse(readFileSync(path.join(DATA, 'movies.json'), 'utf8'));
    const series = JSON.parse(readFileSync(path.join(DATA, 'series.json'), 'utf8'));
    const record = [...movies, ...series].find((t: any) => t.slug === focus);
    if (record) {
      const page = readCachedPage(record.pageid);
      if (page?.wikitext) {
        for (const member of extractCast(page.wikitext)) if (member.wikiTitle) focusTargets.add(member.wikiTitle);
        for (const link of collectPersonLinks(parseInfobox(page.wikitext) ?? [], [], [...CREW_FIELDS, 'starring'])) focusTargets.add(link.target);
      }
    } else {
      console.log(`  focus slug "${focus}" not found — ignoring.`);
    }
  }

  const wave = pending
    .sort((a, b) => {
      const fa = focusTargets.has(a) ? 0 : 1;
      const fb = focusTargets.has(b) ? 0 : 1;
      if (fa !== fb) return fa - fb;
      return frontier.targets[b].refs - frontier.targets[a].refs || a.localeCompare(b);
    })
    .slice(0, waveSize);

  console.log(`→ Fetching person wave of ${wave.length} pages (paced, cache-resumable)…`);
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
    const verdict = classifyPersonPage(page.wikitext);
    if ('reject' in verdict) {
      entry.status = 'rejected';
      entry.reason = verdict.reject;
    } else {
      entry.status = 'accepted';
    }
  }

  mkdirSync(path.dirname(FRONTIER_PATH), { recursive: true });
  writeFileSync(FRONTIER_PATH, JSON.stringify(frontier));
  const after = Object.values(frontier.targets);
  console.log(
    `✓ Person wave complete: ${after.filter((t) => t.status === 'accepted').length} accepted, ` +
      `${after.filter((t) => t.status === 'rejected').length} rejected, ` +
      `${after.filter((t) => t.status === 'missing').length} missing, ` +
      `${after.filter((t) => t.status === 'pending').length} still pending — run again to continue.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
