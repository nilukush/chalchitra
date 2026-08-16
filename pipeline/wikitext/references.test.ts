import { describe, expect, it } from 'vitest';
import { extractReferences } from './references.js';

const page = `
Lead sentence.<ref>{{cite web |title=Matka King |url=https://www.gadgets360.com/x |website=[[Gadgets 360]] |access-date=18 April 2026}}</ref> More text.<ref name="THR" /> Later <ref name="THR">{{cite news |last1=Mitra |first1=Shilajit |title=How A 'Matka King' Was Born |url=https://thr.com/y |work=The Hollywood Reporter India |date=15 April 2026}}</ref> and a bare one <ref>[https://example.com/article Article title here]</ref> plus <ref name="unused">never referenced inline but defined</ref> and reuse <ref name="THR" />.
`;

describe('extractReferences', () => {
  it('extracts cite-web references with title, url and source', () => {
    const refs = extractReferences(page);
    expect(refs[0]).toEqual({
      label: 'Matka King',
      url: 'https://www.gadgets360.com/x',
      source: 'Gadgets 360',
      date: undefined,
    });
  });

  it('resolves named refs to their definition (defined after first use)', () => {
    const refs = extractReferences(page);
    expect(refs[1]).toEqual({
      label: "How A 'Matka King' Was Born",
      url: 'https://thr.com/y',
      source: 'The Hollywood Reporter India',
      date: '15 April 2026',
    });
  });

  it('dedupes repeated named refs', () => {
    const refs = extractReferences(page);
    expect(refs.filter((r) => r.url === 'https://thr.com/y')).toHaveLength(1);
  });

  it('handles bare external-link refs', () => {
    const refs = extractReferences(page);
    expect(refs[2]).toEqual({
      label: 'Article title here',
      url: 'https://example.com/article',
      source: undefined,
      date: undefined,
    });
  });

  it('keeps wikitext-only refs as cleaned text (no url required)', () => {
    const refs = extractReferences('<ref>Some plain statement</ref>');
    expect(refs[0]?.label).toContain('Some plain statement');
    expect(refs[0]?.url).toBeUndefined();
  });

  it('returns [] when there are no refs', () => {
    expect(extractReferences('plain text')).toEqual([]);
  });
});
