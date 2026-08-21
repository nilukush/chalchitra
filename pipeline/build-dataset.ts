/**
 * Stage 3 — parse cached wikitext into the site datasets:
 *   data/movies.json, data/series.json, data/persons.json,
 *   data/search-index.json, data/site-stats.json
 * Persons are discovered from cast/crew links and fetched (cache-aware).
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  extractCast,
  extractAwards,
  extractBioSections,
  extractEpisodes,
  extractExternalLinks,
  extractFilmography,
  extractDiscography,
  findDiscographySubpage,
  findEpisodesSubpage,
  findSoundtrackSubpage,
  extractReferences,
  extractSections,
  extractSoundtrack,
  findAwardsSubpage,
  findFilmographySubpage,
  findPlotSection,
  getSection,
  listSectionTitles,
  parseInfobox,
  splitListField,
  stripWikitext,
  collectPersonLinks,
  parseStartDate,
} from './wikitext/index.js';
import type { AwardRow } from './wikitext/awards.js';
import type { DiscographySection, FilmographySection } from './wikitext/filmography.js';
import { renderLinkedHtml, type LinkLookup } from './wikitext/linked-html.js';
import { enrichPersons, enrichTitles, enrichTitlesLite } from './enrich/tmdb.js';
import { enrichWithAi } from './enrich/ai.js';
import { loadEnv } from './env.js';

loadEnv();
import { fetchPages, readCachedPage, resolveImageThumbUrls, type CachedPage } from './wiki-api.js';
import { SlugRegistry, buildSearchDocuments, computeKnownFor, displayTitle, wikiUrlFor } from './dataset-lib.js';
import type { PersonRecord, SiteStats, TitleRecord } from './types.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = path.join(ROOT, 'data');
const YEAR = 2026;

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const CREW_FIELDS = [
  'director', 'creator', 'producer', 'executive_producer', 'writer', 'screenwriter', 'story',
  'music', 'composer', 'theme_music_composer', 'cinematography', 'editor', 'narrator',
  'choreographer', 'lyricist', 'production_designer', 'costume_designer', 'presenter',
];

const FACT_FIELDS: [string, string][] = [
  ['birth_name', 'Birth name'],
  ['birth_date', 'Born'],
  ['birth_place', 'Birthplace'],
  ['death_date', 'Died'],
  ['death_place', 'Place of death'],
  ['occupation', 'Occupation'],
  ['years_active', 'Years active'],
  ['nationality', 'Nationality'],
  ['citizenship', 'Citizenship'],
  ['spouses', 'Spouse(s)'],
  ['partner', 'Partner(s)'],
  ['children', 'Children'],
  ['parents', 'Parents'],
  ['relatives', 'Relatives'],
  ['alma_mater', 'Alma mater'],
  ['education', 'Education'],
  ['awards', 'Awards'],
  ['known_for', 'Known for'],
  ['height', 'Height'],
  ['home_town', 'Home town'],
  ['other_names', 'Other names'],
  ['genres', 'Genres'],
  ['instruments', 'Instruments'],
  ['labels', 'Labels'],
  ['notable_works', 'Notable works'],
];

const BORING_SECTIONS = new Set([
  'References', 'External links', 'See also', 'Notes', 'Citations',
  'Further reading', 'Bibliography', 'Sources', 'Footnotes',
]);

function truncate(text: string | undefined, max: number): string | undefined {
  if (!text) return undefined;
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSentence = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('!'), cut.lastIndexOf('?'));
  return (lastSentence > max * 0.5 ? cut.slice(0, lastSentence + 1) : cut.trimEnd()) + ' […]';
}

/** {{Birth date and age|1984|5|31|df=y}} → "31 May 1984" */
function renderDateTemplate(raw: string): string {
  const match =
    /\{\{\s*(?:Birth date and age|Birth date|Death date and age|Death date|bda|dda|birth date)\s*\|([^{}]*)\}\}/i.exec(
      raw,
    );
  if (match) {
    const nums = match[1].split('|').map((p) => p.trim()).filter((p) => /^\d{1,4}$/.test(p)).map(Number);
    if (nums.length >= 3 && nums[1] >= 1 && nums[1] <= 12 && nums[2] >= 1 && nums[2] <= 31) {
      return `${nums[2]} ${MONTHS[nums[1] - 1]} ${nums[0]}`;
    }
  }
  return stripWikitext(raw).replace(/\s+/g, ' ').trim();
}

function cleanValue(raw: string | undefined): string {
  if (!raw) return '';
  return splitListField(raw).join(', ');
}

/** Keep link chips unique by URL, most meaningful labels first. */
function dedupeLinks(links: { label: string; url: string }[]): { label: string; url: string }[] {
  const seen = new Set<string>();
  return links.filter((l) => {
    if (!l.url || seen.has(l.url)) return false;
    seen.add(l.url);
    return true;
  });
}

function leadFromWikitext(wikitext: string): string | undefined {
  const firstHeading = wikitext.search(/^={2,}.*$/m);
  const lead = firstHeading > 0 ? wikitext.slice(0, firstHeading) : wikitext;
  const stripped = stripWikitext(lead);
  return truncate(stripped, 900);
}

/** "Jana Nayagan.jpg?utm_source=…" → "Jana Nayagan.jpg" (API appends utm on unscaled thumbs). */
function cleanThumb(url: string | undefined): string | undefined {
  return url ? url.split('?')[0] : undefined;
}

/** "Dhurandhar poster.jpg" or "[[File:X.jpg|thumb|…]]" → "X.jpg" (null if none). */
function imageFilenameFromInfobox(value: string | undefined): string | null {
  if (!value) return null;
  // commented-out posters must never be used (may reference another film's art)
  const uncommented = value.replace(/<!--[\s\S]*?-->/g, '');
  const match = /([^\[\]|:]+\.(?:jpe?g|png|svg|gif|webp))/i.exec(uncommented);
  return match ? match[1].trim() : null;
}

/** Sections rendered elsewhere (plot, cast, tables) or pure navigation → excluded
 *  from the article deep-dive text. */
const SKIP_ARTICLE_SECTIONS =
  /^(references?|external links?|see also|notes?|citations?|further reading|bibliography|sources?|footnotes?|gallery|trivia|plots?|plot (summary|synopsis)|premise|synops(is|es)|story|cast( and (characters|crew))?|main cast|principal cast|recurring|guest|cameo appearances|voice cast|episodes?|series overview|season \d+|soundtracks?|music|music \(album\)|songs?|soundtrack album|marketing|promotion)$/i;

function extractArticleSections(wikitext: string): { title: string; text: string }[] {
  return extractSections(wikitext)
    .filter((s) => !SKIP_ARTICLE_SECTIONS.test(s.title.trim()) && !/^\d+$/.test(s.title.trim()))
    .map((s) => ({
      title: s.title.trim().replace(/^./, (c) => c.toUpperCase()),
      text: stripWikitext(s.body)
        .replace(/^[#*:;]+\s*/gm, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim(),
    }))
    .filter((s) => s.text.length >= 60);
}

function parseTitlePage(
  kind: 'movie' | 'series',
  wikiTitle: string,
  page: CachedPage,
  slug: string,
  opts: { year?: number; archive?: boolean } = {},
): TitleRecord {
  const wikitext = page.wikitext ?? '';
  const box = parseInfobox(wikitext) ?? {};
  const cast = extractCast(wikitext);
  const external = extractExternalLinks(wikitext);
  const website = box.website ? stripWikitext(box.website) : undefined;
  const official = external.official ?? (website && /^https?:\/\//.test(website) ? website : undefined);

  const plot = findPlotSection(wikitext);
  const reception =
    getSection(wikitext, 'Reception') ??
    getSection(wikitext, 'Critical response') ??
    getSection(wikitext, 'Critical reception') ??
    getSection(wikitext, 'Box office');

  const record: TitleRecord = {
    kind,
    slug,
    title: displayTitle(wikiTitle),
    wikiTitle,
    wikiUrl: wikiUrlFor(wikiTitle),
    pageid: page.pageid,
    origin: 'in',
    language: cleanValue(box.language) || 'Hindi',
    year: opts.year ?? YEAR,
    ...(opts.archive ? { archive: true } : {}),
    poster: cleanThumb(page.thumb),
    summary: page.extract ? page.extract.trim() : leadFromWikitext(wikitext),
    plot: stripWikitext(plot ?? '') || undefined,
    reception: stripWikitext(reception ?? '') || undefined,
    articleSections: extractArticleSections(wikitext),
    nativeName: cleanValue(box.native_name) || undefined,
    lastAired: cleanValue(box.last_aired) || undefined,
    relatedTitles: splitListField(box.related),
    releaseDate: parseStartDate(box.released) ?? parseStartDate(box.first_aired) ?? undefined,
    runtime: cleanValue(box.runtime) || undefined,
    genres: splitListField(box.genre),
    directedBy: splitListField(box.director),
    createdBy: splitListField(box.creator),
    writtenBy: [...splitListField(box.writer), ...splitListField(box.screenplay), ...splitListField(box.story)].filter((v, i, a) => a.indexOf(v) === i),
    musicBy: splitListField(box.music).length > 0 ? splitListField(box.music) : splitListField(box.composer),
    producedBy: [...splitListField(box.producer), ...splitListField(box.executive_producer)].filter((v, i, a) => a.indexOf(v) === i),
    cinematographyBy: [...splitListField(box.cinematography), ...splitListField(box.camera)].filter((v, i, a) => a.indexOf(v) === i),
    editedBy: splitListField(box.editing).length > 0 ? splitListField(box.editing) : splitListField(box.editor),
    studios: [...(splitListField(box.studio).length > 0 ? splitListField(box.studio) : splitListField(box.company)), ...splitListField(box.production_companies)].filter((v, i, a) => a.indexOf(v) === i),
    distributor: splitListField(box.distributor),
    network: [...splitListField(box.network), ...splitListField(box.channel)].filter((v, i, a) => a.indexOf(v) === i),
    seasons: cleanValue(box.num_seasons) || undefined,
    episodes: cleanValue(box.num_episodes) || undefined,
    budget: cleanValue(box.budget) || undefined,
    gross: cleanValue(box.gross) || undefined,
    episodesList: extractEpisodes(wikitext),
    soundtrack: extractSoundtrack(wikitext) ?? undefined,
    awards: extractAwards(wikitext),
    references: extractReferences(wikitext),
    cast: [], // filled after person resolution
    crew: [],
    referenceCount: (wikitext.match(/<ref[\s>]/gi) ?? []).length,
    sections: listSectionTitles(wikitext).filter((s) => !BORING_SECTIONS.has(s)),
    external: { imdbId: external.imdbId, official, links: dedupeLinks(external.links).slice(0, 14) },
  };
  void cast;
  // structured awards replace the raw section (no double render); a prose-only
  // awards section stays as an article chapter
  if (record.awards && record.awards.length > 0) {
    record.articleSections = record.articleSections.filter((s) => !/^(awards?|accolades)/i.test(s.title.trim()));
  } else {
    record.awards = undefined;
  }
  return record;
}

async function main() {
  console.log('→ Loading titles & cached pages…');
  const titles = JSON.parse(readFileSync(path.join(DATA, 'titles.json'), 'utf8'));
  const movieTitles: string[] = titles.movies.map((m: any) => m.title);
  const seriesTitles: string[] = titles.series.map((s: any) => s.title);
  const titlePages = await fetchPages([...movieTitles, ...seriesTitles], (d, t) => {
    if (d % 100 === 0 || d === t) console.log(`  titles ${d}/${t}`);
  });

  const movieRegistry = new SlugRegistry();
  const seriesRegistry = new SlugRegistry();
  const movies: TitleRecord[] = [];
  const series: TitleRecord[] = [];

  // parse + collect person links
  const personLinkTargets = new Set<string>();
  const titleCast = new Map<string, { name: string; wikiTitle: string | null; role: string }[]>();
  const titleCrew = new Map<string, { name: string; role: string; target: string }[]>();

  for (const [wikiTitle, page] of titlePages) {
    const kind = movieTitles.includes(wikiTitle) ? 'movie' : 'series';
    if (page.missing || !page.wikitext) continue;
    const slug = kind === 'movie' ? movieRegistry.slug(wikiTitle, page.pageid) : seriesRegistry.slug(wikiTitle, page.pageid);
    const record = parseTitlePage(kind, wikiTitle, page, slug);
    (kind === 'movie' ? movies : series).push(record);

    const box = parseInfobox(page.wikitext) ?? {};
    const cast = extractCast(page.wikitext);
    titleCast.set(wikiTitle, cast);
    const links = collectPersonLinks(box, cast, [...CREW_FIELDS, 'starring']);
    titleCrew.set(
      wikiTitle,
      links.filter((l) => l.as !== 'Cast').map((l) => ({ name: l.label || l.target, role: l.as, target: l.target })),
    );
    for (const link of links) personLinkTargets.add(link.target);
    for (const member of cast) if (member.wikiTitle) personLinkTargets.add(member.wikiTitle);
  }

  console.log(`→ Parsed ${movies.length} movies, ${series.length} series`);
  console.log(`→ Discovering ${personLinkTargets.size} candidate person pages…`);
  const candidates = [...personLinkTargets];
  const personPages = await fetchPages(candidates, (d, t) => {
    if (d % 200 === 0 || d === t) console.log(`  persons ${d}/${t}`);
  });

  // canonical target → final title (redirect-aware)
  const canonical = new Map<string, string>();
  const finalPersons = new Map<string, CachedPage>();
  for (const [requested, page] of personPages) {
    if (page.missing || !page.wikitext || page.pageid <= 0) continue;
    canonical.set(requested, page.title);
    if (!finalPersons.has(page.title)) finalPersons.set(page.title, page);
  }
  console.log(`→ ${finalPersons.size} person pages resolved`);

  // Recursive person expansion (Step 7): ingest the wave-accepted person pages
  // — cast/crew discovered on ANY cached title (catalogue + archive alike).
  // They flow through the same person loop: filmography/awards/discography/
  // bio/subpages, and the archive cast wiring below resolves against them.
  const personFrontierPath = path.join(DATA, 'cache', 'person-frontier.json');
  if (existsSync(personFrontierPath)) {
    const pf = JSON.parse(readFileSync(personFrontierPath, 'utf8')) as {
      targets: Record<string, { pageid: number; finalTitle?: string; status: string }>;
    };
    let wavePersons = 0;
    for (const [requested, entry] of Object.entries(pf.targets)) {
      if (entry.status !== 'accepted' || entry.pageid <= 0) continue;
      const page = readCachedPage(entry.pageid);
      if (!page?.wikitext) continue;
      const finalTitle = entry.finalTitle ?? page.title;
      canonical.set(requested, finalTitle);
      if (!finalPersons.has(finalTitle)) {
        finalPersons.set(finalTitle, page);
        wavePersons++;
      }
    }
    if (wavePersons > 0) console.log(`→ Person expansion: +${wavePersons} wave persons`);
  }

  // Follow {{Main|X filmography}} / {{Main|List of awards…}} pointers to the
  // dedicated subpages that hold the real tables (Emraan Hashmi et al).
  // Fetched through the same paced, cache-resumable path as everything else.
  const subpageWanted = new Set<string>();
  for (const page of finalPersons.values()) {
    for (const target of [findFilmographySubpage(page.wikitext ?? ''), findAwardsSubpage(page.wikitext ?? '')]) {
      if (target) subpageWanted.add(target);
    }
  }
  let subpages = new Map<string, CachedPage>();
  if (subpageWanted.size > 0) {
    console.log(`→ Following ${subpageWanted.size} filmography/awards subpages…`);
    subpages = await fetchPages([...subpageWanted]);
    console.log(`  ${[...subpages.values()].filter((p) => !p.missing).length} subpages resolved`);
  }

  // person slug lookup: finalTitle → slug
  const personRegistry = new SlugRegistry();
  const personSlugByFinal = new Map<string, string>();
  for (const finalTitle of finalPersons.keys()) {
    const page = finalPersons.get(finalTitle)!;
    personSlugByFinal.set(finalTitle, personRegistry.slug(page.title, page.pageid));
  }
  // exact-name fallback for plain-text cast entries (no wikilink on the title
  // page): link them when EXACTLY ONE person in the universe carries that name
  const nameCount = new Map<string, number>();
  for (const finalTitle of finalPersons.keys()) {
    const name = displayTitle(finalTitle);
    nameCount.set(name, (nameCount.get(name) ?? 0) + 1);
  }
  const nameToSlug = new Map<string, string>();
  for (const [finalTitle, slug] of personSlugByFinal) {
    const name = displayTitle(finalTitle);
    if (nameCount.get(name) === 1) nameToSlug.set(name, slug);
  }

  // wire cast + crew into title records
  for (const record of [...movies, ...series]) {
    const cast = titleCast.get(record.wikiTitle) ?? [];
    record.cast = cast.map((member) => {
      const final = member.wikiTitle ? canonical.get(member.wikiTitle) : undefined;
      const slug =
        (final && personSlugByFinal.has(final) ? personSlugByFinal.get(final)! : null) ??
        (member.wikiTitle ? undefined : nameToSlug.get(member.name)) ??
        null;
      return { name: member.name, slug, role: member.role };
    });
    const crew = titleCrew.get(record.wikiTitle) ?? [];
    record.crew = crew
      .map((c) => {
        const final = canonical.get(c.target);
        const slug = final && personSlugByFinal.has(final) ? personSlugByFinal.get(final)! : null;
        return { name: c.name, role: c.role, slug };
      })
      .filter((c) => c.slug !== null || !canonical.has(c.target));
  }

  // build person records with computed credits
  const persons: PersonRecord[] = [];
  for (const [finalTitle, page] of finalPersons) {
    const box = parseInfobox(page.wikitext) ?? {};
    const slug = personSlugByFinal.get(finalTitle)!;
    const external = extractExternalLinks(page.wikitext);

    const credits = [];
    for (const record of [...movies, ...series]) {
      const castHit = (titleCast.get(record.wikiTitle) ?? []).find(
        (m) => m.wikiTitle && (canonical.get(m.wikiTitle) === finalTitle || m.wikiTitle === finalTitle),
      );
      if (castHit) {
        credits.push({
          titleSlug: record.slug,
          title: record.title,
          kind: record.kind,
          role: castHit.role ? `as ${castHit.role}` : 'Cast',
          year: record.year,
          poster: record.poster,
        });
        continue;
      }
      const crewHit = (titleCrew.get(record.wikiTitle) ?? []).find(
        (c) => canonical.get(c.target) === finalTitle || c.target === finalTitle,
      );
      if (crewHit) {
        credits.push({
          titleSlug: record.slug,
          title: record.title,
          kind: record.kind,
          role: crewHit.role,
          year: record.year,
          poster: record.poster,
        });
      }
    }
    credits.sort((a, b) => a.title.localeCompare(b.title));

    const facts = FACT_FIELDS.flatMap(([key, label]) => {
      if (!box[key]) return [];
      const value = key === 'birth_date' || key === 'death_date' ? renderDateTemplate(box[key]) : cleanValue(box[key]);
      return value ? [{ label, value: truncate(value, 160) }] : [];
    });

    // filmography/awards may live on a dedicated subpage; merge with the
    // main article's own rows, subpage tables winning on duplicates
    const filmSub = findFilmographySubpage(page.wikitext ?? '');
    const filmSubPage = filmSub ? subpages.get(filmSub) : undefined;
    const awardsSub = findAwardsSubpage(page.wikitext ?? '');
    const awardsSubPage = awardsSub ? subpages.get(awardsSub) : undefined;

    const filmography: FilmographySection[] = [];
    for (const source of [filmSubPage?.wikitext, page.wikitext]) {
      if (!source) continue;
      for (const section of extractFilmography(source)) {
        const existing = filmography.find((s) => s.heading === section.heading);
        if (!existing) filmography.push(section);
        else {
          const known = new Set(existing.rows.map((r) => r.wikiTitle ?? r.title));
          existing.rows.push(...section.rows.filter((r) => !known.has(r.wikiTitle ?? r.title)));
        }
      }
    }

    // discography: same subpage-first merge (the discography subpage is often
    // the same {{Main|X discography}} page the filmography union fetched)
    const discSub = findDiscographySubpage(page.wikitext ?? '');
    const discSubPage = discSub ? subpages.get(discSub) : undefined;
    const discography: DiscographySection[] = [];
    for (const source of [discSubPage?.wikitext, page.wikitext]) {
      if (!source) continue;
      for (const section of extractDiscography(source)) {
        const existing = discography.find((s) => s.heading === section.heading);
        if (!existing) discography.push(section);
        else {
          const known = new Set(existing.rows.map((r) => r.song));
          existing.rows.push(...section.rows.filter((r) => !known.has(r.song)));
        }
      }
    }

    const awardRows: AwardRow[] = [];
    for (const source of [awardsSubPage?.wikitext, page.wikitext]) {
      if (!source) continue;
      const known = new Set(awardRows.map((r) => `${r.year ?? ''}|${r.award}|${r.category ?? ''}|${r.work ?? ''}`));
      awardRows.push(...extractAwards(source).filter((r) => !known.has(`${r.year ?? ''}|${r.award}|${r.category ?? ''}|${r.work ?? ''}`)));
    }

    persons.push({
      slug,
      name: displayTitle(finalTitle),
      wikiTitle: finalTitle,
      wikiUrl: wikiUrlFor(finalTitle),
      pageid: page.pageid,
      image: cleanThumb(page.thumb),
      summary: page.extract ? page.extract.trim() : leadFromWikitext(page.wikitext),
      occupations: splitListField(box.occupation),
      facts,
      credits,
      external: { imdbId: external.imdbId, official: external.official, links: dedupeLinks(external.links).slice(0, 12) },
      references: extractReferences(page.wikitext ?? ''),
      awards: awardRows.length > 0 ? awardRows : undefined,
      filmography: filmography.length > 0 ? filmography : undefined,
      discography: discography.length > 0 ? discography : undefined,
      bio: extractBioSections(page.wikitext ?? ''),
      sections: listSectionTitles(page.wikitext).filter((s) => !BORING_SECTIONS.has(s)),
    });
  }
  persons.sort((a, b) => a.name.localeCompare(b.name));

  // ---- archive expansion: turn fetched filmography works into full pages ----
  // Reads whatever the expand-titles waves have cached; unfetched works keep
  // their Wikipedia link-out until a later wave. Records are trimmed to an
  // archive-lite shape (no references/article sections/soundtrack/reception)
  // to keep the dataset JSONs within build budget.
  const frontierPath = path.join(DATA, 'cache', 'expansion-frontier.json');
  if (existsSync(frontierPath)) {
    const frontier = JSON.parse(readFileSync(frontierPath, 'utf8')) as {
      targets: Record<string, { pageid: number; finalTitle?: string; status: string; kind?: 'movie' | 'series'; year?: string; refs: number }>;
    };
    const accepted = Object.entries(frontier.targets).filter(([, t]) => t.status === 'accepted' && t.kind && t.pageid > 0);
    let archiveMovies = 0;
    let archiveSeries = 0;
    const seenFinal = new Set<string>([...movies, ...series].map((t) => t.wikiTitle));
    for (const [requested, entry] of accepted) {
      const finalTitle = entry.finalTitle ?? requested;
      if (seenFinal.has(finalTitle)) continue;
      const page = readCachedPage(entry.pageid);
      if (!page?.wikitext) continue;
      titlePages.set(finalTitle, page); // poster resolution + plot-link lookup
      const kind = entry.kind!;
      const slug = kind === 'movie' ? movieRegistry.slug(finalTitle, page.pageid) : seriesRegistry.slug(finalTitle, page.pageid);
      const box = parseInfobox(page.wikitext) ?? {};
      const yearFromBox = parseStartDate(box.released) ?? parseStartDate(box.first_aired);
      const year = yearFromBox ? Number(String(yearFromBox).slice(0, 4)) : Number(String(entry.year ?? '').slice(0, 4)) || undefined;
      const record = parseTitlePage(kind, finalTitle, page, slug, { year, archive: true });
      // full-fidelity mandate (2026-08-20): soundtracks stay; references and
      // article chapters remain trimmed ONLY until the JSON-chunking step
      // lands (Step 6) — they dominate record size
      record.references = [];
      record.articleSections = [];
      record.reception = undefined;
      record.sections = [];
      record.external = { imdbId: record.external.imdbId, official: record.external.official, links: record.external.links.slice(0, 6) };
      // wire cast/crew to the person universe (catalogue + expansion waves);
      // plain-text names link via the exact-name fallback
      record.cast = extractCast(page.wikitext).map((member) => {
        const final = member.wikiTitle ? canonical.get(member.wikiTitle) : undefined;
        const slug =
          (final && personSlugByFinal.has(final) ? personSlugByFinal.get(final)! : null) ??
          (member.wikiTitle ? undefined : nameToSlug.get(member.name)) ??
          null;
        return { name: member.name, role: member.role, slug };
      });
      const crewLinks = collectPersonLinks(box, [], CREW_FIELDS);
      record.crew = crewLinks
        .filter((c) => c.as !== 'Cast')
        .map((c) => {
          const final = canonical.get(c.target);
          return { name: c.label || c.target, role: c.as, slug: final && personSlugByFinal.has(final) ? personSlugByFinal.get(final)! : null };
        });
      if (kind === 'movie') { movies.push(record); archiveMovies++; } else { series.push(record); archiveSeries++; }
      seenFinal.add(finalTitle);
      void requested;
    }
    if (accepted.length > 0) {
      console.log(`→ Archive expansion: +${archiveMovies} films, +${archiveSeries} series from ${accepted.length} fetched works`);
    }
  }

  // Episode subpages: series whose article only carries {{Main|List of X
  // episodes}} pointers — follow them (paced, cache-resumable) and parse the
  // full multi-season tables that live there.
  const episodeSubpageWanted = new Map<string, string>(); // series wikiTitle → subpage
  for (const s of series) {
    if (s.episodesList.length > 0) continue;
    const wikitext = titlePages.get(s.wikiTitle)?.wikitext;
    const sub = wikitext ? findEpisodesSubpage(wikitext) : null;
    if (sub) episodeSubpageWanted.set(s.wikiTitle, sub);
  }
  if (episodeSubpageWanted.size > 0) {
    console.log(`→ Following ${episodeSubpageWanted.size} episode-list subpages…`);
    const episodePages = await fetchPages([...new Set(episodeSubpageWanted.values())]);
    let guidesGained = 0;
    for (const s of series) {
      const sub = episodeSubpageWanted.get(s.wikiTitle);
      if (!sub) continue;
      const page = episodePages.get(sub);
      const rows = page?.wikitext ? extractEpisodes(page.wikitext) : [];
      if (rows.length > 0) {
        s.episodesList = rows;
        guidesGained++;
      }
    }
    console.log(`  ${guidesGained} series gained episode guides from subpages`);
  }

  // Soundtrack subpages: == Music == sections that only carry
  // {{Main|X (soundtrack)}} — follow them for the actual track lists.
  const ostSubpageWanted = new Map<string, string>(); // title wikiTitle → album subpage
  for (const t of [...movies, ...series]) {
    if (t.soundtrack && t.soundtrack.tracks.length > 0) continue;
    const wikitext = titlePages.get(t.wikiTitle)?.wikitext;
    const sub = wikitext ? findSoundtrackSubpage(wikitext) : null;
    if (sub) ostSubpageWanted.set(t.wikiTitle, sub);
  }
  if (ostSubpageWanted.size > 0) {
    console.log(`→ Following ${ostSubpageWanted.size} soundtrack subpages…`);
    const ostPages = await fetchPages([...new Set(ostSubpageWanted.values())]);
    let ostsGained = 0;
    for (const t of [...movies, ...series]) {
      const sub = ostSubpageWanted.get(t.wikiTitle);
      if (!sub) continue;
      const st = extractSoundtrack(ostPages.get(sub)?.wikitext ?? '');
      if (st && st.tracks.length > 0) {
        t.soundtrack = st;
        ostsGained++;
      }
    }
    console.log(`  ${ostsGained} titles gained soundtracks from subpages`);
  }

  // Resolve posters/portraits: prop=pageimages skips non-free posters, so fall
  // back to the infobox image param resolved through imageinfo.
  console.log('→ Resolving infobox images…');
  const imageTargets = new Map<string, Array<(url: string) => void>>();
  const addImageTarget = (filename: string | null, apply: (url: string) => void) => {
    if (!filename) return;
    const list = imageTargets.get(filename) ?? [];
    list.push(apply);
    imageTargets.set(filename, list);
  };
  for (const record of [...movies, ...series]) {
    if (record.poster) continue;
    const page = titlePages.get(record.wikiTitle);
    const filename = imageFilenameFromInfobox(parseInfobox(page?.wikitext ?? '')?.image);
    addImageTarget(filename, (url) => { record.poster = url; });
  }
  for (const person of persons) {
    if (person.image) continue;
    const page = finalPersons.get(person.wikiTitle);
    const filename = imageFilenameFromInfobox(parseInfobox(page?.wikitext ?? '')?.image);
    addImageTarget(filename, (url) => { person.image = url; });
  }
  if (imageTargets.size > 0) {
    console.log(`  ${imageTargets.size} unique images to resolve`);
    const thumbs = await resolveImageThumbUrls([...imageTargets.keys()]);
    const canonicalKey = (t: string) => t.replace(/_/g, ' ').trim();
    for (const [filename, setters] of imageTargets) {
      const url = thumbs.get(canonicalKey(filename));
      if (url) for (const apply of setters) apply(url);
    }
  }
  const posterCount = [...movies, ...series].filter((t) => t.poster).length;
  console.log(`  posters on titles: ${posterCount}/${movies.length + series.length}`);

  // Inline links inside plot text → internal pages for people and titles
  const lookup: LinkLookup = new Map();
  for (const record of [...movies, ...series]) {
    lookup.set(record.wikiTitle, { type: record.kind, slug: record.slug });
  }
  for (const [finalTitle, slug] of personSlugByFinal) {
    lookup.set(finalTitle, { type: 'person', slug });
  }
  let plotLinkCount = 0;
  for (const record of [...movies, ...series]) {
    if (record.archive) continue; // archive records keep plain plots — linked HTML doubles record size
    const wikitext = titlePages.get(record.wikiTitle)?.wikitext ?? '';
    const rawPlot = findPlotSection(wikitext);
    if (!rawPlot) continue;
    record.plotHtml = renderLinkedHtml(rawPlot, lookup) || undefined;
    if (record.plotHtml) plotLinkCount += (record.plotHtml.match(/<a /g) ?? []).length;
  }
  console.log(`→ Plot texts carry ${plotLinkCount} internal links to people/title pages`);

  // multi-source enrichment (TMDB). Catalogue pass: full field+episode work.
  // Archive pass: lite (search + one validated details payload each) behind a
  // polite 8 req/s gate — the old 12–38h figure was serial-client latency,
  // not a TMDB limit; every response is disk-cached so re-runs are fast.
  // Set TMDB_ARCHIVE_LITE=0 to skip the archive pass on slow links.
  const catalogueTitles = [...movies, ...series].filter((t) => !t.archive);
  await enrichTitles(catalogueTitles);
  if (process.env.TMDB_ARCHIVE_LITE !== '0') {
    const archiveTitles = [...movies, ...series].filter((t) => t.archive);
    await enrichTitlesLite(archiveTitles);
  }
  await enrichPersons(persons);
  // AI hooks/moods — key-gated; falls back to tagline/first-sentence below
  await enrichWithAi(catalogueTitles);

  // display hook fallback: TMDB tagline → AI one-liner (already set) → first plot sentence
  for (const record of [...movies, ...series]) {
    if (record.tagline) continue;
    const source = record.plot ?? record.summary ?? '';
    const firstSentence = /^[\s\S]*?[.!?](?=\s|$)/.exec(source.trim())?.[0] ?? '';
    if (firstSentence.length >= 40 && firstSentence.length <= 200) record.tagline = firstSentence.trim();
  }

  // transparent "known for" ranking — computed after enrichment so ratings exist
  const titleByWiki = new Map([...movies, ...series].map((t) => [t.wikiTitle, t]));
  for (const person of persons) {
    person.knownFor = computeKnownFor(person, titleByWiki, YEAR);
  }

  // stats — single-tier mandate (2026-08-20): years/languages describe EVERY
  // record on the site, catalogue + archive alike
  const languageMap = new Map<string, { movies: number; series: number }>();
  for (const record of [...movies, ...series]) {
    const lang = record.language || 'Other';
    const entry = languageMap.get(lang) ?? { movies: 0, series: 0 };
    entry[record.kind === 'movie' ? 'movies' : 'series']++;
    languageMap.set(lang, entry);
  }
  const stats: SiteStats = {
    generatedAt: new Date().toISOString(),
    movies: movies.length,
    series: series.length,
    persons: persons.length,
    years: [...new Set([...movies, ...series].map((t) => t.year))].sort((a, b) => b - a),
    languages: [...languageMap.entries()]
      .map(([language, counts]) => ({ language, ...counts }))
      .sort((a, b) => b.movies + b.series - (a.movies + a.series)),
  };

  const searchDocs = buildSearchDocuments(movies, series, persons);

  movies.sort((a, b) => (b.releaseDate ?? '').localeCompare(a.releaseDate ?? ''));
  series.sort((a, b) => (b.releaseDate ?? '').localeCompare(a.releaseDate ?? ''));

  mkdirSync(DATA, { recursive: true });
  const PUBLIC_DIR = path.join(ROOT, 'public');
  mkdirSync(PUBLIC_DIR, { recursive: true });
  writeFileSync(path.join(DATA, 'movies.json'), JSON.stringify(movies));
  writeFileSync(path.join(DATA, 'series.json'), JSON.stringify(series));
  writeFileSync(path.join(DATA, 'persons.json'), JSON.stringify(persons));
  writeFileSync(path.join(DATA, 'search-index.json'), JSON.stringify({ generatedAt: stats.generatedAt, docs: searchDocs }));
  writeFileSync(path.join(PUBLIC_DIR, 'search-index.json'), JSON.stringify({ generatedAt: stats.generatedAt, docs: searchDocs }));
  writeFileSync(path.join(DATA, 'site-stats.json'), JSON.stringify(stats, null, 2));

  console.log(`✓ Dataset complete: ${movies.length} movies, ${series.length} series, ${persons.length} persons`);
  console.log(`  Languages: ${stats.languages.slice(0, 8).map((l) => `${l.language} (${l.movies + l.series})`).join(', ')}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
