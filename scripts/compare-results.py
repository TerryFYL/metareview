"""
Compare MetaReview engine output vs Python gold standard.
Outputs a structured comparison with pass/fail for each metric.
"""
import json
import subprocess
import sys

# Run both scripts and capture output
mr_output = subprocess.run(
    ["node", "scripts/validate-stats.mjs"],
    capture_output=True, text=True, cwd="/Users/terry/terry-com/projects/metareview"
)
py_output = subprocess.run(
    ["python3", "scripts/validate-gold-standard.py"],
    capture_output=True, text=True, cwd="/Users/terry/terry-com/projects/metareview"
)

mr = json.loads(mr_output.stdout)
py = json.loads(py_output.stdout)

# Tolerances
TOL = {
    "pooled_OR": 0.001,
    "log_OR": 0.0001,
    "ci_bounds": 0.01,
    "I2": 0.1,
    "tau2": 0.0001,
    "Q": 0.01,
    "se": 0.0001,
    "z": 0.001,
    "weight": 0.01,
    "egger_intercept": 0.001,
    "egger_pvalue": 0.01,
}

results = []
all_pass = True

def check(name, mr_val, py_val, tolerance, unit=""):
    global all_pass
    diff = abs(mr_val - py_val)
    passed = diff <= tolerance
    if not passed:
        all_pass = False
    results.append({
        "metric": name,
        "metareview": mr_val,
        "gold_standard": py_val,
        "difference": diff,
        "tolerance": tolerance,
        "status": "PASS" if passed else "FAIL",
        "unit": unit,
    })

# 1. Pooled OR
check("Pooled log(OR)", mr["pooled"]["log_OR"], py["pooled"]["log_OR"], TOL["log_OR"])
check("Pooled OR", mr["pooled"]["OR"], py["pooled"]["OR"], TOL["pooled_OR"])
check("Pooled SE", mr["pooled"]["se"], py["pooled"]["se"], TOL["se"])
check("CI Lower", mr["pooled"]["ci_lower"], py["pooled"]["ci_lower"], TOL["ci_bounds"])
check("CI Upper", mr["pooled"]["ci_upper"], py["pooled"]["ci_upper"], TOL["ci_bounds"])
check("z-value", mr["pooled"]["z"], py["pooled"]["z"], TOL["z"])
check("p-value", mr["pooled"]["p_value"], py["pooled"]["p_value"], 1e-14)

# 2. Heterogeneity
check("Cochran's Q", mr["heterogeneity"]["Q"], py["heterogeneity"]["Q"], TOL["Q"])
check("Q p-value", mr["heterogeneity"]["Q_pvalue"], py["heterogeneity"]["Q_pvalue"], 0.001)
check("I-squared (%)", mr["heterogeneity"]["I2"], py["heterogeneity"]["I2"], TOL["I2"], "%")
check("tau-squared", mr["heterogeneity"]["tau2"], py["heterogeneity"]["tau2"], TOL["tau2"])
check("H-squared", mr["heterogeneity"]["H2"], py["heterogeneity"]["H2"], 0.001)

# 3. Fixed effects
check("Fixed log(OR)", mr["fixed_effects"]["log_OR"], py["fixed_effects"]["log_OR"], TOL["log_OR"])
check("Fixed OR", mr["fixed_effects"]["OR"], py["fixed_effects"]["OR"], TOL["pooled_OR"])
check("Fixed SE", mr["fixed_effects"]["se"], py["fixed_effects"]["se"], TOL["se"])

# 4. Egger's test
check("Egger intercept", mr["eggers_test"]["intercept"], py["eggers_test"]["intercept"], TOL["egger_intercept"])
check("Egger SE", mr["eggers_test"]["se"], py["eggers_test"]["se"], 0.001)
check("Egger t-value", mr["eggers_test"]["tValue"], py["eggers_test"]["tValue"], 0.001)
check("Egger p-value", mr["eggers_test"]["pValue"], py["eggers_test"]["pValue"], TOL["egger_pvalue"])

# 5. Per-study
for i in range(len(mr["studies"])):
    name = mr["studies"][i]["name"]
    check(f"{name} yi", mr["studies"][i]["yi"], py["studies"][i]["yi"], TOL["log_OR"])
    check(f"{name} sei", mr["studies"][i]["sei"], py["studies"][i]["sei"], TOL["se"])
    check(f"{name} OR", mr["studies"][i]["effect_OR"], py["studies"][i]["effect_OR"], TOL["pooled_OR"])
    check(f"{name} weight_fixed%", mr["studies"][i]["weight_fixed_pct"], py["studies"][i]["weight_fixed_pct"], TOL["weight"])
    check(f"{name} weight_random%", mr["studies"][i]["weight_random_pct"], py["studies"][i]["weight_random_pct"], TOL["weight"])

# Output
print("=" * 90)
print(f"{'Metric':<25} {'MetaReview':>15} {'Gold Std':>15} {'Diff':>12} {'Tol':>10} {'Status':>8}")
print("=" * 90)

for r in results:
    mr_str = f"{r['metareview']:.10f}" if abs(r['metareview']) < 1000 else f"{r['metareview']:.6e}"
    py_str = f"{r['gold_standard']:.10f}" if abs(r['gold_standard']) < 1000 else f"{r['gold_standard']:.6e}"
    diff_str = f"{r['difference']:.2e}"
    tol_str = f"{r['tolerance']:.2e}"
    status = r["status"]
    marker = "  " if status == "PASS" else "**"
    print(f"{marker}{r['metric']:<23} {mr_str:>15} {py_str:>15} {diff_str:>12} {tol_str:>10} {status:>8}")

print("=" * 90)
passed = sum(1 for r in results if r["status"] == "PASS")
failed = sum(1 for r in results if r["status"] == "FAIL")
print(f"\nTotal: {len(results)} checks | PASSED: {passed} | FAILED: {failed}")
print(f"Overall: {'ALL CHECKS PASSED' if all_pass else 'SOME CHECKS FAILED'}")

# Also output JSON for report generation
with open("/Users/terry/terry-com/projects/metareview/scripts/comparison-results.json", "w") as f:
    json.dump({
        "summary": {
            "total": len(results),
            "passed": passed,
            "failed": failed,
            "all_pass": all_pass,
        },
        "checks": results,
        "metareview_raw": mr,
        "gold_standard_raw": py,
    }, f, indent=2)
print("\nDetailed results saved to scripts/comparison-results.json")
