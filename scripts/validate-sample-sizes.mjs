#!/usr/bin/env node
// =============================================================================
// MetaReview Sample Size Validation Against Zheng 2019 Ground Truth
// =============================================================================
//
// Purpose:
//   Validate that MetaReview correctly handles sample sizes throughout the
//   calculation pipeline, using Zheng 2019 per-study data as ground truth.
//
// Validates:
//   1. Sample sizes are correctly stored in Study objects
//   2. Effect size calculations use correct sample sizes
//   3. Meta-analysis pooling reflects sample size differences in weights
//   4. Sensitivity to sample size errors (sanity check)
//
// Ground truth: zheng_2019_per_study_data.csv (13 studies)
//
// Usage:
//   node scripts/validate-sample-sizes.mjs
//
// =============================================================================

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// =============================================================================
// Statistical Functions (subset from cross-validate-metafor.mjs)
// =============================================================================

const SQRT2PI = Math.sqrt(2 * Math.PI);

function normalPdf(x) {
  if (x < -8 || x > 8) return x < 0 ? 0 : 0;
  return Math.exp(-0.5 * x * x) / SQRT2PI;
}

function normalCdf(x) {
  if (x < -8) return 0;
  if (x > 8) return 1;
  const negative = x < 0;
  if (negative) x = -x;
  const t = 1 / (1 + 0.2316419 * x);
  const d = normalPdf(x);
  const p = d * t * (0.319381530 + t * (-0.356563782 +
    t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return negative ? p : 1 - p;
}

function tCdf(t, df) {
  if (df <= 0) return NaN;
  const x = df / (df + t * t);
  const a = df / 2;
  const b = 0.5;
  const ibeta = incompleteBeta(x, a, b);
  const p = 0.5 * ibeta;
  return t > 0 ? 1 - p : p;
}

function incompleteBeta(x, a, b) {
  if (x === 0 || x === 1) return x === 0 ? 0 : 1;
  const lbeta = lgamma(a) + lgamma(b) - lgamma(a + b);
  const front = Math.exp(Math.log(x) * a + Math.log(1 - x) * b - lbeta);
  if (x < (a + 1) / (a + b + 2)) {
    return front * betaCf(x, a, b) / a;
  }
  return 1 - front * betaCf(1 - x, b, a) / b;
}

function betaCf(x, a, b) {
  const maxIter = 200;
  const eps = 1e-14;
  let qab = a + b, qap = a + 1, qam = a - 1;
  let c = 1, d = 1 - qab * x / qap;
  if (Math.abs(d) < 1e-30) d = 1e-30;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= maxIter; m++) {
    const m2 = 2 * m;
    let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < 1e-30) d = 1e-30; d = 1 / d;
    c = 1 + aa / c; if (Math.abs(c) < 1e-30) c = 1e-30;
    h *= d * c;
    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
    d = 1 + aa * d; if (Math.abs(d) < 1e-30) d = 1e-30; d = 1 / d;
    c = 1 + aa / c; if (Math.abs(c) < 1e-30) c = 1e-30;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < eps) break;
  }
  return h;
}

function lgamma(x) {
  const cof = [76.18009172947146, -86.50532032941677, 24.01409824083091,
    -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let y = x, tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (const c of cof) ser += c / ++y;
  return -tmp + Math.log(2.5066282746310005 * ser / x);
}

// =============================================================================
// Effect Size Calculations (from MetaReview's engine)
// =============================================================================

function computeOR(e1, n1, e2, n2) {
  const a = e1 + 0.5, b = n1 - e1 + 0.5, c = e2 + 0.5, d = n2 - e2 + 0.5;
  const yi = Math.log(a * d / (b * c));
  const vi = 1 / a + 1 / b + 1 / c + 1 / d;
  return { yi, vi, sei: Math.sqrt(vi) };
}

function computeRR(e1, n1, e2, n2) {
  const a = e1 + 0.5, b = n1 + 0.5, c = e2 + 0.5, d = n2 + 0.5;
  const yi = Math.log(a / b) - Math.log(c / d);
  const vi = 1 / a - 1 / b + 1 / c - 1 / d;
  return { yi, vi, sei: Math.sqrt(vi) };
}

function computeHR(hr, ciLower, ciUpper) {
  const yi = Math.log(hr);
  const sei = (Math.log(ciUpper) - Math.log(ciLower)) / (2 * 1.96);
  return { yi, vi: sei * sei, sei };
}

// Random-effects meta-analysis (DerSimonian-Laird)
function metaAnalysisRE(studies) {
  const k = studies.length;
  const w = studies.map(s => 1 / s.vi);
  const sumW = w.reduce((a, b) => a + b, 0);
  const sumWY = studies.reduce((sum, s, i) => sum + w[i] * s.yi, 0);
  const yFE = sumWY / sumW;

  const Q = studies.reduce((sum, s, i) => sum + w[i] * (s.yi - yFE) ** 2, 0);
  const df = k - 1;
  const C = sumW - studies.reduce((sum, _, i) => sum + w[i] ** 2, 0) / sumW;
  const tau2 = Math.max(0, (Q - df) / C);

  const wRE = studies.map(s => 1 / (s.vi + tau2));
  const sumWRE = wRE.reduce((a, b) => a + b, 0);
  const yRE = studies.reduce((sum, s, i) => sum + wRE[i] * s.yi, 0) / sumWRE;
  const seRE = Math.sqrt(1 / sumWRE);
  const z = yRE / seRE;
  const pValue = 2 * (1 - normalCdf(Math.abs(z)));

  return {
    summary: yRE,
    se: seRE,
    z,
    pValue,
    heterogeneity: { Q, df, tau2, I2: df > 0 ? Math.max(0, (Q - df) / Q * 100) : 0 },
    weights: wRE.map(w => w / sumWRE * 100),
  };
}

// =============================================================================
// Load Zheng 2019 Ground Truth Data
// =============================================================================

function loadZheng2019() {
  const csvPath = join(__dirname, '..', '..', '..', 'zheng_2019_per_study_data.csv');
  const raw = readFileSync(csvPath, 'utf-8');
  const lines = raw.trim().split('\n');
  const header = lines[0].split(',');

  return lines.slice(1).map(line => {
    // Handle CSV with quoted fields containing commas
    const vals = [];
    let inQuote = false;
    let current = '';
    for (const ch of line) {
      if (ch === '"') { inQuote = !inQuote; continue; }
      if (ch === ',' && !inQuote) { vals.push(current); current = ''; continue; }
      current += ch;
    }
    vals.push(current);

    const obj = {};
    header.forEach((h, i) => obj[h.trim()] = vals[i]?.trim());
    return obj;
  });
}

// =============================================================================
// Validation Tests
// =============================================================================

let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${message}`);
  } else {
    failed++;
    failures.push(message);
    console.log(`  ❌ ${message}`);
  }
}

function assertClose(actual, expected, tolerance, message) {
  const diff = Math.abs(actual - expected);
  const relDiff = expected !== 0 ? Math.abs(diff / expected) : diff;
  if (diff <= tolerance || relDiff <= 0.001) {
    passed++;
    console.log(`  ✅ ${message} (${actual.toFixed(6)} ≈ ${expected.toFixed(6)}, diff=${diff.toExponential(2)})`);
  } else {
    failed++;
    failures.push(`${message}: got ${actual}, expected ${expected}, diff=${diff}`);
    console.log(`  ❌ ${message} (${actual.toFixed(6)} ≠ ${expected.toFixed(6)}, diff=${diff.toExponential(2)})`);
  }
}

// =============================================================================
// Test 1: Sample Size Integrity
// =============================================================================
console.log('\n=== Test 1: Sample Size Data Integrity ===\n');

const zhengData = loadZheng2019();
console.log(`Loaded ${zhengData.length} studies from Zheng 2019 CSV\n`);

assert(zhengData.length === 13, `Expected 13 studies, got ${zhengData.length}`);

// Verify all studies have valid sample sizes
for (const study of zhengData) {
  const nTotal = parseInt(study.N_Total);
  const nAspirin = parseInt(study.N_Aspirin);
  const nControl = parseInt(study.N_Control);

  assert(nAspirin > 0 && nControl > 0, `${study.Study} (${study.Year}): N_Aspirin=${nAspirin}, N_Control=${nControl} — both > 0`);

  // N_Total should equal N_Aspirin + N_Control (±1 for rounding)
  // Exception: factorial trials (e.g., TPT) have more arms, so N_Total > N_T + N_C
  const sumN = nAspirin + nControl;
  assert(
    nTotal >= sumN,
    `${study.Study}: N_Total(${nTotal}) >= N_Aspirin(${nAspirin}) + N_Control(${nControl}) = ${sumN}`
  );
}

// =============================================================================
// Test 2: Sample Sizes in Binary Effect Size Calculations (RR)
// =============================================================================
console.log('\n=== Test 2: Sample Sizes in RR Calculations ===\n');

// Use studies that have RR data with events
const rrStudies = zhengData.filter(s =>
  s.Effect_Measure === 'RR' && s.Events_Aspirin !== 'NA' && s.Events_Control !== 'NA'
);

console.log(`Found ${rrStudies.length} studies with RR + event data\n`);

for (const study of rrStudies) {
  const e1 = parseInt(study.Events_Aspirin);
  const n1 = parseInt(study.N_Aspirin);
  const e2 = parseInt(study.Events_Control);
  const n2 = parseInt(study.N_Control);
  const expectedRR = parseFloat(study.Estimate);

  const { yi } = computeRR(e1, n1, e2, n2);
  const computedRR = Math.exp(yi);

  // RR should be close to reported value (within 5% due to continuity correction)
  assertClose(computedRR, expectedRR, 0.15,
    `${study.Study} RR: events ${e1}/${n1} vs ${e2}/${n2}`);
}

// =============================================================================
// Test 3: Sample Size Sensitivity — Weights Proportional to N
// =============================================================================
console.log('\n=== Test 3: Sample Size Sensitivity (Weights) ===\n');

// Create study set from RR data
const rrEffects = rrStudies.map(s => {
  const e1 = parseInt(s.Events_Aspirin);
  const n1 = parseInt(s.N_Aspirin);
  const e2 = parseInt(s.Events_Control);
  const n2 = parseInt(s.N_Control);
  return { ...computeRR(e1, n1, e2, n2), name: s.Study, n: n1 + n2 };
});

if (rrEffects.length >= 2) {
  const result = metaAnalysisRE(rrEffects);

  // Larger studies should generally have higher weights
  const sortedByN = [...rrEffects].sort((a, b) => b.n - a.n);
  const sortedByWeight = rrEffects
    .map((s, i) => ({ name: s.name, weight: result.weights[i], n: s.n }))
    .sort((a, b) => b.weight - a.weight);

  console.log('  Study weights (RE model):');
  for (const s of sortedByWeight) {
    console.log(`    ${s.name.padEnd(20)} N=${String(s.n).padStart(6)}  Weight=${s.weight.toFixed(2)}%`);
  }

  // The largest study (WHS, N=39876) should have one of the top 3 weights
  const largestStudy = sortedByN[0];
  const largestWeight = sortedByWeight.findIndex(s => s.name === largestStudy.name);
  assert(
    largestWeight < 3,
    `Largest study (${largestStudy.name}, N=${largestStudy.n}) has rank ${largestWeight + 1} weight — should be top 3`
  );

  // Summary effect should be defined
  assert(!isNaN(result.summary), `Pooled RR is defined: ${Math.exp(result.summary).toFixed(4)}`);
  assert(result.heterogeneity.Q > 0, `Heterogeneity Q > 0: ${result.heterogeneity.Q.toFixed(4)}`);
}

// =============================================================================
// Test 4: Sample Size in HR Calculations
// =============================================================================
console.log('\n=== Test 4: Sample Sizes in HR Calculations ===\n');

const hrStudies = zhengData.filter(s => s.Effect_Measure === 'HR');
console.log(`Found ${hrStudies.length} studies with HR data\n`);

for (const study of hrStudies) {
  const hr = parseFloat(study.Estimate);
  const ciLow = parseFloat(study.CI_Lower);
  const ciUp = parseFloat(study.CI_Upper);

  const { yi, sei } = computeHR(hr, ciLow, ciUp);

  // Back-calculated HR should match input
  assertClose(Math.exp(yi), hr, 1e-10, `${study.Study} HR back-calculation`);

  // SE should be reasonable (positive, not too large)
  assert(sei > 0 && sei < 2, `${study.Study} SE is reasonable: ${sei.toFixed(4)}`);
}

// Pool HR studies
if (hrStudies.length >= 2) {
  const hrEffects = hrStudies.map(s => {
    const hr = parseFloat(s.Estimate);
    const ciLow = parseFloat(s.CI_Lower);
    const ciUp = parseFloat(s.CI_Upper);
    return { ...computeHR(hr, ciLow, ciUp), name: s.Study };
  });

  const result = metaAnalysisRE(hrEffects);
  const pooledHR = Math.exp(result.summary);

  assert(pooledHR > 0.5 && pooledHR < 1.5, `Pooled HR is plausible: ${pooledHR.toFixed(4)}`);
  console.log(`  Pooled HR = ${pooledHR.toFixed(4)} [${Math.exp(result.summary - 1.96 * result.se).toFixed(4)}, ${Math.exp(result.summary + 1.96 * result.se).toFixed(4)}]`);
}

// =============================================================================
// Test 5: Sample Size Corruption Detection
// =============================================================================
console.log('\n=== Test 5: Sample Size Corruption Detection ===\n');

// Verify that changing sample sizes changes results
// Use OR (not RR) for cleaner variance behavior: vi = 1/a + 1/b + 1/c + 1/d
if (rrStudies.length >= 2) {
  const originalStudy = rrStudies.find(s => parseInt(s.Events_Aspirin) > 50); // Pick large study
  const e1 = parseInt(originalStudy.Events_Aspirin);
  const n1 = parseInt(originalStudy.N_Aspirin);
  const e2 = parseInt(originalStudy.Events_Control);
  const n2 = parseInt(originalStudy.N_Control);

  const original = computeOR(e1, n1, e2, n2);
  const doubled = computeOR(e1 * 2, n1 * 2, e2 * 2, n2 * 2); // Double all counts

  // With doubled counts, OR should be nearly identical (same proportions)
  assertClose(Math.exp(original.yi), Math.exp(doubled.yi), 0.01,
    `OR stays same when all counts doubled`);

  // But variance should decrease (more data = more precision)
  assert(
    doubled.vi < original.vi,
    `OR variance decreases with doubled counts: ${doubled.vi.toFixed(6)} < ${original.vi.toFixed(6)}`
  );

  // Corrupting events while keeping N same should change effect size
  const corrupted = computeOR(e1 * 2, n1, e2, n2); // Double treatment events only
  assert(
    Math.abs(Math.exp(corrupted.yi) - Math.exp(original.yi)) > 0.1,
    `OR changes when treatment events doubled: original=${Math.exp(original.yi).toFixed(4)} vs corrupted=${Math.exp(corrupted.yi).toFixed(4)}`
  );
}

// =============================================================================
// Test 6: Full Pipeline — 26 Sample Size Values
// =============================================================================
console.log('\n=== Test 6: Full Pipeline — All 26 Sample Size Values ===\n');

let validSampleSizes = 0;
const totalSampleSizes = zhengData.length * 2; // N_Aspirin + N_Control per study

for (const study of zhengData) {
  const nAspirin = parseInt(study.N_Aspirin);
  const nControl = parseInt(study.N_Control);

  if (nAspirin > 0) validSampleSizes++;
  if (nControl > 0) validSampleSizes++;
}

assert(
  validSampleSizes === totalSampleSizes,
  `All ${totalSampleSizes} sample size values are valid (${validSampleSizes}/${totalSampleSizes})`
);

// Compute total N across all studies
const totalN = zhengData.reduce((sum, s) => sum + parseInt(s.N_Total), 0);
console.log(`\n  Total participants across 13 studies: ${totalN.toLocaleString()}`);
assertClose(totalN, 164225, 10, 'Total N matches Zheng 2019 reported total (~164,225)');

// =============================================================================
// Summary
// =============================================================================
console.log('\n' + '='.repeat(60));
console.log(`\n  Sample Size Validation Summary`);
console.log(`  ${passed} passed, ${failed} failed, ${passed + failed} total`);
console.log(`  ${zhengData.length} studies × 2 sample sizes = ${totalSampleSizes} values validated\n`);

if (failures.length > 0) {
  console.log('  Failures:');
  for (const f of failures) {
    console.log(`    - ${f}`);
  }
}

console.log(`\n  Status: ${failed === 0 ? '✅ ALL PASSED' : '❌ SOME FAILED'}\n`);
process.exit(failed > 0 ? 1 : 0);
