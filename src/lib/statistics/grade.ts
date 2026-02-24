// GRADE evidence quality assessment (Guyatt et al., 2008)
// Auto-assesses 3 of 5 factors: inconsistency, imprecision, publication bias
// Risk of bias and indirectness require manual assessment

import type {
  MetaAnalysisResult, EggersTest, BeggsTest,
  GradeAssessment, GradeFactor, GradeLevel, GradeConcern,
} from '../types';
import type { TrimAndFillResult } from './publication-bias';

interface GradeInput {
  result: MetaAnalysisResult;
  eggers: EggersTest | null;
  beggs: BeggsTest | null;
  trimFill: TrimAndFillResult | null;
  /** Manual overrides (user can adjust auto-assessed values) */
  overrides?: {
    riskOfBias?: GradeConcern;
    inconsistency?: GradeConcern;
    indirectness?: GradeConcern;
    imprecision?: GradeConcern;
    publicationBias?: GradeConcern;
  };
}

function concernToDowngrade(concern: GradeConcern): 0 | -1 | -2 {
  if (concern === 'no_concern') return 0;
  if (concern === 'serious') return -1;
  return -2;
}

function scoreToLevel(score: number): GradeLevel {
  if (score >= 4) return 'high';
  if (score >= 3) return 'moderate';
  if (score >= 2) return 'low';
  return 'very_low';
}

function assessInconsistency(result: MetaAnalysisResult): GradeFactor {
  const { I2, pValue } = result.heterogeneity;
  const k = result.studies.length;

  let level: GradeConcern;
  let reasoning: string;

  if (k < 3) {
    level = 'no_concern';
    reasoning = 'Too few studies to assess inconsistency (k < 3).';
  } else if (I2 > 75) {
    level = 'very_serious';
    reasoning = `Considerable heterogeneity (I\u00B2 = ${I2.toFixed(1)}%, Q test p = ${pValue < 0.001 ? '< 0.001' : pValue.toFixed(3)}). Point estimates vary substantially across studies.`;
  } else if (I2 > 50 || pValue < 0.10) {
    level = 'serious';
    reasoning = `Substantial heterogeneity (I\u00B2 = ${I2.toFixed(1)}%, Q test p = ${pValue < 0.001 ? '< 0.001' : pValue.toFixed(3)}).`;
  } else {
    level = 'no_concern';
    reasoning = `Low heterogeneity (I\u00B2 = ${I2.toFixed(1)}%, Q test p = ${pValue.toFixed(3)}). Study results are consistent.`;
  }

  return { level, downgrade: concernToDowngrade(level), auto: true, reasoning };
}

function assessImprecision(result: MetaAnalysisResult): GradeFactor {
  const isRatio = result.measure === 'OR' || result.measure === 'RR' || result.measure === 'HR';
  const nullVal = isRatio ? 1 : 0;
  const k = result.studies.length;

  // Check if CI crosses null
  const ciCrossesNull = isRatio
    ? (result.ciLower <= nullVal && result.ciUpper >= nullVal)
    : (result.ciLower <= nullVal && result.ciUpper >= nullVal);

  // Compute CI width relative to effect
  const ciWidth = result.ciUpper - result.ciLower;

  let level: GradeConcern;
  let reasoning: string;

  if (k <= 2) {
    level = 'serious';
    reasoning = `Very few studies (k = ${k}). Insufficient data for precise estimate.`;
  } else if (ciCrossesNull && ciWidth > (isRatio ? 1.0 : Math.abs(result.effect) * 2 || 1)) {
    level = 'very_serious';
    reasoning = `The 95% CI crosses the null value and is very wide ([${result.ciLower.toFixed(2)}, ${result.ciUpper.toFixed(2)}]), indicating very imprecise results.`;
  } else if (ciCrossesNull) {
    level = 'serious';
    reasoning = `The 95% CI crosses the null value (${isRatio ? `${result.measure} = 1` : `${result.measure} = 0`}), suggesting imprecise results ([${result.ciLower.toFixed(2)}, ${result.ciUpper.toFixed(2)}]).`;
  } else {
    level = 'no_concern';
    reasoning = `The 95% CI does not cross the null value ([${result.ciLower.toFixed(2)}, ${result.ciUpper.toFixed(2)}]). Adequate precision.`;
  }

  return { level, downgrade: concernToDowngrade(level), auto: true, reasoning };
}

function assessPublicationBias(
  result: MetaAnalysisResult,
  eggers: EggersTest | null,
  beggs: BeggsTest | null,
  trimFill: TrimAndFillResult | null,
): GradeFactor {
  const k = result.studies.length;

  if (k < 10) {
    return {
      level: 'no_concern',
      downgrade: 0,
      auto: true,
      reasoning: `Fewer than 10 studies (k = ${k}); publication bias tests have insufficient power. Unable to assess formally.`,
    };
  }

  let sigTests = 0;
  const reasons: string[] = [];

  if (eggers && eggers.pValue < 0.10) {
    sigTests++;
    reasons.push(`Egger's test significant (p = ${eggers.pValue < 0.001 ? '< 0.001' : eggers.pValue.toFixed(3)})`);
  }
  if (beggs && beggs.pValue < 0.10) {
    sigTests++;
    reasons.push(`Begg's test significant (p = ${beggs.pValue < 0.001 ? '< 0.001' : beggs.pValue.toFixed(3)})`);
  }
  if (trimFill && trimFill.k0 > 0) {
    sigTests++;
    reasons.push(`Trim-and-Fill: ${trimFill.k0} missing ${trimFill.k0 === 1 ? 'study' : 'studies'} imputed`);
  }

  let level: GradeConcern;
  let reasoning: string;

  if (sigTests >= 2) {
    level = 'very_serious';
    reasoning = `Multiple indicators suggest publication bias: ${reasons.join('; ')}.`;
  } else if (sigTests === 1) {
    level = 'serious';
    reasoning = `One indicator suggests possible publication bias: ${reasons.join('; ')}.`;
  } else {
    level = 'no_concern';
    const parts: string[] = [];
    if (eggers) parts.push(`Egger's p = ${eggers.pValue.toFixed(3)}`);
    if (beggs) parts.push(`Begg's p = ${beggs.pValue.toFixed(3)}`);
    if (trimFill) parts.push(`Trim-and-Fill: ${trimFill.k0} missing`);
    reasoning = `No significant publication bias detected (${parts.join('; ')}).`;
  }

  return { level, downgrade: concernToDowngrade(level), auto: true, reasoning };
}

/** Compute GRADE evidence quality assessment
 *  Starting from "High" (assuming RCT evidence), with 5 downgrade domains
 */
export function gradeAssessment(input: GradeInput): GradeAssessment {
  const { result, eggers, beggs, trimFill, overrides } = input;

  // Auto-assessed factors
  const inconsistency = assessInconsistency(result);
  const imprecision = assessImprecision(result);
  const publicationBias = assessPublicationBias(result, eggers, beggs, trimFill);

  // Manual factors (default to no concern)
  const riskOfBias: GradeFactor = {
    level: overrides?.riskOfBias || 'no_concern',
    downgrade: concernToDowngrade(overrides?.riskOfBias || 'no_concern'),
    auto: false,
    reasoning: overrides?.riskOfBias === 'very_serious'
      ? 'Very serious risk of bias (manual assessment).'
      : overrides?.riskOfBias === 'serious'
        ? 'Serious risk of bias (manual assessment).'
        : 'No serious risk of bias concerns (requires manual assessment with RoB tool).',
  };

  const indirectness: GradeFactor = {
    level: overrides?.indirectness || 'no_concern',
    downgrade: concernToDowngrade(overrides?.indirectness || 'no_concern'),
    auto: false,
    reasoning: overrides?.indirectness === 'very_serious'
      ? 'Very serious indirectness (manual assessment).'
      : overrides?.indirectness === 'serious'
        ? 'Serious indirectness in population, intervention, comparator, or outcome (manual assessment).'
        : 'No serious indirectness concerns (requires manual assessment of PICO alignment).',
  };

  // Apply overrides to auto-assessed factors
  if (overrides?.inconsistency) {
    inconsistency.level = overrides.inconsistency;
    inconsistency.downgrade = concernToDowngrade(overrides.inconsistency);
    inconsistency.auto = false;
  }
  if (overrides?.imprecision) {
    imprecision.level = overrides.imprecision;
    imprecision.downgrade = concernToDowngrade(overrides.imprecision);
    imprecision.auto = false;
  }
  if (overrides?.publicationBias) {
    publicationBias.level = overrides.publicationBias;
    publicationBias.downgrade = concernToDowngrade(overrides.publicationBias);
    publicationBias.auto = false;
  }

  const factors = { riskOfBias, inconsistency, indirectness, imprecision, publicationBias };

  // Calculate overall score: start at 4 (high), downgrade
  const totalDowngrade = Object.values(factors).reduce((sum, f) => sum + f.downgrade, 0);
  const score = Math.max(1, 4 + totalDowngrade);

  return {
    overall: scoreToLevel(score),
    score,
    factors,
  };
}
