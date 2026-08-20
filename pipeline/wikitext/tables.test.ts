import { describe, expect, it } from 'vitest';
import { parseWikitableView } from './tables.js';

describe('parseWikitableView', () => {
  it('drops MediaWiki table captions (|+ …) — they are not data rows', () => {
    const table = `{| class="wikitable sortable"
|+ List of Emraan Hashmi television credits
|-
! scope="col" | Year
! scope="col" | Title
! scope="col" | Role
|-
| 2019 || [[Bard of Blood]] || Kabir Anand
|}`;
    const view = parseWikitableView(table);
    expect(view.header).toEqual(['year', 'title', 'role']);
    expect(view.rows).toEqual([['2019', '[[Bard of Blood]]', 'Kabir Anand']]);
  });

  it('does not leak the caption even in headerless tables', () => {
    const table = `{| class="wikitable"
|+ Films produced under ABC Productions
|-
| 2020 || [[Some Film]]
|}`;
    const view = parseWikitableView(table);
    expect(view.rows).toEqual([['2020', '[[Some Film]]']]);
    expect(JSON.stringify(view)).not.toContain('+ Films produced');
  });
});

describe('rowspan/colspan grid expansion', () => {
  // Verbatim shape of Emraan Hashmi's Accolades table: Year AND Film carry
  // the rowspan while the award is restated on every continuation row, one
  // cell per line (no || chaining).
  it('carries rowspan cells into continuation rows at their column position', () => {
    const table = `{| class="wikitable"
|-
! Year
! Film
! Award
! Category
! Result
! Ref.
|-
| rowspan="2"|2007
| rowspan="2"|''[[Gangster (2006 film)|Gangster]]''
| [[Filmfare Awards]]
| [[Filmfare Award for Best Performance in a Negative Role|Best Performance in a Negative Role]]
| {{nom}}
| <ref>{{cite web|url=x}}</ref>
|-
| [[International Indian Film Academy Awards|IIFA Awards]]
| [[IIFA Award for Best Performance in a Negative Role|Best Performance in a Negative Role]]
| {{nom}}
| <ref>{{cite web|url=x}}</ref>
|}`;
    const view = parseWikitableView(table);
    expect(view.header).toEqual(['year', 'film', 'award', 'category', 'result', 'ref.']);
    expect(view.rows).toHaveLength(2);
    expect(view.rows[0]).toEqual([
      '2007',
      "''[[Gangster (2006 film)|Gangster]]''",
      '[[Filmfare Awards]]',
      '[[Filmfare Award for Best Performance in a Negative Role|Best Performance in a Negative Role]]',
      '{{nom}}',
      '<ref>{{cite web|url=x}}</ref>',
    ]);
    expect(view.rows[1]).toEqual([
      '2007',
      "''[[Gangster (2006 film)|Gangster]]''",
      '[[International Indian Film Academy Awards|IIFA Awards]]',
      '[[IIFA Award for Best Performance in a Negative Role|Best Performance in a Negative Role]]',
      '{{nom}}',
      '<ref>{{cite web|url=x}}</ref>',
    ]);
  });

  it('expands colspan cells into repeated column values', () => {
    const table = `{| class="wikitable"
|-
! Year !! Title !! Role !! Notes
|-
| 2020 || colspan="2"|TBA || debut
|}`;
    const view = parseWikitableView(table);
    expect(view.rows[0]).toEqual(['2020', 'TBA', 'TBA', 'debut']);
  });

  it('preserves empty cells positionally so columns stay aligned', () => {
    const table = `{| class="wikitable"
|-
! Year !! Film !! Award !! Result
|-
| 2011 || || Screen Awards || {{nom}}
|}`;
    const view = parseWikitableView(table);
    expect(view.rows[0]).toEqual(['2011', '', 'Screen Awards', '{{nom}}']);
  });
});
