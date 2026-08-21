import { describe, expect, it } from 'vitest';
import { classifyPersonPage } from './classify-person.js';

const actorPage = `{{Infobox person
| name = Aadhi Pinisetty
| occupation = {{hlist|Actor|Producer}}
| birth_date = {{Birth date and age|1988|12|14|df=y}}
}}
'''Aadhi Pinisetty''' is an Indian actor.
[[Category:Indian male film actors]]`;

const stubActorNoInfobox = `'''X Y''' is an Indian film director.
[[Category:Indian film directors]]
[[Category:Living people]]`;

const disambiguation = `{{Disambiguation}}
* '''X Y''' may refer to a person or a film.`;

const filmPage = `{{Infobox film | name = Something | starring = [[Aadhi Pinisetty]]}}
A film article, not a person.`;

const songPage = `{{Infobox song | name = Tamma Tamma Again}}
A song article.`;

const randomArticle = `An article about a temple with no person markers at all.
[[Category:Hindu temples in Kerala]]`;

describe('classifyPersonPage', () => {
  it('accepts {{Infobox person}} pages', () => {
    expect(classifyPersonPage(actorPage)).toEqual({ ok: true });
  });

  it('accepts occupation-specific person infoboxes', () => {
    expect(classifyPersonPage(`{{Infobox actor | name = X}}`)).toEqual({ ok: true });
    expect(classifyPersonPage(`{{Infobox musical artist | name = X | genre = Film score}}`)).toEqual({ ok: true });
  });

  it('accepts infobox-less stubs that carry Indian-cinema person categories', () => {
    expect(classifyPersonPage(stubActorNoInfobox)).toEqual({ ok: true });
  });

  it('rejects disambiguation pages', () => {
    expect(classifyPersonPage(disambiguation)).toEqual({ reject: 'disambiguation' });
  });

  it('rejects title/song pages (wrong infobox type)', () => {
    expect(classifyPersonPage(filmPage)).toMatchObject({ reject: expect.stringContaining('wrong-type') });
    expect(classifyPersonPage(songPage)).toMatchObject({ reject: expect.stringContaining('wrong-type') });
  });

  it('rejects pages with no person markers', () => {
    expect(classifyPersonPage(randomArticle)).toEqual({ reject: 'no-person-markers' });
  });
});
