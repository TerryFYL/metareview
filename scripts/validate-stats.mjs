/**
 * Validation script: Run MetaReview statistical engine on demo data
 * and output all results as JSON for cross-validation.
 *
 * Uses the same logic as the production code (re-implemented in plain JS
 * to avoid TS compilation issues).
 */

// === Demo Data (from store.ts) ===
const studies = [
  { id: 'd1', name: 'ISIS-2', year: 1988, data: { events1: 791, total1: 8587, events2: 1029, total2: 8600 } },
  { id: 'd2', name: 'SALT', year: 1991, data: { events1: 150, total1: 676, events2: 196, total2: 684 } },
  { id: 'd3', name: 'UK-TIA', year: 1991, data: { events1: 286, total1: 1632, events2: 168, total2: 814 } },
  { id: 'd4', name: 'ESPS-2', year: 1996, data: { events1: 356, total1: 1649, events2: 441, total2: 1649 } },
  { id: 'd5', name: 'TPT', year: 1998, data: { events1: 142, total1: 2545, events2: 166, total2: 2540 } },
  { id: 'd6', name: 'HOT', year: 1998, data: { events1: 127, total1: 9399, events2: 151, total2: 9391 } },
  { id: 'd7', name: 'PPP', year: 2001, data: { events1: 20, total1: 2226, events2: 32, total2: 2269 } },
];

// === Distribution functions (from distributions.ts) ===
const SQRT2PI = Math.sqrt(2 * Math.PI);

function normalPdf(x) {
  return Math.exp(-0.5 * x * x) / SQRT2PI;
}

function normalCdf(x) {
  if (x < -8) return 0;
  if (x > 8) return 1;
  const negative = x < 0;
  if (negative) x = -x;
  const t = 1 / (1 + 0.2316419 * x);
  const d = normalPdf(x);
  const p = d * t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return negative ? p : 1 - p;
}

function zToP(z) {
  return 2 * (1 - normalCdf(Math.abs(z)));
}

function logGamma(x) {
  const g = 7;
  const coef = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  if (x < 0.5) {
    return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x);
  }
  x -= 1;
  let sum = coef[0];
  for (let i = 1; i < g + 2; i++) {
    sum += coef[i] / (x + i);
  }
  const t = x + g + 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(sum);
}

function regularizedGammaP(a, x) {
  if (x <= 0) return 0;
  const lnA = logGamma(a);
  if (x < a + 1) return gammaPSeries(a, x, lnA);
  return 1 - gammaPContinuedFraction(a, x, lnA);
}

function gammaPSeries(a, x, lnA) {
  let sum = 1 / a;
  let term = sum;
  for (let n = 1; n < 200; n++) {
    term *= x / (a + n);
    sum += term;
    if (Math.abs(term) < Math.abs(sum) * 1e-14) break;
  }
  return sum * Math.exp(-x + a * Math.log(x) - lnA);
}

function gammaPContinuedFraction(a, x, lnA) {
  let f = 1e-30;
  let c = f;
  let d = 0;
  for (let i = 1; i < 200; i++) {
    const an = i % 2 === 1 ? ((i + 1) / 2 - a) : i / 2;
    const bn = x + i - (i % 2 === 1 ? 0 : a - 1);
    d = bn + an * d;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    c = bn + an / c;
    if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d;
    const delta = c * d;
    f *= delta;
    if (Math.abs(delta - 1) < 1e-14) break;
  }
  return f * Math.exp(-x + a * Math.log(x) - lnA);
}

function chiSquaredCdf(x, df) {
  if (x <= 0) return 0;
  return regularizedGammaP(df / 2, x / 2);
}

function chiSquaredPValue(x, df) {
  return 1 - chiSquaredCdf(x, df);
}

function incompleteBeta(x, a, b) {
  if (x === 0 || x === 1) return x;
  const lnBeta = logGamma(a) + logGamma(b) - logGamma(a + b);
  const front = Math.exp(Math.log(x) * a + Math.log(1 - x) * b - lnBeta) / a;
  let f = 1, c = 1;
  let d = 1 - ((a + b) * x) / (a + 1);
  if (Math.abs(d) < 1e-30) d = 1e-30;
  d = 1 / d;
  f = d;
  for (let m = 1; m <= 200; m++) {
    let numerator = (m * (b - m) * x) / ((a + 2 * m - 1) * (a + 2 * m));
    d = 1 + numerator * d;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    c = 1 + numerator / c;
    if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d;
    f *= c * d;
    numerator = -(((a + m) * (a + b + m) * x) / ((a + 2 * m) * (a + 2 * m + 1)));
    d = 1 + numerator * d;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    c = 1 + numerator / c;
    if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d;
    const delta = c * d;
    f *= delta;
    if (Math.abs(delta - 1) < 1e-10) break;
  }
  return front * f;
}

function tCdf(t, df) {
  const x = df / (df + t * t);
  const p = 0.5 * incompleteBeta(x, df / 2, 0.5);
  return t >= 0 ? 1 - p : p;
}

function tToP(t, df) {
  return 2 * (1 - tCdf(Math.abs(t), df));
}

// === Effect Size (from effect-size.ts) ===
function correctZeroCells(d) {
  const hasZero = d.events1 === 0 || d.events2 === 0 || d.events1 === d.total1 || d.events2 === d.total2;
  if (!hasZero) return d;
  return {
    events1: d.events1 + 0.5,
    total1: d.total1 + 1,
    events2: d.events2 + 0.5,
    total2: d.total2 + 1,
  };
}

function logOddsRatio(raw) {
  const d = correctZeroCells(raw);
  const a = d.events1;
  const b = d.total1 - d.events1;
  const c = d.events2;
  const dd = d.total2 - d.events2;
  const yi = Math.log((a * dd) / (b * c));
  const sei = Math.sqrt(1 / a + 1 / b + 1 / c + 1 / dd);
  return { yi, sei };
}

// === Meta-analysis (from meta-analysis.ts) ===
function computeStudyEffects(studies) {
  return studies.map(s => {
    const { yi, sei } = logOddsRatio(s.data);
    const vi = sei * sei;
    const lower = Math.exp(yi - 1.96 * sei);
    const upper = Math.exp(yi + 1.96 * sei);
    return { id: s.id, name: s.name, year: s.year, yi, sei, vi, ciLower: lower, ciUpper: upper, effect: Math.exp(yi) };
  });
}

function fixedEffects(effects) {
  const weights = effects.map(e => 1 / e.vi);
  const sumW = weights.reduce((a, b) => a + b, 0);
  const summary = effects.reduce((s, e, i) => s + weights[i] * e.yi, 0) / sumW;
  const se = Math.sqrt(1 / sumW);
  return { summary, se, weights };
}

function computeHeterogeneity(effects, summaryFixed) {
  const k = effects.length;
  const df = k - 1;
  if (df <= 0) return { Q: 0, df: 0, pValue: 1, I2: 0, tau2: 0, tau: 0, H2: 1 };
  const weights = effects.map(e => 1 / e.vi);
  const sumW = weights.reduce((a, b) => a + b, 0);
  const sumW2 = weights.reduce((a, w) => a + w * w, 0);
  const Q = effects.reduce((sum, e, i) => sum + weights[i] * (e.yi - summaryFixed) ** 2, 0);
  const pValue = chiSquaredPValue(Q, df);
  const C = sumW - sumW2 / sumW;
  const tau2 = Math.max(0, (Q - df) / C);
  const tau = Math.sqrt(tau2);
  const I2 = df > 0 ? Math.max(0, ((Q - df) / Q) * 100) : 0;
  const H2 = df > 0 ? Q / df : 1;
  return { Q, df, pValue, I2, tau2, tau, H2 };
}

function randomEffects(effects, tau2) {
  const weights = effects.map(e => 1 / (e.vi + tau2));
  const sumW = weights.reduce((a, b) => a + b, 0);
  const summary = effects.reduce((s, e, i) => s + weights[i] * e.yi, 0) / sumW;
  const se = Math.sqrt(1 / sumW);
  return { summary, se, weights };
}

// === Egger's test (from publication-bias.ts) ===
function eggersTest(studyEffects) {
  const k = studyEffects.length;
  if (k < 3) return null;
  const df = k - 2;
  const x = studyEffects.map(s => 1 / s.sei);
  const y = studyEffects.map(s => s.yi / s.sei);
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
  const residuals = y.map((yi, i) => yi - (intercept + slope * x[i]));
  const sse = residuals.reduce((s, r) => s + r * r, 0);
  const mse = sse / df;
  const seIntercept = Math.sqrt(mse * (1 / n + (meanX * meanX) / Sxx));
  const tValue = intercept / seIntercept;
  const pValue = tToP(tValue, df);
  return { intercept, se: seIntercept, tValue, pValue, df };
}

// === RUN ===
const rawEffects = computeStudyEffects(studies);
const fixed = fixedEffects(rawEffects);
const het = computeHeterogeneity(rawEffects, fixed.summary);
const random = randomEffects(rawEffects, het.tau2);

const totalWeightRE = random.weights.reduce((a, b) => a + b, 0);
const totalWeightFE = fixed.weights.reduce((a, b) => a + b, 0);

const studyResults = rawEffects.map((e, i) => ({
  name: e.name,
  yi: e.yi,
  sei: e.sei,
  vi: e.vi,
  effect_OR: e.effect,
  ci_lower: e.ciLower,
  ci_upper: e.ciUpper,
  weight_fixed_pct: (fixed.weights[i] / totalWeightFE) * 100,
  weight_random_pct: (random.weights[i] / totalWeightRE) * 100,
}));

const summaryZ = random.summary / random.se;
const summaryP = zToP(summaryZ);

const eggers = eggersTest(rawEffects);

const result = {
  metareview_version: 'engine-extract',
  measure: 'OR',
  model: 'random (DerSimonian-Laird)',
  studies: studyResults,
  pooled: {
    log_OR: random.summary,
    OR: Math.exp(random.summary),
    se: random.se,
    ci_lower: Math.exp(random.summary - 1.96 * random.se),
    ci_upper: Math.exp(random.summary + 1.96 * random.se),
    z: summaryZ,
    p_value: summaryP,
  },
  heterogeneity: {
    Q: het.Q,
    df: het.df,
    Q_pvalue: het.pValue,
    I2: het.I2,
    tau2: het.tau2,
    tau: het.tau,
    H2: het.H2,
  },
  eggers_test: eggers,
  fixed_effects: {
    log_OR: fixed.summary,
    OR: Math.exp(fixed.summary),
    se: fixed.se,
    ci_lower: Math.exp(fixed.summary - 1.96 * fixed.se),
    ci_upper: Math.exp(fixed.summary + 1.96 * fixed.se),
  }
};

console.log(JSON.stringify(result, null, 2));
