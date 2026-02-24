import { useState, useRef, useCallback } from 'react';
import type { Study, EffectMeasure, BinaryData, ContinuousData, HRData } from '../lib/types';
import { exportCSV, importCSV } from '../lib/csv';
import { t, type Lang } from '../lib/i18n';
import { trackFeature } from '../lib/analytics';

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

function emptyHRStudy(): Study {
  return {
    id: generateId(),
    name: '',
    year: undefined,
    data: { hr: 0, ciLower: 0, ciUpper: 0 } as HRData,
  };
}

const isBinary = (m: EffectMeasure) => m === 'OR' || m === 'RR';
const isHR = (m: EffectMeasure) => m === 'HR';

type CellIssue = 'error' | 'warning' | null;

/** Check if a cell value has a data quality issue */
function getCellIssue(study: Study, key: string, measure: EffectMeasure): CellIssue {
  if (key === 'name' || key === 'year' || key === 'subgroup') return null;
  const data = study.data as unknown as Record<string, number>;
  const val = data[key];

  if (isBinary(measure)) {
    const d = study.data as BinaryData;
    if (key === 'total1' || key === 'total2') {
      if (val <= 0) return 'error';
    }
    if (key === 'events1') {
      if (val < 0 || val > d.total1) return 'error';
    }
    if (key === 'events2') {
      if (val < 0 || val > d.total2) return 'error';
    }
  } else if (isHR(measure)) {
    const d = study.data as HRData;
    if (key === 'hr' && val <= 0) return 'error';
    if (key === 'ciLower' && (val <= 0 || val >= d.hr)) return 'error';
    if (key === 'ciUpper' && (val <= 0 || val <= d.hr)) return 'error';
  } else {
    // continuous
    if ((key === 'sd1' || key === 'sd2') && val <= 0) return 'error';
    if ((key === 'n1' || key === 'n2') && val <= 0) return 'error';
  }

  // Warnings for potential issues
  if (isBinary(measure)) {
    if ((key === 'events1' || key === 'events2') && val === 0) return 'warning';
  }

  return null;
}

export default function DataTable({ studies, measure, onStudiesChange, lang }: DataTableProps) {
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [pasteToast, setPasteToast] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);

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

  /** Handle paste from Excel / Google Sheets (tab-separated) */
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData('text/plain');
    if (!text) return;

    // Detect tab-separated (Excel/Sheets paste) — at least one tab per line
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length === 0) return;
    const hasTabs = lines.some(l => l.includes('\t'));
    if (!hasTabs) return; // Not spreadsheet data, let normal paste happen

    e.preventDefault(); // Take over paste

    const dataColCount = isHR(measure) ? 3 : isBinary(measure) ? 4 : 6;

    // Parse lines into studies
    const parsed: Study[] = [];
    for (const line of lines) {
      const cells = line.split('\t').map(c => c.trim());
      // Skip header-like rows (first cell matches a known header)
      const firstLower = cells[0]?.toLowerCase() || '';
      if (firstLower === 'study' || firstLower === '研究' || firstLower === 'name') continue;

      // Determine column mapping: name, [year], [subgroup], ...data...
      // Minimum: just data columns; maximum: name + year + subgroup + data
      let name = '';
      let year: number | undefined;
      let subgroup: string | undefined;
      let dataStart = 0;

      if (cells.length >= dataColCount + 3) {
        // name + year + subgroup + data
        name = cells[0] || '';
        year = parseInt(cells[1]) || undefined;
        subgroup = cells[2] || undefined;
        dataStart = 3;
      } else if (cells.length >= dataColCount + 2) {
        // name + year + data
        name = cells[0] || '';
        year = parseInt(cells[1]) || undefined;
        dataStart = 2;
      } else if (cells.length >= dataColCount + 1) {
        // name + data
        name = cells[0] || '';
        dataStart = 1;
      } else if (cells.length >= dataColCount) {
        // just data
        dataStart = 0;
      } else {
        continue; // Not enough columns
      }

      const nums = cells.slice(dataStart).map(c => parseFloat(c) || 0);
      const id = Math.random().toString(36).slice(2, 9);

      if (isHR(measure)) {
        parsed.push({ id, name: name || `Study ${studies.length + parsed.length + 1}`, year, subgroup, data: { hr: nums[0], ciLower: nums[1], ciUpper: nums[2] } as HRData });
      } else if (isBinary(measure)) {
        parsed.push({ id, name: name || `Study ${studies.length + parsed.length + 1}`, year, subgroup, data: { events1: nums[0], total1: nums[1], events2: nums[2], total2: nums[3] } as BinaryData });
      } else {
        parsed.push({ id, name: name || `Study ${studies.length + parsed.length + 1}`, year, subgroup, data: { mean1: nums[0], sd1: nums[1], n1: nums[2], mean2: nums[3], sd2: nums[4], n2: nums[5] } as ContinuousData });
      }
    }

    if (parsed.length > 0) {
      onStudiesChange([...studies, ...parsed]);
      trackFeature('paste_import');
      const msg = t('table.pasteHint', lang).replace('{n}', String(parsed.length));
      setPasteToast(msg);
      setTimeout(() => setPasteToast(null), 3000);
    }
  }, [studies, measure, onStudiesChange, lang]);

  const addStudy = () => {
    const newStudy = isHR(measure) ? emptyHRStudy() : isBinary(measure) ? emptyBinaryStudy() : emptyContinuousStudy();
    onStudiesChange([...studies, newStudy]);
    // Focus the name cell of the new study after render
    setTimeout(() => {
      if (!tableRef.current) return;
      const inputs = tableRef.current.querySelectorAll('tbody input');
      const lastRowFirstInput = inputs[inputs.length - columns.length] as HTMLInputElement | undefined;
      lastRowFirstInput?.focus();
    }, 50);
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

  /** Navigate to adjacent cell via keyboard */
  const navigateCell = useCallback((currentInput: HTMLInputElement, direction: 'up' | 'down' | 'left' | 'right') => {
    if (!tableRef.current) return;
    const inputs = Array.from(tableRef.current.querySelectorAll('tbody input')) as HTMLInputElement[];
    const currentIdx = inputs.indexOf(currentInput);
    if (currentIdx === -1) return;

    const colCount = columns.length;
    let targetIdx = -1;

    switch (direction) {
      case 'right': targetIdx = currentIdx + 1; break;
      case 'left': targetIdx = currentIdx - 1; break;
      case 'down': targetIdx = currentIdx + colCount; break;
      case 'up': targetIdx = currentIdx - colCount; break;
    }

    if (targetIdx >= 0 && targetIdx < inputs.length) {
      // Commit current cell first
      currentInput.blur();
      setTimeout(() => {
        inputs[targetIdx].focus();
        inputs[targetIdx].select();
      }, 10);
    } else if (direction === 'down' && currentIdx + colCount >= inputs.length) {
      // At the last row pressing down: auto-add a new study
      currentInput.blur();
      addStudy();
    }
  }, [studies.length, measure]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    const input = e.currentTarget;

    if (e.key === 'Enter') {
      e.preventDefault();
      navigateCell(input, 'down');
    } else if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault();
      navigateCell(input, 'right');
    } else if (e.key === 'Tab' && e.shiftKey) {
      e.preventDefault();
      navigateCell(input, 'left');
    } else if (e.key === 'ArrowDown' && e.altKey) {
      e.preventDefault();
      navigateCell(input, 'down');
    } else if (e.key === 'ArrowUp' && e.altKey) {
      e.preventDefault();
      navigateCell(input, 'up');
    } else if (e.key === 'Escape') {
      input.blur();
    }
  }, [navigateCell]);

  const columns = isHR(measure)
    ? [
        { key: 'name', label: t('table.study', lang), type: 'text' as const, width: '140px' },
        { key: 'year', label: t('table.year', lang), type: 'number' as const, width: '65px' },
        { key: 'subgroup', label: t('table.subgroup', lang), type: 'text' as const, width: '100px' },
        { key: 'hr', label: t('table.hr', lang), type: 'number' as const, width: '85px' },
        { key: 'ciLower', label: t('table.ciLower', lang), type: 'number' as const, width: '85px' },
        { key: 'ciUpper', label: t('table.ciUpper', lang), type: 'number' as const, width: '85px' },
      ]
    : isBinary(measure)
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

  const getInputStyle = (issue: CellIssue): React.CSSProperties => {
    if (issue === 'error') {
      return { ...inputStyle, borderColor: '#ef4444', background: '#fef2f2' };
    }
    if (issue === 'warning') {
      return { ...inputStyle, borderColor: '#f59e0b', background: '#fffbeb' };
    }
    return inputStyle;
  };

  const getCellTitle = (issue: CellIssue, key: string, study: Study): string | undefined => {
    if (issue !== 'error') return undefined;
    if (isBinary(measure)) {
      const d = study.data as BinaryData;
      if ((key === 'total1' || key === 'total2') && d[key as keyof BinaryData] <= 0) return t('table.hint.totalGt0', lang);
      if (key === 'events1' && d.events1 > d.total1) return t('table.hint.eventsLteTotal', lang);
      if (key === 'events2' && d.events2 > d.total2) return t('table.hint.eventsLteTotal', lang);
    } else if (isHR(measure)) {
      if (key === 'hr') return t('table.hint.hrGt0', lang);
      if (key === 'ciLower' || key === 'ciUpper') return t('table.hint.ciValid', lang);
    } else {
      if (key === 'sd1' || key === 'sd2') return t('table.hint.sdGt0', lang);
      if (key === 'n1' || key === 'n2') return t('table.hint.nGt0', lang);
    }
    return undefined;
  };

  return (
    <div onPaste={handlePaste}>
      {pasteToast && (
        <div style={toastStyle}>{pasteToast}</div>
      )}
      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <table ref={tableRef} style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13, minWidth: 520 }}>
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
                {columns.map((col) => {
                  const issue = getCellIssue(study, col.key, measure);
                  return (
                    <td key={col.key} style={tdStyle} title={getCellTitle(issue, col.key, study)}>
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
                        onFocus={(e) => {
                          setEditingCell(`${study.id}-${col.key}`);
                          if (col.type === 'number') e.target.select();
                        }}
                        onBlur={(e) => {
                          setEditingCell(null);
                          updateStudy(study.id, col.key, e.target.value);
                        }}
                        onChange={(e) => {
                          if (editingCell !== `${study.id}-${col.key}`) {
                            updateStudy(study.id, col.key, e.target.value);
                          }
                        }}
                        onKeyDown={handleKeyDown}
                        style={getInputStyle(issue)}
                        step={col.type === 'number' ? 'any' : undefined}
                      />
                    </td>
                  );
                })}
                <td style={tdStyle}>
                  <button
                    onClick={() => removeStudy(study.id)}
                    style={deleteBtnStyle}
                    title="Remove study"
                    tabIndex={-1}
                  >
                    &times;
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap', alignItems: 'center' }}>
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
        {studies.length > 0 && (
          <span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 'auto' }}>
            {t('table.navHint', lang)} · {t('table.pasteTip', lang)}
          </span>
        )}
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
  transition: 'border-color 0.15s, background 0.15s',
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

const toastStyle: React.CSSProperties = {
  padding: '8px 14px',
  background: '#f0fdf4',
  border: '1px solid #bbf7d0',
  borderRadius: 6,
  fontSize: 12,
  color: '#16a34a',
  marginBottom: 8,
  fontWeight: 500,
};
