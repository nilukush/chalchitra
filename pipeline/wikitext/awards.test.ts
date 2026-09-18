import { describe, expect, it } from 'vitest';
import { extractAwards, extractInfoboxAwardTotals } from './awards.js';

const emraanStyle = `
== Accolades ==
{| class="wikitable"
|-
! Year !! Award !! Category !! Film !! Result
|-
| 2005 || [[Screen Awards|Screen Awards]] || Best Villain || ''[[Murder (2004 film)|Murder]]'' || {{nom}}
|-
| rowspan="2" | 2007 || [[Filmfare Awards]] || Best Performance in a Negative Role || ''[[Gangster (2006 film)|Gangster]]'' || {{Won}}
|-
| [[IIFA Awards]] || Best Supporting Actor || ''[[Once Upon a Time in Mumbaai]]'' || Nominated
|-
| 2010 || [[Stardust Awards]] || Best Actor || ''[[Once Upon a Time in Mumbaai]]'''''{{cite web|url=x}}'''
|}
The actor also received the [[Karnataka State Film Award for Best Actor]] twice.<ref>{{cite web|url=x}}</ref>
`;

const proseOnly = `
== Awards ==
She won the [[Filmfare OTT Award]] and later a [[SIIMA Award]].
`;

describe('extractAwards (structured)', () => {
  it('maps table columns to year, award, category, work, result', () => {
    const rows = extractAwards(emraanStyle);
    const first = rows.find((r) => r.work === 'Murder');
    expect(first).toMatchObject({
      year: '2005',
      award: 'Screen Awards',
      awardWikiTitle: 'Screen Awards',
      category: 'Best Villain',
      result: 'nominated',
    });
  });

  it('reads {{Won}}/{{nom}} templates and plain-text results', () => {
    const rows = extractAwards(emraanStyle);
    expect(rows.find((r) => r.work === 'Gangster')?.result).toBe('won');
    expect(rows.find((r) => r.work === 'Once Upon a Time in Mumbaai' && r.year === '2007')?.result).toBe('nominated');
  });

  it('carries rowspan years forward', () => {
    const rows = extractAwards(emraanStyle);
    expect(rows.find((r) => r.work === 'Once Upon a Time in Mumbaai' && r.category === 'Best Supporting Actor')?.year).toBe('2007');
  });

  it('strips rowspan/colspan/style attributes and citations from cells', () => {
    const rows = extractAwards(emraanStyle);
    for (const row of rows) {
      const joined = JSON.stringify(row);
      expect(joined).not.toMatch(/rowspan|colspan|style=|cite web|\{\{/i);
    }
  });

  it('captures award names from prose as label-only rows', () => {
    const rows = extractAwards(proseOnly);
    const award = rows.find((r) => r.award === 'Filmfare OTT Award');
    expect(award).toMatchObject({ awardWikiTitle: 'Filmfare OTT Award', result: '' });
    expect(rows.some((r) => r.award === 'SIIMA Award')).toBe(true);
  });

  it('returns [] without award sections', () => {
    expect(extractAwards('== Plot ==\ntext')).toEqual([]);
  });
});

// Real shapes from Emraan Hashmi's Accolades table (2026-08 session): the
// Award column itself is rowspan'd, and continuation rows carry only a
// category link + result — sometimes wikilinked to the award-CATEGORY
// article ("… Award for …"), which used to be promoted to the ceremony name.
const rowspanAwardPage = `
== Accolades ==
{| class="wikitable"
! Year !! Film !! Award !! Category !! Result
|-
| 2011 || ''[[Murder 2]]'' || rowspan="2" | IIFA Awards || [[IIFA Award for Best Performance in a Negative Role|Best Performance in a Negative Role]] || {{nom}}
|-
| [[IIFA Award for Best Supporting Actor|Best Supporting Actor]] || {{nom}}
|-
| 2011 || ''[[Murder 2]]'' || rowspan="2" | [[Producers Guild Film Awards]] || [[Apsara Award for Best Actor in a Supporting Role|Best Actor in a Supporting Role]] || {{nom}}
|-
| [[Apsara Award for Best Actor in a Negative Role|Best Actor in a Negative Role]] || {{nom}}
|}
`;

describe('extractAwards (rowspan award column)', () => {
  it('carries the ceremony name down rowspan continuation rows', () => {
    const rows = extractAwards(rowspanAwardPage);
    const supporting = rows.find((r) => r.category === 'Best Supporting Actor');
    expect(supporting).toMatchObject({ year: '2011', award: 'IIFA Awards', result: 'nominated' });
    const negative = rows.find((r) => r.category === 'Best Actor in a Negative Role');
    expect(negative).toMatchObject({ year: '2011', award: 'Producers Guild Film Awards', result: 'nominated' });
  });

  it('never promotes a wikilinked award-category article (… Award for …) to the ceremony field', () => {
    const rows = extractAwards(rowspanAwardPage);
    expect(rows.some((r) => /Best (Supporting|Negative) Actor/i.test(r.award))).toBe(false);
    expect(rows.every((r) => r.awardWikiTitle !== 'Apsara Award for Best Actor in a Negative Role')).toBe(true);
  });

  it('never fabricates an "—" ceremony; continuation work rows carry the rowspan film', () => {
    const rows = extractAwards(rowspanAwardPage);
    expect(rows.some((r) => r.award === '—' || r.award === '')).toBe(false);
    const supporting = rows.find((r) => r.category === 'Best Supporting Actor');
    expect(supporting?.work).toBe('Murder 2');
  });
});

// Verbatim shape of the REAL Emraan Hashmi Accolades table (session 15 user
// report): the FILM column carries the rowspan while the award is restated
// per row — the inverse of the fixture above. Used to lose Shanghai etc.
const rowspanFilmPage = `
== Accolades ==
{| class="wikitable"
|-
! Year
! Film
! Award
! Category
! Result
! Ref.
|-
| rowspan="2"|2007
| rowspan="2"|''[[Gangster (2006 film)|Gangster]]''
| [[Filmfare Awards]]
| [[Filmfare Award for Best Performance in a Negative Role|Best Performance in a Negative Role]]
| {{nom}}
| <ref>{{cite web|url=x}}</ref>
|-
| [[International Indian Film Academy Awards|IIFA Awards]]
| [[IIFA Award for Best Performance in a Negative Role|Best Performance in a Negative Role]]
| {{nom}}
| <ref>{{cite web|url=x}}</ref>
|-
| rowspan="3"|2013
| rowspan="3"|''[[Shanghai (2012 film)|Shanghai]]''
| Filmfare Awards
| Best Supporting Actor
| {{nom}}
| <ref>{{cite web|url=x}}</ref>
|-
| Screen Awards
| [[Screen Award for Best Supporting Actor|Best Supporting Actor]]
| {{nom}}
| <ref>{{cite web|url=x}}</ref>
|-
| Stardust Awards
| Best Actor – Thriller/Action
| {{nom}}
| <ref>{{cite web|url=x}}</ref>
|}
`;

describe('extractAwards (rowspan film column — the Shanghai bug)', () => {
  it('continuation rows inherit the rowspan film and year', () => {
    const rows = extractAwards(rowspanFilmPage);
    const screen = rows.find((r) => r.award === 'Screen Awards' && r.category === 'Best Supporting Actor');
    expect(screen).toMatchObject({
      year: '2013',
      work: 'Shanghai',
      workWikiTitle: 'Shanghai (2012 film)',
      result: 'nominated',
    });
    const iifa = rows.find((r) => r.award === 'IIFA Awards');
    expect(iifa).toMatchObject({ year: '2007', work: 'Gangster', workWikiTitle: 'Gangster (2006 film)' });
    const stardust = rows.find((r) => r.award === 'Stardust Awards' && r.year === '2013');
    expect(stardust?.work).toBe('Shanghai');
  });

  it('never inherits a work when the table has no work column', () => {
    const noWorkColumn = `
== Awards ==
{| class="wikitable"
|-
! Year !! Award !! Category !! Result
|-
| 2011 || Filmfare Awards || Best Supporting Actor || {{nom}}
|-
| 2011 || Screen Awards || Best Villain || {{nom}}
|}
`;
    const rows = extractAwards(noWorkColumn);
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.work === undefined)).toBe(true);
  });
});

// Title-page awards (Step 3): film/series articles carry "Awards"/"Accolades"
// sections with their own column shapes — Recipients/Nominee(s) instead of
// Work, years sometimes wikilinked to the ceremony edition, "Award Ceremony"
// headers. Verbatim from Arth (film) and Tia Bajpai's pages.
const titleAwardsArth = `
==Awards==
{| class="wikitable plainrowheaders sortable"
|-
!scope=col|Year
!scope=col|Award
!scope=col|Category
!scope=col|Nominee(s)
!scope=col|Result
|-
| rowspan="2" |[[30th National Film Awards|1982]]
| rowspan="2" |[[National Film Awards]]
|[[National Film Award for Best Actress|Best Actress]]
|[[Shabana Azmi]]
|{{Won}}
|-
|[[National Film Award for Best Editing|Best Editing]]
|Keshav Hirani
|{{Won}}
|}
`;

const titleAwardsMirchi = `
== Accolades ==
{| class="wikitable"
! Award Ceremony
! Category
! Recipient
! Result
! Ref.(s)
|-
| [[4th Mirchi Music Awards]]
| [[Mirchi Music Award for Upcoming Female Vocalist of The Year|Upcoming Female Vocalist of The Year]]
| "Sheet Leher" from ''[[Lanka (2011 film)|Lanka]]''
| {{won}}
|<ref>{{Cite web |url=x}}</ref>
|}
`;

// ---------------------------------------------------------------------------
// Bullet-list awards (docs/ISSUES.md #1). Wikipedia's convention for honours
// lists (mid-tier / regional / director pages): "* 2025 — Best Director, …".
// Verbatim fixtures from the cached articles of anuparna-roy (81004770),
// nedumudi-venu (497622), a-k-lohithadas (4138353), o-n-v-kurup (10436191),
// manoj-k-jayan (6536967), susanne-bier (2091579), anupam-roy (28968626) and
// Chaitanya Tamhane's article. Honours lists are wins by convention; explicit
// "(Nominated)" markers override.
// ---------------------------------------------------------------------------
const bulletAnuparna = `
== Awards ==
* 2025 — Best Director, Orizzonti section, [[Venice Film Festival|Venice International Film Festival]].<ref name=":0" />
`;

const bulletNedumudi = `
==Awards==

=== [[National Film Awards]] ===
* 1990 – [[National Film Award for Best Supporting Actor|Best Supporting Actor]] – ''[[His Highness Abdullah]]''
* 2006  – [[National Film Award for Best Non-Feature Film Narration / Voice Over]] – ''Minukku''

=== [[Kerala State Film Awards]] ===
* 1980 – [[Kerala State Film Award for Second Best Actor|Second Best Actor]] – ''[[Chamaram]]''

=== [[Vanitha Film Awards]] ===
2015 – [[Vanitha Film Awards|Best Actor In A Negative Role]] – ''[[Oru Second Class Yathra|Oru Second Class Yatra]]''
`;

const bulletLohithadas = `
==Awards==
[[File:Lohitadas.jpg|thumb|right|300px|Lohithadas]]
; [[National Film Awards]]:

* 1998 – [[Indira Gandhi Award for Best Debut Film of a Director]] – ''[[Bhoothakannadi]]''<ref>{{cite web|url=x}}</ref>

; [[Kerala State Film Awards]]:

* 1987 – [[Kerala State Film Award for Best Story|Best Story]] – ''[[Thaniyavarthanam]]''<ref name="1981-90" />
`;

const bulletOnvKurup = `
==Awards==
* 2011 – [[Padma Vibhushan]]<ref>{{cite web|url=x}}</ref>
* 2007 – [[D.Litt|Honorary Doctorate]] by [[University of Kerala]]<ref>{{cite web|url=x}}</ref>
`;

const bulletManojPlain = `
===Other awards===
*Film Artsclub Award
* Kerala State Film Award (Second Best Actor)
*Variety Cinema Award (Best Villain)
`;

const bulletSusanneNested = `
== Awards and nominations ==
;''Freud's Leaving Home'' (''Freud flytter hjemmefra...'') (1991)
* 1992 Angers European First Film Festival
** Audience Award: Feature Film
* 1992 [[27th Guldbagge Awards|Guldbagge Awards]]
** Best Director (Nominated)<ref name="27thGuldbagge">{{cite web|url=x}}</ref>
`;

const bulletAnupamCompound = `
==Awards and recognitions==
* Big Bangla Movie Awards 2011 – Best Lyricist – ''Amake Amar Moto Thakte Dao''
* Zee Bangla Gourab Award 2011 – Best Lyricist – ''Amake Amar Moto Thakte Dao''
`;

const bulletTamhane = `
==Awards==
* Best Feature Film ''[[Court (2014 film)|Court]]'' at [[62nd National Film Awards]], 2015<ref>{{cite web|url=x}}</ref>
* Best Screenplay, [[The Disciple (2020 film)|''The Disciple'']] at [[77th Venice International Film Festival]].
`;

const bulletRathnam = `
==Awards==
'''[[Filmfare Awards South]]'''
* [[Filmfare Award for Best Film – Telugu]] – ''[[Karthavyam (1990 film)|Karthavyam]]'' (1990)

'''[[Tamil Nadu State Film Awards]]'''
* [[Tamil Nadu State Film Award for Best Film]] (First Prize) – ''[[Indian (1996 film)|Indian]]''  (1996)
`;

describe('extractAwards (bullet honours lists — the anuparna-roy bug)', () => {
  it('parses the year-leading em-dash bullet (issue example: anuparna-roy)', () => {
    const rows = extractAwards(bulletAnuparna);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      year: '2025',
      award: 'Venice International Film Festival',
      awardWikiTitle: 'Venice Film Festival',
      category: 'Best Director',
      result: 'won',
    });
  });

  it('uses wikilinked === subsection titles as the ceremony context (nedumudi-venu)', () => {
    const rows = extractAwards(bulletNedumudi);
    const supporting = rows.find((r) => r.category === 'Best Supporting Actor');
    expect(supporting).toMatchObject({
      year: '1990',
      award: 'National Film Awards',
      work: 'His Highness Abdullah',
      workWikiTitle: 'His Highness Abdullah',
      result: 'won',
    });
    // non-Feature narration link is a category article, not the ceremony
    const narration = rows.find((r) => /Non-Feature Film Narration/i.test(r.category ?? ''));
    expect(narration).toMatchObject({ year: '2006', award: 'National Film Awards', work: 'Minukku' });
    const second = rows.find((r) => r.category === 'Second Best Actor' && r.award === 'Kerala State Film Awards');
    expect(second).toMatchObject({ year: '1980', work: 'Chamaram' });
  });

  it('parses non-bullet year-leading lines inside award subsections', () => {
    const rows = extractAwards(bulletNedumudi);
    const vanitha = rows.find((r) => r.year === '2015');
    expect(vanitha).toBeTruthy();
    expect(vanitha?.work).toBe('Oru Second Class Yatra');
  });

  it('treats ; [[Ceremony]]: definition headers as award context and drops hollow shells (a-k-lohithadas)', () => {
    const rows = extractAwards(bulletLohithadas);
    const debut = rows.find((r) => /Indira Gandhi Award/.test(r.category ?? r.award));
    expect(debut).toMatchObject({
      year: '1998',
      award: 'National Film Awards',
      awardWikiTitle: 'National Film Awards',
      work: 'Bhoothakannadi',
      result: 'won',
    });
    // every emitted row is substantive — no label-only "National Film Awards" shells
    expect(rows.some((r) => r.award === 'National Film Awards' && !r.year && !r.work && !r.category)).toBe(false);
  });

  it('captures decoration/honour links without a category (o-n-v-kurup)', () => {
    const rows = extractAwards(bulletOnvKurup);
    const padma = rows.find((r) => r.award === 'Padma Vibhushan');
    expect(padma).toMatchObject({ year: '2011', result: 'won' });
    const dLitt = rows.find((r) => /Honorary Doctorate/.test(r.award));
    expect(dLitt).toMatchObject({ year: '2007' });
  });

  it('extracts plain-text award names and parenthesised categories (manoj-k-jayan)', () => {
    const rows = extractAwards(bulletManojPlain);
    const artsclub = rows.find((r) => r.award === 'Film Artsclub Award');
    expect(artsclub).toMatchObject({ result: 'won' });
    const kerala = rows.find((r) => r.award === 'Kerala State Film Award');
    expect(kerala).toMatchObject({ category: 'Second Best Actor' });
  });

  it('nests ** category bullets under * ceremony bullets with work context from ; definitions (susanne-bier)', () => {
    const rows = extractAwards(bulletSusanneNested);
    const director = rows.find((r) => r.category === 'Best Director');
    expect(director).toMatchObject({
      year: '1992',
      award: 'Guldbagge Awards',
      awardWikiTitle: '27th Guldbagge Awards',
      work: "Freud's Leaving Home",
      result: 'nominated',
    });
    const audience = rows.find((r) => r.category === 'Audience Award: Feature Film');
    expect(audience).toMatchObject({ year: '1992', award: 'Angers European First Film Festival', result: 'won' });
    // ceremony-header bullets (their detail lives in ** children) must not
    // emit their own category-less rows
    expect(rows.some((r) => r.award === 'Guldbagge Awards' && !r.category)).toBe(false);
  });

  it('matches compound section titles like "Awards and recognitions" (anupam-roy)', () => {
    const rows = extractAwards(bulletAnupamCompound);
    expect(rows).toHaveLength(2);
    const bigBangla = rows[0];
    expect(bigBangla).toMatchObject({
      year: '2011',
      award: 'Big Bangla Movie Awards',
      category: 'Best Lyricist',
      work: 'Amake Amar Moto Thakte Dao',
      result: 'won',
    });
  });

  it('parses award-first bullets with work and trailing year (Chaitanya Tamhane)', () => {
    const rows = extractAwards(bulletTamhane);
    const court = rows.find((r) => r.work === 'Court');
    expect(court).toMatchObject({
      category: 'Best Feature Film',
      award: '62nd National Film Awards',
      year: '2015',
    });
    const disciple = rows.find((r) => r.work === 'The Disciple');
    // ordinal edition implies the year — must stay undefined, never guessed
    expect(disciple?.year).toBeUndefined();
    expect(disciple).toMatchObject({ category: 'Best Screenplay', award: '77th Venice International Film Festival' });
  });

  it('uses bold \'\'\'[[Ceremony]]\'\'\' headers as context, paren years as year, paren qualifiers never as award (a-m-rathnam)', () => {
    const rows = extractAwards(bulletRathnam);
    const filmfare = rows.find((r) => r.work === 'Karthavyam');
    expect(filmfare).toMatchObject({
      year: '1990',
      award: 'Filmfare Awards South',
      awardWikiTitle: 'Filmfare Awards South',
      category: 'Filmfare Award for Best Film – Telugu',
      result: 'won',
    });
    const state = rows.find((r) => r.work === 'Indian');
    expect(state).toMatchObject({ year: '1996', award: 'Tamil Nadu State Film Awards', category: 'Tamil Nadu State Film Award for Best Film' });
    expect(state?.award).not.toMatch(/Prize/i);
  });

  it('never parses bullets outside award sections (filmography scope gate)', () => {
    const notAwards = `
==Filmography==
* 2011 – ''[[Some Film]]'' as Director
== Plot ==
* Best Director award something
`;
    expect(extractAwards(notAwards)).toEqual([]);
  });
});

// Ceremony-less tables under award-ish subsection headings (Amit Trivedi
// shape, pageid 20692293): the ceremony lives in the === heading, the table
// carries Year|Nominated work|Category|Result only.
const ceremonyInHeading = `
==Awards and nominations==
===National Film Awards===

{| class="wikitable plainrowheaders sortable"
|-
! Year
! Nominated work
! Category
! Result
|-
|[[57th National Film Awards|2009]]
|''[[Dev.D]]''
|[[National Film Award for Best Music Direction|Best Music Director]]
|{{won}}
|}

===Filmfare Awards===

{| class="wikitable"
|-
! Year
! Nominated work
! Category
! Result
|-
|[[55th Filmfare Awards|2010]]
|''[[Dev.D]]''
|[[Filmfare RD Burman Award for New Music Talent|RD Burman Award for New Music Talent]]
|{{won}}
|}
`;

describe('extractAwards (ceremony in the subsection heading)', () => {
  it('fills the award from the heading when the table has no ceremony column', () => {
    const rows = extractAwards(ceremonyInHeading);
    const music = rows.find((r) => r.category === 'Best Music Director');
    expect(music).toMatchObject({
      year: '2009',
      award: 'National Film Awards',
      work: 'Dev.D',
      workWikiTitle: 'Dev.D',
      result: 'won',
    });
    const rdBurman = rows.find((r) => r.category === 'RD Burman Award for New Music Talent');
    expect(rdBurman).toMatchObject({ year: '2010', award: 'Filmfare Awards', work: 'Dev.D' });
  });

  it('maps "Nominated work" to the work field', () => {
    const rows = extractAwards(ceremonyInHeading);
    expect(rows.every((r) => r.work === 'Dev.D')).toBe(true);
  });
});

// Awards subpages ("List of awards and nominations received by X"): ceremony-
// titled === sections and tables in the page lead. Without the subpage flag
// these sections are out of scope; with it, the whole page is award content.
const awardsSubpage = `
This is a list of awards and nominations received by [[Someone]], with over
fifty wins. He won the [[Filmfare Award for Best Actor]] twice.

{| class="wikitable"
! Year !! Award !! Category !! Work !! Result
|-
| 2010 || [[Screen Awards]] || Best Actor || ''[[Film A]]'' || {{won}}
|}

==Film awards==

===Filmfare Awards===
{| class="wikitable"
! Year !! Category !! Work !! Result
|-
| 2012 || Best Supporting Actor || ''[[Film B]]'' || Nominated
|}

==References==
{{Reflist}}
`;

describe('extractAwards (awards subpage mode)', () => {
  it('reads the lead table and ceremony-titled sections with { subpage: true }', () => {
    const rows = extractAwards(awardsSubpage, 120, { subpage: true });
    const lead = rows.find((r) => r.work === 'Film A');
    expect(lead).toMatchObject({ year: '2010', award: 'Screen Awards', category: 'Best Actor', result: 'won' });
    const supporting = rows.find((r) => r.work === 'Film B');
    expect(supporting).toMatchObject({ year: '2012', award: 'Filmfare Awards', result: 'nominated' });
    expect(rows.some((r) => /Reflist|References/i.test(r.award))).toBe(false);
    // lead prose must not emit shells: category articles, list self-references
    // or generic phrases are not ceremonies
    expect(rows.some((r) => !r.year && !r.work && !r.category)).toBe(false);
  });

  it('without the flag the page lead is not parsed (ceremony-titled sections still match by title)', () => {
    const rows = extractAwards(awardsSubpage);
    expect(rows.find((r) => r.work === 'Film A')).toBeUndefined();
  });
});

const editionLinkAwards = `
==Awards and nominations==
{| class="wikitable"
! Year !! Award !! Category !! Work !! Result
|-
| 2024 || [[58th Maharashtra State Film Awards|2024]] || Best Actress || ''[[Film X]]'' || {{won}}
|-
| 1995 || [[2nd Screen Actors Guild Awards|1995]] || Outstanding Ensemble in a Comedy Series || ''[[Seinfeld]]'' || Nominated
|}
`;

describe('extractAwards (edition-link display years)', () => {
  it('reads [[58th …|2024]] award cells as ceremony + year, never award "2024"', () => {
    const rows = extractAwards(editionLinkAwards);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ award: '58th Maharashtra State Film Awards', year: '2024', result: 'won' });
    expect(rows[1]).toMatchObject({ award: '2nd Screen Actors Guild Awards', year: '1995', result: 'nominated' });
    expect(rows.some((r) => /^\d{4}$/.test(r.award))).toBe(false);
  });
});

// {{awards table}} template (aftab-shivdasani shape, pageid 1108304): the
// template OPENS a table (no {| of its own, no header row) that continues
// with |- row syntax and closes with |}. Single award column holding
// "… Award for …" category links — there is no separate ceremony column.
const awardsTableTemplate = `
== Awards ==
{{awards table}}
|-
|rowspan="2"|2000
|rowspan="2"|''[[Mast (film)|Mast]]''
| [[Star Screen Award for Most Promising Newcomer - Male]]
| {{won}}
|-
| [[Zee Cine Award for Best Male Debut]]
| {{won}}
|-
| 2005
| ''[[Masti (2004 film)|Masti]]''
| [[Bollywood Movie Awards|Bollywood Movie Award for Best Comedian]]
| {{won}}
|}
`;

describe('extractAwards ({{awards table}} template)', () => {
  it('parses template-opened tables positionally', () => {
    const rows = extractAwards(awardsTableTemplate);
    const newcomer = rows.find((r) => /Most Promising Newcomer/.test(r.award));
    expect(newcomer).toMatchObject({ year: '2000', work: 'Mast', result: 'won' });
    const debut = rows.find((r) => /Male Debut/.test(r.award));
    expect(debut).toMatchObject({ year: '2000', work: 'Mast', workWikiTitle: 'Mast (film)', result: 'won' });
    const comedian = rows.find((r) => /Best Comedian/.test(r.award));
    expect(comedian).toMatchObject({ year: '2005', work: 'Masti', awardWikiTitle: 'Bollywood Movie Awards', result: 'won' });
  });
});

// Bullets INSIDE table cells (manoj-k-jayan shape, pageid 6536967): the Award
// cell holds a multi-line bullet list; tables.ts drops non-|/! lines by
// default, so the cell read empty and the row died at the award gate.
const bulletsInCells = `
==Awards==
{| class="wikitable sortable"
|+ List of awards received by Manoj K. Jayan
|-
! scope="col" | Year
! scope="col" | Title
! scope="col" | Award
|-
|1992
|''[[Perumthachan (film)|Perumthachan]]''
|
*Film Artsclub Award
|-
|1993
|''[[Sargam (1992 film)|Sargam]]''
|
* Kerala State Film Award (Second Best Actor)
*Film Critics Award
|}
`;

describe('extractAwards (bullet lists inside table cells)', () => {
  it('expands a bullet-filled award cell into one row per bullet, sharing year and work', () => {
    const rows = extractAwards(bulletsInCells);
    expect(rows).toHaveLength(3);
    const artsclub = rows.find((r) => r.award === 'Film Artsclub Award');
    expect(artsclub).toMatchObject({ year: '1992', work: 'Perumthachan', workWikiTitle: 'Perumthachan (film)' });
    const kerala = rows.find((r) => r.award === 'Kerala State Film Award (Second Best Actor)');
    expect(kerala).toMatchObject({ year: '1993', work: 'Sargam' });
    const critics = rows.find((r) => r.award === 'Film Critics Award');
    expect(critics).toMatchObject({ year: '1993', work: 'Sargam' });
  });
});

// A table with no Result column is an honours list — the same won-by-
// convention the bullet-list walk applies (a "(Nominated)" marker overrides).
// Without it the site counter read "1 wins" above manoj-k-jayan's 69 rows.
const bulletsInCellsNominated = `
==Awards==
{| class="wikitable"
! Year !! Title !! Award
|-
| 2020
| ''[[Film X (film)|Film X]]''
|
*Best Actor (nominated)
*Critics' Choice Award
|}
`;

const resultColumnBlankCell = `
==Awards==
{| class="wikitable"
! Year !! Film !! Award !! Result
|-
| 2021 || ''[[Film Y (film)|Film Y]]'' || [[Screen Awards]] ||
|}
`;

describe('extractAwards (won-by-convention on result-less tables)', () => {
  it('fills result won for rows from tables without a Result column', () => {
    const rows = extractAwards(bulletsInCells);
    expect(rows).toHaveLength(3);
    for (const r of rows) expect(r.result).toBe('won');
  });

  it('a nominated marker inside a result-less table row overrides the convention', () => {
    const rows = extractAwards(bulletsInCellsNominated);
    const actor = rows.find((r) => /Best Actor/.test(r.award));
    expect(actor?.result).toBe('nominated');
    expect(actor?.award).toBe('Best Actor');
    expect(rows.find((r) => /Critics/.test(r.award))?.result).toBe('won');
  });

  it('tables WITH a Result column keep a blank result empty (unknown stays unknown)', () => {
    const rows = extractAwards(resultColumnBlankCell);
    const row = rows.find((r) => r.award === 'Screen Awards');
    expect(row).toMatchObject({ work: 'Film Y', result: '' });
  });
});

describe('extractAwards (title-page shapes)', () => {
  it('maps Nominee(s) to recipients and reads wikilinked years', () => {
    const rows = extractAwards(titleAwardsArth);
    const actress = rows.find((r) => r.category === 'Best Actress');
    expect(actress).toMatchObject({
      year: '1982',
      award: 'National Film Awards',
      recipients: 'Shabana Azmi',
      result: 'won',
    });
  });

  it('continuation rows carry the rowspan year+award and their own recipient', () => {
    const rows = extractAwards(titleAwardsArth);
    const editing = rows.find((r) => r.category === 'Best Editing');
    expect(editing).toMatchObject({ year: '1982', award: 'National Film Awards', recipients: 'Keshav Hirani', result: 'won' });
  });

  it('maps Award Ceremony / Recipient headers (no year column)', () => {
    const rows = extractAwards(titleAwardsMirchi);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      award: '4th Mirchi Music Awards',
      awardWikiTitle: '4th Mirchi Music Awards',
      category: 'Upcoming Female Vocalist of The Year',
      result: 'won',
    });
  });
});

// {{Infobox awards list}} (38 "List of awards…" subpages): editors compile
// aggregate wins/nominations there — totals plus per-ceremony counts. Used as
// ground truth for coverage audits of the row parser.
const infoboxAwardsList = `
{{Use Indian English|date=February 2023}}
{{Infobox awards list
| name = [[Gulzar]]
| wins = 43
| nominations = 92
| award1 = [[National Film Awards]]
| award1W = 6
| award1N = 6
| award2 = [[Filmfare Awards]]
| award2W = 22
| award2N = 51
| award3 = [[Sahitya Akademi Award]]s
| award3W = 1
| award3N = 1
| award10 = Honours
| award10W = 4
| award10N = 4
}}
`;

describe('extractInfoboxAwardTotals', () => {
  it('reads wins/nominations totals and per-ceremony aggregates', () => {
    const totals = extractInfoboxAwardTotals(infoboxAwardsList);
    expect(totals).not.toBeNull();
    expect(totals!.wins).toBe(43);
    expect(totals!.nominations).toBe(92);
    expect(totals!.ceremonies).toHaveLength(4);
    expect(totals!.ceremonies[0]).toMatchObject({ award: 'National Film Awards', awardWikiTitle: 'National Film Awards', wins: 6, nominations: 6 });
    expect(totals!.ceremonies[1]).toMatchObject({ award: 'Filmfare Awards', wins: 22, nominations: 51 });
    expect(totals!.ceremonies[2]).toMatchObject({ award: 'Sahitya Akademi Awards', awardWikiTitle: 'Sahitya Akademi Award' });
    expect(totals!.ceremonies[3]).toMatchObject({ award: 'Honours', wins: 4, nominations: 4 });
  });

  it('returns null when the page has no infobox awards list', () => {
    expect(extractInfoboxAwardTotals('==Awards==\nplain page')).toBeNull();
  });
});
