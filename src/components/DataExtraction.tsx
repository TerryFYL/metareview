import { useCallback, useRef, useState } from 'react';
import { extractTextFromPDF, isScannedPDF, type PageText } from '../lib/extraction/pdf-parser';
import {
  extractFromText,
  type ExtractionProgress,
  type ExtractionResult,
  type EffectSizeResult,
  type SampleSizesResult,
  type EventsResult,
  type ContinuousResult,
} from '../lib/extraction/extraction-client';
import { trackFeature } from '../lib/analytics';
import { t } from '../lib/i18n';
import type { Lang } from '../lib/i18n';
import type { EffectMeasure, Study } from '../lib/types';

interface Props {
  lang: Lang;
  measure: EffectMeasure;
  studies: Study[];
  onStudiesChange: (studies: Study[]) => void;
  onSwitchToInput: () => void;
}

type StudyType = 'binary' | 'continuous';

interface QueueItem {
  file: File;
  status: 'pending' | 'parsing' | 'extracting' | 'done' | 'error';
  error?: string;
  results?: ExtractionResult[];
}

export default function DataExtraction({ lang, measure, studies, onStudiesChange, onSwitchToInput }: Props) {
  // PDF state
  const [pages, setPages] = useState<PageText[]>([]);
  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set());
  const [fileName, setFileName] = useState('');
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Extraction state
  const [studyType, setStudyType] = useState<StudyType>(
    measure === 'MD' || measure === 'SMD' ? 'continuous' : 'binary'
  );
  const [extracting, setExtracting] = useState(false);
  const [progress, setProgress] = useState<ExtractionProgress | null>(null);
  const [results, setResults] = useState<ExtractionResult[]>([]);
  const [extractError, setExtractError] = useState<string | null>(null);

  // Inline editing state: maps result index to edited data object
  const [editedValues, setEditedValues] = useState<Record<number, Record<string, unknown>>>({});
  const [editingIdx, setEditingIdx] = useState<string | null>(null);

  // Batch queue state
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [batchProcessing, setBatchProcessing] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Handle PDF file upload
  const handleFile = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setPdfError(lang === 'zh' ? '请选择 PDF 文件' : 'Please select a PDF file');
      return;
    }

    setLoading(true);
    setPdfError(null);
    setPages([]);
    setSelectedPages(new Set());
    setResults([]);
    setFileName(file.name);

    try {
      trackFeature('pdf_upload');
      const extracted = await extractTextFromPDF(file);

      if (isScannedPDF(extracted)) {
        setPdfError(t('extract.scannedPdf', lang));
        setLoading(false);
        return;
      }

      setPages(extracted);
      // Auto-select all pages initially
      setSelectedPages(new Set(extracted.map(p => p.pageNum)));
    } catch (err) {
      setPdfError(err instanceof Error ? err.message : 'PDF parsing failed');
    } finally {
      setLoading(false);
    }
  }, [lang]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files).filter(f => f.name.toLowerCase().endsWith('.pdf'));
    if (files.length === 1) handleFile(files[0]);
    else if (files.length > 1) startBatch(files);
  }, [handleFile]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).filter(f => f.name.toLowerCase().endsWith('.pdf'));
    if (files.length === 1) handleFile(files[0]);
    else if (files.length > 1) startBatch(files);
  }, [handleFile]);

  // Batch processing: parse + extract all files sequentially
  const startBatch = useCallback(async (files: File[]) => {
    const items: QueueItem[] = files.map(f => ({ file: f, status: 'pending' as const }));
    setQueue(items);
    setPages([]);
    setResults([]);
    setFileName('');
    setBatchProcessing(true);

    const abort = new AbortController();
    abortRef.current = abort;

    for (let i = 0; i < files.length; i++) {
      if (abort.signal.aborted) break;

      setQueue(prev => prev.map((q, j) => j === i ? { ...q, status: 'parsing' } : q));
      try {
        trackFeature('pdf_upload');
        const parsed = await extractTextFromPDF(files[i]);
        if (isScannedPDF(parsed)) {
          setQueue(prev => prev.map((q, j) => j === i ? { ...q, status: 'error', error: t('extract.scannedPdf', lang) } : q));
          continue;
        }
        const text = parsed.map(p => p.text).join('\n\n');
        if (text.trim().length < 50) {
          setQueue(prev => prev.map((q, j) => j === i ? { ...q, status: 'error', error: lang === 'zh' ? '文字过少' : 'Too little text' } : q));
          continue;
        }

        setQueue(prev => prev.map((q, j) => j === i ? { ...q, status: 'extracting' } : q));
        trackFeature('extract_start');
        const extractionResults = await extractFromText(text, studyType, () => {}, abort.signal);
        setQueue(prev => prev.map((q, j) => j === i ? { ...q, status: 'done', results: extractionResults } : q));
        trackFeature('extract_complete');
      } catch (err) {
        if ((err as Error).name === 'AbortError') break;
        setQueue(prev => prev.map((q, j) => j === i ? { ...q, status: 'error', error: (err as Error).message } : q));
      }
    }
    setBatchProcessing(false);
  }, [studyType, lang]);

  // Add all batch results to study table
  const addBatchToStudies = useCallback(() => {
    const newStudies: Study[] = [];
    for (const item of queue) {
      if (item.status !== 'done' || !item.results) continue;
      const fName = item.file.name;
      const sampleResult = item.results.find(r => r.queryType === 'sample_sizes');
      const sizes = sampleResult?.data as SampleSizesResult | undefined;
      const outcomes = item.results.filter(r => r.queryType === 'effect_size');

      for (const outcome of outcomes) {
        const outcomeName = outcome.outcome || 'Outcome';
        if (studyType === 'binary') {
          const eventsResult = item.results.find(r => r.queryType === 'events' && r.outcome === outcome.outcome);
          const events = eventsResult?.data as EventsResult | undefined;
          if (events?.treatment_events != null && events?.control_events != null && sizes?.treatment_n != null && sizes?.control_n != null) {
            newStudies.push({
              id: crypto.randomUUID(),
              name: `${fName.replace('.pdf', '')} — ${outcomeName}`,
              data: { events1: events.treatment_events, total1: sizes.treatment_n, events2: events.control_events, total2: sizes.control_n },
            });
          }
        } else {
          const contResult = item.results.find(r => r.queryType === 'continuous' && r.outcome === outcome.outcome);
          const cont = contResult?.data as ContinuousResult | undefined;
          if (cont?.treatment_mean != null && cont?.treatment_sd != null && cont?.control_mean != null && cont?.control_sd != null && sizes?.treatment_n != null && sizes?.control_n != null) {
            newStudies.push({
              id: crypto.randomUUID(),
              name: `${fName.replace('.pdf', '')} — ${outcomeName}`,
              data: { mean1: cont.treatment_mean, sd1: cont.treatment_sd, n1: sizes.treatment_n, mean2: cont.control_mean, sd2: cont.control_sd, n2: sizes.control_n },
            });
          }
        }
      }
    }
    if (newStudies.length > 0) {
      onStudiesChange([...studies, ...newStudies]);
      trackFeature('extract_batch_add');
      onSwitchToInput();
    }
  }, [queue, studyType, studies, onStudiesChange, onSwitchToInput]);

  const togglePage = useCallback((pageNum: number) => {
    setSelectedPages(prev => {
      const next = new Set(prev);
      if (next.has(pageNum)) next.delete(pageNum);
      else next.add(pageNum);
      return next;
    });
  }, []);

  // Run extraction
  const startExtraction = useCallback(async () => {
    if (selectedPages.size === 0) return;

    const selectedText = pages
      .filter(p => selectedPages.has(p.pageNum))
      .map(p => p.text)
      .join('\n\n');

    if (selectedText.trim().length < 50) {
      setExtractError(lang === 'zh' ? '选中页面文字过少，请选择包含结果数据的页面' : 'Selected pages have too little text');
      return;
    }

    setExtracting(true);
    setExtractError(null);
    setResults([]);
    abortRef.current = new AbortController();

    try {
      trackFeature('extract_start');
      const extractionResults = await extractFromText(
        selectedText,
        studyType,
        setProgress,
        abortRef.current.signal
      );
      setResults(extractionResults);
      trackFeature('extract_complete');
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setExtractError(err instanceof Error ? err.message : 'Extraction failed');
      }
    } finally {
      setExtracting(false);
      setProgress(null);
    }
  }, [pages, selectedPages, studyType, lang]);

  const cancelExtraction = useCallback(() => {
    abortRef.current?.abort();
    setExtracting(false);
    setProgress(null);
  }, []);

  const resetAll = useCallback(() => {
    setPages([]);
    setSelectedPages(new Set());
    setFileName('');
    setPdfError(null);
    setResults([]);
    setExtractError(null);
    setEditedValues({});
    setEditingIdx(null);
    setQueue([]);
    setBatchProcessing(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  /** Get effective data for a result, merging in any user edits */
  const getEffectiveData = useCallback((idx: number): ExtractionResult['data'] => {
    const original = results[idx]?.data;
    const edits = editedValues[idx];
    if (!edits) return original;
    return { ...original, ...edits } as ExtractionResult['data'];
  }, [results, editedValues]);

  /** Update a single field for a result */
  const updateExtractedField = useCallback((resultIdx: number, field: string, value: string) => {
    const numVal = parseFloat(value);
    setEditedValues(prev => ({
      ...prev,
      [resultIdx]: {
        ...prev[resultIdx],
        [field]: isNaN(numVal) ? value : numVal,
      },
    }));
  }, []);

  // Add extracted data to study table (uses edited values when available)
  const addToStudies = useCallback(() => {
    // Build effective results with edits merged in
    const effectiveResults = results.map((r, i) => ({
      ...r,
      data: getEffectiveData(i),
    }));

    const sampleResult = effectiveResults.find(r => r.queryType === 'sample_sizes');
    const sizes = sampleResult?.data as SampleSizesResult | undefined;
    const outcomes = effectiveResults.filter(r => r.queryType === 'effect_size');

    const newStudies: Study[] = [];
    for (const outcome of outcomes) {
      const outcomeName = outcome.outcome || 'Outcome';

      if (studyType === 'binary') {
        const eventsResult = effectiveResults.find(
          r => r.queryType === 'events' && r.outcome === outcome.outcome
        );
        const events = eventsResult?.data as EventsResult | undefined;

        if (events?.treatment_events != null && events?.control_events != null &&
            sizes?.treatment_n != null && sizes?.control_n != null) {
          newStudies.push({
            id: crypto.randomUUID(),
            name: `${fileName.replace('.pdf', '')} — ${outcomeName}`,
            data: {
              events1: events.treatment_events,
              total1: sizes.treatment_n,
              events2: events.control_events,
              total2: sizes.control_n,
            },
          });
        }
      } else {
        const contResult = effectiveResults.find(
          r => r.queryType === 'continuous' && r.outcome === outcome.outcome
        );
        const cont = contResult?.data as ContinuousResult | undefined;

        if (cont?.treatment_mean != null && cont?.treatment_sd != null &&
            cont?.control_mean != null && cont?.control_sd != null &&
            sizes?.treatment_n != null && sizes?.control_n != null) {
          newStudies.push({
            id: crypto.randomUUID(),
            name: `${fileName.replace('.pdf', '')} — ${outcomeName}`,
            data: {
              mean1: cont.treatment_mean,
              sd1: cont.treatment_sd,
              n1: sizes.treatment_n,
              mean2: cont.control_mean,
              sd2: cont.control_sd,
              n2: sizes.control_n,
            },
          });
        }
      }
    }

    if (newStudies.length > 0) {
      onStudiesChange([...studies, ...newStudies]);
      trackFeature('extract_add_study');
      onSwitchToInput();
    }
  }, [results, editedValues, getEffectiveData, studyType, fileName, studies, onStudiesChange, onSwitchToInput]);

  const hasExtractableData = results.some(
    r => (r.queryType === 'effect_size' || r.queryType === 'events' || r.queryType === 'continuous')
      && r.confidence !== 'low'
  );

  return (
    <div>
      <h2 style={h2Style}>{t('extract.title', lang)}</h2>
      <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>
        {t('extract.subtitle', lang)}
      </p>

      {/* Disclaimer banner */}
      <div style={disclaimerStyle}>
        {t('extract.disclaimer', lang)}
      </div>

      {/* PDF Upload */}
      {pages.length === 0 && queue.length === 0 && (
        <div>
          {/* Study type selector */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>
              {lang === 'zh' ? '数据类型' : 'Data Type'}
            </label>
            <div style={{ display: 'flex', gap: 12 }}>
              <label style={{ fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                <input
                  type="radio"
                  checked={studyType === 'binary'}
                  onChange={() => setStudyType('binary')}
                />
                {t('extract.studyType.binary', lang)}
              </label>
              <label style={{ fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                <input
                  type="radio"
                  checked={studyType === 'continuous'}
                  onChange={() => setStudyType('continuous')}
                />
                {t('extract.studyType.continuous', lang)}
              </label>
            </div>
          </div>

          {/* Upload dropzone */}
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => fileInputRef.current?.click()}
            style={dropzoneStyle}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              multiple
              onChange={handleInputChange}
              style={{ display: 'none' }}
            />
            {loading ? (
              <div style={{ color: '#2563eb' }}>
                {lang === 'zh' ? '正在解析 PDF...' : 'Parsing PDF...'}
              </div>
            ) : (
              <>
                <div style={{ fontSize: 36, marginBottom: 8 }}>📄</div>
                <div style={{ fontSize: 14, fontWeight: 500, color: '#374151' }}>
                  {t('extract.upload', lang)}
                </div>
                <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>
                  {t('extract.uploadHint', lang)}
                </div>
              </>
            )}
          </div>

          {pdfError && (
            <div style={errorStyle}>{pdfError}</div>
          )}
        </div>
      )}

      {/* Batch Queue */}
      {queue.length > 0 && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>
              {batchProcessing ? t('extract.batchProgress', lang) : t('extract.batchDone', lang)}
              {' '}({queue.filter(q => q.status === 'done').length}/{queue.length})
            </h3>
            <button onClick={() => { abortRef.current?.abort(); resetAll(); }} style={secondaryBtnStyle}>
              {batchProcessing ? (lang === 'zh' ? '取消' : 'Cancel') : t('extract.reset', lang)}
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 400, overflowY: 'auto', marginBottom: 16 }}>
            {queue.map((item, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 14px', border: '1px solid #e5e7eb', borderRadius: 8,
                background: item.status === 'done' ? '#f0fdf4' : item.status === 'error' ? '#fef2f2' : item.status === 'pending' ? '#fff' : '#eff6ff',
              }}>
                <span style={{ fontSize: 16 }}>
                  {item.status === 'done' ? '\u2705' : item.status === 'error' ? '\u274c' : item.status === 'pending' ? '\u23f3' : '\u2699\ufe0f'}
                </span>
                <span style={{ flex: 1, fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.file.name}
                </span>
                <span style={{ fontSize: 12, color: item.status === 'error' ? '#dc2626' : '#6b7280', flexShrink: 0 }}>
                  {item.status === 'error' ? (item.error || t('extract.queueError', lang)) : t(`extract.queue${item.status.charAt(0).toUpperCase() + item.status.slice(1)}` as Parameters<typeof t>[0], lang)}
                </span>
                {item.status === 'done' && item.results && (
                  <span style={{ fontSize: 11, color: '#16a34a', flexShrink: 0 }}>
                    ({item.results.filter(r => r.queryType === 'effect_size').length} {lang === 'zh' ? '个结局' : 'outcomes'})
                  </span>
                )}
              </div>
            ))}
          </div>

          {!batchProcessing && queue.some(q => q.status === 'done') && (
            <button onClick={addBatchToStudies} style={primaryBtnStyle}>
              {t('extract.batchAdd', lang)}
            </button>
          )}
        </div>
      )}

      {/* Page Selection */}
      {pages.length > 0 && results.length === 0 && !extracting && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>
              {t('extract.selectPages', lang)} ({fileName})
            </h3>
            <button onClick={resetAll} style={secondaryBtnStyle}>
              {t('extract.reset', lang)}
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 400, overflowY: 'auto', marginBottom: 16 }}>
            {pages.map(page => (
              <label
                key={page.pageNum}
                style={{
                  ...pageItemStyle,
                  borderColor: selectedPages.has(page.pageNum) ? '#2563eb' : '#e5e7eb',
                  background: selectedPages.has(page.pageNum) ? '#eff6ff' : '#fff',
                }}
              >
                <input
                  type="checkbox"
                  checked={selectedPages.has(page.pageNum)}
                  onChange={() => togglePage(page.pageNum)}
                />
                <span style={{ fontWeight: 500 }}>
                  {t('extract.pagePreview', lang).replace('{page}', String(page.pageNum))}
                </span>
                <span style={{ color: '#9ca3af', fontSize: 11, marginLeft: 8 }}>
                  ({page.charCount} chars)
                </span>
                <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4, whiteSpace: 'pre-wrap', maxHeight: 60, overflow: 'hidden', width: '100%' }}>
                  {page.text.slice(0, 200)}...
                </div>
              </label>
            ))}
          </div>

          <button
            onClick={startExtraction}
            style={primaryBtnStyle}
            disabled={selectedPages.size === 0}
          >
            {t('extract.startExtract', lang)}
          </button>

          {extractError && <div style={errorStyle}>{extractError}</div>}
        </div>
      )}

      {/* Extraction Progress */}
      {extracting && progress && (
        <div style={{ padding: 24, textAlign: 'center' }}>
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 12 }}>
            {t('extract.extracting', lang)}
          </div>
          <div
            role="progressbar"
            aria-valuenow={progress.current}
            aria-valuemin={0}
            aria-valuemax={progress.total}
            aria-label={`${progress.current} / ${progress.total} — ${progress.currentQuery}`}
            style={progressBarContainerStyle}
          >
            <div style={{ ...progressBarStyle, width: `${(progress.current / progress.total) * 100}%` }} />
          </div>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 8 }} aria-hidden="true">
            {progress.current} / {progress.total} — {progress.currentQuery}
          </div>
          <button onClick={cancelExtraction} style={{ ...secondaryBtnStyle, marginTop: 12 }}>
            {t('extract.cancel', lang)}
          </button>
        </div>
      )}

      {/* Results Table */}
      {results.length > 0 && !extracting && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>
              {t('extract.verify', lang)}
            </h3>
            <button onClick={resetAll} style={secondaryBtnStyle}>
              {t('extract.reset', lang)}
            </button>
          </div>

          <p style={{ fontSize: 11, color: '#6b7280', marginBottom: 8 }}>
            {t('extract.editHint', lang)}
          </p>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13, minWidth: 600 }}>
              <thead>
                <tr>
                  <th style={thStyle}>{lang === 'zh' ? '查询类型' : 'Query'}</th>
                  <th style={thStyle}>{t('extract.outcome', lang)}</th>
                  <th style={thStyle}>{lang === 'zh' ? '提取结果' : 'Extracted Value'}</th>
                  <th style={thStyle}>{lang === 'zh' ? '置信度' : 'Confidence'}</th>
                  <th style={thStyle}>{t('extract.sourceQuote', lang)}</th>
                </tr>
              </thead>
              <tbody>
                {results.filter(r => r.queryType !== 'outcomes').map((r, i) => {
                  const effectiveData = getEffectiveData(i) as unknown as Record<string, unknown>;
                  const isEdited = !!editedValues[i];
                  const editableFields = getEditableFields(r);
                  return (
                    <tr key={i} style={{ background: i % 2 ? '#f9fafb' : '#fff' }}>
                      <td style={tdStyle}>
                        {formatQueryType(r.queryType, lang)}
                        <span style={reliabilityBadgeStyle(r.queryType)}>
                          {t(`extract.reliability.${r.queryType}`, lang)}
                        </span>
                      </td>
                      <td style={tdStyle}>{r.outcome || '—'}</td>
                      <td style={{ ...tdStyle, fontFamily: 'monospace', minWidth: 160 }}>
                        {r.error ? `${r.error}` : editableFields.length > 0 ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            {editableFields.map(field => {
                              const cellKey = `${i}-${field.key}`;
                              const val = effectiveData[field.key];
                              const isEditingThis = editingIdx === cellKey;
                              return (
                                <div key={field.key} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                  <span style={{ fontSize: 10, color: '#9ca3af', minWidth: 20 }}>{field.label}:</span>
                                  {isEditingThis ? (
                                    <input
                                      type="number"
                                      step="any"
                                      defaultValue={val != null ? String(val) : ''}
                                      autoFocus
                                      onBlur={(e) => {
                                        setEditingIdx(null);
                                        if (e.target.value !== String(val)) {
                                          updateExtractedField(i, field.key, e.target.value);
                                        }
                                      }}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === 'Escape') {
                                          (e.target as HTMLInputElement).blur();
                                        }
                                      }}
                                      style={inlineEditInputStyle}
                                    />
                                  ) : (
                                    <span
                                      onClick={() => setEditingIdx(cellKey)}
                                      style={{
                                        cursor: 'pointer',
                                        padding: '1px 4px',
                                        borderRadius: 3,
                                        border: '1px solid transparent',
                                        transition: 'border-color 0.15s',
                                      }}
                                      onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#d1d5db')}
                                      onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'transparent')}
                                    >
                                      {val != null ? String(val) : '—'}
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                            {isEdited && (
                              <span style={{ fontSize: 10, color: '#2563eb', fontStyle: 'italic' }}>
                                {t('extract.edited', lang)}
                              </span>
                            )}
                          </div>
                        ) : formatValue(r)}
                      </td>
                      <td style={tdStyle}>
                        <span style={confidenceBadgeStyle(r.confidence)}>
                          {t(`extract.confidence.${r.confidence}`, lang)}
                        </span>
                      </td>
                      <td style={{ ...tdStyle, fontSize: 11, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {(r.data as { source_quote?: string }).source_quote || '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {extractError && <div style={errorStyle}>{extractError}</div>}

          <div style={{ marginTop: 16, display: 'flex', gap: 12 }}>
            {hasExtractableData && (
              <button onClick={addToStudies} style={primaryBtnStyle}>
                {t('extract.addToStudy', lang)}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** Get editable numeric fields for a result type */
function getEditableFields(r: ExtractionResult): Array<{ key: string; label: string }> {
  switch (r.queryType) {
    case 'effect_size':
      return [{ key: 'value', label: 'Val' }, { key: 'ci_lower', label: 'CI-' }, { key: 'ci_upper', label: 'CI+' }];
    case 'sample_sizes':
      return [{ key: 'treatment_n', label: 'T' }, { key: 'control_n', label: 'C' }];
    case 'events':
      return [{ key: 'treatment_events', label: 'T' }, { key: 'control_events', label: 'C' }];
    case 'continuous':
      return [
        { key: 'treatment_mean', label: 'T\u0304' }, { key: 'treatment_sd', label: 'SD-T' },
        { key: 'control_mean', label: 'C\u0304' }, { key: 'control_sd', label: 'SD-C' },
      ];
    default:
      return [];
  }
}

function formatQueryType(qt: string, lang: string): string {
  const labels: Record<string, [string, string]> = {
    effect_size: ['效应量', 'Effect Size'],
    sample_sizes: ['样本量', 'Sample Sizes'],
    events: ['事件数', 'Events'],
    continuous: ['均值/SD', 'Mean/SD'],
  };
  const pair = labels[qt];
  return pair ? (lang === 'zh' ? pair[0] : pair[1]) : qt;
}

function formatValue(r: ExtractionResult): string {
  if (r.error) return `❌ ${r.error}`;

  switch (r.queryType) {
    case 'effect_size': {
      const e = r.data as EffectSizeResult;
      if (e.value == null) return '—';
      return `${e.type || '?'} = ${e.value}${e.ci_lower != null ? ` [${e.ci_lower}, ${e.ci_upper}]` : ''}`;
    }
    case 'sample_sizes': {
      const s = r.data as SampleSizesResult;
      return s.treatment_n != null ? `T: ${s.treatment_n}, C: ${s.control_n}` : '—';
    }
    case 'events': {
      const ev = r.data as EventsResult;
      return ev.treatment_events != null ? `T: ${ev.treatment_events}, C: ${ev.control_events}` : '—';
    }
    case 'continuous': {
      const c = r.data as ContinuousResult;
      return c.treatment_mean != null
        ? `T: ${c.treatment_mean}±${c.treatment_sd}, C: ${c.control_mean}±${c.control_sd}`
        : '—';
    }
    default:
      return JSON.stringify(r.data);
  }
}

function reliabilityBadgeStyle(queryType: string): React.CSSProperties {
  const isValidated = queryType === 'effect_size';
  return {
    display: 'block',
    marginTop: 2,
    padding: '1px 6px',
    borderRadius: 8,
    fontSize: 10,
    fontWeight: 500,
    background: isValidated ? '#f0fdf4' : '#fff7ed',
    color: isValidated ? '#16a34a' : '#c2410c',
    border: `1px solid ${isValidated ? '#bbf7d0' : '#fed7aa'}`,
  };
}

function confidenceBadgeStyle(level: string): React.CSSProperties {
  const colors: Record<string, { bg: string; color: string; border: string }> = {
    high: { bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0' },
    medium: { bg: '#fffbeb', color: '#d97706', border: '#fde68a' },
    low: { bg: '#fef2f2', color: '#dc2626', border: '#fecaca' },
  };
  const c = colors[level] || colors.low;
  return {
    padding: '2px 8px',
    borderRadius: 10,
    fontSize: 11,
    fontWeight: 500,
    background: c.bg,
    color: c.color,
    border: `1px solid ${c.border}`,
  };
}

// Styles
const h2Style: React.CSSProperties = { fontSize: 15, fontWeight: 600, color: '#111827', marginBottom: 8 };
const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 };

const disclaimerStyle: React.CSSProperties = {
  padding: '10px 14px',
  background: '#fffbeb',
  border: '1px solid #fde68a',
  borderRadius: 8,
  fontSize: 12,
  color: '#92400e',
  marginBottom: 20,
};

const dropzoneStyle: React.CSSProperties = {
  border: '2px dashed #d1d5db',
  borderRadius: 12,
  padding: '40px 20px',
  textAlign: 'center',
  cursor: 'pointer',
  transition: 'border-color 0.2s',
};

const pageItemStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'flex-start',
  gap: 8,
  padding: '10px 14px',
  border: '1px solid #e5e7eb',
  borderRadius: 8,
  cursor: 'pointer',
  fontSize: 13,
};

const errorStyle: React.CSSProperties = {
  padding: '10px 14px',
  background: '#fef2f2',
  border: '1px solid #fecaca',
  borderRadius: 6,
  color: '#dc2626',
  fontSize: 13,
  marginTop: 12,
};

const primaryBtnStyle: React.CSSProperties = {
  padding: '11px 28px',
  background: '#7c3aed',
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
};

const secondaryBtnStyle: React.CSSProperties = {
  padding: '7px 14px',
  background: '#f3f4f6',
  color: '#374151',
  border: '1px solid #d1d5db',
  borderRadius: 6,
  fontSize: 12,
  cursor: 'pointer',
};

const progressBarContainerStyle: React.CSSProperties = {
  width: '100%',
  height: 8,
  background: '#e5e7eb',
  borderRadius: 4,
  overflow: 'hidden',
};

const progressBarStyle: React.CSSProperties = {
  height: '100%',
  background: 'linear-gradient(90deg, #7c3aed, #2563eb)',
  borderRadius: 4,
  transition: 'width 0.3s ease',
};

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
  fontSize: 13,
};

const inlineEditInputStyle: React.CSSProperties = {
  width: 70,
  padding: '2px 4px',
  border: '1px solid #2563eb',
  borderRadius: 3,
  fontSize: 12,
  fontFamily: 'monospace',
  outline: 'none',
  background: '#eff6ff',
};
