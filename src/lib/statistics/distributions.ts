// Statistical distribution functions (pure JS, no dependencies)

const SQRT2PI = Math.sqrt(2 * Math.PI);

/** Standard normal PDF */
export function normalPdf(x: number): number {
  return Math.exp(-0.5 * x * x) / SQRT2PI;
}

/** Standard normal CDF (Abramowitz & Stegun approximation, max error 7.5e-8) */
export function normalCdf(x: number): number {
  if (x < -8) return 0;
  if (x > 8) return 1;

  const negative = x < 0;
  if (negative) x = -x;

  const t = 1 / (1 + 0.2316419 * x);
  const d = normalPdf(x);
  const p =
    d *
    t *
    (0.319381530 +
      t *
        (-0.356563782 +
          t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));

  return negative ? p : 1 - p;
}

/** Two-tailed p-value from z-score */
export function zToP(z: number): number {
  return 2 * (1 - normalCdf(Math.abs(z)));
}

/** Inverse normal CDF (rational approximation, Beasley-Springer-Moro) */
export function normalQuantile(p: number): number {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  if (p === 0.5) return 0;

  const a = [
    -3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2,
    1.383577518672690e2, -3.066479806614716e1, 2.506628277459239e0,
  ];
  const b = [
    -5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2,
    6.680131188771972e1, -1.328068155288572e1,
  ];
  const c = [
    -7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838,
    -2.549732539343734, 4.374664141464968, 2.938163982698783,
  ];
  const d = [
    7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996,
    3.754408661907416,
  ];

  const pLow = 0.02425;
  const pHigh = 1 - pLow;

  let q: number;
  if (p < pLow) {
    q = Math.sqrt(-2 * Math.log(p));
    return (
      (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    );
  } else if (p <= pHigh) {
    q = p - 0.5;
    const r = q * q;
    return (
      ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) *
        q) /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
    );
  } else {
    q = Math.sqrt(-2 * Math.log(1 - p));
    return (
      -(
        (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
        ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
      )
    );
  }
}

/** Chi-squared CDF using regularized gamma function */
export function chiSquaredCdf(x: number, df: number): number {
  if (x <= 0) return 0;
  return regularizedGammaP(df / 2, x / 2);
}

/** Chi-squared p-value (upper tail) */
export function chiSquaredPValue(x: number, df: number): number {
  return Math.max(0, 1 - chiSquaredCdf(x, df));
}

/** t-distribution CDF using incomplete beta function */
export function tCdf(t: number, df: number): number {
  const x = df / (df + t * t);
  const p = 0.5 * incompleteBeta(x, df / 2, 0.5);
  return t >= 0 ? 1 - p : p;
}

/** Two-tailed t-test p-value */
export function tToP(t: number, df: number): number {
  return 2 * (1 - tCdf(Math.abs(t), df));
}

/** Inverse t-distribution CDF (quantile function via bisection + Newton refinement)
 *  Returns t such that P(T <= t) = p for a t-distribution with df degrees of freedom.
 */
export function tQuantile(p: number, df: number): number {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  if (p === 0.5) return 0;

  // Use normal quantile as starting point for large df
  if (df > 1000) return normalQuantile(p);

  // Bisection method with tight convergence
  let lo = -20;
  let hi = 20;

  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    const cdf = tCdf(mid, df);
    if (Math.abs(cdf - p) < 1e-12) return mid;
    if (cdf < p) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

// --- Helper functions ---

/** Log-gamma function (Lanczos approximation) */
function logGamma(x: number): number {
  const g = 7;
  const coef = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];

  if (x < 0.5) {
    return (
      Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x)
    );
  }

  x -= 1;
  let sum = coef[0];
  for (let i = 1; i < g + 2; i++) {
    sum += coef[i] / (x + i);
  }
  const t = x + g + 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(sum);
}

/** Regularized incomplete gamma function P(a, x) via series expansion */
function regularizedGammaP(a: number, x: number): number {
  if (x < 0) return 0;
  if (x === 0) return 0;

  const lnA = logGamma(a);

  // Use series for x < a+1, continued fraction otherwise
  if (x < a + 1) {
    return gammaPSeries(a, x, lnA);
  } else {
    return 1 - gammaPContinuedFraction(a, x, lnA);
  }
}

function gammaPSeries(a: number, x: number, lnA: number): number {
  let sum = 1 / a;
  let term = sum;
  for (let n = 1; n < 200; n++) {
    term *= x / (a + n);
    sum += term;
    if (Math.abs(term) < Math.abs(sum) * 1e-14) break;
  }
  return sum * Math.exp(-x + a * Math.log(x) - lnA);
}

function gammaPContinuedFraction(a: number, x: number, lnA: number): number {
  // Legendre continued fraction for Q(a,x) = Gamma(a,x)/Gamma(a)
  // Q(a,x) = e^{-x} * x^a / Gamma(a) * CF
  // CF = 1/(x+1-a- 1*(1-a)/(x+3-a- 2*(2-a)/(x+5-a- ...)))
  // Using modified Lentz's method
  let b = x + 1 - a;
  let c = 1e30;
  let d = 1 / b;
  let f = d;

  for (let i = 1; i <= 200; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    c = b + an / c;
    if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d;
    const delta = d * c;
    f *= delta;
    if (Math.abs(delta - 1) < 1e-10) break;
  }

  return f * Math.exp(-x + a * Math.log(x) - lnA);
}

/** Incomplete beta function via continued fraction (Lentz's method) */
function incompleteBeta(x: number, a: number, b: number): number {
  if (x === 0 || x === 1) return x;

  const lnBeta = logGamma(a) + logGamma(b) - logGamma(a + b);
  const front = Math.exp(
    Math.log(x) * a + Math.log(1 - x) * b - lnBeta
  ) / a;

  // Lentz's continued fraction
  let f = 1;
  let c = 1;
  let d = 1 - ((a + b) * x) / (a + 1);
  if (Math.abs(d) < 1e-30) d = 1e-30;
  d = 1 / d;
  f = d;

  for (let m = 1; m <= 200; m++) {
    // Even step
    let numerator =
      (m * (b - m) * x) / ((a + 2 * m - 1) * (a + 2 * m));
    d = 1 + numerator * d;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    c = 1 + numerator / c;
    if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d;
    f *= c * d;

    // Odd step
    numerator =
      -(((a + m) * (a + b + m) * x) / ((a + 2 * m) * (a + 2 * m + 1)));
    d = 1 + numerator * d;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    c = 1 + numerator / c;
    if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d;
    const delta = c * d;
    f *= delta;

    if (Math.abs(delta - 1) < 1e-10) break;
  }

  return front * f;
}
