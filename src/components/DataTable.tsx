import { useState, useRef } from 'react';
import type { Study, EffectMeasure, BinaryData, ContinuousData } from '../lib/types';
import { exportCSV, importCSV } from '../lib/csv';
import { t, type Lang } from '../lib/i18n';

interface DataTableProps {
  studies: Study[];
  measure: EffectMeasure;
  onStudiesChange: (studies: Study[]) => void;
  lang: Lang;
}

function generateId() {
  return Math.random().toString(36).slice(2, 9);
}

function emptyBinaryStudy(): Study {
  return {
    id: generateId(),
    name: '',
    year: undefined,
    data: { events1: 0, total1: 0, events2: 0, total2: 0 } as BinaryData,
  };
}

function emptyContinuousStudy(): Study {
  return {
    id: generateId(),
    name: '',
    year: undefined,
    data: { mean1: 0, sd1: 0, n1: 0, mean2: 0, sd2: 0, n2: 0 } as ContinuousData,
  };
}

const isBinary = (m: EffectMeasure) => m === 'OR' || m === 'RR';

export default function DataTable({ studies, measure, onStudiesChange, lang }: DataTableProps) {
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExportCSV = () => {
    const csv = exportCSV(studies, measure);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `metareview-${measure.toLowerCase()}-data.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result;
      if (typeof text !== 'string') return;
      const imported = importCSV(text, measure);
      if (imported.length > 0) {
        onStudiesChange([...studies, ...imported]);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const addStudy = () => {
    const newStudy = isBinary(measure) ? emptyBinaryStudy() : emptyContinuousStudy();
    onStudiesChange([...studies, newStudy]);
  };

  const removeStudy = (id: string) => {
    onStudiesChange(studies.filter((s) => s.id !== id));
  };

  const updateStudy = (id: string, field: string, value: string) => {
    onStudiesChange(
      studies.map((s) => {
        if (s.id !== id) return s;
        if (field === 'name') return { ...s, name: value };
        if (field === 'year') return { ...s, year: value ? parseInt(value) : undefined };
        if (field === 'subgroup') return { ...s, subgroup: value || undefined };
        const numVal = parseFloat(value) || 0;
        return { ...s, data: { ...s.data, [field]: numVal } };
      })
    );
  };

  const binary = isBinary(measure);

  const columns = binary
    ? [
        { key: 'name', label: t('table.study', lang), type: 'text' as const, width: '140px' },
        { key: 'year', label: t('table.year', lang), type: 'number' as const, width: '65px' },
        { key: 'subgroup', label: t('table.subgroup', lang), type: 'text' as const, width: '100px' },
        { key: 'events1', label: t('table.eventsT', lang), type: 'number' as const, width: '80px' },
        { key: 'total1', label: t('table.totalT', lang), type: 'number' as const, width: '80px' },
        { key: 'events2', label: t('table.eventsC', lang), type: 'number' as const, width: '80px' },
        { key: 'total2', label: t('table.totalC', lang), type: 'number' as const, width: '80px' },
      ]
    : [
        { key: 'name', label: t('table.study', lang), type: 'text' as const, width: '140px' },
        { key: 'year', label: t('table.year', lang), type: 'number' as const, width: '65px' },
        { key: 'subgroup', label: t('table.subgroup', lang), type: 'text' as const, width: '100px' },
        { key: 'mean1', label: t('table.meanT', lang), type: 'number' as const, width: '80px' },
        { key: 'sd1', label: t('table.sdT', lang), type: 'number' as const, width: '75px' },
        { key: 'n1', label: t('table.nT', lang), type: 'number' as const, width: '65px' },
        { key: 'mean2', label: t('table.meanC', lang), type: 'number' as const, width: '80px' },
        { key: 'sd2', label: t('table.sdC', lang), type: 'number' as const, width: '75px' },
        { key: 'n2', label: t('table.nC', lang), type: 'number' as const, width: '65px' },
      ];

  const getValue = (study: Study, key: string): string => {
    if (key === 'name') return study.name;
    if (key === 'year') return study.year?.toString() || '';
    if (key === 'subgroup') return study.subgroup || '';
    const val = (study.data as unknown as Record<string, number>)[key];
    return val?.toString() || '0';
  };

  return (
    <div>
      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13, minWidth: 520 }}>
          <thead>
            <tr>
              <th style={thStyle}>#</th>
              {columns.map((col) => (
                <th key={col.key} style={{ ...thStyle, width: col.width }}>
                  {col.label}
                </th>
              ))}
              <th style={thStyle}></th>
            </tr>
          </thead>
          <tbody>
            {studies.map((study, idx) => (
              <tr key={study.id} style={{ background: idx % 2 ? '#f9fafb' : '#fff' }}>
                <td style={tdStyle}>{idx + 1}</td>
                {columns.map((col) => (
                  <td key={col.key} style={tdStyle}>
                    <input
                      type={col.type}
                      value={
                        editingCell === `${study.id}-${col.key}`
                          ? undefined
                          : getValue(study, col.key)
                      }
                      defaultValue={
                        editingCell === `${study.id}-${col.key}`
                          ? getValue(study, col.key)
                          : undefined
                      }
                      onFocus={() => setEditingCell(`${study.id}-${col.key}`)}
                      onBlur={(e) => {
                        setEditingCell(null);
                        updateStudy(study.id, col.key, e.target.value);
                      }}
                      onChange={(e) => {
                        if (editingCell !== `${study.id}-${col.key}`) {
                          updateStudy(study.id, col.key, e.target.value);
                        }
                      }}
                      style={inputStyle}
                      step={col.type === 'number' ? 'any' : undefined}
                    />
                  </td>
                ))}
                <td style={tdStyle}>
                  <button
                    onClick={() => removeStudy(study.id)}
                    style={deleteBtnStyle}
                    title="Remove study"
                  >
                    &times;
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        <button onClick={addStudy} style={addBtnStyle}>
          {t('table.addStudy', lang)}
        </button>
        <button onClick={handleExportCSV} style={csvBtnStyle} disabled={studies.length === 0}>
          {t('table.exportCSV', lang)}
        </button>
        <button onClick={() => fileInputRef.current?.click()} style={csvBtnStyle}>
          {t('table.importCSV', lang)}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={handleImportCSV}
          style={{ display: 'none' }}
        />
      </div>

      {studies.length === 0 && (
        <p style={{ color: '#9ca3af', textAlign: 'center', marginTop: 24, fontSize: 13 }}>
          {t('table.empty', lang)}
        </p>
      )}
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: '8px 4px',
  borderBottom: '2px solid #e5e7eb',
  textAlign: 'left',
  fontSize: 11,
  fontWeight: 600,
  color: '#6b7280',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  whiteSpace: 'nowrap',
};

const tdStyle: React.CSSProperties = {
  padding: '4px 3px',
  borderBottom: '1px solid #f3f4f6',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '5px 6px',
  border: '1px solid #e5e7eb',
  borderRadius: 4,
  fontSize: 13,
  outline: 'none',
  background: 'transparent',
  boxSizing: 'border-box',
};

const addBtnStyle: React.CSSProperties = {
  padding: '7px 16px',
  background: '#f3f4f6',
  border: '1px dashed #d1d5db',
  borderRadius: 6,
  cursor: 'pointer',
  fontSize: 13,
  color: '#374151',
};

const csvBtnStyle: React.CSSProperties = {
  padding: '7px 14px',
  background: '#fff',
  border: '1px solid #d1d5db',
  borderRadius: 6,
  cursor: 'pointer',
  fontSize: 12,
  color: '#374151',
};

const deleteBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: '#ef4444',
  cursor: 'pointer',
  fontSize: 18,
  padding: '2px 6px',
  borderRadius: 4,
};
