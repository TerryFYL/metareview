import type { PICO } from '../lib/types';

interface PICOFormProps {
  pico: PICO;
  onChange: (pico: PICO) => void;
}

export default function PICOForm({ pico, onChange }: PICOFormProps) {
  const update = (field: keyof PICO, value: string) => {
    onChange({ ...pico, [field]: value });
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      <Field
        label="P — Population / Patients"
        placeholder="e.g., Adults with type 2 diabetes"
        value={pico.population}
        onChange={(v) => update('population', v)}
      />
      <Field
        label="I — Intervention"
        placeholder="e.g., Metformin monotherapy"
        value={pico.intervention}
        onChange={(v) => update('intervention', v)}
      />
      <Field
        label="C — Comparison"
        placeholder="e.g., Placebo or lifestyle modification"
        value={pico.comparison}
        onChange={(v) => update('comparison', v)}
      />
      <Field
        label="O — Outcome"
        placeholder="e.g., HbA1c reduction at 12 weeks"
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
