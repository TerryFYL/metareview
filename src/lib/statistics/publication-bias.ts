// Publication bias assessment: Funnel plot data, Galbraith plot data, Egger's regression test, and Trim-and-Fill

import type { StudyEffect, EggersTest, BeggsTest, FunnelPoint } from '../types';
import { tToP, normalQuantile, zToP } from './distributions';

export interface GalbraithPoint {
  name: string;
  precision: number;   // 1 / SE
  zScore: number;      // yi / SE
  isOutlier: boolean;  // |z - slope * precision| > 2
}

export interface GalbraithData {
  points: GalbraithPoint[];
  slope: number;       // pooled effect (regression slope = summary effect)
  intercept: number;   // Egger's intercept
  outliers: string[];  // names of outlier studies
}

/** Generate Galbraith (radial) plot data */
export function galbraithPlotData(studies: StudyEffect[], summaryEffect: number): GalbraithData {
  const points: GalbraithPoint[] = studies.map((s) => {
    const precision = 1 / s.sei;
    const zScore = s.yi / s.sei;
    // Expected z = summary * precision; outlier if residual > 2
    const residual = Math.abs(zScore - summaryEffect * precision);
    return {
      name: s.name,
      precision,
      zScore,
      isOutlier: residual > 2,
    };
  });

  const outliers = points.filter((p) => p.isOutlier).map((p) => p.name);

  return {
    points,
    slope: summaryEffect,
    intercept: 0,
    outliers,
  };
}

/** Generate funnel plot data points */
export function funnelPlotData(studies: StudyEffect[]): FunnelPoint[] {
  return studies.map((s) => ({
    x: s.yi,
    y: s.sei,
    name: s.name,
  }));
}

/** Egger's regression test for funnel plot asymmetry
 *  Regresses standardized effect (yi/sei) on precision (1/sei)
 *  Tests whether intercept differs significantly from zero
 */
export function eggersTest(studies: StudyEffect[]): EggersTest | null {
  const k = studies.length;
  if (k < 3) return null;

  const df = k - 2;

  // Independent variable: precision (1/sei)
  // Dependent variable: standardized effect (yi/sei)
  const x = studies.map((s) => 1 / s.sei);
  const y = studies.map((s) => s.yi / s.sei);

  // Simple linear regression: y = intercept + slope * x
  const n = x.length;
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((s, xi, i) => s + xi * y[i], 0);
  const sumX2 = x.reduce((s, xi) => s + xi * xi, 0);

  const meanX = sumX / n;
  const meanY = sumY / n;

  const Sxx = sumX2 - n * meanX * meanX;
  const Sxy = sumXY - n * meanX * meanY;

  const slope = Sxy / Sxx;
  const intercept = meanY - slope * meanX;

  // Residual standard error
  const residuals = y.map((yi, i) => yi - (intercept + slope * x[i]));
  const sse = residuals.reduce((s, r) => s + r * r, 0);
  const mse = sse / df;

  // SE of intercept
  const seIntercept = Math.sqrt(mse * (1 / n + (meanX * meanX) / Sxx));

  // t-test for intercept
  const tValue = intercept / seIntercept;
  const pValue = tToP(tValue, df);

  return {
    intercept,
    se: seIntercept,
    tValue,
    pValue,
    df,
  };
}

/** Begg's adjusted rank correlation test for funnel plot asymmetry
 *  Tests the correlation between effect estimates and their variances
 *  using Kendall's tau (Begg & Mazumdar, 1994)
 */
export function beggsTest(studies: StudyEffect[]): BeggsTest | null {
  const k = studies.length;
  if (k < 3) return null;

  // Use standardized effect (yi) and variance (vi) for rank correlation
  const yi = studies.map((s) => s.yi);
  const vi = studies.map((s) => s.vi);

  // Compute Kendall's tau between yi and vi
  let concordant = 0;
  let discordant = 0;
  for (let i = 0; i < k; i++) {
    for (let j = i + 1; j < k; j++) {
      const yDiff = yi[j] - yi[i];
      const vDiff = vi[j] - vi[i];
      const product = yDiff * vDiff;
      if (product > 0) concordant++;
      else if (product < 0) discordant++;
      // ties (product === 0) are ignored
    }
  }

  const n0 = k * (k - 1) / 2;
  const tau = (concordant - discordant) / n0;

  // Variance of tau under H0 (no ties adjustment)
  const variance = (2 * (2 * k + 5)) / (9 * k * (k - 1));
  const z = tau / Math.sqrt(variance);
  const pValue = zToP(z);

  return { tau, z, pValue, k };
}

/** Trim-and-Fill result for publication bias correction (Duval & Tweedie, 2000) */
export interface TrimAndFillResult {
  /** Number of imputed (missing) studies */
  k0: number;
  /** Side where studies are imputed */
  side: 'left' | 'right';
  /** Adjusted summary effect (log-scale for ratio measures) */
  adjustedSummary: number;
  /** Adjusted SE */
  adjustedSE: number;
  /** Adjusted summary on original scale */
  adjustedEffect: number;
  /** Adjusted 95% CI lower (original scale) */
  adjustedCILower: number;
  /** Adjusted 95% CI upper (original scale) */
  adjustedCIUpper: number;
  /** Imputed study positions for funnel plot overlay */
  imputedPoints: FunnelPoint[];
}

/** Trim-and-Fill method for estimating missing studies and adjusted effect
 *  Uses the R₀ rank-based estimator (Duval & Tweedie, 2000)
 *  @param studies - Computed study effects from meta-analysis
 *  @param summaryEffect - Pooled summary on log-scale
 *  @param isLogScale - Whether effect measure uses log transformation (OR/RR/HR)
 */
export function trimAndFill(
  studies: StudyEffect[],
  summaryEffect: number,
  isLogScale: boolean,
): TrimAndFillResult | null {
  const n = studies.length;
  if (n < 3) return null;

  // 1. Rank studies by |yi - θ̂|
  const items = studies.map((s) => ({
    yi: s.yi,
    sei: s.sei,
    diff: s.yi - summaryEffect,
    absDiff: Math.abs(s.yi - summaryEffect),
    name: s.name,
  }));

  items.sort((a, b) => a.absDiff - b.absDiff);
  // Assign ranks 1..n
  const ranks = items.map((_, i) => i + 1);

  // 2. Sum of ranks for studies on right (yi > summary) and left (yi < summary)
  let Tright = 0;
  let Tleft = 0;
  for (let i = 0; i < n; i++) {
    if (items[i].diff > 0) Tright += ranks[i];
    else if (items[i].diff < 0) Tleft += ranks[i];
  }

  // 3. R₀ estimator: k₀ = max(0, round((4*T - n*(n+1)/2) / (2n - 1)))
  // Apply to the heavier side
  let k0: number;
  let side: 'left' | 'right';

  if (Tright >= Tleft) {
    // More extreme studies on right → missing studies on left
    k0 = Math.max(0, Math.round((4 * Tright - n * (n + 1) / 2) / (2 * n - 1)));
    side = 'left';
  } else {
    // More extreme studies on left → missing studies on right
    k0 = Math.max(0, Math.round((4 * Tleft - n * (n + 1) / 2) / (2 * n - 1)));
    side = 'right';
  }

  // 4. If no asymmetry detected, return with original values
  if (k0 === 0) {
    const z196 = normalQuantile(0.975);
    const origEffect = isLogScale ? Math.exp(summaryEffect) : summaryEffect;
    const origSE = Math.sqrt(1 / studies.reduce((sum, s) => sum + 1 / s.vi, 0));
    return {
      k0: 0,
      side,
      adjustedSummary: summaryEffect,
      adjustedSE: origSE,
      adjustedEffect: origEffect,
      adjustedCILower: isLogScale
        ? Math.exp(summaryEffect - z196 * origSE)
        : summaryEffect - z196 * origSE,
      adjustedCIUpper: isLogScale
        ? Math.exp(summaryEffect + z196 * origSE)
        : summaryEffect + z196 * origSE,
      imputedPoints: [],
    };
  }

  // 5. Find k₀ most extreme studies on the heavier side
  const heavySide = side === 'left' ? 'right' : 'left';
  const extremeStudies = items
    .filter((s) => (heavySide === 'right' ? s.diff > 0 : s.diff < 0))
    .sort((a, b) => b.absDiff - a.absDiff)
    .slice(0, k0);

  // 6. Create imputed points by reflecting across the summary
  const imputedPoints: FunnelPoint[] = extremeStudies.map((s, i) => ({
    x: 2 * summaryEffect - s.yi,
    y: s.sei,
    name: `Imputed ${i + 1}`,
  }));

  // 7. Recalculate summary with original + imputed studies (fixed-effect IV)
  const allYi = [...studies.map((s) => s.yi), ...imputedPoints.map((p) => p.x)];
  const allVi = [...studies.map((s) => s.vi), ...extremeStudies.map((s) => s.sei * s.sei)];
  const allWi = allVi.map((v) => 1 / v);
  const totalW = allWi.reduce((a, b) => a + b, 0);
  const adjSummary = allWi.reduce((sum, w, i) => sum + w * allYi[i], 0) / totalW;
  const adjSE = Math.sqrt(1 / totalW);

  const z196 = normalQuantile(0.975);
  const adjEffect = isLogScale ? Math.exp(adjSummary) : adjSummary;
  const adjCILower = isLogScale
    ? Math.exp(adjSummary - z196 * adjSE)
    : adjSummary - z196 * adjSE;
  const adjCIUpper = isLogScale
    ? Math.exp(adjSummary + z196 * adjSE)
    : adjSummary + z196 * adjSE;

  return {
    k0,
    side,
    adjustedSummary: adjSummary,
    adjustedSE: adjSE,
    adjustedEffect: adjEffect,
    adjustedCILower: adjCILower,
    adjustedCIUpper: adjCIUpper,
    imputedPoints,
  };
}
