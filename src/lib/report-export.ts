// Report export — generates a printable HTML report
import type { MetaAnalysisResult, EggersTest, SubgroupAnalysisResult, SensitivityResult, PICO } from './types';

interface ReportData {
  title: string;
  pico: PICO;
  result: MetaAnalysisResult;
  eggers: EggersTest | null;
  subgroupResult: SubgroupAnalysisResult | null;
  sensitivityResults: SensitivityResult[];
  forestSvg: string | null;
  funnelSvg: string | null;
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
          const dirChanged = (r.effect > 1) !== (full.effect > 1) && (full.measure === 'OR' || full.measure === 'RR');
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
        ? `the ${r.measure === 'OR' || r.measure === 'RR' ? 'association between' : 'effect of'} ${esc(pico.intervention)} ${r.measure === 'OR' || r.measure === 'RR' ? 'and' : 'compared with'} ${esc(pico.comparison)}`
        : null,
      pico.outcome ? `on ${esc(pico.outcome)}` : null,
      pico.population ? `in ${esc(pico.population)}` : null,
    ].filter(Boolean).join(' ');
    if (picoDesc) parts.push(`The aim was to evaluate ${picoDesc}.`);
  }

  const modelName = r.model === 'random' ? 'random-effects' : 'fixed-effect';
  const estimator = r.model === 'random' ? 'DerSimonian-Laird' : 'inverse variance';
  const measureFull: Record<string, string> = { OR: 'odds ratios (ORs)', RR: 'risk ratios (RRs)', MD: 'mean differences (MDs)', SMD: 'standardized mean differences (SMDs)' };
  parts.push(`A ${modelName} model with the ${estimator} estimator was used to pool effect sizes across ${k} studies. Results were expressed as ${measureFull[r.measure] || r.measure} with 95% confidence intervals (CIs).`);

  parts.push("Statistical heterogeneity was assessed using Cochran's Q test and quantified with the I&sup2; statistic, where I&sup2; values of 25%, 50%, and 75% were interpreted as low, moderate, and high heterogeneity, respectively (Higgins et al., 2003).");

  if (eggers) {
    parts.push("Publication bias was evaluated by visual inspection of funnel plot asymmetry and formally tested using Egger's linear regression test.");
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

function narrativeSection(r: MetaAnalysisResult, eggers: EggersTest | null, sg: SubgroupAnalysisResult | null, sensitivity: SensitivityResult[]): string {
  const het = r.heterogeneity;
  const k = r.studies.length;
  let text = `A ${r.model === 'random' ? 'random-effects' : 'fixed-effect'} meta-analysis of ${k} studies was performed using the ${r.model === 'random' ? 'DerSimonian-Laird' : 'inverse variance'} method. The pooled ${r.measure} was ${r.effect.toFixed(2)} (95% CI: ${r.ciLower.toFixed(2)}&ndash;${r.ciUpper.toFixed(2)}; Z = ${r.z.toFixed(2)}, P ${r.pValue < 0.001 ? '&lt; 0.001' : `= ${r.pValue.toFixed(3)}`}), ${r.pValue < 0.05 ? 'indicating a statistically significant effect' : 'showing no statistically significant effect'}. `;
  text += `Heterogeneity was ${het.I2 < 25 ? 'low' : het.I2 < 50 ? 'moderate' : het.I2 < 75 ? 'substantial' : 'considerable'} (I&sup2; = ${het.I2.toFixed(1)}%, Q = ${het.Q.toFixed(2)}, df = ${het.df}, P ${het.pValue < 0.001 ? '&lt; 0.001' : `= ${het.pValue.toFixed(3)}`}; &tau;&sup2; = ${het.tau2.toFixed(4)}).`;
  if (eggers) {
    text += ` Egger's regression test ${eggers.pValue < 0.05 ? 'indicated significant' : 'did not indicate'} funnel plot asymmetry (intercept = ${eggers.intercept.toFixed(2)}, P = ${formatP(eggers.pValue)}).`;
  }
  if (sensitivity.length > 0) {
    const isRatio = r.measure === 'OR' || r.measure === 'RR';
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
  return `
    <h2>Narrative Summary (for manuscript)</h2>
    <div class="narrative">${text}</div>`;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function generateReportHTML(data: ReportData): string {
  const { title, pico, result, eggers, subgroupResult, sensitivityResults, forestSvg, funnelSvg } = data;
  const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

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
  <p class="subtitle">Generated by MetaReview &mdash; ${dateStr}</p>
  ${picoSection(pico)}
  ${overallSection(result)}
  ${studyTable(result)}
  ${eggers ? eggersSection(eggers) : ''}
  ${forestSvg ? `<div class="figure">${forestSvg}<p class="figure-caption">Figure 1. Forest plot</p></div>` : ''}
  ${funnelSvg ? `<div class="figure">${funnelSvg}<p class="figure-caption">Figure 2. Funnel plot</p></div>` : ''}
  ${subgroupResult ? subgroupSection(subgroupResult, result.measure) : ''}
  ${sensitivitySection(sensitivityResults, result)}
  ${methodsSection(result, pico, eggers, subgroupResult, sensitivityResults)}
  ${narrativeSection(result, eggers, subgroupResult, sensitivityResults)}
  <div class="footer">
    Generated by MetaReview (metareview-8c1.pages.dev) &mdash; Open-source meta-analysis platform
  </div>
</body>
</html>`;
}
