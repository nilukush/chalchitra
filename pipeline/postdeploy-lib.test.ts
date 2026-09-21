import { describe, expect, it } from 'vitest';
import { diffDocIds, docIdToUrl, sampleCanaryIds } from './postdeploy-lib.js';

describe('diffDocIds (no-silent-loss contract)', () => {
  const prev = ['movie:a', 'movie:b', 'series:c', 'person:d'];

  it('unexpected vanishings are pages present live but missing from the new build', () => {
    const plan = diffDocIds(prev, ['movie:a', 'series:c'], []);
    expect(plan.unexpected).toEqual(['movie:b', 'person:d']);
  });

  it('intentional removals are tolerated and reported separately', () => {
    const plan = diffDocIds(prev, ['movie:a', 'series:c'], ['person:d']);
    expect(plan.unexpected).toEqual(['movie:b']);
    expect(plan.intentional).toEqual(['person:d']);
  });

  it('added docs (new pages) are reported, never a failure', () => {
    const plan = diffDocIds(prev, [...prev, 'movie:new'], []);
    expect(plan.unexpected).toEqual([]);
    expect(plan.added).toEqual(['movie:new']);
  });

  it('empty new build is a catastrophic failure, not an empty diff', () => {
    const plan = diffDocIds(prev, [], []);
    expect(plan.unexpected.length).toBe(prev.length);
  });
});

describe('docIdToUrl', () => {
  it('maps kinds to their route prefixes', () => {
    expect(docIdToUrl('movie:x-2')).toBe('/movies/x-2');
    expect(docIdToUrl('series:the-court')).toBe('/series/the-court');
    expect(docIdToUrl('person:jaya-bachchan')).toBe('/people/jaya-bachchan');
  });

  it('returns a safe root for unknown shapes', () => {
    expect(docIdToUrl('weird')).toBe('/');
  });
});

describe('sampleCanaryIds (deterministic)', () => {
  it('samples evenly across the sorted id list and is stable across calls', () => {
    const ids = Array.from({ length: 100 }, (_, i) => `movie:t${String(i).padStart(3, '0')}`);
    const a = sampleCanaryIds(ids, 5);
    const b = sampleCanaryIds(ids, 5);
    expect(a).toEqual(b);
    expect(a).toHaveLength(5);
  });

  it('caps the sample at the pool size', () => {
    expect(sampleCanaryIds(['a', 'b'], 5)).toEqual(['a', 'b']);
  });
});
