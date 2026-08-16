/**
 * Soundtrack extraction. Supports the common Indian-film styles:
 * 1. {{Track listing}} templates (trackN/singerN/lyricsN/lengthN params,
 *    with all_lyrics/all_music fallbacks)
 * 2. plain numbered lists in the Soundtrack/Songs section
 */
import { stripWikitext } from './clean.js';
import { extractSections } from './sections.js';
import { findTemplates } from './infobox.js';

export interface TrackRow {
  number: string;
  title: string;
  singers?: string;
  lyrics?: string;
  length?: string;
}

export interface Soundtrack {
  /** album/section headline when present */
  title?: string;
  composer?: string;
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

  // 1) {{Track listing}} templates anywhere in the section (or page, as fallback)
  const scope = text.length > 0 ? text : pageWikitext;
  const listings = findTemplates(scope, /^track listing$/i);

  const tracks: TrackRow[] = [];
  let title: string | undefined;
  let composer: string | undefined;

  for (const listing of listings) {
    const params = listing.params;
    title = title ?? clean(params['headline']) ?? clean(params['title']);
    const allLyrics = clean(params['all_lyrics']);
    const allMusic = clean(params['all_music']);
    if (!composer && allMusic) composer = allMusic;

    for (let n = 1; n <= 99; n++) {
      const t =
        clean(params[`title${n}`]) ??
        clean(params[`track${n}`]) ??
        clean(params[`song${n}`]) ??
        clean(params[`${n}`]);
      if (!t) continue;
      tracks.push({
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
  }
  if (tracks.length > 0) {
    // composer often named in the section prose ("music is composed by X")
    const lead = clean(section?.body.split('\n').find((l) => /compos/i.test(l)));
    return { title, composer: composer ?? lead, tracks };
  }

  // 2) numbered-list fallback: # "Song" – Sung by A, B
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
