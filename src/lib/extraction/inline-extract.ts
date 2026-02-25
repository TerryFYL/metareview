// Per-study inline PDF extraction for the Screening → DataTable bridge
// Simplified extraction pipeline: upload PDF → extract data → auto-fill one study row

import type { EffectMeasure, BinaryData, ContinuousData, HRData } from '../types';
import { extractTextFromPDF, isScannedPDF } from './pdf-parser';
import { extractFromText, type ExtractionResult, type EffectSizeResult, type SampleSizesResult, type EventsResult, type ContinuousResult } from './extraction-client';

export interface InlineExtractionProgress {
  status: 'parsing' | 'extracting' | 'done' | 'error';
  message: string;
  /** 0-100 percentage */
  percent: number;
}

export interface InlineExtractionResult {
  success: boolean;
  data: BinaryData | ContinuousData | HRData | null;
  confidence: 'high' | 'medium' | 'low';
  details: ExtractionResult[];
}

/**
 * Extract study data from a PDF file for a single study row.
 * Returns populated data object matching the study's effect measure type.
 */
export async function extractStudyFromPDF(
  file: File,
  measure: EffectMeasure,
  onProgress: (progress: InlineExtractionProgress) => void,
  signal?: AbortSignal
): Promise<InlineExtractionResult> {
  // Step 1: Parse PDF
  onProgress({ status: 'parsing', message: 'pdf', percent: 10 });

  const pages = await extractTextFromPDF(file);
  if (isScannedPDF(pages)) {
    return { success: false, data: null, confidence: 'low', details: [] };
  }

  const fullText = pages.map(p => p.text).join('\n\n');
  if (fullText.trim().length < 50) {
    return { success: false, data: null, confidence: 'low', details: [] };
  }

  // Step 2: Run extraction
  onProgress({ status: 'extracting', message: 'ai', percent: 30 });

  const studyType = measure === 'MD' || measure === 'SMD' ? 'continuous' : 'binary';
  const results = await extractFromText(
    fullText,
    studyType,
    (p) => {
      const pct = 30 + Math.round((p.current / p.total) * 60);
      onProgress({ status: 'extracting', message: p.currentQuery, percent: pct });
    },
    signal
  );

  // Step 3: Map extraction results to study data
  onProgress({ status: 'done', message: 'complete', percent: 100 });

  const data = mapResultsToStudyData(results, measure);
  if (!data) {
    return { success: false, data: null, confidence: 'low', details: results };
  }

  // Overall confidence is the lowest confidence across extracted fields
  const fieldResults = results.filter(r => r.queryType !== 'outcomes');
  const worstConfidence = fieldResults.reduce((worst, r) => {
    const order = { high: 2, medium: 1, low: 0 };
    return order[r.confidence] < order[worst] ? r.confidence : worst;
  }, 'high' as 'high' | 'medium' | 'low');

  return { success: true, data, confidence: worstConfidence, details: results };
}

/**
 * Map extraction results to a Study data object.
 * Returns null if insufficient data was extracted.
 */
function mapResultsToStudyData(
  results: ExtractionResult[],
  measure: EffectMeasure
): BinaryData | ContinuousData | HRData | null {
  const sampleResult = results.find(r => r.queryType === 'sample_sizes');
  const sizes = sampleResult?.data as SampleSizesResult | undefined;
  const effectResult = results.find(r => r.queryType === 'effect_size');
  const effect = effectResult?.data as EffectSizeResult | undefined;

  if (measure === 'HR') {
    // For HR: extract HR + CI from effect size result
    if (effect?.value != null && effect.ci_lower != null && effect.ci_upper != null) {
      return { hr: effect.value, ciLower: effect.ci_lower, ciUpper: effect.ci_upper };
    }
    return null;
  }

  const isBinary = measure === 'OR' || measure === 'RR';

  if (isBinary) {
    const eventsResult = results.find(r => r.queryType === 'events');
    const events = eventsResult?.data as EventsResult | undefined;

    if (events?.treatment_events != null && events?.control_events != null &&
        sizes?.treatment_n != null && sizes?.control_n != null) {
      return {
        events1: events.treatment_events,
        total1: sizes.treatment_n,
        events2: events.control_events,
        total2: sizes.control_n,
      };
    }
    return null;
  }

  // Continuous (MD/SMD)
  const contResult = results.find(r => r.queryType === 'continuous');
  const cont = contResult?.data as ContinuousResult | undefined;

  if (cont?.treatment_mean != null && cont?.treatment_sd != null &&
      cont?.control_mean != null && cont?.control_sd != null &&
      sizes?.treatment_n != null && sizes?.control_n != null) {
    return {
      mean1: cont.treatment_mean,
      sd1: cont.treatment_sd,
      n1: sizes.treatment_n,
      mean2: cont.control_mean,
      sd2: cont.control_sd,
      n2: sizes.control_n,
    };
  }
  return null;
}
