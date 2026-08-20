export interface WikiSection {
  title: string;
  level: number;
  body: string;
}

/** Split page wikitext into sections by ==…== style headings (lead excluded). */
export function extractSections(text: string): WikiSection[] {
  const sections: WikiSection[] = [];
  const lines = (text ?? '').split('\n');
  let current: WikiSection | null = null;

  for (const line of lines) {
    const heading = /^(={2,6})\s*(.*?)\s*=+\s*$/.exec(line);
    if (heading) {
      if (current) sections.push(current);
      const title = heading[2].replace(/\[edit\]/gi, '').trim();
      current = { title, level: heading[1].length, body: '' };
    } else if (current) {
      current.body += line + '\n';
    }
  }
  if (current) sections.push(current);

  for (const s of sections) s.body = s.body.trim();
  return sections.filter((s) => s.title.length > 0);
}

/** Body of the first section whose title matches (case-insensitive), or null. */
export function getSection(text: string, title: string): string | null {
  const wanted = title.trim().toLowerCase();
  const section = extractSections(text).find((s) => s.title.toLowerCase() === wanted);
  return section ? section.body : null;
}

/** Plot section heading variants seen on real title pages (cache census
 * 2026-08-20): plot 4883 · synopsis 167 · premise 142 · "plot summary" 12 ·
 * story 6 · "plot synopsis" 3. Exact titles only — a loose prefix would
 * swallow non-plot sections like "Plot and cast". Ordered by MOS:FILM
 * preference: Plot first, then Premise, then Synopsis, then variants. */
const PLOT_SECTION_TITLES = [
  /^plots?$/i,
  /^premise$/i,
  /^synops(is|es)$/i,
  /^plot (summary|synopsis)$/i,
  /^story$/i,
];

/** Body of the page's plot/premise/synopsis section under any of its common
 *  heading spellings, or null when the article has none. */
export function findPlotSection(text: string): string | null {
  const sections = extractSections(text);
  for (const pattern of PLOT_SECTION_TITLES) {
    const section = sections.find((s) => pattern.test(s.title.trim()));
    if (section && section.body.trim() !== '') return section.body;
  }
  return null;
}

export function listSectionTitles(text: string): string[] {
  return extractSections(text).map((s) => s.title);
}
