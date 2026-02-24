import { useCallback, useMemo } from 'react';
import { useProjectStore, useUIStore } from './store';
import PICOForm from './components/PICOForm';
import DataTable from './components/DataTable';
import ForestPlot from './components/ForestPlot';
import FunnelPlot from './components/FunnelPlot';
import ResultsSummary from './components/ResultsSummary';
import SensitivityTable from './components/SensitivityTable';
import { metaAnalysis, eggersTest, sensitivityAnalysis } from './lib/statistics';
import { t } from './lib/i18n';
import type { EffectMeasure, ModelType } from './lib/types';

const MEASURES: { value: EffectMeasure; label: string; desc: string }[] = [
  { value: 'OR', label: 'Odds Ratio', desc: 'Binary outcomes (2\u00D72 table)' },
  { value: 'RR', label: 'Risk Ratio', desc: 'Binary outcomes (2\u00D72 table)' },
  { value: 'MD', label: 'Mean Difference', desc: 'Continuous outcomes (mean, SD, n)' },
  { value: 'SMD', label: "Hedges' g (SMD)", desc: 'Continuous, different scales' },
];

const TAB_KEYS = ['input', 'results', 'forest', 'funnel', 'sensitivity'] as const;

export default function App() {
  const {
    title, pico, measure, model, studies,
    setTitle, setPICO, setMeasure, setModel, setStudies, reset, loadDemo,
  } = useProjectStore();

  const {
    lang, result, eggers, error, activeTab,
    setLang, setResult, setEggers, setError, setActiveTab,
  } = useUIStore();

  const runAnalysis = useCallback(() => {
    setError(null);
    try {
      if (studies.length < 2) {
        setError(t('input.minStudies', lang));
        return;
      }
      const res = metaAnalysis(studies, measure, model);
      setResult(res);
      setEggers(eggersTest(res.studies));
      setActiveTab('results');
    } catch (e) {
      setError(e instanceof Error ? e.message : t('input.analysisFailed', lang));
      setResult(null);
      setEggers(null);
    }
  }, [studies, measure, model, lang, setResult, setEggers, setError, setActiveTab]);

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
          const isSensitivity = tab === 'sensitivity';
          const disabled = tab !== 'input' && !result || (isSensitivity && studies.length < 3);
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
        <ResultsSummary result={result} eggers={eggers} lang={lang} />
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
            <ForestPlot result={result} title={title || 'Forest Plot'} lang={lang} />
          </div>
        </div>
      )}

      {/* Funnel Plot Tab */}
      {activeTab === 'funnel' && result && (
        <div style={{ display: 'flex', justifyContent: 'center', overflowX: 'auto' }}>
          <FunnelPlot result={result} />
        </div>
      )}

      {/* Sensitivity Analysis Tab */}
      {activeTab === 'sensitivity' && result && sensitivityResults.length > 0 && (
        <SensitivityTable results={sensitivityResults} fullResult={result} lang={lang} />
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
