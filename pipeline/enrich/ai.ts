/**
 * AI (LLM) enrichment — activates when AI_API_KEY is set (any OpenAI-compatible
 * endpoint via AI_BASE_URL, default OpenAI; model via AI_MODEL).
 * Generates a display hook (one-liner) and mood tags per title; Wikipedia text
 * is unaffected. Cached in data/cache/ai/. Skips gracefully without a key.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import type { TitleRecord } from '../types.js';
import { buildSummaryPrompt, parseAiSummary } from './ai-lib.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const CACHE_DIR = path.join(ROOT, 'data', 'cache', 'ai');

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function aiEnabled(): boolean {
  return Boolean(process.env.AI_API_KEY);
}

export async function enrichWithAi(titles: TitleRecord[]): Promise<{ enriched: number }> {
  const apiKey = process.env.AI_API_KEY;
  if (!apiKey) {
    console.log('→ AI enrichment: AI_API_KEY not set — skipping (hooks fall back to tagline/first-sentence)');
    return { enriched: 0 };
  }
  const baseUrl = process.env.AI_BASE_URL ?? 'https://api.openai.com/v1';
  const model = process.env.AI_MODEL ?? 'gpt-4o-mini';

  mkdirSync(CACHE_DIR, { recursive: true });
  let enriched = 0;

  for (const record of titles) {
    if (record.moods?.length && record.tagline && record.enrichedFrom?.includes('ai')) continue;
    const cacheFile = path.join(CACHE_DIR, `${record.slug}.json`);
    if (existsSync(cacheFile)) {
      try {
        const cached = parseAiSummary(readFileSync(cacheFile, 'utf8'));
        if (cached) {
          record.tagline = record.tagline ?? cached.oneLiner;
          record.moods = cached.moods;
          record.enrichedFrom = [...new Set([...(record.enrichedFrom ?? []), 'ai'])];
          enriched++;
          continue;
        }
      } catch {
        /* refetch */
      }
    }

    const prompt = buildSummaryPrompt(record.title, record.kind, record.plot, record.reception);
    try {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
          max_tokens: 120,
        }),
      });
      if (!res.ok) throw new Error(`AI HTTP ${res.status}`);
      const json = await res.json();
      const raw: string = json.choices?.[0]?.message?.content ?? '';
      const parsed = parseAiSummary(raw);
      if (parsed) {
        writeFileSync(cacheFile, JSON.stringify(parsed));
        record.tagline = record.tagline ?? parsed.oneLiner;
        record.moods = parsed.moods;
        record.enrichedFrom = [...new Set([...(record.enrichedFrom ?? []), 'ai'])];
        enriched++;
      }
      await sleep(400);
    } catch {
      /* skip this title */
    }
  }

  console.log(`→ AI enrichment: ${enriched}/${titles.length} hooks + moods generated`);
  return { enriched };
}
