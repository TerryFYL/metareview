import { useState } from 'react';
import type { Study, EffectMeasure, BinaryData, ContinuousData } from '../lib/types';

interface DataTableProps {
  studies: Study[];
  measure: EffectMeasure;
  onStudiesChange: (studies: Study[]) => void;
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

export default function DataTable({ studies, measure, onStudiesChange }: DataTableProps) {
  const [editingCell, setEditingCell] = useState<string | null>(null);

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
        const numVal = parseFloat(value) || 0;
        return { ...s, data: { ...s.data, [field]: numVal } };
      })
    );
  };

  const binary = isBinary(measure);

  const columns = binary
    ? [
        { key: 'name', label: 'Study', type: 'text' as const, width: '160px' },
        { key: 'year', label: 'Year', type: 'number' as const, width: '70px' },
        { key: 'events1', label: 'Events (T)', type: 'number' as const, width: '90px' },
        { key: 'total1', label: 'Total (T)', type: 'number' as const, width: '90px' },
        { key: 'events2', label: 'Events (C)', type: 'number' as const, width: '90px' },
        { key: 'total2', label: 'Total (C)', type: 'number' as const, width: '90px' },
      ]
    : [
        { key: 'name', label: 'Study', type: 'text' as const, width: '160px' },
        { key: 'year', label: 'Year', type: 'number' as const, width: '70px' },
        { key: 'mean1', label: 'Mean (T)', type: 'number' as const, width: '90px' },
        { key: 'sd1', label: 'SD (T)', type: 'number' as const, width: '80px' },
        { key: 'n1', label: 'N (T)', type: 'number' as const, width: '70px' },
        { key: 'mean2', label: 'Mean (C)', type: 'number' as const, width: '90px' },
        { key: 'sd2', label: 'SD (C)', type: 'number' as const, width: '80px' },
        { key: 'n2', label: 'N (C)', type: 'number' as const, width: '70px' },
      ];

  const getValue = (study: Study, key: string): string => {
    if (key === 'name') return study.name;
    if (key === 'year') return study.year?.toString() || '';
    const val = (study.data as unknown as Record<string, number>)[key];
    return val?.toString() || '0';
  };

  return (
    <div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>
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

      <button onClick={addStudy} style={addBtnStyle}>
        + Add Study
      </button>

      {studies.length === 0 && (
        <p style={{ color: '#9ca3af', textAlign: 'center', marginTop: 24, fontSize: 13 }}>
          No studies added yet. Click "+ Add Study" to begin.
        </p>
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
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

const tdStyle: React.CSSProperties = {
  padding: '4px 4px',
  borderBottom: '1px solid #f3f4f6',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '5px 8px',
  border: '1px solid #e5e7eb',
  borderRadius: 4,
  fontSize: 13,
  outline: 'none',
  background: 'transparent',
  boxSizing: 'border-box',
};

const addBtnStyle: React.CSSProperties = {
  marginTop: 12,
  padding: '7px 16px',
  background: '#f3f4f6',
  border: '1px dashed #d1d5db',
  borderRadius: 6,
  cursor: 'pointer',
  fontSize: 13,
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
