import { useState, useMemo, useCallback } from 'react';
import type { MetaAnalysisResult, EggersTest, BeggsTest, GradeAssessment as GradeAssessmentType, GradeConcern } from '../lib/types';
import type { TrimAndFillResult } from '../lib/statistics';
import { gradeAssessment } from '../lib/statistics';
import { t, type Lang } from '../lib/i18n';

interface GradeAssessmentProps {
  result: MetaAnalysisResult;
  eggers: EggersTest | null;
  beggs: BeggsTest | null;
  trimFillResult: TrimAndFillResult | null;
  lang: Lang;
}

const GRADE_COLORS: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  high: { bg: '#f0fdf4', border: '#86efac', text: '#166534', badge: '#16a34a' },
  moderate: { bg: '#fefce8', border: '#fde047', text: '#854d0e', badge: '#ca8a04' },
  low: { bg: '#fff7ed', border: '#fed7aa', text: '#9a3412', badge: '#ea580c' },
  very_low: { bg: '#fef2f2', border: '#fecaca', text: '#991b1b', badge: '#dc2626' },
};

const CONCERN_OPTIONS: { value: GradeConcern; labelKey: string }[] = [
  { value: 'no_concern', labelKey: 'grade.noConcern' },
  { value: 'serious', labelKey: 'grade.serious' },
  { value: 'very_serious', labelKey: 'grade.verySerious' },
];

export default function GradeAssessment({ result, eggers, beggs, trimFillResult, lang }: GradeAssessmentProps) {
  const [overrides, setOverrides] = useState<Record<string, GradeConcern>>({});

  const assessment = useMemo(
    () => gradeAssessment({
      result,
      eggers,
      beggs,
      trimFill: trimFillResult,
      overrides: overrides as Record<string, GradeConcern>,
    }),
    [result, eggers, beggs, trimFillResult, overrides]
  );

  const updateOverride = useCallback((factor: string, value: GradeConcern) => {
    setOverrides((prev) => ({ ...prev, [factor]: value }));
  }, []);

  const gradeColor = GRADE_COLORS[assessment.overall];

  const factors: { key: string; labelKey: string; factor: GradeAssessmentType['factors'][keyof GradeAssessmentType['factors']] }[] = [
    { key: 'riskOfBias', labelKey: 'grade.riskOfBias', factor: assessment.factors.riskOfBias },
    { key: 'inconsistency', labelKey: 'grade.inconsistency', factor: assessment.factors.inconsistency },
    { key: 'indirectness', labelKey: 'grade.indirectness', factor: assessment.factors.indirectness },
    { key: 'imprecision', labelKey: 'grade.imprecision', factor: assessment.factors.imprecision },
    { key: 'publicationBias', labelKey: 'grade.publicationBias', factor: assessment.factors.publicationBias },
  ];

  return (
    <div>
      <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>
        {t('grade.desc', lang)}
      </p>

      {/* Overall GRADE badge */}
      <div style={{
        padding: '16px 20px',
        background: gradeColor.bg,
        border: `1px solid ${gradeColor.border}`,
        borderRadius: 10,
        marginBottom: 20,
        display: 'flex',
        alignItems: 'center',
        gap: 16,
      }}>
        <div style={{
          padding: '8px 16px',
          background: gradeColor.badge,
          color: '#fff',
          borderRadius: 6,
          fontSize: 16,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: 1,
        }}>
          {t(`grade.level.${assessment.overall}`, lang)}
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: gradeColor.text }}>
            {t('grade.evidenceQuality', lang)}
          </div>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
            {t('grade.startingHigh', lang)} → {Object.values(assessment.factors).reduce((s, f) => s + f.downgrade, 0)} {t('grade.downgrades', lang)}
          </div>
        </div>
      </div>

      {/* Factors table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>
          <thead>
            <tr>
              <th style={thStyle}>{t('grade.domain', lang)}</th>
              <th style={thStyle}>{t('grade.assessment', lang)}</th>
              <th style={thStyle}>{t('grade.downgradeCol', lang)}</th>
              <th style={{ ...thStyle, minWidth: 280 }}>{t('grade.reasoning', lang)}</th>
            </tr>
          </thead>
          <tbody>
            {factors.map(({ key, labelKey, factor }, i) => {
              const isAuto = factor.auto;
              const concernColor = factor.level === 'very_serious' ? '#dc2626'
                : factor.level === 'serious' ? '#ea580c' : '#16a34a';
              return (
                <tr key={key} style={{ background: i % 2 ? '#f9fafb' : '#fff' }}>
                  <td style={tdStyle}>
                    <div style={{ fontWeight: 500 }}>{t(labelKey, lang)}</div>
                    {isAuto && (
                      <span style={{ fontSize: 10, color: '#2563eb', background: '#eff6ff', padding: '1px 6px', borderRadius: 3 }}>
                        {t('grade.auto', lang)}
                      </span>
                    )}
                  </td>
                  <td style={tdStyle}>
                    <select
                      value={overrides[key] || factor.level}
                      onChange={(e) => updateOverride(key, e.target.value as GradeConcern)}
                      style={{
                        padding: '4px 8px',
                        border: '1px solid #d1d5db',
                        borderRadius: 4,
                        fontSize: 12,
                        color: concernColor,
                        fontWeight: 500,
                        background: '#fff',
                        cursor: 'pointer',
                      }}
                    >
                      {CONCERN_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {t(opt.labelKey, lang)}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 600, color: factor.downgrade < 0 ? '#dc2626' : '#16a34a' }}>
                    {factor.downgrade === 0 ? '0' : factor.downgrade}
                  </td>
                  <td style={{ ...tdStyle, fontSize: 12, color: '#374151' }}>
                    {factor.reasoning}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Score calculation */}
      <div style={{ marginTop: 12, fontSize: 12, color: '#6b7280', display: 'flex', gap: 8, alignItems: 'center' }}>
        <span>{t('grade.scoreCalc', lang)}:</span>
        <span style={{ fontFamily: 'monospace' }}>
          4 (high) {Object.values(assessment.factors).map((f) => f.downgrade < 0 ? ` ${f.downgrade}` : '').join('')} = {assessment.score}
        </span>
        <span>→ <strong style={{ color: GRADE_COLORS[assessment.overall].badge }}>{t(`grade.level.${assessment.overall}`, lang)}</strong></span>
      </div>

      {/* Note */}
      <p style={{ marginTop: 12, fontSize: 11, color: '#9ca3af', fontStyle: 'italic' }}>
        {t('grade.note', lang)}
      </p>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: '8px 10px',
  borderBottom: '2px solid #e5e7eb',
  textAlign: 'left',
  fontSize: 12,
  fontWeight: 600,
  color: '#6b7280',
};

const tdStyle: React.CSSProperties = {
  padding: '8px 10px',
  borderBottom: '1px solid #f3f4f6',
};
