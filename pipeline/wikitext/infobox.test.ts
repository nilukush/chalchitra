import { describe, expect, it } from 'vitest';
import { findTemplates, parseInfobox, splitListField } from './infobox.js';

const filmWikitext = `{{Short description|2025 Indian film}}
{{Use dmy dates|date=March 2026}}
{{Infobox film
| name           = Dhurandhar
| image          = Dhurandhar poster.jpg
| director       = [[Aditya Dhar]]
| producer       = {{ubl|Aditya Dhar|Lokesh Dhar|[[Jyoti Deshpande]]}}
| starring       = {{plainlist|
* [[Ranveer Singh]]
* [[Akshaye Khanna]]
* [[Danish Pandor (actor)|Danish Pandor]]
}}
| released       = {{Film date|2025|12|5|df=y}}
| runtime        = 214 minutes<ref name="CBFB" />
| country        = India
| language       = Hindi
| budget         = {{INR}}250–255 crore<ref>{{cite web|url=x}}</ref>
| gross          = {{INR|1350.83}} crore
}}

Some lead text here.
`;

describe('findTemplates', () => {
  const page = `
{{Episode table |episodes=
{{Episode list
| EpisodeNumber = 1
| Title = Taqdeer!
| OriginalAirDate = {{Start date|2026|4|17|df=y}}
}}
{{Episode list
| EpisodeNumber = 2
| Title = Umeed Ka Karkhana
| WrittenBy = Abhay Koranne
}}
}}
{{Track listing
| title1 = "Dhoom" | length1 = 4:28
| title2 = "Second" | singer2 = [[Shreya Ghoshal]]
}}
`;

  it('finds all templates matching a name pattern with parsed params', () => {
    const lists = findTemplates(page, /^episode list$/i);
    expect(lists).toHaveLength(2);
    expect(lists[0].params['titlenumber'] ?? lists[0].params['episodenumber']).toBe('1');
    expect(lists[1].params['title']).toBe('Umeed Ka Karkhana');
  });

  it('params keep nested templates intact', () => {
    const lists = findTemplates(page, /^episode list$/i);
    expect(lists[0].params['originalairdate']).toBe('{{Start date|2026|4|17|df=y}}');
  });

  it('finds other templates independently', () => {
    expect(findTemplates(page, /^track listing$/i)).toHaveLength(1);
  });

  it('returns empty array when nothing matches', () => {
    expect(findTemplates('no templates here', /^episode list$/i)).toEqual([]);
  });
});

describe('parseInfobox', () => {
  it('extracts the infobox with normalised keys', () => {
    const box = parseInfobox(filmWikitext);
    expect(box).not.toBeNull();
    expect(box!['name']).toBe('Dhurandhar');
    expect(box!['director']).toBe('[[Aditya Dhar]]');
    expect(box!['language']).toBe('Hindi');
  });

  it('keeps nested template values intact (pipes inside templates)', () => {
    const box = parseInfobox(filmWikitext);
    expect(box!['producer']).toBe('{{ubl|Aditya Dhar|Lokesh Dhar|[[Jyoti Deshpande]]}}');
    expect(box!['starring']).toContain('[[Ranveer Singh]]');
    expect(box!['starring']).toContain('[[Danish Pandor (actor)|Danish Pandor]]');
  });

  it('matches Infobox television too', () => {
    const box = parseInfobox(
      '{{Infobox television\n| director = [[Nagraj Manjule]]\n| num_episodes = 8\n}}',
    );
    expect(box!['director']).toBe('[[Nagraj Manjule]]');
    expect(box!['num_episodes']).toBe('8');
  });

  it('returns null when there is no infobox', () => {
    expect(parseInfobox('Just some text without an infobox.')).toBeNull();
  });

  it('does not include content after the closing braces', () => {
    const box = parseInfobox(filmWikitext);
    expect(box!['language']).not.toContain('Some lead text');
  });
});

describe('splitListField', () => {
  it('splits a plainlist template into items', () => {
    expect(
      splitListField('{{plainlist|\n* [[Ranveer Singh]]\n* [[Akshaye Khanna]]\n}}'),
    ).toEqual(['Ranveer Singh', 'Akshaye Khanna']);
  });

  it('splits ubl (unbulleted list) templates', () => {
    expect(splitListField('{{ubl|Aditya Dhar|Lokesh Dhar|[[Jyoti Deshpande]]}}')).toEqual([
      'Aditya Dhar',
      'Lokesh Dhar',
      'Jyoti Deshpande',
    ]);
  });

  it('splits on <br> variants', () => {
    expect(splitListField('Abhay Koranne<br />[[Nagraj Manjule]]<br>Nagraj')).toEqual([
      'Abhay Koranne',
      'Nagraj Manjule',
      'Nagraj',
    ]);
  });

  it('returns a single cleaned item for plain text', () => {
    expect(splitListField('[[Aditya Dhar]]')).toEqual(['Aditya Dhar']);
  });

  it('drops refs and empties', () => {
    expect(splitListField('214 minutes<ref name="CBFB" />')).toEqual(['214 minutes']);
    expect(splitListField('')).toEqual([]);
  });
});
