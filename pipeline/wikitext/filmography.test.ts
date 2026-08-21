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
    // discography sections are the discography extractor's territory now —
    // songs must not leak into filmography rows
    expect(titles).not.toContain('Song One');
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

// Real shapes from Emraan Hashmi's filmography subpage (2026-08 session):
// captioned tables, {{Pending film}} names destroyed by template removal,
// release-status notes masquerading as titles, {{small}} role annotations.
const leakyPage = `
== Filmography ==
=== Film ===
{| class="wikitable"
! Year !! Title !! Role !! Notes
|-
| 2026 || [[Awarapan 2]] || Shivam Pandit ||
|-
| {{Pending film|Gunmaaster G9}} || {{TableTBA}} || rowspan="2" | Filming
|-
| 2027 || [[G2 (film)|G2]] || || Telugu film; filming
|-
| 2020 || ''55'' || Sagar Bhai ||
|-
| 2026 || Filming || ||
|}

=== Television ===
{| class="wikitable sortable"
|+ List of Emraan Hashmi television credits
! Year !! Title !! Role !! Notes
|-
| 2019 || [[Bard of Blood]] || Prof. Kabir Anand ({{small|Agent Adonis}}) || {{no wrap|[[Netflix]] series}}
|}
`;

describe('extractFilmography (leak guards)', () => {
  it('never creates a row from a table caption (|+ List of …)', () => {
    const sections = extractFilmography(leakyPage);
    const titles = sections.flatMap((s) => s.rows).map((r) => r.title);
    expect(titles.join('\n')).not.toMatch(/\+\s*List of/i);
    expect(titles).toContain('Bard of Blood');
  });

  it('recovers {{Pending film|X}} titles instead of promoting the status note', () => {
    const rows = extractFilmography(leakyPage).flatMap((s) => s.rows);
    const gunmaster = rows.find((r) => /Gunmaaster/i.test(r.title));
    expect(gunmaster).toBeDefined();
    expect(gunmaster?.title).toBe('Gunmaaster G9');
    expect(gunmaster?.notes).toBe('Filming');
  });

  it('drops rows whose title is only a release-status word', () => {
    const rows = extractFilmography(leakyPage).flatMap((s) => s.rows);
    expect(rows.some((r) => /^(filming|released|tba|post-production)$/i.test(r.title))).toBe(false);
  });

  it('keeps numeric film titles (55 is a real film)', () => {
    const rows = extractFilmography(leakyPage).flatMap((s) => s.rows);
    expect(rows.some((r) => r.title === '55')).toBe(true);
  });

  it('keeps {{small}} annotations inside roles without empty parentheses', () => {
    const rows = extractFilmography(leakyPage).flatMap((s) => s.rows);
    const bard = rows.find((r) => r.wikiTitle === 'Bard of Blood');
    expect(bard?.role).toBe('Prof. Kabir Anand (Agent Adonis)');
    expect(bard?.notes).toBe('Netflix series');
  });

  it('does not use a bare year as a title', () => {
    const rows = extractFilmography(leakyPage).flatMap((s) => s.rows);
    expect(rows.some((r) => /^\d{4}$/.test(r.title))).toBe(false);
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
