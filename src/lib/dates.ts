/** Age math for person sidebars, derived from infobox-style date strings. */

const MONTHS: Record<string, number> = {
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
};

/** "5 March 1990" (or "5 March 1990 (age 36)") → UTC Date | null */
export function parseFactDate(value: string): Date | null {
  const m = /(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/.exec(value);
  if (!m) return null;
  const month = MONTHS[m[2].toLowerCase()];
  if (month === undefined) return null;
  return new Date(Date.UTC(Number(m[3]), month, Number(m[1])));
}

export function computeAgeFromFacts(
  facts: { label: string; value: string }[],
  now: Date = new Date(),
): number | null {
  const born = parseFactDate(facts.find((f) => f.label === 'Born')?.value ?? '');
  if (!born) return null;
  const died = parseFactDate(facts.find((f) => f.label === 'Died')?.value ?? '');
  const end = died ?? now;
  let age = end.getUTCFullYear() - born.getUTCFullYear();
  const beforeBirthday =
    end.getUTCMonth() < born.getUTCMonth() ||
    (end.getUTCMonth() === born.getUTCMonth() && end.getUTCDate() < born.getUTCDate());
  if (beforeBirthday) age--;
  return age >= 0 && age < 130 ? age : null;
}

/** Distinct dates mentioned in prose ("5 March 1990", "April 2023"), in order. */
export function extractTimelineDates(text: string, limit = 6): string[] {
  const pattern = /\b(?:(\d{1,2})\s+)?(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})\b/gi;
  const found: string[] = [];
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(text)) !== null) {
    const date = `${m[1] ? m[1] + ' ' : ''}${m[2]} ${m[3]}`;
    const key = date.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      found.push(date);
    }
    if (found.length >= limit) break;
  }
  return found;
}
