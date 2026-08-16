/**
 * stripWikitext — best-effort conversion of MediaWiki markup to plain text.
 * Never throws; designed to degrade gracefully on arbitrary input.
 */
const VALUE_TEMPLATES: Record<string, string> = {
  inr: '₹',
  usd: 'US$',
  nbsp: ' ',
  ndash: '–',
  snd: '–',
  dash: '–',
  mdash: '—',
  'spaced ndash': ' – ',
  'spaced en dash': ' – ',
  'circa': 'c. ',
  'c.': 'c. ',
  approx: '~',
};

const ENTITIES: Record<string, string> = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&quot;': '"',
  '&#39;': "'",
  '&lt;': '<',
  '&gt;': '>',
  '&hellip;': '…',
  '&mdash;': '—',
  '&ndash;': '–',
  '&rsquo;': '’',
  '&lsquo;': '‘',
  '&middot;': '·',
};

export function stripWikitext(raw: string): string {
  try {
    let text = raw ?? '';

    // HTML comments
    text = text.replace(/<!--[\s\S]*?-->/g, '');

    // <ref>…</ref> and self-closing refs
    text = text.replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, '');
    text = text.replace(/<ref[^>]*\/>/gi, '');

    // File/Image links (removed entirely, including caption pipes)
    text = text.replace(/\[\[(?:File|Image|Media):[^\]]*\]\]/gi, '');

    // Parameterised currency templates keep their value: {{INR|1350.83}} → ₹1350.83
    text = text.replace(/\{\{\s*(INR|USD)\s*\|\s*([^{}|]+?)\s*\}\}/gi, (_m, cur: string, val: string) =>
      `${VALUE_TEMPLATES[cur.toLowerCase()] ?? ''}${val}`,
    );

    // Known scalar-value templates
    text = text.replace(
      /\{\{\s*([A-Za-z .]+?)\s*\}\}/g,
      (m, name: string) => VALUE_TEMPLATES[name.trim().toLowerCase()] ?? '',
    );

    // Display-preserving templates: {{ill|Article|lang|…}} → Article,
    // {{lang|code|Text}} → Text
    text = text.replace(/\{\{\s*ill\s*\|\s*([^|}]+)[^{}]*\}\}/gi, (_m, first: string) => first.trim());
    text = text.replace(/\{\{\s*langx?\s*\|\s*[a-zA-Z-]+\s*\|\s*([^|}]+)[^{}]*\}\}/gi, (_m, shown: string) => shown.trim());

    // Remaining templates removed innermost-first
    for (let i = 0; i < 20 && text.includes('{{'); i++) {
      const next = text.replace(/\{\{[^{}]*\}\}/g, '');
      if (next === text) break;
      text = next;
    }

    // Wikilinks: [[target|label]] → label, [[target]] → target
    text = text.replace(/\[\[([^\[\]|]+)\|([^\[\]]*)\]\]/g, (_m, _target: string, label: string) =>
      label.trim() || _target.trim(),
    );
    text = text.replace(/\[\[([^\[\]|]+)\]\]/g, (_m, target: string) => target.trim());

    // External links: [https://url label] → label
    text = text.replace(/\[(?:https?:)?\/\/[^\s\]]+[ \t]+([^\]]*)\]/g, '$1');
    text = text.replace(/\[(?:https?:)?\/\/[^\s\]]+\]/g, '');

    // Emphasis
    text = text.replace(/'''''([^']+|[^'].*?[^'])'''''/g, '$1');
    text = text.replace(/'''([^']+|[^'].*?[^'])'''/g, '$1');
    text = text.replace(/''([^']+|[^'].*?[^'])''/g, '$1');

    // Line breaks → space; only real HTML tags removed (letter after < or </),
    // so raw comparisons like "gross < 500" survive; entities decoded
    text = text.replace(/<br\s*\/?>/gi, ' ');
    text = text.replace(/<\/?[a-zA-Z][^>]*>/g, '');
    for (const [ent, ch] of Object.entries(ENTITIES)) text = text.split(ent).join(ch);

    // Stray markup leftovers
    text = text.replace(/\{\{|\}\}|\[\[|\]\]/g, '');

    // Heading markers: ==Plot== → Plot (keep the heading text itself).
    // Wrapped lines join into paragraphs; blank lines and headings break them.
    const paragraphs: string[] = [];
    let current: string[] = [];
    const flush = () => {
      if (current.length > 0) {
        paragraphs.push(current.join(' '));
        current = [];
      }
    };
    for (const rawLine of text.split('\n')) {
      const isHeading = /^\s*={2,}\s*.+?\s*={2,}\s*$/.test(rawLine);
      const line = rawLine
        .replace(/^\s*={2,}\s*(.*?)\s*={2,}\s*$/, '$1')
        .replace(/[ \t]+/g, ' ')
        .trim();
      if (isHeading) {
        flush();
        if (line) paragraphs.push(line);
      } else if (!line) {
        flush();
      } else {
        current.push(line);
      }
    }
    flush();

    return paragraphs.join('\n').trim();
  } catch {
    return (raw ?? '').replace(/[\{\}\[\]<>]/g, ' ');
  }
}
