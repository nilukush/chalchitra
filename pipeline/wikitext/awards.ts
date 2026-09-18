/**
 * Awards & accolades from a person's or title's Wikipedia article, structured
 * the way Wikipedia presents them: year, award, category, work and result
 * (won/nominated). Three source shapes:
 *  - wikitables (rowspan/colspan grid-aligned), the "Awards and nominations"
 *    convention for famous subjects;
 *  - bullet honours lists ("* 2025 — Best Director, Orizzonti section,
 *    [[Venice Film Festival|…]]") — the convention for mid-tier, regional and
 *    director pages; honours lists are wins by convention, an explicit
 *    "(Nominated)" marker overrides;
 *  - subpages ("List of awards and nominations received by X") where the
 *    ceremony often lives in the === section heading rather than a table
 *    column or the bullet itself.
 * Result templates ({{Won}}, {{nom}}) are read before stripWikitext can
 * delete them. Award names wikilinked in surrounding prose become label-only
 * rows, dropped when a fuller row already names the same award.
 */
import { stripWikitext } from './clean.js';
import { extractSections, type WikiSection } from './sections.js';
import { extractWikiLinks } from './links.js';
import { parseWikitableView } from './tables.js';

export type AwardResult = 'won' | 'nominated' | '';

export interface AwardRow {
  year?: string;
  award: string;
  awardWikiTitle?: string;
  category?: string;
  work?: string;
  workWikiTitle?: string;
  /** title-page tables: the nominee(s)/recipient named in the row */
  recipients?: string;
  result: AwardResult;
}

export interface ExtractAwardsOptions {
  /** the wikitext IS a "List of awards and nominations received by X" page:
   *  every section (and the lead) is award content, not just award-titled
   *  ones. Passed by build-dataset for the followed awards subpage. */
  subpage?: boolean;
}

/** Section titles that hold awards — unanchored on purpose: matches "Awards",
 *  "Accolades", "Awards and nominations", compound titles ("Awards and
 *  recognitions", "Honours and awards"), ceremony-titled subsections
 *  ("===National Film Awards===") and subpage groups ("==Film awards=="). */
const AWARD_SECTION_TITLE = /accolad|award|honou?r|recogni/i;

const AWARD_NAME_HINT =
  /(award|awardshistory|honou?r|prize|medal|padam|padma|national film|filmfare|siima|iifa|screen|stardust|zee cine|nandi|karnataka state|kerala state|tamil nadu state|national|festival)/i;

/** Award-ish noun inside plain-text bullet segments ("Kerala State Film
 *  Award", "Angers European First Film Festival"). */
const AWARD_NOUN =
  /\b(awards?|honou?rs?|honors?|honorary|doctorate|prizes?|medals?|festivals?|samman|puraskaram?|fellowship)\b/i;

/** Category-looking text: comma/dash segments and parentheticals. */
const CATEGORY_START =
  /^(best|special|jury|lifetime|life ?time|runner|grand prix|silver|gold|second|versatile|upcoming|special mention|outstanding)/i;

/** Heading words that alone name no ceremony — a title made only of these
 *  ("Awards", "Awards and recognitions", "Film awards", "Other awards")
 *  provides section scope but no award carry-down. */
const GENERIC_HEADING_WORDS =
  /\b(awards?|accolades?|honou?rs?|honors?|nominations?|recognition|recognitions?|and|other|list|of|received|film|films|television|tv|series|cinema|for|the)\b/gi;

/** A specific ceremony named by a section heading or definition-list entry:
 *  "===National Film Awards===", "; [[Kerala State Film Awards]]:". */
function ceremonyFromTitle(title: string): { award: string; awardWikiTitle?: string } | null {
  const link = extractWikiLinks(title)[0];
  const text = stripWikitext(title).replace(/''/g, '').replace(/\s+/g, ' ').replace(/[:\s]+$/, '').trim();
  if (!text || !AWARD_NAME_HINT.test(text)) return null;
  const specific = text.replace(GENERIC_HEADING_WORDS, '').replace(/[^a-z0-9]/gi, ' ').trim();
  if (!specific) return null;
  return { award: text, awardWikiTitle: link?.target };
}

/** Work mention in a line: ''[[X]]'' / [[X|''Y'']] italics or a plain
 *  ''italic'' title (the ; definition entries group bullets by work). */
function readWorkFromLine(s: string): { work: string; workWikiTitle?: string } | null {
  let m = /''\s*\[\[([^\]|]+)(?:\|([^\]]*))?\]\]\s*''/.exec(s);
  if (m) {
    const work = (m[2] ?? m[1]).replace(/''/g, '').trim();
    return work ? { work, workWikiTitle: m[1].trim() } : null;
  }
  m = /\[\[([^\]|]+)\|''([^']+)''\]\]/.exec(s);
  if (m) return { work: m[2].trim(), workWikiTitle: m[1].trim() };
  m = /''(.+?)''/.exec(s);
  if (m) {
    const work = m[1].trim();
    return work.length >= 2 ? { work } : null;
  }
  return null;
}

/** Context carried into list lines: ceremony from ; definitions and the
 *  nearest ceremony-bearing heading; work from ; definitions. */
interface ListCtx {
  award?: string;
  awardWikiTitle?: string;
  work?: string;
  workWikiTitle?: string;
}

interface ListParts {
  year?: string;
  award?: string;
  awardWikiTitle?: string;
  category?: string;
  work?: string;
  workWikiTitle?: string;
  result: AwardResult;
}

/** Parse one honours-list line. `subBullet` lines (** children) carry the
 *  detail level: their text is the category, the ceremony/year comes from
 *  the parent bullet. Returns null when the line shows no award signal of
 *  its own (prose fragments, bare refs). */
function parseListLine(rawLine: string, subBullet: boolean): ListParts | null {
  const cleaned = rawLine
    .replace(/<ref[^>]*\/>/gi, '')
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, '')
    .replace(/\[\[(?:File|Image|Media):[^\]]*\]\]/gi, '')
    .replace(/\{\{\s*(?:expand list|unreferenced section?|BLP unreferenced section|citation needed|cn)[^{}]*\}\}/gi, '')
    .replace(/^\s*[:#*]+\s*/, '')
    .replace(/\s+/g, ' ')
    .replace(/\.\s*$/, '')
    .trim();
  if (!cleaned) return null;

  const links = extractWikiLinks(cleaned);
  // bullets open with a year, a capitalised name or a wikilink — a lowercase
  // word or a pronoun-verb sentence means prose that happens to be bulleted
  if (/^[a-z]/.test(cleaned) && !/^\d{4}/.test(cleaned)) return null;
  if (/\b(he|she|they)\s+(was|were|is|are|received|accepted|served|has|have)\b/i.test(cleaned)) return null;

  const parts: ListParts = {
    result: /\bnominat/i.test(cleaned) || /\{\{\s*(nom|n)\s*[|}]/i.test(cleaned) ? 'nominated' : 'won',
  };

  // year: leading ("2025 — …", "1992 Angers…", "In 2002, …"), an edition link
  // whose display is the year ([[61st National Film Awards|2013]]), or
  // trailing (", 2015")
  const leading = /^\s*(?:in\s+)?(\d{4})\s*(?:[–—:-]\s*|,?\s+|\s(?=\S))/.exec(cleaned);
  if (leading) parts.year = leading[1];
  const edition = links.find((l) => YEARISH.test(l.label));
  if (!parts.year && edition) parts.year = edition.label.match(/\d{4}/)?.[0];

  // ceremony wikilink vs award-category article link (… Award for …)
  const catLink = links.find((l) => /\baward for\b/i.test(l.target));
  if (catLink) parts.category = catLink.label.replace(/''/g, '').trim();
  const ceremony = links.find(
    (l) => l !== edition && l !== catLink && AWARD_NAME_HINT.test(l.target) && !/\baward for\b/i.test(l.target),
  );
  if (ceremony) {
    parts.award = ceremony.label.replace(/''/g, '').trim();
    parts.awardWikiTitle = ceremony.target;
  }

  // work: italic shapes, then a "for <work>" clause
  const wk = readWorkFromLine(cleaned);
  if (wk && wk.work !== parts.award && !(wk.workWikiTitle && wk.workWikiTitle === parts.awardWikiTitle)) {
    parts.work = wk.work;
    parts.workWikiTitle = wk.workWikiTitle;
  }
  if (!parts.work) {
    const forM = /\bfor\s+(?:''(?:\[\[([^\]|]+)(?:\|([^\]]*))?\]\]|([^'|.'']+))''|\[\[([^\]|]+)(?:\|([^\]]*))?\]\]|'([^']+)')/.exec(
      cleaned,
    );
    if (forM) {
      const target = forM[1] ?? forM[4];
      const work = (forM[2] ?? forM[5] ?? forM[3] ?? forM[6] ?? target ?? '')
        .replace(/''/g, '')
        .trim();
      if (work && work !== parts.award) {
        parts.work = work;
        parts.workWikiTitle = target?.trim();
      }
    }
  }

  // plain-text residue: category parentheticals, award-noun segments,
  // trailing years
  let text = stripWikitext(cleaned).replace(/''/g, '').replace(/\s+/g, ' ').trim();
  if (parts.year) text = text.replace(new RegExp(`^${parts.year}\\s*(?:[–—:-]\\s*|\\s(?=\\S))?`), '');
  const paren = /\(([^()]*)\)\s*$/.exec(text);
  if (paren && /^\d{4}$/.test(paren[1].trim())) {
    // trailing "(1996)" is the ceremony year
    parts.year ??= paren[1].trim();
  } else if (paren && CATEGORY_START.test(paren[1].trim())) {
    parts.category ??= paren[1].trim();
  }
  if (paren) text = text.slice(0, paren.index).trim();
  for (const consumed of [parts.work, parts.award, parts.category]) {
    if (consumed) text = text.replace(consumed, ' ');
  }
  const segs = text
    .split(/\s*[–—]\s*|\s+-\s+|\s*:\s*|\s*,\s*/)
    .map((sg) => sg.trim())
    .filter(Boolean);

  if (subBullet) {
    // detail level: the whole text is the category (minus result markers)
    parts.category ??= text
      .replace(/\((?:nominated|won|winner)\)\s*$/i, '')
      .replace(/(?:nominated|won|winner)\s*$/i, '')
      .trim();
    if (!parts.category) return parts.year || parts.award ? parts : null;
    return parts;
  }

  if (!parts.award) {
    const awardSeg = segs.find((sg) => AWARD_NOUN.test(sg) && !CATEGORY_START.test(sg));
    if (awardSeg) {
      let a = awardSeg;
      const ym = /,?\s*(?:in\s+)?(\d{4})\s*$/.exec(a);
      if (ym) {
        parts.year ??= ym[1];
        a = a.slice(0, ym.index);
      }
      a = a.split(/\s+(?:by|at)\s+/)[0].replace(/^\(\s*/, '').replace(/\s*\)+$/, '').trim();
      // "(First Prize)"-style qualifiers describe the category, not a ceremony
      if (a && !/^(first|second|third|joint|shared|special)\b/i.test(a)) {
        parts.award = a;
      }
    }
  }
  if (!parts.category) {
    const catSeg = segs.find((sg) => CATEGORY_START.test(sg));
    if (catSeg) parts.category = catSeg.replace(/\s+(?:at|by|for|in|from)\s*$/i, '').trim();
  }
  if (!parts.year) {
    const ty = /(?:^|[\s,(])\(?\s*(\d{4})\s*\)?$/.exec(text);
    if (ty) parts.year = ty[1];
  }

  return parts.award || parts.year || parts.category || parts.work ? parts : null;
}

const HEADER_FIELD: Record<string, 'year' | 'award' | 'category' | 'work' | 'result' | 'recipients'> = {
  year: 'year',
  award: 'award',
  awardshow: 'award',
  awardshistory: 'award',
  'award ceremony': 'award',
  ceremony: 'award',
  festival: 'award',
  category: 'category',
  categorie: 'category',
  work: 'work',
  'nominated work': 'work',
  film: 'work',
  title: 'work',
  show: 'work',
  serie: 'work',
  series: 'work',
  nominee: 'recipients',
  nominees: 'recipients',
  recipient: 'recipients',
  recipients: 'recipients',
  artist: 'recipients',
  result: 'result',
  outcome: 'result',
};

const YEARISH = /^(\d{4}|\d{4}\s*[–—-]\s*\d{0,4})$/;

/** Result cells: {{Won}}/{{nom}} templates and plain-text forms, read raw. */
function readResult(rawCell: string): AwardResult | null {
  if (/\{\{\s*(won|w)\s*[|}]/i.test(rawCell) || /^\s*'{0,2}\s*won\b/i.test(stripWikitext(rawCell))) return 'won';
  if (/\{\{\s*(nom|nominated|n)\s*[|}]/i.test(rawCell) || /^\s*'{0,2}\s*nominat/i.test(stripWikitext(rawCell))) return 'nominated';
  return null;
}

/** Links like `[[IIFA Award for Best Supporting Actor|…]]` point at the
 *  award-CATEGORY article, not the ceremony — they belong in `category`. */
function isCategoryArticleLink(text: string): boolean {
  const link = extractWikiLinks(text)[0];
  return link?.target !== undefined && /\baward for\b/i.test(link.target);
}

/** An "award" made only of generic words ("Awards and nominations") names no
 *  ceremony — such rows are structure or prose self-reference, not data. */
function isGenericAwardName(name: string): boolean {
  return name.replace(GENERIC_HEADING_WORDS, '').replace(/[^a-z0-9]/gi, '').trim().length === 0;
}

/** A cell holding an embedded bullet list (honours lists inside an
 *  Award-column cell) expands into one row per bullet, sharing the row's
 *  other cells (year, work, result). */
function expandBulletRow(cells: string[]): string[][] {
  const idx = cells.findIndex((c) => c.includes('\n*'));
  if (idx === -1) return [cells];
  const parts = cells[idx].split('\n').map((p) => p.trim()).filter((p) => p !== '');
  const base = parts[0]?.startsWith('*') || parts[0]?.startsWith('#') ? '' : (parts[0] ?? '');
  const bullets = parts
    .filter((p) => p.startsWith('*') || p.startsWith('#'))
    .map((p) => p.replace(/^\s*[*#]+\s*/, ''))
    .filter((p) => p !== '');
  const variants: string[][] = [];
  if (base !== '') variants.push(cells.map((c, j) => (j === idx ? base : c)));
  for (const b of bullets) variants.push(cells.map((c, j) => (j === idx ? b : c)));
  return variants.length > 0 ? variants : [cells];
}

export function extractAwards(
  pageWikitext: string,
  limit = 120,
  opts: ExtractAwardsOptions = {},
): AwardRow[] {
  const rows: AwardRow[] = [];
  const seen = new Set<string>();
  const push = (row: AwardRow) => {
    if (isGenericAwardName(row.award)) return;
    const key = `${row.year ?? ''}|${row.award}|${row.category ?? ''}|${row.work ?? ''}`;
    if (rows.length >= limit || seen.has(key)) return;
    seen.add(key);
    rows.push(row);
  };

  const sections: WikiSection[] = extractSections(pageWikitext);
  if (opts.subpage) {
    // a "List of awards…" page often opens with a summary table in the lead,
    // which extractSections (by design) never returns
    const firstHeading = /\n={2,6}[^=\n]+=+/.exec(pageWikitext);
    const lead = (firstHeading ? pageWikitext.slice(0, firstHeading.index) : pageWikitext).trim();
    if (lead) sections.unshift({ title: '', level: 2, body: lead });
  }

  // scope + ceremony context walk: a section is in scope when its title
  // names awards OR an ancestor section does OR the whole page is an awards
  // subpage. The nearest ceremony-bearing heading (own or ancestor) carries
  // into rows that don't name their own ceremony.
  const stack: { level: number; inScope: boolean; ceremony: { award: string; awardWikiTitle?: string } | null }[] = [];
  const scoped: { section: WikiSection; ceremony: { award: string; awardWikiTitle?: string } | null }[] = [];
  for (const section of sections) {
    while (stack.length > 0 && stack[stack.length - 1].level >= section.level) stack.pop();
    const parent = stack[stack.length - 1];
    const titleMatch = section.title.trim() !== '' && AWARD_SECTION_TITLE.test(section.title);
    const inScope = opts.subpage || titleMatch || (parent?.inScope ?? false);
    const ceremony = ceremonyFromTitle(section.title) ?? parent?.ceremony ?? null;
    if (inScope) scoped.push({ section, ceremony });
    stack.push({ level: section.level, inScope, ceremony });
  }

  for (const { section, ceremony } of scoped) {
    // {{awards table}} OPENS a table (no {|, no header row) that continues
    // with |- row syntax and closes with |} — rewrite it to a plain opener
    const tableSource = section.body.replace(/\{\{\s*awards table[^}]*\}\}/gi, '{| class="wikitable"');
    for (const table of tableSource.match(/\{\|[\s\S]*?\|\}/g) ?? []) {
      const view = parseWikitableView(table, { multilineCells: true });
      const fields = view.header?.map((h) => HEADER_FIELD[h] ?? null) ?? null;
      const hasWorkColumn = fields?.some((f) => f === 'work') ?? false;
      const hasResultColumn = fields?.some((f) => f === 'result') ?? false;
      let lastYear: string | undefined;
      let lastResult: AwardResult = '';
      let lastAward = '';
      let lastAwardWiki: string | undefined;
      let lastWork: string | undefined;
      let lastWorkWiki: string | undefined;

      // bullet-expanded variants; residual leading bullet markers stripped
      // (a single-bullet cell arrives as "*Award Name" after cell trimming)
      for (const cells of view.rows
        .flatMap(expandBulletRow)
        .map((row) => row.map((c) => c.replace(/^\s*[*#]+\s*/, '')))) {
        if (cells.every((c) => c.trim() === '')) continue;
        // rows come rowspan-expanded and positionally aligned with the header
        const aligned = fields !== null && cells.length === fields.length;

        let year: string | undefined;
        let award = '';
        let awardWikiTitle: string | undefined;
        let category: string | undefined;
        let work: string | undefined;
        let workWikiTitle: string | undefined;
        let recipients: string | undefined;
        let result: AwardResult | null = null;
        let categoryFromLink = false;

        cells.forEach((rawCell, i) => {
          const text = rawCell.trim();
          if (text === '') return;
          const field = aligned ? (fields![i] ?? null) : null;
          // years are sometimes wikilinked to the ceremony edition
          // ([[30th National Film Awards|1982]]) — read the display text
          if (year === undefined && (field === 'year' || field === null)) {
            const display0 = stripWikitext(text).replace(/\s+/g, ' ').trim();
            if (YEARISH.test(text)) {
              year = text;
              return;
            }
            if (display0 && YEARISH.test(display0)) {
              year = display0;
              return;
            }
          }
          const parsed = readResult(text);
          if (parsed && (field === 'result' || field === null || result === null)) {
            result = parsed;
            return;
          }
          const display = stripWikitext(text).replace(/\s+/g, ' ').trim();
          if (!display) return;
          if (
            (field === 'award' || (field === null && award === '' && AWARD_NAME_HINT.test(text))) &&
            !isCategoryArticleLink(text)
          ) {
            const link = extractWikiLinks(text)[0];
            // edition links ([[58th Maharashtra State Film Awards|2024]]):
            // the display is the ceremony year, the target the ceremony
            if (YEARISH.test(display) && link && !YEARISH.test(link.target)) {
              if (year === undefined) year = display;
              award = link.target;
            } else if (YEARISH.test(display) && !link) {
              // a bare year in the award column is the edition year
              if (year === undefined) year = display;
            } else {
              award = display;
            }
            awardWikiTitle = link?.target;
          } else if (isCategoryArticleLink(text) && category === undefined) {
            // category article wikilink, whichever column it strayed into
            category = display;
            categoryFromLink = true;
          } else if (field === 'category') {
            category = display;
          } else if (field === 'recipients') {
            recipients = display;
          } else if (field === 'work' || field === null) {
            if (/\[\[/.test(text) && work === undefined) {
              const link = extractWikiLinks(text)[0];
              work = display.replace(/^''+|''+$/g, '');
              workWikiTitle = link?.target;
            } else if (category === undefined) {
              category = display;
            } else if (work === undefined) {
              work = display;
            } else if (award === '') {
              award = display;
            }
          }
        });

        // rowspan carry-forward: ceremony, film and year often span the
        // continuation rows of one nomination group. A work is inherited when
        // the ceremony was carried (award-column rowspan) OR when the table
        // itself declares a work column whose cell this row left empty.
        let carriedAward = false;
        if (award === '' && lastAward) {
          award = lastAward;
          awardWikiTitle = lastAwardWiki;
          carriedAward = true;
        }
        if (work === undefined && lastWork && (carriedAward || hasWorkColumn)) {
          work = lastWork;
          workWikiTitle = lastWorkWiki;
        }
        if (year === undefined && (award || work || category) && lastYear) year = lastYear;
        if (result === null && lastResult) result = lastResult;
        if (year) lastYear = year;
        if (result) lastResult = result;
        if (award) {
          lastAward = award;
          lastAwardWiki = awardWikiTitle;
        }
        if (work) {
          lastWork = work;
          lastWorkWiki = workWikiTitle;
        }

        // ceremony-less tables (Year|Nominated work|Category|Result) sit
        // under a ceremony-bearing heading — fill the award from there
        if (award === '' && ceremony && (category || work || result !== null || year !== undefined || recipients)) {
          award = ceremony.award;
          awardWikiTitle = ceremony.awardWikiTitle;
        }

        // single-award-column shapes ({{awards table}}): the "… Award for …"
        // category link IS the award — promote it instead of dropping the
        // row for lacking a ceremony column
        if (award === '' && categoryFromLink && category) {
          award = category;
          category = undefined;
        }

        // a row must carry substance beyond a bare ceremony name — pure
        // ceremony/fragment rows are table structure, not nominations
        if (award && (category || work || result !== null || year !== undefined || recipients)) {
          // a table with no Result column is an honours list — apply the same
          // won-by-convention the bullet-list walk uses (marker overrides)
          let resultValue: AwardResult = result ?? '';
          if (result === null && !hasResultColumn) {
            const nominated = /\bnominat/i.test(cells.join(' '));
            resultValue = nominated ? 'nominated' : 'won';
            if (nominated) award = award.replace(/\s*\(\s*nominated\s*\)\s*$/i, '');
          }
          push({
            year,
            award,
            awardWikiTitle,
            category,
            work,
            workWikiTitle,
            recipients,
            result: resultValue,
          });
        }
      }
    }

    // bullet honours lists: "; [[Ceremony]]:" / ";''Work''" definition lines
    // set context, "*" lines are entries, "**" children carry the category.
    // Lines inside table spans are skipped — their bullets are consumed by
    // the table pass above (expandBulletRow).
    const lines = tableSource.split('\n');
    const def: ListCtx = {};
    let parentBullet: { award?: string; awardWikiTitle?: string; year?: string } | null = null;
    let inTable = false;
    for (let i = 0; i < lines.length; i += 1) {
      const t = lines[i].trim();
      if (t === '') continue;
      if (/\{\|/.test(t)) {
        inTable = true;
        continue;
      }
      if (/^\|\}/.test(t)) {
        inTable = false;
        continue;
      }
      if (inTable) continue;
      // bold '''[[Ceremony]]''' lines act as ceremony headers between bullet
      // groups (the a-m-rathnam convention)
      const boldCeremony = /^'''\s*(\[\[[^\]]+\]\])\s*'''/.exec(t);
      if (t.startsWith(';') || boldCeremony) {
        parentBullet = null;
        const cer = ceremonyFromTitle(boldCeremony ? boldCeremony[1] : t.slice(1));
        if (cer) {
          def.award = cer.award;
          def.awardWikiTitle = cer.awardWikiTitle;
        } else {
          const wk = readWorkFromLine(t.slice(1));
          if (wk) {
            def.work = wk.work;
            def.workWikiTitle = wk.workWikiTitle;
          }
        }
        continue;
      }
      const stars = /^(\*+)/.exec(t)?.[1].length ?? 0;
      const yearLed = stars === 0 && /^\d{4}\s*[–—:-]/.test(t);
      if (stars === 0 && !yearLed) continue;

      const ctx: ListCtx = { ...def };
      if (parentBullet && stars >= 2) {
        ctx.award ??= parentBullet.award;
        ctx.awardWikiTitle ??= parentBullet.awardWikiTitle;
        ctx.year ??= parentBullet.year;
      }
      const parts = parseListLine(t, stars >= 2);
      if (!parts) continue;

      // a ceremony-header bullet exists to host its ** children — skip its
      // own category-less row when children follow
      const nextLine = lines.slice(i + 1).find((l) => l.trim() !== '')?.trim() ?? '';
      if (stars === 1 && parts.award && !parts.category && !parts.work && nextLine.startsWith('**')) {
        parentBullet = { award: parts.award, awardWikiTitle: parts.awardWikiTitle, year: parts.year };
        continue;
      }

      const award = parts.award ?? ctx.award ?? ceremony?.award;
      if (!award) continue;
      const year = parts.year ?? ctx.year;
      const work = parts.work ?? ctx.work;
      if (!(year || parts.category || work || parts.result)) continue;
      if (stars === 1) {
        parentBullet = { award, awardWikiTitle: parts.awardWikiTitle ?? ctx.awardWikiTitle, year };
      }
      push({
        year,
        award,
        awardWikiTitle: parts.awardWikiTitle ?? (parts.award ? undefined : ctx.awardWikiTitle ?? ceremony?.awardWikiTitle),
        category: parts.category,
        work,
        workWikiTitle: parts.workWikiTitle ?? (parts.work ? undefined : ctx.workWikiTitle),
        result: parts.result,
      });
    }

    // award names mentioned in the prose around the tables — category
    // articles ("… Award for …") and list self-references are not ceremonies.
    // Skipped on awards subpages: their prose is summary text over fully
    // structured tables, so it only yields label-only noise.
    if (!opts.subpage) {
      for (const para of lines) {
        if (/^\s*[!|{;]/.test(para) || para.trim().startsWith('*')) continue;
        for (const link of extractWikiLinks(para)) {
          if (AWARD_NAME_HINT.test(link.target)) {
            if (/\baward for\b/i.test(link.target) || /^list of awards/i.test(link.target)) continue;
            // edition links label the year ([[41st National Film Awards|1991]])
            const award = YEARISH.test(link.label) ? link.target : link.label || link.target;
            if (/^[a-z]/.test(award)) continue;
            push({ award, awardWikiTitle: link.target, result: '' });
          }
        }
      }
    }
  }

  // label-only prose shells are redundant when a fuller row already names
  // the same award (the a-k-lohithadas hollow-row shape)
  const substantive = new Set(
    rows.filter((r) => r.year || r.category || r.work || r.recipients || r.result).map((r) => r.award.toLowerCase()),
  );
  return rows.filter(
    (r) => r.year || r.category || r.work || r.recipients || r.result || !substantive.has(r.award.toLowerCase()),
  );
}

/** Per-ceremony aggregate from a {{Infobox awards list}} subpage. */
export interface InfoboxAwardCeremony {
  award: string;
  awardWikiTitle?: string;
  wins: number;
  nominations: number;
}

/** Editor-compiled aggregate wins/nominations from a "List of awards…"
 *  subpage infobox — coverage-audit ground truth for the row parser. */
export interface InfoboxAwardTotals {
  wins: number;
  nominations: number;
  ceremonies: InfoboxAwardCeremony[];
}

export function extractInfoboxAwardTotals(pageWikitext: string): InfoboxAwardTotals | null {
  const m = /\{\{\s*[Ii]nfobox awards list\s*\n([\s\S]*?)^\}\}/m.exec(pageWikitext);
  if (!m) return null;
  const param = (key: string) =>
    new RegExp(`^\\s*\\|\\s*${key}\\s*=\\s*(.*?)\\s*$`, 'm').exec(m[1])?.[1];
  const num = (value: string | undefined) => {
    const n = Number((value ?? '').replace(/[^\d]/g, ''));
    return Number.isFinite(n) ? n : 0;
  };
  const ceremonies: InfoboxAwardCeremony[] = [];
  // matchAll over awardN params (not a 1..n loop) so numbering gaps survive
  for (const hit of m[1].matchAll(/^\s*\|\s*award(\d+)\s*=\s*(.*?)\s*$/gm)) {
    const award = stripWikitext(hit[2]).replace(/\s+/g, ' ').trim();
    if (award === '') continue;
    const link = extractWikiLinks(hit[2])[0];
    const i = hit[1];
    ceremonies.push({
      award,
      awardWikiTitle: link?.target,
      wins: num(param(`award${i}W`)),
      nominations: num(param(`award${i}N`)),
    });
  }
  return { wins: num(param('wins')), nominations: num(param('nominations')), ceremonies };
}
