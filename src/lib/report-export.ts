// Report export — generates a printable HTML report
import type { MetaAnalysisResult, EggersTest, BeggsTest, SubgroupAnalysisResult, SensitivityResult, PICO, MetaRegressionResult, GradeAssessment, InfluenceDiagnostic, DoseResponseResult, CumulativeResult, RobAssessments, RobJudgment, RobDomain, Study } from './types';
import type { PRISMAData } from '../components/PRISMAFlow';
import type { TrimAndFillResult } from './statistics/publication-bias';
import { calculateNNT } from './statistics/nnt';

export interface ReportSections {
  pico: boolean;
  prisma: boolean;
  overall: boolean;
  interpretation: boolean;
  studyTable: boolean;
  eggers: boolean;
  beggs: boolean;
  plots: boolean;
  galbraith: boolean;
  labbe: boolean;
  subgroup: boolean;
  sensitivity: boolean;
  metaReg: boolean;
  baujat: boolean;
  influence: boolean;
  loo: boolean;
  network: boolean;
  grade: boolean;
  rob: boolean;
  contourFunnel: boolean;
  cumulative: boolean;
  doseResponse: boolean;
  methods: boolean;
  narrative: boolean;
}

export const defaultReportSections: ReportSections = {
  pico: true,
  prisma: true,
  overall: true,
  interpretation: true,
  studyTable: true,
  eggers: true,
  beggs: true,
  plots: true,
  galbraith: true,
  labbe: true,
  subgroup: true,
  sensitivity: true,
  metaReg: true,
  baujat: true,
  influence: true,
  loo: true,
  network: true,
  grade: true,
  rob: true,
  contourFunnel: true,
  cumulative: true,
  doseResponse: true,
  methods: true,
  narrative: true,
};

interface ReportData {
  title: string;
  pico: PICO;
  result: MetaAnalysisResult;
  eggers: EggersTest | null;
  beggs?: BeggsTest | null;
  subgroupResult: SubgroupAnalysisResult | null;
  sensitivityResults: SensitivityResult[];
  forestSvg: string | null;
  funnelSvg: string | null;
  galbraithSvg?: string | null;
  trimFillResult?: TrimAndFillResult | null;
  metaRegression?: MetaRegressionResult | null;
  metaRegSvg?: string | null;
  labbeSvg?: string | null;
  baujatSvg?: string | null;
  looSvg?: string | null;
  networkSvg?: string | null;
  influenceDiagnostics?: InfluenceDiagnostic[];
  gradeAssessment?: GradeAssessment | null;
  robAssessments?: RobAssessments;
  studies?: Study[];
  doseResponseResult?: DoseResponseResult | null;
  doseResponseSvg?: string | null;
  cumulativeResults?: CumulativeResult[];
  contourFunnelSvg?: string | null;
  cumulativeSvg?: string | null;
  prisma?: PRISMAData;
  sections?: ReportSections;
}

const formatP = (p: number) => (p < 0.001 ? '&lt; 0.001' : p.toFixed(3));

function picoSection(pico: PICO): string {
  if (!pico.population && !pico.intervention && !pico.comparison && !pico.outcome) return '';
  return `
    <h2>PICO Framework</h2>
    <table class="data-table">
      <tbody>
        ${pico.population ? `<tr><td class="label">Population</td><td>${esc(pico.population)}</td></tr>` : ''}
        ${pico.intervention ? `<tr><td class="label">Intervention</td><td>${esc(pico.intervention)}</td></tr>` : ''}
        ${pico.comparison ? `<tr><td class="label">Comparison</td><td>${esc(pico.comparison)}</td></tr>` : ''}
        ${pico.outcome ? `<tr><td class="label">Outcome</td><td>${esc(pico.outcome)}</td></tr>` : ''}
      </tbody>
    </table>`;
}

function overallSection(r: MetaAnalysisResult): string {
  const het = r.heterogeneity;
  return `
    <h2>Overall Effect</h2>
    <table class="data-table">
      <tbody>
        <tr><td class="label">Model</td><td>${r.model === 'random' ? 'Random Effects (DerSimonian-Laird)' : 'Fixed Effects (Inverse Variance)'}</td></tr>
        <tr><td class="label">Effect measure</td><td>${r.measure}</td></tr>
        <tr><td class="label">Number of studies</td><td>${r.studies.length}</td></tr>
        <tr><td class="label">Pooled ${r.measure}</td><td>${r.effect.toFixed(4)}</td></tr>
        <tr><td class="label">95% CI</td><td>[${r.ciLower.toFixed(4)}, ${r.ciUpper.toFixed(4)}]</td></tr>
        <tr><td class="label">Z</td><td>${r.z.toFixed(4)}</td></tr>
        <tr><td class="label">P-value</td><td class="${r.pValue < 0.05 ? 'sig' : ''}">${formatP(r.pValue)}</td></tr>
        ${r.predictionInterval ? `<tr><td class="label">95% Prediction Interval</td><td>[${r.predictionInterval.lower.toFixed(4)}, ${r.predictionInterval.upper.toFixed(4)}]</td></tr>` : ''}
      </tbody>
    </table>
    ${r.predictionInterval ? `<p class="note">Prediction interval indicates the range of true effects expected in a new study (Riley et al., 2011). It incorporates both sampling error and between-study heterogeneity (&tau;&sup2;).</p>` : ''}
    <h2>Heterogeneity</h2>
    <table class="data-table">
      <tbody>
        <tr><td class="label">Cochran's Q</td><td>${het.Q.toFixed(2)} (df = ${het.df})</td></tr>
        <tr><td class="label">P-value (Q)</td><td class="${het.pValue < 0.1 ? 'sig' : ''}">${formatP(het.pValue)}</td></tr>
        <tr><td class="label">I&sup2;</td><td>${het.I2.toFixed(1)}%</td></tr>
        <tr><td class="label">&tau;&sup2;</td><td>${het.tau2.toFixed(4)}</td></tr>
        <tr><td class="label">&tau;</td><td>${het.tau.toFixed(4)}</td></tr>
        <tr><td class="label">H&sup2;</td><td>${het.H2.toFixed(2)}</td></tr>
      </tbody>
    </table>`;
}

function interpretationSection(r: MetaAnalysisResult): string {
  const isRatio = r.measure === 'OR' || r.measure === 'RR' || r.measure === 'HR';
  const nullVal = isRatio ? 1 : 0;

  // Direction
  let direction: string;
  if (isRatio) {
    if (Math.abs(r.effect - 1) < 0.0001) direction = `No difference (${r.measure} = 1)`;
    else if (r.effect < 1) direction = `Favours treatment (${r.measure} &lt; 1)`;
    else direction = `Favours control (${r.measure} &gt; 1)`;
  } else {
    if (Math.abs(r.effect) < 0.0001) direction = `No difference (${r.measure} = 0)`;
    else if (r.effect < 0) direction = `Favours treatment (${r.measure} &lt; 0)`;
    else direction = `Favours control (${r.measure} &gt; 0)`;
  }

  // Magnitude
  let magnitude = '';
  if (isRatio) {
    const logE = Math.abs(Math.log(r.effect));
    if (logE < 0.223) magnitude = 'Small effect';
    else if (logE < 0.693) magnitude = 'Moderate effect';
    else magnitude = 'Large effect';
  } else if (r.measure === 'SMD') {
    const absD = Math.abs(r.effect);
    if (absD < 0.5) magnitude = 'Small effect (Cohen\'s d &lt; 0.5)';
    else if (absD < 0.8) magnitude = 'Medium effect (0.5 &le; d &lt; 0.8)';
    else magnitude = 'Large effect (d &ge; 0.8)';
  }

  const ciCrossesNull = isRatio
    ? (r.ciLower <= nullVal && r.ciUpper >= nullVal)
    : (r.ciLower <= nullVal && r.ciUpper >= nullVal);

  return `
    <h2>Clinical Interpretation</h2>
    <table class="data-table">
      <tbody>
        <tr><td class="label">Effect Direction</td><td>${direction}</td></tr>
        ${magnitude ? `<tr><td class="label">Effect Magnitude</td><td>${magnitude}</td></tr>` : ''}
        <tr><td class="label">Statistical Significance</td><td class="${r.pValue < 0.05 ? 'sig' : ''}">${r.pValue < 0.05 ? 'Significant (P &lt; 0.05)' : 'Not significant (P &ge; 0.05)'}</td></tr>
        <tr><td class="label">95% CI</td><td>${ciCrossesNull ? 'Crosses the null line' : 'Does not include the null value'}</td></tr>
      </tbody>
    </table>
    <p class="note">Note: Clinical significance depends on context. Statistical significance &ne; clinical importance.</p>`;
}

function nntSection(r: MetaAnalysisResult, studies: Study[]): string {
  const nnt = calculateNNT(r, studies);
  if (!nnt) return '';

  const label = nnt.isHarm ? 'Number Needed to Harm (NNH)' : 'Number Needed to Treat (NNT)';
  const nntRounded = Math.ceil(nnt.nnt);
  const ciCrossesNull = !isFinite(nnt.nntCIUpper);
  const ciLower = Math.ceil(nnt.nntCILower);
  const ciStr = ciCrossesNull ? `[${ciLower}, &infin;]` : `[${ciLower}, ${Math.ceil(nnt.nntCIUpper)}]`;
  const interp = nnt.isHarm
    ? `For every ${nntRounded} patients treated, 1 additional harm event occurs.`
    : `For every ${nntRounded} patients treated, 1 event is prevented.`;

  return `
    <h2>Clinical Significance (NNT/NNH)</h2>
    <table class="data-table">
      <tbody>
        <tr><td class="label">${label}</td><td class="sig">${nntRounded}</td></tr>
        <tr><td class="label">95% CI</td><td>${ciStr}</td></tr>
        <tr><td class="label">Absolute Risk Difference</td><td>${(nnt.absoluteRiskDifference * 100).toFixed(2)}%</td></tr>
        <tr><td class="label">Control Event Rate</td><td>${(nnt.controlEventRate * 100).toFixed(2)}%</td></tr>
        <tr><td class="label">Experimental Event Rate</td><td>${(nnt.experimentalEventRate * 100).toFixed(2)}%</td></tr>
      </tbody>
    </table>
    <p class="note">${esc(interp)}</p>
    ${ciCrossesNull ? '<p class="note">Note: 95% CI crosses the null — NNT confidence interval is discontinuous.</p>' : ''}
    <p class="note">Based on pooled effect and weighted average control event rate across studies.</p>`;
}

function studyTable(r: MetaAnalysisResult): string {
  const model = r.model;
  return `
    <h2>Individual Study Results</h2>
    <table class="full-table">
      <thead>
        <tr>
          <th>Study</th>
          <th>${r.measure}</th>
          <th>95% CI</th>
          <th>Weight (%)</th>
        </tr>
      </thead>
      <tbody>
        ${r.studies.map(s => {
          const w = model === 'random' ? s.weightRandom : s.weightFixed;
          const totalW = r.studies.reduce((sum, st) => sum + (model === 'random' ? st.weightRandom : st.weightFixed), 0);
          return `<tr>
            <td>${esc(s.name)}${s.year ? ` (${s.year})` : ''}</td>
            <td>${s.effect.toFixed(4)}</td>
            <td>[${s.ciLower.toFixed(4)}, ${s.ciUpper.toFixed(4)}]</td>
            <td>${((w / totalW) * 100).toFixed(1)}%</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>`;
}

function eggersSection(eggers: EggersTest): string {
  return `
    <h2>Publication Bias (Egger's Test)</h2>
    <table class="data-table">
      <tbody>
        <tr><td class="label">Intercept</td><td>${eggers.intercept.toFixed(4)}</td></tr>
        <tr><td class="label">SE</td><td>${eggers.se.toFixed(4)}</td></tr>
        <tr><td class="label">t-value</td><td>${eggers.tValue.toFixed(4)}</td></tr>
        <tr><td class="label">P-value</td><td class="${eggers.pValue < 0.05 ? 'sig' : ''}">${formatP(eggers.pValue)}</td></tr>
        <tr><td class="label">df</td><td>${eggers.df}</td></tr>
      </tbody>
    </table>
    <p class="note">${eggers.pValue < 0.05 ? 'Significant asymmetry detected — potential publication bias.' : 'No significant funnel plot asymmetry detected.'}</p>`;
}

function beggsSection(beggs: BeggsTest): string {
  return `
    <h2>Publication Bias (Begg's Test)</h2>
    <table class="data-table">
      <tbody>
        <tr><td class="label">Kendall's &tau;</td><td>${beggs.tau.toFixed(4)}</td></tr>
        <tr><td class="label">Z</td><td>${beggs.z.toFixed(4)}</td></tr>
        <tr><td class="label">P-value</td><td class="${beggs.pValue < 0.05 ? 'sig' : ''}">${formatP(beggs.pValue)}</td></tr>
        <tr><td class="label">k</td><td>${beggs.k}</td></tr>
      </tbody>
    </table>
    <p class="note">${beggs.pValue < 0.05 ? 'Significant rank correlation detected &mdash; potential publication bias.' : 'No significant rank correlation detected (no evidence of publication bias).'}</p>`;
}

function metaRegressionSection(mr: MetaRegressionResult): string {
  return `
    <h2>Meta-Regression Analysis</h2>
    <table class="data-table">
      <tbody>
        <tr><td class="label">Covariate</td><td>${esc(mr.covariate)} (k = ${mr.k})</td></tr>
        <tr><td class="label">Coefficient</td><td>${mr.coefficient.toFixed(4)} (SE = ${mr.se.toFixed(4)})</td></tr>
        <tr><td class="label">Z</td><td>${mr.z.toFixed(4)}</td></tr>
        <tr><td class="label">P-value</td><td class="${mr.pValue < 0.05 ? 'sig' : ''}">${formatP(mr.pValue)}</td></tr>
        <tr><td class="label">Intercept</td><td>${mr.intercept.toFixed(4)}</td></tr>
        <tr><td class="label">Q<sub>model</sub></td><td>${mr.QModel.toFixed(2)} (p = ${formatP(mr.QModelP)})</td></tr>
        <tr><td class="label">Q<sub>residual</sub></td><td>${mr.QResidual.toFixed(2)} (df = ${mr.QResidualDf}, p = ${formatP(mr.QResidualP)})</td></tr>
        <tr><td class="label">R&sup2;</td><td>${(mr.R2 * 100).toFixed(1)}%</td></tr>
      </tbody>
    </table>
    <p class="note">${mr.pValue < 0.05 ? 'The covariate significantly moderates the effect size (P &lt; 0.05).' : 'The covariate does not significantly moderate the effect size (P &ge; 0.05).'}</p>`;
}

function subgroupSection(sg: SubgroupAnalysisResult, measure: string): string {
  return `
    <h2>Subgroup Analysis</h2>
    <table class="full-table">
      <thead>
        <tr><th>Subgroup</th><th>k</th><th>${measure} [95% CI]</th><th>I&sup2;</th><th>p</th></tr>
      </thead>
      <tbody>
        ${sg.subgroups.map(s => `<tr>
          <td>${esc(s.name || 'Ungrouped')}</td>
          <td>${s.result.studies.length}</td>
          <td>${s.result.effect.toFixed(2)} [${s.result.ciLower.toFixed(2)}, ${s.result.ciUpper.toFixed(2)}]</td>
          <td>${s.result.heterogeneity.I2.toFixed(1)}%</td>
          <td>${formatP(s.result.pValue)}</td>
        </tr>`).join('')}
      </tbody>
    </table>
    <div class="callout ${sg.test.pValue < 0.05 ? 'callout-red' : 'callout-green'}">
      <strong>Test for Subgroup Differences:</strong>
      Q = ${sg.test.Q.toFixed(2)}, df = ${sg.test.df}, p = ${formatP(sg.test.pValue)}
      <br>${sg.test.pValue < 0.05 ? 'Significant difference between subgroups.' : 'No significant difference between subgroups.'}
    </div>`;
}

function sensitivitySection(results: SensitivityResult[], full: MetaAnalysisResult): string {
  if (results.length === 0) return '';
  return `
    <h2>Sensitivity Analysis (Leave-One-Out)</h2>
    <table class="full-table">
      <thead>
        <tr><th>Omitted Study</th><th>${full.measure} [95% CI]</th><th>I&sup2;</th></tr>
      </thead>
      <tbody>
        ${results.map(r => {
          const dirChanged = (r.effect > 1) !== (full.effect > 1) && (full.measure === 'OR' || full.measure === 'RR' || full.measure === 'HR');
          const sigChanged = (r.ciLower > 1 || r.ciUpper < 1) !== (full.ciLower > 1 || full.ciUpper < 1);
          const highlight = dirChanged || sigChanged;
          return `<tr${highlight ? ' class="highlight"' : ''}>
            <td>${esc(r.omittedStudy)}${highlight ? ' *' : ''}</td>
            <td>${r.effect.toFixed(4)} [${r.ciLower.toFixed(4)}, ${r.ciUpper.toFixed(4)}]</td>
            <td>${r.I2.toFixed(1)}%</td>
          </tr>`;
        }).join('')}
        <tr class="overall-row">
          <td><strong>Full model</strong></td>
          <td><strong>${full.effect.toFixed(4)} [${full.ciLower.toFixed(4)}, ${full.ciUpper.toFixed(4)}]</strong></td>
          <td><strong>${full.heterogeneity.I2.toFixed(1)}%</strong></td>
        </tr>
      </tbody>
    </table>
    <p class="note">* Removing this study changes the direction or statistical significance of the pooled result.</p>`;
}

function methodsSection(r: MetaAnalysisResult, pico: PICO, eggers: EggersTest | null, sg: SubgroupAnalysisResult | null, sensitivity: SensitivityResult[]): string {
  const k = r.studies.length;
  const parts: string[] = [];

  parts.push('A systematic review and meta-analysis was conducted following the PRISMA 2020 guidelines.');

  if (pico.population || pico.intervention || pico.comparison || pico.outcome) {
    const picoDesc = [
      pico.intervention && pico.comparison
        ? `the ${r.measure === 'OR' || r.measure === 'RR' || r.measure === 'HR' ? 'association between' : 'effect of'} ${esc(pico.intervention)} ${r.measure === 'OR' || r.measure === 'RR' || r.measure === 'HR' ? 'and' : 'compared with'} ${esc(pico.comparison)}`
        : null,
      pico.outcome ? `on ${esc(pico.outcome)}` : null,
      pico.population ? `in ${esc(pico.population)}` : null,
    ].filter(Boolean).join(' ');
    if (picoDesc) parts.push(`The aim was to evaluate ${picoDesc}.`);
  }

  const modelName = r.model === 'random' ? 'random-effects' : 'fixed-effect';
  const estimator = r.model === 'random' ? 'DerSimonian-Laird' : 'inverse variance';
  const measureFull: Record<string, string> = { OR: 'odds ratios (ORs)', RR: 'risk ratios (RRs)', HR: 'hazard ratios (HRs)', MD: 'mean differences (MDs)', SMD: 'standardized mean differences (SMDs)' };
  parts.push(`A ${modelName} model with the ${estimator} estimator was used to pool effect sizes across ${k} studies. Results were expressed as ${measureFull[r.measure] || r.measure} with 95% confidence intervals (CIs).`);

  parts.push("Statistical heterogeneity was assessed using Cochran's Q test and quantified with the I&sup2; statistic, where I&sup2; values of 25%, 50%, and 75% were interpreted as low, moderate, and high heterogeneity, respectively (Higgins et al., 2003).");

  if (eggers) {
    parts.push("Publication bias was evaluated by visual inspection of funnel plot asymmetry and formally tested using Egger's linear regression test and Begg's rank correlation test.");
  }
  if (sensitivity.length > 0) {
    parts.push('Sensitivity analysis was performed using the leave-one-out method, whereby each study was sequentially removed to assess its influence on the pooled estimate.');
  }
  if (sg && sg.subgroups.length > 1) {
    parts.push('Subgroup analysis was conducted to explore potential sources of heterogeneity, and the test for subgroup differences (Q-between) was used to evaluate effect modification.');
  }

  parts.push('All analyses were performed using MetaReview (metareview.cc), an open-source online meta-analysis platform. A two-sided P value &lt; 0.05 was considered statistically significant.');

  return `
    <h2>Methods Paragraph (for manuscript)</h2>
    <div class="narrative">${parts.join(' ')}</div>`;
}

function narrativeSection(r: MetaAnalysisResult, eggers: EggersTest | null, sg: SubgroupAnalysisResult | null, sensitivity: SensitivityResult[], beggs?: BeggsTest | null, metaReg?: MetaRegressionResult | null, grade?: GradeAssessment | null, doseResponse?: DoseResponseResult | null, trimFill?: TrimAndFillResult | null, influenceData?: InfluenceDiagnostic[]): string {
  const het = r.heterogeneity;
  const k = r.studies.length;
  let text = `A ${r.model === 'random' ? 'random-effects' : 'fixed-effect'} meta-analysis of ${k} studies was performed using the ${r.model === 'random' ? 'DerSimonian-Laird' : 'inverse variance'} method. The pooled ${r.measure} was ${r.effect.toFixed(2)} (95% CI: ${r.ciLower.toFixed(2)}&ndash;${r.ciUpper.toFixed(2)}; Z = ${r.z.toFixed(2)}, P ${r.pValue < 0.001 ? '&lt; 0.001' : `= ${r.pValue.toFixed(3)}`}), ${r.pValue < 0.05 ? 'indicating a statistically significant effect' : 'showing no statistically significant effect'}. `;
  text += `Heterogeneity was ${het.I2 < 25 ? 'low' : het.I2 < 50 ? 'moderate' : het.I2 < 75 ? 'substantial' : 'considerable'} (I&sup2; = ${het.I2.toFixed(1)}%, Q = ${het.Q.toFixed(2)}, df = ${het.df}, P ${het.pValue < 0.001 ? '&lt; 0.001' : `= ${het.pValue.toFixed(3)}`}; &tau;&sup2; = ${het.tau2.toFixed(4)}).`;
  if (r.predictionInterval) {
    text += ` The 95% prediction interval was ${r.predictionInterval.lower.toFixed(2)}&ndash;${r.predictionInterval.upper.toFixed(2)}, indicating the range of true effects expected in a new study (Riley et al., 2011).`;
  }
  if (eggers) {
    text += ` Egger's regression test ${eggers.pValue < 0.05 ? 'indicated significant' : 'did not indicate'} funnel plot asymmetry (intercept = ${eggers.intercept.toFixed(2)}, P = ${formatP(eggers.pValue)}).`;
  }
  if (beggs) {
    text += ` Begg's rank correlation test ${beggs.pValue < 0.05 ? 'revealed significant' : 'showed no significant'} evidence of publication bias (Kendall's &tau; = ${beggs.tau.toFixed(3)}, P = ${formatP(beggs.pValue)}).`;
  }
  if (trimFill && trimFill.k0 > 0) {
    text += ` Trim-and-Fill analysis (Duval &amp; Tweedie, 2000) estimated ${trimFill.k0} missing ${trimFill.k0 === 1 ? 'study' : 'studies'} on the ${trimFill.side} side; the adjusted ${r.measure} was ${trimFill.adjustedEffect.toFixed(2)} (95% CI: ${trimFill.adjustedCILower.toFixed(2)}&ndash;${trimFill.adjustedCIUpper.toFixed(2)}).`;
  } else if (trimFill && trimFill.k0 === 0) {
    text += ` Trim-and-Fill analysis detected no funnel plot asymmetry requiring imputation.`;
  }
  if (sensitivity.length > 0) {
    const isRatio = r.measure === 'OR' || r.measure === 'RR' || r.measure === 'HR';
    const influential = sensitivity.filter(s => {
      const dirChanged = isRatio ? (s.effect > 1) !== (r.effect > 1) : (s.effect > 0) !== (r.effect > 0);
      const origSig = isRatio ? (r.ciLower > 1 || r.ciUpper < 1) : (r.ciLower > 0 || r.ciUpper < 0);
      const newSig = isRatio ? (s.ciLower > 1 || s.ciUpper < 1) : (s.ciLower > 0 || s.ciUpper < 0);
      return dirChanged || origSig !== newSig;
    });
    if (influential.length === 0) {
      text += ` Leave-one-out sensitivity analysis showed that the pooled estimate was robust; no single study substantially altered the overall result.`;
    } else {
      text += ` Leave-one-out sensitivity analysis identified ${influential.length} influential ${influential.length === 1 ? 'study' : 'studies'} (${influential.map(s => esc(s.omittedStudy)).join(', ')}) whose removal altered the direction or statistical significance of the pooled estimate.`;
    }
  }
  if (influenceData && influenceData.length > 0) {
    const cooksThreshold = 4 / influenceData.length;
    const hatThreshold = 2 / influenceData.length;
    const flagged = influenceData.filter(d => d.cooksDistance > cooksThreshold || d.hat > hatThreshold || Math.abs(d.rstudent) > 2);
    if (flagged.length > 0) {
      text += ` Influence diagnostics (Viechtbauer &amp; Cheung, 2010) flagged ${flagged.length} ${flagged.length === 1 ? 'study' : 'studies'} (${flagged.map(d => esc(d.name)).join(', ')}) as potentially influential based on Cook's distance (&gt; ${cooksThreshold.toFixed(3)}), leverage (&gt; ${hatThreshold.toFixed(3)}), or studentized residuals (&gt; 2).`;
    } else {
      text += ` Influence diagnostics revealed no individually influential studies.`;
    }
  }
  if (sg && sg.subgroups.length > 1) {
    const sgEffects = sg.subgroups.map(s =>
      `${s.name || 'Ungrouped'} (${r.measure} = ${s.result.effect.toFixed(2)}, 95% CI: ${s.result.ciLower.toFixed(2)}&ndash;${s.result.ciUpper.toFixed(2)}, k = ${s.result.studies.length})`
    );
    const testSig = sg.test.pValue < 0.05;
    text += ` Subgroup analysis by ${sg.subgroups.map(s => s.name || 'Ungrouped').join(' vs ')} revealed ${sgEffects.join('; ')}. The test for subgroup differences ${testSig ? 'was statistically significant' : 'was not statistically significant'} (Q = ${sg.test.Q.toFixed(2)}, df = ${sg.test.df}, P ${sg.test.pValue < 0.001 ? '&lt; 0.001' : `= ${sg.test.pValue.toFixed(3)}`})${testSig ? ', suggesting effect modification across subgroups' : ', indicating no significant effect modification'}.`;
  }
  if (metaReg) {
    text += ` Meta-regression analysis using ${esc(metaReg.covariate)} as the covariate (k = ${metaReg.k}) ${metaReg.pValue < 0.05 ? 'identified a significant moderating effect' : 'did not identify a significant moderating effect'} (coefficient = ${metaReg.coefficient.toFixed(4)}, P = ${formatP(metaReg.pValue)}; R&sup2; = ${(metaReg.R2 * 100).toFixed(1)}%).`;
  }
  if (grade) {
    const levelLabels: Record<string, string> = { high: 'high', moderate: 'moderate', low: 'low', very_low: 'very low' };
    const downgradedDomains = Object.entries(grade.factors)
      .filter(([, f]) => f.downgrade < 0)
      .map(([key]) => ({ riskOfBias: 'risk of bias', inconsistency: 'inconsistency', indirectness: 'indirectness', imprecision: 'imprecision', publicationBias: 'publication bias' }[key] || key));
    text += ` The overall quality of evidence was rated as ${levelLabels[grade.overall]} using the GRADE framework (score: ${grade.score}/4)`;
    if (downgradedDomains.length > 0) {
      text += `, downgraded for ${downgradedDomains.join(' and ')}`;
    }
    text += `.`;
  }
  if (doseResponse) {
    text += ` Dose-response meta-analysis of ${doseResponse.k} dose levels using weighted ${doseResponse.modelType} regression ${doseResponse.pLinear < 0.05 ? 'revealed a significant' : 'did not reveal a significant'} dose-response relationship (&beta;<sub>1</sub> = ${doseResponse.beta1.toFixed(4)}, P = ${formatP(doseResponse.pLinear)}; R&sup2; = ${(doseResponse.R2 * 100).toFixed(1)}%).`;
  }
  return `
    <h2>Narrative Summary (for manuscript)</h2>
    <div class="narrative">${text}</div>`;
}

function prismaDataSection(prisma: PRISMAData): string {
  const hasData = prisma.dbRecords || prisma.otherRecords || prisma.recordsScreened || prisma.quantitativeSynthesis;
  if (!hasData) return '';
  const row = (label: string, value: string) => value ? `<tr><td class="label">${label}</td><td>${esc(value)}</td></tr>` : '';
  return `
    <h2>PRISMA 2020 Flow Summary</h2>
    <table class="data-table">
      <tbody>
        ${row('Records from databases', prisma.dbRecords)}
        ${row('Records from other sources', prisma.otherRecords)}
        ${row('After duplicates removed', prisma.duplicatesRemoved)}
        ${row('Records screened', prisma.recordsScreened)}
        ${row('Records excluded', prisma.recordsExcluded)}
        ${row('Full-text articles assessed', prisma.fullTextAssessed)}
        ${row('Full-text articles excluded', prisma.fullTextExcluded)}
        ${prisma.fullTextExcludeReasons ? row('Exclusion reasons', prisma.fullTextExcludeReasons) : ''}
        ${row('Studies in qualitative synthesis', prisma.qualitativeSynthesis)}
        ${row('Studies in meta-analysis', prisma.quantitativeSynthesis)}
      </tbody>
    </table>`;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function trimFillSection(tf: TrimAndFillResult, measure: string): string {
  if (tf.k0 === 0) {
    return `
    <div class="callout callout-green">
      <strong>Trim-and-Fill (Duval &amp; Tweedie, 2000):</strong> No funnel plot asymmetry detected &mdash; no imputation needed.
    </div>`;
  }
  return `
    <div class="callout callout-red">
      <strong>Trim-and-Fill (Duval &amp; Tweedie, 2000)</strong><br>
      Estimated ${tf.k0} missing ${tf.k0 === 1 ? 'study' : 'studies'} on the ${tf.side} side.<br>
      Adjusted ${measure}: ${tf.adjustedEffect.toFixed(4)} [${tf.adjustedCILower.toFixed(4)}, ${tf.adjustedCIUpper.toFixed(4)}]
    </div>`;
}

function influenceSection(diagnostics: InfluenceDiagnostic[], measure: string): string {
  if (diagnostics.length === 0) return '';
  const k = diagnostics.length;
  const cooksThreshold = 4 / k;
  const hatThreshold = 2 / k;
  return `
    <h2>Influence Diagnostics</h2>
    <p class="note">Viechtbauer &amp; Cheung (2010). Thresholds: Cook's D &gt; ${cooksThreshold.toFixed(3)}, hat &gt; ${hatThreshold.toFixed(3)}, |rstudent| &gt; 2, |DFFITS| &gt; 1.</p>
    <table class="full-table">
      <thead>
        <tr><th>Study</th><th>${measure}</th><th>Weight</th><th>Hat</th><th>Rstudent</th><th>Cook's D</th><th>DFFITS</th><th>CovRatio</th><th>LOO ${measure}</th><th>LOO I&sup2;</th></tr>
      </thead>
      <tbody>
        ${diagnostics.map(d => {
          const isInfluential = d.cooksDistance > cooksThreshold || d.hat > hatThreshold;
          return `<tr${isInfluential ? ' class="highlight"' : ''}>
            <td>${esc(d.name)}${d.year ? ` (${d.year})` : ''}${isInfluential ? ' *' : ''}</td>
            <td>${d.effect.toFixed(4)}</td>
            <td>${d.weight.toFixed(1)}%</td>
            <td class="${d.hat > hatThreshold ? 'sig' : ''}">${d.hat.toFixed(4)}</td>
            <td class="${Math.abs(d.rstudent) > 2 ? 'sig' : ''}">${d.rstudent.toFixed(3)}</td>
            <td class="${d.cooksDistance > cooksThreshold ? 'sig' : ''}">${d.cooksDistance.toFixed(4)}</td>
            <td class="${Math.abs(d.dffits) > 1 ? 'sig' : ''}">${d.dffits.toFixed(4)}</td>
            <td>${d.covRatio.toFixed(4)}</td>
            <td>${d.leaveOneOutEffect.toFixed(4)}</td>
            <td>${d.leaveOneOutI2.toFixed(1)}%</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
    ${(() => {
      const cooksInfluential = diagnostics.filter(d => d.cooksDistance > cooksThreshold);
      const hatInfluential = diagnostics.filter(d => d.hat > hatThreshold);
      const rstudentOutliers = diagnostics.filter(d => Math.abs(d.rstudent) > 2);
      const dffitsInfluential = diagnostics.filter(d => Math.abs(d.dffits) > 1);
      const anyFlagged = cooksInfluential.length > 0 || hatInfluential.length > 0 || rstudentOutliers.length > 0 || dffitsInfluential.length > 0;
      if (!anyFlagged) {
        return `<div class="callout callout-green"><strong>No influential studies detected.</strong> All diagnostic measures are within acceptable thresholds, suggesting the pooled estimate is robust across individual study contributions.</div>`;
      }
      const parts: string[] = [];
      if (cooksInfluential.length > 0)
        parts.push(`Cook's distance flagged ${cooksInfluential.map(d => esc(d.name)).join(', ')} (threshold: ${cooksThreshold.toFixed(3)})`);
      if (hatInfluential.length > 0)
        parts.push(`high leverage (hat) in ${hatInfluential.map(d => esc(d.name)).join(', ')} (threshold: ${hatThreshold.toFixed(3)})`);
      if (rstudentOutliers.length > 0)
        parts.push(`studentized residuals exceeded &pm;2 for ${rstudentOutliers.map(d => esc(d.name)).join(', ')}`);
      if (dffitsInfluential.length > 0)
        parts.push(`|DFFITS| &gt; 1 for ${dffitsInfluential.map(d => esc(d.name)).join(', ')}`);
      return `<div class="callout callout-red"><strong>Influential studies detected:</strong> ${parts.join('; ')}. Consider conducting sensitivity analyses excluding these studies to assess robustness of the pooled estimate.</div>`;
    })()}`;
}

function gradeSection(grade: GradeAssessment): string {
  const levelLabels: Record<string, string> = { high: 'HIGH', moderate: 'MODERATE', low: 'LOW', very_low: 'VERY LOW' };
  const levelColors: Record<string, string> = { high: '#16a34a', moderate: '#ca8a04', low: '#ea580c', very_low: '#dc2626' };
  const concernLabels: Record<string, string> = { no_concern: 'No concern', serious: 'Serious', very_serious: 'Very serious' };
  const domainLabels: Record<string, string> = {
    riskOfBias: 'Risk of Bias', inconsistency: 'Inconsistency', indirectness: 'Indirectness',
    imprecision: 'Imprecision', publicationBias: 'Publication Bias',
  };

  return `
    <h2>GRADE Evidence Quality Assessment</h2>
    <div class="callout" style="background:${grade.overall === 'high' ? '#f0fdf4' : grade.overall === 'moderate' ? '#fefce8' : grade.overall === 'low' ? '#fff7ed' : '#fef2f2'};border:1px solid ${levelColors[grade.overall]}44;text-align:center;">
      <span style="display:inline-block;padding:6px 16px;background:${levelColors[grade.overall]};color:#fff;border-radius:4px;font-weight:700;font-size:14pt;letter-spacing:1px;">${levelLabels[grade.overall]}</span>
      <div style="margin-top:6px;font-size:10pt;color:#666;">Quality of Evidence (Score: ${grade.score}/4)</div>
    </div>
    <table class="full-table">
      <thead>
        <tr><th>Domain</th><th>Assessment</th><th>Downgrade</th><th>Reasoning</th></tr>
      </thead>
      <tbody>
        ${Object.entries(grade.factors).map(([key, f]) => `<tr>
          <td><strong>${domainLabels[key] || key}</strong>${f.auto ? ' <span style="font-size:9pt;color:#2563eb;background:#eff6ff;padding:1px 5px;border-radius:3px;">Auto</span>' : ''}</td>
          <td style="color:${f.level === 'very_serious' ? '#dc2626' : f.level === 'serious' ? '#ea580c' : '#16a34a'};font-weight:500;">${concernLabels[f.level]}</td>
          <td style="text-align:center;font-weight:600;color:${f.downgrade < 0 ? '#dc2626' : '#16a34a'};">${f.downgrade}</td>
          <td style="font-size:10pt;">${esc(f.reasoning)}</td>
        </tr>`).join('')}
      </tbody>
    </table>
    <p class="note">Note: Risk of bias and indirectness require manual assessment. Auto-assessed factors can be overridden in the GRADE tab.</p>`;
}

const ROB_DOMAIN_LABELS: Record<RobDomain, string> = {
  d1_randomization: 'D1: Randomization process',
  d2_deviations: 'D2: Deviations from intended interventions',
  d3_missing: 'D3: Missing outcome data',
  d4_measurement: 'D4: Measurement of the outcome',
  d5_selection: 'D5: Selection of the reported result',
};
const ROB_JUDGMENT_COLORS: Record<RobJudgment, string> = { low: '#22c55e', some_concerns: '#eab308', high: '#ef4444' };
const ROB_JUDGMENT_BG: Record<RobJudgment, string> = { low: '#dcfce7', some_concerns: '#fef9c3', high: '#fee2e2' };
const ROB_SYMBOLS: Record<RobJudgment, string> = { low: '+', some_concerns: '?', high: '\u2212' };

function robSection(robData: RobAssessments, studyList: Study[]): string {
  const domains: RobDomain[] = ['d1_randomization', 'd2_deviations', 'd3_missing', 'd4_measurement', 'd5_selection'];
  const assessed = studyList.filter(s => robData[s.id]);
  if (assessed.length === 0) return '';

  // Summary counts per domain
  const summaryRows = domains.map(d => {
    const low = assessed.filter(s => robData[s.id]?.domains[d] === 'low').length;
    const some = assessed.filter(s => robData[s.id]?.domains[d] === 'some_concerns').length;
    const high = assessed.filter(s => robData[s.id]?.domains[d] === 'high').length;
    return `<tr><td>${ROB_DOMAIN_LABELS[d]}</td><td style="text-align:center;color:#166534">${low}</td><td style="text-align:center;color:#854d0e">${some}</td><td style="text-align:center;color:#991b1b">${high}</td></tr>`;
  }).join('');

  // Traffic light table
  const headerCells = domains.map(d => `<th style="text-align:center;font-size:9pt;padding:4px 6px;">${d.split('_')[0].toUpperCase()}</th>`).join('');
  const bodyRows = assessed.map(s => {
    const a = robData[s.id]!;
    const cells = domains.map(d => {
      const j = a.domains[d];
      return `<td style="text-align:center;background:${ROB_JUDGMENT_BG[j]};color:${ROB_JUDGMENT_COLORS[j]};font-weight:700;font-size:14pt;padding:4px;">${ROB_SYMBOLS[j]}</td>`;
    }).join('');
    const ov = a.overall;
    return `<tr><td style="white-space:nowrap;font-size:10pt;">${esc(s.name)}${s.year ? ` (${s.year})` : ''}</td>${cells}<td style="text-align:center;background:${ROB_JUDGMENT_BG[ov]};color:${ROB_JUDGMENT_COLORS[ov]};font-weight:700;font-size:14pt;padding:4px;">${ROB_SYMBOLS[ov]}</td></tr>`;
  }).join('');

  return `
    <h2>Risk of Bias Assessment (Cochrane RoB 2.0)</h2>
    <p class="note">Assessed using the Cochrane Risk of Bias tool 2.0 (Sterne et al., 2019). Each study was evaluated across 5 bias domains. Overall judgment follows the worst-case domain rule.</p>
    <h3 style="font-size:11pt;margin-top:16px;">Summary of Risk of Bias Across Studies</h3>
    <table class="full-table">
      <thead><tr><th>Domain</th><th style="text-align:center">Low risk</th><th style="text-align:center">Some concerns</th><th style="text-align:center">High risk</th></tr></thead>
      <tbody>${summaryRows}</tbody>
    </table>
    <h3 style="font-size:11pt;margin-top:16px;">Traffic Light Table</h3>
    <table class="full-table">
      <thead><tr><th>Study</th>${headerCells}<th style="text-align:center;font-size:9pt;padding:4px 6px;">Overall</th></tr></thead>
      <tbody>${bodyRows}</tbody>
    </table>
    <p class="note" style="margin-top:8px;">
      <span style="display:inline-block;width:16px;height:16px;background:#dcfce7;border-radius:2px;vertical-align:middle;margin-right:3px;"></span> + Low risk
      &nbsp;&nbsp;<span style="display:inline-block;width:16px;height:16px;background:#fef9c3;border-radius:2px;vertical-align:middle;margin-right:3px;"></span> ? Some concerns
      &nbsp;&nbsp;<span style="display:inline-block;width:16px;height:16px;background:#fee2e2;border-radius:2px;vertical-align:middle;margin-right:3px;"></span> &minus; High risk
    </p>`;
}

function doseResponseSection(dr: DoseResponseResult): string {
  return `
    <h2>Dose-Response Meta-Analysis</h2>
    <table class="data-table">
      <tbody>
        <tr><td class="label">Model</td><td>Weighted ${dr.modelType === 'linear' ? 'Linear' : 'Quadratic Polynomial'} Regression (WLS)</td></tr>
        <tr><td class="label">Dose levels (k)</td><td>${dr.k}</td></tr>
        <tr><td class="label">Intercept</td><td>${dr.intercept.toFixed(4)}</td></tr>
        <tr><td class="label">&beta;<sub>1</sub> (linear)</td><td>${dr.beta1.toFixed(4)} (P = ${formatP(dr.pLinear)})</td></tr>
        ${dr.modelType === 'quadratic' ? `<tr><td class="label">&beta;<sub>2</sub> (quadratic)</td><td>${dr.beta2.toFixed(4)} (P = ${formatP(dr.pQuadratic)})</td></tr>` : ''}
        <tr><td class="label">P-value (model)</td><td class="${dr.pModel < 0.05 ? 'sig' : ''}">${formatP(dr.pModel)}</td></tr>
        <tr><td class="label">R&sup2;</td><td>${(dr.R2 * 100).toFixed(1)}%</td></tr>
      </tbody>
    </table>
    <p class="note">${dr.pLinear < 0.05 ? `A significant ${dr.modelType} dose-response relationship was detected (P ${formatP(dr.pLinear)}).` : `No significant dose-response relationship was detected (P = ${formatP(dr.pLinear)}).`}${dr.modelType === 'quadratic' && dr.pQuadratic < 0.05 ? ' The quadratic term was significant, suggesting a non-linear trend.' : ''}</p>`;
}

function cumulativeSection(results: CumulativeResult[], measure: string): string {
  if (results.length === 0) return '';
  const isRatio = measure === 'OR' || measure === 'RR' || measure === 'HR';
  const fmt = (v: number) => isRatio ? v.toFixed(2) : v.toFixed(3);
  // Stability assessment
  let stabilityNote = '';
  if (results.length >= 4) {
    const last3 = results.slice(-3);
    const baseline = last3[0].effect;
    if (baseline !== 0) {
      const stable = last3.every(r => Math.abs((r.effect - baseline) / baseline) < 0.1);
      stabilityNote = stable
        ? '<div class="callout callout-green"><strong>Stability:</strong> The pooled estimate remained stable over the last 3 steps (&lt; 10% change), suggesting a robust result.</div>'
        : '<div class="callout callout-red"><strong>Stability:</strong> The pooled estimate still fluctuated notably in recent steps, suggesting the result may not yet be fully stable.</div>';
    }
  }
  // Trend description
  const first = results[0];
  const last = results[results.length - 1];
  const trendText = `The cumulative meta-analysis progressed from ${first.studyCount} to ${last.studyCount} studies. The initial pooled ${measure} was ${fmt(first.effect)} (95% CI: ${fmt(first.ciLower)}&ndash;${fmt(first.ciUpper)}) and the final estimate was ${fmt(last.effect)} (95% CI: ${fmt(last.ciLower)}&ndash;${fmt(last.ciUpper)}; I&sup2; = ${last.I2.toFixed(1)}%).`;

  return `
    <h2>Cumulative Meta-Analysis</h2>
    <p class="note">${trendText}</p>
    ${stabilityNote}
    <table class="full-table">
      <thead>
        <tr><th>Study Added</th><th>k</th><th>${measure} [95% CI]</th><th>I&sup2;</th><th>P</th></tr>
      </thead>
      <tbody>
        ${results.map((r, i) => `<tr${i === results.length - 1 ? ' class="overall-row"' : ''}>
          <td>${esc(r.addedStudy)}${r.year ? ` (${r.year})` : ''}</td>
          <td>${r.studyCount}</td>
          <td>${fmt(r.effect)} [${fmt(r.ciLower)}, ${fmt(r.ciUpper)}]</td>
          <td>${r.I2.toFixed(1)}%</td>
          <td class="${r.pValue < 0.05 ? 'sig' : ''}">${formatP(r.pValue)}</td>
        </tr>`).join('')}
      </tbody>
    </table>`;
}

export function generateReportHTML(data: ReportData): string {
  const { title, pico, result, eggers, beggs, subgroupResult, sensitivityResults, forestSvg, funnelSvg, galbraithSvg, labbeSvg, baujatSvg, looSvg, networkSvg, trimFillResult, metaRegression, metaRegSvg, influenceDiagnostics: influenceData, gradeAssessment: gradeData, robAssessments: robData, studies: studyList, doseResponseResult: drData, doseResponseSvg: drSvg, contourFunnelSvg: contourSvg, cumulativeResults: cumResults, cumulativeSvg: cumSvg, prisma } = data;
  const s = data.sections || defaultReportSections;
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title || 'MetaReview Report')}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Times New Roman', Georgia, serif; font-size: 12pt; line-height: 1.6; color: #111; max-width: 800px; margin: 0 auto; padding: 40px 30px; }
  .brand-header { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 12px 0; margin-bottom: 16px; border-bottom: 2px solid #2563eb; }
  .brand-logo svg { display: block; }
  .brand-name { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 14pt; font-weight: 700; color: #2563eb; letter-spacing: -0.3px; }
  .brand-url { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 9pt; color: #6b7280; margin-left: 4px; }
  h1 { font-size: 18pt; text-align: center; margin-bottom: 4px; }
  .subtitle { text-align: center; font-size: 10pt; color: #666; margin-bottom: 24px; }
  h2 { font-size: 13pt; margin: 20px 0 8px; padding-bottom: 4px; border-bottom: 1px solid #ddd; }
  table { width: 100%; border-collapse: collapse; margin: 8px 0 16px; font-size: 11pt; }
  .data-table td { padding: 4px 8px; border-bottom: 1px solid #eee; }
  .data-table .label { color: #555; width: 180px; font-weight: 500; }
  .full-table th { padding: 6px 8px; text-align: left; border-bottom: 2px solid #ccc; font-size: 10pt; color: #444; }
  .full-table td { padding: 5px 8px; border-bottom: 1px solid #eee; }
  .full-table tr:nth-child(even) { background: #fafafa; }
  .full-table .highlight { background: #fff8e6; }
  .full-table .overall-row { background: #f0f7ff; }
  .sig { color: #c00; font-weight: 600; }
  .note { font-size: 10pt; color: #666; margin: 4px 0 16px; font-style: italic; }
  .callout { padding: 10px 14px; border-radius: 6px; margin: 12px 0 16px; font-size: 11pt; }
  .callout-red { background: #fef2f2; border: 1px solid #fecaca; }
  .callout-green { background: #f0fdf4; border: 1px solid #bbf7d0; }
  .narrative { background: #f9fafb; padding: 14px 18px; border-radius: 6px; border: 1px solid #e5e7eb; font-size: 11pt; line-height: 1.7; }
  .figure { text-align: center; margin: 16px 0; page-break-inside: avoid; }
  .figure svg { max-width: 100%; height: auto; }
  .figure-caption { font-size: 10pt; color: #555; margin-top: 6px; font-style: italic; }
  .footer { margin-top: 32px; padding-top: 12px; border-top: 2px solid #2563eb; font-size: 9pt; color: #6b7280; text-align: center; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
  .footer a { color: #2563eb; text-decoration: none; }
  .footer .footer-brand { font-weight: 600; color: #2563eb; font-size: 10pt; }
  @media print {
    body { padding: 20px; }
    .no-print { display: none; }
    .figure { page-break-inside: avoid; }
    table { page-break-inside: avoid; }
    h2 { page-break-after: avoid; }
  }
</style>
</head>
<body>
  <div class="no-print" style="text-align:center;margin-bottom:20px;">
    <button onclick="window.print()" style="padding:8px 20px;background:#2563eb;color:#fff;border:none;border-radius:6px;font-size:13px;cursor:pointer;">
      Print / Save as PDF
    </button>
  </div>
  <div class="brand-header">
    <div class="brand-logo">
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="2" y="16" width="4" height="8" rx="1" fill="#2563eb"/>
        <rect x="8" y="10" width="4" height="14" rx="1" fill="#3b82f6"/>
        <rect x="14" y="6" width="4" height="18" rx="1" fill="#2563eb"/>
        <rect x="20" y="12" width="4" height="12" rx="1" fill="#3b82f6"/>
        <line x1="1" y1="3" x2="26" y2="3" stroke="#2563eb" stroke-width="1.5" stroke-dasharray="2 2"/>
        <circle cx="4" cy="20" r="1.5" fill="#fff" stroke="#2563eb" stroke-width="1"/>
        <circle cx="10" cy="17" r="1.5" fill="#fff" stroke="#2563eb" stroke-width="1"/>
        <circle cx="16" cy="15" r="1.5" fill="#fff" stroke="#2563eb" stroke-width="1"/>
        <circle cx="22" cy="18" r="1.5" fill="#fff" stroke="#2563eb" stroke-width="1"/>
        <path d="M4 20 L10 17 L16 15 L22 18" stroke="#2563eb" stroke-width="1" fill="none"/>
      </svg>
    </div>
    <span class="brand-name">MetaReview</span>
    <span class="brand-url">metareview.cc</span>
  </div>
  <h1>${esc(title || 'Meta-Analysis Report')}</h1>
  <p class="subtitle">Generated by MetaReview &mdash; ${dateStr} at ${timeStr}</p>
  ${s.prisma && prisma ? prismaDataSection(prisma) : ''}
  ${s.pico ? picoSection(pico) : ''}
  ${s.overall ? overallSection(result) : ''}
  ${s.interpretation ? interpretationSection(result) : ''}
  ${s.interpretation && studyList ? nntSection(result, studyList) : ''}
  ${s.studyTable ? studyTable(result) : ''}
  ${(() => {
    let figNum = 0;
    const figs: string[] = [];
    // Core result visualization
    if (s.plots && forestSvg) figs.push(`<div class="figure">${forestSvg}<p class="figure-caption">Figure ${++figNum}. Forest plot</p></div>`);
    // Publication bias group
    if (s.plots && funnelSvg) figs.push(`<div class="figure">${funnelSvg}<p class="figure-caption">Figure ${++figNum}. Funnel plot</p></div>`);
    if (s.contourFunnel && contourSvg) figs.push(`<div class="figure">${contourSvg}<p class="figure-caption">Figure ${++figNum}. Contour-enhanced funnel plot (significance regions: p &lt; 0.01, p &lt; 0.05, p &lt; 0.10)</p></div>`);
    if (s.eggers && eggers) figs.push(eggersSection(eggers));
    if (s.beggs && beggs) figs.push(beggsSection(beggs));
    if (s.eggers && trimFillResult) figs.push(trimFillSection(trimFillResult, result.measure));
    // Heterogeneity diagnostics group
    if (s.galbraith && galbraithSvg) figs.push(`<div class="figure">${galbraithSvg}<p class="figure-caption">Figure ${++figNum}. Galbraith plot (radial plot)</p></div>`);
    if (s.baujat && baujatSvg) figs.push(`<div class="figure">${baujatSvg}<p class="figure-caption">Figure ${++figNum}. Baujat plot (contribution&ndash;influence)</p></div>`);
    if (s.influence && influenceData && influenceData.length > 0) figs.push(influenceSection(influenceData, result.measure));
    if (s.loo && looSvg) figs.push(`<div class="figure">${looSvg}<p class="figure-caption">Figure ${++figNum}. Leave-one-out cross-validation forest plot</p></div>`);
    // Additional analyses group
    if (s.subgroup && subgroupResult) figs.push(subgroupSection(subgroupResult, result.measure));
    if (s.metaReg && metaRegression) figs.push(metaRegressionSection(metaRegression));
    if (s.metaReg && metaRegSvg) figs.push(`<div class="figure">${metaRegSvg}<p class="figure-caption">Figure ${++figNum}. Meta-regression scatter plot</p></div>`);
    if (s.labbe && labbeSvg) figs.push(`<div class="figure">${labbeSvg}<p class="figure-caption">Figure ${++figNum}. L'Abb&eacute; plot (experimental vs. control event rates)</p></div>`);
    if (s.network && networkSvg) figs.push(`<div class="figure">${networkSvg}<p class="figure-caption">Figure ${++figNum}. Network meta-analysis graph</p></div>`);
    if (s.doseResponse && drData) figs.push(doseResponseSection(drData));
    if (s.doseResponse && drSvg) figs.push(`<div class="figure">${drSvg}<p class="figure-caption">Figure ${++figNum}. Dose-response plot</p></div>`);
    if (s.cumulative && cumResults && cumResults.length > 0) figs.push(cumulativeSection(cumResults, result.measure));
    if (s.cumulative && cumSvg) figs.push(`<div class="figure">${cumSvg}<p class="figure-caption">Figure ${++figNum}. Cumulative meta-analysis forest plot</p></div>`);
    // Evidence quality assessment
    if (s.grade && gradeData) figs.push(gradeSection(gradeData));
    if (s.rob && robData && studyList && studyList.length > 0) figs.push(robSection(robData, studyList));
    return figs.join('\n  ');
  })()}
  ${s.sensitivity ? sensitivitySection(sensitivityResults, result) : ''}
  ${s.methods ? methodsSection(result, pico, eggers, subgroupResult, sensitivityResults) : ''}
  ${s.narrative ? narrativeSection(result, eggers, subgroupResult, sensitivityResults, beggs, metaRegression, gradeData, drData, trimFillResult, influenceData) : ''}
  <div class="footer">
    <span class="footer-brand">MetaReview</span> &mdash; Free Open-Source Meta-Analysis Platform<br>
    <a href="https://metareview.cc">metareview.cc</a>
  </div>
</body>
</html>`;
}
