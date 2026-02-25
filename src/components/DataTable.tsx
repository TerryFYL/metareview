import { useState, useRef, useCallback, useMemo } from 'react';
import type { Study, EffectMeasure, BinaryData, ContinuousData, HRData } from '../lib/types';
import { exportCSV, importCSV } from '../lib/csv';
import { importRIS } from '../lib/ris';
import { t, type Lang } from '../lib/i18n';
import { trackFeature } from '../lib/analytics';
import type { InlineExtractionProgress } from '../lib/extraction/inline-extract';

interface DataTableProps {
  studies: Study[];
  measure: EffectMeasure;
  onStudiesChange: (studies: Study[]) => void;
  lang: Lang;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onLoadDemo?: () => void;
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

/** Check if a study has all data fields set to zero (needs data entry) */
function isStudyDataEmpty(study: Study, measure: EffectMeasure): boolean {
  if (!study.name) return false; // Unnamed studies are manually created, not imported
  const data = study.data as unknown as Record<string, number>;
  if (isHR(measure)) {
    const d = data as unknown as HRData;
    return d.hr === 0 && d.ciLower === 0 && d.ciUpper === 0;
  }
  if (isBinary(measure)) {
    const d = data as unknown as BinaryData;
    return d.events1 === 0 && d.total1 === 0 && d.events2 === 0 && d.total2 === 0;
  }
  // Continuous
  const d = data as unknown as ContinuousData;
  return d.mean1 === 0 && d.sd1 === 0 && d.n1 === 0 && d.mean2 === 0 && d.sd2 === 0 && d.n2 === 0;
}

/** Check if a cell value has a data quality issue */
function getCellIssue(study: Study, key: string, measure: EffectMeasure): CellIssue {
  if (key === 'name' || key === 'year' || key === 'subgroup' || key === 'dose') return null;
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
    if (key === 'ciUpper' && (val <= 0 || val <= d.hr || val <= d.ciLower)) return 'error';
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

export default function DataTable({ studies, measure, onStudiesChange, lang, onUndo, onRedo, canUndo, canRedo, onLoadDemo }: DataTableProps) {
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [pasteToast, setPasteToast] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchSubgroup, setBatchSubgroup] = useState('');
  const [showSubgroupInput, setShowSubgroupInput] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const risInputRef = useRef<HTMLInputElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);

  // Per-row PDF extraction state
  const [extractingId, setExtractingId] = useState<string | null>(null);
  const [extractProgress, setExtractProgress] = useState<InlineExtractionProgress | null>(null);
  const [extractToast, setExtractToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const extractTargetId = useRef<string | null>(null);

  // Batch PDF extraction state
  const [batchExtracting, setBatchExtracting] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ done: 0, total: 0, success: 0, fail: 0 });
  const batchInputRef = useRef<HTMLInputElement>(null);
  const batchAbortRef = useRef(false);

  // Count studies needing data entry
  const emptyDataCount = useMemo(
    () => studies.filter(s => isStudyDataEmpty(s, measure)).length,
    [studies, measure]
  );

  // Real-time validation: count errors and warnings across all studies
  const validationSummary = useMemo(() => {
    let errors = 0;
    let warnings = 0;
    const dataKeys = isHR(measure)
      ? ['hr', 'ciLower', 'ciUpper']
      : isBinary(measure)
      ? ['events1', 'total1', 'events2', 'total2']
      : ['mean1', 'sd1', 'n1', 'mean2', 'sd2', 'n2'];
    for (const s of studies) {
      if (isStudyDataEmpty(s, measure)) continue; // skip empty stubs
      if (!s.name.trim()) errors++;
      for (const key of dataKeys) {
        const issue = getCellIssue(s, key, measure);
        if (issue === 'error') errors++;
        else if (issue === 'warning') warnings++;
      }
    }
    return { errors, warnings };
  }, [studies, measure]);

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
      const result = importCSV(text, measure);
      if (result.studies.length > 0) {
        onStudiesChange([...studies, ...result.studies]);
        let msg = t('table.pasteHint', lang).replace('{n}', String(result.studies.length));
        if (result.skippedRows > 0) {
          msg += ' · ' + t('table.csvColumnMismatch', lang)
            .replace('{measure}', measure)
            .replace('{expected}', String(result.expectedColumns))
            .replace('{actual}', String(result.actualColumns ?? '?'))
            .replace('{skipped}', String(result.skippedRows));
        }
        setPasteToast(msg);
        setTimeout(() => setPasteToast(null), result.skippedRows > 0 ? 6000 : 3000);
      } else if (result.skippedRows > 0) {
        const msg = t('table.csvColumnMismatch', lang)
          .replace('{measure}', measure)
          .replace('{expected}', String(result.expectedColumns))
          .replace('{actual}', String(result.actualColumns ?? '?'))
          .replace('{skipped}', String(result.skippedRows));
        setPasteToast(msg);
        setTimeout(() => setPasteToast(null), 6000);
      } else {
        const msg = lang === 'zh' ? 'CSV 文件中未找到可导入的数据' : 'No importable data found in CSV file';
        setPasteToast(msg);
        setTimeout(() => setPasteToast(null), 4000);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleImportRIS = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result;
      if (typeof text !== 'string') return;
      const imported = importRIS(text, measure);
      if (imported.length > 0) {
        onStudiesChange([...studies, ...imported]);
        trackFeature('ris_import');
        const msg = t('table.risImportHint', lang).replace('{n}', String(imported.length));
        setPasteToast(msg);
        setTimeout(() => setPasteToast(null), 3000);
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
    let skippedCells = 0;
    let skippedRows = 0;
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
        skippedRows++;
        continue; // Not enough columns
      }

      let skippedInRow = 0;
      const nums = cells.slice(dataStart).map(c => {
        const v = parseFloat(c);
        if (isNaN(v) && c.trim() !== '' && c.trim() !== '0') skippedInRow++;
        return isNaN(v) ? 0 : v;
      });
      skippedCells += skippedInRow;
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
      let msg = skippedCells > 0
        ? t('table.pasteSkipped', lang).replace('{n}', String(parsed.length)).replace('{skipped}', String(skippedCells))
        : t('table.pasteHint', lang).replace('{n}', String(parsed.length));
      if (skippedRows > 0) {
        msg += ' · ' + t('table.pasteColumnMismatch', lang)
          .replace('{measure}', measure)
          .replace('{expected}', String(dataColCount))
          .replace('{skipped}', String(skippedRows));
      }
      setPasteToast(msg);
      setTimeout(() => setPasteToast(null), (skippedCells > 0 || skippedRows > 0) ? 6000 : 3000);
    } else if (skippedRows > 0) {
      const msg = t('table.pasteColumnMismatch', lang)
        .replace('{measure}', measure)
        .replace('{expected}', String(dataColCount))
        .replace('{skipped}', String(skippedRows));
      setPasteToast(msg);
      setTimeout(() => setPasteToast(null), 6000);
    }
  }, [studies, measure, onStudiesChange, lang]);

  const addStudy = () => {
    const newStudy = isHR(measure) ? emptyHRStudy() : isBinary(measure) ? emptyBinaryStudy() : emptyContinuousStudy();
    onStudiesChange([...studies, newStudy]);
    // Focus the name cell of the new study after render
    setTimeout(() => {
      if (!tableRef.current) return;
      const inputs = tableRef.current.querySelectorAll('tbody input[type="text"], tbody input[type="number"]');
      const lastRowFirstInput = inputs[inputs.length - columns.length] as HTMLInputElement | undefined;
      lastRowFirstInput?.focus();
    }, 50);
  };

  const removeStudy = (id: string) => {
    onStudiesChange(studies.filter((s) => s.id !== id));
    setSelectedIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
  };

  const updateStudy = (id: string, field: string, value: string) => {
    onStudiesChange(
      studies.map((s) => {
        if (s.id !== id) return s;
        if (field === 'name') return { ...s, name: value };
        if (field === 'year') return { ...s, year: value ? parseInt(value) : undefined };
        if (field === 'subgroup') return { ...s, subgroup: value || undefined };
        if (field === 'dose') return { ...s, dose: value ? parseFloat(value) : undefined };
        const numVal = parseFloat(value) || 0;
        return { ...s, data: { ...s.data, [field]: numVal } };
      })
    );
  };

  // Batch operations
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === studies.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(studies.map(s => s.id)));
    }
  };

  const batchDelete = () => {
    if (selectedIds.size === 0) return;
    onStudiesChange(studies.filter(s => !selectedIds.has(s.id)));
    setSelectedIds(new Set());
    trackFeature('batch_delete');
  };

  const applyBatchSubgroup = () => {
    if (selectedIds.size === 0 || !batchSubgroup.trim()) return;
    onStudiesChange(
      studies.map(s => selectedIds.has(s.id) ? { ...s, subgroup: batchSubgroup.trim() } : s)
    );
    setShowSubgroupInput(false);
    setBatchSubgroup('');
    trackFeature('batch_subgroup');
  };

  // Per-row PDF extraction
  const startPdfExtract = useCallback((studyId: string) => {
    extractTargetId.current = studyId;
    pdfInputRef.current?.click();
  }, []);

  const handlePdfFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const targetId = extractTargetId.current;
    if (!file || !targetId) return;
    e.target.value = '';

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setExtractToast({ type: 'error', message: t('table.extractScanned', lang) });
      setTimeout(() => setExtractToast(null), 4000);
      return;
    }

    setExtractingId(targetId);
    setExtractToast(null);

    try {
      // Dynamic import to avoid bundling pdfjs-dist in main chunk
      const { extractStudyFromPDF } = await import('../lib/extraction/inline-extract');
      trackFeature('inline_pdf_extract');

      const result = await extractStudyFromPDF(
        file,
        measure,
        (progress) => setExtractProgress(progress),
      );

      if (result.success && result.data) {
        // Auto-fill the study row with extracted data
        onStudiesChange(
          studies.map(s => s.id === targetId ? { ...s, data: result.data! } : s)
        );
        const confidenceLabel = t(`table.confidence.${result.confidence}`, lang);
        const msg = t('table.extractSuccess', lang).replace('{confidence}', confidenceLabel);
        setExtractToast({ type: 'success', message: msg });
        trackFeature('inline_extract_success');
      } else {
        setExtractToast({ type: 'error', message: t('table.extractFail', lang) });
        trackFeature('inline_extract_fail');
      }
    } catch {
      setExtractToast({ type: 'error', message: t('table.extractFail', lang) });
    } finally {
      setExtractingId(null);
      setExtractProgress(null);
      extractTargetId.current = null;
      setTimeout(() => setExtractToast(null), 5000);
    }
  }, [studies, measure, onStudiesChange, lang]);

  // Batch PDF extraction: upload multiple PDFs, extract into empty studies sequentially
  const handleBatchPdfFiles = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).filter(f => f.name.toLowerCase().endsWith('.pdf'));
    e.target.value = '';
    if (files.length === 0) return;

    const emptyStudies = studies.filter(s => isStudyDataEmpty(s, measure));
    const toProcess = Math.min(files.length, emptyStudies.length);
    if (toProcess === 0) return;

    setBatchExtracting(true);
    batchAbortRef.current = false;
    setBatchProgress({ done: 0, total: toProcess, success: 0, fail: 0 });

    const { extractStudyFromPDF } = await import('../lib/extraction/inline-extract');
    trackFeature('batch_inline_extract');

    let updatedStudies = [...studies];
    let success = 0;
    let fail = 0;

    for (let i = 0; i < toProcess; i++) {
      if (batchAbortRef.current) break;

      const targetStudy = emptyStudies[i];
      setExtractingId(targetStudy.id);

      try {
        const result = await extractStudyFromPDF(
          files[i],
          measure,
          (progress) => setExtractProgress(progress),
        );

        if (result.success && result.data) {
          updatedStudies = updatedStudies.map(s =>
            s.id === targetStudy.id ? { ...s, data: result.data! } : s
          );
          success++;
        } else {
          fail++;
        }
      } catch {
        fail++;
      }

      setBatchProgress({ done: i + 1, total: toProcess, success, fail });
      setExtractProgress(null);
    }

    onStudiesChange(updatedStudies);
    setExtractingId(null);
    setBatchExtracting(false);

    const msg = t('table.batchExtractDone', lang)
      .replace('{success}', String(success))
      .replace('{fail}', String(fail));
    setExtractToast({ type: success > 0 ? 'success' : 'error', message: msg });
    setTimeout(() => setExtractToast(null), 5000);
  }, [studies, measure, onStudiesChange, lang]);

  const cancelBatchExtract = useCallback(() => {
    batchAbortRef.current = true;
  }, []);

  /** Navigate to adjacent cell via keyboard */
  const navigateCell = useCallback((currentInput: HTMLInputElement, direction: 'up' | 'down' | 'left' | 'right') => {
    if (!tableRef.current) return;
    const inputs = Array.from(tableRef.current.querySelectorAll('tbody input[type="text"], tbody input[type="number"]')) as HTMLInputElement[];
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

  const doseCol = { key: 'dose', label: t('table.dose', lang), type: 'number' as const, width: '75px' };

  // Column widths optimized per effect measure type:
  // HR (7 cols) — wider name/CI since fewer data columns
  // Binary (8 cols) — balanced data columns
  // Continuous (10 cols) — compact N columns to give space to mean/SD
  const columns = isHR(measure)
    ? [
        { key: 'name', label: t('table.study', lang), type: 'text' as const, width: '160px' },
        { key: 'year', label: t('table.year', lang), type: 'number' as const, width: '65px' },
        { key: 'subgroup', label: t('table.subgroup', lang), type: 'text' as const, width: '100px' },
        doseCol,
        { key: 'hr', label: t('table.hr', lang), type: 'number' as const, width: '90px' },
        { key: 'ciLower', label: t('table.ciLower', lang), type: 'number' as const, width: '90px' },
        { key: 'ciUpper', label: t('table.ciUpper', lang), type: 'number' as const, width: '90px' },
      ]
    : isBinary(measure)
    ? [
        { key: 'name', label: t('table.study', lang), type: 'text' as const, width: '140px' },
        { key: 'year', label: t('table.year', lang), type: 'number' as const, width: '65px' },
        { key: 'subgroup', label: t('table.subgroup', lang), type: 'text' as const, width: '100px' },
        doseCol,
        { key: 'events1', label: t('table.eventsT', lang), type: 'number' as const, width: '80px' },
        { key: 'total1', label: t('table.totalT', lang), type: 'number' as const, width: '80px' },
        { key: 'events2', label: t('table.eventsC', lang), type: 'number' as const, width: '80px' },
        { key: 'total2', label: t('table.totalC', lang), type: 'number' as const, width: '80px' },
      ]
    : [
        { key: 'name', label: t('table.study', lang), type: 'text' as const, width: '130px' },
        { key: 'year', label: t('table.year', lang), type: 'number' as const, width: '60px' },
        { key: 'subgroup', label: t('table.subgroup', lang), type: 'text' as const, width: '90px' },
        doseCol,
        { key: 'mean1', label: t('table.meanT', lang), type: 'number' as const, width: '82px' },
        { key: 'sd1', label: t('table.sdT', lang), type: 'number' as const, width: '78px' },
        { key: 'n1', label: t('table.nT', lang), type: 'number' as const, width: '58px' },
        { key: 'mean2', label: t('table.meanC', lang), type: 'number' as const, width: '82px' },
        { key: 'sd2', label: t('table.sdC', lang), type: 'number' as const, width: '78px' },
        { key: 'n2', label: t('table.nC', lang), type: 'number' as const, width: '58px' },
      ];

  const getValue = (study: Study, key: string): string => {
    if (key === 'name') return study.name;
    if (key === 'year') return study.year?.toString() || '';
    if (key === 'subgroup') return study.subgroup || '';
    if (key === 'dose') return study.dose != null ? study.dose.toString() : '';
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

  const allSelected = studies.length > 0 && selectedIds.size === studies.length;
  const someSelected = selectedIds.size > 0;

  return (
    <div onPaste={handlePaste}>
      {/* Hidden PDF input for per-row extraction */}
      <input
        ref={pdfInputRef}
        type="file"
        accept=".pdf"
        onChange={handlePdfFile}
        style={{ display: 'none' }}
      />
      {/* Hidden multi-file input for batch extraction */}
      <input
        ref={batchInputRef}
        type="file"
        accept=".pdf"
        multiple
        onChange={handleBatchPdfFiles}
        style={{ display: 'none' }}
      />

      {pasteToast && (
        <div style={toastStyle}>{pasteToast}</div>
      )}

      {/* Extraction toast */}
      {extractToast && (
        <div style={{
          ...toastStyle,
          background: extractToast.type === 'success' ? '#f0fdf4' : '#fef2f2',
          border: `1px solid ${extractToast.type === 'success' ? '#bbf7d0' : '#fecaca'}`,
          color: extractToast.type === 'success' ? '#16a34a' : '#dc2626',
        }}>
          {extractToast.message}
        </div>
      )}

      {/* Data completeness banner — shows when imported studies need data */}
      {emptyDataCount > 0 && !batchExtracting && (
        <div style={needsDataBannerStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', flexWrap: 'wrap', gap: 8 }}>
            <div>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#92400e' }}>
                {t('table.needsData', lang).replace('{n}', String(emptyDataCount))}
              </span>
              <span style={{ fontSize: 11, color: '#b45309', display: 'block', marginTop: 2 }}>
                {t('table.needsDataHint', lang)}
              </span>
            </div>
            <button
              onClick={() => batchInputRef.current?.click()}
              disabled={!!extractingId}
              style={{
                padding: '6px 14px',
                background: '#fef3c7',
                border: '1px solid #f59e0b',
                borderRadius: 6,
                cursor: extractingId ? 'default' : 'pointer',
                fontSize: 12,
                fontWeight: 600,
                color: '#92400e',
                opacity: extractingId ? 0.5 : 1,
                whiteSpace: 'nowrap',
              }}
            >
              {t('table.batchExtract', lang)}
            </button>
          </div>
        </div>
      )}
      {/* Batch extraction progress */}
      {batchExtracting && (
        <div style={{ ...needsDataBannerStyle, background: '#eff6ff', borderColor: '#bfdbfe' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', gap: 8 }}>
            <div>
              <span style={{ fontSize: 12, fontWeight: 500, color: '#1e40af' }}>
                {t('table.batchExtractProgress', lang)
                  .replace('{done}', String(batchProgress.done))
                  .replace('{total}', String(batchProgress.total))}
              </span>
              <div style={{ height: 4, background: '#dbeafe', borderRadius: 2, marginTop: 4, width: 200 }}>
                <div style={{ height: '100%', background: '#2563eb', borderRadius: 2, width: `${batchProgress.total > 0 ? (batchProgress.done / batchProgress.total) * 100 : 0}%`, transition: 'width 0.3s' }} />
              </div>
            </div>
            <button onClick={cancelBatchExtract} style={{ padding: '4px 10px', background: '#fff', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 11, cursor: 'pointer', color: '#374151' }}>
              {lang === 'zh' ? '取消' : 'Cancel'}
            </button>
          </div>
        </div>
      )}

      {/* Batch action bar */}
      {someSelected && (
        <div style={batchBarStyle}>
          <span style={{ fontSize: 12, color: '#374151', fontWeight: 500 }}>
            {t('table.selected', lang).replace('{n}', String(selectedIds.size))}
          </span>
          <button onClick={batchDelete} style={batchDeleteBtnStyle}>
            {t('table.batchDelete', lang)}
          </button>
          {!showSubgroupInput ? (
            <button onClick={() => setShowSubgroupInput(true)} style={batchActionBtnStyle}>
              {t('table.batchSubgroup', lang)}
            </button>
          ) : (
            <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
              <input
                type="text"
                value={batchSubgroup}
                onChange={(e) => setBatchSubgroup(e.target.value)}
                placeholder={t('table.batchSubgroupPrompt', lang)}
                style={{ padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 12, width: 120 }}
                onKeyDown={(e) => { if (e.key === 'Enter') applyBatchSubgroup(); if (e.key === 'Escape') setShowSubgroupInput(false); }}
                autoFocus
              />
              <button onClick={applyBatchSubgroup} style={batchActionBtnStyle} disabled={!batchSubgroup.trim()}>
                {t('table.batchSubgroupApply', lang)}
              </button>
            </span>
          )}
        </div>
      )}

      {/* Validation summary — real-time error/warning count */}
      {studies.length > 0 && (validationSummary.errors > 0 || validationSummary.warnings > 0) && (
        <div style={{
          display: 'flex',
          gap: 12,
          alignItems: 'center',
          padding: '6px 12px',
          background: validationSummary.errors > 0 ? '#fef2f2' : '#fffbeb',
          border: `1px solid ${validationSummary.errors > 0 ? '#fecaca' : '#fde68a'}`,
          borderRadius: 6,
          marginBottom: 8,
          fontSize: 12,
        }}>
          {validationSummary.errors > 0 && (
            <span style={{ color: '#dc2626', fontWeight: 500 }}>
              {t('table.validationErrors', lang).replace('{n}', String(validationSummary.errors))}
            </span>
          )}
          {validationSummary.warnings > 0 && (
            <span style={{ color: '#d97706', fontWeight: 500 }}>
              {t('table.validationWarnings', lang).replace('{n}', String(validationSummary.warnings))}
            </span>
          )}
        </div>
      )}

      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <table ref={tableRef} style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13, minWidth: 520 }}>
          <thead>
            <tr>
              <th scope="col" style={{ ...thStyle, width: '28px', padding: '8px 2px' }}>
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleSelectAll}
                  aria-label={t('table.selectAll', lang)}
                  title={t('table.selectAll', lang)}
                  style={{ cursor: 'pointer' }}
                />
              </th>
              <th scope="col" style={thStyle}>#</th>
              {columns.map((col) => (
                <th key={col.key} scope="col" style={{ ...thStyle, width: col.width }}>
                  {col.label}
                </th>
              ))}
              <th scope="col" style={thStyle}></th>
            </tr>
          </thead>
          <tbody>
            {studies.map((study, idx) => {
              const isEmpty = isStudyDataEmpty(study, measure);
              const isExtracting = extractingId === study.id;
              return (
                <tr
                  key={study.id}
                  style={{
                    background: selectedIds.has(study.id) ? '#eff6ff' : idx % 2 ? '#f9fafb' : '#fff',
                    borderLeft: isEmpty ? '3px solid #f59e0b' : undefined,
                  }}
                >
                  <td style={{ ...tdStyle, padding: '4px 2px', textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(study.id)}
                      onChange={() => toggleSelect(study.id)}
                      style={{ cursor: 'pointer' }}
                    />
                  </td>
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
                  <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                    {/* Per-row PDF extract button for empty studies */}
                    {isEmpty && (
                      <button
                        onClick={() => startPdfExtract(study.id)}
                        disabled={isExtracting || !!extractingId}
                        style={{
                          ...extractBtnStyle,
                          opacity: isExtracting || !!extractingId ? 0.5 : 1,
                          cursor: isExtracting || !!extractingId ? 'default' : 'pointer',
                        }}
                        aria-label={`${t('table.extractPdf', lang)} ${study.name || `Study ${idx + 1}`}`}
                        title={t('table.extractPdf', lang)}
                      >
                        {isExtracting ? (
                          <span style={{ fontSize: 11 }}>
                            {extractProgress ? `${extractProgress.percent}%` : '...'}
                          </span>
                        ) : (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                            📄
                            <span style={{ fontSize: 10 }}>PDF</span>
                          </span>
                        )}
                      </button>
                    )}
                    <button
                      onClick={() => removeStudy(study.id)}
                      style={deleteBtnStyle}
                      aria-label={`Remove ${study.name || `Study ${idx + 1}`}`}
                      title="Remove study"
                      tabIndex={-1}
                    >
                      &times;
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <button onClick={addStudy} style={addBtnStyle}>
          {t('table.addStudy', lang)}
        </button>
        {onUndo && (
          <button onClick={onUndo} style={{ ...undoBtnStyle, opacity: canUndo ? 1 : 0.4 }} disabled={!canUndo} title={t('table.undo', lang)}>
            {t('table.undo', lang)}
          </button>
        )}
        {onRedo && (
          <button onClick={onRedo} style={{ ...undoBtnStyle, opacity: canRedo ? 1 : 0.4 }} disabled={!canRedo} title={t('table.redo', lang)}>
            {t('table.redo', lang)}
          </button>
        )}
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
        <button onClick={() => risInputRef.current?.click()} style={csvBtnStyle}>
          {t('table.importRIS', lang)}
        </button>
        <input
          ref={risInputRef}
          type="file"
          accept=".ris,.enw"
          onChange={handleImportRIS}
          style={{ display: 'none' }}
        />
        {studies.length > 0 && (
          <span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 'auto' }}>
            {t('table.navHint', lang)} · {t('table.pasteTip', lang)}
          </span>
        )}
      </div>

      {studies.length === 0 && (
        <div style={emptyGuideContainerStyle}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#374151', marginBottom: 12 }}>
            {t('table.emptyGuide.title', lang)}
          </div>
          <div style={emptyGuideGridStyle}>
            <button onClick={addStudy} style={emptyGuideCardStyle}>
              <span style={{ fontSize: 20 }}>+</span>
              <span style={{ fontWeight: 600, fontSize: 13 }}>{t('table.emptyGuide.manual', lang)}</span>
              <span style={{ fontSize: 11, color: '#6b7280' }}>{t('table.emptyGuide.manualDesc', lang)}</span>
            </button>
            <div style={{ ...emptyGuideCardStyle, cursor: 'default', borderStyle: 'dashed' }}>
              <span style={{ fontSize: 20 }}>📋</span>
              <span style={{ fontWeight: 600, fontSize: 13 }}>{t('table.emptyGuide.paste', lang)}</span>
              <span style={{ fontSize: 11, color: '#6b7280' }}>{t('table.emptyGuide.pasteDesc', lang)}</span>
            </div>
            <button onClick={() => fileInputRef.current?.click()} style={emptyGuideCardStyle}>
              <span style={{ fontSize: 20 }}>📁</span>
              <span style={{ fontWeight: 600, fontSize: 13 }}>{t('table.emptyGuide.csv', lang)}</span>
              <span style={{ fontSize: 11, color: '#6b7280' }}>{t('table.emptyGuide.csvDesc', lang)}</span>
            </button>
            {onLoadDemo && (
              <button onClick={onLoadDemo} style={emptyGuideCardStyle}>
                <span style={{ fontSize: 20 }}>📊</span>
                <span style={{ fontWeight: 600, fontSize: 13 }}>{t('table.emptyGuide.demo', lang)}</span>
                <span style={{ fontSize: 11, color: '#6b7280' }}>{t('table.emptyGuide.demoDesc', lang)}</span>
              </button>
            )}
          </div>
        </div>
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

const undoBtnStyle: React.CSSProperties = {
  padding: '7px 10px',
  background: '#fff',
  border: '1px solid #d1d5db',
  borderRadius: 6,
  cursor: 'pointer',
  fontSize: 12,
  color: '#374151',
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

const batchBarStyle: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  alignItems: 'center',
  padding: '8px 12px',
  background: '#eff6ff',
  border: '1px solid #bfdbfe',
  borderRadius: 6,
  marginBottom: 8,
  flexWrap: 'wrap',
};

const batchDeleteBtnStyle: React.CSSProperties = {
  padding: '5px 12px',
  background: '#fef2f2',
  border: '1px solid #fecaca',
  borderRadius: 4,
  cursor: 'pointer',
  fontSize: 12,
  color: '#dc2626',
  fontWeight: 500,
};

const batchActionBtnStyle: React.CSSProperties = {
  padding: '5px 12px',
  background: '#fff',
  border: '1px solid #d1d5db',
  borderRadius: 4,
  cursor: 'pointer',
  fontSize: 12,
  color: '#374151',
};

const needsDataBannerStyle: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  alignItems: 'center',
  padding: '8px 12px',
  background: '#fffbeb',
  border: '1px solid #fde68a',
  borderRadius: 6,
  marginBottom: 8,
  flexWrap: 'wrap',
};

const extractBtnStyle: React.CSSProperties = {
  background: 'none',
  border: '1px solid #fde68a',
  borderRadius: 4,
  padding: '2px 6px',
  fontSize: 14,
  cursor: 'pointer',
  marginRight: 2,
  lineHeight: 1,
};

const emptyGuideContainerStyle: React.CSSProperties = {
  textAlign: 'center',
  marginTop: 24,
  padding: '24px 16px',
  background: '#f9fafb',
  borderRadius: 8,
  border: '1px solid #e5e7eb',
};

const emptyGuideGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
  gap: 12,
  maxWidth: 600,
  margin: '0 auto',
};

const emptyGuideCardStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 4,
  padding: '16px 12px',
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: 8,
  cursor: 'pointer',
  color: '#374151',
  transition: 'border-color 0.15s, box-shadow 0.15s',
};
