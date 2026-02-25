// MetaReview Core Types

/** Effect size measure types */
export type EffectMeasure = 'OR' | 'RR' | 'MD' | 'SMD' | 'HR';

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

/** Hazard Ratio data (from Cox regression, reported in papers) */
export interface HRData {
  /** Hazard Ratio (original scale) */
  hr: number;
  /** Lower 95% CI */
  ciLower: number;
  /** Upper 95% CI */
  ciUpper: number;
}

/** A single study in the meta-analysis */
export interface Study {
  id: string;
  name: string;
  year?: number;
  subgroup?: string;
  /** Dose level for dose-response analysis (optional) */
  dose?: number;
  data: BinaryData | ContinuousData | GenericData | HRData;
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
  /** Prediction interval (Riley et al., 2011) — null if k < 3 */
  predictionInterval: PredictionInterval | null;
}

/** Cumulative meta-analysis result (one row per progressive pooling) */
export interface CumulativeResult {
  /** Study added at this step */
  addedStudy: string;
  /** Number of studies pooled so far */
  studyCount: number;
  /** Publication year of added study */
  year?: number;
  /** Pooled effect on original scale */
  effect: number;
  /** 95% CI lower */
  ciLower: number;
  /** 95% CI upper */
  ciUpper: number;
  /** I-squared (%) */
  I2: number;
  /** P-value for overall effect */
  pValue: number;
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
  /** Regression slope (≈ pooled effect estimate in Galbraith space) */
  slope: number;
  se: number;
  tValue: number;
  pValue: number;
  df: number;
}

/** Begg's rank correlation test result (Begg & Mazumdar, 1994) */
export interface BeggsTest {
  /** Kendall's tau statistic */
  tau: number;
  /** Z-score for the test */
  z: number;
  /** Two-tailed P-value */
  pValue: number;
  /** Number of studies */
  k: number;
}

/** Meta-regression result (WLS) */
export interface MetaRegressionResult {
  /** Regression coefficient (slope) */
  coefficient: number;
  /** SE of coefficient */
  se: number;
  /** Z-value for coefficient */
  z: number;
  /** P-value for coefficient */
  pValue: number;
  /** Intercept */
  intercept: number;
  /** Covariate name */
  covariate: string;
  /** Q_model statistic */
  QModel: number;
  /** Q_model P-value */
  QModelP: number;
  /** Q_residual */
  QResidual: number;
  /** Q_residual df */
  QResidualDf: number;
  /** Q_residual P-value */
  QResidualP: number;
  /** R² analog (proportion of heterogeneity explained) */
  R2: number;
  /** Number of studies with covariate data */
  k: number;
  /** Per-study data for scatter plot */
  points: { name: string; x: number; y: number; weight: number }[];
}

/** Subgroup analysis result */
export interface SubgroupResult {
  /** Subgroup name */
  name: string;
  /** Meta-analysis result for this subgroup */
  result: MetaAnalysisResult;
}

/** Test for subgroup differences */
export interface SubgroupTest {
  /** Q statistic for between-subgroup differences */
  Q: number;
  /** Degrees of freedom (number of subgroups - 1) */
  df: number;
  /** P-value */
  pValue: number;
}

/** Full subgroup analysis output */
export interface SubgroupAnalysisResult {
  /** Per-subgroup results */
  subgroups: SubgroupResult[];
  /** Test for subgroup differences */
  test: SubgroupTest;
  /** Overall result across all studies */
  overall: MetaAnalysisResult;
}

/** Funnel plot data point */
export interface FunnelPoint {
  x: number; // effect size
  y: number; // SE (inverted axis)
  name: string;
}

/** Baujat plot data point */
export interface BaujatPoint {
  name: string;
  /** Study's individual contribution to overall Q statistic */
  contribution: number;
  /** Squared standardized influence on pooled effect when study is removed */
  influence: number;
}

/** Baujat plot data */
export interface BaujatData {
  points: BaujatPoint[];
  /** Mean contribution for quadrant threshold */
  meanContribution: number;
  /** Mean influence for quadrant threshold */
  meanInfluence: number;
}

/** Influence diagnostics for a single study */
export interface InfluenceDiagnostic {
  name: string;
  year?: number;
  /** Effect on original scale */
  effect: number;
  /** Weight (%) in current model */
  weight: number;
  /** Hat value (leverage) */
  hat: number;
  /** Internally studentized residual */
  rstudent: number;
  /** Cook's distance */
  cooksDistance: number;
  /** DFFITS */
  dffits: number;
  /** Covariance ratio */
  covRatio: number;
  /** Leave-one-out pooled effect (original scale) */
  leaveOneOutEffect: number;
  /** Leave-one-out I² */
  leaveOneOutI2: number;
}

/** GRADE evidence quality level */
export type GradeLevel = 'high' | 'moderate' | 'low' | 'very_low';

/** GRADE factor concern level */
export type GradeConcern = 'no_concern' | 'serious' | 'very_serious';

/** Individual GRADE factor assessment */
export interface GradeFactor {
  level: GradeConcern;
  downgrade: 0 | -1 | -2;
  auto: boolean;
  reasoning: string;
}

/** GRADE evidence quality assessment */
export interface GradeAssessment {
  overall: GradeLevel;
  score: number;
  factors: {
    riskOfBias: GradeFactor;
    inconsistency: GradeFactor;
    indirectness: GradeFactor;
    imprecision: GradeFactor;
    publicationBias: GradeFactor;
  };
}

/** Prediction interval (Riley et al., 2011) */
export interface PredictionInterval {
  /** Lower bound on original scale */
  lower: number;
  /** Upper bound on original scale */
  upper: number;
  /** Lower bound on log/raw scale */
  lowerRaw: number;
  /** Upper bound on log/raw scale */
  upperRaw: number;
}

/** Dose-response analysis result */
export interface DoseResponseResult {
  /** Model type */
  modelType: 'linear' | 'quadratic';
  /** Linear coefficient (slope) */
  beta1: number;
  /** Quadratic coefficient (for quadratic model) */
  beta2: number;
  /** Intercept */
  intercept: number;
  /** P-value for linear term */
  pLinear: number;
  /** P-value for quadratic term (quadratic model only) */
  pQuadratic: number;
  /** P-value for overall model */
  pModel: number;
  /** R² analog */
  R2: number;
  /** Number of dose levels */
  k: number;
  /** Per-study data points for scatter plot */
  points: { name: string; dose: number; effect: number; weight: number; sei: number }[];
  /** Fitted curve points for smooth rendering */
  curve: { dose: number; effect: number; ciLower: number; ciUpper: number }[];
}

/** Cochrane RoB 2.0 domain judgment */
export type RobJudgment = 'low' | 'some_concerns' | 'high';

/** RoB 2.0 domains */
export type RobDomain = 'd1_randomization' | 'd2_deviations' | 'd3_missing' | 'd4_measurement' | 'd5_selection';

/** Per-study Risk of Bias assessment */
export interface StudyRobAssessment {
  domains: Record<RobDomain, RobJudgment>;
  overall: RobJudgment;
  notes: string;
}

/** Complete Risk of Bias data for all studies */
export type RobAssessments = Record<string, StudyRobAssessment>;

/** Study design types for protocol eligibility */
export type StudyDesignType = 'RCT' | 'quasi_experimental' | 'cohort' | 'case_control' | 'cross_sectional' | 'case_series' | 'other';

/** Risk of bias tool options */
export type RobToolType = 'rob2' | 'robins_i' | 'nos' | 'jbi' | 'custom';

/** Database options for information sources */
export type DatabaseType = 'pubmed' | 'embase' | 'central' | 'scopus' | 'web_of_science' | 'cinahl' | 'psycinfo' | 'other';

/** SR/MA Protocol data following PRISMA-P 2015 */
export interface ProtocolData {
  // Section 1: Administrative
  title: string;
  prosperoId: string;
  authors: string;
  contactEmail: string;

  // Section 2: Background
  rationale: string;

  // Section 3: Eligibility Criteria
  studyTypes: StudyDesignType[];
  participants: string;
  interventions: string;
  comparators: string;
  primaryOutcomes: string;
  secondaryOutcomes: string;
  timingOfOutcomes: string;
  setting: string;

  // Section 4: Information Sources
  databases: DatabaseType[];
  otherSources: string;
  searchDateFrom: string;
  searchDateTo: string;

  // Section 5: Search Strategy
  searchStrategy: string;

  // Section 6: Study Selection
  screeningProcess: string;

  // Section 7: Data Collection
  dataExtractionProcess: string;
  dataItems: string;

  // Section 8: Risk of Bias
  robTool: RobToolType;
  robDetails: string;

  // Section 9: Synthesis
  effectMeasure: string;
  synthesisMethod: string;
  heterogeneityAssessment: string;
  subgroupAnalyses: string;
  sensitivityAnalyses: string;

  // Section 10: Meta-bias & Confidence
  publicationBiasAssessment: string;
  confidenceAssessment: string;

  // Section 11: Timeline & Funding
  anticipatedStartDate: string;
  anticipatedEndDate: string;
  funding: string;
  conflictsOfInterest: string;
}

/** PICO-based screening score */
export interface ScreeningScore {
  score: number; // 0-100
  bucket: 'likely' | 'maybe' | 'unlikely';
  matchedTerms: string[];
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
