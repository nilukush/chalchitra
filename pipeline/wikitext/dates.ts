/**
 * {{Start date|2026|04|17|df=y}} / {{Film date|2025|12|5|df=y}} → ISO-ish date
 * ("YYYY", "YYYY-MM" or "YYYY-MM-DD"). Null when not a valid date.
 */
export function parseStartDate(value: string | undefined | null): string | null {
  if (!value) return null;
  const match = /\{\{\s*(?:Start date|Film date)\s*\|([^{}]*)\}\}/i.exec(value);
  if (!match) return null;

  const numbers = match[1]
    .split('|')
    .map((p) => p.trim())
    .filter((p) => /^\d{1,4}$/.test(p))
    .map((p) => Number(p));

  if (numbers.length === 0) return null;

  const [year, month, day] = numbers;
  if (year < 1900 || year > 2100) return null;
  if (numbers.length === 1) return String(year);
  if (month < 1 || month > 12) return null;
  if (numbers.length === 2) return `${year}-${String(month).padStart(2, '0')}`;
  if (day < 1 || day > 31) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
