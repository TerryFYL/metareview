import type { MetaAnalysisResult, EggersTest } from '../lib/types';
import { t, type Lang } from '../lib/i18n';

interface ResultsSummaryProps {
  result: MetaAnalysisResult;
  eggers: EggersTest | null;
  lang: Lang;
}

export default function ResultsSummary({ result, eggers, lang }: ResultsSummaryProps) {
  const { measure, model, heterogeneity: het } = result;
  const k = result.studies.length;

  const formatP = (p: number) => {
    if (p < 0.001) return '< 0.001';
    return p.toFixed(3);
  };

  return (
    <div style={{ fontSize: 13, lineHeight: 1.8, color: '#374151' }}>
      <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12, color: '#111827' }}>
        {t('results.title', lang)}
      </h3>

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
          </tbody>
        </table>
      </div>

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

      {/* Auto-generated paragraph (always in English for academic use) */}
      <div style={cardStyle}>
        <div style={cardTitleStyle}>{t('results.narrative', lang)}</div>
        <p style={{ fontSize: 13, lineHeight: 1.7, color: '#374151' }}>
          A {model === 'random' ? 'random-effects' : 'fixed-effect'} meta-analysis
          of {k} studies was performed using the {
            model === 'random' ? 'DerSimonian-Laird' : 'inverse variance'
          } method. The pooled {measure} was {result.effect.toFixed(2)} (95% CI: {result.ciLower.toFixed(2)}&ndash;{result.ciUpper.toFixed(2)}; Z = {result.z.toFixed(2)}, P {result.pValue < 0.001 ? '< 0.001' : `= ${result.pValue.toFixed(3)}`}), {result.pValue < 0.05 ? 'indicating a statistically significant effect' : 'showing no statistically significant effect'}.
          Heterogeneity was {het.I2 < 25 ? 'low' : het.I2 < 50 ? 'moderate' : het.I2 < 75 ? 'substantial' : 'considerable'} (I{'\u00B2'} = {het.I2.toFixed(1)}%, Q = {het.Q.toFixed(2)}, df = {het.df}, P {het.pValue < 0.001 ? '< 0.001' : `= ${het.pValue.toFixed(3)}`}; {'\u03C4\u00B2'} = {het.tau2.toFixed(4)}).
          {eggers ? ` Egger's regression test ${eggers.pValue < 0.05 ? 'indicated significant' : 'did not indicate'} funnel plot asymmetry (intercept = ${eggers.intercept.toFixed(2)}, P = ${formatP(eggers.pValue)}).` : ''}
        </p>
      </div>
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
  if (I2 < 25) { key = 'het.low'; color = '#16a34a'; }
  else if (I2 < 50) { key = 'het.moderate'; color = '#ca8a04'; }
  else if (I2 < 75) { key = 'het.substantial'; color = '#ea580c'; }
  else { key = 'het.considerable'; color = '#dc2626'; }

  return (
    <p style={{ fontSize: 12, color, fontWeight: 500, marginTop: 8 }}>
      {t(key, lang)} (Higgins et al., 2003)
    </p>
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
