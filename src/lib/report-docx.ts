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
import type { MetaAnalysisResult, EggersTest, BeggsTest, SubgroupAnalysisResult, SensitivityResult, PICO, MetaRegressionResult } from './types';
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
  prisma?: PRISMAData;
  sections?: ReportSections;
}

const formatP = (p: number) => (p < 0.001 ? '< 0.001' : p.toFixed(3));

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
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: makeLabelValueRows([
      ['Model', r.model === 'random' ? 'Random Effects (DerSimonian-Laird)' : 'Fixed Effects (Inverse Variance)'],
      ['Effect measure', r.measure],
      ['Number of studies', r.studies.length.toString()],
      [`Pooled ${r.measure}`, r.effect.toFixed(4)],
      ['95% CI', `[${r.ciLower.toFixed(4)}, ${r.ciUpper.toFixed(4)}]`],
      ['Z', r.z.toFixed(4)],
      ['P-value', formatP(r.pValue), r.pValue < 0.05],
      ["Cochran's Q", `${het.Q.toFixed(2)} (df = ${het.df})`],
      ['P-value (Q)', formatP(het.pValue), het.pValue < 0.1],
      ['I\u00B2', `${het.I2.toFixed(1)}%`, het.I2 > 50],
      ['\u03C4\u00B2', het.tau2.toFixed(4)],
      ['\u03C4', het.tau.toFixed(4)],
      ['H\u00B2', het.H2.toFixed(2)],
    ]),
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
  const totalW = r.studies.reduce((sum, s) => sum + (model === 'random' ? s.weightRandom : s.weightFixed), 0);
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
            makeCell(s.effect.toFixed(4)),
            makeCell(`[${s.ciLower.toFixed(4)}, ${s.ciUpper.toFixed(4)}]`),
            makeCell(`${((w / totalW) * 100).toFixed(1)}%`),
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
      ['Intercept', eggers.intercept.toFixed(4)],
      ['SE', eggers.se.toFixed(4)],
      ['t-value', eggers.tValue.toFixed(4)],
      ['P-value', formatP(eggers.pValue), eggers.pValue < 0.05],
      ['df', eggers.df.toString()],
    ]),
  });
}

function beggsTable(beggs: BeggsTest): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: makeLabelValueRows([
      ["Kendall's \u03C4", beggs.tau.toFixed(4)],
      ['Z', beggs.z.toFixed(4)],
      ['P-value', formatP(beggs.pValue), beggs.pValue < 0.05],
      ['k', beggs.k.toString()],
    ]),
  });
}

function metaRegressionTable(mr: MetaRegressionResult): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: makeLabelValueRows([
      ['Covariate', `${mr.covariate} (k = ${mr.k})`],
      ['Coefficient', `${mr.coefficient.toFixed(4)} (SE = ${mr.se.toFixed(4)})`],
      ['Z', mr.z.toFixed(4)],
      ['P-value', formatP(mr.pValue), mr.pValue < 0.05],
      ['Intercept', mr.intercept.toFixed(4)],
      ['Q_model', `${mr.QModel.toFixed(2)} (p = ${formatP(mr.QModelP)})`, mr.QModelP < 0.05],
      ['Q_residual', `${mr.QResidual.toFixed(2)} (df = ${mr.QResidualDf}, p = ${formatP(mr.QResidualP)})`],
      ['R\u00B2', `${(mr.R2 * 100).toFixed(1)}%`],
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
            makeCell(`${s.result.effect.toFixed(2)} [${s.result.ciLower.toFixed(2)}, ${s.result.ciUpper.toFixed(2)}]`),
            makeCell(`${s.result.heterogeneity.I2.toFixed(1)}%`),
            makeCell(formatP(s.result.pValue)),
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
            makeCell(`${r.effect.toFixed(4)} [${r.ciLower.toFixed(4)}, ${r.ciUpper.toFixed(4)}]`),
            makeCell(`${r.I2.toFixed(1)}%`),
          ],
        });
      }),
      new TableRow({
        children: [
          makeCell('Full model', { bold: true }),
          makeCell(`${full.effect.toFixed(4)} [${full.ciLower.toFixed(4)}, ${full.ciUpper.toFixed(4)}]`, { bold: true }),
          makeCell(`${full.heterogeneity.I2.toFixed(1)}%`, { bold: true }),
        ],
      }),
    ],
  });
}

function narrativeText(r: MetaAnalysisResult, eggers: EggersTest | null, sg: SubgroupAnalysisResult | null, sensitivity: SensitivityResult[], beggs?: BeggsTest | null, metaReg?: MetaRegressionResult | null): string {
  const het = r.heterogeneity;
  const k = r.studies.length;
  let text = `A ${r.model === 'random' ? 'random-effects' : 'fixed-effect'} meta-analysis of ${k} studies was performed using the ${r.model === 'random' ? 'DerSimonian-Laird' : 'inverse variance'} method. The pooled ${r.measure} was ${r.effect.toFixed(2)} (95% CI: ${r.ciLower.toFixed(2)}\u2013${r.ciUpper.toFixed(2)}; Z = ${r.z.toFixed(2)}, P ${r.pValue < 0.001 ? '< 0.001' : `= ${r.pValue.toFixed(3)}`}), ${r.pValue < 0.05 ? 'indicating a statistically significant effect' : 'showing no statistically significant effect'}. `;
  text += `Heterogeneity was ${het.I2 < 25 ? 'low' : het.I2 < 50 ? 'moderate' : het.I2 < 75 ? 'substantial' : 'considerable'} (I\u00B2 = ${het.I2.toFixed(1)}%, Q = ${het.Q.toFixed(2)}, df = ${het.df}, P ${het.pValue < 0.001 ? '< 0.001' : `= ${het.pValue.toFixed(3)}`}; \u03C4\u00B2 = ${het.tau2.toFixed(4)}).`;
  if (eggers) {
    text += ` Egger's regression test ${eggers.pValue < 0.05 ? 'indicated significant' : 'did not indicate'} funnel plot asymmetry (intercept = ${eggers.intercept.toFixed(2)}, P = ${formatP(eggers.pValue)}).`;
  }
  if (beggs) {
    text += ` Begg's rank correlation test ${beggs.pValue < 0.05 ? 'revealed significant' : 'showed no significant'} evidence of publication bias (Kendall's \u03C4 = ${beggs.tau.toFixed(3)}, P = ${formatP(beggs.pValue)}).`;
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
  if (sg && sg.subgroups.length > 1) {
    const sgEffects = sg.subgroups.map(s =>
      `${s.name || 'Ungrouped'} (${r.measure} = ${s.result.effect.toFixed(2)}, 95% CI: ${s.result.ciLower.toFixed(2)}\u2013${s.result.ciUpper.toFixed(2)}, k = ${s.result.studies.length})`
    );
    const testSig = sg.test.pValue < 0.05;
    text += ` Subgroup analysis by ${sg.subgroups.map(s => s.name || 'Ungrouped').join(' vs ')} revealed ${sgEffects.join('; ')}. The test for subgroup differences ${testSig ? 'was statistically significant' : 'was not statistically significant'} (Q = ${sg.test.Q.toFixed(2)}, df = ${sg.test.df}, P ${sg.test.pValue < 0.001 ? '< 0.001' : `= ${sg.test.pValue.toFixed(3)}`})${testSig ? ', suggesting effect modification across subgroups' : ', indicating no significant effect modification'}.`;
  }
  if (metaReg) {
    text += ` Meta-regression analysis using ${metaReg.covariate} as the covariate (k = ${metaReg.k}) ${metaReg.pValue < 0.05 ? 'identified a significant moderating effect' : 'did not identify a significant moderating effect'} (coefficient = ${metaReg.coefficient.toFixed(4)}, P = ${formatP(metaReg.pValue)}; R\u00B2 = ${(metaReg.R2 * 100).toFixed(1)}%).`;
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

export async function generateReportDOCX(data: ReportData): Promise<Blob> {
  const { title, pico, result, eggers, beggs, subgroupResult, sensitivityResults, trimFillResult, metaRegression, prisma } = data;
  const s = data.sections || defaultReportSections;
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  const children: (Paragraph | Table)[] = [];

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
  }

  // Clinical Interpretation
  if (s.interpretation) {
    children.push(
      new Paragraph({ text: 'Clinical Interpretation', heading: HeadingLevel.HEADING_1, spacing: { before: 300 } }),
      ...interpretationRows(result),
    );
  }

  // Individual Study Results
  if (s.studyTable) {
    children.push(
      new Paragraph({ text: 'Individual Study Results', heading: HeadingLevel.HEADING_1, spacing: { before: 300 } }),
      studyResultsTable(result),
    );
  }

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
      : `Trim-and-Fill (Duval & Tweedie, 2000): Estimated ${trimFillResult.k0} missing ${trimFillResult.k0 === 1 ? 'study' : 'studies'} on the ${trimFillResult.side} side. Adjusted ${result.measure}: ${trimFillResult.adjustedEffect.toFixed(4)} [${trimFillResult.adjustedCILower.toFixed(4)}, ${trimFillResult.adjustedCIUpper.toFixed(4)}].`;
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
          text: 'Note: For the graphical Galbraith plot, export the HTML report or download SVG from MetaReview.',
          italics: true,
          size: 18,
          color: '666666',
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

  // Subgroup Analysis
  if (s.subgroup && subgroupResult && subgroupResult.subgroups.length > 1) {
    children.push(
      new Paragraph({ text: 'Subgroup Analysis', heading: HeadingLevel.HEADING_1, spacing: { before: 300 } }),
      subgroupTable(subgroupResult, result.measure),
      new Paragraph({
        children: [new TextRun({
          text: `Test for Subgroup Differences: Q = ${subgroupResult.test.Q.toFixed(2)}, df = ${subgroupResult.test.df}, p = ${formatP(subgroupResult.test.pValue)}. ${subgroupResult.test.pValue < 0.05 ? 'Significant difference between subgroups.' : 'No significant difference between subgroups.'}`,
          bold: subgroupResult.test.pValue < 0.05,
          size: 20,
          font: 'Times New Roman',
        })],
        spacing: { before: 100 },
      }),
    );
  }

  // Sensitivity Analysis
  if (s.sensitivity && sensitivityResults.length > 0) {
    children.push(
      new Paragraph({ text: 'Sensitivity Analysis (Leave-One-Out)', heading: HeadingLevel.HEADING_1, spacing: { before: 300 } }),
      sensitivityTable(sensitivityResults, result),
    );
  }

  // Narrative Summary
  if (s.narrative) {
    children.push(
      new Paragraph({ text: 'Narrative Summary', heading: HeadingLevel.HEADING_1, spacing: { before: 300 } }),
      new Paragraph({
        children: [new TextRun({
          text: narrativeText(result, eggers, subgroupResult, sensitivityResults, beggs, metaRegression),
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
      children: [new TextRun({
        text: 'Generated by MetaReview (metareview-8c1.pages.dev) \u2014 Open-source meta-analysis platform',
        size: 16,
        color: '999999',
        font: 'Times New Roman',
      })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 600 },
      border: { top: { style: BorderStyle.SINGLE, size: 1, color: 'DDDDDD' } },
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
      children: [new TextRun({
        text: 'Generated by MetaReview (metareview-8c1.pages.dev) \u2014 Open-source meta-analysis platform',
        size: 16,
        color: '999999',
        font: 'Times New Roman',
      })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 600 },
      border: { top: { style: BorderStyle.SINGLE, size: 1, color: 'DDDDDD' } },
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
