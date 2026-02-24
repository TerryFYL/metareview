import { useState } from 'react';
import { t } from '../lib/i18n';
import type { Lang } from '../lib/i18n';
import type { EffectMeasure } from '../lib/types';

interface Props {
  lang: Lang;
  currentMeasure: EffectMeasure;
  onSelectMeasure: (m: EffectMeasure) => void;
}

type Step = 'start' | 'binary' | 'continuous' | 'survival';

export default function EffectMeasureGuide({ lang, currentMeasure, onSelectMeasure }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [step, setStep] = useState<Step>('start');

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        style={{
          background: 'none',
          border: 'none',
          color: '#6b7280',
          fontSize: 12,
          cursor: 'pointer',
          padding: '4px 0',
          marginBottom: 8,
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}
      >
        <span style={{ fontSize: 14 }}>?</span>
        {t('guide.showGuide', lang)}
      </button>
    );
  }

  const reset = () => setStep('start');

  const recommend = (measure: EffectMeasure) => {
    onSelectMeasure(measure);
  };

  return (
    <div style={{
      background: '#f0f9ff',
      border: '1px solid #bfdbfe',
      borderRadius: 10,
      padding: '14px 18px',
      marginBottom: 16,
      fontSize: 13,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontWeight: 600, color: '#1e40af', fontSize: 13 }}>
          {t('guide.title', lang)}
        </span>
        <button
          onClick={() => setCollapsed(true)}
          style={{ background: 'none', border: 'none', color: '#93c5fd', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: '0 2px' }}
          title={t('guide.collapse', lang)}
        >
          &times;
        </button>
      </div>

      {step === 'start' && (
        <div>
          <p style={{ color: '#374151', marginBottom: 10 }}>{t('guide.question', lang)}</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <ChoiceButton label={t('guide.binary', lang)} desc={t('guide.binaryDesc', lang)} onClick={() => setStep('binary')} />
            <ChoiceButton label={t('guide.continuous', lang)} desc={t('guide.continuousDesc', lang)} onClick={() => setStep('continuous')} />
            <ChoiceButton label={t('guide.survival', lang)} desc={t('guide.survivalDesc', lang)} onClick={() => setStep('survival')} />
          </div>
        </div>
      )}

      {step === 'binary' && (
        <div>
          <p style={{ color: '#374151', marginBottom: 10 }}>{t('guide.binaryQ', lang)}</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <RecommendButton
              measure="OR"
              label="OR (Odds Ratio)"
              desc={t('guide.orDesc', lang)}
              active={currentMeasure === 'OR'}
              onClick={() => recommend('OR')}
            />
            <RecommendButton
              measure="RR"
              label="RR (Risk Ratio)"
              desc={t('guide.rrDesc', lang)}
              active={currentMeasure === 'RR'}
              onClick={() => recommend('RR')}
            />
          </div>
          <BackButton onClick={reset} lang={lang} />
        </div>
      )}

      {step === 'continuous' && (
        <div>
          <p style={{ color: '#374151', marginBottom: 10 }}>{t('guide.continuousQ', lang)}</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <RecommendButton
              measure="MD"
              label="MD (Mean Difference)"
              desc={t('guide.mdDesc', lang)}
              active={currentMeasure === 'MD'}
              onClick={() => recommend('MD')}
            />
            <RecommendButton
              measure="SMD"
              label="SMD (Hedges' g)"
              desc={t('guide.smdDesc', lang)}
              active={currentMeasure === 'SMD'}
              onClick={() => recommend('SMD')}
            />
          </div>
          <BackButton onClick={reset} lang={lang} />
        </div>
      )}

      {step === 'survival' && (
        <div>
          <p style={{ color: '#374151', marginBottom: 10 }}>{t('guide.survivalInfo', lang)}</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <RecommendButton
              measure="HR"
              label="HR (Hazard Ratio)"
              desc={t('guide.hrDesc', lang)}
              active={currentMeasure === 'HR'}
              onClick={() => recommend('HR')}
            />
          </div>
          <BackButton onClick={reset} lang={lang} />
        </div>
      )}
    </div>
  );
}

function ChoiceButton({ label, desc, onClick }: { label: string; desc: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: '1 1 140px',
        minWidth: 120,
        padding: '10px 12px',
        background: '#fff',
        border: '1px solid #d1d5db',
        borderRadius: 8,
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'border-color 0.15s',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#3b82f6')}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#d1d5db')}
    >
      <div style={{ fontWeight: 600, fontSize: 13, color: '#111827', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 11, color: '#6b7280', lineHeight: 1.3 }}>{desc}</div>
    </button>
  );
}

function RecommendButton({ measure, label, desc, active, onClick }: {
  measure: string; label: string; desc: string; active: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: '1 1 180px',
        minWidth: 140,
        padding: '10px 12px',
        background: active ? '#dbeafe' : '#fff',
        border: active ? '2px solid #2563eb' : '1px solid #d1d5db',
        borderRadius: 8,
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'all 0.15s',
      }}
      onMouseEnter={(e) => { if (!active) e.currentTarget.style.borderColor = '#3b82f6'; }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.borderColor = '#d1d5db'; }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
        <span style={{
          display: 'inline-block',
          width: 8, height: 8,
          borderRadius: '50%',
          background: active ? '#2563eb' : '#d1d5db',
          flexShrink: 0,
        }} />
        <span style={{ fontWeight: 600, fontSize: 13, color: active ? '#1e40af' : '#111827' }}>{label}</span>
      </div>
      <div style={{ fontSize: 11, color: '#6b7280', lineHeight: 1.3, paddingLeft: 14 }}>{desc}</div>
      {active && (
        <div style={{ fontSize: 11, color: '#2563eb', fontWeight: 500, marginTop: 4, paddingLeft: 14 }}>
          {measure}
        </div>
      )}
    </button>
  );
}

function BackButton({ onClick, lang }: { onClick: () => void; lang: Lang }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'none',
        border: 'none',
        color: '#6b7280',
        fontSize: 12,
        cursor: 'pointer',
        marginTop: 8,
        padding: 0,
      }}
    >
      {t('guide.back', lang)}
    </button>
  );
}
