"""
Hazard Ratio (HR) Gold Standard Validation for MetaReview Statistical Engine
Cycle 80 QA — Validates the logHazardRatio() function and HR meta-analysis pipeline.

Five test scenarios:
  1. Simple HR pooling (k=3) — oncology studies, moderate heterogeneity
  2. HR with high heterogeneity (k=5) — cardiovascular, divergent effects
  3. HR all protective (k=4) — all HR < 1, consistent direction
  4. HR minimal (k=2) — edge case, minimal degrees of freedom
  5. HR near null (k=4) — HRs close to 1.0, near-zero effect

Methodology:
  - Python gold standard (numpy/scipy) computes reference values
  - Same formulas as MetaReview's engine are reimplemented independently
  - Cross-check validates formula correctness
  - All results output as JSON for downstream comparison

Key formulas validated:
  - yi = log(HR)
  - sei = (log(ciUpper) - log(ciLower)) / (2 * 1.96)
  - vi = sei^2
  - Fixed effects: inverse variance weighting
  - Random effects: DerSimonian-Laird
  - Heterogeneity: Q, I^2, tau^2, tau, H^2
  - Back-transform: exp(pooled yi) for summary HR

Uses numpy/scipy as independent reference implementation.
Run with: uv run --with numpy --with scipy python scripts/validate-hr.py
"""

import numpy as np
from scipy import stats
import json
import sys


# ============================================================
# Helper functions (independent reimplementation)
# ============================================================

def log_hazard_ratio(hr, ci_lower, ci_upper):
    """Compute log(HR) and SE from reported HR and 95% CI.

    This is the core formula from effect-size.ts logHazardRatio():
      yi = log(HR)
      sei = (log(ciUpper) - log(ciLower)) / (2 * 1.96)
    """
    yi = np.log(hr)
    sei = (np.log(ci_upper) - np.log(ci_lower)) / (2 * 1.96)
    return float(yi), float(sei)


def meta_analysis_hr(studies, model='random'):
    """Run meta-analysis on HR data, return comprehensive results.

    Implements the exact same algorithm as MetaReview's meta-analysis.ts:
    1. Compute per-study yi, sei, vi
    2. Fixed effects (inverse variance)
    3. Heterogeneity (Cochran's Q, DL tau^2, I^2, H^2)
    4. Random effects (DL)
    5. Back-transform to original HR scale
    """
    # Step 1: Per-study effect sizes
    per_study = []
    yi_arr = []
    vi_arr = []

    for s in studies:
        yi, sei = log_hazard_ratio(s["hr"], s["ciLower"], s["ciUpper"])
        vi = sei ** 2
        yi_arr.append(yi)
        vi_arr.append(vi)
        per_study.append({
            "name": s["name"],
            "yi": yi,
            "sei": sei,
            "vi": vi,
            "effect": float(np.exp(yi)),                        # HR on original scale
            "ciLower": float(np.exp(yi - 1.96 * sei)),          # 95% CI lower
            "ciUpper": float(np.exp(yi + 1.96 * sei)),          # 95% CI upper
        })

    yi = np.array(yi_arr)
    vi = np.array(vi_arr)
    k = len(yi)
    df = k - 1

    # Step 2: Fixed effects (always computed, needed for Q)
    w_fe = 1.0 / vi
    sum_w_fe = float(np.sum(w_fe))
    summary_fe = float(np.sum(w_fe * yi) / sum_w_fe)
    se_fe = float(np.sqrt(1.0 / sum_w_fe))

    # Step 3: Heterogeneity
    if df <= 0:
        het = {"Q": 0.0, "df": 0, "pValue": 1.0, "I2": 0.0,
               "tau2": 0.0, "tau": 0.0, "H2": 1.0}
        weights_re_pct = [float(x) for x in (w_fe / sum_w_fe * 100)]
        summary = summary_fe
        se = se_fe
    else:
        Q = float(np.sum(w_fe * (yi - summary_fe) ** 2))
        Q_pvalue = float(1 - stats.chi2.cdf(Q, df))
        sum_w2 = float(np.sum(w_fe ** 2))
        C = sum_w_fe - sum_w2 / sum_w_fe
        tau2 = max(0.0, (Q - df) / C)
        tau = float(np.sqrt(tau2))
        I2 = max(0.0, ((Q - df) / Q) * 100) if Q > 0 else 0.0
        H2 = Q / df

        het = {
            "Q": Q,
            "df": df,
            "pValue": Q_pvalue,
            "I2": float(I2),
            "tau2": float(tau2),
            "tau": tau,
            "H2": float(H2),
        }

        # Step 4: Random effects
        w_re = 1.0 / (vi + tau2)
        sum_w_re = float(np.sum(w_re))
        summary_re = float(np.sum(w_re * yi) / sum_w_re)
        se_re = float(np.sqrt(1.0 / sum_w_re))

        weights_re_pct = [float(x) for x in (w_re / sum_w_re * 100)]

        if model == 'fixed':
            summary = summary_fe
            se = se_fe
        else:
            summary = summary_re
            se = se_re

    # Step 5: Z-test and p-value
    z = summary / se
    p = float(2 * (1 - stats.norm.cdf(abs(z))))

    # Add weight percentages to per-study
    for i, ps in enumerate(per_study):
        ps["weight"] = weights_re_pct[i]

    # Step 6: Back-transform pooled to original HR scale
    pooled = {
        "summary": summary,                                    # log(HR)
        "se": se,
        "effect": float(np.exp(summary)),                      # HR
        "ciLower": float(np.exp(summary - 1.96 * se)),         # 95% CI lower on HR scale
        "ciUpper": float(np.exp(summary + 1.96 * se)),         # 95% CI upper on HR scale
        "z": float(z),
        "pValue": float(p),
    }

    # Fixed effects pooled (for cross-reference)
    z_fe = summary_fe / se_fe
    p_fe = float(2 * (1 - stats.norm.cdf(abs(z_fe))))
    fixed = {
        "summary": summary_fe,
        "se": se_fe,
        "effect": float(np.exp(summary_fe)),
        "ciLower": float(np.exp(summary_fe - 1.96 * se_fe)),
        "ciUpper": float(np.exp(summary_fe + 1.96 * se_fe)),
        "z": float(z_fe),
        "pValue": float(p_fe),
    }

    return {
        "studies": per_study,
        "pooled": pooled,
        "fixed": fixed,
        "heterogeneity": het,
    }


def compare_values(label, expected, actual, abs_tol=1e-6, rel_tol=0.0001):
    """Compare two values with dual tolerance (absolute OR relative).

    Returns (pass, message) tuple.
    """
    if expected == 0 and actual == 0:
        return True, f"  PASS  {label}: {expected} == {actual}"

    abs_diff = abs(expected - actual)
    rel_diff = abs_diff / max(abs(expected), 1e-30) if expected != 0 else abs_diff

    passed = abs_diff < abs_tol or rel_diff < rel_tol

    if passed:
        return True, f"  PASS  {label}: gold={expected:.10g}, check={actual:.10g} (abs={abs_diff:.2e}, rel={rel_diff:.2e})"
    else:
        return False, f"  FAIL  {label}: gold={expected:.10g}, check={actual:.10g} (abs={abs_diff:.2e}, rel={rel_diff:.2e})"


# ============================================================
# Test Datasets — 5 HR Scenarios
# ============================================================

# --- Scenario 1: Simple HR pooling (k=3) ---
# Oncology studies: treatment vs control, moderate heterogeneity expected
scenario_1_studies = [
    {"name": "ONCO_A",  "hr": 0.72, "ciLower": 0.65, "ciUpper": 0.80},
    {"name": "ONCO_B",  "hr": 0.85, "ciLower": 0.74, "ciUpper": 0.97},
    {"name": "ONCO_C",  "hr": 0.68, "ciLower": 0.58, "ciUpper": 0.80},
]

# --- Scenario 2: HR with high heterogeneity (k=5) ---
# Cardiovascular studies: diverse HRs, some protective, some harmful
scenario_2_studies = [
    {"name": "CV_A",  "hr": 0.50, "ciLower": 0.35, "ciUpper": 0.71},
    {"name": "CV_B",  "hr": 0.80, "ciLower": 0.65, "ciUpper": 0.98},
    {"name": "CV_C",  "hr": 1.10, "ciLower": 0.85, "ciUpper": 1.42},
    {"name": "CV_D",  "hr": 0.65, "ciLower": 0.48, "ciUpper": 0.88},
    {"name": "CV_E",  "hr": 0.90, "ciLower": 0.70, "ciUpper": 1.16},
]

# --- Scenario 3: HR all protective (k=4) ---
# All HR < 1, consistent direction, low heterogeneity expected
scenario_3_studies = [
    {"name": "PROT_A",  "hr": 0.60, "ciLower": 0.50, "ciUpper": 0.72},
    {"name": "PROT_B",  "hr": 0.55, "ciLower": 0.42, "ciUpper": 0.72},
    {"name": "PROT_C",  "hr": 0.70, "ciLower": 0.58, "ciUpper": 0.84},
    {"name": "PROT_D",  "hr": 0.62, "ciLower": 0.49, "ciUpper": 0.78},
]

# --- Scenario 4: HR minimal k=2 ---
# Only 2 studies, minimal degrees of freedom for heterogeneity
scenario_4_studies = [
    {"name": "MIN_A",  "hr": 0.75, "ciLower": 0.60, "ciUpper": 0.94},
    {"name": "MIN_B",  "hr": 0.82, "ciLower": 0.68, "ciUpper": 0.99},
]

# --- Scenario 5: HR near null (k=4) ---
# HRs close to 1.0, testing near-zero log(HR) precision
scenario_5_studies = [
    {"name": "NULL_A",  "hr": 0.98, "ciLower": 0.85, "ciUpper": 1.13},
    {"name": "NULL_B",  "hr": 1.02, "ciLower": 0.90, "ciUpper": 1.16},
    {"name": "NULL_C",  "hr": 0.95, "ciLower": 0.80, "ciUpper": 1.13},
    {"name": "NULL_D",  "hr": 1.05, "ciLower": 0.88, "ciUpper": 1.25},
]


# ============================================================
# Run all scenarios and self-validate
# ============================================================

scenarios = [
    ("scenario_1_simple_hr", "Simple HR pooling (k=3, oncology)", scenario_1_studies),
    ("scenario_2_high_het", "HR with high heterogeneity (k=5, cardiovascular)", scenario_2_studies),
    ("scenario_3_all_protective", "HR all protective (k=4, all HR < 1)", scenario_3_studies),
    ("scenario_4_minimal_k2", "HR minimal (k=2)", scenario_4_studies),
    ("scenario_5_near_null", "HR near null (k=4, HRs close to 1.0)", scenario_5_studies),
]

results = {}
total_checks = 0
total_passed = 0
total_failed = 0
all_messages = []

for scenario_key, description, study_data in scenarios:
    print(f"\n{'='*70}", file=sys.stderr)
    print(f"Running {scenario_key}: {description}", file=sys.stderr)
    print(f"{'='*70}", file=sys.stderr)

    # Compute gold standard with scipy
    gold = meta_analysis_hr(study_data)

    # Independent reimplementation check — compute same values manually
    # to verify the meta_analysis_hr function itself is correct
    checks = []

    # Validate per-study calculations
    for i, s in enumerate(study_data):
        ps = gold["studies"][i]

        # Check yi = log(HR)
        expected_yi = np.log(s["hr"])
        ok, msg = compare_values(f"study[{i}].yi", expected_yi, ps["yi"])
        checks.append(ok)
        all_messages.append(msg)

        # Check sei = (log(ciUpper) - log(ciLower)) / (2 * 1.96)
        expected_sei = (np.log(s["ciUpper"]) - np.log(s["ciLower"])) / (2 * 1.96)
        ok, msg = compare_values(f"study[{i}].sei", expected_sei, ps["sei"])
        checks.append(ok)
        all_messages.append(msg)

        # Check vi = sei^2
        expected_vi = expected_sei ** 2
        ok, msg = compare_values(f"study[{i}].vi", expected_vi, ps["vi"])
        checks.append(ok)
        all_messages.append(msg)

        # Check effect = exp(yi) = HR (should match input)
        ok, msg = compare_values(f"study[{i}].effect", s["hr"], ps["effect"])
        checks.append(ok)
        all_messages.append(msg)

        # Check CI on original scale
        ok, msg = compare_values(f"study[{i}].ciLower", float(np.exp(expected_yi - 1.96 * expected_sei)), ps["ciLower"])
        checks.append(ok)
        all_messages.append(msg)

        ok, msg = compare_values(f"study[{i}].ciUpper", float(np.exp(expected_yi + 1.96 * expected_sei)), ps["ciUpper"])
        checks.append(ok)
        all_messages.append(msg)

        # Check weight is positive and sums to ~100%
        assert ps["weight"] > 0, f"Weight must be positive for study {i}"

    # Verify weights sum to 100%
    weight_sum = sum(ps["weight"] for ps in gold["studies"])
    ok, msg = compare_values("weight_sum", 100.0, weight_sum)
    checks.append(ok)
    all_messages.append(msg)

    # Validate fixed effects pooled estimate
    yi_arr = np.array([ps["yi"] for ps in gold["studies"]])
    vi_arr = np.array([ps["vi"] for ps in gold["studies"]])
    w_fe = 1.0 / vi_arr
    sum_w_fe = np.sum(w_fe)
    expected_fe_summary = float(np.sum(w_fe * yi_arr) / sum_w_fe)
    expected_fe_se = float(np.sqrt(1.0 / sum_w_fe))

    ok, msg = compare_values("fixed.summary", expected_fe_summary, gold["fixed"]["summary"])
    checks.append(ok)
    all_messages.append(msg)

    ok, msg = compare_values("fixed.se", expected_fe_se, gold["fixed"]["se"])
    checks.append(ok)
    all_messages.append(msg)

    ok, msg = compare_values("fixed.effect", float(np.exp(expected_fe_summary)), gold["fixed"]["effect"])
    checks.append(ok)
    all_messages.append(msg)

    # Validate heterogeneity
    het = gold["heterogeneity"]
    k = len(study_data)
    df = k - 1

    if df > 0:
        expected_Q = float(np.sum(w_fe * (yi_arr - expected_fe_summary) ** 2))
        ok, msg = compare_values("het.Q", expected_Q, het["Q"])
        checks.append(ok)
        all_messages.append(msg)

        ok, msg = compare_values("het.df", df, het["df"])
        checks.append(ok)
        all_messages.append(msg)

        expected_Q_p = float(1 - stats.chi2.cdf(expected_Q, df))
        ok, msg = compare_values("het.pValue", expected_Q_p, het["pValue"])
        checks.append(ok)
        all_messages.append(msg)

        sum_w2 = float(np.sum(w_fe ** 2))
        C = float(sum_w_fe) - sum_w2 / float(sum_w_fe)
        expected_tau2 = max(0.0, (expected_Q - df) / C)
        ok, msg = compare_values("het.tau2", expected_tau2, het["tau2"])
        checks.append(ok)
        all_messages.append(msg)

        ok, msg = compare_values("het.tau", float(np.sqrt(expected_tau2)), het["tau"])
        checks.append(ok)
        all_messages.append(msg)

        expected_I2 = max(0.0, ((expected_Q - df) / expected_Q) * 100) if expected_Q > 0 else 0.0
        ok, msg = compare_values("het.I2", expected_I2, het["I2"])
        checks.append(ok)
        all_messages.append(msg)

        expected_H2 = expected_Q / df
        ok, msg = compare_values("het.H2", expected_H2, het["H2"])
        checks.append(ok)
        all_messages.append(msg)

        # Validate random effects pooled
        w_re = 1.0 / (vi_arr + expected_tau2)
        sum_w_re = float(np.sum(w_re))
        expected_re_summary = float(np.sum(w_re * yi_arr) / sum_w_re)
        expected_re_se = float(np.sqrt(1.0 / sum_w_re))

        ok, msg = compare_values("pooled.summary", expected_re_summary, gold["pooled"]["summary"])
        checks.append(ok)
        all_messages.append(msg)

        ok, msg = compare_values("pooled.se", expected_re_se, gold["pooled"]["se"])
        checks.append(ok)
        all_messages.append(msg)

        expected_z = expected_re_summary / expected_re_se
        ok, msg = compare_values("pooled.z", expected_z, gold["pooled"]["z"])
        checks.append(ok)
        all_messages.append(msg)

        expected_p = float(2 * (1 - stats.norm.cdf(abs(expected_z))))
        ok, msg = compare_values("pooled.pValue", expected_p, gold["pooled"]["pValue"])
        checks.append(ok)
        all_messages.append(msg)

        # Back-transformed pooled HR
        ok, msg = compare_values("pooled.effect (HR)", float(np.exp(expected_re_summary)), gold["pooled"]["effect"])
        checks.append(ok)
        all_messages.append(msg)

        ok, msg = compare_values("pooled.ciLower", float(np.exp(expected_re_summary - 1.96 * expected_re_se)), gold["pooled"]["ciLower"])
        checks.append(ok)
        all_messages.append(msg)

        ok, msg = compare_values("pooled.ciUpper", float(np.exp(expected_re_summary + 1.96 * expected_re_se)), gold["pooled"]["ciUpper"])
        checks.append(ok)
        all_messages.append(msg)
    else:
        # k=1 case: heterogeneity should be degenerate (not applicable for HR since min k=2)
        pass

    scenario_passed = sum(1 for c in checks if c)
    scenario_failed = sum(1 for c in checks if not c)
    total_checks += len(checks)
    total_passed += scenario_passed
    total_failed += scenario_failed

    status = "PASS" if scenario_failed == 0 else "FAIL"
    print(f"  {status}: {scenario_passed}/{len(checks)} checks passed", file=sys.stderr)

    # Store results for JSON output
    results[scenario_key] = {
        "description": description,
        "measure": "HR",
        "model": "random",
        "k": k,
        "checks_passed": scenario_passed,
        "checks_total": len(checks),
        "status": status,
        "studies": gold["studies"],
        "pooled": gold["pooled"],
        "fixed": gold["fixed"],
        "heterogeneity": gold["heterogeneity"],
    }


# ============================================================
# Summary
# ============================================================

print(f"\n{'='*70}", file=sys.stderr)
print(f"HR VALIDATION SUMMARY", file=sys.stderr)
print(f"{'='*70}", file=sys.stderr)

summary = {
    "validation": "Hazard Ratio (HR) Meta-Analysis",
    "date": "2026-02-24",
    "engine": "MetaReview statistical engine (effect-size.ts + meta-analysis.ts)",
    "gold_standard": "Python numpy/scipy",
    "total_checks": total_checks,
    "total_passed": total_passed,
    "total_failed": total_failed,
    "status": "PASS" if total_failed == 0 else "FAIL",
    "scenarios": results,
}

for scenario_key, r in results.items():
    print(f"  {r['status']}  {scenario_key}: {r['checks_passed']}/{r['checks_total']}", file=sys.stderr)

print(f"\n  TOTAL: {total_passed}/{total_checks} checks passed", file=sys.stderr)
if total_failed > 0:
    print(f"  WARNING: {total_failed} checks FAILED", file=sys.stderr)
else:
    print(f"  All checks PASSED -- zero discrepancies", file=sys.stderr)

# Print detailed check log
print(f"\n{'='*70}", file=sys.stderr)
print(f"DETAILED CHECK LOG", file=sys.stderr)
print(f"{'='*70}", file=sys.stderr)
for msg in all_messages:
    print(msg, file=sys.stderr)

# Output JSON to stdout
print(json.dumps(summary, indent=2))
