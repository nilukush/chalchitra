import { describe, expect, it } from 'vitest';
import { extractDiscography, findDiscographySubpage } from './filmography.js';

// Verbatim shape of Tanishk Bagchi's == Discography == tables: Year and Film
// carry rowspans, Track(s) is the song, Singer(s)/Writer(s) the credits.
const tanishkPage = `
== Discography ==

=== Hindi film songs ===
{| class="wikitable sortable"
! Year
! Film
! Track(s)
! Singer(s)
! Writer(s)
! Notes
|-
| rowspan="3"|2016
| ''[[Kapoor & Sons]]''
| "[[Bolna (song)|Bolna]]"
| [[Arijit Singh]], [[Asees Kaur]]
| Dr. Devendra Kafir
|
|-
| rowspan="2"|''[[Sarbjit (film)|Sarbjit]]''
| "Rabba"
| [[Shafqat Amanat Ali]]
| Arafat Mehmood
|
|-
| "Allah Hu Allah"
| [[Shashaa Tirupati]], Altamash Faridi
| Haider Najmi
|
|}
`;

const albumOnlyPage = `
== Discography ==
=== Albums ===
{| class="wikitable"
! Year !! Title !! Label
|-
| 2018 || ''[[Raincoat (album)|Raincoat]]'' || T-Series
|}
`;

describe('extractDiscography', () => {
  it('maps Year|Film|Track(s)|Singer(s)|Writer(s) tables to song rows', () => {
    const sections = extractDiscography(tanishkPage);
    expect(sections).toHaveLength(1);
    expect(sections[0].heading).toBe('Hindi film songs');
    const rows = sections[0].rows;
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({
      year: '2016',
      song: 'Bolna',
      songWikiTitle: 'Bolna (song)',
      film: 'Kapoor & Sons',
      filmWikiTitle: 'Kapoor & Sons',
      singers: 'Arijit Singh, Asees Kaur',
    });
  });

  it('carries the rowspan film down continuation rows (Allah Hu Allah → Sarbjit)', () => {
    const rows = extractDiscography(tanishkPage)[0].rows;
    expect(rows[2]).toMatchObject({ year: '2016', song: 'Allah Hu Allah', film: 'Sarbjit', filmWikiTitle: 'Sarbjit (film)' });
  });

  it('parses album tables without a film column (song/album only)', () => {
    const sections = extractDiscography(albumOnlyPage);
    expect(sections[0].rows[0]).toMatchObject({ year: '2018', song: 'Raincoat' });
    expect(sections[0].rows[0].film).toBeUndefined();
  });

  it('returns [] for pages without song tables', () => {
    expect(extractDiscography('== Filmography ==\nprose')).toEqual([]);
  });
});

describe('findDiscographySubpage', () => {
  it('detects {{Main|X discography}} pointers', () => {
    expect(findDiscographySubpage('== Discography ==\n{{Main|Tanishk Bagchi discography}}')).toBe('Tanishk Bagchi discography');
  });

  it('ignores filmography and episode pointers', () => {
    expect(findDiscographySubpage('{{Main|Emraan Hashmi filmography}}')).toBeNull();
    expect(findDiscographySubpage('{{Main|List of Aahat episodes}}')).toBeNull();
  });
});
