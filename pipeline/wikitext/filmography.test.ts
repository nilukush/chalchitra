import { describe, expect, it } from 'vitest';
import { extractFilmography } from './filmography.js';

const page = `
== Early life ==
He was born in [[Mumbai]].

== Filmography ==
{| class="wikitable"
|-
! Year !! Title !! Role
|-
| 2023 || ''[[K.G.F: Chapter 2|KGF: Chapter 2]]'' || Rocky
|-
| 2024 || [[Salaar]] || Deva
|}

== Television ==
* [[Matka King]] (2026)
* Some uncredited show

== Discography ==
# [[Song One (soundtrack)|Song One]]

== Awards ==
{{awards table}}
`;

// Wikipedia actor pages commonly nest per-medium tables under ==Filmography==
const nestedPage = `
== Career ==
=== As actor ===
{| class="wikitable"
| 2023 || [[83rd Filmfare Awards|Filmfare]] rowspan thing
|}

== Filmography ==
Wamiqa Gabbi at a promotional event.
=== Film ===
{| class="wikitable"
|-
! Year !! Title
|-
| 2017 || [[Three Bhayanak Nights]]
|-
| 2021 || [[Cinemailer: Film 2]]
|}

=== As actress ===
* [[Jubilee (TV series)|Jubilee]]
* [[Modern Love Chennai]]

=== Television ===
* [[Inside Edge (TV series)|Inside Edge]]

== Accolades ==
She won the [[Filmfare OTT Award]].
`;

describe('extractFilmography', () => {
  it('collects linked works from filmography/television/discography sections', () => {
    const works = extractFilmography(page);
    const titles = works.map((w) => w.title);
    expect(titles).toContain('KGF: Chapter 2');
    expect(titles).toContain('Salaar');
    expect(titles).toContain('Matka King');
    expect(titles).toContain('Song One');
  });

  it('captures works in subsections nested under a matching section', () => {
    const works = extractFilmography(nestedPage);
    const titles = works.map((w) => w.title);
    expect(titles).toContain('Three Bhayanak Nights');
    expect(titles).toContain('Jubilee');
    expect(titles).toContain('Modern Love Chennai');
  });

  it('captures "As actor" subsections outside a filmography parent', () => {
    const works = extractFilmography(nestedPage);
    expect(works.some((w) => w.wikiTitle === '83rd Filmfare Awards')).toBe(true);
  });

  it('stops at the next top-level non-work section', () => {
    const works = extractFilmography(nestedPage);
    expect(works.some((w) => w.wikiTitle === 'Filmfare OTT Award')).toBe(false);
  });

  it('filters table-header noise: languages, outlets, award names', () => {
    const noisy = `
== Filmography ==
{| class="wikitable"
| Language || [[Hindi]] || [[Punjabi language|Punjabi]]
|-
| Review || [[The Times of India]] gave 4 stars to [[Baby John]]
|}
She won the [[Filmfare OTT Award]] for [[Jubilee (TV series)|Jubilee]].
`;
    const works = extractFilmography(noisy);
    const targets = works.map((w) => w.wikiTitle);
    expect(targets).not.toContain('Hindi');
    expect(targets).not.toContain('Punjabi');
    expect(targets).not.toContain('Punjabi language');
    expect(targets).not.toContain('The Times of India');
    expect(targets).not.toContain('Filmfare OTT Award');
    expect(targets).toContain('Baby John');
    expect(targets).toContain('Jubilee (TV series)');
  });

  it('keeps wikiTitle targets for cross-linking', () => {
    const works = extractFilmography(page);
    expect(works.find((w) => w.title === 'KGF: Chapter 2')?.wikiTitle).toBe('K.G.F: Chapter 2');
  });

  it('ignores non-work sections and dedupes', () => {
    const works = extractFilmography(page);
    expect(works.some((w) => w.wikiTitle === 'Mumbai')).toBe(false);
    const targets = works.map((w) => w.wikiTitle);
    expect(new Set(targets).size).toBe(targets.length);
  });
});
