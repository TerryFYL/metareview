/**
 * PICO Scorer Validation — Zheng 2019 Ground Truth Dataset
 *
 * Validates the PICO keyword scoring system against a known dataset:
 * - 13 included RCTs from Zheng SL et al. JAMA 2019;321(3):277–287
 * - 20 irrelevant papers (secondary prevention, unrelated topics, etc.)
 *
 * Measures: Recall, Precision, F1 at different bucket thresholds
 */

import { scorePICORelevance, type ScreeningScore } from '../src/lib/screening/pico-scorer';

// PICO criteria for Zheng 2019 (Aspirin Primary Prevention)
const PICO = {
  population: 'adults without established cardiovascular disease primary prevention',
  intervention: 'aspirin',
  comparison: 'placebo',
  outcome: 'cardiovascular events myocardial infarction stroke bleeding mortality',
};

// ---- GROUND TRUTH: 13 Included RCTs from Zheng 2019 ----
interface TestArticle {
  id: string;
  title: string;
  abstract: string;
  relevant: boolean; // ground truth
}

const RELEVANT_PAPERS: TestArticle[] = [
  {
    id: 'BDT-1988',
    title: 'Randomised trial of prophylactic daily aspirin in British male doctors',
    abstract: 'A randomised controlled trial in 5139 apparently healthy male doctors compared aspirin 500 mg daily with no aspirin for primary prevention of cardiovascular disease. The aspirin group showed no significant reduction in myocardial infarction or stroke but had reduced transient ischaemic attacks.',
    relevant: true,
  },
  {
    id: 'PHS-1989',
    title: 'Final report on the aspirin component of the ongoing Physicians Health Study',
    abstract: 'A randomized double-blind placebo-controlled trial of aspirin 325 mg every other day among 22071 male physicians aged 40-84 years for primary prevention. Aspirin reduced the risk of first myocardial infarction by 44% (RR 0.56, p<0.00001). No significant effect on stroke or cardiovascular death.',
    relevant: true,
  },
  {
    id: 'TPT-1998',
    title: 'Thrombosis prevention trial: randomised trial of low-intensity oral anticoagulation with warfarin and low-dose aspirin in the primary prevention of ischaemic heart disease in men at increased risk',
    abstract: 'A randomised trial of aspirin 75 mg daily and low-intensity warfarin in 5499 men at high risk of ischaemic heart disease. Aspirin reduced total ischaemic heart disease events by 20% (p=0.04). Combined aspirin and warfarin reduced events by 34%.',
    relevant: true,
  },
  {
    id: 'HOT-1998',
    title: 'Effects of intensive blood-pressure lowering and low-dose aspirin in patients with hypertension: principal results of the Hypertension Optimal Treatment randomised trial',
    abstract: 'A prospective randomized trial in 18790 patients with hypertension, comparing aspirin 75 mg daily with placebo. Aspirin reduced major cardiovascular events by 15% (p=0.03) and myocardial infarction by 36% (p=0.002). No effect on stroke. Fatal and non-fatal major bleeding more common with aspirin.',
    relevant: true,
  },
  {
    id: 'PPP-2001',
    title: 'Low-dose aspirin and vitamin E in people at cardiovascular risk: a randomised trial in general practice',
    abstract: 'An open-label randomized trial in 4495 subjects with one or more cardiovascular risk factors. Low-dose aspirin 100 mg daily reduced cardiovascular death and total cardiovascular events. No significant effect on myocardial infarction or stroke individually.',
    relevant: true,
  },
  {
    id: 'WHS-2005',
    title: 'A randomized trial of low-dose aspirin in the primary prevention of cardiovascular disease in women',
    abstract: 'A randomized double-blind placebo-controlled trial among 39876 healthy women aged 45 or older. Aspirin 100 mg every other day showed a nonsignificant reduction in major cardiovascular events but significantly reduced ischemic stroke by 24% (p=0.009). No effect on myocardial infarction.',
    relevant: true,
  },
  {
    id: 'POPADAD-2008',
    title: 'Prevention of progression of arterial disease and diabetes trial: aspirin and antioxidants in patients with diabetes and asymptomatic peripheral arterial disease',
    abstract: 'A randomized double-blind 2x2 factorial trial of aspirin 100 mg daily and antioxidants in 1276 adults with type 1 or 2 diabetes and ankle brachial pressure index of 0.99 or less. No significant reduction in cardiovascular events or death with aspirin or antioxidants.',
    relevant: true,
  },
  {
    id: 'JPAD-2008',
    title: 'Low-dose aspirin for primary prevention of atherosclerotic events in patients with type 2 diabetes',
    abstract: 'An open-label randomised controlled trial in 2539 patients with type 2 diabetes without known atherosclerotic disease. Low-dose aspirin 81-100 mg daily did not significantly reduce composite cardiovascular events (HR 0.80, p=0.16) but reduced fatal coronary and cerebrovascular events in post-hoc analysis.',
    relevant: true,
  },
  {
    id: 'AAA-2010',
    title: 'Aspirin for Asymptomatic Atherosclerosis trial: aspirin for prevention of cardiovascular events in a general population screened for a low ankle brachial index',
    abstract: 'A randomized double-blind trial of aspirin 100 mg daily in 3350 men and women with low ankle brachial index but no clinical cardiovascular disease. Aspirin did not significantly reduce vascular events (HR 1.03, 95% CI 0.84-1.27) but did not increase bleeding risk.',
    relevant: true,
  },
  {
    id: 'JPPP-2014',
    title: 'Low-dose aspirin for primary prevention of cardiovascular events in Japanese patients 60 years or older with atherosclerotic risk factors',
    abstract: 'An open-label randomised controlled trial of aspirin 100 mg daily in 14464 Japanese patients aged 60-85 with hypertension, dyslipidemia, or diabetes. Aspirin did not reduce composite of cardiovascular death, nonfatal stroke, and nonfatal myocardial infarction (HR 0.94, 95% CI 0.77-1.15).',
    relevant: true,
  },
  {
    id: 'ASPREE-2018',
    title: 'Effect of aspirin on disability-free survival in the healthy elderly',
    abstract: 'A randomized double-blind placebo-controlled trial of 100 mg aspirin daily in 19114 community-dwelling older adults (mean age 74 years) without cardiovascular disease, dementia, or disability. Aspirin did not prolong disability-free survival and was associated with higher rate of major hemorrhage.',
    relevant: true,
  },
  {
    id: 'ASCEND-2018',
    title: 'Effects of aspirin for primary prevention in persons with diabetes mellitus',
    abstract: 'A randomized double-blind trial of aspirin 100 mg daily versus placebo in 15480 adults with diabetes but no evident cardiovascular disease. Aspirin reduced serious vascular events by 12% (RR 0.88, 95% CI 0.79-0.97) but increased major bleeding by 29% (RR 1.29, 95% CI 1.09-1.52). Absolute benefit largely offset by bleeding risk.',
    relevant: true,
  },
  {
    id: 'ARRIVE-2018',
    title: 'Use of aspirin to reduce risk of initial vascular events in patients at moderate risk of cardiovascular disease',
    abstract: 'A randomized double-blind placebo-controlled trial of aspirin 100 mg daily in 12546 patients at moderate cardiovascular risk. Aspirin did not significantly reduce the primary endpoint of cardiovascular events (HR 0.96, 95% CI 0.81-1.13). Gastrointestinal bleeding was more common with aspirin.',
    relevant: true,
  },
];

// ---- IRRELEVANT PAPERS (should be excluded) ----
const IRRELEVANT_PAPERS: TestArticle[] = [
  {
    id: 'IRR-1',
    title: 'Dual antiplatelet therapy with aspirin and clopidogrel after acute coronary syndrome',
    abstract: 'A meta-analysis of dual antiplatelet therapy in patients with established coronary artery disease after acute coronary syndrome. Aspirin plus clopidogrel reduced recurrent cardiovascular events compared to aspirin alone in secondary prevention.',
    relevant: false,
  },
  {
    id: 'IRR-2',
    title: 'Statin therapy for primary prevention of cardiovascular disease: a systematic review',
    abstract: 'A systematic review and meta-analysis of statin therapy for primary prevention of cardiovascular events in adults without established cardiovascular disease. Statins reduced major vascular events and all-cause mortality.',
    relevant: false,
  },
  {
    id: 'IRR-3',
    title: 'Effects of clopidogrel in addition to aspirin in patients with acute coronary syndromes without ST-segment elevation',
    abstract: 'The CURE trial evaluated clopidogrel plus aspirin versus aspirin alone in 12562 patients with acute coronary syndromes. Secondary prevention trial in patients with established cardiovascular disease.',
    relevant: false,
  },
  {
    id: 'IRR-4',
    title: 'Aspirin for secondary prevention after acute myocardial infarction: systematic review and meta-analysis',
    abstract: 'A systematic review of aspirin use after myocardial infarction for secondary prevention. Aspirin 75-325 mg daily reduced recurrent cardiovascular events by 25% in patients with prior MI or stroke.',
    relevant: false,
  },
  {
    id: 'IRR-5',
    title: 'Mediterranean diet and risk of cardiovascular disease: a systematic review',
    abstract: 'A systematic review of observational studies and randomized trials examining the association between Mediterranean diet and cardiovascular risk. The diet was associated with lower incidence of myocardial infarction and stroke.',
    relevant: false,
  },
  {
    id: 'IRR-6',
    title: 'Exercise training and cardiovascular risk reduction: a meta-analysis of randomized controlled trials',
    abstract: 'A meta-analysis evaluating the effects of exercise training on cardiovascular risk factors including blood pressure, cholesterol, and glucose. Regular exercise reduced cardiovascular mortality by 27%.',
    relevant: false,
  },
  {
    id: 'IRR-7',
    title: 'Omega-3 fatty acids for the primary prevention of cardiovascular disease',
    abstract: 'A Cochrane systematic review of omega-3 supplementation for primary prevention of heart disease. Moderate-certainty evidence suggests omega-3 has little effect on cardiovascular events or mortality.',
    relevant: false,
  },
  {
    id: 'IRR-8',
    title: 'Aspirin use and risk of colorectal cancer: a systematic review and dose-response meta-analysis',
    abstract: 'A meta-analysis examining aspirin use and colorectal cancer risk. Regular aspirin use was associated with 27% reduced risk of colorectal cancer. Dose-response analysis showed optimal benefit at 75-325 mg daily.',
    relevant: false,
  },
  {
    id: 'IRR-9',
    title: 'Blood pressure lowering for prevention of cardiovascular disease and death: a systematic review',
    abstract: 'A systematic review of blood pressure lowering strategies for primary and secondary prevention of cardiovascular disease. Antihypertensive treatment reduced stroke by 35-40% and myocardial infarction by 20-25%.',
    relevant: false,
  },
  {
    id: 'IRR-10',
    title: 'Rivaroxaban for prevention of venous thromboembolism after total hip or knee arthroplasty',
    abstract: 'A randomized trial comparing rivaroxaban with enoxaparin for thromboprophylaxis after hip and knee replacement surgery. Rivaroxaban reduced symptomatic venous thromboembolism without increased bleeding.',
    relevant: false,
  },
  {
    id: 'IRR-11',
    title: 'Metformin versus insulin for gestational diabetes: a systematic review',
    abstract: 'A systematic review comparing metformin with insulin for treatment of gestational diabetes mellitus. Both treatments had similar glycemic control outcomes. Metformin was associated with less weight gain.',
    relevant: false,
  },
  {
    id: 'IRR-12',
    title: 'Cognitive behavioral therapy for chronic pain: a meta-analysis',
    abstract: 'A meta-analysis of randomized controlled trials examining cognitive behavioral therapy for chronic pain conditions. CBT showed moderate effects on pain intensity and disability compared to control.',
    relevant: false,
  },
  {
    id: 'IRR-13',
    title: 'SGLT2 inhibitors and cardiovascular outcomes in type 2 diabetes: a meta-analysis',
    abstract: 'A meta-analysis of sodium-glucose cotransporter 2 inhibitors in patients with type 2 diabetes. SGLT2 inhibitors reduced major adverse cardiovascular events, heart failure hospitalization, and renal outcomes.',
    relevant: false,
  },
  {
    id: 'IRR-14',
    title: 'Aspirin resistance in clinical practice: a systematic review and meta-analysis of diagnostic tests',
    abstract: 'A systematic review of laboratory tests for aspirin resistance. Various platelet function tests show different prevalence of aspirin resistance. Clinical significance remains uncertain.',
    relevant: false,
  },
  {
    id: 'IRR-15',
    title: 'Immunotherapy for advanced non-small cell lung cancer: a network meta-analysis',
    abstract: 'A network meta-analysis comparing immune checkpoint inhibitors for advanced non-small cell lung cancer. Pembrolizumab and atezolizumab showed improved overall survival versus chemotherapy.',
    relevant: false,
  },
  {
    id: 'IRR-16',
    title: 'Proton pump inhibitor use and risk of chronic kidney disease: a systematic review',
    abstract: 'A systematic review of observational studies examining the association between proton pump inhibitor use and chronic kidney disease risk. PPI use was associated with 20-50% increased CKD risk.',
    relevant: false,
  },
  {
    id: 'IRR-17',
    title: 'Aspirin in pregnancy: systematic review of effects on preeclampsia, preterm birth, and birthweight',
    abstract: 'A systematic review of low-dose aspirin in pregnancy for prevention of preeclampsia. Aspirin 75-150 mg daily reduced preeclampsia risk by 10-20% when started before 16 weeks gestation.',
    relevant: false,
  },
  {
    id: 'IRR-18',
    title: 'Anticoagulation therapy after ischemic stroke: a meta-analysis',
    abstract: 'A meta-analysis of anticoagulation versus antiplatelet therapy for secondary stroke prevention. In patients with atrial fibrillation, warfarin was superior to aspirin for stroke prevention.',
    relevant: false,
  },
  {
    id: 'IRR-19',
    title: 'Vitamin D supplementation and cardiovascular events: a systematic review and meta-analysis',
    abstract: 'A meta-analysis of vitamin D supplementation for prevention of cardiovascular events. No significant reduction in myocardial infarction, stroke, or cardiovascular mortality with vitamin D.',
    relevant: false,
  },
  {
    id: 'IRR-20',
    title: 'Deep brain stimulation for treatment-resistant depression: a systematic review',
    abstract: 'A systematic review of deep brain stimulation for major depressive disorder resistant to conventional treatments. Heterogeneous results with some patients showing marked improvement.',
    relevant: false,
  },
];

// ---- RUN VALIDATION ----
const allPapers = [...RELEVANT_PAPERS, ...IRRELEVANT_PAPERS];

console.log('='.repeat(70));
console.log('PICO Scorer Validation — Zheng 2019 Ground Truth');
console.log('='.repeat(70));
console.log(`PICO Criteria:`);
console.log(`  P: ${PICO.population}`);
console.log(`  I: ${PICO.intervention}`);
console.log(`  C: ${PICO.comparison}`);
console.log(`  O: ${PICO.outcome}`);
console.log(`Dataset: ${RELEVANT_PAPERS.length} relevant + ${IRRELEVANT_PAPERS.length} irrelevant = ${allPapers.length} total`);
console.log('');

// Score all papers
const results: { article: TestArticle; score: ScreeningScore }[] = [];
for (const article of allPapers) {
  const score = scorePICORelevance(article.title, article.abstract, PICO);
  results.push({ article, score });
}

// Print detailed results
console.log('-'.repeat(70));
console.log('DETAILED RESULTS');
console.log('-'.repeat(70));
console.log('');

console.log('--- RELEVANT PAPERS (should be likely/maybe) ---');
for (const r of results.filter(r => r.article.relevant)) {
  const icon = r.score.bucket === 'likely' ? '✅' : r.score.bucket === 'maybe' ? '⚠️' : '❌';
  console.log(`${icon} [${r.score.bucket.padEnd(8)}] Score=${String(r.score.score).padStart(3)} | ${r.article.id}: ${r.article.title.slice(0, 70)}`);
  console.log(`   Matched: ${r.score.matchedTerms.join(', ')}`);
}

console.log('');
console.log('--- IRRELEVANT PAPERS (should be unlikely) ---');
for (const r of results.filter(r => !r.article.relevant)) {
  const icon = r.score.bucket === 'unlikely' ? '✅' : r.score.bucket === 'maybe' ? '⚠️' : '❌';
  console.log(`${icon} [${r.score.bucket.padEnd(8)}] Score=${String(r.score.score).padStart(3)} | ${r.article.id}: ${r.article.title.slice(0, 70)}`);
  console.log(`   Matched: ${r.score.matchedTerms.join(', ')}`);
}

// ---- CALCULATE METRICS ----
console.log('');
console.log('='.repeat(70));
console.log('METRICS');
console.log('='.repeat(70));

// At "likely" threshold
const likelyRelevant = results.filter(r => r.article.relevant && r.score.bucket === 'likely').length;
const likelyIrrelevant = results.filter(r => !r.article.relevant && r.score.bucket === 'likely').length;
const likelyTotal = results.filter(r => r.score.bucket === 'likely').length;
const totalRelevant = RELEVANT_PAPERS.length;
const totalIrrelevant = IRRELEVANT_PAPERS.length;

// At "likely+maybe" threshold (screening should use this — conservative)
const passRelevant = results.filter(r => r.article.relevant && r.score.bucket !== 'unlikely').length;
const passIrrelevant = results.filter(r => !r.article.relevant && r.score.bucket !== 'unlikely').length;
const passTotal = results.filter(r => r.score.bucket !== 'unlikely').length;

// Missed relevant papers
const missedRelevant = results.filter(r => r.article.relevant && r.score.bucket === 'unlikely');

console.log('');
console.log('Threshold: "likely" only');
console.log(`  Recall:    ${likelyRelevant}/${totalRelevant} = ${(likelyRelevant / totalRelevant * 100).toFixed(1)}%`);
console.log(`  Precision: ${likelyRelevant}/${likelyTotal} = ${likelyTotal > 0 ? (likelyRelevant / likelyTotal * 100).toFixed(1) : 'N/A'}%`);
const f1Likely = likelyTotal > 0 && totalRelevant > 0
  ? 2 * (likelyRelevant / likelyTotal) * (likelyRelevant / totalRelevant) / ((likelyRelevant / likelyTotal) + (likelyRelevant / totalRelevant))
  : 0;
console.log(`  F1:        ${(f1Likely * 100).toFixed(1)}%`);
console.log(`  False positives: ${likelyIrrelevant}`);

console.log('');
console.log('Threshold: "likely" + "maybe" (recommended for screening)');
console.log(`  Recall:    ${passRelevant}/${totalRelevant} = ${(passRelevant / totalRelevant * 100).toFixed(1)}%`);
console.log(`  Precision: ${passRelevant}/${passTotal} = ${passTotal > 0 ? (passRelevant / passTotal * 100).toFixed(1) : 'N/A'}%`);
const f1Pass = passTotal > 0 && totalRelevant > 0
  ? 2 * (passRelevant / passTotal) * (passRelevant / totalRelevant) / ((passRelevant / passTotal) + (passRelevant / totalRelevant))
  : 0;
console.log(`  F1:        ${(f1Pass * 100).toFixed(1)}%`);
console.log(`  False positives: ${passIrrelevant}`);

if (missedRelevant.length > 0) {
  console.log('');
  console.log('⚠️  MISSED RELEVANT PAPERS (classified as unlikely):');
  for (const r of missedRelevant) {
    console.log(`  - ${r.article.id}: ${r.article.title.slice(0, 70)}`);
    console.log(`    Score: ${r.score.score}, Matched: ${r.score.matchedTerms.join(', ') || 'none'}`);
  }
}

// Score distribution
console.log('');
console.log('Score Distribution:');
const bucketCounts = { likely: { relevant: 0, irrelevant: 0 }, maybe: { relevant: 0, irrelevant: 0 }, unlikely: { relevant: 0, irrelevant: 0 } };
for (const r of results) {
  const label = r.article.relevant ? 'relevant' : 'irrelevant';
  bucketCounts[r.score.bucket][label]++;
}
console.log(`  Likely:   ${bucketCounts.likely.relevant} relevant, ${bucketCounts.likely.irrelevant} irrelevant`);
console.log(`  Maybe:    ${bucketCounts.maybe.relevant} relevant, ${bucketCounts.maybe.irrelevant} irrelevant`);
console.log(`  Unlikely: ${bucketCounts.unlikely.relevant} relevant, ${bucketCounts.unlikely.irrelevant} irrelevant`);

// Overall assessment
console.log('');
console.log('='.repeat(70));
console.log('ASSESSMENT');
console.log('='.repeat(70));
const recallPass = passRelevant / totalRelevant;
if (recallPass >= 0.95) {
  console.log('✅ PASS — Recall ≥ 95% at likely+maybe threshold. Acceptable for screening.');
} else if (recallPass >= 0.85) {
  console.log('⚠️  MARGINAL — Recall 85-95%. Some relevant papers may be missed.');
} else {
  console.log('❌ FAIL — Recall < 85%. PICO scorer may miss too many relevant papers.');
}
console.log(`   Target: ≥ 95% recall (Cochrane standard for sensitive searches)`);
console.log(`   Actual: ${(recallPass * 100).toFixed(1)}% recall at likely+maybe threshold`);
