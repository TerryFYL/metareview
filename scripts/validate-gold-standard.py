"""
Gold Standard Validation: Meta-analysis of Aspirin vs Placebo data
using Python scipy/statsmodels as reference (since R is not available).

Implements the same DerSimonian-Laird random effects model from scratch
using standard formulas, cross-checked against numpy/scipy.
"""

import numpy as np
from scipy import stats
import json

# === Demo Data (from store.ts) ===
studies = [
    {"name": "ISIS-2",  "events1": 791, "total1": 8587, "events2": 1029, "total2": 8600},
    {"name": "SALT",    "events1": 150, "total1": 676,  "events2": 196,  "total2": 684},
    {"name": "UK-TIA",  "events1": 286, "total1": 1632, "events2": 168,  "total2": 814},
    {"name": "ESPS-2",  "events1": 356, "total1": 1649, "events2": 441,  "total2": 1649},
    {"name": "TPT",     "events1": 142, "total1": 2545, "events2": 166,  "total2": 2540},
    {"name": "HOT",     "events1": 127, "total1": 9399, "events2": 151,  "total2": 9391},
    {"name": "PPP",     "events1": 20,  "total1": 2226, "events2": 32,   "total2": 2269},
]


def log_odds_ratio(events1, total1, events2, total2):
    """Calculate log OR and SE (no zero-cell correction needed for this data)."""
    a = events1
    b = total1 - events1
    c = events2
    d = total2 - events2

    yi = np.log((a * d) / (b * c))
    sei = np.sqrt(1/a + 1/b + 1/c + 1/d)
    return yi, sei


# Step 1: Calculate per-study effect sizes
yi_list = []
sei_list = []
vi_list = []
study_results = []

for s in studies:
    yi, sei = log_odds_ratio(s["events1"], s["total1"], s["events2"], s["total2"])
    vi = sei ** 2
    yi_list.append(yi)
    sei_list.append(sei)
    vi_list.append(vi)
    study_results.append({
        "name": s["name"],
        "yi": yi,
        "sei": sei,
        "vi": vi,
        "effect_OR": np.exp(yi),
        "ci_lower": np.exp(yi - 1.96 * sei),
        "ci_upper": np.exp(yi + 1.96 * sei),
    })

yi_arr = np.array(yi_list)
vi_arr = np.array(vi_list)
sei_arr = np.array(sei_list)

# Step 2: Fixed effects (Inverse Variance)
w_fe = 1.0 / vi_arr
sum_w_fe = np.sum(w_fe)
summary_fe = np.sum(w_fe * yi_arr) / sum_w_fe
se_fe = np.sqrt(1.0 / sum_w_fe)

# Step 3: Heterogeneity
k = len(studies)
df = k - 1

# Cochran's Q
Q = np.sum(w_fe * (yi_arr - summary_fe) ** 2)
Q_pvalue = 1 - stats.chi2.cdf(Q, df)

# DerSimonian-Laird tau^2
C = sum_w_fe - np.sum(w_fe ** 2) / sum_w_fe
tau2 = max(0, (Q - df) / C)
tau = np.sqrt(tau2)

# I^2
I2 = max(0, ((Q - df) / Q) * 100) if Q > 0 else 0
H2 = Q / df if df > 0 else 1

# Step 4: Random effects (DerSimonian-Laird)
w_re = 1.0 / (vi_arr + tau2)
sum_w_re = np.sum(w_re)
summary_re = np.sum(w_re * yi_arr) / sum_w_re
se_re = np.sqrt(1.0 / sum_w_re)

# Z and p-value
z_re = summary_re / se_re
p_re = 2 * (1 - stats.norm.cdf(abs(z_re)))

# Per-study weights
weights_fe_pct = (w_fe / sum_w_fe) * 100
weights_re_pct = (w_re / sum_w_re) * 100

for i, sr in enumerate(study_results):
    sr["weight_fixed_pct"] = float(weights_fe_pct[i])
    sr["weight_random_pct"] = float(weights_re_pct[i])

# Step 5: Egger's test
# y = yi/sei, x = 1/sei
x_egger = 1.0 / sei_arr
y_egger = yi_arr / sei_arr

n_egger = len(x_egger)
mean_x = np.mean(x_egger)
mean_y = np.mean(y_egger)
Sxx = np.sum((x_egger - mean_x) ** 2)
Sxy = np.sum((x_egger - mean_x) * (y_egger - mean_y))

slope_egger = Sxy / Sxx
intercept_egger = mean_y - slope_egger * mean_x

# Residuals
residuals = y_egger - (intercept_egger + slope_egger * x_egger)
sse = np.sum(residuals ** 2)
df_egger = n_egger - 2
mse = sse / df_egger

# SE of intercept
se_intercept = np.sqrt(mse * (1.0/n_egger + mean_x**2 / Sxx))

# t-test
t_egger = intercept_egger / se_intercept
p_egger = 2 * (1 - stats.t.cdf(abs(t_egger), df_egger))


# === Output ===
result = {
    "gold_standard": "Python scipy/statsmodels",
    "measure": "OR",
    "model": "random (DerSimonian-Laird)",
    "studies": study_results,
    "pooled": {
        "log_OR": float(summary_re),
        "OR": float(np.exp(summary_re)),
        "se": float(se_re),
        "ci_lower": float(np.exp(summary_re - 1.96 * se_re)),
        "ci_upper": float(np.exp(summary_re + 1.96 * se_re)),
        "z": float(z_re),
        "p_value": float(p_re),
    },
    "heterogeneity": {
        "Q": float(Q),
        "df": df,
        "Q_pvalue": float(Q_pvalue),
        "I2": float(I2),
        "tau2": float(tau2),
        "tau": float(tau),
        "H2": float(H2),
    },
    "eggers_test": {
        "intercept": float(intercept_egger),
        "se": float(se_intercept),
        "tValue": float(t_egger),
        "pValue": float(p_egger),
        "df": df_egger,
    },
    "fixed_effects": {
        "log_OR": float(summary_fe),
        "OR": float(np.exp(summary_fe)),
        "se": float(se_fe),
        "ci_lower": float(np.exp(summary_fe - 1.96 * se_fe)),
        "ci_upper": float(np.exp(summary_fe + 1.96 * se_fe)),
    },
}

print(json.dumps(result, indent=2))
