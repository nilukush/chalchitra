import { describe, expect, it } from 'vitest';
import { planRefresh } from './refresh-lib.js';

describe('planRefresh', () => {
  it('flags pageids whose revid changed', () => {
    const plan = planRefresh({ '1': 100, '2': 200 }, { '1': 100, '2': 201 });
    expect(plan.changed).toEqual(['2']);
  });

  it('flags new pageids as added (they need a fetch, not a refetch)', () => {
    const plan = planRefresh({ '1': 100 }, { '1': 100, '7': 700 });
    expect(plan.added).toEqual(['7']);
    expect(plan.changed).toEqual([]);
  });

  it('ignores pageids that vanished from the wiki', () => {
    const plan = planRefresh({ '1': 100, '2': 200 }, { '1': 100 });
    expect(plan.changed).toEqual([]);
    expect(plan.added).toEqual([]);
  });

  it('returns empty plan when nothing changed', () => {
    const plan = planRefresh({ '1': 100 }, { '1': 100 });
    expect(plan.changed).toEqual([]);
    expect(plan.added).toEqual([]);
  });
});
