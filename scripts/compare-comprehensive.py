"""
Compare MetaReview engine output vs Python gold standard
for comprehensive validation (Cycle 78).

Reads two JSON files and reports PASS/FAIL for each metric.
"""

import json
import sys


def compare_values(name, actual, expected, tol=1e-6):
    """Compare two numeric values with tolerance."""
    if expected is None and actual is None:
        return True, 0
    if expected is None or actual is None:
        return False, float('inf')

    diff = abs(actual - expected)
    rel_diff = diff / max(abs(expected), 1e-15) if expected != 0 else diff

    if diff < tol or rel_diff < tol:
        return True, diff
    return False, diff


def compare_scenario(name, engine, gold, tol=1e-6):
    """Compare a single scenario between engine and gold standard."""
    results = []
    total = 0
    passed = 0

    # Compare per-study effects
    for i, (es, gs) in enumerate(zip(engine.get("studies", []), gold.get("studies", []))):
        for key in ["yi", "sei", "vi", "effect", "ciLower", "ciUpper"]:
            if key in gs and key in es:
                total += 1
                ok, diff = compare_values(f"{name}/study_{i}/{key}", es[key], gs[key], tol)
                if ok:
                    passed += 1
                else:
                    results.append(f"  FAIL: study[{i}].{key}: engine={es[key]:.10f} vs gold={gs[key]:.10f} (diff={diff:.2e})")

    # Compare pooled results
    ep = engine.get("pooled", {})
    gp = gold.get("pooled", {})
    for key in set(list(ep.keys()) + list(gp.keys())):
        if key in ep and key in gp and isinstance(ep[key], (int, float)) and isinstance(gp[key], (int, float)):
            total += 1
            ok, diff = compare_values(f"{name}/pooled/{key}", ep[key], gp[key], tol)
            if ok:
                passed += 1
            else:
                results.append(f"  FAIL: pooled.{key}: engine={ep[key]:.10f} vs gold={gp[key]:.10f} (diff={diff:.2e})")

    # Compare heterogeneity
    eh = engine.get("heterogeneity", {})
    gh = gold.get("heterogeneity", {})
    for key in ["Q", "df", "pValue", "I2", "tau2", "tau", "H2"]:
        if key in eh and key in gh:
            total += 1
            ok, diff = compare_values(f"{name}/het/{key}", eh[key], gh[key], tol)
            if ok:
                passed += 1
            else:
                results.append(f"  FAIL: heterogeneity.{key}: engine={eh[key]:.10f} vs gold={gh[key]:.10f} (diff={diff:.2e})")

    return total, passed, results


def main():
    if len(sys.argv) != 3:
        print("Usage: python compare-comprehensive.py <engine.json> <gold.json>")
        sys.exit(1)

    with open(sys.argv[1]) as f:
        engine = json.load(f)
    with open(sys.argv[2]) as f:
        gold = json.load(f)

    total_all = 0
    passed_all = 0
    all_failures = []

    scenario_names = sorted(set(list(engine.keys()) + list(gold.keys())))

    print("=" * 70)
    print("MetaReview Comprehensive Validation Report — Cycle 78")
    print("=" * 70)

    for scenario in scenario_names:
        if scenario not in engine:
            print(f"\n--- {scenario} ---")
            print(f"  SKIP: Not found in engine output")
            continue
        if scenario not in gold:
            print(f"\n--- {scenario} ---")
            print(f"  SKIP: Not found in gold standard")
            continue

        desc = gold[scenario].get("description", scenario)
        total, passed, failures = compare_scenario(scenario, engine[scenario], gold[scenario])
        total_all += total
        passed_all += passed

        status = "PASS" if passed == total else "FAIL"
        print(f"\n--- {scenario}: {desc} ---")
        print(f"  [{status}] {passed}/{total} checks passed")

        if failures:
            for f in failures:
                print(f)
                all_failures.append(f"{scenario}: {f.strip()}")

    print(f"\n{'=' * 70}")
    print(f"TOTAL: {passed_all}/{total_all} checks passed")
    if all_failures:
        print(f"FAILURES: {len(all_failures)}")
        print(f"{'=' * 70}")
        for f in all_failures:
            print(f"  {f}")
    else:
        print("ALL CHECKS PASSED!")
    print(f"{'=' * 70}")

    # Exit code
    sys.exit(0 if passed_all == total_all else 1)


if __name__ == "__main__":
    main()
