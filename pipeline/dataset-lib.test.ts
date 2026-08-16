import { describe, expect, it } from 'vitest';
import { buildSearchDocuments, slugify, SlugRegistry, wikiUrlFor } from './dataset-lib.js';

describe('slugify', () => {
  it('kebab-cases plain titles', () => {
    expect(slugify('Matka King')).toBe('matka-king');
    expect(slugify('Dhurandhar: The Revenge')).toBe('dhurandhar-the-revenge');
  });

  it('drops common disambiguation parentheses', () => {
    expect(slugify('Glory (TV series)')).toBe('glory');
    expect(slugify('DC (film)')).toBe('dc');
    expect(slugify('Lakshmi Niwas (Hindi TV series)')).toBe('lakshmi-niwas');
  });

  it('keeps other parentheses content', () => {
    expect(slugify('Muthu Engira Kaattaan')).toBe('muthu-engira-kaattaan');
  });

  it('collapses punctuation and whitespace', () => {
    expect(slugify('Mr. and Mrs. Parshuram')).toBe('mr-and-mrs-parshuram');
    expect(slugify("Hui Gumm! Yaadein")).toBe('hui-gumm-yaadein');
  });

  it('strips diacritics', () => {
    expect(slugify('Andha Pyaar 2.0')).toBe('andha-pyaar-2-0');
  });

  it('falls back to a provided pageid for fully non-latin titles', () => {
    expect(slugify('ಜೋಗಿ ಸಾಹೇಬ', 12345)).toBe('p12345');
  });
});

describe('SlugRegistry', () => {
  it('returns the same slug until a collision, then suffixes', () => {
    const reg = new SlugRegistry();
    expect(reg.slug('Sankalp')).toBe('sankalp');
    expect(reg.slug('Sankalp (film)')).toBe('sankalp-2');
    expect(reg.slug('Sankalp')).toBe('sankalp-3');
  });

  it('treats non-latin fallback ids as unique', () => {
    const reg = new SlugRegistry();
    expect(reg.slug('ಚಿತ್ರ', 1)).toBe('p1');
    expect(reg.slug('ಚಿತ್ರ', 2)).toBe('p2');
  });
});

describe('wikiUrlFor', () => {
  it('encodes spaces as underscores inside the path', () => {
    expect(wikiUrlFor('Matka King')).toBe('https://en.wikipedia.org/wiki/Matka_King');
    expect(wikiUrlFor('A & B?')).toBe(
      'https://en.wikipedia.org/wiki/A_%26_B%3F',
    );
  });
});

describe('buildSearchDocuments', () => {
  const movies = [
    {
      slug: 'matka-king',
      title: 'Matka King',
      kind: 'movie',
      year: 2026,
      language: 'Hindi',
      cast: [
        { name: 'Vijay Varma', slug: 'vijay-varma', role: '' },
        { name: 'Anon', slug: null, role: '' },
      ],
      directedBy: ['Nagraj Manjule'],
    },
  ] as any;
  const persons = [
    {
      slug: 'vijay-varma',
      name: 'Vijay Varma',
      kind: 'person',
      credits: [{ title: 'Matka King', kind: 'movie', role: 'Cast' }],
    },
  ] as any;

  it('creates one document per title and per person', () => {
    const docs = buildSearchDocuments(movies, [] as any, persons);
    expect(docs).toHaveLength(2);
    expect(docs.map((d) => d.s).sort()).toEqual(['matka-king', 'vijay-varma']);
  });

  it('makes title documents searchable by cast and director names', () => {
    const docs = buildSearchDocuments(movies, [] as any, persons);
    const movie = docs.find((d) => d.s === 'matka-king')!;
    expect(movie.q).toContain('Vijay Varma');
    expect(movie.q).toContain('Nagraj Manjule');
    expect(movie.q).not.toContain('Anon');
  });

  it('makes person documents searchable by credited titles', () => {
    const docs = buildSearchDocuments(movies, [] as any, persons);
    const person = docs.find((d) => d.s === 'vijay-varma')!;
    expect(person.q).toContain('Matka King');
  });
});
