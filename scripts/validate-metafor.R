#!/usr/bin/env Rscript
# =============================================================================
# MetaReview Cross-Validation: R metafor Reference Generator
# =============================================================================
#
# Purpose:
#   Generate gold-standard reference values from R's metafor package for
#   cross-validation against MetaReview's JavaScript statistical engine.
#
# Usage:
#   Rscript scripts/validate-metafor.R
#
# Output:
#   scripts/metafor-reference.json
#
# Dependencies:
#   - R >= 4.0
#   - metafor package (auto-installed if missing)
#   - jsonlite package (auto-installed if missing)
#
# Method correspondence:
#   MetaReview            | metafor
#   ----------------------|---------------------------
#   DerSimonian-Laird RE  | rma(method = "DL")
#   Inverse Variance FE   | rma(method = "FE")
#   Log Odds Ratio        | escalc(measure = "OR")
#   Log Risk Ratio        | escalc(measure = "RR")
#   Mean Difference       | escalc(measure = "MD")
#   Hedges' g (SMD)       | escalc(measure = "SMD")
#   0.5 continuity corr.  | escalc(to = "if0all", add = 0.5)
#
# =============================================================================

# --- Package management ------------------------------------------------------

install_if_missing <- function(pkg) {
  if (!requireNamespace(pkg, quietly = TRUE)) {
    message(sprintf("Installing package '%s'...", pkg))
    install.packages(pkg, repos = "https://cloud.r-project.org", quiet = TRUE)
  }
  library(pkg, character.only = TRUE)
}

install_if_missing("metafor")
install_if_missing("jsonlite")

message("metafor version: ", packageVersion("metafor"))
message("R version: ", R.version.string)

# --- Helper: extract all results from a metafor model ------------------------

extract_results <- function(es, model_re, model_fe, measure_name, k) {
  # Per-study effect sizes
  studies <- data.frame(
    yi  = as.numeric(es$yi),
    vi  = as.numeric(es$vi),
    sei = sqrt(as.numeric(es$vi))
  )

  # Random effects (DerSimonian-Laird)
  re <- list(
    estimate = as.numeric(model_re$beta),
    se       = as.numeric(model_re$se),
    zval     = as.numeric(model_re$zval),
    pval     = as.numeric(model_re$pval),
    ci_lb    = as.numeric(model_re$ci.lb),
    ci_ub    = as.numeric(model_re$ci.ub)
  )

  # Fixed effects (Inverse Variance)
  fe <- list(
    estimate = as.numeric(model_fe$beta),
    se       = as.numeric(model_fe$se),
    zval     = as.numeric(model_fe$zval),
    pval     = as.numeric(model_fe$pval),
    ci_lb    = as.numeric(model_fe$ci.lb),
    ci_ub    = as.numeric(model_fe$ci.ub)
  )

  # Heterogeneity (from random effects model, since FE does not estimate tau2)
  heterogeneity <- list(
    QE   = as.numeric(model_re$QE),
    QEp  = as.numeric(model_re$QEp),
    I2   = as.numeric(model_re$I2),
    tau2 = as.numeric(model_re$tau2),
    H2   = as.numeric(model_re$H2)
  )

  # Prediction interval (for RE with k >= 3)
  prediction_interval <- NULL
  if (k >= 3) {
    pred <- tryCatch(
      predict(model_re, level = 0.95),
      error = function(e) NULL
    )
    if (!is.null(pred) && !is.null(pred$pi.lb)) {
      prediction_interval <- list(
        pi_lb = as.numeric(pred$pi.lb),
        pi_ub = as.numeric(pred$pi.ub)
      )
    }
  }

  list(
    measure              = measure_name,
    k                    = k,
    studies              = studies,
    random_effects       = re,
    fixed_effects        = fe,
    heterogeneity        = heterogeneity,
    prediction_interval  = prediction_interval
  )
}

# =============================================================================
# Scenario 1: Odds Ratio with Aspirin data (7 studies)
# =============================================================================

message("\n--- Scenario 1: OR with Aspirin data ---")

ai_aspirin <- c(791, 150, 286, 356, 142, 127, 20)
n1i_aspirin <- c(8587, 676, 1632, 1649, 2545, 9399, 2226)
ci_aspirin <- c(1029, 196, 168, 441, 166, 151, 32)
n2i_aspirin <- c(8600, 684, 814, 1649, 2540, 9391, 2269)
bi_aspirin <- n1i_aspirin - ai_aspirin
di_aspirin <- n2i_aspirin - ci_aspirin

# escalc computes log odds ratios
es1 <- escalc(measure = "OR",
              ai = ai_aspirin, bi = bi_aspirin,
              ci = ci_aspirin, di = di_aspirin)

# Random effects (DerSimonian-Laird)
re1 <- rma(yi, vi, data = es1, method = "DL")

# Fixed effects (Inverse Variance)
fe1 <- rma(yi, vi, data = es1, method = "FE")

message("  RE log(OR) = ", round(re1$beta, 6), " (SE = ", round(re1$se, 6), ")")
message("  FE log(OR) = ", round(fe1$beta, 6), " (SE = ", round(fe1$se, 6), ")")
message("  tau2 = ", round(re1$tau2, 6), ", I2 = ", round(re1$I2, 2), "%")

scenario1 <- extract_results(es1, re1, fe1, "OR", 7)

# =============================================================================
# Scenario 2: Risk Ratio with same Aspirin data (7 studies)
# =============================================================================

message("\n--- Scenario 2: RR with Aspirin data ---")

es2 <- escalc(measure = "RR",
              ai = ai_aspirin, bi = bi_aspirin,
              ci = ci_aspirin, di = di_aspirin)

re2 <- rma(yi, vi, data = es2, method = "DL")
fe2 <- rma(yi, vi, data = es2, method = "FE")

message("  RE log(RR) = ", round(re2$beta, 6), " (SE = ", round(re2$se, 6), ")")
message("  FE log(RR) = ", round(fe2$beta, 6), " (SE = ", round(fe2$se, 6), ")")
message("  tau2 = ", round(re2$tau2, 6), ", I2 = ", round(re2$I2, 2), "%")

scenario2 <- extract_results(es2, re2, fe2, "RR", 7)

# =============================================================================
# Scenario 3: Mean Difference with blood pressure data (6 studies)
# =============================================================================

message("\n--- Scenario 3: MD with blood pressure data ---")

m1i_bp <- c(-10.2, -8.5, -12.0, -6.8, -15.0, -9.0)
sd1i_bp <- c(5.1, 6.0, 4.3, 7.2, 5.0, 5.5)
n1i_bp <- c(50, 35, 60, 25, 45, 70)
m2i_bp <- c(-3.1, -2.3, -4.0, -1.5, -5.5, -3.2)
sd2i_bp <- c(4.2, 5.0, 5.2, 6.0, 4.0, 4.5)
n2i_bp <- c(48, 40, 55, 30, 42, 65)

es3 <- escalc(measure = "MD",
              m1i = m1i_bp, sd1i = sd1i_bp, n1i = n1i_bp,
              m2i = m2i_bp, sd2i = sd2i_bp, n2i = n2i_bp)

re3 <- rma(yi, vi, data = es3, method = "DL")
fe3 <- rma(yi, vi, data = es3, method = "FE")

message("  RE MD = ", round(re3$beta, 6), " (SE = ", round(re3$se, 6), ")")
message("  FE MD = ", round(fe3$beta, 6), " (SE = ", round(fe3$se, 6), ")")
message("  tau2 = ", round(re3$tau2, 6), ", I2 = ", round(re3$I2, 2), "%")

scenario3 <- extract_results(es3, re3, fe3, "MD", 6)

# =============================================================================
# Scenario 4: Standardized Mean Difference (Hedges' g) with blood pressure data
# =============================================================================

message("\n--- Scenario 4: SMD (Hedges' g) with blood pressure data ---")

es4 <- escalc(measure = "SMD",
              m1i = m1i_bp, sd1i = sd1i_bp, n1i = n1i_bp,
              m2i = m2i_bp, sd2i = sd2i_bp, n2i = n2i_bp)

re4 <- rma(yi, vi, data = es4, method = "DL")
fe4 <- rma(yi, vi, data = es4, method = "FE")

message("  RE SMD = ", round(re4$beta, 6), " (SE = ", round(re4$se, 6), ")")
message("  FE SMD = ", round(fe4$beta, 6), " (SE = ", round(fe4$se, 6), ")")
message("  tau2 = ", round(re4$tau2, 6), ", I2 = ", round(re4$I2, 2), "%")

scenario4 <- extract_results(es4, re4, fe4, "SMD", 6)

# =============================================================================
# Scenario 5: OR with high heterogeneity (5 studies)
# =============================================================================

message("\n--- Scenario 5: OR with high heterogeneity ---")

ai_hh <- c(5, 30, 20, 40, 3)
n1i_hh <- c(100, 100, 200, 80, 150)
ci_hh <- c(10, 15, 25, 20, 10)
n2i_hh <- c(100, 100, 200, 80, 150)
bi_hh <- n1i_hh - ai_hh
di_hh <- n2i_hh - ci_hh

es5 <- escalc(measure = "OR",
              ai = ai_hh, bi = bi_hh,
              ci = ci_hh, di = di_hh)

re5 <- rma(yi, vi, data = es5, method = "DL")
fe5 <- rma(yi, vi, data = es5, method = "FE")

message("  RE log(OR) = ", round(re5$beta, 6), " (SE = ", round(re5$se, 6), ")")
message("  FE log(OR) = ", round(fe5$beta, 6), " (SE = ", round(fe5$se, 6), ")")
message("  tau2 = ", round(re5$tau2, 6), ", I2 = ", round(re5$I2, 2), "%")

scenario5 <- extract_results(es5, re5, fe5, "OR", 5)

# =============================================================================
# Assemble and write output
# =============================================================================

output <- list(
  meta = list(
    generator      = "validate-metafor.R",
    metafor_version = as.character(packageVersion("metafor")),
    r_version      = R.version.string,
    generated_at   = format(Sys.time(), "%Y-%m-%dT%H:%M:%S%z"),
    description    = "Gold-standard reference values from R metafor for MetaReview cross-validation"
  ),
  scenario_1_or_aspirin  = scenario1,
  scenario_2_rr_aspirin  = scenario2,
  scenario_3_md_bp       = scenario3,
  scenario_4_smd_bp      = scenario4,
  scenario_5_or_high_het = scenario5
)

# Write JSON output
output_path <- file.path(dirname(sys.frame(1)$ofile %||% "."), "metafor-reference.json")

# Determine output path robustly (works whether run via Rscript or source)
script_dir <- tryCatch({
  dirname(sys.frame(1)$ofile)
}, error = function(e) {
  # Fallback: check command args for --file
  args <- commandArgs(trailingOnly = FALSE)
  file_arg <- grep("^--file=", args, value = TRUE)
  if (length(file_arg) > 0) {
    dirname(sub("^--file=", "", file_arg))
  } else {
    "."
  }
})

output_file <- file.path(script_dir, "metafor-reference.json")
json_output <- toJSON(output, pretty = TRUE, auto_unbox = TRUE, digits = 15)
writeLines(json_output, output_file)

message("\n=== Results written to: ", normalizePath(output_file, mustWork = FALSE), " ===")

# Also print to stdout for verification
cat(json_output)
cat("\n")
