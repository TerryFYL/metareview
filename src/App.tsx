import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useProjectStore, useUIStore } from './store';
import HeroSection from './components/HeroSection';
import PICOForm from './components/PICOForm';
import DataTable from './components/DataTable';
import EffectMeasureGuide from './components/EffectMeasureGuide';
import ForestPlot from './components/ForestPlot';
import FunnelPlot from './components/FunnelPlot';
import ResultsSummary from './components/ResultsSummary';
import SensitivityTable from './components/SensitivityTable';
import PRISMAFlow from './components/PRISMAFlow';
import LiteratureSearch from './components/LiteratureSearch';
import OnboardingTour from './components/OnboardingTour';
import CumulativeMeta from './components/CumulativeMeta';
import GalbraithPlot from './components/GalbraithPlot';
import LabbePlot from './components/LabbePlot';
import BaujatPlot from './components/BaujatPlot';
import InfluenceDiagnostics from './components/InfluenceDiagnostics';
import GradeAssessment from './components/GradeAssessment';
import MetaRegressionPlot from './components/MetaRegressionPlot';
import LeaveOneOutPlot from './components/LeaveOneOutPlot';
import NetworkGraph from './components/NetworkGraph';
import DoseResponsePlot from './components/DoseResponsePlot';
import { metaAnalysis, eggersTest, beggsTest, metaRegression as runMetaRegression, sensitivityAnalysis, subgroupAnalysis, cumulativeMetaAnalysis, isBinaryData, isContinuousData, isHRData, trimAndFill, isLogScale, influenceDiagnostics as computeInfluence, gradeAssessment as computeGrade, doseResponseAnalysis } from './lib/statistics';
import type { TrimAndFillResult } from './lib/statistics';
import { generateReportHTML, type ReportSections } from './lib/report-export';
import { generateReportDOCX } from './lib/report-docx';
import { t, type Lang } from './lib/i18n';
import { trackPageView, trackTabSwitch } from './lib/analytics';
import { exportJSON } from './lib/csv';
import type { EffectMeasure, ModelType, Study, BinaryData, ContinuousData, HRData, SubgroupAnalysisResult } from './lib/types';

// Lazy-load extraction component (pdfjs-dist is ~700KB)
const DataExtraction = lazy(() => import('./components/DataExtraction'));

const MEASURES: { value: EffectMeasure; label: string; desc: string }[] = [
  { value: 'OR', label: 'Odds Ratio', desc: 'Binary outcomes (2\u00D72 table)' },
  { value: 'RR', label: 'Risk Ratio', desc: 'Binary outcomes (2\u00D72 table)' },
  { value: 'HR', label: 'Hazard Ratio', desc: 'Time-to-event / survival data' },
  { value: 'MD', label: 'Mean Difference', desc: 'Continuous outcomes (mean, SD, n)' },
  { value: 'SMD', label: "Hedges' g (SMD)", desc: 'Continuous, different scales' },
];

const TAB_KEYS = ['search', 'extract', 'input', 'results', 'forest', 'funnel', 'galbraith', 'labbe', 'baujat', 'cumulative', 'sensitivity', 'influence', 'loo', 'network', 'doseresponse', 'subgroup', 'metareg', 'grade', 'prisma'] as const;

function ForestPlotControls({ lang, onDownloadSVG, onDownloadPNG }: { lang: Lang; onDownloadSVG: () => void; onDownloadPNG: () => void }) {
  const { plotSettings, setPlotSettings } = useUIStore();
  const [showSettings, setShowSettings] = useState(false);

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
        <button onClick={() => setShowSettings(!showSettings)} style={secondaryBtnStyle}>
          {showSettings ? t('forest.hideSettings', lang) : t('forest.settings', lang)}
        </button>
        <button onClick={onDownloadSVG} style={secondaryBtnStyle}>
          {t('forest.download', lang)}
        </button>
        <button onClick={onDownloadPNG} style={secondaryBtnStyle}>
          {t('forest.downloadPNG', lang)}
        </button>
      </div>
      {showSettings && (
        <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: '14px 18px', marginTop: 10 }}>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            {/* Color Scheme */}
            <div style={{ flex: '0 0 auto' }}>
              <label style={settingsLabelStyle}>{t('forest.colorScheme', lang)}</label>
              <select
                value={plotSettings.colorScheme}
                onChange={(e) => setPlotSettings({ colorScheme: e.target.value as 'default' | 'bw' | 'colorblind' })}
                style={settingsSelectStyle}
              >
                <option value="default">{t('forest.colorDefault', lang)}</option>
                <option value="bw">{t('forest.colorBW', lang)}</option>
                <option value="colorblind">{t('forest.colorBlind', lang)}</option>
              </select>
            </div>
            {/* Font Size */}
            <div style={{ flex: '0 0 auto' }}>
              <label style={settingsLabelStyle}>{t('forest.fontSize', lang)}</label>
              <select
                value={plotSettings.fontSize}
                onChange={(e) => setPlotSettings({ fontSize: Number(e.target.value) })}
                style={settingsSelectStyle}
              >
                {[9, 10, 11, 12, 13, 14].map(s => (
                  <option key={s} value={s}>{s}pt</option>
                ))}
              </select>
            </div>
            {/* Show Weights */}
            <div style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 4 }}>
              <input
                type="checkbox"
                checked={plotSettings.showWeights}
                onChange={(e) => setPlotSettings({ showWeights: e.target.checked })}
                id="show-weights"
              />
              <label htmlFor="show-weights" style={{ fontSize: 12, color: '#374151' }}>
                {t('forest.showWeights', lang)}
              </label>
            </div>
          </div>
          {/* Sort */}
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 8 }}>
            <div style={{ flex: '0 0 auto' }}>
              <label style={settingsLabelStyle}>{t('forest.sortBy', lang)}</label>
              <select
                value={plotSettings.forestSortBy}
                onChange={(e) => setPlotSettings({ forestSortBy: e.target.value as 'default' | 'effect' | 'year' | 'weight' | 'name' })}
                style={settingsSelectStyle}
              >
                <option value="default">{t('forest.sort.default', lang)}</option>
                <option value="effect">{t('forest.sort.effect', lang)}</option>
                <option value="year">{t('forest.sort.year', lang)}</option>
                <option value="weight">{t('forest.sort.weight', lang)}</option>
                <option value="name">{t('forest.sort.name', lang)}</option>
              </select>
            </div>
          </div>
          {/* Custom Labels */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 10 }}>
            <div style={{ flex: '1 1 200px' }}>
              <label style={settingsLabelStyle}>{t('forest.customTitle', lang)}</label>
              <input
                type="text"
                value={plotSettings.customTitle}
                onChange={(e) => setPlotSettings({ customTitle: e.target.value })}
                placeholder={t('forest.customTitlePlaceholder', lang)}
                style={settingsInputStyle}
              />
            </div>
            <div style={{ flex: '1 1 160px' }}>
              <label style={settingsLabelStyle}>{t('forest.leftLabel', lang)}</label>
              <input
                type="text"
                value={plotSettings.favoursLeftLabel}
                onChange={(e) => setPlotSettings({ favoursLeftLabel: e.target.value })}
                placeholder={t('forest.favoursTreatment', lang)}
                style={settingsInputStyle}
              />
            </div>
            <div style={{ flex: '1 1 160px' }}>
              <label style={settingsLabelStyle}>{t('forest.rightLabel', lang)}</label>
              <input
                type="text"
                value={plotSettings.favoursRightLabel}
                onChange={(e) => setPlotSettings({ favoursRightLabel: e.target.value })}
                placeholder={t('forest.favoursControl', lang)}
                style={settingsInputStyle}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FunnelPlotControls({ lang }: { lang: Lang }) {
  const { plotSettings, setPlotSettings } = useUIStore();
  const [showSettings, setShowSettings] = useState(false);

  const downloadFunnelSVG = useCallback(() => {
    const svg = document.querySelector('.funnel-plot-container svg');
    if (!svg) return;
    const serializer = new XMLSerializer();
    const source = serializer.serializeToString(svg);
    const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'funnel-plot.svg';
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
        <button onClick={() => setShowSettings(!showSettings)} style={secondaryBtnStyle}>
          {showSettings ? t('funnel.hideSettings', lang) : t('funnel.settings', lang)}
        </button>
        <button onClick={downloadFunnelSVG} style={secondaryBtnStyle}>
          {t('funnel.download', lang)}
        </button>
      </div>
      {showSettings && (
        <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: '14px 18px', marginTop: 10 }}>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            {/* Color Scheme */}
            <div style={{ flex: '0 0 auto' }}>
              <label style={settingsLabelStyle}>{t('forest.colorScheme', lang)}</label>
              <select
                value={plotSettings.colorScheme}
                onChange={(e) => setPlotSettings({ colorScheme: e.target.value as 'default' | 'bw' | 'colorblind' })}
                style={settingsSelectStyle}
              >
                <option value="default">{t('forest.colorDefault', lang)}</option>
                <option value="bw">{t('forest.colorBW', lang)}</option>
                <option value="colorblind">{t('forest.colorBlind', lang)}</option>
              </select>
            </div>
            {/* Font Size */}
            <div style={{ flex: '0 0 auto' }}>
              <label style={settingsLabelStyle}>{t('forest.fontSize', lang)}</label>
              <select
                value={plotSettings.fontSize}
                onChange={(e) => setPlotSettings({ fontSize: Number(e.target.value) })}
                style={settingsSelectStyle}
              >
                {[9, 10, 11, 12, 13, 14].map(s => (
                  <option key={s} value={s}>{s}pt</option>
                ))}
              </select>
            </div>
          </div>
          {/* Custom Labels */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 10 }}>
            <div style={{ flex: '1 1 200px' }}>
              <label style={settingsLabelStyle}>{t('funnel.customTitle', lang)}</label>
              <input
                type="text"
                value={plotSettings.customTitle}
                onChange={(e) => setPlotSettings({ customTitle: e.target.value })}
                placeholder={t('funnel.customTitlePlaceholder', lang)}
                style={settingsInputStyle}
              />
            </div>
            <div style={{ flex: '1 1 160px' }}>
              <label style={settingsLabelStyle}>{t('funnel.xLabelCustom', lang)}</label>
              <input
                type="text"
                value={plotSettings.customXLabel}
                onChange={(e) => setPlotSettings({ customXLabel: e.target.value })}
                placeholder={t('funnel.xLabel', lang)}
                style={settingsInputStyle}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const settingsLabelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 3 };
const settingsSelectStyle: React.CSSProperties = { padding: '5px 8px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 12, background: '#fff' };
const settingsInputStyle: React.CSSProperties = { width: '100%', padding: '5px 8px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 12, boxSizing: 'border-box' as const };

export default function App() {
  const {
    title, pico, measure, model, studies, prisma,
    setTitle, setPICO, setMeasure, setModel, setStudies, setPRISMA, reset, loadDemo,
  } = useProjectStore();

  const {
    lang, heroSeen, tourSeen, result, eggers, beggs, metaRegression, error, activeTab,
    setLang, setHeroSeen, setTourSeen, setResult, setEggers, setBeggs, setMetaRegression, setError, setActiveTab,
  } = useUIStore();

  const [subgroupResult, setSubgroupResult] = useState<SubgroupAnalysisResult | null>(null);
  const [trimFillResult, setTrimFillResult] = useState<TrimAndFillResult | null>(null);
  const [showTrimFill, setShowTrimFill] = useState(false);
  const [showContours, setShowContours] = useState(false);
  const [showEggersLine, setShowEggersLine] = useState(false);

  const { undo, redo, canUndo, canRedo } = useProjectStore();

  // Global undo/redo keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        if (canUndo()) { e.preventDefault(); undo(); }
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'z' && e.shiftKey) {
        if (canRedo()) { e.preventDefault(); redo(); }
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'y') {
        if (canRedo()) { e.preventDefault(); redo(); }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, redo, canUndo, canRedo]);

  // Track page view on mount
  useEffect(() => { trackPageView(); }, []);

  // Track tab switches
  useEffect(() => { trackTabSwitch(activeTab); }, [activeTab]);

  const validateStudies = useCallback((studyList: Study[]): string | null => {
    for (let i = 0; i < studyList.length; i++) {
      const s = studyList[i];
      const name = s.name || `#${i + 1}`;
      if (!s.name.trim()) {
        return t('input.studyNameMissing', lang).replace('{index}', String(i + 1));
      }
      if (isBinaryData(s.data)) {
        const d = s.data as BinaryData;
        // Check for all-zero data (e.g., RIS import stubs)
        if (d.events1 === 0 && d.total1 === 0 && d.events2 === 0 && d.total2 === 0) {
          return t('input.emptyDataRow', lang).replace('{name}', name);
        }
        if (d.total1 <= 0 || d.total2 <= 0) {
          return t('input.invalidBinaryTotal', lang).replace('{name}', name);
        }
        if (d.events1 < 0 || d.events2 < 0 || d.events1 > d.total1 || d.events2 > d.total2) {
          return t('input.invalidBinaryEvents', lang).replace('{name}', name);
        }
      } else if (isContinuousData(s.data)) {
        const d = s.data as ContinuousData;
        // Check for all-zero data (e.g., RIS import stubs)
        if (d.mean1 === 0 && d.sd1 === 0 && d.n1 === 0 && d.mean2 === 0 && d.sd2 === 0 && d.n2 === 0) {
          return t('input.emptyDataRow', lang).replace('{name}', name);
        }
        if (d.n1 <= 0 || d.n2 <= 0) {
          return t('input.invalidContinuousN', lang).replace('{name}', name);
        }
        if (d.sd1 <= 0 || d.sd2 <= 0) {
          return t('input.invalidContinuousSD', lang).replace('{name}', name);
        }
      } else if (isHRData(s.data)) {
        const d = s.data as HRData;
        // Check for all-zero data (e.g., RIS import stubs)
        if (d.hr === 0 && d.ciLower === 0 && d.ciUpper === 0) {
          return t('input.emptyDataRow', lang).replace('{name}', name);
        }
        if (d.hr <= 0) {
          return t('input.invalidHR', lang).replace('{name}', name);
        }
        if (d.ciLower <= 0 || d.ciUpper <= 0 || d.ciLower >= d.ciUpper) {
          return t('input.invalidHRCI', lang).replace('{name}', name);
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
      setBeggs(beggsTest(res.studies));
      // Meta-regression
      setMetaRegression(runMetaRegression(studies, measure, model));
      // Trim-and-Fill: publication bias correction
      setTrimFillResult(trimAndFill(res.studies, res.summary, isLogScale(res.measure)));
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
      setBeggs(null);
      setMetaRegression(null);
      setSubgroupResult(null);
      setTrimFillResult(null);
    }
  }, [studies, measure, model, lang, validateStudies, setResult, setEggers, setBeggs, setMetaRegression, setError, setActiveTab]);

  const sensitivityResults = useMemo(() => {
    if (!result || studies.length < 3) return [];
    return sensitivityAnalysis(studies, measure, model);
  }, [result, studies, measure, model]);

  const cumulativeResults = useMemo(() => {
    if (!result || studies.length < 2) return [];
    return cumulativeMetaAnalysis(studies, measure, model);
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

  const downloadPNG = useCallback(() => {
    const svgEl = document.querySelector('.forest-plot-container svg') as SVGSVGElement | null;
    if (!svgEl) return;
    const scale = 2; // 2x retina
    const w = svgEl.width.baseVal.value;
    const h = svgEl.height.baseVal.value;
    const serializer = new XMLSerializer();
    let source = serializer.serializeToString(svgEl);
    // Ensure xmlns is present
    if (!source.includes('xmlns=')) {
      source = source.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
    }
    const canvas = document.createElement('canvas');
    canvas.width = w * scale;
    canvas.height = h * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    // White background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.scale(scale, scale);
    const img = new Image();
    const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      const pngUrl = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = pngUrl;
      a.download = `forest-plot-${title || 'metareview'}.png`;
      a.click();
    };
    img.src = url;
  }, [title]);

  const exportReport = useCallback((sections?: ReportSections) => {
    if (!result) return;
    const serializer = new XMLSerializer();
    const forestEl = document.querySelector('.forest-plot-container svg');
    const funnelEl = document.querySelector('.funnel-plot-container svg');
    const galbraithEl = document.querySelector('.galbraith-plot-container svg');
    const labbeEl = document.querySelector('.labbe-plot-container svg');
    const baujatEl = document.querySelector('.baujat-plot-container svg');
    const metaRegEl = document.querySelector('.metareg-plot-container svg');
    const looEl = document.querySelector('.loo-plot-container svg');
    const networkEl = document.querySelector('.network-graph-container svg');
    const doseResponseEl = document.querySelector('.dose-response-container svg');
    const contourFunnelEl = document.querySelector('.contour-funnel-plot-container svg');
    const cumulativeEl = document.querySelector('.cumulative-plot-container svg');
    const forestSvg = forestEl ? serializer.serializeToString(forestEl) : null;
    const funnelSvg = funnelEl ? serializer.serializeToString(funnelEl) : null;
    const contourFunnelSvg = contourFunnelEl ? serializer.serializeToString(contourFunnelEl) : null;
    const galbraithSvg = galbraithEl ? serializer.serializeToString(galbraithEl) : null;
    const labbeSvg = labbeEl ? serializer.serializeToString(labbeEl) : null;
    const baujatSvg = baujatEl ? serializer.serializeToString(baujatEl) : null;
    const metaRegSvg = metaRegEl ? serializer.serializeToString(metaRegEl) : null;
    const looSvg = looEl ? serializer.serializeToString(looEl) : null;
    const networkSvg = networkEl ? serializer.serializeToString(networkEl) : null;
    const doseResponseSvg = doseResponseEl ? serializer.serializeToString(doseResponseEl) : null;
    const cumulativeSvg = cumulativeEl ? serializer.serializeToString(cumulativeEl) : null;
    const influenceData = studies.length >= 3 ? computeInfluence(studies, measure, model) : [];
    const gradeData = result ? computeGrade({ result, eggers, beggs, trimFill: trimFillResult }) : null;
    const drData = doseResponseAnalysis(result.studies, studies.map(s => s.dose ?? NaN), studies.map(s => s.name));
    const html = generateReportHTML({
      title,
      pico,
      result,
      eggers,
      beggs,
      subgroupResult,
      sensitivityResults,
      forestSvg,
      funnelSvg,
      galbraithSvg,
      labbeSvg,
      baujatSvg,
      looSvg,
      networkSvg,
      trimFillResult,
      metaRegression,
      metaRegSvg,
      influenceDiagnostics: influenceData,
      gradeAssessment: gradeData,
      doseResponseResult: drData,
      doseResponseSvg,
      contourFunnelSvg,
      cumulativeResults,
      cumulativeSvg,
      prisma,
      sections,
    });
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }, [result, title, pico, prisma, eggers, beggs, subgroupResult, sensitivityResults, trimFillResult, metaRegression, measure, model, studies, cumulativeResults]);

  const exportDOCX = useCallback(async (sections?: ReportSections) => {
    if (!result) return;
    const influenceData = studies.length >= 3 ? computeInfluence(studies, measure, model) : [];
    const gradeData = result ? computeGrade({ result, eggers, beggs, trimFill: trimFillResult }) : null;
    const drData = doseResponseAnalysis(result.studies, studies.map(s => s.dose ?? NaN), studies.map(s => s.name));
    const blob = await generateReportDOCX({
      title,
      pico,
      result,
      eggers,
      beggs,
      subgroupResult,
      sensitivityResults,
      trimFillResult,
      metaRegression,
      influenceDiagnostics: influenceData,
      gradeAssessment: gradeData,
      doseResponseResult: drData,
      cumulativeResults,
      studies,
      prisma,
      sections,
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title || 'metareview-report'}.docx`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }, [result, title, pico, prisma, eggers, beggs, subgroupResult, sensitivityResults, trimFillResult, metaRegression, cumulativeResults, measure, model, studies]);

  const exportJSONHandler = useCallback(() => {
    if (!result) return;
    const influenceData = studies.length >= 3 ? computeInfluence(studies, measure, model) : [];
    const gradeData = computeGrade({ result, eggers, beggs, trimFill: trimFillResult });
    const drData = doseResponseAnalysis(result.studies, studies.map(s => s.dose ?? NaN), studies.map(s => s.name));
    const json = exportJSON({
      studies,
      measure,
      model,
      result,
      eggers,
      beggs,
      trimFill: trimFillResult,
      metaRegression,
      influenceDiagnostics: influenceData,
      gradeAssessment: gradeData,
      doseResponse: drData,
      subgroupResult,
      sensitivityResults,
      cumulativeResults,
    });
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title || 'metareview-data'}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }, [result, studies, measure, model, eggers, beggs, trimFillResult, metaRegression, subgroupResult, sensitivityResults, cumulativeResults, title]);

  // Show hero for new visitors
  if (!heroSeen) {
    return (
      <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
        <HeroSection
          lang={lang}
          onGetStarted={() => {
            setHeroSeen(true);
            setActiveTab('search');
          }}
          onLoadDemo={() => {
            setHeroSeen(true);
            loadDemo();
            setActiveTab('input');
          }}
          onSwitchLang={() => setLang(lang === 'zh' ? 'en' : 'zh')}
        />
      </div>
    );
  }

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
          <button onClick={() => setTourSeen(false)} style={secondaryBtnStyle} title={t('tour.startTour', lang)}>
            {t('tour.startTour', lang)}
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
      <nav
        role="tablist"
        aria-label={t('a11y.tabs', lang)}
        style={{ display: 'flex', gap: 0, borderBottom: '2px solid #e5e7eb', marginBottom: 20, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
            e.preventDefault();
            const enabledTabs = TAB_KEYS.filter((tab) => {
              const isAlwaysEnabled = tab === 'prisma' || tab === 'search' || tab === 'input' || tab === 'extract';
              if (isAlwaysEnabled) return true;
              if (!result) return false;
              if (tab === 'sensitivity' && studies.length < 3) return false;
              if (tab === 'influence' && studies.length < 3) return false;
              if (tab === 'loo' && studies.length < 3) return false;
              if (tab === 'subgroup' && !subgroupResult) return false;
              if (tab === 'cumulative' && studies.length < 2) return false;
              if (tab === 'metareg' && !metaRegression) return false;
              if (tab === 'labbe' && measure !== 'OR' && measure !== 'RR') return false;
              if (tab === 'doseresponse' && studies.filter(s => s.dose != null && !isNaN(s.dose!)).length < 3) return false;
              return true;
            });
            const idx = enabledTabs.indexOf(activeTab as typeof enabledTabs[number]);
            const next = e.key === 'ArrowRight'
              ? enabledTabs[(idx + 1) % enabledTabs.length]
              : enabledTabs[(idx - 1 + enabledTabs.length) % enabledTabs.length];
            setActiveTab(next);
            // Focus the new tab button
            const btn = document.getElementById(`tab-${next}`);
            if (btn) btn.focus();
          }
        }}
      >
        {TAB_KEYS.map((tab) => {
          const isAlwaysEnabled = tab === 'prisma' || tab === 'search' || tab === 'input' || tab === 'extract';
          const isSubgroup = tab === 'subgroup';
          const isSensitivity = tab === 'sensitivity';
          const isInfluence = tab === 'influence';
          const isLoo = tab === 'loo';
          const isCumulative = tab === 'cumulative';
          const isMetaReg = tab === 'metareg';
          const isLabbe = tab === 'labbe';
          const isDoseResponse = tab === 'doseresponse';
          const isBinaryMeasure = measure === 'OR' || measure === 'RR';
          const disabled = !isAlwaysEnabled && (
            !result
            || (isSensitivity && studies.length < 3)
            || (isInfluence && studies.length < 3)
            || (isLoo && studies.length < 3)
            || (isSubgroup && !subgroupResult)
            || (isCumulative && studies.length < 2)
            || (isMetaReg && !metaRegression)
            || (isLabbe && !isBinaryMeasure)
            || (isDoseResponse && studies.filter(s => s.dose != null && !isNaN(s.dose!)).length < 3)
          );
          return (
            <button
              key={tab}
              id={`tab-${tab}`}
              role="tab"
              aria-selected={activeTab === tab}
              aria-controls={`tabpanel-${tab}`}
              tabIndex={activeTab === tab ? 0 : -1}
              data-tour={`tab-${tab}`}
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

      {/* PDF Data Extraction Tab */}
      {activeTab === 'extract' && (
        <Suspense fallback={<div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>{t('extract.loading', lang)}</div>}>
          <DataExtraction
            lang={lang}
            measure={measure}
            studies={studies}
            onStudiesChange={setStudies}
            onSwitchToInput={() => setActiveTab('input')}
          />
        </Suspense>
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
            <EffectMeasureGuide lang={lang} currentMeasure={measure} onSelectMeasure={setMeasure} />
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
          <section style={sectionStyle} data-tour="import-csv">
            <h2 style={h2Style}>{t('input.studyData', lang)}</h2>
            <DataTable studies={studies} measure={measure} onStudiesChange={setStudies} lang={lang} onUndo={undo} onRedo={redo} canUndo={canUndo()} canRedo={canRedo()} />
          </section>

          {/* Error */}
          {error && (
            <div style={{ padding: '10px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, color: '#dc2626', fontSize: 13, marginBottom: 16 }}>
              {error}
            </div>
          )}

          {/* Run button */}
          <button data-tour="run-analysis" onClick={runAnalysis} style={primaryBtnStyle} disabled={studies.length < 2}>
            {t('input.runAnalysis', lang)}
          </button>
        </div>
      )}

      {/* Results Tab */}
      {activeTab === 'results' && result && (
        <ResultsSummary result={result} eggers={eggers} subgroupResult={subgroupResult} sensitivityResults={sensitivityResults} lang={lang} onExportReport={exportReport} onExportDOCX={exportDOCX} onExportJSON={exportJSONHandler} />
      )}

      {/* Forest Plot Tab */}
      {activeTab === 'forest' && result && (
        <div>
          <ForestPlotControls lang={lang} onDownloadSVG={downloadSVG} onDownloadPNG={downloadPNG} />
          <div className="forest-plot-container">
            <ForestPlot result={result} subgroupResult={subgroupResult} title={title || 'Forest Plot'} lang={lang} />
          </div>
        </div>
      )}

      {/* Funnel Plot Tab */}
      {activeTab === 'funnel' && result && (
        <div>
          <FunnelPlotControls lang={lang} />
          {/* Trim-and-Fill & Contour toggles */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12, flexWrap: 'wrap' }}>
            <label style={{ fontSize: 12, color: '#374151', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
              <input type="checkbox" checked={showTrimFill} onChange={(e) => setShowTrimFill(e.target.checked)} />
              {t('trimFill.show', lang)}
            </label>
            <label style={{ fontSize: 12, color: '#374151', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
              <input type="checkbox" checked={showContours} onChange={(e) => setShowContours(e.target.checked)} />
              {t('funnel.contours', lang)}
            </label>
            <label style={{ fontSize: 12, color: '#374151', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
              <input type="checkbox" checked={showEggersLine} onChange={(e) => setShowEggersLine(e.target.checked)} disabled={!eggers} />
              {t('funnel.eggersLine', lang)}
            </label>
          </div>
          <div className="funnel-plot-container" style={{ display: 'flex', justifyContent: 'center', overflowX: 'auto' }}>
            <FunnelPlot result={result} lang={lang} trimFillResult={showTrimFill ? trimFillResult : undefined} showContours={showContours} eggers={showEggersLine ? eggers : undefined} showEggersLine={showEggersLine} />
          </div>
          {/* Hidden contour funnel plot for report export (always renders with contours enabled) */}
          <div className="contour-funnel-plot-container" style={{ position: 'absolute', left: -9999, top: -9999, overflow: 'hidden' }}>
            <FunnelPlot result={result} lang={lang} showContours={true} />
          </div>
          {/* Trim-and-Fill results */}
          {showTrimFill && trimFillResult && (
            <div style={{
              marginTop: 12,
              padding: '10px 14px',
              background: trimFillResult.k0 > 0 ? '#fff7ed' : '#f0fdf4',
              border: `1px solid ${trimFillResult.k0 > 0 ? '#fed7aa' : '#bbf7d0'}`,
              borderRadius: 8,
              fontSize: 13,
            }}>
              {trimFillResult.k0 > 0 ? (
                <div>
                  <div style={{ fontWeight: 500, color: '#c2410c', marginBottom: 4 }}>
                    {t('trimFill.title', lang)}
                  </div>
                  <div style={{ color: '#374151' }}>
                    {t('trimFill.imputed', lang)
                      .replace('{k0}', String(trimFillResult.k0))
                      .replace('{side}', t(`trimFill.side.${trimFillResult.side}`, lang))}
                  </div>
                  <div style={{ marginTop: 6, fontSize: 12, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                    <span>
                      <span style={{ color: '#6b7280' }}>{t('trimFill.original', lang)} {result.measure}: </span>
                      <span style={{ fontFamily: 'monospace' }}>{result.effect.toFixed(4)} [{result.ciLower.toFixed(4)}, {result.ciUpper.toFixed(4)}]</span>
                    </span>
                    <span>
                      <span style={{ color: '#c2410c', fontWeight: 500 }}>{t('trimFill.adjusted', lang)} {result.measure}: </span>
                      <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{trimFillResult.adjustedEffect.toFixed(4)} [{trimFillResult.adjustedCILower.toFixed(4)}, {trimFillResult.adjustedCIUpper.toFixed(4)}]</span>
                    </span>
                  </div>
                </div>
              ) : (
                <span style={{ color: '#16a34a' }}>{t('trimFill.noMissing', lang)}</span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Galbraith Plot Tab */}
      {activeTab === 'galbraith' && result && (
        <div className="galbraith-plot-container">
          <GalbraithPlot result={result} lang={lang} />
        </div>
      )}

      {/* L'Abbé Plot Tab */}
      {activeTab === 'labbe' && result && (
        <LabbePlot studies={studies} lang={lang} />
      )}

      {/* Baujat Plot Tab */}
      {activeTab === 'baujat' && result && (
        <div className="baujat-plot-container">
          <BaujatPlot result={result} lang={lang} />
        </div>
      )}

      {/* Cumulative Meta-Analysis Tab */}
      {activeTab === 'cumulative' && result && cumulativeResults.length > 0 && (
        <CumulativeMeta results={cumulativeResults} measure={measure} lang={lang} />
      )}

      {/* Sensitivity Analysis Tab */}
      {activeTab === 'sensitivity' && result && sensitivityResults.length > 0 && (
        <SensitivityTable results={sensitivityResults} fullResult={result} lang={lang} />
      )}

      {/* Influence Diagnostics Tab */}
      {activeTab === 'influence' && result && studies.length >= 3 && (
        <InfluenceDiagnostics studies={studies} result={result} measure={measure} model={model} lang={lang} />
      )}

      {/* Leave-One-Out Cross-Validation Tab */}
      {activeTab === 'loo' && result && studies.length >= 3 && sensitivityResults.length > 0 && (
        <div className="loo-plot-container">
          <LeaveOneOutPlot result={result} sensitivityResults={sensitivityResults} lang={lang} />
        </div>
      )}

      {/* Network Graph Tab */}
      {activeTab === 'network' && result && (
        <div className="network-graph-container">
          <NetworkGraph studies={studies} lang={lang} />
        </div>
      )}

      {/* Dose-Response Tab */}
      {activeTab === 'doseresponse' && result && (
        <div className="dose-response-container">
          <DoseResponsePlot
            result={result}
            doses={studies.map(s => s.dose ?? NaN)}
            names={studies.map(s => s.name)}
            lang={lang}
          />
        </div>
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

      {/* Meta-Regression Tab */}
      {activeTab === 'metareg' && result && metaRegression && (
        <div className="metareg-plot-container">
          <MetaRegressionPlot metaRegression={metaRegression} lang={lang} />
        </div>
      )}

      {/* GRADE Assessment Tab */}
      {activeTab === 'grade' && result && (
        <GradeAssessment result={result} eggers={eggers} beggs={beggs} trimFillResult={trimFillResult} lang={lang} />
      )}

      {/* PRISMA Flow Tab */}
      {activeTab === 'prisma' && (
        <PRISMAFlow data={prisma} onChange={setPRISMA} lang={lang} />
      )}

      {/* Onboarding Tour */}
      {!tourSeen && (
        <OnboardingTour
          lang={lang}
          onComplete={() => setTourSeen(true)}
          onTabSwitch={(tab) => setActiveTab(tab as typeof activeTab)}
        />
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
