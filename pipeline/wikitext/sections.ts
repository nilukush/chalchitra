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

export function listSectionTitles(text: string): string[] {
  return extractSections(text).map((s) => s.title);
}
