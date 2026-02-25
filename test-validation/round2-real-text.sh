#!/bin/bash
# Round 2: Testing with REAL XML-extracted text (simulating pdfjs-dist output)
# Ground truth verified against actual Europe PMC full-text XML

API_URL="https://metareview.cc/api/extract/data"

call_api() {
  local label="$1"
  local query_type="$2"
  local outcome="$3"
  local text="$4"
  local expected="$5"

  local payload
  if [ -n "$outcome" ]; then
    payload=$(jq -n --arg text "$text" --arg qt "$query_type" --arg oc "$outcome" \
      '{text: $text, queryType: $qt, outcome: $oc}')
  else
    payload=$(jq -n --arg text "$text" --arg qt "$query_type" \
      '{text: $text, queryType: $qt}')
  fi

  echo "--- $label ---"
  echo "  Query: $query_type ${outcome:+(outcome: $outcome)}"
  echo "  Expected: $expected"

  local response
  response=$(curl -s -X POST "$API_URL" \
    -H "Content-Type: application/json" \
    -d "$payload" \
    --max-time 30)

  echo "  Got: $response"
  echo ""
}

echo "================================================================"
echo "ROUND 2: Real XML-extracted text (simulating pdfjs-dist output)"
echo "================================================================"
echo ""

# ====================================================================
# Paper 1: Aspirin Primary Prevention (PMC6827248)
# Real Results section from Europe PMC XML
# ====================================================================
echo "=== PAPER 1: Aspirin (PMC6827248) ==="
echo ""

PAPER1_REAL="Thirteen randomized controlled trials comprising 164,225 patients were included. The risk of all-cause and cardiovascular mortality was similar for aspirin and control groups (RR 0.98; 95% CI, 0.93–1.02; RR 0.99; 95% CI, 0.90–1.08; respectively). Aspirin reduced the relative risk (RRR) of major adverse cardiovascular events (MACE) by 9% (RR 0.91; 95% CI, 0.86–0.95), myocardial infarction by 14% (RR 0.86; 95% CI, 0.77–0.95), and ischemic stroke by 10% (RR 0.90; 95% CI, 0.82–0.99), but was associated with a 46% relative risk increase of major bleeding events (RR 1.46; 95% CI, 1.30–1.64) compared with controls. Aspirin use did not translate into a net clinical benefit adjusted for event-associated mortality risk (mean 0.034%; 95% CI, − 0.18 to 0.25%). There was an interaction for aspirin effect in three patient subgroups: (i) in patients under statin treatment, aspirin was associated with a 12% RRR of MACE (RR 0.88; 95% CI, 0.80–0.96), and this effect was lacking in the no-statin group; (ii) in non-smokers, aspirin was associated with a 10% RRR of MACE (RR 0.90; 95% CI, 0.82–0.99), and this effect was not present in smokers; and (iii) in males, aspirin use resulted in a 11% RRR of MACE (RR 0.89; 95% CI, 0.83–0.95), with a non-significant effect in females."

call_api "P1-Q1" "outcomes" "" "$PAPER1_REAL" \
  "MACE, MI, ischemic stroke, major bleeding, all-cause mortality, CV mortality"
sleep 2

call_api "P1-Q2" "sample_sizes" "" "$PAPER1_REAL" \
  "treatment_n=~82000, control_n=~82000 (164,225 total, split roughly even)"
sleep 2

call_api "P1-Q3" "effect_size" "MACE" "$PAPER1_REAL" \
  "type=RR, value=0.91, ci_lower=0.86, ci_upper=0.95"
sleep 2

call_api "P1-Q4" "effect_size" "myocardial infarction" "$PAPER1_REAL" \
  "type=RR, value=0.86, ci_lower=0.77, ci_upper=0.95"
sleep 2

call_api "P1-Q5" "effect_size" "major bleeding events" "$PAPER1_REAL" \
  "type=RR, value=1.46, ci_lower=1.30, ci_upper=1.64"
sleep 2

# ====================================================================
# Paper 2: COVID Comorbidities (PMC9281964)
# Real text including messy table data from XML
# ====================================================================
echo "=== PAPER 2: COVID Comorbidities (PMC9281964) ==="
echo ""

PAPER2_REAL="3.3 Association between hypertension and severe cases between non-severe cases A total of 3286 patients from 22 studies were included to detect the relationship between hypertension and adverse outcome. The random-effects model was used due to significant heterogeneity among the preceding studies (I2 = 83.5%, P = .000). The results showed that patients with hypertension were more likely to have poor outcomes than patients without hypertension (pooled OR = 2.79; 95% CI: 1.66-4.69) (Fig. 2 A). 3.4 Association between diabetes and severe cases A total of 3286 patients from 22 studies were analyzed to analyze the association between diabetes and adverse outcomes. The fixed-effects model was applied to the meta-analysis because no significant heterogeneity was found among the included studies (I2 = 0.0%, P = .475). The results showed that patients with diabetes mellitus were more likely to have poor outcomes than patients without diabetes mellitus (pooled OR = 1.64; 95% CI: 1.30-2.08) (Fig. 2 B). 3.5 Association between cardiovascular diseases and severe/non-severe cases A total of 3286 patients from 22 studies were analyzed. The random-effects model was used due to significant heterogeneity among the preceding studies (I2 = 73.9%, P = .000). The results showed that patients with CVD were more likely to have poor outcomes than those without cardiovascular disease (pooled OR = 1.79; 95% CI: 1.08-2.96) (Fig. 2 C). 3.6 Association between cerebrovascular disease and severe/non-severe cases (I2 = 0.0%, P = .528). The results showed that patients with cerebrovascular disease were more likely to have poor outcomes than those without the cerebrovascular disease (pooled OR = 3.92; 95% CI: 2.45-6.28) (Fig. 2 D). 3.7 Association between respiratory disease and severe/non-severe cases (I2 = 0.0%, P = .488). Results showed that patients with respiratory disease were more likely to have poor outcomes than those without the respiratory disease (pooled OR = 1.98; 95% CI: 1.26-3.12) (Fig. 2 E)."

call_api "P2-Q1" "outcomes" "" "$PAPER2_REAL" \
  "hypertension, diabetes, CVD, cerebrovascular disease, respiratory disease"
sleep 2

call_api "P2-Q2" "sample_sizes" "" "$PAPER2_REAL" \
  "3286 total patients (no treatment/control split given directly)"
sleep 2

call_api "P2-Q3" "effect_size" "hypertension" "$PAPER2_REAL" \
  "type=OR, value=2.79, ci_lower=1.66, ci_upper=4.69"
sleep 2

call_api "P2-Q4" "effect_size" "diabetes" "$PAPER2_REAL" \
  "type=OR, value=1.64, ci_lower=1.30, ci_upper=2.08"
sleep 2

call_api "P2-Q5" "effect_size" "cardiovascular disease" "$PAPER2_REAL" \
  "type=OR, value=1.79, ci_lower=1.08, ci_upper=2.96"
sleep 2

# ====================================================================
# Paper 3: CVD & COVID Severity (PMC7187816)
# Real text with table data - hardest test
# ====================================================================
echo "=== PAPER 3: CVD & COVID Severity (PMC7187816) ==="
echo ""

PAPER3_REAL="Meta-Analysis of the Association Between CVD and COVID-19 Severity A total of 13 studies (n = 3812) were included. Pre-existing CVD was significantly associated with an increased risk of a severe form of COVID-19 in both case-control (OR = 3.33; 95% CI 2.11-5.27; I2 = 0%; Q = 3.43; P = 0.75) and cohort studies (OR = 3.02; 95% CI 2.00-4.57; I2 = 2%; Q = 5.12; P = 0.40), with the overall analysis revealing very low evidence of inter-study heterogeneity (Cochran's Q = 8.68, P = 0.73, I2 = 0%). No significant change in the OR was seen in the leave-one-out sensitivity analysis (Fig 2; supplementary material). Meta-Analysis of the Association Between CVD and Mortality in Severe COVID-19 Disease A total of three (n = 480) studies reported data on mortality in patients with severe COVID-19 disease and pre-existing history of CVD. Pooled analysis of these studies did not find a significant association between previous history of CVD and mortality in severe COVID-19 disease (OR = 1.72; 95% CI: 0.97-3.06, I2 = 0%, Cochran's Q = 1.56, P = 0.46). Meta-Analysis of the Association Between CVD and Overall COVID-19 Mortality A total of 3 (n = 566) studies reported data on mortality in all hospitalized patients COVID-19 disease and pre-existing history of CVD. In the pooled analysis, previous history of CVD was associated with an approximately 11-fold increase in mortality (OR = 11.08; 95% CI: 2.59-47.32), with moderate level of inter-study heterogeneity (I2 = 55%, Cochran's Q = 4.43, P = 0.11)."

call_api "P3-Q1" "outcomes" "" "$PAPER3_REAL" \
  "CVD & COVID severity, CVD & mortality in severe COVID, CVD & overall COVID mortality"
sleep 2

call_api "P3-Q2" "sample_sizes" "" "$PAPER3_REAL" \
  "severity: n=3812 (13 studies), mortality-severe: n=480 (3 studies), mortality-overall: n=566 (3 studies)"
sleep 2

call_api "P3-Q3" "effect_size" "severe COVID-19" "$PAPER3_REAL" \
  "type=OR, value=3.33 (case-control) or 3.02 (cohort), ci varies"
sleep 2

call_api "P3-Q4" "effect_size" "overall COVID-19 mortality" "$PAPER3_REAL" \
  "type=OR, value=11.08, ci_lower=2.59, ci_upper=47.32"
sleep 2

call_api "P3-Q5" "effect_size" "mortality in severe COVID-19" "$PAPER3_REAL" \
  "type=OR, value=1.72, ci_lower=0.97, ci_upper=3.06"

echo ""
echo "================================================================"
echo "ROUND 2 COMPLETE"
echo "================================================================"
