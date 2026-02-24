// Effect size calculations for meta-analysis
import type { BinaryData, ContinuousData, GenericData, EffectMeasure } from '../types';

/** Computed effect size with SE on log/raw scale */
export interface EffectSizeResult {
  /** Effect size (log-scale for OR/RR, raw for MD/SMD) */
  yi: number;
  /** Standard error */
  sei: number;
}

/** Apply 0.5 continuity correction for zero cells */
function correctZeroCells(d: BinaryData): BinaryData {
  const hasZero =
    d.events1 === 0 || d.events2 === 0 ||
    d.events1 === d.total1 || d.events2 === d.total2;

  if (!hasZero) return d;

  return {
    events1: d.events1 + 0.5,
    total1: d.total1 + 1,
    events2: d.events2 + 0.5,
    total2: d.total2 + 1,
  };
}

/** Log Odds Ratio and SE */
export function logOddsRatio(raw: BinaryData): EffectSizeResult {
  const d = correctZeroCells(raw);
  const a = d.events1;
  const b = d.total1 - d.events1;
  const c = d.events2;
  const dd = d.total2 - d.events2;

  const yi = Math.log((a * dd) / (b * c));
  const sei = Math.sqrt(1 / a + 1 / b + 1 / c + 1 / dd);

  return { yi, sei };
}

/** Log Risk Ratio and SE */
export function logRiskRatio(raw: BinaryData): EffectSizeResult {
  const d = correctZeroCells(raw);
  const p1 = d.events1 / d.total1;
  const p2 = d.events2 / d.total2;

  const yi = Math.log(p1 / p2);
  const sei = Math.sqrt(
    (1 - p1) / (d.events1) + (1 - p2) / (d.events2)
  );

  return { yi, sei };
}

/** Mean Difference and SE */
export function meanDifference(d: ContinuousData): EffectSizeResult {
  const yi = d.mean1 - d.mean2;
  const sei = Math.sqrt(d.sd1 * d.sd1 / d.n1 + d.sd2 * d.sd2 / d.n2);

  return { yi, sei };
}

/** Standardized Mean Difference (Hedges' g) and SE */
export function hedgesG(d: ContinuousData): EffectSizeResult {
  const n1 = d.n1;
  const n2 = d.n2;
  const df = n1 + n2 - 2;

  // Pooled SD
  const sp = Math.sqrt(
    ((n1 - 1) * d.sd1 * d.sd1 + (n2 - 1) * d.sd2 * d.sd2) / df
  );

  // Cohen's d
  const cohenD = (d.mean1 - d.mean2) / sp;

  // Hedges' correction factor J
  const J = 1 - 3 / (4 * df - 1);

  // Hedges' g
  const yi = cohenD * J;

  // SE of Hedges' g
  const sei = Math.sqrt(
    (n1 + n2) / (n1 * n2) + (yi * yi) / (2 * (n1 + n2))
  ) * J;

  return { yi, sei };
}

/** Check if data is binary */
export function isBinaryData(data: unknown): data is BinaryData {
  const d = data as BinaryData;
  return (
    typeof d.events1 === 'number' &&
    typeof d.total1 === 'number' &&
    typeof d.events2 === 'number' &&
    typeof d.total2 === 'number'
  );
}

/** Check if data is continuous */
export function isContinuousData(data: unknown): data is ContinuousData {
  const d = data as ContinuousData;
  return (
    typeof d.mean1 === 'number' &&
    typeof d.sd1 === 'number' &&
    typeof d.n1 === 'number' &&
    typeof d.mean2 === 'number' &&
    typeof d.sd2 === 'number' &&
    typeof d.n2 === 'number'
  );
}

/** Check if data is generic (pre-calculated) */
export function isGenericData(data: unknown): data is GenericData {
  const d = data as GenericData;
  return typeof d.yi === 'number' && typeof d.sei === 'number';
}

/** Calculate effect size for a study based on measure type */
export function calculateEffectSize(
  data: BinaryData | ContinuousData | GenericData,
  measure: EffectMeasure
): EffectSizeResult {
  if (isGenericData(data)) {
    return { yi: data.yi, sei: data.sei };
  }

  if (isBinaryData(data)) {
    switch (measure) {
      case 'OR':
        return logOddsRatio(data);
      case 'RR':
        return logRiskRatio(data);
      default:
        throw new Error(`Measure ${measure} requires continuous data`);
    }
  }

  if (isContinuousData(data)) {
    switch (measure) {
      case 'MD':
        return meanDifference(data);
      case 'SMD':
        return hedgesG(data);
      default:
        throw new Error(`Measure ${measure} requires binary data`);
    }
  }

  throw new Error('Invalid study data format');
}

/** Convert log-scale effect to original scale (for OR/RR) */
export function toOriginalScale(yi: number, measure: EffectMeasure): number {
  return measure === 'OR' || measure === 'RR' ? Math.exp(yi) : yi;
}

/** Is this measure on log scale? */
export function isLogScale(measure: EffectMeasure): boolean {
  return measure === 'OR' || measure === 'RR';
}

/** Calculate CI on original scale */
export function calculateCI(
  yi: number,
  sei: number,
  measure: EffectMeasure,
  zCrit = 1.96
): { lower: number; upper: number } {
  const lower = yi - zCrit * sei;
  const upper = yi + zCrit * sei;

  if (isLogScale(measure)) {
    return { lower: Math.exp(lower), upper: Math.exp(upper) };
  }
  return { lower, upper };
}
