/**
 * Stage 3 — parse cached wikitext into the site datasets:
 *   data/movies.json, data/series.json, data/persons.json,
 *   data/search-index.json, data/site-stats.json
 * Persons are discovered from cast/crew links and fetched (cache-aware).
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  extractCast,
  extractEpisodes,
  extractExternalLinks,
  extractReferences,
  extractSections,
  extractSoundtrack,
  getSection,
  listSectionTitles,
  parseInfobox,
  splitListField,
  stripWikitext,
  collectPersonLinks,
  parseStartDate,
} from './wikitext/index.js';
import { renderLinkedHtml, type LinkLookup } from './wikitext/linked-html.js';
import { fetchPages, resolveImageThumbUrls, type CachedPage } from './wiki-api.js';
import { SlugRegistry, buildSearchDocuments, displayTitle, wikiUrlFor } from './dataset-lib.js';
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
  /^(references?|external links?|see also|notes?|citations?|further reading|bibliography|sources?|footnotes?|gallery|trivia|plot|premise|synopsis|cast( and (characters|crew))?|main cast|principal cast|recurring|guest|cameo appearances|voice cast|episodes?|series overview|season \d+|soundtracks?|music|music \(album\)|songs?|soundtrack album|marketing|promotion)$/i;

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
): TitleRecord {
  const wikitext = page.wikitext ?? '';
  const box = parseInfobox(wikitext) ?? {};
  const cast = extractCast(wikitext);
  const external = extractExternalLinks(wikitext);
  const website = box.website ? stripWikitext(box.website) : undefined;
  const official = external.official ?? (website && /^https?:\/\//.test(website) ? website : undefined);

  const plot =
    getSection(wikitext, 'Plot') ??
    getSection(wikitext, 'Premise') ??
    getSection(wikitext, 'Synopsis');
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
    language: cleanValue(box.language) || (kind === 'movie' ? 'Hindi' : 'Hindi'),
    year: YEAR,
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
    references: extractReferences(wikitext),
    cast: [], // filled after person resolution
    crew: [],
    referenceCount: (wikitext.match(/<ref[\s>]/gi) ?? []).length,
    sections: listSectionTitles(wikitext).filter((s) => !BORING_SECTIONS.has(s)),
    external: { imdbId: external.imdbId, official, links: dedupeLinks(external.links).slice(0, 14) },
  };
  void cast;
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

  // person slug lookup: finalTitle → slug
  const personRegistry = new SlugRegistry();
  const personSlugByFinal = new Map<string, string>();
  for (const finalTitle of finalPersons.keys()) {
    const page = finalPersons.get(finalTitle)!;
    personSlugByFinal.set(finalTitle, personRegistry.slug(page.title, page.pageid));
  }

  // wire cast + crew into title records
  for (const record of [...movies, ...series]) {
    const cast = titleCast.get(record.wikiTitle) ?? [];
    record.cast = cast.map((member) => {
      const final = member.wikiTitle ? canonical.get(member.wikiTitle) : undefined;
      const slug = final && personSlugByFinal.has(final) ? personSlugByFinal.get(final)! : null;
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
      sections: listSectionTitles(page.wikitext).filter((s) => !BORING_SECTIONS.has(s)),
    });
  }
  persons.sort((a, b) => a.name.localeCompare(b.name));

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
    const wikitext = titlePages.get(record.wikiTitle)?.wikitext ?? '';
    const rawPlot =
      getSection(wikitext, 'Plot') ?? getSection(wikitext, 'Premise') ?? getSection(wikitext, 'Synopsis');
    if (!rawPlot) continue;
    record.plotHtml = renderLinkedHtml(rawPlot, lookup) || undefined;
    if (record.plotHtml) plotLinkCount += (record.plotHtml.match(/<a /g) ?? []).length;
  }
  console.log(`→ Plot texts carry ${plotLinkCount} internal links to people/title pages`);

  // stats
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
