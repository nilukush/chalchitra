import { describe, expect, it } from 'vitest';
import { planRefresh, planRenames, planValidation } from './refresh-lib.js';

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

describe('planRenames (Wikipedia page moves)', () => {
  it('flags pageids whose live title differs from the cached title', () => {
    const plan = planRenames(
      { '83962455': 'Khalifa: The Intro', '123': 'Same Name' },
      { '83962455': 'Khalifa: The Ruler', '123': 'Same Name', '456': 'New Page' },
    );
    expect(plan).toEqual(['83962455']);
  });
});

// ── Issue 6: legacy cache validation (stale-seed freeze) ──────────────
describe('planValidation (revid-aware staleness)', () => {
  const live: Record<string, number> = { '1': 100, '2': 200, '3': 300, '9': 900 };

  it('flags pages whose cached revid differs from live as stale', () => {
    const plan = planValidation([{ pageid: 1, revid: 50 }], live);
    expect(plan.stale).toEqual([1]);
    expect(plan.legacy).toEqual([]);
  });

  it('treats matching revids as fresh (neither stale nor legacy)', () => {
    const plan = planValidation([{ pageid: 2, revid: 200 }], live);
    expect(plan.stale).toEqual([]);
    expect(plan.legacy).toEqual([]);
  });

  it('routes revid-less legacy files to historical validation', () => {
    const plan = planValidation([{ pageid: 3 }], live);
    expect(plan.legacy).toEqual([3]);
    expect(plan.stale).toEqual([]);
  });

  it('skips pages no longer live (deleted/merged articles)', () => {
    const plan = planValidation([{ pageid: 4, revid: 5 }, { pageid: 5 }], live);
    expect(plan.stale).toEqual([]);
    expect(plan.legacy).toEqual([]);
  });
});
