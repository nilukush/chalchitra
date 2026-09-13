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

export interface TableViewOptions {
  /** Keep `*`/`#` lines inside cells, merging each into the preceding cell
   *  (award lists embedded in an Award-column cell). OFF by default —
   *  filmography/soundtrack/episode tables never carry bullet cells and
   *  must keep their exact current output. */
  multilineCells?: boolean;
}

/** MediaWiki cell format: `| attr="…" attr2=… | content`. */
const CELL_ATTRS = /^((?:[\w-]+\s*=\s*("[^"]*"|'[^']*'|[^\s|]+)\s*)+\|\s*)+/;

/** Remove leading `!`/`|` markers and any attributes before the content pipe. */
export function cleanCell(raw: string): string {
  return raw.replace(/^\s*[!|]+\s*/, '').replace(CELL_ATTRS, '').trim();
}

/** A parsed cell: cleaned content plus the MediaWiki span attributes it declared. */
interface ParsedCell {
  text: string;
  rowspan: number;
  colspan: number;
}

/** Read rowspan/colspan off a raw cell (`| rowspan="2"|2007`) before cleaning. */
function readSpan(raw: string, attr: 'rowspan' | 'colspan'): number {
  const attrs = CELL_ATTRS.exec(raw.replace(/^\s*[!|]+\s*/, ''))?.[1] ?? '';
  const m = new RegExp(`${attr}\\s*=\\s*"?([\\d]+)"?`, 'i').exec(attrs);
  const n = m ? Number(m[1]) : 0;
  return Number.isFinite(n) && n > 1 ? Math.min(n, 100) : 1;
}

/** Merge bullet/numbered lines into the preceding CELL line (multilineCells).
 *  Runs before the cell-line filter, which would otherwise drop them. */
function mergeContinuationLines(lines: string[]): string[] {
  const out = [...lines];
  for (let i = 0; i < out.length; i += 1) {
    if (!/^\s*[*#]/.test(out[i])) continue;
    let anchor = -1;
    for (let j = i - 1; j >= 0; j -= 1) {
      if (/^\s*[!|]/.test(out[j]) && !/^\s*\|\}/.test(out[j]) && !/^\s*\|\+/.test(out[j])) {
        anchor = j;
        break;
      }
    }
    if (anchor >= 0) {
      out[anchor] += '\n' + out[i];
      out[i] = '';
    }
  }
  return out;
}

/** One wikitext table (`{| … |}`) → optional header row + data rows.
 *
 * Rows are returned as a rowspan/colspan-EXPANDED grid: a cell declaring
 * `rowspan="3"` is copied into that column for the next 2 rows (and colspan
 * repeats into sibling columns), so every row is positionally aligned with
 * the header and consumers can map by column index instead of guessing.
 * Empty cells are preserved positionally. */
export function parseWikitableView(table: string, opts: TableViewOptions = {}): WikitableView {
  const chunks = table.split(/^\|-.*$/m);
  const rowsRaw: string[][] = [];
  let header: string[] | null = null;
  // column index → cell still spanning down into later rows
  const active = new Map<number, { text: string; remaining: number }>();

  for (const chunk of chunks) {
    const rawLines = chunk
      .split('\n')
      .map((l) => l.trimEnd());
    const lines = (opts.multilineCells ? mergeContinuationLines(rawLines) : rawLines).filter(
      // `|+ …` is the table CAPTION, not a data row; `{|`/`|}` are delimiters
      (l) => /^\s*[!|]/.test(l) && !/^\s*\|\}/.test(l) && !/^\s*\|\+/.test(l) && l.trim() !== '',
    );
    if (lines.length === 0) continue;
    const cells: ParsedCell[] = [];
    for (const line of lines) {
      const isHeaderRow = /^\s*!/.test(line);
      const marker = isHeaderRow ? '!!' : '||';
      // drop the first marker, split the rest
      const stripped = line.replace(/^\s*[!|]/, '');
      for (const piece of stripped.split(marker)) {
        cells.push({
          text: cleanCell('|' + piece),
          rowspan: isHeaderRow ? 1 : readSpan('|' + piece, 'rowspan'),
          colspan: isHeaderRow ? 1 : readSpan('|' + piece, 'colspan'),
        });
      }
    }
    if (cells.every((c) => c.text === '')) continue;

    const cleaned = cells.map((c) => c.text);
    if (header === null && cleaned.length >= 2 && cleaned.some((c) => /^(year|title|award|film|work|show|serial|name)\b/i.test(cleanHeader(c)))) {
      header = cleaned.map(cleanHeader);
    } else {
      // expand spans: walk columns left→right, consuming active rowspans and
      // placing new cells into the next free columns (MediaWiki semantics)
      const row: string[] = [];
      let col = 0;
      let idx = 0;
      while (idx < cells.length || active.has(col)) {
        const span = active.get(col);
        if (span !== undefined) {
          row[col] = span.text;
          span.remaining -= 1;
          if (span.remaining <= 0) active.delete(col);
          col += 1;
          continue;
        }
        if (idx >= cells.length) break;
        const cell = cells[idx];
        idx += 1;
        for (let s = 0; s < cell.colspan; s++) {
          row[col] = cell.text;
          if (s === 0 && cell.rowspan > 1) active.set(col, { text: cell.text, remaining: cell.rowspan - 1 });
          col += 1;
        }
      }
      rowsRaw.push(row);
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
