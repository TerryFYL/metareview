// Publication bias assessment: Funnel plot data and Egger's regression test

import type { StudyEffect, EggersTest, FunnelPoint } from '../types';
import { tToP } from './distributions';

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
