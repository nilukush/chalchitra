/** "214 minutes" → "3h 34m"; ranges and garbage pass through sensibly. */
export function formatRuntime(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const range = /(\d{1,3})\s*[–—-]\s*(\d{1,3})/.exec(raw);
  if (range) {
    const [a, b] = [Number(range[1]), Number(range[2])];
    if (a >= 60) return `${Math.floor(a / 60)}h ${a % 60}m – ${Math.floor(b / 60)}h ${b % 60}m`;
    return `${a}–${b} min`;
  }
  const m = /(\d{1,3})/.exec(raw);
  if (!m) return raw;
  const mins = Number(m[1]);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const rest = mins % 60;
  return rest ? `${h}h ${rest}m` : `${h}h`;
}

/** Sentence boundary: terminator + whitespace + opener. The lookbehinds keep
 *  initialisms like "A.R. Rahman" (capital letter + period) from splitting. */
const SENTENCE_BOUNDARY = /(?<=[.!?])(?<![A-Z]\.)\s+(?=[A-Z"'“(\[])/;

/** Split a wall-of-text paragraph into readable chunks of ≤ `maxSentences`.
 *  Readability research consensus: 3–5 sentences per paragraph. */
export function splitLongParagraphs(paragraph: string, maxSentences = 3): string[] {
  if (!paragraph.trim()) return [];
  const sentences = paragraph.split(SENTENCE_BOUNDARY);
  if (sentences.length <= maxSentences) return [paragraph];
  const chunks: string[] = [];
  for (let i = 0; i < sentences.length; i += maxSentences) {
    chunks.push(sentences.slice(i, i + maxSentences).join(' '));
  }
  return chunks;
}

/** Pull the opening sentence out of a paragraph so chapters can set a bold lead
 *  (inverted-pyramid style) without hard-coding markdown in data. */
export function splitLeadSentence(paragraph: string): { lead: string; rest: string } {
  const trimmed = paragraph.trim();
  if (!trimmed) return { lead: '', rest: '' };
  const m = SENTENCE_BOUNDARY.exec(trimmed);
  if (!m || m.index === undefined) return { lead: trimmed, rest: '' };
  return { lead: trimmed.slice(0, m.index), rest: trimmed.slice(m.index + m[0].length).trim() };
}
