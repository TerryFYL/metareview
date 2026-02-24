import type { PICO } from '../lib/types';
import { t, type Lang } from '../lib/i18n';

interface PICOFormProps {
  pico: PICO;
  onChange: (pico: PICO) => void;
  lang: Lang;
}

export default function PICOForm({ pico, onChange, lang }: PICOFormProps) {
  const update = (field: keyof PICO, value: string) => {
    onChange({ ...pico, [field]: value });
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
      <Field
        label={t('pico.p', lang)}
        placeholder={t('pico.p.placeholder', lang)}
        value={pico.population}
        onChange={(v) => update('population', v)}
      />
      <Field
        label={t('pico.i', lang)}
        placeholder={t('pico.i.placeholder', lang)}
        value={pico.intervention}
        onChange={(v) => update('intervention', v)}
      />
      <Field
        label={t('pico.c', lang)}
        placeholder={t('pico.c.placeholder', lang)}
        value={pico.comparison}
        onChange={(v) => update('comparison', v)}
      />
      <Field
        label={t('pico.o', lang)}
        placeholder={t('pico.o.placeholder', lang)}
        value={pico.outcome}
        onChange={(v) => update('outcome', v)}
      />
    </div>
  );
}

function Field({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%',
          padding: '8px 12px',
          border: '1px solid #d1d5db',
          borderRadius: 6,
          fontSize: 13,
          outline: 'none',
          boxSizing: 'border-box',
        }}
      />
    </div>
  );
}
