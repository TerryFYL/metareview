import { useMemo } from 'react';
import type { MetaAnalysisResult, Study, EffectMeasure, ModelType } from '../lib/types';
import { influenceDiagnostics } from '../lib/statistics';
import { t, type Lang } from '../lib/i18n';

interface InfluenceDiagnosticsProps {
  studies: Study[];
  result: MetaAnalysisResult;
  measure: EffectMeasure;
  model: ModelType;
  lang: Lang;
}

export default function InfluenceDiagnostics({ studies, result, measure, model, lang }: InfluenceDiagnosticsProps) {
  const diagnostics = useMemo(
    () => influenceDiagnostics(studies, measure, model),
    [studies, measure, model]
  );

  if (diagnostics.length === 0) {
    return <p style={{ color: '#6b7280', fontSize: 13 }}>{t('influence.noData', lang)}</p>;
  }

  // Thresholds for highlighting
  const k = diagnostics.length;
  const cooksThreshold = 4 / k; // common threshold
  const hatThreshold = 2 / k; // 2× average hat value

  const highlightStyle = (value: number, threshold: number): React.CSSProperties =>
    Math.abs(value) > threshold
      ? { color: '#dc2626', fontWeight: 600 }
      : {};

  return (
    <div>
      <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 12 }}>
        {t('influence.desc', lang)}
      </p>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12, minWidth: 900 }}>
          <thead>
            <tr>
              <th style={thStyle}>{t('influence.study', lang)}</th>
              <th style={thStyle}>{result.measure}</th>
              <th style={{ ...thStyle, cursor: 'help' }} title={t('influence.weightTip', lang)}>
                {t('influence.weight', lang)}
              </th>
              <th style={{ ...thStyle, cursor: 'help' }} title={t('influence.hatTip', lang)}>
                {t('influence.hat', lang)}
              </th>
              <th style={{ ...thStyle, cursor: 'help' }} title={t('influence.rstudentTip', lang)}>
                {t('influence.rstudent', lang)}
              </th>
              <th style={{ ...thStyle, cursor: 'help' }} title={t('influence.cooksTip', lang)}>
                {t('influence.cooks', lang)}
              </th>
              <th style={{ ...thStyle, cursor: 'help' }} title={t('influence.dffitsTip', lang)}>
                DFFITS
              </th>
              <th style={{ ...thStyle, cursor: 'help' }} title={t('influence.covRatioTip', lang)}>
                {t('influence.covRatio', lang)}
              </th>
              <th style={thStyle}>{t('influence.looEffect', lang)}</th>
              <th style={thStyle}>{t('influence.looI2', lang)}</th>
            </tr>
          </thead>
          <tbody>
            {diagnostics.map((d, i) => {
              const isInfluential = d.cooksDistance > cooksThreshold || d.hat > hatThreshold;
              return (
                <tr
                  key={d.name}
                  style={{
                    background: isInfluential ? '#fff7ed' : i % 2 ? '#f9fafb' : '#fff',
                  }}
                >
                  <td style={tdStyle}>
                    {d.name}{d.year ? ` (${d.year})` : ''}
                    {isInfluential && <span style={{ color: '#f59e0b', marginLeft: 4 }} title={t('influence.influential', lang)}>*</span>}
                  </td>
                  <td style={{ ...tdStyle, fontFamily: 'monospace' }}>{d.effect.toFixed(4)}</td>
                  <td style={{ ...tdStyle, fontFamily: 'monospace' }}>{d.weight.toFixed(1)}%</td>
                  <td style={{ ...tdStyle, fontFamily: 'monospace', ...highlightStyle(d.hat, hatThreshold) }}>
                    {d.hat.toFixed(4)}
                  </td>
                  <td style={{ ...tdStyle, fontFamily: 'monospace', ...(Math.abs(d.rstudent) > 2 ? { color: '#dc2626', fontWeight: 600 } : {}) }}>
                    {d.rstudent.toFixed(3)}
                  </td>
                  <td style={{ ...tdStyle, fontFamily: 'monospace', ...highlightStyle(d.cooksDistance, cooksThreshold) }}>
                    {d.cooksDistance.toFixed(4)}
                  </td>
                  <td style={{ ...tdStyle, fontFamily: 'monospace', ...(Math.abs(d.dffits) > 1 ? { color: '#dc2626', fontWeight: 600 } : {}) }}>
                    {d.dffits.toFixed(4)}
                  </td>
                  <td style={{ ...tdStyle, fontFamily: 'monospace' }}>
                    {d.covRatio.toFixed(4)}
                  </td>
                  <td style={{ ...tdStyle, fontFamily: 'monospace' }}>{d.leaveOneOutEffect.toFixed(4)}</td>
                  <td style={{ ...tdStyle, fontFamily: 'monospace' }}>{d.leaveOneOutI2.toFixed(1)}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {/* Legend */}
      <div style={{ marginTop: 10, fontSize: 11, color: '#6b7280' }}>
        <p style={{ margin: '2px 0' }}>
          * {t('influence.legendInfluential', lang)} (Cook's D &gt; {cooksThreshold.toFixed(3)} {t('influence.legendOr', lang)} hat &gt; {hatThreshold.toFixed(3)})
        </p>
        <p style={{ margin: '2px 0' }}>
          {t('influence.legendRstudent', lang)}
        </p>
      </div>
      {/* Influential studies summary */}
      {diagnostics.some((d) => d.cooksDistance > cooksThreshold) && (
        <div style={{
          marginTop: 12,
          padding: '10px 14px',
          background: '#fff7ed',
          border: '1px solid #fed7aa',
          borderRadius: 8,
          fontSize: 13,
        }}>
          <span style={{ fontWeight: 500, color: '#c2410c' }}>
            {t('influence.summaryTitle', lang)}:
          </span>{' '}
          <span style={{ color: '#374151' }}>
            {diagnostics
              .filter((d) => d.cooksDistance > cooksThreshold)
              .map((d) => d.name)
              .join(', ')}
          </span>
        </div>
      )}
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: '8px 6px',
  borderBottom: '2px solid #e5e7eb',
  textAlign: 'left',
  fontSize: 11,
  fontWeight: 600,
  color: '#6b7280',
  whiteSpace: 'nowrap',
};

const tdStyle: React.CSSProperties = {
  padding: '6px',
  borderBottom: '1px solid #f3f4f6',
  fontSize: 12,
};
