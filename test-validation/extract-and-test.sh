#!/bin/bash
# PDF Extraction Prototype Validation - Cycle 71
# Tests the production API at https://metareview.cc/api/extract/data
# Uses text extracted from 3 real meta-analysis papers via Europe PMC XML

API_URL="https://metareview.cc/api/extract/data"
RESULTS_FILE="validation-results.json"

echo "[]" > "$RESULTS_FILE"

# Helper function to call the extraction API
call_api() {
  local paper_id="$1"
  local query_type="$2"
  local outcome="$3"
  local text="$4"

  local payload
  if [ -n "$outcome" ]; then
    payload=$(jq -n --arg text "$text" --arg qt "$query_type" --arg oc "$outcome" \
      '{text: $text, queryType: $qt, outcome: $oc}')
  else
    payload=$(jq -n --arg text "$text" --arg qt "$query_type" \
      '{text: $text, queryType: $qt}')
  fi

  echo "  Testing: paper=$paper_id, queryType=$query_type, outcome=${outcome:-N/A}"

  local response
  response=$(curl -s -w "\n%{http_code}" -X POST "$API_URL" \
    -H "Content-Type: application/json" \
    -d "$payload" \
    --max-time 30)

  local http_code=$(echo "$response" | tail -1)
  local body=$(echo "$response" | sed '$d')

  echo "    HTTP: $http_code"
  echo "    Response: $(echo "$body" | head -c 300)"
  echo ""

  # Append to results
  jq --arg pid "$paper_id" --arg qt "$query_type" --arg oc "$outcome" \
     --arg code "$http_code" --argjson resp "$body" \
     '. += [{"paper": $pid, "queryType": $qt, "outcome": $oc, "http_code": $code, "response": $resp}]' \
     "$RESULTS_FILE" > tmp.json && mv tmp.json "$RESULTS_FILE"
}

echo "============================================"
echo "Paper 1: Aspirin Primary Prevention (PMC6827248)"
echo "============================================"
echo ""

# Paper 1 text - extracted from Results section of Gelbenegger et al. 2019
PAPER1_TEXT="Results: Thirteen RCTs with a total of 164,225 patients and 1,050,511 patient-years of follow-up were included. Aspirin reduced the risk of the composite outcome of MI, stroke and cardiovascular death (MACE) compared to placebo: risk ratio (RR) 0.89, 95% confidence interval (CI) 0.83-0.95, p=0.001, I2=0%, number needed to treat (NNT)=265. Aspirin significantly reduced the risk of myocardial infarction (RR 0.82, 95% CI 0.71-0.94, p=0.006, I2=27%) and ischemic stroke (RR 0.81, 95% CI 0.68-0.97, I2=0%). However, aspirin significantly increased the risk of major bleeding events (RR 1.47, 95% CI 1.31-1.65, I2=0%, number needed to harm NNH=210) and intracranial bleeding (RR 1.33, 95% CI 1.13-1.58, I2=0%). Aspirin had no significant effect on all-cause mortality (RR 0.98, 95% CI 0.93-1.02, I2=0%) or cardiovascular mortality (RR 0.99, 95% CI 0.90-1.08, I2=0%). In the subgroup analysis, aspirin reduced the risk of MI in men (RR 0.72, 95% CI 0.53-0.97) but not in women. In patients with diabetes, aspirin reduced MACE (RR 0.87, 95% CI 0.79-0.96) with increased bleeding risk. The ASCEND trial enrolled 15,480 patients with diabetes: aspirin group 7,740 and placebo group 7,740. The ARRIVE trial had 12,546 patients: aspirin 6,270, placebo 6,276. The ASPREE trial included 19,114 participants: aspirin 9,525, placebo 9,589."

call_api "paper1" "outcomes" "" "$PAPER1_TEXT"
sleep 2
call_api "paper1" "sample_sizes" "" "$PAPER1_TEXT"
sleep 2
call_api "paper1" "effect_size" "MACE" "$PAPER1_TEXT"
sleep 2
call_api "paper1" "effect_size" "myocardial infarction" "$PAPER1_TEXT"
sleep 2
call_api "paper1" "events" "major bleeding" "$PAPER1_TEXT"
sleep 2

echo "============================================"
echo "Paper 2: COVID-19 Comorbidities (PMC9281964)"
echo "============================================"
echo ""

# Paper 2 text - Cheng et al. 2021
PAPER2_TEXT="Results: Twenty-two retrospective studies involving 3,286 COVID-19 patients were included. The pooled prevalence of hypertension, diabetes, and cardiovascular disease (CVD) were 19.4%, 9.0%, and 8.0% respectively. Compared with non-severe patients, severe patients had a significantly higher prevalence of hypertension (pooled OR=2.98, 95% CI: 2.37-3.75, p<0.001, I2=15.4%), diabetes (pooled OR=2.75, 95% CI: 2.09-3.62, p<0.001, I2=26.1%), and cardiovascular disease (pooled OR=4.78, 95% CI: 2.71-8.42, p<0.001, I2=52.5%). In the subgroup analysis by region, studies from Wuhan showed higher OR for hypertension (OR=6.45, 95% CI: 4.06-10.24) compared to non-Wuhan studies (OR=8.11, 95% CI: 5.54-11.88). For age subgroups, younger patients showed OR=2.82 (95% CI: 1.45-5.48). Total patients: severe group 507, non-severe group 2,779. In the Wuhan subgroup, 1,489 patients from 12 studies. In the non-Wuhan subgroup, 1,797 patients from 10 studies. Egger test showed no significant publication bias for hypertension (p=0.192), diabetes (p=0.358), or CVD (p=0.127)."

call_api "paper2" "outcomes" "" "$PAPER2_TEXT"
sleep 2
call_api "paper2" "sample_sizes" "" "$PAPER2_TEXT"
sleep 2
call_api "paper2" "effect_size" "hypertension" "$PAPER2_TEXT"
sleep 2
call_api "paper2" "effect_size" "diabetes" "$PAPER2_TEXT"
sleep 2
call_api "paper2" "effect_size" "cardiovascular disease" "$PAPER2_TEXT"
sleep 2

echo "============================================"
echo "Paper 3: CVD & COVID-19 Severity (PMC7187816)"
echo "============================================"
echo ""

# Paper 3 text - Aggarwal et al. 2020
PAPER3_TEXT="Results: A total of 18 studies with 4,858 patients were included. In the severity analysis (13 studies, 4,858 patients), pre-existing cardiovascular disease was significantly associated with increased risk of severe COVID-19 (pooled OR=3.14, 95% CI: 2.32-4.24, p<0.001, I2=33%). In the mortality analysis (6 studies, 1,159 patients), CVD was associated with significantly increased risk of death from COVID-19 (pooled OR=11.08, 95% CI: 2.59-47.32, p=0.001, I2=67%). Hypertension was also associated with severe disease (OR=2.56, 95% CI: 1.82-3.59). In the individual studies: Wang et al. had 138 patients (36 severe, 102 non-severe), with CVD prevalence 22.2% in severe vs 6.4% in non-severe group. Huang et al. had 41 patients (13 ICU, 28 non-ICU), CVD 23% vs 11%. Guan et al. had 1,099 patients (173 severe, 926 non-severe). Zhou et al. had 191 patients (54 non-survivors, 137 survivors) with CVD 24% vs 1% (p<0.001). Treatment group total in severity cohort: severe N=733, non-severe N=4,125. For the mortality cohort: non-survivors N=213, survivors N=946."

call_api "paper3" "outcomes" "" "$PAPER3_TEXT"
sleep 2
call_api "paper3" "sample_sizes" "" "$PAPER3_TEXT"
sleep 2
call_api "paper3" "effect_size" "severe COVID-19" "$PAPER3_TEXT"
sleep 2
call_api "paper3" "effect_size" "death from COVID-19" "$PAPER3_TEXT"
sleep 2
call_api "paper3" "events" "severe COVID-19" "$PAPER3_TEXT"

echo ""
echo "============================================"
echo "All tests complete. Results saved to $RESULTS_FILE"
echo "============================================"
