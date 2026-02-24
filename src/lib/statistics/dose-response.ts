// Dose-Response Meta-Analysis
// Weighted polynomial regression: effect ~ dose (linear or quadratic)

import type { StudyEffect, DoseResponseResult } from '../types';
import { normalCdf } from './distributions';

/**
 * Compute dose-response meta-analysis using weighted least squares regression.
 * Each study must have a dose value. The regression models effect size as a function of dose.
 *
 * Linear model: E[y] = β₀ + β₁ × dose
 * Quadratic model: E[y] = β₀ + β₁ × dose + β₂ × dose²
 *
 * Weights = 1/variance (inverse variance weighting, same as meta-analysis).
 * If fewer than 4 dose levels, only linear model is fitted.
 */
export function doseResponseAnalysis(
  studies: StudyEffect[],
  doses: number[],
  names: string[],
): DoseResponseResult | null {
  // Filter studies with valid dose values
  const valid: { name: string; dose: number; yi: number; sei: number; wi: number }[] = [];
  for (let i = 0; i < studies.length; i++) {
    const dose = doses[i];
    if (dose == null || isNaN(dose)) continue;
    const s = studies[i];
    if (s.sei <= 0 || !isFinite(s.sei)) continue;
    const wi = 1 / (s.sei * s.sei);
    valid.push({ name: names[i], dose, yi: s.yi, sei: s.sei, wi });
  }

  if (valid.length < 3) return null;

  // Try quadratic if enough data points, otherwise linear
  const useQuadratic = valid.length >= 5;
  const modelType = useQuadratic ? 'quadratic' : 'linear';

  // Weighted least squares regression
  // For linear: X = [1, dose], y = effect
  // For quadratic: X = [1, dose, dose²]
  const p = useQuadratic ? 3 : 2; // number of parameters

  // Build matrices (manual computation for small dimensions)
  // XᵀWX and XᵀWy
  const XtWX: number[][] = Array.from({ length: p }, () => Array(p).fill(0));
  const XtWy: number[] = Array(p).fill(0);

  for (const { dose, yi, wi } of valid) {
    const x = useQuadratic ? [1, dose, dose * dose] : [1, dose];
    for (let i = 0; i < p; i++) {
      for (let j = 0; j < p; j++) {
        XtWX[i][j] += wi * x[i] * x[j];
      }
      XtWy[i] += wi * x[i] * yi;
    }
  }

  // Solve XᵀWX * β = XᵀWy using Gaussian elimination
  const beta = solveLinearSystem(XtWX, XtWy);
  if (!beta) return null;

  const intercept = beta[0];
  const beta1 = beta[1];
  const beta2 = useQuadratic ? beta[2] : 0;

  // Compute residuals and R²
  let SSres = 0;
  let SStot = 0;
  const yBar = valid.reduce((s, v) => s + v.wi * v.yi, 0) / valid.reduce((s, v) => s + v.wi, 0);

  for (const { dose, yi, wi } of valid) {
    const fitted = useQuadratic
      ? intercept + beta1 * dose + beta2 * dose * dose
      : intercept + beta1 * dose;
    SSres += wi * (yi - fitted) ** 2;
    SStot += wi * (yi - yBar) ** 2;
  }

  const R2 = SStot > 0 ? Math.max(0, 1 - SSres / SStot) : 0;

  // Standard errors of coefficients from (XᵀWX)⁻¹
  const covMatrix = invertMatrix(XtWX);
  if (!covMatrix) return null;

  const seBeta1 = Math.sqrt(covMatrix[1][1]);
  const zBeta1 = beta1 / seBeta1;
  const pLinear = 2 * (1 - normalCdf(Math.abs(zBeta1)));

  let pQuadratic = 1;
  if (useQuadratic) {
    const seBeta2 = Math.sqrt(covMatrix[2][2]);
    const zBeta2 = beta2 / seBeta2;
    pQuadratic = 2 * (1 - normalCdf(Math.abs(zBeta2)));
  }

  // Overall model test (Wald chi-square)
  const df = p - 1;
  // Q_model = SSreg / 1 (simplified F-test approximation via chi-square)
  const QModel = SStot - SSres;
  // Chi-square p-value for model
  const pModel = chiSquaredPValue(QModel, df);

  // Generate fitted curve points
  const doseMin = Math.min(...valid.map((v) => v.dose));
  const doseMax = Math.max(...valid.map((v) => v.dose));
  const doseRange = doseMax - doseMin;
  const curveSteps = 50;
  const curve: DoseResponseResult['curve'] = [];

  for (let i = 0; i <= curveSteps; i++) {
    const d = doseMin + (doseRange * i) / curveSteps;
    const x = useQuadratic ? [1, d, d * d] : [1, d];
    let fitted = 0;
    for (let j = 0; j < p; j++) fitted += beta[j] * x[j];

    // SE of fitted value: sqrt(x' * (X'WX)^-1 * x)
    let varFitted = 0;
    for (let a = 0; a < p; a++) {
      for (let b = 0; b < p; b++) {
        varFitted += x[a] * covMatrix[a][b] * x[b];
      }
    }
    const seFitted = Math.sqrt(Math.max(0, varFitted));
    curve.push({
      dose: d,
      effect: fitted,
      ciLower: fitted - 1.96 * seFitted,
      ciUpper: fitted + 1.96 * seFitted,
    });
  }

  // Build scatter plot points (on original effect scale for display)
  const points = valid.map((v) => ({
    name: v.name,
    dose: v.dose,
    effect: v.yi,
    weight: v.wi,
    sei: v.sei,
  }));

  return {
    modelType,
    beta1,
    beta2,
    intercept,
    pLinear,
    pQuadratic,
    pModel,
    R2,
    k: valid.length,
    points,
    curve,
  };
}

/** Solve Ax = b by Gaussian elimination with partial pivoting */
function solveLinearSystem(A: number[][], b: number[]): number[] | null {
  const n = A.length;
  // Augmented matrix
  const M = A.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col++) {
    // Partial pivoting
    let maxRow = col;
    let maxVal = Math.abs(M[col][col]);
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(M[row][col]) > maxVal) {
        maxVal = Math.abs(M[row][col]);
        maxRow = row;
      }
    }
    if (maxVal < 1e-12) return null; // Singular
    if (maxRow !== col) [M[col], M[maxRow]] = [M[maxRow], M[col]];

    // Eliminate
    for (let row = col + 1; row < n; row++) {
      const factor = M[row][col] / M[col][col];
      for (let j = col; j <= n; j++) {
        M[row][j] -= factor * M[col][j];
      }
    }
  }

  // Back substitution
  const x = Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    x[i] = M[i][n];
    for (let j = i + 1; j < n; j++) {
      x[i] -= M[i][j] * x[j];
    }
    x[i] /= M[i][i];
  }
  return x;
}

/** Invert a small matrix using Gauss-Jordan elimination */
function invertMatrix(A: number[][]): number[][] | null {
  const n = A.length;
  // Augmented with identity
  const M = A.map((row, i) => {
    const r = [...row];
    for (let j = 0; j < n; j++) r.push(i === j ? 1 : 0);
    return r;
  });

  for (let col = 0; col < n; col++) {
    // Pivot
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(M[row][col]) > Math.abs(M[maxRow][col])) maxRow = row;
    }
    if (Math.abs(M[maxRow][col]) < 1e-12) return null;
    if (maxRow !== col) [M[col], M[maxRow]] = [M[maxRow], M[col]];

    const pivot = M[col][col];
    for (let j = 0; j < 2 * n; j++) M[col][j] /= pivot;

    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = M[row][col];
      for (let j = 0; j < 2 * n; j++) {
        M[row][j] -= factor * M[col][j];
      }
    }
  }

  return M.map((row) => row.slice(n));
}

/** Chi-squared p-value (upper tail) using regularized incomplete gamma function.
 *  Simple approximation for small df. */
function chiSquaredPValue(x: number, df: number): number {
  if (x <= 0 || df <= 0) return 1;
  // Use normal approximation for chi-squared: Z = ((x/df)^(1/3) - (1 - 2/(9*df))) / sqrt(2/(9*df))
  const term = 2 / (9 * df);
  const z = (Math.pow(x / df, 1 / 3) - (1 - term)) / Math.sqrt(term);
  return 1 - normalCdf(z);
}
