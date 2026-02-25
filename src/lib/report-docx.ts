// DOCX report export using docx.js
import {
  Document,
  Packer,
  Paragraph,
  Table,
  TableRow,
  TableCell,
  TextRun,
  HeadingLevel,
  AlignmentType,
  WidthType,
  BorderStyle,
  ShadingType,
  convertInchesToTwip,
} from 'docx';
import type { MetaAnalysisResult, EggersTest, BeggsTest, SubgroupAnalysisResult, SensitivityResult, PICO, MetaRegressionResult, GradeAssessment, InfluenceDiagnostic, DoseResponseResult, CumulativeResult, Study, RobAssessments, RobDomain, RobJudgment } from './types';
import { calculateNNT } from './statistics/nnt';
import type { PRISMAData } from '../components/PRISMAFlow';
import type { ReportSections } from './report-export';
import { defaultReportSections } from './report-export';
import type { TrimAndFillResult } from './statistics/publication-bias';

interface ReportData {
  title: string;
  pico: PICO;
  result: MetaAnalysisResult;
  eggers: EggersTest | null;
  beggs?: BeggsTest | null;
  subgroupResult: SubgroupAnalysisResult | null;
  sensitivityResults: SensitivityResult[];
  trimFillResult?: TrimAndFillResult | null;
  metaRegression?: MetaRegressionResult | null;
  influenceDiagnostics?: InfluenceDiagnostic[];
  gradeAssessment?: GradeAssessment | null;
  robAssessments?: RobAssessments;
  doseResponseResult?: DoseResponseResult | null;
  cumulativeResults?: CumulativeResult[];
  studies?: Study[];
  prisma?: PRISMAData;
  sections?: ReportSections;
}

/** Safe number formatter — returns '—' for NaN/Infinity */
const fmt = (n: number, d = 2): string => isFinite(n) ? n.toFixed(d) : '—';
const fmtP = (p: number): string => !isFinite(p) ? '—' : p < 0.001 ? '< 0.001' : p.toFixed(3);

function makeHeaderCell(text: string): TableCell {
  return new TableCell({
    children: [new Paragraph({ children: [new TextRun({ text, bold: true, size: 20, font: 'Times New Roman' })] })],
    shading: { type: ShadingType.SOLID, color: 'F0F0F0' },
    width: { size: 0, type: WidthType.AUTO },
  });
}

function makeCell(text: string, opts?: { bold?: boolean; color?: string }): TableCell {
  return new TableCell({
    children: [new Paragraph({
      children: [new TextRun({
        text,
        bold: opts?.bold,
        color: opts?.color,
        size: 20,
        font: 'Times New Roman',
      })],
    })],
    width: { size: 0, type: WidthType.AUTO },
  });
}

function makeLabelValueRows(pairs: [string, string, boolean?][]): TableRow[] {
  return pairs.map(([label, value, highlight]) =>
    new TableRow({
      children: [
        makeCell(label, { color: '555555' }),
        makeCell(value, { bold: !!highlight, color: highlight ? 'CC0000' : undefined }),
      ],
    })
  );
}

function picoTable(pico: PICO): Table | null {
  const items: [string, string][] = [];
  if (pico.population) items.push(['Population', pico.population]);
  if (pico.intervention) items.push(['Intervention', pico.intervention]);
  if (pico.comparison) items.push(['Comparison', pico.comparison]);
  if (pico.outcome) items.push(['Outcome', pico.outcome]);
  if (items.length === 0) return null;

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: items.map(([label, value]) =>
      new TableRow({ children: [makeCell(label, { bold: true }), makeCell(value)] })
    ),
  });
}

function overallEffectTable(r: MetaAnalysisResult): Table {
  const het = r.heterogeneity;
  const rows: [string, string, boolean?][] = [
    ['Model', r.model === 'random' ? 'Random Effects (DerSimonian-Laird)' : 'Fixed Effects (Inverse Variance)'],
    ['Effect measure', r.measure],
    ['Number of studies', r.studies.length.toString()],
    [`Pooled ${r.measure}`, fmt(r.effect, 4)],
    ['95% CI', `[${fmt(r.ciLower, 4)}, ${fmt(r.ciUpper, 4)}]`],
    ['Z', fmt(r.z, 4)],
    ['P-value', fmtP(r.pValue), r.pValue < 0.05],
  ];
  if (r.predictionInterval) {
    rows.push(['95% Prediction Interval', `[${fmt(r.predictionInterval.lower, 4)}, ${fmt(r.predictionInterval.upper, 4)}]`]);
  }
  rows.push(
    ["Cochran's Q", `${fmt(het.Q)} (df = ${het.df})`],
    ['P-value (Q)', fmtP(het.pValue), het.pValue < 0.1],
    ['I\u00B2', `${fmt(het.I2, 1)}%`, het.I2 > 50],
    ['\u03C4\u00B2', fmt(het.tau2, 4)],
    ['\u03C4', fmt(het.tau, 4)],
    ['H\u00B2', fmt(het.H2)],
  );
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: makeLabelValueRows(rows),
  });
}

function interpretationRows(r: MetaAnalysisResult): Paragraph[] {
  const isRatio = r.measure === 'OR' || r.measure === 'RR' || r.measure === 'HR';
  const nullVal = isRatio ? 1 : 0;

  let direction: string;
  if (isRatio) {
    if (Math.abs(r.effect - 1) < 0.0001) direction = `No difference (${r.measure} = 1)`;
    else if (r.effect < 1) direction = `Favours treatment (${r.measure} < 1)`;
    else direction = `Favours control (${r.measure} > 1)`;
  } else {
    if (Math.abs(r.effect) < 0.0001) direction = `No difference (${r.measure} = 0)`;
    else if (r.effect < 0) direction = `Favours treatment (${r.measure} < 0)`;
    else direction = `Favours control (${r.measure} > 0)`;
  }

  let magnitude = '';
  if (isRatio) {
    const logE = Math.abs(Math.log(r.effect));
    if (logE < 0.223) magnitude = 'Small effect';
    else if (logE < 0.693) magnitude = 'Moderate effect';
    else magnitude = 'Large effect';
  } else if (r.measure === 'SMD') {
    const absD = Math.abs(r.effect);
    if (absD < 0.5) magnitude = "Small effect (Cohen's d < 0.5)";
    else if (absD < 0.8) magnitude = 'Medium effect (0.5 \u2264 d < 0.8)';
    else magnitude = 'Large effect (d \u2265 0.8)';
  }

  const ciCrossesNull = isRatio
    ? (r.ciLower <= nullVal && r.ciUpper >= nullVal)
    : (r.ciLower <= nullVal && r.ciUpper >= nullVal);

  const lines: Paragraph[] = [
    new Paragraph({ children: [new TextRun({ text: `Effect Direction: ${direction}`, size: 20, font: 'Times New Roman' })] }),
  ];
  if (magnitude) {
    lines.push(new Paragraph({ children: [new TextRun({ text: `Effect Magnitude: ${magnitude}`, size: 20, font: 'Times New Roman' })] }));
  }
  lines.push(
    new Paragraph({ children: [new TextRun({ text: `Statistical Significance: ${r.pValue < 0.05 ? 'Significant (P < 0.05)' : 'Not significant (P \u2265 0.05)'}`, size: 20, font: 'Times New Roman', bold: r.pValue < 0.05 })] }),
    new Paragraph({ children: [new TextRun({ text: `95% CI: ${ciCrossesNull ? 'Crosses the null line' : 'Does not include the null value'}`, size: 20, font: 'Times New Roman' })] }),
    new Paragraph({ children: [new TextRun({ text: 'Note: Clinical significance depends on context. Statistical significance \u2260 clinical importance.', italics: true, size: 18, color: '666666', font: 'Times New Roman' })] }),
  );
  return lines;
}

function studyResultsTable(r: MetaAnalysisResult): Table {
  const model = r.model;
  const totalW = r.studies.reduce((sum, s) => sum + (model === 'random' ? s.weightRandom : s.weightFixed), 0) || 1;
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          makeHeaderCell('Study'),
          makeHeaderCell(r.measure),
          makeHeaderCell('95% CI'),
          makeHeaderCell('Weight (%)'),
        ],
      }),
      ...r.studies.map(s => {
        const w = model === 'random' ? s.weightRandom : s.weightFixed;
        return new TableRow({
          children: [
            makeCell(`${s.name}${s.year ? ` (${s.year})` : ''}`),
            makeCell(fmt(s.effect, 4)),
            makeCell(`[${fmt(s.ciLower, 4)}, ${fmt(s.ciUpper, 4)}]`),
            makeCell(`${fmt((w / totalW) * 100, 1)}%`),
          ],
        });
      }),
    ],
  });
}

function eggersTable(eggers: EggersTest): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: makeLabelValueRows([
      ['Intercept', fmt(eggers.intercept, 4)],
      ['SE', fmt(eggers.se, 4)],
      ['t-value', fmt(eggers.tValue, 4)],
      ['P-value', fmtP(eggers.pValue), eggers.pValue < 0.05],
      ['df', eggers.df.toString()],
    ]),
  });
}

function beggsTable(beggs: BeggsTest): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: makeLabelValueRows([
      ["Kendall's \u03C4", fmt(beggs.tau, 4)],
      ['Z', fmt(beggs.z, 4)],
      ['P-value', fmtP(beggs.pValue), beggs.pValue < 0.05],
      ['k', beggs.k.toString()],
    ]),
  });
}

function metaRegressionTable(mr: MetaRegressionResult): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: makeLabelValueRows([
      ['Covariate', `${mr.covariate} (k = ${mr.k})`],
      ['Coefficient', `${fmt(mr.coefficient, 4)} (SE = ${fmt(mr.se, 4)})`],
      ['Z', fmt(mr.z, 4)],
      ['P-value', fmtP(mr.pValue), mr.pValue < 0.05],
      ['Intercept', fmt(mr.intercept, 4)],
      ['Q_model', `${fmt(mr.QModel)} (p = ${fmtP(mr.QModelP)})`, mr.QModelP < 0.05],
      ['Q_residual', `${fmt(mr.QResidual)} (df = ${mr.QResidualDf}, p = ${fmtP(mr.QResidualP)})`],
      ['R\u00B2', `${fmt(isFinite(mr.R2) ? mr.R2 * 100 : NaN, 1)}%`],
    ]),
  });
}

function subgroupTable(sg: SubgroupAnalysisResult, measure: string): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          makeHeaderCell('Subgroup'),
          makeHeaderCell('k'),
          makeHeaderCell(`${measure} [95% CI]`),
          makeHeaderCell('I\u00B2'),
          makeHeaderCell('p'),
        ],
      }),
      ...sg.subgroups.map(s =>
        new TableRow({
          children: [
            makeCell(s.name || 'Ungrouped'),
            makeCell(s.result.studies.length.toString()),
            makeCell(`${fmt(s.result.effect)} [${fmt(s.result.ciLower)}, ${fmt(s.result.ciUpper)}]`),
            makeCell(`${fmt(s.result.heterogeneity.I2, 1)}%`),
            makeCell(fmtP(s.result.pValue)),
          ],
        })
      ),
    ],
  });
}

function sensitivityTable(results: SensitivityResult[], full: MetaAnalysisResult): Table {
  const isRatio = full.measure === 'OR' || full.measure === 'RR' || full.measure === 'HR';
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          makeHeaderCell('Omitted Study'),
          makeHeaderCell(`${full.measure} [95% CI]`),
          makeHeaderCell('I\u00B2'),
        ],
      }),
      ...results.map(r => {
        const dirChanged = isRatio ? (r.effect > 1) !== (full.effect > 1) : (r.effect > 0) !== (full.effect > 0);
        const sigChanged = isRatio
          ? (r.ciLower > 1 || r.ciUpper < 1) !== (full.ciLower > 1 || full.ciUpper < 1)
          : (r.ciLower > 0 || r.ciUpper < 0) !== (full.ciLower > 0 || full.ciUpper < 0);
        const highlight = dirChanged || sigChanged;
        return new TableRow({
          children: [
            makeCell(`${r.omittedStudy}${highlight ? ' *' : ''}`, { bold: highlight }),
            makeCell(`${fmt(r.effect, 4)} [${fmt(r.ciLower, 4)}, ${fmt(r.ciUpper, 4)}]`),
            makeCell(`${fmt(r.I2, 1)}%`),
          ],
        });
      }),
      new TableRow({
        children: [
          makeCell('Full model', { bold: true }),
          makeCell(`${fmt(full.effect, 4)} [${fmt(full.ciLower, 4)}, ${fmt(full.ciUpper, 4)}]`, { bold: true }),
          makeCell(`${fmt(full.heterogeneity.I2, 1)}%`, { bold: true }),
        ],
      }),
    ],
  });
}

function narrativeText(r: MetaAnalysisResult, eggers: EggersTest | null, sg: SubgroupAnalysisResult | null, sensitivity: SensitivityResult[], beggs?: BeggsTest | null, metaReg?: MetaRegressionResult | null, grade?: GradeAssessment | null, doseResponse?: DoseResponseResult | null, trimFill?: TrimAndFillResult | null, influenceData?: InfluenceDiagnostic[]): string {
  const het = r.heterogeneity;
  const k = r.studies.length;
  let text = `A ${r.model === 'random' ? 'random-effects' : 'fixed-effect'} meta-analysis of ${k} studies was performed using the ${r.model === 'random' ? 'DerSimonian-Laird' : 'inverse variance'} method. The pooled ${r.measure} was ${fmt(r.effect)} (95% CI: ${fmt(r.ciLower)}\u2013${fmt(r.ciUpper)}; Z = ${fmt(r.z)}, P ${fmtP(r.pValue) === '< 0.001' ? '< 0.001' : `= ${fmtP(r.pValue)}`}), ${r.pValue < 0.05 ? 'indicating a statistically significant effect' : 'showing no statistically significant effect'}. `;
  text += `Heterogeneity was ${het.I2 < 25 ? 'low' : het.I2 < 50 ? 'moderate' : het.I2 < 75 ? 'substantial' : 'considerable'} (I\u00B2 = ${fmt(het.I2, 1)}%, Q = ${fmt(het.Q)}, df = ${het.df}, P ${fmtP(het.pValue) === '< 0.001' ? '< 0.001' : `= ${fmtP(het.pValue)}`}; \u03C4\u00B2 = ${fmt(het.tau2, 4)}).`;
  if (r.predictionInterval) {
    text += ` The 95% prediction interval was ${fmt(r.predictionInterval.lower)}\u2013${fmt(r.predictionInterval.upper)}, indicating the range of true effects expected in a new study (Riley et al., 2011).`;
  }
  if (eggers) {
    text += ` Egger's regression test ${eggers.pValue < 0.05 ? 'indicated significant' : 'did not indicate'} funnel plot asymmetry (intercept = ${fmt(eggers.intercept)}, P = ${fmtP(eggers.pValue)}).`;
  }
  if (beggs) {
    text += ` Begg's rank correlation test ${beggs.pValue < 0.05 ? 'revealed significant' : 'showed no significant'} evidence of publication bias (Kendall's \u03C4 = ${fmt(beggs.tau, 3)}, P = ${fmtP(beggs.pValue)}).`;
  }
  if (trimFill && trimFill.k0 > 0) {
    text += ` Trim-and-Fill analysis (Duval & Tweedie, 2000) estimated ${trimFill.k0} missing ${trimFill.k0 === 1 ? 'study' : 'studies'} on the ${trimFill.side} side; the adjusted ${r.measure} was ${fmt(trimFill.adjustedEffect)} (95% CI: ${fmt(trimFill.adjustedCILower)}\u2013${fmt(trimFill.adjustedCIUpper)}).`;
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
    text += influential.length === 0
      ? ` Leave-one-out sensitivity analysis showed that the pooled estimate was robust; no single study substantially altered the overall result.`
      : ` Leave-one-out sensitivity analysis identified ${influential.length} influential ${influential.length === 1 ? 'study' : 'studies'} (${influential.map(s => s.omittedStudy).join(', ')}) whose removal altered the direction or statistical significance of the pooled estimate.`;
  }
  if (influenceData && influenceData.length > 0) {
    const cooksThreshold = 4 / influenceData.length;
    const hatThreshold = 2 / influenceData.length;
    const flagged = influenceData.filter(d => d.cooksDistance > cooksThreshold || d.hat > hatThreshold || Math.abs(d.rstudent) > 2);
    if (flagged.length > 0) {
      text += ` Influence diagnostics (Viechtbauer & Cheung, 2010) flagged ${flagged.length} ${flagged.length === 1 ? 'study' : 'studies'} (${flagged.map(d => d.name).join(', ')}) as potentially influential based on Cook's distance (> ${cooksThreshold.toFixed(3)}), leverage (> ${hatThreshold.toFixed(3)}), or studentized residuals (> 2).`;
    } else {
      text += ` Influence diagnostics revealed no individually influential studies.`;
    }
  }
  if (sg && sg.subgroups.length > 1) {
    const sgEffects = sg.subgroups.map(s =>
      `${s.name || 'Ungrouped'} (${r.measure} = ${fmt(s.result.effect)}, 95% CI: ${fmt(s.result.ciLower)}\u2013${fmt(s.result.ciUpper)}, k = ${s.result.studies.length})`
    );
    const testSig = sg.test.pValue < 0.05;
    text += ` Subgroup analysis by ${sg.subgroups.map(s => s.name || 'Ungrouped').join(' vs ')} revealed ${sgEffects.join('; ')}. The test for subgroup differences ${testSig ? 'was statistically significant' : 'was not statistically significant'} (Q = ${fmt(sg.test.Q)}, df = ${sg.test.df}, P ${fmtP(sg.test.pValue) === '< 0.001' ? '< 0.001' : `= ${fmtP(sg.test.pValue)}`})${testSig ? ', suggesting effect modification across subgroups' : ', indicating no significant effect modification'}.`;
  }
  if (metaReg) {
    text += ` Meta-regression analysis using ${metaReg.covariate} as the covariate (k = ${metaReg.k}) ${metaReg.pValue < 0.05 ? 'identified a significant moderating effect' : 'did not identify a significant moderating effect'} (coefficient = ${fmt(metaReg.coefficient, 4)}, P = ${fmtP(metaReg.pValue)}; R\u00B2 = ${fmt(isFinite(metaReg.R2) ? metaReg.R2 * 100 : NaN, 1)}%).`;
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
    text += ` Dose-response meta-analysis of ${doseResponse.k} dose levels using weighted ${doseResponse.modelType} regression ${doseResponse.pLinear < 0.05 ? 'revealed a significant' : 'did not reveal a significant'} dose-response relationship (\u03B2\u2081 = ${fmt(doseResponse.beta1, 4)}, P = ${fmtP(doseResponse.pLinear)}; R\u00B2 = ${fmt(isFinite(doseResponse.R2) ? doseResponse.R2 * 100 : NaN, 1)}%).`;
  }
  return text;
}

function prismaSummaryTable(prisma: PRISMAData): Table | null {
  const n = (val: string) => val.trim() || '';
  const items: [string, string][] = [];
  if (n(prisma.dbRecords)) items.push(['Records from databases', n(prisma.dbRecords)]);
  if (n(prisma.otherRecords)) items.push(['Records from other sources', n(prisma.otherRecords)]);
  if (n(prisma.duplicatesRemoved)) items.push(['After duplicates removed', n(prisma.duplicatesRemoved)]);
  if (n(prisma.recordsScreened)) items.push(['Records screened', n(prisma.recordsScreened)]);
  if (n(prisma.recordsExcluded)) items.push(['Records excluded', n(prisma.recordsExcluded)]);
  if (n(prisma.fullTextAssessed)) items.push(['Full-text articles assessed', n(prisma.fullTextAssessed)]);
  if (n(prisma.fullTextExcluded)) items.push(['Full-text articles excluded', n(prisma.fullTextExcluded)]);
  if (prisma.fullTextExcludeReasons) items.push(['Exclusion reasons', prisma.fullTextExcludeReasons]);
  if (n(prisma.qualitativeSynthesis)) items.push(['Studies in qualitative synthesis', n(prisma.qualitativeSynthesis)]);
  if (n(prisma.quantitativeSynthesis)) items.push(['Studies in meta-analysis', n(prisma.quantitativeSynthesis)]);
  if (items.length === 0) return null;
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: items.map(([label, value]) =>
      new TableRow({ children: [makeCell(label, { bold: true }), makeCell(value)] })
    ),
  });
}

function influenceDiagnosticsTable(diagnostics: InfluenceDiagnostic[], measure: string): Table {
  const k = diagnostics.length;
  const cooksThreshold = 4 / k;
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          makeHeaderCell('Study'),
          makeHeaderCell(measure),
          makeHeaderCell('Weight'),
          makeHeaderCell('Hat'),
          makeHeaderCell('Rstudent'),
          makeHeaderCell("Cook's D"),
          makeHeaderCell('DFFITS'),
          makeHeaderCell('CovRatio'),
          makeHeaderCell(`LOO ${measure}`),
          makeHeaderCell('LOO I\u00B2'),
        ],
      }),
      ...diagnostics.map(d => {
        const isInfluential = d.cooksDistance > cooksThreshold;
        return new TableRow({
          children: [
            makeCell(`${d.name}${d.year ? ` (${d.year})` : ''}${isInfluential ? ' *' : ''}`, { bold: isInfluential }),
            makeCell(fmt(d.effect, 4)),
            makeCell(`${fmt(d.weight, 1)}%`),
            makeCell(fmt(d.hat, 4)),
            makeCell(fmt(d.rstudent, 3), { color: Math.abs(d.rstudent) > 2 ? 'CC0000' : undefined }),
            makeCell(fmt(d.cooksDistance, 4), { color: d.cooksDistance > cooksThreshold ? 'CC0000' : undefined }),
            makeCell(fmt(d.dffits, 4), { color: Math.abs(d.dffits) > 1 ? 'CC0000' : undefined }),
            makeCell(fmt(d.covRatio, 4)),
            makeCell(fmt(d.leaveOneOutEffect, 4)),
            makeCell(`${fmt(d.leaveOneOutI2, 1)}%`),
          ],
        });
      }),
    ],
  });
}

function gradeAssessmentTable(grade: GradeAssessment): Table {
  const levelLabels: Record<string, string> = { high: 'HIGH', moderate: 'MODERATE', low: 'LOW', very_low: 'VERY LOW' };
  const concernLabels: Record<string, string> = { no_concern: 'No concern', serious: 'Serious', very_serious: 'Very serious' };
  const domainLabels: Record<string, string> = {
    riskOfBias: 'Risk of Bias', inconsistency: 'Inconsistency', indirectness: 'Indirectness',
    imprecision: 'Imprecision', publicationBias: 'Publication Bias',
  };

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [makeHeaderCell('Domain'), makeHeaderCell('Assessment'), makeHeaderCell('Downgrade'), makeHeaderCell('Reasoning')],
      }),
      ...Object.entries(grade.factors).map(([key, f]) =>
        new TableRow({
          children: [
            makeCell(`${domainLabels[key] || key}${f.auto ? ' (Auto)' : ''}`, { bold: true }),
            makeCell(concernLabels[f.level], { color: f.level === 'very_serious' ? 'CC0000' : f.level === 'serious' ? 'CC6600' : '228B22' }),
            makeCell(f.downgrade.toString(), { bold: true, color: f.downgrade < 0 ? 'CC0000' : '228B22' }),
            makeCell(f.reasoning),
          ],
        })
      ),
      new TableRow({
        children: [
          makeCell('OVERALL', { bold: true }),
          makeCell(levelLabels[grade.overall], { bold: true }),
          makeCell(`Score: ${grade.score}/4`, { bold: true }),
          makeCell(''),
        ],
      }),
    ],
  });
}

const ROB_DOMAIN_LABELS_DOCX: Record<RobDomain, string> = {
  d1_randomization: 'D1: Randomization',
  d2_deviations: 'D2: Deviations',
  d3_missing: 'D3: Missing data',
  d4_measurement: 'D4: Measurement',
  d5_selection: 'D5: Reporting',
};
const ROB_JUDGMENT_LABELS_DOCX: Record<RobJudgment, string> = { low: 'Low', some_concerns: 'Some concerns', high: 'High' };
const ROB_JUDGMENT_COLORS_DOCX: Record<RobJudgment, string> = { low: '228B22', some_concerns: 'CC9900', high: 'CC0000' };
const ROB_JUDGMENT_BG_DOCX: Record<RobJudgment, string> = { low: 'DCFCE7', some_concerns: 'FEF9C3', high: 'FEE2E2' };
const ROB_SYMBOLS_DOCX: Record<RobJudgment, string> = { low: '+', some_concerns: '?', high: '\u2212' };

function robAssessmentTable(robData: RobAssessments, studyList: Study[]): Table {
  const domains: RobDomain[] = ['d1_randomization', 'd2_deviations', 'd3_missing', 'd4_measurement', 'd5_selection'];
  const assessed = studyList.filter(s => robData[s.id]);

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          makeHeaderCell('Study'),
          ...domains.map(d => makeHeaderCell(ROB_DOMAIN_LABELS_DOCX[d])),
          makeHeaderCell('Overall'),
        ],
      }),
      ...assessed.map(study => {
        const a = robData[study.id]!;
        return new TableRow({
          children: [
            makeCell(`${study.name}${study.year ? ` (${study.year})` : ''}`, { bold: true }),
            ...domains.map(d => {
              const j = a.domains[d];
              return new TableCell({
                children: [new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [new TextRun({ text: `${ROB_SYMBOLS_DOCX[j]} ${ROB_JUDGMENT_LABELS_DOCX[j]}`, bold: true, size: 20, font: 'Times New Roman', color: ROB_JUDGMENT_COLORS_DOCX[j] })],
                })],
                shading: { type: ShadingType.SOLID, color: ROB_JUDGMENT_BG_DOCX[j] },
                width: { size: 0, type: WidthType.AUTO },
              });
            }),
            new TableCell({
              children: [new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: `${ROB_SYMBOLS_DOCX[a.overall]} ${ROB_JUDGMENT_LABELS_DOCX[a.overall]}`, bold: true, size: 20, font: 'Times New Roman', color: ROB_JUDGMENT_COLORS_DOCX[a.overall] })],
              })],
              shading: { type: ShadingType.SOLID, color: ROB_JUDGMENT_BG_DOCX[a.overall] },
              width: { size: 0, type: WidthType.AUTO },
            }),
          ],
        });
      }),
    ],
  });
}

function doseResponseResultTable(dr: DoseResponseResult): Table {
  const rows: [string, string, boolean?][] = [
    ['Model', `Weighted ${dr.modelType === 'linear' ? 'Linear' : 'Quadratic Polynomial'} Regression (WLS)`],
    ['Dose levels (k)', dr.k.toString()],
    ['Intercept', fmt(dr.intercept, 4)],
    ['\u03B2\u2081 (linear)', `${fmt(dr.beta1, 4)} (P = ${fmtP(dr.pLinear)})`, dr.pLinear < 0.05],
  ];
  if (dr.modelType === 'quadratic') {
    rows.push(['\u03B2\u2082 (quadratic)', `${fmt(dr.beta2, 4)} (P = ${fmtP(dr.pQuadratic)})`, dr.pQuadratic < 0.05]);
  }
  rows.push(
    ['P-value (model)', fmtP(dr.pModel), dr.pModel < 0.05],
    ['R\u00B2', `${fmt(isFinite(dr.R2) ? dr.R2 * 100 : NaN, 1)}%`],
  );
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: makeLabelValueRows(rows),
  });
}

export async function generateReportDOCX(data: ReportData): Promise<Blob> {
  const { title, pico, result, eggers, beggs, subgroupResult, sensitivityResults, trimFillResult, metaRegression, influenceDiagnostics: influenceData, gradeAssessment: gradeData, robAssessments: robData, doseResponseResult: drData, cumulativeResults: cumResults, studies: rawStudies, prisma } = data;
  const s = data.sections || defaultReportSections;
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  const children: (Paragraph | Table)[] = [];

  // Brand header
  children.push(
    new Paragraph({
      children: [
        new TextRun({ text: 'MetaReview', bold: true, size: 24, color: '2563EB', font: 'Helvetica' }),
        new TextRun({ text: '  |  Free Open-Source Meta-Analysis Platform', size: 18, color: '6B7280', font: 'Helvetica' }),
      ],
      alignment: AlignmentType.CENTER,
      border: { bottom: { style: BorderStyle.SINGLE, size: 3, color: '2563EB' } },
      spacing: { after: 200 },
    }),
  );

  // Title
  children.push(
    new Paragraph({
      children: [new TextRun({ text: title || 'Meta-Analysis Report', bold: true, size: 32, font: 'Times New Roman' })],
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
    }),
    new Paragraph({
      children: [new TextRun({ text: `Generated by MetaReview \u2014 ${dateStr} at ${timeStr}`, size: 18, color: '666666', font: 'Times New Roman' })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    }),
  );

  // PRISMA Flow Summary
  if (s.prisma && prisma) {
    const prismaT = prismaSummaryTable(prisma);
    if (prismaT) {
      children.push(
        new Paragraph({ text: 'PRISMA 2020 Flow Summary', heading: HeadingLevel.HEADING_1, spacing: { before: 300 } }),
        prismaT,
      );
    }
  }

  // PICO
  if (s.pico) {
    const picoT = picoTable(pico);
    if (picoT) {
      children.push(
        new Paragraph({ text: 'PICO Framework', heading: HeadingLevel.HEADING_1, spacing: { before: 300 } }),
        picoT,
      );
    }
  }

  // Overall Effect & Heterogeneity
  if (s.overall) {
    children.push(
      new Paragraph({ text: 'Overall Effect & Heterogeneity', heading: HeadingLevel.HEADING_1, spacing: { before: 300 } }),
      overallEffectTable(result),
    );
    if (result.predictionInterval) {
      children.push(new Paragraph({
        children: [new TextRun({
          text: 'Prediction interval indicates the range of true effects expected in a new study (Riley et al., 2011). It incorporates both sampling error and between-study heterogeneity (\u03C4\u00B2).',
          italics: true,
          size: 18,
          color: '666666',
          font: 'Times New Roman',
        })],
        spacing: { before: 100 },
      }));
    }
  }

  // Clinical Interpretation
  if (s.interpretation) {
    children.push(
      new Paragraph({ text: 'Clinical Interpretation', heading: HeadingLevel.HEADING_1, spacing: { before: 300 } }),
      ...interpretationRows(result),
    );
  }

  // NNT/NNH (only for binary outcomes)
  if (s.interpretation && rawStudies) {
    const nnt = calculateNNT(result, rawStudies);
    if (nnt) {
      const label = nnt.isHarm ? 'Number Needed to Harm (NNH)' : 'Number Needed to Treat (NNT)';
      const nntRounded = Math.ceil(nnt.nnt);
      const ciCrossesNull = !isFinite(nnt.nntCIUpper);
      const ciLower = Math.ceil(nnt.nntCILower);
      const ciStr = ciCrossesNull ? `[${ciLower}, \u221E]` : `[${ciLower}, ${Math.ceil(nnt.nntCIUpper)}]`;
      const interp = nnt.isHarm
        ? `For every ${nntRounded} patients treated, 1 additional harm event occurs.`
        : `For every ${nntRounded} patients treated, 1 event is prevented.`;
      children.push(
        new Paragraph({ text: 'Clinical Significance (NNT/NNH)', heading: HeadingLevel.HEADING_1, spacing: { before: 300 } }),
        new Paragraph({ children: [new TextRun({ text: `${label}: `, bold: true }), new TextRun({ text: nntRounded.toString(), bold: true })], spacing: { before: 100 } }),
        new Paragraph({ children: [new TextRun({ text: '95% CI: ', bold: true }), new TextRun(ciStr)], spacing: { before: 60 } }),
        new Paragraph({ children: [new TextRun({ text: 'Absolute Risk Difference: ', bold: true }), new TextRun(`${fmt(isFinite(nnt.absoluteRiskDifference) ? nnt.absoluteRiskDifference * 100 : NaN)}%`)], spacing: { before: 60 } }),
        new Paragraph({ children: [new TextRun({ text: 'Control Event Rate: ', bold: true }), new TextRun(`${fmt(isFinite(nnt.controlEventRate) ? nnt.controlEventRate * 100 : NaN)}%`)], spacing: { before: 60 } }),
        new Paragraph({ children: [new TextRun({ text: 'Experimental Event Rate: ', bold: true }), new TextRun(`${fmt(isFinite(nnt.experimentalEventRate) ? nnt.experimentalEventRate * 100 : NaN)}%`)], spacing: { before: 60 } }),
        new Paragraph({ children: [new TextRun({ text: interp, italics: true, color: nnt.isHarm ? 'DC2626' : '16A34A' })], spacing: { before: 100 } }),
        new Paragraph({ children: [new TextRun({ text: 'Based on pooled effect and weighted average control event rate across studies.', italics: true, size: 18, color: '6B7280' })], spacing: { before: 60 } }),
      );
    }
  }

  // Individual Study Results
  if (s.studyTable) {
    children.push(
      new Paragraph({ text: 'Individual Study Results', heading: HeadingLevel.HEADING_1, spacing: { before: 300 } }),
      studyResultsTable(result),
    );
  }

  // === Publication Bias Group ===
  // Egger's Test
  if (s.eggers && eggers) {
    children.push(
      new Paragraph({ text: "Publication Bias (Egger's Test)", heading: HeadingLevel.HEADING_1, spacing: { before: 300 } }),
      eggersTable(eggers),
      new Paragraph({
        children: [new TextRun({
          text: eggers.pValue < 0.05
            ? 'Significant asymmetry detected \u2014 potential publication bias.'
            : 'No significant funnel plot asymmetry detected.',
          italics: true,
          size: 20,
          color: '666666',
          font: 'Times New Roman',
        })],
        spacing: { before: 100 },
      }),
    );
  }

  // Begg's Test
  if (s.beggs && beggs) {
    children.push(
      new Paragraph({ text: "Publication Bias (Begg's Rank Correlation)", heading: HeadingLevel.HEADING_1, spacing: { before: 300 } }),
      beggsTable(beggs),
      new Paragraph({
        children: [new TextRun({
          text: beggs.pValue < 0.05
            ? 'Significant rank correlation detected \u2014 potential publication bias.'
            : 'No significant rank correlation detected.',
          italics: true,
          size: 20,
          color: '666666',
          font: 'Times New Roman',
        })],
        spacing: { before: 100 },
      }),
    );
  }

  // Trim-and-Fill
  if (s.eggers && trimFillResult) {
    const tfText = trimFillResult.k0 === 0
      ? 'Trim-and-Fill (Duval & Tweedie, 2000): No funnel plot asymmetry detected \u2014 no imputation needed.'
      : `Trim-and-Fill (Duval & Tweedie, 2000): Estimated ${trimFillResult.k0} missing ${trimFillResult.k0 === 1 ? 'study' : 'studies'} on the ${trimFillResult.side} side. Adjusted ${result.measure}: ${fmt(trimFillResult.adjustedEffect, 4)} [${fmt(trimFillResult.adjustedCILower, 4)}, ${fmt(trimFillResult.adjustedCIUpper, 4)}].`;
    children.push(
      new Paragraph({
        children: [new TextRun({
          text: tfText,
          bold: trimFillResult.k0 > 0,
          size: 20,
          color: trimFillResult.k0 > 0 ? 'CC6600' : '228B22',
          font: 'Times New Roman',
        })],
        spacing: { before: 100 },
      }),
    );
  }

  // Contour-Enhanced Funnel Plot (text summary)
  if (s.contourFunnel && result.studies.length >= 3) {
    // Classify studies by significance regions based on their z-scores
    const studiesWithZ = result.studies.map(s => ({
      name: s.name,
      z: Math.abs(s.yi / s.sei),
    }));
    const sigP001 = studiesWithZ.filter(s => s.z >= 2.576).length;
    const sigP005 = studiesWithZ.filter(s => s.z >= 1.96 && s.z < 2.576).length;
    const sigP010 = studiesWithZ.filter(s => s.z >= 1.645 && s.z < 1.96).length;
    const nonSig = studiesWithZ.filter(s => s.z < 1.645).length;
    const total = studiesWithZ.length;
    const sigTotal = sigP001 + sigP005 + sigP010;
    children.push(
      new Paragraph({ text: 'Contour-Enhanced Funnel Plot', heading: HeadingLevel.HEADING_1, spacing: { before: 300 } }),
      new Paragraph({
        children: [new TextRun({
          text: `Of ${total} studies: ${sigP001} in p < 0.01 region, ${sigP005} in p < 0.05 region, ${sigP010} in p < 0.10 region, and ${nonSig} in non-significant region (p \u2265 0.10).`,
          size: 20,
          font: 'Times New Roman',
        })],
      }),
      new Paragraph({
        children: [new TextRun({
          text: sigTotal > total * 0.7
            ? 'The majority of studies fall in statistically significant regions, which could indicate publication bias favouring significant results (Peters et al., 2008).'
            : nonSig > total * 0.5
            ? 'Most studies fall in non-significant regions, suggesting limited evidence of publication bias related to significance-seeking.'
            : 'Studies are distributed across significance regions, showing a mixed pattern without strong evidence of significance-driven publication bias.',
          size: 20,
          color: sigTotal > total * 0.7 ? 'CC6600' : '228B22',
          font: 'Times New Roman',
        })],
        spacing: { before: 50 },
      }),
      new Paragraph({
        children: [new TextRun({
          text: 'The contour-enhanced funnel plot overlays significance contour regions (p < 0.01, p < 0.05, p < 0.10) on the standard funnel plot. If asymmetry arises primarily in areas of statistical significance, this suggests publication bias rather than other causes of funnel plot asymmetry such as between-study heterogeneity.',
          italics: true,
          size: 18,
          color: '666666',
          font: 'Times New Roman',
        })],
        spacing: { before: 100 },
      }),
    );
  }

  // === Heterogeneity Diagnostics Group ===
  // Galbraith Plot (text summary since DOCX can't embed SVG)
  if (s.galbraith) {
    const { galbraithPlotData } = await import('./statistics/publication-bias');
    const gData = galbraithPlotData(result.studies, result.summary);
    children.push(
      new Paragraph({ text: 'Galbraith Plot (Radial Plot)', heading: HeadingLevel.HEADING_1, spacing: { before: 300 } }),
      new Paragraph({
        children: [new TextRun({
          text: gData.outliers.length > 0
            ? `${gData.outliers.length} study(ies) outside \u00B12 confidence band, likely source(s) of heterogeneity: ${gData.outliers.join(', ')}.`
            : 'All studies within \u00B12 confidence band \u2014 no obvious sources of heterogeneity.',
          size: 20,
          color: gData.outliers.length > 0 ? 'CC0000' : '228B22',
          font: 'Times New Roman',
        })],
      }),
      new Paragraph({
        children: [new TextRun({
          text: `The Galbraith plot displays standardized effect sizes (z = y/se) against precision (1/se). ${gData.outliers.length > 0 ? `Studies outside the \u00B12 confidence band are potential sources of heterogeneity and may warrant further investigation through sensitivity analysis.` : 'All studies fall within the expected confidence band, consistent with the observed heterogeneity statistics.'}`,
          italics: true,
          size: 18,
          color: '666666',
          font: 'Times New Roman',
        })],
        spacing: { before: 100 },
      }),
    );
  }

  // Baujat Plot (text summary)
  if (s.baujat) {
    const { baujatPlotData } = await import('./statistics/publication-bias');
    const bData = baujatPlotData(result.studies, result.summary, result.heterogeneity.tau2);
    if (bData) {
      const influential = bData.points.filter(p => p.contribution > bData.meanContribution && p.influence > bData.meanInfluence);
      children.push(
        new Paragraph({ text: 'Baujat Plot (Contribution\u2013Influence)', heading: HeadingLevel.HEADING_1, spacing: { before: 300 } }),
        new Paragraph({
          children: [new TextRun({
            text: influential.length > 0
              ? `${influential.length} study(ies) in the upper-right quadrant (high contribution to heterogeneity and high influence on pooled effect): ${influential.map(p => p.name).join(', ')}.`
              : 'No studies showed both high contribution to heterogeneity and high influence on the pooled effect.',
            size: 20,
            color: influential.length > 0 ? 'CC6600' : '228B22',
            font: 'Times New Roman',
          })],
        }),
        new Paragraph({
          children: [new TextRun({
            text: `The Baujat plot maps each study's contribution to overall heterogeneity (x-axis) against its influence on the pooled estimate (y-axis). ${influential.length > 0 ? 'Studies in the upper-right quadrant contribute disproportionately to both heterogeneity and the pooled effect, and should be examined in sensitivity analyses.' : 'No studies showed disproportionate influence on both heterogeneity and the pooled effect.'}`,
            italics: true,
            size: 18,
            color: '666666',
            font: 'Times New Roman',
          })],
          spacing: { before: 100 },
        }),
      );
    }
  }

  // Influence Diagnostics
  if (s.influence && influenceData && influenceData.length > 0) {
    const k = influenceData.length;
    const cooksThreshold = 4 / k;
    const hatThreshold = 2 / k;
    const cooksInfluential = influenceData.filter(d => d.cooksDistance > cooksThreshold);
    const hatInfluential = influenceData.filter(d => d.hat > hatThreshold);
    const rstudentOutliers = influenceData.filter(d => Math.abs(d.rstudent) > 2);
    const dffitsInfluential = influenceData.filter(d => Math.abs(d.dffits) > 1);
    const anyFlagged = cooksInfluential.length > 0 || hatInfluential.length > 0 || rstudentOutliers.length > 0 || dffitsInfluential.length > 0;
    children.push(
      new Paragraph({ text: 'Influence Diagnostics', heading: HeadingLevel.HEADING_1, spacing: { before: 300 } }),
      new Paragraph({
        children: [new TextRun({
          text: `Viechtbauer & Cheung (2010). Thresholds: Cook's D > ${cooksThreshold.toFixed(3)}, hat > ${hatThreshold.toFixed(3)}, |rstudent| > 2, |DFFITS| > 1.`,
          italics: true,
          size: 18,
          color: '666666',
          font: 'Times New Roman',
        })],
        spacing: { before: 50 },
      }),
      influenceDiagnosticsTable(influenceData, result.measure),
    );
    if (anyFlagged) {
      const parts: string[] = [];
      if (cooksInfluential.length > 0) parts.push(`Cook's distance flagged ${cooksInfluential.map(d => d.name).join(', ')}`);
      if (hatInfluential.length > 0) parts.push(`high leverage in ${hatInfluential.map(d => d.name).join(', ')}`);
      if (rstudentOutliers.length > 0) parts.push(`studentized residuals exceeded \u00B12 for ${rstudentOutliers.map(d => d.name).join(', ')}`);
      if (dffitsInfluential.length > 0) parts.push(`|DFFITS| > 1 for ${dffitsInfluential.map(d => d.name).join(', ')}`);
      children.push(new Paragraph({
        children: [new TextRun({
          text: `Influential studies detected: ${parts.join('; ')}. Consider conducting sensitivity analyses excluding these studies to assess robustness of the pooled estimate.`,
          bold: true,
          size: 20,
          color: 'CC6600',
          font: 'Times New Roman',
        })],
        spacing: { before: 100 },
      }));
    } else {
      children.push(new Paragraph({
        children: [new TextRun({
          text: 'No influential studies detected. All diagnostic measures are within acceptable thresholds.',
          size: 20,
          color: '228B22',
          font: 'Times New Roman',
        })],
        spacing: { before: 100 },
      }));
    }
  }

  // Leave-One-Out Forest Plot (text summary)
  if (s.loo && sensitivityResults.length > 0) {
    const isRatio = result.measure === 'OR' || result.measure === 'RR' || result.measure === 'HR';
    const effects = sensitivityResults.map(r => r.effect);
    const minEffect = Math.min(...effects);
    const maxEffect = Math.max(...effects);
    const fmtLoo = (v: number) => !isFinite(v) ? '—' : isRatio ? v.toFixed(2) : v.toFixed(3);
    const influential = sensitivityResults.filter(s => {
      const dirChanged = isRatio ? (s.effect > 1) !== (result.effect > 1) : (s.effect > 0) !== (result.effect > 0);
      const origSig = isRatio ? (result.ciLower > 1 || result.ciUpper < 1) : (result.ciLower > 0 || result.ciUpper < 0);
      const newSig = isRatio ? (s.ciLower > 1 || s.ciUpper < 1) : (s.ciLower > 0 || s.ciUpper < 0);
      return dirChanged || origSig !== newSig;
    });
    children.push(
      new Paragraph({ text: 'Leave-One-Out Cross-Validation', heading: HeadingLevel.HEADING_1, spacing: { before: 300 } }),
      new Paragraph({
        children: [new TextRun({
          text: `The leave-one-out analysis shows the pooled ${result.measure} ranged from ${fmtLoo(minEffect)} to ${fmtLoo(maxEffect)} across ${sensitivityResults.length} iterations (full model: ${fmtLoo(result.effect)}).${influential.length > 0 ? ` Removing ${influential.map(s => s.omittedStudy).join(', ')} altered the direction or significance of the pooled estimate.` : ' No single study substantially altered the overall result.'}`,
          size: 20,
          font: 'Times New Roman',
        })],
      }),
    );
  }

  // === Additional Analyses Group ===
  // Subgroup Analysis
  if (s.subgroup && subgroupResult && subgroupResult.subgroups.length > 1) {
    children.push(
      new Paragraph({ text: 'Subgroup Analysis', heading: HeadingLevel.HEADING_1, spacing: { before: 300 } }),
      subgroupTable(subgroupResult, result.measure),
      new Paragraph({
        children: [new TextRun({
          text: `Test for Subgroup Differences: Q = ${fmt(subgroupResult.test.Q)}, df = ${subgroupResult.test.df}, p = ${fmtP(subgroupResult.test.pValue)}. ${subgroupResult.test.pValue < 0.05 ? 'Significant difference between subgroups.' : 'No significant difference between subgroups.'}`,
          bold: subgroupResult.test.pValue < 0.05,
          size: 20,
          font: 'Times New Roman',
        })],
        spacing: { before: 100 },
      }),
    );
  }

  // Meta-Regression
  if (s.metaReg && metaRegression) {
    children.push(
      new Paragraph({ text: 'Meta-Regression Analysis', heading: HeadingLevel.HEADING_1, spacing: { before: 300 } }),
      metaRegressionTable(metaRegression),
      new Paragraph({
        children: [new TextRun({
          text: metaRegression.pValue < 0.05
            ? 'The covariate significantly moderates the effect size (P < 0.05).'
            : 'The covariate does not significantly moderate the effect size (P \u2265 0.05).',
          italics: true,
          size: 20,
          color: metaRegression.pValue < 0.05 ? 'CC0000' : '228B22',
          font: 'Times New Roman',
        })],
        spacing: { before: 100 },
      }),
    );
  }

  // L'Abbé Plot (text summary)
  if (s.labbe && rawStudies && rawStudies.length > 0) {
    const { labbeePlotData } = await import('./statistics/publication-bias');
    const { isBinaryData } = await import('./statistics/effect-size');
    const binaryEntries = rawStudies
      .filter(st => isBinaryData(st.data))
      .map(st => {
        const d = st.data as { events1: number; total1: number; events2: number; total2: number };
        return { name: st.name, events1: d.events1, total1: d.total1, events2: d.events2, total2: d.total2 };
      });
    if (binaryEntries.length > 0) {
      const lData = labbeePlotData(binaryEntries);
      if (lData && lData.points.length > 0) {
        const total = lData.points.length;
        const aboveDiag = lData.favoursControl;
        const belowDiag = lData.favoursTreatment;
        const onDiag = total - aboveDiag - belowDiag;
        children.push(
          new Paragraph({ text: "L'Abb\u00e9 Plot", heading: HeadingLevel.HEADING_1, spacing: { before: 300 } }),
          new Paragraph({
            children: [new TextRun({
              text: `Of ${total} studies, ${belowDiag} ${belowDiag === 1 ? 'favours' : 'favour'} the experimental group (below diagonal), ${aboveDiag} ${aboveDiag === 1 ? 'favours' : 'favour'} the control group (above diagonal)${onDiag > 0 ? `, and ${onDiag} ${onDiag === 1 ? 'lies' : 'lie'} on the line of no effect` : ''}.`,
              size: 20,
              color: belowDiag > aboveDiag ? '228B22' : aboveDiag > belowDiag ? 'CC6600' : '333333',
              font: 'Times New Roman',
            })],
          }),
          new Paragraph({
            children: [new TextRun({
              text: "The L'Abb\u00e9 plot displays experimental group event rates (y-axis) against control group event rates (x-axis), with bubble sizes proportional to sample size. Studies below the diagonal line of equality indicate lower event rates in the experimental group (i.e., treatment benefit for harmful outcomes). The pattern of scatter around the diagonal provides a visual assessment of treatment effect consistency across studies.",
              italics: true,
              size: 18,
              color: '666666',
              font: 'Times New Roman',
            })],
            spacing: { before: 100 },
          }),
        );
      }
    }
  }

  // Network Graph (text summary)
  if (s.network && result.studies.length >= 3) {
    const subgroups = new Set<string>();
    const comparisons = new Map<string, number>();
    for (const study of result.studies) {
      // Try to extract subgroup as intervention name
      const parts = study.name.split(/\s+vs\.?\s+/i);
      if (parts.length === 2) {
        subgroups.add(parts[0].trim());
        subgroups.add(parts[1].trim());
        const key = [parts[0].trim(), parts[1].trim()].sort().join(' vs ');
        comparisons.set(key, (comparisons.get(key) || 0) + 1);
      }
    }
    if (subgroups.size > 0) {
      children.push(
        new Paragraph({ text: 'Network Meta-Analysis Graph', heading: HeadingLevel.HEADING_1, spacing: { before: 300 } }),
        new Paragraph({
          children: [new TextRun({
            text: `The network graph includes ${subgroups.size} interventions and ${comparisons.size} direct comparisons from ${result.studies.length} studies. Interventions: ${[...subgroups].join(', ')}.`,
            size: 20,
            font: 'Times New Roman',
          })],
        }),
      );
    } else {
      children.push(
        new Paragraph({ text: 'Network Meta-Analysis Graph', heading: HeadingLevel.HEADING_1, spacing: { before: 300 } }),
        new Paragraph({
          children: [new TextRun({
            text: `The network graph visualizes the relationships among ${result.studies.length} studies included in the meta-analysis. For the graphical network representation, see the HTML report.`,
            size: 20,
            font: 'Times New Roman',
          })],
        }),
      );
    }
  }

  // Dose-Response Analysis
  if (s.doseResponse && drData) {
    children.push(
      new Paragraph({ text: 'Dose-Response Meta-Analysis', heading: HeadingLevel.HEADING_1, spacing: { before: 300 } }),
      doseResponseResultTable(drData),
      new Paragraph({
        children: [new TextRun({
          text: drData.pLinear < 0.05
            ? `A significant ${drData.modelType} dose-response relationship was detected (P = ${fmtP(drData.pLinear)}).`
            : `No significant dose-response relationship was detected (P = ${fmtP(drData.pLinear)}).`,
          italics: true,
          size: 20,
          color: drData.pLinear < 0.05 ? 'CC0000' : '228B22',
          font: 'Times New Roman',
        })],
        spacing: { before: 100 },
      }),
      new Paragraph({
        children: [new TextRun({
          text: `Dose-response analysis used weighted ${drData.modelType} regression across ${drData.k} dose levels. ${drData.pLinear < 0.05 ? `The model explained ${fmt(isFinite(drData.R2) ? drData.R2 * 100 : NaN, 1)}% of the variance.` : `The model did not reach statistical significance (R\u00B2 = ${fmt(isFinite(drData.R2) ? drData.R2 * 100 : NaN, 1)}%).`}`,
          italics: true,
          size: 18,
          color: '666666',
          font: 'Times New Roman',
        })],
        spacing: { before: 100 },
      }),
    );
  }

  // Cumulative Meta-Analysis
  if (s.cumulative && cumResults && cumResults.length > 0) {
    const isRatio = result.measure === 'OR' || result.measure === 'RR' || result.measure === 'HR';
    const fmtCum = (v: number) => !isFinite(v) ? '—' : isRatio ? v.toFixed(2) : v.toFixed(3);
    const first = cumResults[0];
    const last = cumResults[cumResults.length - 1];
    children.push(
      new Paragraph({ text: 'Cumulative Meta-Analysis', heading: HeadingLevel.HEADING_1, spacing: { before: 300 } }),
      new Paragraph({
        children: [new TextRun({
          text: `The cumulative meta-analysis progressed from ${first.studyCount} to ${last.studyCount} studies. The initial pooled ${result.measure} was ${fmtCum(first.effect)} (95% CI: ${fmtCum(first.ciLower)}\u2013${fmtCum(first.ciUpper)}) and the final estimate was ${fmtCum(last.effect)} (95% CI: ${fmtCum(last.ciLower)}\u2013${fmtCum(last.ciUpper)}; I\u00B2 = ${fmt(last.I2, 1)}%).`,
          size: 20,
          font: 'Times New Roman',
        })],
        spacing: { after: 100 },
      }),
    );
    // Stability assessment
    if (cumResults.length >= 4) {
      const last3 = cumResults.slice(-3);
      const baseline = last3[0].effect;
      if (baseline !== 0) {
        const stable = last3.every(r => Math.abs((r.effect - baseline) / baseline) < 0.1);
        children.push(new Paragraph({
          children: [new TextRun({
            text: stable
              ? 'Stability: The pooled estimate remained stable over the last 3 steps (< 10% change), suggesting a robust result.'
              : 'Stability: The pooled estimate still fluctuated notably in recent steps, suggesting the result may not yet be fully stable.',
            bold: true,
            size: 20,
            color: stable ? '228B22' : 'CC6600',
            font: 'Times New Roman',
          })],
          spacing: { before: 50 },
        }));
      }
    }
    // Cumulative table
    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            children: [makeHeaderCell('Study Added'), makeHeaderCell('k'), makeHeaderCell(`${result.measure} [95% CI]`), makeHeaderCell('I\u00B2'), makeHeaderCell('P')],
          }),
          ...cumResults.map((r, i) =>
            new TableRow({
              children: [
                makeCell(`${r.addedStudy}${r.year ? ` (${r.year})` : ''}`, { bold: i === cumResults.length - 1 }),
                makeCell(r.studyCount.toString()),
                makeCell(`${fmtCum(r.effect)} [${fmtCum(r.ciLower)}, ${fmtCum(r.ciUpper)}]`),
                makeCell(`${fmt(r.I2, 1)}%`),
                makeCell(fmtP(r.pValue), { color: r.pValue < 0.05 ? 'CC0000' : undefined }),
              ],
            })
          ),
        ],
      }),
    );
  }

  // === Evidence Quality Assessment ===
  // GRADE Evidence Quality Assessment
  if (s.grade && gradeData) {
    const levelLabels: Record<string, string> = { high: 'HIGH', moderate: 'MODERATE', low: 'LOW', very_low: 'VERY LOW' };
    children.push(
      new Paragraph({ text: 'GRADE Evidence Quality Assessment', heading: HeadingLevel.HEADING_1, spacing: { before: 300 } }),
      new Paragraph({
        children: [new TextRun({
          text: `Overall Quality: ${levelLabels[gradeData.overall]} (Score: ${gradeData.score}/4)`,
          bold: true,
          size: 24,
          font: 'Times New Roman',
        })],
        spacing: { after: 200 },
      }),
      gradeAssessmentTable(gradeData),
      new Paragraph({
        children: [new TextRun({
          text: 'Note: Risk of bias and indirectness require manual assessment. Auto-assessed factors can be overridden in the GRADE tab.',
          italics: true,
          size: 18,
          color: '666666',
          font: 'Times New Roman',
        })],
        spacing: { before: 100 },
      }),
    );
  }

  // Risk of Bias Assessment (Cochrane RoB 2.0)
  if (s.rob && robData && rawStudies && rawStudies.length > 0 && Object.keys(robData).length > 0) {
    const assessed = rawStudies.filter(st => robData[st.id]);
    if (assessed.length > 0) {
      const lowCount = assessed.filter(st => robData[st.id]?.overall === 'low').length;
      const someCount = assessed.filter(st => robData[st.id]?.overall === 'some_concerns').length;
      const highCount = assessed.filter(st => robData[st.id]?.overall === 'high').length;
      children.push(
        new Paragraph({ text: 'Risk of Bias Assessment (Cochrane RoB 2.0)', heading: HeadingLevel.HEADING_1, spacing: { before: 300 } }),
        new Paragraph({
          children: [new TextRun({
            text: `Risk of bias was assessed for ${assessed.length} studies using the Cochrane RoB 2.0 tool (Sterne et al., 2019). Overall: ${lowCount} low risk, ${someCount} some concerns, ${highCount} high risk.`,
            size: 20,
            font: 'Times New Roman',
          })],
          spacing: { after: 200 },
        }),
        robAssessmentTable(robData, rawStudies),
        new Paragraph({
          children: [new TextRun({
            text: 'Note: Overall risk of bias judgment follows the worst-case domain rule (Cochrane RoB 2.0).',
            italics: true,
            size: 18,
            color: '666666',
            font: 'Times New Roman',
          })],
          spacing: { before: 100 },
        }),
      );
    }
  }

  // Sensitivity Analysis
  if (s.sensitivity && sensitivityResults.length > 0) {
    children.push(
      new Paragraph({ text: 'Sensitivity Analysis (Leave-One-Out)', heading: HeadingLevel.HEADING_1, spacing: { before: 300 } }),
      sensitivityTable(sensitivityResults, result),
    );
  }

  // Methods Paragraph (for manuscript)
  if (s.methods) {
    const methodsParts: string[] = [];
    methodsParts.push('A systematic review and meta-analysis was conducted following the PRISMA 2020 guidelines.');
    if (pico.population || pico.intervention || pico.comparison || pico.outcome) {
      const isRatioM = result.measure === 'OR' || result.measure === 'RR' || result.measure === 'HR';
      const picoDesc = [
        pico.intervention && pico.comparison
          ? `the ${isRatioM ? 'association between' : 'effect of'} ${pico.intervention} ${isRatioM ? 'and' : 'compared with'} ${pico.comparison}`
          : null,
        pico.outcome ? `on ${pico.outcome}` : null,
        pico.population ? `in ${pico.population}` : null,
      ].filter(Boolean).join(' ');
      if (picoDesc) methodsParts.push(`The aim was to evaluate ${picoDesc}.`);
    }
    const modelName = result.model === 'random' ? 'random-effects' : 'fixed-effect';
    const estimator = result.model === 'random' ? 'DerSimonian-Laird' : 'inverse variance';
    const measureFull: Record<string, string> = { OR: 'odds ratios (ORs)', RR: 'risk ratios (RRs)', HR: 'hazard ratios (HRs)', MD: 'mean differences (MDs)', SMD: 'standardized mean differences (SMDs)' };
    methodsParts.push(`A ${modelName} model with the ${estimator} estimator was used to pool effect sizes across ${result.studies.length} studies. Results were expressed as ${measureFull[result.measure] || result.measure} with 95% confidence intervals (CIs).`);
    methodsParts.push("Statistical heterogeneity was assessed using Cochran's Q test and quantified with the I\u00B2 statistic, where I\u00B2 values of 25%, 50%, and 75% were interpreted as low, moderate, and high heterogeneity, respectively (Higgins et al., 2003).");
    if (eggers) {
      methodsParts.push("Publication bias was evaluated by visual inspection of funnel plot asymmetry and formally tested using Egger's linear regression test and Begg's rank correlation test.");
    }
    if (sensitivityResults.length > 0) {
      methodsParts.push('Sensitivity analysis was performed using the leave-one-out method, whereby each study was sequentially removed to assess its influence on the pooled estimate.');
    }
    if (subgroupResult && subgroupResult.subgroups.length > 1) {
      methodsParts.push('Subgroup analysis was conducted to explore potential sources of heterogeneity, and the test for subgroup differences (Q-between) was used to evaluate effect modification.');
    }
    methodsParts.push('All analyses were performed using MetaReview (metareview.cc), an open-source online meta-analysis platform. A two-sided P value < 0.05 was considered statistically significant.');
    children.push(
      new Paragraph({ text: 'Methods Paragraph (for manuscript)', heading: HeadingLevel.HEADING_1, spacing: { before: 300 } }),
      new Paragraph({
        children: [new TextRun({
          text: methodsParts.join(' '),
          size: 22,
          font: 'Times New Roman',
        })],
        spacing: { after: 200 },
      }),
    );
  }

  // Narrative Summary
  if (s.narrative) {
    children.push(
      new Paragraph({ text: 'Narrative Summary', heading: HeadingLevel.HEADING_1, spacing: { before: 300 } }),
      new Paragraph({
        children: [new TextRun({
          text: narrativeText(result, eggers, subgroupResult, sensitivityResults, beggs, metaRegression, gradeData, drData, trimFillResult, influenceData),
          size: 22,
          font: 'Times New Roman',
        })],
        spacing: { after: 200 },
      }),
    );
  }

  // Footer
  children.push(
    new Paragraph({
      children: [
        new TextRun({ text: 'MetaReview', bold: true, size: 18, color: '2563EB', font: 'Helvetica' }),
        new TextRun({ text: ' \u2014 Free Open-Source Meta-Analysis Platform', size: 16, color: '6B7280', font: 'Helvetica' }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { before: 600 },
      border: { top: { style: BorderStyle.SINGLE, size: 3, color: '2563EB' } },
    }),
    new Paragraph({
      children: [new TextRun({
        text: 'metareview.cc',
        size: 16,
        color: '2563EB',
        font: 'Helvetica',
      })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
    }),
  );

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: {
            top: convertInchesToTwip(1),
            right: convertInchesToTwip(1),
            bottom: convertInchesToTwip(1),
            left: convertInchesToTwip(1),
          },
        },
      },
      children,
    }],
  });

  return await Packer.toBlob(doc);
}

// PRISMA Flow Diagram DOCX Export
function prismaFlowTable(data: PRISMAData): Table {
  const n = (val: string) => val.trim() || '\u2014';
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [makeHeaderCell('Phase'), makeHeaderCell('Step'), makeHeaderCell('Count')],
      }),
      // Identification
      new TableRow({ children: [makeCell('Identification'), makeCell('Records from databases'), makeCell(n(data.dbRecords))] }),
      new TableRow({ children: [makeCell(''), makeCell('Records from other sources'), makeCell(n(data.otherRecords))] }),
      // Screening
      new TableRow({ children: [makeCell('Screening'), makeCell('After duplicates removed'), makeCell(n(data.duplicatesRemoved))] }),
      new TableRow({ children: [makeCell(''), makeCell('Records screened'), makeCell(n(data.recordsScreened))] }),
      new TableRow({ children: [makeCell(''), makeCell('Records excluded'), makeCell(n(data.recordsExcluded))] }),
      // Eligibility
      new TableRow({ children: [makeCell('Eligibility'), makeCell('Full-text articles assessed'), makeCell(n(data.fullTextAssessed))] }),
      new TableRow({ children: [makeCell(''), makeCell('Full-text articles excluded'), makeCell(n(data.fullTextExcluded))] }),
      ...(data.fullTextExcludeReasons ? [new TableRow({ children: [makeCell(''), makeCell('Exclusion reasons'), makeCell(data.fullTextExcludeReasons)] })] : []),
      // Included
      new TableRow({ children: [makeCell('Included'), makeCell('Studies in qualitative synthesis'), makeCell(n(data.qualitativeSynthesis))] }),
      new TableRow({ children: [makeCell(''), makeCell('Studies in quantitative synthesis (meta-analysis)'), makeCell(n(data.quantitativeSynthesis))] }),
    ],
  });
}

export async function generatePRISMADOCX(data: PRISMAData): Promise<Blob> {
  const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const children: (Paragraph | Table)[] = [
    new Paragraph({
      children: [new TextRun({ text: 'PRISMA 2020 Flow Diagram', bold: true, size: 32, font: 'Times New Roman' })],
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
    }),
    new Paragraph({
      children: [new TextRun({ text: `Generated by MetaReview \u2014 ${dateStr}`, size: 18, color: '666666', font: 'Times New Roman' })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    }),
    new Paragraph({ text: 'Screening Flow', heading: HeadingLevel.HEADING_1, spacing: { before: 200 } }),
    prismaFlowTable(data),
    new Paragraph({
      children: [new TextRun({
        text: 'Note: This table represents the PRISMA 2020 flow diagram data. For the graphical version, export as SVG or PNG from MetaReview.',
        italics: true,
        size: 18,
        color: '666666',
        font: 'Times New Roman',
      })],
      spacing: { before: 200 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: 'MetaReview', bold: true, size: 18, color: '2563EB', font: 'Helvetica' }),
        new TextRun({ text: ' \u2014 Free Open-Source Meta-Analysis Platform', size: 16, color: '6B7280', font: 'Helvetica' }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { before: 600 },
      border: { top: { style: BorderStyle.SINGLE, size: 3, color: '2563EB' } },
    }),
    new Paragraph({
      children: [new TextRun({
        text: 'metareview.cc',
        size: 16,
        color: '2563EB',
        font: 'Helvetica',
      })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
    }),
  ];

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: {
            top: convertInchesToTwip(1),
            right: convertInchesToTwip(1),
            bottom: convertInchesToTwip(1),
            left: convertInchesToTwip(1),
          },
        },
      },
      children,
    }],
  });

  return await Packer.toBlob(doc);
}
