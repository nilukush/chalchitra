import { describe, expect, it } from 'vitest';
import { extractEpisodes } from './episodes.js';

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
