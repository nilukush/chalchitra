import { describe, expect, it } from 'vitest';
import { stripWikitext } from './clean.js';

describe('stripWikitext', () => {
  it('removes inline and self-closing refs', () => {
    expect(
      stripWikitext('Hello<ref>{{cite web|url=https://x.com|title=T}}</ref> world<ref name="a" />.'),
    ).toBe('Hello world.');
  });

  it('unwraps wikilinks keeping the label', () => {
    expect(stripWikitext('[[Vijay Varma]] as [[Dawood Ibrahim|Darab]]')).toBe(
      'Vijay Varma as Darab',
    );
  });

  it('unwraps bold and italics', () => {
    expect(stripWikitext("'''''Matka King''''' is a series")).toBe('Matka King is a series');
  });

  it('flattens known value templates', () => {
    expect(stripWikitext('{{INR}}250 crore')).toBe('₹250 crore');
    expect(stripWikitext('43{{ndash}}62 minutes')).toBe('43–62 minutes');
    expect(stripWikitext('Kannada{{snd}}Hindi')).toBe('Kannada–Hindi');
  });

  it('removes unknown templates entirely', () => {
    expect(stripWikitext('Note{{efn|some footnote}} end')).toBe('Note end');
  });

  it('removes file/image links', () => {
    expect(stripWikitext('[[File:Poster.jpg|thumb|Some poster]] text')).toBe('text');
  });

  it('keeps the label of external links', () => {
    expect(stripWikitext('Watch on [https://primevideo.com Prime Video] now')).toBe(
      'Watch on Prime Video now',
    );
  });

  it('decodes common HTML entities and converts <br> to a separator', () => {
    expect(stripWikitext('A&nbsp;&amp;&nbsp;B<br />C')).toBe('A & B C');
  });

  it('removes HTML comments', () => {
    expect(stripWikitext('Keep <!-- don\'t add copyrighted text -->this')).toBe('Keep this');
  });

  it('strips leftover heading markers and excess whitespace', () => {
    expect(stripWikitext('==Plot==\n  Some   plot \n text ')).toBe('Plot\nSome plot text');
  });

  it('never throws on garbage input', () => {
    expect(() => stripWikitext('{{[[<ref>}}]]')).not.toThrow();
  });
});
