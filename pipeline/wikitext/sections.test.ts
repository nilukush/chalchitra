import { describe, expect, it } from 'vitest';
import { extractSections, getSection, listSectionTitles } from './sections.js';

const page = `{{Infobox film | name = X}}
Lead text.

== Plot ==
Plot para one.
Plot para two.

==Cast==
* [[A]] as B

=== Supporting cast ===
* [[C]] as D

== Reception ==
Reception text.

== External links ==
* {{IMDb title|123}}

== References ==
{{Reflist}}
`;

describe('extractSections', () => {
  it('returns all sections with normalised titles', () => {
    const sections = extractSections(page);
    expect(sections.map((s) => s.title)).toEqual([
      'Plot',
      'Cast',
      'Supporting cast',
      'Reception',
      'External links',
      'References',
    ]);
  });

  it('carries body text per section', () => {
    const sections = extractSections(page);
    expect(sections[0].body).toContain('Plot para one.');
    expect(sections[0].body).not.toContain('Lead text');
  });

  it('does not throw on heading-only pages', () => {
    expect(() => extractSections('== A ==\n== B ==')).not.toThrow();
  });
});

describe('getSection', () => {
  it('matches titles case-insensitively and ignores decoration', () => {
    expect(getSection(page, 'plot')).toContain('Plot para one.');
    expect(getSection(page, 'CAST')).toContain('[[A]] as B');
  });

  it('returns null when the section is absent', () => {
    expect(getSection(page, 'Box office')).toBeNull();
  });
});

describe('listSectionTitles', () => {
  it('returns the flat list of headings', () => {
    expect(listSectionTitles(page)).toContain('Reception');
    expect(listSectionTitles(page)).not.toContain('Plot para one.');
  });
});
