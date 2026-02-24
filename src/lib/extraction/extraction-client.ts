// Client-side orchestrator for decomposed atomic extraction queries
// Sends text to the Worker endpoint and collects structured results

const EXTRACT_ENDPOINT = '/api/extract/data';

export type QueryType = 'outcomes' | 'effect_size' | 'sample_sizes' | 'events' | 'continuous';

export interface ExtractionProgress {
  current: number;
  total: number;
  currentQuery: string;
}

export interface OutcomesResult {
  outcomes: string[];
}

export interface EffectSizeResult {
  type: string | null;
  value: number | null;
  ci_lower: number | null;
  ci_upper: number | null;
  source_quote: string;
}

export interface SampleSizesResult {
  treatment_n: number | null;
  control_n: number | null;
  source_quote: string;
}

export interface EventsResult {
  treatment_events: number | null;
  control_events: number | null;
  source_quote: string;
}

export interface ContinuousResult {
  treatment_mean: number | null;
  treatment_sd: number | null;
  control_mean: number | null;
  control_sd: number | null;
  source_quote: string;
}

export type AtomicResult = OutcomesResult | EffectSizeResult | SampleSizesResult | EventsResult | ContinuousResult;

export interface ExtractionResult {
  queryType: QueryType;
  outcome?: string;
  data: AtomicResult;
  confidence: 'high' | 'medium' | 'low';
  error?: string;
}

/**
 * Send a single atomic extraction query to the Worker.
 */
async function queryExtract(
  text: string,
  queryType: QueryType,
  outcome?: string,
  signal?: AbortSignal
): Promise<AtomicResult> {
  const res = await fetch(EXTRACT_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, queryType, outcome }),
    signal,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'unknown' }));
    throw new Error((err as { error?: string }).error || `HTTP ${res.status}`);
  }

  return res.json();
}

/**
 * Compute confidence level from source quote verification.
 * HIGH: source_quote exists in original text AND extracted number appears in quote
 * MEDIUM: source_quote partially matches
 * LOW: no match or parse fallback
 */
export function computeConfidence(
  result: AtomicResult,
  originalText: string
): 'high' | 'medium' | 'low' {
  const quote = (result as { source_quote?: string }).source_quote;
  if (!quote || quote.length < 5) return 'low';

  // Check if source quote is an exact substring of original text
  const normalizedText = originalText.toLowerCase().replace(/\s+/g, ' ');
  const normalizedQuote = quote.toLowerCase().replace(/\s+/g, ' ');

  if (normalizedText.includes(normalizedQuote)) {
    // Check if any extracted number appears in the quote
    const numbers = extractNumbers(result);
    if (numbers.length > 0 && numbers.some(n => quote.includes(String(n)))) {
      return 'high';
    }
    return 'medium';
  }

  // Fuzzy match: check if at least 70% of quote words appear in text
  const quoteWords = normalizedQuote.split(' ').filter(w => w.length > 2);
  const matchCount = quoteWords.filter(w => normalizedText.includes(w)).length;
  if (quoteWords.length > 0 && matchCount / quoteWords.length > 0.7) {
    return 'medium';
  }

  return 'low';
}

function extractNumbers(result: AtomicResult): number[] {
  const nums: number[] = [];
  for (const val of Object.values(result)) {
    if (typeof val === 'number' && val !== null) {
      nums.push(val);
    }
  }
  return nums;
}

/**
 * Run the full decomposed extraction pipeline for a paper.
 * 1. Extract outcomes list
 * 2. For each outcome: extract effect size, sample sizes, events/continuous data
 */
export async function extractFromText(
  text: string,
  studyType: 'binary' | 'continuous',
  onProgress?: (progress: ExtractionProgress) => void,
  signal?: AbortSignal
): Promise<ExtractionResult[]> {
  const results: ExtractionResult[] = [];

  // Step 1: Extract outcomes
  onProgress?.({ current: 0, total: 1, currentQuery: 'outcomes' });
  let outcomes: string[] = [];
  try {
    const outcomesData = await queryExtract(text, 'outcomes', undefined, signal);
    outcomes = (outcomesData as OutcomesResult).outcomes || [];
    results.push({
      queryType: 'outcomes',
      data: outcomesData,
      confidence: outcomes.length > 0 ? 'medium' : 'low',
    });
  } catch (err) {
    results.push({
      queryType: 'outcomes',
      data: { outcomes: [] },
      confidence: 'low',
      error: err instanceof Error ? err.message : 'Failed',
    });
    return results; // Can't continue without outcomes
  }

  if (outcomes.length === 0) return results;

  // Step 2: Extract sample sizes (once per paper)
  const totalQueries = 1 + 1 + outcomes.length * (studyType === 'binary' ? 2 : 2);
  let current = 1;

  onProgress?.({ current, total: totalQueries, currentQuery: 'sample_sizes' });
  try {
    const sizesData = await queryExtract(text, 'sample_sizes', undefined, signal);
    results.push({
      queryType: 'sample_sizes',
      data: sizesData,
      confidence: computeConfidence(sizesData, text),
    });
  } catch (err) {
    results.push({
      queryType: 'sample_sizes',
      data: { treatment_n: null, control_n: null, source_quote: '' },
      confidence: 'low',
      error: err instanceof Error ? err.message : 'Failed',
    });
  }
  current++;

  // Step 3: For each outcome, extract effect size and data
  for (const outcome of outcomes) {
    if (signal?.aborted) break;

    // Effect size
    onProgress?.({ current, total: totalQueries, currentQuery: `effect_size:${outcome}` });
    try {
      const effectData = await queryExtract(text, 'effect_size', outcome, signal);
      results.push({
        queryType: 'effect_size',
        outcome,
        data: effectData,
        confidence: computeConfidence(effectData, text),
      });
    } catch (err) {
      results.push({
        queryType: 'effect_size',
        outcome,
        data: { type: null, value: null, ci_lower: null, ci_upper: null, source_quote: '' },
        confidence: 'low',
        error: err instanceof Error ? err.message : 'Failed',
      });
    }
    current++;

    // Events (binary) or continuous data
    const dataQueryType = studyType === 'binary' ? 'events' : 'continuous';
    onProgress?.({ current, total: totalQueries, currentQuery: `${dataQueryType}:${outcome}` });
    try {
      const eventData = await queryExtract(text, dataQueryType, outcome, signal);
      results.push({
        queryType: dataQueryType,
        outcome,
        data: eventData,
        confidence: computeConfidence(eventData, text),
      });
    } catch (err) {
      const emptyData = studyType === 'binary'
        ? { treatment_events: null, control_events: null, source_quote: '' }
        : { treatment_mean: null, treatment_sd: null, control_mean: null, control_sd: null, source_quote: '' };
      results.push({
        queryType: dataQueryType,
        outcome,
        data: emptyData,
        confidence: 'low',
        error: err instanceof Error ? err.message : 'Failed',
      });
    }
    current++;
  }

  return results;
}
