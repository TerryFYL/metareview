import { useCallback, useMemo, useState } from 'react';
import { useProjectStore, useUIStore } from './store';
import PICOForm from './components/PICOForm';
import DataTable from './components/DataTable';
import ForestPlot from './components/ForestPlot';
import FunnelPlot from './components/FunnelPlot';
import ResultsSummary from './components/ResultsSummary';
import SensitivityTable from './components/SensitivityTable';
import PRISMAFlow from './components/PRISMAFlow';
import LiteratureSearch from './components/LiteratureSearch';
import { metaAnalysis, eggersTest, sensitivityAnalysis, subgroupAnalysis, isBinaryData, isContinuousData } from './lib/statistics';
import { generateReportHTML } from './lib/report-export';
import { t } from './lib/i18n';
import type { EffectMeasure, ModelType, Study, BinaryData, ContinuousData, SubgroupAnalysisResult } from './lib/types';

const MEASURES: { value: EffectMeasure; label: string; desc: string }[] = [
  { value: 'OR', label: 'Odds Ratio', desc: 'Binary outcomes (2\u00D72 table)' },
  { value: 'RR', label: 'Risk Ratio', desc: 'Binary outcomes (2\u00D72 table)' },
  { value: 'MD', label: 'Mean Difference', desc: 'Continuous outcomes (mean, SD, n)' },
  { value: 'SMD', label: "Hedges' g (SMD)", desc: 'Continuous, different scales' },
];

const TAB_KEYS = ['search', 'input', 'results', 'forest', 'funnel', 'sensitivity', 'subgroup', 'prisma'] as const;

export default function App() {
  const {
    title, pico, measure, model, studies, prisma,
    setTitle, setPICO, setMeasure, setModel, setStudies, setPRISMA, reset, loadDemo,
  } = useProjectStore();

  const {
    lang, result, eggers, error, activeTab,
    setLang, setResult, setEggers, setError, setActiveTab,
  } = useUIStore();

  const [subgroupResult, setSubgroupResult] = useState<SubgroupAnalysisResult | null>(null);

  const validateStudies = useCallback((studyList: Study[]): string | null => {
    for (let i = 0; i < studyList.length; i++) {
      const s = studyList[i];
      const name = s.name || `#${i + 1}`;
      if (!s.name.trim()) {
        return t('input.studyNameMissing', lang).replace('{index}', String(i + 1));
      }
      if (isBinaryData(s.data)) {
        const d = s.data as BinaryData;
        if (d.total1 <= 0 || d.total2 <= 0) {
          return t('input.invalidBinaryTotal', lang).replace('{name}', name);
        }
        if (d.events1 < 0 || d.events2 < 0 || d.events1 > d.total1 || d.events2 > d.total2) {
          return t('input.invalidBinaryEvents', lang).replace('{name}', name);
        }
      } else if (isContinuousData(s.data)) {
        const d = s.data as ContinuousData;
        if (d.n1 <= 0 || d.n2 <= 0) {
          return t('input.invalidContinuousN', lang).replace('{name}', name);
        }
        if (d.sd1 <= 0 || d.sd2 <= 0) {
          return t('input.invalidContinuousSD', lang).replace('{name}', name);
        }
      }
    }
    return null;
  }, [lang]);

  const runAnalysis = useCallback(() => {
    setError(null);
    try {
      if (studies.length < 2) {
        setError(t('input.minStudies', lang));
        return;
      }
      const validationError = validateStudies(studies);
      if (validationError) {
        setError(validationError);
        return;
      }
      const res = metaAnalysis(studies, measure, model);
      setResult(res);
      setEggers(eggersTest(res.studies));
      // Subgroup analysis: only if at least one study has a subgroup defined
      const hasSubgroups = studies.some((s) => s.subgroup?.trim());
      if (hasSubgroups) {
        const sgResult = subgroupAnalysis(studies, measure, model);
        setSubgroupResult(sgResult);
      } else {
        setSubgroupResult(null);
      }
      setActiveTab('results');
    } catch (e) {
      setError(e instanceof Error ? e.message : t('input.analysisFailed', lang));
      setResult(null);
      setEggers(null);
      setSubgroupResult(null);
    }
  }, [studies, measure, model, lang, validateStudies, setResult, setEggers, setError, setActiveTab]);

  const sensitivityResults = useMemo(() => {
    if (!result || studies.length < 3) return [];
    return sensitivityAnalysis(studies, measure, model);
  }, [result, studies, measure, model]);

  const downloadSVG = useCallback(() => {
    const svg = document.querySelector('.forest-plot-container svg');
    if (!svg) return;
    const serializer = new XMLSerializer();
    const source = serializer.serializeToString(svg);
    const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `forest-plot-${title || 'metareview'}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }, [title]);

  const exportReport = useCallback(() => {
    if (!result) return;
    const serializer = new XMLSerializer();
    const forestEl = document.querySelector('.forest-plot-container svg');
    const funnelEl = document.querySelector('.funnel-plot-container svg');
    const forestSvg = forestEl ? serializer.serializeToString(forestEl) : null;
    const funnelSvg = funnelEl ? serializer.serializeToString(funnelEl) : null;
    const html = generateReportHTML({
      title,
      pico,
      result,
      eggers,
      subgroupResult,
      sensitivityResults,
      forestSvg,
      funnelSvg,
    });
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }, [result, title, pico, eggers, subgroupResult, sensitivityResults]);

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 16px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      {/* Header */}
      <header style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#111827', margin: 0 }}>
            MetaReview
          </h1>
          <p style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
            {t('header.subtitle', lang)}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')}
            style={langBtnStyle}
            title={lang === 'zh' ? 'Switch to English' : '切换到中文'}
          >
            {lang === 'zh' ? 'EN' : '中文'}
          </button>
          <button onClick={loadDemo} style={secondaryBtnStyle}>
            {t('header.loadDemo', lang)}
          </button>
          <button onClick={reset} style={secondaryBtnStyle}>
            {t('header.newAnalysis', lang)}
          </button>
        </div>
      </header>

      {/* Tab navigation */}
      <nav style={{ display: 'flex', gap: 0, borderBottom: '2px solid #e5e7eb', marginBottom: 20, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        {TAB_KEYS.map((tab) => {
          const isAlwaysEnabled = tab === 'prisma' || tab === 'search' || tab === 'input';
          const isSubgroup = tab === 'subgroup';
          const isSensitivity = tab === 'sensitivity';
          const disabled = !isAlwaysEnabled && (
            !result
            || (isSensitivity && studies.length < 3)
            || (isSubgroup && !subgroupResult)
          );
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '10px 16px',
                border: 'none',
                borderBottom: activeTab === tab ? '2px solid #2563eb' : '2px solid transparent',
                background: 'none',
                cursor: disabled ? 'default' : 'pointer',
                fontSize: 13,
                fontWeight: activeTab === tab ? 600 : 400,
                color: disabled ? '#d1d5db' : activeTab === tab ? '#2563eb' : '#6b7280',
                marginBottom: -2,
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
              disabled={disabled}
            >
              {t(`tab.${tab}`, lang)}
            </button>
          );
        })}
      </nav>

      {/* Literature Search Tab */}
      {activeTab === 'search' && (
        <LiteratureSearch
          lang={lang}
          measure={measure}
          studies={studies}
          pico={pico}
          onStudiesChange={setStudies}
          onSwitchToInput={() => setActiveTab('input')}
          onPRISMAUpdate={(updates) => setPRISMA({ ...prisma, ...updates })}
        />
      )}

      {/* Data Input Tab */}
      {activeTab === 'input' && (
        <div>
          {/* Title */}
          <section style={sectionStyle}>
            <label style={labelStyle}>{t('input.title', lang)}</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('input.titlePlaceholder', lang)}
              style={{ ...textInputStyle, fontSize: 15, fontWeight: 500 }}
            />
          </section>

          {/* PICO */}
          <section style={sectionStyle}>
            <h2 style={h2Style}>{t('input.pico', lang)}</h2>
            <PICOForm pico={pico} onChange={setPICO} lang={lang} />
          </section>

          {/* Settings */}
          <section style={sectionStyle}>
            <h2 style={h2Style}>{t('input.settings', lang)}</h2>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 260px', minWidth: 0 }}>
                <label style={labelStyle}>{t('input.measure', lang)}</label>
                <select
                  value={measure}
                  onChange={(e) => setMeasure(e.target.value as EffectMeasure)}
                  style={selectStyle}
                >
                  {MEASURES.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label} — {m.desc}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ flex: '1 1 260px', minWidth: 0 }}>
                <label style={labelStyle}>{t('input.model', lang)}</label>
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value as ModelType)}
                  style={selectStyle}
                >
                  <option value="random">{t('model.random', lang)}</option>
                  <option value="fixed">{t('model.fixed', lang)}</option>
                </select>
              </div>
            </div>
          </section>

          {/* Data Table */}
          <section style={sectionStyle}>
            <h2 style={h2Style}>{t('input.studyData', lang)}</h2>
            <DataTable studies={studies} measure={measure} onStudiesChange={setStudies} lang={lang} />
          </section>

          {/* Error */}
          {error && (
            <div style={{ padding: '10px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, color: '#dc2626', fontSize: 13, marginBottom: 16 }}>
              {error}
            </div>
          )}

          {/* Run button */}
          <button onClick={runAnalysis} style={primaryBtnStyle} disabled={studies.length < 2}>
            {t('input.runAnalysis', lang)}
          </button>
        </div>
      )}

      {/* Results Tab */}
      {activeTab === 'results' && result && (
        <ResultsSummary result={result} eggers={eggers} subgroupResult={subgroupResult} sensitivityResults={sensitivityResults} lang={lang} onExportReport={exportReport} />
      )}

      {/* Forest Plot Tab */}
      {activeTab === 'forest' && result && (
        <div>
          <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={downloadSVG} style={secondaryBtnStyle}>
              {t('forest.download', lang)}
            </button>
          </div>
          <div className="forest-plot-container">
            <ForestPlot result={result} subgroupResult={subgroupResult} title={title || 'Forest Plot'} lang={lang} />
          </div>
        </div>
      )}

      {/* Funnel Plot Tab */}
      {activeTab === 'funnel' && result && (
        <div className="funnel-plot-container" style={{ display: 'flex', justifyContent: 'center', overflowX: 'auto' }}>
          <FunnelPlot result={result} />
        </div>
      )}

      {/* Sensitivity Analysis Tab */}
      {activeTab === 'sensitivity' && result && sensitivityResults.length > 0 && (
        <SensitivityTable results={sensitivityResults} fullResult={result} lang={lang} />
      )}

      {/* Subgroup Analysis Tab */}
      {activeTab === 'subgroup' && result && subgroupResult && (
        <div>
          <h2 style={h2Style}>{t('subgroup.title', lang)}</h2>

          {/* Subgroup comparison table */}
          <div style={{ overflowX: 'auto', marginBottom: 20 }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13, minWidth: 500 }}>
              <thead>
                <tr>
                  <th style={sgThStyle}>{lang === 'zh' ? '亚组' : 'Subgroup'}</th>
                  <th style={sgThStyle}>k</th>
                  <th style={sgThStyle}>{result.measure} [95% CI]</th>
                  <th style={sgThStyle}>I²</th>
                  <th style={sgThStyle}>p</th>
                </tr>
              </thead>
              <tbody>
                {subgroupResult.subgroups.map((sg, i) => (
                  <tr key={sg.name} style={{ background: i % 2 ? '#f9fafb' : '#fff' }}>
                    <td style={sgTdStyle}>{sg.name || (lang === 'zh' ? '未分组' : 'Ungrouped')}</td>
                    <td style={sgTdStyle}>{sg.result.studies.length}</td>
                    <td style={{ ...sgTdStyle, fontFamily: 'monospace' }}>
                      {sg.result.effect.toFixed(2)} [{sg.result.ciLower.toFixed(2)}, {sg.result.ciUpper.toFixed(2)}]
                    </td>
                    <td style={sgTdStyle}>{sg.result.heterogeneity.I2.toFixed(1)}%</td>
                    <td style={sgTdStyle}>{sg.result.pValue < 0.001 ? '< 0.001' : sg.result.pValue.toFixed(3)}</td>
                  </tr>
                ))}
                <tr style={{ background: '#f0f9ff', fontWeight: 600 }}>
                  <td style={sgTdStyle}>{t('subgroup.overall', lang)}</td>
                  <td style={sgTdStyle}>{result.studies.length}</td>
                  <td style={{ ...sgTdStyle, fontFamily: 'monospace' }}>
                    {result.effect.toFixed(2)} [{result.ciLower.toFixed(2)}, {result.ciUpper.toFixed(2)}]
                  </td>
                  <td style={sgTdStyle}>{result.heterogeneity.I2.toFixed(1)}%</td>
                  <td style={sgTdStyle}>{result.pValue < 0.001 ? '< 0.001' : result.pValue.toFixed(3)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Test for subgroup differences */}
          <div style={{
            padding: '12px 16px',
            background: subgroupResult.test.pValue < 0.05 ? '#fef2f2' : '#f0fdf4',
            border: `1px solid ${subgroupResult.test.pValue < 0.05 ? '#fecaca' : '#bbf7d0'}`,
            borderRadius: 8,
            marginBottom: 20,
          }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, margin: '0 0 6px', color: '#111827' }}>
              {t('subgroup.testTitle', lang)}
            </h3>
            <p style={{ fontSize: 13, color: '#374151', margin: 0 }}>
              {t('subgroup.qBetween', lang)} = {subgroupResult.test.Q.toFixed(2)},
              {' '}df = {subgroupResult.test.df},
              {' '}p = {subgroupResult.test.pValue < 0.001 ? '< 0.001' : subgroupResult.test.pValue.toFixed(3)}
            </p>
            <p style={{ fontSize: 12, color: subgroupResult.test.pValue < 0.05 ? '#dc2626' : '#16a34a', margin: '4px 0 0', fontWeight: 500 }}>
              {subgroupResult.test.pValue < 0.05
                ? t('subgroup.significant', lang)
                : t('subgroup.notSignificant', lang)}
            </p>
          </div>
        </div>
      )}

      {/* PRISMA Flow Tab */}
      {activeTab === 'prisma' && (
        <PRISMAFlow data={prisma} onChange={setPRISMA} lang={lang} />
      )}

      {/* Footer */}
      <footer style={{ marginTop: 48, padding: '16px 0', borderTop: '1px solid #e5e7eb', fontSize: 12, color: '#9ca3af', textAlign: 'center', display: 'flex', justifyContent: 'center', gap: 16, flexWrap: 'wrap' }}>
        <span>{t('footer.text', lang)}</span>
        <a href="https://github.com/TerryFYL/metareview/issues" target="_blank" rel="noopener noreferrer" style={{ color: '#6b7280', textDecoration: 'underline' }}>
          {t('footer.feedback', lang)}
        </a>
      </footer>
    </div>
  );
}

const sectionStyle: React.CSSProperties = { marginBottom: 24 };
const h2Style: React.CSSProperties = { fontSize: 15, fontWeight: 600, color: '#111827', marginBottom: 12 };
const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 };

const textInputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 14px',
  border: '1px solid #d1d5db',
  borderRadius: 6,
  outline: 'none',
  boxSizing: 'border-box',
};

const selectStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  border: '1px solid #d1d5db',
  borderRadius: 6,
  fontSize: 13,
  outline: 'none',
  background: '#fff',
};

const primaryBtnStyle: React.CSSProperties = {
  padding: '11px 28px',
  background: '#2563eb',
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
};

const secondaryBtnStyle: React.CSSProperties = {
  padding: '7px 14px',
  background: '#f3f4f6',
  color: '#374151',
  border: '1px solid #d1d5db',
  borderRadius: 6,
  fontSize: 12,
  cursor: 'pointer',
};

const langBtnStyle: React.CSSProperties = {
  padding: '6px 12px',
  background: '#fff',
  color: '#2563eb',
  border: '1px solid #2563eb',
  borderRadius: 6,
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
};

const sgThStyle: React.CSSProperties = {
  padding: '8px 10px',
  borderBottom: '2px solid #e5e7eb',
  textAlign: 'left',
  fontSize: 12,
  fontWeight: 600,
  color: '#6b7280',
};

const sgTdStyle: React.CSSProperties = {
  padding: '8px 10px',
  borderBottom: '1px solid #f3f4f6',
  fontSize: 13,
};
