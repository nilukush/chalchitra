import { describe, expect, it } from 'vitest';
import { buildSearchDocuments, computeSlugRedirects, slugify, SlugRegistry, wikiUrlFor } from './dataset-lib.js';

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
  it('gives every doc a unique MiniSearch id (kind-qualified slug)', () => {
    const docs = buildSearchDocuments(
      [{ slug: 'x', kind: 'movie', title: 'X', year: 2026, language: 'Hindi', cast: [], directedBy: [] }],
      [{ slug: 'x', kind: 'series', title: 'X', year: 2026, language: 'Hindi', cast: [], createdBy: [] }],
      [{ slug: 'y', name: 'Y Person', credits: [] }],
    );
    const ids = docs.map((d: any) => d.id);
    expect(ids).toHaveLength(3);
    expect(new Set(ids).size).toBe(3); // movie:x vs series:x must not collide
    expect(ids).toContain('movie:x');
  });

  it('carries display fields for rich result rows (poster, rating, release date, person image)', () => {
    const docs = buildSearchDocuments(
      [{
        slug: 'm', kind: 'movie', title: 'M', year: 2026, language: 'Tamil',
        cast: [], directedBy: [],
        poster: 'https://img/p.jpg',
        rating: { source: 'tmdb', value: 8.1, votes: 9 },
        releaseDate: '2026-12-25',
      }] as any,
      [] as any,
      [{ slug: 'p', name: 'P Person', credits: [], image: 'https://img/i.jpg' }] as any,
    );
    const movie = docs.find((d: any) => d.id === 'movie:m');
    expect(movie.p).toBe('https://img/p.jpg');
    expect(movie.r).toBe(8.1);
    expect(movie.rd).toBe('2026-12-25');
    const person = docs.find((d: any) => d.id === 'person:p');
    expect(person.i).toBe('https://img/i.jpg');
  });

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

import { describe, expect, it } from 'vitest';
import { computeKnownFor } from './dataset-lib.js';
import type { PersonRecord, TitleRecord } from './types.js';

const title = (slug: string, over: Partial<TitleRecord>): TitleRecord => ({
  slug,
  kind: 'movie',
  title: slug,
  wikiTitle: slug,
  wikiUrl: '',
  language: 'Hindi',
  ...over,
} as TitleRecord);

const person = (over: Partial<PersonRecord>): PersonRecord => ({
  slug: 'p',
  name: 'P',
  wikiTitle: 'P',
  wikiUrl: '',
  pageid: 1,
  occupations: [],
  facts: [],
  credits: [],
  external: { imdbId: undefined, official: undefined, links: [] },
  references: [],
  sections: [],
  ...over,
} as PersonRecord);

const works = [
  title('blockbuster', { rating: { source: 'tmdb', value: 8.0, votes: 5000 }, year: 2024, poster: 'x.jpg' }),
  title('classic-award', { year: 1994, poster: 'x.jpg' }),
  title('flop', { rating: { source: 'tmdb', value: 4.0, votes: 500 }, year: 2025 }),
  title('unrated-recent', { year: 2026 }),
  title('bare-old', { year: 1971 }),
];

describe('computeKnownFor', () => {
  it('ranks voted, rated, recent, postered works above bare ones', () => {
    const p = person({
      filmography: [{ heading: 'Film', medium: 'film', rows: works.map((w) => ({ title: w.title, wikiTitle: w.wikiTitle, year: String(w.year), medium: 'film' as const })) }],
    });
    const byWiki = new Map(works.map((w) => [w.wikiTitle, w]));
    const ranked = computeKnownFor(p, byWiki, 2026);
    expect(ranked[0]?.slug).toBe('blockbuster');
    expect(ranked[ranked.length - 1]?.slug).toBe('bare-old');
  });

  it('boosts works the person won awards for', () => {
    const pair = [
      title('won-one', { rating: { source: 'tmdb', value: 7.0, votes: 400 }, year: 2001, poster: 'x.jpg' }),
      title('lost-one', { rating: { source: 'tmdb', value: 7.0, votes: 400 }, year: 2001, poster: 'x.jpg' }),
    ];
    const p = person({
      filmography: [{ heading: 'Film', medium: 'film', rows: pair.map((w) => ({ title: w.title, wikiTitle: w.wikiTitle, year: String(w.year), medium: 'film' as const })) }],
      awards: [{ year: '2001', award: 'Filmfare', category: 'Best Actor', work: 'won-one', workWikiTitle: 'won-one', result: 'won' }],
    });
    const byWiki = new Map(pair.map((w) => [w.wikiTitle, w]));
    const ranked = computeKnownFor(p, byWiki, 2026);
    expect(ranked[0]?.slug).toBe('won-one');
  });

  it('caps at six works, dedupes, and stays deterministic', () => {
    const many = Array.from({ length: 10 }, (_, i) => title(`w${i}`, { year: 2000 + i }));
    const p = person({
      filmography: [{ heading: 'Film', medium: 'film', rows: many.map((w) => ({ title: w.title, wikiTitle: w.wikiTitle, year: String(w.year), medium: 'film' as const })) }],
    });
    const byWiki = new Map(many.map((w) => [w.wikiTitle, w]));
    const a = computeKnownFor(p, byWiki, 2026);
    const b = computeKnownFor(p, byWiki, 2026);
    expect(a.length).toBe(6);
    expect(a).toEqual(b);
  });

  it('ranks a well-rated work above an equally popular poorly-rated one', () => {
    const two = [
      title('rated-low', { rating: { source: 'tmdb', value: 3.5, votes: 3000 }, year: 2025, poster: 'x' }),
      title('rated-high', { rating: { source: 'tmdb', value: 8.2, votes: 3000 }, year: 2025, poster: 'x' }),
    ];
    const p = person({
      filmography: [{ heading: 'Film', medium: 'film', rows: two.map((w) => ({ title: w.title, wikiTitle: w.wikiTitle, year: String(w.year), medium: 'film' as const })) }],
    });
    const byWiki = new Map(two.map((w) => [w.wikiTitle, w]));
    const ranked = computeKnownFor(p, byWiki, 2026);
    expect(ranked[0]?.slug).toBe('rated-high');
  });
});

// ── persons chunking (session 16): keep every data file well under the 100MB
// runtime + GitHub limits as person waves grow the universe ──────────────
import { bucketKeyForName, chunkPersons } from './dataset-lib.js';

describe('bucketKeyForName', () => {
  it('maps plain initials to their letter', () => {
    expect(bucketKeyForName('Aadhi Pinisetty')).toBe('A');
    expect(bucketKeyForName('tanishk bagchi')).toBe('T');
  });

  it('folds digits, accents and empty names to # (mirrors the people index A–Z buckets)', () => {
    expect(bucketKeyForName('13th Lancers')).toBe('#');
    expect(bucketKeyForName('Éanna')).toBe('#');
    expect(bucketKeyForName('')).toBe('#');
  });
});

describe('chunkPersons', () => {
  it('buckets persons by name initial and keeps records intact', () => {
    const chunks = chunkPersons([
      { name: 'Aadhi Pinisetty', slug: 'a' },
      { name: 'Ananya', slug: 'b' },
      { name: 'Bobby', slug: 'c' },
      { name: '13th Lancers', slug: 'd' },
    ] as any);
    expect(chunks.get('A')).toHaveLength(2);
    expect(chunks.get('B')).toHaveLength(1);
    expect(chunks.get('#')).toHaveLength(1);
  });

  it('never emits an empty bucket', () => {
    const chunks = chunkPersons([{ name: 'Zoya', slug: 'z' }] as any);
    expect(chunks.has('A')).toBe(false);
    expect(chunks.get('Z')).toHaveLength(1);
  });
});

describe('computeSlugRedirects (Wikipedia renames)', () => {
  it('emits old→new redirect when a pageid slug changes and records the new one', () => {
    const records = [
      { pageid: 1, slug: 'khalifa-the-ruler', kind: 'movie' as const },
      { pageid: 2, slug: 'stable-slug', kind: 'series' as const },
    ];
    const prev = { '1': { slug: 'khalifa-the-intro', kind: 'movie' }, '2': { slug: 'stable-slug', kind: 'series' } };
    const { redirects, next } = computeSlugRedirects(records as any, prev);
    expect(redirects).toEqual([{ from: '/movies/khalifa-the-intro', to: '/movies/khalifa-the-ruler' }]);
    expect(next).toEqual({ '1': { slug: 'khalifa-the-ruler', kind: 'movie' }, '2': { slug: 'stable-slug', kind: 'series' } });
  });

  it('redirects on a KIND flip even when the slug string is identical (Mandela /series→/movies)', () => {
    const records = [{ pageid: 3, slug: 'mandela', kind: 'movie' as const }];
    const prev = { '3': { slug: 'mandela', kind: 'series' } };
    const { redirects } = computeSlugRedirects(records as any, prev);
    expect(redirects).toEqual([{ from: '/series/mandela', to: '/movies/mandela' }]);
  });

  it('no redirects on first run (empty previous map)', () => {
    const { redirects, next } = computeSlugRedirects([{ pageid: 7, slug: 'x', kind: 'movie' }] as any, {});
    expect(redirects).toEqual([]);
    expect(next).toEqual({ '7': { slug: 'x', kind: 'movie' } });
  });
});
