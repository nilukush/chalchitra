import { describe, expect, it } from 'vitest';
import { extractAwards } from './awards.js';

const emraanStyle = `
== Accolades ==
{| class="wikitable"
|-
! Year !! Award !! Category !! Film !! Result
|-
| 2005 || [[Screen Awards|Screen Awards]] || Best Villain || ''[[Murder (2004 film)|Murder]]'' || {{nom}}
|-
| rowspan="2" | 2007 || [[Filmfare Awards]] || Best Performance in a Negative Role || ''[[Gangster (2006 film)|Gangster]]'' || {{Won}}
|-
| [[IIFA Awards]] || Best Supporting Actor || ''[[Once Upon a Time in Mumbaai]]'' || Nominated
|-
| 2010 || [[Stardust Awards]] || Best Actor || ''[[Once Upon a Time in Mumbaai]]'''''{{cite web|url=x}}'''
|}
The actor also received the [[Karnataka State Film Award for Best Actor]] twice.<ref>{{cite web|url=x}}</ref>
`;

const proseOnly = `
== Awards ==
She won the [[Filmfare OTT Award]] and later a [[SIIMA Award]].
`;

describe('extractAwards (structured)', () => {
  it('maps table columns to year, award, category, work, result', () => {
    const rows = extractAwards(emraanStyle);
    const first = rows.find((r) => r.work === 'Murder');
    expect(first).toMatchObject({
      year: '2005',
      award: 'Screen Awards',
      awardWikiTitle: 'Screen Awards',
      category: 'Best Villain',
      result: 'nominated',
    });
  });

  it('reads {{Won}}/{{nom}} templates and plain-text results', () => {
    const rows = extractAwards(emraanStyle);
    expect(rows.find((r) => r.work === 'Gangster')?.result).toBe('won');
    expect(rows.find((r) => r.work === 'Once Upon a Time in Mumbaai' && r.year === '2007')?.result).toBe('nominated');
  });

  it('carries rowspan years forward', () => {
    const rows = extractAwards(emraanStyle);
    expect(rows.find((r) => r.work === 'Once Upon a Time in Mumbaai' && r.category === 'Best Supporting Actor')?.year).toBe('2007');
  });

  it('strips rowspan/colspan/style attributes and citations from cells', () => {
    const rows = extractAwards(emraanStyle);
    for (const row of rows) {
      const joined = JSON.stringify(row);
      expect(joined).not.toMatch(/rowspan|colspan|style=|cite web|\{\{/i);
    }
  });

  it('captures award names from prose as label-only rows', () => {
    const rows = extractAwards(proseOnly);
    const award = rows.find((r) => r.award === 'Filmfare OTT Award');
    expect(award).toMatchObject({ awardWikiTitle: 'Filmfare OTT Award', result: '' });
    expect(rows.some((r) => r.award === 'SIIMA Award')).toBe(true);
  });

  it('returns [] without award sections', () => {
    expect(extractAwards('== Plot ==\ntext')).toEqual([]);
  });
});
