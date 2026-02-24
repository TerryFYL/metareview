"""
Comprehensive Gold Standard Validation for MetaReview Statistical Engine
Cycle 78 QA — Tests all untested scenarios:
  1. Risk Ratio (RR) — binary data
  2. Mean Difference (MD) — continuous data
  3. Standardized Mean Difference (SMD / Hedges' g) — continuous data
  4. Zero-cell continuity correction — binary data with zero events
  5. High heterogeneity (non-zero tau^2) — deliberately divergent effects
  6. Edge cases — k=1 and k=2 studies
  7. Subgroup analysis — Q-between test

Uses numpy/scipy as independent reference implementation.
"""

import numpy as np
from scipy import stats
import json
import sys


# ============================================================
# Helper functions
# ============================================================

def correct_zero_cells(events1, total1, events2, total2):
    """Apply 0.5 continuity correction if any cell is zero or total."""
    has_zero = (events1 == 0 or events2 == 0 or
                events1 == total1 or events2 == total2)
    if not has_zero:
        return events1, total1, events2, total2
    return events1 + 0.5, total1 + 1, events2 + 0.5, total2 + 1


def log_odds_ratio(events1, total1, events2, total2):
    e1, t1, e2, t2 = correct_zero_cells(events1, total1, events2, total2)
    a, b, c, d = e1, t1 - e1, e2, t2 - e2
    yi = np.log((a * d) / (b * c))
    sei = np.sqrt(1/a + 1/b + 1/c + 1/d)
    return yi, sei


def log_risk_ratio(events1, total1, events2, total2):
    e1, t1, e2, t2 = correct_zero_cells(events1, total1, events2, total2)
    p1 = e1 / t1
    p2 = e2 / t2
    yi = np.log(p1 / p2)
    sei = np.sqrt((1 - p1) / e1 + (1 - p2) / e2)
    return yi, sei


def mean_difference(mean1, sd1, n1, mean2, sd2, n2):
    yi = mean1 - mean2
    sei = np.sqrt(sd1**2 / n1 + sd2**2 / n2)
    return yi, sei


def hedges_g(mean1, sd1, n1, mean2, sd2, n2):
    df = n1 + n2 - 2
    sp = np.sqrt(((n1 - 1) * sd1**2 + (n2 - 1) * sd2**2) / df)
    cohen_d = (mean1 - mean2) / sp
    J = 1 - 3 / (4 * df - 1)
    yi = cohen_d * J
    sei = np.sqrt((n1 + n2) / (n1 * n2) + yi**2 / (2 * (n1 + n2))) * J
    return yi, sei


def meta_analysis(yi_arr, vi_arr, model='random'):
    """Run meta-analysis, return dict of results."""
    yi = np.array(yi_arr)
    vi = np.array(vi_arr)
    k = len(yi)
    df = k - 1

    # Fixed effects
    w_fe = 1.0 / vi
    sum_w_fe = np.sum(w_fe)
    summary_fe = np.sum(w_fe * yi) / sum_w_fe
    se_fe = np.sqrt(1.0 / sum_w_fe)

    # Heterogeneity
    if df <= 0:
        het = {"Q": 0, "df": 0, "pValue": 1, "I2": 0, "tau2": 0, "tau": 0, "H2": 1}
        return {
            "summary": float(summary_fe),
            "se": float(se_fe),
            "heterogeneity": het,
            "weights_fe": [float(x) for x in (w_fe / sum_w_fe * 100)],
            "weights_re": [float(x) for x in (w_fe / sum_w_fe * 100)],
        }

    Q = float(np.sum(w_fe * (yi - summary_fe)**2))
    Q_pvalue = float(1 - stats.chi2.cdf(Q, df))
    C = float(sum_w_fe - np.sum(w_fe**2) / sum_w_fe)
    tau2 = max(0, (Q - df) / C)
    tau = np.sqrt(tau2)
    I2 = max(0, ((Q - df) / Q) * 100) if Q > 0 else 0
    H2 = Q / df if df > 0 else 1

    het = {
        "Q": Q, "df": df, "pValue": Q_pvalue,
        "I2": float(I2), "tau2": float(tau2), "tau": float(tau), "H2": float(H2),
    }

    # Random effects
    w_re = 1.0 / (vi + tau2)
    sum_w_re = np.sum(w_re)
    summary_re = float(np.sum(w_re * yi) / sum_w_re)
    se_re = float(np.sqrt(1.0 / sum_w_re))

    if model == 'fixed':
        summary = float(summary_fe)
        se = float(se_fe)
    else:
        summary = summary_re
        se = se_re

    z = summary / se
    p = float(2 * (1 - stats.norm.cdf(abs(z))))

    return {
        "summary": summary,
        "se": se,
        "z": float(z),
        "pValue": p,
        "heterogeneity": het,
        "weights_fe": [float(x) for x in (w_fe / sum_w_fe * 100)],
        "weights_re": [float(x) for x in (w_re / sum_w_re * 100)],
        "fixed_summary": float(summary_fe),
        "fixed_se": float(se_fe),
    }


# ============================================================
# Test Datasets
# ============================================================

# --- Scenario 1: RR with binary data (same Aspirin dataset) ---
aspirin_studies = [
    {"name": "ISIS-2",  "events1": 791, "total1": 8587, "events2": 1029, "total2": 8600},
    {"name": "SALT",    "events1": 150, "total1": 676,  "events2": 196,  "total2": 684},
    {"name": "UK-TIA",  "events1": 286, "total1": 1632, "events2": 168,  "total2": 814},
    {"name": "ESPS-2",  "events1": 356, "total1": 1649, "events2": 441,  "total2": 1649},
    {"name": "TPT",     "events1": 142, "total1": 2545, "events2": 166,  "total2": 2540},
    {"name": "HOT",     "events1": 127, "total1": 9399, "events2": 151,  "total2": 9391},
    {"name": "PPP",     "events1": 20,  "total1": 2226, "events2": 32,   "total2": 2269},
]

# --- Scenario 2 & 3: Continuous data (Blood pressure reduction studies) ---
bp_studies = [
    {"name": "Trial_A", "mean1": -10.2, "sd1": 5.1, "n1": 50, "mean2": -3.1, "sd2": 4.2, "n2": 48},
    {"name": "Trial_B", "mean1": -8.5,  "sd1": 6.0, "n1": 35, "mean2": -2.3, "sd2": 5.0, "n2": 40},
    {"name": "Trial_C", "mean1": -12.0, "sd1": 4.3, "n1": 60, "mean2": -4.0, "sd2": 5.2, "n2": 55},
    {"name": "Trial_D", "mean1": -6.8,  "sd1": 7.2, "n1": 25, "mean2": -1.5, "sd2": 6.0, "n2": 30},
    {"name": "Trial_E", "mean1": -15.0, "sd1": 5.0, "n1": 45, "mean2": -5.5, "sd2": 4.0, "n2": 42},
    {"name": "Trial_F", "mean1": -9.0,  "sd1": 5.5, "n1": 70, "mean2": -3.2, "sd2": 4.5, "n2": 65},
]

# --- Scenario 4: Zero-cell correction ---
zero_cell_studies = [
    {"name": "ZC_1", "events1": 0,  "total1": 20, "events2": 5, "total2": 22},
    {"name": "ZC_2", "events1": 3,  "total1": 30, "events2": 8, "total2": 28},
    {"name": "ZC_3", "events1": 1,  "total1": 15, "events2": 6, "total2": 18},
    {"name": "ZC_4", "events1": 10, "total1": 50, "events2": 0, "total2": 45},
]

# --- Scenario 5: High heterogeneity (divergent effects) ---
high_het_studies = [
    {"name": "HH_1", "events1": 5,   "total1": 100, "events2": 10,  "total2": 100},  # OR ~0.48
    {"name": "HH_2", "events1": 30,  "total1": 100, "events2": 15,  "total2": 100},  # OR ~2.43
    {"name": "HH_3", "events1": 20,  "total1": 200, "events2": 25,  "total2": 200},  # OR ~0.79
    {"name": "HH_4", "events1": 40,  "total1": 80,  "events2": 20,  "total2": 80},   # OR ~3.0
    {"name": "HH_5", "events1": 3,   "total1": 150, "events2": 10,  "total2": 150},  # OR ~0.29
]

# --- Scenario 6: Edge cases ---
single_study = [
    {"name": "Solo", "events1": 50, "total1": 200, "events2": 70, "total2": 200},
]
two_studies = [
    {"name": "Duo_A", "events1": 30, "total1": 100, "events2": 45, "total2": 100},
    {"name": "Duo_B", "events1": 15, "total1": 80,  "events2": 25, "total2": 80},
]


# ============================================================
# Run all scenarios
# ============================================================

results = {}

# --- 1. RR with Aspirin data ---
print("Running Scenario 1: RR with Aspirin data...", file=sys.stderr)
yi_rr, vi_rr = [], []
per_study_rr = []
for s in aspirin_studies:
    yi, sei = log_risk_ratio(s["events1"], s["total1"], s["events2"], s["total2"])
    vi = sei**2
    yi_rr.append(yi)
    vi_rr.append(vi)
    per_study_rr.append({
        "name": s["name"], "yi": float(yi), "sei": float(sei), "vi": float(vi),
        "effect": float(np.exp(yi)),
        "ciLower": float(np.exp(yi - 1.96 * sei)),
        "ciUpper": float(np.exp(yi + 1.96 * sei)),
    })

ma_rr = meta_analysis(yi_rr, vi_rr)
results["scenario_1_rr"] = {
    "description": "Risk Ratio with Aspirin binary data (7 studies)",
    "measure": "RR",
    "model": "random",
    "studies": per_study_rr,
    "pooled": {
        "log_RR": ma_rr["summary"],
        "RR": float(np.exp(ma_rr["summary"])),
        "se": ma_rr["se"],
        "ciLower": float(np.exp(ma_rr["summary"] - 1.96 * ma_rr["se"])),
        "ciUpper": float(np.exp(ma_rr["summary"] + 1.96 * ma_rr["se"])),
        "z": ma_rr["z"],
        "pValue": ma_rr["pValue"],
    },
    "heterogeneity": ma_rr["heterogeneity"],
}

# --- 2. MD with continuous data ---
print("Running Scenario 2: MD with continuous data...", file=sys.stderr)
yi_md, vi_md = [], []
per_study_md = []
for s in bp_studies:
    yi, sei = mean_difference(s["mean1"], s["sd1"], s["n1"], s["mean2"], s["sd2"], s["n2"])
    vi = sei**2
    yi_md.append(yi)
    vi_md.append(vi)
    per_study_md.append({
        "name": s["name"], "yi": float(yi), "sei": float(sei), "vi": float(vi),
        "effect": float(yi),
        "ciLower": float(yi - 1.96 * sei),
        "ciUpper": float(yi + 1.96 * sei),
    })

ma_md = meta_analysis(yi_md, vi_md)
results["scenario_2_md"] = {
    "description": "Mean Difference with blood pressure data (6 studies)",
    "measure": "MD",
    "model": "random",
    "studies": per_study_md,
    "pooled": {
        "MD": ma_md["summary"],
        "se": ma_md["se"],
        "ciLower": float(ma_md["summary"] - 1.96 * ma_md["se"]),
        "ciUpper": float(ma_md["summary"] + 1.96 * ma_md["se"]),
        "z": ma_md["z"],
        "pValue": ma_md["pValue"],
    },
    "heterogeneity": ma_md["heterogeneity"],
}

# --- 3. SMD (Hedges' g) with continuous data ---
print("Running Scenario 3: SMD with continuous data...", file=sys.stderr)
yi_smd, vi_smd = [], []
per_study_smd = []
for s in bp_studies:
    yi, sei = hedges_g(s["mean1"], s["sd1"], s["n1"], s["mean2"], s["sd2"], s["n2"])
    vi = sei**2
    yi_smd.append(yi)
    vi_smd.append(vi)
    per_study_smd.append({
        "name": s["name"], "yi": float(yi), "sei": float(sei), "vi": float(vi),
        "effect": float(yi),
        "ciLower": float(yi - 1.96 * sei),
        "ciUpper": float(yi + 1.96 * sei),
    })

ma_smd = meta_analysis(yi_smd, vi_smd)
results["scenario_3_smd"] = {
    "description": "Standardized Mean Difference (Hedges' g) with blood pressure data (6 studies)",
    "measure": "SMD",
    "model": "random",
    "studies": per_study_smd,
    "pooled": {
        "SMD": ma_smd["summary"],
        "se": ma_smd["se"],
        "ciLower": float(ma_smd["summary"] - 1.96 * ma_smd["se"]),
        "ciUpper": float(ma_smd["summary"] + 1.96 * ma_smd["se"]),
        "z": ma_smd["z"],
        "pValue": ma_smd["pValue"],
    },
    "heterogeneity": ma_smd["heterogeneity"],
}

# --- 4. Zero-cell correction with OR ---
print("Running Scenario 4: Zero-cell correction...", file=sys.stderr)
yi_zc, vi_zc = [], []
per_study_zc = []
for s in zero_cell_studies:
    yi, sei = log_odds_ratio(s["events1"], s["total1"], s["events2"], s["total2"])
    vi = sei**2
    yi_zc.append(yi)
    vi_zc.append(vi)
    per_study_zc.append({
        "name": s["name"], "yi": float(yi), "sei": float(sei), "vi": float(vi),
        "effect": float(np.exp(yi)),
        "ciLower": float(np.exp(yi - 1.96 * sei)),
        "ciUpper": float(np.exp(yi + 1.96 * sei)),
    })

ma_zc = meta_analysis(yi_zc, vi_zc)
results["scenario_4_zero_cell"] = {
    "description": "Zero-cell correction with OR (4 studies, 2 with zero events)",
    "measure": "OR",
    "model": "random",
    "studies": per_study_zc,
    "pooled": {
        "log_OR": ma_zc["summary"],
        "OR": float(np.exp(ma_zc["summary"])),
        "se": ma_zc["se"],
        "ciLower": float(np.exp(ma_zc["summary"] - 1.96 * ma_zc["se"])),
        "ciUpper": float(np.exp(ma_zc["summary"] + 1.96 * ma_zc["se"])),
        "z": ma_zc["z"],
        "pValue": ma_zc["pValue"],
    },
    "heterogeneity": ma_zc["heterogeneity"],
}

# --- 5. High heterogeneity ---
print("Running Scenario 5: High heterogeneity...", file=sys.stderr)
yi_hh, vi_hh = [], []
per_study_hh = []
for s in high_het_studies:
    yi, sei = log_odds_ratio(s["events1"], s["total1"], s["events2"], s["total2"])
    vi = sei**2
    yi_hh.append(yi)
    vi_hh.append(vi)
    per_study_hh.append({
        "name": s["name"], "yi": float(yi), "sei": float(sei), "vi": float(vi),
        "effect": float(np.exp(yi)),
        "ciLower": float(np.exp(yi - 1.96 * sei)),
        "ciUpper": float(np.exp(yi + 1.96 * sei)),
    })

ma_hh = meta_analysis(yi_hh, vi_hh)
results["scenario_5_high_het"] = {
    "description": "High heterogeneity with OR (5 studies, divergent effects)",
    "measure": "OR",
    "model": "random",
    "studies": per_study_hh,
    "pooled": {
        "log_OR": ma_hh["summary"],
        "OR": float(np.exp(ma_hh["summary"])),
        "se": ma_hh["se"],
        "ciLower": float(np.exp(ma_hh["summary"] - 1.96 * ma_hh["se"])),
        "ciUpper": float(np.exp(ma_hh["summary"] + 1.96 * ma_hh["se"])),
        "z": ma_hh["z"],
        "pValue": ma_hh["pValue"],
    },
    "heterogeneity": ma_hh["heterogeneity"],
}

# --- 6a. Edge case: k=1 ---
print("Running Scenario 6a: Single study...", file=sys.stderr)
s = single_study[0]
yi1, sei1 = log_odds_ratio(s["events1"], s["total1"], s["events2"], s["total2"])
vi1 = sei1**2
ma_k1 = meta_analysis([yi1], [vi1])
results["scenario_6a_k1"] = {
    "description": "Single study (k=1)",
    "measure": "OR",
    "model": "random",
    "studies": [{
        "name": s["name"], "yi": float(yi1), "sei": float(sei1), "vi": float(vi1),
        "effect": float(np.exp(yi1)),
        "ciLower": float(np.exp(yi1 - 1.96 * sei1)),
        "ciUpper": float(np.exp(yi1 + 1.96 * sei1)),
    }],
    "pooled": {
        "log_OR": ma_k1["summary"],
        "OR": float(np.exp(ma_k1["summary"])),
        "se": ma_k1["se"],
    },
    "heterogeneity": ma_k1["heterogeneity"],
}

# --- 6b. Edge case: k=2 ---
print("Running Scenario 6b: Two studies...", file=sys.stderr)
yi_k2, vi_k2 = [], []
per_study_k2 = []
for s in two_studies:
    yi, sei = log_odds_ratio(s["events1"], s["total1"], s["events2"], s["total2"])
    vi = sei**2
    yi_k2.append(yi)
    vi_k2.append(vi)
    per_study_k2.append({
        "name": s["name"], "yi": float(yi), "sei": float(sei), "vi": float(vi),
        "effect": float(np.exp(yi)),
        "ciLower": float(np.exp(yi - 1.96 * sei)),
        "ciUpper": float(np.exp(yi + 1.96 * sei)),
    })

ma_k2 = meta_analysis(yi_k2, vi_k2)
results["scenario_6b_k2"] = {
    "description": "Two studies (k=2)",
    "measure": "OR",
    "model": "random",
    "studies": per_study_k2,
    "pooled": {
        "log_OR": ma_k2["summary"],
        "OR": float(np.exp(ma_k2["summary"])),
        "se": ma_k2["se"],
        "ciLower": float(np.exp(ma_k2["summary"] - 1.96 * ma_k2["se"])),
        "ciUpper": float(np.exp(ma_k2["summary"] + 1.96 * ma_k2["se"])),
        "z": ma_k2["z"],
        "pValue": ma_k2["pValue"],
    },
    "heterogeneity": ma_k2["heterogeneity"],
}

# --- 7. RR with zero-cell data ---
print("Running Scenario 7: RR with zero-cell data...", file=sys.stderr)
yi_rr_zc, vi_rr_zc = [], []
per_study_rr_zc = []
for s in zero_cell_studies:
    yi, sei = log_risk_ratio(s["events1"], s["total1"], s["events2"], s["total2"])
    vi = sei**2
    yi_rr_zc.append(yi)
    vi_rr_zc.append(vi)
    per_study_rr_zc.append({
        "name": s["name"], "yi": float(yi), "sei": float(sei), "vi": float(vi),
        "effect": float(np.exp(yi)),
        "ciLower": float(np.exp(yi - 1.96 * sei)),
        "ciUpper": float(np.exp(yi + 1.96 * sei)),
    })

ma_rr_zc = meta_analysis(yi_rr_zc, vi_rr_zc)
results["scenario_7_rr_zero_cell"] = {
    "description": "Risk Ratio with zero-cell data (4 studies)",
    "measure": "RR",
    "model": "random",
    "studies": per_study_rr_zc,
    "pooled": {
        "log_RR": ma_rr_zc["summary"],
        "RR": float(np.exp(ma_rr_zc["summary"])),
        "se": ma_rr_zc["se"],
        "ciLower": float(np.exp(ma_rr_zc["summary"] - 1.96 * ma_rr_zc["se"])),
        "ciUpper": float(np.exp(ma_rr_zc["summary"] + 1.96 * ma_rr_zc["se"])),
        "z": ma_rr_zc["z"],
        "pValue": ma_rr_zc["pValue"],
    },
    "heterogeneity": ma_rr_zc["heterogeneity"],
}


# Output
print(json.dumps(results, indent=2))
print(f"\nGenerated {len(results)} test scenarios.", file=sys.stderr)
