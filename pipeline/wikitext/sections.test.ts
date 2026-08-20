import { describe, expect, it } from 'vitest';
import { extractSections, findPlotSection, getSection, listSectionTitles } from './sections.js';

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

describe('findPlotSection', () => {
  // Real heading variants found in the 8,300-page cache census (2026-08-20):
  // plot 4883 · synopsis 167 · premise 142 · "plot summary" 12 (Crime Beat)
  // · story 6 · "plot synopsis" 3.
  it('matches the exact canonical names', () => {
    expect(findPlotSection('== Plot ==\nA')).toContain('A');
    expect(findPlotSection('== Premise ==\nB')).toContain('B');
    expect(findPlotSection('== Synopsis ==\nC')).toContain('C');
  });

  it('matches variant headings: Plot summary, Plot synopsis, Story', () => {
    expect(findPlotSection('== Plot summary ==\nCrime Beat plot.')).toContain('Crime Beat plot.');
    expect(findPlotSection('== Plot synopsis ==\nD')).toContain('D');
    expect(findPlotSection('== Story ==\nE')).toContain('E');
  });

  it('prefers Plot over Synopsis when both exist, regardless of order', () => {
    const both = `== Synopsis ==\nsynopsis body
== Plot ==\nplot body`;
    expect(findPlotSection(both)).toContain('plot body');
  });

  it('does not match non-plot headings that merely contain the word', () => {
    expect(findPlotSection('== Plot and cast ==\nX')).toBeNull();
    expect(findPlotSection('== Story of the film industry ==\nY')).toBeNull();
    expect(findPlotSection('== Casting ==\nZ')).toBeNull();
  });

  it('returns null when no plot-like section exists', () => {
    expect(findPlotSection('== Cast ==\n* A as B')).toBeNull();
  });
});
