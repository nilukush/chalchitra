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
