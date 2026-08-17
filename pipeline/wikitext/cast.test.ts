import { describe, expect, it } from 'vitest';
import { extractCast } from './cast.js';

const castSection = `== Cast ==
* [[Vijay Varma]] as Brij Bhatti "Matka King"
* [[Danish Pandor (actor)|Danish Pandor]]
* Ajay Raju as Police Homeguard
* [[Vineet Kumar Singh]] as [[Dawood Ibrahim|Darab Ahmed Wadkar]] (special appearance)<ref>{{cite web|title=X|url=https://x.com}}</ref>
* [[Bharat Jadhav]] as [[Sub-inspector|Sub Inspector]] Eknath Tumbade
* [[Ishtiyak Khan]]
** some nested note that should be ignored
: {{Plainlist|should be ignored too}}
`;

describe('extractCast', () => {
  it('parses linked actors with roles', () => {
    const cast = extractCast(castSection);
    expect(cast[0]).toEqual({
      name: 'Vijay Varma',
      wikiTitle: 'Vijay Varma',
      role: 'Brij Bhatti "Matka King"',
    });
  });

  it('uses the piped label as name and full target as wikiTitle', () => {
    const cast = extractCast(castSection);
    expect(cast[1]).toEqual({ name: 'Danish Pandor', wikiTitle: 'Danish Pandor (actor)', role: '' });
  });

  it('keeps unlinked names without a wikiTitle', () => {
    const cast = extractCast(castSection);
    expect(cast[2]).toEqual({ name: 'Ajay Raju', wikiTitle: null, role: 'Police Homeguard' });
  });

  it('strips refs and unwraps links inside the role', () => {
    const cast = extractCast(castSection);
    expect(cast[3]?.role).toBe('Darab Ahmed Wadkar (special appearance)');
    expect(cast[4]?.role).toBe('Sub Inspector Eknath Tumbade');
  });

  it('handles entries with no role, appending ** continuations', () => {
    const cast = extractCast(castSection);
    expect(cast[5]).toEqual({
      name: 'Ishtiyak Khan',
      wikiTitle: 'Ishtiyak Khan',
      role: 'some nested note that should be ignored',
    });
  });

  it('ignores nested and indented lines', () => {
    const cast = extractCast(castSection);
    expect(cast.some((c) => c.name.includes('nested'))).toBe(false);
    expect(cast.every((c) => c.name.length > 0)).toBe(true);
  });

  it('returns an empty array when there is no cast section', () => {
    expect(extractCast('== Plot ==\nNothing here.')).toEqual([]);
  });

  it('matches alternative headings like "Cast and characters"', () => {
    const alt = extractCast('== Cast and characters ==\n* [[A]] as B');
    expect(alt).toHaveLength(1);
  });

  it('appends ** sub-bullets to the previous entry (dual roles)', () => {
    const dual = extractCast(
      [
        '== Cast ==',
        '* [[Yash (actor)|Yash]] in a [[dual role]] as',
        '** Raya, Rumi\'s biological father',
        '** Rumi / Ticket, Raya\'s son',
        '* [[Kiara Advani]] as Nadia',
      ].join('\n'),
    );
    expect(dual[0].role).toBe("Dual role: Raya, Rumi's biological father Rumi / Ticket, Raya's son");
    expect(dual[1].role).toBe('Nadia');
  });
});
