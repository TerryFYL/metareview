import { useCallback, useMemo } from 'react';
import { useProjectStore, useUIStore } from './store';
import PICOForm from './components/PICOForm';
import DataTable from './components/DataTable';
import ForestPlot from './components/ForestPlot';
import FunnelPlot from './components/FunnelPlot';
import ResultsSummary from './components/ResultsSummary';
import SensitivityTable from './components/SensitivityTable';
import { metaAnalysis, eggersTest, sensitivityAnalysis } from './lib/statistics';
import type { EffectMeasure, ModelType } from './lib/types';

const MEASURES: { value: EffectMeasure; label: string; desc: string }[] = [
  { value: 'OR', label: 'Odds Ratio', desc: 'Binary outcomes (2\u00D72 table)' },
  { value: 'RR', label: 'Risk Ratio', desc: 'Binary outcomes (2\u00D72 table)' },
  { value: 'MD', label: 'Mean Difference', desc: 'Continuous outcomes (mean, SD, n)' },
  { value: 'SMD', label: "Hedges' g (SMD)", desc: 'Continuous, different scales' },
];

export default function App() {
  const {
    title, pico, measure, model, studies,
    setTitle, setPICO, setMeasure, setModel, setStudies, reset, loadDemo,
  } = useProjectStore();

  const {
    result, eggers, error, activeTab,
    setResult, setEggers, setError, setActiveTab,
  } = useUIStore();

  const runAnalysis = useCallback(() => {
    setError(null);
    try {
      if (studies.length < 2) {
        setError('At least 2 studies are required for meta-analysis.');
        return;
      }
      const res = metaAnalysis(studies, measure, model);
      setResult(res);
      setEggers(eggersTest(res.studies));
      setActiveTab('results');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Analysis failed');
      setResult(null);
      setEggers(null);
    }
  }, [studies, measure, model, setResult, setEggers, setError, setActiveTab]);

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
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 20px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      {/* Header */}
      <header style={{ marginBottom: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: '#111827', margin: 0 }}>
            MetaReview
          </h1>
          <p style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
            AI-powered meta-analysis platform. From data to forest plot in 5 minutes.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={loadDemo} style={secondaryBtnStyle}>
            Load Demo
          </button>
          <button onClick={reset} style={secondaryBtnStyle}>
            New Analysis
          </button>
        </div>
      </header>

      {/* Tab navigation */}
      <nav style={{ display: 'flex', gap: 2, borderBottom: '2px solid #e5e7eb', marginBottom: 24 }}>
        {(['input', 'results', 'forest', 'funnel', 'sensitivity'] as const).map((tab) => {
          const isSensitivity = tab === 'sensitivity';
          const disabled = tab !== 'input' && !result || (isSensitivity && studies.length < 3);
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '10px 20px',
                border: 'none',
                borderBottom: activeTab === tab ? '2px solid #2563eb' : '2px solid transparent',
                background: 'none',
                cursor: disabled ? 'default' : 'pointer',
                fontSize: 13,
                fontWeight: activeTab === tab ? 600 : 400,
                color: disabled ? '#d1d5db' : activeTab === tab ? '#2563eb' : '#6b7280',
                marginBottom: -2,
              }}
              disabled={disabled}
            >
              {tab === 'input' && 'Data Input'}
              {tab === 'results' && 'Results'}
              {tab === 'forest' && 'Forest Plot'}
              {tab === 'funnel' && 'Funnel Plot'}
              {tab === 'sensitivity' && 'Sensitivity'}
            </button>
          );
        })}
      </nav>

      {/* Data Input Tab */}
      {activeTab === 'input' && (
        <div>
          {/* Title */}
          <section style={sectionStyle}>
            <label style={labelStyle}>Analysis Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Aspirin vs Placebo for Cardiovascular Events"
              style={{ ...textInputStyle, fontSize: 15, fontWeight: 500 }}
            />
          </section>

          {/* PICO */}
          <section style={sectionStyle}>
            <h2 style={h2Style}>PICO Framework</h2>
            <PICOForm pico={pico} onChange={setPICO} />
          </section>

          {/* Settings */}
          <section style={sectionStyle}>
            <h2 style={h2Style}>Analysis Settings</h2>
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
              <div>
                <label style={labelStyle}>Effect Measure</label>
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
              <div>
                <label style={labelStyle}>Model</label>
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value as ModelType)}
                  style={selectStyle}
                >
                  <option value="random">Random Effects (DerSimonian-Laird)</option>
                  <option value="fixed">Fixed Effects (Inverse Variance)</option>
                </select>
              </div>
            </div>
          </section>

          {/* Data Table */}
          <section style={sectionStyle}>
            <h2 style={h2Style}>Study Data</h2>
            <DataTable studies={studies} measure={measure} onStudiesChange={setStudies} />
          </section>

          {/* Error */}
          {error && (
            <div style={{ padding: '10px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, color: '#dc2626', fontSize: 13, marginBottom: 16 }}>
              {error}
            </div>
          )}

          {/* Run button */}
          <button onClick={runAnalysis} style={primaryBtnStyle} disabled={studies.length < 2}>
            Run Meta-Analysis
          </button>
        </div>
      )}

      {/* Results Tab */}
      {activeTab === 'results' && result && (
        <ResultsSummary result={result} eggers={eggers} />
      )}

      {/* Forest Plot Tab */}
      {activeTab === 'forest' && result && (
        <div>
          <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={downloadSVG} style={secondaryBtnStyle}>
              Download SVG
            </button>
          </div>
          <div className="forest-plot-container">
            <ForestPlot result={result} title={title || 'Forest Plot'} />
          </div>
        </div>
      )}

      {/* Funnel Plot Tab */}
      {activeTab === 'funnel' && result && (
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <FunnelPlot result={result} />
        </div>
      )}

      {/* Sensitivity Analysis Tab */}
      {activeTab === 'sensitivity' && result && sensitivityResults.length > 0 && (
        <SensitivityTable results={sensitivityResults} fullResult={result} />
      )}

      {/* Footer */}
      <footer style={{ marginTop: 48, padding: '16px 0', borderTop: '1px solid #e5e7eb', fontSize: 12, color: '#9ca3af', textAlign: 'center' }}>
        MetaReview &mdash; Open-source meta-analysis platform for medical research
      </footer>
    </div>
  );
}

const sectionStyle: React.CSSProperties = { marginBottom: 28 };
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
  padding: '8px 12px',
  border: '1px solid #d1d5db',
  borderRadius: 6,
  fontSize: 13,
  outline: 'none',
  background: '#fff',
  minWidth: 280,
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
