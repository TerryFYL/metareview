// Publication bias assessment: Funnel plot data, Galbraith plot data, and Egger's regression test

import type { StudyEffect, EggersTest, FunnelPoint } from '../types';
import { tToP } from './distributions';

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
