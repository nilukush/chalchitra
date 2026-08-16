/** Pure helpers for AI (LLM) enrichment parsing & prompt building. */

export interface AiSummary {
  oneLiner: string;
  moods: string[];
}

/** Tolerant parser: accepts raw or fenced JSON; returns null when unusable. */
export function parseAiSummary(raw: string): AiSummary | null {
  if (!raw) return null;
  const fenced = /\{[\s\S]*\}/.exec(raw);
  if (!fenced) return null;
  try {
    const json = JSON.parse(fenced[0]);
    const oneLiner = typeof json.oneLiner === 'string' ? json.oneLiner.trim() : '';
    if (!oneLiner) return null;
    const moods = Array.isArray(json.moods)
      ? json.moods.filter((m: unknown) => typeof m === 'string' && m.trim().length > 0).slice(0, 4)
      : [];
    return { oneLiner: oneLiner.slice(0, 200), moods };
  } catch {
    return null;
  }
}

export function buildSummaryPrompt(title: string, kind: string, plot: string | undefined, reception: string | undefined): string {
  return [
    `You are writing display copy for a film database page about the ${kind} "${title}".`,
    'Reply with ONLY a JSON object: {"oneLiner": string, "moods": string[3]}',
    '- oneLiner: one vivid sentence (max 25 words) capturing the story hook. No quotes inside.',
    '- moods: exactly 3 short genre-mood tags, Title Case (e.g. "Crime", "Slow-burn", "Feel-good").',
    plot ? `\nPlot:\n${plot.slice(0, 1500)}` : '',
    reception ? `\nReception:\n${reception.slice(0, 600)}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}
