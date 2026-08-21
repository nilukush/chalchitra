/**
 * Classification of a fetched page linked from a title's cast/crew: is it a
 * real person article we should build a page for, or noise (films, songs,
 * episodes, disambiguation, unrelated articles)?
 */
import { findTemplates } from './wikitext/index.js';

export type PersonClassifyResult = { ok: true } | { reject: string };

const PERSON_INFOBOX =
  /^infobox\s+(person|actor|actress|biography|musical artist|singer|director|producer|writer|screenwriter|playwright|composer|lyricist|model|television presenter|presenter|cricketer|politician|footballer|sports personality|athlete)$/i;

/** Indian-cinema occupation categories — the fallback marker for stubs that
 *  carry no infobox at all. */
const PERSON_CATEGORY =
  /\[\[Category:[^\]]*(?:actor|actress|film director|film producer|screenwriter|lyricist|playback singer|film score composer|cinematographer|film editor|choreographer|television presenter)[^\]]*\]\]/i;

export function classifyPersonPage(wikitext: string): PersonClassifyResult {
  if (!wikitext?.trim()) return { reject: 'empty' };
  if (findTemplates(wikitext, /disambiguation/i).length > 0) return { reject: 'disambiguation' };

  const infobox = findTemplates(wikitext, /^infobox/i)[0];
  if (infobox) {
    if (PERSON_INFOBOX.test(infobox.name)) return { ok: true };
    return { reject: `wrong-type:${infobox.name}` };
  }
  if (PERSON_CATEGORY.test(wikitext)) return { ok: true };
  return { reject: 'no-person-markers' };
}
