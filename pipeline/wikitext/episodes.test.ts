import { describe, expect, it } from 'vitest';
import { extractEpisodes, findEpisodesSubpage } from './episodes.js';

const templatePage = `
{{Infobox television | num_episodes = 2}}
Lead text.

== Episodes ==
{{Episode table |background=#A42C17 |episodes=
{{Episode list
| EpisodeNumber       = 1
| Title               = Taqdeer, Tadbeer, Tarkeeb!
| DirectedBy          = [[Nagraj Manjule]]
| WrittenBy           = Abhay Koranne
| OriginalAirDate     = {{Start date|2026|4|17|df=y}}
| ShortSummary        = Brij starts small in 1960s Mumbai.
}}
{{Episode list
| EpisodeNumber       = 2
| Title               = Umeed Ka Karkhana
| DirectedBy          = Nagraj Manjule
| WrittenBy           = Abhay Koranne
| OriginalAirDate     = {{Start date|2026|4|24|df=y}}
}}
}}
`;

const wikitablePage = `
== Episodes ==
{| class="wikitable plainrowheaders"
! No. !! Title !! Directed by !! Written by !! Original release date
|-
| 1 || "{{ill|Pilot|...}}" || A. Director || B. Writer || {{Start date|2026|1|5|df=y}}
|-
| 2 || Second Episode || A. Director || C. Writer || {{Start date|2026|1|12|df=y}}
|}
`;

const noEpisodesPage = `== Plot ==\nNothing here.`;

describe('extractEpisodes', () => {
  it('parses {{Episode list}} templates', () => {
    const eps = extractEpisodes(templatePage);
    expect(eps).toHaveLength(2);
    expect(eps[0]).toEqual({
      number: '1',
      title: 'Taqdeer, Tadbeer, Tarkeeb!',
      director: 'Nagraj Manjule',
      writer: 'Abhay Koranne',
      airDate: '2026-04-17',
      summary: 'Brij starts small in 1960s Mumbai.',
    });
  });

  it('keeps episodes without summaries or directors', () => {
    const eps = extractEpisodes(templatePage);
    expect(eps[1].summary).toBeUndefined();
  });

  it('parses plain wikitables with header mapping', () => {
    const eps = extractEpisodes(wikitablePage);
    expect(eps).toHaveLength(2);
    expect(eps[0].title).toBe('Pilot');
    expect(eps[0].number).toBe('1');
    expect(eps[0].director).toBe('A. Director');
    expect(eps[0].airDate).toBe('2026-01-05');
    expect(eps[1].title).toBe('Second Episode');
  });

  it('returns [] when there are no episodes', () => {
    expect(extractEpisodes(noEpisodesPage)).toEqual([]);
  });
});

// Real multi-season shapes (session 15 Step 4): Indian series keep per-season
// subsections ON the article — every "Season N" section must contribute its
// rows WITH the season tagged, not just the first one found.
const multiSeasonTemplates = `
== Episodes ==
=== Season 1 ===
{{Episode table |episodes=
{{Episode list | EpisodeNumber = 1 | Title = S1 First | DirectedBy = A }}
{{Episode list | EpisodeNumber = 2 | Title = S1 Second | DirectedBy = A }}
}}
=== Season 2: The return ===
{{Episode table |episodes=
{{Episode list | EpisodeNumber = 1 | Title = S2 First | DirectedBy = B }}
}}
`;

const multiSeasonWikitables = `
== Episodes ==
=== Season 1 (2023) ===
{| class="wikitable"
! No. !! Title !! Directed by !! Original release date
|-
| 1 || First || rowspan="2" | A. Director || {{Start date|2023|1|5|df=y}}
|-
| 2 || Second || {{Start date|2023|1|12|df=y}}
|}
=== Season 2 (2024) ===
{| class="wikitable"
! No. !! Title !! Directed by !! Original release date
|-
| 1 || S2 First || B. Director || {{Start date|2024|3|1|df=y}}
|}
`;

describe('extractEpisodes (multi-season)', () => {
  it('collects rows from EVERY season section, tagged with the season', () => {
    const eps = extractEpisodes(multiSeasonTemplates);
    expect(eps).toHaveLength(3);
    expect(eps.filter((e) => e.season === 1)).toHaveLength(2);
    expect(eps.filter((e) => e.season === 2)).toHaveLength(1);
    expect(eps[2]).toMatchObject({ season: 2, number: '1', title: 'S2 First' });
  });

  it('tags per-season wikitables and carries rowspan directors within a season', () => {
    const eps = extractEpisodes(multiSeasonWikitables);
    expect(eps).toHaveLength(3);
    const s2 = eps.find((e) => e.season === 2);
    expect(s2).toMatchObject({ number: '1', title: 'S2 First', director: 'B. Director' });
    expect(eps.filter((e) => e.season === 1)).toHaveLength(2);
  });

  it('recognises Series N and decorated season headings', () => {
    const page = `
== Episodes ==
=== Series 2 (2021) ===
{| class="wikitable"
! No. !! Title
|-
| 1 || UK Return
|}
`;
    const eps = extractEpisodes(page);
    expect(eps).toHaveLength(1);
    expect(eps[0].season).toBe(2);
  });

  it('single-season pages keep season undefined (UI defaults to 1)', () => {
    const eps = extractEpisodes(templatePage);
    expect(eps.every((e) => e.season === undefined)).toBe(true);
  });
});

describe('findEpisodesSubpage', () => {
  it('detects {{Main|List of X episodes}} pointers', () => {
    expect(findEpisodesSubpage('== Episodes ==\n{{Main|List of Aahat episodes}}')).toBe('List of Aahat episodes');
    expect(findEpisodesSubpage('{{Main list|List of Sacred Games episodes}}')).toBe('List of Sacred Games episodes');
  });

  it('ignores filmography/awards subpages and pages without pointers', () => {
    expect(findEpisodesSubpage('{{Main|Emraan Hashmi filmography}}')).toBeNull();
    expect(findEpisodesSubpage('{{Main|List of awards received by X}}')).toBeNull();
    expect(findEpisodesSubpage('== Plot ==\nNo pointer.')).toBeNull();
  });
});
