import { describe, expect, it } from 'vitest';
import { extractSoundtrack, findSoundtrackSubpage } from './soundtrack.js';

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

// Plain track wikitables (Step 5): many articles tabulate tracks instead of
// using {{Track listing}}.
const wikitableTracks = `
== Songs ==
{| class="wikitable"
! Track !! Song !! Singer(s) !! Lyricist !! Length
|-
| 1 || "Kaattu Payale" || [[Saindhavi]] || Vivek || 4:02
|-
| 2 || "Chellamma" || [[Anirudh Ravichander]], [[Jonita Gandhi]] || Vivek || 3:58
|}
`;

describe('extractSoundtrack (wikitable tracks)', () => {
  it('parses track wikitables with header mapping', () => {
    const st = extractSoundtrack(wikitableTracks);
    expect(st?.tracks).toHaveLength(2);
    expect(st?.tracks[0]).toMatchObject({
      number: '1',
      title: 'Kaattu Payale',
      singers: 'Saindhavi',
      lyrics: 'Vivek',
      length: '4:02',
    });
    expect(st?.tracks[1].singers).toBe('Anirudh Ravichander, Jonita Gandhi');
  });

  it('numbers rows itself when there is no track column', () => {
    const table = `
== Music ==
{| class="wikitable"
! Song !! Singer
|-
| "First" || A
|-
| "Second" || B
|}
`;
    const st = extractSoundtrack(table);
    expect(st?.tracks).toHaveLength(2);
    expect(st?.tracks[0].number).toBe('1');
    expect(st?.tracks[1].title).toBe('Second');
  });

  it('falls back to the whole page when the matched section has no listings', () => {
    // real shape of "The Family Man (soundtrack)": a small == Songs == section
    // (reused tracks, no templates) while the real {{Track listing}}s live
    // under a separate "Track listing" heading
    const subpage = `
== Background ==
Prose about the score.

== Track listing ==
=== Season 1 ===
{{Track listing
| title1 = Dhuan
| singer1 = Roma
}}
=== Season 2 ===
{{Track listing
| title1 = Saathi
| singer1 = Anuj
}}

== Songs ==
=== Reused tracks ===
Some prose, no templates.
`;
    const st = extractSoundtrack(subpage);
    expect(st?.tracks).toHaveLength(2);
    expect(st?.tracks[0].title).toBe('Dhuan');
    expect(st?.tracks[1].title).toBe('Saathi');
  });
});

// Soundtrack subpages (Step 5): The Family Man's == Music == only carries a
// pointer — the tracks live on "The Family Man (soundtrack)". 509 such
// pointers exist in the cache.
const musicSubpage = `
== Music ==
{{Main|The Family Man (soundtrack)}}

''The Family Man: Season 1'' consists of fourteen songs used in the series.<ref>x</ref>
`;

describe('findSoundtrackSubpage', () => {
  it('detects {{Main|X (soundtrack)}} pointers in music sections', () => {
    expect(findSoundtrackSubpage(musicSubpage)).toBe('The Family Man (soundtrack)');
    expect(findSoundtrackSubpage('== Soundtrack ==\n{{Main list|Mohenjo Daro (soundtrack)}}')).toBe('Mohenjo Daro (soundtrack)');
  });

  it('ignores pointers to non-soundtrack subpages and other sections', () => {
    expect(findSoundtrackSubpage('== Music ==\nProse only, no pointer.')).toBeNull();
    expect(findSoundtrackSubpage('== Music ==\n{{Main|Sachin–Jigar}}')).toBeNull();
    expect(findSoundtrackSubpage('== Episodes ==\n{{Main|List of Aahat episodes}}')).toBeNull();
  });
});
