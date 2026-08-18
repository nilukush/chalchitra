/**
 * Minimal wikitable reader shared by the filmography and awards extractors.
 * Handles the noisy real-world shapes seen in person articles: attribute-laden
 * cells (`| rowspan="3" style="…" | 2024`), `||`-chained inline cells, `!!`
 * header chains, and headerless tables (caller falls back positionally).
 */

export interface WikitableView {
  header: string[] | null;
  rows: string[][];
}

/** MediaWiki cell format: `| attr="…" attr2=… | content`. */
const CELL_ATTRS = /^((?:[\w-]+\s*=\s*("[^"]*"|'[^']*'|[^\s|]+)\s*)+\|\s*)+/;

/** Remove leading `!`/`|` markers and any attributes before the content pipe. */
export function cleanCell(raw: string): string {
  return raw.replace(/^\s*[!|]+\s*/, '').replace(CELL_ATTRS, '').trim();
}

/** One wikitext table (`{| … |}`) → optional header row + data rows. */
export function parseWikitableView(table: string): WikitableView {
  const chunks = table.split(/^\|-.*$/m);
  const rowsRaw: string[][] = [];
  let header: string[] | null = null;

  for (const chunk of chunks) {
    const lines = chunk
      .split('\n')
      .map((l) => l.trimEnd())
      .filter((l) => /^\s*[!|]/.test(l) && !/^\s*\|\}/.test(l) && l.trim() !== '');
    if (lines.length === 0) continue;
    const cells: string[] = [];
    for (const line of lines) {
      const isHeaderRow = /^\s*!/.test(line);
      const marker = isHeaderRow ? '!!' : '||';
      // drop the first marker, split the rest
      const stripped = line.replace(/^\s*[!|]/, '');
      for (const piece of stripped.split(marker)) {
        const text = cleanCell('|' + piece);
        if (text !== '' || cells.length > 0) cells.push(text);
      }
    }
    if (cells.every((c) => c === '')) continue;
    if (header === null && cells.length >= 2 && cells.some((c) => /^(year|title|award|film|work|show|serial|name)\b/i.test(cleanHeader(c)))) {
      header = cells.map(cleanHeader);
    } else {
      rowsRaw.push(cells);
    }
  }

  return { header, rows: rowsRaw };
}

/** Normalise a header cell for mapping: drop templates/tooltips, plural s, punctuation. */
function cleanHeader(cell: string): string {
  const s = cell
    .replace(/\{\{[^}]*\}\}/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/["'()]/g, '')
    .trim()
    .toLowerCase();
  return s.endsWith('s') && s.length > 4 ? s.slice(0, -1) : s;
}
