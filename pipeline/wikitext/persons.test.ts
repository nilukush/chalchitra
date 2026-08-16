import { describe, expect, it } from 'vitest';
import { collectPersonLinks, isPersonLikeTitle } from './persons.js';

describe('isPersonLikeTitle', () => {
  it('accepts plain biographical titles', () => {
    expect(isPersonLikeTitle('Vijay Varma')).toBe(true);
    expect(isPersonLikeTitle('Nagraj Popatrao Manjule')).toBe(true);
  });

  it('rejects namespaces and non-person patterns', () => {
    expect(isPersonLikeTitle('Category:2026 films')).toBe(false);
    expect(isPersonLikeTitle('File:Poster.jpg')).toBe(false);
    expect(isPersonLikeTitle('List of Indian films')).toBe(false);
    expect(isPersonLikeTitle('Template:Infobox film')).toBe(false);
    expect(isPersonLikeTitle('Wikipedia:Manual of Style')).toBe(false);
    expect(isPersonLikeTitle('2026 in India')).toBe(false);
    expect(isPersonLikeTitle('Hindi')).toBe(false);
    expect(isPersonLikeTitle('Amazon Prime Video')).toBe(false);
  });
});

describe('collectPersonLinks', () => {
  const infobox: Record<string, string> = {
    director: '[[Aditya Dhar]]',
    starring: '{{plainlist|\n* [[Ranveer Singh]]\n* [[Akshaye Khanna]]\n}}',
    language: '[[Hindi]]',
    music: '[[Shashwat Sachdev]]',
  };
  const cast = [
    { name: 'Ranveer Singh', wikiTitle: 'Ranveer Singh', role: '' },
    { name: 'Bharat Jadhav', wikiTitle: 'Bharat Jadhav', role: 'Inspector' },
    { name: 'Ajay Raju', wikiTitle: null, role: 'Homeguard' },
  ];

  it('unions crew fields and cast, deduplicated', () => {
    const people = collectPersonLinks(infobox, cast, ['director', 'starring', 'music']);
    const names = people.map((p) => p.target);
    expect(names).toContain('Aditya Dhar');
    expect(names).toContain('Ranveer Singh'); // deduped from starring + cast
    expect(names).toContain('Bharat Jadhav');
    expect(new Set(names).size).toBe(names.length);
  });

  it('filters non-person targets like languages', () => {
    const people = collectPersonLinks(infobox, cast, ['director', 'starring', 'music', 'language']);
    expect(people.map((p) => p.target)).not.toContain('Hindi');
  });

  it('keeps a role hint per person', () => {
    const people = collectPersonLinks(infobox, cast, ['director', 'starring', 'music']);
    const director = people.find((p) => p.target === 'Aditya Dhar');
    const actor = people.find((p) => p.target === 'Bharat Jadhav');
    expect(director?.as).toBe('Director');
    expect(actor?.as).toBe('Cast');
  });

  it('skips cast entries without wiki titles', () => {
    const people = collectPersonLinks({}, cast, ['cast']);
    expect(people.map((p) => p.target)).not.toContain('Ajay Raju');
  });
});
