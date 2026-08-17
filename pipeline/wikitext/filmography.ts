/**
 * Person filmography/discography: the linked *works* named in those Wikipedia
 * sections. Best-effort and noisy-tolerant — the display layer only hyperlinks
 * works that exist in our own catalogue (exact wikiTitle match), so noise
 * degrades to invisible text.
 *
 * Works usually live in per-medium subsections nested under ==Filmography==
 * (===Film===, ===As actor===, …) or under ==Career==, so extraction walks the
 * heading tree: once a work-ish heading opens, everything until the next
 * heading of the same or higher level belongs to it.
 */
import { extractWikiLinks } from './links.js';

export interface FilmographyWork {
  title: string;
  wikiTitle: string;
}

const WORK_SECTIONS =
  /(filmograph|\bfilm\b|\bfilms\b|\bmovies\b|television|discography|videography|notable works|music videos|web series)/i;

// "As actor", "As an actress", "As playback singer" — role subsections that
// exist only inside a work block; safe to enter from anywhere.
const WORK_SUBSECTION = /^as\s+(an?\s+)?(actor|actress|director|producer|writer|host|singer|artist|dancer|composer|playback)/i;

const NOT_A_WORK =
  /^(list of|index of|awards?|accolades?|nominations?|19\d\d|20\d\d|category|wikipedia|template|the following|filmography|discography|bibliography|references|external links)/i;

// Filmography tables link languages, studios and reviewers in header/prose
// cells; they are context, not works.
const NOT_A_WORK_EXACT =
  /^(the times of india|hindustan times|the indian express|india today|deccan herald|deccan chronicle|the hindu|ndtv|cnn-news18|zee news|bollywood hungama|rediff|dna india|firstpost|the free press journal|mid-day|youtube|netflix|amazon prime video|disney\+ hotstar|jiocinema|sonyliv|mx player|zee5|aha \(streaming service\)|sun nxt|imdb|rotten tomatoes|cinema of india|indian cinema|bollywood|tollywood|kollywood|mollywood|sandalwood|playback singing|playback singer|feature film|short film|soundtrack album|filmfare awards?|filmfare ott awards?|national film awards?|siima awards?|iifa awards?|screen awards?|stardust awards?|zee cine awards?|nandi awards?)$/i;

const INDIAN_LANGUAGE =
  /^(hindi|punjabi|tamil|telugu|kannada|malayalam|bengali|marathi|gujarati|english|urdu|assamese|odia|tulu|meitei)( (language|cinema))?$/i;

const HEADING = /^(={2,6})\s*(.+?)\s*=+\s*$/;

export function extractFilmography(pageWikitext: string, limit = 80): FilmographyWork[] {
  const works: FilmographyWork[] = [];
  const seen = new Set<string>();

  let active = false;
  let activeLevel = 0;
  let buffer: string[] = [];

  const collect = () => {
    if (!active || buffer.length === 0) return;
    for (const link of extractWikiLinks(buffer.join('\n'))) {
      if (
        seen.has(link.target) ||
        NOT_A_WORK.test(link.target) ||
        NOT_A_WORK_EXACT.test(link.target) ||
        INDIAN_LANGUAGE.test(link.target)
      )
        continue;
      seen.add(link.target);
      works.push({ title: link.label || link.target, wikiTitle: link.target });
    }
    buffer = [];
  };

  for (const line of (pageWikitext ?? '').split('\n')) {
    const heading = HEADING.exec(line);
    if (heading) {
      collect();
      const level = heading[1].length;
      const title = heading[2].replace(/\[edit\]/gi, '').trim();
      if (WORK_SECTIONS.test(title) || WORK_SUBSECTION.test(title)) {
        active = true;
        activeLevel = level;
      } else if (level <= activeLevel) {
        active = false;
      }
    } else if (active) {
      buffer.push(line);
    }
  }
  collect();

  return works.slice(0, limit);
}
