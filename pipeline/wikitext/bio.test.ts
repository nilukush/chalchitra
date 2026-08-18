import { describe, expect, it } from 'vitest';
import { extractBioSections } from './bio.js';

const page = `
== Early life and education ==
Hashmi was born in [[Mumbai]] to a family of filmmakers. He attended school there.
More prose about childhood.

== Career ==
=== 2003–2007: Breakthrough ===
He debuted with ''Footpath''.

== Personal life ==
He married his long-time partner in 2006. The couple has a son.
His son was diagnosed with cancer, which he has spoken about publicly.

== In the media ==
Some commentary.

== Filmography ==
{| class="wikitable" |}
`;

describe('extractBioSections', () => {
  it('captures Early life (and education variants) and Personal life as prose', () => {
    const bio = extractBioSections(page);
    expect(bio.map((b) => b.heading)).toEqual(['Early life', 'Personal life']);
    expect(bio[0].text).toContain('Mumbai');
    expect(bio[1].text).toContain('married');
  });

  it('excludes Career, media and filmography sections', () => {
    const bio = extractBioSections(page);
    expect(bio.some((b) => b.text.includes('Footpath'))).toBe(false);
  });

  it('strips wikitext markup from the prose', () => {
    const bio = extractBioSections(page);
    expect(bio[0].text).not.toMatch(/\[\[|''|\{/);
  });

  it('returns [] when no bio sections exist', () => {
    expect(extractBioSections('== Plot ==\nnothing')).toEqual([]);
  });
});
