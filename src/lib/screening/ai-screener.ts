// AI-powered literature screening via Cloudflare Workers AI
// Phase 2: Sends articles to /api/screening/screen for LLM-based PICO evaluation
// Fallback: returns null on error (caller should use Phase 1 PICO scores)

import type { PICO } from '../types';

export interface AIScreeningResult {
  verdict: 'include' | 'exclude' | 'maybe';
  confidence: number;
  reason: string;
}

export interface BatchScreeningProgress {
  completed: number;
  total: number;
  results: Map<string, AIScreeningResult>;
}

const BATCH_SIZE = 5;
const BATCH_DELAY_MS = 500;

/** Screen a single article against PICO criteria */
async function screenOne(
  pico: PICO,
  title: string,
  abstract: string,
): Promise<AIScreeningResult | null> {
  try {
    const res = await fetch('/api/screening/screen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pico, title, abstract }),
    });

    if (res.status === 429) {
      return {
        verdict: 'maybe',
        confidence: 0,
        reason: 'Daily AI screening quota exceeded.',
      };
    }

    if (!res.ok) return null;

    const data = await res.json();
    return {
      verdict: data.verdict || 'maybe',
      confidence: typeof data.confidence === 'number' ? data.confidence : 0,
      reason: data.reason || '',
    };
  } catch {
    return null; // Network error — caller uses Phase 1 fallback
  }
}

/** Batch screen multiple articles with progress reporting */
export async function batchScreen(
  articles: Array<{ pmid: string; title: string; abstract: string }>,
  pico: PICO,
  onProgress: (progress: BatchScreeningProgress) => void,
  signal?: AbortSignal,
): Promise<Map<string, AIScreeningResult>> {
  const results = new Map<string, AIScreeningResult>();
  let quotaExhausted = false;

  for (let i = 0; i < articles.length; i += BATCH_SIZE) {
    // Check abort signal
    if (signal?.aborted) break;

    // Stop sending if quota is exhausted
    if (quotaExhausted) {
      // Mark remaining as maybe
      for (let j = i; j < articles.length; j++) {
        results.set(articles[j].pmid, {
          verdict: 'maybe',
          confidence: 0,
          reason: 'Skipped — daily quota exceeded.',
        });
      }
      onProgress({ completed: articles.length, total: articles.length, results });
      break;
    }

    const batch = articles.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(async (article) => {
        const result = await screenOne(pico, article.title, article.abstract);
        return { pmid: article.pmid, result };
      })
    );

    for (const { pmid, result } of batchResults) {
      if (result) {
        results.set(pmid, result);
        // Check if quota was hit
        if (result.reason.includes('quota exceeded')) {
          quotaExhausted = true;
        }
      }
      // null result = API error, skip (Phase 1 score remains)
    }

    onProgress({
      completed: Math.min(i + BATCH_SIZE, articles.length),
      total: articles.length,
      results,
    });

    // Rate limit delay between batches
    if (i + BATCH_SIZE < articles.length && !quotaExhausted) {
      await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
    }
  }

  return results;
}
