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

// Real shapes from Emraan Hashmi's Accolades table (2026-08 session): the
// Award column itself is rowspan'd, and continuation rows carry only a
// category link + result — sometimes wikilinked to the award-CATEGORY
// article ("… Award for …"), which used to be promoted to the ceremony name.
const rowspanAwardPage = `
== Accolades ==
{| class="wikitable"
! Year !! Film !! Award !! Category !! Result
|-
| 2011 || ''[[Murder 2]]'' || rowspan="2" | IIFA Awards || [[IIFA Award for Best Performance in a Negative Role|Best Performance in a Negative Role]] || {{nom}}
|-
| [[IIFA Award for Best Supporting Actor|Best Supporting Actor]] || {{nom}}
|-
| 2011 || ''[[Murder 2]]'' || rowspan="2" | [[Producers Guild Film Awards]] || [[Apsara Award for Best Actor in a Supporting Role|Best Actor in a Supporting Role]] || {{nom}}
|-
| [[Apsara Award for Best Actor in a Negative Role|Best Actor in a Negative Role]] || {{nom}}
|}
`;

describe('extractAwards (rowspan award column)', () => {
  it('carries the ceremony name down rowspan continuation rows', () => {
    const rows = extractAwards(rowspanAwardPage);
    const supporting = rows.find((r) => r.category === 'Best Supporting Actor');
    expect(supporting).toMatchObject({ year: '2011', award: 'IIFA Awards', result: 'nominated' });
    const negative = rows.find((r) => r.category === 'Best Actor in a Negative Role');
    expect(negative).toMatchObject({ year: '2011', award: 'Producers Guild Film Awards', result: 'nominated' });
  });

  it('never promotes a wikilinked award-category article (… Award for …) to the ceremony field', () => {
    const rows = extractAwards(rowspanAwardPage);
    expect(rows.some((r) => /Best (Supporting|Negative) Actor/i.test(r.award))).toBe(false);
    expect(rows.every((r) => r.awardWikiTitle !== 'Apsara Award for Best Actor in a Negative Role')).toBe(true);
  });

  it('never fabricates an "—" ceremony; continuation work rows carry the rowspan film', () => {
    const rows = extractAwards(rowspanAwardPage);
    expect(rows.some((r) => r.award === '—' || r.award === '')).toBe(false);
    const supporting = rows.find((r) => r.category === 'Best Supporting Actor');
    expect(supporting?.work).toBe('Murder 2');
  });
});
