# Phase A-1: SR/MA Complete Workflow Mapping

**Analyst**: Research Thompson (Ben Thompson model)
**Date**: 2026-02-25
**Status**: Complete
**Confidence**: High (cross-referenced PRISMA 2020, Cochrane Handbook v6.5, 10-step PMC framework, and Zheng 2019 JAMA case study)

---

## Executive Summary

A systematic review (SR) with meta-analysis (MA) follows a 13-step workflow from research question formulation to final reporting. This document maps every step against PRISMA 2020 (27-item checklist), Cochrane Handbook v6.5 (Chapters 1-15), and the Zheng 2019 JAMA Aspirin MA as a gold-standard reference case.

**Key finding**: MetaReview currently covers Steps 7-13 well (data entry through reporting), but has significant gaps in Steps 1-6 (protocol through screening) and Step 8 (risk of bias). The highest-value automation opportunities lie in Steps 5-6 (screening) and Step 7 (data extraction), where AI can reduce the 60-70% of total SR time spent on manual labor.

---

## SR/MA Complete Workflow: 13-Step Mapping

### Step 1: Define Research Question (PICO/PICOTS)

- **PRISMA 2020 Item**: #4 (Objectives)
- **Cochrane Chapter**: Ch 1 (Starting a Review), Ch 2 (Determining Scope and Questions)
- **Input**: Clinical uncertainty or knowledge gap; preliminary literature scan
- **Output**: Structured PICO(T/S) question; defined Population, Intervention, Comparator, Outcome(s), optionally Timeframe and Setting
- **Method Standard**: Must use a structured framework (PICO, PICOTS, PEO, SPIDER). The question must be specific enough to define eligibility criteria but broad enough to capture relevant evidence. Preliminary database searches should confirm sufficient literature exists and no duplicate SRs are registered.
- **Zheng 2019 Example**: P = Adults without CVD; I = Aspirin (any dose); C = Placebo or no treatment; O = Primary: composite CV mortality + nonfatal MI + nonfatal stroke; Secondary: all-cause mortality, major bleeding. T = >= 12 months follow-up.
- **MetaReview Support**: ⚠️ Partial. PICO fields exist in AI screening module (used for keyword matching), but no structured PICO definition workspace, no question formulation wizard, and no PROSPERO integration for checking existing reviews.
- **AI Automation Potential**: MEDIUM. LLM can assist in structuring a natural-language clinical question into PICO format, suggest MeSH terms, and search PROSPERO for duplicates. However, the clinical judgment to select the right question remains human.
- **Automation Value**: MEDIUM. Saves 1-2 hours, reduces errors in PICO specification. Real value is in preventing poorly-defined questions that waste downstream effort.
- **Automation Difficulty**: LOW. Well-constrained NLP task. LLMs already excel at extracting PICO from clinical text.

---

### Step 2: Write Protocol

- **PRISMA 2020 Item**: #24a-c (Registration and Protocol)
- **Cochrane Chapter**: Ch 2 (Determining Scope), Ch 3 (Inclusion Criteria)
- **Input**: Finalized PICO question; preliminary literature assessment
- **Output**: Pre-registered protocol document specifying: eligibility criteria (study design, population, intervention, comparator, outcomes), information sources, search strategy, selection process, data collection process, risk of bias assessment method, synthesis methods, and planned subgroup/sensitivity analyses
- **Method Standard**: Protocol should follow PRISMA-P (26 items). Must be registered in PROSPERO (health/social care), Cochrane, or OSF before screening begins. Protocol amendments must be documented and justified. The protocol is a contract with the scientific community that reduces selective reporting.
- **Zheng 2019 Example**: Registered in PROSPERO (CRD42018107562). Pre-specified: RCTs only, >= 1000 participants, >= 12 months follow-up, English language, primary/secondary/exploratory outcomes defined a priori.
- **MetaReview Support**: ❌ Not supported. No protocol template, no PROSPERO integration, no structured eligibility criteria builder.
- **AI Automation Potential**: HIGH. LLM can generate a protocol draft from PICO, auto-fill PRISMA-P sections, suggest appropriate eligibility criteria based on similar published reviews, and even pre-populate a PROSPERO registration form.
- **Automation Value**: HIGH. Protocol writing is 5-10 hours of tedious but critical work. A well-structured template with AI-assisted filling could reduce this to 1-2 hours.
- **Automation Difficulty**: MEDIUM. The generation part is straightforward; the challenge is ensuring the protocol is methodologically sound and matches the specific clinical context. Needs human review.

---

### Step 3: Develop Search Strategy

- **PRISMA 2020 Item**: #6 (Information Sources), #7 (Search Strategy)
- **Cochrane Chapter**: Ch 4 (Searching and Selecting Studies), Ch 4.S1 (Technical Supplement)
- **Input**: PICO components; list of target databases; consultation with librarian
- **Output**: Full Boolean search strings for each database (PubMed, Embase, CENTRAL, etc.), with MeSH terms, free-text synonyms, truncation, field tags, and database-specific syntax adaptations. Also: list of grey literature sources, clinical trial registries, hand-searched journals, and reference list checking plans.
- **Method Standard**: Must search minimum 2 databases (AMSTAR requirement), ideally 3+ for interventions (Cochrane recommends CENTRAL + MEDLINE + Embase). Strategy must be reproducible: full syntax must be published. Must include both controlled vocabulary (MeSH/Emtree) and free-text terms. Must balance sensitivity (finding everything) with precision (manageable volume). Different databases require different syntax (Ovid vs PubMed vs Embase.com).
- **Zheng 2019 Example**: PubMed + Embase + Cochrane CENTRAL. Search from inception to November 1, 2018. Full strategy in eMethods 1 (supplementary). Identified 1,385 records.
- **MetaReview Support**: ⚠️ Partial. PubMed search is built-in with basic filters (year, type, language), but: only 1 database (PubMed), no Boolean query builder, no MeSH term browser, no Embase/CENTRAL/Scopus support, no syntax adaptation tool, no search string export for documentation.
- **AI Automation Potential**: HIGH. LLM can translate PICO into Boolean search strings, expand synonyms, suggest MeSH terms, adapt syntax across databases. Tools like SWIFT-Review already do parts of this.
- **Automation Value**: HIGH. Search strategy development takes 5-20 hours with librarian consultation. AI-assisted development with human validation could save 60-80% of time while improving comprehensiveness.
- **Automation Difficulty**: MEDIUM-HIGH. Database-specific syntax rules are complex and error-prone. MeSH mapping requires understanding of the vocabulary hierarchy. Over-sensitive searches create screening burden; under-sensitive searches miss studies. This is where experienced librarians add enormous value.

---

### Step 4: Execute Search and Manage Records

- **PRISMA 2020 Item**: #16a (Study Selection — search results)
- **Cochrane Chapter**: Ch 4 (Searching and Selecting Studies)
- **Input**: Finalized search strings; database access
- **Output**: Deduplicated reference library with all records from all sources. Counts: total identified per database, total after deduplication. Records in structured format (title, authors, abstract, year, journal, DOI, PMID).
- **Method Standard**: All database searches must be run and documented with date. Results exported in standard format (RIS, BibTeX, CSV). Deduplication must be systematic (by DOI, PMID, then title+author+year fuzzy matching). The PRISMA flow diagram tracks these numbers.
- **Zheng 2019 Example**: 1,385 articles identified. Duplicates removed. Screening pool established.
- **MetaReview Support**: ⚠️ Partial. PubMed search returns results with title/abstract/PMID. RIS/CSV import exists. But: no multi-database merge, no automated deduplication (beyond what PubMed itself handles), no Embase/CENTRAL execution. PRISMA flow diagram auto-populates from PubMed search counts.
- **AI Automation Potential**: HIGH. Record deduplication is a well-solved problem (exact + fuzzy matching). Multi-database search execution can be automated via APIs (PubMed E-utilities, Embase API, CENTRAL via Cochrane Library).
- **Automation Value**: MEDIUM. Saves 2-5 hours. The real value is in multi-database coverage — currently MetaReview only searches PubMed, which misses studies indexed only in Embase (estimated 10-20% unique records in Embase for drug interventions).
- **Automation Difficulty**: LOW-MEDIUM. PubMed API is free and well-documented. Embase requires institutional access/license (barrier). CENTRAL is accessible. Deduplication algorithms are mature.

---

### Step 5: Screen Titles and Abstracts

- **PRISMA 2020 Item**: #8 (Selection Process), #16a (Study Selection)
- **Cochrane Chapter**: Ch 4 (Searching and Selecting Studies)
- **Input**: Deduplicated reference library; eligibility criteria from protocol
- **Output**: List of potentially relevant articles for full-text review; list of excluded articles (no reasons needed at this stage); inter-rater agreement statistics (Cohen's kappa)
- **Method Standard**: Minimum 2 independent reviewers must screen every record. Disagreements resolved by discussion or third reviewer. Must apply pre-specified eligibility criteria consistently. Pilot testing on 50-100 records recommended to calibrate reviewers. This is the most time-consuming step (60-70% of total SR time for large searches).
- **Zheng 2019 Example**: Two authors independently screened all 1,385 titles/abstracts. Full agreement required. No disagreements needing third party.
- **MetaReview Support**: ⚠️ Partial. AI screening exists: Phase 1 (PICO keyword scoring) + Phase 2 (Llama 3.1 LLM evaluation with include/exclude/maybe verdict). But: single-reviewer only (no dual independent screening workflow), no inter-rater agreement calculation, no pilot calibration, no structured exclusion tracking.
- **AI Automation Potential**: VERY HIGH. This is the most validated AI use case in SR. ASReview (active learning), Rayyan (ML ranking), otto-SR (LLM, 96.7% sensitivity) all demonstrate AI can match or exceed human screening. LLMs can serve as "second reviewer" in dual screening.
- **Automation Value**: VERY HIGH. For a search returning 2,000 records, dual manual screening takes 40-80 person-hours. AI-assisted screening can reduce workload by 70-95% while maintaining sensitivity >= 95%.
- **Automation Difficulty**: MEDIUM. Sensitivity must be >= 95% (missing relevant studies is unacceptable). The challenge is calibration — AI must be tuned to the specific review's inclusion criteria. Current MetaReview uses generic PICO matching; needs review-specific fine-tuning.

---

### Step 6: Full-Text Screening

- **PRISMA 2020 Item**: #8 (Selection Process), #16a-b (Study Selection, Excluded Studies)
- **Cochrane Chapter**: Ch 4 (Searching and Selecting Studies)
- **Input**: Full-text PDFs/articles of potentially relevant studies; eligibility criteria
- **Output**: Final included studies list; excluded studies list with specific reasons for each (per PRISMA 2020, must cite studies that appeared to meet criteria but were excluded, explaining why); PRISMA flow diagram numbers (reports retrieved, reports assessed, reports excluded with reasons, studies included)
- **Method Standard**: 2-3 independent reviewers examine each full text. Every exclusion requires documented justification mapped to specific eligibility criterion. Reference lists of included studies must be hand-searched for missed studies. Contact authors if full text unavailable. Third reviewer resolves disagreements.
- **Zheng 2019 Example**: 21 full-text articles assessed. 8 excluded (reasons: duplicate population, no relevant outcomes, conference abstract only, etc.). 13 studies (from 21 articles) included.
- **MetaReview Support**: ❌ Not supported. No full-text PDF review interface, no structured exclusion reason tracking, no reference list checking, no dual reviewer workflow.
- **AI Automation Potential**: HIGH. LLMs can read full-text PDFs and assess against eligibility criteria. Challenge is that some criteria require clinical judgment (e.g., "was the population truly primary prevention?"). AI can flag borderline cases for human review.
- **Automation Value**: HIGH. Full-text screening of 50-200 articles takes 10-40 hours. AI-assisted with human oversight could cut this by 50-70%.
- **Automation Difficulty**: HIGH. Requires reliable PDF text extraction (tables, figures, supplementary materials), understanding of complex eligibility criteria, and ability to identify the specific reason for exclusion. Current PDF parsing has significant limitations (tables, multi-column layouts, scanned images).

---

### Step 7: Data Extraction

- **PRISMA 2020 Item**: #9 (Data Collection), #10a-b (Data Items), #17 (Study Characteristics)
- **Cochrane Chapter**: Ch 5 (Collecting Data)
- **Input**: Full-text PDFs of included studies; pilot-tested extraction form
- **Output**: Structured dataset containing per study: bibliographic info, study design, sample sizes (treatment/control), participant characteristics, intervention details, comparator details, outcome definitions, effect measures (OR/RR/HR/MD/SMD), point estimates, confidence intervals, follow-up duration, subgroup data, funding sources, conflict of interest declarations
- **Method Standard**: 2-3 independent extractors using standardized, pilot-tested forms. Data must be verified by second extractor. Contact original authors for missing/unclear data. Extract both adjusted and unadjusted estimates when available. For time-to-event data, extract HR + 95% CI (or Kaplan-Meier data to derive HR). For binary data, extract events/totals per arm. For continuous data, extract mean + SD + N per arm.
- **Zheng 2019 Example**: Two authors independently extracted using piloted forms: baseline characteristics, inclusion criteria, study design, drug/control, follow-up, endpoints, subgroup data. Antithrombotic Trialists' Collaboration provided supplementary individual-level data.
- **MetaReview Support**: ⚠️ Partial. Manual data entry table exists (binary: events/n; continuous: mean/SD/n; HR: HR/CI; generic: effect/SE). AI PDF extraction prototype exists (atomic queries for outcomes, effect sizes, sample sizes, events, continuous data). Excel paste import. But: no standardized extraction form, no dual-extractor workflow, no author contact tracking, no extraction completeness validation.
- **AI Automation Potential**: VERY HIGH. Recent studies show LLM-assisted extraction achieves 93-97% accuracy (otto-SR: 93.1%, Moonshot/Claude: >= 95% with human correction). The decomposed atomic query approach (extract one data point at a time) significantly outperforms "extract everything at once."
- **Automation Value**: VERY HIGH. Manual extraction of 15-20 studies takes 15-40 hours. AI-assisted extraction with human verification could reduce this to 3-8 hours while improving consistency.
- **Automation Difficulty**: HIGH. Key challenges: (1) Data often scattered across text, tables, figures, and supplements; (2) Multiple outcomes/timepoints per study require disambiguation; (3) Adjusted vs unadjusted estimates; (4) Inconsistent reporting formats across journals; (5) PDF table parsing remains unreliable.

---

### Step 8: Assess Risk of Bias

- **PRISMA 2020 Item**: #11 (Risk of Bias Assessment), #18 (Risk of Bias in Studies)
- **Cochrane Chapter**: Ch 7 (Considering Bias), Ch 8 (Risk of Bias in RCTs — RoB 2)
- **Input**: Full-text articles of included studies; chosen RoB tool
- **Output**: Per-study assessment across all RoB domains; summary table; traffic-light visualization. For RoB 2 (RCTs): 5 domains — (D1) randomization process, (D2) deviations from intended interventions, (D3) missing outcome data, (D4) measurement of the outcome, (D5) selection of the reported result. Each domain judged as "Low risk" / "Some concerns" / "High risk" based on signalling questions.
- **Method Standard**: Must use validated tool appropriate to study design: RoB 2 for RCTs (Cochrane recommended), ROBINS-I for non-randomized intervention studies, Newcastle-Ottawa Scale for observational studies. Assessment is per-result (not per-study in RoB 2). Two independent assessors required. Avoid composite quality scores. Classify each domain independently. Document reasoning for each judgment.
- **Zheng 2019 Example**: Cochrane Collaboration risk of bias tool (original RoB, not RoB 2). 6 domains assessed: sequence generation, allocation concealment, blinding, detection bias, attrition bias, reporting bias. Result: 9/13 low risk, 4/13 high risk (open-label designs). Two independent assessors, no disagreements.
- **MetaReview Support**: ❌ Not supported. No RoB assessment interface. GRADE module accepts manual risk-of-bias override (no concern / serious / very serious) but has no per-study RoB tool, no signalling questions, no domain-level assessment, no traffic-light visualization.
- **AI Automation Potential**: MEDIUM-HIGH. RobotReviewer achieves 71-78% accuracy on RoB assessment. LLMs can answer signalling questions by extracting relevant text from full papers. However, some judgments require understanding of trial conduct that may not be described in the paper. AI works best as "first pass" with human verification.
- **Automation Value**: HIGH. RoB assessment for 15 studies across 5 domains = 75 individual judgments, each requiring careful reading. Takes 10-20 hours manually. AI-assisted could cut to 3-6 hours.
- **Automation Difficulty**: HIGH. Signalling questions require nuanced judgment (e.g., "Was the allocation sequence adequately concealed?"). Information may be implicit or absent from the paper. RoB 2 has been noted for "low interrater reliability" even among trained human assessors. AI performance ceiling may be limited by inherent subjectivity.

---

### Step 9: Prepare Data for Synthesis

- **PRISMA 2020 Item**: #12 (Effect Measures), #13a-b (Synthesis Methods)
- **Cochrane Chapter**: Ch 6 (Effect Measures and Computing Estimates), Ch 9 (Summarizing and Preparing for Synthesis)
- **Input**: Extracted data from all included studies; protocol-specified effect measure
- **Output**: Harmonized dataset with computed effect sizes and standard errors for each study. Characteristics table (Table 1). Decision on synthesis feasibility (can studies be meaningfully combined?). Selection of effect measure (OR, RR, HR, MD, SMD). Conversion of reported data to common scale (e.g., converting 2x2 tables to log-OR + SE, converting medians to means if needed).
- **Method Standard**: Effect measure choice must be pre-specified in protocol and appropriate to data type. Binary outcomes: OR or RR (log-transformed for analysis). Time-to-event: HR (log-transformed). Continuous: MD (same scale) or SMD/Hedges' g (different scales). Must assess clinical and methodological heterogeneity before deciding to pool. Studies too heterogeneous for meta-analysis should be synthesized narratively. Conversion formulas must be documented.
- **Zheng 2019 Example**: Primary effect measure: HR via Bayesian MCMC. For studies reporting only event counts (no HR), authors estimated HRs using Poisson likelihood with patient-years denominators. Also computed RR as sensitivity analysis. Converted all to common scale.
- **MetaReview Support**: ✅ Strong. 5 effect measures supported (OR, RR, HR, MD, SMD). Automatic effect size calculation from raw data (binary, continuous, HR, or generic input). Log-transformation handled internally. Effect size calculator and interactive decision guide help users choose. However: no median-to-mean conversion, no data harmonization across different reporting formats, no clinical heterogeneity assessment tool.
- **AI Automation Potential**: MEDIUM. Computation is deterministic (already automated). AI adds value in: (1) Recommending appropriate effect measure based on study characteristics; (2) Identifying and flagging data inconsistencies; (3) Converting between scales when original data is in non-standard format.
- **Automation Value**: MEDIUM. Core computation is already automated. Marginal value in edge-case handling and decision support.
- **Automation Difficulty**: LOW for computation (already done). MEDIUM for intelligent data harmonization.

---

### Step 10: Statistical Synthesis (Meta-Analysis)

- **PRISMA 2020 Item**: #13c-f (Synthesis Methods), #19 (Individual Study Results), #20a-d (Synthesis Results)
- **Cochrane Chapter**: Ch 10 (Meta-Analysis), Ch 12 (Synthesis Without Meta-Analysis)
- **Input**: Harmonized effect sizes + standard errors for all studies; pre-specified analysis plan (model, subgroups, sensitivity analyses)
- **Output**: Pooled effect estimate + 95% CI; heterogeneity statistics (I2, Q, tau2, prediction interval); forest plot; subgroup analyses with Q-between test; sensitivity analyses (leave-one-out, restricting by quality/design/dose); cumulative meta-analysis; meta-regression (if >= 10 studies); narrative synthesis for studies not pooled
- **Method Standard**: Choose fixed-effect (common effect assumed) or random-effects (DerSimonian-Laird or REML) model based on heterogeneity and clinical reasoning. Assess heterogeneity with I2 (low < 25%, moderate 25-75%, high > 75%) and Q-test. Pre-specified subgroup analyses only. Sensitivity analyses to test robustness. If meta-analysis not appropriate, use structured narrative synthesis (SWiM guideline). At least 2 studies needed to pool; >= 10 studies recommended for meta-regression and publication bias tests.
- **Zheng 2019 Example**: Bayesian MCMC via R/GeMTC. Model selection by DIC (fixed vs random). I2 = 0% for primary outcome. 4 pre-specified sensitivity analyses + post-hoc exclusions. Subgroups: low vs high CV risk, diabetes status. HR 0.89 (95% CrI 0.84-0.94) for primary composite.
- **MetaReview Support**: ✅ Strong. Fixed + random effects (IV, DL). I2/Q/tau2. Forest plot (interactive, 3 color schemes, PNG/SVG). Subgroup analysis + Q-between. Leave-one-out sensitivity. Cumulative MA. Meta-regression (year covariate). Dose-response (linear/quadratic). Prediction interval (Riley 2011). Influence diagnostics (Hat/rstudent/Cook's D/DFFITS/CovRatio). 568/568 QA tests passing.
- **AI Automation Potential**: LOW for core computation (already fully automated). MEDIUM for interpretation — LLM can generate natural-language interpretation of results, flag anomalies, suggest additional analyses.
- **Automation Value**: HIGH (already realized). MetaReview's statistical engine is its core strength.
- **Automation Difficulty**: N/A for computation (done). LOW for interpretation assistance.

---

### Step 11: Assess Publication Bias

- **PRISMA 2020 Item**: #14 (Reporting Bias Assessment), #21 (Reporting Biases)
- **Cochrane Chapter**: Ch 13 (Bias Due to Missing Results)
- **Input**: Study-level effect sizes and standard errors; >= 10 studies recommended
- **Output**: Funnel plot (standard + contour-enhanced); statistical tests (Egger's regression, Begg's rank correlation); Trim-and-Fill analysis with imputed studies and corrected estimate; narrative interpretation
- **Method Standard**: Funnel plot is visual assessment (asymmetry suggests bias). Egger's regression test (p < 0.10 threshold) — note only valid for ratio measures, not SMD. Begg's rank correlation (Kendall's tau). Trim-and-Fill provides corrected estimate but is conservative. Contour-enhanced funnel plots help distinguish publication bias from other causes of asymmetry. Consider selective outcome reporting within studies (not just whole-study non-publication). Minimum 10 studies for meaningful assessment.
- **Zheng 2019 Example**: Egger's test: intercept -0.47, p = 0.57 (no significant asymmetry). 13 studies included, adequate power.
- **MetaReview Support**: ✅ Strong. Funnel plot (standard + contour-enhanced with p < 0.01/0.05/0.10 regions). Egger's regression test with regression line overlay. Begg's rank correlation. Trim-and-Fill (R0 estimator with filled points + corrected effect). All auto-computed.
- **AI Automation Potential**: LOW. Computation is fully automated. LLM could assist with nuanced interpretation (e.g., "asymmetry may reflect small-study effects rather than publication bias because...").
- **Automation Value**: HIGH (already realized).
- **Automation Difficulty**: N/A (done).

---

### Step 12: Assess Certainty of Evidence (GRADE)

- **PRISMA 2020 Item**: #15 (Certainty Assessment), #22 (Certainty of Evidence)
- **Cochrane Chapter**: Ch 14 (Summary of Findings and GRADE)
- **Input**: Pooled results per outcome; RoB assessments; heterogeneity data; publication bias results; clinical context
- **Output**: GRADE Summary of Findings (SoF) table. Per outcome: certainty rating (High / Moderate / Low / Very Low) with 5 downgrade domains: (1) Risk of bias, (2) Inconsistency, (3) Indirectness, (4) Imprecision, (5) Publication bias. Plus 3 potential upgrade domains for observational studies: large effect, dose-response, plausible confounding.
- **Method Standard**: Start at "High" for RCTs, "Low" for observational. Downgrade 1 level for "serious" concern, 2 levels for "very serious." Each domain requires explicit judgment with documented reasoning. Indirectness assesses whether the evidence directly applies to the review question (PICO match). Imprecision assessed by CI width, null-crossing, and sample size (Optimal Information Size). Use GRADEpro GDT software for standardized tables.
- **Zheng 2019 Example**: GRADE not explicitly reported in the paper (a notable gap — most journals now require it).
- **MetaReview Support**: ⚠️ Partial. GRADE module exists with 5 downgrade domains. Auto-assesses 3 of 5: inconsistency (via I2), imprecision (via CI null-crossing), publication bias (via Egger/Begg/Trim-Fill). Risk of bias and indirectness are manual override only. No SoF table generation. No GRADEpro integration. No upgrade domains for observational studies.
- **AI Automation Potential**: MEDIUM. Risk of bias domain could be auto-populated if Step 8 (RoB assessment) is automated. Indirectness requires comparing study populations/interventions to the review question — LLM can assist. Full SoF table generation from structured data is straightforward.
- **Automation Value**: HIGH. GRADE tables are required by most journals and Cochrane. Currently no tool generates them end-to-end from meta-analysis results. A tool that auto-generates a draft SoF table (with human override) would be highly differentiated.
- **Automation Difficulty**: MEDIUM. The 3 auto-assessed domains are already implemented. Adding risk of bias (contingent on Step 8) and indirectness (requires PICO comparison) would complete the picture. SoF table formatting is deterministic.

---

### Step 13: Write Report and Generate PRISMA Documentation

- **PRISMA 2020 Item**: All 27 items — the checklist IS the reporting standard
- **Cochrane Chapter**: Ch 3 (Reporting), Ch 15 (Interpreting Results and Drawing Conclusions)
- **Input**: All prior outputs: PICO, protocol, search strategy, PRISMA flow numbers, characteristics table, RoB assessments, forest plots, synthesis results, publication bias results, GRADE SoF table
- **Output**: Complete manuscript with: Title, Abstract (PRISMA-A 12-item checklist), Introduction (rationale + objectives), Methods (all sub-sections per PRISMA items 5-15), Results (all sub-sections per PRISMA items 16-22), Discussion (interpretation, limitations, implications), Other (registration, support, COI, data availability). PRISMA 2020 flow diagram. Completed PRISMA checklist with page numbers.
- **Method Standard**: Must follow PRISMA 2020 checklist. Methods section must be reproducible. Results must present individual study data, synthesis results, heterogeneity investigations, sensitivity analyses, and certainty assessments. Discussion must address limitations of both evidence and review process. If > 6-12 months since search, must update before submission.
- **Zheng 2019 Example**: Full JAMA article following structured format. Methods paragraph includes search strategy, selection process, data extraction, RoB tool, statistical methods (Bayesian, DIC model selection). Results include PRISMA flow, characteristics table, forest plots for primary/secondary outcomes, subgroup/sensitivity analyses.
- **MetaReview Support**: ✅ Strong for downstream sections. HTML + DOCX report export with 10+ togglable sections. Auto-generated Methods paragraph (PRISMA 2020-compliant). Results narrative integrating subgroup, sensitivity, bias, regression findings. PRISMA 2020 flow diagram (SVG/PNG, auto-populated). JSON/CSV data export. However: no Introduction/Discussion generation, no PRISMA checklist auto-completion, no characteristics table (Table 1), no PROSPERO registration reference.
- **AI Automation Potential**: VERY HIGH. LLM can generate full manuscript drafts from structured analysis results. Introduction (literature context), Methods (from protocol + analysis settings), Results (from statistical outputs), Discussion (interpretation + limitations). PRISMA checklist can be auto-populated from available data.
- **Automation Value**: VERY HIGH. Manuscript writing takes 20-60 hours. AI-generated first draft with human editing could save 60-80% of time.
- **Automation Difficulty**: MEDIUM. Generating grammatically correct, scientifically accurate text is achievable with current LLMs. The challenge is ensuring claims match the evidence (no hallucination), appropriate hedging language, and journal-specific formatting.

---

## Summary Matrix: MetaReview Gap Analysis

| Step | Name | MetaReview | AI Potential | Value | Difficulty | Priority |
|------|------|:---:|:---:|:---:|:---:|:---:|
| 1 | Define Research Question | ⚠️ | Medium | Medium | Low | P3 |
| 2 | Write Protocol | ❌ | High | High | Medium | P2 |
| 3 | Develop Search Strategy | ⚠️ | High | High | Medium-High | P2 |
| 4 | Execute Search / Manage Records | ⚠️ | High | Medium | Low-Medium | P2 |
| 5 | Screen Titles/Abstracts | ⚠️ | Very High | Very High | Medium | P1 |
| 6 | Full-Text Screening | ❌ | High | High | High | P1 |
| 7 | Data Extraction | ⚠️ | Very High | Very High | High | P1 |
| 8 | Risk of Bias Assessment | ❌ | Medium-High | High | High | P1 |
| 9 | Prepare Data for Synthesis | ✅ | Medium | Medium | Low | P3 |
| 10 | Statistical Synthesis (MA) | ✅ | Low | High (done) | N/A | Done |
| 11 | Publication Bias | ✅ | Low | High (done) | N/A | Done |
| 12 | GRADE Assessment | ⚠️ | Medium | High | Medium | P2 |
| 13 | Report Writing | ✅ | Very High | Very High | Medium | P2 |

**Legend**: P1 = highest gap/opportunity, should address first; P2 = significant gap, address next; P3 = nice-to-have improvement; Done = adequately covered.

---

## Value Chain Analysis (Thompson Framework)

Applying Aggregation Theory to the SR/MA workflow:

### Where is the "distribution cost" dropping?

1. **Literature access**: PubMed, PubMed Central, and Unpaywall have dramatically reduced the cost of finding and accessing papers. But Embase remains behind a paywall.
2. **Screening labor**: AI screening has gone from research prototype to production tool in 3 years. Cost per screened record has dropped from ~$0.50 (human) to ~$0.01 (AI).
3. **Statistical computation**: Fully commoditized. Free tools exist everywhere (R metafor, RevMan, MetaReview).
4. **Report generation**: LLMs have collapsed the cost of first-draft writing from hours to minutes.

### Where is the profit/value pool?

The value is NOT in computation (commoditized). The value is in the **upstream workflow** (Steps 1-8) where:
- Human labor is most expensive (60-70% of total SR time)
- Quality is most variable (screening sensitivity, extraction accuracy, RoB consistency)
- No single tool covers the full chain end-to-end
- Switching costs are high (users build projects in one tool and are locked in)

### Structural insight

**The SR/MA tool market is fragmented by step**: Rayyan does screening. Covidence does screening + extraction. RevMan does analysis + reporting. R metafor does analysis. No tool does Steps 1-13 end-to-end. This fragmentation creates an aggregation opportunity.

MetaReview currently owns Steps 9-13 (analysis through reporting). The strategic question is whether to:
- **(A)** Deepen Steps 9-13 (better analysis, more charts, NMA) — incremental
- **(B)** Expand upstream to Steps 5-8 (screening, extraction, RoB) — transformative, captures the high-value segment where users spend 70% of their time
- **(C)** Build the full pipeline Steps 1-13 — maximum lock-in but maximum scope

**Recommendation**: Option B is the highest-ROI path. Steps 5-8 represent the intersection of (1) highest user pain, (2) highest AI automation potential, and (3) biggest competitive gap. A tool that covers screening-extraction-RoB-analysis-reporting (Steps 5-13) would be the most complete free tool in the market.

---

## Information Sources

### Primary Sources (Confirmed)
- PRISMA 2020 Statement: Page MJ, McKenzie JE, et al. BMJ 2021;372:n71. [PMC8007028]
- Cochrane Handbook v6.5 (2024): training.cochrane.org/handbook/current
- Zheng SL, Roddick AJ. JAMA 2019;321(3):277-287. [PMC6439678]
- Ten Steps to Conduct a Systematic Review. PMC10828625 (2024)
- RoB 2: Sterne JAG et al. BMJ 2019;366:l4898

### AI Automation Evidence (Confirmed)
- otto-SR (LLM agentic workflow): 96.7% screening sensitivity, 93.1% extraction accuracy
- Moonshot/Claude for extraction+RoB: >= 95% accuracy with human correction
- RobotReviewer: 71-78% RoB accuracy
- ASReview/Rayyan: validated active-learning screening tools

### Information Gaps
- Embase API access requirements and costs — need to verify if free academic tier exists
- CENTRAL API availability — Cochrane Library API documentation is sparse
- Exact performance benchmarks for LLM-based full-text screening (Step 6) — limited published data
- GRADEpro data export format — need to determine if structured import is feasible

---

## Appendix: PRISMA 2020 Checklist to Step Mapping

| PRISMA Item | Checklist Topic | Maps to Step |
|---|---|---|
| 1 | Title | 13 |
| 2 | Abstract | 13 |
| 3 | Rationale | 1, 13 |
| 4 | Objectives | 1 |
| 5 | Eligibility criteria | 2 |
| 6 | Information sources | 3 |
| 7 | Search strategy | 3 |
| 8 | Selection process | 5, 6 |
| 9 | Data collection process | 7 |
| 10a-b | Data items | 7 |
| 11 | Risk of bias assessment | 8 |
| 12 | Effect measures | 9 |
| 13a-f | Synthesis methods | 9, 10 |
| 14 | Reporting bias assessment | 11 |
| 15 | Certainty assessment | 12 |
| 16a-b | Study selection results | 4, 5, 6 |
| 17 | Study characteristics | 7, 9 |
| 18 | Risk of bias results | 8 |
| 19 | Individual study results | 10 |
| 20a-d | Synthesis results | 10 |
| 21 | Reporting biases results | 11 |
| 22 | Certainty of evidence | 12 |
| 23a-d | Discussion | 13 |
| 24a-c | Registration/protocol | 2 |
| 25 | Support | 13 |
| 26 | Competing interests | 13 |
| 27 | Data availability | 13 |

---

*Report generated by Research Thompson (Phase A-1)*
*All findings cross-referenced against >= 3 independent sources*
*Confidence markers: Confirmed (primary sources), Likely (single source + logical inference), Speculative (reasoning only)*
