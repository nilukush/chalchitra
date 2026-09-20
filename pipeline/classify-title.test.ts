import { describe, expect, it } from 'vitest';
import { classifyTitlePage, hasNonIndianCountryCategory, shouldEvictNonIndian } from './classify-title.js';

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

  it('accepts episodic Infobox television as a series', () => {
    const page = `
{{Infobox television
| name = Some Show
| creator = X
| num_episodes = 40
| original_run = {{Start date|2020|1|1}}
| country = India
| language = Hindi
}}
`;
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

  it('treats {{Infobox television}} pages with director/runtime and no episodes as direct-to-TV/OTT FILMS (Mandela pattern)', () => {
    const ottFilm = `
{{Infobox television
| director = Madonne Ashwin
| runtime = 140 minutes
| released = {{Start date|2021|04|04|df=y}}
| country = India
| language = Tamil
}}
`;
    expect(classifyTitlePage(ottFilm)).toMatchObject({ kind: 'movie' });
  });

  it('keeps episodic {{Infobox television}} pages as series', () => {
    const episodic = `
{{Infobox television
| num_episodes = 42
| original_run = {{Start date|2020|01|01}}
| country = India
| language = Hindi
}}
`;
    expect(classifyTitlePage(episodic)).toMatchObject({ kind: 'series' });
  });
});

// ── Issue 4 side finding: non-Indian national categories ─────────────
describe('non-Indian country categories', () => {
  const series = (cats: string, extra = '') => `
{{Infobox television
| name = Headline
| num_episodes = 8
| original_run = {{Start date|2026|2|1}}
${extra}}}
${cats}
`;

  it('rejects an otherwise-unverified article that carries a non-Indian national debuts category', () => {
    // no country/language in the infobox → used to pass as { unverified: true }
    expect(classifyTitlePage(series('[[Category:2026 Bangladeshi television series debuts]]')))
      .toMatchObject({ reject: 'non-indian' });
    expect(classifyTitlePage(series('[[Category:2026 Pakistani television series debuts]]')))
      .toMatchObject({ reject: 'non-indian' });
    expect(classifyTitlePage(series('[[Category:2024 Sri Lankan films]]')))
      .toMatchObject({ reject: 'non-indian' });
  });

  it('a language-only infobox signal still admits despite a non-Indian category (infobox-first)', () => {
    // corrected precedence: the category veto fires only on signal-free pages;
    // bare-language pages stay admitted exactly as the wave gate always did —
    // rejecting them would need country data Wikipedia often omits
    expect(classifyTitlePage(series('[[Category:2026 Pakistani television series debuts]]', '| language = Hindi')))
      .toMatchObject({ kind: 'series' });
  });

  it('keeps Indian, global and category-free pages on the existing verdicts', () => {
    expect(classifyTitlePage(series('[[Category:2026 Indian television series debuts]]')))
      .toMatchObject({ kind: 'series' });
    expect(classifyTitlePage(series('[[Category:2026 web series debuts]]')))
      .toMatchObject({ kind: 'series' });
    expect(classifyTitlePage(series(''))).toMatchObject({ kind: 'series' });
  });

  it('hasNonIndianCountryCategory detects the pattern directly', () => {
    expect(hasNonIndianCountryCategory('x [[Category:2026 Bangladeshi television series debuts]] y')).toBe(true);
    expect(hasNonIndianCountryCategory('x [[Category:2026 Indian television series debuts]] y')).toBe(false);
    expect(hasNonIndianCountryCategory('no categories here')).toBe(false);
  });
});

// ── Eviction precision: shared-industry categories must not outrank the infobox ──
describe('non-Indian category vs infobox precedence', () => {
  const page = (infobox: string, cats: string) => `
{{Infobox film
| name = X
${infobox}}}
${cats}
`;

  it('an infobox country = India WINS over a stray Bangladeshi year category (Indian Bengali films carry both)', () => {
    expect(classifyTitlePage(page('| country = India\n| language = Bengali', '[[Category:2021 Bangladeshi films]][[Category:Indian films]]')))
      .toMatchObject({ kind: 'movie' });
    expect(classifyTitlePage(page('| country = India', '[[Category:2016 Bangladeshi films]]')))
      .toMatchObject({ kind: 'movie' });
  });

  it('an Indian-language infobox still accepts when only a Bangladeshi category is present', () => {
    expect(classifyTitlePage(page('| language = Bengali', '[[Category:2014 Bangladeshi films]]')))
      .toMatchObject({ kind: 'movie' });
  });

  it('rejects only when there is NO infobox country/language signal (the Headline shape)', () => {
    expect(classifyTitlePage(page('', '[[Category:2026 Bangladeshi television series debuts]]')))
      .toMatchObject({ reject: 'non-indian' });
  });

  it('shouldEvictNonIndian: full verdict decides, not the raw category regex', () => {
    expect(shouldEvictNonIndian(page('| country = India', '[[Category:2021 Bangladeshi films]]'))).toBe(false);
    expect(shouldEvictNonIndian(page('', '[[Category:2026 Pakistani television series debuts]]'))).toBe(true);
    expect(shouldEvictNonIndian(page('| country = India', ''))).toBe(false);
  });
});
