import type { CastEntry } from './cast.js';
import { extractWikiLinks } from './links.js';

/** Non-person targets that frequently appear in film/TV crew infobox fields. */
const NON_PERSONS = new Set([
  // languages
  'hindi', 'tamil', 'telugu', 'kannada', 'malayalam', 'marathi', 'bengali', 'punjabi',
  'gujarati', 'odia', 'oriya', 'assamese', 'english', 'urdu', 'bhojpuri', 'tulu',
  'sanskrit', 'maithili', 'rajasthani', 'haryanvi', 'konkani', 'nepali', 'tamil language',
  'telugu language', 'kannada language', 'malayalam language', 'marathi language',
  'hindi language',
  // countries / regions
  'india', 'pakistan', 'south korea',
  // streamers / networks / channels
  'netflix', 'amazon prime video', 'prime video', 'disney+', 'disney+ hotstar', 'hotstar',
  'jiohotstar', 'sonyliv', 'sony liv', 'zee5', 'zee telugu', 'mx player', 'altbalaji',
  'aha (streaming service)', 'aha', 'aha video', 'manoramamax', 'stage (streaming service)',
  'sun nxt', 'colors (tv channel)', 'starplus', 'star plus', 'zee tv', 'sony entertainment television',
  'sony sab', 'sab tv', 'sun tv', 'star maa', 'etv telugu', 'colors marathi', 'zee marathi',
  'star jalsha', 'colors kannada', 'star vijay', 'vijay tv', 'asianet', 'sun tv (india)',
  'jawan (streaming service)',
  // studios / labels (common false positives)
  'yash raj films', 't-series', 'red chillies entertainment', 'dharma productions',
  'viacom18 studios', 'jio studios', 'roy kapur films', 'eros international', 'zeal entertainment',
  'indian rupee', '₹',
]);

const NAMESPACE_RE =
  /^(file|image|media|category|wikipedia|wp|template|portal|help|special|draft|module|user|wikt|wiktionary|commons|list of|index of|table of|timeline of|glossary of|outline of)/i;

/** Heuristic filter: does this wikilink target look like a person article? */
export function isPersonLikeTitle(title: string): boolean {
  const t = (title ?? '').trim().replace(/_/g, ' ');
  if (!t) return false;
  if (NAMESPACE_RE.test(t)) return false;
  if (/^\d/.test(t)) return false; // "2026 in …", "108 …"
  if (/:(?!\s)/.test(t)) return false; // any namespace-ish colon
  if (NON_PERSONS.has(t.toLowerCase())) return false;
  return true;
}

const ROLE_LABELS: Record<string, string> = {
  director: 'Director',
  creator: 'Creator',
  producer: 'Producer',
  writer: 'Writer',
  screenwriter: 'Writer',
  story: 'Writer',
  starring: 'Cast',
  cast: 'Cast',
  music: 'Music',
  composer: 'Composer',
  theme_music_composer: 'Music',
  cinematography: 'Cinematographer',
  editor: 'Editor',
  choreographer: 'Choreographer',
  lyricist: 'Lyricist',
  singer: 'Singer',
  production_designer: 'Production designer',
  art_director: 'Art director',
  costume_designer: 'Costume designer',
  makeup_artist: 'Makeup artist',
  stunt_coordinator: 'Stunt coordinator',
  action_director: 'Action director',
  dialogue: 'Writer',
  screenplay: 'Writer',
  based_on: 'Based on',
  narrator: 'Narrator',
  presenter: 'Presenter',
};

function roleLabelForField(field: string): string {
  const key = field.trim().toLowerCase();
  if (ROLE_LABELS[key]) return ROLE_LABELS[key];
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export interface PersonLink {
  target: string;
  label: string;
  as: string;
}

/** Union of person links from selected infobox fields and the parsed cast list. */
export function collectPersonLinks(
  infobox: Record<string, string>,
  cast: CastEntry[],
  fields: string[],
): PersonLink[] {
  const seen = new Set<string>();
  const people: PersonLink[] = [];

  for (const field of fields) {
    const value = infobox[field];
    if (!value) continue;
    for (const link of extractWikiLinks(value)) {
      if (!isPersonLikeTitle(link.target) || seen.has(link.target)) continue;
      seen.add(link.target);
      people.push({ target: link.target, label: link.label, as: roleLabelForField(field) });
    }
  }

  for (const entry of cast) {
    if (!entry.wikiTitle || !isPersonLikeTitle(entry.wikiTitle) || seen.has(entry.wikiTitle)) continue;
    seen.add(entry.wikiTitle);
    people.push({ target: entry.wikiTitle, label: entry.name, as: 'Cast' });
  }

  return people;
}
