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

  it('handles {{URL|…}} as an official-site link', () => {
    const ext = extractExternalLinks('{{URL|https://www.thefilm.com}}');
    expect(ext.links.some((l) => l.url === 'https://www.thefilm.com' && l.label.includes('thefilm.com'))).toBe(true);
  });

  it('captures streaming, social and ratings templates', () => {
    const ext = extractExternalLinks(`
* {{Netflix title|90123456}}
* {{Instagram|wamiqa.gabbi}}
* {{Twitter|wamiqagabbi}}
* {{Facebook|matkakingprime}}
* {{YouTube|matkakingtrailer}}
* {{Rotten Tomatoes|matka_king_2026}}
`);
    const labels = ext.links.map((l) => l.label);
    expect(ext.links.find((l) => l.label === 'Netflix')?.url).toBe('https://www.netflix.com/title/90123456');
    expect(ext.links.find((l) => l.label === 'Instagram')?.url).toBe('https://www.instagram.com/wamiqa.gabbi');
    expect(ext.links.find((l) => l.label === 'X (Twitter)')?.url).toBe('https://twitter.com/wamiqagabbi');
    expect(ext.links.find((l) => l.label === 'Facebook')?.url).toBe('https://www.facebook.com/matkakingprime');
    expect(ext.links.find((l) => l.label === 'YouTube')?.url).toBe('https://www.youtube.com/matkakingtrailer');
    expect(ext.links.find((l) => l.label === 'Rotten Tomatoes')?.url).toBe('https://www.rottentomatoes.com/m/matka_king_2026');
    expect(labels).toContain('Netflix');
  });

  it('captures regional database templates (Bollywood Hungama, RT person)', () => {
    const ext = extractExternalLinks(`
* {{Bollywood Hungama person|wamiqa-gabbi}}
* {{Rotten Tomatoes person|wamiqa-gabbi}}
`);
    expect(ext.links.find((l) => l.label === 'Bollywood Hungama')?.url).toBe(
      'https://www.bollywoodhungama.com/person/wamiqa-gabbi/',
    );
    expect(ext.links.find((l) => l.label === 'Rotten Tomatoes')?.url).toBe(
      'https://www.rottentomatoes.com/celebrity/wamiqa-gabbi',
    );
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
