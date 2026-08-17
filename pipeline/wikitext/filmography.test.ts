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

describe('extractFilmography', () => {
  it('collects linked works from filmography/television/discography sections', () => {
    const works = extractFilmography(page);
    const titles = works.map((w) => w.title);
    expect(titles).toContain('KGF: Chapter 2');
    expect(titles).toContain('Salaar');
    expect(titles).toContain('Matka King');
    expect(titles).toContain('Song One');
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
