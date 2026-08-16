import { describe, expect, it } from 'vitest';
import { extractExternalLinks, extractWikiLinks } from './links.js';

const externalSection = `== External links ==
* {{Official website|https://www.matkaking.com}}
* {{IMDb title|21234567|Matka King}}
* {{Amazon Prime Video|matka-king}}
* [https://timesofindia.indiatimes.com/x Reviews] at The Times of India
`;

describe('extractExternalLinks', () => {
  it('finds the IMDb title id from the template', () => {
    const ext = extractExternalLinks(externalSection);
    expect(ext.imdbId).toBe('21234567');
  });

  it('finds IMDb id given as a named parameter', () => {
    const ext = extractExternalLinks('{{IMDb title|id=998877}}');
    expect(ext.imdbId).toBe('998877');
  });

  it('finds IMDb name ids for persons', () => {
    const ext = extractExternalLinks('{{IMDb name|0987654|Vijay Varma}}');
    expect(ext.imdbId).toBe('0987654');
  });

  it('extracts the official website url', () => {
    const ext = extractExternalLinks(externalSection);
    expect(ext.official).toBe('https://www.matkaking.com');
  });

  it('collects labelled external url bullets', () => {
    const ext = extractExternalLinks(externalSection);
    const times = ext.links.find((l) => l.label.includes('Reviews'));
    expect(times?.url).toBe('https://timesofindia.indiatimes.com/x');
  });

  it('returns empty results for text without external links', () => {
    const ext = extractExternalLinks('== Plot ==\nplain text');
    expect(ext.imdbId).toBeUndefined();
    expect(ext.official).toBeUndefined();
    expect(ext.links).toEqual([]);
  });
});

describe('extractWikiLinks', () => {
  it('returns targets and labels, deduplicated in order', () => {
    const links = extractWikiLinks('[[A]] and [[B|Bee]] and [[A]] again');
    expect(links).toEqual([
      { target: 'A', label: 'A' },
      { target: 'B', label: 'Bee' },
    ]);
  });

  it('ignores file and category links', () => {
    const links = extractWikiLinks('[[File:X.jpg|thumb]] [[Category:2026 films]] [[Person]]');
    expect(links).toEqual([{ target: 'Person', label: 'Person' }]);
  });
});
