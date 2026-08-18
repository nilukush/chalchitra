import { describe, expect, it } from 'vitest';
import { extractFilmography, findFilmographySubpage, findAwardsSubpage } from './filmography.js';

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

// Disha-Patani-style nested filmography: subsections with structured tables,
// rowspan years, unlinked titles, notes column
const nestedPage = `
== Filmography ==
=== Film ===
{| class="wikitable"
! Year !! Title !! Role !! Notes
|-
| 2016 || ''[[M.S. Dhoni: The Untold Story]]'' || Priyanka Jha || Hindi film
|-
| rowspan="2" | 2018 || [[Baaghi 2]] || Neha || Cameo appearance
|-
| ''[[Kung Fu Yoga]]'' || Ashmita || Chinese-Hindi film
|-
| TBA || Fateh || Untitled web debut
|}

=== Television ===
{| class="wikitable"
! Year !! Title !! Role !! Notes
|-
| 2019 || [[Four More Shots Please!]] || Umang || Amazon Prime Video
|}

=== Music videos ===
* [[Buzz (song)|Buzz]]

== Accolades ==
She won the [[Filmfare OTT Award]].
`;

const headerless = `
== Filmography ==
{| class="wikitable"
|-
| 2014 || [[Heropanti]] || Dimpy's friend
|-
| 2016 || Baaghi || Sia
|}
`;

const subpagePage = `
== Filmography ==
{{Main|Emraan Hashmi filmography}}
== Accolades ==
{{Main list|List of awards and nominations received by Emraan Hashmi}}
`;

const spacedSubpage = `== Filmography ==\n{{main| Siddique filmography }}`;

describe('extractFilmography (structured)', () => {
  it('parses table rows with year, title, role and notes', () => {
    const sections = extractFilmography(nestedPage);
    const film = sections.find((s) => s.medium === 'film');
    expect(film).toBeDefined();
    const dhoni = film!.rows.find((r) => r.wikiTitle === 'M.S. Dhoni: The Untold Story');
    expect(dhoni).toMatchObject({ year: '2016', role: 'Priyanka Jha', notes: 'Hindi film' });
  });

  it('carries rowspan years forward to following rows', () => {
    const sections = extractFilmography(nestedPage);
    const film = sections.find((s) => s.medium === 'film')!;
    const kfy = film.rows.find((r) => r.wikiTitle === 'Kung Fu Yoga');
    expect(kfy?.year).toBe('2018');
  });

  it('keeps unlinked title rows as plain rows', () => {
    const sections = extractFilmography(nestedPage);
    const film = sections.find((s) => s.medium === 'film')!;
    const fateh = film.rows.find((r) => r.title === 'Fateh');
    expect(fateh).toMatchObject({ year: 'TBA', wikiTitle: undefined });
  });

  it('classifies television and music-video subsections by medium', () => {
    const sections = extractFilmography(nestedPage);
    const tv = sections.find((s) => s.heading === 'Television');
    expect(tv?.medium).toBe('television');
    expect(tv?.rows[0]).toMatchObject({ title: 'Four More Shots Please!', notes: 'Amazon Prime Video' });
    const mv = sections.find((s) => s.heading === 'Music videos');
    expect(mv?.rows.map((r) => r.title)).toContain('Buzz');
  });

  it('parses headerless tables positionally', () => {
    const sections = extractFilmography(headerless);
    const rows = sections.flatMap((s) => s.rows);
    expect(rows.find((r) => r.wikiTitle === 'Heropanti')).toMatchObject({ year: '2014', role: "Dimpy's friend" });
    expect(rows.find((r) => r.title === 'Baaghi')?.year).toBe('2016');
  });

  it('harvests prose links as fallback rows and dedupes against table rows', () => {
    const sections = extractFilmography(page);
    const titles = sections.flatMap((s) => s.rows).map((r) => r.title);
    expect(titles).toContain('KGF: Chapter 2');
    expect(titles).toContain('Salaar');
    expect(titles).toContain('Matka King');
    expect(titles).toContain('Song One');
    const targets = sections.flatMap((s) => s.rows).map((r) => r.wikiTitle);
    expect(new Set(targets).size).toBe(targets.length);
  });

  it('ignores non-work sections', () => {
    const sections = extractFilmography(page);
    const targets = sections.flatMap((s) => s.rows).map((r) => r.wikiTitle);
    expect(targets).not.toContain('Mumbai');
    expect(targets).not.toContain('Filmfare OTT Award');
  });

  it('filters table-header noise: languages and outlets', () => {
    const noisy = `
== Filmography ==
{| class="wikitable"
| Language || [[Hindi]] || [[Punjabi language|Punjabi]]
|-
| Review || [[The Times of India]] gave 4 stars to [[Baby John]]
|}
`;
    const targets = extractFilmography(noisy).flatMap((s) => s.rows).map((r) => r.wikiTitle);
    expect(targets).not.toContain('Hindi');
    expect(targets).not.toContain('Punjabi language');
    expect(targets).not.toContain('The Times of India');
    expect(targets).toContain('Baby John');
  });
});

describe('subpage pointers', () => {
  it('detects {{Main|X filmography}} including leading spaces', () => {
    expect(findFilmographySubpage(subpagePage)).toBe('Emraan Hashmi filmography');
    expect(findFilmographySubpage(spacedSubpage)).toBe('Siddique filmography');
  });

  it('detects {{Main list|List of awards…}} as an awards subpage', () => {
    expect(findAwardsSubpage(subpagePage)).toBe('List of awards and nominations received by Emraan Hashmi');
  });

  it('returns null when no filmography subpage exists', () => {
    expect(findFilmographySubpage(page)).toBeNull();
    expect(findAwardsSubpage(page)).toBeNull();
  });
});
