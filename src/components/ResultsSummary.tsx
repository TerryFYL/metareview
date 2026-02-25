import { useState } from 'react';
import type { MetaAnalysisResult, EggersTest, SubgroupAnalysisResult, SensitivityResult } from '../lib/types';
import type { ReportSections } from '../lib/report-export';
import { defaultReportSections } from '../lib/report-export';
import { t, type Lang } from '../lib/i18n';
import { useProjectStore, useUIStore } from '../store';
import { trackFeature, trackEvent, trackMaCompleted } from '../lib/analytics';
import { calculateNNT } from '../lib/statistics';

interface ResultsSummaryProps {
  result: MetaAnalysisResult;
  eggers: EggersTest | null;
  subgroupResult: SubgroupAnalysisResult | null;
  sensitivityResults: SensitivityResult[];
  lang: Lang;
  onExportReport?: (sections: ReportSections) => void;
  onExportDOCX?: (sections: ReportSections) => void;
  onExportMarkdown?: (sections: ReportSections) => void;
  onExportJSON?: () => void;
}

export default function ResultsSummary({ result, eggers, subgroupResult, sensitivityResults, lang, onExportReport, onExportDOCX, onExportMarkdown, onExportJSON }: ResultsSummaryProps) {
  const { measure, model, heterogeneity: het } = result;
  const k = result.studies.length;
  const beggs = useUIStore((s) => s.beggs);
  const metaRegression = useUIStore((s) => s.metaRegression);
  const { pico, prisma, robAssessments, studies } = useProjectStore();
  const [showSections, setShowSections] = useState(false);
  const [sections, setSections] = useState<ReportSections>({ ...defaultReportSections });

  // Data availability — false means section will produce empty content
  const dataAvailable: Partial<Record<keyof ReportSections, boolean>> = {
    pico: !!(pico.population || pico.intervention || pico.comparison || pico.outcome),
    prisma: !!(prisma && (prisma.dbRecords || prisma.otherRecords)),
    eggers: !!eggers,
    beggs: !!beggs,
    subgroup: !!subgroupResult && subgroupResult.subgroups.length > 1,
    sensitivity: sensitivityResults.length > 0,
    metaReg: !!metaRegression,
    rob: !!robAssessments && Object.keys(robAssessments).length > 0,
    labbe: measure === 'OR' || measure === 'RR',
    doseResponse: studies.some(s => s.dose != null && !isNaN(s.dose)),
  };

  const sectionGroups: { labelKey: string; keys: { key: keyof ReportSections; labelKey: string }[] }[] = [
    {
      labelKey: 'report.group.core',
      keys: [
        { key: 'pico', labelKey: 'report.section.pico' },
        { key: 'prisma', labelKey: 'report.section.prisma' },
        { key: 'overall', labelKey: 'report.section.overall' },
        { key: 'interpretation', labelKey: 'report.section.interpretation' },
        { key: 'studyTable', labelKey: 'report.section.studyTable' },
        { key: 'plots', labelKey: 'report.section.plots' },
      ],
    },
    {
      labelKey: 'report.group.pubBias',
      keys: [
        { key: 'contourFunnel', labelKey: 'report.section.contourFunnel' },
        { key: 'eggers', labelKey: 'report.section.eggers' },
        { key: 'beggs', labelKey: 'report.section.beggs' },
      ],
    },
    {
      labelKey: 'report.group.heterogeneity',
      keys: [
        { key: 'galbraith', labelKey: 'report.section.galbraith' },
        { key: 'baujat', labelKey: 'report.section.baujat' },
        { key: 'influence', labelKey: 'report.section.influence' },
        { key: 'loo', labelKey: 'report.section.loo' },
      ],
    },
    {
      labelKey: 'report.group.additional',
      keys: [
        { key: 'subgroup', labelKey: 'report.section.subgroup' },
        { key: 'metaReg', labelKey: 'report.section.metaRegression' },
        { key: 'sensitivity', labelKey: 'report.section.sensitivity' },
        { key: 'labbe', labelKey: 'report.section.labbe' },
        { key: 'network', labelKey: 'report.section.network' },
        { key: 'doseResponse', labelKey: 'report.section.doseResponse' },
        { key: 'cumulative', labelKey: 'report.section.cumulative' },
      ],
    },
    {
      labelKey: 'report.group.evidence',
      keys: [
        { key: 'grade', labelKey: 'report.section.grade' },
        { key: 'rob', labelKey: 'report.section.rob' },
      ],
    },
    {
      labelKey: 'report.group.writing',
      keys: [
        { key: 'methods', labelKey: 'report.section.methods' },
        { key: 'narrative', labelKey: 'report.section.narrative' },
      ],
    },
  ];

  const toggleSection = (key: keyof ReportSections) => {
    setSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleGroup = (groupKeys: (keyof ReportSections)[]) => {
    const allOn = groupKeys.every(k => sections[k]);
    const newVal = !allOn;
    setSections(prev => {
      const next = { ...prev };
      groupKeys.forEach(k => { next[k] = newVal; });
      return next;
    });
  };

  const toggleAllSections = () => {
    const allOn = Object.values(sections).every(v => v);
    const newVal = !allOn;
    setSections({
      pico: newVal, prisma: newVal, overall: newVal, interpretation: newVal, studyTable: newVal,
      eggers: newVal, beggs: newVal, plots: newVal, galbraith: newVal, labbe: newVal, contourFunnel: newVal, subgroup: newVal, sensitivity: newVal,
      metaReg: newVal, baujat: newVal, influence: newVal, loo: newVal, network: newVal, grade: newVal, rob: newVal, cumulative: newVal, doseResponse: newVal, methods: newVal, narrative: newVal,
    });
  };

  const handleExportHTML = () => {
    if (onExportReport) {
      trackEvent('export_html_custom', { studies: String(k), measure });
      trackMaCompleted(k, measure);
      onExportReport(sections);
    }
  };

  const handleExportDOCX = () => {
    if (onExportDOCX) {
      trackEvent('export_docx_custom', { studies: String(k), measure });
      trackMaCompleted(k, measure);
      onExportDOCX(sections);
    }
  };

  const handleExportMarkdown = () => {
    if (onExportMarkdown) {
      trackEvent('export_md_custom', { studies: String(k), measure });
      trackMaCompleted(k, measure);
      onExportMarkdown(sections);
    }
  };

  const formatP = (p: number) => {
    if (p < 0.001) return '< 0.001';
    return p.toFixed(3);
  };

  return (
    <div style={{ fontSize: 13, lineHeight: 1.8, color: '#374151' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: '#111827', margin: 0 }}>
          {t('results.title', lang)}
        </h3>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button onClick={() => setShowSections(!showSections)} style={sectionToggleBtnStyle}>
            {t('report.customize', lang)}
          </button>
          {onExportMarkdown && (
            <button onClick={handleExportMarkdown} style={exportBtnStyle}>
              {t('results.exportMD', lang)}
            </button>
          )}
          {onExportReport && (
            <button onClick={handleExportHTML} style={docxBtnStyle}>
              {t('results.exportReport', lang)}
            </button>
          )}
          {onExportDOCX && (
            <button onClick={handleExportDOCX} style={docxBtnStyle}>
              {t('results.exportDOCX', lang)}
            </button>
          )}
          {onExportJSON && (
            <button onClick={() => { trackEvent('export_json', { studies: String(k), measure }); onExportJSON(); }} style={jsonBtnStyle}>
              {t('results.exportJSON', lang)}
            </button>
          )}
        </div>
      </div>

      {/* Section selection panel */}
      {showSections && (
        <div style={{ background: '#f0f9ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '12px 16px', marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>{t('report.customize', lang)}</span>
            <label style={{ fontSize: 11, color: '#6b7280', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
              <input type="checkbox" checked={Object.values(sections).every(v => v)} onChange={toggleAllSections} />
              {t('report.selectAll', lang)}
            </label>
          </div>
          {sectionGroups.map((group) => {
            const groupKeyList = group.keys.map(k => k.key);
            const allGroupOn = groupKeyList.every(k => sections[k]);
            return (
              <div key={group.labelKey} style={{ marginBottom: 8 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.03em', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                  <input type="checkbox" checked={allGroupOn} onChange={() => toggleGroup(groupKeyList)} />
                  {t(group.labelKey, lang)}
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px 14px', paddingLeft: 18 }}>
                  {group.keys.map(({ key, labelKey }) => {
                    const available = dataAvailable[key] !== false;
                    return (
                      <label key={key} style={{ fontSize: 12, color: available ? '#374151' : '#9ca3af', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, minWidth: 130 }}>
                        <input type="checkbox" checked={sections[key]} onChange={() => toggleSection(key)} />
                        {t(labelKey, lang)}
                        {!available && <span style={{ fontSize: 10, color: '#d1d5db', marginLeft: 2 }}>({t('report.noData', lang)})</span>}
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Overall effect */}
      <div style={cardStyle}>
        <div style={cardTitleStyle}>{t('results.overallEffect', lang)}</div>
        <table style={tableStyle}>
          <tbody>
            <Row label={t('results.model', lang)} value={model === 'random' ? t('model.random', lang) : t('model.fixed', lang)} />
            <Row label={t('results.measure', lang)} value={measure} />
            <Row label={t('results.numStudies', lang)} value={k.toString()} />
            <Row label={`${t('results.pooled', lang)} ${measure}`} value={result.effect.toFixed(4)} />
            <Row label="95% CI" value={`[${result.ciLower.toFixed(4)}, ${result.ciUpper.toFixed(4)}]`} />
            <Row label="Z" value={result.z.toFixed(4)} />
            <Row label="P-value" value={formatP(result.pValue)} highlight={result.pValue < 0.05} />
            {result.predictionInterval && (
              <Row label={t('results.predictionInterval', lang)} value={`[${result.predictionInterval.lower.toFixed(4)}, ${result.predictionInterval.upper.toFixed(4)}]`} />
            )}
          </tbody>
        </table>
        {result.predictionInterval && (
          <p style={{ fontSize: 11, color: '#6b7280', marginTop: 6, fontStyle: 'italic' }}>
            {t('results.piNote', lang)}
          </p>
        )}
        {!result.predictionInterval && model === 'random' && k >= 3 ? null : !result.predictionInterval && (
          <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 6, fontStyle: 'italic' }}>
            {t('results.piNotAvailable', lang)}
          </p>
        )}
      </div>

      {/* Clinical Interpretation */}
      <EffectInterpretation effect={result.effect} ciLower={result.ciLower} ciUpper={result.ciUpper} pValue={result.pValue} measure={measure} lang={lang} />

      {/* NNT/NNH */}
      <NNTSection result={result} lang={lang} />

      {/* Heterogeneity */}
      <div style={cardStyle}>
        <div style={cardTitleStyle}>{t('results.heterogeneity', lang)}</div>
        <table style={tableStyle}>
          <tbody>
            <Row label="Cochran's Q" value={`${het.Q.toFixed(2)} (df = ${het.df})`} />
            <Row label="P-value (Q)" value={formatP(het.pValue)} highlight={het.pValue < 0.1} />
            <Row label="I\u00B2" value={`${het.I2.toFixed(1)}%`} highlight={het.I2 > 50} />
            <Row label={'\u03C4\u00B2'} value={het.tau2.toFixed(4)} />
            <Row label={'\u03C4'} value={het.tau.toFixed(4)} />
            <Row label="H\u00B2" value={het.H2.toFixed(2)} />
          </tbody>
        </table>
        <HeterogeneityInterpretation I2={het.I2} lang={lang} />
      </div>

      {/* Egger's test */}
      {eggers && (
        <div style={cardStyle}>
          <div style={cardTitleStyle}>{t('results.pubBias', lang)}</div>
          <table style={tableStyle}>
            <tbody>
              <Row label="Intercept" value={eggers.intercept.toFixed(4)} />
              <Row label="SE" value={eggers.se.toFixed(4)} />
              <Row label="t-value" value={eggers.tValue.toFixed(4)} />
              <Row label="P-value" value={formatP(eggers.pValue)} highlight={eggers.pValue < 0.05} />
              <Row label="df" value={eggers.df.toString()} />
            </tbody>
          </table>
          <p style={{ fontSize: 12, color: '#6b7280', marginTop: 8 }}>
            {eggers.pValue < 0.05
              ? t('results.asymmetryDetected', lang)
              : t('results.noAsymmetry', lang)}
          </p>
        </div>
      )}

      {/* Begg's test */}
      {beggs && (
        <div style={cardStyle}>
          <div style={cardTitleStyle}>{t('results.beggs', lang)}</div>
          <table style={tableStyle}>
            <tbody>
              <Row label="Kendall's \u03C4" value={beggs.tau.toFixed(4)} />
              <Row label="Z" value={beggs.z.toFixed(4)} />
              <Row label="P-value" value={formatP(beggs.pValue)} highlight={beggs.pValue < 0.05} />
              <Row label="k" value={beggs.k.toString()} />
            </tbody>
          </table>
          <p style={{ fontSize: 12, color: '#6b7280', marginTop: 8 }}>
            {beggs.pValue < 0.05
              ? t('results.beggsAsymmetry', lang)
              : t('results.beggsNoAsymmetry', lang)}
          </p>
        </div>
      )}

      {/* Meta-Regression */}
      {metaRegression && (
        <div style={cardStyle}>
          <div style={cardTitleStyle}>{t('metaReg.title', lang)}</div>
          <table style={tableStyle}>
            <tbody>
              <Row label={t('metaReg.covariate', lang)} value={`${metaRegression.covariate} (k = ${metaRegression.k})`} />
              <Row label={t('metaReg.coefficient', lang)} value={`${metaRegression.coefficient.toFixed(4)} (SE = ${metaRegression.se.toFixed(4)})`} />
              <Row label="Z" value={metaRegression.z.toFixed(4)} />
              <Row label="P-value" value={formatP(metaRegression.pValue)} highlight={metaRegression.pValue < 0.05} />
              <Row label={t('metaReg.intercept', lang)} value={metaRegression.intercept.toFixed(4)} />
              <Row label={t('metaReg.qModel', lang)} value={`${metaRegression.QModel.toFixed(2)} (p = ${formatP(metaRegression.QModelP)})`} highlight={metaRegression.QModelP < 0.05} />
              <Row label={t('metaReg.qResidual', lang)} value={`${metaRegression.QResidual.toFixed(2)} (df = ${metaRegression.QResidualDf}, p = ${formatP(metaRegression.QResidualP)})`} />
              <Row label={t('metaReg.r2', lang)} value={`${(metaRegression.R2 * 100).toFixed(1)}%`} />
            </tbody>
          </table>
          <p style={{ fontSize: 12, color: metaRegression.pValue < 0.05 ? '#dc2626' : '#16a34a', marginTop: 8, fontWeight: 500 }}>
            {metaRegression.pValue < 0.05 ? t('metaReg.significant', lang) : t('metaReg.notSignificant', lang)}
          </p>
        </div>
      )}

      {/* Methods paragraph (for manuscript) */}
      <MethodsParagraph result={result} eggers={eggers} subgroupResult={subgroupResult} sensitivityResults={sensitivityResults} lang={lang} />

      {/* Auto-generated paragraph (always in English for academic use) */}
      <div style={cardStyle}>
        <div style={cardTitleStyle}>{t('results.narrative', lang)}</div>
        <p style={{ fontSize: 13, lineHeight: 1.7, color: '#374151' }}>
          A {model === 'random' ? 'random-effects' : 'fixed-effect'} meta-analysis
          of {k} studies was performed using the {
            model === 'random' ? 'DerSimonian-Laird' : 'inverse variance'
          } method. The pooled {measure} was {result.effect.toFixed(2)} (95% CI: {result.ciLower.toFixed(2)}&ndash;{result.ciUpper.toFixed(2)}; Z = {result.z.toFixed(2)}, P {result.pValue < 0.001 ? '< 0.001' : `= ${result.pValue.toFixed(3)}`}), {result.pValue < 0.05 ? 'indicating a statistically significant effect' : 'showing no statistically significant effect'}.
          Heterogeneity was {het.I2 < 25 ? 'low' : het.I2 < 50 ? 'moderate' : het.I2 < 75 ? 'substantial' : 'considerable'} (I{'\u00B2'} = {het.I2.toFixed(1)}%, Q = {het.Q.toFixed(2)}, df = {het.df}, P {het.pValue < 0.001 ? '< 0.001' : `= ${het.pValue.toFixed(3)}`}; {'\u03C4\u00B2'} = {het.tau2.toFixed(4)}).
          {result.predictionInterval ? ` The 95% prediction interval was ${result.predictionInterval.lower.toFixed(2)}\u2013${result.predictionInterval.upper.toFixed(2)}, indicating the range of effects expected in a new study (Riley et al., 2011).` : ''}
          {eggers ? ` Egger's regression test ${eggers.pValue < 0.05 ? 'indicated significant' : 'did not indicate'} funnel plot asymmetry (intercept = ${eggers.intercept.toFixed(2)}, P = ${formatP(eggers.pValue)}).` : ''}
          {sensitivityResults.length > 0 && (() => {
            const influential = sensitivityResults.filter(r => {
              const isRatio = measure === 'OR' || measure === 'RR' || measure === 'HR';
              const dirChanged = isRatio ? (r.effect > 1) !== (result.effect > 1) : (r.effect > 0) !== (result.effect > 0);
              const origSig = isRatio ? (result.ciLower > 1 || result.ciUpper < 1) : (result.ciLower > 0 || result.ciUpper < 0);
              const newSig = isRatio ? (r.ciLower > 1 || r.ciUpper < 1) : (r.ciLower > 0 || r.ciUpper < 0);
              return dirChanged || origSig !== newSig;
            });
            if (influential.length === 0) {
              return ` Leave-one-out sensitivity analysis showed that the pooled estimate was robust; no single study substantially altered the overall result.`;
            }
            return ` Leave-one-out sensitivity analysis identified ${influential.length} influential ${influential.length === 1 ? 'study' : 'studies'} (${influential.map(r => r.omittedStudy).join(', ')}) whose removal altered the direction or statistical significance of the pooled estimate.`;
          })()}
          {subgroupResult && subgroupResult.subgroups.length > 1 && (() => {
            const sg = subgroupResult;
            const sgNames = sg.subgroups.map(s => s.name || 'Ungrouped');
            const sgEffects = sg.subgroups.map(s =>
              `${s.name || 'Ungrouped'} (${measure} = ${s.result.effect.toFixed(2)}, 95% CI: ${s.result.ciLower.toFixed(2)}\u2013${s.result.ciUpper.toFixed(2)}, k = ${s.result.studies.length})`
            );
            const testSig = sg.test.pValue < 0.05;
            return ` Subgroup analysis by ${sgNames.join(' vs ')} revealed ${sgEffects.join('; ')}. The test for subgroup differences ${testSig ? 'was statistically significant' : 'was not statistically significant'} (Q = ${sg.test.Q.toFixed(2)}, df = ${sg.test.df}, P ${sg.test.pValue < 0.001 ? '< 0.001' : `= ${sg.test.pValue.toFixed(3)}`})${testSig ? ', suggesting effect modification across subgroups' : ', indicating no significant effect modification'}.`;
          })()}
          {(() => {
            const nntResult = calculateNNT(result, useProjectStore.getState().studies);
            if (!nntResult) return '';
            const label = nntResult.isHarm ? 'NNH' : 'NNT';
            const nntRounded = Math.ceil(nntResult.nnt);
            return ` The ${label} was ${nntRounded} (95% CI: ${Math.ceil(nntResult.nntCILower)}\u2013${isFinite(nntResult.nntCIUpper) ? Math.ceil(nntResult.nntCIUpper) : '\u221E'}), based on a control event rate of ${(nntResult.controlEventRate * 100).toFixed(1)}%.`;
          })()}
        </p>
      </div>

      {/* Email subscription CTA */}
      <ResultsEmailCTA lang={lang} />
    </div>
  );
}

function MethodsParagraph({ result, eggers, subgroupResult, sensitivityResults, lang }: {
  result: MetaAnalysisResult;
  eggers: EggersTest | null;
  subgroupResult: SubgroupAnalysisResult | null;
  sensitivityResults: SensitivityResult[];
  lang: Lang;
}) {
  const { pico, measure, model } = useProjectStore();
  const [copied, setCopied] = useState(false);
  const k = result.studies.length;

  // Build methods paragraph following PRISMA 2020 reporting guidelines
  const parts: string[] = [];

  // 1. Study design
  parts.push('A systematic review and meta-analysis was conducted following the PRISMA 2020 guidelines.');

  // 2. PICO context (if filled)
  if (pico.population || pico.intervention || pico.comparison || pico.outcome) {
    const picoDesc = [
      pico.intervention && pico.comparison
        ? `the ${measure === 'OR' || measure === 'RR' || measure === 'HR' ? 'association between' : 'effect of'} ${pico.intervention} ${measure === 'OR' || measure === 'RR' || measure === 'HR' ? 'and' : 'compared with'} ${pico.comparison}`
        : null,
      pico.outcome ? `on ${pico.outcome}` : null,
      pico.population ? `in ${pico.population}` : null,
    ].filter(Boolean).join(' ');
    if (picoDesc) {
      parts.push(`The aim was to evaluate ${picoDesc}.`);
    }
  }

  // 3. Statistical methods
  const modelName = model === 'random' ? 'random-effects' : 'fixed-effect';
  const estimator = model === 'random' ? 'DerSimonian-Laird' : 'inverse variance';
  const measureFull: Record<string, string> = {
    OR: 'odds ratios (ORs)',
    RR: 'risk ratios (RRs)',
    HR: 'hazard ratios (HRs)',
    MD: 'mean differences (MDs)',
    SMD: 'standardized mean differences (SMDs)',
  };
  parts.push(
    `A ${modelName} model with the ${estimator} estimator was used to pool effect sizes across ${k} studies. Results were expressed as ${measureFull[measure] || measure} with 95% confidence intervals (CIs).`
  );

  // 4. Heterogeneity assessment
  parts.push(
    "Statistical heterogeneity was assessed using Cochran's Q test and quantified with the I\u00B2 statistic, where I\u00B2 values of 25%, 50%, and 75% were interpreted as low, moderate, and high heterogeneity, respectively (Higgins et al., 2003)."
  );

  // 5. Publication bias
  if (eggers) {
    parts.push(
      "Publication bias was evaluated by visual inspection of funnel plot asymmetry and formally tested using Egger's linear regression test."
    );
  }

  // 6. Sensitivity analysis
  if (sensitivityResults.length > 0) {
    parts.push(
      'Sensitivity analysis was performed using the leave-one-out method, whereby each study was sequentially removed to assess its influence on the pooled estimate.'
    );
  }

  // 7. Subgroup analysis
  if (subgroupResult && subgroupResult.subgroups.length > 1) {
    parts.push(
      'Subgroup analysis was conducted to explore potential sources of heterogeneity, and the test for subgroup differences (Q-between) was used to evaluate effect modification.'
    );
  }

  // 8. Software
  parts.push(
    'All analyses were performed using MetaReview (https://metareview.cc/), an open-source online meta-analysis platform. A two-sided P value < 0.05 was considered statistically significant.'
  );

  const methodsText = parts.join(' ');

  const handleCopy = () => {
    navigator.clipboard.writeText(methodsText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={cardTitleStyle}>{t('results.methods', lang)}</div>
        <button onClick={handleCopy} style={copyBtnStyle}>
          {copied ? t('results.methods.copy', lang) : 'Copy'}
        </button>
      </div>
      <p style={{ fontSize: 13, lineHeight: 1.7, color: '#374151' }}>
        {methodsText}
      </p>
    </div>
  );
}

function NNTSection({ result, lang }: { result: MetaAnalysisResult; lang: Lang }) {
  const { studies } = useProjectStore();
  const nntResult = calculateNNT(result, studies);
  if (!nntResult) return null;

  const label = nntResult.isHarm ? t('results.nnt.nnh', lang) : t('results.nnt.nnt', lang);
  const interpKey = nntResult.isHarm ? 'results.nnt.interp.harm' : 'results.nnt.interp.benefit';
  const nntRounded = Math.ceil(nntResult.nnt);
  const interp = t(interpKey, lang).replace('{nnt}', nntRounded.toString());
  const ciCrossesNull = !isFinite(nntResult.nntCIUpper);

  const formatCI = () => {
    const lower = Math.ceil(nntResult.nntCILower);
    if (ciCrossesNull) return `[${lower}, \u221E]`;
    const upper = Math.ceil(nntResult.nntCIUpper);
    return `[${lower}, ${upper}]`;
  };

  return (
    <div style={{ ...cardStyle, background: nntResult.isHarm ? '#fef2f2' : '#f0fdf4', borderColor: nntResult.isHarm ? '#fecaca' : '#bbf7d0' }}>
      <div style={cardTitleStyle}>{t('results.nnt.title', lang)}</div>
      <table style={tableStyle}>
        <tbody>
          <Row label={label} value={nntRounded.toString()} highlight />
          <Row label="95% CI" value={formatCI()} />
          <Row label={t('results.nnt.ard', lang)} value={`${(nntResult.absoluteRiskDifference * 100).toFixed(2)}%`} />
          <Row label={t('results.nnt.cer', lang)} value={`${(nntResult.controlEventRate * 100).toFixed(2)}%`} />
          <Row label={t('results.nnt.eer', lang)} value={`${(nntResult.experimentalEventRate * 100).toFixed(2)}%`} />
        </tbody>
      </table>
      <p style={{ fontSize: 13, fontWeight: 500, color: nntResult.isHarm ? '#dc2626' : '#16a34a', marginTop: 8 }}>
        {interp}
      </p>
      {ciCrossesNull && (
        <p style={{ fontSize: 11, color: '#92400e', marginTop: 4, fontStyle: 'italic' }}>
          {t('results.nnt.ciNote', lang)}
        </p>
      )}
      <p style={{ fontSize: 11, color: '#6b7280', marginTop: 4, fontStyle: 'italic' }}>
        {t('results.nnt.note', lang)}
      </p>
    </div>
  );
}

function EffectInterpretation({ effect, ciLower, ciUpper, pValue, measure, lang }: {
  effect: number; ciLower: number; ciUpper: number; pValue: number; measure: string; lang: Lang;
}) {
  const isRatio = measure === 'OR' || measure === 'RR' || measure === 'HR';
  const nullVal = isRatio ? 1 : 0;

  // Direction
  let dirKey: string;
  let dirColor: string;
  if (isRatio) {
    if (Math.abs(effect - 1) < 0.0001) { dirKey = 'interp.ratio.null'; dirColor = '#6b7280'; }
    else if (effect < 1) { dirKey = 'interp.ratio.favor.treatment'; dirColor = '#16a34a'; }
    else { dirKey = 'interp.ratio.favor.control'; dirColor = '#dc2626'; }
  } else {
    if (Math.abs(effect) < 0.0001) { dirKey = 'interp.diff.null'; dirColor = '#6b7280'; }
    else if (effect < 0) { dirKey = 'interp.diff.favor.treatment'; dirColor = '#16a34a'; }
    else { dirKey = 'interp.diff.favor.control'; dirColor = '#dc2626'; }
  }

  // Magnitude
  let magText: string;
  let magColor: string;
  if (isRatio) {
    const logEffect = Math.abs(Math.log(effect));
    if (logEffect < 0.223) { magText = t('interp.ratio.small', lang); magColor = '#16a34a'; } // ~OR 1.25
    else if (logEffect < 0.693) { magText = t('interp.ratio.moderate', lang); magColor = '#ca8a04'; } // ~OR 2.0
    else { magText = t('interp.ratio.large', lang); magColor = '#dc2626'; }
  } else if (measure === 'SMD') {
    const absD = Math.abs(effect);
    if (absD < 0.5) { magText = t('interp.smd.small', lang); magColor = '#16a34a'; }
    else if (absD < 0.8) { magText = t('interp.smd.medium', lang); magColor = '#ca8a04'; }
    else { magText = t('interp.smd.large', lang); magColor = '#dc2626'; }
  } else {
    // MD — no universal threshold, skip magnitude
    magText = '';
    magColor = '#6b7280';
  }

  // CI crosses null?
  const ciCrossesNull = isRatio
    ? (ciLower <= nullVal && ciUpper >= nullVal)
    : (ciLower <= nullVal && ciUpper >= nullVal);

  const isSig = pValue < 0.05;

  return (
    <div style={{ ...cardStyle, background: '#fefce8', borderColor: '#fde68a' }}>
      <div style={cardTitleStyle}>{t('interp.title', lang)}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {/* Direction */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: '#6b7280', minWidth: 70 }}>{t('interp.direction', lang)}:</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: dirColor }}>
            {t(dirKey, lang).replace('{measure}', measure)}
          </span>
        </div>
        {/* Magnitude */}
        {magText && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: '#6b7280', minWidth: 70 }}>{t('interp.magnitude', lang)}:</span>
            <span style={{ fontSize: 13, fontWeight: 500, color: magColor }}>{magText}</span>
          </div>
        )}
        {/* Statistical significance */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: '#6b7280', minWidth: 70 }}>{t('interp.significance', lang)}:</span>
          <span style={{ fontSize: 13, fontWeight: 500, color: isSig ? '#16a34a' : '#9ca3af' }}>
            {isSig ? t('interp.sig.yes', lang) : t('interp.sig.no', lang)}
          </span>
        </div>
        {/* CI interpretation */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: '#6b7280', minWidth: 70 }}>95% CI:</span>
          <span style={{ fontSize: 13, color: ciCrossesNull ? '#dc2626' : '#16a34a' }}>
            {ciCrossesNull ? t('interp.ciCross', lang) : t('interp.ciNoCross', lang)}
          </span>
        </div>
      </div>
      <p style={{ fontSize: 11, color: '#92400e', marginTop: 8, fontStyle: 'italic' }}>
        {t('interp.note', lang)}
      </p>
    </div>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <tr>
      <td style={{ padding: '4px 12px 4px 0', color: '#6b7280', whiteSpace: 'nowrap' }}>{label}</td>
      <td style={{
        padding: '4px 0',
        fontFamily: 'monospace',
        fontWeight: highlight ? 600 : 400,
        color: highlight ? '#dc2626' : '#111827',
      }}>
        {value}
      </td>
    </tr>
  );
}

function HeterogeneityInterpretation({ I2, lang }: { I2: number; lang: Lang }) {
  let key: string;
  let color: string;
  let bg: string;
  if (I2 < 25) { key = 'het.low'; color = '#16a34a'; bg = '#f0fdf4'; }
  else if (I2 < 50) { key = 'het.moderate'; color = '#ca8a04'; bg = '#fefce8'; }
  else if (I2 < 75) { key = 'het.substantial'; color = '#ea580c'; bg = '#fff7ed'; }
  else { key = 'het.considerable'; color = '#dc2626'; bg = '#fef2f2'; }

  return (
    <div style={{ marginTop: 8, padding: '8px 12px', background: bg, borderRadius: 6, borderLeft: `3px solid ${color}` }}>
      <p style={{ fontSize: 12, color, fontWeight: 600, margin: 0 }}>
        {t(key, lang)} (I² = {I2.toFixed(1)}%)
      </p>
      <p style={{ fontSize: 11, color: '#4b5563', margin: '4px 0 0 0' }}>
        {t(`${key}.desc`, lang)}
      </p>
      <p style={{ fontSize: 10, color: '#9ca3af', margin: '4px 0 0 0', fontStyle: 'italic' }}>
        Higgins et al., 2003
      </p>
    </div>
  );
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function ResultsEmailCTA({ lang }: { lang: Lang }) {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'submitting' | 'success' | 'already' | 'error' | 'invalid'>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!EMAIL_REGEX.test(email)) { setState('invalid'); return; }
    setState('submitting');
    try {
      const res = await fetch('/api/emails/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, source: 'results', lang }),
      });
      const data = await res.json();
      if (data.ok) {
        setState(data.already ? 'already' : 'success');
        trackFeature('email_subscribe_results');
      } else {
        setState(data.error === 'invalid_email' ? 'invalid' : 'error');
      }
    } catch { setState('error'); }
  };

  if (state === 'success' || state === 'already') {
    return (
      <div style={{ ...cardStyle, background: '#ecfdf5', borderColor: '#a7f3d0', textAlign: 'center' }}>
        <p style={{ fontSize: 13, color: '#065f46', fontWeight: 500, margin: 0 }}>
          {t(state === 'already' ? 'email.already' : 'email.success', lang)}
        </p>
      </div>
    );
  }

  return (
    <div style={{ ...cardStyle, background: '#f0f9ff', borderColor: '#bfdbfe' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ flex: '1 1 200px', minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', marginBottom: 2 }}>
            {t('email.results.title', lang)}
          </div>
          <div style={{ fontSize: 12, color: '#4b5563', lineHeight: 1.4 }}>
            {t('email.results.desc', lang)}
          </div>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 6, flex: '0 0 auto' }}>
          <input
            type="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); if (state === 'invalid' || state === 'error') setState('idle'); }}
            placeholder={t('email.placeholder', lang)}
            style={{ padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 12, width: 180, outline: 'none' }}
          />
          <button type="submit" disabled={state === 'submitting'} style={{ padding: '6px 14px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: state === 'submitting' ? 0.7 : 1, whiteSpace: 'nowrap' }}>
            {t(state === 'submitting' ? 'email.submitting' : 'email.submit', lang)}
          </button>
        </form>
      </div>
      {state === 'invalid' && <p style={{ fontSize: 11, color: '#dc2626', margin: '6px 0 0' }}>{t('email.invalid', lang)}</p>}
      {state === 'error' && <p style={{ fontSize: 11, color: '#dc2626', margin: '6px 0 0' }}>{t('email.error', lang)}</p>}
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  background: '#f9fafb',
  border: '1px solid #e5e7eb',
  borderRadius: 8,
  padding: '14px 18px',
  marginBottom: 12,
};

const cardTitleStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: '#111827',
  marginBottom: 8,
};

const tableStyle: React.CSSProperties = {
  fontSize: 13,
};

const copyBtnStyle: React.CSSProperties = {
  padding: '4px 10px',
  background: '#f3f4f6',
  color: '#374151',
  border: '1px solid #d1d5db',
  borderRadius: 4,
  fontSize: 11,
  cursor: 'pointer',
};

const exportBtnStyle: React.CSSProperties = {
  padding: '7px 16px',
  background: '#2563eb',
  color: '#fff',
  border: 'none',
  borderRadius: 6,
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
};

const docxBtnStyle: React.CSSProperties = {
  padding: '7px 16px',
  background: '#16a34a',
  color: '#fff',
  border: 'none',
  borderRadius: 6,
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
};

const jsonBtnStyle: React.CSSProperties = {
  padding: '7px 16px',
  background: '#7c3aed',
  color: '#fff',
  border: 'none',
  borderRadius: 6,
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
};

const sectionToggleBtnStyle: React.CSSProperties = {
  padding: '7px 14px',
  background: '#f3f4f6',
  color: '#374151',
  border: '1px solid #d1d5db',
  borderRadius: 6,
  fontSize: 12,
  cursor: 'pointer',
};
