import { describe, expect, it } from 'vitest';
import { extractAwards } from './awards.js';

const page = `
== Accolades ==
{| class="wikitable"
! Year !! Work !! Award !! Category !! Result
|-
| 2025 || ''[[Toxic]]'' || [[Filmfare Awards South|Filmfare Awards South]] || Best Actor || '''Won'''
|-
| 2023 || Salaar || SIIMA Awards || Best Actor – Telugu || Nominated
|}
The actor also received the [[Karnataka State Film Award for Best Actor]] twice.<ref>{{cite web|url=x}}</ref>

== Other ==
{| class="wikitable"
|-
| Not an award table
|}
`;

const rowspanPage = `
== Accolades ==
{| class="wikitable"
|-
! rowspan="2" | Year !! Award !! Result
|-
| rowspan="3" style="text-align:center;" | 2024 || [[Filmfare Awards South|Filmfare Award]] || Won
|-
| '''Nominated''' || Referrer
|-
| colspan="2" | 2023 || Won
|}
`;

describe('extractAwards', () => {
  it('parses award table rows into cleaned strings', () => {
    const awards = extractAwards(page);
    expect(awards.length).toBeGreaterThanOrEqual(2);
    expect(awards[0]).toContain('2025');
    expect(awards[0]).toContain('Toxic');
    expect(awards[0]).toContain('Won');
    expect(awards[1]).toContain('Nominated');
  });

  it('strips rowspan/colspan/style attributes from cells', () => {
    const awards = extractAwards(rowspanPage);
    expect(awards.length).toBeGreaterThanOrEqual(3);
    for (const row of awards) {
      expect(row).not.toMatch(/rowspan|colspan|text-align|style=|scope=/i);
    }
    expect(awards[0]).toContain('2024');
    expect(awards[0]).toContain('Filmfare Award');
    expect(awards[0]).toContain('Won');
  });

  it('captures award mentions in prose after the tables', () => {
    const awards = extractAwards(page);
    expect(awards.some((a) => a.includes('Karnataka State Film Award'))).toBe(true);
  });

  it('ignores tables outside award sections', () => {
    const awards = extractAwards(page);
    expect(awards.some((a) => a.includes('Not an award table'))).toBe(false);
  });

  it('returns [] without award sections', () => {
    expect(extractAwards('== Plot ==\ntext')).toEqual([]);
  });
});
