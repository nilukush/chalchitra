import { describe, expect, it } from 'vitest';
import { extractSoundtrack } from './soundtrack.js';

const trackListingPage = `
== Soundtrack ==
The music and background score is composed by [[Amit Trivedi]].

{{Track listing
| headline        = Track listing
| all_lyrics      = Irshad Kamil
| title1          = "Dhoom Machale" | singer1 = [[Divya Kumar]] | length1 = 4:28
| title2          = "Second Song" | singer2 = [[Shreya Ghoshal]], [[Vishal Dadlani]] | lyricist2 = [[Varun Grover]] | length2 = 3:52
| title3          = "Third" | note3 = Rendered by Arijit Singh | length3 = 5:01
}}
`;

const listPage = `
== Soundtrack ==
Music composed by X.
# "Song One" – Sung by A, B
# "Song Two" – Sung by C, D
`;

const nonePage = `== Plot ==\nNo music here.`;

describe('extractSoundtrack', () => {
  it('parses {{Track listing}} into numbered tracks', () => {
    const st = extractSoundtrack(trackListingPage);
    expect(st?.tracks).toHaveLength(3);
    expect(st?.tracks[0]).toEqual({
      number: '1',
      title: 'Dhoom Machale',
      singers: 'Divya Kumar',
      lyrics: 'Irshad Kamil', // falls back to all_lyrics
      length: '4:28',
    });
  });

  it('keeps per-track overrides', () => {
    const st = extractSoundtrack(trackListingPage);
    expect(st?.tracks[1].lyrics).toBe('Varun Grover');
    expect(st?.tracks[1].singers).toBe('Shreya Ghoshal, Vishal Dadlani');
    expect(st?.tracks[2].singers).toBe('Rendered by Arijit Singh'); // note fallback
  });

  it('falls back to numbered lists in the section', () => {
    const st = extractSoundtrack(listPage);
    expect(st?.tracks).toHaveLength(2);
    expect(st?.tracks[0].title).toBe('Song One');
    expect(st?.tracks[0].singers).toBe('A, B');
  });

  it('returns null when a page has no soundtrack', () => {
    expect(extractSoundtrack(nonePage)).toBeNull();
  });
});
