/**
 * Soundtrack extraction. Supports the common Indian-film styles:
 * 1. {{Track listing}} templates (trackN/singerN/lyricsN/lengthN params,
 *    with all_lyrics/all_music fallbacks)
 * 2. plain track wikitables (Track | Song | Singer(s) | Lyricist | Length)
 * 3. numbered lists in the Soundtrack/Songs section
 *
 * Albums that live on their own article are found via findSoundtrackSubpage
 * ({{Main|X (soundtrack)}} pointers inside a Music/Soundtrack section).
 */
import { stripWikitext } from './clean.js';
import { extractSections } from './sections.js';
import { findTemplates } from './infobox.js';
import { parseWikitableView } from './tables.js';

export interface TrackRow {
  number: string;
  title: string;
  singers?: string;
  lyrics?: string;
  length?: string;
}

export interface SoundtrackAlbum {
  /** album headline — the language/version label on multi-album releases */
  title?: string;
  tracks: TrackRow[];
}

export interface Soundtrack {
  /** album/section headline when present (first album's) */
  title?: string;
  composer?: string;
  /** one entry per {{Track listing}}/table — multi-language releases carry
   *  one album per language; rendering them flat made songs "repeat" */
  albums?: SoundtrackAlbum[];
  tracks: TrackRow[];
}

const SECTION_TITLES = /^(soundtrack|soundtracks|music|songs|music album|soundtrack album)$/i;

function clean(text: string | undefined): string | undefined {
  const stripped = stripWikitext(text ?? '')
    .replace(/\s+/g, ' ')
    .replace(/^["“”']+|["“”']+$/g, '')
    .trim();
  return stripped.length > 0 ? stripped : undefined;
}

export function extractSoundtrack(pageWikitext: string): Soundtrack | null {
  const section = extractSections(pageWikitext).find((s) => SECTION_TITLES.test(s.title.trim()));
  const text = section?.body ?? '';

  // 1) {{Track listing}} templates: in the matched section, falling back to
  // the whole page — album subpages often keep them under a "Track listing"
  // heading while a template-free "Songs" section wins the section match
  let scope = text.length > 0 ? text : pageWikitext;
  let listings = findTemplates(scope, /^track listing$/i);
  if (listings.length === 0 && scope !== pageWikitext) {
    listings = findTemplates(pageWikitext, /^track listing$/i);
    if (listings.length > 0) scope = pageWikitext;
  }

  const albums: SoundtrackAlbum[] = [];
  let title: string | undefined;
  let composer: string | undefined;

  // group the scope into (album-heading, body) chunks: multi-language releases
  // label each {{Track listing}} with an === Kannada === / === Telugu === style
  // SUBHEADING (the headline param is often left empty on those pages)
  const chunks: { heading?: string; body: string }[] = [];
  let activeHeading: string | undefined;
  for (const line of scope.split('\n')) {
    const sub = /^={3,4}\s*(.*?)\s*=+\s*$/.exec(line);
    if (sub) {
      activeHeading = stripWikitext(sub[1]).trim() || undefined;
      continue;
    }
    const top = /^={2}\s*(.*?)\s*={2,}\s*$/.exec(line);
    if (top && !sub) {
      const heading = stripWikitext(top[1]).trim();
      // level-2 sections are album groups too ("Non-album singles") — except
      // the generic containers (the matched Soundtrack/Music/Track listing)
      activeHeading = /^(track listing|soundtrack[s]?|music|songs?|music album|soundtrack album)$/i.test(heading)
        ? undefined
        : heading || undefined;
      continue;
    }
    if (chunks.length === 0 || chunks[chunks.length - 1].heading !== activeHeading) {
      chunks.push({ heading: activeHeading, body: '' });
    }
    chunks[chunks.length - 1].body += line + '\n';
  }
  const scopeChunkOf = (needleScope: string): string => needleScope; // (scope invariant)
  void scopeChunkOf;

  for (const chunk of (chunks.length > 0 ? chunks : [{ heading: undefined, body: scope }])) {
    const chunkListings = findTemplates(chunk.body, /^track listing$/i);
    for (const listing of chunkListings) {
      const params = listing.params;
      const albumTitle = clean(params['headline']) ?? clean(params['title']) ?? chunk.heading;
      title = title ?? albumTitle;
      const allLyrics = clean(params['all_lyrics']);
      const allMusic = clean(params['all_music']);
      if (!composer && allMusic) composer = allMusic;

      const albumTracks: TrackRow[] = [];
      for (let n = 1; n <= 99; n++) {
        const t =
          clean(params[`title${n}`]) ??
          clean(params[`track${n}`]) ??
          clean(params[`song${n}`]) ??
          clean(params[`${n}`]);
        if (!t) continue;
        albumTracks.push({
          number: String(n),
          title: t,
          singers:
            clean(params[`singer${n}`]) ??
            clean(params[`singers${n}`]) ??
            clean(params[`note${n}`]) ??
            clean(params[`vocal${n}`]),
          lyrics: clean(params[`lyrics${n}`]) ?? clean(params[`lyricist${n}`]) ?? allLyrics,
          length: clean(params[`length${n}`]) ?? clean(params[`duration${n}`]),
        });
      }
      if (albumTracks.length > 0) albums.push({ title: albumTitle, tracks: albumTracks });
    }
  }
  const tracks = albums.flatMap((a) => a.tracks);
  if (tracks.length > 0) {
    // composer often named in the section prose ("music is composed by X")
    const lead = clean(section?.body.split('\n').find((l) => /compos/i.test(l)));
    return { title, composer: composer ?? lead, albums, tracks };
  }

  // 2) track wikitables (on the page, or on a soundtrack-album subpage whose
  // body we're handed directly — with the same section→page fallback)
  let tableTracks = parseTrackTables(scope);
  if (tableTracks.length === 0 && scope !== pageWikitext) {
    tableTracks = parseTrackTables(pageWikitext);
  }
  if (tableTracks.length > 0) {
    const lead = clean(section?.body.split('\n').find((l) => /compos/i.test(l)));
    return { title, composer: composer ?? lead, tracks: tableTracks };
  }

  // 3) numbered-list fallback: # "Song" – Sung by A, B
  const listTracks: TrackRow[] = [];
  let n = 0;
  for (const line of (section?.body ?? '').split('\n')) {
    const item = /^#\s*(.+)$/.exec(line.trim());
    if (!item) continue;
    const cleaned = clean(item[1]);
    if (!cleaned) continue;
    n++;
    const split = cleaned.split(/\s+[–—-]\s+/);
    const singers = split.length > 1 ? split.slice(1).join(' – ').replace(/^sung by\s+/i, '') : undefined;
    listTracks.push({
      number: String(n),
      title: split[0].replace(/^["“”']+|["“”']+$/g, '').trim(),
      singers: singers?.length ? singers : undefined,
    });
  }
  if (listTracks.length > 0) return { tracks: listTracks };

  return null;
}

const TRACK_COLUMN: [RegExp, keyof TrackRow][] = [
  [/^(track|no\.?|#|sl\.?\s?no\.?|sno|serial)$/i, 'number'],
  [/song|title|name/i, 'title'],
  [/singer|vocal|artist|perform/i, 'singers'],
  [/lyric/i, 'lyrics'],
  [/length|duration|time/i, 'length'],
];

function trackHeaderToKey(header: string): keyof TrackRow | null {
  for (const [pattern, key] of TRACK_COLUMN) {
    if (pattern.test(header)) return key;
  }
  return null;
}

/** Track rows from plain wikitables (headers like Track|Song|Singer(s)|…). */
function parseTrackTables(text: string): TrackRow[] {
  const rows: TrackRow[] = [];
  for (const table of text.match(/\{\|[\s\S]*?\|\}/g) ?? []) {
    const view = parseWikitableView(table);
    let headerCells: string[] | null = view.header;
    let dataRows = view.rows;
    if (headerCells === null) {
      const headerLine = table.split('\n').find((l) => l.trim().startsWith('!'));
      if (!headerLine) continue;
      headerCells = headerLine
        .replace(/^\s*!+/, '')
        .split(/!!/)
        .map((c) => stripWikitext(c).toLowerCase().trim());
      dataRows = dataRows.slice(1); // the ! row itself landed in the rows
    }
    const keys = headerCells.map((h) => trackHeaderToKey(h));
    if (!keys.includes('title')) continue;

    for (const cells of dataRows) {
      const row: Partial<TrackRow> = {};
      keys.forEach((key, i) => {
        const cell = cells[i];
        if (key === null || cell === undefined || cell.trim() === '') return;
        const value = clean(cell);
        if (value) (row as Record<string, string>)[key] = value;
      });
      if (!row.title || row.title.length < 2) continue;
      if (row.number !== undefined && !/^\d+$/.test(row.number)) {
        // "Track" header but a non-numeric cell — treat as title-ish junk guard
        if (!row.title) continue;
        row.number = undefined;
      }
      row.number = row.number ?? String(rows.length + 1);
      rows.push(row as TrackRow);
    }
  }
  return rows;
}

/** `{{Main|X (soundtrack)}}` inside a Music/Soundtrack/Songs section → the
 *  album subpage title, or null. (The Family Man and 508 other pages.) */
export function findSoundtrackSubpage(pageWikitext: string): string | null {
  for (const section of extractSections(pageWikitext ?? '')) {
    if (!SECTION_TITLES.test(section.title.trim())) continue;
    for (const tpl of findTemplates(section.body, /^(main|main\s*list|main\s*article)$/i)) {
      const target = (tpl.params['1'] ?? '').replace(/<[^>]+>/g, '').trim();
      if (/(soundtrack|album)/i.test(target)) return target;
    }
  }
  return null;
}
