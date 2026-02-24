// PICO-based relevance scorer for literature screening
// Phase 1: Client-side keyword matching with MeSH synonym expansion

import type { PICO } from '../types';

export interface ScreeningScore {
  score: number; // 0-100
  bucket: 'likely' | 'maybe' | 'unlikely';
  matchedTerms: string[];
}

// MeSH synonym dictionary — common medical terms and their variations
// Covers cardiology, endocrinology, oncology, neurology, infectious disease, etc.
const MESH_SYNONYMS: Record<string, string[]> = {
  // Cardiovascular
  hypertension: ['high blood pressure', 'htn', 'elevated blood pressure', 'arterial hypertension'],
  hypotension: ['low blood pressure', 'arterial hypotension'],
  'myocardial infarction': ['heart attack', 'mi', 'ami', 'acute myocardial infarction', 'stemi', 'nstemi'],
  stroke: ['cerebrovascular accident', 'cva', 'cerebral infarction', 'ischemic stroke', 'hemorrhagic stroke', 'brain attack'],
  'heart failure': ['cardiac failure', 'hf', 'chf', 'congestive heart failure', 'ventricular dysfunction'],
  'atrial fibrillation': ['af', 'afib', 'a-fib', 'auricular fibrillation'],
  'coronary artery disease': ['cad', 'coronary heart disease', 'chd', 'ischemic heart disease', 'ihd'],
  atherosclerosis: ['arteriosclerosis', 'arterial plaque', 'hardening of the arteries'],
  thrombosis: ['blood clot', 'thrombus', 'venous thrombosis', 'dvt', 'deep vein thrombosis'],
  'pulmonary embolism': ['pe', 'lung embolism', 'pulmonary thromboembolism'],
  arrhythmia: ['cardiac arrhythmia', 'dysrhythmia', 'irregular heartbeat'],
  angina: ['angina pectoris', 'chest pain', 'cardiac chest pain'],

  // Endocrinology & Metabolism
  diabetes: ['diabetes mellitus', 'dm', 'diabetic', 'hyperglycemia', 'hyperglycaemia'],
  't2dm': ['type 2 diabetes', 'type ii diabetes', 'niddm', 'non-insulin dependent diabetes'],
  't1dm': ['type 1 diabetes', 'type i diabetes', 'iddm', 'insulin dependent diabetes', 'juvenile diabetes'],
  obesity: ['obese', 'overweight', 'adiposity', 'excess weight', 'high bmi'],
  hyperlipidemia: ['dyslipidemia', 'high cholesterol', 'hypercholesterolemia', 'elevated lipids'],
  hypothyroidism: ['underactive thyroid', 'low thyroid', 'myxedema'],
  hyperthyroidism: ['overactive thyroid', 'thyrotoxicosis', 'graves disease'],
  'metabolic syndrome': ['syndrome x', 'insulin resistance syndrome'],

  // Oncology
  cancer: ['carcinoma', 'malignancy', 'neoplasm', 'tumor', 'tumour', 'malignant'],
  'breast cancer': ['breast carcinoma', 'breast neoplasm', 'mammary cancer'],
  'lung cancer': ['lung carcinoma', 'pulmonary neoplasm', 'nsclc', 'sclc', 'bronchogenic carcinoma'],
  'colorectal cancer': ['colon cancer', 'rectal cancer', 'bowel cancer', 'crc'],
  'prostate cancer': ['prostatic carcinoma', 'prostate neoplasm', 'prostate adenocarcinoma'],
  'gastric cancer': ['stomach cancer', 'gastric carcinoma', 'gastric neoplasm'],
  'hepatocellular carcinoma': ['liver cancer', 'hcc', 'hepatoma'],
  lymphoma: ['hodgkin lymphoma', 'non-hodgkin lymphoma', 'nhl'],
  leukemia: ['leukaemia', 'blood cancer'],
  chemotherapy: ['chemo', 'cytotoxic therapy', 'antineoplastic therapy'],
  radiotherapy: ['radiation therapy', 'radiation treatment', 'irradiation'],
  immunotherapy: ['immune checkpoint inhibitor', 'ici', 'checkpoint blockade'],

  // Neurology
  'alzheimer': ['alzheimer disease', 'alzheimers', 'ad', 'senile dementia'],
  dementia: ['cognitive decline', 'cognitive impairment', 'neurocognitive disorder'],
  'parkinson': ['parkinson disease', 'parkinsons', 'pd', 'parkinsonism'],
  epilepsy: ['seizure disorder', 'convulsive disorder', 'seizures'],
  migraine: ['migrainous headache', 'migraine headache'],
  depression: ['major depressive disorder', 'mdd', 'depressive disorder', 'clinical depression'],
  anxiety: ['anxiety disorder', 'gad', 'generalized anxiety', 'generalised anxiety'],
  schizophrenia: ['schizoaffective', 'psychosis', 'psychotic disorder'],
  'multiple sclerosis': ['ms', 'demyelinating disease'],

  // Respiratory
  asthma: ['bronchial asthma', 'reactive airway disease'],
  copd: ['chronic obstructive pulmonary disease', 'emphysema', 'chronic bronchitis'],
  pneumonia: ['lung infection', 'pulmonary infection', 'community acquired pneumonia', 'cap'],
  'pulmonary fibrosis': ['lung fibrosis', 'ipf', 'interstitial lung disease', 'ild'],

  // Infectious Disease
  'covid-19': ['sars-cov-2', 'coronavirus', 'covid', 'novel coronavirus', '2019-ncov'],
  hiv: ['human immunodeficiency virus', 'aids', 'hiv/aids', 'hiv infection'],
  tuberculosis: ['tb', 'mycobacterium tuberculosis', 'pulmonary tuberculosis'],
  hepatitis: ['hbv', 'hcv', 'hepatitis b', 'hepatitis c', 'viral hepatitis'],
  malaria: ['plasmodium', 'plasmodium falciparum', 'antimalarial'],
  sepsis: ['septicemia', 'bacteremia', 'systemic infection', 'septic shock'],

  // Renal
  'chronic kidney disease': ['ckd', 'chronic renal failure', 'renal insufficiency', 'kidney failure'],
  'acute kidney injury': ['aki', 'acute renal failure', 'arf'],
  dialysis: ['hemodialysis', 'haemodialysis', 'peritoneal dialysis', 'renal replacement therapy'],

  // Gastroenterology
  'inflammatory bowel disease': ['ibd', 'crohn disease', 'crohns', 'ulcerative colitis'],
  cirrhosis: ['liver cirrhosis', 'hepatic cirrhosis', 'liver fibrosis'],
  'gastroesophageal reflux': ['gerd', 'gord', 'acid reflux', 'reflux disease'],
  'peptic ulcer': ['gastric ulcer', 'duodenal ulcer', 'stomach ulcer'],

  // Musculoskeletal
  'rheumatoid arthritis': ['ra', 'rheumatoid', 'inflammatory arthritis'],
  osteoarthritis: ['oa', 'degenerative joint disease', 'wear and tear arthritis'],
  osteoporosis: ['bone loss', 'low bone density', 'bone mineral density loss'],
  'low back pain': ['lbp', 'lumbar pain', 'back pain', 'backache'],

  // Interventions / Drugs
  aspirin: ['acetylsalicylic acid', 'asa'],
  metformin: ['glucophage', 'metformin hydrochloride'],
  insulin: ['insulin therapy', 'insulin treatment', 'exogenous insulin'],
  statin: ['hmg-coa reductase inhibitor', 'atorvastatin', 'rosuvastatin', 'simvastatin', 'pravastatin'],
  'ace inhibitor': ['acei', 'angiotensin converting enzyme inhibitor', 'ramipril', 'enalapril', 'lisinopril'],
  'beta blocker': ['beta-blocker', 'beta adrenergic blocker', 'metoprolol', 'atenolol', 'propranolol', 'bisoprolol'],
  anticoagulant: ['blood thinner', 'warfarin', 'heparin', 'enoxaparin', 'rivaroxaban', 'apixaban', 'dabigatran', 'doac', 'noac'],
  antiplatelet: ['clopidogrel', 'ticagrelor', 'prasugrel', 'platelet inhibitor'],
  nsaid: ['non-steroidal anti-inflammatory', 'ibuprofen', 'naproxen', 'diclofenac', 'celecoxib'],
  corticosteroid: ['steroid', 'glucocorticoid', 'prednisone', 'prednisolone', 'dexamethasone', 'methylprednisolone'],
  antibiotic: ['antimicrobial', 'antibacterial', 'amoxicillin', 'azithromycin', 'ciprofloxacin'],
  antidepressant: ['ssri', 'snri', 'tricyclic', 'fluoxetine', 'sertraline', 'escitalopram', 'venlafaxine'],
  antihypertensive: ['blood pressure lowering', 'blood pressure medication', 'amlodipine', 'losartan', 'valsartan'],
  diuretic: ['water pill', 'furosemide', 'hydrochlorothiazide', 'spironolactone'],
  placebo: ['sham', 'dummy', 'inactive control', 'sugar pill'],
  surgery: ['surgical', 'operation', 'operative', 'surgical intervention', 'surgical treatment'],
  'physical therapy': ['physiotherapy', 'rehabilitation', 'rehab', 'physical rehabilitation'],
  exercise: ['physical activity', 'aerobic exercise', 'resistance training', 'physical exercise'],
  acupuncture: ['electroacupuncture', 'needle therapy'],

  // Outcomes
  mortality: ['death', 'fatality', 'survival', 'all-cause mortality', 'all cause death'],
  morbidity: ['disease burden', 'illness', 'complications'],
  'quality of life': ['qol', 'hrqol', 'health related quality of life', 'sf-36', 'eq-5d'],
  'blood pressure': ['bp', 'systolic', 'diastolic', 'sbp', 'dbp'],
  hba1c: ['glycated hemoglobin', 'glycosylated hemoglobin', 'hemoglobin a1c', 'a1c', 'glycaemic control', 'glycemic control'],
  bmi: ['body mass index', 'body weight', 'weight change'],
  'adverse events': ['side effects', 'adverse effects', 'adverse reactions', 'complications', 'safety'],
  hospitalization: ['hospitalisation', 'hospital admission', 'inpatient', 'readmission'],
  'length of stay': ['los', 'hospital stay', 'duration of hospitalization'],
  pain: ['pain score', 'vas', 'visual analog scale', 'pain intensity', 'analgesic', 'analgesia'],
  inflammation: ['inflammatory', 'crp', 'c-reactive protein', 'il-6', 'interleukin', 'tnf'],

  // Study Design
  rct: ['randomized controlled trial', 'randomised controlled trial', 'randomized clinical trial', 'randomised clinical trial'],
  'systematic review': ['systematic literature review', 'systematic overview'],
  'meta-analysis': ['meta analysis', 'metaanalysis', 'pooled analysis'],
  'cohort study': ['cohort', 'prospective study', 'longitudinal study', 'follow-up study'],
  'case-control': ['case control study', 'retrospective study'],
  'cross-sectional': ['cross sectional study', 'prevalence study', 'survey'],

  // Populations
  adult: ['adults', 'grown-up', 'adult population'],
  elderly: ['older adults', 'aged', 'geriatric', 'seniors', 'older people', 'older patients'],
  pediatric: ['paediatric', 'children', 'child', 'adolescent', 'infant', 'neonatal', 'neonate'],
  pregnant: ['pregnancy', 'prenatal', 'antenatal', 'gestational', 'maternal'],
  male: ['men', 'man'],
  female: ['women', 'woman'],
};

// Common English stopwords to skip
const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
  'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
  'could', 'should', 'may', 'might', 'shall', 'can', 'it', 'its', 'this',
  'that', 'these', 'those', 'not', 'no', 'nor', 'as', 'if', 'than',
  'so', 'such', 'very', 'too', 'also', 'just', 'about', 'up', 'out',
  'all', 'any', 'each', 'every', 'both', 'few', 'more', 'most', 'other',
  'some', 'into', 'over', 'after', 'before', 'between', 'under', 'during',
  'through', 'above', 'below', 'using', 'who', 'which', 'what', 'where',
  'when', 'how', 'vs', 'versus', 'among', 'per',
]);

// Build reverse lookup: synonym -> canonical term
let reverseLookup: Map<string, string> | null = null;

function getReverseLookup(): Map<string, string> {
  if (reverseLookup) return reverseLookup;
  reverseLookup = new Map();
  for (const [canonical, synonyms] of Object.entries(MESH_SYNONYMS)) {
    reverseLookup.set(canonical, canonical);
    for (const syn of synonyms) {
      reverseLookup.set(syn, canonical);
    }
  }
  return reverseLookup;
}

/** Tokenize text into lowercase terms, keeping multi-word medical terms intact */
function tokenize(text: string): string[] {
  if (!text) return [];
  const lower = text.toLowerCase().replace(/[^\w\s-]/g, ' ');
  const words = lower.split(/\s+/).filter(w => w.length > 1 && !STOPWORDS.has(w));
  return words;
}

/** Extract meaningful keyword phrases from a PICO field */
function extractKeywords(text: string): string[] {
  if (!text.trim()) return [];
  const lower = text.toLowerCase().trim();
  const keywords: string[] = [];
  const lookup = getReverseLookup();

  // First, try to match multi-word MeSH terms in the input
  for (const [term] of lookup) {
    if (term.length > 2 && lower.includes(term)) {
      keywords.push(term);
    }
  }

  // Then add individual tokens that aren't already covered
  const tokens = tokenize(text);
  for (const token of tokens) {
    if (!keywords.some(k => k.includes(token)) && token.length > 2) {
      keywords.push(token);
    }
  }

  return [...new Set(keywords)];
}

/** Expand a keyword with its MeSH synonyms */
function expandWithSynonyms(keyword: string): string[] {
  const lower = keyword.toLowerCase();
  const expanded = [lower];

  // Direct match in dictionary
  if (MESH_SYNONYMS[lower]) {
    expanded.push(...MESH_SYNONYMS[lower]);
  }

  // Reverse lookup: keyword might be a synonym itself
  const lookup = getReverseLookup();
  const canonical = lookup.get(lower);
  if (canonical && canonical !== lower) {
    expanded.push(canonical);
    if (MESH_SYNONYMS[canonical]) {
      expanded.push(...MESH_SYNONYMS[canonical]);
    }
  }

  return [...new Set(expanded)];
}

/** Check if text contains a term (supports multi-word matching) */
function textContainsTerm(textLower: string, term: string): boolean {
  return textLower.includes(term);
}

/** Score a single article against PICO criteria */
export function scorePICORelevance(
  title: string,
  abstract: string,
  pico: PICO
): ScreeningScore {
  // If PICO is empty, everything is "maybe"
  const picoFields = [pico.population, pico.intervention, pico.comparison, pico.outcome]
    .filter(f => f.trim());
  if (picoFields.length === 0) {
    return { score: 50, bucket: 'maybe', matchedTerms: [] };
  }

  const titleLower = (title || '').toLowerCase();
  const abstractLower = (abstract || '').toLowerCase();

  const matchedTerms: string[] = [];
  let totalWeight = 0;
  let matchedWeight = 0;

  // PICO field weights: P=1, I=1.5, C=1, O=1.5 (intervention and outcome are more discriminative)
  const fieldWeights: [string, number][] = [
    [pico.population, 1.0],
    [pico.intervention, 1.5],
    [pico.comparison, 1.0],
    [pico.outcome, 1.5],
  ];

  for (const [field, fieldWeight] of fieldWeights) {
    if (!field.trim()) continue;

    const keywords = extractKeywords(field);
    if (keywords.length === 0) continue;

    const keywordWeight = fieldWeight / keywords.length;

    for (const keyword of keywords) {
      const expanded = expandWithSynonyms(keyword);
      totalWeight += keywordWeight;

      let matched = false;
      for (const term of expanded) {
        // Title match = 2x weight
        if (textContainsTerm(titleLower, term)) {
          matchedWeight += keywordWeight * 2;
          matched = true;
          if (!matchedTerms.includes(keyword)) matchedTerms.push(keyword);
          break;
        }
        // Abstract match = 1x weight
        if (abstract && textContainsTerm(abstractLower, term)) {
          matchedWeight += keywordWeight;
          matched = true;
          if (!matchedTerms.includes(keyword)) matchedTerms.push(keyword);
          break;
        }
      }

      // If no synonym matched, try fuzzy title-only match (no abstract loaded)
      if (!matched && !abstract) {
        // When abstract isn't loaded, be more generous with title-only scoring
        for (const term of expanded) {
          const termWords = term.split(/\s+/);
          if (termWords.length === 1 && termWords[0].length > 3) {
            // Check if any word in title starts with this term (partial match)
            const titleWords = titleLower.split(/\s+/);
            if (titleWords.some(tw => tw.startsWith(termWords[0]) || termWords[0].startsWith(tw))) {
              matchedWeight += keywordWeight * 0.5;
              if (!matchedTerms.includes(keyword)) matchedTerms.push(keyword);
              break;
            }
          }
        }
      }
    }
  }

  // Normalize: max possible is totalWeight * 2 (all title matches)
  const maxPossible = totalWeight * 2;
  const rawScore = maxPossible > 0 ? (matchedWeight / maxPossible) * 100 : 50;
  const score = Math.min(100, Math.round(rawScore));

  // Determine bucket
  let bucket: ScreeningScore['bucket'];
  if (score >= 40) {
    bucket = 'likely';
  } else if (score >= 15) {
    bucket = 'maybe';
  } else {
    bucket = 'unlikely';
  }

  return { score, bucket, matchedTerms };
}

/** Batch score multiple articles */
export function batchScore(
  articles: { title: string; abstract?: string }[],
  pico: PICO
): ScreeningScore[] {
  return articles.map(a => scorePICORelevance(a.title, a.abstract || '', pico));
}
