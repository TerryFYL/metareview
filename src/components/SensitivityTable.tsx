import type { SensitivityResult, MetaAnalysisResult } from '../lib/types';
import { isLogScale } from '../lib/statistics';
import { t, type Lang } from '../lib/i18n';

interface SensitivityTableProps {
  results: SensitivityResult[];
  fullResult: MetaAnalysisResult;
  lang: Lang;
}

export default function SensitivityTable({ results, fullResult, lang }: SensitivityTableProps) {
  const { measure } = fullResult;
  const logScale = isLogScale(measure);

  const nullValue = logScale ? 1 : 0;
  const fullSignificant = fullResult.pValue < 0.05;
  const fullDirection = fullResult.effect > nullValue ? 'positive' : 'negative';

  const isInfluential = (row: SensitivityResult): boolean => {
    const rowDirection = row.effect > nullValue ? 'positive' : 'negative';
    if (rowDirection !== fullDirection) return true;

    const rowCrossesNull = logScale
      ? row.ciLower <= 1 && row.ciUpper >= 1
      : row.ciLower <= 0 && row.ciUpper >= 0;
    const rowSignificant = !rowCrossesNull;

    if (rowSignificant !== fullSignificant) return true;

    return false;
  };

  const fmt = (n: number) => n.toFixed(4);
  const fmtI2 = (n: number) => n.toFixed(1) + '%';

  return (
    <div style={{ fontSize: 13, color: '#374151' }}>
      <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4, color: '#111827' }}>
        {t('sensitivity.title', lang)}
      </h3>
      <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 16 }}>
        {t('sensitivity.desc', lang)}
      </p>

      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>
          <thead>
            <tr>
              <th style={thStyle}>{t('sensitivity.omitted', lang)}</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>{measure}</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>95% CI</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>I{'\u00B2'}</th>
            </tr>
          </thead>
          <tbody>
            {results.map((row) => {
              const flagged = isInfluential(row);
              return (
                <tr
                  key={row.omittedStudy}
                  style={{
                    background: flagged ? '#fef2f2' : undefined,
                  }}
                >
                  <td style={{ ...tdStyle, fontWeight: flagged ? 600 : 400, color: flagged ? '#dc2626' : '#374151' }}>
                    {row.omittedStudy}
                    {flagged && <span style={{ marginLeft: 6, fontSize: 11, color: '#dc2626' }}>*</span>}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontFamily: 'monospace' }}>
                    {fmt(row.effect)}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontFamily: 'monospace' }}>
                    [{fmt(row.ciLower)}, {fmt(row.ciUpper)}]
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontFamily: 'monospace' }}>
                    {fmtI2(row.I2)}
                  </td>
                </tr>
              );
            })}

            {/* Reference row: full model */}
            <tr style={{ borderTop: '2px solid #e5e7eb', background: '#f0f9ff' }}>
              <td style={{ ...tdStyle, fontWeight: 600, color: '#1e40af' }}>
                {t('sensitivity.fullModel', lang)}
              </td>
              <td style={{ ...tdStyle, textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: '#1e40af' }}>
                {fmt(fullResult.effect)}
              </td>
              <td style={{ ...tdStyle, textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: '#1e40af' }}>
                [{fmt(fullResult.ciLower)}, {fmt(fullResult.ciUpper)}]
              </td>
              <td style={{ ...tdStyle, textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: '#1e40af' }}>
                {fmtI2(fullResult.heterogeneity.I2)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {results.some(isInfluential) && (
        <p style={{ fontSize: 12, color: '#dc2626', marginTop: 12, fontWeight: 500 }}>
          {t('sensitivity.influential', lang)}
        </p>
      )}
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: '8px 10px',
  borderBottom: '2px solid #e5e7eb',
  textAlign: 'left',
  fontSize: 11,
  fontWeight: 600,
  color: '#6b7280',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

const tdStyle: React.CSSProperties = {
  padding: '7px 10px',
  borderBottom: '1px solid #f3f4f6',
};
