// Report export — generates a printable HTML report
import type { MetaAnalysisResult, EggersTest, BeggsTest, SubgroupAnalysisResult, SensitivityResult, PICO, MetaRegressionResult } from './types';
import type { PRISMAData } from '../components/PRISMAFlow';
import type { TrimAndFillResult } from './statistics/publication-bias';

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
  subgroup: boolean;
  sensitivity: boolean;
  metaReg: boolean;
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
  subgroup: true,
  sensitivity: true,
  metaReg: true,
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
      </tbody>
    </table>
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

  parts.push('All analyses were performed using MetaReview (metareview-8c1.pages.dev), an open-source online meta-analysis platform. A two-sided P value &lt; 0.05 was considered statistically significant.');

  return `
    <h2>Methods Paragraph (for manuscript)</h2>
    <div class="narrative">${parts.join(' ')}</div>`;
}

function narrativeSection(r: MetaAnalysisResult, eggers: EggersTest | null, sg: SubgroupAnalysisResult | null, sensitivity: SensitivityResult[], beggs?: BeggsTest | null, metaReg?: MetaRegressionResult | null): string {
  const het = r.heterogeneity;
  const k = r.studies.length;
  let text = `A ${r.model === 'random' ? 'random-effects' : 'fixed-effect'} meta-analysis of ${k} studies was performed using the ${r.model === 'random' ? 'DerSimonian-Laird' : 'inverse variance'} method. The pooled ${r.measure} was ${r.effect.toFixed(2)} (95% CI: ${r.ciLower.toFixed(2)}&ndash;${r.ciUpper.toFixed(2)}; Z = ${r.z.toFixed(2)}, P ${r.pValue < 0.001 ? '&lt; 0.001' : `= ${r.pValue.toFixed(3)}`}), ${r.pValue < 0.05 ? 'indicating a statistically significant effect' : 'showing no statistically significant effect'}. `;
  text += `Heterogeneity was ${het.I2 < 25 ? 'low' : het.I2 < 50 ? 'moderate' : het.I2 < 75 ? 'substantial' : 'considerable'} (I&sup2; = ${het.I2.toFixed(1)}%, Q = ${het.Q.toFixed(2)}, df = ${het.df}, P ${het.pValue < 0.001 ? '&lt; 0.001' : `= ${het.pValue.toFixed(3)}`}; &tau;&sup2; = ${het.tau2.toFixed(4)}).`;
  if (eggers) {
    text += ` Egger's regression test ${eggers.pValue < 0.05 ? 'indicated significant' : 'did not indicate'} funnel plot asymmetry (intercept = ${eggers.intercept.toFixed(2)}, P = ${formatP(eggers.pValue)}).`;
  }
  if (beggs) {
    text += ` Begg's rank correlation test ${beggs.pValue < 0.05 ? 'revealed significant' : 'showed no significant'} evidence of publication bias (Kendall's &tau; = ${beggs.tau.toFixed(3)}, P = ${formatP(beggs.pValue)}).`;
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

export function generateReportHTML(data: ReportData): string {
  const { title, pico, result, eggers, beggs, subgroupResult, sensitivityResults, forestSvg, funnelSvg, galbraithSvg, trimFillResult, metaRegression, metaRegSvg, prisma } = data;
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
  h1 { font-size: 18pt; text-align: center; margin-bottom: 4px; }
  .subtitle { text-align: center; font-size: 10pt; color: #666; margin-bottom: 24px; }
  h2 { font-size: 13pt; margin: 20px 0 8px; padding-bottom: 4px; border-bottom: 1px solid #ddd; }
  table { width: 100%; border-collapse: collapse; margin: 8px 0 16px; font-size: 11pt; }
  .data-table td { padding: 4px 8px; border-bottom: 1px solid #eee; }
  .data-table .label { color: #555; width: 180px; font-weight: 500; }
  .full-table th { padding: 6px 8px; text-align: left; border-bottom: 2px solid #ccc; font-size: 10pt; color: #444; }
  .full-table td { padding: 5px 8px; border-bottom: 1px solid #eee; }
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
  .footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #ddd; font-size: 9pt; color: #999; text-align: center; }
  @media print {
    body { padding: 20px; }
    .no-print { display: none; }
    .figure { page-break-inside: avoid; }
  }
</style>
</head>
<body>
  <div class="no-print" style="text-align:center;margin-bottom:20px;">
    <button onclick="window.print()" style="padding:8px 20px;background:#2563eb;color:#fff;border:none;border-radius:6px;font-size:13px;cursor:pointer;">
      Print / Save as PDF
    </button>
  </div>
  <h1>${esc(title || 'Meta-Analysis Report')}</h1>
  <p class="subtitle">Generated by MetaReview &mdash; ${dateStr} at ${timeStr}</p>
  ${s.pico ? picoSection(pico) : ''}
  ${s.prisma && prisma ? prismaDataSection(prisma) : ''}
  ${s.overall ? overallSection(result) : ''}
  ${s.interpretation ? interpretationSection(result) : ''}
  ${s.studyTable ? studyTable(result) : ''}
  ${s.eggers && eggers ? eggersSection(eggers) : ''}
  ${s.beggs && beggs ? beggsSection(beggs) : ''}
  ${s.plots && forestSvg ? `<div class="figure">${forestSvg}<p class="figure-caption">Figure 1. Forest plot</p></div>` : ''}
  ${s.plots && funnelSvg ? `<div class="figure">${funnelSvg}<p class="figure-caption">Figure 2. Funnel plot</p></div>` : ''}
  ${s.eggers && trimFillResult ? trimFillSection(trimFillResult, result.measure) : ''}
  ${s.galbraith && galbraithSvg ? `<div class="figure">${galbraithSvg}<p class="figure-caption">Figure 3. Galbraith plot (radial plot)</p></div>` : ''}
  ${s.metaReg && metaRegression ? metaRegressionSection(metaRegression) : ''}
  ${s.metaReg && metaRegSvg ? `<div class="figure">${metaRegSvg}<p class="figure-caption">Figure ${[forestSvg, funnelSvg, galbraithSvg].filter(Boolean).length + 1}. Meta-regression scatter plot</p></div>` : ''}
  ${s.subgroup && subgroupResult ? subgroupSection(subgroupResult, result.measure) : ''}
  ${s.sensitivity ? sensitivitySection(sensitivityResults, result) : ''}
  ${s.methods ? methodsSection(result, pico, eggers, subgroupResult, sensitivityResults) : ''}
  ${s.narrative ? narrativeSection(result, eggers, subgroupResult, sensitivityResults, beggs, metaRegression) : ''}
  <div class="footer">
    Generated by MetaReview (metareview-8c1.pages.dev) &mdash; Open-source meta-analysis platform
  </div>
</body>
</html>`;
}
