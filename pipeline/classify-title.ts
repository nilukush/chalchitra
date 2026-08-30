/**
 * Classification of a fetched page from a person's filmography: is it a real
 * Indian film/series article we should build a page for, or noise (persons,
 * songs, albums, episodes, disambiguation, non-Indian works)?
 */
import { findTemplates, parseInfobox } from './wikitext/index.js';

export interface ClassifyVerdict {
  kind: 'movie' | 'series';
  unverified?: boolean;
}

export type ClassifyResult = ClassifyVerdict | { reject: string };

const FILM_INFOBOX = /^infobox\s+(film|television film|movie)$/i;
const SERIES_INFOBOX = /^infobox\s+(television|tv series|television series|miniseries|television programme|television program|television show)$/i;

const INDIAN_LANGUAGES =
  /(hindi|urdu|punjabi|bengali|marathi|gujarati|odia|assamese|tamil|telugu|kannada|malayalam|tulu|meitei|konkani|sanskrit|maithili|santali|kashmiri|nepali|sindhi|dogri|bhojpuri|rajasthani|haryanvi|chhattisgarhi|magahi|awadhi|garhwali|kumaoni)/i;

export function classifyTitlePage(wikitext: string): ClassifyResult {
  if (!wikitext?.trim()) return { reject: 'empty' };
  if (findTemplates(wikitext, /disambiguation/i).length > 0) return { reject: 'disambiguation' };

  const infobox = findTemplates(wikitext, /^infobox/i)[0];
  if (!infobox) return { reject: 'no-infobox' };
  if (FILM_INFOBOX.test(infobox.name)) return indianCheck(wikitext, 'movie');
  if (SERIES_INFOBOX.test(infobox.name)) {
    // Indian direct-to-streaming/TV films often carry {{Infobox television}}
    // (Mandela 2021, Pulikkuthi Pandi) — a director + runtime + single release
    // date and NO episode count marks a FILM, not a series.
    const box = parseInfobox(wikitext) ?? {};
    const filmish = Boolean(box.director || box.runtime);
    const episodic = Boolean(box.num_episodes || box.original_run || box.num_seasons);
    return indianCheck(wikitext, filmish && !episodic ? 'movie' : 'series');
  }
  return { reject: `wrong-type:${infobox.name}` };
}

function indianCheck(wikitext: string, kind: 'movie' | 'series'): ClassifyResult {
  const box = parseInfobox(wikitext) ?? {};
  const country = String(box.country ?? '');
  const language = String(box.language ?? '');
  if (/india/i.test(country)) return { kind };
  if (INDIAN_LANGUAGES.test(language) && !/^(united states|uk|united kingdom|france|japan|south korea|china|italy|germany|spain|russia|canada|australia)\b/i.test(country.trim())) {
    return { kind };
  }
  if (!country.trim() && !language.trim()) return { kind, unverified: true };
  return { reject: 'non-indian' };
}
