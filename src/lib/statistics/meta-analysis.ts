// Core meta-analysis engine: Fixed effects (Inverse Variance / Mantel-Haenszel)
// and Random effects (DerSimonian-Laird)

import type {
  Study, StudyEffect, MetaAnalysisResult,
  EffectMeasure, ModelType, Heterogeneity,
} from '../types';
import {
  calculateEffectSize, toOriginalScale, calculateCI,
} from './effect-size';
import { zToP, chiSquaredPValue } from './distributions';

/** Compute per-study effects from raw data */
function computeStudyEffects(
  studies: Study[],
  measure: EffectMeasure
): Omit<StudyEffect, 'weightFixed' | 'weightRandom'>[] {
  return studies.map((s) => {
    const { yi, sei } = calculateEffectSize(s.data, measure);
    const vi = sei * sei;
    const ci = calculateCI(yi, sei, measure);

    return {
      id: s.id,
      name: s.name,
      year: s.year,
      yi,
      sei,
      vi,
      ciLower: ci.lower,
      ciUpper: ci.upper,
      effect: toOriginalScale(yi, measure),
    };
  });
}

/** Calculate heterogeneity statistics */
function computeHeterogeneity(
  effects: { yi: number; vi: number }[],
  summaryFixed: number
): Heterogeneity {
  const k = effects.length;
  const df = k - 1;

  if (df <= 0) {
    return { Q: 0, df: 0, pValue: 1, I2: 0, tau2: 0, tau: 0, H2: 1 };
  }

  // Weights for fixed effects
  const weights = effects.map((e) => 1 / e.vi);
  const sumW = weights.reduce((a, b) => a + b, 0);
  const sumW2 = weights.reduce((a, w) => a + w * w, 0);

  // Cochran's Q
  const Q = effects.reduce(
    (sum, e, i) => sum + weights[i] * (e.yi - summaryFixed) ** 2,
    0
  );

  // P-value for Q
  const pValue = chiSquaredPValue(Q, df);

  // DerSimonian-Laird tau²
  const C = sumW - sumW2 / sumW;
  const tau2 = Math.max(0, (Q - df) / C);
  const tau = Math.sqrt(tau2);

  // I² and H²
  const I2 = df > 0 ? Math.max(0, ((Q - df) / Q) * 100) : 0;
  const H2 = df > 0 ? Q / df : 1;

  return { Q, df, pValue, I2, tau2, tau, H2 };
}

/** Run fixed effects meta-analysis (Inverse Variance method) */
function fixedEffects(
  effects: Omit<StudyEffect, 'weightFixed' | 'weightRandom'>[]
): { summary: number; se: number; weights: number[] } {
  const weights = effects.map((e) => 1 / e.vi);
  const sumW = weights.reduce((a, b) => a + b, 0);
  const summary = effects.reduce((s, e, i) => s + weights[i] * e.yi, 0) / sumW;
  const se = Math.sqrt(1 / sumW);

  return { summary, se, weights };
}

/** Run random effects meta-analysis (DerSimonian-Laird) */
function randomEffects(
  effects: Omit<StudyEffect, 'weightFixed' | 'weightRandom'>[],
  tau2: number
): { summary: number; se: number; weights: number[] } {
  const weights = effects.map((e) => 1 / (e.vi + tau2));
  const sumW = weights.reduce((a, b) => a + b, 0);
  const summary = effects.reduce((s, e, i) => s + weights[i] * e.yi, 0) / sumW;
  const se = Math.sqrt(1 / sumW);

  return { summary, se, weights };
}

/** Main meta-analysis function */
export function metaAnalysis(
  studies: Study[],
  measure: EffectMeasure,
  model: ModelType = 'random'
): MetaAnalysisResult {
  if (studies.length === 0) {
    throw new Error('At least one study is required');
  }

  // Step 1: Compute per-study effects
  const rawEffects = computeStudyEffects(studies, measure);

  // Step 2: Fixed effects (always needed for Q statistic)
  const fixed = fixedEffects(rawEffects);

  // Step 3: Heterogeneity
  const het = computeHeterogeneity(rawEffects, fixed.summary);

  // Step 4: Model-specific pooling
  const result =
    model === 'fixed'
      ? fixed
      : randomEffects(rawEffects, het.tau2);

  // Normalize weights to percentages
  const totalWeight = result.weights.reduce((a, b) => a + b, 0);

  // Build study effects with weights
  const studyEffects: StudyEffect[] = rawEffects.map((e, i) => ({
    ...e,
    weightFixed: (fixed.weights[i] / fixed.weights.reduce((a, b) => a + b, 0)) * 100,
    weightRandom:
      model === 'random'
        ? (result.weights[i] / totalWeight) * 100
        : (fixed.weights[i] / fixed.weights.reduce((a, b) => a + b, 0)) * 100,
  }));

  // Summary on original scale
  const summaryEffect = toOriginalScale(result.summary, measure);
  const ci = calculateCI(result.summary, result.se, measure);
  const z = result.summary / result.se;
  const pValue = zToP(z);

  return {
    summary: result.summary,
    se: result.se,
    effect: summaryEffect,
    ciLower: ci.lower,
    ciUpper: ci.upper,
    z,
    pValue,
    model,
    measure,
    studies: studyEffects,
    heterogeneity: het,
  };
}

/** Leave-one-out sensitivity analysis */
export function sensitivityAnalysis(
  studies: Study[],
  measure: EffectMeasure,
  model: ModelType = 'random'
): import('../types').SensitivityResult[] {
  if (studies.length < 3) {
    return [];
  }

  return studies.map((_, i) => {
    const subset = [...studies.slice(0, i), ...studies.slice(i + 1)];
    const result = metaAnalysis(subset, measure, model);

    return {
      omittedStudy: studies[i].name,
      effect: result.effect,
      ciLower: result.ciLower,
      ciUpper: result.ciUpper,
      I2: result.heterogeneity.I2,
    };
  });
}
