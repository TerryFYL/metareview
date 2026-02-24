/**
 * Comprehensive Engine Validation for MetaReview
 * Cycle 78 QA — Tests RR, MD, SMD, zero-cell, high heterogeneity, edge cases
 *
 * Re-implements the MetaReview engine logic in plain JS (same as production code)
 * to avoid TS compilation. Outputs JSON for cross-validation with Python gold standard.
 */

// ============================================================
// Distribution functions (from distributions.ts)
// ============================================================

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
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x);
  x -= 1;
  let sum = coef[0];
  for (let i = 1; i < g + 2; i++) sum += coef[i] / (x + i);
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
  let sum = 1 / a, term = sum;
  for (let n = 1; n < 200; n++) {
    term *= x / (a + n);
    sum += term;
    if (Math.abs(term) < Math.abs(sum) * 1e-14) break;
  }
  return sum * Math.exp(-x + a * Math.log(x) - lnA);
}

function gammaPContinuedFraction(a, x, lnA) {
  // Legendre continued fraction for Q(a,x) via modified Lentz's method
  let b = x + 1 - a;
  let c = 1e30;
  let d = 1 / b;
  let f = d;
  for (let i = 1; i <= 200; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    c = b + an / c;
    if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d;
    const delta = d * c;
    f *= delta;
    if (Math.abs(delta - 1) < 1e-10) break;
  }
  return f * Math.exp(-x + a * Math.log(x) - lnA);
}

function chiSquaredPValue(x, df) {
  if (x <= 0) return 1;
  return Math.max(0, 1 - regularizedGammaP(df / 2, x / 2));
}

// ============================================================
// Effect size functions (from effect-size.ts)
// ============================================================

function correctZeroCells(d) {
  const hasZero = d.events1 === 0 || d.events2 === 0 || d.events1 === d.total1 || d.events2 === d.total2;
  if (!hasZero) return d;
  return {
    events1: d.events1 + 0.5, total1: d.total1 + 1,
    events2: d.events2 + 0.5, total2: d.total2 + 1,
  };
}

function logOddsRatio(raw) {
  const d = correctZeroCells(raw);
  const a = d.events1, b = d.total1 - d.events1, c = d.events2, dd = d.total2 - d.events2;
  return { yi: Math.log((a * dd) / (b * c)), sei: Math.sqrt(1/a + 1/b + 1/c + 1/dd) };
}

function logRiskRatio(raw) {
  const d = correctZeroCells(raw);
  const p1 = d.events1 / d.total1, p2 = d.events2 / d.total2;
  return { yi: Math.log(p1 / p2), sei: Math.sqrt((1 - p1) / d.events1 + (1 - p2) / d.events2) };
}

function meanDiff(d) {
  const yi = d.mean1 - d.mean2;
  const sei = Math.sqrt(d.sd1 * d.sd1 / d.n1 + d.sd2 * d.sd2 / d.n2);
  return { yi, sei };
}

function hedgesG(d) {
  const df = d.n1 + d.n2 - 2;
  const sp = Math.sqrt(((d.n1 - 1) * d.sd1 * d.sd1 + (d.n2 - 1) * d.sd2 * d.sd2) / df);
  const cohenD = (d.mean1 - d.mean2) / sp;
  const J = 1 - 3 / (4 * df - 1);
  const yi = cohenD * J;
  const sei = Math.sqrt((d.n1 + d.n2) / (d.n1 * d.n2) + yi * yi / (2 * (d.n1 + d.n2))) * J;
  return { yi, sei };
}

function calculateEffectSize(data, measure) {
  if ('yi' in data && 'sei' in data) return { yi: data.yi, sei: data.sei };
  if ('events1' in data) {
    if (measure === 'OR') return logOddsRatio(data);
    if (measure === 'RR') return logRiskRatio(data);
    throw new Error(`Measure ${measure} requires continuous data`);
  }
  if ('mean1' in data) {
    if (measure === 'MD') return meanDiff(data);
    if (measure === 'SMD') return hedgesG(data);
    throw new Error(`Measure ${measure} requires binary data`);
  }
  throw new Error('Invalid data format');
}

function toOriginalScale(yi, measure) {
  return (measure === 'OR' || measure === 'RR') ? Math.exp(yi) : yi;
}

function isLogScale(measure) {
  return measure === 'OR' || measure === 'RR';
}

function calculateCI(yi, sei, measure) {
  const lower = yi - 1.96 * sei;
  const upper = yi + 1.96 * sei;
  return isLogScale(measure)
    ? { lower: Math.exp(lower), upper: Math.exp(upper) }
    : { lower, upper };
}

// ============================================================
// Meta-analysis engine (from meta-analysis.ts)
// ============================================================

function metaAnalysis(studies, measure, model = 'random') {
  const rawEffects = studies.map(s => {
    const { yi, sei } = calculateEffectSize(s.data, measure);
    const vi = sei * sei;
    const ci = calculateCI(yi, sei, measure);
    return { id: s.id, name: s.name, yi, sei, vi, ciLower: ci.lower, ciUpper: ci.upper, effect: toOriginalScale(yi, measure) };
  });

  // Fixed effects
  const wFE = rawEffects.map(e => 1 / e.vi);
  const sumWFE = wFE.reduce((a, b) => a + b, 0);
  const summaryFE = rawEffects.reduce((s, e, i) => s + wFE[i] * e.yi, 0) / sumWFE;
  const seFE = Math.sqrt(1 / sumWFE);

  // Heterogeneity
  const k = rawEffects.length;
  const df = k - 1;
  let het;
  if (df <= 0) {
    het = { Q: 0, df: 0, pValue: 1, I2: 0, tau2: 0, tau: 0, H2: 1 };
  } else {
    const Q = rawEffects.reduce((sum, e, i) => sum + wFE[i] * (e.yi - summaryFE) ** 2, 0);
    const sumW2 = wFE.reduce((a, w) => a + w * w, 0);
    const C = sumWFE - sumW2 / sumWFE;
    const tau2 = Math.max(0, (Q - df) / C);
    const pValue = chiSquaredPValue(Q, df);
    const I2 = df > 0 ? Math.max(0, ((Q - df) / Q) * 100) : 0;
    const H2 = df > 0 ? Q / df : 1;
    het = { Q, df, pValue, I2, tau2, tau: Math.sqrt(tau2), H2 };
  }

  // Random effects
  const wRE = rawEffects.map(e => 1 / (e.vi + het.tau2));
  const sumWRE = wRE.reduce((a, b) => a + b, 0);
  const summaryRE = rawEffects.reduce((s, e, i) => s + wRE[i] * e.yi, 0) / sumWRE;
  const seRE = Math.sqrt(1 / sumWRE);

  const summary = model === 'fixed' ? summaryFE : summaryRE;
  const se = model === 'fixed' ? seFE : seRE;
  const z = summary / se;
  const pValue = zToP(z);

  return { summary, se, z, pValue, heterogeneity: het, rawEffects };
}

// ============================================================
// Test Datasets (same as Python gold standard)
// ============================================================

const aspirinStudies = [
  { id: 'd1', name: 'ISIS-2', data: { events1: 791, total1: 8587, events2: 1029, total2: 8600 } },
  { id: 'd2', name: 'SALT', data: { events1: 150, total1: 676, events2: 196, total2: 684 } },
  { id: 'd3', name: 'UK-TIA', data: { events1: 286, total1: 1632, events2: 168, total2: 814 } },
  { id: 'd4', name: 'ESPS-2', data: { events1: 356, total1: 1649, events2: 441, total2: 1649 } },
  { id: 'd5', name: 'TPT', data: { events1: 142, total1: 2545, events2: 166, total2: 2540 } },
  { id: 'd6', name: 'HOT', data: { events1: 127, total1: 9399, events2: 151, total2: 9391 } },
  { id: 'd7', name: 'PPP', data: { events1: 20, total1: 2226, events2: 32, total2: 2269 } },
];

const bpStudies = [
  { id: 'c1', name: 'Trial_A', data: { mean1: -10.2, sd1: 5.1, n1: 50, mean2: -3.1, sd2: 4.2, n2: 48 } },
  { id: 'c2', name: 'Trial_B', data: { mean1: -8.5, sd1: 6.0, n1: 35, mean2: -2.3, sd2: 5.0, n2: 40 } },
  { id: 'c3', name: 'Trial_C', data: { mean1: -12.0, sd1: 4.3, n1: 60, mean2: -4.0, sd2: 5.2, n2: 55 } },
  { id: 'c4', name: 'Trial_D', data: { mean1: -6.8, sd1: 7.2, n1: 25, mean2: -1.5, sd2: 6.0, n2: 30 } },
  { id: 'c5', name: 'Trial_E', data: { mean1: -15.0, sd1: 5.0, n1: 45, mean2: -5.5, sd2: 4.0, n2: 42 } },
  { id: 'c6', name: 'Trial_F', data: { mean1: -9.0, sd1: 5.5, n1: 70, mean2: -3.2, sd2: 4.5, n2: 65 } },
];

const zeroCellStudies = [
  { id: 'z1', name: 'ZC_1', data: { events1: 0, total1: 20, events2: 5, total2: 22 } },
  { id: 'z2', name: 'ZC_2', data: { events1: 3, total1: 30, events2: 8, total2: 28 } },
  { id: 'z3', name: 'ZC_3', data: { events1: 1, total1: 15, events2: 6, total2: 18 } },
  { id: 'z4', name: 'ZC_4', data: { events1: 10, total1: 50, events2: 0, total2: 45 } },
];

const highHetStudies = [
  { id: 'h1', name: 'HH_1', data: { events1: 5, total1: 100, events2: 10, total2: 100 } },
  { id: 'h2', name: 'HH_2', data: { events1: 30, total1: 100, events2: 15, total2: 100 } },
  { id: 'h3', name: 'HH_3', data: { events1: 20, total1: 200, events2: 25, total2: 200 } },
  { id: 'h4', name: 'HH_4', data: { events1: 40, total1: 80, events2: 20, total2: 80 } },
  { id: 'h5', name: 'HH_5', data: { events1: 3, total1: 150, events2: 10, total2: 150 } },
];

const singleStudy = [
  { id: 's1', name: 'Solo', data: { events1: 50, total1: 200, events2: 70, total2: 200 } },
];

const twoStudies = [
  { id: 't1', name: 'Duo_A', data: { events1: 30, total1: 100, events2: 45, total2: 100 } },
  { id: 't2', name: 'Duo_B', data: { events1: 15, total1: 80, events2: 25, total2: 80 } },
];

// ============================================================
// Run all scenarios
// ============================================================

const results = {};

function formatPooled(ma, measure) {
  const isLog = measure === 'OR' || measure === 'RR';
  const pooled = {
    se: ma.se,
    z: ma.z,
    pValue: ma.pValue,
  };
  if (isLog) {
    const key = `log_${measure}`;
    pooled[key] = ma.summary;
    pooled[measure] = Math.exp(ma.summary);
    pooled.ciLower = Math.exp(ma.summary - 1.96 * ma.se);
    pooled.ciUpper = Math.exp(ma.summary + 1.96 * ma.se);
  } else {
    pooled[measure] = ma.summary;
    pooled.ciLower = ma.summary - 1.96 * ma.se;
    pooled.ciUpper = ma.summary + 1.96 * ma.se;
  }
  return pooled;
}

function formatStudies(ma) {
  return ma.rawEffects.map(e => ({
    name: e.name, yi: e.yi, sei: e.sei, vi: e.vi,
    effect: e.effect, ciLower: e.ciLower, ciUpper: e.ciUpper,
  }));
}

// Scenario 1: RR
const ma_rr = metaAnalysis(aspirinStudies, 'RR');
results.scenario_1_rr = {
  description: "Risk Ratio with Aspirin binary data (7 studies)",
  measure: "RR", model: "random",
  studies: formatStudies(ma_rr),
  pooled: formatPooled(ma_rr, 'RR'),
  heterogeneity: ma_rr.heterogeneity,
};

// Scenario 2: MD
const ma_md = metaAnalysis(bpStudies, 'MD');
results.scenario_2_md = {
  description: "Mean Difference with blood pressure data (6 studies)",
  measure: "MD", model: "random",
  studies: formatStudies(ma_md),
  pooled: formatPooled(ma_md, 'MD'),
  heterogeneity: ma_md.heterogeneity,
};

// Scenario 3: SMD
const ma_smd = metaAnalysis(bpStudies, 'SMD');
results.scenario_3_smd = {
  description: "Standardized Mean Difference (Hedges' g) with blood pressure data (6 studies)",
  measure: "SMD", model: "random",
  studies: formatStudies(ma_smd),
  pooled: formatPooled(ma_smd, 'SMD'),
  heterogeneity: ma_smd.heterogeneity,
};

// Scenario 4: Zero-cell OR
const ma_zc = metaAnalysis(zeroCellStudies, 'OR');
results.scenario_4_zero_cell = {
  description: "Zero-cell correction with OR (4 studies)",
  measure: "OR", model: "random",
  studies: formatStudies(ma_zc),
  pooled: formatPooled(ma_zc, 'OR'),
  heterogeneity: ma_zc.heterogeneity,
};

// Scenario 5: High heterogeneity
const ma_hh = metaAnalysis(highHetStudies, 'OR');
results.scenario_5_high_het = {
  description: "High heterogeneity with OR (5 studies)",
  measure: "OR", model: "random",
  studies: formatStudies(ma_hh),
  pooled: formatPooled(ma_hh, 'OR'),
  heterogeneity: ma_hh.heterogeneity,
};

// Scenario 6a: k=1
const ma_k1 = metaAnalysis(singleStudy, 'OR');
results.scenario_6a_k1 = {
  description: "Single study (k=1)",
  measure: "OR", model: "random",
  studies: formatStudies(ma_k1),
  pooled: { log_OR: ma_k1.summary, OR: Math.exp(ma_k1.summary), se: ma_k1.se },
  heterogeneity: ma_k1.heterogeneity,
};

// Scenario 6b: k=2
const ma_k2 = metaAnalysis(twoStudies, 'OR');
results.scenario_6b_k2 = {
  description: "Two studies (k=2)",
  measure: "OR", model: "random",
  studies: formatStudies(ma_k2),
  pooled: formatPooled(ma_k2, 'OR'),
  heterogeneity: ma_k2.heterogeneity,
};

// Scenario 7: RR with zero-cell
const ma_rr_zc = metaAnalysis(zeroCellStudies, 'RR');
results.scenario_7_rr_zero_cell = {
  description: "Risk Ratio with zero-cell data (4 studies)",
  measure: "RR", model: "random",
  studies: formatStudies(ma_rr_zc),
  pooled: formatPooled(ma_rr_zc, 'RR'),
  heterogeneity: ma_rr_zc.heterogeneity,
};

console.log(JSON.stringify(results, null, 2));
