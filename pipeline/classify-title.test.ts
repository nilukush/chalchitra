import { describe, expect, it } from 'vitest';
import { classifyTitlePage } from './classify-title.js';

const film = (over = '') => `
{{Infobox film
| name = Murder
| director = Anurag Basu
| country = India
| language = Hindi
| released = {{Film date|2004|4|2}}
${over}}}
== Plot ==
Text.
`;

describe('classifyTitlePage', () => {
  it('accepts Infobox film as a movie', () => {
    expect(classifyTitlePage(film())).toMatchObject({ kind: 'movie' });
  });

  it('accepts Infobox television as a series', () => {
    const page = film().replace('Infobox film', 'Infobox television').replace('| released', '| first_aired');
    expect(classifyTitlePage(page)).toMatchObject({ kind: 'series' });
  });

  it('rejects persons, songs, albums, episodes, disambiguation and infobox-less pages', () => {
    expect(classifyTitlePage('{{Infobox person|name=X}}')).toMatchObject({ reject: expect.stringContaining('wrong-type') });
    expect(classifyTitlePage('{{Infobox song|name=X}}')).toMatchObject({ reject: expect.stringContaining('wrong-type') });
    expect(classifyTitlePage('{{Infobox album|name=X}}')).toMatchObject({ reject: expect.stringContaining('wrong-type') });
    expect(classifyTitlePage('{{Infobox television episode|name=X}}')).toMatchObject({ reject: expect.stringContaining('wrong-type') });
    expect(classifyTitlePage('{{Disambiguation}}')).toMatchObject({ reject: 'disambiguation' });
    expect(classifyTitlePage('No infobox here at all.')).toMatchObject({ reject: 'no-infobox' });
  });

  it('rejects non-Indian films unless a field marks them Indian', () => {
    const hollywood = `
{{Infobox film
| name = Mission Impossible
| director = X
| country = United States
| language = English
}}
`;
    expect(classifyTitlePage(hollywood)).toMatchObject({ reject: 'non-indian' });
    const coprod = film('| country = India, United States');
    expect(classifyTitlePage(coprod)).toMatchObject({ kind: 'movie' });
    const indicEnglish = film().replace('| country = India', '| country =').replace('| language = Hindi', '| language = Hindi, English');
    expect(classifyTitlePage(indicEnglish)).toMatchObject({ kind: 'movie' });
  });

  it('accepts films with no country/language fields but flags them unverified', () => {
    const bare = `
{{Infobox film
| name = Some Indie
| director = Y
}}
`;
    expect(classifyTitlePage(bare)).toMatchObject({ kind: 'movie', unverified: true });
  });
});
