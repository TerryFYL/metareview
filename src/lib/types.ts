// MetaReview Core Types

/** Effect size measure types */
export type EffectMeasure = 'OR' | 'RR' | 'MD' | 'SMD';

/** Meta-analysis model types */
export type ModelType = 'fixed' | 'random';

/** Binary outcome data (2x2 table) */
export interface BinaryData {
  /** Events in treatment group */
  events1: number;
  /** Total in treatment group */
  total1: number;
  /** Events in control group */
  events2: number;
  /** Total in control group */
  total2: number;
}

/** Continuous outcome data */
export interface ContinuousData {
  /** Mean in treatment group */
  mean1: number;
  /** SD in treatment group */
  sd1: number;
  /** Sample size in treatment group */
  n1: number;
  /** Mean in control group */
  mean2: number;
  /** SD in control group */
  sd2: number;
  /** Sample size in control group */
  n2: number;
}

/** Pre-calculated effect size data (generic input) */
export interface GenericData {
  /** Effect size (log-scale for OR/RR) */
  yi: number;
  /** Standard error */
  sei: number;
}

/** A single study in the meta-analysis */
export interface Study {
  id: string;
  name: string;
  year?: number;
  data: BinaryData | ContinuousData | GenericData;
}

/** Computed effect for a single study */
export interface StudyEffect {
  id: string;
  name: string;
  year?: number;
  /** Effect size (log-scale for OR/RR) */
  yi: number;
  /** Standard error */
  sei: number;
  /** Variance */
  vi: number;
  /** Weight (fixed effects) */
  weightFixed: number;
  /** Weight (random effects) */
  weightRandom: number;
  /** Lower CI (original scale) */
  ciLower: number;
  /** Upper CI (original scale) */
  ciUpper: number;
  /** Effect on original scale */
  effect: number;
}

/** Heterogeneity statistics */
export interface Heterogeneity {
  /** Cochran's Q statistic */
  Q: number;
  /** Degrees of freedom */
  df: number;
  /** P-value for Q test */
  pValue: number;
  /** I-squared (%) */
  I2: number;
  /** Between-study variance */
  tau2: number;
  /** Square root of tau2 */
  tau: number;
  /** H-squared */
  H2: number;
}

/** Overall meta-analysis result */
export interface MetaAnalysisResult {
  /** Summary effect (log-scale for OR/RR) */
  summary: number;
  /** Summary SE */
  se: number;
  /** Summary on original scale */
  effect: number;
  /** 95% CI lower (original scale) */
  ciLower: number;
  /** 95% CI upper (original scale) */
  ciUpper: number;
  /** Z-value */
  z: number;
  /** P-value */
  pValue: number;
  /** Model type used */
  model: ModelType;
  /** Effect measure */
  measure: EffectMeasure;
  /** Per-study results */
  studies: StudyEffect[];
  /** Heterogeneity stats */
  heterogeneity: Heterogeneity;
}

/** Sensitivity analysis result (leave-one-out) */
export interface SensitivityResult {
  /** Study left out */
  omittedStudy: string;
  /** Re-calculated summary effect (original scale) */
  effect: number;
  ciLower: number;
  ciUpper: number;
  I2: number;
}

/** Egger's regression test result */
export interface EggersTest {
  intercept: number;
  se: number;
  tValue: number;
  pValue: number;
  df: number;
}

/** Funnel plot data point */
export interface FunnelPoint {
  x: number; // effect size
  y: number; // SE (inverted axis)
  name: string;
}

/** PICO definition */
export interface PICO {
  population: string;
  intervention: string;
  comparison: string;
  outcome: string;
  studyDesign?: string;
}

/** A meta-analysis project */
export interface Project {
  id: string;
  title: string;
  pico: PICO;
  measure: EffectMeasure;
  studies: Study[];
  createdAt: number;
  updatedAt: number;
}
